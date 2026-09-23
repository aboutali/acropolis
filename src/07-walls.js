// Module 07 — Plateau perimeter walls
window.buildWalls = function (THREE, mats, H) {
  var group = new THREE.Group();
  group.position.set(0, -1, 0);

  // Generate perimeter ellipse points with jitter
  var perimeter = [];
  for (var i = 0; i < 28; i++) {
    var a = (i / 28) * Math.PI * 2;
    var jit = 1 + 0.04 * H.noise2(Math.cos(a) * 5, Math.sin(a) * 5, 11);
    var x = -45 + 148 * Math.cos(a) * jit;
    var z = 73 * Math.sin(a) * jit;
    perimeter.push([x, z]);
  }

  // Filter out gate gap (x < -150 and |z| < 20)
  var filtered = [];
  for (var i = 0; i < perimeter.length; i++) {
    var pt = perimeter[i];
    if (!(pt[0] < -150 && Math.abs(pt[1]) < 20)) {
      filtered.push(pt);
    }
  }

  // Check wraparound distance between last and first point
  if (filtered.length > 1) {
    var lastPt = filtered[filtered.length - 1];
    var firstPt = filtered[0];
    var wrapDist = Math.sqrt((firstPt[0] - lastPt[0]) ** 2 + (firstPt[1] - lastPt[1]) ** 2);

    // If wraparound distance is small (not the gate gap), find the real gap and reorder
    if (wrapDist < 50) {
      // Find the large gap (the real gate gap)
      var gapIdx = -1;
      for (var i = 0; i < filtered.length - 1; i++) {
        var curr = filtered[i];
        var next = filtered[i + 1];
        var dist = Math.sqrt((next[0] - curr[0]) ** 2 + (next[1] - curr[1]) ** 2);
        if (dist > 50) {
          gapIdx = i;
          break;
        }
      }

      // If gap found, reorder array to start right after the gap
      if (gapIdx >= 0) {
        var reordered = [];
        for (var i = gapIdx + 1; i < filtered.length; i++) {
          reordered.push(filtered[i]);
        }
        for (var i = 0; i <= gapIdx; i++) {
          reordered.push(filtered[i]);
        }
        filtered = reordered;
      }
    }
  }

  // Split into contiguous runs (separated by the gap)
  var runs = [];
  var currentRun = [];
  for (var i = 0; i < filtered.length; i++) {
    currentRun.push(filtered[i]);
    // Check if we need to break to next run
    var nextIdx = (i + 1) % filtered.length;
    if (i < filtered.length - 1) {
      var curr = filtered[i];
      var next = filtered[nextIdx];
      var dist = Math.sqrt((next[0] - curr[0]) ** 2 + (next[1] - curr[1]) ** 2);
      if (dist > 50) {
        // Large gap indicates separation
        runs.push(currentRun);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  // Build a map of subRuns with their heights for use in ashlar cap
  var allSubRuns = [];

  // For each run, determine height based on z > 40 threshold and build walls
  for (var r = 0; r < runs.length; r++) {
    var run = runs[r];
    // Split run at z = 40 threshold
    var subRuns = [];
    var currentSub = [];
    for (var i = 0; i < run.length; i++) {
      if (currentSub.length > 0) {
        var lastPt = currentSub[currentSub.length - 1];
        var currPt = run[i];
        // Check if we cross z = 40 threshold
        if ((lastPt[1] > 40) !== (currPt[1] > 40)) {
          // Interpolate crossing point
          var t = (40 - lastPt[1]) / (currPt[1] - lastPt[1]);
          var crossX = lastPt[0] + t * (currPt[0] - lastPt[0]);
          currentSub.push([crossX, 40]);
          subRuns.push(currentSub);
          currentSub = [[crossX, 40]];
        }
      }
      currentSub.push(run[i]);
    }
    if (currentSub.length > 0) {
      subRuns.push(currentSub);
    }

    // Build walls for each sub-run and track them
    for (var s = 0; s < subRuns.length; s++) {
      var sub = subRuns[s];
      var avgZ = 0;
      for (var i = 0; i < sub.length; i++) {
        avgZ += sub[i][1];
      }
      avgZ /= sub.length;
      var h = avgZ > 40 ? 9 : 7;
      var wallGroup = H.makeWall(sub, h, 3.5, mats.rockDark);
      group.add(wallGroup);

      // Store this subRun with its height for ashlar cap
      allSubRuns.push({
        points: sub,
        h: h
      });
    }
  }

  // Ashlar cap on south stretch (z > 40) using subRuns
  var ashlarBlocks = [];
  for (var sr = 0; sr < allSubRuns.length; sr++) {
    var subRun = allSubRuns[sr];
    // Only place caps on subRuns with h === 9 (z > 40 portions)
    if (subRun.h === 9) {
      var run = subRun.points;
      // Place blocks along this subRun
      for (var i = 0; i < run.length - 1; i++) {
        var p1 = run[i];
        var p2 = run[i + 1];
        var dx = p2[0] - p1[0];
        var dz = p2[1] - p1[1];
        var segLen = Math.sqrt(dx * dx + dz * dz);
        var angle = Math.atan2(dz, dx);

        // Place blocks every 1.4 units
        for (var dist = 0; dist < segLen; dist += 1.4) {
          var t = dist / segLen;
          var bx = p1[0] + t * dx;
          var bz = p1[1] + t * dz;
          ashlarBlocks.push({
            p: [bx, 9.4, bz],
            r: [0, angle, 0],
            s: [1, 1, 1]
          });
        }
      }
    }
  }

  if (ashlarBlocks.length > 0) {
    var ashlarGeo = new THREE.BoxGeometry(1.3, 0.8, 3.7);
    var ashlarMesh = H.instance(ashlarGeo, mats.marbleWorn, ashlarBlocks);
    group.add(ashlarMesh);
  }

  // Two flanking towers at the gap
  var towerGeo = new THREE.BoxGeometry(8, 11, 8);
  var tower1 = new THREE.Mesh(towerGeo, mats.rockDark);
  tower1.position.set(-158, 5.5, -22);
  tower1.castShadow = true;
  tower1.receiveShadow = true;
  group.add(tower1);

  var tower2 = new THREE.Mesh(towerGeo, mats.rockDark);
  tower2.position.set(-158, 5.5, 22);
  tower2.castShadow = true;
  tower2.receiveShadow = true;
  group.add(tower2);

  // Beulé gate at (-165, 0, 8)
  // Two towers
  var gateTowerGeo = new THREE.BoxGeometry(5, 9, 5);
  var gateTower1 = new THREE.Mesh(gateTowerGeo, mats.marbleWorn);
  gateTower1.position.set(-165, 4.5, 3);
  gateTower1.castShadow = true;
  gateTower1.receiveShadow = true;
  group.add(gateTower1);

  var gateTower2 = new THREE.Mesh(gateTowerGeo, mats.marbleWorn);
  gateTower2.position.set(-165, 4.5, 13);
  gateTower2.castShadow = true;
  gateTower2.receiveShadow = true;
  group.add(gateTower2);

  // Lintel
  var lintelGeo = new THREE.BoxGeometry(1.5, 1.5, 12);
  var lintel = new THREE.Mesh(lintelGeo, mats.marbleWorn);
  lintel.position.set(-165, 8.5, 8);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  group.add(lintel);

  return group;
};
