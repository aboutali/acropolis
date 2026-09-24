// Headless screenshots of index.html for visual review. Output goes to tools/shots/ (gitignored).
// Usage: node tools/shoot.mjs [view ...]   (default: every preset). Needs Playwright (global install is fine).
//        node tools/shoot.mjs --at '{"t":[x,y,z],"r":30,"theta":0.5,"phi":1.3}' name   (custom camera, desktop only)
// DESK_ONLY=1 skips the phone viewport. WAIT=<ms> waits longer before the shot (assets load after start).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'tools', 'shots');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

let custom = null;
const argv = process.argv.slice(2);
if (argv[0] === '--at') { custom = JSON.parse(argv[1]); argv.splice(0, 2); if (!argv.length) argv.push('custom'); process.env.DESK_ONLY = '1'; }
const views = argv.length ? argv
  : ['overview', 'parthenon', 'erechtheion', 'propylaea', 'promachos', 'southslope'];
fs.mkdirSync(OUT, { recursive: true });
// Serve three.js from a local cache so the page works behind proxies and offline
const THREE_CACHE = path.join(OUT, 'three.min.js');
if (!fs.existsSync(THREE_CACHE)) execSync(`curl -sSfL -o "${THREE_CACHE}" https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`);
// Serve the repo over HTTP: WebGL textures and glTF fetches are blocked from file:// pages
import http from 'node:http';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE_URL = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [label, vp] of [['desk', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
  const page = await browser.newPage({ viewport: vp });
  await page.route('**/three.min.js', r => r.fulfill({ path: THREE_CACHE, contentType: 'text/javascript' }));
  await page.route('https://fonts.**', r => r.abort());
  // Add-on scripts: cache each once with curl, then serve from disk
  await page.route('https://cdn.jsdelivr.net/**', r => {
    const url = r.request().url();
    const local = path.join(OUT, 'cdn', url.replace(/^https:\/\//, '').replace(/[^\w.\/-]/g, '_'));
    if (!fs.existsSync(local)) { fs.mkdirSync(path.dirname(local), { recursive: true }); execSync(`curl -sSfL -o "${local}" "${url}"`); }
    return r.fulfill({ path: local, contentType: 'text/javascript' });
  });
  page.on('console', m => { if (m.type() === 'error') console.log(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', e => console.log(`[${label}] pageerror: ${e.message}`));
  for (const v of views) {
    await page.goto(`${BASE_URL}/index.html?view=${custom ? 'overview' : v}&still&debug${process.env.Q || ''}`, { timeout: 180000 });
    if (custom) {
      await page.waitForTimeout(2500);
      await page.evaluate(c => { window.acropolisCtrl.setAutoRotate(false); window.acropolisCtrl.jumpTo(c); }, custom);
    }
    await page.waitForTimeout(+(process.env.WAIT || 6000));
    const file = path.join(OUT, `${v}${process.env.TAG || ''}-${label}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    console.log(file, await page.textContent('#debug'));
  }
  await page.close();
  if (views.length && process.env.DESK_ONLY) break;
}
await browser.close();
server.close();
