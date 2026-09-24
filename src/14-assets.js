// Module 14: progressive loading of scanned statues/reliefs from assets/models/.
// 13-figures.js tags every procedural statue/relief with userData.slot so this
// module can find them by traversing the finished scene; it never touches
// their geometry directly. Real scans are loaded as GLB (baked normal + AO
// maps already applied in tools/blender/make_statues.py) and swapped in as
// they arrive, at the same world transform as the procedural object they
// replace, which is then hidden (not removed, so a failed/slow load simply
// leaves the procedural fallback visible).
window.loadAssets = function (THREE, scene, mats, renderer, H) {
  var GLTFLoader = THREE.GLTFLoader;
  if (!GLTFLoader) return; // add-on not present: procedural scene stands as-is
  var loader = new GLTFLoader();
  var BASE = 'assets/models/';

  // Desktop-only: on mobile the procedural (much cheaper) statues stay put --
  // the whole point of the scanned GLBs is extra surface detail that a phone
  // won't render at a size where it matters, and it isn't worth the download.
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  if (MOBILE) return;

  // ---- small helpers -------------------------------------------------
  function ensureUV2(geo) {
    if (geo.attributes.uv && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv);
    }
  }

  // Loads one GLB once, extracts its single mesh's geometry + baked maps,
  // and hands them to every callback queued for that name (so multiple
  // slots that use the same scan only trigger one network fetch).
  var modelCache = {}; // name -> { state: 'pending'|'ready'|'failed', asset, cbs }
  function fetchModel(name, cb) {
    var entry = modelCache[name];
    if (entry) {
      if (entry.state === 'ready') { cb(entry.asset); return; }
      if (entry.state === 'failed') { cb(null); return; }
      entry.cbs.push(cb);
      return;
    }
    entry = modelCache[name] = { state: 'pending', asset: null, cbs: [cb] };
    loader.load(
      BASE + name + '.glb',
      function (gltf) {
        var mesh = null;
        gltf.scene.traverse(function (o) { if (!mesh && o.isMesh) mesh = o; });
        if (!mesh) { entry.state = 'failed'; entry.cbs.forEach(function (f) { f(null); }); return; }
        var geo = mesh.geometry;
        geo.computeBoundingBox();
        var size = new THREE.Vector3();
        geo.boundingBox.getSize(size);
        ensureUV2(geo);
        var srcMat = mesh.material;
        var asset = {
          geometry: geo,
          size: size,
          normalMap: (srcMat && srcMat.normalMap) || null,
          aoMap: (srcMat && srcMat.aoMap) || null
        };
        entry.state = 'ready';
        entry.asset = asset;
        entry.cbs.forEach(function (f) { f(asset); });
      },
      undefined,
      function (err) {
        console.error('loadAssets: failed to load ' + name + '.glb', err);
        entry.state = 'failed';
        entry.cbs.forEach(function (f) { f(null); });
      }
    );
  }

  function baseMaterial(kind, asset) {
    var src = kind === 'panel' ? mats.marbleRelief : mats.marbleStatue;
    var mat = (src && src.clone) ? src.clone() : new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 });
    if (asset.normalMap) mat.normalMap = asset.normalMap;
    // Half-strength baked AO: full strength doubled up with SSAO and read as soot-black
    if (asset.aoMap) { mat.aoMap = asset.aoMap; mat.aoMapIntensity = 0.5; }
    // Relief panels are thin single-facing slabs; the scan's own winding
    // doesn't reliably agree with the procedural slot's outward-facing
    // convention, and a backface-culled panel renders as a hole straight
    // through the entablature to whatever sits behind it. Double-siding
    // costs nothing at this triangle count and guarantees the panel is
    // visible from the one side that matters.
    if (kind === 'panel') mat.side = THREE.DoubleSide;
    mat.needsUpdate = true;
    return mat;
  }

  // World transform of a procedural object, decomposed so the replacement
  // can be placed with the exact same world position/orientation regardless
  // of how deeply it's nested (parthenon group offset, pediment group
  // rotation, etc.) without having to re-derive any of that math here.
  function worldTransform(obj) {
    obj.updateWorldMatrix(true, false);
    var pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, quat, scl);
    return { pos: pos, quat: quat, scl: scl };
  }

  // Adds `mesh` to the scene at the procedural object's world transform,
  // then hides (does not remove) the procedural object.
  function place(proc, mesh, noShadow) {
    var t = worldTransform(proc);
    mesh.position.copy(t.pos);
    mesh.quaternion.copy(t.quat);
    mesh.castShadow = !noShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    proc.visible = false;
    return mesh;
  }

  function findSlots(pred) {
    var out = [];
    scene.traverse(function (o) { if (o.userData && pred(o.userData) && o.visible) out.push(o); });
    return out;
  }

  // =====================================================================
  // Caryatids: all 6 slots -> the Caryatid scan. A literal negative-X-scale
  // mirror flips both winding and tangent-space handedness, which read the
  // baked normal map backwards and rendered every other statue near-black
  // -- a small alternating head-turn-style yaw (still reading as the same
  // statue facing the same way, as the real porch does) gives the row
  // enough per-statue variety to avoid an obvious repeated clone without
  // that lighting bug.
  // =====================================================================
  fetchModel('caryatid', function (asset) {
    if (!asset) return;
    var slots = findSlots(function (u) { return u.slot === 'caryatid'; });
    slots.forEach(function (proc, i) {
      var mat = baseMaterial('statue', asset);
      var idx = proc.userData.index != null ? proc.userData.index : i;
      var mesh = new THREE.Mesh(asset.geometry, mat);
      var targetH = proc.userData.height || asset.size.y;
      var s = targetH / asset.size.y;
      mesh.scale.set(s, s, s);
      place(proc, mesh);
      mesh.rotateY((idx % 2 === 1 ? 1 : -1) * 0.07);
    });
  });

  // =====================================================================
  // Pediment figures: recline -> Dionysos, kneel/seated -> Artemis or
  // Kekrops-Pandrossos (alternating), stand -> Iris. Every slot is swapped,
  // using the ~2k-triangle *_lo bakes: the figures sit 15 m up, where the
  // baked normal map carries the carving.
  // =====================================================================
  var FIGURE_CAP_PER_POSE = Infinity;
  function capSlots(slots, cap) {
    if (slots.length <= cap) return slots;
    var out = [], step = slots.length / cap;
    for (var i = 0; i < cap; i++) out.push(slots[Math.floor(i * step)]);
    return out;
  }

  function swapFigurePose(pose, modelNames) {
    var slots = capSlots(findSlots(function (u) { return u.slot === 'figure' && u.pose === pose && u.height < 5; }), FIGURE_CAP_PER_POSE);
    if (!slots.length) return;
    modelNames.forEach(function (name) { fetchModel(name, function () {}); }); // warm the cache
    slots.forEach(function (proc, i) {
      var name = modelNames[i % modelNames.length];
      fetchModel(name, function (asset) {
        if (!asset) return;
        var mat = baseMaterial('statue', asset);
        var mesh = new THREE.Mesh(asset.geometry, mat);
        var targetH = proc.userData.height || asset.size.y;
        var s = targetH / asset.size.y;
        // Seated groups fill standing slots; shrink them so they stay under the raking cornice
        if (pose === 'stand') s *= 0.85;
        mesh.scale.set(s, s, s);
        place(proc, mesh);
      });
    });
  }

  swapFigurePose('recline', ['dionysos_lo']);
  swapFigurePose('kneel', ['artemis_lo', 'kekrops_pandrossos_lo']);
  swapFigurePose('seated', ['kekrops_pandrossos_lo', 'artemis_lo']);
  // Iris is a headless fragment that shatters into shards when stretched to a full standing slot
  swapFigurePose('stand', ['artemis_lo', 'kekrops_pandrossos_lo']);

  // =====================================================================
  // Metopes and frieze strips: H.makeRelief tags every panel 'relief' and
  // records whether it read as a square metope-like panel (combat: true)
  // or a wide frieze strip (combat: false, from the H.makeRelief aspect
  // check) -- 13-figures.js's own logic, reused here to route each panel
  // to the right scan set. As with the pediment figures, only a capped,
  // evenly-spread subset is swapped (92 metopes + many frieze strips exist;
  // scanning all of them would blow the scene's triangle budget many times
  // over) and traversal order runs front-face-first, so the capped set
  // lands on the building's most visible faces.
  // =====================================================================
  // Front-facing metopes/friezes are built first (see 04-parthenon.js), so
  // scene.traverse visits them first too -- takes the first `cap` found
  // rather than an even spread across all 92, so the capped budget lands on
  // the building's most visible face instead of being diluted across faces
  // a normal viewing angle never sees at once.
  // All panels, using the ~800-triangle *_lo bakes (supersedes the caps described above)
  var METOPE_CAP = Infinity, FRIEZE_CAP = Infinity;
  var METOPE_MODELS = ['metope_south09_lo', 'metope_north03_lo', 'metope_west09_lo', 'metope_east10_lo'];
  var FRIEZE_MODELS = ['frieze_south10_lo', 'frieze_north3839_lo', 'frieze_west0102_lo'];

  function swapPanels(pred, cap, modelNames) {
    var slots = findSlots(pred).slice(0, cap);
    if (!slots.length) return;
    slots.forEach(function (proc, i) {
      var name = modelNames[i % modelNames.length];
      fetchModel(name, function (asset) {
        if (!asset) return;
        var mat = baseMaterial('panel', asset);
        var mesh = new THREE.Mesh(asset.geometry, mat);
        var w = proc.userData.w || asset.size.x;
        var h = proc.userData.h || asset.size.y;
        var sx = w / asset.size.x, sy = h / asset.size.y;
        var sz = (sx + sy) / 2; // keep relief depth proportionate rather than stretched
        mesh.scale.set(sx, sy, sz);
        // Panels sit in shade under the cornice; skipping them in the shadow pass saves ~100k triangles
        place(proc, mesh, true);
        // The scans' carved face points the opposite way to the procedural panels
        if (location.search.indexOf('panelflip0') < 0) mesh.rotateY(Math.PI);
      });
    });
  }

  swapPanels(function (u) { return u.slot === 'relief' && u.combat; }, METOPE_CAP, METOPE_MODELS);
  swapPanels(function (u) { return u.slot === 'relief' && !u.combat; }, FRIEZE_CAP, FRIEZE_MODELS);

  // Promachos: the director's brief is explicit that the procedural bronze
  // Athena stays unless a scan convincingly reads as a standing Athena --
  // none of the available scans (caryatid, reclining Dionysos, fragmentary
  // Iris, frieze goddesses) do, so the promachos slot is intentionally left
  // untouched here.
};
