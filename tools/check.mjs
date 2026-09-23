// Static + smoke checks for one or more src/*.js modules. No LLM, no browser.
// Usage: node tools/check.mjs [src/04-parthenon.js ...]   (no args = all of src/)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src');

const H_NAMES = ['makeDoricColumns', 'makeIonicColumns', 'makeSteppedBase', 'makeEntablature', 'makePediment',
  'makeGableRoof', 'makeCaryatid', 'makeFigure', 'makeWall', 'makeRockOutcrop', 'makeCella', 'makeBlockCourse',
  'noise2', 'instance'];
const MAT_NAMES = ['marble', 'marbleWorn', 'marbleShadowed', 'rock', 'rockDark', 'ground', 'city', 'terracotta',
  'bronze', 'foliageOlive', 'foliageCypress', 'trunk'];
const EXPORTS = {
  '00': 'CFG', '01': 'buildMats', '02': 'makeHelpers', '03': 'buildTerrain', '04': 'buildParthenon',
  '05': 'buildErechtheion', '06': 'buildPropylaea', '07': 'buildWalls', '08': 'buildSouthSlope',
  '09': 'buildScenery', '10': 'buildEnv', '11': 'makeOrbit', '12': 'startAcropolis',
};
const FORBIDDEN = /BufferGeometryUtils|OrbitControls|mergeBufferGeometries|THREE\.Geometry\b|TextureLoader|GLTFLoader|\bfetch\s*\(|https?:\/\/|\brequire\s*\(|^\s*import\s|^\s*export\s|Math\.random|```/m;

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map(f => path.resolve(ROOT, f))
  : fs.readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => path.join(SRC, f));

let failed = 0;
for (const file of files) {
  const problems = checkFile(file);
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (problems.length) {
    failed++;
    console.log(`FAIL ${rel}`);
    for (const p of problems) console.log(`  - ${p}`);
  } else {
    console.log(`OK ${rel}`);
  }
}
process.exit(failed ? 1 : 0);

function checkFile(file) {
  const problems = [];
  if (!fs.existsSync(file)) return [`file not found`];
  const code = fs.readFileSync(file, 'utf8');
  const id = path.basename(file).slice(0, 2);
  const exp = EXPORTS[id];
  if (!exp) return [`unknown module id ${id}`];

  // 1. syntax
  const syn = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syn.status !== 0) {
    problems.push('syntax: ' + (syn.stderr || '').split('\n').slice(0, 6).join(' | '));
    return problems;
  }

  // 2. regex gates
  const m = code.match(FORBIDDEN);
  if (m) problems.push(`forbidden token: "${m[0].trim()}"`);
  const tops = code.split('\n').filter(l => /^\S/.test(l) && !/^\s*\/\//.test(l) && !/^[})\]]+[;()]*\s*$/.test(l) && !/^\s*\*/.test(l));
  const assign = new RegExp(`^window\\.${exp}\\s*=`);
  if (!tops.some(l => assign.test(l))) problems.push(`missing top-level assignment "window.${exp} = ..."`);
  const extraTops = tops.filter(l => !assign.test(l) && !/^\/\*/.test(l));
  if (extraTops.length) problems.push(`extra top-level statements: ${extraTops.slice(0, 3).map(s => JSON.stringify(s.slice(0, 60))).join(', ')}`);
  const n = +id;
  if (n >= 2 && n <= 11 && /\bdocument\b/.test(code) && n !== 1) problems.push('uses "document" (not allowed in this module)');
  if (n >= 2 && n <= 9 && /new\s+THREE\.\w*Material/.test(code)) problems.push('constructs a Material (use mats.* instead)');
  if (n >= 3 && n <= 9) {
    for (const h of new Set([...code.matchAll(/\bH\.(\w+)/g)].map(x => x[1]))) if (!H_NAMES.includes(h)) problems.push(`unknown helper H.${h}`);
    for (const k of new Set([...code.matchAll(/\bmats\.(\w+)/g)].map(x => x[1]))) if (!MAT_NAMES.includes(k)) problems.push(`unknown material mats.${k}`);
  }
  if (n === 2) {
    for (const k of new Set([...code.matchAll(/\bmats\.(\w+)/g)].map(x => x[1]))) if (!MAT_NAMES.includes(k)) problems.push(`unknown material mats.${k}`);
    for (const h of H_NAMES) if (!new RegExp(`H\\.${h}\\s*=`).test(code)) problems.push(`helper H.${h} not defined`);
  }
  if (problems.length) return problems;

  // 3. smoke test with a stub THREE
  try {
    const nanLog = [];
    const THREE = makeStubTHREE(nanLog);
    const win = { CFG: { PLATEAU_H: 80, PLATEAU_X: 300, PLATEAU_Z: 150, PLATEAU_CX: -45, PLATEAU_CZ: 0, MOBILE: false, SEG: { colRadial: 40, colHeight: 4, capital: 24 } } };
    const doc = { createElement: () => stubObj(nanLog), getElementById: () => stubObj(nanLog), querySelectorAll: () => [], addEventListener() {} };
    const fn = new Function('window', 'THREE', 'document', 'innerWidth', 'innerHeight', 'performance', 'requestAnimationFrame', 'location', 'setTimeout', 'setInterval', code + `\n;return window.${exp};`);
    const perf = { now: () => 1000 };
    const result = fn(win, THREE, n === 1 || n === 12 ? doc : undefined, 1440, 900, perf, () => 0, { search: '' }, () => 0, () => 0);
    if (result === undefined) problems.push(`window.${exp} is undefined after evaluation`);
    else if (n === 0) {
      for (const k of ['PLATEAU_H', 'MOBILE', 'SEG']) if (!(k in result)) problems.push(`CFG.${k} missing`);
    } else if (n === 1) {
      const mats = result(THREE);
      for (const k of MAT_NAMES) if (!mats || !mats[k]) problems.push(`mats.${k} missing from buildMats result`);
    } else if (n === 2) {
      const mats = Object.fromEntries(MAT_NAMES.map(k => [k, stubObj(nanLog)]));
      const H = result(THREE, mats);
      const samples = {
        makeDoricColumns: [[[0, 0], [4, 0]], {}], makeIonicColumns: [[[0, 0], [2, 0]], {}], makeSteppedBase: [10, 20, 3, 0.5],
        makeEntablature: [10, 20, 2, {}], makePediment: [10, 1, 2, {}], makeGableRoof: [10, 20, 0.2, { tiles: true, acroteria: true }],
        makeCaryatid: [2.3], makeFigure: [1.8], makeWall: [[[0, 0], [10, 0], [10, 10]], 5, 2], makeRockOutcrop: [100, 50, 4, 1],
        makeCella: [10, 20, 5, {}], makeBlockCourse: [10, 20, 1, 1.2], noise2: [1.5, 2.5, 3], instance: [stubObj(nanLog), stubObj(nanLog), [{ p: [0, 0, 0] }]],
      };
      for (const h of H_NAMES) {
        if (typeof H[h] !== 'function') { problems.push(`H.${h} is not a function`); continue; }
        try { const r = H[h](...samples[h]); if (r === undefined || r === null) problems.push(`H.${h} returned nothing`); if (h === 'noise2' && typeof r !== 'number') problems.push('H.noise2 must return a number'); }
        catch (e) { problems.push(`H.${h} threw: ${e.message}`); }
      }
    } else if (n >= 3 && n <= 9) {
      const mats = Object.fromEntries(MAT_NAMES.map(k => [k, stubObj(nanLog)]));
      const H = Object.fromEntries(H_NAMES.map(k => [k, k === 'noise2' ? () => 0.3 : () => stubObj(nanLog)]));
      const g = result(THREE, mats, H);
      if (!g) problems.push('builder returned nothing');
    } else if (n === 10) {
      const r = result(THREE, stubObj(nanLog), stubObj(nanLog));
      if (!r || typeof r.update !== 'function') problems.push('buildEnv must return {sun, update}');
    } else if (n === 11) {
      const r = result(THREE, stubObj(nanLog), stubObj(nanLog), {});
      if (!r || typeof r.update !== 'function' || typeof r.setAutoRotate !== 'function') problems.push('makeOrbit must return {update, setAutoRotate, target}');
      else r.update(0.016);
    } else if (n === 12) {
      win.buildMats = () => Object.fromEntries(MAT_NAMES.map(k => [k, stubObj(nanLog)]));
      win.makeHelpers = () => ({}); win.buildTerrain = () => stubObj(nanLog); win.buildEnv = () => ({ update() {} });
      win.makeOrbit = () => ({ update() {}, setAutoRotate() {} });
      win.innerWidth = 1440; win.innerHeight = 900; win.addEventListener = () => 0;
      result();
    }
    if (nanLog.length) problems.push(`NaN passed to ${nanLog.slice(0, 5).join(', ')}${nanLog.length > 5 ? ' …' : ''}`);
  } catch (e) {
    problems.push(`runtime: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e}`);
  }
  return problems;
}

// ---- stub THREE: every property is a constructor-callable, chainable, numeric-coercible stub
function stubObj(nanLog, name = 'obj') {
  const target = function () {};
  const store = new Map();
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toString') return () => '0';
      if (prop === 'length' || prop === 'count') return 0;
      if (prop === 'isMesh' || prop === 'isObject3D') return true;
      if (prop === 'then') return undefined;
      if (prop === Symbol.iterator) return function* () {};
      if (typeof prop === 'symbol') return undefined;
      if (store.has(prop)) return store.get(prop);
      const child = stubObj(nanLog, `${name}.${String(prop)}`);
      store.set(prop, child);
      return child;
    },
    set(t, prop, v) { store.set(prop, v); return true; },
    has() { return true; },
    apply(t, thisArg, args) {
      if (args.some(a => typeof a === 'number' && Number.isNaN(a))) nanLog.push(name);
      if (name.endsWith('traverse') && typeof args[0] === 'function') { args[0](stubObj(nanLog, 'mesh')); return undefined; }
      if (name.endsWith('forEach') && typeof args[0] === 'function') return undefined;
      return stubObj(nanLog, name + '()');
    },
    construct(t, args) {
      if (args.some(a => typeof a === 'number' && Number.isNaN(a))) nanLog.push('new ' + name);
      return stubObj(nanLog, name);
    },
  });
  return proxy;
}
function makeStubTHREE(nanLog) {
  const consts = { DoubleSide: 2, BackSide: 1, FrontSide: 0, RepeatWrapping: 1000, sRGBEncoding: 3001, ACESFilmicToneMapping: 4, PCFSoftShadowMap: 2 };
  return new Proxy({}, { get(t, prop) { if (prop in consts) return consts[prop]; if (typeof prop === 'symbol') return undefined; return stubObj(nanLog, 'THREE.' + String(prop)); } });
}
