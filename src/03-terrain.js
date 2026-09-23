// Terrain: plateau surface, stratified cliffs, hillside descending to the plain, city, sacred way
window.buildTerrain = function (THREE, mats, H) {
  var group = new THREE.Group();
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var PI = Math.PI, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt;

  function lcg(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // Weathering tint shared by the plateau + cliff: broad honey/iron patches plus darker
  // streak/lichen zones, sampled straight off world x,z (playing the role of a normal map's
  // discoloration channel, since materials and textures belong to the module that builds mats).
  // The macro/macro2/patch layers sit at 0.018-0.07 Hz -- well below the 0.32/0.58/1.05 Hz used
  // by fineWeather()'s height displacement -- and are multiplied together (rather than summed)
  // so colour patches read as chaotic 30-55m blotches independent of the terrain's own ripple,
  // instead of tracing it.
  function weatherTint(x, z, seed, vparams) {
    var macro = H.noise2(x * 0.018, z * 0.022, seed + 5);    // ~45-55m broad discoloration blobs
    var macro2 = H.noise2(x * 0.031, z * 0.026, seed + 6);   // second, differently-oriented low-freq layer
    var patch = H.noise2(x * 0.07, z * 0.06, seed + 1);      // mid-scale honey patches
    var fine = H.noise2(x * 0.15, z * 0.16, seed + 3);       // fine mottling, kept below vertex-grid Nyquist to avoid banding
    var honey = (0.5 + 0.5 * macro) * (0.55 + 0.45 * (0.5 + 0.5 * macro2)) * (0.7 + 0.3 * (0.5 + 0.5 * patch));
    var mult = 0.8 + 0.36 * honey + 0.04 * fine;
    var streakN = H.noise2(x * 0.013, z * 0.016, seed + 2);   // very broad water-streak/lichen bands
    // Wide, soft-edged falloff (rather than a hard threshold) so the darkened bands blend across
    // the coarse cliff mesh instead of showing as blocky facets at close range.
    var streak = clamp01((-0.05 - streakN) / 0.85);
    if (vparams) {
      // Directional water-stain / iron-oxide streaks down the cliff face: a sine wave along the
      // cliff's arc length whose phase is perturbed by low-frequency noise (so streaks land
      // irregularly rather than at perfectly even intervals), gated to a band per streak, and
      // ramped so staining concentrates near the base and fades out toward the plateau rim.
      var s = vparams.a * 130; // approx arc-length coordinate around the ellipse
      var phase = s * 0.28 + H.noise2(s * 0.015, 0, seed + 11) * 5;
      var band = Math.pow(Math.max(0, cos(phase)), 6);
      var ramp = clamp01((-vparams.y) / 46);
      var irregular = 0.4 + 0.6 * (0.5 + 0.5 * H.noise2(s * 0.05, vparams.y * 0.08, seed + 12));
      streak = clamp01(streak * 0.55 + band * ramp * irregular);
    }
    var r = mult * (1 - 0.28 * streak);
    var g = mult * (1 - 0.11 * streak); // lichen reads greenish: green channel darkens least
    var b = mult * (1 - 0.32 * streak);
    return [clamp01(r), clamp01(g), clamp01(b)];
  }
  function paintVertexColors(geo, seed, cliffMode) {
    var pos = geo.attributes.position, arr = pos.array, n = pos.count;
    var col = new Float32Array(n * 3);
    for (var vi = 0; vi < n; vi++) {
      var x = arr[vi * 3], y = arr[vi * 3 + 1], z = arr[vi * 3 + 2];
      var vparams = cliffMode ? { y: y, a: Math.atan2((z - CZ) / RZ, (x - CX) / RX) } : null;
      var c = weatherTint(x, z, seed, vparams);
      col[vi * 3] = c[0]; col[vi * 3 + 1] = c[1]; col[vi * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  function weatheredMat(base, seed, uvScaleOverride) {
    var m = base.clone();
    m.vertexColors = true;
    m.userData = {}; // fresh object: don't mutate the shared mats.* material's userData
    for (var uk in base.userData) m.userData[uk] = base.userData[uk]; // keep uvScale for finishScene's box-projected UVs
    // mats.rock's baked texture has horizontal strata bands at its native 14m tile: correct for a
    // vertical cliff face, but box-projected onto a horizontal surface (top-down u=x,v=z) they
    // show up as a tight, unnaturally regular ripple every ~2.3m -- a texture-tiling artifact, not
    // a geometry one, so it survives any change to the height-field or vertex-colour noise alone.
    // A much larger tile on this clone only spreads that same texture into broad, soft bands.
    if (uvScaleOverride) m.userData.uvScale = uvScaleOverride;
    return m;
  }

  // ---------------- 1. Plateau top: worn limestone, bedrock patches, cuttings ----------------
  var PW = 300, PD = 150, segX = MOBILE ? 72 : 130, segZ = MOBILE ? 36 : 66;
  var topGeo = new THREE.PlaneGeometry(PW, PD, segX, segZ);
  topGeo.rotateX(-PI / 2);
  var cuttings = [
    { x: -95, z: 30, w: 16, d: 10, depth: 1.4 },
    { x: 35, z: -50, w: 12, d: 8, depth: 1.0 },
    { x: -20, z: 55, w: 20, d: 9, depth: 0.9 }
  ];
  function cutAt(x, z) {
    var cut = 0;
    for (var i = 0; i < cuttings.length; i++) {
      var c = cuttings[i];
      var dx = Math.abs(x - c.x) / (c.w / 2), dz = Math.abs(z - c.z) / (c.d / 2);
      var r = Math.max(dx, dz);
      if (r < 1) cut = Math.max(cut, c.depth * (1 - r * r) );
    }
    return cut;
  }
  // Fractal weathering detail: extra octaves layered on top of the broad shape so the surface
  // reads as irregularly worn limestone rather than a smooth digital ripple. Frequencies are kept
  // well below the plateau mesh's own vertex density (~2.3m desktop, ~4.2m mobile spacing) --
  // the previous 0.58/1.05 Hz octaves sat far past that grid's Nyquist limit, which produced a
  // severe aliasing artifact (regular "corduroy" banding under raking light) rather than organic
  // irregularity. Kept small in amplitude so it reads as surface texture, not landform.
  function fineWeather(x, z) {
    return 0.6 * H.noise2(x * 0.045, z * 0.05, 511) + 0.4 * H.noise2(x * 0.085, z * 0.09, 517);
  }
  var pos = topGeo.attributes.position, arr = pos.array;
  for (var i = 0; i < arr.length; i += 3) {
    var x = arr[i], z = arr[i + 2];
    var e = sqrt((x / 150) * (x / 150) + (z / 75) * (z / 75));
    var base = 4 * (0.6 * H.noise2(x * 0.02, z * 0.02, 7) + 0.4 * H.noise2(x * 0.08, z * 0.08, 16));
    var bedrock = H.noise2(x * 0.04, z * 0.055, 23);
    var patch = bedrock > 0.42 ? (bedrock - 0.42) * 5.5 : 0; // exposed bedrock ridges poke up
    var y = base + patch;
    if (e < 0.6) y *= 0.22 + 0.15 * Math.max(0, bedrock); // mostly flat esplanade, bedrock still shows
    else if (e > 0.88) y -= (e - 0.88) * 40; // fold down toward the cliff edge
    y += 0.22 * fineWeather(x, z) * (e < 0.6 ? 1 : 0.6); // fine weathering irregularity, breaks the uniform ripple
    y -= cutAt(x, z);
    arr[i + 1] = y;
  }
  pos.needsUpdate = true;
  topGeo.computeVertexNormals();
  paintVertexColors(topGeo, 700);
  var top = new THREE.Mesh(topGeo, weatheredMat(mats.rock, 700, 150));
  top.position.set(-45, 0, 0);
  top.receiveShadow = true;
  group.add(top);
  function plateauHeight(lx, lz) {
    var e = sqrt((lx / 150) * (lx / 150) + (lz / 75) * (lz / 75));
    var base = 4 * (0.6 * H.noise2(lx * 0.02, lz * 0.02, 7) + 0.4 * H.noise2(lx * 0.08, lz * 0.08, 16));
    var bedrock = H.noise2(lx * 0.04, lz * 0.055, 23);
    var patch = bedrock > 0.42 ? (bedrock - 0.42) * 5.5 : 0;
    var y = base + patch;
    if (e < 0.6) y *= 0.22 + 0.15 * Math.max(0, bedrock);
    else if (e > 0.88) y -= (e - 0.88) * 40;
    y += 0.22 * fineWeather(lx, lz) * (e < 0.6 ? 1 : 0.6);
    return y - cutAt(lx, lz);
  }

  // Scattered marble fragments: broken column-drum stubs, capital blocks and slabs, tinted
  // per-batch (light/mid/dark weathering) since InstancedMesh in r128 has no per-instance colour.
  var fragR = lcg(51);
  var drumGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.5, 10);
  var capGeo = new THREE.BoxGeometry(0.9, 0.45, 0.9);
  var slabGeo = new THREE.BoxGeometry(1.3, 0.3, 0.8);
  var fragBuckets = { drum: [[], [], []], cap: [[], [], []], slab: [[], [], []] };
  var fragCount = MOBILE ? 26 : 48;
  for (var f = 0; f < fragCount; f++) {
    // 60% cluster within ~10m of the perimeter (where walls/structures actually shed debris via
    // collapse and quarrying), 40% scattered across the open plateau centre.
    var rim = fragR() < 0.6;
    var a = fragR() * PI * 2;
    var e2 = rim ? (0.80 + fragR() * 0.15) : (0.05 + fragR() * 0.68);
    var lx = cos(a) * 150 * e2, lz = sin(a) * 75 * e2;
    var ly = plateauHeight(lx, lz);
    var tiltX = (fragR() - 0.5) * 0.9, tiltZ = (fragR() - 0.5) * 0.9;
    var bucket = (fragR() * 3) | 0;
    var yaw = fragR() * PI * 2; // full 360-degree orientation
    var scaleV = 0.5 + fragR() * 2.0; // 0.5x - 2.5x relative size
    var pick = fragR();
    if (pick < 0.45) fragBuckets.drum[bucket].push({ p: [lx, ly + 0.25 * scaleV, lz], r: [tiltX, yaw, tiltZ * 0.6], s: [scaleV, scaleV, scaleV] });
    else if (pick < 0.7) fragBuckets.cap[bucket].push({ p: [lx, ly + 0.22 * scaleV, lz], r: [tiltX * 0.5, yaw, tiltZ * 0.5], s: [scaleV, scaleV, scaleV] });
    else fragBuckets.slab[bucket].push({ p: [lx, ly + 0.15 * scaleV, lz], r: [tiltX * 0.5, yaw, tiltZ * 0.5], s: [scaleV, scaleV, scaleV] });
  }
  var fragGroup = new THREE.Group();
  fragGroup.position.set(-45, 0, 0);
  var fragTints = [0.76, 0.94, 1.08]; // weathered dark -> clean-ish, simulating lichen/patina variety
  [['drum', drumGeo], ['cap', capGeo], ['slab', slabGeo]].forEach(function (entry) {
    var shape = entry[0], geo = entry[1];
    for (var b = 0; b < 3; b++) {
      var list = fragBuckets[shape][b];
      if (!list.length) continue;
      var m = mats.marbleWorn.clone();
      m.color.setScalar(fragTints[b]);
      fragGroup.add(H.instance(geo, m, list));
    }
  });
  group.add(fragGroup);

  // Sparse dry grass tufts near the plateau edge
  var grassR = lcg(93);
  var bladeGeo = new THREE.ConeGeometry(0.18, 0.7, 4);
  var tuftT = [];
  var tuftCount = MOBILE ? 30 : 90;
  for (var g = 0; g < tuftCount; g++) {
    var ga = grassR() * PI * 2, ge = 0.72 + grassR() * 0.22;
    var gx = cos(ga) * 150 * ge, gz = sin(ga) * 75 * ge;
    var gy = plateauHeight(gx, gz);
    for (var b2 = 0; b2 < 2; b2++) {
      var jx = gx + (grassR() - 0.5) * 0.6, jz = gz + (grassR() - 0.5) * 0.6;
      tuftT.push({ p: [jx, gy + 0.3, jz], r: [(grassR() - 0.5) * 0.3, grassR() * PI * 2, (grassR() - 0.5) * 0.3], s: [1, 0.7 + grassR() * 0.6, 1] });
    }
  }
  var grassGroup = new THREE.Group();
  grassGroup.position.set(-45, 0, 0);
  grassGroup.add(H.instance(bladeGeo, mats.grass, tuftT));
  group.add(grassGroup);

  // ---------------- 2. Stratified limestone cliff + talus, blending into the hillside ----------------
  // Radial profile from the plateau edge (t=0, y=0) down to the plain (t=1, y=-80), per-angle.
  var CX = -45, CZ = 0, RX = 150, RZ = 75;
  var CLIFF_T = 0.5; // near-vertical face below this t, scree apron above it
  function cliffRadiusMul(t, a, seed) {
    // Irregular strata ledges: band phase is offset per-angle so the courses are not
    // perfectly concentric rings (the "digitally obvious" flaw), depth also varies by angle.
    var phase = H.noise2(cos(a) * 3, sin(a) * 3, seed + 40) * 0.9;
    var bands = 9;
    var bt = t * bands + phase;
    var bandFrac = bt - Math.floor(bt);
    var ledgeDepth = 0.09 + 0.05 * H.noise2(cos(a) * 6.3, sin(a) * 6.3, seed + 41);
    var ledge = (t < CLIFF_T && bandFrac < 0.22) ? (0.22 - bandFrac) / 0.22 * ledgeDepth : 0;
    // Vertical erosion channels/fissures: frequency + amplitude both vary by location so
    // grooves read as natural crevices rather than a single regular sine ripple.
    var fissureFreq = 10 + 6 * H.noise2(cos(a) * 2.1, sin(a) * 2.1, seed + 42);
    var fissureAmp = 0.05 + 0.045 * H.noise2(cos(a) * 9, sin(a) * 9, seed + 43);
    var fissure = fissureAmp * Math.sin(a * fissureFreq + seed) * (1 - t * 0.4);
    // Patchy overhangs: only where a noise mask exceeds a threshold, not everywhere.
    var overhangMask = H.noise2(cos(a) * 11, sin(a) * 11, seed + 44);
    var overhang = (t > 0.08 && t < CLIFF_T - 0.02 && overhangMask > 0.22)
      ? (overhangMask - 0.22) * 0.6 * Math.sin((t - 0.08) / (CLIFF_T - 0.1) * PI)
      : 0;
    // Fine surface roughness so the rock face itself isn't a smooth ramp at any zoom level.
    var micro = 0.022 * H.noise2(cos(a) * 22 + t * 16, sin(a) * 22, seed + 45);
    var scree = t > CLIFF_T ? Math.pow((t - CLIFF_T) / (1 - CLIFF_T), 1.3) * 0.85 : 0;
    return 1 + ledge + fissure + overhang + scree + micro;
  }
  function cliffY(t) {
    // Steeper near-vertical face, easing into the gentler talus slope.
    if (t < CLIFF_T) return -t / CLIFF_T * 50;
    var tt = (t - CLIFF_T) / (1 - CLIFF_T);
    return -50 - (tt * tt * 0.55 + tt * 0.45) * 30;
  }
  function ringGeometry(rings, radial, matSeedOffset) {
    // Indexed grid with vertices shared between adjacent triangles (rather than duplicated per
    // face), so computeVertexNormals() averages normals across neighbouring faces and produces
    // smooth interpolated shading instead of hard per-facet boundaries at close range. The ellipse
    // is seamless in the angle parameter (cos/sin of a=2*PI give identical values at k=0 and
    // k=radial), so the radial direction wraps via modulo without needing a duplicate seam column.
    var vertCount = (rings + 1) * radial;
    var verts = new Float32Array(vertCount * 3);
    for (var r = 0; r <= rings; r++) {
      for (var k = 0; k < radial; k++) {
        var t = r / rings;
        var a = (k / radial) * PI * 2;
        var m = cliffRadiusMul(t, a, 5 + matSeedOffset);
        var idx = (r * radial + k) * 3;
        verts[idx] = CX + cos(a) * RX * m;
        verts[idx + 1] = cliffY(t);
        verts[idx + 2] = CZ + sin(a) * RZ * m;
      }
    }
    var indices = [];
    for (var r2 = 0; r2 < rings; r2++) {
      for (var k2 = 0; k2 < radial; k2++) {
        var k2n = (k2 + 1) % radial;
        var a0 = r2 * radial + k2, a1 = r2 * radial + k2n;
        var b0 = (r2 + 1) * radial + k2, b1 = (r2 + 1) * radial + k2n;
        indices.push(a0, b0, b1, a0, b1, a1);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  var radialSeg = MOBILE ? 90 : 190, ringSeg = MOBILE ? 26 : 46;
  var cliffGeo = ringGeometry(ringSeg, radialSeg, 0);
  paintVertexColors(cliffGeo, 900, true);
  var cliffMesh = new THREE.Mesh(cliffGeo, weatheredMat(mats.rockDark, 900));
  cliffMesh.castShadow = true;
  cliffMesh.receiveShadow = true;
  group.add(cliffMesh);
  function hillHeight(wx, wz) {
    var dx = wx - CX, dz = wz - CZ;
    var a = Math.atan2(dz / RZ, dx / RX);
    var e = sqrt((dx / RX) * (dx / RX) + (dz / RZ) * (dz / RZ));
    // invert e (roughly 1..1.85) back to t via the same profile shape
    var t = Math.min(1, Math.max(0, (e - 1) / 0.85));
    return cliffY(t);
  }

  // Ground plain
  var groundGeo = new THREE.PlaneGeometry(3400, 3400, 2, 2);
  groundGeo.rotateX(-PI / 2);
  var groundMesh = new THREE.Mesh(groundGeo, mats.ground);
  groundMesh.position.y = -80.4;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ---------------- 3. Hillside vegetation: Aleppo pines, dense scrub clumps, talus debris ----------------
  var hillR = lcg(140);
  var trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.6, 6);
  var pineGeo = new THREE.IcosahedronGeometry(1.6, 0);
  var scrubGeo = new THREE.IcosahedronGeometry(0.55, 0);
  var pineTrunkT = [], pineCanopyT = [], scrubT = [];
  var pineCount = MOBILE ? 26 : 60;
  for (var p = 0; p < pineCount; p++) {
    var pa = hillR() * PI * 2, pt = 0.35 + hillR() * 0.55;
    var m = cliffRadiusMul(pt, pa, 5);
    var px = CX + cos(pa) * RX * m, pz = CZ + sin(pa) * RZ * m, py = cliffY(pt);
    var psc = 0.7 + hillR() * 0.6;
    pineTrunkT.push({ p: [px, py + 1.3 * psc, pz], s: [psc, psc, psc] });
    pineCanopyT.push({ p: [px, py + 2.9 * psc, pz], s: [psc * 1.1, psc * 0.55, psc * 1.1] });
  }
  // Dense scrub: clustered clumps (3-5 tufts within ~2m) rather than one tuft per sample point,
  // covering the whole slope down toward the plain, each tuft randomly rotated/scaled.
  var clusterCount = MOBILE ? 42 : 110;
  for (var sc = 0; sc < clusterCount; sc++) {
    var sa = hillR() * PI * 2, st = 0.4 + hillR() * 0.58;
    var sm = cliffRadiusMul(st, sa, 5);
    var sx = CX + cos(sa) * RX * sm, sz = CZ + sin(sa) * RZ * sm, sy = cliffY(st);
    var clumpN = 3 + ((hillR() * 3) | 0); // 3-5 tufts per clump
    for (var ci = 0; ci < clumpN; ci++) {
      var jang = hillR() * PI * 2, jr = hillR() * 2.0;
      var jx = sx + cos(jang) * jr, jz = sz + sin(jang) * jr;
      var ssc = 0.5 + hillR() * 0.75;
      scrubT.push({ p: [jx, sy + 0.32 * ssc, jz], r: [0, hillR() * PI * 2, 0], s: [ssc * (0.8 + hillR() * 0.4), ssc * 0.7, ssc * (0.8 + hillR() * 0.4)] });
    }
  }
  group.add(H.instance(trunkGeo, mats.trunk, pineTrunkT));
  group.add(H.instance(pineGeo, mats.foliageOlive, pineCanopyT));
  group.add(H.instance(scrubGeo, mats.scrub, scrubT));

  // Talus debris: a handful of large fallen boulders plus scattered small rubble in the
  // scree/talus band, so the cliff-to-plain transition reads as rockfall, not an abrupt seam.
  var taluR = lcg(271);
  // Warmer/brighter than the surrounding rock so the scree band separates visually at overview
  // distance -- component increments are allowed to push a channel past 1 (ACES tone mapping
  // compresses that back into a genuinely brighter highlight rather than a flat white clip).
  function warmBrighten(baseMat, dr, dg, db) {
    var m = baseMat.clone();
    m.color = new THREE.Color(m.color.r + dr, m.color.g + dg, m.color.b + db);
    return m;
  }
  var taluBoulderMat = warmBrighten(mats.rockDark, 0.18, 0.14, 0.06);
  var taluRubbleMat = warmBrighten(mats.rock, 0.16, 0.13, 0.07);
  var boulderGeo = new THREE.IcosahedronGeometry(1, 1);
  var boulderT = [];
  var boulderCount = MOBILE ? 8 : 14; // 1.5x the prior density
  for (var bo = 0; bo < boulderCount; bo++) {
    var ba = taluR() * PI * 2, btq = CLIFF_T + 0.06 + taluR() * 0.5;
    var bm = cliffRadiusMul(btq, ba, 5);
    var bx = CX + cos(ba) * RX * bm, bz = CZ + sin(ba) * RZ * bm, by = cliffY(btq);
    var bsc = 2.0 + taluR() * 3.5; // ~4-9m boulders (icosahedron radius 1 -> diameter 2*scale)
    boulderT.push({ p: [bx, by + bsc * 0.35, bz], r: [taluR() * PI, taluR() * PI, taluR() * PI], s: [bsc, bsc * (0.7 + taluR() * 0.4), bsc * (0.85 + taluR() * 0.3)] });
  }
  group.add(H.instance(boulderGeo, taluBoulderMat, boulderT));
  var rubbleGeo = new THREE.IcosahedronGeometry(0.32, 0);
  var rubbleT = [];
  var rubbleCount = MOBILE ? 110 : 260;
  for (var ru = 0; ru < rubbleCount; ru++) {
    var ra = taluR() * PI * 2, rtq = CLIFF_T + 0.02 + taluR() * 0.68;
    var rm2 = cliffRadiusMul(rtq, ra, 5);
    var rx = CX + cos(ra) * RX * rm2, rz = CZ + sin(ra) * RZ * rm2, ry = cliffY(rtq);
    var rsc = 0.5 + taluR() * 1.1;
    rubbleT.push({ p: [rx, ry + rsc * 0.2, rz], r: [taluR() * PI, taluR() * PI, taluR() * PI], s: [rsc, rsc * 0.8, rsc] });
  }
  group.add(H.instance(rubbleGeo, taluRubbleMat, rubbleT));

  // ---------------- 4. City of Athens: whitewashed houses along radiating streets ----------------
  var cityR = lcg(7);
  var bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  var roofGeo = new THREE.ConeGeometry(0.82, 0.6, 4, 1);
  roofGeo.rotateY(PI / 4);
  var farGeo = new THREE.BoxGeometry(1, 1, 1);
  var microGeo = new THREE.BoxGeometry(1, 1, 1);
  var houseT = [], farT = [], microT = [];
  // Weathered terracotta roof variants (rust-brown, dusty ochre, dark/aged, weathered tan, plus a
  // toned-down "fresher" tone) so roofs stop reading as one flat saturated orange. The variant is
  // chosen from a low-frequency noise field sampled at the house's own position (not per-house
  // random pick), so neighbouring houses on the same block share a weathering state.
  var terracottaVariants = [
    [0.90, 0.42, 0.20], // fresher orange-red, still toned down from the old flat saturated hue
    [0.80, 0.50, 0.20], // rust-brown
    [0.90, 0.70, 0.40], // dusty ochre
    [0.62, 0.40, 0.27], // dark, aged
    [0.74, 0.56, 0.32]  // weathered tan
  ];
  var terracottaMats = terracottaVariants.map(function (c) {
    var m = mats.terracotta.clone();
    m.color.setRGB(c[0], c[1], c[2]);
    return m;
  });
  var roofBuckets = [[], [], [], [], []];
  function roofVariantAt(hx, hz) {
    var n = H.noise2(hx * 0.018, hz * 0.021, 601); // broad enough that whole blocks share a variant
    return Math.min(4, Math.max(0, Math.floor((n * 0.5 + 0.5) * 5)));
  }
  var placed = []; // coarse min-spacing check against already-placed houses
  var MIN_SPACING = 5.5;
  function tooClose(hx, hz) {
    for (var pi = 0; pi < placed.length; pi++) {
      var dx0 = placed[pi][0] - hx, dz0 = placed[pi][1] - hz;
      if (dx0 * dx0 + dz0 * dz0 < MIN_SPACING * MIN_SPACING) return true;
    }
    return false;
  }
  // Pale ground-texture cue along each street centreline, so the radial corridors read clearly
  // from an oblique view even where the houses along them thin out.
  var streetStripGeo = new THREE.BoxGeometry(1000, 0.05, 3.0);
  var streetStripT = [];
  var spokes = MOBILE ? 14 : 26;
  for (var sIdx = 0; sIdx < spokes; sIdx++) {
    var ang = (sIdx / spokes) * PI * 2 + cityR() * 0.1;
    streetStripT.push({ p: [-45 + cos(ang) * 695, -80.34, 0 + sin(ang) * 695], r: [0, -ang, 0] });
    var r = 210;
    var placedInSpoke = 0; // strict alternation -> the street corridor reads as a clean line, not a scatter
    while (r < 1250) {
      var density = clamp01(1 - r / 900); // continuous falloff: dense near the hill, thin with distance
      var step = (13 + cityR() * 9) / Math.max(0.14, density);
      r += step;
      if (cityR() > density + 0.12) continue;
      // Street corridor: keep an empty band straddling the spoke centreline (now 8-10m wide total),
      // houses set back from it on strictly alternating sides -> reads as buildings facing a street.
      var streetHalf = 4 + cityR() * 1;
      var setback = streetHalf + 1.5 + cityR() * (10 + r * 0.05);
      var side = (placedInSpoke % 2 === 0) ? 1 : -1;
      var jitter = side * setback;
      var hx = -45 + cos(ang) * r + cos(ang + PI / 2) * jitter;
      var hz = 0 + sin(ang) * r + sin(ang + PI / 2) * jitter;
      var dxk = hx + 45, dzk = hz;
      if ((dxk / 160) * (dxk / 160) + (dzk / 85) * (dzk / 85) < 1) continue;
      if (tooClose(hx, hz)) continue;
      placed.push([hx, hz]);
      placedInSpoke++;
      var yaw = cityR() * PI * 2;
      if (r < 780) {
        var sxh = 5 + cityR() * 6, szh = 5 + cityR() * 6, syh = 3.2 + cityR() * 3.2;
        houseT.push({ p: [hx, -80 + syh / 2, hz], r: [0, yaw, 0], s: [sxh, syh, szh] });
        roofBuckets[roofVariantAt(hx, hz)].push({ p: [hx, -80 + syh + 0.3 * ((sxh + szh) / 2) * 0.35, hz], r: [0, yaw, 0], s: [(sxh + szh) / 2 * 1.05, (sxh + szh) / 2 * 0.9, (sxh + szh) / 2 * 1.05] });
      } else if (r < 1050) {
        var sx2 = 6 + cityR() * 12, sz2 = 6 + cityR() * 12, sy2 = 4 + cityR() * 8;
        farT.push({ p: [hx, -80 + sy2 / 2, hz], r: [0, yaw, 0], s: [sx2, sy2, sz2] });
      } else {
        // Micro size class: distant buildings resolve to only a few pixels, so keep them tiny
        // and cheap while still reading as a townscape fading into the haze.
        var sx3 = 2.4 + cityR() * 3.2, sz3 = 2.4 + cityR() * 3.2, sy3 = 3 + cityR() * 4.5;
        microT.push({ p: [hx, -80 + sy3 / 2, hz], r: [0, yaw, 0], s: [sx3, sy3, sz3] });
      }
    }
  }
  var cityGroup = new THREE.Group();
  cityGroup.add(H.instance(bodyGeo, mats.plaster, houseT));
  for (var rv = 0; rv < 5; rv++) {
    if (roofBuckets[rv].length) cityGroup.add(H.instance(roofGeo, terracottaMats[rv], roofBuckets[rv]));
  }
  cityGroup.add(H.instance(farGeo, mats.city, farT));
  if (microT.length) cityGroup.add(H.instance(microGeo, mats.city, microT));
  if (streetStripT.length) cityGroup.add(H.instance(streetStripGeo, mats.plaster, streetStripT));
  group.add(cityGroup);

  // Cheap plain-shaft columns for distant background landmarks (no fluting/entasis: they read
  // as small silhouettes in the haze, so a full H.makeDoricColumns/H.makeIonicColumns colonnade
  // would spend triangles the viewer will never resolve).
  function cheapColonnade(positions, height, r, capMat, shaftMat) {
    var g = new THREE.Group();
    var shaftGeo = new THREE.CylinderGeometry(r * 0.85, r, height, 8);
    var capGeo2 = new THREE.BoxGeometry(r * 2.6, height * 0.06, r * 2.6);
    var shaftT = [], capT2 = [];
    for (var i = 0; i < positions.length; i++) {
      var px = positions[i][0], pz = positions[i][1];
      shaftT.push({ p: [px, height / 2, pz] });
      capT2.push({ p: [px, height + height * 0.03, pz] });
    }
    g.add(H.instance(shaftGeo, shaftMat, shaftT));
    g.add(H.instance(capGeo2, capMat, capT2));
    return g;
  }

  // Hephaisteion-like temple on a knoll, NW of the hill (a small, hazy silhouette)
  (function () {
    var knoll = new THREE.Mesh(new THREE.ConeGeometry(30, 9, 10), mats.rock);
    knoll.position.set(-500, -79, -300);
    knoll.receiveShadow = true;
    group.add(knoll);
    var tGroup = new THREE.Group();
    tGroup.position.set(-500, -75, -300);
    var cols = [];
    var colW = 5.6, colD = 12, nx = 6, nz = 10;
    for (var cx2 = 0; cx2 < nx; cx2++) cols.push([-colW / 2 + cx2 * (colW / (nx - 1)), -colD / 2]);
    for (var cx3 = 0; cx3 < nx; cx3++) cols.push([-colW / 2 + cx3 * (colW / (nx - 1)), colD / 2]);
    for (var cz2 = 1; cz2 < nz - 1; cz2++) { cols.push([-colW / 2, -colD / 2 + cz2 * (colD / (nz - 1))]); cols.push([colW / 2, -colD / 2 + cz2 * (colD / (nz - 1))]); }
    tGroup.add(cheapColonnade(cols, 4.2, 0.26, mats.marble, mats.marble));
    var base = new THREE.Mesh(new THREE.BoxGeometry(colW + 1.2, 0.6, colD + 1.2), mats.marble);
    base.position.y = 0.3;
    base.receiveShadow = true;
    tGroup.add(base);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(colW, colD) * 0.72, 2.2, 4), mats.terracotta);
    roof.rotation.y = PI / 4;
    roof.position.y = 4.2 + 1.7;
    roof.scale.set(1, 1, colD / colW);
    roof.castShadow = true;
    tGroup.add(roof);
    group.add(tGroup);
  })();

  // Stoa of Attalos: a long colonnaded portico facing the ancient agora (background silhouette)
  (function () {
    var sGroup = new THREE.Group();
    sGroup.position.set(-330, -80, -160);
    sGroup.rotation.y = 0.5;
    var n = 15, len = 56, colsA = [];
    for (var i2 = 0; i2 < n; i2++) colsA.push([-len / 2 + i2 * (len / (n - 1)), 0]);
    sGroup.add(cheapColonnade(colsA, 5.2, 0.24, mats.marble, mats.marble));
    var back = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 6.2, 1.2), mats.city);
    back.position.set(0, 3.1, -5.5);
    back.castShadow = true; back.receiveShadow = true;
    sGroup.add(back);
    var stoaRoof = new THREE.Mesh(new THREE.BoxGeometry(len + 3, 0.4, 8), mats.terracotta);
    stoaRoof.position.set(0, 6.4, -2.5);
    stoaRoof.castShadow = true; stoaRoof.receiveShadow = true;
    sGroup.add(stoaRoof);
    group.add(sGroup);
  })();

  // ---------------- 5. Sacred Way ----------------
  var sacredTransforms = [];
  for (var sw = 0; sw < 30; sw++) {
    var t2 = sw / 29;
    var swx = -200 + t2 * 60, swy = -60 + t2 * 58, swz = 40 + t2 * (-36);
    sacredTransforms.push({ p: [swx, swy, swz], r: [0, 0, 0], s: [6, 0.3, 5] });
  }
  var sacredMesh = H.instance(new THREE.BoxGeometry(1, 1, 1), mats.marbleShadowed, sacredTransforms);
  sacredMesh.castShadow = false;
  sacredMesh.receiveShadow = true;
  group.add(sacredMesh);

  return group;
};
