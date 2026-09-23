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

  function onPointerDown(e) {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastInteract = performance.now();
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;

    var prevPointers = Array.from(pointers.entries());
    var prevDist = null;
    if (prevPointers.length === 2) {
      var p1 = prevPointers[0][1];
      var p2 = prevPointers[1][1];
      prevDist = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
    }

    var px = e.clientX;
    var py = e.clientY;
    var oldP = pointers.get(e.pointerId);
    var dx = px - oldP.x;
    var dy = py - oldP.y;

    if (pointers.size === 1) {
      theta_t -= dx * 0.005;
      phi_t -= dy * 0.005;
    } else if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: px, y: py });
      var curPointers = Array.from(pointers.entries());
      var p1 = curPointers[0][1];
      var p2 = curPointers[1][1];
      var curDist = Math.sqrt((p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y));
      if (prevDist !== null && curDist > 0) {
        radius_t *= prevDist / curDist;
      }
      return;
    }

    pointers.set(e.pointerId, { x: px, y: py });
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

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  update(0);

  return {
    update: update,
    setAutoRotate: setAutoRotate,
    flyTo: flyTo,
    jumpTo: jumpTo,
    target: target
  };
};
