# Module 09 — src/09-scenery.js
Signature: `window.buildScenery = function (THREE, mats, H) { ...; return group; };`  Group at (0,0,0). Budget ≈ 8k tris.

- Athena Promachos at (-62, 0, -12): plinth `BoxGeometry(3, 2.5, 3)` `mats.marble` centred at y = 1.25; `var f = H.makeFigure(9.0); f.position.y = 2.5; f.traverse(function (o) { if (o.isMesh) o.material = mats.bronze; });` spear `CylinderGeometry(0.08, 0.08, 11, 6)` `mats.bronze` at (x + 1.2, 2.5 + 5.5, z).
- Great Altar at (-8, 0, -41): `BoxGeometry(12, 2.2, 6)` `mats.marble` centred at y = 1.1, plus `BoxGeometry(10, 0.6, 4)` on top centred at y = 2.5.
- Deterministic LCG (seed 42): `var s = 42; function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }`.
- 34 olive trees: positions on the plateau ellipse centre (-45, 0), rx 148, rz 73, at radius factor in [0.78, 0.92], angle uniform; reject positions inside any exclusion rectangle (x0, z0, x1, z1): Parthenon (-18,-38,18,38), Erechtheion (-56,-46,-28,-22), Propylaea (-135,-30,-100,25), Nike (-140,12,-126,28), Promachos (-66,-16,-58,-8), Altar (-16,-46,0,-36); keep drawing until 34 accepted. Trunks: one `H.instance(CylinderGeometry(0.25, 0.4, 2.6, 8), mats.trunk, ...)` at y = 1.3; canopies: one `H.instance(IcosahedronGeometry(1.9, 0), mats.foliageOlive, ...)` with 3 blobs per tree around y = 3.5 with ±0.8 offsets and scale 0.8–1.2.
- 12 cypresses on the south slope: x in [-150, 40], z in [80, 110], y = -8 - (z - 80) * 0.7; `ConeGeometry(1.3, 9, 8)` `mats.foliageCypress` centred at y + 5.2, trunks `CylinderGeometry(0.2, 0.25, 1.5, 6)` `mats.trunk` at y + 0.75; both via H.instance.
- 60 rubble blocks `BoxGeometry(1.2, 0.5, 0.8)` `mats.marbleWorn` via H.instance, positions on the ellipse at radius factor [0.85, 0.93], random yaw, y = 0.25.
