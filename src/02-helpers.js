// Module 02: H — shared geometry helpers
window.makeHelpers = function (THREE, mats) {
  var H = {};
  var SEG = (window.CFG && window.CFG.SEG) || { colRadial: 40, colHeight: 4, capital: 24 };
  var PI = Math.PI, sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, atan2 = Math.atan2;

  // Deterministic value noise
  H.noise2 = function (x, z, seed) {
    function hash(ix, iz) {
      var s = sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453;
      return s - Math.floor(s);
    }
    function smoothstep(t) {
      return t * t * (3 - 2 * t);
    }
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

  // Doric columns
  H.makeDoricColumns = function (positions, opts) {
    opts = opts || {};
    var height = opts.height !== undefined ? opts.height : 10.4;
    var baseD = opts.baseD !== undefined ? opts.baseD : 1.9;
    var topD = opts.topD !== undefined ? opts.topD : 1.48;
    var flutes = opts.flutes !== undefined ? opts.flutes : 20;
    var entasis = opts.entasis !== undefined ? opts.entasis : 0.02;
    var y = opts.y !== undefined ? opts.y : 0;
    var group = new THREE.Group();
    var shaftH = height * 0.92;

    // Shaft geometry with flutes
    var shaftGeo = new THREE.CylinderGeometry(topD / 2, baseD / 2, shaftH, Math.min(40, flutes * 2), SEG.colHeight);
    var pos = shaftGeo.getAttribute('position');
    var posArray = pos.array;
    for (var i = 0; i < posArray.length; i += 3) {
      var px = posArray[i], py = posArray[i + 1], pz = posArray[i + 2];
      var theta = atan2(pz, px);
      var r = sqrt(px * px + pz * pz);
      var yN = (py + shaftH / 2) / shaftH;
      var newR = r * (1 - 0.055 * (0.5 + 0.5 * cos(flutes * theta))) * (1 + entasis * sin(PI * yN));
      posArray[i] = newR * cos(theta);
      posArray[i + 2] = newR * sin(theta);
    }
    pos.needsUpdate = true;
    shaftGeo.computeVertexNormals();

    var echinosGeo = new THREE.CylinderGeometry(topD * 0.55, topD * 0.5, 0.35, SEG.capital);
    var abacusGeo = new THREE.BoxGeometry(topD * 1.35, 0.3, topD * 1.35);

    var shaftTransforms = [];
    var echinosTransforms = [];
    var abacusTransforms = [];
    for (var i = 0; i < positions.length; i++) {
      var px = positions[i][0], pz = positions[i][1];
      shaftTransforms.push({ p: [px, y + shaftH / 2, pz] });
      echinosTransforms.push({ p: [px, y + shaftH + 0.175, pz] });
      abacusTransforms.push({ p: [px, y + shaftH + 0.35 + 0.15, pz] });
    }

    group.add(H.instance(shaftGeo, mats.marbleWorn, shaftTransforms));
    group.add(H.instance(echinosGeo, mats.marbleWorn, echinosTransforms));
    group.add(H.instance(abacusGeo, mats.marbleWorn, abacusTransforms));
    return group;
  };

  // Ionic columns. opts.rotY turns the capitals so the volutes face along that axis.
  H.makeIonicColumns = function (positions, opts) {
    opts = opts || {};
    var height = opts.height !== undefined ? opts.height : 6.5;
    var baseD = opts.baseD !== undefined ? opts.baseD : 0.85;
    var topD = opts.topD !== undefined ? opts.topD : baseD * 0.84;
    var flutes = opts.flutes !== undefined ? opts.flutes : 24;
    var y = opts.y !== undefined ? opts.y : 0;
    var rotY = opts.rotY !== undefined ? opts.rotY : 0;
    var group = new THREE.Group();
    var baseH = 0.3;
    var shaftH = height * 0.86;
    var capH = height - baseH - shaftH;
    var baseR = baseD * 0.62;

    // Attic base: plinth drum with two tori
    var baseGeo = new THREE.CylinderGeometry(baseR, baseR * 1.1, baseH, 24);
    var torusLoGeo = new THREE.TorusGeometry(baseR * 1.02, baseH * 0.2, 4, 20);
    torusLoGeo.rotateX(PI / 2);
    var torusHiGeo = new THREE.TorusGeometry(baseR * 0.92, baseH * 0.15, 4, 20);
    torusHiGeo.rotateX(PI / 2);

    var shaftGeo = new THREE.CylinderGeometry(topD / 2, baseR, shaftH, Math.min(40, flutes * 2), SEG.colHeight);
    var pos = shaftGeo.getAttribute('position');
    var posArray = pos.array;
    for (var i = 0; i < posArray.length; i += 3) {
      var px = posArray[i], pz = posArray[i + 2];
      var theta = atan2(pz, px);
      var r = sqrt(px * px + pz * pz);
      var newR = r * (1 - 0.025 * (0.5 + 0.5 * cos(flutes * theta)));
      posArray[i] = newR * cos(theta);
      posArray[i + 2] = newR * sin(theta);
    }
    pos.needsUpdate = true;
    shaftGeo.computeVertexNormals();

    // Capital, built around the shaft top (local y = 0) and later rotated by rotY
    var echH = capH * 0.32, canH = capH * 0.4, abH = capH * 0.22;
    var capW = topD * 1.9, capDp = topD * 1.02;
    var volR = Math.min(topD * 0.34, capH * 0.62);
    var volX = capW / 2 - volR * 0.7;
    var volY = echH + canH * 0.5 - volR * 0.35;

    var echinusGeo = new THREE.CylinderGeometry(topD * 0.58, topD * 0.5, echH, 20);
    echinusGeo.translate(0, echH / 2, 0);
    var canalisGeo = new THREE.BoxGeometry(capW - volR * 1.2, canH, capDp);
    canalisGeo.translate(0, echH + canH / 2, 0);
    var abacusGeo = new THREE.BoxGeometry(capW * 0.96, abH, capDp * 1.05);
    abacusGeo.translate(0, capH - abH / 2, 0);
    // Pulvinus: the bolster that joins front and back volutes
    var pulvGeo = new THREE.CylinderGeometry(volR * 0.92, volR * 0.92, capDp * 0.96, 16);
    pulvGeo.rotateX(PI / 2);

    var CFG_MOBILE = window.CFG && window.CFG.MOBILE;
    // Spiral tube on the volute face; hand = +1 for the right volute, -1 mirrors it
    function spiralGeo(hand) {
      var pts = [], n = CFG_MOBILE ? 18 : 30, turns = 2.4;
      for (var k = 0; k <= n; k++) {
        var t = k / n;
        var ang = PI / 2 - t * turns * 2 * PI;
        var rr = volR * (1 - 0.82 * t);
        pts.push(new THREE.Vector3(hand * rr * cos(ang), rr * sin(ang), 0));
      }
      var g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, volR * 0.1, 4, false);
      var eye = new THREE.SphereGeometry(volR * 0.16, 6, 4);
      return [g, eye];
    }
    var spR = spiralGeo(1), spL = spiralGeo(-1);

    var baseT = [], torLoT = [], torHiT = [], shaftT = [], capT = [], pulvT = [], spRT = [], spLT = [];
    var cq = cos(rotY), sq = sin(rotY);
    function capPoint(cx, cz, lx, ly, lz) {
      return [cx + lx * cq + lz * sq, ly, cz - lx * sq + lz * cq];
    }
    var zF = capDp * 0.49;
    for (var i = 0; i < positions.length; i++) {
      var cx = positions[i][0], cz = positions[i][1];
      var y0 = y + baseH + shaftH;
      baseT.push({ p: [cx, y + baseH / 2, cz] });
      torLoT.push({ p: [cx, y + baseH * 0.2, cz] });
      torHiT.push({ p: [cx, y + baseH * 0.85, cz] });
      shaftT.push({ p: [cx, y + baseH + shaftH / 2, cz] });
      capT.push({ p: [cx, y0, cz], r: [0, rotY, 0] });
      var pr = capPoint(cx, cz, volX, 0, 0), pl = capPoint(cx, cz, -volX, 0, 0);
      pulvT.push({ p: [pr[0], y0 + volY, pr[2]], r: [0, rotY, 0] });
      pulvT.push({ p: [pl[0], y0 + volY, pl[2]], r: [0, rotY, 0] });
      // Front faces: right spiral at +x, mirrored at -x. Back faces: the same pair turned by PI.
      var fr = capPoint(cx, cz, volX, 0, zF), fl = capPoint(cx, cz, -volX, 0, zF);
      var br = capPoint(cx, cz, volX, 0, -zF), bl = capPoint(cx, cz, -volX, 0, -zF);
      spRT.push({ p: [fr[0], y0 + volY, fr[2]], r: [0, rotY, 0] });
      spRT.push({ p: [bl[0], y0 + volY, bl[2]], r: [0, rotY + PI, 0] });
      spLT.push({ p: [fl[0], y0 + volY, fl[2]], r: [0, rotY, 0] });
      spLT.push({ p: [br[0], y0 + volY, br[2]], r: [0, rotY + PI, 0] });
    }

    group.add(H.instance(baseGeo, mats.marbleWorn, baseT));
    group.add(H.instance(shaftGeo, mats.marble, shaftT));
    group.add(H.instance(echinusGeo, mats.marbleWorn, capT));
    group.add(H.instance(canalisGeo, mats.marble, capT));
    group.add(H.instance(abacusGeo, mats.marbleWorn, capT));
    group.add(H.instance(pulvGeo, mats.marble, pulvT));
    // Small carved detail: receives shadows but casts none, to keep the shadow pass cheap
    [[spR[0], spRT], [spR[1], spRT], [spL[0], spLT], [spL[1], spLT], [torusLoGeo, torLoT], [torusHiGeo, torHiT]].forEach(function (e) {
      var m = H.instance(e[0], mats.marbleWorn, e[1]);
      m.castShadow = false;
      group.add(m);
    });
    return group;
  };

  // Stepped base
  H.makeSteppedBase = function (w, d, steps, stepH, inset) {
    inset = inset !== undefined ? inset : 0.7;
    var group = new THREE.Group();
    for (var i = 0; i < steps; i++) {
      var geo = new THREE.BoxGeometry(w + 2 * inset * i, stepH, d + 2 * inset * i);
      var mesh = new THREE.Mesh(geo, mats.marble);
      mesh.position.y = -stepH * (i + 0.5);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  };

  // Entablature
  H.makeEntablature = function (w, d, h, o) {
    o = o || {};
    var triglyphs = o.triglyphs !== undefined ? o.triglyphs : true;
    var triglyphCount = o.triglyphCount !== undefined ? o.triglyphCount : 8;
    var cornice = o.cornice !== undefined ? o.cornice : true;
    var guttae = o.guttae !== undefined ? o.guttae : false;
    var group = new THREE.Group();

    // Architrave (4 boxes forming a ring)
    var archH = h * 0.40;
    var archThickness = 1.4;
    var aw = w / 2 - archThickness / 2, ad = d / 2 - archThickness / 2;
    var archGeos = [
      new THREE.BoxGeometry(w, archH, archThickness),
      new THREE.BoxGeometry(w, archH, archThickness),
      new THREE.BoxGeometry(archThickness, archH, d),
      new THREE.BoxGeometry(archThickness, archH, d)
    ];
    var archPoses = [
      [0, archH / 2, ad],
      [0, archH / 2, -ad],
      [aw, archH / 2, 0],
      [-aw, archH / 2, 0]
    ];
    for (var i = 0; i < 4; i++) {
      var mesh = new THREE.Mesh(archGeos[i], mats.marble);
      mesh.position.set(archPoses[i][0], archPoses[i][1], archPoses[i][2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Frieze ring
    var friezeH = h * 0.35;
    var frieze = [
      new THREE.BoxGeometry(w, friezeH, archThickness),
      new THREE.BoxGeometry(w, friezeH, archThickness),
      new THREE.BoxGeometry(archThickness, friezeH, d),
      new THREE.BoxGeometry(archThickness, friezeH, d)
    ];
    var frizePoses = [
      [0, archH + friezeH / 2, ad],
      [0, archH + friezeH / 2, -ad],
      [aw, archH + friezeH / 2, 0],
      [-aw, archH + friezeH / 2, 0]
    ];
    for (var i = 0; i < 4; i++) {
      var mesh = new THREE.Mesh(frieze[i], mats.marbleShadowed);
      mesh.position.set(frizePoses[i][0], frizePoses[i][1], frizePoses[i][2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Triglyphs
    if (triglyphs) {
      var trigGeo = new THREE.BoxGeometry(0.85, friezeH, 0.12);
      var trigTransforms = [];
      var xCount = triglyphCount;
      var zCount = Math.round(triglyphCount * d / w);
      var xStep = w / (xCount + 1), zStep = d / (zCount + 1);
      for (var i = 1; i <= xCount; i++) {
        trigTransforms.push({ p: [-(w / 2) + xStep * i, archH + friezeH / 2, d / 2 + 0.06] });
        trigTransforms.push({ p: [-(w / 2) + xStep * i, archH + friezeH / 2, -d / 2 - 0.06] });
      }
      for (var i = 1; i <= zCount; i++) {
        trigTransforms.push({ p: [w / 2 + 0.06, archH + friezeH / 2, -(d / 2) + zStep * i], r: [0, PI / 2, 0] });
        trigTransforms.push({ p: [-w / 2 - 0.06, archH + friezeH / 2, -(d / 2) + zStep * i], r: [0, PI / 2, 0] });
      }
      group.add(H.instance(trigGeo, mats.marble, trigTransforms));
    }

    // Cornice
    if (cornice) {
      var corniceH = h * 0.25;
      var cornOvhg = 0.45;
      var cornW = w + 2 * cornOvhg, cornD = d + 2 * cornOvhg;
      var cornices = [
        new THREE.BoxGeometry(cornW, corniceH, archThickness + 2 * cornOvhg),
        new THREE.BoxGeometry(cornW, corniceH, archThickness + 2 * cornOvhg),
        new THREE.BoxGeometry(archThickness + 2 * cornOvhg, corniceH, cornD),
        new THREE.BoxGeometry(archThickness + 2 * cornOvhg, corniceH, cornD)
      ];
      var cornPoses = [
        [0, archH + friezeH + corniceH / 2, (d / 2 + cornOvhg)],
        [0, archH + friezeH + corniceH / 2, -(d / 2 + cornOvhg)],
        [(w / 2 + cornOvhg), archH + friezeH + corniceH / 2, 0],
        [-(w / 2 + cornOvhg), archH + friezeH + corniceH / 2, 0]
      ];
      for (var i = 0; i < 4; i++) {
        var mesh = new THREE.Mesh(cornices[i], mats.marble);
        mesh.position.set(cornPoses[i][0], cornPoses[i][1], cornPoses[i][2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }

    return group;
  };

  // Pediment
  H.makePediment = function (w, d, h, o) {
    o = o || {};
    var figures = o.figures !== undefined ? o.figures : 9;
    var relief = o.relief !== undefined ? o.relief : true;
    var group = new THREE.Group();

    // Tympanum (triangular extrude)
    var shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(-w / 2, 0);
    var tympGeo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    tympGeo.translate(0, 0, -d / 2);
    var tympMesh = new THREE.Mesh(tympGeo, mats.marbleShadowed);
    tympMesh.castShadow = true;
    tympMesh.receiveShadow = true;
    group.add(tympMesh);

    // Raking cornice
    var slopeLen = sqrt((w / 2) * (w / 2) + h * h) + 0.4;
    var angle = atan2(h, w / 2);
    var rakingCornice = [
      new THREE.BoxGeometry(slopeLen, 0.4, d + 0.6),
      new THREE.BoxGeometry(slopeLen, 0.4, d + 0.6)
    ];
    var rakingPos = [
      [w / 4, h / 2, 0],
      [-w / 4, h / 2, 0]
    ];
    var rakingRot = [
      [0, 0, -angle],
      [0, 0, angle]
    ];
    for (var i = 0; i < 2; i++) {
      var mesh = new THREE.Mesh(rakingCornice[i], mats.marble);
      mesh.position.set(rakingPos[i][0], rakingPos[i][1], rakingPos[i][2]);
      mesh.rotation.set(rakingRot[i][0], rakingRot[i][1], rakingRot[i][2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Figures: standing in the centre, kneeling further out, reclining in the corners
    var spacing = figures > 1 ? (w * 0.8) / (figures - 1) : w;
    for (var i = 0; i < figures; i++) {
      var xi = figures > 1 ? i / (figures - 1) : 0.5;
      var fx = -w * 0.4 + xi * w * 0.8;
      var avail = h * (1 - Math.abs(fx) / (w / 2)) - 0.3;
      var side = fx > 0 ? 1 : -1;
      var fig;
      if (avail >= 1.5) {
        var fh = Math.min(avail * 0.92, h * 0.85);
        fig = H.makeFigure(fh);
        fig.position.set(fx, 0.02, d / 2 + 0.2);
        fig.rotation.set(0, side * 0.25 * (i % 2 ? 1 : 0.4), side * -0.04);
      } else if (avail >= 0.7) {
        var kh = (avail * 0.92) / 0.72;
        fig = H.makeFigure(kh);
        fig.scale.set(1, 0.72, 1);
        fig.position.set(fx, 0.02, d / 2 + 0.2);
        fig.rotation.set(0, -side * 0.35, 0);
      } else {
        // Lying with the head toward the centre
        var len = Math.max(0.6, Math.min(avail / 0.3, spacing * 1.5));
        fig = H.makeFigure(len);
        fig.rotation.set(0, 0, side * PI / 2 * 0.94);
        fig.position.set(fx + side * len * 0.35, 0.13 * len + 0.02, d / 2 + 0.2);
      }
      group.add(fig);
    }

    return group;
  };

  // Gable roof
  H.makeGableRoof = function (w, d, pitch, o) {
    o = o || {};
    var tiles = o.tiles !== undefined ? o.tiles : true;
    var acroteria = o.acroteria !== undefined ? o.acroteria : false;
    var group = new THREE.Group();
    var ridgeH = (w / 2) * pitch;
    var slopeLen = sqrt((w / 2) * (w / 2) + ridgeH * ridgeH);
    var angle = atan2(pitch, 1);

    // Two slabs
    var slab = [
      new THREE.BoxGeometry(slopeLen, 0.25, d),
      new THREE.BoxGeometry(slopeLen, 0.25, d)
    ];
    var slabPos = [[w / 4, ridgeH / 2, 0], [-w / 4, ridgeH / 2, 0]];
    var slabRot = [[0, 0, -angle], [0, 0, angle]];
    for (var i = 0; i < 2; i++) {
      var mesh = new THREE.Mesh(slab[i], mats.terracotta);
      mesh.position.set(slabPos[i][0], slabPos[i][1], slabPos[i][2]);
      mesh.rotation.set(slabRot[i][0], slabRot[i][1], slabRot[i][2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // Tiles: rows run from eave to ridge; tiles grow on big roofs to keep each side under ~700
    if (tiles) {
      var k = Math.max(1, sqrt((slopeLen / 0.75) * (d / 0.65) / 700));
      var rowStep = 0.75 * k, colStep = 0.65 * k;
      var tileGeo = new THREE.BoxGeometry(0.6 * k, 0.06, 0.7 * k);
      var tileTransforms = [];
      var rowCount = Math.floor(slopeLen / rowStep);
      var colCount = Math.floor(d / colStep);
      for (var si = 0; si < 2; si++) {
        var sx = si === 0 ? 1 : -1;
        for (var r = 0; r < rowCount; r++) {
          var sAlong = -slopeLen / 2 + (r + 0.5) * rowStep;
          for (var c = 0; c < colCount; c++) {
            var tx = sx * (w / 4 - sAlong * cos(angle));
            var ty = ridgeH / 2 + sAlong * sin(angle) + 0.14 * cos(angle);
            var tz = -(d / 2) + (c + 0.5) * colStep;
            tileTransforms.push({ p: [tx, ty, tz], r: [0, 0, si === 0 ? -angle : angle] });
          }
        }
      }
      group.add(H.instance(tileGeo, mats.terracotta, tileTransforms));
    }

    // Ridge cap
    var ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, d), mats.terracotta);
    ridgeCap.position.y = ridgeH;
    ridgeCap.castShadow = true;
    ridgeCap.receiveShadow = true;
    group.add(ridgeCap);

    // Acroteria
    if (acroteria) {
      var acroGeo = new THREE.ConeGeometry(0.4, 1.2, 8);
      var acroTransforms = [
        { p: [0, ridgeH, d / 2] },
        { p: [w / 4, ridgeH, d / 2] },
        { p: [-w / 4, ridgeH, d / 2] },
        { p: [0, ridgeH, -d / 2] },
        { p: [w / 4, ridgeH, -d / 2] },
        { p: [-w / 4, ridgeH, -d / 2] }
      ];
      group.add(H.instance(acroGeo, mats.marble, acroTransforms));
    }

    return group;
  };

  // Figure
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
    var torsoMesh = new THREE.Mesh(torsoGeo, mats.marble);
    torsoMesh.position.y = 0.625 * height;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    group.add(torsoMesh);

    var armR = 0.04 * height, armLen = 0.3 * height;
    var armGeo = new THREE.CylinderGeometry(armR, armR, armLen, 8);
    group.add(H.instance(armGeo, mats.marble, [
      { p: [0.16 * height, 0.62 * height, 0], r: [0, 0, -0.25] },
      { p: [-0.16 * height, 0.62 * height, 0], r: [0, 0, 0.25] }
    ]));

    var neckGeo = new THREE.CylinderGeometry(0.03 * height, 0.03 * height, 0.06 * height, 8);
    var neckMesh = new THREE.Mesh(neckGeo, mats.marble);
    neckMesh.position.y = 0.81 * height;
    neckMesh.castShadow = true;
    neckMesh.receiveShadow = true;
    group.add(neckMesh);

    var headGeo = new THREE.SphereGeometry(0.08 * height, 12, 8);
    var headMesh = new THREE.Mesh(headGeo, mats.marble);
    headMesh.position.y = 0.9 * height;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    group.add(headMesh);

    return group;
  };

  // Caryatid
  H.makeCaryatid = function (height) {
    height = height !== undefined ? height : 2.3;
    var group = new THREE.Group();

    var plinthGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.25, 16);
    var plinthMesh = new THREE.Mesh(plinthGeo, mats.marble);
    plinthMesh.position.y = 0.125;
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    group.add(plinthMesh);

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
    var bodyMesh = new THREE.Mesh(bodyGeo, mats.marble);
    bodyMesh.position.y = 0.25 + height * 0.36;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    var armGeo = new THREE.CylinderGeometry(0.07, 0.07, height * 0.5, 8);
    group.add(H.instance(armGeo, mats.marble, [
      { p: [0.28 - 0.07, 0.25 + height * 0.36, 0] },
      { p: [-(0.28 - 0.07), 0.25 + height * 0.36, 0] }
    ]));

    var headGeo = new THREE.SphereGeometry(0.14, 12, 8);
    var headMesh = new THREE.Mesh(headGeo, mats.marble);
    headMesh.position.y = 0.25 + height * 0.72 + 0.14;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    group.add(headMesh);

    var capitalGeo = new THREE.CylinderGeometry(0.32, 0.30, 0.28, 16);
    var capitalMesh = new THREE.Mesh(capitalGeo, mats.marble);
    capitalMesh.position.y = 0.25 + height * 0.72 + 0.28 + 0.14;
    capitalMesh.castShadow = true;
    capitalMesh.receiveShadow = true;
    group.add(capitalMesh);

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
      var wallMesh = new THREE.Mesh(wallGeo, mat);
      wallMesh.position.set((p0[0] + p1[0]) / 2, height / 2, (p0[1] + p1[1]) / 2);
      wallMesh.rotation.y = angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
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

  // Cella (interior chamber)
  H.makeCella = function (w, d, h, o) {
    o = o || {};
    var doorWidth = o.doorWidth !== undefined ? o.doorWidth : 4;
    var doorSide = o.doorSide !== undefined ? o.doorSide : '+z';
    var group = new THREE.Group();
    var t = o.thickness !== undefined ? o.thickness : 1.2;
    var doorH = h * 0.65;

    function box(sx, sy, sz, x, y, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mats.marbleWorn);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }

    // Wall along x at z = zc, or along z at x = xc; len is its full length
    function wall(axis, off, len, withDoor) {
      if (!withDoor) {
        if (axis === 'x') box(len, h, t, 0, h / 2, off); else box(t, h, len, off, h / 2, 0);
        return;
      }
      var flank = (len - doorWidth) / 2;
      var fc = doorWidth / 2 + flank / 2;
      var lintelH = h - doorH;
      if (axis === 'x') {
        box(flank, h, t, -fc, h / 2, off);
        box(flank, h, t, fc, h / 2, off);
        box(doorWidth, lintelH, t, 0, doorH + lintelH / 2, off);
      } else {
        box(t, h, flank, off, h / 2, -fc);
        box(t, h, flank, off, h / 2, fc);
        box(t, lintelH, doorWidth, off, doorH + lintelH / 2, 0);
      }
    }

    // Walls along x close the short ends; walls along z run the full outer length
    wall('x', d / 2 + t / 2, w, doorSide === '+z');
    wall('x', -d / 2 - t / 2, w, doorSide === '-z');
    wall('z', w / 2 + t / 2, d + 2 * t, doorSide === '+x');
    wall('z', -w / 2 - t / 2, d + 2 * t, doorSide === '-x');

    return group;
  };

  // Block course ring
  H.makeBlockCourse = function (w, d, h, blockLen) {
    var blockGeo = new THREE.BoxGeometry(blockLen * 0.96, h * 0.96, 1.0);
    var transforms = [];
    var thickness = 1.0;

    // Top side (+z)
    var zTopCount = Math.floor(d / blockLen);
    for (var i = 0; i < zTopCount; i++) {
      var bx = -(w / 2) + thickness / 2;
      var bz = -(d / 2) + (i + 0.5) * blockLen;
      transforms.push({ p: [bx, h / 2, bz], r: [0, Math.PI / 2, 0] });
    }

    // Bottom side (-z)
    var zBottomCount = Math.floor(d / blockLen);
    for (var i = 0; i < zBottomCount; i++) {
      var bx = w / 2 - thickness / 2;
      var bz = -(d / 2) + (i + 0.5) * blockLen;
      transforms.push({ p: [bx, h / 2, bz], r: [0, Math.PI / 2, 0] });
    }

    // Left side (-x)
    var xLeftCount = Math.floor(w / blockLen);
    for (var i = 0; i < xLeftCount; i++) {
      var bx = -(w / 2) + (i + 0.5) * blockLen;
      var bz = d / 2 - thickness / 2;
      transforms.push({ p: [bx, h / 2, bz] });
    }

    // Right side (+x)
    var xRightCount = Math.floor(w / blockLen);
    for (var i = 0; i < xRightCount; i++) {
      var bx = -(w / 2) + (i + 0.5) * blockLen;
      var bz = -(d / 2) + thickness / 2;
      transforms.push({ p: [bx, h / 2, bz] });
    }

    return H.instance(blockGeo, mats.marbleWorn, transforms);
  };

  // 13-figures.js replaces the figure helpers and adds statues and reliefs
  if (window.addFigureHelpers) window.addFigureHelpers(THREE, mats, H);

  return H;
};
