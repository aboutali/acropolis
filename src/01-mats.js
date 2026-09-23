// Module 01: photoreal procedural material + texture library.
// Fast ImageData synthesis (seeded hash noise, deterministic, no RNG calls), Sobel-derived normal maps,
// world-scale-aware UV re-projection via mats.finishScene(scene, renderer).
window.buildMats = function (THREE) {
  var HAS_DOC = typeof document !== 'undefined';
  var MOBILE = !!(window.CFG && window.CFG.MOBILE);
  var SIZE = MOBILE ? 512 : 1024;      // final texture size
  var GEN = MOBILE ? 192 : 384;        // synthesis resolution for the primary (hero) fields
  var GEN_S = MOBILE ? 128 : 256;      // synthesis resolution for secondary fields
  var ALL_TEX = [];

  // ---------------------------------------------------------------
  // Seeded, trig-free integer hash -> tileable value noise -> fbm.
  // Periods are always integral so RepeatWrapping textures tile seamlessly.
  // ---------------------------------------------------------------
  function hashP(ix, iz, seed, px, pz) {
    ix = ((ix % px) + px) % px;
    iz = ((iz % pz) + pz) % pz;
    var h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }
  function vnoiseP(x, z, seed, px, pz) {
    var xi = Math.floor(x), zi = Math.floor(z);
    var xf = x - xi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    var h00 = hashP(xi, zi, seed, px, pz), h10 = hashP(xi + 1, zi, seed, px, pz);
    var h01 = hashP(xi, zi + 1, seed, px, pz), h11 = hashP(xi + 1, zi + 1, seed, px, pz);
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  }
  // Seamlessly tileable fbm over u,v in [0,1). fx/fz = base cell counts per axis (independent -> anisotropic stretch).
  function fbmTile(u, v, seed, fx, fz, oct, gain) {
    var amp = 0.5, sum = 0, norm = 0, mul = 1, i;
    for (i = 0; i < oct; i++) {
      var px = Math.max(1, Math.round(fx * mul)), pz = Math.max(1, Math.round(fz * mul));
      sum += amp * vnoiseP(u * px, v * pz, seed + i * 101, px, pz);
      norm += amp; amp *= gain; mul *= 2;
    }
    return sum / norm;
  }
  function warpTile(u, v, seed, fx, fz, oct, gain, warpAmt) {
    if (!warpAmt) return fbmTile(u, v, seed, fx, fz, oct, gain);
    var wf = Math.max(1, Math.round(fx * 0.4));
    var wu = fbmTile(u, v, seed + 811, wf, wf, 3, 0.5) - 0.5;
    var wv = fbmTile(u, v, seed + 1637, wf, wf, 3, 0.5) - 0.5;
    return fbmTile(u + wu * warpAmt, v + wv * warpAmt, seed, fx, fz, oct, gain);
  }
  function ridgeTile(u, v, seed, fx, fz, oct) {
    var amp = 0.5, sum = 0, norm = 0, mul = 1, i;
    for (i = 0; i < oct; i++) {
      var px = Math.max(1, Math.round(fx * mul)), pz = Math.max(1, Math.round(fz * mul));
      var n = vnoiseP(u * px, v * pz, seed + i * 53, px, pz);
      var r = 1 - Math.abs(2 * n - 1);
      sum += amp * r * r; norm += amp; amp *= 0.5; mul *= 2;
    }
    return sum / norm;
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function byte(x) { x = x < 0 ? 0 : x > 255 ? 255 : x; return x | 0; }
  function fastHash(ix, iz, seed) {
    var h = (ix * 1274126177 + iz * 668265263 + seed * 374761393) | 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = h ^ (h >>> 13);
    return (h >>> 0) / 4294967295;
  }

  // ---------------------------------------------------------------
  // Canvas plumbing
  // ---------------------------------------------------------------
  function newCanvas(n) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }
  function arrToCanvas(data, res) {
    var c = newCanvas(res), ctx = c.getContext('2d');
    var img = ctx.createImageData(res, res);
    img.data.set(data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function upscale(src, size) {
    if (src.width === size) return src;
    var c = newCanvas(size), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, size, size);
    return c;
  }
  function addFineGrain(canvas, amount, seed) {
    var res = canvas.width, ctx = canvas.getContext('2d');
    var img = ctx.getImageData(0, 0, res, res), d = img.data, x, y;
    for (y = 0; y < res; y++) {
      for (x = 0; x < res; x++) {
        var g = (fastHash(x, y, seed) - 0.5) * amount * 255;
        var i = (y * res + x) * 4;
        d[i] = byte(d[i] + g); d[i + 1] = byte(d[i + 1] + g); d[i + 2] = byte(d[i + 2] + g);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  // Very sparse, very-high-frequency bright specks (quartz-sparkle proxy). Applied at
  // full canvas resolution (post-upscale) so it stays crisp instead of blurring away.
  function addSparkle(canvas, density, seed) {
    var res = canvas.width, ctx = canvas.getContext('2d');
    var img = ctx.getImageData(0, 0, res, res), d = img.data, x, y;
    var thresh = 1 - density;
    for (y = 0; y < res; y++) {
      for (x = 0; x < res; x++) {
        var h = fastHash(x, y, seed);
        if (h > thresh) {
          var boost = ((h - thresh) / density) * 44;
          var i = (y * res + x) * 4;
          d[i] = byte(d[i] + boost); d[i + 1] = byte(d[i + 1] + boost); d[i + 2] = byte(d[i + 2] + boost * 0.9);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function toTexture(canvas, srgb) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.needsUpdate = true;
    ALL_TEX.push(t);
    return t;
  }
  // Sobel filter over a wrapped height field -> tangent-space normal map canvas.
  function heightToNormalCanvas(height, res, strength) {
    var out = new Uint8ClampedArray(res * res * 4);
    function h(x, z) { x = ((x % res) + res) % res; z = ((z % res) + res) % res; return height[z * res + x]; }
    var x, z;
    for (z = 0; z < res; z++) {
      for (x = 0; x < res; x++) {
        var tl = h(x - 1, z - 1), tc = h(x, z - 1), tr = h(x + 1, z - 1);
        var l = h(x - 1, z), r = h(x + 1, z);
        var bl = h(x - 1, z + 1), bc = h(x, z + 1), br = h(x + 1, z + 1);
        var gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
        var gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);
        var nx = -gx * strength, ny = -gy * strength, nz = 1;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len; ny /= len; nz /= len;
        var i = (z * res + x) * 4;
        out[i] = byte((nx * 0.5 + 0.5) * 255);
        out[i + 1] = byte((ny * 0.5 + 0.5) * 255);
        out[i + 2] = byte((nz * 0.5 + 0.5) * 255);
        out[i + 3] = 255;
      }
    }
    return arrToCanvas(out, res);
  }

  // Applies a pronounced grounding grime: surfaces darken and warm toward their own base
  // (ancient-marble water-runoff + dust look), heaviest right at grade and fading out over
  // the lower few metres. Uses LOCAL (pre-modelMatrix) vertex Y, not world Y: per the helper
  // contract (H.makeSteppedBase/makeEntablature/makeDoricColumns etc.) each architectural
  // piece is authored with its own y=0 at its base, so this reads correctly on every group
  // regardless of how high that group's platform sits in world space (Parthenon +1.65,
  // Erechtheion +1, Nike bastion +4, ...) — a world-Y version would put whole raised
  // buildings entirely above the darkening threshold and never show any grime on them.
  // Cheap: a few shader-chunk string replacements, no extra texture samples.
  // roughWeather=true (marble family only) also grades roughnessFactor from the same
  // local-height signal: polished-feeling near the top of a piece, much rougher/weathered
  // right at its own base -- addresses the "should graduate polished -> very rough" note.
  function addGroundGrime(mat, roughWeather) {
    mat.onBeforeCompile = function (shader) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vGrimeY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrimeY = transformed.y;');
      var frag = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGrimeY;');
      if (roughWeather) {
        frag = frag.replace('#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\n' +
          '{ float rG = clamp(1.0 - (vGrimeY + 1.0) / 4.0, 0.0, 1.0); rG *= rG; ' +
          'roughnessFactor = clamp(roughnessFactor * (0.8 + rG * 0.5), 0.0, 1.0); }');
      }
      frag = frag.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n' +
        '{ float gGrime = clamp(1.0 - (vGrimeY + 1.0) / 4.0, 0.0, 1.0); gGrime *= gGrime; ' +
        'gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.46, 0.38, 0.30), gGrime * 0.55); }');
      shader.fragmentShader = frag;
    };
  }

  var mats = {};

  // No-canvas environments (should not occur in practice: index.html always runs in a
  // browser) get flat-color materials so the module never throws.
  if (!HAS_DOC) {
    function flat(hex, rough, metal) { return new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal || 0 }); }
    mats.marble = flat(0xe9decc, 0.72); mats.marbleWorn = flat(0xd6c9ac, 0.85); mats.marbleShadowed = flat(0xc4b89c, 0.88);
    mats.rock = flat(0xa2957a, 0.95); mats.rockDark = flat(0x7d735f, 0.97); mats.ground = flat(0xb2a896, 0.98);
    mats.city = flat(0xcfc4ab, 0.9); mats.terracotta = flat(0xa05f46, 0.75); mats.bronze = flat(0x63503a, 0.4, 0.9);
    mats.foliageOlive = flat(0x6e7b57, 0.95); mats.foliageCypress = flat(0x38492f, 0.95); mats.trunk = flat(0x584634, 0.95);
    mats.marbleStatue = flat(0xe9e0c8, 0.5); mats.marbleRelief = flat(0xd6c9ac, 0.85); mats.bronzePatina = flat(0x5a7869, 0.7, 0.5);
    mats.gold = flat(0xc9a04a, 0.3, 1); mats.ivory = flat(0xf0e6cf, 0.5); mats.grass = flat(0x8c8552, 0.95);
    mats.scrub = flat(0x7c7848, 0.95); mats.plaster = flat(0xe0d6c2, 0.9);
    mats.finishScene = function () {};
    return mats;
  }

  // =================================================================
  // MARBLE FAMILY: one hero field (marble/marbleWorn/marbleShadowed/marbleRelief share
  // it, only colour grading + weathering weight differ) and one finer field for statues.
  // =================================================================
  function genMarbleField(res, seed) {
    var color = new Uint8ClampedArray(res * res * 4);
    var height = new Float32Array(res * res);
    var patina = new Float32Array(res * res);
    var streak = new Float32Array(res * res);
    var vein = new Float32Array(res * res);
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x;
        var grain = warpTile(u, v, seed, 5, 5, 6, 0.5, 0.4);           // fine crystalline grain, warped, 6 octaves
        var vr = ridgeTile(u * 1.0, v * 1.0, seed + 71, 4, 4, 3);
        var vn = smooth(0.72, 0.94, vr) * 0.75;                        // thin grey veins
        var pn = smooth(0.42, 0.8, warpTile(u, v, seed + 233, 3, 3, 4, 0.5, 0.5)); // honey/iron patches, wider spread
        var sk = warpTile(u, v * 0.4, seed + 577, 6, 16, 4, 0.5, 0.55) * smooth(0.35, 0.88, warpTile(u * 2.3, v, seed + 900, 7, 5, 3, 0.5, 0.35)); // vertical streak blobs, warped to avoid a regular repeat
        // Fine stress-crack network: high-octave ridge noise, mid-scale-fbm-warped so cracks
        // meander instead of forming a rigid grid, isolated to sparse thin ridge peaks only.
        var crackWarpU = u + (fbmTile(u, v, seed + 811, 6, 6, 3, 0.5) - 0.5) * 0.18;
        var crackWarpV = v + (fbmTile(u, v, seed + 812, 6, 6, 3, 0.5) - 0.5) * 0.18;
        var crackN = ridgeTile(crackWarpU, crackWarpV, seed + 950, 27, 27, 8);
        // Per-pixel threshold jitter (art-director r2 note) so the ridge-noise crack network
        // doesn't read as a perfectly regular repeat: +-0.03 shifts the onset threshold,
        // giving ~10-20% amplitude variation across the field.
        var crackJit = (fbmTile(u, v, seed + 960, 5, 5, 3, 0.5) - 0.5) * 0.06;
        var crackAmt = smooth(0.8 + crackJit, 0.965, crackN);
        height[i] = clamp01(0.5 + (grain - 0.5) * 0.5 - vn * 0.12 - crackAmt * 0.17);
        vein[i] = vn; patina[i] = pn; streak[i] = clamp01(sk);
        var base = [233, 222, 200];        // creamy white Pentelic base (art-director spec)
        var veinCol = [196, 188, 172];
        var patinaCol = [214, 190, 150];   // soft honey/ochre wash (art-director spec)
        var c = lerpC(base, veinCol, vn * 0.35);
        c = lerpC(c, patinaCol, pn * 0.42);
        var gshade = (grain - 0.5) * 26 - crackAmt * 6;
        var di = i * 4;
        color[di] = byte(c[0] + gshade); color[di + 1] = byte(c[1] + gshade * 0.92); color[di + 2] = byte(c[2] + gshade * 0.8); color[di + 3] = 255;
      }
    }
    return { color: color, height: height, patina: patina, streak: streak, vein: vein, res: res };
  }
  function lerpC(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

  function paintMarbleVariant(field, opts) {
    var res = field.res, out = new Uint8ClampedArray(res * res * 4), rm = new Uint8ClampedArray(res * res * 4);
    var grimeCol = [86, 78, 65];
    var i, di;
    for (i = 0; i < res * res; i++) {
      di = i * 4;
      var r = field.color[di], g = field.color[di + 1], b = field.color[di + 2];
      var patina = field.patina[i] * opts.patina;
      var streak = field.streak[i] * opts.streak;
      var grime = Math.max(patina * 0.4, streak) * opts.grime;
      var c = lerpC([r, g, b], grimeCol, clamp01(grime));
      c = [c[0] * opts.darken, c[1] * opts.darken, c[2] * opts.darken];
      out[di] = byte(c[0]); out[di + 1] = byte(c[1]); out[di + 2] = byte(c[2]); out[di + 3] = 255;
      var rough = clamp01(opts.roughBase + (patina + streak) * opts.roughVar - (field.height[i] - 0.5) * 0.06);
      rm[di] = 255; rm[di + 1] = byte(rough * 255); rm[di + 2] = 0; rm[di + 3] = 255;
    }
    var smallCanvas = arrToCanvas(out, res);
    if (opts.grainAmt) addFineGrain(smallCanvas, opts.grainAmt, opts.seed || 1);
    var colorCanvas = upscale(smallCanvas, SIZE);
    // Sparkle (sparse quartz-fleck highlights) is applied at full SIZE resolution, post-
    // upscale, so those single-pixel specks stay crisp instead of being blurred away by the
    // upscale blit; it's cheap because the density is very low (few flagged pixels per tile).
    if (opts.sparkleAmt) addSparkle(colorCanvas, opts.sparkleAmt, (opts.seed || 1) + 4000);
    var m = {};
    m.map = toTexture(colorCanvas, true);
    m.roughnessMap = toTexture(upscale(arrToCanvas(rm, res), SIZE), false);
    m.normalMap = toTexture(upscale(heightToNormalCanvas(field.height, res, opts.normalStrength), SIZE), false);
    return m;
  }

  var marbleFieldA = genMarbleField(GEN, 401);
  var marbleFieldB = genMarbleField(Math.round(GEN * 0.85), 907); // statue: independent, finer-feeling field

  // normalStrength (the Sobel gradient multiplier) raised ~1.5x across the marble family so
  // crystalline grain, tool-marks and the new crack network read with real physical relief
  // instead of looking airbrushed; normalScale raised into the 1.5-2.0 range to match.
  var mA = paintMarbleVariant(marbleFieldA, { patina: 0.30, streak: 0.15, grime: 0.12, darken: 1.0, roughBase: 0.6, roughVar: 0.22, normalStrength: 2.2, grainAmt: 0.03, sparkleAmt: 0.01, seed: 11 });
  mats.marble = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: mA.map, normalMap: mA.normalMap, roughnessMap: mA.roughnessMap, normalScale: new THREE.Vector2(1.3, 1.3) });

  var mW = paintMarbleVariant(marbleFieldA, { patina: 0.45, streak: 0.35, grime: 0.28, darken: 0.92, roughBase: 0.8, roughVar: 0.18, normalStrength: 2.3, grainAmt: 0.032, sparkleAmt: 0.006, seed: 12 });
  mats.marbleWorn = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: mW.map, normalMap: mW.normalMap, roughnessMap: mW.roughnessMap, normalScale: new THREE.Vector2(1.4, 1.4) });

  var mS = paintMarbleVariant(marbleFieldA, { patina: 0.30, streak: 0.20, grime: 0.30, darken: 0.72, roughBase: 0.85, roughVar: 0.12, normalStrength: 2.2, grainAmt: 0.02, seed: 13 });
  mats.marbleShadowed = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: mS.map, normalMap: mS.normalMap, roughnessMap: mS.roughnessMap, normalScale: new THREE.Vector2(1.2, 1.2) });

  var mR = paintMarbleVariant(marbleFieldA, { patina: 0.38, streak: 0.25, grime: 0.20, darken: 0.9, roughBase: 0.76, roughVar: 0.16, normalStrength: 1.7, grainAmt: 0.026, seed: 14 });
  mats.marbleRelief = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: mR.map, normalMap: mR.normalMap, roughnessMap: mR.roughnessMap, normalScale: new THREE.Vector2(0.9, 0.9) });

  var mSt = paintMarbleVariant(marbleFieldB, { patina: 0.18, streak: 0.08, grime: 0.12, darken: 1.0, roughBase: 0.4, roughVar: 0.1, normalStrength: 1.4, grainAmt: 0.024, sparkleAmt: 0.014, seed: 15 });
  mats.marbleStatue = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: mSt.map, normalMap: mSt.normalMap, roughnessMap: mSt.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5) });

  addGroundGrime(mats.marble, true); addGroundGrime(mats.marbleWorn, true); addGroundGrime(mats.marbleShadowed, true); addGroundGrime(mats.marbleRelief, true);

  // =================================================================
  // ROCK: limestone strata + cracks + lichen. rockDark reuses the field, darker/cooler.
  // =================================================================
  function genRockField(res, seed) {
    var color = new Uint8ClampedArray(res * res * 4);
    var height = new Float32Array(res * res);
    var rough = new Float32Array(res * res);
    var x, y;
    var stone = [176, 158, 122], band = [140, 124, 94], crack = [86, 76, 62], lichen = [134, 146, 88];
    // Fixed seeded phase offsets for the multi-frequency strata sines (deterministic hash, no RNG).
    var hp1 = hashP(1, 3, seed + 11, 97, 97) * 6.28318;
    var hp2 = hashP(5, 2, seed + 12, 97, 97) * 6.28318;
    var hp3 = hashP(9, 4, seed + 13, 97, 97) * 6.28318;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x;
        // Strata: several integer-period sine waves warped by fbm so bands bend, thicken/thin
        // and can fade out — real stratified limestone, not a uniform corduroy repeat.
        var warpBig = (fbmTile(u, v, seed + 500, 3, 3, 4, 0.5) - 0.5) * 0.9;
        var warpSmall = (fbmTile(u, v, seed + 600, 11, 11, 3, 0.5) - 0.5) * 0.32;
        var thickness = lerp(0.55, 1.6, fbmTile(u, v, seed + 400, 2, 3, 3, 0.5)); // slow band-thickness variator
        var breakMask = smooth(0.3, 0.5, fbmTile(u, v, seed + 700, 4, 3, 3, 0.5)); // patches where a stratum fades/breaks
        var vp1 = v * 5 + warpBig + warpSmall;
        var vp2 = v * 9 + warpBig * 1.3 + warpSmall * 0.6;
        var vp3 = v * 17 + warpSmall * 1.4;
        var s1 = Math.sin(vp1 * Math.PI * 2 + hp1);
        var s2 = Math.sin(vp2 * Math.PI * 2 + hp2) * 0.55;
        var s3 = Math.sin(vp3 * Math.PI * 2 + hp3) * 0.3;
        var stripeSum = clamp01((s1 + s2 + s3) / 1.85 * 0.5 + 0.5);
        var lo = 0.5 - 0.2 * thickness, hi = 0.5 + 0.2 * thickness;
        var bandMask = smooth(lo, hi, stripeSum) * breakMask;
        var crackN = ridgeTile(u, v, seed + 300, 6, 11, 4);
        var crackN2 = ridgeTile(u, v, seed + 330, 15, 21, 3); // finer secondary crack layer
        var crackMask = clamp01(smooth(0.87, 0.96, crackN) + smooth(0.9, 0.98, crackN2) * 0.6);
        // Sharp fracture/joint planes: a broad low-frequency near-horizontal layer plus a
        // diagonal (45deg-ish) layer on a rotated combined coordinate, both thresholded to
        // sparse hard ridge lines rather than a soft field -- reads as real bedding-joint
        // fractures cutting across the strata, not just fine surface noise.
        var jointH = ridgeTile(u, v, seed + 1300, 2, 6, 3);
        var jointD = ridgeTile(u + v, v - u, seed + 1350, 5, 5, 3);
        var jointMask = clamp01(smooth(0.86, 0.97, jointH) + smooth(0.88, 0.97, jointD) * 0.85);
        // Thin crevice shadow right at each strata band boundary (where bandMask crosses its
        // midpoint), so layer transitions read as weathered joints rather than flat colour bands.
        var bandEdge = Math.pow(clamp01(1 - Math.abs(bandMask * 2 - 1)), 5) * breakMask;
        var lichenN = warpTile(u, v, seed + 620, 8, 8, 3, 0.5, 0.3);
        var lichenMask = smooth(0.7, 0.85, lichenN) * 0.55;
        var grain = fbmTile(u, v, seed + 55, 16, 16, 3, 0.5);
        height[i] = clamp01(0.5 + (bandMask - 0.5) * 0.45 + (grain - 0.5) * 0.4 - crackMask * 0.5 - jointMask * 0.5 - bandEdge * 0.4);
        rough[i] = clamp01(0.85 + crackMask * 0.1 + jointMask * 0.06 - lichenMask * 0.06 + (grain - 0.5) * 0.06);
        var c = lerpC(stone, band, bandMask * 0.65);
        c = lerpC(c, crack, crackMask * 0.55);
        c = lerpC(c, crack, jointMask * 0.35);
        c = lerpC(c, lichen, lichenMask);
        var gshade = (grain - 0.5) * 26 - jointMask * 8 - bandEdge * 9;
        var di = i * 4;
        color[di] = byte(c[0] + gshade); color[di + 1] = byte(c[1] + gshade * 0.92); color[di + 2] = byte(c[2] + gshade * 0.8); color[di + 3] = 255;
      }
    }
    return { color: color, height: height, rough: rough, res: res };
  }
  var rockField = genRockField(GEN, 2201);
  function paintRockVariant(field, tint, roughBias, seed) {
    var res = field.res, out = new Uint8ClampedArray(res * res * 4), rm = new Uint8ClampedArray(res * res * 4), i, di;
    for (i = 0; i < res * res; i++) {
      di = i * 4;
      out[di] = byte(field.color[di] * tint); out[di + 1] = byte(field.color[di + 1] * tint); out[di + 2] = byte(field.color[di + 2] * tint); out[di + 3] = 255;
      rm[di] = 255; rm[di + 1] = byte(clamp01(field.rough[i] + roughBias) * 255); rm[di + 2] = 0; rm[di + 3] = 255;
    }
    var colorCanvas = arrToCanvas(out, res);
    addFineGrain(colorCanvas, 0.035, seed);
    return {
      map: toTexture(upscale(colorCanvas, SIZE), true),
      roughnessMap: toTexture(upscale(arrToCanvas(rm, res), SIZE), false),
      normalMap: toTexture(upscale(heightToNormalCanvas(field.height, res, 2.6), SIZE), false)
    };
  }
  var rk = paintRockVariant(rockField, 1.0, 0, 21);
  mats.rock = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: rk.map, normalMap: rk.normalMap, roughnessMap: rk.roughnessMap, normalScale: new THREE.Vector2(1.1, 1.1) });
  var rkd = paintRockVariant(rockField, 0.66, 0.04, 22);
  mats.rockDark = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: rkd.map, normalMap: rkd.normalMap, roughnessMap: rkd.roughnessMap, normalScale: new THREE.Vector2(1.1, 1.1) });
  addGroundGrime(mats.rock); addGroundGrime(mats.rockDark);

  // =================================================================
  // GROUND: dry Attic soil, pebbles, sparse dry grass flecks.
  // =================================================================
  (function () {
    var res = GEN, color = new Uint8ClampedArray(res * res * 4), height = new Float32Array(res * res), rough = new Uint8ClampedArray(res * res * 4);
    // r2: art director still reads the plateau as warm cream-yellow even after the r1 cooling
    // pass, because the scene's key light (0xffbb66 at intensity 5.0 in 10-env.js, an env-owned
    // file) dominates the lit faces and re-warms whatever base tone the texture has. Since we
    // can't touch the light from here, push the base palette further: nearly neutral R~=G~=B
    // (killing almost all of the remaining warm R-B bias) plus a small G/B lift so the residual
    // cast trends grey-blue rather than grey-beige-warm once the key light multiplies it.
    var soil = [151, 153, 150], soilDark = [124, 127, 123], pebbleLt = [171, 173, 168], pebbleDk = [101, 103, 100], fleck = [144, 146, 141];
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x;
        // Two independently-oriented, higher-frequency warped fields multiplied together
        // break up any single-frequency repeat (avoids a "wavy fingerprint" look tiled).
        var soilA = warpTile(u, v, 3301, 24, 27, 4, 0.55, 0.3);
        var soilB = warpTile(u, v, 3355, 29, 21, 3, 0.5, 0.3);
        var soilN = clamp01(soilA * 0.55 + soilB * 0.45);
        var pebN = ridgeTile(u, v, 3402, 23, 29, 2) * ridgeTile(u, v, 3450, 31, 19, 2);
        var pebMask = smooth(0.65, 0.92, pebN);
        var pebDark = fastHash((x / 3) | 0, (y / 3) | 0, 3500) > 0.5;
        var fleckMask = smooth(0.9, 0.98, fbmTile(u, v, 3600, 40, 40, 2, 0.5)) * 0.25;
        height[i] = clamp01(0.5 + (soilN - 0.5) * 0.18 + pebMask * 0.25);
        var c = lerpC(soil, soilDark, soilN);
        c = lerpC(c, pebDark ? pebbleDk : pebbleLt, pebMask);
        c = lerpC(c, fleck, fleckMask);
        var di = i * 4;
        color[di] = byte(c[0]); color[di + 1] = byte(c[1]); color[di + 2] = byte(c[2]); color[di + 3] = 255;
        var rgh = clamp01(0.92 + pebMask * 0.06);
        rough[di] = 255; rough[di + 1] = byte(rgh * 255); rough[di + 2] = 0; rough[di + 3] = 255;
      }
    }
    var colorCanvas = arrToCanvas(color, res);
    addFineGrain(colorCanvas, 0.05, 31);
    mats.ground = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0,
      map: toTexture(upscale(colorCanvas, SIZE), true),
      roughnessMap: toTexture(upscale(arrToCanvas(rough, res), SIZE), false),
      normalMap: toTexture(upscale(heightToNormalCanvas(height, res, 0.9), SIZE), false),
      normalScale: new THREE.Vector2(0.22, 0.22)
    });
  })();

  // =================================================================
  // Generic lightweight field painter for the secondary materials (colour + roughness,
  // no normal map) — kept cheap since these read mostly at a distance.
  // =================================================================
  function paintSimple(res, seed, colorFn, roughFn) {
    var color = new Uint8ClampedArray(res * res * 4), rough = new Uint8ClampedArray(res * res * 4);
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x, di = i * 4;
        var c = colorFn(u, v);
        color[di] = byte(c[0]); color[di + 1] = byte(c[1]); color[di + 2] = byte(c[2]); color[di + 3] = 255;
        var rg = roughFn ? roughFn(u, v) : 0.8;
        rough[di] = 255; rough[di + 1] = byte(clamp01(rg[0]) * 255); rough[di + 2] = byte(clamp01(rg[1] || 0) * 255); rough[di + 3] = 255;
      }
    }
    var cc = arrToCanvas(color, res);
    addFineGrain(cc, 0.02, seed);
    return { map: toTexture(upscale(cc, SIZE), true), rm: toTexture(upscale(arrToCanvas(rough, res), SIZE), false) };
  }

  // Terracotta: fired clay with irregular per-tile colour patches (kiln inconsistency,
  // surface wear) rather than a single-axis warped stripe.
  (function () {
    var t = paintSimple(GEN_S, 4401, function (u, v) {
      var warp1 = warpTile(u, v, 4401, 9, 9, 5, 0.5, 0.55);              // primary domain, higher octaves
      var warp2 = warpTile(u * 1.6, v * 1.6, 4451, 13, 11, 4, 0.5, 0.6); // secondary high-freq domain, different scale/orientation
      var n = clamp01(warp1 * 0.6 + warp2 * 0.4);
      var fire = fbmTile(u, v, 4501, 4, 5, 4, 0.5);                      // asymmetric freq avoids single-axis bias
      var patchN = smooth(0.35, 0.75, warpTile(u, v, 4551, 6, 7, 4, 0.5, 0.5)); // firing/weathering patches
      // r2: mute further toward weathered brown-red -- lower the hot extreme's saturation and
      // weight the cool/muted end more heavily in the fire blend.
      var base = [160, 95, 70], hot = [163, 105, 80], cool = [132, 80, 62], patchCol = [150, 96, 74];
      var c = lerpC(cool, hot, fire * 0.6);
      c = lerpC(c, base, 0.35);
      c = lerpC(c, patchCol, patchN * 0.4);
      var g = (n - 0.5) * 28;
      return [c[0] + g, c[1] + g * 0.8, c[2] + g * 0.6];
    }, function (u, v) { return [0.58 + fbmTile(u, v, 4601, 7, 5, 3, 0.5) * 0.24, 0]; });
    mats.terracotta = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: t.map, roughnessMap: t.rm });
    addGroundGrime(mats.terracotta);
  })();

  // Bronze family: dark warm metal with streaks; bronzePatina overlays verdigris crust
  // (crust patches are matte/non-metal, clean bronze stays reflective).
  (function () {
    var res = GEN_S;
    var color = new Uint8ClampedArray(res * res * 4), rm = new Uint8ClampedArray(res * res * 4);
    var patinaC = new Uint8ClampedArray(res * res * 4), patinaRM = new Uint8ClampedArray(res * res * 4);
    var flakeHeight = new Float32Array(res * res); // dedicated crackle/flake field for bronzePatina's normal map
    // r2 art-director pass: statue still read near-black with invisible verdigris. Brighten the
    // dark/warm bronze base further and pull the verdigris hue apart from the bronze base (a bit
    // more saturated + cooler dark variant) so crust patches read as distinct blue-green streaks
    // rather than merging into shadow -- but kept short of the director's most saturated ask,
    // since a first pass at that value plus the metallic crackle normal produced a neon/glowing
    // highlight under the strong direct light; this is a middle point that stays legible without
    // glowing (see normalScale/metalness note below for the other half of that fix).
    var dark = [78, 65, 50], warm = [130, 110, 80], verdigris = [78, 148, 112], verdigrisDk = [54, 92, 82];
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x, di = i * 4;
        var streak = warpTile(u, v * 0.3, 5501, 2, 8, 4, 0.5, 0.3);
        var fleck = fbmTile(u, v, 5601, 20, 20, 3, 0.5);
        var c = lerpC(dark, warm, streak);
        var g = (fleck - 0.5) * 18;
        color[di] = byte(c[0] + g); color[di + 1] = byte(c[1] + g * 0.9); color[di + 2] = byte(c[2] + g * 0.8); color[di + 3] = 255;
        var rough = clamp01(0.32 + (1 - streak) * 0.2 + (fleck - 0.5) * 0.1);
        rm[di] = 255; rm[di + 1] = byte(rough * 255); rm[di + 2] = byte(0.92 * 255); rm[di + 3] = 255;

        // Lowered threshold a bit (was 0.62-0.9 in r1) so more of the field crosses into visible
        // verdigris crust -- r1 coverage read as near-invisible -- but not as low as a first r2
        // attempt (0.45-0.75), which covered so much area that, combined with the metallic sheen
        // still left on the crust, it read as a solid neon-green wash instead of streaks/patches.
        var patch = smooth(0.55, 0.85, warpTile(u, v, 5701, 3, 3, 4, 0.5, 0.5));
        var patchDetail = fbmTile(u, v, 5801, 12, 12, 3, 0.5);
        var pc = lerpC(c, patch > 0.5 ? verdigris : verdigrisDk, patch * 0.8);
        var pg = (patchDetail - 0.5) * 14;
        patinaC[di] = byte(pc[0] + pg); patinaC[di + 1] = byte(pc[1] + pg); patinaC[di + 2] = byte(pc[2] + pg * 0.8); patinaC[di + 3] = 255;
        // Crust is pushed further toward matte/non-metal (was -0.4, now -0.6) so it stops
        // throwing a bright specular highlight in the crust color under the strong direct sun --
        // that specular bounce, not just the albedo, was the main source of the neon look.
        var prough = clamp01(rough + patch * 0.5);
        var pmetal = clamp01(0.85 - patch * 0.6);
        patinaRM[di] = 255; patinaRM[di + 1] = byte(prough * 255); patinaRM[di + 2] = byte(pmetal * 255); patinaRM[di + 3] = 255;

        // Fine crystalline crackle/flake detail (fbm of ridges), independent of roughness,
        // heavier where the verdigris crust patch sits. Amplitude raised modestly vs. r1 (was
        // 1.2/0.8) so the crust reads as physically flaking, but pulled back from a first r2
        // attempt (1.5/1.0) that over-sharpened the normal map into glinting specular noise.
        var crackle = ridgeTile(u, v, 5901, 18, 18, 4);
        var crackle2 = ridgeTile(u, v, 5950, 9, 9, 3);
        flakeHeight[i] = clamp01(0.5 + (crackle - 0.5) * 1.3 + (crackle2 - 0.5) * 0.9 * (0.4 + patch * 0.6));
      }
    }
    var bronzeCanvas = arrToCanvas(color, res);
    var patinaCanvas = arrToCanvas(patinaC, res);
    mats.bronze = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1,
      map: toTexture(upscale(bronzeCanvas, SIZE), true),
      roughnessMap: toTexture(upscale(arrToCanvas(rm, res), SIZE), false),
    });
    mats.bronze.metalnessMap = mats.bronze.roughnessMap;
    var patinaRMTex = toTexture(upscale(arrToCanvas(patinaRM, res), SIZE), false);
    mats.bronzePatina = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 1,
      map: toTexture(upscale(patinaCanvas, SIZE), true),
      roughnessMap: patinaRMTex, metalnessMap: patinaRMTex,
      // normalScale eased back from 0.95 (r1) -- at full strength the sharpened r2 crackle
      // field threw hard glinting specular noise across the crust under the strong direct sun.
      normalMap: toTexture(upscale(heightToNormalCanvas(flakeHeight, res, 2.4), SIZE), false),
      normalScale: new THREE.Vector2(0.7, 0.7)
    });
  })();

  // Gold gilding: bright, mostly-clean metal with faint tooling streaks.
  (function () {
    var t = paintSimple(GEN_S, 6601, function (u, v) {
      var n = warpTile(u, v, 6601, 6, 6, 3, 0.5, 0.3);
      var base = [201, 163, 78], hi = [230, 202, 130];
      var c = lerpC(base, hi, n);
      return c;
    }, function (u, v) { return [0.22 + fbmTile(u, v, 6701, 8, 8, 2, 0.5) * 0.16, 0.97]; });
    mats.gold = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 1, map: t.map, roughnessMap: t.rm, metalnessMap: t.rm });
  })();

  // Ivory: smooth, minimal grain.
  (function () {
    var t = paintSimple(GEN_S, 7701, function (u, v) {
      var n = fbmTile(u, v, 7701, 5, 5, 3, 0.5);
      var base = [236, 227, 204], warm = [222, 208, 178];
      return lerpC(base, warm, n * 0.4);
    }, function (u, v) { return [0.42 + fbmTile(u, v, 7801, 6, 6, 2, 0.5) * 0.14, 0]; });
    mats.ivory = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: t.map, roughnessMap: t.rm });
  })();

  // Plaster + city share a whitewash field; city adds dirt streaks + window-shadow flecks.
  (function () {
    var res = GEN_S, plasterC = new Uint8ClampedArray(res * res * 4), cityC = new Uint8ClampedArray(res * res * 4);
    var plasterRM = new Uint8ClampedArray(res * res * 4), cityRM = new Uint8ClampedArray(res * res * 4);
    var base = [231, 222, 201], patch = [214, 204, 180], dirt = [156, 147, 124], blotchCol = [202, 191, 165];
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x, di = i * 4;
        var n = warpTile(u, v, 8801, 7, 7, 7, 0.5, 0.4);              // grain octaves 4 -> 7
        // Coarse aging blotches: a large, low-octave fbm field so weathering reads as big
        // uneven patches of the wall, not a uniform speckle.
        var blotchN = fbmTile(u, v, 8850, 3, 3, 3, 0.5);
        // r2: raise the threshold (was 0.42-0.78) to shrink blotch coverage, and fragment the
        // remaining patches with a higher-frequency secondary field so aging reads as varied
        // small weathering rather than a few monolithic stains.
        var blotchDetail = fbmTile(u, v, 8870, 6, 6, 3, 0.5);
        var blotchMask = smooth(0.5, 0.75, blotchN) * (0.7 + 0.3 * blotchDetail);
        var c = lerpC(base, patch, n * 0.4);
        c = lerpC(c, blotchCol, blotchMask * 0.28);
        plasterC[di] = byte(c[0]); plasterC[di + 1] = byte(c[1]); plasterC[di + 2] = byte(c[2]); plasterC[di + 3] = 255;
        plasterRM[di] = 255; plasterRM[di + 1] = byte(clamp01(0.82 + (n - 0.5) * 0.14 + blotchMask * 0.12) * 255); plasterRM[di + 2] = 0; plasterRM[di + 3] = 255;

        var streak = warpTile(u, v * 0.4, 8901, 3, 9, 4, 0.5, 0.25);
        var grime = smooth(0.5, 0.85, streak) * 0.35;
        var cc = lerpC(c, dirt, grime);
        cityC[di] = byte(cc[0]); cityC[di + 1] = byte(cc[1]); cityC[di + 2] = byte(cc[2]); cityC[di + 3] = 255;
        cityRM[di] = 255; cityRM[di + 1] = byte(clamp01(0.85 + grime * 0.1 + blotchMask * 0.1) * 255); cityRM[di + 2] = 0; cityRM[di + 3] = 255;
      }
    }
    var plasterCanvas = arrToCanvas(plasterC, res), cityCanvas = arrToCanvas(cityC, res);
    addFineGrain(plasterCanvas, 0.028, 8802);
    addFineGrain(cityCanvas, 0.032, 8902);
    mats.plaster = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: toTexture(upscale(plasterCanvas, SIZE), true), roughnessMap: toTexture(upscale(arrToCanvas(plasterRM, res), SIZE), false) });
    mats.city = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: toTexture(upscale(cityCanvas, SIZE), true), roughnessMap: toTexture(upscale(arrToCanvas(cityRM, res), SIZE), false) });
    addGroundGrime(mats.plaster); addGroundGrime(mats.city);
  })();

  // Dry vegetation: grass (ground cover) and scrub (foliage-adjacent, drier/greyer) share a field.
  (function () {
    var res = GEN_S, grassC = new Uint8ClampedArray(res * res * 4), scrubC = new Uint8ClampedArray(res * res * 4);
    var gr = new Uint8ClampedArray(res * res * 4), sr = new Uint8ClampedArray(res * res * 4);
    var gBase = [151, 141, 76], gBlade = [120, 112, 56], sBase = [128, 122, 76], sBlade = [104, 100, 62];
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x, di = i * 4;
        var n = warpTile(u, v, 9901, 12, 12, 4, 0.55, 0.35);
        var gc = lerpC(gBase, gBlade, n);
        var sc = lerpC(sBase, sBlade, n);
        grassC[di] = byte(gc[0]); grassC[di + 1] = byte(gc[1]); grassC[di + 2] = byte(gc[2]); grassC[di + 3] = 255;
        scrubC[di] = byte(sc[0]); scrubC[di + 1] = byte(sc[1]); scrubC[di + 2] = byte(sc[2]); scrubC[di + 3] = 255;
        gr[di] = 255; gr[di + 1] = byte(0.9 * 255); gr[di + 2] = 0; gr[di + 3] = 255;
        sr[di] = 255; sr[di + 1] = byte(0.92 * 255); sr[di + 2] = 0; sr[di + 3] = 255;
      }
    }
    mats.grass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: toTexture(upscale(arrToCanvas(grassC, res), SIZE), true), roughnessMap: toTexture(upscale(arrToCanvas(gr, res), SIZE), false) });
    mats.scrub = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: toTexture(upscale(arrToCanvas(scrubC, res), SIZE), true), roughnessMap: toTexture(upscale(arrToCanvas(sr, res), SIZE), false) });
  })();

  // Foliage (olive canopy / cypress canopy) + trunk bark.
  (function () {
    var res = GEN_S, olive = new Uint8ClampedArray(res * res * 4), cypress = new Uint8ClampedArray(res * res * 4), bark = new Uint8ClampedArray(res * res * 4);
    var oB = [104, 116, 80], oL = [128, 138, 100], cB = [42, 56, 36], cL = [64, 80, 52], bB = [86, 68, 50], bD = [58, 46, 34], bL = [112, 92, 66];
    var x, y;
    for (y = 0; y < res; y++) {
      var v = (y + 0.5) / res;
      for (x = 0; x < res; x++) {
        var u = (x + 0.5) / res, i = y * res + x, di = i * 4;
        var n = fbmTile(u, v, 1101, 10, 10, 3, 0.5);
        var oc = lerpC(oB, oL, n); var cc = lerpC(cB, cL, n);
        olive[di] = byte(oc[0]); olive[di + 1] = byte(oc[1]); olive[di + 2] = byte(oc[2]); olive[di + 3] = 255;
        cypress[di] = byte(cc[0]); cypress[di + 1] = byte(cc[1]); cypress[di + 2] = byte(cc[2]); cypress[di + 3] = 255;
        var strand = warpTile(u, v * 0.25, 1201, 8, 2, 4, 0.5, 0.2);
        var bc = lerpC(bB, strand > 0.55 ? bL : bD, Math.abs(strand - 0.5) * 2);
        bark[di] = byte(bc[0]); bark[di + 1] = byte(bc[1]); bark[di + 2] = byte(bc[2]); bark[di + 3] = 255;
      }
    }
    mats.foliageOlive = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, map: toTexture(upscale(arrToCanvas(olive, res), SIZE), true) });
    mats.foliageCypress = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, map: toTexture(upscale(arrToCanvas(cypress, res), SIZE), true) });
    mats.trunk = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, map: toTexture(upscale(arrToCanvas(bark, res), SIZE), true) });
  })();

  // ---------------------------------------------------------------
  // Real-world-scale tile sizes (metres per texture repeat), read by finishScene.
  // ---------------------------------------------------------------
  var UV_SCALE = {
    marble: 1.3, marbleWorn: 1.3, marbleShadowed: 1.4, marbleStatue: 0.9, marbleRelief: 1.3,
    rock: 10, rockDark: 8, ground: 4, city: 4, terracotta: 1.4,
    bronze: 2, bronzePatina: 2, foliageOlive: 3, foliageCypress: 3, trunk: 1.1,
    gold: 1, ivory: 1.4, grass: 6, scrub: 4, plaster: 3,
  };
  for (var key in UV_SCALE) { if (mats[key]) mats[key].userData.uvScale = UV_SCALE[key]; }

  // Materials with no gravity-aligned detail (marble's vertical rain-streaks/grime need to
  // stay vertical, so it's excluded) get a small random per-mesh UV-axis rotation in
  // finishScene, so a repeated ground/rock/masonry tile doesn't line up with the world/view
  // axes and read as an obvious grid.
  var UV_ROTATE = { rock: 1, rockDark: 1, ground: 1, city: 1, terracotta: 1, plaster: 1, grass: 1, scrub: 1 };
  for (var rkey in UV_ROTATE) { if (mats[rkey]) mats[rkey].userData.uvRotate = true; }

  // ---------------------------------------------------------------
  // finishScene(scene, renderer): anisotropy + world-scale box-projected UVs.
  // ---------------------------------------------------------------
  function boxProjectUV(geo, sx, sy, sz, uvScale, rotAngle) {
    var pos = geo.attributes.position;
    if (!pos) return;
    var norm = geo.attributes.normal;
    if (!norm) { geo.computeVertexNormals(); norm = geo.attributes.normal; }
    var count = pos.count;
    var uv = new Float32Array(count * 2);
    var ca = rotAngle ? Math.cos(rotAngle) : 1, sa = rotAngle ? Math.sin(rotAngle) : 0;
    var i, px, py, pz, nx, ny, nz, u, v, ur, vr;
    for (i = 0; i < count; i++) {
      px = pos.getX(i) * sx; py = pos.getY(i) * sy; pz = pos.getZ(i) * sz;
      nx = Math.abs(norm.getX(i)); ny = Math.abs(norm.getY(i)); nz = Math.abs(norm.getZ(i));
      if (nx >= ny && nx >= nz) { u = pz; v = py; }
      else if (ny >= nx && ny >= nz) { u = px; v = pz; }
      else { u = px; v = py; }
      if (rotAngle) { ur = u * ca - v * sa; vr = u * sa + v * ca; u = ur; v = vr; }
      uv[i * 2] = u / uvScale; uv[i * 2 + 1] = v / uvScale;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  mats.finishScene = function (scene, renderer) {
    var maxAniso = 1;
    try { if (renderer && renderer.capabilities) maxAniso = renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
    var i;
    for (i = 0; i < ALL_TEX.length; i++) ALL_TEX[i].anisotropy = maxAniso;
    if (!scene || typeof scene.traverse !== 'function') return;

    var geoState = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
    var fallbackState = [];
    function getState(geo) {
      if (geoState) return geoState.get(geo);
      for (var k = 0; k < fallbackState.length; k++) if (fallbackState[k].geo === geo) return fallbackState[k].state;
      return undefined;
    }
    function setState(geo, state) {
      if (geoState) { geoState.set(geo, state); return; }
      fallbackState.push({ geo: geo, state: state });
    }

    var wv = new THREE.Vector3();
    scene.traverse(function (obj) {
      if (!obj || !obj.isMesh) return;
      if (obj.userData && obj.userData.keepUV) return;
      var mat = obj.material;
      if (!mat || Array.isArray(mat)) return;
      if (mat.isShaderMaterial || mat.side === THREE.BackSide) return;
      var uvScale = mat.userData && mat.userData.uvScale;
      if (!uvScale) return;
      var rotAngle = 0;
      if (mat.userData.uvRotate) {
        // Deterministic per-object hash (seeded, not RNG-based) -> a fixed +/-30 degree
        // UV-axis rotation so this object's tiling doesn't line up with the next one's.
        rotAngle = (fastHash(obj.id, 7, 9001) - 0.5) * (Math.PI / 3);
      }
      var geo = obj.geometry;
      if (!geo || !geo.attributes || !geo.attributes.position) return;
      obj.getWorldScale(wv);
      var sx = wv.x || 1, sy = wv.y || 1, sz = wv.z || 1;
      var key = uvScale.toFixed(3) + '|' + rotAngle.toFixed(4) + '|' + sx.toFixed(4) + ',' + sy.toFixed(4) + ',' + sz.toFixed(4);
      var state = getState(geo);
      if (state && state.key === key) return;
      var targetGeo = geo;
      if (state) { targetGeo = geo.clone(); obj.geometry = targetGeo; }
      boxProjectUV(targetGeo, sx, sy, sz, uvScale, rotAngle);
      setState(targetGeo, { key: key });
    });
  };

  return mats;
};
