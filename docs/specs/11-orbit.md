# Module 11 — src/11-orbit.js
Signature: `window.makeOrbit = function (THREE, camera, el, opts) { ...; return { update: update, setAutoRotate: setAutoRotate, target: target }; };`
Exceptions: this module MAY add event listeners on `el` and set `el.style.touchAction`. It may use `performance.now()`. No other DOM use.

opts defaults: `{ target: new THREE.Vector3(0,0,0), minDist: 25, maxDist: 900, minPolar: 0.08, maxPolar: 1.50, damping: 0.09, autoRotate: true }`.
- State: spherical `theta, phi, radius` initialised from the camera position relative to target (`radius = dist; phi = acos(dy/radius); theta = atan2(dx, dz)`), and targets `tTheta, tPhi, tRadius` equal to them. `lastInteract = performance.now()`, `pointers = new Map()`.
- `update(dt)`: if autoRotate is on and `pointers.size === 0` and `performance.now() - lastInteract > 4000`, `tTheta += 0.04*dt`. Clamp tPhi to [minPolar, maxPolar] and tRadius to [minDist, maxDist]. Lerp theta, phi, radius toward targets by `damping`. Then `camera.position.set(target.x + radius*Math.sin(phi)*Math.sin(theta), target.y + radius*Math.cos(phi), target.z + radius*Math.sin(phi)*Math.cos(theta)); camera.lookAt(target);`
- Pointer events (mouse + touch): `pointerdown` → `el.setPointerCapture(e.pointerId)`, store {x, y}; `pointermove` (only for stored pointers): with 1 pointer, `tTheta -= dx*0.005; tPhi -= dy*0.005`; with 2 pointers, pinch: `tRadius *= prevDist / curDist` (compute distances between the two stored points before and after updating); update the stored point; `pointerup`/`pointercancel` → delete. Each event sets `lastInteract`.
- `wheel` on el with `{ passive: false }`: `e.preventDefault(); tRadius *= 1 + e.deltaY * 0.0012;` set lastInteract.
- `el.style.touchAction = 'none';`
- `setAutoRotate(b)` sets the flag. Call `update(0)` once at the end so the camera snaps to the initial orbit. ~75 lines.
