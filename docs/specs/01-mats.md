# Module 01 — src/01-mats.js
Signature: `window.buildMats = function (THREE) { ...; return mats; };` where `mats` has exactly the 12 keys below.
Exception to the rules: this module MAY use `document.createElement('canvas')` to build textures and MAY construct materials. No other DOM use.

Internal helper `noiseTex(size, amp, tint)`:
- canvas `size`×`size` (use 256), fill with `tint` (a CSS colour string), then value noise: 4 octaves; for each 2×2 pixel block draw `ctx.fillRect(x, y, 2, 2)` with `rgba(0,0,0,a)` where `a = amp * n`, n in [0,1] from a seeded LCG (constant seed, NOT Math.random).
- then 60 faint streaks: `ctx.strokeStyle = 'rgba(0,0,0,0.05)'`, lines across the canvas at LCG positions, for marble veining.
- return `new THREE.CanvasTexture(c)` with `wrapS = wrapT = THREE.RepeatWrapping`.
- Make at most 4 canvases total (warm marble, grey rock, ground, and reuse the rest). To reuse a texture with a different repeat, do `var t2 = tex.clone(); t2.needsUpdate = true;`.

Materials (each `new THREE.MeshStandardMaterial({...})`):

| key | color | roughness | metalness | extra |
|---|---|---|---|---|
| marble | 0xe8e0cf | 0.75 | 0 | map = noiseTex(256, 0.08, '#e8e0cf'), map.repeat.set(4,4) |
| marbleWorn | 0xd8cdb6 | 0.9 | 0 | cloned marble map, repeat (2,6) |
| marbleShadowed | 0xcfc4ad | 0.92 | 0 | no map |
| rock | 0x9a8f7a | 1.0 | 0 | map = noiseTex(256, 0.35, '#9a8f7a'), repeat (8,8) |
| rockDark | 0x7d735f | 1.0 | 0 | cloned rock map, repeat (6,3) |
| ground | 0xa9a08a | 1.0 | 0 | map = noiseTex(256, 0.2, '#a9a08a'), repeat (60,60) |
| city | 0xbfb6a4 | 0.95 | 0 | flatShading: true |
| terracotta | 0xb5643c | 0.85 | 0 | |
| bronze | 0x6f5b3e | 0.45 | 0.85 | |
| foliageOlive | 0x6e7b57 | 1.0 | 0 | flatShading: true |
| foliageCypress | 0x38492f | 1.0 | 0 | flatShading: true |
| trunk | 0x584634 | 1.0 | 0 | |

Guard: if `document` is undefined (test environment), skip textures and return the materials without maps. ~80 lines.
