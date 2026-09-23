// Headless screenshots of index.html for visual review. Output goes to tools/shots/ (gitignored).
// Usage: node tools/shoot.mjs [view ...]   (default: every preset). Needs Playwright (global install is fine).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'tools', 'shots');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const views = process.argv.slice(2).length ? process.argv.slice(2)
  : ['overview', 'parthenon', 'erechtheion', 'propylaea', 'promachos', 'southslope'];
fs.mkdirSync(OUT, { recursive: true });
// Serve three.js from a local cache so the page works behind proxies and offline
const THREE_CACHE = path.join(OUT, 'three.min.js');
if (!fs.existsSync(THREE_CACHE)) execSync(`curl -sSfL -o "${THREE_CACHE}" https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`);
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [label, vp] of [['desk', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
  const page = await browser.newPage({ viewport: vp });
  await page.route('**/three.min.js', r => r.fulfill({ path: THREE_CACHE, contentType: 'text/javascript' }));
  await page.route('https://fonts.**', r => r.abort());
  page.on('console', m => { if (m.type() === 'error') console.log(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', e => console.log(`[${label}] pageerror: ${e.message}`));
  for (const v of views) {
    await page.goto(`file://${ROOT}/index.html?view=${v}&still&debug`);
    await page.waitForTimeout(6000);
    const file = path.join(OUT, `${v}-${label}.png`);
    await page.screenshot({ path: file });
    console.log(file, await page.textContent('#debug'));
  }
  await page.close();
  if (views.length && process.env.DESK_ONLY) break;
}
await browser.close();
