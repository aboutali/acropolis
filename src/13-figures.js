// Module 13: figure helpers (statues, caryatids, reliefs), installed onto H by makeHelpers.
window.addFigureHelpers = function (THREE, mats, H) {
  var PI = Math.PI, sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt, atan2 = Math.atan2, abs = Math.abs, exp = Math.exp;
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var UP = new THREE.Vector3(0, 1, 0);

  // ---- seeded LCG (no built-in RNG allowed) ----
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function gaussFall(v, width) {
    return exp(-(v * v) / (width * width));
  }

  // piecewise-linear "tent" wave: a triangle wave with a sharp corner at every peak and trough
  // (unlike cos(), whose slope is zero at the extrema) so fold ridges read as angular creases
  // instead of smooth undulations. Range [-1, 1], period 2*PI in x.
  function triWave(x) {
    return (2 / PI) * Math.asin(sin(x));
  }

  // ---- limb: a tapered cylinder oriented between two points ----
  function dist3(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    return sqrt(dx * dx + dy * dy + dz * dz);
  }

  function orientBetween(mesh, a, b) {
    var dir = new THREE.Vector3().subVectors(b, a);
    var mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    dir.normalize();
    var quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    mesh.position.copy(mid);
    mesh.quaternion.copy(quat);
  }

  function taperedLimb(a, b, r0, r1, radialSeg, mat) {
    var len = dist3(a, b) || 0.001;
    var geo = new THREE.CylinderGeometry(r1, r0, len, radialSeg, 1);
    var mesh = new THREE.Mesh(geo, mat);
    orientBetween(mesh, a, b);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function ballMesh(r, seg, mat, pos) {
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 4)), mat);
    if (pos) mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ---- a lathed body (torso / drapery) with vertical + catenary fold displacement ----
  // profile: array of THREE.Vector2(radius, y), bottom -> top, in local metres (y measured from feet/base = 0).
  function foldedLathe(profile, opts) {
    opts = opts || {};
    var radial = opts.radial || (MOBILE ? 11 : 20);
    var mat = opts.material || mats.marbleStatue;
    var vFold = opts.vFold !== undefined ? opts.vFold : 0.05;
    var vFoldCount = opts.vFoldCount || 9;
    var vFoldBiasTheta = opts.vFoldBiasTheta;
    var vFoldBiasAmt = opts.vFoldBiasAmt || 0;
    var catAmp = opts.catAmp !== undefined ? opts.catAmp : 0.035;
    var catFreq = opts.catFreq || 2.4;
    var span = opts.span || 1;
    var lean = opts.lean;
    var bulge = opts.bulge;
    var seed = opts.seed || 1;
    // subtle high-frequency surface variation so lathed skin doesn't read as a perfectly smooth
    // plastic taper at shoulder/hip/waist transitions; small amplitude, non-integer-multiple
    // frequency so it doesn't line up with (and reinforce) the main fold ridges.
    var micro = opts.micro !== undefined ? opts.micro : 0.014;
    var microCount = opts.microCount || (vFoldCount * 1.7 + 5);
    var rnd = makeRng(seed);
    var phase = rnd() * PI * 2;
    var microPhase = rnd() * PI * 2;

    var geo = new THREE.LatheGeometry(profile, radial);
    var pos = geo.getAttribute('position');
    var arr = pos.array;
    for (var i = 0; i < arr.length; i += 3) {
      var x = arr[i], y = arr[i + 1], z = arr[i + 2];
      var theta = atan2(z, x);
      var r = sqrt(x * x + z * z);
      var yFrac = y / span;
      var bias = vFoldBiasTheta !== undefined ? (1 + vFoldBiasAmt * cos(theta - vFoldBiasTheta)) : 1;
      var fold = 1 + vFold * bias * triWave(vFoldCount * theta + phase)
        + catAmp * sin(catFreq * yFrac * PI * 2 + 2.6 * sin(theta + phase))
        + micro * cos(microCount * theta + microPhase) * sin(3.1 * theta - microPhase * 0.5);
      var newR = r * fold;
      var nx = newR * cos(theta), nz = newR * sin(theta);
      if (bulge) {
        var b = bulge(theta, yFrac);
        if (b) { nx += b * cos(theta); nz += b * sin(theta); }
      }
      if (lean) {
        var L = lean(yFrac);
        if (L.twist) {
          var ct = cos(L.twist), st = sin(L.twist);
          var rx = nx * ct - nz * st, rz = nx * st + nz * ct;
          nx = rx; nz = rz;
        }
        nx += L.x || 0;
        nz += L.z || 0;
      }
      arr[i] = nx; arr[i + 2] = nz;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ---- head: displaced sphere (brow, nose, chin) + hair mass, on a neck ----
  function makeHead(size, opts) {
    opts = opts || {};
    var mat = opts.material || mats.marbleStatue;
    var hairMat = opts.hairMaterial || mat;
    // lowRes: small/distant heads (most pediment figures, relief-scale decoration)
    // don't need full sphere resolution or a separate hair shell.
    var lowRes = !!opts.lowRes || MOBILE;
    var seg = lowRes ? 8 : 13;
    var geo = new THREE.SphereGeometry(size, seg, Math.max(5, seg - 4));
    var pos = geo.getAttribute('position');
    var arr = pos.array;
    for (var i = 0; i < arr.length; i += 3) {
      var x = arr[i], y = arr[i + 1], z = arr[i + 2];
      var d = sqrt(x * x + y * y + z * z) || 1;
      var nx = x / d, ny = y / d, nz = z / d;
      var front = Math.max(0, nz);
      var push = 0;
      push += 0.09 * size * gaussFall(ny - 0.14, 0.16) * front;               // brow ridge
      push += 0.34 * size * gaussFall(ny + 0.02, 0.20) * gaussFall(nx, 0.16) * Math.max(0, (nz - 0.5)); // nose
      push += 0.13 * size * gaussFall(ny + 0.44, 0.16) * front;               // chin
      var jawPull = (ny < -0.05 && ny > -0.55) ? 0.055 * size * gaussFall(ny + 0.26, 0.24) * Math.max(0, abs(nx) - 0.28) : 0;
      var r = d + push - jawPull;
      arr[i] = nx * r; arr[i + 1] = ny * r; arr[i + 2] = nz * r;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    var head = new THREE.Mesh(geo, mat);
    head.castShadow = true; head.receiveShadow = true;

    var group = new THREE.Group();
    group.add(head);

    if (opts.hair !== false) {
      var hairGeo = new THREE.SphereGeometry(size * 1.1, seg, Math.max(5, seg - 4));
      hairGeo.scale(1.02, 1.08, 0.94);
      var hp = hairGeo.getAttribute('position');
      var harr = hp.array;
      for (var j = 0; j < harr.length; j += 3) {
        var hx = harr[j], hy = harr[j + 1], hz = harr[j + 2];
        var hd = sqrt(hx * hx + hy * hy + hz * hz) || 1;
        var hny = hy / hd, hnz = hz / hd;
        if (hnz > 0.1 && hny > -0.65) {
          var pull = Math.max(0, hnz - 0.1) * 0.92;
          hx *= (1 - pull); hy *= (1 - pull * 0.35); hz *= (1 - pull);
        }
        harr[j] = hx; harr[j + 1] = hy; harr[j + 2] = hz;
      }
      hp.needsUpdate = true;
      hairGeo.computeVertexNormals();
      var hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.y = size * 0.06;
      hair.castShadow = true; hair.receiveShadow = true;
      group.add(hair);
    }
    group.headMesh = head;
    return group;
  }

  // ---- foot: a short tapered wedge from heel to toe, laid flat on the ground, so figures
  // don't appear to float on nothing below the ankle. `dir` is the horizontal (y=0) forward
  // unit vector the toes point along.
  function makeFoot(anklePos, dir, footLen, r0, r1, mat, segs) {
    var heel = new THREE.Vector3(
      anklePos.x - dir.x * footLen * 0.32,
      anklePos.y * 0.4,
      anklePos.z - dir.z * footLen * 0.32
    );
    var toe = new THREE.Vector3(
      anklePos.x + dir.x * footLen * 0.78,
      anklePos.y * 0.22,
      anklePos.z + dir.z * footLen * 0.78
    );
    return taperedLimb(heel, toe, r0, r1, segs || (MOBILE ? 6 : 8), mat);
  }

  // ---- small low-poly sphere dropped at a limb junction (shoulder/elbow/hip/knee) so two
  // tapered-cylinder segments of slightly different radius meet with a rounded transition
  // instead of a hard plastic-looking step. ----
  function jointBall(pos, r, mat) {
    // small feature regardless of viewing distance — always cheap
    return ballMesh(r, 5, mat, pos);
  }

  // ---- braid: a chain of slightly offset tapered segments down the back, each one twisted
  // a few degrees relative to the last so the facets read as a helical interweave ----
  // Explicit parametric helix (not a self-rotated tube): the braid's centreline itself spirals
  // in x/z as it descends in y, so the twist is geometric and reads clearly from any angle,
  // rather than relying on per-segment rotation of an otherwise-straight axis.
  function buildBraid(top, dir, length, r0, r1, segs, seed, mat) {
    var group = new THREE.Group();
    var n = Math.max(segs, 6);
    var turns = 2.1;
    var helixR = r0 * 1.35;
    var phase = (seed % 7) * 0.55;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var ang = phase + t * turns * PI * 2;
      var rad = helixR * (1 - t * 0.55);
      pts.push(new THREE.Vector3(
        top.x + cos(ang) * rad,
        top.y + dir.y * length * t,
        top.z + dir.z * length * t * 0.7 + sin(ang) * rad * 0.6
      ));
    }
    for (var seg = 0; seg < n; seg++) {
      var ra = r0 * (1 - seg / n * 0.6), rb = r0 * (1 - (seg + 1) / n * 0.6);
      group.add(taperedLimb(pts[seg], pts[seg + 1], Math.max(ra, r1), Math.max(rb, r1), 7, mat));
    }
    return group;
  }

  // ================= STANDING BODY =================
  // Builds an upright draped figure, feet at local y = 0, facing +z.
  // Returns { group, hipY, shoulderY, headTopY, maxR }.
  function buildStandingBody(height, mat, seed, opts) {
    opts = opts || {};
    var rnd = makeRng(seed);
    var group = new THREE.Group();
    // LOD: small/distant figures (most pediment statues) get lighter geometry —
    // fewer radial facets, cheaper joints, no separate hair shell — since the
    // saved triangles are invisible at that scale but add up fast across 22+ figures.
    var LOD = MOBILE || height < 3.2;
    var limbSeg = LOD ? 6 : 9;
    var footSeg = LOD ? 6 : 8;
    var neckSeg = LOD ? 6 : 8;
    var bodyRadial = LOD ? 12 : 20;
    var foldScale = opts.foldScale !== undefined ? opts.foldScale : 1;
    var leanScale = opts.leanScale !== undefined ? opts.leanScale : 1;
    // Classical 7.5-head canon (measured from the ground, y=0 at the feet): ankle ~0.5 head
    // units up, knee ~1.5, hip ~3.5, shoulder ~6, chin/neck-base ~6.5, crown ~7.5 (== height).
    // headSize is the head sphere's radius, so a ~1-head-unit crown-to-chin diameter is
    // 2*headSize =~ height/7.5, i.e. headSize =~ height/15.
    var ankleY = 0.065 * height, kneeY = 0.205 * height, hipY = 0.467 * height,
      shoulderY = 0.80 * height, neckBaseY = 0.865 * height, headSize = 0.041 * height;
    var headTopY = height;

    var rHem = 0.075 * height, rCalf = 0.062 * height, rKnee = 0.052 * height, rHip = 0.100 * height,
      rWaist = 0.078 * height, rChest = 0.100 * height, rShoulder = 0.112 * height, rNeck = 0.044 * height;

    var contrapposto = opts.contrapposto !== false;
    var weightSide = opts.weightSide || 1; // +1 = weight on figure's right leg (their -x side)
    function lean(yFrac) {
      if (!contrapposto) return { x: 0, twist: 0 };
      var s = yFrac;
      return {
        x: weightSide * height * leanScale * (0.016 * sin(PI * s) + 0.008 * sin(2 * PI * s)),
        twist: weightSide * 0.09 * leanScale * sin(PI * s)
      };
    }

    var profile = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(rHem, 0.02 * height),
      new THREE.Vector2(rCalf, 0.10 * height),
      new THREE.Vector2(rKnee, kneeY),
      new THREE.Vector2(rHip * 0.86, hipY * 0.80),
      new THREE.Vector2(rHip, hipY),
      new THREE.Vector2(rWaist, hipY + 0.09 * height),
      new THREE.Vector2(rChest, shoulderY * 0.90),
      new THREE.Vector2(rShoulder, shoulderY),
      new THREE.Vector2(rNeck, neckBaseY)
    ];
    var body = foldedLathe(profile, {
      material: mat, seed: seed, span: neckBaseY, lean: lean, radial: bodyRadial,
      vFoldCount: 16, vFold: 0.15 * foldScale, catAmp: 0.07 * foldScale, catFreq: 2.2,
      vFoldBiasTheta: weightSide > 0 ? PI * 0.15 : PI * 1.15, vFoldBiasAmt: 0.5
    });
    group.add(body);

    // bare feet peeking out from under the hem — origin is at the feet (y=0), so without this
    // the figure's legs taper to a point at ground level and it reads as floating.
    var footLen = height * 0.10, footR0 = rHem * 0.60, footR1 = rHem * 0.28;
    var footDir = new THREE.Vector3(0, 0, 1);
    group.add(makeFoot(new THREE.Vector3(-rHem * 0.42, ankleY, 0), footDir, footLen, footR0, footR1, mat, footSeg));
    group.add(makeFoot(new THREE.Vector3(rHem * 0.42, ankleY, 0), footDir, footLen, footR0, footR1, mat, footSeg));

    var shoulderW = rShoulder * 0.92;
    var armR0 = 0.032 * height, armR1 = 0.024 * height, handR = 0.021 * height;
    var s0 = -weightSide, s1 = weightSide;

    if (opts.arms !== false) {
      // Authentic breakage: a deterministic fraction of figures lose a forearm at
      // the elbow (surviving pediment marbles almost never have all four limbs
      // intact) instead of every statue reading as a pristine mannequin.
      var breakRoll = rnd();
      var breakArm = breakRoll < 0.30 ? (breakRoll < 0.15 ? 'relaxed' : 'bent') : null;

      // relaxed arm (weight-bearing side)
      var relShY = new THREE.Vector3(s0 * shoulderW, shoulderY, 0.015 * height);
      var relEl = new THREE.Vector3(s0 * shoulderW * 1.05, shoulderY - 0.17 * height, 0.02 * height);
      var relWr = new THREE.Vector3(s0 * shoulderW * 0.85, hipY + 0.02 * height, 0.03 * height);
      group.add(taperedLimb(relShY, relEl, armR0, (armR0 + armR1) / 2, limbSeg, mat));
      group.add(jointBall(relShY, armR0 * 0.92, mat));
      if (breakArm === 'relaxed') {
        group.add(jointBall(relEl, armR0 * 0.7, mat)); // rounded broken stump
      } else {
        group.add(taperedLimb(relEl, relWr, (armR0 + armR1) / 2, armR1, limbSeg, mat));
        group.add(jointBall(relEl, (armR0 + armR1) / 2 * 0.95, mat));
        group.add(ballMesh(handR, 5, mat, relWr));
      }

      // bent arm holding the drape fold
      var benShY = new THREE.Vector3(s1 * shoulderW, shoulderY, 0.015 * height);
      var benEl = new THREE.Vector3(s1 * shoulderW * 1.18, shoulderY - 0.10 * height, 0.11 * height);
      var benWr = new THREE.Vector3(s1 * shoulderW * 0.55, shoulderY - 0.01 * height, 0.17 * height);
      group.add(taperedLimb(benShY, benEl, armR0, (armR0 + armR1) / 2, limbSeg, mat));
      group.add(jointBall(benShY, armR0 * 0.92, mat));
      if (breakArm === 'bent') {
        group.add(jointBall(benEl, armR0 * 0.7, mat));
      } else {
        group.add(taperedLimb(benEl, benWr, (armR0 + armR1) / 2, armR1, limbSeg, mat));
        group.add(jointBall(benEl, (armR0 + armR1) / 2 * 0.95, mat));
        group.add(ballMesh(handR, 5, mat, benWr));
      }
    }

    // himation sash: a light diagonal drape from the far shoulder to the near hip
    if (opts.sash !== false) {
      var sashA = new THREE.Vector3(-s0 * shoulderW * 0.7, shoulderY + 0.02 * height, 0.06 * height);
      var sashMid = new THREE.Vector3(0, (shoulderY + hipY) / 2, 0.10 * height);
      var sashB = new THREE.Vector3(s0 * rHip * 0.9, hipY - 0.03 * height, 0.06 * height);
      group.add(taperedLimb(sashA, sashMid, 0.05 * height, 0.045 * height, limbSeg, mat));
      group.add(taperedLimb(sashMid, sashB, 0.045 * height, 0.03 * height, limbSeg, mat));
    }

    var neck = taperedLimb(new THREE.Vector3(lean(neckBaseY / neckBaseY).x, neckBaseY, 0), new THREE.Vector3(lean(1).x, neckBaseY + 0.045 * height, 0), rNeck, rNeck * 0.9, neckSeg, mat);
    group.add(neck);

    var headGroup = makeHead(headSize, { material: mat, hairMaterial: opts.hairMaterial || mat, lowRes: LOD, hair: !LOD });
    var headLean = lean(1);
    headGroup.position.set(headLean.x, neckBaseY + 0.045 * height + headSize * 0.95, headLean.z || 0);
    // Heads turned off-axis break up the "row of identical mannequins" look —
    // deterministic per seed, and skippable (headTurn: 0) for statues like the
    // Promachos whose helmet geometry assumes a forward-facing head.
    var headTurnRange = opts.headTurn !== undefined ? opts.headTurn : 0.9;
    headGroup.rotation.y = (rnd() - 0.5) * headTurnRange;
    group.add(headGroup);

    return { group: group, hipY: hipY, shoulderY: shoulderY, headTopY: headTopY, maxR: Math.max(rShoulder, rHip), headSize: headSize };
  }

  // ================= KNEEL / SEATED bodies (bespoke legs) =================
  function buildBentBody(height, mat, seed, hipY, shoulderFrac, legJoints) {
    var group = new THREE.Group();
    var rnd = makeRng(seed + 500);
    var LOD = MOBILE || height < 3.2;
    var limbSeg = LOD ? 6 : 8;
    var bodyRadial = LOD ? 12 : 18;
    var shoulderY = hipY + (height - hipY) * shoulderFrac;
    var neckBaseY = hipY + (height - hipY) * (shoulderFrac + 0.06);
    var headSize = 0.041 * height;

    var rHip = 0.100 * height, rWaist = 0.080 * height, rChest = 0.098 * height, rShoulder = 0.110 * height, rNeck = 0.044 * height;
    var profile = [
      new THREE.Vector2(rHip * 0.9, 0),
      new THREE.Vector2(rHip, hipY * 0.06 + 0),
      new THREE.Vector2(rWaist, (shoulderY - hipY) * 0.35),
      new THREE.Vector2(rChest, (shoulderY - hipY) * 0.75),
      new THREE.Vector2(rShoulder, (shoulderY - hipY)),
      new THREE.Vector2(rNeck, (neckBaseY - hipY))
    ];
    // Slightly deeper folds than the base version (0.13/0.065) — seated/kneeling
    // drapery pools and creases more than a standing figure's.
    var torso = foldedLathe(profile, { material: mat, seed: seed, span: neckBaseY - hipY, radial: bodyRadial, vFold: 0.17, vFoldCount: 15, catAmp: 0.085 });
    torso.position.y = hipY;
    group.add(torso);

    for (var li = 0; li < legJoints.length; li++) {
      var chain = legJoints[li];
      for (var i = 0; i < chain.length - 1; i++) {
        var t0 = i / (chain.length - 1), t1 = (i + 1) / (chain.length - 1);
        var r0 = 0.075 * height * (1 - 0.35 * t0), r1 = 0.075 * height * (1 - 0.35 * t1);
        group.add(taperedLimb(chain[i], chain[i + 1], r0, r1, limbSeg, mat));
        if (i > 0) group.add(jointBall(chain[i], r0 * 0.95, mat)); // knee
      }
      // foot at the chain's ground end, oriented along the last segment's horizontal direction,
      // plus a small ankle joint ball — without this the leg just tapers to nothing at the ankle.
      var ankle = chain[chain.length - 1];
      var prevJoint = chain[chain.length - 2];
      var toeDir = new THREE.Vector3(ankle.x - prevJoint.x, 0, ankle.z - prevJoint.z);
      if (toeDir.lengthSq() < 1e-6) toeDir.set(0, 0, 1); else toeDir.normalize();
      group.add(jointBall(ankle, 0.040 * height, mat));
      group.add(makeFoot(ankle, toeDir, height * 0.095, 0.052 * height, 0.024 * height, mat, limbSeg));
    }

    var armR0 = 0.030 * height, armR1 = 0.022 * height, shoulderW = rShoulder * 0.9;
    var sides = [1, -1];
    // Authentic breakage here too: about 30% of kneeling/seated figures lose one
    // forearm at the elbow.
    var breakRoll = rnd();
    var breakSide = breakRoll < 0.30 ? sides[breakRoll < 0.15 ? 0 : 1] : null;
    for (var a = 0; a < 2; a++) {
      var sx = sides[a];
      var sh = new THREE.Vector3(sx * shoulderW, shoulderY, 0.01 * height);
      var el = new THREE.Vector3(sx * shoulderW * 1.1, shoulderY - 0.14 * height, 0.06 * height);
      var wr = new THREE.Vector3(sx * shoulderW * 0.7, shoulderY - 0.26 * height, 0.10 * height);
      group.add(taperedLimb(sh, el, armR0, (armR0 + armR1) / 2, limbSeg, mat));
      group.add(jointBall(sh, armR0 * 0.9, mat));
      if (sx === breakSide) {
        group.add(jointBall(el, armR0 * 0.65, mat));
      } else {
        group.add(taperedLimb(el, wr, (armR0 + armR1) / 2, armR1, limbSeg, mat));
        group.add(jointBall(el, (armR0 + armR1) / 2 * 0.95, mat));
        group.add(ballMesh(0.02 * height, 5, mat, wr));
      }
    }

    var neck = taperedLimb(new THREE.Vector3(0, neckBaseY, 0), new THREE.Vector3(0, neckBaseY + 0.045 * height, 0), rNeck, rNeck * 0.9, limbSeg, mat);
    group.add(neck);
    var headGroup = makeHead(headSize, { material: mat, lowRes: LOD, hair: !LOD });
    headGroup.position.set(0, neckBaseY + 0.045 * height + headSize * 0.95, 0);
    // turned/tilted head — seated and kneeling pediment figures traditionally
    // look toward the temple's central axis rather than stare straight out.
    headGroup.rotation.y = (rnd() - 0.5) * 1.1;
    headGroup.rotation.x = (rnd() - 0.5) * 0.25;
    group.add(headGroup);

    return { group: group, headTopY: neckBaseY + 0.09 * height + headSize * 2, maxR: Math.max(rShoulder, rHip) };
  }

  // ================= H.makeFigure =================
  // o.pose: 'stand' | 'kneel' | 'seated' | 'recline'
  //   stand/kneel/seated: origin at the feet (y=0 on the ground).
  //   recline: figure lies along +x with the head toward -x; origin is on the ground under the hips.
  // Callers (e.g. H.makePediment in 02-helpers.js) build many figures of the same
  // pose without ever passing a seed, so without this every 'stand' figure in the
  // scene would share the exact same fold phase, head turn and breakage — reading
  // as one mannequin duplicated down the row. Auto-incrementing keeps every
  // unseeded call distinct while staying fully deterministic (no runtime RNG).
  var __figureAutoSeed = 100;
  H.makeFigure = function (height, o) {
    height = height !== undefined ? height : 1.8;
    o = o || {};
    var pose = o.pose || 'stand';
    var mat = o.material || mats.marbleStatue;
    var seed = o.seed !== undefined ? o.seed : (__figureAutoSeed += 17);

    if (pose === 'stand') {
      return buildStandingBody(height, mat, seed, o).group;
    }

    if (pose === 'kneel') {
      var hipY = 0.40 * height;
      var legs = [
        // kneeling leg: hip -> knee on ground (forward) -> shin trailing back, foot behind
        [new THREE.Vector3(-0.05 * height, hipY, 0), new THREE.Vector3(-0.06 * height, 0.03 * height, 0.16 * height), new THREE.Vector3(-0.05 * height, 0.05 * height, -0.14 * height)],
        // planted leg: hip -> raised knee -> foot forward on ground
        [new THREE.Vector3(0.06 * height, hipY, 0), new THREE.Vector3(0.09 * height, 0.20 * height, 0.22 * height), new THREE.Vector3(0.08 * height, 0.03 * height, 0.36 * height)]
      ];
      var b = buildBentBody(height, mat, seed, hipY, 0.86, legs);
      return b.group;
    }

    if (pose === 'seated') {
      var seatHipY = 0.46 * height;
      var legsS = [
        [new THREE.Vector3(-0.09 * height, seatHipY, 0), new THREE.Vector3(-0.10 * height, seatHipY - 0.02 * height, 0.30 * height), new THREE.Vector3(-0.09 * height, 0.05 * height, 0.34 * height)],
        [new THREE.Vector3(0.09 * height, seatHipY, 0), new THREE.Vector3(0.10 * height, seatHipY - 0.02 * height, 0.30 * height), new THREE.Vector3(0.09 * height, 0.05 * height, 0.34 * height)]
      ];
      var bs = buildBentBody(height, mat, seed, seatHipY, 0.80, legsS);
      return bs.group;
    }

    // recline: build the upright body then rotate it down onto its back so it runs along +x,
    // head toward -x, resting on the ground under the hips (this file's local origin convention).
    var built = buildStandingBody(height, mat, seed, {
      contrapposto: false, sash: o.sash, arms: o.arms,
      foldScale: o.foldScale, leanScale: o.leanScale, headTurn: o.headTurn
    });
    var g = built.group;
    g.rotation.z = PI / 2;
    g.position.x += built.hipY;
    g.position.y += built.maxR * 0.95;
    return g;
  };

  // ================= H.makeCaryatid =================
  // Erechtheion kore: peplos with deep vertical folds on the supporting leg, the bent free leg
  // pressing through the drapery, braids down the back, capital (echinus + abacus/kalathos) on the
  // head. Origin at the plinth base; total height (plinth to capital top) == height. Faces -z.
  // Real korai are sturdy — broad-shouldered, full-hipped, built to visually carry
  // an entablature — not slim figure statues. Proportions below are ~1.3x the
  // original girth (radii only; scaling doesn't add a single extra triangle).
  // Successive calls (the 6 porch figures) auto-alternate which leg bears the
  // weight, as on the real porch, and get a distinct head turn, purely from a
  // module-level call counter — no change needed at the 05-erechtheion.js call site.
  var __caryatidCallIdx = 0;
  H.makeCaryatid = function (height) {
    height = height !== undefined ? height : 2.3;
    var mat = mats.marbleStatue;
    var callIdx = __caryatidCallIdx++;
    var seed = 31 + callIdx * 13;
    var rnd = makeRng(seed + 900);
    var group = new THREE.Group();

    var plinthH = 0.05 * height;
    var plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.47, plinthH, MOBILE ? 10 : 16), mats.marble);
    plinth.position.y = plinthH / 2;
    plinth.castShadow = true; plinth.receiveShadow = true;
    group.add(plinth);

    var shoulderY = 0.775 * height;
    var neckBaseY = 0.815 * height;
    var headSize = 0.084 * height;
    // alternate which leg bears the weight, mirroring the real porch's arrangement
    var supportSide = (callIdx % 2 === 0) ? 1 : -1;

    // ~1.3x the base radii: broad shoulders, full hips, a genuinely sturdy silhouette.
    var rBase = 0.188, rCalf = 0.176, rKnee = 0.188, rHip = 0.228, rWaist = 0.195, rChest = 0.221, rShoulder = 0.195, rNeck = 0.090;
    var profile = [
      new THREE.Vector2(rBase, plinthH),
      new THREE.Vector2(rCalf, 0.14 * height),
      new THREE.Vector2(rKnee, 0.28 * height),
      new THREE.Vector2(rHip * 0.92, 0.40 * height),
      new THREE.Vector2(rHip, 0.47 * height),
      new THREE.Vector2(rWaist, 0.56 * height),
      new THREE.Vector2(rChest, shoulderY * 0.92),
      new THREE.Vector2(rShoulder, shoulderY),
      new THREE.Vector2(rNeck, neckBaseY)
    ];
    var body = foldedLathe(profile, {
      material: mat, seed: seed, span: neckBaseY, radial: MOBILE ? 12 : 22,
      // deeper, more sculptural peplos folds than the base figure body
      vFold: 0.24, vFoldCount: 17, vFoldBiasTheta: supportSide > 0 ? 0 : PI, vFoldBiasAmt: 0.8,
      catAmp: 0.10, catFreq: 3,
      // the free leg's bent knee presses through the drapery as a localized bulge, and a seam
      // running knee-to-ankle where the fabric is drawn tight over the shin — this is what
      // differentiates the free leg's drape from the straight support leg's vertical folds.
      bulge: function (theta, yFrac) {
        var kneeFrac = 0.28 * height / neckBaseY;
        var ankleFrac = 0.09 * height / neckBaseY;
        var thetaFree = -supportSide > 0 ? 0 : PI;
        var nearKnee = gaussFall(yFrac - kneeFrac, 0.10);
        var nearTheta = gaussFall(((theta - thetaFree + PI) % (2 * PI)) - PI, 0.9);
        var kneeBulge = 0.036 * height * nearKnee * nearTheta;

        var seamTheta = thetaFree + 0.4;
        var seamBand = Math.max(0, Math.min(1, (kneeFrac - yFrac) / (kneeFrac - ankleFrac)));
        var seamProfile = sin(seamBand * PI); // 0 at the ankle and knee, peaks mid-shin
        var seamFall = gaussFall(((theta - seamTheta + PI) % (2 * PI)) - PI, 0.16);
        var seamPull = -0.026 * height * seamProfile * seamFall;

        return kneeBulge + seamPull;
      }
    });
    group.add(body);

    // stub arms at the sides (forearms broken off, as on the surviving Caryatids)
    var armR = 0.052 * height;
    var stubShY = shoulderY - 0.02 * height;
    group.add(taperedLimb(new THREE.Vector3(-rShoulder * 0.85, stubShY, 0), new THREE.Vector3(-rShoulder * 1.05, stubShY - 0.14 * height, 0.02 * height), armR, armR * 0.8, MOBILE ? 6 : 8, mat));
    group.add(taperedLimb(new THREE.Vector3(rShoulder * 0.85, stubShY, 0), new THREE.Vector3(rShoulder * 1.05, stubShY - 0.14 * height, 0.02 * height), armR, armR * 0.8, MOBILE ? 6 : 8, mat));

    var neck = taperedLimb(new THREE.Vector3(0, neckBaseY, 0), new THREE.Vector3(0, neckBaseY + 0.035 * height, 0), rNeck, rNeck * 0.95, MOBILE ? 8 : 10, mat);
    group.add(neck);

    var headGroup = makeHead(headSize, { material: mat, hair: false });
    var headY = neckBaseY + 0.035 * height + headSize * 0.9;
    headGroup.position.y = headY;
    // a small per-figure head turn so the row doesn't read as identical pegs
    headGroup.rotation.y = supportSide * 0.10 + (rnd() - 0.5) * 0.14;
    group.add(headGroup);

    // long, thick braids down the back (front faces -z, so the back is +z)
    var braidTop = new THREE.Vector3(0, headY + headSize * 0.3, headSize * 0.85);
    for (var bi = -1; bi <= 1; bi += 2) {
      var top = braidTop.clone(); top.x = bi * headSize * 0.35;
      var braid = buildBraid(top, new THREE.Vector3(0, -1, 0.05), shoulderY - headY + headSize, headSize * 0.32, headSize * 0.075, MOBILE ? 7 : 12, seed + bi, mat);
      group.add(braid);
    }

    // capital: a heavy, cushion-like echinus (fuller curve, taller) + abacus (kalathos)
    // resting on the head, top of abacus == height
    var abacusH = 0.06 * height, echinusH = 0.065 * height;
    var kalathosTop = height;
    var echinusY = kalathosTop - abacusH - echinusH / 2;
    var echinusProfile = [
      new THREE.Vector2(headSize * 1.15, 0),
      new THREE.Vector2(headSize * 1.48, echinusH * 0.32),
      new THREE.Vector2(headSize * 1.68, echinusH * 0.68),
      new THREE.Vector2(headSize * 1.62, echinusH)
    ];
    var echinus = foldedLathe(echinusProfile, {
      material: mats.marble, seed: seed + 5, span: echinusH, radial: MOBILE ? 12 : 20,
      vFold: 0.30, vFoldCount: 12, catAmp: 0, micro: 0
    });
    echinus.position.y = echinusY - echinusH / 2;
    group.add(echinus);
    var abacus = new THREE.Mesh(new THREE.BoxGeometry(headSize * 3.5, abacusH, headSize * 3.5), mats.marble);
    abacus.position.y = kalathosTop - abacusH / 2;
    abacus.castShadow = true; abacus.receiveShadow = true;
    group.add(abacus);

    return group;
  };

  // ================= H.makeStatue =================
  H.makeStatue = function (o) {
    o = o || {};
    var g = H.makeFigure(o.height !== undefined ? o.height : 2, { pose: o.pose, seed: o.seed, material: o.material });
    if (o.material) g.traverse(function (m) { if (m.isMesh) m.material = o.material; });
    return g;
  };

  // ================= relief panels (metopes / friezes) =================
  // Manual BufferGeometry merge (no addon merge helpers allowed in this build).
  function mergeGeoms(geoList) {
    var positions = [], normals = [];
    for (var gi = 0; gi < geoList.length; gi++) {
      var g = geoList[gi];
      var src = g.index ? g.toNonIndexed() : g;
      if (!src.getAttribute('normal')) src.computeVertexNormals();
      var p = src.getAttribute('position').array;
      var n = src.getAttribute('normal').array;
      for (var i = 0; i < p.length; i++) positions.push(p[i]);
      for (var j = 0; j < n.length; j++) normals.push(n[j]);
    }
    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
  }

  // A flattened, low-relief figure built from a handful of boxes squashed in z —
  // boxes (12 tris each) rather than the previous cylinders/spheres (20-48 tris
  // each) because a relief panel this small never shows the difference in
  // roundness, and there can be well over 150 of these across the temple's
  // metopes and friezes, where every triangle is multiplied by that count.
  // variant: 'lapith' (human, weapon arm raised) | 'centaur' (human torso on an
  // elongated four-legged body) | 'procession' (walking figure, frieze default).
  function reliefFigureGeoms(cx, baseY, fh, depth, seed, lowDetail, variant) {
    var rnd = makeRng(seed);
    var geoms = [];
    var legR = fh * 0.09, torsoW = fh * 0.22, torsoH = fh * 0.40, headS = fh * 0.16;
    var stance = (rnd() - 0.5) * fh * 0.18;
    var armSwing = (rnd() - 0.5) * fh * 0.3;
    var dz = Math.min(depth, fh * 0.5);

    function pushBox(w, h, d, x, y, z, rz) {
      var bg = new THREE.BoxGeometry(w, h, Math.min(d, depth));
      if (rz) bg.rotateZ(rz);
      bg.translate(x, y, z);
      geoms.push(bg);
    }

    if (variant === 'centaur') {
      // Human torso and arms rising from an elongated four-legged horse body —
      // reads clearly as a centaur in silhouette without a full quadruped rig.
      var bodyLen = fh * 0.62, bodyH = fh * 0.30;
      pushBox(bodyLen, bodyH, depth * 0.9, cx + fh * 0.05, baseY + bodyH * 0.55, 0, 0);
      for (var lg = 0; lg < 4; lg++) {
        var lx = cx - bodyLen * 0.32 + lg * (bodyLen * 0.6 / 3);
        pushBox(legR * 0.75, fh * 0.36, legR * 0.75, lx, baseY + fh * 0.19, 0, (lg < 2 ? -1 : 1) * 0.05);
      }
      var htx = cx + bodyLen * 0.30;
      pushBox(torsoW * 0.9, torsoH, depth * 0.85, htx, baseY + bodyH + torsoH * 0.5, dz * 0.1, 0.08);
      pushBox(legR * 0.7, fh * 0.30, legR * 0.7, htx - torsoW * 0.4, baseY + bodyH + fh * 0.18, dz * 0.15, 0.6 + armSwing * 0.01);
      pushBox(legR * 0.7, fh * 0.30, legR * 0.7, htx + torsoW * 0.4, baseY + bodyH + fh * 0.18, dz * 0.15, -0.6 - armSwing * 0.01);
      pushBox(headS, headS, Math.min(headS, depth), htx, baseY + bodyH + torsoH + headS * 0.5, dz * 0.2, 0);
      return geoms;
    }

    // legs (biped: Lapith fighters and procession walkers alike)
    pushBox(legR, fh * 0.42, legR, cx - fh * 0.07 + stance * 0.4, baseY + fh * 0.21, 0, 0.05);
    pushBox(legR, fh * 0.42, legR, cx + fh * 0.07 - stance * 0.4, baseY + fh * 0.21, 0, -0.05);
    // torso
    pushBox(torsoW, torsoH, depth * 0.9, cx, baseY + fh * 0.42 + torsoH / 2, 0, 0);
    // arms — a Lapith gets one arm raised overhead with a weapon; everyone else swings both
    var armLen = fh * 0.36;
    var raised = variant === 'lapith';
    pushBox(legR * 0.75, armLen, legR * 0.75, cx - torsoW * 0.55 + armSwing * 0.3, baseY + fh * 0.62, dz * 0.1, 0.5 + armSwing * 0.01);
    pushBox(legR * 0.75, armLen, legR * 0.75, cx + torsoW * 0.55 - armSwing * 0.3, baseY + fh * (raised ? 0.74 : 0.62), dz * 0.1, raised ? -1.15 : (-0.5 - armSwing * 0.01));
    if (raised) {
      // weapon: a thin diagonal bar gripped in the raised hand
      pushBox(legR * 0.35, fh * 0.34, legR * 0.35, cx + torsoW * 0.85, baseY + fh * 0.92, dz * 0.15, -0.3);
    }
    // head
    pushBox(headS, headS, Math.min(headS, depth), cx, baseY + fh * 0.42 + torsoH + headS * 0.5, dz * 0.15, 0);

    if (!lowDetail) {
      // a light drape fold across the torso for frieze-grade panels
      pushBox(torsoW * 1.1, torsoH * 0.14, depth * 0.7, cx, baseY + fh * 0.5, dz * 0.25, 0.3);
    }
    return geoms;
  }

  // H.makeRelief(w, h, {figures, lowDetail, seed}) -> single merged Mesh, mats.marbleRelief.
  // Square-ish panels (w/h < 2.2, i.e. metope-shaped) get an alternating Lapith/
  // centaur combat pair; wide strips (friezes) get a plain marching procession —
  // this is decided from the panel's own proportions so every existing call site
  // (metopes, the Panathenaic frieze, the altar frieze) gets the right reading
  // without needing to pass a new option.
  H.makeRelief = function (w, h, o) {
    o = o || {};
    var figures = o.figures !== undefined ? o.figures : 2;
    var lowDetail = !!o.lowDetail;
    var seed = (o.seed !== undefined ? o.seed : 1) * 97 + 13;
    var depth = 0.15;
    var slabThickness = depth * 0.5;
    var combat = (w / h) < 2.2;

    var geoms = [];
    var slab = new THREE.BoxGeometry(w, h, slabThickness);
    slab.translate(0, 0, -slabThickness / 2);
    geoms.push(slab);

    var reliefDepth = depth - slabThickness;
    for (var i = 0; i < figures; i++) {
      var t = figures > 1 ? i / (figures - 1) : 0.5;
      var fx = (t - 0.5) * w * 0.82;
      var fh = h * (lowDetail ? 0.80 : 0.86);
      var baseY = -h / 2 + h * 0.03;
      var variant = combat ? (i % 2 === 0 ? 'lapith' : 'centaur') : 'procession';
      var fgeoms = reliefFigureGeoms(fx, baseY, fh, reliefDepth, seed + i * 7, lowDetail, variant);
      for (var k = 0; k < fgeoms.length; k++) geoms.push(fgeoms[k]);
    }

    var merged = mergeGeoms(geoms);
    var mesh = new THREE.Mesh(merged, mats.marbleRelief);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // ================= H.makePromachos =================
  // 2.5m moulded marble plinth; 9m bronze Athena Promachos: Corinthian helmet with high crest,
  // aegis, long peplos, shield resting on the ground by the left leg, spear (gilded tip) in the
  // right hand reaching ~11m. Origin at the plinth base.
  H.makePromachos = function (o) {
    o = o || {};
    var group = new THREE.Group();
    var plinthH = 2.5;
    var seed = 71;

    var base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 3.5), mats.marble);
    base.position.y = 0.15;
    base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    var shaft = new THREE.Mesh(new THREE.BoxGeometry(3.0, plinthH - 0.6, 3.0), mats.marble);
    shaft.position.y = 0.3 + (plinthH - 0.6) / 2;
    shaft.castShadow = true; shaft.receiveShadow = true;
    group.add(shaft);
    var cap = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 3.3), mats.marble);
    cap.position.y = plinthH - 0.15;
    cap.castShadow = true; cap.receiveShadow = true;
    group.add(cap);

    var height = 9;
    var mat = mats.bronzePatina;
    // arms:false — this statue's arms are custom-built below (shield arm, spear arm);
    // building buildStandingBody's own default pair too would leave two overlapping
    // sets of limbs, which is exactly what made earlier renders read as a confused
    // dark blob rather than a clean silhouette. foldScale/leanScale exaggerate the
    // peplos folds and the contrapposto lean so the bronze reads as a shaped figure
    // — not flat color — even under the patina's dark, uneven material.
    var built = buildStandingBody(height, mat, seed, { weightSide: 1, sash: true, arms: false, foldScale: 1.8, leanScale: 1.3, headTurn: 0 });
    var statue = built.group;
    statue.position.y = plinthH;
    group.add(statue);

    var shoulderY = plinthH + built.shoulderY;
    var headTopY = plinthH + built.headTopY;

    // Corinthian helmet: skull dome + nose guard + cheek flaps + a high arched crest
    var helmR = built.headSize * 1.25;
    var helmCenterY = headTopY - built.headSize * 0.35;
    var helm = new THREE.Mesh(new THREE.SphereGeometry(helmR, MOBILE ? 9 : 14, MOBILE ? 6 : 9, 0, PI * 2, 0, PI * 0.62), mat);
    helm.position.y = helmCenterY;
    helm.castShadow = true; helm.receiveShadow = true;
    group.add(helm);
    // nose guard: a 4-sided (box-like) tapered prism, wide at the brow, narrowing to a point at the chin
    var noseGuard = new THREE.Mesh(new THREE.CylinderGeometry(helmR * 0.05, helmR * 0.15, helmR * 1.15, 4), mat);
    noseGuard.rotateY(PI / 4);
    noseGuard.position.set(0, helmCenterY - helmR * 0.32, helmR * 0.85);
    noseGuard.castShadow = true; noseGuard.receiveShadow = true;
    group.add(noseGuard);
    // cheek flaps: curved wrap-around plates (partial cylindrical shells, not flat boxes)
    for (var cheekSide = -1; cheekSide <= 1; cheekSide += 2) {
      var cheekGeo = new THREE.CylinderGeometry(helmR * 0.42, helmR * 0.42, helmR * 0.95, MOBILE ? 6 : 9, 1, true, PI * 0.15, PI * 0.7);
      var cheek = new THREE.Mesh(cheekGeo, mat);
      cheek.rotation.z = cheekSide * PI / 2;
      cheek.rotation.y = cheekSide > 0 ? PI : 0;
      cheek.position.set(cheekSide * helmR * 0.58, helmCenterY - helmR * 0.62, helmR * 0.62);
      cheek.castShadow = true; cheek.receiveShadow = true;
      group.add(cheek);
    }
    // eye holes: a displacement dip in the helm shell at each eye position, ringed by a raised bronze rim
    var helmPos = helm.geometry.getAttribute('position');
    var helmArr = helmPos.array;
    for (var hv = 0; hv < helmArr.length; hv += 3) {
      var hx = helmArr[hv], hy = helmArr[hv + 1], hz = helmArr[hv + 2];
      var hd = sqrt(hx * hx + hy * hy + hz * hz) || 1;
      var hnx = hx / hd, hny = hy / hd, hnz = hz / hd;
      for (var eyeSide = -1; eyeSide <= 1; eyeSide += 2) {
        var eyeDx = hnx - eyeSide * 0.30, eyeDy = hny - (-0.10);
        var eyeFall = gaussFall(sqrt(eyeDx * eyeDx + eyeDy * eyeDy), 0.16) * Math.max(0, hnz - 0.4);
        hd -= helmR * 0.22 * eyeFall;
      }
      helmArr[hv] = hnx * hd; helmArr[hv + 1] = hny * hd; helmArr[hv + 2] = hnz * hd;
    }
    helmPos.needsUpdate = true;
    helm.geometry.computeVertexNormals();
    for (var eyeRimSide = -1; eyeRimSide <= 1; eyeRimSide += 2) {
      var eyeRim = new THREE.Mesh(new THREE.TorusGeometry(helmR * 0.13, helmR * 0.028, MOBILE ? 5 : 7, MOBILE ? 8 : 12), mat);
      eyeRim.position.set(eyeRimSide * helmR * 0.30, helmCenterY - helmR * 0.10, helmR * 0.94);
      eyeRim.castShadow = true; eyeRim.receiveShadow = true;
      group.add(eyeRim);
    }
    // crest: a row of adjoining vertical slabs whose tops trace a smooth high arc
    // (nape to brow), reading as one continuous crest from any angle.
    var crestN = MOBILE ? 7 : 13, crestPeak = helmR * 1.55, crestLen = helmR * 2.5, crestBaseY = helmCenterY + helmR * 0.52;
    var crestSlabD = (crestLen / crestN) * 1.2;
    for (var ci = 0; ci < crestN; ci++) {
      var ct = ci / (crestN - 1);
      var archZ = (ct - 0.5) * crestLen;
      var segH = Math.max(helmR * 0.14, crestPeak * Math.pow(sin(ct * PI), 0.65));
      var fin = new THREE.Mesh(new THREE.BoxGeometry(helmR * 0.11, segH, crestSlabD), mat);
      fin.position.set(0, crestBaseY + segH / 2, archZ);
      fin.castShadow = true; fin.receiveShadow = true;
      group.add(fin);
    }

    // Aegis: a carved dome (displaced lathe, snake-coil ridges radiating from the boss) across the
    // chest/shoulders, with a gorgoneion boss modelled from the same head-sculpting logic as makeHead.
    var aegisY = shoulderY - built.headSize * 0.2;
    var aegisR = built.maxR * 1.55;
    var aegisBulge = aegisR * 0.7;
    var aegisProfile = [
      new THREE.Vector2(aegisR, 0),
      new THREE.Vector2(aegisR * 0.88, aegisBulge * 0.30),
      new THREE.Vector2(aegisR * 0.55, aegisBulge * 0.65),
      new THREE.Vector2(0.001, aegisBulge)
    ];
    var aegis = foldedLathe(aegisProfile, {
      material: mat, seed: seed + 3, span: aegisBulge, radial: MOBILE ? 16 : 26,
      vFold: 0.018, vFoldCount: 18, catAmp: 0, micro: 0
    });
    aegis.position.set(0, aegisY, 0);
    aegis.rotation.x = -PI / 2;
    aegis.scale.set(1, 1, 0.55);
    group.add(aegis);
    var gorgon = makeHead(built.headSize * 0.42, { material: mat, hair: true, hairMaterial: mat, lowRes: true });
    gorgon.position.set(0, aegisY - built.headSize * 0.1, built.maxR * 0.92);
    group.add(gorgon);

    // Shield: resting on the ground against the left side, held by the bent left arm
    var shieldR = height * 0.20;
    var shieldX = -built.maxR * 2.1, shieldZ = height * 0.16;
    var shieldY = plinthH + shieldR + 0.02;
    var shieldDisc = new THREE.Mesh(new THREE.CylinderGeometry(shieldR, shieldR, height * 0.03, MOBILE ? 16 : 28), mat);
    shieldDisc.rotation.x = PI / 2;
    shieldDisc.rotation.y = 0.12;
    shieldDisc.position.set(shieldX, shieldY, shieldZ);
    shieldDisc.castShadow = true; shieldDisc.receiveShadow = true;
    group.add(shieldDisc);
    var shieldRim = new THREE.Mesh(new THREE.TorusGeometry(shieldR, height * 0.018, MOBILE ? 6 : 8, MOBILE ? 16 : 26), mat);
    shieldRim.rotation.y = 0.12;
    shieldRim.position.set(shieldX, shieldY, shieldZ);
    shieldRim.castShadow = true; shieldRim.receiveShadow = true;
    group.add(shieldRim);
    // shield boss: a carved gorgoneion (Medusa head), scaled and centred to dominate the shield
    // face rather than read as a small bump on it.
    var shieldBoss = makeHead(shieldR * 0.44, { material: mat, hair: true, hairMaterial: mat, lowRes: true });
    shieldBoss.rotation.y = 0.12;
    shieldBoss.position.set(shieldX + shieldR * 0.02, shieldY, shieldZ + shieldR * 0.20);
    group.add(shieldBoss);
    // left arm resting on the shield rim
    var leftShoulder = new THREE.Vector3(-built.maxR * 0.92, shoulderY, height * 0.015);
    var leftElbow = new THREE.Vector3(shieldX * 0.55, shoulderY - height * 0.14, shieldZ * 0.5);
    var leftHand = new THREE.Vector3(shieldX + shieldR * 0.1, shieldY + shieldR * 0.75, shieldZ);
    group.add(taperedLimb(leftShoulder, leftElbow, height * 0.032, height * 0.026, MOBILE ? 6 : 9, mat));
    group.add(taperedLimb(leftElbow, leftHand, height * 0.026, height * 0.021, MOBILE ? 6 : 9, mat));
    group.add(jointBall(leftShoulder, height * 0.030, mat));
    group.add(jointBall(leftElbow, height * 0.024, mat));
    group.add(ballMesh(height * 0.022, 5, mat, leftHand));

    // Spear: right hand raised, shaft ~11m tall with a gilded leaf-shaped tip
    var rightShoulder = new THREE.Vector3(built.maxR * 0.92, shoulderY, height * 0.015);
    var rightElbow = new THREE.Vector3(built.maxR * 1.05, shoulderY - height * 0.06, height * 0.10);
    var rightHand = new THREE.Vector3(built.maxR * 1.0, shoulderY + height * 0.02, height * 0.04);
    group.add(taperedLimb(rightShoulder, rightElbow, height * 0.032, height * 0.026, MOBILE ? 6 : 9, mat));
    group.add(taperedLimb(rightElbow, rightHand, height * 0.026, height * 0.022, MOBILE ? 6 : 9, mat));
    group.add(jointBall(rightShoulder, height * 0.030, mat));
    group.add(jointBall(rightElbow, height * 0.024, mat));
    group.add(ballMesh(height * 0.022, 5, mat, rightHand));

    var spearLen = 11;
    var spearBottomY = plinthH + 0.05;
    var spearTopY = spearBottomY + spearLen;
    var spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, spearLen * 0.94, MOBILE ? 6 : 8), mat);
    spearShaft.position.set(rightHand.x, spearBottomY + spearLen * 0.47, rightHand.z);
    spearShaft.castShadow = true; spearShaft.receiveShadow = true;
    group.add(spearShaft);
    // spear tip: a leaf-shaped bronze/gilt head — two tapered cones joined base-to-base (lathed,
    // 4 sides for a crisp diamond cross-section with a distinct spine and edges), not a plain cone
    var tipH = spearLen * 0.075, tipMaxR = spearLen * 0.0085;
    var tipProfile = [
      new THREE.Vector2(0.006, 0),
      new THREE.Vector2(tipMaxR, tipH * 0.32),
      new THREE.Vector2(0.002, tipH)
    ];
    var tipGeo = new THREE.LatheGeometry(tipProfile, 4);
    tipGeo.rotateY(PI / 4);
    var spearTip = new THREE.Mesh(tipGeo, mats.gold);
    spearTip.position.set(rightHand.x, spearTopY - tipH, rightHand.z);
    spearTip.castShadow = true; spearTip.receiveShadow = true;
    group.add(spearTip);

    return group;
  };
};
