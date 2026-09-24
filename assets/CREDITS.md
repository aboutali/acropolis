# Texture credits

All textures are CC0 (public domain) photo-scanned PBR materials. Files were
resized to 1k/2k JPG and recompressed (Pillow, quality ~82); the marble and
plaster albedo were colour-graded toward a warmer, creamier tone to match
Pentelic marble and Attic whitewash. No geometry or non-CC0 content is
included.

| assets/tex/ files | Source asset | Source | Author(s) | License |
|---|---|---|---|---|
| `marble_col[.,_2k].jpg`, `marble_nor[.,_2k].jpg`, `marble_rough[.,_2k].jpg` | Marble012 | ambientCG (https://ambientcg.com/a/Marble012) | ambientCG | CC0 |
| `rock_col.jpg`, `rock_nor.jpg`, `rock_rough.jpg` | Marble Cliff 01 | Poly Haven (https://polyhaven.com/a/marble_cliff_01) | Rob Tuytel | CC0 |
| `rockdark_col.jpg`, `rockdark_nor.jpg`, `rockdark_rough.jpg` | Marble Cliff 02 | Poly Haven (https://polyhaven.com/a/marble_cliff_02) | Rob Tuytel | CC0 |
| `ground_col.jpg`, `ground_nor.jpg`, `ground_rough.jpg` | Dry Ground Rocks | Poly Haven (https://polyhaven.com/a/dry_ground_rocks) | Rob Tuytel | CC0 |
| `terracotta_col.jpg`, `terracotta_nor.jpg`, `terracotta_rough.jpg` | Roof Tiles | Poly Haven (https://polyhaven.com/a/roof_tiles) | Stephan Seeliger | CC0 |
| `plaster_col.jpg`, `plaster_nor.jpg`, `plaster_rough.jpg` | White Stucco | Poly Haven (https://polyhaven.com/a/white_stucco) | Amal Kumar | CC0 |

`mats.marbleStatue` reuses the `marble` texture set (with a smoother,
lower-roughness override in `01-mats.js`) rather than a separate download.
`mats.bronze`/`mats.bronzePatina`, `mats.city`, and vegetation/gold/ivory
materials keep their original procedural (CanvasTexture) look — no CC0 photo
match was pulled in for those in this pass.

Downloaded via the Poly Haven API (`api.polyhaven.com`, files from
`dl.polyhaven.org`) and the ambientCG API (`ambientcg.com/api/v2/full_json`,
files from `ambientcg.com/get?file=...`).
