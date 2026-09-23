// Module 08: South Slope — Theatre of Dionysus (aisles, thrones, paved orchestra, skene colonnade)
// and Odeon of Herodes Atticus (arched stage facade built from real piers + arches).
window.buildSouthSlope = function (THREE, mats, H) {
  var group = new THREE.Group();
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var PI = Math.PI, sin = Math.sin, cos = Math.cos;
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // Rock-face vertical weathering: a sine-wave streak whose phase is perturbed by low-frequency
  // noise (irregular spacing, not a perfectly even ripple), ramped so staining concentrates near
  // the base of an exposed face and fades upward -- used to paint the apron below.
  function apronWeatherTint(x, y, z) {
    var base = 0.86 + 0.10 * H.noise2(x * 0.02, z * 0.02, 951) + 0.05 * H.noise2(x * 0.07, z * 0.07, 952);
    var phase = x * 0.28 + H.noise2(x * 0.015, z * 0.015, 953) * 5;
    var band = Math.pow(Math.max(0, cos(phase)), 6);
    var ramp = clamp01((-y - 35) / 75); // darker toward the plain, fading upward toward the plateau
    var irregular = 0.4 + 0.6 * (0.5 + 0.5 * H.noise2(x * 0.05, y * 0.09, 954));
    var streak = band * ramp * irregular;
    var mult = base * (1 - 0.42 * streak);
    return [clamp01(mult), clamp01(mult * (1 - 0.05 * streak)), clamp01(mult * (1 - 0.14 * streak))];
  }

  // Stepped auditorium as one mesh: per row a riser facing the orchestra and a tread facing up.
  var seatMat = mats.marbleShadowed.clone();
  seatMat.side = THREE.DoubleSide;
  seatMat.vertexColors = true;
  // Duller, dirtier base tone used only under the lower, foot-trafficked/rain-channelled rows.
  var wornSeatMat = mats.marbleShadowed.clone();
  wornSeatMat.side = THREE.DoubleSide;
  wornSeatMat.vertexColors = true;
  wornSeatMat.color = new THREE.Color(0xab9a72);

  // Gravity-biased weathering: seating darkens toward the lower rows, with rust-orange staining
  // patches and high-frequency worn/dirt spots layered on top.
  function caveaVertexColor(x, y, z, rowFrac) {
    var wear = H.noise2(x * 0.15, z * 0.15, 831);
    var spotN = H.noise2(x * 0.6, z * 0.6, 833);
    var rustN = H.noise2(x * 0.09, z * 0.11, 835);
    var grav = 0.6 + 0.4 * rowFrac; // rowFrac: 0 at the front/lowest row, 1 at the top
    var spotWear = spotN > 0.55 ? (spotN - 0.55) * 0.95 : 0;
    var base = grav * (1 - spotWear) * (0.92 + 0.08 * wear);
    var rustAmt = rustN > 0.28 ? (rustN - 0.28) * 0.7 * (1 - rowFrac * 0.5) : 0;
    return [
      clamp01(base * (1 + rustAmt * 0.35)),
      clamp01(base * (1 - rustAmt * 0.12)),
      clamp01(base * (1 - rustAmt * 0.42))
    ];
  }

  // wornFrac: fraction of rows (counted from the front/lowest row) built with the duller,
  // grime-caked worn material instead of the regular seating marble.
  function makeCavea(r0, dr, dy, rows, halfA, segs, wornFrac) {
    wornFrac = wornFrac || 0;
    var wornRows = Math.round(rows * wornFrac);
    function pt(r, y, phi) { return [r * sin(phi), y, -r * cos(phi)]; }
    function buildRange(rowStart, rowEnd, mat) {
      var pos = [], col = [];
      function pushPt(p, rowFrac) {
        pos.push(p[0], p[1], p[2]);
        var c = caveaVertexColor(p[0], p[1], p[2], rowFrac);
        col.push(c[0], c[1], c[2]);
      }
      function quad(a, b, c, d, rowFrac) {
        pushPt(a, rowFrac); pushPt(b, rowFrac); pushPt(c, rowFrac);
        pushPt(a, rowFrac); pushPt(c, rowFrac); pushPt(d, rowFrac);
      }
      for (var i = rowStart; i < rowEnd; i++) {
        var r = r0 + i * dr, y0 = i * dy, y1 = (i + 1) * dy;
        var rowFrac = rows > 1 ? i / (rows - 1) : 0;
        for (var k = 0; k < segs; k++) {
          var p0 = -halfA + (2 * halfA * k) / segs, p1 = -halfA + (2 * halfA * (k + 1)) / segs;
          quad(pt(r, y0, p0), pt(r, y1, p0), pt(r, y1, p1), pt(r, y0, p1), rowFrac);
          quad(pt(r, y1, p0), pt(r + dr, y1, p0), pt(r + dr, y1, p1), pt(r, y1, p1), rowFrac);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      var mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
    var g = new THREE.Group();
    if (wornRows > 0) g.add(buildRange(0, wornRows, wornSeatMat));
    g.add(buildRange(wornRows, rows, seatMat));
    return g;
  }
  // Rock apron
  // Lower amplitude than the helper's default reads as a real hillside apron rather than dunes.
  var apron = H.makeRockOutcrop(260, 120, 4.5, 3);
  apron.position.set(-60, -45, 85);
  apron.rotation.x = 0.31;
  group.add(apron);

  // ============================= Theatre of Dionysus =============================
  var theatreGroup = new THREE.Group();
  theatreGroup.position.set(-6, -55, 124);
  var dRows = 24, dR0 = 22, dDr = 1.05, dDy = 0.6, dHalfA = 1.75;
  theatreGroup.add(makeCavea(dR0, dDr, dDy, dRows, dHalfA, MOBILE ? 22 : 40, 0.35));

  // Klimakes: 8 radial aisle strips dividing the cavea into 7 wedges
  var dWedges = MOBILE ? 4 : 7;
  var aisleGeo = new THREE.BoxGeometry(0.9, 0.12, 1);
  var aisleT = [];
  for (var w = 0; w <= dWedges; w++) {
    var phi = -dHalfA + (2 * dHalfA * w) / dWedges;
    for (var i = 0; i < dRows; i++) {
      var r = dR0 + i * dDr + dDr * 0.5;
      var y = i * dDy + dDy * 0.5 + 0.06;
      aisleT.push({ p: [r * sin(phi), y, -r * cos(phi)], r: [0, -phi, 0], s: [1, 1, dDr * 1.02] });
    }
  }
  theatreGroup.add(H.instance(aisleGeo, mats.marbleWorn, aisleT));

  // Front-row thrones (proedria): seat + backrest facing the orchestra, one per wedge column
  var throneSeatGeo = new THREE.BoxGeometry(1.5, 0.55, 1.3);
  var throneBackGeo = new THREE.BoxGeometry(1.5, 1.1, 0.18);
  var seatT = [], backT = [];
  var throneCols = MOBILE ? 10 : 18;
  for (var tc = 0; tc < throneCols; tc++) {
    var tphi = -dHalfA + (2 * dHalfA * (tc + 0.5)) / throneCols;
    var tr = dR0 - 0.6;
    var tx = tr * sin(tphi), tz = -tr * cos(tphi);
    seatT.push({ p: [tx, 0.28, tz], r: [0, -tphi, 0] });
    var bx = tx - sin(tphi) * 0.66, bz = tz + cos(tphi) * 0.66;
    backT.push({ p: [bx, 1.1, bz], r: [0, -tphi, 0] });
  }
  theatreGroup.add(H.instance(throneSeatGeo, mats.marble, seatT));
  theatreGroup.add(H.instance(throneBackGeo, mats.marble, backT));

  // Paved orchestra: pale plaster paving (visually distinct from the surrounding worn-marble
  // seating) with raised concentric ring steps -- not just painted-on lines -- and a compact
  // white-marble thymele block at the centre.
  var orchGeom = new THREE.CylinderGeometry(19, 19, 0.3, MOBILE ? 24 : 40);
  var orchMesh = new THREE.Mesh(orchGeom, mats.plaster);
  orchMesh.castShadow = true; orchMesh.receiveShadow = true;
  orchMesh.position.y = -0.15;
  theatreGroup.add(orchMesh);
  // Concentric paving rings as real raised steps (thin annular cylinders), each a touch higher
  // than the last, reading as distinct pavement courses rather than a flat unmarked disc.
  var ringCount = 4, ringT = [];
  var ringGeo = new THREE.CylinderGeometry(1, 1, 0.14, MOBILE ? 20 : 36, 1, true);
  for (var ring = 1; ring <= ringCount; ring++) {
    var rr = ring * 4.2;
    ringT.push({ p: [0, 0.07 + ring * 0.07, 0], s: [rr, 1, rr] });
  }
  var ringMesh = H.instance(ringGeo, mats.marbleWorn, ringT);
  ringMesh.castShadow = false;
  theatreGroup.add(ringMesh);
  var thymele = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.8, 12), mats.marble);
  thymele.position.y = 0.4;
  thymele.castShadow = true; thymele.receiveShadow = true;
  theatreGroup.add(thymele);

  // Skene (stage building) with a colonnaded proscaenium facing the orchestra
  var skeneBack = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 2), mats.marbleWorn);
  skeneBack.position.set(0, 3, 21.3);
  skeneBack.castShadow = true; skeneBack.receiveShadow = true;
  theatreGroup.add(skeneBack);
  var proColumns = [];
  var proN = MOBILE ? 4 : 6;
  for (var pc = 0; pc < proN; pc++) proColumns.push([-13.5 + pc * (27 / (proN - 1)), 19.6]);
  theatreGroup.add(H.makeDoricColumns(proColumns, { height: 3.4, baseD: 0.62, topD: 0.5, y: 0 }));
  // Plain architrave/frieze/cornice only (no triglyph+guttae detail): a small stage-front
  // colonnade doesn't need full Doric ornament, and it keeps the theatre's triangle budget low.
  var proEnt = H.makeEntablature(28, 2, 0.9, { triglyphs: false, cornice: true });
  proEnt.position.set(0, 3.4 * 0.92, 20.1);
  theatreGroup.add(proEnt);

  group.add(theatreGroup);

  // ============================= Odeon of Herodes Atticus =============================
  var odeonGroup = new THREE.Group();
  odeonGroup.position.set(-140, -52, 101);
  var oRows = 18, oR0 = 14, oDr = 1.33, oDy = 0.8, oHalfA = PI / 2;
  odeonGroup.add(makeCavea(oR0, oDr, oDy, oRows, oHalfA, MOBILE ? 18 : 32));

  var oWedges = MOBILE ? 3 : 5;
  var oAisleT = [];
  for (var ow = 0; ow <= oWedges; ow++) {
    var ophi = -oHalfA + (2 * oHalfA * ow) / oWedges;
    for (var oi = 0; oi < oRows; oi++) {
      var or_ = oR0 + oi * oDr + oDr * 0.5;
      var oy = oi * oDy + oDy * 0.5 + 0.07;
      oAisleT.push({ p: [or_ * sin(ophi), oy, -or_ * cos(ophi)], r: [0, -ophi, 0], s: [1, 1, oDr * 1.02] });
    }
  }
  odeonGroup.add(H.instance(aisleGeo, mats.marbleWorn, oAisleT));

  // Half-disc orchestra, paved
  var odorchGeom = new THREE.CylinderGeometry(12, 12, 0.3, MOBILE ? 20 : 32, 1, false, -1.571, 3.142);
  var odorchMesh = new THREE.Mesh(odorchGeom, mats.marble);
  odorchMesh.castShadow = true; odorchMesh.receiveShadow = true;
  odorchMesh.rotation.y = PI;
  odorchMesh.position.y = -0.15;
  odeonGroup.add(odorchMesh);

  // Stage facade: real piers + arched openings across 3 tiers, not a slab with applied rings.
  // A thin recessed back wall gives the openings depth; piers and arch bands carry the load visually.
  var facadeHalfW = 38, bayCount = MOBILE ? 6 : 8;
  var bayW = (facadeHalfW * 2) / bayCount;
  var tierY = [0, 6.4, 12.8], tierH = 6.0, sillH = 0;
  // Recessed well behind the pier/arch front face (23.4) so each bay reads as a real shadowed
  // opening with depth, not a flat wall with lines painted on it.
  var backWall = new THREE.Mesh(new THREE.BoxGeometry(facadeHalfW * 2 + 2, 19.5, 1.2), mats.rockDark);
  backWall.position.set(0, 9.75, 19.0);
  backWall.castShadow = true; backWall.receiveShadow = true;
  odeonGroup.add(backWall);

  var pierGeo = new THREE.BoxGeometry(1.1, tierH * 3 + 2, 2.4);
  var pierT = [];
  for (var bp = 0; bp <= bayCount; bp++) {
    var bx2 = -facadeHalfW + bp * bayW;
    pierT.push({ p: [bx2, (tierH * 3 + 2) / 2, 22.2] });
  }
  odeonGroup.add(H.instance(pierGeo, mats.marbleWorn, pierT));

  // Tier entablature bands (visually separate the 3 storeys of arcading)
  var bandGeo = new THREE.BoxGeometry(facadeHalfW * 2 + 1.6, 0.7, 2.4);
  var bandT = [];
  for (var bt = 0; bt < 3; bt++) bandT.push({ p: [0, tierY[bt] + tierH + 0.35, 22.2] });
  odeonGroup.add(H.instance(bandGeo, mats.marbleWorn, bandT));

  // Arched openings per bay per tier: a chunky semicircular voussoir band standing proud on the
  // piers' own front face (not recessed inside them), sitting on a projecting springer lintel,
  // with an open reveal beneath it down to the recessed dark back wall -- a real shadowed opening.
  var archGeo = new THREE.TorusGeometry(bayW * 0.39, 0.5, 6, MOBILE ? 10 : 16, PI);
  var archT = [];
  var springerGeo = new THREE.BoxGeometry(bayW - 1.1, 0.35, 2.6);
  var springerT = [];
  var archZ = 23.35; // flush with the piers' front face (22.2 +/- 1.2 half-depth)
  for (var tier = 0; tier < 3; tier++) {
    for (var bay = 0; bay < bayCount; bay++) {
      var cx = -facadeHalfW + bayW * (bay + 0.5);
      var springY = tierY[tier] + tierH * 0.62;
      springerT.push({ p: [cx, springY, archZ] });
      archT.push({ p: [cx, springY, archZ] }); // default torus orientation: upper semicircle in the XY plane, facing +z
    }
  }
  odeonGroup.add(H.instance(archGeo, mats.marbleWorn, archT));
  odeonGroup.add(H.instance(springerGeo, mats.marbleWorn, springerT));

  // Recessed niche floor + back panel visible through each opening: with the back wall now ~4.4m
  // behind the arch face, this dark, shadowed rectangle is what reads as "depth" from a distance.
  var nicheFloorGeo = new THREE.BoxGeometry(bayW - 1.3, 0.15, 1.6);
  var nicheBackGeo = new THREE.BoxGeometry(bayW - 1.2, tierH * 0.72, 0.2);
  var nicheFloorT = [], nicheBackT = [];
  for (var tier2 = 0; tier2 < 3; tier2++) {
    for (var bay2 = 0; bay2 < bayCount; bay2++) {
      var cx2 = -facadeHalfW + bayW * (bay2 + 0.5);
      nicheFloorT.push({ p: [cx2, tierY[tier2] + 0.1, 20.0] });
      nicheBackT.push({ p: [cx2, tierY[tier2] + tierH * 0.36 + 0.1, 19.65] });
    }
  }
  odeonGroup.add(H.instance(nicheFloorGeo, mats.marbleShadowed, nicheFloorT));
  odeonGroup.add(H.instance(nicheBackGeo, mats.rockDark, nicheBackT));

  // Cornice capping the whole facade
  var facadeCornice = new THREE.Mesh(new THREE.BoxGeometry(facadeHalfW * 2 + 3, 0.8, 3), mats.marble);
  facadeCornice.position.set(0, tierH * 3 + 2.4, 21.8);
  facadeCornice.castShadow = true; facadeCornice.receiveShadow = true;
  odeonGroup.add(facadeCornice);

  group.add(odeonGroup);

  // Carve the rock apron so both auditoria and their stages sit on the slope.
  var bowls = [
    { x: -6, y: -55, z: 124, r0: 22, dr: 1.05, dy: 0.6, rows: 24, sw: 19, sd: 23 },
    { x: -140, y: -52, z: 101, r0: 14, dr: 1.33, dy: 0.8, rows: 18, sw: 40, sd: 25 }
  ];
  function floorAt(wx, wz) {
    var f = Infinity;
    for (var b = 0; b < bowls.length; b++) {
      var o = bowls[b];
      var dx = wx - o.x, dz = wz - o.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      var rMax = o.r0 + o.rows * o.dr;
      var top = o.y + o.rows * o.dy;
      if (dz <= 0.2 * d && d < rMax + 12) {
        var g = d < o.r0 ? o.y : d < rMax ? o.y + ((d - o.r0) / o.dr) * o.dy : top + (d - rMax) * 0.9;
        f = Math.min(f, g - 1.0);
      } else if (dz > 0 && Math.abs(dx) < o.sw && dz < o.sd) {
        f = Math.min(f, o.y - 1.0);
      }
    }
    return f;
  }
  apron.updateMatrix();
  var toWorld = apron.matrix.clone();
  var toLocal = new THREE.Matrix4().copy(toWorld).invert();
  var apPos = apron.geometry.getAttribute('position');
  var v = new THREE.Vector3();
  for (var k = 0; k < apPos.count; k++) {
    v.fromBufferAttribute(apPos, k).applyMatrix4(toWorld);
    var fl = floorAt(v.x, v.z);
    if (v.y > fl) {
      v.y = fl;
      v.applyMatrix4(toLocal);
      apPos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  apPos.needsUpdate = true;
  apron.geometry.computeVertexNormals();

  // Vertical water-stain weathering on the apron's exposed rock, concentrated near the base and
  // fading toward the plateau rim. Cloned so the shared mats.rock instance from
  // H.makeRockOutcrop (also used unmodified elsewhere) is never mutated.
  var apronMat = mats.rock.clone();
  apronMat.vertexColors = true;
  // mats.rock's baked strata read as a tight regular ripple when box-projected onto a mostly
  // horizontal/gently-sloped surface at its native 14m tile; a much larger tile on this clone
  // only spreads the same texture into broad, soft bands instead (see 03-terrain.js's plateau
  // for the same fix). Fresh userData object so the shared mats.rock instance isn't mutated.
  apronMat.userData = {};
  for (var auk in mats.rock.userData) apronMat.userData[auk] = mats.rock.userData[auk];
  apronMat.userData.uvScale = 150;
  apron.material = apronMat;
  var apCol = new Float32Array(apPos.count * 3);
  var wv = new THREE.Vector3();
  for (var k2 = 0; k2 < apPos.count; k2++) {
    wv.fromBufferAttribute(apPos, k2).applyMatrix4(toWorld);
    var c2 = apronWeatherTint(wv.x, wv.y, wv.z);
    apCol[k2 * 3] = c2[0]; apCol[k2 * 3 + 1] = c2[1]; apCol[k2 * 3 + 2] = c2[2];
  }
  apron.geometry.setAttribute('color', new THREE.Float32BufferAttribute(apCol, 3));

  // Cypresses: scattered around the auditoria, each dropped onto the apron by a downward ray
  var seed = 11;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  apron.updateMatrixWorld(true);
  var ray = new THREE.Raycaster();
  var down = new THREE.Vector3(0, -1, 0);
  var canopyT = [], trunkT = [];
  // Denser cypress cover on the hillside apron between the two theatres (was a sparse 16) --
  // matches the wider hillside-vegetation density pass in 03-terrain.js.
  for (var tries = 0; tries < 700 && canopyT.length < 46; tries++) {
    var cx3 = -175 + rnd() * 215, cz3 = 70 + rnd() * 70;
    if (floorAt(cx3, cz3) < Infinity) continue;
    ray.set(new THREE.Vector3(cx3, 50, cz3), down);
    var hit = ray.intersectObject(apron);
    if (!hit.length || hit[0].point.y < -75) continue;
    var gy = hit[0].point.y, sc = 0.8 + rnd() * 0.5;
    // Asymmetric xz scale (0.8-1.3x independently per axis) so each cone canopy reads as a
    // slightly irregular, wind-shaped crown instead of a perfect cone of revolution.
    var ccx = 0.8 + rnd() * 0.5, ccz = 0.8 + rnd() * 0.5;
    canopyT.push({ p: [cx3, gy + 1.2 + 4.5 * sc, cz3], s: [sc * ccx, sc, sc * ccz] });
    trunkT.push({ p: [cx3, gy + 0.75, cz3] });
  }
  group.add(H.instance(new THREE.ConeGeometry(1.3, 9, 8), mats.foliageCypress, canopyT));
  group.add(H.instance(new THREE.CylinderGeometry(0.2, 0.25, 1.5, 6), mats.trunk, trunkT));

  return group;
};
