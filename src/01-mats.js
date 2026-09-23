// Module 01: materials with canvas textures
window.buildMats = function (THREE) {
  function noiseTex(size, amp, tint) {
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    var seed = 12345;
    function lcg() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }
    for (var y = 0; y < size; y += 2) {
      for (var x = 0; x < size; x += 2) {
        var n = lcg();
        ctx.fillStyle = 'rgba(0,0,0,' + (amp * n) + ')';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    for (var i = 0; i < 60; i++) {
      var ly = lcg() * size;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(size, ly);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  var mats = {};
  if (typeof document === 'undefined') {
    mats.marble = new THREE.MeshStandardMaterial({color: 0xe8e0cf, roughness: 0.75, metalness: 0});
    mats.marbleWorn = new THREE.MeshStandardMaterial({color: 0xd8cdb6, roughness: 0.9, metalness: 0});
    mats.marbleShadowed = new THREE.MeshStandardMaterial({color: 0xcfc4ad, roughness: 0.92, metalness: 0});
    mats.rock = new THREE.MeshStandardMaterial({color: 0x9a8f7a, roughness: 1.0, metalness: 0});
    mats.rockDark = new THREE.MeshStandardMaterial({color: 0x7d735f, roughness: 1.0, metalness: 0});
    mats.ground = new THREE.MeshStandardMaterial({color: 0xa9a08a, roughness: 1.0, metalness: 0});
    mats.city = new THREE.MeshStandardMaterial({color: 0xbfb6a4, roughness: 0.95, metalness: 0, flatShading: true});
    mats.terracotta = new THREE.MeshStandardMaterial({color: 0xb5643c, roughness: 0.85, metalness: 0});
    mats.bronze = new THREE.MeshStandardMaterial({color: 0x6f5b3e, roughness: 0.45, metalness: 0.85});
    mats.foliageOlive = new THREE.MeshStandardMaterial({color: 0x6e7b57, roughness: 1.0, metalness: 0, flatShading: true});
    mats.foliageCypress = new THREE.MeshStandardMaterial({color: 0x38492f, roughness: 1.0, metalness: 0, flatShading: true});
    mats.trunk = new THREE.MeshStandardMaterial({color: 0x584634, roughness: 1.0, metalness: 0});
    return mats;
  }
  var marbleTex = noiseTex(256, 0.08, '#e8e0cf');
  marbleTex.repeat.set(4, 4);
  var marbleWornTex = marbleTex.clone();
  marbleWornTex.needsUpdate = true;
  marbleWornTex.repeat.set(2, 6);
  var rockTex = noiseTex(256, 0.35, '#9a8f7a');
  rockTex.repeat.set(8, 8);
  var rockDarkTex = rockTex.clone();
  rockDarkTex.needsUpdate = true;
  rockDarkTex.repeat.set(6, 3);
  var groundTex = noiseTex(256, 0.2, '#a9a08a');
  groundTex.repeat.set(60, 60);
  mats.marble = new THREE.MeshStandardMaterial({color: 0xe8e0cf, roughness: 0.75, metalness: 0, map: marbleTex});
  mats.marbleWorn = new THREE.MeshStandardMaterial({color: 0xd8cdb6, roughness: 0.9, metalness: 0, map: marbleWornTex});
  mats.marbleShadowed = new THREE.MeshStandardMaterial({color: 0xcfc4ad, roughness: 0.92, metalness: 0});
  mats.rock = new THREE.MeshStandardMaterial({color: 0x9a8f7a, roughness: 1.0, metalness: 0, map: rockTex});
  mats.rockDark = new THREE.MeshStandardMaterial({color: 0x7d735f, roughness: 1.0, metalness: 0, map: rockDarkTex});
  mats.ground = new THREE.MeshStandardMaterial({color: 0xa9a08a, roughness: 1.0, metalness: 0, map: groundTex});
  mats.city = new THREE.MeshStandardMaterial({color: 0xbfb6a4, roughness: 0.95, metalness: 0, flatShading: true});
  mats.terracotta = new THREE.MeshStandardMaterial({color: 0xb5643c, roughness: 0.85, metalness: 0});
  mats.bronze = new THREE.MeshStandardMaterial({color: 0x6f5b3e, roughness: 0.45, metalness: 0.85});
  mats.foliageOlive = new THREE.MeshStandardMaterial({color: 0x6e7b57, roughness: 1.0, metalness: 0, flatShading: true});
  mats.foliageCypress = new THREE.MeshStandardMaterial({color: 0x38492f, roughness: 1.0, metalness: 0, flatShading: true});
  mats.trunk = new THREE.MeshStandardMaterial({color: 0x584634, roughness: 1.0, metalness: 0});
  return mats;
};
