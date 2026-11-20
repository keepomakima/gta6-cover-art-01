// tools/playtest.mjs — headless-Chrome playtest + screenshot maker for
// Key Art Studio. Node 22 stdlib only: drives Chrome over CDP with the
// built-in WebSocket client, serves app/ on localhost, checks the editor
// (layouts x grades, crop, exports, console errors) and takes the 4
// screenshots into screenshots/.
//
// Run: node tools/playtest.mjs [--shots-only]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');
const SHOTS = join(ROOT, 'screenshots');
const CHROME = process.env.CHROME_BIN || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const PORT = 8137, CDP_PORT = 9223;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS_ONLY = process.argv.includes('--shots-only');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 20000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(step);
  }
  return false;
}

// --- minimal CDP client -------------------------------------------------------
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result);
      } else if (m.method) {
        this.events.push(m);
      }
    };
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page exception: ${JSON.stringify(r.exceptionDetails).slice(0, 400)}`);
    return r.result ? r.result.value : undefined;
  }
  consoleErrors() {
    return this.events.filter((e) =>
      (e.method === 'Runtime.exceptionThrown') ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'));
  }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

async function newPage() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new Cdp(page.webSocketDebuggerUrl);
  await ws.ready();
  await ws.send('Page.enable');
  await ws.send('Runtime.enable');
  await ws.send('Log.enable');
  return ws;
}

async function navigate(ws, url, readyExpr, timeout = 25000) {
  await ws.send('Page.navigate', { url });
  const ok = await waitFor(async () => {
    try { return await ws.eval(readyExpr); } catch { return false; }
  }, timeout);
  if (!ok) throw new Error(`timeout waiting for ${readyExpr} at ${url}`);
  await sleep(400); // let the last render settle
}

function jpegDims(buf) {
  // Parse the first SOF marker for width/height.
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function pngDims(b64) {
  const buf = Buffer.from(b64, 'base64');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function shot(ws, name, width, height) {
  // Adaptive JPEG quality: screenshots must stay under the 256 KiB gate cap.
  let quality = 85, buf = null;
  for (let i = 0; i < 3; i++) {
    buf = Buffer.from((await ws.send('Page.captureScreenshot', { format: 'jpeg', quality })).data, 'base64');
    if (buf.length <= 250000 || quality <= 60) break;
    quality -= 12;
  }
  const path = join(SHOTS, name);
  writeFileSync(path, buf);
  const dims = jpegDims(buf);
  console.log(`  shot ${name}: ${buf.length} bytes (q${quality}), ${dims ? `${dims.w}x${dims.h}` : 'dims?'}`);
  return { path, bytes: buf.length, dims };
}

// Set the viewport BEFORE the page loads, so the cover canvas is painted
// at exactly the capture size (a canvas painted at another size and then
// CSS-stretched would distort the art).
async function capture(ws, url, readyExpr, name, width, height) {
  await ws.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await navigate(ws, url, readyExpr);
  return shot(ws, name, width, height);
}

// --- main ---------------------------------------------------------------------
async function main() {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  mkdirSync(SHOTS, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: APP, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--user-data-dir=/tmp/ka-chrome-profile',
    `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    if (!await waitFor(async () => { try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); return r.ok; } catch { return false; } }, 20000)) {
      throw new Error('chrome did not start');
    }
    await waitFor(async () => { try { const r = await fetch(BASE + '/index.html'); return r.ok; } catch { return false; } }, 10000);

    const ws = await newPage();

    // --- editor checks ------------------------------------------------------
    console.log('editor checks:');
    await navigate(ws, `${BASE}/index.html`, 'window.__studioReady === true');
    const fontOk = await ws.eval(`document.fonts.check('80px "Bebas Neue"')`);
    check('Bebas Neue font loaded', fontOk === true);

    if (!SHOTS_ONLY) {
      const nonBlank = `(() => { const c = document.getElementById('preview'); const x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let sum = 0, n = 0; for (let i = 0; i < d.length; i += 4013 * 4) { sum += d[i] + d[i + 1] + d[i + 2]; n++; } const mean = sum / n / 3; let v = 0; for (let i = 0; i < d.length; i += 4013 * 4) { const m = (d[i] + d[i + 1] + d[i + 2]) / 3; v += (m - mean) ** 2; } return { mean: Math.round(mean), std: Math.round(Math.sqrt(v / n)) }; })()`;
      const base = await ws.eval(nonBlank);
      check('default cover renders (non-blank)', base.std > 8, `std=${base.std}`);

      // Every layout x grade renders non-blank.
      let combos = 0, bad = [];
      for (const layout of ['keyart', 'mosaic', 'covergrid', 'fivepanel', 'triptych', 'single', 'split', 'slanted']) {
        for (const grade of ['heatwave', 'ultraviolet', 'golden-hour', 'neon-night', 'vice-sunset', 'palm-dusk', 'noir', 'miami-pop']) {
          await ws.eval(`window.__studio.setLayout('${layout}'); window.__studio.setGrade('${grade}')`);
          await sleep(120);
          const s = await ws.eval(nonBlank);
          combos++;
          if (s.std <= 8) bad.push(`${layout}/${grade}`);
        }
      }
      check(`all ${combos} layout x grade combos render`, bad.length === 0, bad.join(', ') || 'all non-blank');

      // Title styles.
      for (const style of ['chrome', 'halftone', 'flat']) {
        await ws.eval(`window.__studio.state.titleStyle = '${style}'; window.__studio.render()`);
        await sleep(150);
        const s = await ws.eval(nonBlank);
        if (s.std <= 8) bad.push(`title/${style}`);
      }
      check('3 title styles render', !bad.some((b) => b.startsWith('title/')), bad.filter((b) => b.startsWith('title/')).join(', '));

      // Crop: zoom + pan + reset.
      await ws.eval(`window.__studio.setLayout('keyart'); window.__studio.selectPanel(0); window.__studio.state.panels[0].crop = { zoom: 2.2, cx: 0.6, cy: 0.3 }; window.__studio.render()`);
      await sleep(200);
      const cropped = await ws.eval(nonBlank);
      check('crop zoom 2.2 renders (no gaps)', cropped.std > 8, `std=${cropped.std}`);
      await ws.eval(`window.__studio.state.panels[0].crop = { zoom: 1, cx: 0.5, cy: 0.45 }; window.__studio.render()`);

      // Exports: exact PNG dimensions.
      for (const [id, w, h] of [['square', 1080, 1080], ['portrait', 1080, 1350], ['wide', 1920, 1080]]) {
        const dataUrl = await ws.eval(`window.__studio.exportPng('${id}')`);
        const dims = pngDims(dataUrl.split(',')[1]);
        check(`export ${id} is ${w}x${h}`, dims.w === w && dims.h === h, `${dims.w}x${dims.h}`);
      }

      const errs = ws.consoleErrors();
      check('0 console errors / page exceptions', errs.length === 0, errs.slice(0, 2).map((e) => JSON.stringify(e.params || e).slice(0, 160)).join(' | '));
    }

    // --- screenshots (viewport set before each page loads) --------------
    console.log('screenshots:');
    await capture(ws, `${BASE}/index.html?shot=cover&size=wide`, 'window.__shotReady === true', '1-cover.jpg', 1280, 720);
    await capture(ws, `${BASE}/index.html`, 'window.__studioReady === true', '2-editor.jpg', 1280, 900);
    await capture(ws, `${BASE}/index.html?shot=cover&size=portrait&layout=triptych&grade=golden-hour&title=PIER%20PRESSURE&subtitle=LEONIDA%20AFTER%20DARK`, 'window.__shotReady === true', '3-cover.jpg', 1024, 1280);
    await capture(ws, `${BASE}/index.html?shot=cover&size=square&layout=mosaic&grade=neon-night&title=NEON%20SHORE&subtitle=A%20LEONIDA%20STORY`, 'window.__shotReady === true', '4-cover.jpg', 1080, 1080);

    const errs2 = ws.consoleErrors();
    check('shots: 0 console errors / page exceptions', errs2.length === 0, errs2.slice(0, 2).map((e) => JSON.stringify(e.params || e).slice(0, 160)).join(' | '));
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => { console.error('PLAYTEST ERROR:', e.message); process.exit(2); });
