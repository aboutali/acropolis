# Module 12 — src/12-main.js
Top-level statement: `window.startAcropolis = function () { ... };` (the HTML shell calls it on DOMContentLoaded). Exception: this module owns the DOM. The HTML shell already provides: `<div id="app">` (full-screen container; append the canvas into it), `<div id="legend">` (already filled), `<div id="hint">`, `<button id="autorot" aria-pressed="true">`, `<div id="debug" hidden>`.

- `var CFG = window.CFG || { MOBILE: false }; var W = window.innerWidth, Hh = window.innerHeight;`
- `var renderer = new THREE.WebGLRenderer({ antialias: !CFG.MOBILE, powerPreference: 'high-performance' }); renderer.setSize(W, Hh); document.getElementById('app').appendChild(renderer.domElement);`
- `var scene = new THREE.Scene(); var camera = new THREE.PerspectiveCamera(48, W / Hh, 0.5, 4000); camera.position.set(170, 95, 205);`
- `var mats = window.buildMats(THREE); var H = window.makeHelpers(THREE, mats);`
- Builders: `[window.buildTerrain, window.buildParthenon, window.buildErechtheion, window.buildPropylaea, window.buildWalls, window.buildSouthSlope, window.buildScenery].forEach(function (f) { try { if (typeof f === 'function') scene.add(f(THREE, mats, H)); } catch (e) { console.error('builder failed', f && f.name, e); } });`
- `var env = window.buildEnv(THREE, scene, renderer);`
- `var ctrl = window.makeOrbit(THREE, camera, renderer.domElement, { target: new THREE.Vector3(-30, 8, 0) });`
- Resize: on `resize` and `orientationchange`, debounce 150 ms: update `camera.aspect`, `camera.updateProjectionMatrix()`, `renderer.setSize(innerWidth, innerHeight)`.
- Loop: `var clock = new THREE.Clock(); var frames = 0; function frame() { requestAnimationFrame(frame); var dt = Math.min(0.05, clock.getDelta()); ctrl.update(dt); env.update(dt); renderer.render(scene, camera); frames++; } frame();`
- Hint: `setTimeout(function () { document.getElementById('hint').style.opacity = '0'; }, 6000);`
- Auto-rotate button `#autorot`: on click toggle a boolean, `ctrl.setAutoRotate(on)`, `setAttribute('aria-pressed', on)`, `classList.toggle('off', !on)`.
- Debug: if `location.search.indexOf('debug') >= 0`: `var dbg = document.getElementById('debug'); dbg.hidden = false;` and every 500 ms set `dbg.textContent = 'tris ' + renderer.info.render.triangles + ' · calls ' + renderer.info.render.calls + ' · geo ' + renderer.info.memory.geometries + ' · fps ' + Math.round(frames * 2); frames = 0;`
~80 lines.
