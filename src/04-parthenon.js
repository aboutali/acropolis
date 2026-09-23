// Module 04 - Parthenon
window.buildParthenon = function (THREE, mats, H) {
  var group = new THREE.Group();
  // Raise the building so its three steps stand above the plateau
  group.position.y = 1.65;

  // Stylobate
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

  var colGroup = H.makeDoricColumns(colPositions, {height: 10.43, baseD: 1.91, topD: 1.48, flutes: 20});
  group.add(colGroup);

  // Entablature at y = 10.43
  var entablature = H.makeEntablature(30.9, 69.5, 3.3, {triglyphs: true, triglyphCount: 16});
  entablature.position.y = 10.43;
  group.add(entablature);

  // Pediments
  var pedimentFront = H.makePediment(30.9, 1.2, 3.4, {figures: 11});
  pedimentFront.position.set(0, 13.73, 34.75);
  group.add(pedimentFront);

  var pedimentBack = H.makePediment(30.9, 1.2, 3.4, {figures: 11});
  pedimentBack.position.set(0, 13.73, -34.75);
  pedimentBack.rotation.y = Math.PI;
  group.add(pedimentBack);

  // Roof at y = 13.7
  var roof = H.makeGableRoof(31.5, 70, 0.22, {tiles: true, acroteria: true});
  roof.position.y = 13.7;
  group.add(roof);

  // Cella at (0, 0, 0)
  var cella = H.makeCella(21.7, 59, 10.0, {doorWidth: 4.5, doorSide: '+z'});
  group.add(cella);

  // Pronaos: 6 Doric columns at z = +26, x evenly in [-9, 9]
  var pronaosCols = [];
  for (var i = 0; i < 6; i++) {
    var x = -9 + (18 / 5) * i;
    pronaosCols.push([x, 26]);
  }
  var pronaoGroup = H.makeDoricColumns(pronaosCols, {height: 8.0, baseD: 1.5, topD: 1.2});
  group.add(pronaoGroup);

  // Opisthodomos: 6 Doric columns at z = -26, x evenly in [-9, 9]
  var opisthodomosCols = [];
  for (var i = 0; i < 6; i++) {
    var x = -9 + (18 / 5) * i;
    opisthodomosCols.push([x, -26]);
  }
  var opisthodoGroup = H.makeDoricColumns(opisthodomosCols, {height: 8.0, baseD: 1.5, topD: 1.2});
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
  var interiorGroup = H.makeDoricColumns(interiorCols, {height: 5.0, baseD: 0.9, topD: 0.75, flutes: 16});
  group.add(interiorGroup);

  // Inner frieze band at y = 9.0
  var frieze = H.makeBlockCourse(22.5, 59.8, 1.0, 1.2);
  frieze.position.y = 9.0;
  group.add(frieze);

  // Cult statue
  var statue = H.makeFigure(11.5);
  statue.position.set(0, 0, -10);
  statue.traverse(function (o) {
    if (o.isMesh) {
      o.material = mats.bronze;
    }
  });
  group.add(statue);

  return group;
};
