// Concatenates src/NN-*.js (in order) into a single self-contained index.html.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src');
const files = fs.readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
// Official r128 example add-ons (post-processing and glTF loading), same version as the core build
const ADDON_BASE = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
const ADDONS = ['shaders/CopyShader.js', 'shaders/SSAOShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/GammaCorrectionShader.js',
  'shaders/FXAAShader.js', 'math/SimplexNoise.js', 'postprocessing/EffectComposer.js', 'postprocessing/MaskPass.js',
  'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/SSAOPass.js', 'postprocessing/UnrealBloomPass.js',
  'loaders/GLTFLoader.js'];

const scripts = files.map(f => {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script data-module="${f}">\n${code}\n</script>`;
}).join('\n');

const html = `<title>Acropolis of Athens</title>
<meta name="description" content="Interactive 3D reconstruction of the Acropolis of Athens, rendered procedurally with three.js.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&display=swap">
<style>
  :root { --ink: #f2ece0; --panel: rgba(20, 24, 30, .62); --accent: #e3c78a; }
  html, body { height: 100%; }
  body { margin: 0; overflow: hidden; background: #87b6de; color: var(--ink); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  #app { position: fixed; inset: 0; z-index: 0; }
  #legend, #hint, #autorot, #debug { z-index: 5; }
  #app canvas { display: block; width: 100% !important; height: 100% !important; touch-action: none; }
  #legend { position: fixed; left: 12px; bottom: 12px; max-width: min(300px, 46vw); padding: 10px 12px; border-radius: 10px;
    background: var(--panel); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); font-size: 12px; line-height: 1.5; }
  #legend h1 { margin: 0 0 4px; font: 600 14px/1.3 Cinzel, "Trajan Pro", Georgia, serif; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
  #legend ul { margin: 0; padding: 0; list-style: none; }
  #legend li::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 7px; background: var(--dot, #e8e0cf); vertical-align: middle; }
  #hint { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: var(--panel);
    backdrop-filter: blur(6px); font-size: 12px; white-space: nowrap; transition: opacity 1.2s ease; pointer-events: none; }
  #autorot { position: fixed; right: 12px; bottom: 12px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--panel);
    color: var(--ink); font-size: 20px; cursor: pointer; backdrop-filter: blur(6px); }
  #autorot.off { opacity: .5; }
  #debug { position: fixed; top: 12px; right: 12px; padding: 4px 8px; border-radius: 6px; background: var(--panel); font: 12px ui-monospace, Menlo, Consolas, monospace; }
  #legend li { display: flex; align-items: baseline; }
  #legend li::before { flex: none; }
  #legend button { all: unset; cursor: pointer; border-radius: 4px; }
  #legend button:hover { color: var(--accent); }
  #legend button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @media (max-width: 640px) { #legend { font-size: 11px; padding: 8px 10px; } #legend h1 { font-size: 13px; } }
</style>
<div id="app"></div>
<div id="legend">
  <h1>Acropolis of Athens</h1>
  <ul>
    <li style="--dot:#e8e0cf"><button data-view="parthenon">Parthenon, 447–432 BC</button></li>
    <li style="--dot:#d8cdb6"><button data-view="erechtheion">Erechtheion &amp; Caryatids</button></li>
    <li style="--dot:#cfc4ad"><button data-view="propylaea">Propylaea &amp; Temple of Athena Nike</button></li>
    <li style="--dot:#6f5b3e"><button data-view="promachos">Athena Promachos</button></li>
    <li style="--dot:#9a8f7a"><button data-view="southslope">Theatre of Dionysus &amp; Odeon</button></li>
    <li style="--dot:transparent"><button data-view="overview">Whole hill</button></li>
  </ul>
  </ul>
</div>
<div id="hint">drag to orbit · pinch to zoom · tap a name to fly</div>
<button id="autorot" aria-pressed="true" title="Toggle auto-rotate">⟳</button>
<div id="debug" hidden></div>
<script src="${THREE_URL}"></script>
${ADDONS.map(a => `<script src="${ADDON_BASE}${a}"></script>`).join('\n')}
${scripts}
<script>
  (function () {
    function go() { try { window.startAcropolis(); } catch (e) { console.error('start failed', e); } }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  })();
</script>
`;
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log(`index.html written: ${files.length} modules, ${(html.length / 1024).toFixed(1)} KB`);
