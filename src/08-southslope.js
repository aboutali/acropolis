// Module 08: South Slope
window.buildSouthSlope = function (THREE, mats, H) {
  var group = new THREE.Group();

  // Stepped auditorium as one mesh: per row a riser facing the orchestra and a tread facing up.
  // Rows open toward +z; phi runs from -halfA to +halfA around the -z axis.
  var seatMat = mats.marbleShadowed.clone();
  seatMat.side = THREE.DoubleSide;
  function makeCavea(r0, dr, dy, rows, halfA, segs) {
    var pos = [];
    function quad(a, b, c, d) { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]); }
    function pt(r, y, phi) { return [r * Math.sin(phi), y, -r * Math.cos(phi)]; }
    for (var i = 0; i < rows; i++) {
      var r = r0 + i * dr, y0 = i * dy, y1 = (i + 1) * dy;
      for (var k = 0; k < segs; k++) {
        var p0 = -halfA + (2 * halfA * k) / segs, p1 = -halfA + (2 * halfA * (k + 1)) / segs;
        quad(pt(r, y0, p0), pt(r, y1, p0), pt(r, y1, p1), pt(r, y0, p1));
        quad(pt(r, y1, p0), pt(r + dr, y1, p0), pt(r + dr, y1, p1), pt(r, y1, p1));
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, seatMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Rock apron
  var apron = H.makeRockOutcrop(260, 120, 10, 3);
  apron.position.set(-60, -45, 85);
  apron.rotation.x = 0.31;
  group.add(apron);

  // Theatre of Dionysus
  var theatreGroup = new THREE.Group();
  // Seats start at the foot of the cliff skirt (radius 22 + 24 rows reach z = 78)
  theatreGroup.position.set(-6, -55, 124);

  // Cavea: 24 rows
  theatreGroup.add(makeCavea(22, 1.05, 0.6, 24, 1.75, 40));

  // Orchestra
  var orchGeom = new THREE.CylinderGeometry(19, 19, 0.3, 40);
  var orchMesh = new THREE.Mesh(orchGeom, mats.marble);
  orchMesh.castShadow = true;
  orchMesh.receiveShadow = true;
  orchMesh.position.y = -0.15;
  theatreGroup.add(orchMesh);

  // Skene wall
  var skeneGeom = new THREE.BoxGeometry(30, 6, 3);
  var skeneMesh = new THREE.Mesh(skeneGeom, mats.marbleWorn);
  skeneMesh.castShadow = true;
  skeneMesh.receiveShadow = true;
  skeneMesh.position.set(0, 3, 20);
  theatreGroup.add(skeneMesh);

  group.add(theatreGroup);

  // Odeon of Herodes Atticus
  var odeonGroup = new THREE.Group();
  odeonGroup.position.set(-140, -52, 101);

  // Cavea: 18 rows in a half circle
  odeonGroup.add(makeCavea(14, 1.33, 0.8, 18, Math.PI / 2, 32));

  // Half-disc orchestra
  var odorchGeom = new THREE.CylinderGeometry(12, 12, 0.3, 32, 1, false, -1.571, 3.142);
  var odorchMesh = new THREE.Mesh(odorchGeom, mats.marble);
  odorchMesh.castShadow = true;
  odorchMesh.receiveShadow = true;
  odorchMesh.rotation.y = Math.PI;
  odorchMesh.position.y = -0.15;
  odeonGroup.add(odorchMesh);

  // Stage wall
  var stageGeom = new THREE.BoxGeometry(76, 22, 3);
  var stageMesh = new THREE.Mesh(stageGeom, mats.rock);
  stageMesh.castShadow = true;
  stageMesh.receiveShadow = true;
  stageMesh.position.set(0, 11, 22);
  odeonGroup.add(stageMesh);

  // Niches: 3 tiers × 8 = 24 niches
  var nicheGeom = new THREE.BoxGeometry(3, 5, 0.8);
  var nicheTransforms = [];
  for (var tier = 0; tier < 3; tier++) {
    var tierY = [4, 10, 16][tier];
    for (var j = 0; j < 8; j++) {
      var tierX = -33 + (j * 66 / 7);
      nicheTransforms.push({
        p: [tierX, tierY, 22 - 1.2]
      });
    }
  }
  var nicheInstances = H.instance(nicheGeom, mats.marbleShadowed, nicheTransforms);
  odeonGroup.add(nicheInstances);

  // Arches: 3 tiers × 8 = 24 arches
  var archGeom = new THREE.TorusGeometry(1.5, 0.3, 8, 16, Math.PI);
  var archTransforms = [];
  for (var tier = 0; tier < 3; tier++) {
    var tierBaseY = [4, 10, 16][tier];
    var tierY = tierBaseY + 2.5;
    for (var j = 0; j < 8; j++) {
      var tierX = -33 + (j * 66 / 7);
      archTransforms.push({
        p: [tierX, tierY, 22 - 1.2]
      });
    }
  }
  var archInstances = H.instance(archGeom, mats.rock, archTransforms);
  odeonGroup.add(archInstances);

  group.add(odeonGroup);

  // Carve the rock apron so both auditoria and their stages sit on the slope.
  // Each entry: centre, floor y, first-row radius, row depth, row rise, rows, stage half-width, stage depth.
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

  // Cypresses: scattered around the auditoria, each dropped onto the apron by a downward ray
  var seed = 11;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  apron.updateMatrixWorld(true);
  var ray = new THREE.Raycaster();
  var down = new THREE.Vector3(0, -1, 0);
  var canopyT = [], trunkT = [];
  for (var tries = 0; tries < 200 && canopyT.length < 16; tries++) {
    var cx = -175 + rnd() * 215, cz = 70 + rnd() * 70;
    if (floorAt(cx, cz) < Infinity) continue;
    ray.set(new THREE.Vector3(cx, 50, cz), down);
    var hit = ray.intersectObject(apron);
    if (!hit.length || hit[0].point.y < -75) continue;
    var gy = hit[0].point.y, sc = 0.8 + rnd() * 0.5;
    canopyT.push({ p: [cx, gy + 1.2 + 4.5 * sc, cz], s: [sc, sc, sc] });
    trunkT.push({ p: [cx, gy + 0.75, cz] });
  }
  group.add(H.instance(new THREE.ConeGeometry(1.3, 9, 8), mats.foliageCypress, canopyT));
  group.add(H.instance(new THREE.CylinderGeometry(0.2, 0.25, 1.5, 6), mats.trunk, trunkT));

  return group;
};
