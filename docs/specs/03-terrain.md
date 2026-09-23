# Module 03 — src/03-terrain.js
Signature: `window.buildTerrain = function (THREE, mats, H) { ...; return group; };`  Group at (0,0,0). Budget ≈ 22k tris.

- Plateau top: `var top = H.makeRockOutcrop(300, 150, 4, 7);` then loop over `top.geometry.attributes.position` and flatten: e = sqrt((x/150)² + (z/75)²); if e < 0.6 multiply y by 0.25; if e > 0.9 subtract (e - 0.9)*30 from y; `computeVertexNormals()`. `top.position.set(-45, 0, 0)`.
- Cliff skirt: `new THREE.CylinderGeometry(1, 1.06, 80, 64, 6, true)`; jitter each vertex: `var f = 1 + 0.04*H.noise2(x*3, y*0.05, 3); x *= f; z *= f;` `computeVertexNormals()`. Mesh with `mats.rockDark`, `scale.set(150, 1, 75)`, `position.set(-45, -39, 0)` (top at y=+1, bottom at y=-79). castShadow true, receiveShadow true.
- Ground: `new THREE.PlaneGeometry(3000, 3000)` rotated -PI/2 about x, `mats.ground`, y = -80.4, receiveShadow only.
- City: 220 boxes via `H.instance(new THREE.BoxGeometry(1,1,1), mats.city, transforms)`. Deterministic LCG (seed 7): angle uniform in [0, 2π), radius in [220, 1300]; skip if inside the plateau ellipse (dx = x+45, (dx/160)² + (z/85)² < 1); sizes sx, sz in [8,22], sy in [6,16]; transform p = [x, -80 + sy/2, z], r = [0, yaw, 0], s = [sx, sy, sz]. Keep drawing until 220 accepted.
- Sacred Way: 30 flat boxes `BoxGeometry(6, 0.3, 5)` in `mats.marbleShadowed`, from (-200, -60, 40) rising linearly to (-140, -2, 4) (linear interpolation in x, y, z), receiveShadow only. Use H.instance.
