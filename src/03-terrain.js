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
    if (vparams) {
      // Every reference photo shows the slope below the short rock band reading as dense wooded/
      // scrubby hillside, not more pale apron -- blend toward a darker olive-green tone with depth
      // below the cliff band, strongest near the plain where the real pine/scrub cover is densest.
      // Weighted hard toward the vegetation target (not a gentle blend): the scene's own warm
      // key light multiplies every surface's lit colour, which washes out a subtler green tint
      // almost entirely (confirmed by render -- a half-blended tan/olive still read as plain pale
      // tan once lit). Pushing the target itself darker and more saturated, and the blend weight
      // close to full replacement at high veg, is what actually survives that multiply and reads
      // as dark wooded slope instead of sunlit rock.
      var veg = clamp01((-vparams.y - (CLIFF_DROP + 1)) / 34);
      var vr = 0.14, vg = 0.30, vb = 0.09;
      r = r * (1 - veg * 0.88) + vr * veg * 0.88;
      g = g * (1 - veg * 0.80) + vg * veg * 0.80;
      b = b * (1 - veg * 0.90) + vb * veg * 0.90;
    }
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
    // Interior of the plaza: a nearly flat rock platform. Fine mottling only, capped well under
    // the 0.15m relief budget -- no broad slab bumps or long-wavelength dune-like swells.
    var micro = 0.05 * fineWeather(x, z); // +-0.05m fine surface texture, everywhere
    // A handful of exposed bedrock ledges, confined to a narrow band hugging the rim (inside the
    // rim fold itself): gated both by radius (a tight ring just short of e=0.86, where the fold
    // begins) and by a sparse noise threshold, so only a few isolated ledges break the platform
    // instead of a field of raised slabs scattered across the whole summit.
    var bedrock = H.noise2(x * 0.028, z * 0.042, 23); // -1..1, coarse so ledges read as distinct outcrops
    var edgeBand = 0;
    if (e > 0.66 && e < 0.86) {
      var eIn = smooth(clamp01((e - 0.66) / 0.05));
      var eOut = smooth(clamp01((0.86 - e) / 0.05));
      edgeBand = eIn * eOut;
    }
    var ledge = clamp01((bedrock - 0.62) / 0.1) * edgeBand * 0.4; // up to ~0.4m, sparse, rim-only
    var y = micro + ledge;
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
  // The plane is rectangular but the summit is an ellipse: drop triangles past the cliff rim,
  // whose drooping corners otherwise hang outside the cliff as pale sheets
  (function () {
    var idx = topGeo.index.array, keep = [];
    function eOf(v) { var x = arr[v * 3] / 150, z = arr[v * 3 + 2] / 75; return Math.sqrt(x * x + z * z); }
    for (var t = 0; t < idx.length; t += 3) {
      if (eOf(idx[t]) < 1.03 && eOf(idx[t + 1]) < 1.03 && eOf(idx[t + 2]) < 1.03) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    topGeo.setIndex(keep);
  })();
  topGeo.computeVertexNormals();
  paintVertexColors(topGeo, 700);
  var top = new THREE.Mesh(topGeo, weatheredMat(mats.rock, 700, 14));
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
  // scaled by RX/RZ when applied to x/z). Real Acropolis photos (Philopappou SW, Areopagus W,
  // Museum S, the north banner) all show a SHORT (15-25m) irregular, broken rock band sitting atop
  // a much longer steep-then-gentler wooded/scrubby slope running down to the city -- not one tall
  // uniform drum -- so CLIFF_T (the radial fraction spent on the near-vertical band) is kept small
  // and cliffY's own drop at t=CLIFF_T is fixed at a real ~20m, with the remaining ~60m of descent
  // spread across the long talus/hillside slope below.
  var CX = -45, CZ = 0, RX = 150, RZ = 75;
  var CLIFF_T = 0.16;
  var CLIFF_DROP = 20; // metres of near-vertical rock band (art-director spec: 15-25m)
  function cliffRadiusMul(t, a, seed) {
    // Horizontal strata ledges: broad, evenly-spaced courses with a rounded (smoothstepped) lip.
    var phase = H.noise2(cos(a) * 3, sin(a) * 3, seed + 40) * 0.9;
    var bands = 6;
    var bt = t * bands + phase;
    var bandFrac = bt - floor(bt);
    var ledgeDepthM = 1.025 + 0.275 * H.noise2(cos(a) * 6.3, sin(a) * 6.3, seed + 41); // metres (0.75-1.3m: stronger shadow lines)
    var ledgeT = bandFrac < 0.24 ? smooth((0.24 - bandFrac) / 0.24) : 0;
    var ledge = (t < CLIFF_T ? ledgeT * ledgeDepthM : 0) / RX;
    // Alternating course offset: every other stratum course sits a few centimetres further out
    // than its neighbour, so each bedding-plane boundary casts its own small shadow line even on
    // the flat, unledged part of the band -- reads as pronounced strata rather than one uniform
    // faceted face. Sign flips per band index, magnitude has a touch of per-angle variation.
    var bandIndex = floor(bt);
    var courseOffsetM = (bandIndex % 2 === 0 ? 1 : -1) * (0.032 + 0.018 * H.noise2(cos(a) * 8, sin(a) * 8, seed + 48));
    var courseOffset = (t < CLIFF_T ? courseOffsetM : 0) / RX;
    // Narrow fissures: gated by a coarse mask so only a handful appear, not a continuous ripple.
    var fissureFreq = 9 + 5 * H.noise2(cos(a) * 2.1, sin(a) * 2.1, seed + 42);
    var fissureAmpM = 0.25 + 0.2 * H.noise2(cos(a) * 9, sin(a) * 9, seed + 43); // metres
    var fissureMask = H.noise2(cos(a) * 4.2, sin(a) * 4.2, seed + 46);
    var fissureGate = fissureMask > 0.5 ? smooth(clamp01((fissureMask - 0.5) / 0.22)) : 0;
    var fissure = fissureGate * fissureAmpM * sin(a * fissureFreq + seed) * (1 - t * 0.4) / RX;
    // Patchy, gentle bulges (read as a shallow overhang at a distance) -- a small mask-gated swell.
    // Bounds scaled off CLIFF_T (not fixed metres) so this stays a mid-band feature now that the
    // band itself is much shorter.
    var overhangMask = H.noise2(cos(a) * 11, sin(a) * 11, seed + 44);
    var ohLo = CLIFF_T * 0.18, ohHi = CLIFF_T * 0.92;
    var overhangM = (t > ohLo && t < ohHi && overhangMask > 0.3)
      ? (overhangMask - 0.3) * 1.1 * sin((t - ohLo) / (ohHi - ohLo) * PI)
      : 0; // metres
    var overhang = overhangM / RX;
    // Irregular inward notches: broken cliff faces aren't a smooth ellipse in plan -- real bands
    // (Philopappou SW, Areopagus W) show sudden re-entrant breaks at a handful of angles where a
    // chunk of the face has sheared away. Gated sparse per-angle so only a few notches appear
    // around the perimeter, confined to (and fading at the top/bottom of) the vertical band.
    var notchMask = H.noise2(cos(a) * 3.4, sin(a) * 3.4, seed + 49);
    var notchGate = notchMask > 0.6 ? smooth(clamp01((notchMask - 0.6) / 0.18)) : 0;
    var notchVert = smooth(clamp01(t / (CLIFF_T * 0.35))) * (1 - smooth(clamp01((t - CLIFF_T * 0.6) / (CLIFF_T * 0.4))));
    var notchDepthM = notchGate * notchVert * (2.2 + 2.6 * H.noise2(cos(a) * 7.1, sin(a) * 7.1, seed + 50));
    var notch = notchDepthM / RX;
    // Fine surface roughness, well under the strata scale.
    var microM = 0.09 * H.noise2(cos(a) * 22 + t * 16, sin(a) * 22, seed + 45); // metres
    var micro = microM / RX;
    // Talus/hillside flare: the slope widens steadily as it runs out toward the plain, over the
    // now much longer post-cliff distance.
    var scree = t > CLIFF_T ? pow((t - CLIFF_T) / (1 - CLIFF_T), 1.15) * 1.3 : 0;
    // Broken-rock rubble bump-field right at the cliff foot: small irregular metre-scale bumps
    // (not a smooth flare) fading in just past the cliff base and fading back out over the talus.
    var taluBumpM = 0;
    if (t > CLIFF_T) {
      var bn = H.noise2(cos(a) * 15 + t * 40, sin(a) * 15, seed + 47);
      var fadeIn = smooth(clamp01((t - CLIFF_T) / 0.05));
      var fadeOut = 1 - smooth(clamp01((t - (CLIFF_T + 0.12)) / 0.12));
      taluBumpM = (0.1 + 0.3 * (0.5 + 0.5 * bn)) * fadeIn * Math.max(0, fadeOut);
    }
    var taluBump = taluBumpM / RX;
    return 1 + ledge + courseOffset + fissure + overhang + scree + micro + taluBump - notch;
  }
  // Short vertical rock band (CLIFF_DROP metres) down to y=-CLIFF_DROP, then a long steep-to-
  // gentler wooded/scrubby slope (real Attic hillside, not more bare rock) running the rest of the
  // way down to the plain at y=-80 -- steep just below the cliff foot, easing off as it nears the
  // city, per the reference photos.
  function cliffY(t) {
    if (t < CLIFF_T) return -t / CLIFF_T * CLIFF_DROP;
    var tt = (t - CLIFF_T) / (1 - CLIFF_T);
    var eased = 1 - pow(1 - tt, 1.6); // ease-out: steep right after the cliff foot, gentle near the plain
    return -CLIFF_DROP - eased * (80 - CLIFF_DROP);
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
        // Counter-clockwise seen from outside, so normals face out and the slope is not culled
        indices.push(a0, b1, b0, a0, a1, b1);
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
  // Carve the two theatre bowls out of the hillside (same bowls as 08-southslope.js carves in its
  // rock apron); otherwise the slope buries the middle of the seating
  (function () {
    var bowls = [
      { x: -6, y: -55, z: 124, r0: 22, dr: 1.05, dy: 0.6, rows: 24, sw: 19, sd: 23 },
      { x: -140, y: -52, z: 101, r0: 14, dr: 1.33, dy: 0.8, rows: 18, sw: 40, sd: 25 }
    ];
    var p = cliffGeo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var wx = p.getX(i), wz = p.getZ(i), f = Infinity;
      for (var b = 0; b < bowls.length; b++) {
        var o = bowls[b], dx = wx - o.x, dz = wz - o.z, d = Math.sqrt(dx * dx + dz * dz);
        var rMax = o.r0 + o.rows * o.dr, top = o.y + o.rows * o.dy;
        // Only vertices below the bowl's rim: higher ones belong to the cliff band and must stay
        if (p.getY(i) > top + 6) continue;
        if (dz <= 0.2 * d && d < rMax + 12) {
          f = Math.min(f, (d < o.r0 ? o.y : d < rMax ? o.y + ((d - o.r0) / o.dr) * o.dy : top + (d - rMax) * 0.9) - 1.0);
        } else if (dz > 0 && Math.abs(dx) < o.sw && dz < o.sd) f = Math.min(f, o.y - 1.0);
      }
      if (p.getY(i) > f) p.setY(i, f);
    }
    p.needsUpdate = true;
    cliffGeo.computeVertexNormals();
  })();
  paintVertexColors(cliffGeo, 900, true);
  // A larger uvScale than the material's native tiling spreads the baked stone texture into
  // broad soft bands instead of a tight regular grid, so the strata read as bedding planes
  // rather than a faceted ashlar-like lattice (same fix as the plateau/apron materials).
  var cliffMesh = new THREE.Mesh(cliffGeo, weatheredMat(mats.rockDark, 900, 22));
  cliffMesh.castShadow = true;
  cliffMesh.receiveShadow = true;
  group.add(cliffMesh);

  // Ground plain
  // Reaches past the distant hills (up to ~5.5 km) so they stand on ground. Subdivided (was a
  // bare 2x2 slab) and given broad vertex-colour patches (dusty soil / scrub-green / dry-brown)
  // plus a very gentle rolling undulation, so the huge stretch of plain visible past the city in
  // wide shots reads as real countryside instead of one flat uniform beige sheet. The undulation
  // is held at zero out to well past the city's own footprint (maxR below) and only grows beyond
  // that, so no modelled building/tree ever floats or sinks relative to its own "flat -80" ground.
  var groundSeg = MOBILE ? 44 : 64;
  var groundGeo = new THREE.PlaneGeometry(16000, 16000, groundSeg, groundSeg);
  groundGeo.rotateX(-PI / 2);
  function mixC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  var gPos = groundGeo.attributes.position, gArr = gPos.array;
  var gCol = new Float32Array(gPos.count * 3);
  var gSoil = [0.62, 0.58, 0.49], gGreen = [0.42, 0.46, 0.32], gDry = [0.56, 0.48, 0.36];
  // Real Athens seen from the hills stands on a grey asphalt/concrete carpet, not orange-tan sand:
  // blend the ground plane toward a neutral grey wherever the city grid (section 4 below, same
  // radius the "maxR" city extent uses) actually sits, fading back to natural soil/scrub beyond it
  // so the open countryside past the city keeps its warm dusty colouring.
  var gAsphalt = [0.32, 0.325, 0.33];
  var CITY_GREY_R0 = 130, CITY_GREY_R1 = 210, CITY_GREY_MAX = 1350, CITY_GREY_FADE = 220;
  for (var gi = 0; gi < gArr.length; gi += 3) {
    var gx = gArr[gi], gz = gArr[gi + 2];
    var dxh = gx - CX, dzh = gz - CZ, distH = sqrt(dxh * dxh + dzh * dzh);
    var patch = H.noise2(gx * 0.0007, gz * 0.0009, 61);
    var fine = H.noise2(gx * 0.0035, gz * 0.003, 62);
    var green = clamp01((patch + 1) * 0.42 + (fine + 1) * 0.08);
    var dry = clamp01(((fine + 1) * 0.5 - 0.5) * 0.7);
    var gc = mixC(gSoil, gGreen, green);
    gc = mixC(gc, gDry, dry);
    var cityMask = smoothstep01(CITY_GREY_R0, CITY_GREY_R1, distH) * (1 - smoothstep01(CITY_GREY_MAX, CITY_GREY_MAX + CITY_GREY_FADE, distH));
    if (cityMask > 0) {
      var asphaltFine = 0.85 + 0.3 * H.noise2(gx * 0.01, gz * 0.011, 65);
      gc = mixC(gc, [gAsphalt[0] * asphaltFine, gAsphalt[1] * asphaltFine, gAsphalt[2] * asphaltFine], cityMask * 0.9);
    }
    gCol[gi] = gc[0]; gCol[gi + 1] = gc[1]; gCol[gi + 2] = gc[2];
    var rollFade = smoothstep01(1250, 2700, distH);
    var roll = 0.55 * H.noise2(gx * 0.0009, gz * 0.0011, 63) + 0.45 * H.noise2(gx * 0.0022, gz * 0.0019, 64);
    gArr[gi + 1] = roll * 5.5 * rollFade;
  }
  gPos.needsUpdate = true;
  groundGeo.computeVertexNormals();
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gCol, 3));
  mats.ground.vertexColors = true; // sole consumer of mats.ground, safe to flip in place
  var groundMesh = new THREE.Mesh(groundGeo, mats.ground);
  groundMesh.position.y = -80.4;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ---------------- 3. Hillside vegetation: Aleppo pines, dense scrub clumps, talus debris ----------------
  // Dense hillside cover between the cliff foot and the plain: pines and scrub clumps at ~4x the
  // previous instance counts. Both use cheap low-poly primitives (octahedron canopies/blobs
  // instead of icosahedra) so the coverage increase stays affordable -- at hillside viewing
  // distance the textured material reads the shape, not the facet count.
  // Per-vertex directional jitter on a low-poly primitive: builds ONE fixed, deterministic
  // irregular shape (not a per-instance effect -- InstancedMesh in r128 shares one geometry across
  // all instances), so this gives boulders their own lumpy, weathered silhouette that reads as
  // distinct from the smooth scaled icosahedra used for tree canopies, while per-instance
  // rotation/scale (already present at each call site) keeps individual rocks from looking cloned.
  function makeIrregularRock(radius, seed) {
    var geo = new THREE.IcosahedronGeometry(radius, 0);
    var pos = geo.attributes.position, arr = pos.array;
    var rr = lcg(seed);
    for (var vi = 0; vi < arr.length; vi += 3) {
      var vx = arr[vi], vy = arr[vi + 1], vz = arr[vi + 2];
      var len = sqrt(vx * vx + vy * vy + vz * vz) || 1;
      var nx = vx / len, ny = vy / len, nz = vz / len;
      var j = 0.68 + 0.6 * rr();
      arr[vi] = nx * len * j;
      arr[vi + 1] = ny * len * j * (0.8 + 0.35 * rr());
      arr[vi + 2] = nz * len * j;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  var hillR = lcg(140);
  var trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.6, 5);
  var pineGeo = new THREE.IcosahedronGeometry(1.7, 0);
  var pineGeo2 = new THREE.IcosahedronGeometry(1.15, 0); // smaller secondary lobe, stacked offset
  var scrubGeo = new THREE.OctahedronGeometry(0.62, 0); // 8 tris (was 20): ~1200 instances
  var pineTrunkT = [], pineCanopyT = [], pineCanopy2T = [], scrubT = [];
  // t is capped well short of 1 (unlike the boulder/rubble talus spray below, which fades out
  // anyway): at the higher counts here, even the previous build's occasional stragglers that
  // rode the talus's own noisy outer flare out toward the plain became numerous enough to read
  // as scrub scattered into the city plaza, so pines/scrub are kept to the upper cliff+talus face.
  // Range widened (was 0.32-0.68) and counts raised so this band now reaches all the way out to
  // the city's own (also widened, see CITY greenbelt below) start radius -- a real forested
  // greenbelt hugs the rock before the streets begin, not a hard cut from bare talus to houses.
  var pineCount = MOBILE ? 65 : 225;
  for (var p = 0; p < pineCount; p++) {
    var pa = hillR() * PI * 2, pt = (CLIFF_T + 0.02) + hillR() * (0.90 - CLIFF_T - 0.02);
    var m = cliffRadiusMul(pt, pa, 5);
    var px = CX + cos(pa) * RX * m, pz = CZ + sin(pa) * RZ * m, py = cliffY(pt);
    var psc = 0.55 + hillR() * 1.05; // wider height range -> more silhouette variation
    pineTrunkT.push({ p: [px, py + 1.3 * psc, pz], s: [psc, psc, psc] });
    // Asymmetric per-axis canopy scale (0.8-1.3x independently on each axis) breaks up the
    // perfect-octahedron silhouette so each canopy reads as an irregular clump, not a geometric
    // solid, without adding any geometry.
    var pcx = 0.8 + hillR() * 0.5, pcz = 0.8 + hillR() * 0.5;
    pineCanopyT.push({ p: [px, py + 2.9 * psc, pz], r: [0, hillR() * PI * 2, 0], s: [psc * 1.1 * pcx, psc * (0.5 + hillR() * 0.25), psc * 1.1 * pcz] });
    // Second, smaller lobe offset to one side and slightly lower: breaks the single-icosahedron
    // "gem on a post" silhouette into an irregular two-lobe crown, matching the soft, uneven real
    // pine/cypress canopies in the reference photos.
    var loA2 = hillR() * PI * 2, loR2 = 0.55 * psc;
    pineCanopy2T.push({
      p: [px + cos(loA2) * loR2, py + 2.55 * psc + (hillR() - 0.3) * 0.5 * psc, pz + sin(loA2) * loR2],
      r: [0, hillR() * PI * 2, 0],
      s: [psc * (0.6 + hillR() * 0.35), psc * (0.45 + hillR() * 0.3), psc * (0.6 + hillR() * 0.35)]
    });
  }
  var clusterCount = MOBILE ? 100 : 300;
  for (var sc = 0; sc < clusterCount; sc++) {
    var sa = hillR() * PI * 2, st = (CLIFF_T + 0.02) + hillR() * (0.90 - CLIFF_T - 0.02);
    var sm = cliffRadiusMul(st, sa, 5);
    var sx = CX + cos(sa) * RX * sm, sz = CZ + sin(sa) * RZ * sm, sy = cliffY(st);
    var clumpN = 3 + ((hillR() * 4) | 0);
    for (var ci = 0; ci < clumpN; ci++) {
      var jang = hillR() * PI * 2, jr = hillR() * 2.3;
      var jx = sx + cos(jang) * jr, jz = sz + sin(jang) * jr;
      var ssc = 0.45 + hillR() * 0.85;
      var scx = 0.8 + hillR() * 0.5, scz = 0.8 + hillR() * 0.5;
      scrubT.push({ p: [jx, sy + 0.32 * ssc, jz], r: [0, hillR() * PI * 2, 0], s: [ssc * scx, ssc * (0.55 + hillR() * 0.3), ssc * scz] });
    }
  }
  // Hillside scatter must stay out of the two carved theatre bowls (seating plus stage apron)
  function outOfBowls(list) {
    return list.filter(function (t) {
      var x = t.p[0], z = t.p[2];
      var d1 = Math.hypot(x + 6, z - 124), d2 = Math.hypot(x + 140, z - 101);
      return d1 > 50 && d2 > 42;
    });
  }
  group.add(H.instance(trunkGeo, mats.trunk, outOfBowls(pineTrunkT)));
  group.add(H.instance(pineGeo, mats.foliageOlive, outOfBowls(pineCanopyT)));
  group.add(H.instance(pineGeo2, mats.foliageOlive, pineCanopy2T));
  var scrubMesh = H.instance(scrubGeo, mats.scrub, outOfBowls(scrubT)); scrubMesh.castShadow = false; group.add(scrubMesh);

  var taluR = lcg(271);
  function warmBrighten(baseMat, dr, dg, db) {
    var m = baseMat.clone();
    m.color = new THREE.Color(m.color.r + dr, m.color.g + dg, m.color.b + db);
    return m;
  }
  var taluBoulderMat = warmBrighten(mats.rockDark, 0.18, 0.14, 0.06);
  var taluRubbleMat = warmBrighten(mats.rock, 0.16, 0.13, 0.07);
  // Irregular jittered low-poly rock (still 20 tris, same cost as the plain detail-0 icosahedron it
  // replaces) so boulders read as weathered broken rock, not the same "gem" primitive as the tree
  // canopies above -- per-instance rotation/non-uniform scale below then keeps individual rocks
  // from all looking like clones of the one master shape.
  var boulderGeo = makeIrregularRock(1, 601);
  var boulderT = [];
  var boulderCount = MOBILE ? 12 : 22;
  for (var bo = 0; bo < boulderCount; bo++) {
    var ba = taluR() * PI * 2, btq = CLIFF_T + 0.03 + pow(taluR(), 1.5) * 0.24; // biased toward the cliff foot, kept off the city plaza
    var bm = cliffRadiusMul(btq, ba, 5);
    var bx = CX + cos(ba) * RX * bm, bz = CZ + sin(ba) * RZ * bm, by = cliffY(btq);
    var bsc = 2.0 + taluR() * 3.5;
    boulderT.push({ p: [bx, by + bsc * 0.35, bz], r: [taluR() * PI, taluR() * PI, taluR() * PI], s: [bsc, bsc * (0.7 + taluR() * 0.4), bsc * (0.85 + taluR() * 0.3)] });
  }
  group.add(H.instance(boulderGeo, taluBoulderMat, outOfBowls(boulderT)));
  // Octahedron (8 tris, well under half the previous icosahedron's cost) lets the rubble spray
  // grow denser at the cliff base -- a real scree field is mostly count, not per-chip roundness.
  var rubbleGeo = new THREE.OctahedronGeometry(0.34, 0);
  var rubbleT = [];
  var rubbleCount = MOBILE ? 220 : 500;
  for (var ru = 0; ru < rubbleCount; ru++) {
    var ra = taluR() * PI * 2;
    // Two averaged uniforms give a bell-shaped (not stacked-at-zero) distribution along the talus,
    // so the densest scree band sits a few metres downslope of the cliff foot rather than pressed
    // right against the wall -- how a real rockfall apron settles.
    var tFrac = (taluR() + taluR()) * 0.5;
    var rtq = CLIFF_T + 0.02 + tFrac * 0.32;
    var rm2 = cliffRadiusMul(rtq, ra, 5);
    var rx = CX + cos(ra) * RX * rm2, rz = CZ + sin(ra) * RZ * rm2, ry = cliffY(rtq);
    // Size grading down the slope: larger settled chunks near the foot, finer chips further out --
    // a coarse stand-in for the natural size-sorting of a real scree fan.
    var sizeLOD = 1.15 - 0.5 * tFrac;
    var rsc = (0.45 + taluR() * 1.05) * sizeLOD;
    rubbleT.push({ p: [rx, ry + rsc * 0.2, rz], r: [taluR() * PI, taluR() * PI, taluR() * PI], s: [rsc, rsc * 0.8, rsc] });
  }
  group.add(H.instance(rubbleGeo, taluRubbleMat, outOfBowls(rubbleT)));

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
      apex, C1, C0, apex, C2, C1, apex, C3, C2, apex, C0, C3 // 4 sloped sides (base cap dropped: hidden)
    ];
    var verts = new Float32Array(tris.length * 3);
    for (var vi = 0; vi < tris.length; vi++) { verts[vi * 3] = tris[vi][0]; verts[vi * 3 + 1] = tris[vi][1]; verts[vi * 3 + 2] = tris[vi][2]; }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }
  // Flat roof cap: a plain flat quad at the wall top (2 tris) -- cheaper than the hip pyramid and
  // reads as a modern poured-concrete flat roof, the commonest form in real Athens.
  function flatRoofGeo(radius) {
    var a = radius * Math.SQRT1_2;
    var C0 = [a, 0, a], C1 = [-a, 0, a], C2 = [-a, 0, -a], C3 = [a, 0, -a];
    var tris = [C0, C1, C2, C0, C2, C3];
    var verts = new Float32Array(tris.length * 3);
    for (var vi = 0; vi < tris.length; vi++) { verts[vi * 3] = tris[vi][0]; verts[vi * 3 + 1] = tris[vi][1]; verts[vi * 3 + 2] = tris[vi][2]; }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }
  // Damaged/sagged roof: same 6-triangle hip silhouette, but the apex is pulled down and off to
  // one side so one slope caves inward -- reads as a part-collapsed, long-neglected roof.
  function damagedRoofGeo(radius, height) {
    var a = radius * Math.SQRT1_2;
    var C0 = [a, 0, a], C1 = [-a, 0, a], C2 = [-a, 0, -a], C3 = [a, 0, -a];
    var apex = [a * 0.4, height * 0.5, a * 0.2];
    var tris = [
      apex, C1, C0, apex, C2, C1, apex, C3, C2, apex, C0, C3
    ];
    var verts = new Float32Array(tris.length * 3);
    for (var vi = 0; vi < tris.length; vi++) { verts[vi * 3] = tris[vi][0]; verts[vi * 3 + 1] = tris[vi][1]; verts[vi * 3 + 2] = tris[vi][2]; }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }
  var hipGeo = pyramidRoofGeo(0.82, 0.6);
  var flatGeo = flatRoofGeo(0.82);
  var damagedGeo = damagedRoofGeo(0.82, 0.6);
  // City buildings are split into: walls-only boxes (no top/bottom face: 8 tris) textured with the
  // procedural facade, and separate flat roof caps (2 tris) in a windowless concrete material.
  // Near (<400 m) blocks cast shadows; far ones don't (cheaper shadow pass, invisible there anyway).
  var wallGeo = (function () {
    var g = new THREE.BoxGeometry(1, 1, 1), idx = g.index.array, keep = [];
    for (var q = 0; q < idx.length; q++) { var face = (q / 6) | 0; if (face === 2 || face === 3) continue; keep.push(idx[q]); }
    g.setIndex(keep);
    return g;
  })();
  var roofCapGeo = new THREE.PlaneGeometry(1, 1); roofCapGeo.rotateX(-PI / 2);
  var wallNearT = [], wallOldT = [], wallFarT = [], capNearT = [], capFarT = [];
  var tankT = [], hutT = [], solarT = [], poleT = [];
  var tintR = lcg(913);
  var BLOCK_TINTS = [[0.98, 0.97, 0.94], [0.97, 0.93, 0.83], [0.88, 0.88, 0.88], [0.94, 0.89, 0.78], [0.80, 0.80, 0.81], [0.93, 0.85, 0.68], [0.90, 0.78, 0.70], [0.97, 0.97, 0.97]];
  var BLOCK_CUM = [0.24, 0.42, 0.62, 0.78, 0.88, 0.94, 0.97, 1.0];
  function blockTint() {
    var r = tintR(), k = 0; while (k < BLOCK_CUM.length - 1 && r > BLOCK_CUM[k]) k++;
    var v = 0.93 + tintR() * 0.1, c = BLOCK_TINTS[k];
    return [c[0] * v, c[1] * v, c[2] * v];
  }
  function oldTint() { var v = 0.92 + tintR() * 0.1; return [0.98 * v, 0.94 * v, 0.84 * v]; }
  function roofTint() { var r = tintR(), v = 0.55 + tintR() * 0.35; if (r < 0.12) v = 0.95; else if (r > 0.92) v = 0.35; return [v, v * 0.99, v * 0.96]; }
  // Plaka: old tiled houses only within ~300 m of the hill centre on the north / north-east side
  // (north is -z, east is +x in this scene): compass bearing 10..125 degrees.
  function inPlaka(hx, hz) {
    var dx = hx + 45, dz = hz, d = Math.sqrt(dx * dx + dz * dz);
    if (d > 300) return false;
    var a = Math.atan2(-dz, dx) * 180 / PI;
    return a > 10 && a < 125;
  }
  function rotXZ(ox, oz, yaw) { return [ox * cos(yaw) + oz * sin(yaw), -ox * sin(yaw) + oz * cos(yaw)]; }
  // One building: walls + roof, plus rooftop clutter on flat-roofed near/mid blocks.
  function addBuilding(hx, hz, yaw, rr, stories, sx, sz, old, tiled, variant) {
    var sy = stories * storyH, shadow = rr < 400;
    var wt = { p: [hx, -80 + sy / 2, hz], r: [0, yaw, 0], s: [sx, sy, sz], c: old ? oldTint() : blockTint() };
    (old ? wallOldT : shadow ? wallNearT : wallFarT).push(wt);
    if (tiled) {
      var rs = (sx + sz) / 2;
      roofBuckets[variant].push({ p: [hx, -80 + sy + 0.3 * rs * 0.35, hz], r: [0, yaw, 0], s: [rs * 1.05, rs * 0.9, rs * 1.05] });
      return;
    }
    (shadow ? capNearT : capFarT).push({ p: [hx, -80 + sy + 0.02, hz], r: [0, yaw, 0], s: [sx * 1.02, 1, sz * 1.02], c: roofTint() });
    if (rr < 450 && stories >= 2.5) {
      var rc = cityR(), o, top = -80 + sy;
      if (rc < 0.34) { // water tank
        o = rotXZ((cityR() - 0.5) * sx * 0.6, (cityR() - 0.5) * sz * 0.6, yaw);
        var ts = 0.8 + cityR() * 0.5;
        tankT.push({ p: [hx + o[0], top + 0.55 * ts, hz + o[1]], s: [ts, ts, ts], c: cityR() < 0.6 ? [0.92, 0.92, 0.9] : [0.55, 0.57, 0.6] });
      }
      if (cityR() < 0.3) { // solar heater: dark tilted panel
        o = rotXZ((cityR() - 0.5) * sx * 0.6, (cityR() - 0.5) * sz * 0.6, yaw);
        solarT.push({ p: [hx + o[0], top + 0.55, hz + o[1]], r: [-0.55, yaw, 0], s: [1.8, 0.1, 1.2], c: [0.16, 0.2, 0.28] });
        tankT.push({ p: [hx + o[0], top + 1.15, hz + o[1] - 0.2 * cos(yaw)], s: [0.7, 0.7, 0.7], c: [0.92, 0.92, 0.9] });
      }
      if (cityR() < 0.35 && sx > 6 && sz > 6) { // stair hut
        o = rotXZ((cityR() < 0.5 ? -1 : 1) * sx * 0.28, (cityR() < 0.5 ? -1 : 1) * sz * 0.28, yaw);
        hutT.push({ p: [hx + o[0], top + 1.2, hz + o[1]], r: [0, yaw, 0], s: [2.4, 2.4, 2.8], c: blockTint() });
      }
      if (rr < 260 && cityR() < 0.3) { // antenna mast
        o = rotXZ((cityR() - 0.5) * sx * 0.7, (cityR() - 0.5) * sz * 0.7, yaw);
        poleT.push({ p: [hx + o[0], top + 1.6, hz + o[1]], s: [1, 1, 1], c: [0.35, 0.35, 0.36] });
      }
    }
  }
  var microT = [];
  // Six roof variants mixing shape (hip/flat/damaged) and colour (hue shifted +-20%, ~1/3 of
  // variants desaturated toward grey-green to read as aged/mossy) so roofs stop reading as one
  // identical geometry+colour repeated everywhere.
  var roofVariantDefs = [
    { geo: hipGeo, color: [0.85, 0.42, 0.22] },   // hip, warm terracotta (toned down from neon-orange)
    { geo: hipGeo, color: [0.80, 0.50, 0.20] },   // hip, standard clay
    { geo: hipGeo, color: [0.70, 0.56, 0.34] },   // hip, sun-bleached pale (-hue/desaturated)
    { geo: flatGeo, color: [0.83, 0.80, 0.72] },  // flat modern concrete cap, pale/whitewashed
    { geo: flatGeo, color: [0.56, 0.58, 0.50] },  // flat cap, weathered grey-green (desaturated)
    { geo: damagedGeo, color: [0.52, 0.46, 0.30] } // damaged/mossy, desaturated + green-shifted
  ];
  var roofMats = roofVariantDefs.map(function (v) {
    var m = mats.terracotta.clone();
    m.color.setRGB(v.color[0], v.color[1], v.color[2]);
    return m;
  });
  var roofBuckets = [[], [], [], [], [], []];
  // Cumulative probabilities: ~25% hip (pristine tile), ~55% flat (modern -- the commonest real
  // Athens roof), ~20% damaged/mossy. Was ~45% hip, which (all three hip variants being some
  // shade of saturated orange/terracotta, the one roof shape with a strong silhouette) made the
  // whole city read as a uniform field of orange pyramids at a distance even though the flat/
  // damaged variants were already there -- they just don't register as a distinct shape from far
  // away the way a pointed hip roof does.
  var roofCum = [0.10, 0.18, 0.25, 0.50, 0.80, 1.0];
  function roofVariantAt(hx, hz) {
    var n = tintR();
    return n < 0.3 ? 0 : n < 0.6 ? 1 : n < 0.88 ? 2 : 5;
  }
  // Tree clumps and small parks woven into the city fabric.
  var treeTrunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 5);
  var treeCanopyGeo = new THREE.IcosahedronGeometry(1.5, 0); // bigger crown -- pure scale, reads at distance
  var parkGeo = new THREE.PlaneGeometry(1, 1); parkGeo.rotateX(-PI / 2);
  var cityTreeTrunkT = [], cityTreeCanopyT = [], cityTreeCanopyFarT = [], parkT = [];

  // Real Athens seen from the hills is a dense, continuous carpet of tightly packed blocks with
  // only street-width gaps, not individually-spaced boxes -- lot spacing tightened at every LOD
  // tier so gaps between buildings shrink toward street width. The far/taper tiers (by far the
  // largest fraction of the city's screen area in the wide hill shots) use the cheapest per-house
  // geometry already (a bare box, no roof mesh -- see farT/microT below), so tightening them costs
  // very little per added triangle; near/mid keep a smaller tightening since each instance there
  // also carries a separate roof mesh.
  var cellNear = 12, cellMid = 19, cellFar = 68, cellTaper = cellFar * 1.2; // block cell size by ring (metres)
  var maxR = 1350; // extended from 1100 so the far LOD tier tapers out instead of cutting off abruptly
  var storyH = 2.9;
  function smoothstep01(e0, e1, x) { var t = (x - e0) / (e1 - e0); if (t < 0) t = 0; if (t > 1) t = 1; return t * t * (3 - 2 * t); }
  // Interpolated cell size across each tier boundary so the density gradient reads as a continuous
  // fade (denser near the hill, sparser toward the haze) instead of a visible step where one grid
  // resolution abruptly replaces another.
  function cellAt(rrv) {
    if (rrv < 210) return cellNear;
    if (rrv < 300) return cellNear + (cellMid - cellNear) * smoothstep01(210, 300, rrv);
    if (rrv < 540) return cellMid;
    if (rrv < 680) return cellMid + (cellFar - cellMid) * smoothstep01(540, 680, rrv);
    if (rrv < 1080) return cellFar;
    if (rrv < 1220) return cellFar + (cellTaper - cellFar) * smoothstep01(1080, 1220, rrv);
    return cellTaper;
  }
  // Street-surface tiles: pale worn stone strips laid into the street lanes near+mid tier so the
  // gaps between blocks read as walked/paved paths rather than plain bare sand.
  var streetGeo = new THREE.BoxGeometry(1, 1, 1);
  var streetT = [];
  // Widened from (160,85) so a real forested greenbelt (the hillside pine/scrub band above, whose
  // range was extended to match) separates the rock from the streets, instead of houses starting
  // almost the moment the talus ends.
  function ellipseE(hx, hz) {
    var dx = hx + 45, dz = hz;
    return (dx / 215) * (dx / 215) + (dz / 112) * (dz / 112);
  }
  // The south-slope theatre/Odeon rock apron (built independently in 08-southslope.js, centred
  // ~(-60,85) with a ~130x60 half-extent) isn't part of the main hill ellipse above, so without
  // this the city grid (which only knows about that main ellipse) happily plants ordinary houses
  // on top of/inside the carved hillside there -- confirmed in render as boxes with roofs poking
  // out of the theatre's own rock face. Same elliptical gate, centred/sized on that apron with a
  // small margin for each house's own footprint.
  function inSouthSlopeApron(hx, hz) {
    var dx = (hx + 60) / 148, dz = (hz - 85) / 78;
    return dx * dx + dz * dz < 1;
  }
  // Occupancy fraction beyond the mid tier: a smooth 3-step fade (~100% -> ~55% intermediate ->
  // ~30% at the haze edge) instead of the old hard jump from a fully-filled far tier straight to
  // the outer ring's 70%-kept coin-flip -- the city now thins out gradually as it recedes.
  function occupancyAt(rrv) {
    if (rrv < 620) return 1.0;
    if (rrv < 1150) return 1.0 - 0.35 * smoothstep01(620, 1150, rrv);
    if (rrv < 1350) return 0.65 - 0.22 * smoothstep01(1150, 1350, rrv);
    return 0.43;
  }
  // Walk rings of increasing radius; within each ring, walk around it at the ring's own angular
  // step (derived from its cell size) so density stays even instead of thinning like 1/r.
  for (var rr = 46; rr < maxR; ) {
    var cell = cellAt(rr);
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
      if (inSouthSlopeApron(hx, hz)) continue; // keep off the theatre/Odeon rock apron
      var yaw = CITY_ROT + ((cix + ciz) % 2 ? PI / 2 : 0) + (cityR() - 0.5) * 0.1; // aligned to the block grid
      if (isStreet) {
        // Street gap: left empty; the grey asphalt plane shows through as the lane.
        continue;
      }
      // Tree-clump/park odds are higher near the hill and taper with distance, so the city fabric
      // itself carries visibly more greenery close in (real Plaka courtyards + the archaeological
      // park's edge) instead of a flat 3.5%/1.5% everywhere.
      var treeChance = rr < 260 ? 0.09 : rr < 620 ? 0.05 : 0.02;
      var parkChance = rr < 260 ? 0.045 : rr < 620 ? 0.02 : 0.01;
      var special = cityR();
      if (special < treeChance) {
        // Tree clump instead of a house
        var tsc = 0.8 + cityR() * 0.7;
        if (rr < 300) cityTreeTrunkT.push({ p: [hx, 0.8 * tsc - 80, hz], s: [tsc, tsc, tsc] });
        for (var lobe = 0; lobe < 3; lobe++) {
          var loA = (lobe / 3) * PI * 2 + cityR();
          (rr < 300 ? cityTreeCanopyT : cityTreeCanopyFarT).push({ p: [hx + cos(loA) * 0.7 * tsc, (1.7 + cityR() * 0.5) * tsc - 80, hz + sin(loA) * 0.7 * tsc], s: [tsc * 0.8, tsc * 0.7, tsc * 0.8] });
        }
      } else if (special < treeChance + parkChance) {
        // Small park: a flat green patch with a couple of trees
        parkT.push({ p: [hx, -80 + 0.03, hz], r: [0, yaw, 0], s: [cell * 0.9, 1, cell * 0.9] });
        for (var pt2 = 0; pt2 < 2; pt2++) {
          var pox = hx + (cityR() - 0.5) * cell * 0.6, poz = hz + (cityR() - 0.5) * cell * 0.6;
          var ptsc = 0.7 + cityR() * 0.5;
          if (rr < 300) cityTreeTrunkT.push({ p: [pox, 0.8 * ptsc - 80, poz], s: [ptsc, ptsc, ptsc] });
          (rr < 300 ? cityTreeCanopyT : cityTreeCanopyFarT).push({ p: [pox, 1.9 * ptsc - 80, poz], s: [ptsc * 0.8, ptsc * 0.7, ptsc * 0.8] });
        }
      } else if (rr < 260) {
        // Coarse, spatially-coherent (noise, not per-cell coin-flip) open patches -- small plazas,
        // vacant lots, wider courtyards -- so the near-tier grid isn't a literal 100%-filled carpet
        // of houses between the streets.
        if (H.noise2(hx * 0.02, hz * 0.022, 811) > 0.62) continue;
        // Near tier: real Athens as seen from the hills is mostly 4-7 storey apartment blocks
        // (~8-25m at storyH=2.9), with just a minority of older 1-2 storey houses for variety --
        // was skewed short (40% single-storey), which was a big part of the "sparse boxes" read.
        var oldH = inPlaka(hx, hz) && cityR() < 0.8;
        var roll1 = cityR(), stories1;
        if (oldH) stories1 = 1.2 + cityR() * 2.0;
        else if (roll1 < 0.12) stories1 = 1 + cityR() * 1.1;
        else if (roll1 < 0.5) stories1 = 3.5 + cityR() * 1.8;
        else stories1 = 5 + cityR() * 2.6;
        var sxh = (oldH ? 5 : 8) + cityR() * (oldH ? 5 : 3.5), szh = (oldH ? 5 : 8) + cityR() * (oldH ? 5 : 3.5);
        addBuilding(hx, hz, yaw, rr, stories1, sxh, szh, oldH, oldH && cityR() < 0.8, roofVariantAt(hx, hz));
      } else if (rr < 620) {
        // Same coarse open-patch mask, sparser than the near tier so the mid tier still reads dense.
        if (H.noise2(hx * 0.014, hz * 0.016, 812) > 0.72) continue;
        // Mid tier: mostly mid-rise (3-6 storeys, ~8.7-17.4m) with a minority of shorter older
        // houses, so the "wall of similar boxes" reads as a real block front, not a height-uniform
        // band distinct from the near tier.
        var oldM = inPlaka(hx, hz) && cityR() < 0.7;
        var stories2 = oldM ? 1.2 + cityR() * 2.0 : cityR() < 0.2 ? 1 + cityR() * 1.3 : 3.5 + cityR() * 3.0;
        var sx2 = (oldM ? 6 : 11) + cityR() * (oldM ? 8 : 5), sz2 = (oldM ? 6 : 11) + cityR() * (oldM ? 8 : 5);
        addBuilding(hx, hz, yaw, rr, stories2, sx2, sz2, oldM, oldM && cityR() < 0.75, roofVariantAt(hx, hz));
      } else if (rr < 1150) {
        // Far tier now fades from fully-occupied at 620m down to the intermediate ~55% density by
        // 1150m (a gradient, not a flat 100%-filled band butting against the outer ring).
        if (cityR() > occupancyAt(rr)) continue;
        // Far tier's own block reads as most of the city's screen area in the wide hill shots, so
        // it gets the same height variety as the nearer tiers (cheap: still one bare box, no roof).
        var stories3 = cityR() < 0.12 ? 1.5 + cityR() * 1.5 : 4.5 + cityR() * 3.5;
        var sx3 = 20 + cityR() * 20, sz3 = 20 + cityR() * 20, sy3 = stories3 * storyH;
        addBuilding(hx, hz, yaw, rr, stories3, sx3, sz3, false, false, 0);
      } else {
        // Tapered outer ring (1150-1350m): occupancy keeps fading (from ~75% down to ~55%) on the
        // same curve as the far tier above, instead of a separate hard coin-flip threshold.
        if (cityR() > occupancyAt(rr)) continue;
        var sx4 = 3 + cityR() * 5, sz4 = 3 + cityR() * 5, sy4 = (1.2 + cityR() * 2.2) * storyH;
        addBuilding(hx, hz, yaw, rr, sy4 / storyH, sx4, sz4, false, false, 0);
      }
    }
    rr += cell;
  }

  // ---------------- Urban forest scatter: canopies rising between the rooftops ----------------
  // A real city core this close to a major green space/archaeological park isn't wall-to-wall
  // building -- courtyards, street trees and small squares thread all through it (see any real
  // aerial of the Plaka/Makrygianni district). This scatter is independent of the grid above --
  // positions can and do land on top of a house footprint, which is correct: a canopy poking up
  // between buildings, not a gap in them. Cheap octahedron canopies (8 tris) bias toward the hill
  // and taper out with distance, same gradient as the grid's own tree/park special tiles.
  var forestR = lcg(419);
  // Crown/trunk sized like a real 5-8m-wide tree (was a near-invisible 1-2m at this view distance
  // -- pure scale, no extra geometry cost) so the scatter actually registers in wide shots instead
  // of disappearing to sub-pixel specks between the rooftops.
  // Rounded canopies: octahedrons read as green crystals from a distance
  var forestCanopyGeo = new THREE.IcosahedronGeometry(2.3, 0);
  var forestOliveT = [], forestCypressT = [], forestOliveFarT = [], forestCypressFarT = [];
  var forestCanopyFarGeo = new THREE.OctahedronGeometry(2.6, 0); // 8 tris for the far crowns
  var forestCount = MOBILE ? 150 : 430;
  for (var fo = 0; fo < forestCount; fo++) {
    var fa = forestR() * PI * 2;
    // Weighted toward inner radii (denser near the hill, thinning outward), capped at the mid
    // tier's own outer edge so this stays a "green city core" effect, not a forest at the haze.
    var fr = 55 + Math.pow(forestR(), 0.65) * 560;
    var fhx = -45 + cos(fa) * fr, fhz = sin(fa) * fr;
    if (ellipseE(fhx, fhz) < 1) continue; // keep off the hill itself
    var fsc = 0.85 + forestR() * 0.95;
    var fCanopy = { p: [fhx, -80 + 1.6 * fsc, fhz], r: [0, forestR() * PI * 2, 0], s: [fsc, fsc * (0.85 + forestR() * 0.3), fsc] };
    var fFar = fr > 300;
    if (forestR() < 0.6) (fFar ? forestOliveFarT : forestOliveT).push(fCanopy); else (fFar ? forestCypressFarT : forestCypressT).push(fCanopy);
  }

  var cityGroup = new THREE.Group();
  // Instanced mesh with optional per-instance colour (t.c) and shadow flag; keepUV: the city
  // materials compute their own world-scale UVs in-shader (see the mats module), finishScene must not.
  // The list is split into ~48 polar chunks (16 sectors x 3 distance bands) and each chunk gets its
  // own InstancedMesh with a cloned geometry whose boundingSphere encloses just that chunk, so
  // three's frustum culling drops off-screen chunks in the main, shadow and SSAO passes (a single
  // InstancedMesh is culled by its unit geometry's sphere and is effectively always drawn).
  function cityInst(geo, mat, list, shadow, target) {
    target = target || cityGroup;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    var gr = geo.boundingSphere.radius, cells = {}, k;
    for (var li = 0; li < list.length; li++) {
      var e = list[li], dx = e.p[0] + 45, dz = e.p[2], d = Math.sqrt(dx * dx + dz * dz);
      var key = (Math.floor((Math.atan2(dz, dx) / (PI * 2) + 0.5) * 16) % 16) + '/' + (d < 300 ? 0 : d < 620 ? 1 : 2);
      (cells[key] || (cells[key] = [])).push(e);
    }
    for (k in cells) {
      var sub = cells[k], cx = 0, cy = 0, cz = 0, si, ms = 0;
      for (si = 0; si < sub.length; si++) { cx += sub[si].p[0]; cy += sub[si].p[1]; cz += sub[si].p[2]; }
      cx /= sub.length; cy /= sub.length; cz /= sub.length;
      var rad = 0;
      for (si = 0; si < sub.length; si++) {
        var q = sub[si], s = q.s || [1, 1, 1], sm = Math.max(s[0], s[1], s[2]);
        var dd = Math.sqrt((q.p[0] - cx) * (q.p[0] - cx) + (q.p[1] - cy) * (q.p[1] - cy) + (q.p[2] - cz) * (q.p[2] - cz)) + gr * sm;
        if (dd > rad) rad = dd;
      }
      var g2 = geo.clone();
      g2.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), rad + 1);
      var m = H.instance(g2, mat, sub), col = new THREE.Color();
      if (sub[0].c) {
        for (var ci = 0; ci < sub.length; ci++) { col.setRGB(sub[ci].c[0], sub[ci].c[1], sub[ci].c[2]); m.setColorAt(ci, col); }
        m.instanceColor.needsUpdate = true;
      }
      m.castShadow = !!shadow;
      m.userData.keepUV = true;
      target.add(m);
    }
  }
  // Box without its bottom face (10 tris): rooftop clutter never shows its underside.
  function boxNoBottom(w, h, d) {
    var g = new THREE.BoxGeometry(w, h, d), idx = g.index.array, keep = [];
    for (var q = 0; q < idx.length; q++) { if (((q / 6) | 0) === 3) continue; keep.push(idx[q]); }
    g.setIndex(keep);
    return g;
  }
  var cityX = mats.city.userData;
  var roofConcMat = cityX.roofMat || mats.city;
  var clutterMat = cityX.clutterMat || mats.ivory;
  cityInst(wallGeo, mats.city, wallNearT, true);
  cityInst(wallGeo, mats.plaster, wallOldT, true);
  cityInst(wallGeo, mats.city, wallFarT, false);
  cityInst(roofCapGeo, roofConcMat, capNearT, true);
  cityInst(roofCapGeo, roofConcMat, capFarT, false);
  for (var rv = 0; rv < roofVariantDefs.length; rv++) {
    if (roofBuckets[rv].length) {
      var rgeo = roofVariantDefs[rv].geo, rbefore = cityGroup.children.length;
      cityInst(rgeo, roofMats[rv], roofBuckets[rv], true);
      for (var rci = rbefore; rci < cityGroup.children.length; rci++) cityGroup.children[rci].userData.keepUV = false;
    }
  }
  var tankGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.1, 6);
  tankGeo.setIndex(Array.prototype.slice.call(tankGeo.index.array, 0, (6 * 2 + 6) * 3)); // torso + top cap only
  cityInst(tankGeo, clutterMat, tankT, false);
  cityInst(boxNoBottom(1, 1, 1), clutterMat, hutT, false);
  cityInst(boxNoBottom(1, 1, 1), clutterMat, solarT, false);
  cityInst(boxNoBottom(0.07, 3.2, 0.07), clutterMat, poleT, false);
  if (parkT.length) cityGroup.add(H.instance(parkGeo, mats.grass, parkT));
  // Grey asphalt floor under the whole city (fades out past the outermost blocks): covers the
  // tan ground texture so the lanes between blocks read as street, not sand.
  if (cityX.asphaltMat) {
    var asphaltMat = cityX.asphaltMat;
    var asphaltGeo = new THREE.PlaneGeometry(3000, 3000); asphaltGeo.rotateX(-PI / 2);
    asphaltMat.polygonOffset = true; asphaltMat.polygonOffsetFactor = -2; asphaltMat.polygonOffsetUnits = -2;
    var asphaltMesh = new THREE.Mesh(asphaltGeo, asphaltMat);
    asphaltMesh.position.set(-45, -80.15, 0); asphaltMesh.receiveShadow = true; asphaltMesh.userData.keepUV = true; asphaltMesh.renderOrder = -1;
    cityGroup.add(asphaltMesh);
  }
  cityInst(treeTrunkGeo, mats.trunk, cityTreeTrunkT, false);
  cityInst(forestCanopyGeo, mats.foliageOlive, forestOliveT, true);
  cityInst(forestCanopyGeo, mats.foliageCypress, forestCypressT, true);
  cityInst(forestCanopyFarGeo, mats.foliageOlive, forestOliveFarT, false);
  cityInst(forestCanopyFarGeo, mats.foliageCypress, forestCypressFarT, false);
  cityInst(treeCanopyGeo, mats.foliageCypress, cityTreeCanopyT, true);
  cityInst(treeCanopyGeo, mats.foliageCypress, cityTreeCanopyFarT, false);
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
    var back = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 6.2, 1.2), mats.rock);
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
