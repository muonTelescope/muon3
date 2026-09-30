'use strict';
/*
 * Drives web/detector.html (three.js) in headless Chrome and captures deterministic frames, as in halo90-musicVideo.
 *   NODE_PATH=<dir with puppeteer-core> node render.js --still 40 still.jpg
 *   NODE_PATH=... node render.js --scene 2 scene2.mp4          (one mp4 per scene of the assembly guide)
 * Memory guard (8 GB Mac): refuses to start when memory is tight and kills Chrome when free memory drops.
 */
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn, execFileSync } = require('child_process');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = +(process.env.W || 990), H = +(process.env.H || 1170), FPS = +(process.env.FPS || 30);
const MIN_FREE = +(process.env.MIN_FREE_PCT || 15), START_FREE = +(process.env.START_FREE_PCT || 25);
const VO = [17.6, 14.4, 14.64, 10.24, 14.16, 16.0, 19.52], LEAD = 0.6, TAIL = 0.5;
const dur = i => VO[i] + LEAD + TAIL, start = i => VO.slice(0, i).reduce((a, _, k) => a + dur(k), 0);
const freePct = () => { try { return parseInt(execFileSync('sysctl', ['-n', 'kern.memorystatus_level']).toString(), 10); } catch (_) { return 100; } };

function serve() {
  const root = __dirname, types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.stl': 'application/octet-stream' };
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

async function open() {
  const f0 = freePct();
  if (f0 < START_FREE) throw new Error(`memory guard: only ${f0}% free; close some apps first (need ${START_FREE}%)`);
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000,
    args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', `--window-size=${W},${H}`, '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=1536'] });
  const guard = setInterval(() => { const f = freePct(); if (f < MIN_FREE) { console.error(`memory guard: ${f}% free; killing Chrome`); try { browser.process().kill('SIGKILL'); } catch (_) {} process.exit(3); } }, 500);
  guard.unref();
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('console', m => { if (!/GPU stall|WebGL/.test(m.text())) console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/web/detector.html?w=${W}&h=${H}`);
  await page.waitForFunction('window.filmReady === true', { timeout: 300000 });
  return {
    page,
    frame: async t => Buffer.from(await page.evaluate(t => window.renderFrame(t, 'jpeg'), t), 'base64'),
    async close() { clearInterval(guard); await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]); try { browser.process().kill('SIGKILL'); } catch (_) {} server.close(); },
  };
}

(async () => {
  const a = process.argv.slice(2), film = await open();
  try {
    if (a[0] === '--still') { for (let k = 1; k < a.length; k += 2) fs.writeFileSync(a[k + 1], await film.frame(parseFloat(a[k]))); }
    else if (a[0] === '--scene') {
      const i = +a[1], out = a[2], n = Math.round(dur(i) * FPS), tmp = out + '.part.mp4';
      const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
      const t0 = Date.now();
      for (let f = 0; f < n; f++) {
        const buf = await film.frame(start(i) + f / FPS);
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (f % 90 === 0) process.stderr.write(`scene ${i}: frame ${f}/${n}  ${((Date.now() - t0) / (f + 1)).toFixed(0)} ms/f\n`);
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.renameSync(tmp, out);
    } else console.log(await film.page.evaluate('window.gpuInfo()'));
  } finally { await film.close(); }
})().catch(e => { console.error(e); process.exit(1); });
