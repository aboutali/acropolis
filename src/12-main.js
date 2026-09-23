// Acropolis scene launcher and main render loop
window.startAcropolis = function () {
  var CFG = window.CFG || { MOBILE: false };
  var W = window.innerWidth, Hh = window.innerHeight;

  var renderer = new THREE.WebGLRenderer({ antialias: !CFG.MOBILE, powerPreference: 'high-performance' });
  renderer.setSize(W, Hh);
  document.getElementById('app').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(48, W / Hh, 0.5, 4000);
  camera.position.set(170, 95, 205);

  var mats = window.buildMats(THREE);
  var H = window.makeHelpers(THREE, mats);

  [window.buildTerrain, window.buildParthenon, window.buildErechtheion, window.buildPropylaea, window.buildWalls, window.buildSouthSlope, window.buildScenery].forEach(function (f) {
    try {
      if (typeof f === 'function') scene.add(f(THREE, mats, H));
    } catch (e) {
      console.error('builder failed', f && f.name, e);
    }
  });

  var env = window.buildEnv(THREE, scene, renderer);
  var ctrl = window.makeOrbit(THREE, camera, renderer.domElement, { target: new THREE.Vector3(-30, 8, 0) });

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  var resizeTimer;
  function debounceResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 150);
  }

  window.addEventListener('resize', debounceResize);
  window.addEventListener('orientationchange', debounceResize);

  var autorotBtn = document.getElementById('autorot');
  if (autorotBtn) {
    autorotBtn.addEventListener('click', function () {
      var on = autorotBtn.getAttribute('aria-pressed') !== 'true';
      ctrl.setAutoRotate(on);
      autorotBtn.setAttribute('aria-pressed', on);
      autorotBtn.classList.toggle('off', !on);
    });
  }

  var clock = new THREE.Clock();
  var frames = 0;

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    ctrl.update(dt);
    env.update(dt);
    renderer.render(scene, camera);
    frames++;
  }
  frame();

  setTimeout(function () {
    var hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '0';
  }, 6000);

  if (location.search.indexOf('debug') >= 0) {
    var dbg = document.getElementById('debug');
    if (dbg) {
      dbg.hidden = false;
      setInterval(function () {
        dbg.textContent = 'tris ' + renderer.info.render.triangles + ' · calls ' + renderer.info.render.calls + ' · geo ' + renderer.info.memory.geometries + ' · fps ' + Math.round(frames * 2);
        frames = 0;
      }, 500);
    }
  }
};
