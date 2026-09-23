// Module 09 - Scenery
window.buildScenery = function (THREE, mats, H) {
  var group = new THREE.Group();

  // Deterministic LCG (seed 42)
  var s = 42;
  function rnd() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  }

  // Athena Promachos at (-62, 0, -12), built by 13-figures.js
  var promachos = H.makePromachos({});
  promachos.position.set(-62, 0, -12);
  group.add(promachos);

  // Great Altar at (-8, 0, -41)
  var altar = new THREE.Group();
  altar.position.set(-8, 0, -41);

  var altarBase = new THREE.Mesh(
    new THREE.BoxGeometry(12, 2.2, 6),
    mats.marble
  );
  altarBase.position.y = 1.1;
  altarBase.castShadow = true;
  altarBase.receiveShadow = true;
  altar.add(altarBase);

  var altarTop = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.6, 4),
    mats.marble
  );
  altarTop.position.y = 2.5;
  altarTop.castShadow = true;
  altarTop.receiveShadow = true;
  altar.add(altarTop);

  group.add(altar);

  // Olive trees - 34 trees
  var oliveTrees = [];
  var oliveCount = 0;
  var maxAttempts = 1000;
  var attempts = 0;

  while (oliveCount < 34 && attempts < maxAttempts) {
    attempts++;

    var angle = rnd() * Math.PI * 2;
    var radiusFactor = 0.78 + rnd() * (0.92 - 0.78);
    var rx = 148;
    var rz = 73;
    var x = -45 + Math.cos(angle) * rx * radiusFactor;
    var z = 0 + Math.sin(angle) * rz * radiusFactor;

    var excluded = false;
    var exclusions = [
      {x0: -18, z0: -38, x1: 18, z1: 38},      // Parthenon
      {x0: -56, z0: -46, x1: -28, z1: -22},    // Erechtheion
      {x0: -135, z0: -30, x1: -100, z1: 25},   // Propylaea
      {x0: -140, z0: 12, x1: -126, z1: 28},    // Nike
      {x0: -66, z0: -16, x1: -58, z1: -8},     // Promachos
      {x0: -16, z0: -46, x1: 0, z1: -36}       // Altar
    ];

    for (var i = 0; i < exclusions.length; i++) {
      var ex = exclusions[i];
      if (x >= ex.x0 && x <= ex.x1 && z >= ex.z0 && z <= ex.z1) {
        excluded = true;
        break;
      }
    }

    if (!excluded) {
      oliveTrees.push({x: x, z: z});
      oliveCount++;
    }
  }

  // Olive trunks
  var oliveTrunkTransforms = [];
  for (var i = 0; i < oliveTrees.length; i++) {
    oliveTrunkTransforms.push({p: [oliveTrees[i].x, 1.3, oliveTrees[i].z]});
  }

  var oliveTrunk = H.instance(
    new THREE.CylinderGeometry(0.25, 0.4, 2.6, 8),
    mats.trunk,
    oliveTrunkTransforms
  );
  group.add(oliveTrunk);

  // Olive canopies - 3 blobs per tree
  var oliveCanopyTransforms = [];
  for (var i = 0; i < oliveTrees.length; i++) {
    var tree = oliveTrees[i];
    for (var j = 0; j < 3; j++) {
      var offsetAngle = (j / 3) * Math.PI * 2;
      var offsetDist = 1.5;
      var offsetX = tree.x + Math.cos(offsetAngle) * offsetDist;
      var offsetZ = tree.z + Math.sin(offsetAngle) * offsetDist;
      var offsetY = 3.5 + (rnd() - 0.5) * 2 * 0.8;
      var scale = 0.8 + rnd() * (1.2 - 0.8);
      oliveCanopyTransforms.push({
        p: [offsetX, offsetY, offsetZ],
        s: [scale, scale, scale]
      });
    }
  }

  var oliveCanopy = H.instance(
    new THREE.IcosahedronGeometry(1.9, 0),
    mats.foliageOlive,
    oliveCanopyTransforms
  );
  group.add(oliveCanopy);

  // Cypresses live in 08-southslope, which drops them onto the carved rock apron

  // Rubble blocks - 60 blocks on ellipse at radius factor [0.85, 0.93]
  var rubbleTransforms = [];
  for (var i = 0; i < 60; i++) {
    var angle = (i / 60) * Math.PI * 2;
    var radiusFactor = 0.85 + rnd() * (0.93 - 0.85);
    var rx = 148;
    var rz = 73;
    var rbx = -45 + Math.cos(angle) * rx * radiusFactor;
    var rbz = 0 + Math.sin(angle) * rz * radiusFactor;
    var yaw = rnd() * Math.PI * 2;

    rubbleTransforms.push({
      p: [rbx, 0.25, rbz],
      r: [0, yaw, 0]
    });
  }

  var rubble = H.instance(
    new THREE.BoxGeometry(1.2, 0.5, 0.8),
    mats.marbleWorn,
    rubbleTransforms
  );
  group.add(rubble);

  return group;
};
