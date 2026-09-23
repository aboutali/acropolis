// Module 07 — Plateau perimeter walls: battered ashlar/rubble courses, parapet, Beulé gate + bastion
window.buildWalls = function (THREE, mats, H) {
  var group = new THREE.Group();
  group.position.set(0, -1, 0);
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var PI = Math.PI;

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
    if (wrapDist < 50) {
      var gapIdx = -1;
      for (var i = 0; i < filtered.length - 1; i++) {
        var curr = filtered[i];
        var next = filtered[i + 1];
        var dist = Math.sqrt((next[0] - curr[0]) ** 2 + (next[1] - curr[1]) ** 2);
        if (dist > 50) { gapIdx = i; break; }
      }
      if (gapIdx >= 0) {
        var reordered = [];
        for (var i = gapIdx + 1; i < filtered.length; i++) reordered.push(filtered[i]);
        for (var i = 0; i <= gapIdx; i++) reordered.push(filtered[i]);
        filtered = reordered;
      }
    }
  }

  // Split into contiguous runs (separated by the gap)
  var runs = [];
  var currentRun = [];
  for (var i = 0; i < filtered.length; i++) {
    currentRun.push(filtered[i]);
    var nextIdx = (i + 1) % filtered.length;
    if (i < filtered.length - 1) {
      var curr = filtered[i];
      var next = filtered[nextIdx];
      var dist = Math.sqrt((next[0] - curr[0]) ** 2 + (next[1] - curr[1]) ** 2);
      if (dist > 50) { runs.push(currentRun); currentRun = []; }
    }
  }
  if (currentRun.length > 0) runs.push(currentRun);

  // Split each run at z = 40 (Cimonian south wall vs Pelasgian rest) and remember heights.
  var allSubRuns = [];
  for (var r = 0; r < runs.length; r++) {
    var run = runs[r];
    var subRuns = [];
    var currentSub = [];
    for (var i = 0; i < run.length; i++) {
      if (currentSub.length > 0) {
        var lastPt2 = currentSub[currentSub.length - 1];
        var currPt = run[i];
        if ((lastPt2[1] > 40) !== (currPt[1] > 40)) {
          var t = (40 - lastPt2[1]) / (currPt[1] - lastPt2[1]);
          var crossX = lastPt2[0] + t * (currPt[0] - lastPt2[0]);
          currentSub.push([crossX, 40]);
          subRuns.push(currentSub);
          currentSub = [[crossX, 40]];
        }
      }
      currentSub.push(run[i]);
    }
    if (currentSub.length > 0) subRuns.push(currentSub);
    for (var s = 0; s < subRuns.length; s++) {
      var sub = subRuns[s];
      var avgZ = 0;
      for (var i = 0; i < sub.length; i++) avgZ += sub[i][1];
      avgZ /= sub.length;
      var h = avgZ > 40 ? 9 : 7;
      allSubRuns.push({ points: sub, h: h });
    }
  }

  // ---- Battered ashlar/rubble masonry: courses of instanced blocks, wall battered inward with height ----
  var courseGeo = new THREE.BoxGeometry(1, 1, 1);
  var wallT = [], capT = [], parapetT = [];
  var courseH = 0.62;
  for (var sr = 0; sr < allSubRuns.length; sr++) {
    var run = allSubRuns[sr].points, wallH = allSubRuns[sr].h;
    var courses = Math.round(wallH / courseH);
    var baseThick = 3.4;
    // total polyline length -> place blocks at even spacing per course, offset every other course (running bond)
    for (var c = 0; c < courses; c++) {
      var frac = c / courses;
      var batter = baseThick * (1 - 0.22 * frac); // wall thins slightly as it rises
      var cy = c * courseH + courseH / 2;
      var blockLen = 2.1 + 0.4 * ((c % 2));
      var offset = (c % 2) * blockLen * 0.5;
      var dist = -offset;
      for (var seg = 0; seg < run.length - 1; seg++) {
        var p0 = run[seg], p1 = run[seg + 1];
        var dx = p1[0] - p0[0], dz = p1[1] - p0[1];
        var segLen = Math.sqrt(dx * dx + dz * dz);
        var ang = Math.atan2(dz, dx);
        var d0 = dist;
        while (d0 < segLen) {
          if (d0 >= 0) {
            var t = d0 / segLen;
            var bx = p0[0] + t * dx, bz = p0[1] + t * dz;
            var thisLen = Math.min(blockLen, segLen - d0) * (0.9 + 0.1 * H.noise2(bx, cy, 1));
            wallT.push({ p: [bx + Math.cos(ang) * thisLen / 2, cy, bz + Math.sin(ang) * thisLen / 2], r: [0, -ang, 0], s: [thisLen * 0.96, courseH * 0.94, batter] });
          }
          d0 += blockLen;
        }
        dist = d0 - segLen;
      }
    }
    // Coping cap block along the top
    for (var seg2 = 0; seg2 < run.length - 1; seg2++) {
      var p0b = run[seg2], p1b = run[seg2 + 1];
      var dx2 = p1b[0] - p0b[0], dz2 = p1b[1] - p0b[1];
      var segLen2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
      var ang2 = Math.atan2(dz2, dx2);
      var count2 = Math.max(1, Math.round(segLen2 / 1.4));
      for (var k = 0; k < count2; k++) {
        var t2 = (k + 0.5) / count2;
        var bx2 = p0b[0] + t2 * dx2, bz2 = p0b[1] + t2 * dz2;
        capT.push({ p: [bx2, wallH + 0.15, bz2], r: [0, -ang2, 0], s: [1.3, 0.3, 3.7] });
      }
    }
    // Parapet merlons on the south (taller) stretch only
    if (wallH === 9 && !MOBILE) {
      for (var seg3 = 0; seg3 < run.length - 1; seg3++) {
        var p0c = run[seg3], p1c = run[seg3 + 1];
        var dx3 = p1c[0] - p0c[0], dz3 = p1c[1] - p0c[1];
        var segLen3 = Math.sqrt(dx3 * dx3 + dz3 * dz3);
        var ang3 = Math.atan2(dz3, dx3);
        var count3 = Math.max(1, Math.round(segLen3 / 2.2));
        for (var k2 = 0; k2 < count3; k2 += 2) {
          var t3 = (k2 + 0.5) / count3;
          var bx3 = p0c[0] + t3 * dx3, bz3 = p0c[1] + t3 * dz3;
          parapetT.push({ p: [bx3, wallH + 0.9, bz3], r: [0, -ang3, 0], s: [1.1, 1.2, 1.6] });
        }
      }
    }
  }
  group.add(H.instance(courseGeo, mats.rockDark, wallT));
  group.add(H.instance(courseGeo, mats.marbleWorn, capT));
  if (parapetT.length) group.add(H.instance(courseGeo, mats.rockDark, parapetT));

  // Two flanking bastion towers at the gap, with battered coursing
  var towerCourseT = [];
  var towerPositions = [[-158, -22], [-158, 22]];
  for (var tw = 0; tw < 2; tw++) {
    var tx = towerPositions[tw][0], tz = towerPositions[tw][1];
    var towerCourses = 15;
    for (var tc = 0; tc < towerCourses; tc++) {
      var tfrac = tc / towerCourses;
      var tsize = 8.4 * (1 - 0.18 * tfrac);
      towerCourseT.push({ p: [tx, tc * 0.73 + 0.36, tz], s: [tsize, 0.7, tsize] });
    }
  }
  group.add(H.instance(courseGeo, mats.rockDark, towerCourseT));

  // Beulé gate bastion: stepped ashlar podium + two marble towers + lintel
  var bastionT = [];
  var bastionCourses = 6;
  for (var bc = 0; bc < bastionCourses; bc++) {
    var bfrac = bc / bastionCourses;
    bastionT.push({ p: [-165, bc * 0.8 + 0.4, 8], s: [18 * (1 - 0.1 * bfrac), 0.75, 22 * (1 - 0.1 * bfrac)] });
  }
  group.add(H.instance(courseGeo, mats.rockDark, bastionT));

  var gateTowerGeo = new THREE.BoxGeometry(5, 9, 5);
  var gateTower1 = new THREE.Mesh(gateTowerGeo, mats.marbleWorn);
  gateTower1.position.set(-165, 4.5 + 4.8, 3);
  gateTower1.castShadow = true; gateTower1.receiveShadow = true;
  group.add(gateTower1);
  var gateTower2 = new THREE.Mesh(gateTowerGeo, mats.marbleWorn);
  gateTower2.position.set(-165, 4.5 + 4.8, 13);
  gateTower2.castShadow = true; gateTower2.receiveShadow = true;
  group.add(gateTower2);

  var lintelGeo = new THREE.BoxGeometry(1.5, 1.5, 12);
  var lintel = new THREE.Mesh(lintelGeo, mats.marbleWorn);
  lintel.position.set(-165, 8.5 + 4.8, 8);
  lintel.castShadow = true; lintel.receiveShadow = true;
  group.add(lintel);

  // Voussoir arch over the gate passage (real arched opening, not a flat lintel alone)
  var archGeo = new THREE.TorusGeometry(6.2, 0.55, 6, MOBILE ? 10 : 16, PI);
  var gateArch = new THREE.Mesh(archGeo, mats.marbleWorn);
  gateArch.rotation.z = PI;
  gateArch.rotation.y = PI / 2;
  gateArch.position.set(-165, 9.2 + 4.8, 8);
  gateArch.castShadow = true; gateArch.receiveShadow = true;
  group.add(gateArch);

  return group;
};
