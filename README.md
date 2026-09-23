# Acropolis of Athens — procedural 3D reconstruction

A single self-contained `index.html` that renders the Acropolis (Parthenon, Erechtheion with the Caryatids, Propylaea, Temple of Athena Nike, walls, Theatre of Dionysus, Odeon of Herodes Atticus) with three.js r128. All geometry and textures are generated in code; there are no asset files.

- `src/NN-*.js` — one module per element; concatenated in order by `tools/assemble.mjs`.
- `tools/check.mjs` — syntax, forbidden-API and stub-THREE smoke checks for each module.
- `docs/PLAN.md`, `docs/specs/` — the design and the per-module specs the build agents follow.
- `docs/PROGRESS.md` — build status.

Build: `node tools/check.mjs && node tools/assemble.mjs`, then open `index.html`. Add `?debug` to the URL for a triangle/FPS readout.
