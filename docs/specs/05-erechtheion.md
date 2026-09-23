# Module 05 — src/05-erechtheion.js
Signature: `window.buildErechtheion = function (THREE, mats, H) { ...; return group; };`  Group at (-42, 0, -34). Long axis along x. Budget ≈ 14k tris. All coordinates below are local to the group.

- Base: `H.makeSteppedBase(22.8, 11.6, 2, 0.5)`.
- Main block: `H.makeCella(22.8, 11.6, 6.6, {doorWidth:3, doorSide:'+x'})`; entablature `H.makeEntablature(22.8, 11.6, 1.6, {triglyphs:false})` at y = 6.6; roof `H.makeGableRoof(11.6, 22.8, 0.2, {tiles:true})` with `rotation.y = Math.PI/2` (ridge along x) at y = 8.2.
- East porch: `H.makeIonicColumns(pos, {height:6.6, baseD:0.85})` with 6 positions at x = 12.9, z evenly in [-5.2, 5.2].
- North porch (projects to -z at the west end, floor 3.2 m BELOW the main floor — the building is split-level): floor slab `BoxGeometry(10.6, 0.5, 6.6)` `mats.marble` centred at (-7, -3.45, -8.9); 4 front Ionic columns `{height:7.63, baseD:0.92, y:-3.2}` at z = -11.6, x evenly in [-11.2, -2.8]; 2 side columns same opts at (x = -11.2, z = -8.6) and (x = -2.8, z = -8.6); entablature `H.makeEntablature(10.6, 6.4, 1.2, {triglyphs:false})` at (-7, 4.43, -8.9); flat roof slab `BoxGeometry(11.2, 0.6, 7.0)` `mats.marble` at (-7, 5.93, -8.9).
- Caryatid porch on the SOUTH face, centred at local (+6, 0, +5.8): podium `BoxGeometry(5.0, 1.8, 3.1)` `mats.marbleWorn` centred at (6, 0.9, 5.8); 6 × `H.makeCaryatid(2.3)` at y = 1.8: front row 4 at z = 5.8 + 1.2 with x = 6 + (-1.9, -0.63, 0.63, 1.9); rear 2 at z = 5.8 - 0.1 with x = 6 ± 1.9; entablature slab `BoxGeometry(5.4, 0.9, 3.5)` `mats.marble` centred at (6, 1.8 + 2.3 + 0.45, 5.8).
- West wall: 4 engaged half-columns `H.makeIonicColumns(pos, {height:5.8, baseD:0.7})` at x = -11.6, z evenly in [-4, 4] (they may intersect the wall).
- Olive tree at local (-13, 0, 4): trunk `CylinderGeometry(0.25, 0.4, 2.6, 8)` `mats.trunk` centred at y = 1.3; 3 canopy `IcosahedronGeometry(1.9, 0)` `mats.foliageOlive` around y = 3.5 offset ±1.
