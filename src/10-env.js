// Module 10: Environment — physically-inspired sky, image-based lighting, sun + shadows,
// aerial haze, and cheap distant land/sea. Late-afternoon light from the west-southwest.
window.buildEnv = function (THREE, scene, renderer) {
  var CFG = window.CFG || { MOBILE: false, PLATEAU_CX: -45, PLATEAU_CZ: 0 };
  var MOBILE = !!CFG.MOBILE;
  var cx = (typeof CFG.PLATEAU_CX === 'number') ? CFG.PLATEAU_CX : -45;
  var cz = (typeof CFG.PLATEAU_CZ === 'number') ? CFG.PLATEAU_CZ : 0;

  // seeded LCG (deterministic pseudo-noise, no built-in random)
  function makeLcg(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  // Late-afternoon sun: elevation ~30 deg, bearing WSW (247.5 deg from north, +x East / +z South)
  // so the sun sits low in the west and a touch south, lighting the south and west facades.
  var sunElRad = 30 * Math.PI / 180;
  var sunBearingRad = 247.5 * Math.PI / 180;
  var sunDirX = Math.sin(sunBearingRad) * Math.cos(sunElRad);
  var sunDirY = Math.sin(sunElRad);
  var sunDirZ = -Math.cos(sunBearingRad) * Math.cos(sunElRad);
  var sunDirVec = new THREE.Vector3(sunDirX, sunDirY, sunDirZ);

  // Deep, saturated zenith blue; the exponential optical-path fade to the horizon is now
  // steeper still (3.2 -> 4.0 -> 4.6) so the blue holds across nearly the whole dome and
  // only turns pale/warm right at the skyline, instead of washing the sky pale. The cool
  // horizon tone was also given a touch more chroma (was a near-neutral 0xcdd3c8) since a
  // fully desaturated horizon read as grey/washed even with the steeper falloff, and the
  // sunset glow was pushed from a beige/tan peach to a saturated orange-amber so the WSW
  // horizon actually reads as fire rather than pale sand.
  var zenithColor = new THREE.Color(0x123d6e);
  var horizonColor = new THREE.Color(0xa9bcd4);
  var horizonWarmColor = new THREE.Color(0xe25f1a);
  var sunSkyColor = new THREE.Color(0xffc27a);
  var groundDusk = new THREE.Color(0x1e1712);
  var RAYLEIGH_K = 4.6;

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
      // Warm the horizon tone toward peach only in the sun's horizontal (azimuthal)
      // direction, so the sunset glow sits at WSW and the rest of the horizon stays a
      // cooler pale haze -- a cheap stand-in for wavelength-dependent optical path length.
      ' vec2 dirXZ = normalize(dir.xz + vec2(1e-5));' +
      ' vec2 sunXZ = normalize(sunDir.xz + vec2(1e-5));' +
      ' float azDot = dot(dirXZ, sunXZ);' +
      ' float warmMix = smoothstep(-0.3, 1.0, azDot);' +
      ' vec3 horizonTone = mix(horizon, horizonWarm, warmMix);' +
      ' vec3 col = mix(zenith, horizonTone, clamp(horizonMix, 0.0, 1.0));' +
      ' float cosGamma = clamp(dot(dir, sunDir), -1.0, 1.0);' +
      // Three tightened glow lobes (outer/inner/corona) replace the old wide-mushy pair:
      // crisper falloff so the halo reads as a corona instead of a diffuse blob.
      // Corona tightened further (900 -> 1600 exponent, 0.55 -> 0.38 coefficient) so the
      // halo reads as a crisp ring of light around the disk rather than a soft diffuse glow.
      ' float mieOuter = pow(max(cosGamma, 0.0), 70.0);' +
      ' float mieInner = pow(max(cosGamma, 0.0), 1600.0);' +
      ' float corona = pow(max(cosGamma, 0.0), 3000.0);' +
      ' col += sunColor * mieOuter * 0.10;' +
      ' col += sunColor * mieInner * 0.38;' +
      ' col += sunColor * corona * 1.4;' +
      ' float disk = smoothstep(0.99975, 0.99992, cosGamma);' +
      ' col = mix(col, sunColor * 2.2, disk);' +
      // Below-horizon darkening: fades from the normal sky/horizon colour at the geometric
      // horizon (up = 0) down to a dark earth tone by up = -0.3, per the art direction note.
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
    var eWarmMix = Math.min(1, Math.max(0, (eAzDot + 0.3) / 1.3));
    tmpHz.copy(horizonColor).lerp(horizonWarmColor, eWarmMix);
    tmpCol.copy(zenithColor).lerp(tmpHz, eHorizonMix);
    var eCosGamma = eux * sunDirX + euy * sunDirY + euz * sunDirZ;
    var eGlow = Math.pow(Math.max(eCosGamma, 0), 20) * 0.35;
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
  // marble reads as cool-in-shadow rather than pure black. Both raised from the first pass,
  // which left shadows synthetically dark and the whole scene tonally flat.
  scene.add(new THREE.HemisphereLight(0xe8dcc0, 0x6b5c46, 0.30));
  scene.add(new THREE.AmbientLight(0xc8d8e8, 0.18));

  var sun = new THREE.DirectionalLight(0xffbb66, 5.0);
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

  // Aerial perspective: fog tuned to the sky's horizon tone. Density roughly halved from the
  // first pass, which buried the distant mountains and city in blank haze well before they
  // reached the horizon.
  scene.fog = new THREE.FogExp2(0xcfc3a4, MOBILE ? 0.000375 : 0.00035);

  // Distant mountains: cheap noisy ridge silhouettes 3-6 km out, unlit so they read as pure
  // haze-tinted silhouette and cost almost nothing.
  function ridgeGeometry(bearing0, bearing1, radius, baseY, peakMin, peakMax, seed, segs) {
    var rnd = makeLcg(seed);
    var verts = [];
    var prevBx = 0, prevBz = 0, prevTx = 0, prevTy = 0, prevTz = 0;
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var bearing = (bearing0 + (bearing1 - bearing0) * t) * Math.PI / 180;
      var dx = Math.sin(bearing), dz = -Math.cos(bearing);
      var bx = cx + dx * radius, bz = cz + dz * radius;
      var h = peakMin + (peakMax - peakMin) * rnd();
      var tx = bx, tz = bz, ty = baseY + h;
      if (i > 0) {
        verts.push(prevBx, baseY - 60, prevBz, prevTx, prevTy, prevTz, bx, baseY - 60, bz);
        verts.push(prevTx, prevTy, prevTz, tx, ty, tz, bx, baseY - 60, bz);
      }
      prevBx = bx; prevBz = bz; prevTx = tx; prevTy = ty; prevTz = tz;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }

  var ridgeSegs = MOBILE ? 8 : 16;
  // Darkened again (r1's pale grey-blue 0x5f7488-family still read ~75-80% into the fog
  // colour and blended to near-invisible pale blobs) to a much darker earth-blue so the
  // ridgelines punch through the haze as distinct, readable silhouettes.
  var ridges = [
    { b0: 55, b1: 128, r: 4200, base: -60, hMin: 200, hMax: 360, seed: 71, color: 0x33465a },   // Hymettus, east
    { b0: -38, b1: 42, r: 5200, base: -70, hMin: 260, hMax: 460, seed: 133, color: 0x2c3d50 },  // Parnitha, north
    { b0: 232, b1: 306, r: 3900, base: -55, hMin: 170, hMax: 320, seed: 205, color: 0x3a4d62 }  // Aigaleo, west
  ];
  // The engine's own FogExp2 curve is quadratic in distance: at these ridges' 3.9-5.2 km
  // range and the tuned density it blends ~88% to the fog colour regardless of the base
  // material colour, which is why simply darkening the ridge colour alone (r1 -> r2's first
  // attempt) barely moved the rendered pixel. Fog is disabled on the ridge material and a
  // single, gentler haze mix is baked into the colour once instead, so distant peaks stay a
  // readable, saturated silhouette (as they do in reference photos of Hymettus/Parnitha from
  // the Acropolis) rather than washing to the horizon tan almost completely.
  var ridgeFogTint = new THREE.Color(0xcfc3a4);
  for (var ri = 0; ri < ridges.length; ri++) {
    var rg = ridges[ri];
    var ridgeCol = new THREE.Color(rg.color).lerp(ridgeFogTint, 0.2);
    // toneMapped:false, like the sky dome's raw ShaderMaterial output: MeshBasicMaterial
    // normally runs through the renderer's ACES + sRGB chunks, which was lifting these dark
    // blues back toward pale grey on screen and defeating the darkening above.
    var ridgeMat = new THREE.MeshBasicMaterial({ color: ridgeCol, fog: false, toneMapped: false, side: THREE.DoubleSide });
    var ridgeMesh = new THREE.Mesh(ridgeGeometry(rg.b0, rg.b1, rg.r, rg.base, rg.hMin, rg.hMax, rg.seed, ridgeSegs), ridgeMat);
    ridgeMesh.frustumCulled = false;
    scene.add(ridgeMesh);
  }

  // Saronic Gulf: a flat, faintly reflective sea plane to the southwest, beyond the city ring.
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
  var seaMat = new THREE.MeshStandardMaterial({ color: 0x2c4c63, roughness: 0.12, metalness: 0.05, envMapIntensity: 1.2, side: THREE.DoubleSide });
  var sea = new THREE.Mesh(seaGeo, seaMat);
  sea.frustumCulled = false;
  scene.add(sea);

  // Renderer: filmic tone mapping, sRGB output, exposure tuned for a warm but unclipped glow.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  return { sun: sun, update: function (dt) {} };
};
