# Module 06 — src/06-propylaea.js
Signature: `window.buildPropylaea = function (THREE, mats, H) { ...; return group; };`  Group at (-118, 0, -6). The façade faces West (-x). Budget ≈ 20k tris. Local coordinates.

Central hall
- `H.makeSteppedBase(24, 18, 4, 0.5)`.
- West façade: 6 Doric `H.makeDoricColumns(pos, {height:8.57, baseD:1.6, topD:1.25})` at x = -10.5, z evenly in [-7.5, 7.5]. East façade: 6 Doric `{height:8.0, baseD:1.5, topD:1.2}` at x = +10.5, same z.
- Interior: 6 Ionic `H.makeIonicColumns(pos, {height:10.25, baseD:1.0})` in two rows of 3 at z = ±2.6, x = -5, 0, 5.
- Cross-wall at x = +3 built from boxes in `mats.marbleWorn`: 6 pillars `BoxGeometry(1.5, 9, 1.3)` at z = -8.5, -5.4, -2.2, 2.2, 5.4, 8.5 (centre y 4.5) and a lintel `BoxGeometry(1.5, 2, 18)` centred at y = 8 (this leaves 5 doorways, the central one 4.4 wide).
- Entablature `H.makeEntablature(24, 18, 2.6, {triglyphs:true, triglyphCount:12})` at y = 8.57.
- Pediments: `H.makePediment(18, 1.0, 2.6, {figures:0})` with `rotation.y = -Math.PI/2` at (-12, 11.17, 0) and another with `rotation.y = Math.PI/2` at (12, 11.17, 0).
- Roof `H.makeGableRoof(18, 24, 0.24, {tiles:true})` with `rotation.y = Math.PI/2` (ridge along x) at y = 11.2.

Wings
- North wing (Pinakotheke) centred at local (-8, 0, -16): `H.makeSteppedBase(12, 10, 2, 0.5)`, `H.makeCella(12, 10, 5.4, {doorWidth:2.5, doorSide:'+z'})`, 3 Doric `{height:5.4, baseD:1.0, topD:0.8}` at z = -16 + 5.5, x = -8 + (-4, 0, 4); flat roof slab `BoxGeometry(12.6, 0.5, 10.6)` `mats.marble` at y = 5.65.
- South wing centred at local (-8, 0, +17): `H.makeSteppedBase(9, 8, 2, 0.5)`, `H.makeCella(9, 8, 5.4, {doorWidth:2.5, doorSide:'-z'})`, 3 Doric 5.4 at z = 17 - 4.5, x = -8 + (-3, 0, 3); flat roof slab 9.6 × 0.5 × 8.6 at y = 5.65.

Nike bastion and temple, centred at local (-15, 0, +26)
- Bastion: `BoxGeometry(9.6, 6, 11.5)` `mats.rock` centred at y = 0.2 (rises to +3.2); ashlar cap `H.makeBlockCourse(9.6, 11.5, 1.2, 1.4)` at y = 2.0; 6 bronze railing posts `CylinderGeometry(0.06, 0.06, 1.2, 6)` `mats.bronze` around the top edge at y = 3.8, use H.instance.
- Temple of Athena Nike, all at base y = 3.9: `H.makeSteppedBase(5.44, 8.27, 2, 0.35)` positioned at y = 3.9; `H.makeIonicColumns(pos, {height:4.0, baseD:0.56, y:3.9})` with 4 positions on each short end (z = 26 ± 3.4, x = -15 + evenly in [-2.1, 2.1]) — 8 columns; cella `H.makeCella(3.7, 5.0, 4.0, {doorWidth:1.4, doorSide:'+z'})` at y = 3.9; entablature `H.makeEntablature(5.44, 8.27, 1.1, {triglyphs:false})` at y = 7.9; roof `H.makeGableRoof(5.6, 8.4, 0.18, {tiles:true})` at y = 9.0; two pediments `H.makePediment(5.6, 0.5, 0.9, {figures:0})` at z = 26 ± 4.2, y = 9.0 (one rotated PI about y).
