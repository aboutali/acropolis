# Shared preamble (read this before writing any module)

You are writing ONE JavaScript file of a single-page three.js scene: the Acropolis of Athens.
The page loads three.js **r128** UMD from cdnjs (global `THREE`). Modules are plain scripts, concatenated in order.

## Hard rules for every module
- The file contains **exactly one** top-level statement: `window.<name> = function(...) { ... };` (name and signature given in the module spec). No other top-level code, no `import`/`export`/`require`, no markdown fences, no comments outside the function except a 1-line header comment.
- Use only: the function arguments, `window.CFG`, and JS builtins. Never touch `document`, `scene`, `camera`, `renderer`, or any other `window.build*` (exceptions are stated in the spec for 01, 10, 11, 12).
- Return one `THREE.Group`, already placed in world space (set `group.position` yourself as the spec says).
- Every `THREE.Mesh`/`InstancedMesh` you create: `castShadow = true; receiveShadow = true;` (ground-hugging plates: receiveShadow only).
- **Never construct a Material** in modules 03–09; use `mats.<key>` only.
- FORBIDDEN (not available in r128 UMD): `OrbitControls`, `BufferGeometryUtils`, `mergeBufferGeometries`, `THREE.Geometry` (legacy), `TextureLoader`, `GLTFLoader`, `fetch`, `new Image`, any URL. Use `BufferGeometry` classes only (`BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `PlaneGeometry`, `TorusGeometry`, `ConeGeometry`, `IcosahedronGeometry`, `ExtrudeGeometry`, `Shape`) and `THREE.InstancedMesh` for repetition.
- Determinism: no `Math.random()`. Use `H.noise2(x, z, seed)` or a tiny inline LCG seeded with a constant.
- Caps: module ≤ 60k triangles; `radialSegments` ≤ 40; `SphereGeometry` ≤ (16,12); `TorusGeometry` ≤ (8,16). Any element repeated ≥ 8 times must use `THREE.InstancedMesh` (via `H.instance`).
- Units are metres. `+x` = East, `+z` = South, `+y` = up. Plateau top surface is `y = 0`. Surrounding city ground is `y = -80`.

## window.CFG (module 00)
```
CFG = { PLATEAU_H: 80, PLATEAU_X: 300, PLATEAU_Z: 150, PLATEAU_CX: -45, PLATEAU_CZ: 0,
        MOBILE: <bool, innerWidth < 640>, SEG: { colRadial: 40, colHeight: 4, capital: 24 } }  // SEG is 24/2/16 on MOBILE
```

## mats keys (module 01) — all MeshStandardMaterial
marble (0xe8e0cf, warm veined canvas texture), marbleWorn (0xd8cdb6, columns/walls), marbleShadowed (0xcfc4ad, interiors/undersides), rock (0x9a8f7a, noise texture), rockDark (0x7d735f, cliffs), ground (0xa9a08a), city (0xbfb6a4, flatShading), terracotta (0xb5643c, roof tiles), bronze (0x6f5b3e, metalness 0.85), foliageOlive (0x6e7b57), foliageCypress (0x38492f), trunk (0x584634)

## H helpers (module 02) — the ONLY H.* names that exist
```
H.makeDoricColumns(positions, opts) -> THREE.Group
   positions: [[x,z], ...] local coords; opts = {height:10.4, baseD:1.9, topD:1.48, flutes:20, entasis:0.02, y:0} (all optional, defaults shown). Columns stand with their base at y=opts.y.
H.makeIonicColumns(positions, opts) -> THREE.Group
   opts = {height:6.5, baseD:0.85, topD:0.72, flutes:24, y:0}
H.makeSteppedBase(w, d, steps, stepH, inset) -> THREE.Group   // inset default 0.7; TOP face at y=0, steps grow downward and outward. w along x, d along z.
H.makeEntablature(w, d, h, o) -> THREE.Group   // o = {triglyphs:true, triglyphCount:8, cornice:true, guttae:false}; bottom of group at y=0; rectangular ring w(x) × d(z).
H.makePediment(w, d, h, o) -> THREE.Group      // o = {figures:9, relief:true}; triangle in the x–y plane, base width w, thickness d along z, apex height h; bottom at y=0, centred on x=0. Rotate the group Math.PI around y for the opposite end.
H.makeGableRoof(w, d, pitch, o) -> THREE.Group // o = {tiles:true, acroteria:false}; eaves at y=0, ridge along z (the long axis), ridge height = (w/2)*pitch... ridge runs along the d axis.
H.makeCaryatid(height) -> THREE.Group          // default 2.3; origin at the feet, faces -z
H.makeFigure(height) -> THREE.Group            // stylized human, origin at the feet, marble
H.makeWall(points, height, thickness, mat) -> THREE.Group   // points: [[x,z],...] polyline; bottom at y=0
H.makeRockOutcrop(w, d, h, seed) -> THREE.Mesh // displaced PlaneGeometry lying flat (already rotated), centred at origin, amplitude h; receiveShadow only
H.makeCella(w, d, h, o) -> THREE.Group         // o = {doorWidth:4, doorSide:'+z'}; 4 walls thickness 1.2, bottom at y=0
H.makeBlockCourse(w, d, h, blockLen) -> THREE.Group   // one InstancedMesh ring of ashlar blocks, bottom at y=0
H.noise2(x, z, seed) -> number in [-1, 1]      // deterministic
H.instance(geo, mat, transforms) -> THREE.InstancedMesh   // transforms: [{p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz]}]; r and s optional; shadows set for you
```

## Site layout (world coords, x East, z South, plateau top y = 0)
| Element | centre (x,z) | footprint | heights |
|---|---|---|---|
| Rock plateau | (-45, 0) | 300 × 150 (ellipse-ish) | cliffs down to y = -80 |
| Parthenon | (0, 0), long axis along z | stylobate 30.9 (x) × 69.5 (z) | columns 10.43; ridge ≈ 19.5 |
| Erechtheion | (-42, -34), long axis along x | 22.8 × 11.6 | order 6.6; caryatid porch on the south side |
| Propylaea | (-118, -6), façade faces West (-x) | 24 (x) × 18 (z) + wings | Doric 8.6, Ionic 10.2, ridge 15 |
| Athena Nike | (-133, 20) | 5.4 × 8.2 temple on a 9.6 × 11.5 bastion | bastion top y = +3.2 |
| Athena Promachos | (-62, -12) | 3 × 3 plinth | statue 9 |
| Theatre of Dionysus | (-6, +96), y = -46 | cavea r 22→47, 200° arc | 24 rows |
| Odeon of Herodes | (-140, +72), y = -52 | cavea r 14→38, 180° | stage wall 76 × 22 |
| City blocks | ring r 220–1300 around origin, y = -80 | 220 boxes | 6–16 tall |

## Output
Write the file to the path named in the spec using the Write tool. Then run `node tools/check.mjs <that file>` from the repo root and fix anything it reports until it prints OK. Your final message must be exactly one line: `OK <file>` or `FAIL <file>: <reason>`.
