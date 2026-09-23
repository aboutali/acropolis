// Erechtheion: complex split-level temple with east/north/south/west porches and olive tree
window.buildErechtheion = function (THREE, mats, H) {
  var group = new THREE.Group();
  group.position.set(-42, 0, -34);

  // Base: stepped base for the main structure
  var base = H.makeSteppedBase(22.8, 11.6, 2, 0.5);
  group.add(base);

  // Main block: cella with entablature and gable roof
  var cella = H.makeCella(22.8, 11.6, 6.6, {doorWidth: 3, doorSide: '+x'});
  group.add(cella);

  var entablatureMain = H.makeEntablature(22.8, 11.6, 1.6, {triglyphs: false});
  entablatureMain.position.y = 6.6;
  group.add(entablatureMain);

  var roofMain = H.makeGableRoof(11.6, 22.8, 0.2, {tiles: true});
  roofMain.rotation.y = Math.PI / 2;
  roofMain.position.y = 8.2;
  group.add(roofMain);

  // East porch: 6 Ionic columns at x = 12.9, z evenly spaced from -5.2 to 5.2
  var eastPositions = [
    [12.9, -5.2],
    [12.9, -3.12],
    [12.9, -1.04],
    [12.9, 1.04],
    [12.9, 3.12],
    [12.9, 5.2]
  ];
  var eastColumns = H.makeIonicColumns(eastPositions, {height: 6.6, baseD: 0.85});
  group.add(eastColumns);

  // North porch: split-level (3.2m below main floor)
  // Floor slab
  var northFloor = new THREE.Mesh(
    new THREE.BoxGeometry(10.6, 0.5, 6.6),
    mats.marble
  );
  northFloor.position.set(-7, -3.45, -8.9);
  northFloor.castShadow = true;
  northFloor.receiveShadow = true;
  group.add(northFloor);

  // 4 front Ionic columns at z = -11.6, x evenly spaced from -11.2 to -2.8
  var northFrontPositions = [[-11.2, -11.6], [-8.4, -11.6], [-5.6, -11.6], [-2.8, -11.6]];
  var northFrontColumns = H.makeIonicColumns(northFrontPositions, {
    height: 7.63,
    baseD: 0.92,
    y: -3.2
  });
  group.add(northFrontColumns);

  // 2 side columns
  var northSidePositions = [
    [-11.2, -8.6],
    [-2.8, -8.6]
  ];
  var northSideColumns = H.makeIonicColumns(northSidePositions, {
    height: 7.63,
    baseD: 0.92,
    y: -3.2
  });
  group.add(northSideColumns);

  // North entablature
  var entablatureNorth = H.makeEntablature(10.6, 6.4, 1.2, {triglyphs: false});
  entablatureNorth.position.set(-7, 4.43, -8.9);
  group.add(entablatureNorth);

  // North roof slab
  var northRoof = new THREE.Mesh(
    new THREE.BoxGeometry(11.2, 0.6, 7.0),
    mats.marble
  );
  northRoof.position.set(-7, 5.93, -8.9);
  northRoof.castShadow = true;
  northRoof.receiveShadow = true;
  group.add(northRoof);

  // South porch: caryatid porch centred at (+6, 0, +5.8)
  // Podium
  var caryatidPodium = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 1.8, 3.1),
    mats.marbleWorn
  );
  caryatidPodium.position.set(6, 0.9, 5.8);
  caryatidPodium.castShadow = true;
  caryatidPodium.receiveShadow = true;
  group.add(caryatidPodium);

  // 6 caryatids at y = 1.8
  // Front row: 4 caryatids at z = 5.8 + 1.2 = 6.8, x = 6 + (-1.9, -0.63, 0.63, 1.9)
  var frontXPositions = [-1.9, -0.63, 0.63, 1.9];
  for (var i = 0; i < frontXPositions.length; i++) {
    var caryatid = H.makeCaryatid(2.3);
    caryatid.position.set(6 + frontXPositions[i], 1.8, 6.8);
    group.add(caryatid);
  }

  // Rear row: 2 caryatids at z = 5.8 - 0.1 = 5.7, x = 6 ± 1.9
  for (var j = 0; j < 2; j++) {
    var caryatidRear = H.makeCaryatid(2.3);
    var xPos = j === 0 ? 6 - 1.9 : 6 + 1.9;
    caryatidRear.position.set(xPos, 1.8, 5.7);
    group.add(caryatidRear);
  }

  // Caryatid entablature slab
  var caryatidEntabSlab = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.9, 3.5),
    mats.marble
  );
  caryatidEntabSlab.position.set(6, 1.8 + 2.3 + 0.45, 5.8);
  caryatidEntabSlab.castShadow = true;
  caryatidEntabSlab.receiveShadow = true;
  group.add(caryatidEntabSlab);

  // West wall: 4 engaged half-columns at x = -11.6, z evenly spaced from -4 to 4
  var westPositions = [
    [-11.6, -4],
    [-11.6, -1.33333],
    [-11.6, 1.33333],
    [-11.6, 4]
  ];
  var westColumns = H.makeIonicColumns(westPositions, {
    height: 5.8,
    baseD: 0.7
  });
  group.add(westColumns);

  // Olive tree at local (-13, 0, 4)
  // Trunk
  var trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 2.6, 8),
    mats.trunk
  );
  trunk.position.set(-13, 1.3, 4);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // 3 canopy icosahedra around y = 3.5, offset ±1 in z
  var canopyZPositions = [-1, 0, 1];
  var canopyGeo = new THREE.IcosahedronGeometry(1.9, 0);
  for (var k = 0; k < canopyZPositions.length; k++) {
    var canopy = new THREE.Mesh(canopyGeo, mats.foliageOlive);
    canopy.position.set(-13, 3.5, 4 + canopyZPositions[k]);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    group.add(canopy);
  }

  return group;
};
