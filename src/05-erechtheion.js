// Erechtheion: complex split-level temple with east/north/south/west porches and olive tree
window.buildErechtheion = function (THREE, mats, H) {
  if (window.addFigureHelpers && !window.__figuresWired) {
    window.__figuresWired = true;
    window.addFigureHelpers(THREE, mats, H);
  }

  var group = new THREE.Group();
  // y = 1.0 lifts the two base steps above the plateau
  group.position.set(-42, 1.0, -34);

  // Base: stepped base for the main structure
  var base = H.makeSteppedBase(22.8, 11.6, 2, 0.5);
  group.add(base);

  // Main block: ashlar-coursed cella with entablature and gable roof
  var cella = H.makeCella(19.0, 10.0, 6.6, { doorWidth: 3, doorSide: '+x', thickness: 0.8 });
  group.add(cella);

  // Ionic entablature: egg-and-dart cornice band, three-fascia architrave
  var entablatureMain = H.makeEntablature(22.8, 11.6, 1.6, { order: 'ionic', triglyphs: false });
  entablatureMain.position.y = 6.6;
  group.add(entablatureMain);

  var roofMain = H.makeGableRoof(11.6, 22.8, 0.2, { tiles: true });
  roofMain.rotation.y = Math.PI / 2;
  roofMain.position.y = 8.2;
  group.add(roofMain);

  // East porch: 6 Ionic columns at x = 11.0, z evenly spaced from -5.2 to 5.2
  // rotY orients the volute pair to face outward (east), across the porch front.
  var eastPositions = [
    [11.0, -5.2], [11.0, -3.12], [11.0, -1.04],
    [11.0, 1.04], [11.0, 3.12], [11.0, 5.2]
  ];
  var eastColumns = H.makeIonicColumns(eastPositions, { height: 6.6, baseD: 0.85, rotY: Math.PI / 2 });
  group.add(eastColumns);

  // North porch: split-level, 3.2 m below the main floor (left buried, as the
  // real porch is genuinely lower than the temple's east end — this is
  // architecturally correct, not a bug).
  // Floor slab
  var northFloor = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.5, 6.6), mats.marble);
  northFloor.position.set(-7, -3.45, -8.9);
  northFloor.castShadow = true; northFloor.receiveShadow = true;
  group.add(northFloor);

  // 4 front Ionic columns at z = -11.6, x evenly spaced from -11.2 to -2.8
  var northFrontPositions = [[-11.2, -11.6], [-8.4, -11.6], [-5.6, -11.6], [-2.8, -11.6]];
  var northFrontColumns = H.makeIonicColumns(northFrontPositions, { height: 7.63, baseD: 0.92, y: -3.2 });
  group.add(northFrontColumns);

  // 2 side columns
  var northSidePositions = [[-11.2, -8.6], [-2.8, -8.6]];
  var northSideColumns = H.makeIonicColumns(northSidePositions, { height: 7.63, baseD: 0.92, y: -3.2, rotY: Math.PI / 2 });
  group.add(northSideColumns);

  // North entablature (Ionic)
  var entablatureNorth = H.makeEntablature(10.6, 6.4, 1.2, { order: 'ionic', triglyphs: false });
  entablatureNorth.position.set(-7, 4.43, -8.9);
  group.add(entablatureNorth);

  // North roof slab
  var northRoof = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.6, 7.0), mats.marble);
  northRoof.position.set(-7, 5.93, -8.9);
  northRoof.castShadow = true; northRoof.receiveShadow = true;
  group.add(northRoof);

  // South porch: caryatid porch centred at (+6, 0, +7.35), in front of the south wall
  // Podium
  var caryatidPodium = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.8, 3.1), mats.marbleWorn);
  caryatidPodium.position.set(6, 0.9, 7.35);
  caryatidPodium.castShadow = true; caryatidPodium.receiveShadow = true;
  group.add(caryatidPodium);

  // 6 caryatids at y = 1.8
  var frontXPositions = [-1.9, -0.63, 0.63, 1.9];
  for (var i = 0; i < frontXPositions.length; i++) {
    var caryatid = H.makeCaryatid(2.3);
    caryatid.position.set(6 + frontXPositions[i], 1.8, 8.3);
    group.add(caryatid);
  }
  for (var j = 0; j < 2; j++) {
    var caryatidRear = H.makeCaryatid(2.3);
    var xPos = j === 0 ? 6 - 1.9 : 6 + 1.9;
    caryatidRear.position.set(xPos, 1.8, 6.6);
    group.add(caryatidRear);
  }

  // Caryatid porch entablature: a three-fascia Ionic architrave, a dentil
  // course, and a projecting cornice — not a plain slab. Cheap (a handful of
  // boxes plus one small instanced dentil row), but reads as a real order
  // resting on the maidens' heads instead of a block of stone.
  (function () {
    var capW = 5.4, capD = 3.5, capY = 1.8 + 2.3 + 0.05;
    // Dentils enlarged and spaced coarser (0.12x0.14 @ ~0.2 spacing -> 0.2x0.22
    // @ ~0.32 spacing, close to the art director's own suggested numbers):
    // the old row read as an indistinct speckle at normal viewing distance.
    // A dark recessed soffit backing sits directly behind the row (new) so
    // each tooth reads as a raised block against a shadowed background
    // instead of floating cubes with nothing behind them, and the teeth now
    // project past the fascia's own edge for a real cast-shadow line.
    var archH = 0.42, dentilH = 0.22, corniceH = 0.33;
    var fasciaH = archH / 3;
    for (var fb = 0; fb < 3; fb++) {
      var fw = capW - fb * 0.05, fd = capD - fb * 0.05;
      var fascia = new THREE.Mesh(new THREE.BoxGeometry(fw, fasciaH * 0.94, fd), mats.marble);
      fascia.position.set(6, capY + fasciaH * (fb + 0.5), 7.35);
      fascia.castShadow = true; fascia.receiveShadow = true;
      group.add(fascia);
    }
    var dentilY = capY + archH + dentilH / 2;
    var dentilSpacing = 0.32;
    var dCount = Math.max(3, Math.round(capW / dentilSpacing));
    dentilSpacing = capW / dCount;
    var dentilW = dentilSpacing * 0.62;
    var dentilDepth = 0.3;
    var soffitGeo = new THREE.BoxGeometry(capW - 0.08, dentilH * 0.92, 0.14);
    var soffitT = [
      { p: [6, dentilY, 7.35 + capD / 2 - 0.16] },
      { p: [6, dentilY, 7.35 - capD / 2 + 0.16] }
    ];
    group.add(H.instance(soffitGeo, mats.marbleShadowed, soffitT));
    var dentilGeo = new THREE.BoxGeometry(dentilW, dentilH, dentilDepth);
    var dentilT = [];
    for (var di = 0; di < dCount; di++) {
      var dx = 6 - capW / 2 + (di + 0.5) * dentilSpacing;
      dentilT.push({ p: [dx, dentilY, 7.35 + capD / 2 - 0.05 + dentilDepth * 0.15] });
      dentilT.push({ p: [dx, dentilY, 7.35 - capD / 2 + 0.05 - dentilDepth * 0.15] });
    }
    group.add(H.instance(dentilGeo, mats.marble, dentilT));
    var corniceOvh = 0.18;
    var cornice = new THREE.Mesh(new THREE.BoxGeometry(capW + 2 * corniceOvh, corniceH, capD + 2 * corniceOvh), mats.marbleWorn);
    cornice.position.set(6, capY + archH + dentilH + corniceH / 2, 7.35);
    cornice.castShadow = true; cornice.receiveShadow = true;
    group.add(cornice);
  })();

  // West wall: 4 engaged half-columns at x = -10.6, z evenly spaced from -4 to 4
  var westPositions = [[-10.6, -4], [-10.6, -1.33333], [-10.6, 1.33333], [-10.6, 4]];
  var westColumns = H.makeIonicColumns(westPositions, { height: 5.8, baseD: 0.7, rotY: Math.PI / 2 });
  group.add(westColumns);

  // Director's r2 review (v-cary/general envelope): the cella's plain coursed
  // walls read as an unbroken mass with no doors, windows or clear boundary
  // against the rocky plateau. Two framed window openings (dark recess plus a
  // marble surround) in the bays between the west engaged columns, and a
  // second monumental doorway on the north wall (the cella's only modelled
  // door was the east one) give the building envelope real architectural
  // punctuation without touching H.makeCella's shared wall generator.
  // H.makeCella's west end wall is centred at x=-9.9 with thickness 0.8, so
  // its true outer (west-facing) face sits at x=-10.3 — every added element
  // below stays outside that (more negative x) so the solid coursed wall
  // never occludes it.
  var westFaceX = -10.3;
  var winW = 1.0, winH = 2.3, winY = 3.0;
  var westWinZs = [-2.66667, 2.66667];
  var winJambGeo = new THREE.BoxGeometry(0.16, winH, 0.16);
  var winCapGeo = new THREE.BoxGeometry(0.2, 0.18, winW + 0.32);
  for (var wwi = 0; wwi < westWinZs.length; wwi++) {
    var wz2 = westWinZs[wwi];
    var winDark = new THREE.Mesh(new THREE.BoxGeometry(0.1, winH, winW), mats.rockDark);
    winDark.position.set(westFaceX - 0.03, winY, wz2);
    group.add(winDark);
    var jambA = new THREE.Mesh(winJambGeo, mats.marble);
    jambA.position.set(westFaceX - 0.08, winY, wz2 - winW / 2 - 0.08);
    jambA.castShadow = true; jambA.receiveShadow = true;
    group.add(jambA);
    var jambB = new THREE.Mesh(winJambGeo, mats.marble);
    jambB.position.set(westFaceX - 0.08, winY, wz2 + winW / 2 + 0.08);
    jambB.castShadow = true; jambB.receiveShadow = true;
    group.add(jambB);
    var lintelTop = new THREE.Mesh(winCapGeo, mats.marble);
    lintelTop.position.set(westFaceX - 0.08, winY + winH / 2 + 0.09, wz2);
    lintelTop.castShadow = true; lintelTop.receiveShadow = true;
    group.add(lintelTop);
    var sill = new THREE.Mesh(winCapGeo, mats.marbleWorn);
    sill.position.set(westFaceX - 0.08, winY - winH / 2 - 0.09, wz2);
    sill.castShadow = true; sill.receiveShadow = true;
    group.add(sill);
  }

  // Monumental North Doorway: entered from the North Porch, one of the most
  // celebrated doors in Greek architecture — the cella above only modelled
  // its east door, leaving the whole north face (behind the porch columns)
  // blank. The north wall is centred at z=-5.4 with thickness 0.8, so its
  // true outer (north/porch-facing) face is z=-5.8 — every element here
  // stays outside that (more negative z).
  var ndX = -7, ndW = 2.6, ndH = 4.4, ndFaceZ = -5.8;
  var ndDark = new THREE.Mesh(new THREE.BoxGeometry(ndW, ndH, 0.12), mats.rockDark);
  ndDark.position.set(ndX, ndH / 2, ndFaceZ - 0.03);
  group.add(ndDark);
  var ndJambGeo = new THREE.BoxGeometry(0.28, ndH, 0.3);
  var ndJambA = new THREE.Mesh(ndJambGeo, mats.marble);
  ndJambA.position.set(ndX - ndW / 2 - 0.14, ndH / 2, ndFaceZ - 0.08);
  ndJambA.castShadow = true; ndJambA.receiveShadow = true;
  group.add(ndJambA);
  var ndJambB = new THREE.Mesh(ndJambGeo, mats.marble);
  ndJambB.position.set(ndX + ndW / 2 + 0.14, ndH / 2, ndFaceZ - 0.08);
  ndJambB.castShadow = true; ndJambB.receiveShadow = true;
  group.add(ndJambB);
  var ndLintel = new THREE.Mesh(new THREE.BoxGeometry(ndW + 0.7, 0.5, 0.34), mats.marble);
  ndLintel.position.set(ndX, ndH + 0.25, ndFaceZ - 0.08);
  ndLintel.castShadow = true; ndLintel.receiveShadow = true;
  group.add(ndLintel);
  var ndTrim = new THREE.Mesh(new THREE.BoxGeometry(ndW + 0.9, 0.12, 0.4), mats.marbleWorn);
  ndTrim.position.set(ndX, ndH + 0.55, ndFaceZ - 0.08);
  ndTrim.castShadow = true; ndTrim.receiveShadow = true;
  group.add(ndTrim);

  // Olive tree at local (-13, 0, 4)
  var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 8), mats.trunk);
  trunk.position.set(-13, 1.3, 4);
  trunk.castShadow = true; trunk.receiveShadow = true;
  group.add(trunk);

  var canopyZPositions = [-1, 0, 1];
  var canopyGeo = new THREE.IcosahedronGeometry(1.9, 0);
  for (var k = 0; k < canopyZPositions.length; k++) {
    var canopy = new THREE.Mesh(canopyGeo, mats.foliageOlive);
    canopy.position.set(-13, 3.5, 4 + canopyZPositions[k]);
    canopy.castShadow = true; canopy.receiveShadow = true;
    group.add(canopy);
  }

  return group;
};
