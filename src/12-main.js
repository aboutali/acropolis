// Acropolis scene launcher and main render loop
window.startAcropolis = function () {
  var CFG = window.CFG || { MOBILE: false };
  var W = window.innerWidth, Hh = window.innerHeight;

  var renderer = new THREE.WebGLRenderer({ antialias: !CFG.MOBILE, powerPreference: 'high-performance' });
  renderer.setSize(W, Hh);
  // The debug readout counts every pass of a frame, so reset per frame by hand
  renderer.info.autoReset = false;
  document.getElementById('app').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(48, W / Hh, 1.0, 9000);
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
  if (mats.finishScene) mats.finishScene(scene, renderer);
  // Photo textures and scanned statues replace procedural ones as they arrive
  if (window.loadAssets) {
    try { window.loadAssets(THREE, scene, mats, renderer, H); } catch (e) { console.error('assets failed', e); }
  }

  // Post-processing on desktop: ambient occlusion, soft bloom, gamma, FXAA. Phones render directly.
  var composer = null, ssao = null, fxaa = null;
  if (!CFG.MOBILE && THREE.EffectComposer && THREE.SSAOPass && location.search.indexOf('nofx') < 0) {
    try {
      composer = new THREE.EffectComposer(renderer);
      ssao = new THREE.SSAOPass(scene, camera, W, Hh);
      ssao.kernelRadius = 6;
      ssao.minDistance = 0.0004;
      ssao.maxDistance = 0.02;
      composer.addPass(ssao);
      composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W, Hh), 0.18, 0.5, 0.92));
      composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      fxaa = new THREE.ShaderPass(THREE.FXAAShader);
      fxaa.material.uniforms.resolution.value.set(1 / (W * renderer.getPixelRatio()), 1 / (Hh * renderer.getPixelRatio()));
      composer.addPass(fxaa);
    } catch (e) {
      console.error('post-processing disabled', e);
      composer = null;
    }
  }
  var ctrl = window.makeOrbit(THREE, camera, renderer.domElement, { target: new THREE.Vector3(-30, 8, 0) });

  // Camera presets: ?view=<name> on load, legend buttons at runtime
  var VIEWS = {
    overview: { t: [-30, 8, 0], r: 298, theta: 0.77, phi: 1.27 },
    parthenon: { t: [0, 8, 0], r: 78, theta: 0.6, phi: 1.28 },
    erechtheion: { t: [-38, 4, -32], r: 38, theta: -0.25, phi: 1.3 },
    propylaea: { t: [-122, 5, 6], r: 62, theta: -1.25, phi: 1.3 },
    promachos: { t: [-62, 7, -12], r: 30, theta: 0.9, phi: 1.32 },
    southslope: { t: [-70, -48, 110], r: 150, theta: 0.1, phi: 0.95 }
  };
  // Portrait screens see less width, so back the camera off
  function fit(v) {
    var k = Math.min(2, Math.max(1, 1 / camera.aspect));
    return { t: v.t, r: v.r * k, theta: v.theta, phi: v.phi };
  }
  var m = /[?&]view=([a-z]+)/.exec(location.search);
  if (m && VIEWS[m[1]]) {
    ctrl.jumpTo(fit(VIEWS[m[1]]));
    if (location.search.indexOf('still') >= 0) ctrl.setAutoRotate(false);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () {
      var v = VIEWS[b.getAttribute('data-view')];
      if (v) ctrl.flyTo(fit(v));
    });
  });

  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) {
      composer.setSize(w, h);
      if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio()));
    }
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
    renderer.info.reset();
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    frames++;
  }
  frame();

  setTimeout(function () {
    var hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '0';
  }, 6000);

  if (location.search.indexOf('debug') >= 0) {
    window.acropolisCtrl = ctrl;
    window.acropolisScene = scene;
    window.acropolisCamera = camera;
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
