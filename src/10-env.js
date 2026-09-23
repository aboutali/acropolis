// Module 10: Environment — physically-inspired sky, image-based lighting, sun + shadows,
// aerial haze, and cheap distant land/sea. Late-afternoon light from the west-southwest.
window.buildEnv = function (THREE, scene, renderer) {
  var CFG = window.CFG || { MOBILE: false, PLATEAU_CX: -45, PLATEAU_CZ: 0 };
  var MOBILE = !!CFG.MOBILE;
  var cx = (typeof CFG.PLATEAU_CX === 'number') ? CFG.PLATEAU_CX : -45;
  var cz = (typeof CFG.PLATEAU_CZ === 'number') ? CFG.PLATEAU_CZ : 0;

  // Deterministic value-noise + fBm (no built-in random, no imports): a fixed-hash lattice noise
  // combined across 4 octaves at 0.5 persistence gives the multi-scale, fractal-like ridgeline
  // variation real mountain profiles have (broad shoulders + medium bumps + fine jaggedness),
  // instead of the old per-column independent-random ("cardboard cutout") look.
  function latticeHash(i, seed) {
    var x = Math.sin(i * 12.9898 + seed * 78.233 + 1.0) * 43758.5453;
    return x - Math.floor(x);
  }
  function valueNoise1D(x, seed) {
    var i0 = Math.floor(x), f = x - i0;
    var a = latticeHash(i0, seed), b = latticeHash(i0 + 1, seed);
    var u = f * f * (3.0 - 2.0 * f);
    return a + (b - a) * u;
  }
  function fbm1D(x, seed, octaves, persistence) {
    var total = 0, amp = 1, freq = 1, maxAmp = 0;
    for (var o = 0; o < octaves; o++) {
      total += valueNoise1D(x * freq, seed + o * 101.0) * amp;
      maxAmp += amp;
      amp *= persistence;
      freq *= 2.0;
    }
    return maxAmp > 0 ? total / maxAmp : 0;
  }
  function smoothstepJs(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  // Late-afternoon sun: elevation ~30 deg, bearing WSW (247.5 deg from north, +x East / +z South)
  // so the sun sits fairly high and a touch south-of-west, lighting the south and west facades
  // without the low, reddened light of true sunset.
  var sunElRad = 30 * Math.PI / 180;
  var sunBearingRad = 247.5 * Math.PI / 180;
  var sunDirX = Math.sin(sunBearingRad) * Math.cos(sunElRad);
  var sunDirY = Math.sin(sunElRad);
  var sunDirZ = -Math.cos(sunBearingRad) * Math.cos(sunElRad);
  var sunDirVec = new THREE.Vector3(sunDirX, sunDirY, sunDirZ);

  // Afternoon sky, not sunset: a deep, clear blue overhead falls off to a PALE WARM-WHITE haze
  // at the horizon (never orange/red — that reads as sunset, and the sun here is ~30 deg up).
  // The warm tint is concentrated in a fairly narrow cone around the sun's azimuth (real
  // forward-scatter haze brightening near the sun), everywhere else the horizon just pales
  // toward a cool, neutral blue-grey.
  var zenithColor = new THREE.Color(0x123d6e);
  var horizonColor = new THREE.Color(0xc3d2e3);
  var horizonWarmColor = new THREE.Color(0xfdf2dc);
  var sunSkyColor = new THREE.Color(0xfff2d4);
  var groundDusk = new THREE.Color(0x26221d);
  var RAYLEIGH_K = 3.3;

  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: sunDirVec },
      sunColor: { value: sunSkyColor },
      zenith: { value: zenithColor },
      horizon: { value: horizonColor },
      horizonWarm: { value: horizonWarmColor },
      groundCol: { value: groundDusk },
      rayleighK: { value: RAYLEIGH_K }
    },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 zenith; uniform vec3 horizon; uniform vec3 horizonWarm; uniform vec3 groundCol; uniform float rayleighK; varying vec3 vW;' +
      'void main(){' +
      ' vec3 dir = normalize(vW);' +
      ' float up = dir.y;' +
      ' float horizonMix = exp(-max(up, 0.0) * rayleighK);' +
      // Warm the horizon only in a cone around the sun's azimuth, and keep that cone tighter
      // than before so the brightening reads as haze near the sun rather than a band that
      // wraps most of the horizon.
      ' vec2 dirXZ = normalize(dir.xz + vec2(1e-5));' +
      ' vec2 sunXZ = normalize(sunDir.xz + vec2(1e-5));' +
      ' float azDot = dot(dirXZ, sunXZ);' +
      // Wider still, more gradual horizon-to-zenith blend so the pale-warm and deep-blue
      // tones melt into each other with no visible transition band or step.
      ' float warmMix = smoothstep(-0.1, 0.8, azDot);' +
      ' vec3 horizonTone = mix(horizon, horizonWarm, warmMix);' +
      ' vec3 col = mix(zenith, horizonTone, clamp(horizonMix, 0.0, 1.0));' +
      ' float cosGamma = clamp(dot(dir, sunDir), -1.0, 1.0);' +
      // Broad luminous zone around the sun (~50 degree cone) — real bright afternoon sun
      // washes out a wide swath of sky, not just a tight corona.
      ' float sunHalo = pow(max(cosGamma, 0.0), 6.0);' +
      ' float mieOuter = pow(max(cosGamma, 0.0), 70.0);' +
      ' float mieInner = pow(max(cosGamma, 0.0), 1600.0);' +
      ' float corona = pow(max(cosGamma, 0.0), 3000.0);' +
      ' col += sunColor * sunHalo * 0.16;' +
      ' col += sunColor * mieOuter * 0.08;' +
      ' col += sunColor * mieInner * 0.30;' +
      ' col += sunColor * corona * 1.2;' +
      ' float disk = smoothstep(0.99975, 0.99992, cosGamma);' +
      ' col = mix(col, sunColor * 2.0, disk);' +
      // Below-horizon darkening only matters where the dome peeks under distant geometry.
      ' float below = smoothstep(0.0, -0.3, up);' +
      ' col = mix(col, groundCol, below);' +
      ' gl_FragColor = vec4(col, 1.0);' +
      '}'
  });

  var skySegs = MOBILE ? [22, 11] : [32, 16];
  var sky = new THREE.Mesh(new THREE.SphereGeometry(2400, skySegs[0], skySegs[1]), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // Image-based lighting: bake a cheap vertex-coloured approximation of the sky gradient
  // (+ a simple warm ground tone) into a PMREM environment, so MeshStandardMaterial gets
  // realistic ambient light and reflections. A plain vertex-colour mesh (not the live
  // ShaderMaterial dome) is used for the bake: feeding a custom ShaderMaterial through
  // PMREMGenerator's cube capture reliably produced a broken (all-black) environment here.
  var envSkyGeo = new THREE.SphereGeometry(1, 20, 10);
  var envPos = envSkyGeo.attributes.position;
  var envCol = new Float32Array(envPos.count * 3);
  var tmpCol = new THREE.Color();
  var tmpHz = new THREE.Color();
  for (var evi = 0; evi < envPos.count; evi++) {
    var epx = envPos.getX(evi), epy = envPos.getY(evi), epz = envPos.getZ(evi);
    var elen = Math.sqrt(epx * epx + epy * epy + epz * epz) || 1;
    var eux = epx / elen, euy = epy / elen, euz = epz / elen;
    var eHorizonMix = Math.min(1, Math.max(0, Math.exp(-Math.max(euy, 0) * RAYLEIGH_K)));
    var eAzLen = Math.sqrt(epx * epx + epz * epz) || 1;
    var eSunAzLen = Math.sqrt(sunDirX * sunDirX + sunDirZ * sunDirZ) || 1;
    var eAzDot = (epx / eAzLen) * (sunDirX / eSunAzLen) + (epz / eAzLen) * (sunDirZ / eSunAzLen);
    var eWarmMix = smoothstepJs(-0.1, 0.8, eAzDot);
    tmpHz.copy(horizonColor).lerp(horizonWarmColor, eWarmMix);
    tmpCol.copy(zenithColor).lerp(tmpHz, eHorizonMix);
    var eCosGamma = eux * sunDirX + euy * sunDirY + euz * sunDirZ;
    var eHalo = Math.pow(Math.max(eCosGamma, 0), 6) * 0.16;
    var eGlow = Math.pow(Math.max(eCosGamma, 0), 20) * 0.30 + eHalo;
    tmpCol.r += sunSkyColor.r * eGlow; tmpCol.g += sunSkyColor.g * eGlow; tmpCol.b += sunSkyColor.b * eGlow;
    if (euy < 0) tmpCol.lerp(groundDusk, Math.min(1, Math.max(0, -euy / 0.3)));
    // Dim the baked copy well below the dome's on-screen brightness: this feeds ambient/
    // reflection only, and direct sun should still dominate the shading contrast.
    envCol[evi * 3] = tmpCol.r * 0.55; envCol[evi * 3 + 1] = tmpCol.g * 0.55; envCol[evi * 3 + 2] = tmpCol.b * 0.55;
  }
  envSkyGeo.setAttribute('color', new THREE.BufferAttribute(envCol, 3));
  var envScene = new THREE.Scene();
  var envSky = new THREE.Mesh(envSkyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  envScene.add(envSky);
  var envGroundMat = new THREE.MeshBasicMaterial({ color: 0x776b52 });
  var envGround = new THREE.Mesh(new THREE.CircleGeometry(1, 16), envGroundMat);
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -0.02;
  envScene.add(envGround);
  var pmrem = new THREE.PMREMGenerator(renderer);
  var envRT = pmrem.fromScene(envScene, 0.03, 0.1, 10);
  scene.environment = envRT.texture;
  pmrem.dispose();

  // Hemisphere gives the overall warm/cool modelling light (pale gold sky bounce over a
  // warm-earth ground bounce); ambient is a soft, pale-blue sky-reflectance fill so shadowed
  // marble reads as cool-in-shadow rather than pure black.
  // Hemisphere trimmed back down (was 0.30): at 5.5x sun intensity the previous round's
  // foreground paved areas were overexposed relative to the faded distance — 0.22 keeps the
  // sky/ground bounce fill without competing with direct sun for the near-field highlights.
  scene.add(new THREE.HemisphereLight(0xe9e0c9, 0x6b5c46, 0.22));
  scene.add(new THREE.AmbientLight(0xc8d8e8, 0.18));

  // Sun: a soft warm-white gold rather than a saturated orange, so marble reads warm without
  // tipping into an orange cast (that belongs to sunset, not a 30-degree afternoon sun).
  // Intensity brought back down from the previous round's 5.5 (which, combined with the
  // hemisphere fill, overexposed near-field paving and blew the distant hill ranges to
  // near-white under ACES) to 4.7 — still a bright, clear afternoon sun, but with headroom for
  // hue to survive tonemapping on distant, lower-albedo surfaces. Color pulled slightly less
  // red/orange (0xffc877, was 0xffe7c0) so marble reads warm cream rather than peachy.
  var sun = new THREE.DirectionalLight(0xffc877, 4.7);
  var sunDist = 300;
  sun.position.set(cx + sunDirX * sunDist, sunDirY * sunDist, cz + sunDirZ * sunDist);
  sun.castShadow = true;
  var mapSize = MOBILE ? 2048 : 4096;
  sun.shadow.mapSize.set(mapSize, mapSize);
  var camR = 195;
  sun.shadow.camera.left = -camR;
  sun.shadow.camera.right = camR;
  sun.shadow.camera.top = camR;
  sun.shadow.camera.bottom = -camR;
  sun.shadow.camera.near = 60;
  sun.shadow.camera.far = 560;
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.55;
  sun.target.position.set(cx, 0, cz);
  scene.add(sun);
  scene.add(sun.target);

  // Aerial perspective: fog colour matches the sky's pale horizon tone exactly, and density is
  // tuned so the flat ground plain (and everything else) visibly fades to blue-grey haze by
  // roughly a kilometre out, instead of staying crisp (and warm-tinted) all the way to a bright
  // band at the horizon.
  // Density lowered from the previous round (0.00082/0.00068): that value, stacked on top of
  // the (now-fixed) light overexposure, fogged the ground plain to a hard-edged pale wall a
  // short distance out instead of a smooth continuous gradient. This still fully hazes the
  // plain by ~1.5-2km but the exponential falloff is gentler in between, so there's no visible
  // seam between the near, clear ground and the fully-hazed distance.
  // Color fixed to the pure warm horizon tone (previous round) made EVERY fogged surface fade
  // to gold, even the ground looking away from the sun — a render check on the parthenon preset
  // (camera facing roughly south/away from the sun) showed the plain fading to warm cream all
  // the way to the frame edge instead of blue-grey. FogExp2 only takes one color, so this mostly
  // cool tone (a mild lean toward the warm tone, not the full horizonWarm) reads as the target's
  // "blue-grey haze matching the sky horizon" in most directions, while the sky shader itself
  // still shows the strong warm brightening exactly toward the sun.
  var fogColor = horizonColor.clone().lerp(horizonWarmColor, 0.18);
  var fogDensity = MOBILE ? 0.00046 : 0.00058;
  scene.fog = new THREE.FogExp2(fogColor.getHex(), fogDensity);

  // Distant hill ranges: real heightfield strips (a handful of rows deep, a few dozen columns
  // wide) rather than a single flat ribbon, so slopes are rounded, ridgelines are noisy, and a
  // proper lit material lets the sun model the terrain instead of it reading as a flat unlit
  // cutout. Three staggered layers (Hymettus east, Parnitha north, Aigaleo west); farther
  // layers use a paler, bluer base colour so they read as sitting further back through haze.
  // Engine fog is left off this material (at 4-5 km it would wash the layers to nothing before
  // they ever reached the screen) and a single, distance-scaled manual haze blend is baked into
  // the colour once instead — gentle enough that the ranges stay a readable silhouette, as they
  // do in reference photos of Hymettus/Parnitha seen from the Acropolis.
  // Distant-atmosphere tint: real Mediterranean haze on far ranges leans grey-purple rather
  // than neutral blue-grey, and near ranges keep a subtle warm-grey undertone from the low
  // afternoon sun raking across them. Kept separate from the ground/sky fog colour (which
  // stays matched to the pale horizon tone) so the two are tuned independently.
  // Used undiluted (not lerped toward the pale fog colour): the sun's high intensity plus ACES
  // tonemapping already compresses a lot of saturation out of distant geometry, so the source
  // tint needs real saturation of its own for a grey-purple/warm-grey undertone to actually
  // survive onto screen (see the emissive veil below, which is what mainly carries this hue).
  var hazeCool = new THREE.Color(0x6f5490);
  var hazeWarm = new THREE.Color(0xc08a52);
  function buildHillGeometry(b0, b1, radius, baseY, hMin, hMax, seed, cols, rows) {
    var peak = [];
    for (var c = 0; c <= cols; c++) {
      // 4-octave fBm (0.5 persistence) over a fixed-hash lattice gives a fractal-like
      // ridgeline: broad shoulders from the low octave, medium bumps and fine jaggedness
      // layered on top, instead of independent per-column randomness.
      var fbmVal = fbm1D((c / cols) * 6.0, seed, 4, 0.5);
      peak.push(0.35 + 0.65 * fbmVal);
    }
    var pos = [];
    var norml = [];
    var idx = [];
    for (var r = 0; r <= rows; r++) {
      var rt = r / rows;
      // Rounded cross-section: 0 at the near and far edge of the strip, cresting a bit past
      // the middle row — this is what gives the range real rounded slopes (and normals the
      // sun can model) instead of a flat vertical ribbon.
      var envelope = Math.sin(Math.PI * Math.pow(rt, 0.85));
      var rowRadius = radius + (rt - 0.5) * 90;
      for (var c = 0; c <= cols; c++) {
        var t = c / cols;
        var bearing = (b0 + (b1 - b0) * t) * Math.PI / 180;
        var dx = Math.sin(bearing), dz = -Math.cos(bearing);
        var x = cx + dx * rowRadius, z = cz + dz * rowRadius;
        // Small additional detail octave, offset per row so rows are not identical, but built
        // from the SAME smooth-interpolated fBm lattice as the main ridgeline rather than an
        // independent per-vertex random sample. The old per-vertex LCG jitter here was
        // uncorrelated between neighbouring columns, which is exactly what produced the
        // discontinuous, "stair-stepped" silhouette the art director flagged; this stays
        // continuous in c (and varies smoothly row-to-row) so slopes read as rounded terrain
        // down to the finest visible scale instead of jittering off the ridgeline curve.
        var detail = (fbm1D((c / cols) * 17.0 + r * 0.9, seed + 900 + r * 13, 3, 0.5) - 0.5) * 22 * envelope;
        var y = baseY + envelope * (hMin + (hMax - hMin) * peak[c]) + detail;
        pos.push(x, y, z);
      }
    }
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        var i0 = r2 * (cols + 1) + c2;
        var i1 = i0 + 1;
        var i2 = i0 + (cols + 1);
        var i3 = i2 + 1;
        idx.push(i0, i2, i1, i1, i2, i3);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  var hillCols = MOBILE ? 20 : 36;
  var hillRows = MOBILE ? 5 : 9;
  // Haze-blend steps now progress gradually across layers (0.28 / 0.33 / 0.40, was a jump to
  // 0.50) so there's no visible atmospheric-density step between ranges, and each layer mixes
  // its own warm/cool haze balance ("warm": 1 = warm-grey undertone from raking sun, 0 = cooler
  // grey-purple distant-atmosphere tone) — nearer ranges lean warm, the farthest leans purple.
  var ranges = [
    { b0: 55, b1: 128, r: 4200, base: -58, hMin: 170, hMax: 310, seed: 71, color: 0x5b6d72, haze: 0.33, warm: 0.45 },   // Hymettus, east (mid distance)
    { b0: -38, b1: 42, r: 5200, base: -68, hMin: 230, hMax: 400, seed: 133, color: 0x556570, haze: 0.40, warm: 0.15 }, // Parnitha, north (farthest -> palest, most purple)
    { b0: 232, b1: 306, r: 3900, base: -52, hMin: 150, hMax: 280, seed: 205, color: 0x60717a, haze: 0.28, warm: 0.70 }  // Aigaleo, west (nearest -> least faded, warmest)
  ];
  for (var ri = 0; ri < ranges.length; ri++) {
    var rg = ranges[ri];
    var hazeMix = hazeCool.clone().lerp(hazeWarm, rg.warm);
    // Albedo kept fairly dark, as before — the scene sun is intense, and a bright albedo pushes
    // sunlit ridge crests into ACES' highlight rolloff, which flattens hue back to grey/white.
    // What changed from the previous round: the emissive "haze veil" is now a SMALL constant
    // top-up (0.12-0.19) rather than a dominant 1.0-1.4x term. At the previous round's sun
    // intensity (5.5) plus that strong emissive, the west-facing range's directly-lit crests
    // summed to well over 1.0 on every channel before ACES ever saw them, which is exactly an
    // achromatic (white-out) condition — no amount of source hue survives that. With the sun
    // pulled back to 4.7 and the emissive trimmed down, direct+ambient+emissive stays under or
    // close to 1.0 on the brightest slopes, so the per-range warm/purple tint is still visible in
    // the render rather than only in the numbers.
    var hillCol = new THREE.Color(rg.color).multiplyScalar(0.42).lerp(hazeMix, rg.haze * 0.3);
    var hillMat = new THREE.MeshLambertMaterial({
      color: hillCol, emissive: hazeMix, emissiveIntensity: 0.12 + rg.haze * 0.18,
      fog: false, side: THREE.DoubleSide
    });
    var hillGeo = buildHillGeometry(rg.b0, rg.b1, rg.r, rg.base, rg.hMin, rg.hMax, rg.seed, hillCols, hillRows);
    var hillMesh = new THREE.Mesh(hillGeo, hillMat);
    hillMesh.frustumCulled = false;
    scene.add(hillMesh);
  }

  // Saronic Gulf: a flat, faintly reflective sea plane to the southwest, beyond the city ring.
  // It keeps ordinary scene fog (unlike the hill ranges) so it genuinely reads as a hazy blue
  // strip fading toward the same horizon tone at its outer edge.
  var seaSegs = MOBILE ? 10 : 18;
  var innerR = 1250, outerR = 5600, seaB0 = 172, seaB1 = 288, seaY = -79.4;
  var seaVerts = [], seaNormals = [];
  for (var si = 0; si < seaSegs; si++) {
    var t0 = si / seaSegs, t1 = (si + 1) / seaSegs;
    var a0 = (seaB0 + (seaB1 - seaB0) * t0) * Math.PI / 180;
    var a1 = (seaB0 + (seaB1 - seaB0) * t1) * Math.PI / 180;
    var ix0 = cx + Math.sin(a0) * innerR, iz0 = cz - Math.cos(a0) * innerR;
    var ox0 = cx + Math.sin(a0) * outerR, oz0 = cz - Math.cos(a0) * outerR;
    var ix1 = cx + Math.sin(a1) * innerR, iz1 = cz - Math.cos(a1) * innerR;
    var ox1 = cx + Math.sin(a1) * outerR, oz1 = cz - Math.cos(a1) * outerR;
    seaVerts.push(ix0, seaY, iz0, ox0, seaY, oz0, ox1, seaY, oz1);
    seaVerts.push(ix0, seaY, iz0, ox1, seaY, oz1, ix1, seaY, iz1);
    for (var vn = 0; vn < 6; vn++) seaNormals.push(0, 1, 0);
  }
  var seaGeo = new THREE.BufferGeometry();
  seaGeo.setAttribute('position', new THREE.Float32BufferAttribute(seaVerts, 3));
  seaGeo.setAttribute('normal', new THREE.Float32BufferAttribute(seaNormals, 3));
  // Deeper, more saturated blue (was 0x35607e) and a touch more metalness/reflectivity so the
  // gulf reads as a distinct hazy blue strip rather than blending into the pale ground haze.
  var seaMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5a, roughness: 0.12, metalness: 0.08, envMapIntensity: 1.4, side: THREE.DoubleSide });
  var sea = new THREE.Mesh(seaGeo, seaMat);
  sea.frustumCulled = false;
  scene.add(sea);

  // Renderer: filmic tone mapping, sRGB output, exposure tuned for a warm but unclipped glow.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Slightly under 1.0: with the sun/hemisphere trimmed back this keeps the zenith reading as a
  // crisp, saturated blue rather than a bleached pale one, and gives distant low-albedo surfaces
  // (hills, sea) a little more headroom before ACES' highlight rolloff flattens their hue.
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return { sun: sun, update: function (dt) {} };
};
