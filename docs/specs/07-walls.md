# Module 07 — src/07-walls.js
Signature: `window.buildWalls = function (THREE, mats, H) { ...; return group; };`  Group at (0, -1, 0) (bottom slightly below the plateau surface). Budget ≈ 10k tris.

- Perimeter: 28 points on the ellipse centred (-45, 0), rx = 148, rz = 73: for i in 0..27, a = i/28 * 2π, jit = 1 + 0.04*H.noise2(Math.cos(a)*5, Math.sin(a)*5, 11), point = [-45 + 148*cos(a)*jit, 73*sin(a)*jit].
- Gate gap: drop points with x < -150 and |z| < 20 (the west end, where the Propylaea stands). Split the remaining points into contiguous runs (polylines) and build each with `H.makeWall(run, h, 3.5, mats.rockDark)` where h = 9 for runs whose points have z > 40 (south stretch) and 7 otherwise (a run may be split further at the z = 40 threshold).
- Ashlar cap on the south stretch: for each south segment place `BoxGeometry(1.3, 0.8, 3.7)` blocks every 1.4 along the segment at y = 9.4, rotated to the segment direction; all in ONE `H.instance(..., mats.marbleWorn, transforms)`.
- Two flanking towers at the gap: `BoxGeometry(8, 11, 8)` `mats.rockDark` centred at (-158, 5.5, -22) and (-158, 5.5, 22).
- Beulé gate at (-165, 0, 8): two towers `BoxGeometry(5, 9, 5)` at z = 3 and z = 13 (centre y 4.5), lintel `BoxGeometry(1.5, 1.5, 12)` centred at y = 8.5, all `mats.marbleWorn`.
