// Terrain: flat worn-rock plateau, stratified cliffs + talus/hillside, dense city, sacred paths
window.buildTerrain = function (THREE, mats, H) {
  var group = new THREE.Group();
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var PI = Math.PI, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, floor = Math.floor, pow = Math.pow;

  function lcg(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  // Weathering tint shared by the plateau + cliff: broad honey/iron patches plus darker
  // streak/lichen zones, sampled off world x,z (standing in for a normal map's discoloration
  // channel, since materials/textures belong to the module that builds mats).
  function weatherTint(x, z, seed, vparams) {
    var macro = H.noise2(x * 0.018, z * 0.022, seed + 5);
    var macro2 = H.noise2(x * 0.031, z * 0.026, seed + 6);
    var patch = H.noise2(x * 0.07, z * 0.06, seed + 1);
    var fine = H.noise2(x * 0.15, z * 0.16, seed + 3);
    var honey = (0.5 + 0.5 * macro) * (0.55 + 0.45 * (0.5 + 0.5 * macro2)) * (0.7 + 0.3 * (0.5 + 0.5 * patch));
    var mult = 0.8 + 0.36 * honey + 0.04 * fine;
    var streakN = H.noise2(x * 0.013, z * 0.016, seed + 2);
    var streak = clamp01((-0.05 - streakN) / 0.85);
    if (vparams) {
      var s = vparams.a * 130;
      var phase = s * 0.28 + H.noise2(s * 0.015, 0, seed + 11) * 5;
      var band = pow(Math.max(0, cos(phase)), 6);
      var ramp = clamp01((-vparams.y) / 46);
      var irregular = 0.4 + 0.6 * (0.5 + 0.5 * H.noise2(s * 0.05, vparams.y * 0.08, seed + 12));
      streak = clamp01(streak * 0.55 + band * ramp * irregular);
    }
    var r = mult * (1 - 0.28 * streak);
    var g = mult * (1 - 0.11 * streak);
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
    m.userData = {};
    for (var uk in base.userData) m.userData[uk] = base.userData[uk];
    if (uvScaleOverride) m.userData.uvScale = uvScaleOverride;
    return m;
  }

  // ---------------- 1. Plateau top: flat worn limestone platform ----------------
  // Undulation is kept under ~0.3m everywhere (fine mottling + a few raised bedrock slabs);
  // only right at the rim does the surface fold down to meet the cliff mesh below.
  var PW = 300, PD = 150, segX = MOBILE ? 48 : 80, segZ = MOBILE ? 24 : 40;
  function fineWeather(x, z) {
    return 0.6 * H.noise2(x * 0.045, z * 0.05, 511) + 0.4 * H.noise2(x * 0.085, z * 0.09, 517);
  }
  var cuttings = [
    { x: -95, z: 30, w: 16, d: 10, depth: 0.45 },
    { x: 35, z: -50, w: 12, d: 8, depth: 0.35 },
    { x: -20, z: 55, w: 20, d: 9, depth: 0.3 }
  ];
  function cutAt(x, z) {
    var cut = 0;
    for (var i = 0; i < cuttings.length; i++) {
      var c = cuttings[i];
      var dx = Math.abs(x - c.x) / (c.w / 2), dz = Math.abs(z - c.z) / (c.d / 2);
      var r = Math.max(dx, dz);
      if (r < 1) cut = Math.max(cut, c.depth * (1 - r * r));
    }
    return cut;
  }
  function plateauHeight(x, z) {
    var e = sqrt((x / 150) * (x / 150) + (z / 75) * (z / 75));
    var bedrock = H.noise2(x * 0.04, z * 0.055, 23); // -1..1
    var slab = clamp01((bedrock - 0.32) / 0.2); // a handful of raised bedrock slabs, smooth-edged
    // Fine ripple halved again and gated off within ~50m of the rim fold (e > ~0.68..0.86), so
    // the worn-rock esplanade reads dead flat right where it meets the cliff, with any residual
    // texture confined to the interior of the platform.
    var rippleGate = 1 - smooth((e - 0.68) / 0.18 < 0 ? 0 : (e - 0.68) / 0.18 > 1 ? 1 : (e - 0.68) / 0.18);
    var y = 0.03 * fineWeather(x, z) * rippleGate + 0.22 * slab; // <= ~0.25m of texture + step, everywhere
    if (e > 0.86) y -= (e - 0.86) * 34; // rim fold: blends into the cliff mesh, not "undulation"
    return y - cutAt(x, z);
  }
  var topGeo = new THREE.PlaneGeometry(PW, PD, segX, segZ);
  topGeo.rotateX(-PI / 2);
  var pos = topGeo.attributes.position, arr = pos.array;
  for (var i = 0; i < arr.length; i += 3) {
    arr[i + 1] = plateauHeight(arr[i], arr[i + 2]);
  }
  pos.needsUpdate = true;
  topGeo.computeVertexNormals();
  paintVertexColors(topGeo, 700);
  var top = new THREE.Mesh(topGeo, weatheredMat(mats.rock, 700, 150));
  top.position.set(-45, 0, 0);
  top.receiveShadow = true;
  group.add(top);

  // Worn paths: pale flattened stone strips linking the Propylaea entrance to the Parthenon
  // and Erechtheion, so the plaza reads as a walked surface, not raw open rock.
  var pathSegs = [
    [[-100, -4], [-60, -14], [-24, -20]],
    [[-24, -20], [-38, -30], [-40, -33]]
  ];
  var pathT = [];
  pathSegs.forEach(function (chain) {
    for (var pi = 0; pi < chain.length - 1; pi++) {
      var p0 = chain[pi], p1 = chain[pi + 1];
      var dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      var len = sqrt(dx * dx + dz * dz);
      var ang = Math.atan2(dz, dx);
      var n = Math.max(1, Math.round(len / 3.2));
      for (var k = 0; k < n; k++) {
        var t = (k + 0.5) / n;
        var px = p0[0] + dx * t, pz = p0[1] + dz * t;
        pathT.push({ p: [px, plateauHeight(px, pz) + 0.03, pz], r: [0, -ang, 0], s: [3.4, 0.05, 4.2] });
      }
    }
  });
  var pathGroup = new THREE.Group();
  pathGroup.position.set(-45, 0, 0);
  pathGroup.add(H.instance(new THREE.BoxGeometry(1, 1, 1), mats.marbleWorn, pathT));
  group.add(pathGroup);

  // Scattered marble fragments: broken column-drum stubs, capital blocks and slabs, tinted
  // per-batch (light/mid/dark weathering) since InstancedMesh in r128 has no per-instance colour.
  var fragR = lcg(51);
  var drumGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.5, 10);
  var capGeo = new THREE.BoxGeometry(0.9, 0.45, 0.9);
  var slabGeo = new THREE.BoxGeometry(1.3, 0.3, 0.8);
  var fragBuckets = { drum: [[], [], []], cap: [[], [], []], slab: [[], [], []] };
  var fragCount = MOBILE ? 26 : 48;
  for (var f = 0; f < fragCount; f++) {
    var rim = fragR() < 0.6;
    var a = fragR() * PI * 2;
    var e2 = rim ? (0.80 + fragR() * 0.15) : (0.05 + fragR() * 0.68);
    var lx = cos(a) * 150 * e2, lz = sin(a) * 75 * e2;
    var ly = plateauHeight(lx, lz);
    // Fragments lie flat on the ground: a small random yaw, and only a slight settling tilt
    // (not a full free 3-axis tumble, which read as debris blown into the air).
    var tiltX = (fragR() - 0.5) * 0.12, tiltZ = (fragR() - 0.5) * 0.12;
    var bucket = (fragR() * 3) | 0;
    var yaw = fragR() * PI * 2;
    var scaleV = 0.5 + fragR() * 2.0;
    var pick = fragR();
    if (pick < 0.45) fragBuckets.drum[bucket].push({ p: [lx, ly + 0.25 * scaleV, lz], r: [tiltX, yaw, tiltZ], s: [scaleV, scaleV, scaleV] });
    else if (pick < 0.7) fragBuckets.cap[bucket].push({ p: [lx, ly + 0.22 * scaleV, lz], r: [tiltX * 0.5, yaw, tiltZ * 0.5], s: [scaleV, scaleV, scaleV] });
    else fragBuckets.slab[bucket].push({ p: [lx, ly + 0.15 * scaleV, lz], r: [tiltX * 0.5, yaw, tiltZ * 0.5], s: [scaleV, scaleV, scaleV] });
  }
  var fragGroup = new THREE.Group();
  fragGroup.position.set(-45, 0, 0);
  var fragTints = [0.76, 0.94, 1.08];
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
  var tuftCount = MOBILE ? 24 : 70;
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
  // All perturbation terms below are physical METRES added to the ellipse radius (then implicitly
  // scaled by RX/RZ when applied to x/z) -- kept small so the face reads as broad, near-vertical
  // limestone with a few ledges and fissures, not a crumpled, wedge-gouged ripple.
  var CX = -45, CZ = 0, RX = 150, RZ = 75;
  var CLIFF_T = 0.5;
  function cliffRadiusMul(t, a, seed) {
    // Horizontal strata ledges: broad, evenly-spaced courses with a rounded (smoothstepped) lip.
    var phase = H.noise2(cos(a) * 3, sin(a) * 3, seed + 40) * 0.9;
    var bands = 6;
    var bt = t * bands + phase;
    var bandFrac = bt - floor(bt);
    var ledgeDepthM = 1.025 + 0.275 * H.noise2(cos(a) * 6.3, sin(a) * 6.3, seed + 41); // metres (0.75-1.3m: stronger shadow lines)
    var ledgeT = bandFrac < 0.24 ? smooth((0.24 - bandFrac) / 0.24) : 0;
    var ledge = (t < CLIFF_T ? ledgeT * ledgeDepthM : 0) / RX;
    // Narrow fissures: gated by a coarse mask so only a handful appear, not a continuous ripple.
    var fissureFreq = 9 + 5 * H.noise2(cos(a) * 2.1, sin(a) * 2.1, seed + 42);
    var fissureAmpM = 0.25 + 0.2 * H.noise2(cos(a) * 9, sin(a) * 9, seed + 43); // metres
    var fissureMask = H.noise2(cos(a) * 4.2, sin(a) * 4.2, seed + 46);
    var fissureGate = fissureMask > 0.5 ? smooth(clamp01((fissureMask - 0.5) / 0.22)) : 0;
    var fissure = fissureGate * fissureAmpM * sin(a * fissureFreq + seed) * (1 - t * 0.4) / RX;
    // Patchy, gentle bulges (read as a shallow overhang at a distance) -- a small mask-gated swell.
    var overhangMask = H.noise2(cos(a) * 11, sin(a) * 11, seed + 44);
    var overhangM = (t > 0.08 && t < CLIFF_T - 0.02 && overhangMask > 0.3)
      ? (overhangMask - 0.3) * 1.1 * sin((t - 0.08) / (CLIFF_T - 0.1) * PI)
      : 0; // metres
    var overhang = overhangM / RX;
    // Fine surface roughness, well under the strata scale.
    var microM = 0.09 * H.noise2(cos(a) * 22 + t * 16, sin(a) * 22, seed + 45); // metres
    var micro = microM / RX;
    // Talus fan: the slope widens gently as it flares out to meet the plain.
    var scree = t > CLIFF_T ? pow((t - CLIFF_T) / (1 - CLIFF_T), 1.3) * 0.85 : 0;
    // Broken-rock rubble bump-field right at the cliff foot: small irregular metre-scale bumps
    // (not a smooth flare) fading in just past the cliff base and fading back out over the talus.
    var taluBumpM = 0;
    if (t > CLIFF_T) {
      var bn = H.noise2(cos(a) * 15 + t * 40, sin(a) * 15, seed + 47);
      var fadeIn = smooth(clamp01((t - CLIFF_T) / 0.05));
      var fadeOut = 1 - smooth(clamp01((t - (CLIFF_T + 0.22)) / 0.2));
      taluBumpM = (0.1 + 0.3 * (0.5 + 0.5 * bn)) * fadeIn * Math.max(0, fadeOut);
    }
    var taluBump = taluBumpM / RX;
    return 1 + ledge + fissure + overhang + scree + micro + taluBump;
  }
  function cliffY(t) {
    if (t < CLIFF_T) return -t / CLIFF_T * 50;
    var tt = (t - CLIFF_T) / (1 - CLIFF_T);
    return -50 - (tt * tt * 0.55 + tt * 0.45) * 30;
  }
  function ringGeometry(rings, radial, matSeedOffset) {
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
  var radialSeg = MOBILE ? 70 : 128, ringSeg = MOBILE ? 14 : 24;
  var cliffGeo = ringGeometry(ringSeg, radialSeg, 0);
  paintVertexColors(cliffGeo, 900, true);
  var cliffMesh = new THREE.Mesh(cliffGeo, weatheredMat(mats.rockDark, 900));
  cliffMesh.castShadow = true;
  cliffMesh.receiveShadow = true;
  group.add(cliffMesh);

  // Ground plain
  var groundGeo = new THREE.PlaneGeometry(3400, 3400, 2, 2);
  groundGeo.rotateX(-PI / 2);
  var groundMesh = new THREE.Mesh(groundGeo, mats.ground);
  groundMesh.position.y = -80.4;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ---------------- 3. Hillside vegetation: Aleppo pines, dense scrub clumps, talus debris ----------------
  // Dense hillside cover between the cliff foot and the plain: pines and scrub clumps at ~4x the
  // previous instance counts. Both use cheap low-poly primitives (octahedron canopies/blobs
  // instead of icosahedra) so the coverage increase stays affordable -- at hillside viewing
  // distance the textured material reads the shape, not the facet count.
  var hillR = lcg(140);
  var trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.6, 5);
  var pineGeo = new THREE.OctahedronGeometry(1.7, 0);
  var scrubGeo = new THREE.OctahedronGeometry(0.6, 0);
  var pineTrunkT = [], pineCanopyT = [], scrubT = [];
  // t is capped well short of 1 (unlike the boulder/rubble talus spray below, which fades out
  // anyway): at the higher counts here, even the previous build's occasional stragglers that
  // rode the talus's own noisy outer flare out toward the plain became numerous enough to read
  // as scrub scattered into the city plaza, so pines/scrub are kept to the upper cliff+talus face.
  var pineCount = MOBILE ? 55 : 195;
  for (var p = 0; p < pineCount; p++) {
    var pa = hillR() * PI * 2, pt = 0.32 + hillR() * 0.36;
    var m = cliffRadiusMul(pt, pa, 5);
    var px = CX + cos(pa) * RX * m, pz = CZ + sin(pa) * RZ * m, py = cliffY(pt);
    var psc = 0.55 + hillR() * 1.05; // wider height range -> more silhouette variation
    pineTrunkT.push({ p: [px, py + 1.3 * psc, pz], s: [psc, psc, psc] });
    pineCanopyT.push({ p: [px, py + 2.9 * psc, pz], r: [0, hillR() * PI * 2, 0], s: [psc * 1.1, psc * (0.5 + hillR() * 0.25), psc * 1.1] });
  }
  var clusterCount = MOBILE ? 90 : 290;
  for (var sc = 0; sc < clusterCount; sc++) {
    var sa = hillR() * PI * 2, st = 0.38 + hillR() * 0.34;
    var sm = cliffRadiusMul(st, sa, 5);
    var sx = CX + cos(sa) * RX * sm, sz = CZ + sin(sa) * RZ * sm, sy = cliffY(st);
    var clumpN = 3 + ((hillR() * 4) | 0);
    for (var ci = 0; ci < clumpN; ci++) {
      var jang = hillR() * PI * 2, jr = hillR() * 2.3;
      var jx = sx + cos(jang) * jr, jz = sz + sin(jang) * jr;
      var ssc = 0.45 + hillR() * 0.85;
      scrubT.push({ p: [jx, sy + 0.32 * ssc, jz], r: [0, hillR() * PI * 2, 0], s: [ssc * (0.8 + hillR() * 0.4), ssc * 0.7, ssc * (0.8 + hillR() * 0.4)] });
    }
  }
  group.add(H.instance(trunkGeo, mats.trunk, pineTrunkT));
  group.add(H.instance(pineGeo, mats.foliageOlive, pineCanopyT));
  group.add(H.instance(scrubGeo, mats.scrub, scrubT));

  var taluR = lcg(271);
  function warmBrighten(baseMat, dr, dg, db) {
    var m = baseMat.clone();
    m.color = new THREE.Color(m.color.r + dr, m.color.g + dg, m.color.b + db);
    return m;
  }
  var taluBoulderMat = warmBrighten(mats.rockDark, 0.18, 0.14, 0.06);
  var taluRubbleMat = warmBrighten(mats.rock, 0.16, 0.13, 0.07);
  // Detail-0 icosahedron (20 tris, half the cost of the previous detail-1 boulders) buys room for
  // more boulders -- a broken-rock field reads through sheer count more than per-rock smoothness.
  var boulderGeo = new THREE.IcosahedronGeometry(1, 0);
  var boulderT = [];
  var boulderCount = MOBILE ? 12 : 22;
  for (var bo = 0; bo < boulderCount; bo++) {
    var ba = taluR() * PI * 2, btq = CLIFF_T + 0.03 + pow(taluR(), 1.5) * 0.24; // biased toward the cliff foot, kept off the city plaza
    var bm = cliffRadiusMul(btq, ba, 5);
    var bx = CX + cos(ba) * RX * bm, bz = CZ + sin(ba) * RZ * bm, by = cliffY(btq);
    var bsc = 2.0 + taluR() * 3.5;
    boulderT.push({ p: [bx, by + bsc * 0.35, bz], r: [taluR() * PI, taluR() * PI, taluR() * PI], s: [bsc, bsc * (0.7 + taluR() * 0.4), bsc * (0.85 + taluR() * 0.3)] });
  }
  group.add(H.instance(boulderGeo, taluBoulderMat, boulderT));
  // Octahedron (8 tris, well under half the previous icosahedron's cost) lets the rubble spray
  // grow denser at the cliff base -- a real scree field is mostly count, not per-chip roundness.
  var rubbleGeo = new THREE.OctahedronGeometry(0.34, 0);
  var rubbleT = [];
  var rubbleCount = MOBILE ? 160 : 340;
  for (var ru = 0; ru < rubbleCount; ru++) {
    var ra = taluR() * PI * 2, rtq = CLIFF_T + 0.01 + pow(taluR(), 1.7) * 0.3; // sparse spray, densest right at the base, kept off the city plaza
    var rm2 = cliffRadiusMul(rtq, ra, 5);
    var rx = CX + cos(ra) * RX * rm2, rz = CZ + sin(ra) * RZ * rm2, ry = cliffY(rtq);
    var rsc = 0.5 + taluR() * 1.1;
    rubbleT.push({ p: [rx, ry + rsc * 0.2, rz], r: [taluR() * PI, taluR() * PI, taluR() * PI], s: [rsc, rsc * 0.8, rsc] });
  }
  group.add(H.instance(rubbleGeo, taluRubbleMat, rubbleT));

  // ---------------- 4. City of Athens: dense whitewashed houses fading into the haze ----------------
  // A street grid rotated a few degrees off the world axes (like the real Plaka), with periodic
  // avenue gaps left empty -- streets read as absence of buildings, not painted lines -- and
  // three LOD size classes so the far city stays cheap while still reading as dense.
  var cityR = lcg(7);
  var CITY_ROT = 0.24;
  var rot0 = cos(CITY_ROT), rot1 = sin(CITY_ROT);
  function fromGrid(gx, gz) { return [gx * rot0 - gz * rot1, gx * rot1 + gz * rot0]; }
  var bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  // Hand-built hip-roof pyramid: 4 slanted side faces + a 2-tri base, 6 triangles total versus
  // the 12 a 4-sided ConeGeometry costs in r128 (its degenerate apex ring still counts as full
  // side triangles) -- same footprint/orientation (corners on the diagonals, so the slopes line
  // up with the box body's own walls), half the cost, spent instead on far more houses.
  function pyramidRoofGeo(radius, height) {
    var a = radius * Math.SQRT1_2;
    var C0 = [a, 0, a], C1 = [-a, 0, a], C2 = [-a, 0, -a], C3 = [a, 0, -a], apex = [0, height, 0];
    var tris = [
      apex, C1, C0, apex, C2, C1, apex, C3, C2, apex, C0, C3, // 4 sloped sides
      C0, C1, C2, C0, C2, C3 // base cap (2 tris)
    ];
    var verts = new Float32Array(tris.length * 3);
    for (var vi = 0; vi < tris.length; vi++) { verts[vi * 3] = tris[vi][0]; verts[vi * 3 + 1] = tris[vi][1]; verts[vi * 3 + 2] = tris[vi][2]; }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }
  var roofGeo = pyramidRoofGeo(0.82, 0.6);
  var houseT = [], farT = [], microT = [];
  var terracottaVariants = [
    [0.90, 0.42, 0.20], [0.80, 0.50, 0.20], [0.90, 0.70, 0.40], [0.62, 0.40, 0.27], [0.74, 0.56, 0.32]
  ];
  var terracottaMats = terracottaVariants.map(function (c) {
    var m = mats.terracotta.clone();
    m.color.setRGB(c[0], c[1], c[2]);
    return m;
  });
  var roofBuckets = [[], [], [], [], []];
  function roofVariantAt(hx, hz) {
    var n = H.noise2(hx * 0.018, hz * 0.021, 601);
    return Math.min(4, Math.max(0, floor((n * 0.5 + 0.5) * 5)));
  }
  // Tree clumps and small parks woven into the city fabric.
  var treeTrunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 5);
  var treeCanopyGeo = new THREE.IcosahedronGeometry(0.85, 0);
  var parkGeo = new THREE.BoxGeometry(1, 1, 1);
  var cityTreeTrunkT = [], cityTreeCanopyT = [], parkT = [];

  var cellNear = 20, cellMid = 34, cellFar = 62, cellTaper = cellFar * 1.2; // block cell size by ring (metres)
  var maxR = 1350; // extended from 1100 so the far LOD tier tapers out instead of cutting off abruptly
  var storyH = 2.9;
  // Street-surface tiles: pale worn stone strips laid into the street lanes near+mid tier so the
  // gaps between blocks read as walked/paved paths rather than plain bare sand.
  var streetGeo = new THREE.BoxGeometry(1, 1, 1);
  var streetT = [];
  function ellipseE(hx, hz) {
    var dx = hx + 45, dz = hz;
    return (dx / 160) * (dx / 160) + (dz / 85) * (dz / 85);
  }
  // Walk rings of increasing radius; within each ring, walk around it at the ring's own angular
  // step (derived from its cell size) so density stays even instead of thinning like 1/r.
  for (var rr = 46; rr < maxR; ) {
    var cell = rr < 260 ? cellNear : rr < 620 ? cellMid : rr < 1150 ? cellFar : cellTaper;
    var streetPeriod = rr < 260 ? 5 : rr < 620 ? 6 : rr < 1150 ? 8 : 9; // one street lane every N cells
    var circumf = 2 * PI * rr;
    var nAng = Math.max(8, Math.round(circumf / cell));
    for (var ai = 0; ai < nAng; ai++) {
      var ang = (ai / nAng) * PI * 2;
      // Snap this sample onto a coarse rotated grid so orientation reads as city blocks: convert
      // to grid space, quantize, then treat the quantized index as the street/avenue test.
      var wx0 = cos(ang) * rr, wz0 = sin(ang) * rr; // world-space offset from the hill centre
      var gx = wx0 * rot0 + wz0 * rot1, gz = -wx0 * rot1 + wz0 * rot0;
      var cix = Math.round(gx / cell), ciz = Math.round(gz / cell);
      var isStreet = (cix % streetPeriod === 0 || ciz % streetPeriod === 0);
      var jit = cell * 0.28;
      var jgx = cix * cell + (cityR() - 0.5) * jit, jgz = ciz * cell + (cityR() - 0.5) * jit;
      var world = fromGrid(jgx, jgz);
      var hx = -45 + world[0], hz = world[1];
      if (ellipseE(hx, hz) < 1) continue; // keep off the hill itself
      var yaw = CITY_ROT + ((cix + ciz) % 2 ? PI / 2 : 0) + (cityR() - 0.5) * 0.1; // aligned to the block grid
      if (isStreet) {
        // Street gap: lay a couple of short worn-stone paving segments along the lane (near+mid
        // tier only, and only part of the time) instead of leaving it a flat, featureless gap.
        if (rr < 620 && cityR() < 0.55) {
          var worldGrid = fromGrid(cix * cell, ciz * cell);
          var laneYaw = CITY_ROT + (ciz % streetPeriod === 0 ? 0 : PI / 2);
          for (var seg = 0; seg < 2; seg++) {
            var so = (seg - 0.5) * cell * 0.42;
            var slx = worldGrid[0] + cos(laneYaw) * so, slz = worldGrid[1] + sin(laneYaw) * so;
            streetT.push({ p: [-45 + slx, -80 + 0.025, slz], r: [0, laneYaw, 0], s: [cell * 0.36, 0.05, cell * 0.62] });
          }
        }
        continue;
      }
      var special = cityR();
      if (special < 0.035) {
        // Tree clump instead of a house
        var tsc = 0.8 + cityR() * 0.7;
        cityTreeTrunkT.push({ p: [hx, 0.8 * tsc - 80, hz], s: [tsc, tsc, tsc] });
        for (var lobe = 0; lobe < 3; lobe++) {
          var loA = (lobe / 3) * PI * 2 + cityR();
          cityTreeCanopyT.push({ p: [hx + cos(loA) * 0.7 * tsc, (1.7 + cityR() * 0.5) * tsc - 80, hz + sin(loA) * 0.7 * tsc], s: [tsc * 0.8, tsc * 0.7, tsc * 0.8] });
        }
      } else if (special < 0.05) {
        // Small park: a flat green patch with a couple of trees
        parkT.push({ p: [hx, -80 + 0.03, hz], r: [0, yaw, 0], s: [cell * 0.9, 0.06, cell * 0.9] });
        for (var pt2 = 0; pt2 < 2; pt2++) {
          var pox = hx + (cityR() - 0.5) * cell * 0.6, poz = hz + (cityR() - 0.5) * cell * 0.6;
          var ptsc = 0.7 + cityR() * 0.5;
          cityTreeTrunkT.push({ p: [pox, 0.8 * ptsc - 80, poz], s: [ptsc, ptsc, ptsc] });
          cityTreeCanopyT.push({ p: [pox, 1.9 * ptsc - 80, poz], s: [ptsc * 0.8, ptsc * 0.7, ptsc * 0.8] });
        }
      } else if (rr < 260) {
        // Near tier: full 1-6 story range with real variety -- ~40% single-storey cottages,
        // ~40% ordinary 2-3.5 storey houses, ~20% tall 4-6 storey buildings.
        var roll1 = cityR(), stories1;
        if (roll1 < 0.4) stories1 = 1 + cityR() * 0.35;
        else if (roll1 < 0.8) stories1 = 2 + cityR() * 1.5;
        else stories1 = 4 + cityR() * 2.2;
        var sxh = 5 + cityR() * 6, szh = 5 + cityR() * 6, syh = stories1 * storyH;
        houseT.push({ p: [hx, -80 + syh / 2, hz], r: [0, yaw, 0], s: [sxh, syh, szh] });
        roofBuckets[roofVariantAt(hx, hz)].push({ p: [hx, -80 + syh + 0.3 * ((sxh + szh) / 2) * 0.35, hz], r: [0, yaw, 0], s: [(sxh + szh) / 2 * 1.05, (sxh + szh) / 2 * 0.9, (sxh + szh) / 2 * 1.05] });
      } else if (rr < 620) {
        // Mid tier: kept to 1-2 storeys per the art pass, so height variety concentrates near the hill.
        var stories2 = 1 + cityR() * 1.1;
        var sx2 = 6 + cityR() * 11, sz2 = 6 + cityR() * 11, sy2 = stories2 * storyH;
        houseT.push({ p: [hx, -80 + sy2 / 2, hz], r: [0, yaw, 0], s: [sx2, sy2, sz2] });
        roofBuckets[roofVariantAt(hx, hz)].push({ p: [hx, -80 + sy2 + 0.3 * ((sx2 + sz2) / 2) * 0.35, hz], r: [0, yaw, 0], s: [(sx2 + sz2) / 2 * 1.05, (sx2 + sz2) / 2 * 0.9, (sx2 + sz2) / 2 * 1.05] });
      } else if (rr < 1150) {
        var stories3 = 1 + cityR() * 1.1;
        var sx3 = 6 + cityR() * 14, sz3 = 6 + cityR() * 14, sy3 = stories3 * storyH;
        farT.push({ p: [hx, -80 + sy3 / 2, hz], r: [0, yaw, 0], s: [sx3, sy3, sz3] });
      } else {
        // Tapered outer ring (1150-1350m): sparser (bigger cell + coin-flip skip) instead of a
        // hard cutoff, so the dense city fades gradually into the haze.
        if (cityR() > 0.7) continue;
        var sx4 = 3 + cityR() * 5, sz4 = 3 + cityR() * 5, sy4 = (1 + cityR() * 0.8) * storyH;
        microT.push({ p: [hx, -80 + sy4 / 2, hz], r: [0, yaw, 0], s: [sx4, sy4, sz4] });
      }
    }
    rr += cell;
  }
  var cityGroup = new THREE.Group();
  cityGroup.add(H.instance(bodyGeo, mats.plaster, houseT));
  for (var rv = 0; rv < 5; rv++) {
    if (roofBuckets[rv].length) cityGroup.add(H.instance(roofGeo, terracottaMats[rv], roofBuckets[rv]));
  }
  cityGroup.add(H.instance(new THREE.BoxGeometry(1, 1, 1), mats.city, farT));
  if (microT.length) cityGroup.add(H.instance(new THREE.BoxGeometry(1, 1, 1), mats.city, microT));
  if (parkT.length) cityGroup.add(H.instance(parkGeo, mats.grass, parkT));
  if (streetT.length) cityGroup.add(H.instance(streetGeo, mats.rock, streetT));
  if (cityTreeTrunkT.length) cityGroup.add(H.instance(treeTrunkGeo, mats.trunk, cityTreeTrunkT));
  if (cityTreeCanopyT.length) cityGroup.add(H.instance(treeCanopyGeo, mats.foliageCypress, cityTreeCanopyT));
  group.add(cityGroup);

  // Cheap plain-shaft columns for distant background landmarks (no fluting/entasis: they read
  // as small silhouettes in the haze, so a full H.makeDoricColumns/H.makeIonicColumns colonnade
  // would spend triangles the viewer will never resolve).
  function cheapColonnade(positions, height, r, capMat, shaftMat) {
    var g = new THREE.Group();
    var shaftGeo = new THREE.CylinderGeometry(r * 0.85, r, height, 6);
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
