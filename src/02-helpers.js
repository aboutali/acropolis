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

  // Ionic columns
  H.makeIonicColumns = function (positions, opts) {
    opts = opts || {};
    var height = opts.height !== undefined ? opts.height : 6.5;
    var baseD = opts.baseD !== undefined ? opts.baseD : 0.85;
    var topD = opts.topD !== undefined ? opts.topD : 0.72;
    var flutes = opts.flutes !== undefined ? opts.flutes : 24;
    var y = opts.y !== undefined ? opts.y : 0;
    var group = new THREE.Group();
    var shaftH = height * 0.86;

    var baseGeo = new THREE.CylinderGeometry(baseD * 0.62, baseD * 0.68, 0.3, 24);
    var shaftGeo = new THREE.CylinderGeometry(topD / 2, baseD * 0.62, shaftH, Math.min(40, flutes * 2), SEG.colHeight);
    var pos = shaftGeo.getAttribute('position');
    var posArray = pos.array;
    for (var i = 0; i < posArray.length; i += 3) {
      var px = posArray[i], py = posArray[i + 1], pz = posArray[i + 2];
      var theta = atan2(pz, px);
      var r = sqrt(px * px + pz * pz);
      var yN = (py + shaftH / 2) / shaftH;
      var newR = r * (1 - 0.025 * (0.5 + 0.5 * cos(flutes * theta)));
      posArray[i] = newR * cos(theta);
      posArray[i + 2] = newR * sin(theta);
    }
    pos.needsUpdate = true;
    shaftGeo.computeVertexNormals();

    var voluteGeo = new THREE.TorusGeometry(topD * 0.22, topD * 0.09, 6, 12);
    var abacusGeo = new THREE.BoxGeometry(topD * 1.5, 0.22, topD * 1.1);

    var baseTransforms = [], shaftTransforms = [], voluteTransforms = [], abacusTransforms = [];
    for (var i = 0; i < positions.length; i++) {
      var px = positions[i][0], pz = positions[i][1];
      baseTransforms.push({ p: [px, y + 0.15, pz] });
      shaftTransforms.push({ p: [px, y + 0.3 + shaftH / 2, pz] });
      voluteTransforms.push({ p: [px + topD * 0.55, y + 0.3 + shaftH, pz], r: [PI / 2, 0, 0] });
      voluteTransforms.push({ p: [px - topD * 0.55, y + 0.3 + shaftH, pz], r: [PI / 2, 0, 0] });
      abacusTransforms.push({ p: [px, y + 0.3 + shaftH + 0.22 / 2 + 0.11, pz] });
    }

    group.add(H.instance(baseGeo, mats.marbleWorn, baseTransforms));
    group.add(H.instance(shaftGeo, mats.marbleWorn, shaftTransforms));
    group.add(H.instance(voluteGeo, mats.marbleWorn, voluteTransforms));
    group.add(H.instance(abacusGeo, mats.marbleWorn, abacusTransforms));
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

    // Figures
    for (var i = 0; i < figures; i++) {
      var xi = i / (figures - 1);
      var fx = -w * 0.42 + xi * w * 0.84;
      var fh = Math.max(0.6, 0.85 * h * (1 - Math.abs(fx) / (w / 2)));
      var fig = H.makeFigure(fh);
      fig.position.set(fx, fh / 2, d / 2 + 0.2);
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

    // Tiles
    if (tiles) {
      var tileGeo = new THREE.BoxGeometry(0.6, 0.06, 0.7);
      var tileTransforms = [];
      var tileCount = 0;
      var maxTiles = 1200;
      for (var si = 0; si < 2; si++) {
        var sx = si === 0 ? 1 : -1;
        var rowCount = Math.floor(slopeLen / 0.75);
        var colCount = Math.floor(d / 0.65);
        for (var r = 0; r < rowCount && tileCount < maxTiles; r++) {
          for (var c = 0; c < colCount && tileCount < maxTiles; c++) {
            var tx = sx * (w / 4 - (r + 0.5) * 0.75 * cos(angle));
            var ty = ridgeH / 2 + (r + 0.5) * 0.75 * sin(angle) + 0.14 * cos(angle);
            var tz = -(d / 2) + (c + 0.5) * 0.65;
            tileTransforms.push({ p: [tx, ty, tz], r: [0, 0, si === 0 ? -angle : angle] });
            tileCount++;
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
    var thickness = 1.2;

    var sideX = new THREE.BoxGeometry(w, h, thickness);
    var sideZ = new THREE.BoxGeometry(thickness, h, d);

    var eastMesh = new THREE.Mesh(sideX, mats.marbleWorn);
    eastMesh.position.set(w / 2 + thickness / 2, h / 2, 0);
    eastMesh.castShadow = true;
    eastMesh.receiveShadow = true;
    group.add(eastMesh);

    var westMesh = new THREE.Mesh(sideX, mats.marbleWorn);
    westMesh.position.set(-w / 2 - thickness / 2, h / 2, 0);
    westMesh.castShadow = true;
    westMesh.receiveShadow = true;
    group.add(westMesh);

    var northMesh = new THREE.Mesh(sideZ, mats.marbleWorn);
    northMesh.position.set(0, h / 2, -d / 2 - thickness / 2);
    northMesh.castShadow = true;
    northMesh.receiveShadow = true;
    group.add(northMesh);

    var southMesh = new THREE.Mesh(sideZ, mats.marbleWorn);
    southMesh.position.set(0, h / 2, d / 2 + thickness / 2);
    southMesh.castShadow = true;
    southMesh.receiveShadow = true;
    group.add(southMesh);

    if (doorSide === '+z' || doorSide === '-z') {
      var dz = doorSide === '+z' ? d / 2 + thickness / 2 : -d / 2 - thickness / 2;
      var halfFlank = (w - doorWidth) / 2;
      var flank1 = new THREE.BoxGeometry(halfFlank, h, thickness);
      var flank1Mesh = new THREE.Mesh(flank1, mats.marbleWorn);
      flank1Mesh.position.set(-halfFlank / 2, h / 2, dz);
      flank1Mesh.castShadow = true;
      flank1Mesh.receiveShadow = true;
      group.add(flank1Mesh);

      var flank2 = new THREE.BoxGeometry(halfFlank, h, thickness);
      var flank2Mesh = new THREE.Mesh(flank2, mats.marbleWorn);
      flank2Mesh.position.set(halfFlank / 2, h / 2, dz);
      flank2Mesh.castShadow = true;
      flank2Mesh.receiveShadow = true;
      group.add(flank2Mesh);

      var lintel = new THREE.BoxGeometry(doorWidth, h * 0.3, thickness);
      var lintelMesh = new THREE.Mesh(lintel, mats.marbleWorn);
      lintelMesh.position.set(0, h * 0.7, dz);
      lintelMesh.castShadow = true;
      lintelMesh.receiveShadow = true;
      group.add(lintelMesh);
    } else if (doorSide === '+x' || doorSide === '-x') {
      var dx = doorSide === '+x' ? w / 2 + thickness / 2 : -w / 2 - thickness / 2;
      var halfFlank = (d - doorWidth) / 2;
      var flank1 = new THREE.BoxGeometry(thickness, h, halfFlank);
      var flank1Mesh = new THREE.Mesh(flank1, mats.marbleWorn);
      flank1Mesh.position.set(dx, h / 2, -halfFlank / 2);
      flank1Mesh.castShadow = true;
      flank1Mesh.receiveShadow = true;
      group.add(flank1Mesh);

      var flank2 = new THREE.BoxGeometry(thickness, h, halfFlank);
      var flank2Mesh = new THREE.Mesh(flank2, mats.marbleWorn);
      flank2Mesh.position.set(dx, h / 2, halfFlank / 2);
      flank2Mesh.castShadow = true;
      flank2Mesh.receiveShadow = true;
      group.add(flank2Mesh);

      var lintel = new THREE.BoxGeometry(thickness, h * 0.3, doorWidth);
      var lintelMesh = new THREE.Mesh(lintel, mats.marbleWorn);
      lintelMesh.position.set(dx, h * 0.7, 0);
      lintelMesh.castShadow = true;
      lintelMesh.receiveShadow = true;
      group.add(lintelMesh);
    }

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

  return H;
};
