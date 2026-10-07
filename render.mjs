// Headless-Chrome frame renderer (CDP). Calls renderFrame(i) in order and screenshots each frame.
// Usage: node --experimental-websocket render.mjs [outDir=frames] [only=comma list of frame numbers to save, default all]
// Writes <outDir>/f00000.jpg ... and data/framelog.jsonl (one line per frame: sim time + on-screen counts).
import {spawn} from 'node:child_process';
import {writeFileSync, mkdirSync, createWriteStream} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const out = resolve(HERE, process.argv[2] || 'frames');
const only = process.argv[3] ? new Set(process.argv[3].split(',').map(Number)) : null;
mkdirSync(out, {recursive: true});
const dbg = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${dbg}`, '--window-size=1280,720', '--force-device-scale-factor=1', `--user-data-dir=/tmp/bi-timelapse-${dbg}`, 'about:blank'], {stdio: 'ignore'});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800)); return r.result?.result?.value; };
const log = only ? null : createWriteStream(resolve(HERE, 'data/framelog.jsonl'));
try {
  let url; for (let i = 0; i < 60 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find(x => x.type === 'page')?.webSocketDebuggerUrl; } catch {} if (!url) await sleep(200); }
  ws = new WebSocket(url); await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: 'file://' + resolve(HERE, 'src/render.html')});
  for (let i = 0; i < 60 && !(await ev('typeof window.renderFrame === "function" && document.fonts.status === "loaded"')); i++) await sleep(250);
  await ev('document.fonts.load("800 20px Inter").then(() => true)');
  const N = await ev('TOTAL_FRAMES');
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const info = await ev(`renderFrame(${i})`);
    if (log) log.write(JSON.stringify(info) + '\n');
    if (!only || only.has(i)) {
      const shot = await send('Page.captureScreenshot', {format: 'jpeg', quality: 93});
      writeFileSync(`${out}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from(shot.result.data, 'base64'));
    }
    if (i % 200 === 0) console.log(`frame ${i}/${N} · ${info.phase} · ${new Date(info.t).toISOString()} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log(`done ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally { try { ws?.close(); } catch {} log?.end(); chrome.kill('SIGKILL'); }
