// Propylaea (central hall, wings, Nike bastion & temple)
window.buildPropylaea = function (THREE, mats, H) {
  if (window.addFigureHelpers && !window.__figuresWired) {
    window.__figuresWired = true;
    window.addFigureHelpers(THREE, mats, H);
  }

  var group = new THREE.Group();
  group.position.set(-118, 0, -6);

  // CENTRAL HALL
  //
  // Director's r3 review (v-prop): the hall's own krepis was modelled
  // entirely at/below y=0 (its widest, lowest step bottoms out at
  // -stepH*steps), while the surrounding plaza pavement sits at y=0 --
  // so the whole staircase was buried under the pavement plane and every
  // camera just saw a flat floor with columns rising straight out of it
  // ("no monumental staircase ... just flat pavement"). Wrapping the
  // hall's geometry in its own group raised by PLINTH (= the krepis's
  // total rise) puts the outermost step's bottom back at world y=0
  // (flush with the plaza) and the stylobate at y=PLINTH where the
  // colonnade stands -- the krepis itself is now the visible tiered
  // marble staircase the review asked for, with no separate geometry
  // needed. Also bumped from a 4-step, single-thick plinth to 5 shallower
  // (0.4 m) steps on a deeper (0.85) tread inset: reads as a properly
  // monumental multi-course approach rather than one thick block.
  var PLINTH = 2.0;
  var hall = new THREE.Group();
  hall.position.y = PLINTH;
  group.add(hall);

  var centralBase = H.makeSteppedBase(24, 18, 5, PLINTH / 5, 0.85);
  hall.add(centralBase);

  // West façade: 6 Doric columns at x = -10.5, z evenly in [-7.5, 7.5]
  var westPos = [];
  for (var i = 0; i < 6; i++) {
    var z = -7.5 + (i / 5) * 15;
    westPos.push([-10.5, z]);
  }
  var westCols = H.makeDoricColumns(westPos, { height: 8.57, baseD: 1.6, topD: 1.25 });
  hall.add(westCols);

  // East façade: 6 Doric columns at x = +10.5, same z
  var eastPos = [];
  for (var i = 0; i < 6; i++) {
    var z = -7.5 + (i / 5) * 15;
    eastPos.push([10.5, z]);
  }
  var eastCols = H.makeDoricColumns(eastPos, { height: 8.0, baseD: 1.5, topD: 1.2 });
  hall.add(eastCols);

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
  hall.add(ionicCols);

  // Cross-wall at x = +3: 6 pillars and lintel
  var zPositions = [-8.5, -5.4, -2.2, 2.2, 5.4, 8.5];
  var pillarGeo = new THREE.BoxGeometry(1.5, 9, 1.3);
  for (var i = 0; i < zPositions.length; i++) {
    var pillar = new THREE.Mesh(pillarGeo, mats.marbleWorn);
    pillar.position.set(3, 4.5, zPositions[i]);
    pillar.castShadow = true; pillar.receiveShadow = true;
    hall.add(pillar);
  }

  var lintelGeo = new THREE.BoxGeometry(1.5, 2, 18);
  var lintel = new THREE.Mesh(lintelGeo, mats.marbleWorn);
  lintel.position.set(3, 8, 0);
  lintel.castShadow = true; lintel.receiveShadow = true;
  hall.add(lintel);

  // Entablature (Doric)
  var entablature = H.makeEntablature(24, 18, 2.6, { triglyphs: true, triglyphCount: 12, zCount: 9 });
  entablature.position.y = 8.57;
  hall.add(entablature);

  // Pediments
  var pediment1 = H.makePediment(18, 1.0, 2.6, { figures: 0 });
  pediment1.position.set(-12, 11.17, 0);
  pediment1.rotation.y = -Math.PI / 2;
  hall.add(pediment1);

  var pediment2 = H.makePediment(18, 1.0, 2.6, { figures: 0 });
  pediment2.position.set(12, 11.17, 0);
  pediment2.rotation.y = Math.PI / 2;
  hall.add(pediment2);

  // Roof
  var roof = H.makeGableRoof(18, 24, 0.24, { tiles: true });
  roof.position.y = 11.2;
  roof.rotation.y = Math.PI / 2;
  hall.add(roof);

  // WINGS
  //
  // Director's r3 review (v-prop, v-w): the wings were two small
  // gable-roofed "cottage" boxes with pitched orange-tiled roofs, reading
  // as domestic outbuildings rather than part of the same Doric complex.
  // Replaced with flat-roofed, flat-topped Doric wings styled off the same
  // order as the central hall (ashlar cella, Doric entablature, no pitched
  // tile roofs): a larger Pinakotheke to the north with its own shallow
  // 3-column porch facing the forecourt, and a smaller, plain (columnless)
  // south wing so the two read as clearly different in scale, exactly per
  // the review note. Both stay on their own low plinth at the group's own
  // y=0 (the forecourt level) -- one course below the newly-raised hall --
  // matching the real Propylaea, where the flanking wings sit at the
  // approach level and only the central passage is lifted on its krepis.

  // North wing: Pinakotheke
  var nwCX = -9, nwCZ = -20, nwW = 15, nwD = 13;
  var nwColH = 7.5, nwEntH = 2.2, nwPorchD = 2.6;

  var northBase = H.makeSteppedBase(nwW, nwD, 2, 0.3);
  northBase.position.set(nwCX, 0, nwCZ);
  group.add(northBase);

  var nwFrontZ = nwCZ + nwD / 2;              // wing's own +z (forecourt-facing) edge
  var nwCellaD = nwD - nwPorchD;
  var nwCellaCZ = nwCZ - nwPorchD / 2;         // cella recessed behind the porch bay
  var northCella = H.makeCella(nwW, nwCellaD, nwColH, { doorWidth: 3, doorSide: '+z' });
  northCella.position.set(nwCX, 0, nwCellaCZ);
  group.add(northCella);

  var northColPos = [];
  var nwPorchZ = nwFrontZ - 0.9;
  for (var i = 0; i < 3; i++) {
    var x = nwCX - nwW * 0.32 + i * (nwW * 0.32);
    northColPos.push([x, nwPorchZ]);
  }
  var northCols = H.makeDoricColumns(northColPos, { height: nwColH, baseD: 1.3, topD: 1.0, simple: true });
  group.add(northCols);

  var northEnt = H.makeEntablature(nwW, nwD, nwEntH, { triglyphs: true, triglyphCount: 6, zCount: 5 });
  northEnt.position.set(nwCX, nwColH, nwCZ);
  group.add(northEnt);

  var nwRoofY = nwColH + nwEntH;
  var northRoof = new THREE.Mesh(new THREE.BoxGeometry(nwW + 0.6, 0.3, nwD + 0.6), mats.marbleWorn);
  northRoof.position.set(nwCX, nwRoofY + 0.15, nwCZ);
  northRoof.castShadow = true; northRoof.receiveShadow = true;
  group.add(northRoof);

  var northParapet = H.makeBlockCourse(nwW + 0.4, nwD + 0.4, 0.4, 1.4);
  northParapet.position.set(nwCX, nwRoofY + 0.5, nwCZ);
  group.add(northParapet);

  // South wing: smaller, plain -- ashlar cella and a simple Doric cornice,
  // no colonnade at all, so it clearly reads as the lesser of the two wings.
  var swCX = -8, swCZ = 17, swW = 8, swD = 7;
  var swH = 6.0, swEntH = 1.6;

  var southBase = H.makeSteppedBase(swW, swD, 2, 0.3);
  southBase.position.set(swCX, 0, swCZ);
  group.add(southBase);

  var southCella = H.makeCella(swW, swD, swH, { doorWidth: 2, doorSide: '-z' });
  southCella.position.set(swCX, 0, swCZ);
  group.add(southCella);

  // triglyphs stay on (just a sparser count than the wings/hall) rather than
  // off: H.makeEntablature only fills the frieze band when triglyphs is
  // true (the off path leaves the whole frieze height an open gap, which
  // read as a dark slot clean through the entablature in the first render
  // of this pass) -- "plain" here means no colonnade, not a hollow cornice.
  var southEnt = H.makeEntablature(swW, swD, swEntH, { triglyphs: true, triglyphCount: 3, zCount: 2, sima: false });
  southEnt.position.set(swCX, swH, swCZ);
  group.add(southEnt);

  var southRoof = new THREE.Mesh(new THREE.BoxGeometry(swW + 0.5, 0.25, swD + 0.5), mats.marbleWorn);
  southRoof.position.set(swCX, swH + swEntH + 0.125, swCZ);
  southRoof.castShadow = true; southRoof.receiveShadow = true;
  group.add(southRoof);

  // NIKE BASTION AND TEMPLE, projecting south-west of the entrance
  //
  // Director's r3 review (v-prop): the bastion sat almost flush against
  // the south wing's own footprint, so it read as merged into the wing's
  // massing rather than a separate, visible projecting bastion. Pushed
  // further south (clear of the now-slimmer south wing) and enlarged
  // ~15%, with a low ashlar parapet along its exposed west/south edges,
  // so it reads as a real fortified platform carrying the temple rather
  // than a small plinth tucked out of sight.
  var bnX = -15, bnZ = 27.5;
  var bnW = 11, bnD = 13.2;

  var bastionGeo = new THREE.BoxGeometry(bnW, 6, bnD);
  var bastion = new THREE.Mesh(bastionGeo, mats.rock);
  bastion.position.set(bnX, 0.2, bnZ);
  bastion.castShadow = true; bastion.receiveShadow = true;
  group.add(bastion);

  var ashlarCap = H.makeBlockCourse(bnW, bnD, 1.2, 1.4);
  ashlarCap.position.set(bnX, 2.0, bnZ);
  group.add(ashlarCap);

  var parapetWGeo = new THREE.BoxGeometry(0.35, 0.7, bnD + 0.4);
  var parapetW = new THREE.Mesh(parapetWGeo, mats.rockDark);
  parapetW.position.set(bnX - bnW / 2 - 0.1, 3.55, bnZ);
  parapetW.castShadow = true; parapetW.receiveShadow = true;
  group.add(parapetW);

  var parapetSGeo = new THREE.BoxGeometry(bnW + 0.4, 0.7, 0.35);
  var parapetS = new THREE.Mesh(parapetSGeo, mats.rockDark);
  parapetS.position.set(bnX, 3.55, bnZ + bnD / 2 + 0.1);
  parapetS.castShadow = true; parapetS.receiveShadow = true;
  group.add(parapetS);

  var postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
  var postPositions = [
    [bnX - bnW / 2, 3.8, bnZ - bnD / 2], [bnX - bnW / 2, 3.8, bnZ + bnD / 2],
    [bnX + bnW / 2, 3.8, bnZ - bnD / 2], [bnX + bnW / 2, 3.8, bnZ + bnD / 2],
    [bnX, 3.8, bnZ - bnD / 2], [bnX, 3.8, bnZ + bnD / 2]
  ];
  var postTransforms = [];
  for (var i = 0; i < postPositions.length; i++) postTransforms.push({ p: postPositions[i] });
  var posts = H.instance(postGeo, mats.bronze, postTransforms);
  group.add(posts);

  // Temple of Athena Nike - stepped base
  var templeBase = H.makeSteppedBase(5.44, 8.27, 2, 0.35);
  templeBase.position.set(bnX, 3.9, bnZ);
  group.add(templeBase);

  // Ionic columns: 4 on each short end (rotY faces the volutes along x,
  // across the temple's short ends, matching the real amphiprostyle plan).
  var templeColPos = [];
  var zEnds = [bnZ - 3.4, bnZ + 3.4];
  for (var end = 0; end < 2; end++) {
    var z = zEnds[end];
    for (var col = 0; col < 4; col++) {
      var x = bnX + (-2.1 + (col / 3) * 4.2);
      templeColPos.push([x, z]);
    }
  }
  var templeCols = H.makeIonicColumns(templeColPos, { height: 4.0, baseD: 0.52, y: 3.9, rotY: Math.PI / 2 });
  group.add(templeCols);

  // Cella
  var templeCella = H.makeCella(3.7, 4.4, 4.0, { doorWidth: 1.4, doorSide: '+z', thickness: 0.4 });
  templeCella.position.set(bnX, 3.9, bnZ);
  group.add(templeCella);

  // Entablature (Ionic)
  var templeEntablature = H.makeEntablature(5.44, 8.27, 1.1, { order: 'ionic', triglyphs: false });
  templeEntablature.position.set(bnX, 7.9, bnZ);
  group.add(templeEntablature);

  // Roof
  var templeRoof = H.makeGableRoof(5.6, 8.4, 0.18, { tiles: true });
  templeRoof.position.set(bnX, 9.0, bnZ);
  group.add(templeRoof);

  // Pediments
  var templePediment1 = H.makePediment(5.6, 0.5, 0.9, { figures: 0 });
  templePediment1.position.set(bnX, 9.0, bnZ - 4.2);
  group.add(templePediment1);

  var templePediment2 = H.makePediment(5.6, 0.5, 0.9, { figures: 0 });
  templePediment2.position.set(bnX, 9.0, bnZ + 4.2);
  templePediment2.rotation.y = Math.PI;
  group.add(templePediment2);

  return group;
};
