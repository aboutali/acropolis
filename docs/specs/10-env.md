# Module 10 — src/10-env.js
Signature: `window.buildEnv = function (THREE, scene, renderer) { ...; return { sun: sun, update: function (dt) {} }; };`
Exceptions: this module MAY call `scene.add`, set `scene.fog`, configure `renderer`, construct its sky ShaderMaterial and lights, and read `window.CFG.MOBILE` (default false if CFG missing). It must NOT touch document.

- Sky: `new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color(0x2d5f9e) }, horizon: { value: new THREE.Color(0x87b6de) }, band: { value: new THREE.Color(0xf0dcc0) } }, vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 band; varying vec3 vW; void main(){ float h = normalize(vW).y; vec3 c = mix(horizon, top, clamp(pow(max(h,0.0),0.55),0.0,1.0)); c = mix(band, c, clamp(abs(h-0.02)*14.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }' }))`; `sky.frustumCulled = false; scene.add(sky);`
- `scene.add(new THREE.HemisphereLight(0x9fc4e8, 0x8a7f66, 0.55));`
- Sun: `var sun = new THREE.DirectionalLight(0xfff2d8, 2.1); sun.position.set(160, 190, -120); sun.castShadow = true;` S = MOBILE ? 1024 : 2048; `sun.shadow.mapSize.set(S, S); sun.shadow.camera.left = -180; right = 180; top = 180; bottom = -180; near = 50; far = 600; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.4; sun.target.position.set(-40, 0, 0); scene.add(sun); scene.add(sun.target);`
- `scene.add(new THREE.AmbientLight(0xfff4e0, 0.18));`
- `scene.fog = new THREE.FogExp2(0xa8c4dd, 0.00055);`
- Renderer: `renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;`
- Return `{ sun: sun, update: function (dt) {} }`. ~50 lines.
