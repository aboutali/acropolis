# Progress

| Step | Status |
|---|---|
| Scaffold, specs, checker, assembler | done |
| Modules 01–12 via Haiku build / Sonnet review loop | done (39 agent calls; all pass tools/check.mjs; 11/12 approved by Sonnet, 03-terrain's last defect was already fixed) |
| index.html assembled (72.8 KB) | done |
| Published: artifact https://claude.ai/artifact/ChPTh5wMTCmVXY8Z2cuGFz and GitHub Pages https://aboutali.github.io/acropolis/ | done |
| Visual review from headless screenshots (shots/ is gitignored) | done: round 1 fixed theatre treads, sky banding, flute depth, overlay z-index; 151k tris |
| Round 2 (cloud session) | done: see list below |

### Round 2 changes
- Camera presets: legend names fly the camera; `?view=parthenon|erechtheion|propylaea|promachos|southslope|overview` jumps on load; `&still` stops auto-rotate.
- Ionic columns: shafts, capitals and abaci were never added to the scene; only bases showed. New capitals have volute spirals, pulvini and Attic bases, turned by `rotY`.
- `makeCella`: long and short wall geometries were swapped, so walls stuck out of every temple; door openings were filled. Rewritten with a `thickness` option.
- Parthenon and Erechtheion lifted so their steps stand above the plateau.
- Erechtheion: cella refitted inside its base; east porch and caryatid porch stand in front of the walls.
- Temple of Athena Nike: thinner cella walls free its columns.
- Roof tiles: rows ran past the ridge, and a 1200-tile cap left half the Parthenon roof bare.
- Pediment figures: sat half a figure too high; now standing, kneeling and reclining figures fit the tympanum.
- South slope: both auditoria were hidden inside the cliff skirt and drawn with back-facing risers and downward treads. Moved to the cliff foot, rebuilt as one stepped mesh each, rock apron carved beneath them. Cypresses dropped onto the apron by raycast.
- `tools/shoot.mjs` renders every preset on desktop and phone viewports into `tools/shots/`.

## Next tasks for a cloud/mobile session
- Apply any visual issues from the review (see issues list in the last commit message or ask), re-run `node tools/check.mjs && node tools/assemble.mjs`, commit, push.
- Optional: Erechtheion north porch sits 3.2 m below the plateau and is buried; the terrain needs a cut there.
- Optional: a face direction for the Promachos statue and a shield.
