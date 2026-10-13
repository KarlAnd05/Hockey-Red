/**
 * Full-page screenshots for design review.
 *
 *   node scripts/capture.mjs <url> <out.png> [width] [height]
 *
 * Uses the DevTools protocol rather than Chrome's --screenshot flag, because
 * that flag captures the window and forces you to open a 3000px-tall window to
 * get a full page — which makes every `svh` unit resolve against that fake
 * height and stretches the first viewport into something the visitor never
 * sees. Here the viewport stays honest and captureBeyondViewport does the
 * scrolling.
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out, width = '1440', height = '900'] = process.argv.slice(2);

if (!url || !out) {
  console.error('usage: node scripts/capture.mjs <url> <out.png> [width] [height]');
  process.exit(1);
}

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

if (!CHROME) {
  console.error('Chrome not found; install it or edit the path list in this script.');
  process.exit(1);
}

const port = 9222 + Math.floor(Math.random() * 400);

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Chrome did not expose a debugging endpoint');
}

function client(ws) {
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });

  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
}

try {
  const wsUrl = await endpoint();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  const send = client(ws);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (m, p) => send(m, p, sessionId);

  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 1,
    mobile: Number(width) < 768,
  });

  await call('Page.navigate', { url });
  await sleep(3500); // load, fonts, and the reveal safety net

  // Settle entrance motion before capturing: an element mid-animation reads as
  // a missing element and gets "fixed" into a regression.
  await call('Runtime.evaluate', {
    expression: `
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
      window.scrollTo(0, 0);
    `,
  });
  await sleep(900);

  const { data } = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(data, 'base64'));

  const bytes = Buffer.from(data, 'base64').length;
  console.log(`${out}  ${width}x${height} viewport  ${(bytes / 1024).toFixed(0)} KB`);

  ws.close();
} finally {
  chrome.kill();
}
