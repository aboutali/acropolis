// Propylaea (central hall, wings, Nike bastion & temple)
window.buildPropylaea = function (THREE, mats, H) {
  if (window.addFigureHelpers && !window.__figuresWired) {
    window.__figuresWired = true;
    window.addFigureHelpers(THREE, mats, H);
  }

  var group = new THREE.Group();
  group.position.set(-118, 0, -6);

  // CENTRAL HALL

  var centralBase = H.makeSteppedBase(24, 18, 4, 0.5);
  group.add(centralBase);

  // West façade: 6 Doric columns at x = -10.5, z evenly in [-7.5, 7.5]
  var westPos = [];
  for (var i = 0; i < 6; i++) {
    var z = -7.5 + (i / 5) * 15;
    westPos.push([-10.5, z]);
  }
  var westCols = H.makeDoricColumns(westPos, { height: 8.57, baseD: 1.6, topD: 1.25 });
  group.add(westCols);

  // East façade: 6 Doric columns at x = +10.5, same z
  var eastPos = [];
  for (var i = 0; i < 6; i++) {
    var z = -7.5 + (i / 5) * 15;
    eastPos.push([10.5, z]);
  }
  var eastCols = H.makeDoricColumns(eastPos, { height: 8.0, baseD: 1.5, topD: 1.2 });
  group.add(eastCols);

  // Interior: 6 Ionic columns in two rows of 3 (colonnade runs along x, so
  // rotY faces the volutes along z, across the processional way).
  var ionicPos = [];
  for (var row = 0; row < 2; row++) {
    var z = row === 0 ? -2.6 : 2.6;
    for (var col = 0; col < 3; col++) {
      var x = -5 + col * 5;
      ionicPos.push([x, z]);
    }
  }
  var ionicCols = H.makeIonicColumns(ionicPos, { height: 10.25, baseD: 1.0 });
  group.add(ionicCols);

  // Cross-wall at x = +3: 6 pillars and lintel
  var zPositions = [-8.5, -5.4, -2.2, 2.2, 5.4, 8.5];
  var pillarGeo = new THREE.BoxGeometry(1.5, 9, 1.3);
  for (var i = 0; i < zPositions.length; i++) {
    var pillar = new THREE.Mesh(pillarGeo, mats.marbleWorn);
    pillar.position.set(3, 4.5, zPositions[i]);
    pillar.castShadow = true; pillar.receiveShadow = true;
    group.add(pillar);
  }

  var lintelGeo = new THREE.BoxGeometry(1.5, 2, 18);
  var lintel = new THREE.Mesh(lintelGeo, mats.marbleWorn);
  lintel.position.set(3, 8, 0);
  lintel.castShadow = true; lintel.receiveShadow = true;
  group.add(lintel);

  // Entablature (Doric)
  var entablature = H.makeEntablature(24, 18, 2.6, { triglyphs: true, triglyphCount: 12, zCount: 9 });
  entablature.position.y = 8.57;
  group.add(entablature);

  // Pediments
  var pediment1 = H.makePediment(18, 1.0, 2.6, { figures: 0 });
  pediment1.position.set(-12, 11.17, 0);
  pediment1.rotation.y = -Math.PI / 2;
  group.add(pediment1);

  var pediment2 = H.makePediment(18, 1.0, 2.6, { figures: 0 });
  pediment2.position.set(12, 11.17, 0);
  pediment2.rotation.y = Math.PI / 2;
  group.add(pediment2);

  // Roof
  var roof = H.makeGableRoof(18, 24, 0.24, { tiles: true });
  roof.position.y = 11.2;
  roof.rotation.y = Math.PI / 2;
  group.add(roof);

  // WINGS

  // North wing (Pinakotheke) centred at local (-8, 0, -16)
  var northBase = H.makeSteppedBase(12, 10, 2, 0.5);
  northBase.position.set(-8, 0, -16);
  group.add(northBase);

  var northCella = H.makeCella(12, 10, 5.4, { doorWidth: 2.5, doorSide: '+z' });
  northCella.position.set(-8, 0, -16);
  group.add(northCella);

  var northColPos = [];
  for (var i = 0; i < 3; i++) {
    var x = -8 + (-4 + i * 4);
    northColPos.push([x, -16 + 5.5]);
  }
  var northCols = H.makeDoricColumns(northColPos, { height: 5.4, baseD: 1.0, topD: 0.8 });
  group.add(northCols);

  var northRoofGeo = new THREE.BoxGeometry(12.6, 0.5, 10.6);
  var northRoof = new THREE.Mesh(northRoofGeo, mats.marble);
  northRoof.position.set(-8, 5.65, -16);
  northRoof.castShadow = true; northRoof.receiveShadow = true;
  group.add(northRoof);

  // South wing centred at local (-8, 0, +17)
  var southBase = H.makeSteppedBase(9, 8, 2, 0.5);
  southBase.position.set(-8, 0, 17);
  group.add(southBase);

  var southCella = H.makeCella(9, 8, 5.4, { doorWidth: 2.5, doorSide: '-z' });
  southCella.position.set(-8, 0, 17);
  group.add(southCella);

  var southColPos = [];
  for (var i = 0; i < 3; i++) {
    var x = -8 + (-3 + i * 3);
    southColPos.push([x, 17 - 4.5]);
  }
  var southCols = H.makeDoricColumns(southColPos, { height: 5.4, baseD: 1.0, topD: 0.8 });
  group.add(southCols);

  var southRoofGeo = new THREE.BoxGeometry(9.6, 0.5, 8.6);
  var southRoof = new THREE.Mesh(southRoofGeo, mats.marble);
  southRoof.position.set(-8, 5.65, 17);
  southRoof.castShadow = true; southRoof.receiveShadow = true;
  group.add(southRoof);

  // NIKE BASTION AND TEMPLE centred at local (-15, 0, +26)

  var bastionGeo = new THREE.BoxGeometry(9.6, 6, 11.5);
  var bastion = new THREE.Mesh(bastionGeo, mats.rock);
  bastion.position.set(-15, 0.2, 26);
  bastion.castShadow = true; bastion.receiveShadow = true;
  group.add(bastion);

  var ashlarCap = H.makeBlockCourse(9.6, 11.5, 1.2, 1.4);
  ashlarCap.position.set(-15, 2.0, 26);
  group.add(ashlarCap);

  var postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
  var postPositions = [
    [-15 - 4.8, 3.8, 26 - 5.75], [-15 - 4.8, 3.8, 26 + 5.75],
    [-15 + 4.8, 3.8, 26 - 5.75], [-15 + 4.8, 3.8, 26 + 5.75],
    [-15, 3.8, 26 - 5.75], [-15, 3.8, 26 + 5.75]
  ];
  var postTransforms = [];
  for (var i = 0; i < postPositions.length; i++) postTransforms.push({ p: postPositions[i] });
  var posts = H.instance(postGeo, mats.bronze, postTransforms);
  group.add(posts);

  // Temple of Athena Nike - stepped base
  var templeBase = H.makeSteppedBase(5.44, 8.27, 2, 0.35);
  templeBase.position.set(-15, 3.9, 26);
  group.add(templeBase);

  // Ionic columns: 4 on each short end (rotY faces the volutes along x,
  // across the temple's short ends, matching the real amphiprostyle plan).
  var templeColPos = [];
  var zEnds = [26 - 3.4, 26 + 3.4];
  for (var end = 0; end < 2; end++) {
    var z = zEnds[end];
    for (var col = 0; col < 4; col++) {
      var x = -15 + (-2.1 + (col / 3) * 4.2);
      templeColPos.push([x, z]);
    }
  }
  var templeCols = H.makeIonicColumns(templeColPos, { height: 4.0, baseD: 0.52, y: 3.9, rotY: Math.PI / 2 });
  group.add(templeCols);

  // Cella
  var templeCella = H.makeCella(3.7, 4.4, 4.0, { doorWidth: 1.4, doorSide: '+z', thickness: 0.4 });
  templeCella.position.set(-15, 3.9, 26);
  group.add(templeCella);

  // Entablature (Ionic)
  var templeEntablature = H.makeEntablature(5.44, 8.27, 1.1, { order: 'ionic', triglyphs: false });
  templeEntablature.position.set(-15, 7.9, 26);
  group.add(templeEntablature);

  // Roof
  var templeRoof = H.makeGableRoof(5.6, 8.4, 0.18, { tiles: true });
  templeRoof.position.set(-15, 9.0, 26);
  group.add(templeRoof);

  // Pediments
  var templePediment1 = H.makePediment(5.6, 0.5, 0.9, { figures: 0 });
  templePediment1.position.set(-15, 9.0, 26 - 4.2);
  group.add(templePediment1);

  var templePediment2 = H.makePediment(5.6, 0.5, 0.9, { figures: 0 });
  templePediment2.position.set(-15, 9.0, 26 + 4.2);
  templePediment2.rotation.y = Math.PI;
  group.add(templePediment2);

  return group;
};
