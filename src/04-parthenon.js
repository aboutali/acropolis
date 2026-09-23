// Module 04 - Parthenon
window.buildParthenon = function (THREE, mats, H) {
  // Runtime shim: 13-figures.js defines window.addFigureHelpers but nothing in
  // 12-main.js currently calls it, so H.makeRelief/makeStatue/makePromachos
  // would otherwise never exist. Wire it in once, defensively, from here
  // (buildParthenon runs first in the builder list).
  if (window.addFigureHelpers && !window.__figuresWired) {
    window.__figuresWired = true;
    window.addFigureHelpers(THREE, mats, H);
  }

  var group = new THREE.Group();
  // Raise the building so its three steps stand above the plateau
  group.position.y = 1.65;

  // Crepidoma: three steps, with the top (stylobate) step curving gently
  // upward toward mid-length (H.makeSteppedBase applies this automatically
  // for a building this size).
  var stylobate = H.makeSteppedBase(30.9, 69.5, 3, 0.55, 0.7);
  group.add(stylobate);

  // Peristyle columns - 8 × 17 = 46 columns
  // Rectangle inset 1.3 from stylobate edge: x = ±14.15, z = ±33.45
  var colPositions = [];

  // Short sides: 8 columns at z = ±33.45
  for (var i = 0; i < 8; i++) {
    var x = -14.15 + (28.3 / 7) * i;
    colPositions.push([x, 33.45]);
    colPositions.push([x, -33.45]);
  }

  // Long sides: 17 columns at x = ±14.15, excluding corners
  for (var i = 1; i < 16; i++) {
    var z = -33.45 + (66.9 / 16) * i;
    colPositions.push([14.15, z]);
    colPositions.push([-14.15, z]);
  }

  var colGroup = H.makeDoricColumns(colPositions, { height: 10.43, baseD: 1.91, topD: 1.48, flutes: 20 });
  group.add(colGroup);

  // Entablature at y = 10.43. 13 + 31 triglyph-bay counts give exactly
  // 92 metopes (28 on the ends, 64 on the flanks), matching the real temple.
  var metopeSeedBase = 3000;
  var entablature = H.makeEntablature(30.9, 69.5, 3.3, {
    triglyphs: true, triglyphCount: 13, zCount: 31,
    metopeMaker: H.makeRelief ? function (idx, mw, mh) {
      return H.makeRelief(mw, mh, { lowDetail: true, seed: metopeSeedBase + idx });
    } : null
  });
  entablature.position.y = 10.43;
  group.add(entablature);

  // Pediments (figures pose toward the corners automatically)
  var pedimentFront = H.makePediment(30.9, 1.2, 3.4, { figures: 11 });
  pedimentFront.position.set(0, 13.73, 34.75);
  group.add(pedimentFront);

  var pedimentBack = H.makePediment(30.9, 1.2, 3.4, { figures: 11 });
  pedimentBack.position.set(0, 13.73, -34.75);
  pedimentBack.rotation.y = Math.PI;
  group.add(pedimentBack);

  // Roof at y = 13.7 (pan-and-cover tiles, antefixes, ridge palmettes, acroteria)
  var roof = H.makeGableRoof(31.5, 70, 0.22, { tiles: true, acroteria: true });
  roof.position.y = 13.7;
  group.add(roof);

  // Cella at (0, 0, 0) — ashlar-coursed walls with a framed east door
  var cella = H.makeCella(21.7, 59, 10.0, { doorWidth: 4.5, doorSide: '+z' });
  group.add(cella);

  // Pronaos: 6 Doric columns at z = +26, x evenly in [-9, 9]
  var pronaosCols = [];
  for (var i = 0; i < 6; i++) {
    var x = -9 + (18 / 5) * i;
    pronaosCols.push([x, 26]);
  }
  var pronaoGroup = H.makeDoricColumns(pronaosCols, { height: 8.0, baseD: 1.5, topD: 1.2 });
  group.add(pronaoGroup);

  // Opisthodomos: 6 Doric columns at z = -26, x evenly in [-9, 9]
  var opisthodomosCols = [];
  for (var i = 0; i < 6; i++) {
    var x = -9 + (18 / 5) * i;
    opisthodomosCols.push([x, -26]);
  }
  var opisthodoGroup = H.makeDoricColumns(opisthodomosCols, { height: 8.0, baseD: 1.5, topD: 1.2 });
  group.add(opisthodoGroup);

  // Interior colonnade: two rows of 10 Doric columns at x = ±7.5, z evenly from -20 to +18
  var interiorCols = [];
  for (var i = 0; i < 10; i++) {
    var z = -20 + (38 / 9) * i;
    interiorCols.push([7.5, z]);
    interiorCols.push([-7.5, z]);
  }
  // Rear row: 5 columns at z = -23, x evenly in [-6, 6]
  for (var i = 0; i < 5; i++) {
    var x = -6 + (12 / 4) * i;
    interiorCols.push([x, -23]);
  }
  var interiorGroup = H.makeDoricColumns(interiorCols, { height: 5.0, baseD: 0.9, topD: 0.75, flutes: 16 });
  group.add(interiorGroup);

  // Panathenaic frieze: continuous relief strips around the exterior of the
  // cella walls (hidden behind the peristyle, as in the real temple), just
  // below the roofline.
  if (H.makeRelief) {
    var friezeY = 9.15, friezeH = 1.0;
    var friezeSeed = 4000;
    var friezeSpecs = [
      { len: 21.7 + 2.4, x: 0, z: 59 / 2 + 0.7, ry: 0 },
      { len: 21.7 + 2.4, x: 0, z: -(59 / 2 + 0.7), ry: Math.PI },
      { len: 59 + 2.4, x: 21.7 / 2 + 0.7, z: 0, ry: Math.PI / 2 },
      { len: 59 + 2.4, x: -(21.7 / 2 + 0.7), z: 0, ry: -Math.PI / 2 }
    ];
    // Whatever detail the relief plate itself carries (13-figures.js owns
    // H.makeRelief), the procession also gets a cheap instanced line of
    // small marching/riding figure blocks along every strip so the frieze
    // silhouette breaks up into individual figures instead of a blank band.
    var friezeFigGeo = new THREE.BoxGeometry(0.22, friezeH * 0.62, 0.09);
    var friezeHeadGeo = new THREE.SphereGeometry(friezeH * 0.09, 6, 5);
    var friezeFigT = [], friezeHeadT = [];
    for (var fs = 0; fs < friezeSpecs.length; fs++) {
      var spec = friezeSpecs[fs];
      var stripCount = Math.max(1, Math.round(spec.len / 8));
      var stripLen = spec.len / stripCount;
      var horiz = spec.ry === 0 || spec.ry === Math.PI;
      var figSpacing = 0.62, figCount = Math.max(1, Math.round(spec.len / figSpacing));
      for (var si = 0; si < stripCount; si++) {
        var strip = H.makeRelief(stripLen * 0.98, friezeH, { lowDetail: true, seed: friezeSeed + fs * 20 + si });
        var along = -spec.len / 2 + (si + 0.5) * stripLen;
        var ax = horiz ? along : 0;
        var az = horiz ? 0 : along;
        strip.position.set(spec.x + ax, friezeY, spec.z + az);
        strip.rotation.y = spec.ry;
        group.add(strip);
      }
      for (var fi = 0; fi < figCount; fi++) {
        var falong = -spec.len / 2 + (fi + 0.5) * figSpacing;
        var fx = spec.x + (horiz ? falong : 0), fz = spec.z + (horiz ? 0 : falong);
        var outSign = spec.ry === 0 ? 1 : spec.ry === Math.PI ? -1 : spec.ry === Math.PI / 2 ? 1 : -1;
        var ox = horiz ? 0 : outSign * 0.05, oz = horiz ? outSign * 0.05 : 0;
        friezeFigT.push({ p: [fx + ox, friezeY, fz + oz], r: [0, spec.ry, 0] });
        friezeHeadT.push({ p: [fx + ox, friezeY + friezeH * 0.36, fz + oz], r: [0, spec.ry, 0] });
      }
    }
    group.add(H.instance(friezeFigGeo, mats.marbleRelief, friezeFigT));
    group.add(H.instance(friezeHeadGeo, mats.marbleRelief, friezeHeadT));
  } else {
    // Fallback if the figures module hasn't loaded: plain coursed band.
    var frieze = H.makeBlockCourse(22.5, 59.8, 1.0, 1.2);
    frieze.position.y = 9.0;
    group.add(frieze);
  }

  // Cult statue: chryselephantine Athena Parthenos — gold drapery, ivory flesh.
  if (H.makeStatue) {
    var statue = H.makeStatue({ height: 11.5, material: mats.gold });
    statue.traverse(function (o) {
      if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.type === 'SphereGeometry') {
        o.material = mats.ivory;
      }
    });
    statue.position.set(0, 0, -10);
    group.add(statue);
  } else {
    var statue = H.makeFigure(11.5);
    statue.position.set(0, 0, -10);
    statue.traverse(function (o) { if (o.isMesh) o.material = mats.gold; });
    group.add(statue);
  }

  return group;
};
