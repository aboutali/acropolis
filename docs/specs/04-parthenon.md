# Module 04 — src/04-parthenon.js
Signature: `window.buildParthenon = function (THREE, mats, H) { ...; return group; };`  Group at (0, 0, 0). Long axis along z. Budget ≈ 48k tris.

- Stylobate: `H.makeSteppedBase(30.9, 69.5, 3, 0.55, 0.7)` (top at y=0).
- Peristyle 8 × 17 = 46 columns: place columns on the rectangle inset 1.3 from the stylobate edge (x = ±14.15, z = ±33.45): 8 evenly spaced across x on each short side (z = ±33.45) and 17 evenly spaced across z on each long side (x = ±14.15); do not duplicate the 4 corners (46 total). `H.makeDoricColumns(pos, {height:10.43, baseD:1.91, topD:1.48, flutes:20})`.
- Entablature: `H.makeEntablature(30.9, 69.5, 3.3, {triglyphs:true, triglyphCount:16})` at y = 10.43.
- Pediments: `H.makePediment(30.9, 1.2, 3.4, {figures:11})` at (0, 13.73, +34.75); a second one with `rotation.y = Math.PI` at (0, 13.73, -34.75).
- Roof: `H.makeGableRoof(31.5, 70, 0.22, {tiles:true, acroteria:true})` at y = 13.7 (the helper's ridge runs along its d axis = z, which is what we want).
- Cella: `H.makeCella(21.7, 59, 10.0, {doorWidth:4.5, doorSide:'+z'})` at (0,0,0).
- Pronaos and opisthodomos: 6 Doric columns each, `{height:8.0, baseD:1.5, topD:1.2}`, x evenly spread in [-9, 9], at z = +26 and z = -26.
- Interior colonnade: two rows of 10 Doric columns `{height:5.0, baseD:0.9, topD:0.75, flutes:16}` at x = ±7.5, z evenly from -20 to +18; plus a rear row of 5 at z = -23, x evenly in [-6, 6].
- Inner frieze band: `H.makeBlockCourse(22.5, 59.8, 1.0, 1.2)` at y = 9.0.
- Cult statue: `var s = H.makeFigure(11.5); s.position.set(0, 0, -10); s.traverse(function (o) { if (o.isMesh) o.material = mats.bronze; });`
