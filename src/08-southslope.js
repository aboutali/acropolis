// Module 08: South Slope
window.buildSouthSlope = function (THREE, mats, H) {
  var group = new THREE.Group();

  // Rock apron
  var apron = H.makeRockOutcrop(260, 120, 10, 3);
  apron.position.set(-60, -45, 85);
  apron.rotation.x = 0.31;
  group.add(apron);

  // Theatre of Dionysus
  var theatreGroup = new THREE.Group();
  theatreGroup.position.set(-6, -46, 96);

  // Cavea rings (24 rings)
  for (var i = 0; i < 24; i++) {
    var r = 22 + i * 1.05;
    var cavGeom = new THREE.CylinderGeometry(r, r, 0.6, 40, 1, true, -1.75, 3.5);
    var cavMesh = new THREE.Mesh(cavGeom, mats.marbleShadowed);
    cavMesh.castShadow = true;
    cavMesh.receiveShadow = true;
    cavMesh.rotation.y = Math.PI;
    cavMesh.position.y = i * 0.6;
    theatreGroup.add(cavMesh);
  }

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
  odeonGroup.position.set(-140, -52, 72);

  // 18 rings
  for (var i = 0; i < 18; i++) {
    var r = 14 + i * 1.33;
    var odGeom = new THREE.CylinderGeometry(r, r, 0.8, 40, 1, true, -1.571, 3.142);
    var odMesh = new THREE.Mesh(odGeom, mats.marbleShadowed);
    odMesh.castShadow = true;
    odMesh.receiveShadow = true;
    odMesh.rotation.y = Math.PI;
    odMesh.position.y = i * 0.8;
    odeonGroup.add(odMesh);
  }

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

  return group;
};
