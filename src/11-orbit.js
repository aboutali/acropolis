// Orbit camera controller
window.makeOrbit = function (THREE, camera, el, opts) {
  opts = opts || {};
  var target = opts.target !== undefined ? opts.target : new THREE.Vector3(0, 0, 0);
  var minDist = opts.minDist !== undefined ? opts.minDist : 12;
  var maxDist = opts.maxDist !== undefined ? opts.maxDist : 900;
  var minPolar = opts.minPolar !== undefined ? opts.minPolar : 0.08;
  var maxPolar = opts.maxPolar !== undefined ? opts.maxPolar : 1.50;
  var damping = opts.damping !== undefined ? opts.damping : 0.09;
  var autoRotate = opts.autoRotate !== undefined ? opts.autoRotate : true;

  var dx = camera.position.x - target.x;
  var dy = camera.position.y - target.y;
  var dz = camera.position.z - target.z;
  var radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (radius === 0) radius = 100;
  var phi = Math.acos(Math.max(-1, Math.min(1, dy / radius)));
  var theta = Math.atan2(dx, dz);

  var theta_t = theta;
  var phi_t = phi;
  var radius_t = radius;
  var target_t = target.clone();
  var lastInteract = performance.now();
  var pointers = new Map();

  el.style.touchAction = 'none';

  function updateCamera() {
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
  }

  function update(dt) {
    applyKeys(dt || 0);
    if (autoRotate && pointers.size === 0 && performance.now() - lastInteract > 4000) {
      theta_t += 0.04 * dt;
    }

    phi_t = Math.max(minPolar, Math.min(maxPolar, phi_t));
    radius_t = Math.max(minDist, Math.min(maxDist, radius_t));

    target.lerp(target_t, damping);
    theta += (theta_t - theta) * damping;
    phi += (phi_t - phi) * damping;
    radius += (radius_t - radius) * damping;

    updateCamera();
  }

  // Glide to a preset: v = { t: [x, y, z], r: radius, theta: azimuth, phi: polar }
  function flyTo(v) {
    target_t.set(v.t[0], v.t[1], v.t[2]);
    var d = v.theta - theta_t;
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    theta_t += d;
    phi_t = v.phi;
    radius_t = v.r;
    lastInteract = performance.now();
  }

  // Jump to a preset without the glide
  function jumpTo(v) {
    flyTo(v);
    target.copy(target_t);
    theta = theta_t;
    phi = phi_t;
    radius = radius_t;
    updateCamera();
  }

  function setAutoRotate(b) {
    autoRotate = b;
    update(0);
  }

  // Pan: move the orbit target across the ground plane, "grabbing" the world under the pointer
  var panLimit = opts.panLimit !== undefined ? opts.panLimit : 1200;
  function panBy(dxPx, dyPx) {
    var h = el.clientHeight || 800;
    var k = 2 * radius * Math.tan((camera.fov || 48) * Math.PI / 360) / h;
    var rx = Math.cos(theta), rz = -Math.sin(theta);   // screen right, on the ground
    var fx = -Math.sin(theta), fz = -Math.cos(theta);  // screen up, projected onto the ground
    var fk = k / Math.max(0.35, Math.cos(Math.min(phi, 1.2)) + 0.35);
    target_t.x += -dxPx * k * rx + dyPx * fk * fx;
    target_t.z += -dxPx * k * rz + dyPx * fk * fz;
    var ox = target_t.x + 45, oz = target_t.z, d = Math.sqrt(ox * ox + oz * oz);
    if (d > panLimit) { target_t.x = -45 + ox * panLimit / d; target_t.z = oz * panLimit / d; d = panLimit; }
    // Off the summit, let the target sink toward the plain so the view stays on the ground
    var ex = ox / 150, ez = oz / 75, e2 = Math.sqrt(ex * ex + ez * ez);
    if (e2 > 1) target_t.y = Math.max(-72, Math.min(target_t.y, 8 - (e2 - 1) * 160));
    else if (target_t.y < 8 && e2 < 0.9) target_t.y = 8;
    lastInteract = performance.now();
  }

  var panMode = false;
  function onPointerDown(e) {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Right or middle button, or Shift/Ctrl/Cmd with the left button, pans instead of orbiting
    panMode = e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey || e.metaKey;
    lastInteract = performance.now();
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    var oldP = pointers.get(e.pointerId);
    var dx = e.clientX - oldP.x;
    var dy = e.clientY - oldP.y;

    if (pointers.size === 1) {
      if (panMode) panBy(dx, dy);
      else {
        theta_t -= dx * 0.005;
        phi_t -= dy * 0.005;
      }
    } else if (pointers.size === 2) {
      // Two fingers: pinch zooms, moving both together pans
      var prev = Array.from(pointers.values());
      var prevDist = Math.hypot(prev[1].x - prev[0].x, prev[1].y - prev[0].y);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var cur = Array.from(pointers.values());
      var curDist = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
      if (prevDist > 0 && curDist > 0) radius_t *= prevDist / curDist;
      panBy(dx / 2, dy / 2);
      return;
    }

    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteract = performance.now();
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    lastInteract = performance.now();
  }

  function onWheel(e) {
    e.preventDefault();
    radius_t *= 1 + e.deltaY * 0.0012;
    lastInteract = performance.now();
  }

  // Keyboard: arrows or WASD pan, Q/E orbit, +/- zoom, while held
  var keys = {};
  function onKey(e) {
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    var k = e.key.toLowerCase();
    if ('wasdqe+-='.indexOf(k) >= 0 || k.indexOf('arrow') === 0) {
      keys[k] = e.type === 'keydown';
      if (e.type === 'keydown') { e.preventDefault(); lastInteract = performance.now(); }
    }
  }
  function applyKeys(dt) {
    var step = 600 * dt;
    if (keys.arrowleft || keys.a) panBy(step, 0);
    if (keys.arrowright || keys.d) panBy(-step, 0);
    if (keys.arrowup || keys.w) panBy(0, step);
    if (keys.arrowdown || keys.s) panBy(0, -step);
    if (keys.q) theta_t += 1.2 * dt;
    if (keys.e) theta_t -= 1.2 * dt;
    if (keys['+'] || keys['=']) radius_t *= 1 - 1.2 * dt;
    if (keys['-']) radius_t *= 1 + 1.2 * dt;
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', function () { keys = {}; });
  }

  update(0);

  return {
    update: update,
    setAutoRotate: setAutoRotate,
    flyTo: flyTo,
    jumpTo: jumpTo,
    target: target
  };
};
