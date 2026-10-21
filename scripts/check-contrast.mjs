/**
 * WCAG 2.1 contrast audit.
 *
 *   npm run contrast
 *
 * Reads the live colour tokens out of the stylesheets so it cannot drift from
 * the design system, then checks every foreground/background pair the site
 * actually renders.
 *
 * Thresholds: 4.5:1 normal text, 3:1 large text (>=24px, or >=19px bold) and
 * non-text UI boundaries (WCAG 1.4.11).
 *
 * A pair may also fail before it is measured: any hardcoded colour that no
 * stylesheet ships is reported as STALE and exits non-zero, because a pass
 * against a colour the browser never paints is a false pass.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Read the stylesheets in the order the browser links them, so a token
   redefined in a later sheet audits as the value that actually paints. Only
   styles.css declares tokens today; the loop is here so that stops being a
   silent assumption the day a second sheet does. */
const SHEETS = ['styles.css', 'store.css', 'admin.css'];
const sources = SHEETS.map((name) => readFileSync(join(root, 'assets', name), 'utf8'));
const allCss = sources.join('\n');

/* --- Pull the tokens straight from :root --------------------------------- */
const tokens = {};
for (const css of sources) {
  for (const [, name, value] of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens[name] = value; // later sheet wins, as in the cascade
  }
}

const T = (name) => {
  if (!tokens[name]) throw new Error(`Token --${name} not found in ${SHEETS.join(', ')}`);
  return tokens[name];
};

/* --- Colour maths --------------------------------------------------------- */
function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function ratio(fg, bg) {
  const a = luminance(Array.isArray(fg) ? fg : rgb(fg));
  const b = luminance(Array.isArray(bg) ? bg : rgb(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Composite a translucent white over a solid background. */
const whiteOver = (alpha, bg) => rgb(bg).map((c) => 255 * alpha + c * (1 - alpha));

/* --- The pairs the site actually renders ---------------------------------- */
const NORMAL = 4.5;
const LARGE = 3;
const UI = 3;

const checks = [
  ['body text', T('ink'), T('surface'), NORMAL],
  ['secondary text on white', T('muted'), T('surface'), NORMAL],
  ['secondary text on soft panel', T('muted'), T('soft'), NORMAL],
  ['small caps / meta text', T('muted-soft'), T('surface'), NORMAL],
  ['eyebrow + link red on white', T('red'), T('surface'), NORMAL],
  ['price, large display', T('red'), T('surface'), LARGE],
  ['primary button label', T('surface'), T('red'), NORMAL],
  ['primary button hover', T('surface'), T('red-bright'), NORMAL],
  ['tag on red tint', T('red-dark'), T('red-tint'), NORMAL],
  ['stock: in stock', T('ok'), T('surface'), NORMAL],
  ['stock: low', T('warn'), T('surface'), NORMAL],
  ['badge paid', '#0f7a43', '#e7f6ee', NORMAL],
  ['badge pending', '#9a5b00', '#fdf3e0', NORMAL],
  ['badge fulfilled', '#2c4a86', '#e9eef7', NORMAL],
  ['badge cancelled / toggle off', '#63696f', T('soft-2'), NORMAL],
  ['badge refunded', T('red-dark'), T('red-tint'), NORMAL],
  ['tier platinum', '#3a4250', '#eef1f5', NORMAL],
  ['tier gold', '#8a6100', '#fbf3e0', NORMAL],
  ['tier silver', '#55606a', '#eef2f4', NORMAL],
  ['admin brand accent on rail', '#ff5a6e', T('ink-deep'), NORMAL],
  ['admin table header', T('muted'), T('soft'), NORMAL],
  ['form error text', T('red-dark'), T('surface'), NORMAL],
  ['form success text', T('ok'), T('surface'), NORMAL],
  ['input text on soft', T('ink'), T('soft'), NORMAL],
  ['shipping catch-all warning', T('warn'), '#fff8ec', NORMAL],
  // Player initials stand in for a portrait, so they audit as large text.
  ['player photo placeholder initials', T('red-dark'), T('soft-2'), LARGE],
  ['placeholder / helper on soft', T('muted'), T('soft'), NORMAL],

  // Recognitions: the year is display-scale, so it audits as large text.
  ['recognition year', T('red'), T('surface'), LARGE],
  ['recognition body', T('ink'), T('surface'), NORMAL],
  ['recognition note', T('muted-soft'), T('surface'), NORMAL],

  // News: the "view full screen" hint and the lightbox close, both white on the
  // near-black photo backdrop.
  ['photo hint / lightbox close', '#ffffff', T('ink-deep'), NORMAL],

  // Notice: a page-level message on the red wash, with its accent bar.
  ['notice text on red tint', T('ink'), T('red-tint'), NORMAL],
  ['notice accent bar (1.4.11)', T('red'), T('red-tint'), UI],
  ['notice info bar (1.4.11)', T('ink-deep'), T('soft'), UI],

  // Non-text: the boundary that identifies an interactive control.
  ['control border on white (1.4.11)', T('line-input'), T('surface'), UI],
  ['control border on soft (1.4.11)', T('line-input'), T('soft'), UI],
  ['focus ring (1.4.11)', T('red'), T('surface'), UI],
];

const alphaChecks = [
  /* The hero is `background: var(--ink-deep)` with a photo and a gradient
     stack over it. --ink-deep is the declared base and the overlay's darkest
     stop, so it is the honest token to audit; the composited photo case is
     what scripts/sample-region.mjs measures, which a token pair cannot. */
  ['hero paragraph', 0.86, T('ink-deep'), NORMAL],
  ['scroll cue', 0.62, T('ink-deep'), NORMAL],
  ['footer body text', 0.7, T('ink-deep'), NORMAL],
  ['footer links', 0.66, T('ink-deep'), NORMAL],
  ['footer legal links', 0.72, T('ink-deep'), NORMAL],
  ['footer about text', 0.6, T('ink-deep'), NORMAL],
  ['admin nav links', 0.68, T('ink-deep'), NORMAL],
  ['admin rail buttons', 0.78, T('steel'), NORMAL],
  /* .admin-user is rgba(255,255,255,0.06) over .admin-rail's --ink-deep. The
     6% wash only lightens the ground, so auditing against --ink-deep itself is
     the conservative floor: the rendered ratio is never worse than this. */
  ['admin user block', 0.6, T('ink-deep'), NORMAL],
];

/* --- Drift guard: never audit a colour the site does not ship -------------
   A pair whose literal appears in no stylesheet is measuring something the
   browser never paints, so a pass from it is worth nothing. Three pairs in
   this file were doing exactly that (#0b0f12, #0d0f13) -- close enough to the
   real background to look right, and reporting on a colour that shipped
   nowhere. Fail loudly rather than quietly scoring green on a fiction. */
const tokenValues = new Set(Object.values(tokens).map((v) => v.toLowerCase()));
const haystack = allCss.toLowerCase();

const ships = (value) =>
  typeof value !== 'string' ||
  !value.startsWith('#') ||
  tokenValues.has(value.toLowerCase()) ||
  haystack.includes(value.toLowerCase());

const stale = [];
for (const [label, fg, bg] of checks) {
  for (const v of [fg, bg]) if (!ships(v)) stale.push([label, v]);
}
for (const [label, , bg] of alphaChecks) {
  if (!ships(bg)) stale.push([label, bg]);
}

if (stale.length) {
  console.log('\nSTALE - audited, but no stylesheet ships them:\n');
  for (const [label, v] of stale) console.log(`  ${v}  ${label}`);
  console.log('\nPoint each pair at the colour the site renders, or drop the pair.');
  console.log('Do not soften this guard to make it quiet.\n');
  process.exit(1);
}

/* --- Run ------------------------------------------------------------------ */
const rows = [
  ...checks.map(([label, fg, bg, need]) => [label, ratio(fg, bg), need, `${fg} on ${bg}`]),
  ...alphaChecks.map(([label, alpha, bg, need]) => [
    label,
    ratio(whiteOver(alpha, bg), bg),
    need,
    `white ${alpha} on ${bg}`,
  ]),
];

console.log('\nWCAG 2.1 contrast audit');
console.log('AA needs 4.5:1 normal text, 3:1 large text and UI boundaries\n');

const failures = [];

for (const [label, value, need, detail] of rows) {
  const pass = value >= need;
  const grade = !pass ? 'FAIL' : value >= (need === UI ? 4.5 : 7) ? 'AAA ' : 'AA  ';
  if (!pass) failures.push([label, value, need, detail]);
  console.log(`  ${(value.toFixed(2) + ':1').padStart(8)}  ${grade}  ${label.padEnd(34)} ${detail}`);
}

console.log(`\n${'='.repeat(58)}`);
if (failures.length) {
  console.log(`  ${rows.length - failures.length} pass, ${failures.length} FAIL\n`);
  failures.forEach(([label, value, need, detail]) =>
    console.log(`  ${value.toFixed(2)}:1 needs ${need}:1 - ${label} (${detail})`)
  );
} else {
  console.log(`  all ${rows.length} pairs pass`);
}
console.log(`${'='.repeat(58)}\n`);

process.exit(failures.length ? 1 : 0);
