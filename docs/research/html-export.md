# simscope: standalone/offline HTML export and deck embedding (research report)

Date of research: 2026-09-29/30. Nothing in the simscope repo or other projects was modified. Experiments live in `/private/tmp/claude-501/-Users-senthurayyappan-Projects-simscope/3cd0ceb1-4f12-4f06-ba0c-7c7e8581dba7/scratchpad/research/html/` (`bundle/`, `perf/`, `dl/`).

"Measured" means I ran it on Chrome 152 (Claude.app Electron, Apple M5 Pro) or on wheels and tarballs downloaded from PyPI and npm.

## 1. Executive summary

1. **CDN-free single-file export is a solved pattern, and everyone inlines the runtime plus base64 data.** Runtime sizes I measured:
   - k3d "full" snapshot: 2.7 MB of JS, zlib-compressed to a 1.18 MB base64 string, then `eval`'d.
   - trimesh viewer: 712 KB (full three r140, minified).
   - meshcat: 853 KB.
   - trame-vtk viewer: 1.05 MB.
   - viser 1.1.1 client: 819 KB.
   - Plotly inline: about 4.7 MB.
   - Bokeh inline: about 1.4 MB.

   Brax is the outlier. Its HTML pulls six things from CDNs.
2. **The artifacts-server spec's "2.75 MB React client per file" premise is out of date for viser 1.1.1, but its second premise still holds.**
   - The viser client `index.html` was 2,888,259 B in 1.0.30 and 2,815,047 B in 1.1.0. In 1.1.1 (released 2026-09-15) it is 818,656 B.
   - The 1.1.1 client is a self-extracting page (zstd, WASM decoder bootstrapped through native gzip `DecompressionStream`, base-88 text). See `viser/client/vite-plugin-compress-html.mts` in the wheel.
   - 1.1.1 also has a first-class `server.scene.as_html()` and `StateSerializer.as_html()`, in `viser/_scene_api.py` and `viser/infra/_infra.py`.
   - Playback still cannot be driven from a parent page. `client/src` has no `message` listener, and `currentTime` and `playbackSpeed` are React state in `FilePlayback.tsx`.
   - Viser HTML also still means one React app plus one WebGL context per iframe. So viser stays out as a deck target, but the "2.75 MB" number should be corrected in that spec.
3. **A small owned three.js player is affordable.**
   - mkdeck's real `viewer/*.js`, bundled with esbuild (minified IIFE, `--legal-comments=none`), measures: r150 466 KB min / 122 KB gz / 162 KB as base64(gz); r186 573 KB min / 145 KB gz / 193 KB as base64(gz).
   - mkdeck today inlines about 1.24 MB of unminified text: three.module.js 1,178,963 B + OrbitControls 26,182 B + viewer 16,496 B + loader 14,542 B.
   - Self-extracting gzip would cut that roughly 6x.
   - The WebGLRenderer shader chunks make up the floor (`three.module.js` is 355 KB of the 567 KB in the plain three subset build) and cannot be tree-shaken.
   - Builds are byte-deterministic (I compared two esbuild runs with `cmp`).
4. **Mesh bytes dominate, not poses.** Real data from `~/Projects/dial-mpc/artifacts/crate/crate-upstream-20260910T003823920226Z/rollout.rbundle`:
   - 13 unique meshes, 625,835 verts, 1,255,264 faces, 22.6 MB raw.
   - Poses: `body_pos` is 672 B and `body_quat` is 896 B for 4 frames. That is 28 B per body per frame.
   - Mesh compression results are in section 4. The short version: quantizing to u16 plus delta plus gzip gets to 3.0 MB with no native dependency.
5. **Compression support in 2026 (MDN browser-compat-data 8.1.3, 2026-09-24).**
   - gzip and deflate: Chrome 80, Firefox 113, Safari 16.4. deflate-raw: Chrome 103.
   - Brotli `DecompressionStream`: Firefox 147 and Safari 18.4, but not Chrome (crbug 463397980).
   - zstd: nowhere except Firefox behind a flag.
   - Use gzip only, or vendor a WASM decoder as viser does.
6. **Decode cost is small if you use the native base64 decoder.**
   - 90.3 MB raw (44 MB gz, 59 MB base64) takes 258 ms with `Uint8Array.fromBase64` plus gunzip. The `atob` loop takes 1,125 ms. `fetch('data:…')` on the same data takes 1,042 ms (measured for the decode alone, not the gunzip).
   - `Uint8Array.fromBase64` is available in Chrome 140, Firefox 133, Safari 18.2. Keep an `atob` fallback.
7. **WebGL contexts are the real deck hazard.**
   - Measured: creating 40 canvases with `webgl2` in Chrome 152 left 16 alive and lost the oldest 24.
   - mkdeck keeps the current slide plus or minus 1 alive (`syncEmbeds` in `mkdeck.js`). That is 3 slides times viewers per slide, so a 6-up compare slide would hit 18.
   - mkdeck's viewer `dispose()` calls `renderer.dispose()` but never `forceContextLoss()` (`rollout_viewer.js` lines 262-268). Measured: 40 create/dispose cycles without `forceContextLoss()` cost a live "keeper" context. With `forceContextLoss()` the keeper survived.
   - Recommended fix: a shared renderer that blits into per-viewer 2D canvases (details in section 3).
8. **`file://` forces inlining.** Classic `<script>` works from `file://`. `fetch`, XHR and external `type=module` scripts do not (MDN says local files have opaque origins). I could not run file:// tests: the Browser pane refuses `file://` scripts and no Chrome is installed. So every `file://` statement below is cited, not measured.
9. **`<model-viewer>` and glTF should be a secondary interchange target, not the deck player.**
   - The bundle is 1.07 MB min / 289 KB gz (475 KB for the module build that leaves three external).
   - It has a shared renderer and a settable `currentTime`, but no timeline UI.
   - Draco and KTX2 decoders default to gstatic URLs, and meshopt needs an explicit location.

## 2. Prior-art table

Sizes are measured from the PyPI/npm artifacts unless marked. Data column = how the payload is embedded.

| Tool (version, date) | Truly offline? | Runtime size | Data embedding | Compression | Interactive timeline? | License | Verdict |
|---|---|---|---|---|---|---|---|
| Brax `brax.io.html` 0.14.2 (2026-03-15) | No. CDNs: `unpkg.com/es-module-shims@1.6.3`, `unpkg.com/three@0.150.1` (+`/examples/jsm/`), `cdn.jsdelivr.net/npm/lil-gui@0.18.0/+esm`, `unpkg.com/pako@2.1.0`, and `cdn.jsdelivr.net/gh/google/brax@v{ver}/brax/visualizer/js/viewer.js` (`brax/io/html.py`, `visualizer/index.html`) | Own JS is 24.7 KB. Meshes and poses ride in the page (about 99% meshes, per mkdeck `rollout.py` docstring) | zlib(JSON) then base64 in `var system` | zlib | No scrubber. lil-gui panels for camera, per-body pos/rot, save/capture | Apache-2.0 | Learn from |
| Plotly `to_html(include_plotlyjs=…)` 7.1.0 (2026-09-15), plotly.js 4.1.1 | `True` yes. `'cdn'`, `'directory'`, a `.js` path and `False` do not inline (docs) | `plotly.min.js` 4,815,814 B (1.47 MB gz). Plotly's docs still say "~3MB" (stale). Full HTML with 100k points: 7,189 KiB inline vs 2,486 KiB CDN. Strings such as `cdn.plot.ly` topojson remain in the JS for lazy geo | JSON with base64 typed arrays (`bdata`) | none | n/a | MIT | Learn from. The `directory` mode is the sidecar precedent |
| Bokeh 3.10.0 (2026-08-18), `INLINE` | Yes with `INLINE`. `CDN` is `cdn.bokeh.org` | `bokeh.min.js` 1,388,321 B (386 KB gz). Full doc 3,010 KiB inline vs 1,654 KiB CDN | JSON with base64 ndarray | none | n/a | BSD-3-Clause | Learn from |
| Panel/HoloViz 1.9.4 `save(embed=True)` | Default is CDN. `resources='inline'` gives offline (`panel/io/save.py`) | UNVERIFIED (wheel 30 MB) | Embeds a pre-computed state space (`max_states`) | none | Widget-state lookups, not a rollout timeline | BSD | Ignore |
| Altair/Vega 6.3.0 | `save('x.html', inline=True)` is offline. Default is CDN (docs). Needs `vl-convert-python` | UNVERIFIED | Vega-Lite JSON spec | none | n/a | BSD-3 | Ignore |
| pyvista 0.49.0 `export_html` | Yes, via the trame-vtk static viewer. `Plotter.export_html` is deprecated in 0.49 in favour of `plotter.trame.export_html()` (`trame-pyvista` 0.1.7). Only kitware.github.io favicon/docs strings inside | `static_viewer.html` 1,047,552 B (310 KB gz). `trame-vtk.js` 1,755,884 B for the live view | base64 of a `.vtksz` zip inside `OfflineLocalView.load` | zip | No (static scene) | MIT / BSD | Ignore. vtk.js is heavy and static |
| k3d-jupyter 3.1.1 `get_snapshot()` (2026-09-22) | `snapshot_type="full"` (the default) is fully offline. `"online"` and `"inline"` templates use `unpkg.com/k3d` and cdnjs `require.js` (`plot/plot_snapshot.py`, `static/snapshot_*.txt`) | `standalone.js` 2,695,651 B compressed to 883,584 B, about 1.18 MB base64, plus `require.js` 17.6 KB and `fflate` 32.8 KB. The JS is decoded then `eval`'d | msgpack, zlib level 9, base64 | zlib (fflate) | Yes. Keyframe-dict `TimeSeries` traits and a time slider | MIT | Learn from. Compressed-runtime trick is good, `eval` is CSP-hostile |
| pythreejs 2.4.2 / ipywidgets 8.1.9 `embed_minimal_html` | No by default. html-manager comes from `cdn.jsdelivr.net/npm` (docs). pythreejs last released 2023-02-20 | n/a | Widget-state JSON | none | n/a | BSD | Ignore |
| meshcat 0.3.2 `static_html()` (2021-11-07, repo idle since 2024-05) | Yes. Inlines `main.min.js` | 852,987 B (218 KB gz), three r132 + dat.gui | msgpack "drawing commands", including animations, as JS calls | none | Yes. Animation tracks with the dat.gui timeline | MIT | Learn from. The animation-track model fits rollouts |
| trimesh 5.1.0 `scene_to_html` | Yes. Full three r140 minified with GLTFLoader and OrbitControls, no URLs beyond comments | 712,014 B template (173 KB zipped) | base64 GLB substituted for `$B64GLTF` | none in the HTML | No (static) | MIT | Learn from. Its `srcdoc` iframe embedding is the same trick as here |
| Open3D 0.20.0 web visualizer | No. It needs a running server and WebRTC (docs); there is no static export | n/a | streamed | n/a | server-side | MIT | Ignore |
| Rerun 0.38.1 (2026-09-16) web viewer | Wasm is local in `rerun_notebook`, not a single file | `re_viewer_bg.wasm` 51,220,089 B and `widget.js` 297,636 B | `.rrd` streamed or loaded | n/a | Yes, full timeline | MIT OR Apache-2.0 | Ignore for embedding. Learn from its data model |
| viser 1.1.1 `scene.as_html()` (2026-09-15), stars 2,797 | Yes | client 818,656 B (669 KB gz, already packed). Was 2.89 MB in 1.0.30 | scene bytes in `window.__VISER_EMBED_DATA__` as base64 | zstd (own) | Built-in playback bar, but not parent-drivable | Apache-2.0 LICENSE in the wheel; PyPI metadata says MIT (inconsistent) | Use for the server viewer only. Learn from the compressed-page trick. Ignore for decks |
| marimo 0.25.0 `export html-wasm` | No. Pyodide is fetched from a CDN (marimo's worker bundles reference `cdn.jsdelivr.net/pyodide`). The docs I fetched did not settle `file://` | large | n/a | n/a | n/a | Apache-2.0 | Ignore |
| nbconvert 7.17.1 with widget state | No. Defaults: cdnjs `require.js`, jsdelivr html-manager (`exporters/html.py`) | n/a | Widget-state JSON | none | n/a | BSD-3 | Ignore |
| Quarto `embed-resources: true` | Yes for what it embeds. MathJax and KaTeX are excluded by default (docs) | n/a | inlines files | none | n/a | (Quarto) | Learn from as a model of a "self-contained" switch |
| Observable Framework | Static folder, needs an HTTP host (docs) | n/a | file attachments and loaders | n/a | n/a | ISC | Ignore |
| stlite | No. `stlite.js` from jsdelivr and Pyodide from a CDN by default (README) | large | n/a | n/a | n/a | Apache-2.0 | Ignore |
| `<model-viewer>` 4.3.1 (2026-06-04), stars 8,260 | Yes when nothing is loaded from CDN. Draco defaults to `www.gstatic.com/draco/versioned/decoders/1.5.6/` and Basis to `gstatic.com/basis-universal/…` (only used if the glTF needs them) | `model-viewer.min.js` 1,068,903 B (289 KB gz). `model-viewer-module.min.js` 475,096 B with three external | GLB URL (`src`), which can be `data:` or `blob:` | Optional meshopt/Draco/KTX2 | No UI. API only: `currentTime`, `timeScale`, `play()`, `pause()` | Apache-2.0 | Learn from. Possible secondary export target |
| Vendored three.js subset (mkdeck viewer) | Yes | see section 3 | `.rbundle` | gzip | Custom (mkdeck) | MIT | Use, as the base |

## 3. Recommended export architecture

### 3.1 Runtime and bundling

- **Runtime.** Keep three.js with WebGLRenderer, `OrbitControls` and the existing mkdeck viewer. Size budget: 120–150 KB gz, or about 165–195 KB as a base64(gz) self-extracting block per file. Do not hand-roll WebGL:
  - ogl: 59 KB min / 17 KB gz (Unlicense).
  - twgl subset: 42 KB min / 15 KB gz.
  - regl: 123 KB min / 41 KB gz.
  - Babylon core subset: 1.65 MB min / 391 KB gz.
  - The ogl and twgl numbers are the floor if the primitive set is ever frozen. I did not try them on the real viewer, and three's ecosystem (`OrbitControls`, geometry primitives) is the stronger argument for staying.
- **Three version.** mkdeck pins r150.1 because of the `OrbitControls` camera-up workaround (`scripts/VENDOR_VIEWER.md`). r186 costs 107 KB more min (+23 KB gz) and changes lighting (physically-correct lights are the default since r155, per my recollection, not verified here). Bundle r150 first for visual parity. Treat r186 as a separate upgrade.
- **Bundler.**
  - Use esbuild, pinned exactly, with `npm ci` from a lockfile. It produces one IIFE (`--format=iife --minify --legal-comments=eof`) plus an unminified ESM for development. Builds are deterministic (checked).
  - `vite-plugin-singlefile` 2.3.3 (MIT, 1,234 stars, GitHub release v2.3.0 from 2025-07-02, npm 2.3.3 published 2026-04-17) is only needed if you want a full page shell. Viser uses it plus its own compression plugin.
  - The IIFE lets you delete mkdeck's module machinery (`MODULES`, the `rewrite()` regexes, blob-URL chains, `VIEWER_MODULES`), because a classic inline script works from `file://`.
- **Compressed runtime.** Ship the IIFE as gzip, then base64 in a `<script type="text/plain">`. At load, `DecompressionStream('gzip')` decodes it, then run it as a `Blob` URL script or `new Function`. Both k3d and viser do this. Do not use `eval` if CSP matters. mkdeck already needs `blob:`.
- **Python-only maintainability.**
  - Commit the built `player.js` under `src/simscope/_assets/` and the JS sources under `player/` with `package.json` and `package-lock.json`.
  - Add a CI job that rebuilds and runs `git diff --exit-code`.
  - Add a `THIRD_PARTY_NOTICES` entry (three MIT, OrbitControls MIT, any decoder). `--legal-comments=eof` keeps the notices in the bundle.
  - mkdeck already follows this pattern: `THIRD_PARTY_NOTICES.md` and `scripts/vendor_assets.py`.

### 3.2 Shared `simscope-player` package vs. reusing mkdeck's player

Build the shared player in simscope. Reasons:
- mkdeck's `viewer/*.js` is already a fork of the gallery viewer (`scripts/VENDOR_VIEWER.md`: "a fix made in one place should be easy to carry to the other").
- Both projects consume the same `.rbundle`/`RBDL` format.

Suggested split:
- simscope owns `simscope-player` (ESM + IIFE + a `<simscope-player>` custom element).
- mkdeck's `mkdeck-rollout.js` becomes a thin adapter: it keeps the `load(eager)`/`unload()`/`reload()`/`snapshot()` contract and `data-*` options, and the `.rollout`+`.meshes` splitter stays in mkdeck since `mkdeck/rollout.py` owns that format.
- Distribution: mkdeck vendors the built asset via a sync script that fetches the tagged release, like its `vendor_assets.py`. A hard dependency on the simscope wheel is the alternative, but it adds a heavy Python dependency for a JS file.

### 3.3 Data embedding

- **Per-rollout data.** Base64 text in `<script type="text/plain" data-…>` (mkdeck's current approach, kept).
  - Read `.textContent` lazily and decode with `Uint8Array.fromBase64` (fall back to `atob`), then `DecompressionStream('gzip')`.
  - Measured on Chrome: for a 57 MB HTML file, DOMContentLoaded was 119 ms and a 90 MB decode took 210 ms. JS heap reached 244 MB while holding text, compressed bytes and decoded bytes at once. Free the text after decode where possible.
  - The maximum string length in Chrome 152 is 536,870,888 chars (`'a'.repeat(n)` succeeds at that value and throws at +1), so a single file is capped at about 512 MB.
- **Mesh encoding (add to the format).**
  - Quantize vertices to uint16 in the bounding box.
  - Delta-code vertices and faces.
  - Split into byte planes, then gzip.
  - This pipeline is about 30 lines of JS to decode and needs no native dependency. Use `meshoptimizer` only if you can accept a compiler dependency: the PyPI `meshoptimizer` is sdist-only (0.2.30a0, alpha), and its JS decoder is 26.7 KB min / 7.4 KB gz.
  - Draco is 286 KB of WASM plus a 59 KB wrapper, about 10x larger than meshopt.
- **Deduplicate.** Key meshes by content hash across geoms and across rollouts, as mkdeck does with `HASH.meshes`. This matters: in the crate scene left and right legs have identical sizes, and xz (with a large window) gets 5.5 MB where gzip (32 KB window) gets 11.0 MB.
- **`<script type=application/octet-stream>`** is not needed. `text/plain` plus base64 is fine and what mkdeck uses.
- **Reproducibility.** Use `gzip.compress(..., mtime=0)` and a fixed compression level so exported files are diffable.

### 3.4 `file://` behaviour

- Everything the player needs must be inline: runtime, meshes and poses. A single-file deck already does this.
- MDN says local files have opaque origins, so loading a local file with included local resources produces CORS errors (https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSRequestNotHttp). Module scripts are fetched with CORS and are blocked, while classic scripts are not (https://github.com/whatwg/html/issues/8121, search results). mkdeck's own docs confirm: "A browser does not read a neighboring file from a `file://` page" (`docs/robots/share-rollouts.md`).
- The only sidecar option under `file://` is data wrapped as a classic script (for example `window.__simscope_meshes["hash"]="base64…"` in a `.js` file loaded with `<script src>`). That is standard behaviour and UNVERIFIED here.
- A folder build served over HTTP can use `fetch`, and can send Brotli/gzip `Content-Encoding` from the server as the artifacts-server spec plans.

### 3.5 Deck integration contract

- Custom element `<simscope-player src="…">` (mkdeck keeps `<deck-rollout>` as an alias), with mkdeck's `data-*` options:
  - `data-autoplay`, `data-loop`, `data-follow`, `data-view` (iso/side/front/top), `data-scale`, `data-background`. Add `data-speed` and `data-marks` (baked annotations).
- Methods: `load(eager)`, `unload()`, `play()`, `pause()`, `seek(t)`, `setSpeed(x)`, `setView(name)`, `setCamera(state)`, `snapshot()` (returns a PNG, used for PDF).
- Events: `ready`, `timeupdate {t, duration}`, `ended`, `error`.
- Fragment sync (my suggestion, not verified): reveal.js exposes `slidechanged`, `slidetransitionend`, `fragmentshown` and `fragmenthidden` (present in mkdeck's vendored `dist/reveal.js`), so the deck can call `seek(t)`/`play()` when a fragment appears.
- For an iframe-hosted mode in the server viewer, keep the artifacts-server `bv-*` postMessage protocol as an optional transport over the same methods.
- **Iframes vs. inline.** Use inline components in decks: one shared JS module, and a shared renderer is possible. Iframes duplicate the runtime and the WebGL context per viewer and need postMessage plumbing. A large `srcdoc` is not a problem in itself (a 57 MB srcdoc document decoded 90 MB in 487 ms, measured), so `srcdoc` remains fine for the server viewer and notebooks. In an HTML attribute, `"` and `&` must be escaped (trimesh escapes only quotes, meshcat also escapes `&`).
- **reveal.js lazy loading.** reveal.js supports `data-src` on iframes with `viewDistance` 3 and `mobileViewDistance` 2 (from `dist/reveal.js`; `revealjs.com/lazy-loading/` returned 404). mkdeck already runs its own window (current ±1). Keep that for `<deck-embed>` iframes.

### 3.6 Many viewers per deck (WebGL contexts)

1. **Fix now:** call `renderer.forceContextLoss()` after `dispose()`. Measured in section 1, item 7.
2. **Real fix:** one shared WebGL renderer (an offscreen canvas or `OffscreenCanvas`) draws each visible viewer and blits into that viewer's own 2D canvas.
   - `<model-viewer>` does exactly this (`three-components/Renderer.js`: `Renderer.singleton`, `copyPixels` uses `drawImage`, plus an `IntersectionObserver`).
   - The three.js manual gives a second reason: WebGL resources cannot be shared across contexts, so one renderer means shader compilation and geometry upload happen once (https://threejs.org/manual/en/multiple-scenes.html).
   - My micro-benchmark on Chrome 152 (a 20-sphere scene, 160x120 views, timer-driven because the pane was hidden, so treat as indicative only): shared renderer plus `drawImage` ran 130 fps at 16 viewers, 81 fps at 30 and 49 fps at 48. With one context per view the numbers look fine but are meaningless past 16, because lost contexts render nothing.
3. **Rendering policy.** Render only while visible, on demand (dirty flag) or while playing. Use `IntersectionObserver` or the slide window. Handle `webglcontextlost`/`webglcontextrestored`.
4. **Limits elsewhere.** Chrome's global limit is reported as 16 contexts in the sources I found (and configurable only by a startup flag). Firefox and Safari have their own limits (UNVERIFIED for exact numbers).

### 3.7 PDF and printing

- mkdeck already draws each rollout's first frame as a picture and gives the context back, one at a time (`snapshotRollout` in `mkdeck-rollout.js`).
- Add a baked poster frame (PNG) in the `.rbundle` header so PDF export, email previews and `decktape` do not need WebGL at all.
- This matters for CI: Chrome removed the automatic SwiftShader WebGL fallback and needs `--enable-unsafe-swiftshader` to opt back in (https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM, https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md). reveal.js says `?print-pdf` is confirmed only in Chrome/Chromium (revealjs.com/pdf-export). decktape (v3.16.1) does not document WebGL handling, only `--chrome-arg`, so its default behaviour is UNVERIFIED.

### 3.8 Interactivity in the exported file

- The current mkdeck controls (play, scrubber, time readout) are enough for slides.
- Server-viewer extras (speed, camera presets, side-by-side compare, baked markers) can be a small vanilla DOM overlay. lil-gui (MIT) is 31 KB min / 8 KB gz if you want a panel. Brax uses it for camera, body and capture folders.
- Prior art for animation controls: meshcat (dat.gui timeline) and k3d (time slider, keyframe dicts). `<model-viewer>` has none built in.
- For compare panes, drive N players from one master clock, as the artifacts-server design already does.

### 3.9 `<model-viewer>` and glTF as an export target

- Fit for rigid bodies: glTF animation channels map each body to a node with translation/rotation tracks, LINEAR interpolation of fixed-dt samples, so it is lossless. Size is the same as the pose buffers: T x n_bodies x 28 B, plus a shared time accessor.
- Gaps:
  - glTF is Y-up, so a root rotation node is needed for MuJoCo's Z-up.
  - Capsule, cylinder, ellipsoid and plane must be tessellated in Python, and trimesh's GLB export does not write animations (a custom writer is needed).
  - There is no scrubber UI and no follow-camera besides setting `cameraTarget` per frame.
  - Force arrows, prediction lines and collision toggles are outside glTF.
  - Draco/KTX2 decoders default to gstatic URLs, and meshopt only loads if you set a decoder location (`CachingGLTFLoader.js`). All of this is fixable by vendoring or by not using compression.
- `model-viewer` accepts `data:` and `blob:` URLs, so it can be offline. Its shared renderer (section 3.6) is a plus.
- I did not build and load a rollout GLB in it, so end-to-end fidelity is UNVERIFIED.
- Verdict: export `.glb` as an interchange format for Blender, Quick Look and similar. Do not use `<model-viewer>` as the deck player, since it does not cover force/prediction/collision overlays.

## 4. Numbers

**JS runtimes (minified IIFE unless noted).**

| Item | min | gz |
|---|---|---|
| three r186 subset (WebGLRenderer, primitives, `OrbitControls`) | 566,713 B | 140,460 B |
| three r150 subset | 460,669 B | 117,618 B |
| three r186, whole namespace | 745,313 B | 190,951 B |
| mkdeck's real viewer, r150 | 466,460 B | 121,702 B (162 KB as base64 of gz) |
| mkdeck's real viewer, r186 | 572,554 B | 144,804 B (193 KB as base64 of gz) |
| ogl | 59,400 B | 17,315 B |
| regl | 123,198 B | 41,220 B |
| twgl (full / subset) | 81,728 / 42,474 B | 25,288 / 14,615 B |
| Babylon core subset | 1,650,894 B | 390,530 B |
| lil-gui | 31,118 B | 8,228 B |
| fflate `gunzipSync` | 4,380 B | 2,298 B |
| meshopt decoder | 26,705 B | 7,411 B |
| model-viewer 4.3.1 (full / module) | 1,068,903 / 475,096 B | 289,231 / 143,667 B |
| Chrome's native gunzip | 0 B | n/a |

**Encoding overheads.**
- Base64 adds 33% (measured: 11.11 MB gz becomes 14.81 MB text).
- Viser's base-88 (4 bytes to 5 chars, 25%) is not worth it for 50–100 MB payloads because the native base64 decoder is far faster.

**Decode time (Chrome 152, M5 Pro).**

| Item | 22.6 MB raw | 90.3 MB raw |
|---|---|---|
| gunzip alone | 56 ms | 221 ms |
| `Uint8Array.fromBase64` alone | 9 ms | 34 ms |
| `atob` loop alone | 237 ms | 865 ms |
| `fetch('data:…')` | 232 ms | 1,042 ms |
| Whole pipeline from a `<script>` node with `atob` | 356 ms | 1,125 ms |
| Whole pipeline with `fromBase64` | 74 ms | 258 ms |

deflate-raw times match gzip within about 5%.

**Mesh compression on the crate scene (22.6 MB raw; 22,573,188 B for the 13 unique meshes).**

| Method | Size |
|---|---|
| gzip -9 | 11.0 MB |
| brotli q9 | 10.2 MB |
| zstd level 19 | 8.3 MB |
| xz | 5.5 MB |
| meshopt (f32 verts unquantized) | 5.3 MB |
| u16 quantized + delta + byte-planes + gzip (pure numpy) | 3.04 MB (verts 1.92 MB, indices 1.12 MB) |
| u16 quantized + meshopt | 2.90 MB (2.40 MB with gzip on top of the vertex stream) |

Indices alone: u32 gzip 4.35 MB vs meshopt 0.34 MB. This is a single scene, and 4 to 11 frames long, so poses are not representative (28 B per body per frame is the model).

**Other measured.**
- Chrome 152 keeps 16 live WebGL2 contexts.
- 57 MB inline-base64 HTML: DOMContentLoaded 119 ms, decode 210 ms, JS heap 244 MB.
- 57 MB `srcdoc` iframe: 487 ms end to end.

## 5. Risks and open questions

1. **`file://` behaviour is documented, not measured.** I could not run file:// tests in this environment (no Chrome installed; the Browser pane treats `file://` as a static snapshot). mkdeck's docs assert the same limits. A quick test in real Chrome, Firefox and Safari is still worthwhile.
2. **Non-Chrome WebGL limits.** Firefox and Safari context limits, and drawImage-from-WebGL readback cost, are UNVERIFIED. Chrome numbers are from one machine with the pane hidden.
3. **Three version.** r150 is old. Moving to r186 changes look (lighting), so plan a visual regression pass. Shader chunks put a hard floor of about 450–570 KB min on any three.js WebGLRenderer bundle.
4. **Mesh codec choice.** The pure-numpy quantize/delta scheme is dependency-free but lossy at u16 (about 1/65535 of the bounding box). Decide the tolerance and whether to keep an f32 escape hatch. meshopt is better but the PyPI package is sdist-only and alpha (0.2.30a0), so it needs a compiler.
5. **Viser licence metadata mismatch.** The wheel's LICENSE is Apache-2.0, PyPI metadata says MIT. Confirm before redistributing anything derived.
6. **Self-extracting runtime and CSP.** Blob-URL script or `new Function` needs `blob:`/`unsafe-eval` under strict CSP. Inline-minified without compression avoids it, at 470–570 KB. WASM decoders (meshopt, zstd) need `wasm-unsafe-eval` under CSP.
7. **decktape/CI PDF.** Poster frames avoid the need for GPU or SwiftShader flags, but the header format needs to carry them.
8. **Memory in big decks.** Text, compressed bytes and decoded bytes coexist during decode (244 MB heap for a 90 MB rollout). Decode per rollout only when the slide window arrives, and release the text afterwards.
9. **glTF path is unproven.** No end-to-end GLB animation test was run in `<model-viewer>`.
10. **Unchecked:** Panel and Altair runtime sizes, marimo `file://` behaviour, decktape WebGL defaults, exact Firefox and Safari limits.

## Key source paths

- mkdeck: `~/Projects/mkdeck/src/mkdeck/inline.py`, `src/mkdeck/rollout.py`, `src/mkdeck/assets/mkdeck-rollout.js`, `src/mkdeck/assets/viewer/rollout_viewer.js`, `src/mkdeck/assets/mkdeck.js`, `scripts/VENDOR_VIEWER.md`, `THIRD_PARTY_NOTICES.md`
- artifacts-server spec: `~/Projects/artifacts-server/docs/specs/2026-06-30-native-rollout-viewer-design.md`
- Experiments: `.../scratchpad/research/html/perf/` (`dec.html`, `ctx.html`, `shared.html`, `big4.html`, `tail22.bin`), `.../bundle/` (esbuild outputs `out_*.js`, `mk/`), `.../dl/` (downloaded wheels)
- MDN browser-compat-data 8.1.3 (2026-09-24) via `unpkg.com/@mdn/browser-compat-data/data.json` (compression formats, `fromBase64`, APIs)
- Repo stats via `gh` and PyPI/npm on 2026-09-29: three.js r186 (2026-09-24, 116,075 stars, MIT), model-viewer v4.3.1 (2026-06-04, 8,260, Apache-2.0), viser v1.1.1 (2026-09-15, 2,797, Apache-2.0), brax v0.14.2 (2026-03-15, 3,243, Apache-2.0), k3d v3.1.1 (2026-09-22, 1,035, MIT), rerun 0.38.1 (2026-09-17, 11,516), meshoptimizer v1.3 (2026-09-25, 8,476, MIT), reveal.js 6.0.2 (2026-09-10, 72,363, MIT), decktape v3.16.1 (2026-04-20, 2,430, MIT)
