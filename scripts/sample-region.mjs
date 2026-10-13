/**
 * sample-region.mjs — measure colour variance inside a rectangle of a capture.
 *
 * Two jobs, both of which `check-contrast.mjs` cannot do:
 *
 *   1. Confirm a texture or gradient actually ships WHERE the design says it
 *      does. Sampling a convenient strip is not the same as sampling the
 *      rectangle that matters: a pattern can read dozens of colours just above
 *      the header and still be covered by an opaque block inside the first
 *      viewport. Name the rectangle you actually care about and measure that.
 *      A region carrying a texture reads dozens-to-hundreds of colours with a
 *      non-zero luminance range; a region painted over reads 1 and 0.0.
 *
 *   2. Check text that sits over a PHOTOGRAPH. The token audit compares two
 *      named colours, but a hero caption's background is not a token — it is
 *      whatever the image happens to be at that pixel. Pass the text colour
 *      and this reports the worst case: that colour against the brightest
 *      pixel in the region.
 *
 *   node scripts/sample-region.mjs <png> <x> <y> <w> <h> [label] [#textHex]
 *
 * PNG decoding is done here rather than with a dependency so the check runs
 * in a clean checkout with no install step, matching the rest of the project.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/* --- Minimal PNG reader: 8-bit truecolour, with or without alpha ---------- */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colorType = data[9];
      if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
      if (colorType === 2) channels = 3;
      else if (colorType === 6) channels = 4;
      else throw new Error(`unsupported colour type ${colorType}`);
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    pos += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  /* Undo the per-scanline filters (PNG spec 9.2). */
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    const up = dst - stride;

    for (let i = 0; i < stride; i += 1) {
      const x = raw[src + i];
      const a = i >= channels ? out[dst + i - channels] : 0;
      const b = y > 0 ? out[up + i] : 0;
      const c = i >= channels && y > 0 ? out[up + i - channels] : 0;
      let v;

      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`bad filter ${filter} on row ${y}`);

      out[dst + i] = v & 0xff;
    }
  }

  return { width, height, channels, data: out };
}

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/* WCAG relative luminance and contrast, so a sampled region can be checked
   against the text that sits on it. This is the part a token-pair audit cannot
   do: when text sits over a photograph the background is not a token, it is
   whatever the image happens to be at that pixel. */
const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const relLum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
};
const parseHex = (h) => {
  const v = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};

function sample(png, x0, y0, w, h) {
  const { width, height, channels, data } = png;
  const seen = new Set();
  let min = Infinity;
  let max = -Infinity;
  let worstLum = null;
  let n = 0;

  for (let y = y0; y < Math.min(y0 + h, height); y += 1) {
    for (let x = x0; x < Math.min(x0 + w, width); x += 1) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      seen.add((r << 16) | (g << 8) | b);
      const l = luminance(r, g, b);
      if (l < min) min = l;
      if (l > max) max = l;
      /* Worst case for light text is the brightest background pixel. */
      if (worstLum === null || l > worstLum.l) worstLum = { l, rgb: [r, g, b] };
      n += 1;
    }
  }

  return { colors: seen.size, range: max - min, pixels: n, brightest: worstLum };
}

const [file, x, y, w, h, label, textHex] = process.argv.slice(2);
if (!file || x === undefined) {
  console.error('usage: node scripts/sample-region.mjs <png> <x> <y> <w> <h> [label] [#textHex]');
  process.exit(2);
}

const png = decodePng(readFileSync(file));
const r = sample(png, +x, +y, +w, +h);
const name = label || `${x},${y} ${w}x${h}`;

let line =
  `  ${String(r.colors).padStart(5)} colours  ` +
  `range ${r.range.toFixed(1).padStart(6)}  ` +
  `${r.pixels}px  ${name}`;

if (textHex) {
  const [tr, tg, tb] = parseHex(textHex);
  const tl = relLum(tr, tg, tb);
  const [br, bg, bb] = r.brightest.rgb;
  const worst = ratio(tl, relLum(br, bg, bb));
  line += `
      worst-case ${worst.toFixed(2)}:1  ` +
    `(${textHex} on brightest bg rgb(${br},${bg},${bb}))`;
}

console.log(line);
