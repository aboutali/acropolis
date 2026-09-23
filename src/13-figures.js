// Module 13: figure helpers (statues, caryatids, reliefs), installed onto H by makeHelpers
window.addFigureHelpers = function (THREE, mats, H) {
  var baseFigure = H.makeFigure, baseCaryatid = H.makeCaryatid;

  // height in metres; o.pose: 'stand' | 'kneel' | 'recline'
  H.makeFigure = function (height, o) {
    return baseFigure(height);
  };

  H.makeCaryatid = function (height) {
    return baseCaryatid(height);
  };

  // o: { height, pose, material }
  H.makeStatue = function (o) {
    o = o || {};
    var g = baseFigure(o.height || 2);
    if (o.material) g.traverse(function (m) { if (m.isMesh) m.material = o.material; });
    return g;
  };

  // Relief panel w x h metres, depth d; o.figures: count
  H.makeRelief = function (w, h, o) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), mats.marbleRelief || mats.marble);
    return m;
  };

  // Athena Promachos with plinth; origin at the plinth base
  H.makePromachos = function (o) {
    var g = new THREE.Group();
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), mats.marble);
    plinth.position.y = 1.25;
    g.add(plinth);
    var fig = H.makeStatue({ height: 9, material: mats.bronzePatina || mats.bronze });
    fig.position.y = 2.5;
    g.add(fig);
    return g;
  };
};
