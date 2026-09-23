# Acropolis of Athens — high-detail three.js page, built by a Haiku/Sonnet loop

## Context

The user wants an interactive, high-detail 3D rendering of the Acropolis of Athens as a single three.js web page, comparable to something a friend built, living in their GitHub repo `aboutali/acropolis` and also published as a claude.ai artifact. The distinguishing requirement is **cost parsimony**: Opus was used once for the architecture (done in plan mode; its output is folded in below). Every build task runs on Haiku with Sonnet as reviewer in a build → review → fix loop, orchestrated deterministically by the Workflow tool. Chrome screenshots verify the visual result. At the end, the work is handed off so the user can continue from their phone.

## Repository

- Target: `https://github.com/aboutali/acropolis` (public, **empty**, default branch `main`). No local clone yet.
- Step 0: `git clone` to `C:\Users\angel\acropolis`; all work happens there.
- Layout:
  ```
  acropolis/
    index.html            # assembled single-file page (generated + committed)
    src/00-config.js … src/12-main.js   # one module per file, fixed order
    tools/assemble.mjs    # concatenates src/* into index.html
    tools/check.mjs       # node --check + regex gate + stub-THREE smoke test
    docs/PLAN.md          # this plan (so a cloud session has full context)
    docs/PROGRESS.md      # per-module status, updated by the orchestrator
    README.md
  ```
- Delivery: push to `main`, enable GitHub Pages (`main` / root) via `gh api`, publish `index.html` as an artifact. Both links in the final message.

## Model allocation (maximum parsimony)

| Stage | Model | Effort |
|---|---|---|
| Architecture (done) | Opus | – |
| Write `tools/*.mjs`, HTML shell, Workflow script | this session (glue, no agents) | – |
| Write each JS module | Haiku | low |
| Static review of each module | Sonnet | low |
| Fix rounds (max 3 per module) | Haiku | low |
| Screenshot review | Sonnet (reads 3 PNGs) | low |
| Visual fix rounds (max 2) | Haiku → Sonnet | low |
| Escalation only: if `02-helpers.js` fails 3 Haiku rounds | Sonnet writes it once | low |

Expected: 13 modules × (1 build + 1 review + ~1 fix pair) ≈ 40–50 cheap calls, plus ~6 for the visual pass.

## Platform decisions (fixed)

- three.js **r128** UMD from cdnjs (`three.min.js`, global `THREE`). Not available and forbidden in modules: `OrbitControls`, `BufferGeometryUtils`/`mergeBufferGeometries`, `THREE.Geometry`, loaders. Repetition uses `InstancedMesh`.
- Zero network assets; textures are `CanvasTexture` generated in `01-mats.js`.
- Units metres. `+x` East, `+z` South, `+y` up. Plateau top `y=0`; city ground `y=-80`. Parthenon centred at origin, long axis along x.
- Artifact host rules: page must work at 390 px wide; one `<script>` per module so one parse error cannot blank the page; `12-main.js` wraps every builder in try/catch.

## Module graph (concatenation order)

```
00-config.js    window.CFG                                  constants (PLATEAU_H 80, 300×150 plateau centred (-45,0), MOBILE flag, SEG levels)
01-mats.js      window.buildMats(THREE) -> mats             marble, marbleWorn, marbleShadowed, rock, rockDark, ground, city, terracotta, bronze, foliageOlive, foliageCypress, trunk; noiseTex() canvas helper
02-helpers.js   window.makeHelpers(THREE, mats) -> H        the only hard file (~200 lines)
03-terrain.js   window.buildTerrain(THREE, mats, H)         plateau outcrop, cliff skirt, 3000 m ground, 220 instanced city blocks, sacred way
04-parthenon.js window.buildParthenon(THREE, mats, H)       8×17 Doric peristyle 10.43 m, stylobate 30.9×69.5, 3 steps, entablature 3.3, pediments w/ 11 figures, tiled roof, cella + inner colonnade, cult statue
05-erechtheion.js window.buildErechtheion(THREE, mats, H)   at (-42,-34): east Ionic porch, split-level north porch, south Caryatid porch (6 × makeCaryatid), engaged west columns
06-propylaea.js window.buildPropylaea(THREE, mats, H)       at (-118,-6): central hall (6 Doric west/east, 6 Ionic inside), N/S wings, Nike bastion + Temple of Athena Nike (4+4 Ionic 4.0 m)
07-walls.js     window.buildWalls(THREE, mats, H)           28-point perimeter polyline, 7–9 m, gate gap + towers, Beulé gate
08-southslope.js window.buildSouthSlope(THREE, mats, H)     Theatre of Dionysus (24 rings) and Odeon of Herodes (18 rings, 76 m niche stage wall)
09-scenery.js   window.buildScenery(THREE, mats, H)         Athena Promachos 9 m bronze, altar, 34 olives + 12 cypresses, 60 rubble blocks
10-env.js       window.buildEnv(THREE, scene, renderer)     shader sky sphere, hemi + sun (shadow 2048/1024, normalBias 0.4), ambient, FogExp2, ACES tone mapping
11-orbit.js     window.makeOrbit(THREE, camera, el, opts)   ~60-line orbit: damping, pointer events, pinch, wheel, auto-rotate after 4 s idle
12-main.js      bootstrap                                   scene/camera (48°, at 170,95,205), builders in try/catch, resize debounce, legend panel, hint, auto-rotate button, ?debug readout
```

Rules in every Haiku prompt: exactly one top-level `window.buildX = function(...){...}`; use only the arguments, `window.CFG` and JS builtins; never touch `document`/scene/camera/other builders; return one positioned `THREE.Group`; set `castShadow`/`receiveShadow` on meshes; no materials constructed in modules; caps: module ≤ 60k tris, `radialSegments` ≤ 40, sphere ≤ (16,12), torus ≤ (8,16); use `H.noise2` not `Math.random`.

## Helper contract (`02-helpers.js`) — the table modules 03–09 see

```
H.makeDoricColumns(positions[[x,z]], {height:10.4, baseD:1.9, topD:1.48, flutes:20, entasis:0.02, y:0}) -> Group (3 InstancedMesh: fluted shaft, echinus, abacus)
H.makeIonicColumns(positions, {height:6.5, baseD:0.85, topD:0.72, flutes:24, y:0}) -> Group (base, shaft, 2 torus volutes, abacus)
H.makeSteppedBase(w, d, steps, stepH, inset=0.7) -> Group  (top face at y=0, grows downward)
H.makeEntablature(w, d, h, {triglyphs, triglyphCount, cornice, guttae}) -> Group (bottom at y=0)
H.makePediment(w, d, h, {figures, relief}) -> Group (Shape+Extrude tympanum, raking cornice, figures)
H.makeGableRoof(w, d, pitch, {tiles, acroteria}) -> Group (slabs + instanced tiles)
H.makeCaryatid(height=2.3) -> Group (origin at feet)
H.makeFigure(height) -> Group (7 primitives, ~100 tris)
H.makeWall(points[[x,z]], height, thickness, mat) -> Group (bottom at y=0)
H.makeRockOutcrop(w, d, h, seed) -> Mesh (displaced plane, receiveShadow only)
H.makeCella(w, d, h, {doorWidth, doorSide}) -> Group
H.makeBlockCourse(w, d, h, blockLen) -> Group (one InstancedMesh)
H.noise2(x, z, seed) -> number in [-1,1]
H.instance(geo, mat, [{p,r,s}]) -> InstancedMesh
```

## Site layout (x East, z South; plateau top y=0)

| Element | centre (x,z) | footprint | heights |
|---|---|---|---|
| Rock plateau | (-45, 0) | 300×150 | cliffs to y=-80 |
| Parthenon | (0, 0) | 30.9×69.5 | cols 10.43, ridge ≈19.5 |
| Erechtheion | (-42, -34) | 22.8×11.6 | order 6.6; caryatid porch south at (-36,-26) |
| Propylaea | (-118, -6) | 24×18 + wings | Doric 8.6, Ionic 10.2, ridge 15 |
| Athena Nike | (-133, 20) | 5.4×8.2 on 9.6×11.5 bastion | bastion top +3.2 |
| Promachos | (-62, -12) | 3×3 plinth | statue 9 |
| Theatre of Dionysus | (-6, +96) y=-46 | r 22→47, 200° | 24 rows |
| Odeon | (-140, +72) y=-52 | r 14→38, 180° | stage wall 76×22 |
| City | ring r 220–1300, y=-80 | 220 boxes | 6–16 tall |

Triangle budget ≈ 136k total (< 300k target); instancing mandatory for any repeated element with count ≥ 8.

## Static check pipeline (`tools/check.mjs`, no LLM)

1. `node --check` every module.
2. Regex gate: reject `BufferGeometryUtils|OrbitControls|mergeBufferGeometries|THREE\.Geometry\b|TextureLoader|fetch\(|https?://|require\(|^import `; extract `H.\w+` / `mats.\w+` and diff against the allowlists above.
3. Stub-THREE smoke test: Proxy-based `THREE` and `mats`, real no-op `H` table; `eval` the module, call the builder, assert truthy return, record every constructor arg and fail on `NaN`. Failures go back to Haiku with the stack trace.

`tools/assemble.mjs`: HTML shell + cdnjs script tag + one `<script>` per module in order, main wrapped in `DOMContentLoaded`. Target < 120 KB.

## Sonnet static review checklist (per module)

1. One top-level assignment, no import/export/require.
2. Returns a `THREE.Group` on every path; `group.position` matches the layout table.
3. Only listed `H.*` and `mats.*` names; none of the forbidden APIs or URLs.
4. No undeclared identifiers.
5. Dimensions within ±25 % of the spec; nothing buried or floating (check base y).
6. Under the tri cap; instancing used where count ≥ 8.
7. Shadows flags set; no materials constructed.
8. No coplanar duplicates (stacked slabs offset ≥ 0.02 m).
9. No unseeded `Math.random`.

Output schema: `{ approved: boolean, defects: [{ n, where, problem, fix }] }`.

## Workflow script shape (Haiku builds, Sonnet reviews)

```js
export const meta = { name:'acropolis-build', description:'Haiku writes each three.js module, Sonnet reviews, loop to 3 rounds', phases:[{title:'Build'},{title:'Review'}] }
const MODULES = args.modules            // [{name, spec, preamble}] — spec text from docs/PLAN.md sections
const CODE = {type:'object', properties:{code:{type:'string'}}, required:['code']}
const REVIEW = {type:'object', properties:{approved:{type:'boolean'}, defects:{type:'array'}}, required:['approved','defects']}
const results = await pipeline(MODULES,
  m => agent(`${m.preamble}\n\nWrite src/${m.name}.js exactly to this spec:\n${m.spec}\nReturn only the code.`, {label:`build:${m.name}`, phase:'Build', model:'haiku', effort:'low', schema:CODE}),
  async (built, m) => {
    let code = built.code, rounds = 0, review
    while (rounds < 3) {
      review = await agent(`Review this module against the checklist. Do not run it.\nSPEC:\n${m.spec}\nCHECKLIST:${CHECKLIST}\nCODE:\n${code}`, {label:`review:${m.name}#${rounds}`, phase:'Review', model:'sonnet', effort:'low', schema:REVIEW})
      if (!review || review.approved) break
      const fixed = await agent(`${m.preamble}\nRewrite the whole file fixing every defect:\n${JSON.stringify(review.defects)}\nCODE:\n${code}`, {label:`fix:${m.name}#${rounds}`, phase:'Build', model:'haiku', effort:'low', schema:CODE})
      code = fixed.code; rounds++
    }
    if (review && !review.approved) log(`${m.name}: unresolved after 3 rounds: ${review.defects.length} defects`)
    return { name:m.name, code, approved: review?.approved ?? false, rounds }
  })
return results.filter(Boolean)
```

The orchestrator (this session) writes each returned `code` to `src/`, runs `tools/check.mjs`; check failures are fed back with a second, smaller Workflow run over just the failing modules (same script, `args.modules` filtered, failure text appended to the spec). Helpers escalate to Sonnet only after 3 failed Haiku rounds.

## Visual pass

1. `tools/assemble.mjs` → `index.html`; publish as artifact.
2. Chrome tools: open the artifact, take 3 screenshots (390 px portrait, 1440 px, low-angle close-up of the Erechtheion via `?debug` readout also captured).
3. Sonnet reads the images against the visual checklist: distinct fluted columns with shadow gaps; triangular filled pediments not intersecting the roof; 6 countable caryatids; Propylaea reads as a gateway; Nike temple on the bastion; cliff meets ground with no gap; sky gradient present; consistent shadow direction; no shimmer/acne; legend not covering the Parthenon at 390 px; debug FPS ≥ 30. Schema `{ ok, issues:[{module, instruction}] }`.
4. Issues → same Haiku/Sonnet loop on the named modules only, max 2 visual rounds; republish.

## Delivery

- Commit in small steps (scaffold; modules; assembled page; docs), push `main`, enable Pages, publish artifact.
- Write `docs/PLAN.md` (this file) and `docs/PROGRESS.md` into the repo so any later session has context.

## Mobile hand-off (last step)

An existing terminal session cannot be pushed to the cloud. After the final push:

1. **Cloud session (works with the laptop closed, recommended)**: the user runs, from the repo,
   ```
   claude --cloud "Continue the acropolis project: read README.md and docs/PLAN.md and docs/PROGRESS.md, then <next task>"
   ```
   The user has already set a default remote environment ("aboutali open network access"), and the repo is on GitHub, so this should launch directly; they then drive it from the Claude mobile app. I will print the exact command since it needs their interactive auth.
2. **Fallback, Remote Control (laptop must stay on)**: `/remote-control` in this session keeps this exact context reachable from the phone.

## Verification

- `node tools/check.mjs` passes for all 13 modules (syntax, regex gate, stub smoke test).
- `index.html` opens locally and as an artifact with no console errors; `?debug` shows < 300k triangles and ≥ 30 FPS on desktop.
- Sonnet screenshot review returns `ok: true` (or its remaining issues are listed in the final message).
- Phone-width screenshot shows the scene and controls usable.
- GitHub Pages URL and artifact URL both load.
