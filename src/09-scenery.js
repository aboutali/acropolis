// Module 09 - Scenery: Athena Promachos (built by 13-figures.js), Great Altar, gnarled olive
// groves, and scattered marble fragments on the plateau.
window.buildScenery = function (THREE, mats, H) {
  var group = new THREE.Group();
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var PI = Math.PI;

  // Deterministic LCG (seed 42)
  var s = 42;
  function rnd() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  }

  // Athena Promachos at (-62, 0, -12), built by 13-figures.js — kept as-is, not rebuilt here.
  var promachos = H.makePromachos({});
  promachos.position.set(-62, 0, -12);
  group.add(promachos);

  // Great Altar at (-8, 0, -41), with a low relief frieze on the long faces
  var altar = new THREE.Group();
  altar.position.set(-8, 0, -41);

  var altarBase = new THREE.Mesh(new THREE.BoxGeometry(12, 2.2, 6), mats.marble);
  altarBase.position.y = 1.1;
  altarBase.castShadow = true;
  altarBase.receiveShadow = true;
  altar.add(altarBase);

  var altarTop = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 4), mats.marble);
  altarTop.position.y = 2.5;
  altarTop.castShadow = true;
  altarTop.receiveShadow = true;
  altar.add(altarTop);

  var friezeN = MOBILE ? 2 : 3;
  var friezeFront = H.makeRelief(10.5, 1.8, { figures: friezeN, lowDetail: MOBILE, seed: 5 });
  friezeFront.position.set(0, 1.1, 3.02);
  altar.add(friezeFront);
  var friezeBack = H.makeRelief(10.5, 1.8, { figures: friezeN, lowDetail: MOBILE, seed: 9 });
  friezeBack.position.set(0, 1.1, -3.02);
  friezeBack.rotation.y = PI;
  altar.add(friezeBack);

  group.add(altar);

  // ---------------- Olive groves: gnarled, twisted trunks with clumpy grey-green canopies ----------------
  var oliveTrees = [];
  var oliveCount = 0;
  var maxAttempts = 1000;
  var attempts = 0;

  while (oliveCount < 34 && attempts < maxAttempts) {
    attempts++;
    var angle = rnd() * Math.PI * 2;
    var radiusFactor = 0.78 + rnd() * (0.92 - 0.78);
    var rx = 148, rz = 73;
    var x = -45 + Math.cos(angle) * rx * radiusFactor;
    var z = 0 + Math.sin(angle) * rz * radiusFactor;

    var excluded = false;
    var exclusions = [
      { x0: -18, z0: -38, x1: 18, z1: 38 },
      { x0: -56, z0: -46, x1: -28, z1: -22 },
      { x0: -135, z0: -30, x1: -100, z1: 25 },
      { x0: -140, z0: 12, x1: -126, z1: 28 },
      { x0: -66, z0: -16, x1: -58, z1: -8 },
      { x0: -16, z0: -46, x1: 0, z1: -36 }
    ];
    for (var i = 0; i < exclusions.length; i++) {
      var ex = exclusions[i];
      if (x >= ex.x0 && x <= ex.x1 && z >= ex.z0 && z <= ex.z1) { excluded = true; break; }
    }
    if (!excluded) { oliveTrees.push({ x: x, z: z, seed: (oliveCount * 977 + 31) >>> 0 }); oliveCount++; }
  }

  // Gnarled trunk: a short, thick, lathe-twisted stump instead of a plain tapered cylinder.
  var trunkSeg = MOBILE ? 7 : 10;
  var trunkGeo = new THREE.CylinderGeometry(0.16, 0.5, 2.3, trunkSeg, 4);
  var tp = trunkGeo.attributes.position, tarr = tp.array;
  for (var ti = 0; ti < tarr.length; ti += 3) {
    var tx = tarr[ti], ty = tarr[ti + 1], tz = tarr[ti + 2];
    var theta = Math.atan2(tz, tx), r = Math.sqrt(tx * tx + tz * tz);
    var yN = (ty + 1.15) / 2.3;
    var gnarl = 1 + 0.22 * Math.cos(theta * 5 + yN * 6) * (1 - yN * 0.4);
    var lean = 0.18 * Math.sin(yN * PI * 0.5);
    tarr[ti] = r * gnarl * Math.cos(theta) + lean;
    tarr[ti + 2] = r * gnarl * Math.sin(theta);
  }
  tp.needsUpdate = true;
  trunkGeo.computeVertexNormals();

  var oliveTrunkTransforms = [];
  for (var i = 0; i < oliveTrees.length; i++) {
    var ot = oliveTrees[i];
    var rot = ((ot.seed % 1000) / 1000) * PI * 2;
    oliveTrunkTransforms.push({ p: [ot.x, 1.15, ot.z], r: [0, rot, 0] });
  }
  group.add(H.instance(trunkGeo, mats.trunk, oliveTrunkTransforms));

  // A couple of low gnarled root-boles at the trunk base for extra character
  var rootGeo = new THREE.SphereGeometry(0.42, 6, 5);
  var rootT = [];
  for (var i = 0; i < oliveTrees.length; i++) {
    var ot2 = oliveTrees[i];
    rootT.push({ p: [ot2.x, 0.25, ot2.z], s: [1.1, 0.55, 1.1] });
  }
  group.add(H.instance(rootGeo, mats.trunk, rootT));

  // Clumpy canopies: 4-5 overlapping irregular blobs per tree instead of 3 uniform ones.
  var oliveCanopyTransforms = [];
  for (var i = 0; i < oliveTrees.length; i++) {
    var tree = oliveTrees[i];
    var lobes = 4 + (i % 2);
    for (var j = 0; j < lobes; j++) {
      var offsetAngle = (j / lobes) * Math.PI * 2 + rnd() * 0.6;
      var offsetDist = 1.1 + rnd() * 0.9;
      var offsetX = tree.x + Math.cos(offsetAngle) * offsetDist;
      var offsetZ = tree.z + Math.sin(offsetAngle) * offsetDist;
      var offsetY = 3.1 + (rnd() - 0.5) * 2 * 0.9;
      var scale = 0.75 + rnd() * 0.55;
      oliveCanopyTransforms.push({
        p: [offsetX, offsetY, offsetZ],
        r: [rnd() * PI, rnd() * PI, rnd() * PI],
        s: [scale, scale * (0.75 + rnd() * 0.3), scale]
      });
    }
  }
  group.add(H.instance(new THREE.IcosahedronGeometry(1.7, 0), mats.foliageOlive, oliveCanopyTransforms));

  // Cypresses live in 08-southslope, which drops them onto the carved rock apron

  // ---------------- Scattered marble fragments: broken column drums, capitals, slabs ----------------
  // Each shape gets 3 weathering tints (InstancedMesh in r128 has no per-instance colour), so
  // fragments read with varied lichen/patina rather than one flat material.
  var drumGeo = new THREE.CylinderGeometry(0.7, 0.75, 0.6, MOBILE ? 8 : 12);
  var capGeo = new THREE.BoxGeometry(1.1, 0.5, 1.1);
  var slabGeo = new THREE.BoxGeometry(1.6, 0.35, 1.0);
  var fragBuckets = { drum: [[], [], []], cap: [[], [], []], slab: [[], [], []] };
  var fragCount = MOBILE ? 26 : 60;
  for (var i = 0; i < fragCount; i++) {
    var angle2 = (i / fragCount) * Math.PI * 2 + rnd() * 0.3;
    var radiusFactor2 = 0.85 + rnd() * (0.93 - 0.85);
    var rbx = -45 + Math.cos(angle2) * 148 * radiusFactor2;
    var rbz = 0 + Math.sin(angle2) * 73 * radiusFactor2;
    var yaw = rnd() * Math.PI * 2;
    var tilt = (rnd() - 0.5) * 0.45;
    var pick = rnd();
    var bucket = (rnd() * 3) | 0;
    if (pick < 0.4) fragBuckets.drum[bucket].push({ p: [rbx, 0.3, rbz], r: [tilt, yaw, tilt * 0.7] });
    else if (pick < 0.65) fragBuckets.cap[bucket].push({ p: [rbx, 0.25, rbz], r: [tilt * 0.3, yaw, tilt * 0.3] });
    else fragBuckets.slab[bucket].push({ p: [rbx, 0.18, rbz], r: [tilt * 0.2, yaw, tilt * 0.2] });
  }
  var fragTints = [0.74, 0.93, 1.1]; // weathered-dark, mid, cleaner-worn
  [['drum', drumGeo], ['cap', capGeo], ['slab', slabGeo]].forEach(function (entry) {
    var shape = entry[0], geo = entry[1];
    for (var b = 0; b < 3; b++) {
      var list = fragBuckets[shape][b];
      if (!list.length) continue;
      var m = mats.marbleWorn.clone();
      m.color.setScalar(fragTints[b]);
      group.add(H.instance(geo, m, list));
    }
  });

  return group;
};
