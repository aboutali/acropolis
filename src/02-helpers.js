// Module 02: H — shared geometry helpers (Doric/Ionic orders, entablatures, pediments, roofs, ashlar walls)
window.makeHelpers = function (THREE, mats) {
  var H = {};
  var SEG = (window.CFG && window.CFG.SEG) || { colRadial: 40, colHeight: 4, capital: 24 };
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var PI = Math.PI, sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, atan2 = Math.atan2, abs = Math.abs;

  function rotXZ(x, z, a) { if (!a) return [x, z]; var c = cos(a), s = sin(a); return [x * c - z * s, x * s + z * c]; }
  function addMesh(group, geo, mat, p, r) {
    var m = new THREE.Mesh(geo, mat);
    if (p) m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // Deterministic value noise
  H.noise2 = function (x, z, seed) {
    function hash(ix, iz) {
      var s = sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453;
      return s - Math.floor(s);
    }
    function smoothstep(t) { return t * t * (3 - 2 * t); }
    function octave(x, z, scale) {
      var xs = x * scale, zs = z * scale;
      var xi = Math.floor(xs), zi = Math.floor(zs);
      var xf = xs - xi, zf = zs - zi;
      var h00 = hash(xi, zi), h10 = hash(xi + 1, zi);
      var h01 = hash(xi, zi + 1), h11 = hash(xi + 1, zi + 1);
      var u = smoothstep(xf), v = smoothstep(zf);
      var n0 = h00 * (1 - u) + h10 * u;
      var n1 = h01 * (1 - u) + h11 * u;
      return n0 * (1 - v) + n1 * v;
    }
    var o1 = octave(x, z, 1);
    var o2 = octave(x, z, 2);
    var result = 0.65 * (2 * o1 - 1) + 0.35 * (2 * o2 - 1);
    return Math.max(-1, Math.min(1, result));
  };

  // Deterministic per-call PRNG (xorshift32) for hand-dressed irregularity —
  // stays seed-reproducible (no engine-provided randomness), yet still gives
  // each block/tile its own stable jitter.
  function seedRand(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  // Create InstancedMesh from geometry, material, and transforms
  H.instance = function (geo, mat, transforms) {
    var mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
    for (var i = 0; i < transforms.length; i++) {
      var t = transforms[i];
      var pos = t.p || [0, 0, 0];
      var rot = t.r || [0, 0, 0];
      var scale = t.s || [1, 1, 1];
      var matrix = new THREE.Matrix4();
      var euler = new THREE.Euler(rot[0], rot[1], rot[2]);
      var quat = new THREE.Quaternion().setFromEuler(euler);
      matrix.compose(new THREE.Vector3(pos[0], pos[1], pos[2]), quat, new THREE.Vector3(scale[0], scale[1], scale[2]));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // =====================================================================
  // DORIC ORDER: fluted entasis shaft, hypotrachelion necking + annulets,
  // curved echinus (LatheGeometry), square abacus, subtle drum joints.
  // =====================================================================
  H.makeDoricColumns = function (positions, opts) {
    opts = opts || {};
    var height = opts.height !== undefined ? opts.height : 10.4;
    var baseD = opts.baseD !== undefined ? opts.baseD : 1.9;
    var topD = opts.topD !== undefined ? opts.topD : 1.48;
    var flutes = opts.flutes !== undefined ? opts.flutes : 20;
    var entasis = opts.entasis !== undefined ? opts.entasis : 0.02;
    var y = opts.y !== undefined ? opts.y : 0;
    var drums = opts.drums !== undefined ? opts.drums : 2;
    // Cheap path for columns nobody gets close to (deep interior colonnades
    // seen only, if at all, through a doorway): no flute deformation, no
    // annulet/joint bands, low segment counts everywhere.
    var simple = !!opts.simple;
    var group = new THREE.Group();

    // Enough radial segments that each flute gets a couple of faces (crisp
    // arris) without blowing the triangle budget across dozens of columns.
    var radial = simple ? 16 : Math.max(flutes * 2, Math.min(MOBILE ? 32 : 44, flutes * 2));
    var heightSeg = simple ? 1 : (MOBILE ? 3 : 4);
    var neckFrac = 0.05;                    // hypotrachelion band, as a fraction of shaftH
    var shaftFrac = 1 - neckFrac;
    var shaftH = height * 0.90;             // fluted shaft + necking; echinus+abacus ride above it
    var echinusH = height * 0.055;
    var abacusH = height * 0.045;

    var shaftGeo = new THREE.CylinderGeometry(topD / 2, baseD / 2, shaftH, radial, heightSeg);
    if (!simple) {
      var pos = shaftGeo.getAttribute('position');
      var arr = pos.array;
      var i, px, py, pz, theta, r, yN, taper, ent, neckFac, nt, newR;
      for (i = 0; i < arr.length; i += 3) {
        px = arr[i]; py = arr[i + 1]; pz = arr[i + 2];
        theta = atan2(pz, px);
        r = sqrt(px * px + pz * pz);
        yN = (py + shaftH / 2) / shaftH;
        ent = 1 + entasis * sin(PI * Math.min(yN, shaftFrac) / shaftFrac);
        if (yN <= shaftFrac) {
          // Power-shaped (not pure cosine) profile: valleys stay near full depth
          // across most of the arc while the arris narrows to a crisp edge —
          // real Doric fluting is wide concave arcs meeting at a sharp line,
          // not an even sinusoidal scallop, and this reads as much stronger
          // shadow definition along each flute.
          taper = 1 - 0.09 * Math.pow(0.5 + 0.5 * cos(flutes * theta), 0.42);
          neckFac = 1;
        } else {
          taper = 1;                          // hypotrachelion: plain, unfluted band
          nt = (yN - shaftFrac) / neckFrac;
          neckFac = 0.965 - 0.02 * Math.exp(-Math.pow((nt - 0.5) * 7, 2)); // incised necking groove
        }
        // Foot flare (apophyge): a real Doric column has no separate base
        // blocks, but the shaft does curve outward right where it meets the
        // stylobate. The art director found columns transitioning straight
        // from shaft to floor with no molded base — this reads a deliberate
        // curved flare into that last ~5% of shaft height, at zero extra
        // triangles (same vertex loop, no new geometry).
        var footFrac = 0.05;
        var footFac = yN <= footFrac ? 1 + 0.07 * (1 - yN / footFrac) * (1 - yN / footFrac) : 1;
        newR = r * taper * ent * neckFac * footFac;
        arr[i] = newR * cos(theta);
        arr[i + 2] = newR * sin(theta);
      }
      pos.needsUpdate = true;
      // Duplicate every vertex per-triangle (toNonIndexed) BEFORE computing
      // normals: with no shared indices left, computeVertexNormals gives
      // each vertex the flat normal of its own triangle instead of an
      // average blended across the smooth interior of a flute and its
      // neighbour — the arris (where two flutes meet) reads as a true hard
      // shadow line instead of a soft gradient, at zero extra triangle cost.
      shaftGeo = shaftGeo.toNonIndexed();
      shaftGeo.computeVertexNormals();
    } else {
      shaftGeo.computeVertexNormals();
    }

    var shaftT = [], echinusT = [], abacusT = [], annuletT = [], jointT = [];
    if (simple) {
      // Plain drum + shallow cap, no ovolo curve, no necking rings.
      var echinusGeoS = new THREE.CylinderGeometry(topD * 0.56, topD * 0.5, echinusH, 12);
      var abacusGeoS = new THREE.BoxGeometry(topD * 1.32, abacusH, topD * 1.32);
      for (var si = 0; si < positions.length; si++) {
        var scx = positions[si][0], scz = positions[si][1];
        shaftT.push({ p: [scx, y + shaftH / 2, scz] });
        echinusT.push({ p: [scx, y + shaftH + echinusH / 2, scz] });
        abacusT.push({ p: [scx, y + shaftH + echinusH + abacusH / 2, scz] });
      }
      group.add(H.instance(shaftGeo, mats.marbleWorn, shaftT));
      group.add(H.instance(echinusGeoS, mats.marbleWorn, echinusT));
      group.add(H.instance(abacusGeoS, mats.marbleWorn, abacusT));
      return group;
    }

    // Echinus: curved ovolo profile as a surface of revolution.
    var neckR = topD / 2 * 0.955;
    var lathePts = [
      new THREE.Vector2(Math.max(0.01, neckR * 0.99), 0),
      new THREE.Vector2(neckR * 1.03, echinusH * 0.18),
      new THREE.Vector2(neckR * 1.24, echinusH * 0.58),
      new THREE.Vector2(topD * 0.63, echinusH * 0.88),
      new THREE.Vector2(topD * 0.605, echinusH)
    ];
    var echinusGeo = new THREE.LatheGeometry(lathePts, Math.min(radial, MOBILE ? 16 : 20));
    var abacusGeo = new THREE.BoxGeometry(topD * 1.32, abacusH, topD * 1.32);
    var annuletGeo = new THREE.CylinderGeometry(neckR * 1.045, neckR * 1.045, height * 0.006, Math.min(radial, MOBILE ? 12 : 16));
    var jointGeo = new THREE.CylinderGeometry(1, 1, height * 0.0035, Math.min(radial, MOBILE ? 10 : 14)); // unit radius, scaled per joint
    // Thin foot fillet ring where the shaft meets the stylobate: paired with
    // the vertex-level foot-flare above, this gives the column base a
    // visible molded collar (same cheap thin-cylinder technique as the
    // annulet at the neck) instead of the shaft just stopping flat.
    var footRingGeo = new THREE.CylinderGeometry(baseD / 2 * 1.055, baseD / 2 * 1.07, height * 0.01, Math.min(radial, MOBILE ? 12 : 16));

    var annuletBand = height * 0.02;
    var footRingT = [];
    for (i = 0; i < positions.length; i++) {
      var cx = positions[i][0], cz = positions[i][1];
      shaftT.push({ p: [cx, y + shaftH / 2, cz] });
      echinusT.push({ p: [cx, y + shaftH, cz] });
      abacusT.push({ p: [cx, y + shaftH + echinusH + abacusH / 2, cz] });
      annuletT.push({ p: [cx, y + shaftH - annuletBand * 0.4, cz] });
      footRingT.push({ p: [cx, y + height * 0.005, cz] });
      var fluteTop = shaftH * shaftFrac;
      for (var j = 1; j < drums; j++) {
        var jy = j / drums * fluteTop;
        var jr = (baseD / 2 + (topD / 2 - baseD / 2) * (jy / fluteTop)) * 1.006;
        jointT.push({ p: [cx, y + jy, cz], s: [jr, 1, jr] });
      }
    }
    group.add(H.instance(shaftGeo, mats.marbleWorn, shaftT));
    group.add(H.instance(echinusGeo, mats.marbleWorn, echinusT));
    group.add(H.instance(abacusGeo, mats.marbleWorn, abacusT));
    group.add(H.instance(annuletGeo, mats.marbleShadowed, annuletT));
    group.add(H.instance(jointGeo, mats.marbleShadowed, jointT));
    group.add(H.instance(footRingGeo, mats.marbleShadowed, footRingT));
    return group;
  };

  // =====================================================================
  // IONIC ORDER: fluted shaft, volute capital, egg-and-dart ovolo band.
  // opts.rotY orients the volute pair perpendicular to the colonnade run.
  // =====================================================================
  H.makeIonicColumns = function (positions, opts) {
    opts = opts || {};
    var height = opts.height !== undefined ? opts.height : 6.5;
    var baseD = opts.baseD !== undefined ? opts.baseD : 0.85;
    var topD = opts.topD !== undefined ? opts.topD : 0.72;
    var flutes = opts.flutes !== undefined ? opts.flutes : 24;
    var y = opts.y !== undefined ? opts.y : 0;
    var rotY = opts.rotY || 0;
    var group = new THREE.Group();

    var radial = Math.max(flutes * 2, Math.min(MOBILE ? 26 : 40, flutes * 2));
    var heightSeg = MOBILE ? 3 : 4;
    var baseH = height * 0.06;
    var shaftH = height * 0.80;
    var bandH = height * 0.05;
    var capH = height * 0.05;
    var abacusH = height * 0.032;

    // Attic base (square plinth + torus/scotia/torus profile), replacing the
    // old single tapered cylinder: the art director found columns jumping
    // straight from shaft to stylobate with no articulated base. The
    // torus-scotia-torus curve is one LatheGeometry revolution (same
    // technique as the Doric echinus above) so the extra detail costs only
    // a handful of extra segments, not extra meshes. Top radius matches the
    // shaft's own foot radius (baseD*0.6) so the shaft sits flush on it.
    var plinthH = baseH * 0.34;
    var curveH = baseH - plinthH;
    var t1H = curveH * 0.42, scH = curveH * 0.22, t2H = curveH - t1H - scH;
    var footR = baseD * 0.6;
    var baseLathePts = [
      new THREE.Vector2(Math.max(0.02, baseD * 0.50), 0),
      new THREE.Vector2(baseD * 0.62, t1H * 0.55),
      new THREE.Vector2(baseD * 0.54, t1H),
      new THREE.Vector2(baseD * 0.46, t1H + scH * 0.5),
      new THREE.Vector2(baseD * 0.52, t1H + scH),
      new THREE.Vector2(footR, t1H + scH + t2H * 0.6),
      new THREE.Vector2(footR, curveH)
    ];
    var baseCurveGeo = new THREE.LatheGeometry(baseLathePts, MOBILE ? 10 : 14);
    var plinthGeo = new THREE.BoxGeometry(baseD * 1.3, plinthH, baseD * 1.3);
    var shaftGeo = new THREE.CylinderGeometry(topD / 2, baseD * 0.6, shaftH, radial, heightSeg);
    var pos = shaftGeo.getAttribute('position'); var arr = pos.array;
    var i, px, py, pz, theta, r, yN, ent, newR;
    for (i = 0; i < arr.length; i += 3) {
      px = arr[i]; py = arr[i + 1]; pz = arr[i + 2];
      theta = atan2(pz, px); r = sqrt(px * px + pz * pz);
      yN = (py + shaftH / 2) / shaftH;
      ent = 1 + 0.012 * sin(PI * yN);
      newR = r * (1 - 0.028 * (0.5 + 0.5 * cos(flutes * theta))) * ent;
      arr[i] = newR * cos(theta); arr[i + 2] = newR * sin(theta);
    }
    pos.needsUpdate = true;
    // Same seam-hardening trick as the Doric shaft: break normal smoothing
    // at each flute arris by duplicating vertices per-triangle first.
    shaftGeo = shaftGeo.toNonIndexed();
    shaftGeo.computeVertexNormals();

    // Egg-and-dart ovolo band beneath the volutes: eggs (rounded, raised) and
    // darts (slender, recessed) alternate for real radial depth and a hard
    // shadow line between them, instead of a ring of flat-looking bumps.
    var bandGeo = new THREE.CylinderGeometry(topD * 0.56, topD * 0.58, bandH, Math.min(radial, MOBILE ? 12 : 16));
    var eggCount = MOBILE ? 4 : 6;
    var eggGeo = new THREE.SphereGeometry(topD * 0.085, MOBILE ? 5 : 6, MOBILE ? 4 : 4);
    var dartGeo = new THREE.ConeGeometry(topD * 0.032, topD * 0.16, 5);
    var eggR = topD * 0.58 * 1.06;

    // Sculptural double-spiral volute: a torus for the outer coil plus a
    // smaller concentric torus for the inner wind, with a raised "eye" boss
    // at the centre — reads as a real 3D scroll instead of a flat ring.
    // (Segment counts trimmed hard: there are dozens of these per building
    // and the scroll only needs to read at a glance, not bear close study.)
    var voluteGeo = new THREE.TorusGeometry(topD * 0.23, topD * 0.095, MOBILE ? 6 : 8, MOBILE ? 10 : 12);
    var voluteInnerGeo = new THREE.TorusGeometry(topD * 0.115, topD * 0.05, MOBILE ? 5 : 6, MOBILE ? 8 : 8);
    var voluteEyeGeo = new THREE.SphereGeometry(topD * 0.05, MOBILE ? 5 : 5, MOBILE ? 4 : 4);
    var abacusGeo = new THREE.BoxGeometry(topD * 1.55, abacusH, topD * 1.12);

    var plinthT = [], curveT = [], shaftT = [], bandT = [], eggT = [], dartT = [], voluteT = [], voluteInnerT = [], voluteEyeT = [], abacusT = [];
    for (i = 0; i < positions.length; i++) {
      var cx = positions[i][0], cz = positions[i][1];
      plinthT.push({ p: [cx, y + plinthH / 2, cz] });
      curveT.push({ p: [cx, y + plinthH, cz] });
      shaftT.push({ p: [cx, y + baseH + shaftH / 2, cz] });
      var capY = y + baseH + shaftH;
      bandT.push({ p: [cx, capY + bandH / 2, cz] });
      for (var k = 0; k < eggCount; k++) {
        var ang = (k + 0.5) / eggCount * PI * 2;
        var off = rotXZ(cos(ang) * eggR, sin(ang) * eggR, rotY);
        eggT.push({ p: [cx + off[0], capY + bandH / 2, cz + off[1]], s: [1, 0.72, 1] });
        var dang = ang + PI / eggCount;
        var doff = rotXZ(cos(dang) * eggR, sin(dang) * eggR, rotY);
        dartT.push({ p: [cx + doff[0], capY + bandH * 0.55, cz + doff[1]], r: [PI, atan2(doff[0], doff[1]) + rotY, 0] });
      }
      var vOff1 = rotXZ(topD * 0.58, 0, rotY);
      var vOff2 = rotXZ(-topD * 0.58, 0, rotY);
      voluteT.push({ p: [cx + vOff1[0], capY + bandH + capH * 0.5, cz + vOff1[1]], r: [PI / 2, rotY, 0] });
      voluteT.push({ p: [cx + vOff2[0], capY + bandH + capH * 0.5, cz + vOff2[1]], r: [PI / 2, rotY, 0] });
      voluteInnerT.push({ p: [cx + vOff1[0], capY + bandH + capH * 0.5, cz + vOff1[1]], r: [PI / 2, rotY, 0] });
      voluteInnerT.push({ p: [cx + vOff2[0], capY + bandH + capH * 0.5, cz + vOff2[1]], r: [PI / 2, rotY, 0] });
      voluteEyeT.push({ p: [cx + vOff1[0], capY + bandH + capH * 0.5, cz + vOff1[1]] });
      voluteEyeT.push({ p: [cx + vOff2[0], capY + bandH + capH * 0.5, cz + vOff2[1]] });
      abacusT.push({ p: [cx, capY + bandH + capH + abacusH / 2, cz], r: [0, rotY, 0] });
    }
    group.add(H.instance(plinthGeo, mats.marbleWorn, plinthT));
    group.add(H.instance(baseCurveGeo, mats.marbleWorn, curveT));
    group.add(H.instance(shaftGeo, mats.marbleWorn, shaftT));
    group.add(H.instance(bandGeo, mats.marbleShadowed, bandT));
    group.add(H.instance(eggGeo, mats.marble, eggT));
    group.add(H.instance(dartGeo, mats.marbleShadowed, dartT));
    group.add(H.instance(voluteGeo, mats.marbleWorn, voluteT));
    group.add(H.instance(voluteInnerGeo, mats.marbleShadowed, voluteInnerT));
    group.add(H.instance(voluteEyeGeo, mats.marbleWorn, voluteEyeT));
    group.add(H.instance(abacusGeo, mats.marbleWorn, abacusT));
    return group;
  };

  // =====================================================================
  // CREPIDOMA: stepped base, top face at y=0, growing downward. The
  // topmost (smallest) step optionally takes the classical stylobate
  // curvature — a shallow upward bow along its long (d) axis.
  // =====================================================================
  H.makeSteppedBase = function (w, d, steps, stepH, inset, opts) {
    inset = inset !== undefined ? inset : 0.7;
    opts = opts || {};
    var curvature = opts.curvature !== undefined ? opts.curvature : (d >= 15 || w >= 15);
    var group = new THREE.Group();
    for (var i = 0; i < steps; i++) {
      var sw = w + 2 * inset * i, sd = d + 2 * inset * i;
      var geo;
      if (curvature && i === 0) {
        var longAxisIsD = sd >= sw;
        var segs = MOBILE ? 10 : 18;
        geo = longAxisIsD
          ? new THREE.BoxGeometry(sw, stepH, sd, 1, 1, segs)
          : new THREE.BoxGeometry(sw, stepH, sd, segs, 1, 1);
        var amp = Math.min(0.12, Math.max(sw, sd) * 0.0016);
        var pa = geo.getAttribute('position'), parr = pa.array;
        var axisLen = longAxisIsD ? sd : sw;
        for (var k = 0; k < parr.length; k += 3) {
          var coord = longAxisIsD ? parr[k + 2] : parr[k];
          var t = coord / (axisLen / 2);
          parr[k + 1] += amp * (1 - t * t);
        }
        pa.needsUpdate = true;
        geo.computeVertexNormals();
      } else {
        geo = new THREE.BoxGeometry(sw, stepH, sd);
      }
      addMesh(group, geo, mats.marble, [0, -stepH * (i + 0.5), 0]);
      // Rain-washed tread cap: the flat, foot-trodden ledge of every riser
      // step (not the curved stylobate) weathers darker/rougher than the
      // vertical riser face beneath it — a thin marbleWorn skin at the tread
      // reads as a believable weathering ring in wide shots at negligible cost.
      if (i > 0) {
        var capGeo = new THREE.BoxGeometry(sw, stepH * 0.06, sd);
        addMesh(group, capGeo, mats.marbleWorn, [0, -stepH * i + stepH * 0.03, 0]);
      }
    }
    return group;
  };

  // =====================================================================
  // ENTABLATURE: Doric (taenia+regulae+guttae, triglyphs/metopes, mutules,
  // sima + lion-head spouts) or Ionic (three-fascia architrave, plain
  // frieze, egg-and-dart cornice band) via opts.order.
  // =====================================================================
  H.makeEntablature = function (w, d, h, o) {
    o = o || {};
    var order = o.order || 'doric';
    var isIonic = order === 'ionic';
    var triglyphs = o.triglyphs !== undefined ? o.triglyphs : !isIonic;
    var triglyphCount = o.triglyphCount !== undefined ? o.triglyphCount : 8;
    var zCount = o.zCount !== undefined ? o.zCount : Math.max(1, Math.round(triglyphCount * d / w));
    var cornice = o.cornice !== undefined ? o.cornice : true;
    var guttae = o.guttae !== undefined ? o.guttae : triglyphs;
    var sima = o.sima !== undefined ? o.sima : true;
    var lionSpouts = o.lionSpouts !== undefined ? o.lionSpouts : triglyphs;
    var metopeMaker = typeof o.metopeMaker === 'function' ? o.metopeMaker : null;
    var group = new THREE.Group();
    var rnd = seedRand(Math.round(w * 131 + d * 17 + h * 977) + 7);

    var archH = h * (isIonic ? 0.40 : 0.38);
    var friezeH = h * (isIonic ? 0.30 : 0.34);
    var corniceH = h * (isIonic ? 0.30 : 0.28);
    var archThickness = Math.max(0.9, Math.min(w, d) * 0.045);

    function ring(h0, hgt, thick, mat) {
      var geos = [
        new THREE.BoxGeometry(w, hgt, thick), new THREE.BoxGeometry(w, hgt, thick),
        new THREE.BoxGeometry(thick, hgt, d), new THREE.BoxGeometry(thick, hgt, d)
      ];
      var wHalf = w / 2 - thick / 2, dHalf = d / 2 - thick / 2;
      var poses = [[0, h0 + hgt / 2, dHalf], [0, h0 + hgt / 2, -dHalf], [wHalf, h0 + hgt / 2, 0], [-wHalf, h0 + hgt / 2, 0]];
      for (var k = 0; k < 4; k++) addMesh(group, geos[k], mat, poses[k]);
    }

    // ---- Architrave ------------------------------------------------
    if (isIonic) {
      var bands = 3, bh = archH / bands;
      for (var b = 0; b < bands; b++) {
        var over = archThickness * (1 + b * 0.10);
        ring(bh * b, bh * 0.94, over, mats.marble);
      }
    } else {
      ring(0, archH, archThickness, mats.marble);
      // Taenia: raised fillet along the top edge of the architrave.
      var taeniaH = archH * 0.09;
      ring(archH - taeniaH, taeniaH, archThickness + 0.05, mats.marbleWorn);
    }

    // ---- Frieze ------------------------------------------------------
    var xStep = w / (triglyphCount + 1), zStep = d / (zCount + 1);
    var trigTransforms = [], reguT = [], guttaT = [], mutuleT = [], mutGuttaT = [];
    var trigW = isIonic ? 0 : 0.85;
    if (triglyphs) {
      // Real geometric grooves, not painted-on strips: a recessed base plate
      // plus three proud vertical ridges (two true channels between them,
      // the base's own edges reading as the classical half-glyphs) gives an
      // actual ~3-4 cm normal-facing step that catches real shadow under the
      // scene's sun light, instead of a flat co-planar colour difference.
      var grooveDepth = Math.max(0.022, trigW * 0.045);
      var trigGeo = new THREE.BoxGeometry(trigW, friezeH, 0.12 - grooveDepth);
      var ridgeW = trigW * 0.2;
      var ridgeGeo = new THREE.BoxGeometry(ridgeW, friezeH * 0.97, 0.10);
      for (var i = 1; i <= triglyphCount; i++) {
        trigTransforms.push({ p: [-(w / 2) + xStep * i, archH + friezeH / 2, d / 2 + 0.06], r: [0, 0, 0] });
        trigTransforms.push({ p: [-(w / 2) + xStep * i, archH + friezeH / 2, -d / 2 - 0.06], r: [0, PI, 0] });
      }
      for (var i2 = 1; i2 <= zCount; i2++) {
        trigTransforms.push({ p: [w / 2 + 0.06, archH + friezeH / 2, -(d / 2) + zStep * i2], r: [0, PI / 2, 0] });
        trigTransforms.push({ p: [-w / 2 - 0.06, archH + friezeH / 2, -(d / 2) + zStep * i2], r: [0, -PI / 2, 0] });
      }
      // Split triglyphs between clean and rain-streaked marble so the frieze
      // reads as patchily weathered rather than one uniform flat colour.
      var trigT = [], trigWornT = [], ridgeT = [], ridgeWornT = [];
      for (var t = 0; t < trigTransforms.length; t++) {
        var tt = trigTransforms[t];
        var worn = rnd() < 0.3;
        // Outward normal for this face (see H.makeEntablature's mutule/gutta
        // math below for the same convention): nx=sin(ry), nz=cos(ry).
        var nx = sin(tt.r[1]), nz = cos(tt.r[1]);
        var basePos = [tt.p[0] - nx * grooveDepth * 0.5, tt.p[1], tt.p[2] - nz * grooveDepth * 0.5];
        (worn ? trigWornT : trigT).push({ p: basePos, r: tt.r });
        // Tangent (local width axis) for the ridge offsets.
        var ca = cos(tt.r[1]), sa = sin(tt.r[1]);
        var tx = ca, tz = -sa;
        var ridgeList = worn ? ridgeWornT : ridgeT;
        for (var rIdx = -1; rIdx <= 1; rIdx++) {
          var off = rIdx * ridgeW * 1.35;
          ridgeList.push({
            p: [tt.p[0] + tx * off + nx * grooveDepth * 0.5, tt.p[1], tt.p[2] + tz * off + nz * grooveDepth * 0.5],
            r: tt.r
          });
        }
      }
      group.add(H.instance(trigGeo, mats.marble, trigT));
      if (trigWornT.length) group.add(H.instance(trigGeo, mats.marbleWorn, trigWornT));
      group.add(H.instance(ridgeGeo, mats.marble, ridgeT));
      if (ridgeWornT.length) group.add(H.instance(ridgeGeo, mats.marbleWorn, ridgeWornT));

      // Regulae + guttae under the taenia, aligned above each triglyph —
      // sized up ~40% over the previous pass so they read as distinct
      // hanging studs rather than a faint speckle at normal view distance.
      if (guttae && !isIonic) {
        var reguGeo = new THREE.BoxGeometry(trigW * 0.94, archH * 0.075, 0.13);
        var guttaGeo = new THREE.CylinderGeometry(0.034, 0.06, 0.10, 4);
        for (var t2 = 0; t2 < trigTransforms.length; t2++) {
          var g = trigTransforms[t2];
          var facing = [sin(g.r[1]) * 0.14, -cos(g.r[1]) * 0.14];
          reguT.push({ p: [g.p[0] - facing[0], archH - archH * 0.032, g.p[2] - facing[1]], r: g.r });
          // A single row of 3 (not 2 rows of 3): still reads as a hanging
          // stud row at normal viewing distance, at half the instance cost.
          for (var gx = -1; gx <= 1; gx++) {
            guttaT.push({ p: [g.p[0] - facing[0] + gx * trigW * 0.28, archH - archH * 0.09, g.p[2] - facing[1]], r: [PI, 0, 0] });
          }
        }
        group.add(H.instance(reguGeo, mats.marble, reguT));
        group.add(H.instance(guttaGeo, mats.marbleShadowed, guttaT));
      }
    } else if (isIonic) {
      // Continuous plain frieze band (Ionic friezes are often carved
      // continuously; keep it a clean recessed band here).
      ring(archH, friezeH, archThickness - 0.06, mats.marbleShadowed);
    }

    // Metopes: place a relief/plate in every bay between triglyphs (front/back
    // long faces and both short ends), using the caller-supplied maker so this
    // shared helper never hardcodes any one building's iconography.
    if (triglyphs && metopeMaker) {
      var idx = 0;
      // metopeMaker's own mesh (another stream's module) already carries
      // whatever carved-figure detail it wants per plate — placing a second,
      // independent instanced figure rig on top of every bay here was pure
      // duplicate geometry (the plate's own relief already reads as carved
      // sculpture), so this just seats the caller's mesh in each bay.
      var relH = friezeH * 0.86;
      function metopeRow(count, step, axisIsX, sign) {
        var ry = axisIsX ? (sign > 0 ? 0 : PI) : (sign > 0 ? PI / 2 : -PI / 2);
        for (var n = 0; n < count + 1; n++) {
          var c = -((axisIsX ? w : d) / 2) + step * (n + 0.5);
          var mw = Math.min(step * 0.82, 1.4);
          var mesh = metopeMaker(idx++, mw, relH);
          if (!mesh) continue;
          var baseX = axisIsX ? c : sign * (w / 2 + 0.03);
          var baseZ = axisIsX ? sign * (d / 2 + 0.03) : c;
          mesh.position.set(baseX, archH + friezeH / 2, baseZ);
          mesh.rotation.y = ry;
          group.add(mesh);
        }
      }
      metopeRow(triglyphCount, xStep, true, 1);
      metopeRow(triglyphCount, xStep, true, -1);
      metopeRow(zCount, zStep, false, 1);
      metopeRow(zCount, zStep, false, -1);
    }

    // ---- Cornice -------------------------------------------------------
    if (cornice) {
      var cornOvhg = 0.45;
      // Rain-washed corona: this is the most weather-exposed horizontal
      // surface on the whole order, so it takes the "worn" variant rather
      // than pristine marble.
      ring(archH + friezeH, corniceH, archThickness + 2 * cornOvhg, mats.marbleWorn);
      // Drip-edge throat: a thin shadowed groove along the underside outer
      // lip of the corona (the classical cyma reversa drip channel), which
      // both reads as authentic detailing and gives the cornice a hard
      // shadow line instead of a flat slab silhouette.
      var dripT = archThickness + 2 * cornOvhg - 0.08;
      ring(archH + friezeH + corniceH * 0.06, corniceH * 0.05, dripT, mats.marbleShadowed);

      if (isIonic) {
        // Egg-and-dart band under the cornice soffit.
        var eodGeo = new THREE.CylinderGeometry(1, 1, corniceH * 0.16, 8, 1, true);
        var eodT = [];
        var perim = 2 * (w + d), eodCount = Math.max(8, Math.round(perim / (MOBILE ? 1.4 : 0.9)));
        for (var e = 0; e < eodCount; e++) {
          var tpar = e / eodCount, px2, pz2, ry;
          if (tpar < 0.25) { px2 = -w / 2 + (tpar / 0.25) * w; pz2 = d / 2 + cornOvhg * 0.5; ry = 0; }
          else if (tpar < 0.5) { px2 = w / 2 + cornOvhg * 0.5; pz2 = d / 2 - ((tpar - 0.25) / 0.25) * d; ry = PI / 2; }
          else if (tpar < 0.75) { px2 = w / 2 - ((tpar - 0.5) / 0.25) * w; pz2 = -d / 2 - cornOvhg * 0.5; ry = PI; }
          else { px2 = -w / 2 - cornOvhg * 0.5; pz2 = -d / 2 + ((tpar - 0.75) / 0.25) * d; ry = -PI / 2; }
          eodT.push({ p: [px2, archH + friezeH + corniceH * 0.1, pz2], r: [PI / 2, ry, 0], s: [0.12, 1, 0.12] });
        }
        group.add(H.instance(eodGeo, mats.marbleWorn, eodT));
      } else {
        // Mutules + guttae on the soffit, one set per triglyph position.
        var mutGeo = new THREE.BoxGeometry(1.05, corniceH * 0.12, 0.62);
        var mGuttaGeo = new THREE.CylinderGeometry(0.032, 0.054, 0.09, 4);
        for (var t3 = 0; t3 < trigTransforms.length; t3++) {
          var g2 = trigTransforms[t3];
          var facing2 = [sin(g2.r[1]) * (0.62 / 2 + 0.02), -cos(g2.r[1]) * (0.62 / 2 + 0.02)];
          var soffitY = archH + friezeH + corniceH * 0.55;
          mutuleT.push({ p: [g2.p[0] + facing2[0], soffitY, g2.p[2] + facing2[1]], r: [0, g2.r[1], 0] });
          // A 3x2 grid (6 guttae, not the old 2x2 corner-only 4): the art
          // director flagged the soffit as reading visibly sparse next to a
          // real mutule's 3x3=9 drops. 6 is the cheapest step up that still
          // reads as a full row rather than just corner studs, at 1.5x the
          // old instance cost (still a single low-poly cone-cylinder each).
          for (var mgxi = -1; mgxi <= 1; mgxi++) for (var mgz = -1; mgz <= 1; mgz += 2) {
            var lo = rotXZ(mgxi * 0.32, mgz * 0.18, g2.r[1]);
            mutGuttaT.push({ p: [g2.p[0] + facing2[0] + lo[0], soffitY - 0.05, g2.p[2] + facing2[1] + lo[1]], r: [PI, 0, 0] });
          }
        }
        group.add(H.instance(mutGeo, mats.marble, mutuleT));
        group.add(H.instance(mGuttaGeo, mats.marbleShadowed, mutGuttaT));
      }

      // Sima along the flank eaves, with lion-head spouts (Doric).
      if (sima) {
        var simaH = corniceH * 0.35;
        ring(archH + friezeH + corniceH, simaH, archThickness + 2 * cornOvhg - 0.1, mats.marbleWorn);
        if (lionSpouts) {
          var headGeo = new THREE.SphereGeometry(0.16, 8, 6);
          var snoutGeo = new THREE.ConeGeometry(0.09, 0.16, 6);
          var streakH = corniceH + friezeH * 0.7;
          var streakGeo = new THREE.PlaneGeometry(0.14, streakH);
          var spacing = o.lionSpacing || Math.max(2.2, d / 10);
          var count = Math.max(2, Math.floor(d / spacing));
          var headT = [], snoutT = [], streakT = [];
          for (var li = 0; li < count; li++) {
            var lz = -d / 2 + (li + 0.5) * (d / count);
            var ly = archH + friezeH + corniceH + simaH * 0.4;
            headT.push({ p: [w / 2 + cornOvhg, ly, lz], s: [1, 0.8, 0.8] });
            headT.push({ p: [-w / 2 - cornOvhg, ly, lz], s: [1, 0.8, 0.8] });
            snoutT.push({ p: [w / 2 + cornOvhg + 0.18, ly, lz], r: [0, 0, -PI / 2] });
            snoutT.push({ p: [-w / 2 - cornOvhg - 0.18, ly, lz], r: [0, 0, PI / 2] });
            // Centuries of rain runoff below every spout leave a dark
            // iron/algae streak down the cornice and frieze face beneath it.
            var streakY = archH + friezeH + corniceH - streakH / 2;
            streakT.push({ p: [w / 2 + 0.015, streakY, lz], r: [0, PI / 2, 0] });
            streakT.push({ p: [-(w / 2 + 0.015), streakY, lz], r: [0, -PI / 2, 0] });
          }
          group.add(H.instance(headGeo, mats.marbleShadowed, headT));
          group.add(H.instance(snoutGeo, mats.marbleShadowed, snoutT));
          group.add(H.instance(streakGeo, mats.marbleShadowed, streakT));
        }
      }
    }

    return group;
  };

  // =====================================================================
  // PEDIMENT: recessed tympanum behind the raking cornice, a horizontal
  // geison at the base, sima along the rake, and sculpture figures whose
  // pose flattens toward the corners.
  // =====================================================================
  H.makePediment = function (w, d, h, o) {
    o = o || {};
    var figures = o.figures !== undefined ? o.figures : 9;
    var recess = o.recess !== undefined ? o.recess : Math.max(0.12, d * 0.12);
    var group = new THREE.Group();

    // Horizontal geison at the base of the pediment — a heavily rain-washed
    // exposed ledge, so it takes the worn variant.
    var geisonH = Math.max(0.12, h * 0.05);
    addMesh(group, new THREE.BoxGeometry(w + 0.5, geisonH, d + 0.35), mats.marbleWorn, [0, geisonH / 2, 0]);

    // Tympanum, recessed behind the raking cornice plane.
    var shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(-w / 2, 0);
    var tympGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    // Shallow carved relief on the front face: broad noise roughness plus a
    // few narrow periodic recession lines suggesting panel/figure-niche
    // divisions, so the tympanum reads as worked stone instead of a flat
    // monochrome triangle even where it stands in as a figure placeholder.
    var pedSeed = Math.round(w * 53 + h * 911 + d * 17) + 13;
    var tPos = tympGeo.getAttribute('position'), tArr = tPos.array;
    for (var ti = 0; ti < tArr.length; ti += 3) {
      if (tArr[ti + 2] > d - 0.001) {
        var tx = tArr[ti], ty = tArr[ti + 1];
        var rough = 0.028 * H.noise2(tx * 0.6, ty * 0.6, pedSeed);
        var panel = 0.018 * Math.pow(Math.max(0, Math.sin(tx * (5 / Math.max(w, 1)) * PI)), 8);
        tArr[ti + 2] += rough - panel;
      }
    }
    tPos.needsUpdate = true;
    tympGeo.computeVertexNormals();
    tympGeo.translate(0, geisonH, -d / 2 - recess);
    addMesh(group, tympGeo, mats.marbleShadowed, [0, 0, 0]);

    // Darker perimeter frame where the tympanum meets the raking cornice /
    // geison: a thin picture-frame border sitting just proud of the recess
    // plane, which reads as a hard shadow line and sharpens the perceived
    // depth of the recess from a distance.
    var frameMargin = Math.min(0.4, Math.max(w, d) * 0.02);
    var outerShape = new THREE.Shape();
    outerShape.moveTo(-w / 2 - 0.1, 0);
    outerShape.lineTo(w / 2 + 0.1, 0);
    outerShape.lineTo(0, h + 0.08);
    outerShape.lineTo(-w / 2 - 0.1, 0);
    var innerPath = new THREE.Path();
    innerPath.moveTo(-w / 2 + frameMargin, frameMargin * 0.6);
    innerPath.lineTo(w / 2 - frameMargin, frameMargin * 0.6);
    innerPath.lineTo(0, h - frameMargin);
    innerPath.lineTo(-w / 2 + frameMargin, frameMargin * 0.6);
    outerShape.holes.push(innerPath);
    var frameGeo = new THREE.ExtrudeGeometry(outerShape, { depth: 0.05, bevelEnabled: false });
    frameGeo.translate(0, geisonH, -d / 2 - recess + 0.04);
    addMesh(group, frameGeo, mats.marbleShadowed, [0, 0, 0]);

    // Raking cornice (both slopes) with a thin sima ridge on top.
    var slopeLen = sqrt((w / 2) * (w / 2) + h * h) + 0.4;
    var angle = atan2(h, w / 2);
    var rakingGeo = new THREE.BoxGeometry(slopeLen, 0.4, d + 0.6);
    var simaGeo = new THREE.BoxGeometry(slopeLen, 0.14, d + 0.7);
    var rakingPos = [[w / 4, geisonH + h / 2, 0], [-w / 4, geisonH + h / 2, 0]];
    var rakingRot = [[0, 0, -angle], [0, 0, angle]];
    for (var i = 0; i < 2; i++) {
      // The raking cornice is exposed on its top face along the whole roofline
      // — worn, like the horizontal corona — while the recessed tympanum
      // behind stays comparatively sheltered and darker.
      addMesh(group, rakingGeo.clone(), mats.marbleWorn, rakingPos[i], rakingRot[i]);
      addMesh(group, simaGeo.clone(), mats.marbleWorn, [rakingPos[i][0], rakingPos[i][1] + 0.27, rakingPos[i][2]], rakingRot[i]);
    }

    // Figures: taller/standing near the apex, kneeling mid-slope, reclining
    // toward the low corners — matches the shrinking triangular field.
    for (var f = 0; f < figures; f++) {
      var xi = figures > 1 ? f / (figures - 1) : 0.5;
      var fx = -w * 0.42 + xi * w * 0.84;
      var edge = abs(xi - 0.5) * 2; // 0 centre .. 1 corner
      var fh = Math.max(0.55, 0.85 * h * (1 - abs(fx) / (w / 2)));
      var pose = edge > 0.72 ? 'recline' : (edge > 0.38 ? 'kneel' : 'stand');
      var fig = H.makeFigure(fh, { pose: pose });
      fig.position.set(fx, geisonH + fh * (pose === 'recline' ? 0.25 : 0.5), d / 2 + 0.2 - recess * 0.3);
      group.add(fig);
    }

    return group;
  };

  // =====================================================================
  // ROOF: Laconian pan-and-cover marble tiling (long strips, not per-tile
  // bricks — far cheaper and reads correctly from a distance), antefixes
  // at the eaves, ridge palmettes, and floral acroteria.
  // =====================================================================
  H.makeGableRoof = function (w, d, pitch, o) {
    o = o || {};
    var tiles = o.tiles !== undefined ? o.tiles : true;
    var acroteria = o.acroteria !== undefined ? o.acroteria : false;
    var group = new THREE.Group();
    var ridgeH = (w / 2) * pitch;
    var angle = atan2(pitch, 1);
    // Real ancient roofs project the tile courses well past the cornice
    // face for drainage — the previous pass had the eave landing almost
    // exactly on the entablature edge (near-zero overhang, visible as a flat
    // roofline flush with the colonnade below in parthenon/erechtheion
    // shots). Extend the SAME slope past the original eave point by a
    // horizontal `ovhg`, computed from this call's own w so every building
    // gets a proportional overhang without callers needing to change their
    // w argument. The ridge position/pitch are untouched (only the eave end
    // of each slab moves outward and slightly down along the unchanged
    // slope line), so this cannot reopen the old tile-overshoot bug: tile/
    // cover rows below are still sized as a strict fraction of the (now
    // longer) slab length, never derived independently.
    var ovhg = Math.max(0.4, Math.min(1.0, w * 0.02));
    var slopeLenBase = sqrt((w / 2) * (w / 2) + ridgeH * ridgeH);
    var ovhgSlope = ovhg / cos(angle);
    var slopeLen = slopeLenBase + ovhgSlope;
    var halfLen = slopeLen / 2;
    var eaveHalfW = w / 2 + ovhg;   // extended eave line, x = ±eaveHalfW
    var eaveY = -ovhg * pitch;      // eave tip droops slightly below y=0

    // Two roof slabs (structural underlayment beneath the tile courses),
    // pinned at the ridge (0, ridgeH) and running the full extended length
    // to the new eave point (±eaveHalfW, eaveY) along the same slope angle.
    var slab = [new THREE.BoxGeometry(slopeLen, 0.2, d), new THREE.BoxGeometry(slopeLen, 0.2, d)];
    var slabPos = [
      [halfLen * cos(angle), ridgeH - halfLen * sin(angle), 0],
      [-halfLen * cos(angle), ridgeH - halfLen * sin(angle), 0]
    ];
    var slabRot = [[0, 0, -angle], [0, 0, angle]];
    for (var i = 0; i < 2; i++) {
      var slabMesh = addMesh(group, slab[i], mats.terracotta, slabPos[i], slabRot[i]);
      slabMesh.castShadow = false; // thin edge-on pair meeting at the ridge — same shadow-acne risk as the tiles above them
    }

    // A stylised palmette (fan of tapering lobes, shallow-extruded so its own
    // bevel already reads as carved relief) shared by the ridge finials,
    // acroteria and antefixes below — replaces the old plain cone/box forms.
    // Built once per roof at a nominal unit size; every use scales it via
    // the instance transform's `s`, and two copies crossed 90 deg apart give
    // a readable silhouette from any orbit angle instead of only face-on.
    function palmetteShape(lobeCount) {
      var shp = new THREE.Shape();
      var lobes = lobeCount || 5;
      var tip = [];
      for (var li = 0; li <= lobes; li++) {
        var t = li / lobes;
        var ang2 = (t - 0.5) * 1.7;
        var lenFrac = 0.5 + 0.5 * (1 - abs(t - 0.5) * 2);
        tip.push([sin(ang2) * 0.5 * lenFrac, cos(ang2) * lenFrac]);
      }
      shp.moveTo(-0.055, 0);
      shp.lineTo(tip[0][0] * 0.3, tip[0][1] * 0.15);
      for (var pi = 0; pi < tip.length; pi++) {
        shp.lineTo(tip[pi][0], tip[pi][1]);
        if (pi < tip.length - 1) {
          var vx = (tip[pi][0] + tip[pi + 1][0]) * 0.5 * 0.32;
          var vy = Math.min(tip[pi][1], tip[pi + 1][1]) * 0.38;
          shp.lineTo(vx, vy);
        }
      }
      shp.lineTo(tip[tip.length - 1][0] * 0.3, tip[tip.length - 1][1] * 0.15);
      shp.lineTo(0.055, 0);
      shp.lineTo(-0.055, 0);
      return shp;
    }
    // Two tiers: a nicer beveled palmette for the sparse, larger ridge
    // finials and acroteria, and a much cheaper flat, fewer-lobed one for
    // antefixes — there can be well over a hundred of those along a single
    // building's eaves, so per-instance triangle cost there matters far more
    // than surface polish (InstancedMesh keeps draw calls low regardless,
    // but a software rasterizer still pays per triangle).
    var palmetteGeo = new THREE.ExtrudeGeometry(palmetteShape(5), {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.011, bevelSegments: 1, steps: 1
    });
    palmetteGeo.translate(0, 0, -0.025);
    var palmetteGeoSmall = new THREE.ExtrudeGeometry(palmetteShape(3), { depth: 0.035, bevelEnabled: false, steps: 1 });
    palmetteGeoSmall.translate(0, 0, -0.0175);

    var panT = [], coverT = [], antefixT = [], antefixCapT = [];
    var rndRoof = seedRand(Math.round(w * 331 + d * 71 + pitch * 9007) + 3);
    if (tiles) {
      // Pan tiles run the full ridge-to-eave slope in one board per row (a
      // "row" = one course laid side-by-side along the eave/depth axis),
      // reusing the SAME position+rotation reference as the underlying slab
      // (slabPos/slabRot above) and only ever shrinking that footprint —
      // never re-deriving it from scratch — so a tile can never stick out
      // past the ridge or the eave/gable ends the way an independently
      // computed along-slope offset previously could.
      var rowW = MOBILE ? 0.62 : 0.5;
      var rows = Math.max(2, Math.round(d / rowW));
      rowW = d / rows;
      var jointGap = rowW * 0.08;
      var panGeo = new THREE.BoxGeometry(1, 1, 1); // unit box; sized per-instance via `s`
      // Half-cylinder cap, unit length along local X (its own long axis),
      // reused for both the seam covers and — scaled — the eave antefixes.
      var coverGeo = new THREE.CylinderGeometry(1, 1, 1, MOBILE ? 6 : 8, 1, true, 0, PI);
      coverGeo.rotateZ(PI / 2);
      var antefixGeo = new THREE.BoxGeometry(0.05, 0.3, 1); // thin plaque; long axis (eave-parallel) sized via `s.z`
      for (var side = 0; side < 2; side++) {
        var sx = side === 0 ? 1 : -1;
        var baseX = slabPos[side][0], baseY = slabPos[side][1], rotZ = slabRot[side][2];
        // World offset for a small lift `t` along the slab's own local +Y
        // (its face normal), so tiles sit just above the slab surface
        // instead of z-fighting with it, however the slope is rotated.
        var liftDir = [-sin(rotZ), cos(rotZ)];
        for (var rIdx = 0; rIdx < rows; rIdx++) {
          var z = -d / 2 + (rIdx + 0.5) * rowW;
          var lenFrac = 0.965 + rndRoof() * 0.03; // always < 1: strictly inside the slab's own length
          var lift = 0.03 + rndRoof() * 0.015;
          panT.push({
            p: [baseX + liftDir[0] * lift, baseY + liftDir[1] * lift, z], r: [0, 0, rotZ],
            s: [slopeLen * lenFrac, 0.05, rowW - jointGap]
          });
        }
        // Cover caps over the interior seams only (never the gable-end
        // seams), each also sized as a strict fraction of the slope length —
        // same guarantee against overshoot as the pan tiles above. Lifted a
        // little higher than the pan tiles so it sits proud of them.
        var clift = 0.075;
        for (var seam = 1; seam < rows; seam++) {
          var sz = -d / 2 + seam * rowW;
          coverT.push({
            p: [baseX + liftDir[0] * clift, baseY + liftDir[1] * clift, sz], r: [0, 0, rotZ],
            s: [slopeLen * 0.97, rowW * 0.16, rowW * 0.16]
          });
        }
        // Antefixes along the true (now overhanging) eave line, one per row,
        // spread along the full depth — the eave itself, not the rake.
        for (var ai = 0; ai < rows; ai += (MOBILE ? 2 : 1)) {
          var az = -d / 2 + (ai + 0.5) * rowW;
          var ry = side === 0 ? 0 : PI;
          antefixT.push({ p: [sx * (eaveHalfW + 0.02), eaveY + 0.15, az], r: [0, ry, 0], s: [1, 1, rowW * 0.6] });
          antefixCapT.push({ p: [sx * (eaveHalfW + 0.05), eaveY + 0.15, az], r: [0, ry + PI / 2, 0], s: [0.3, 0.28, 0.3] });
        }
      }
      // Roof tiles skip shadow-casting: this many small, thin, tightly
      // overlapping instanced boxes/half-cylinders at a shallow (late-
      // afternoon) sun angle blow up into long false shadow-map streaks
      // under this software renderer (confirmed by A/B: identical scene
      // with castShadow left on these two meshes reproduces long spurious
      // spikes radiating off the eaves into open space; turning it off on
      // just these two removes them with no visible loss — the tiles still
      // receive shadow and show their own lit/shaded bumps from normals).
      var panMesh = H.instance(panGeo, mats.terracotta, panT);
      panMesh.castShadow = false;
      group.add(panMesh);
      var coverMesh = H.instance(coverGeo, mats.terracotta, coverT);
      coverMesh.castShadow = false;
      group.add(coverMesh);
      // Same shadow-acne risk applies to the antefix plaques and their small
      // palmette caps — thin, numerous and packed along the eave line.
      var antefixMesh = H.instance(antefixGeo, mats.terracotta, antefixT);
      antefixMesh.castShadow = false;
      group.add(antefixMesh);
      var antefixCapMesh = H.instance(palmetteGeoSmall, mats.terracotta, antefixCapT);
      antefixCapMesh.castShadow = false;
      group.add(antefixCapMesh);
    }

    // Ridge cap with palmette finials along its length (front/back-facing;
    // these are always seen roughly along the ridge line in practice, so a
    // single oriented copy per position keeps the instance count down).
    var ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, d), mats.terracotta);
    ridgeCap.position.y = ridgeH; ridgeCap.castShadow = false; ridgeCap.receiveShadow = true;
    group.add(ridgeCap);
    var palCount = Math.max(2, Math.round(d / (MOBILE ? 6 : 3.2)));
    var palT = [];
    for (var p = 0; p < palCount; p++) {
      var pz = -d / 2 + (p + 0.5) * (d / palCount);
      palT.push({ p: [0, ridgeH + 0.16, pz], r: [0, 0, 0], s: [0.55, 0.75, 0.55] });
    }
    var ridgePalMesh = H.instance(palmetteGeo, mats.terracotta, palT);
    ridgePalMesh.castShadow = false; // thin extruded plaque — same shadow-acne risk as the roof tiles
    group.add(ridgePalMesh);

    // Acroteria: taller floral finials at the apex and the two eave corners.
    if (acroteria) {
      var acroBaseGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.16, 8);
      var acroPos = [[0, ridgeH, d / 2], [0, ridgeH, -d / 2], [eaveHalfW, eaveY, d / 2], [-eaveHalfW, eaveY, d / 2], [eaveHalfW, eaveY, -d / 2], [-eaveHalfW, eaveY, -d / 2]];
      var acroT = [], acroBaseT = [];
      for (var a = 0; a < acroPos.length; a++) {
        var apY = acroPos[a][1] + 0.14;
        acroT.push({ p: [acroPos[a][0], apY, acroPos[a][2]], r: [0, 0, 0], s: [1.05, 1.3, 1.05] });
        acroT.push({ p: [acroPos[a][0], apY, acroPos[a][2]], r: [0, PI / 2, 0], s: [1.05, 1.3, 1.05] });
        acroBaseT.push({ p: [acroPos[a][0], acroPos[a][1] + 0.08, acroPos[a][2]] });
      }
      var acroMesh = H.instance(palmetteGeo, mats.marble, acroT);
      acroMesh.castShadow = false; // only 12 instances, but same thin-plaque risk — kept off for consistency
      group.add(acroMesh);
      group.add(H.instance(acroBaseGeo, mats.marble, acroBaseT));
    }

    return group;
  };

  // Figure (default implementation; 13-figures.js wraps this with poses).
  H.makeFigure = function (height) {
    height = height !== undefined ? height : 1.8;
    var group = new THREE.Group();
    var legR = 0.07 * height, legLen = 0.45 * height;
    var legGeo = new THREE.CylinderGeometry(legR, legR, legLen, 8);
    group.add(H.instance(legGeo, mats.marble, [
      { p: [0.06 * height, legLen / 2, 0] },
      { p: [-0.06 * height, legLen / 2, 0] }
    ]));

    var torsoGeo = new THREE.CylinderGeometry(0.11 * height, 0.13 * height, 0.35 * height, 10);
    addMesh(group, torsoGeo, mats.marble, [0, 0.625 * height, 0]);

    var armR = 0.04 * height, armLen = 0.3 * height;
    var armGeo = new THREE.CylinderGeometry(armR, armR, armLen, 8);
    group.add(H.instance(armGeo, mats.marble, [
      { p: [0.16 * height, 0.62 * height, 0], r: [0, 0, -0.25] },
      { p: [-0.16 * height, 0.62 * height, 0], r: [0, 0, 0.25] }
    ]));

    var neckGeo = new THREE.CylinderGeometry(0.03 * height, 0.03 * height, 0.06 * height, 8);
    addMesh(group, neckGeo, mats.marble, [0, 0.81 * height, 0]);

    var headGeo = new THREE.SphereGeometry(0.08 * height, 12, 8);
    addMesh(group, headGeo, mats.marble, [0, 0.9 * height, 0]);

    return group;
  };

  // Caryatid (default implementation; 13-figures.js may wrap this).
  H.makeCaryatid = function (height) {
    height = height !== undefined ? height : 2.3;
    var group = new THREE.Group();

    addMesh(group, new THREE.CylinderGeometry(0.35, 0.38, 0.25, 16), mats.marble, [0, 0.125, 0]);

    var bodyGeo = new THREE.CylinderGeometry(0.28, 0.42, height * 0.72, 16);
    var pos = bodyGeo.getAttribute('position');
    var posArray = pos.array;
    for (var i = 0; i < posArray.length; i += 3) {
      var px = posArray[i], pz = posArray[i + 2];
      var theta = atan2(pz, px);
      var r = sqrt(px * px + pz * pz);
      var newR = r * (1 + 0.06 * cos(8 * theta));
      posArray[i] = newR * cos(theta);
      posArray[i + 2] = newR * sin(theta);
    }
    pos.needsUpdate = true;
    addMesh(group, bodyGeo, mats.marble, [0, 0.25 + height * 0.36, 0]);

    var armGeo = new THREE.CylinderGeometry(0.07, 0.07, height * 0.5, 8);
    group.add(H.instance(armGeo, mats.marble, [
      { p: [0.28 - 0.07, 0.25 + height * 0.36, 0] },
      { p: [-(0.28 - 0.07), 0.25 + height * 0.36, 0] }
    ]));

    addMesh(group, new THREE.SphereGeometry(0.14, 12, 8), mats.marble, [0, 0.25 + height * 0.72 + 0.14, 0]);
    addMesh(group, new THREE.CylinderGeometry(0.32, 0.30, 0.28, 16), mats.marble, [0, 0.25 + height * 0.72 + 0.28 + 0.14, 0]);

    return group;
  };

  // Wall from polyline
  H.makeWall = function (points, height, thickness, mat) {
    mat = mat !== undefined ? mat : mats.rockDark;
    var group = new THREE.Group();
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      var dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      var len = sqrt(dx * dx + dz * dz);
      var angle = -atan2(dz, dx);
      var wallGeo = new THREE.BoxGeometry(len + thickness, height, thickness);
      addMesh(group, wallGeo, mat, [(p0[0] + p1[0]) / 2, height / 2, (p0[1] + p1[1]) / 2], [0, angle, 0]);
    }
    return group;
  };

  // Rock outcrop
  H.makeRockOutcrop = function (w, d, h, seed) {
    var geo = new THREE.PlaneGeometry(w, d, 48, 24);
    geo.rotateX(-PI / 2);
    var pos = geo.getAttribute('position');
    var posArray = pos.array;
    for (var i = 0; i < posArray.length; i += 3) {
      var px = posArray[i], pz = posArray[i + 2];
      posArray[i + 1] = h * (0.6 * H.noise2(px * 0.02, pz * 0.02, seed) + 0.4 * H.noise2(px * 0.08, pz * 0.08, seed + 9));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mats.rock);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    return mesh;
  };

  // =====================================================================
  // CELLA: ashlar-coursed walls (instanced blocks with fine joint grooves)
  // instead of solid slabs, with a proper door frame + lintel.
  // =====================================================================
  H.makeCella = function (w, d, h, o) {
    o = o || {};
    var doorWidth = o.doorWidth !== undefined ? o.doorWidth : 4;
    var doorSide = o.doorSide !== undefined ? o.doorSide : '+z';
    var thickness = o.thickness !== undefined ? o.thickness : 1.2;
    var frame = o.frame !== undefined ? o.frame : true;
    var group = new THREE.Group();
    var rnd = seedRand(Math.round(w * 4001 + d * 617 + h * 89) + 5);

    // Real Pentelic ashlar courses run closer to ~0.6-0.7 m tall / ~1.5 m long
    // blocks; finer, more numerous coursing than a few thick slabs is what
    // actually reads as individually dressed stone rather than a monolith
    // (courseH nudged up slightly over the previous pass to keep the whole
    // scene's block count, and so triangle cost, in budget).
    var courseH = Math.max(0.55, h / Math.round(h / (MOBILE ? 0.9 : 0.72)));
    var courses = Math.max(1, Math.round(h / courseH));
    courseH = h / courses;
    var blockLen = MOBILE ? 1.9 : 1.7;
    // Real ashlar is laid flush: courses run true and block faces sit in one
    // plane, with only a fine dark joint groove between them — not a wide
    // gap with big in/out steps. The art director found the previous, even
    // finer (~1cm) gap read as barely-there against a light backing; widened
    // a bit and paired with a genuinely dark backing material (below) so the
    // joint stays a hairline in scale terms but is legible as a dark line
    // from normal viewing distance, not a masonry course that reads as a
    // staircase.
    var jointGapV = 0.022; // vertical joint between adjacent blocks in a course
    var jointGapH = 0.026; // bed joint between courses

    // Hand-dressed opus quadratum, not CNC ashlar: every course is a slightly
    // different natural height (renormalised so the wall still tops out at
    // exactly h), and every block gets its own joint width, tiny vertical
    // lift and a hair of in/out protrusion — real quarried courses were never
    // perfectly level or perfectly flush.
    var courseHeights = [], courseY0 = [0], hSum = 0, ci;
    for (ci = 0; ci < courses; ci++) {
      var hgt = courseH * (1 + (rnd() - 0.5) * 0.08);
      courseHeights.push(hgt); hSum += hgt;
    }
    var hNorm = h / hSum;
    for (ci = 0; ci < courses; ci++) {
      courseHeights[ci] *= hNorm;
      courseY0.push(courseY0[ci] + courseHeights[ci]);
    }

    var blockWornT = [], blockShadowedT = [], blockCleanT = [], blockStainedT = [];
    // Runs a coursed wall segment centred at (cx,cz) of total length `len`
    // along local axis (dx,dz unit vector), `courses` high, from y=0.
    function wallRun(cx, cz, len, dx, dz, thick) {
      var n = Math.max(1, Math.round(len / blockLen));
      var bl = len / n;
      var ang = atan2(dz, dx);
      var nx = -dz, nz = dx; // wall-face normal, for protrusion jitter
      var wallSeed = Math.round(cx * 131 + cz * 977) + 41; // per-run streak pattern
      for (var c = 0; c < courses; c++) {
        var cyBase = courseY0[c] + courseHeights[c] / 2;
        var rowOffset = (c % 2) * (bl / 2); // running bond
        var heightFrac = c / courses; // 0 at grade .. 1 near the roofline
        for (var b = 0; b < n; b++) {
          var along = -len / 2 + (b + 0.5) * bl + rowOffset;
          if (along > len / 2) along -= len;
          var jg = jointGapV * (0.6 + rnd() * 0.8);
          var lift = (rnd() - 0.5) * 0.004;
          var proud = (rnd() - 0.5) * 0.006;
          var px = cx + dx * along + nx * proud, pz = cz + dz * along + nz * proud;
          var t = { p: [px, cyBase + lift, pz], r: [0, ang, 0], s: [(bl - jg) / bl, (courseHeights[c] - jointGapH) / courseH, 1] };
          // Weathering reads as broad vertical iron-stain streaks (low-frequency
          // noise along the wall) plus more grime low down near grade, plus a
          // finer per-block patch noise (a second, higher-frequency field
          // sampled per-block rather than per-run) so neighbouring blocks in
          // the same streak still land in different tint buckets — real
          // 2400-year-old Pentelic ashlar shows every block individually
          // discoloured, not just broad uniform bands. Four buckets (clean /
          // lightly stained / worn / heavily shadowed) instead of three give
          // one more visible step of variation without any new material.
          var streak = H.noise2(along * 0.09, heightFrac * 1.4, wallSeed); // -1..1
          var patch = H.noise2(along * 0.6 + c * 3.1, c * 0.37, wallSeed + 500); // -1..1, per-block scale
          var grime = 0.42 + streak * 0.3 + patch * 0.16 + (1 - heightFrac) * 0.14 + (rnd() - 0.5) * 0.12;
          var bucket = grime < 0.26 ? blockCleanT : grime < 0.5 ? blockStainedT : grime < 0.74 ? blockWornT : blockShadowedT;
          bucket.push(t);
        }
      }
      // Dark mortar/grout backing behind the coursed veneer: without it, the
      // hand-dressed gaps between blocks read as holes straight through to
      // whatever is behind the wall instead of a mortared joint. Switched
      // from the (fairly light) marbleShadowed marble texture to the much
      // darker rockDark material so the widened joint above reads as a
      // legible dark line/shadow, not a barely-visible hairline.
      addMesh(group, new THREE.BoxGeometry(len + thick * 0.2, h, thick * 0.82), mats.rockDark, [cx, h / 2, cz], [0, ang, 0]);
    }

    var halfW = w / 2, halfD = d / 2;
    var frameCenter = null, frameRy = 0;
    if (doorSide === '+z' || doorSide === '-z') {
      var dzSign = doorSide === '+z' ? 1 : -1;
      var flankLen = (w - doorWidth) / 2;
      wallRun(-halfW - thickness / 2, 0, d, 0, 1, thickness);
      wallRun(halfW + thickness / 2, 0, d, 0, 1, thickness);
      wallRun(0, -dzSign * (halfD + thickness / 2), w, 1, 0, thickness);
      wallRun(-doorWidth / 2 - flankLen / 2, dzSign * (halfD + thickness / 2), flankLen, 1, 0, thickness);
      wallRun(doorWidth / 2 + flankLen / 2, dzSign * (halfD + thickness / 2), flankLen, 1, 0, thickness);
      frameCenter = [0, 0, dzSign * (halfD + thickness / 2)]; frameRy = dzSign === 1 ? 0 : PI;
    } else {
      var dxSign = doorSide === '+x' ? 1 : -1;
      var flankLenX = (d - doorWidth) / 2;
      wallRun(0, -halfD - thickness / 2, w, 1, 0, thickness);
      wallRun(0, halfD + thickness / 2, w, 1, 0, thickness);
      wallRun(-dxSign * (halfW + thickness / 2), 0, d, 0, 1, thickness);
      wallRun(dxSign * (halfW + thickness / 2), -doorWidth / 2 - flankLenX / 2, flankLenX, 0, 1, thickness);
      wallRun(dxSign * (halfW + thickness / 2), doorWidth / 2 + flankLenX / 2, flankLenX, 0, 1, thickness);
      frameCenter = [dxSign * (halfW + thickness / 2), 0, 0]; frameRy = dxSign === 1 ? PI / 2 : -PI / 2;
    }

    var blockGeo = new THREE.BoxGeometry(blockLen, courseH, thickness);
    if (blockWornT.length) group.add(H.instance(blockGeo, mats.marbleWorn, blockWornT));
    if (blockShadowedT.length) group.add(H.instance(blockGeo, mats.marbleShadowed, blockShadowedT));
    if (blockCleanT.length) group.add(H.instance(blockGeo, mats.marble, blockCleanT));
    // Fourth tint step (between clean and fully worn): reuses the existing
    // marbleRelief material as an extra stain bucket rather than
    // constructing a new material — its own baked patina/streak field
    // already differs from the other three, so it reads as a distinct,
    // naturally-stained block colour, not a repeated texture tile.
    if (blockStainedT.length) group.add(H.instance(blockGeo, mats.marbleRelief, blockStainedT));

    if (frame) {
      var dw = doorWidth, dh = h, ry = frameRy, center = frameCenter;
      var lintelH = dh * 0.28;
      var jambGeo = new THREE.BoxGeometry(0.22, dh - lintelH, thickness + 0.08);
      var lintelGeo = new THREE.BoxGeometry(dw + 0.44, lintelH * 0.7, thickness + 0.1);
      var trimGeo = new THREE.BoxGeometry(dw + 0.5, 0.1, thickness + 0.14);
      addMesh(group, jambGeo, mats.marble, [center[0] - (dw / 2) * cos(ry), (dh - lintelH) / 2, center[2] + (dw / 2) * sin(ry)], [0, ry, 0]);
      addMesh(group, jambGeo, mats.marble, [center[0] + (dw / 2) * cos(ry), (dh - lintelH) / 2, center[2] - (dw / 2) * sin(ry)], [0, ry, 0]);
      addMesh(group, lintelGeo, mats.marble, [center[0], dh - lintelH * 0.65, center[2]], [0, ry, 0]);
      addMesh(group, trimGeo, mats.marbleWorn, [center[0], dh - lintelH * 0.15, center[2]], [0, ry, 0]);
    }

    return group;
  };

  // Block course ring (kept for callers that want a plain coursed ring,
  // e.g. bastion caps and interior frieze backing).
  H.makeBlockCourse = function (w, d, h, blockLen) {
    var blockGeo = new THREE.BoxGeometry(blockLen * 0.96, h * 0.96, 1.0);
    var transforms = [];
    var thickness = 1.0;

    var zTopCount = Math.floor(d / blockLen);
    for (var i = 0; i < zTopCount; i++) {
      transforms.push({ p: [-(w / 2) + thickness / 2, h / 2, -(d / 2) + (i + 0.5) * blockLen], r: [0, Math.PI / 2, 0] });
    }
    var zBottomCount = Math.floor(d / blockLen);
    for (var i = 0; i < zBottomCount; i++) {
      transforms.push({ p: [w / 2 - thickness / 2, h / 2, -(d / 2) + (i + 0.5) * blockLen], r: [0, Math.PI / 2, 0] });
    }
    var xLeftCount = Math.floor(w / blockLen);
    for (var i = 0; i < xLeftCount; i++) {
      transforms.push({ p: [-(w / 2) + (i + 0.5) * blockLen, h / 2, d / 2 - thickness / 2] });
    }
    var xRightCount = Math.floor(w / blockLen);
    for (var i = 0; i < xRightCount; i++) {
      transforms.push({ p: [-(w / 2) + (i + 0.5) * blockLen, h / 2, -(d / 2) + thickness / 2] });
    }

    return H.instance(blockGeo, mats.marbleWorn, transforms);
  };

  return H;
};
