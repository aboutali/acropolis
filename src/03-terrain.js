// Terrain: plateau, cliffs, ground, city blocks, sacred way
window.buildTerrain = function (THREE, mats, H) {
  var group = new THREE.Group();

  // 1. Plateau top
  var top = H.makeRockOutcrop(300, 150, 4, 7);
  var pos = top.geometry.attributes.position;
  var posArray = pos.array;
  for (var i = 0; i < posArray.length; i += 3) {
    var x = posArray[i];
    var y = posArray[i + 1];
    var z = posArray[i + 2];
    var e = Math.sqrt((x / 150) * (x / 150) + (z / 75) * (z / 75));
    if (e < 0.6) {
      posArray[i + 1] = y * 0.25;
    } else if (e > 0.9) {
      posArray[i + 1] = y - (e - 0.9) * 30;
    }
  }
  pos.needsUpdate = true;
  top.geometry.computeVertexNormals();
  top.position.set(-45, 0, 0);
  top.receiveShadow = true;
  group.add(top);

  // 2. Cliff skirt
  var cliffGeo = new THREE.CylinderGeometry(1, 1.06, 80, 40, 6, true);
  var cliffPos = cliffGeo.attributes.position;
  var cliffArray = cliffPos.array;
  for (var i = 0; i < cliffArray.length; i += 3) {
    var x = cliffArray[i];
    var y = cliffArray[i + 1];
    var z = cliffArray[i + 2];
    var f = 1 + 0.04 * H.noise2(x * 3, y * 0.05, 3);
    cliffArray[i] = x * f;
    cliffArray[i + 2] = z * f;
  }
  cliffPos.needsUpdate = true;
  cliffGeo.computeVertexNormals();
  var cliffMesh = new THREE.Mesh(cliffGeo, mats.rockDark);
  cliffMesh.scale.set(150, 1, 75);
  cliffMesh.position.set(-45, -39, 0);
  cliffMesh.castShadow = true;
  cliffMesh.receiveShadow = true;
  group.add(cliffMesh);

  // 3. Ground
  var groundGeo = new THREE.PlaneGeometry(3000, 3000);
  groundGeo.rotateX(-Math.PI / 2);
  var groundMesh = new THREE.Mesh(groundGeo, mats.ground);
  groundMesh.position.y = -80.4;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // 4. City blocks (LCG)
  var transforms = [];
  var seed = 7;
  var count = 0;
  while (count < 220) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    var angle = ((seed >>> 16) & 0x7FFF) / 0x7FFF * 2 * Math.PI;
    seed = (seed * 1103515245 + 12345) >>> 0;
    var r = 220 + ((seed >>> 16) & 0x7FFF) / 0x7FFF * 1080;
    var x = r * Math.cos(angle);
    var z = r * Math.sin(angle);
    var dx = x + 45;
    var ellipse = (dx / 160) * (dx / 160) + (z / 85) * (z / 85);
    if (ellipse < 1) continue;

    seed = (seed * 1103515245 + 12345) >>> 0;
    var sx = 8 + ((seed >>> 16) & 0x7FFF) / 0x7FFF * 14;
    seed = (seed * 1103515245 + 12345) >>> 0;
    var sz = 8 + ((seed >>> 16) & 0x7FFF) / 0x7FFF * 14;
    seed = (seed * 1103515245 + 12345) >>> 0;
    var sy = 6 + ((seed >>> 16) & 0x7FFF) / 0x7FFF * 10;
    seed = (seed * 1103515245 + 12345) >>> 0;
    var yaw = ((seed >>> 16) & 0x7FFF) / 0x7FFF * 2 * Math.PI;

    transforms.push({
      p: [x, -80 + sy / 2, z],
      r: [0, yaw, 0],
      s: [sx, sy, sz]
    });
    count++;
  }
  var cityMesh = H.instance(new THREE.BoxGeometry(1, 1, 1), mats.city, transforms);
  group.add(cityMesh);

  // 5. Sacred Way (30 boxes)
  var sacredTransforms = [];
  for (var i = 0; i < 30; i++) {
    var t = i / 29;
    var px = -200 + t * 60;
    var py = -60 + t * 58;
    var pz = 40 + t * (-36);
    sacredTransforms.push({
      p: [px, py, pz],
      r: [0, 0, 0],
      s: [6, 0.3, 5]
    });
  }
  var sacredMesh = H.instance(new THREE.BoxGeometry(1, 1, 1), mats.marbleShadowed, sacredTransforms);
  sacredMesh.castShadow = false;
  sacredMesh.receiveShadow = true;
  group.add(sacredMesh);

  return group;
};
