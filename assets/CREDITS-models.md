# 3D scan credits

Scanned sculpture models under `assets/models/` are derived from real photogrammetry
scans, processed offline (decimated, UV-unwrapped, baked to normal/AO maps, exported
as GLB) by `tools/blender/make_statues.py`. The originals:

## Parthenon Sculpture Gallery (CC BY 4.0)

"Parthenon Sculpture Gallery" by the USC Institute for Creative Technologies,
Skulpturhalle Basel, and the Visual Computing Lab, ISTI-CNR, Pisa — uploaded by
Cosmo Wenman. Licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Source: https://archive.org/details/thingiverse-25298

Used here (each decimated from the ~100k-triangle release mesh):

- `Caryatid_100K.stl` -> `assets/models/caryatid.glb`
- `Dionysos_100K.stl` -> `assets/models/dionysos.glb`
- `Iris_100K.stl` -> `assets/models/iris.glb`
- `Artemis_100K.stl` -> `assets/models/artemis.glb`
- `Kekrops-Pandrossos_100K.stl` -> `assets/models/kekrops_pandrossos.glb`
- `South_Metope_09_100K.stl` -> `assets/models/metope_south09.glb`
- `North_Metope_03_100K.stl` -> `assets/models/metope_north03.glb`
- `West_Metope_09_100K.stl` -> `assets/models/metope_west09.glb`
- `East_Metope_10_100K.stl` -> `assets/models/metope_east10.glb`
- `South_Frieze_10_100K.stl` -> `assets/models/frieze_south10.glb`
- `North_Frieze_38-39_100K.stl` -> `assets/models/frieze_north3839.glb`
- `West_Frieze_01-02_100K.stl` -> `assets/models/frieze_west0102.glb`

## Parthenon horse head (CC BY 3.0)

Horse head from the west pediment (Selene's chariot team), scanned by Cosmo Wenman.
Licensed under
[Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/).
Source: https://archive.org/details/thingiverse-83781

- `Example_-_Parthenon_horse_scanned_by_Cosmo_Wenman.stl` -> `assets/models/horse_head.glb`

## Processing

All models were reoriented, recentred, scaled to the real-world dimensions noted in
`docs/PLAN.md`, decimated to a desktop-friendly triangle budget, UV-unwrapped, and
baked (tangent-space normal + ambient occlusion, from the original ~100k/537k-tri
mesh onto the low-poly copy) with headless Blender via `tools/blender/make_statues.py`.
No geometry was otherwise altered. See that script for exact per-model parameters.
