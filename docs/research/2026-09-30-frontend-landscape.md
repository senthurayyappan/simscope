# simscope frontend landscape: similar viewers and battle-tested dependencies

Date: 2026-09-30. Scope: review of proposed D16 (own React + shadcn/Tailwind
frontend around the existing three.js player; Python becomes a small HTTP +
WebSocket server; exported HTML is the same app with an embedded pack; viser
dropped). Method: npm registry / PyPI JSON, GitHub API, project docs. Every
number below has a source URL. "Retrieved 2026-09-30" applies to all API
figures (stars, open issues, last push) unless stated.

Status: complete.

## 0. What simscope already has (baseline for "own only the integration layer")

- `player/` is a 2,194-line three.js runtime pinned to `three@0.150.1` with
  `esbuild@0.28.2` as its only dev dependency (`player/package.json`). It
  already does the hard, simscope-specific parts: one shared `WebGLRenderer`
  blitting into many 2D canvases (`player/src/renderer.js`), orthographic
  iso/front/side/top presets (`player/src/camera.js`), per-geom-bucket
  `InstancedMesh` with `E * n` instances for batched envs
  (`player/src/scene.js:273`), instanced arrow glyphs (`player/src/overlays.js`),
  and the block/codec reader (`player/src/format.js`).
- Python has zero runtime dependencies beyond numpy; the viewer extra is
  `viser==1.1.1` + `watchfiles` (`pyproject.toml`).
- The earlier export survey (`docs/research/html-export.md`, section 2) already
  measured Brax, Plotly, Bokeh, k3d, meshcat, trimesh, Rerun, viser,
  `<model-viewer>` standalone HTML. This report does not redo it; section 7
  only adds what changes under D16.

So D16 does not start from zero on the 3D side. The new code is the app shell
(layout, timeline, plots, library browser, compare), the HTTP/WS server, and
the camera-follow + highlight logic. The question for each area below is
whether a boring dependency covers the generic part.

## 1. Rollout / trajectory viewers (depend, borrow, or ignore)

### 1.1 Rerun (rerun.io)

- Rust + egui + wgpu, compiled to Wasm for the web. Licence MIT OR Apache-2.0
  (PyPI `rerun-sdk` 0.38.1, released 2026-09-16:
  https://pypi.org/pypi/rerun-sdk/json). GitHub: 11,522 stars, 1,259 open
  issues, pushed 2026-09-30 (https://github.com/rerun-io/rerun). Company-backed.
- Web viewer: npm `@rerun-io/web-viewer` 0.38.1. The package is
  `re_viewer_bg.wasm` 51,225,405 B (16.0 MB gzip -9, measured from
  https://unpkg.com/@rerun-io/web-viewer@0.38.1/re_viewer_bg.wasm) plus
  `re_viewer.js` 229,895 B. It is self-hostable (no CDN needed: the wasm sits
  next to the JS), but it is not a single-file artefact and it is ~20x the
  whole budget of our export.
- JS control API exists: `set_playing`, `set_current_time`,
  `set_active_timeline`, `get_time_range`, `override_panel_state`,
  `send_rrd(Uint8Array)` (from
  https://unpkg.com/@rerun-io/web-viewer@0.38.1/index.d.ts). But `.rrd` is
  only compatible across one minor version (README of the same package), so an
  exported page would pin a viewer version to a data version.
- Follow camera: since 0.27 the 3D view can track any entity ("Alt+double-click
  on an entity, or through the context menu"), exposed in blueprints as
  `EyeControls3D.tracking_entity`
  (https://rerun.io/blog/release-0.27,
  https://rerun.io/docs/reference/types/views/spatial3d_view).
- Orthographic 3D: not supported. Open issue "Add orthographic and axis lock
  features to the 3D view" (#2497, open, updated 2026-09-18,
  https://github.com/rerun-io/rerun/issues/2497).
- Timeline: the best reference in the field. Time panel with per-entity
  streams, loop-selection region, editable timestamps, shift-to-snap, zoom-aware
  precision (release notes above). Layout is "blueprints": containers
  (Grid/Horizontal/Vertical/Tabs) of views, panels expandable/collapsible
  (https://rerun.io/docs/concepts/visualization/blueprints).
- **Verdict: borrow (timeline + follow-by-entity semantics), do not depend.**
  51 MB wasm, no ortho, version-coupled data, and D10 already excludes `.rrd`.

### 1.2 Foxglove / Lichtblick

- Foxglove Studio went closed-source; the old OSS repo `foxglove/studio` is
  archived (last push 2024-07-18, https://github.com/foxglove/studio) and npm
  `@foxglove/studio` stopped at 2.4.0 on 2024-05-08
  (https://registry.npmjs.org/@foxglove/studio). The live OSS SDK
  `foxglove-sdk` 0.28.0 (2026-09-29, MIT, https://pypi.org/pypi/foxglove-sdk/json)
  is a logging/streaming SDK for their proprietary app.
- The community fork **Lichtblick** (BMW): 1,151 stars, v1.29.1 released
  2026-09-08, licence **MPL-2.0** (LICENSE in
  https://github.com/lichtblick-suite/lichtblick). React + three.js.
- Its 3D panel is the most relevant camera design in the survey:
  `CameraState = {distance, perspective: boolean, phi, target, targetOffset,
  targetOrientation, thetaOffset, fovy, near, far}` (file
  `packages/suite-base/src/panels/ThreeDeeRender/camera.ts`), i.e. a
  spherical orbit state *relative to a followed frame*, with an ortho toggle.
  Follow modes are Pose / Heading (position + yaw only, horizon stays level) /
  Position / Off (https://docs.foxglove.dev/docs/visualization/panels/3d).
  The renderer resolves `followFrameId` every frame on the client
  (`Renderer.ts` `setFollowFrameId`, `#updateFixedFrameId`), so follow never
  crosses the network.
- **Verdict: borrow the camera model (orbit state relative to a follow
  target + Pose/Heading/Position/Off modes). Do not vendor code**: MPL-2.0 is
  file-level copyleft; copying files is possible but those files stay MPL. We
  only need the idea, which is ~100 lines.

### 1.3 MuJoCo's own web viewers

- **MuJoCo Studio web viewer** (experimental, in-tree): `mujoco` 3.14.0
  (2026-09-22) now requires `websockets>=13`
  (https://pypi.org/pypi/mujoco/json) for
  `python/mujoco/experimental/studio/web/web_server.py`. That server is one
  asyncio loop on one port: plain HTTP GET for static files and `/model`,
  WebSocket `/state` broadcasting a "latest-wins state payload ... at ~60Hz" as
  binary frames, built on `websockets.asyncio.server.serve` with its
  `process_request` HTTP hook (file header, lines 14-60,
  https://github.com/google-deepmind/mujoco/blob/main/python/mujoco/experimental/studio/web/web_server.py).
  It is a live-sim viewer (ImGui over the wire), not a rollout browser, and it
  is currently broken from the wheel (issue #3580, open, 2026-09-14,
  https://github.com/google-deepmind/mujoco/issues/3580).
  **Verdict: ignore as a dependency; borrow its server shape** (see section 6):
  DeepMind chose the zero-dependency `websockets` library for exactly our
  "static files + one binary stream on one port" problem.
- **zalo/mujoco_wasm**: MIT, 482 stars, runs the simulator in the browser on
  three.js, now on the official `@mujoco/mujoco` npm package (3.14.0,
  2026-09-22, Apache-2.0, 22 MB unpacked,
  https://registry.npmjs.org/@mujoco/mujoco) (commits 2026-08-21,
  https://github.com/zalo/mujoco_wasm). **Ignore**: we replay recorded poses,
  we never need physics in the browser; 22 MB is far outside budget.
- **mjviser** (mujocolab, Apache-2.0, 264 stars,
  https://github.com/mujocolab/mjviser): already handled by D7 (vendor the
  model-to-geometry conversion). Nothing new.
- **Brax HTML viewer**: see `docs/research/html-export.md`; CDN-bound,
  three r150 + lil-gui. Already an importer source (D15). Ignore as UI.

### 1.4 Isaac Lab and Genesis

- **Isaac Lab** (BSD-3-Clause, 8,263 stars, https://github.com/isaac-sim/IsaacLab)
  has no web viewer; replay is `RecorderManager` → HDF5 and re-simulation in
  Kit. Its `ViewerCfg` is the useful bit: `eye`, `lookat`, `origin_type`,
  `env_index`, `asset_name`, `body_name`
  (https://isaac-sim.github.io/IsaacLab/main/source/api/lab/isaaclab.envs.html).
  So Isaac users already think of a camera target as *(env index, asset,
  body)*. **Borrow that addressing for our follow target.**
- **Genesis** (`genesis-world` 1.4.3, 2026-09-30, Apache-2.0, 83 MB wheel,
  https://pypi.org/pypi/genesis-world/json): desktop rasterizer viewer only.
  Its `VisOptions.rendered_envs_idx` "specifies indices of the environments
  that will be rendered" (https://genesis-world.readthedocs.io/en/v1.2.2/api_reference/visualization/viewer.html).
  **Borrow the idea** (explicit render subset for thousands of envs); ignore
  the code (D9 excludes Genesis anyway).

### 1.5 viser (baseline), meshcat, Polyscope, trame/pyvista, Open3D, others

| Project | Stack / licence | Maintenance (2026-09-30) | Relevant behaviour | Verdict |
|---|---|---|---|---|
| viser 1.1.1 | Python + React/R3F/Mantine client; Apache-2.0 LICENSE, PyPI says MIT (see `docs/research/viser.md`) | 2,800 stars, 111 open issues, pushed 2026-09-25 (https://github.com/viser-project/viser); wheel 3.6 MB (https://pypi.org/pypi/viser/json) | Perspective only; batched meshes; camera set from Python over WS; uPlot bundled | Drop under D16 (reasons in the context brief stand). Borrow nothing new |
| meshcat / meshcat-python | three r132 + dat.gui / Python+ZMQ; MIT | JS repo pushed 2026-06-25 (https://github.com/meshcat-dev/meshcat); Python last release 0.3.2 on 2021-11-07 (https://pypi.org/pypi/meshcat/json), repo idle since 2024-05-07 | Animation tracks, `static_html()` | Ignore (dormant Python side) |
| Polyscope 2.6.1 | C++/Python desktop (ImGui); MIT | 2,212 stars, released 2026-02-26 (https://pypi.org/pypi/polyscope/json) | Desktop only, no browser | Ignore |
| trame 4.0.0 / pyvista 0.49.0 | Python + vtk.js / Vue; Apache-2.0 / MIT | trame 2026-09-09, pyvista 2026-09-08 (PyPI) | Server-driven Vue UI; vtk.js ~1.7 MB (html-export.md) | Ignore: a second UI framework and a heavy renderer |
| Open3D 0.20.0 web | C++/Python, WebRTC; MIT | 2026-09-16 (https://pypi.org/pypi/open3d/json), 48 MB wheel | Server renders, streams video | Ignore: no static export, pixel streaming |
| dm_control viewer | Python + GLFW; Apache-2.0 | pushed 2026-09-22 | Desktop | Ignore |
| Kubric | Blender/PyBullet dataset generator; Apache-2.0 | pushed 2026-05-21 | Not a viewer | Ignore |
| urdf-loaders 0.13.1 | three.js URDF loader; Apache-2.0 | 2026-07-08 (https://registry.npmjs.org/urdf-loader) | We ship geometry in the pack, not URDF | Ignore |
| ros3djs | three.js + roslib; BSD (NOASSERTION on GitHub) | pushed 2026-02-20, 81 open issues (https://github.com/RobotWebTools/ros3djs) | ROS-bound | Ignore |

**Thousands-of-instances pattern across the field.** Nobody draws 4,096
followable, plottable robots at once in the UI sense. They render all with
instancing (viser batched meshes, our `scene.js`), and they make *focus* an
explicit small subset: Genesis `rendered_envs_idx`, Isaac `ViewerCfg.env_index`,
Rerun entity selection/tracking. simscope should do the same: render all envs
instanced (cheap, already done), but follow, plot, and draw contacts for a
**focus set** of at most K envs (default 1, cap ~8), picked by click, by
index, or by highlight rank.

## 2. Timeline and highlight UX

### 2.1 Timeline components

| Candidate | Licence | Maintenance | Size / deps | Fit | Verdict |
|---|---|---|---|---|---|
| `@xzdarcy/react-timeline-editor` 1.0.0 | MIT | 795 stars; releases 0.1.9 (2023-03-05) then 1.0.0 (2026-01-25) after a ~3-year gap (https://github.com/xzdarcy/react-timeline-editor/releases); 11.8k dl/wk (https://registry.npmjs.org/@xzdarcy/react-timeline-editor) | Pulls `react-virtualized` (last release 2025-01-20) and `interactjs` | Animation-editor (drag clips on rows). We need scrub + markers + lanes, not clip editing | Ignore. Low bus factor, editing model we removed |
| `vis-timeline` 8.5.4 | Apache-2.0 OR MIT (dual LICENSE files in https://github.com/visjs/vis-timeline) | 2026-08-12, 305 open issues | 77.8 MB unpacked; peers `moment`, `hammerjs`, `vis-data`, `vis-util`, `xss` (https://registry.npmjs.org/vis-timeline) | Calendar/date-range items, DOM per item | Ignore. Heavy, date-centric, DOM-per-item will not scale to 10k-frame lanes |
| `wavesurfer.js` 8.0.1 | BSD-3-Clause | 10,428 stars, 13 open issues, 2026-09-24 (https://github.com/katspaugh/wavesurfer.js) | 52 KB min / 14.7 KB gz (measured) | Audio waveform + regions plugin; tied to a media element clock | Ignore as dep; its regions plugin is a nice reference |
| Perfetto UI | Apache-2.0 (https://github.com/google/perfetto) | Very active (6,578 stars, pushed 2026-09-30) | App, not a library | Tracks, WASD zoom/pan ("W and S zoom in and out, and A and D pan"), pinned tracks, drag area selection with movable edge markers (https://perfetto.dev/docs/visualization/perfetto-ui) | Borrow keyboard model + area selection |
| Rerun time panel | MIT/Apache | see 1.1 | Rust/egui, not reusable | Loop region, editable time, shift-snap, zoom-aware precision (https://rerun.io/blog/release-0.27) | Borrow |
| Lichtblick playback bar | MPL-2.0 | see 1.2 | React/MUI | Speed menu `[0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 0.8, 1, 2, 3, 5]` (`packages/suite-base/src/components/PlaybackSpeedControls.tsx`, https://github.com/lichtblick-suite/lichtblick) | Borrow the speed ladder (idea, not code) |

**Finding: there is no battle-tested library for "a robotics scrub timeline
with marker lanes".** Every serious tool (Rerun, Perfetto, Foxglove, viser's
own playback bar) wrote its own. This is the one place where simscope must
own a component outright. Keep it small: one `<canvas>` for ticks, lanes and
highlight glyphs (DOM-per-marker will not survive 10k-frame runs with dense
auto-highlights), a Radix `Slider`-free custom pointer handler, and shadcn
buttons/menus around it. Budget ~400-600 lines. Hit-testing markers on a
canvas is trivial because lanes are 1-D.

### 2.2 Automatic highlights: game-demo precedent

- **CS Demo Manager** (akiver/cs-demo-manager, MIT, 2,008 stars, pushed
  2026-09-25, https://github.com/akiver/cs-demo-manager) is the best concrete
  reference. Highlights are not scored clips but an *event list*
  (`Action = {tick, roundNumber, playerSlot, opponentSlot, ...}` built from the
  `kills` and `damages` tables, `src/node/database/watch/get-match-playback.ts`).
  The playback plan (`src/node/counter-strike/json-actions-file/generate-player-highlights-json-file.ts`)
  then: seeks to `tick - beforeDelaySeconds * tickrate` (pre-roll, min 1 s),
  plays until `tick + nextDelaySeconds * tickrate` (post-roll, min 1 s),
  **skips ahead** when the next event is more than 15 s away
  (`maxNextActionDelaySeconds = 15`), and when two events are close it does
  not cut, it just **moves the spectator camera to the next player at the
  midpoint** between the two ticks.
- **demoparser** (LaihoE, MIT, 726 stars, pushed 2026-09-30,
  https://github.com/LaihoE/demoparser) and **awpy** (MIT, 617 stars,
  https://github.com/pnxenopoulos/awpy) are the parsing layer: they turn demos
  into per-tick tables and event tables. That split (dense per-tick signals,
  sparse derived events) is the same as ours (pose/signal blocks vs.
  highlight sidecar).
- **Peak picking**: SciPy's `find_peaks` vocabulary (`height`, `distance`,
  `prominence`, `width`) is the standard one
  (https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html).
  SciPy is not a simscope dependency and should not become one for this: a
  numpy implementation of "robust z-score + minimum separation + top-K" is
  ~40 lines and is what we actually need.

**Recommended highlight model (borrowing from the above).**
1. Channels: per focus-eligible env, contact normal-force magnitude sum,
   body linear-acceleration norm (finite difference of recorded velocities,
   or of positions if velocities are absent), joint-torque norm. Computed in
   Python when a block is finalised (recorder) or at index time; never in the
   browser.
2. Score: robust z = (x - median) / (1.4826 * MAD) per channel per run, so
   thresholds are unitless across robots. Peaks: z >= 4 (default), min
   separation 0.25 s, keep top K per run (default 20) after non-maximum
   suppression across channels in a 0.25 s window.
3. Store as sparse events `{t, env, kind, score, channel}` in the same
   sidecar as programmatic marks (one marks model; `kind` distinguishes
   `auto:*` from user API marks).
4. For thousands of envs, rank envs by their max score and expose "top N envs
   by highlight score" as a focus-set picker. This is how the UI answers
   "which of 4,096 robots should I look at".
5. Playback "highlight reel" = CSDM plan: pre-roll, post-roll, skip gaps,
   camera-focus switch at the midpoint when events are close.

## 3. UI stack

All sizes below are measured by bundling the named imports with esbuild
0.28.2 (`--bundle --minify --format=esm`, `NODE_ENV=production`), with
`react`, `react-dom` and `three` marked external unless the row is React or
three itself, then `gzip -9`. Registry facts are from
`https://registry.npmjs.org/<pkg>`; GitHub facts from `gh api repos/<repo>`.

| Package | Version / date | Licence | Signals | min / gzip | Verdict |
|---|---|---|---|---|---|
| react + react-dom (`createRoot`) | 19.3.0 / 2026-09-09 | MIT | 207M dl/wk | 223 KB / 68.9 KB | Depend |
| shadcn/ui (copy-in components, CLI `shadcn` 4.21.0, 2026-09-04) | n/a | MIT | 124,913 stars (https://github.com/shadcn-ui/ui) | code lives in our repo | Depend (as source we own) |
| Radix primitives via `radix-ui` 1.6.7 / 2026-07-24 (10 primitives: Slider, Tooltip, DropdownMenu, Dialog, Popover, Tabs, Switch, ToggleGroup, ScrollArea, Select) | 2026-07-24 | MIT | 19,348 stars, 362 open issues, last push 2026-08-08 (https://github.com/radix-ui/primitives) | 168 KB / **53.7 KB** | Depend (pick this) |
| Base UI `@base-ui/react` 1.8.0, the same 10 primitives | 2026-09-04 | MIT | 11,045 stars, 439 open issues, pushed 2026-09-30 (https://github.com/mui/base-ui), full-time MUI team | 288 KB / **96.4 KB** | Viable alternative |
| Tailwind CSS 4.3.3 (+ `@tailwindcss/vite` or `@tailwindcss/cli`) | 2026-07-16 | MIT | 97,752 stars, 88 open issues | build-time only; output CSS is what we use | Depend |
| zustand 5.0.15 | 2026-08-13 | MIT | 58,774 stars, **7** open issues | 0.9 KB / 0.5 KB | Depend |
| react-resizable-panels 4.14.1 | 2026-09-27 | MIT | 5,382 stars, **0** open issues, 42M dl/wk; it is what shadcn's `Resizable` wraps (https://ui.shadcn.com/docs/components/resizable) | 56 KB / 19.3 KB | Depend |
| @tanstack/react-virtual 3.14.13 | 2026-09-14 | MIT | 7,126 stars, 28.8M dl/wk | 26 KB / 8.0 KB | Depend (run list, 1000s of runs) |
| react-virtuoso 4.18.16 | 2026-09-29 | MIT (LICENSE in package) | 6,460 stars | 61 KB / 20.4 KB | Ignore (TanStack is smaller, headless) |
| dockview-react 8.4.0 | 2026-09-30 | MIT for `dockview`, `dockview-core`, `dockview-react`; **`dockview-enterprise` is proprietary** (LICENCE.md, https://github.com/dockview/dockview) | 3,453 stars, 96 open issues | 406 KB / 94.8 KB | Ignore. Open-core since the enterprise split; full IDE docking is more than we need |
| flexlayout-react 0.11.1 | 2026-09-26 | MIT | 1,363 stars, 149 open issues (https://github.com/caplin/FlexLayout) | 196 KB / 50.6 KB | Ignore (tabsets/docking we do not need; pre-1.0) |
| golden-layout 2.6.0 | **2022-09-26** | MIT | last release 4 years ago (https://registry.npmjs.org/golden-layout) | n/a | Ignore (unmaintained releases) |
| lucide-react 1.49.0 | 2026-09-29 | ISC | shadcn default icon set; tree-shakes per icon | per-icon | Depend |

Notes:

- **Radix vs Base UI.** shadcn switched the *default* for new projects to Base
  UI on 2026-07 but states "Radix is not being deprecated ... every update
  and new component will ship for both libraries"
  (https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default). The common
  claim that Base UI is smaller did not hold for our component set: 96.4 KB vs
  53.7 KB gzip measured above. Radix is slower-moving (last push 2026-08-08)
  but that is fine for 10 stable primitives. Pick Radix for size; either is a
  defensible choice and the shadcn copy-in model makes a later swap a
  per-component edit.
- **Movable sidebars + minimisable timeline do not need a docking library.**
  react-resizable-panels v4 has `collapsible`, `collapsedSize`,
  `collapse()`/`expand()` and `useDefaultLayout` persistence (types in the
  4.14.1 package). A layout of nested Groups
  `[left | (viewport / timeline) | right]` covers every stated requirement;
  "move sidebar to the other side" is a setting that swaps two panels, not a
  drag-dock. Dockview/FlexLayout would add 50-95 KB and a layout model to own.
- **shadcn is not a runtime dependency**: its CLI copies TSX into our repo and
  the runtime deps are the primitives + `class-variance-authority` 0.7.1
  (Apache-2.0, last release 2024-11-26), `tailwind-merge` 3.7.0, `clsx`
  2.1.1. As of 2026-09 shadcn moves `cn` into a small `cn` package
  (https://ui.shadcn.com/docs/changelog). Budget: we will own ~15-25
  component files that we rarely touch.
- **Build tool**: the player already uses esbuild 0.28.2. For the app, Vite
  8.3.1 (2026-09-24, MIT, rolldown-based) is the boring React choice (HMR,
  shadcn docs assume it). Use one bundler for both: build the player as a
  Vite library entry too and drop direct esbuild, or keep esbuild and run
  `@tailwindcss/cli`. Do not run both long-term.

## 4. 3D

### 4.1 three.js: r150 → r186

- Current: `three` 0.186.1, 2026-09-24, MIT, 116,098 stars, pushed daily
  (https://registry.npmjs.org/three, https://github.com/mrdoob/three.js).
- Size of our import subset (WebGLRenderer, Ortho/Perspective cameras, lights,
  InstancedMesh, the primitive geometries, MeshStandardMaterial,
  ShaderMaterial, LineSegments, OrbitControls): **r150.1 461 KB / 119.3 KB gz
  -> r186.1 569 KB / 142.7 KB gz** (+23 KB gz, measured).
- Migration notes that touch `player/src` (from
  https://github.com/mrdoob/three.js/wiki/Migration-Guide):
  - r151: `InstancedMesh.frustumCulled` defaults to true. Already handled:
    `scene.js:276` and `overlays.js:49` set it false.
  - r152: `ColorManagement.enabled = true`, `outputColorSpace = SRGBColorSpace`.
    MuJoCo `rgba` floats passed to `new Color(r, g, b)` (`scene.js:246`) are now treated as linear
    working-space values, so colours will look lighter unless we pass
    `SRGBColorSpace` via `new Color().setRGB(r, g, b, SRGBColorSpace)` (or keep `ColorManagement.enabled = false`).
    This is the one change with visible impact.
  - r155: `useLegacyLights` false by default (removed later). The two lights
    in `player.js:89-90` need their intensities retuned (roughly x pi for the
    same look, per the linked r155 forum note).
  - r158: quaternions are expected to be normalised; q16d-decoded quats should
    be renormalised (cheap) if they are not already.
  - r163: WebGL1 removed (irrelevant). r176: `CapsuleGeometry` `length` was
    renamed `height` (positional use at `scene.js:58` is unaffected). r181:
    PBR shading brighter for rough materials (cosmetic).
  - Import path `three/addons/...` already used; unchanged.
  - Estimate: under a day, plus a screenshot diff of the demo packs.
- **WebGPU**: `three/webgpu` with the same subset is **986 KB / 257 KB gz**
  (measured), and `ShaderMaterial` does not run on `WebGPURenderer` (custom
  shaders must be rewritten in TSL). Our shared-renderer + `drawImage` blit
  design (`renderer.js`) is WebGL-specific too. **Stay on `WebGLRenderer`**;
  nothing in our scenes (instanced primitives, a few thousand glyphs) is
  GPU-bound on WebGL2.

### 4.2 Camera controls

- **camera-controls** (yomotsu) 3.1.2, 2025-11-17, MIT, 2,430 stars, 102 open
  issues, 4.6M dl/wk (mostly via drei) (https://github.com/yomotsu/camera-controls).
  **10.5 KB gz** (it takes THREE via `CameraControls.install({THREE: subset})`,
  so three is not duplicated). From its README
  (https://unpkg.com/camera-controls@3.1.2/README.md): supports
  `THREE.OrthographicCamera` (`ZOOM` instead of `DOLLY`), `smoothTime`
  (default 0.25 s) critically damped transitions, `moveTo(x,y,z,transition)`
  (moves target and eye together = follow), `rotateTo(azimuth, polar,
  transition)` (animated iso/front/side/top), `fitToBox`, `setViewport`,
  `toJSON()`/`fromJSON()` (serialisable state for compare sync), `rest`/
  `sleep` events (lets our render-on-demand loop stop).
  Bus factor is one person, but the lib is small and stable enough to vendor
  if it ever stalls. **Depend** (replaces our `OrbitControls` import).
- **Follow-camera recipe** (why viser jittered, and how the others avoid it):
  every tool that follows smoothly resolves the target pose *on the render
  thread each frame* (Lichtblick `followFrameId`, Rerun `tracking_entity`).
  Ours: each rAF, compute the followed body's position at the *interpolated*
  playback time (not the last decoded frame), feed it to
  `controls.moveTo(..., true)` with `smoothTime` ~0.1-0.2 s, and offer
  Lichtblick's modes (Position / Heading / Pose / Off). Never round-trip to
  Python.

### 4.3 @react-three/fiber + drei: worth it?

- R3F 9.8.1 (2026-09-24, MIT, 32,634 stars, 17 open issues) adds **58 KB gz**;
  drei 10.7.9 subset (OrbitControls, Grid, Instances, CameraControls) adds
  **65 KB gz** (measured, three/react external).
- **Verdict: ignore.** Our player is an imperative engine built around one
  shared WebGLRenderer blitting into many canvases (for decks and 6-up
  compare, `renderer.js`). R3F wants one renderer per `<Canvas>` and to own
  the loop; adopting it means rewriting the 2.2k lines that already work and
  losing the context-sharing trick. Use the standard "imperative island"
  pattern: a React component owns a `<div ref>`, constructs `Player`, and
  talks to it through a small typed API + zustand subscriptions.
- **Borrow** drei's `Grid` fragment shader idea (MIT; `abs(fract(r - 0.5) -
  0.5) / fwidth(r)` anti-aliased lines, two scales `cellSize`/`sectionSize`,
  `fadeDistance`; `@react-three/drei/core/Grid.js`, 142 lines). One ground
  `ShaderMaterial` with a `mode` uniform gives both requested looks: MuJoCo
  checker (`mod(floor(x)+floor(y), 2)` with fwidth AA) and white plane + grey
  grid. This replaces the per-env `LineSegments` grids in `scene.js:290-311`.

### 4.4 Thousands of robots and glyphs

- Keep what `scene.js` does (one `InstancedMesh` per geom bucket, `E * n`
  instances, `frustumCulled = false`). For glyphs (contact points, force
  arrows) use one `InstancedMesh` per glyph type with a *fixed capacity* and
  `mesh.count = active` each frame, so no allocation happens during playback
  (three `InstancedMesh.count` is the draw count). This matches
  `overlays.js`. Draw contacts only for the focus set (section 1.5), cap total
  glyphs (e.g. 4,096), and colour/scale by normal-force magnitude.
- `three-mesh-bvh` 0.9.15 (MIT, 3,500 stars) is the standard for fast
  raycasting on CAD meshes. **Ignore for now**: picking a robot among
  instanced envs can be done by picking the env's root-body instance id,
  which `InstancedMesh` raycasting already returns (`instanceId`).

## 5. Plots at 60 fps

The workload: per focus env, a handful of channels (contact force, joint
torque, acceleration, user signals) over a whole run (10k+ frames), static
once loaded (or appended per block when live), plus a playhead that moves
every frame. The playhead is the only thing that must be 60 fps, and it must
not redraw the series.

| Library | Version / date | Licence | Size (measured) | Notes | Verdict |
|---|---|---|---|---|---|
| **uPlot** | 1.6.32 / 2025-03-14 (npm); repo commits 2026-09-28 (https://github.com/leeoniya/uPlot) | MIT | `uPlot.iife.min.js` 51 KB / **22.0 KB gz**; ESM bundle 23.5 KB gz | Canvas 2D; "150,000 data points in 90ms", ~31,000 pts/ms; its own bench table ranks it first on load time and memory vs Chart.js, ECharts, Plotly (README, https://unpkg.com/uplot@1.6.32/README.md). `setData` for appends, `setCursor` + `valToPos` for a playhead that only moves the cursor overlay. Viser bundles it too. Bus factor 1 (leeoniya: 1,514 commits, next contributor 11) and 18 months since the last npm release | **Depend.** Small enough to vendor if it stalls |
| lightweight-charts | 5.2.1 / 2026-08-12 | Apache-2.0 **with a NOTICE that requires a visible link to tradingview.com on the page** (README: "You shall add the 'attribution notice' ... and a link to https://www.tradingview.com/", https://unpkg.com/lightweight-charts@5.2.1/README.md) | 52 KB gz | Financial time axis | Ignore (attribution in every export, finance-shaped axis) |
| Chart.js | 4.5.1 / 2025-10-13 | MIT | `chart.umd.min.js` 208 KB / 70.5 KB gz | Object-per-point parsing, animations; ~5x uPlot memory in uPlot's bench | Ignore |
| ECharts | 6.1.0 / 2026-05-19 | Apache-2.0 | `echarts.min.js` 1.12 MB / 368 KB gz | Capable (`large` mode, dataZoom) but heavy | Ignore |
| Plotly.js | 4.1.1 / 2026-09-14 | MIT | `plotly.min.js` 4.82 MB / 1.47 MB gz | artifacts-server's current client plots (`static/app.js`). Too large for every export | Ignore |
| Observable Plot | 0.6.17 / 2025-02-14 | ISC | pulls full `d3` | SVG, re-renders the whole figure per update | Ignore for realtime |

Recipe (uPlot): build one `uPlot` per plot with `cursor: {sync: {key}}` so
all plots share a hover crosshair; on each rAF set only the playhead
(`u.setCursor({left: u.valToPos(t, 'x'), top: -1})` or a 1-px absolutely
positioned div at `valToPos`) - no series redraw, no allocation. Downsample
per pixel column (min/max) in Python when a series exceeds ~4x the plot
width, so the browser never holds 4,096 envs x 10k frames.

## 6. Serving

What the server must do under D16: serve the built app (static), a small
JSON API over the library/index, immutable block and CAS files (cacheable
forever: they are content-addressed), and a live-tail notification (D14: a
block finished). Camera follow and compare sync are now client-side, so
nothing latency-sensitive remains on the wire.

| Option | Version / date | Licence | Deps | Notes | Verdict |
|---|---|---|---|---|---|
| stdlib `http.server.ThreadingHTTPServer` | Python 3.12+ | PSF | 0 | No WebSocket, no Range, docs warn it is not for production. SSE works (long-lived chunked response per thread) | Viable only if we accept writing Range/ETag ourselves; Starlette's release notes show how easy Range parsing is to get wrong (a Range-parsing security fix and several range fixes, https://github.com/Kludex/starlette/blob/main/docs/release-notes.md) |
| `websockets` | 17.1 / 2026-08-26 | BSD-3-Clause | **0** (https://pypi.org/pypi/websockets/json); 3 open issues (https://github.com/python-websockets/websockets) | HTTP via `process_request` returning whole in-memory `Response` bodies. This is exactly what MuJoCo 3.14's own web viewer does (section 1.3) | Good minimal option |
| **Starlette + uvicorn** | 1.7.0 / 2026-09-23; 0.54.0 / 2026-09-25 | BSD-3-Clause both | starlette: `anyio` (+`idna`); uvicorn: `click`, `h11`. WebSockets in uvicorn need `websockets` or `wsproto` installed (uvicorn `standard` extra lists `websockets>=13.0`, https://github.com/Kludex/uvicorn/blob/main/pyproject.toml) | `FileResponse` handles `Range`, `ETag`, `Last-Modified`; `StreamingResponse` for SSE; WS routes; 12.6k / 11.0k stars | **Depend** (boring, correct HTTP) |
| aiohttp | 3.14.3 / 2026-07-23 | Apache-2.0 AND MIT | 6+ (multidict, yarl, frozenlist, ...) with C extensions | Fine, but heavier and no gain over Starlette | Ignore |
| granian / hypercorn | 2.8.4 / 0.18.0 | BSD-3 / MIT | Rust extension 3.1 MB / h2 stack | Not needed for a local tool | Ignore |

Recommendations:

- **Use SSE, not WebSocket, for live tail.** With D14 the only server-push
  event is "run R has block N" (plus run-list changes). `EventSource` is
  built into every browser, auto-reconnects, and needs nothing beyond
  Starlette's `StreamingResponse`. That removes the `websockets`/`wsproto`
  dependency and a protocol. Keep WebSocket as a later option only if a
  bidirectional feature appears (none of the stated requirements needs one).
- **Serve blocks as files, not decoded arrays.** The browser already decodes
  `f32s`/`q16d` blocks with native `DecompressionStream('deflate-raw')` (D11).
  Serve CAS objects at content-addressed URLs with
  `Cache-Control: public, max-age=31536000, immutable`; the browser cache
  then makes re-opening a run and compare mode cheap. Range requests are only
  needed if we want random access inside a `.simscope` pack served over
  HTTP; Foxglove's remote-MCAP loader is the precedent (it requires a server
  that "accepts range requests" and exposes `Accept-Ranges`,
  https://docs.foxglove.dev/docs/getting-started/mcap). Starlette's
  `FileResponse` gives that for free.
- Rerun streams over gRPC from its SDK (`serve` operating mode, README of
  `@rerun-io/web-viewer`); Foxglove live uses its WebSocket protocol
  (https://docs.foxglove.dev/docs/connecting-to-data/live-data). Both are
  designed for high-rate live sensor data from a running process, which D14
  deliberately does not do. Nothing to borrow beyond "time windows are
  fetched lazily around the playhead", which our block layout already
  supports.

## 7. Standalone HTML export under D16

`docs/research/html-export.md` section 2 already sized the precedents
(Plotly 4.8 MB inline runtime, Bokeh 1.39 MB, viser 819 KB compressed,
k3d 1.18 MB base64 with an `eval`, meshcat 853 KB, trimesh 712 KB,
`<model-viewer>` 1.07 MB, Rerun 51 MB wasm). New numbers for D16:

- Current `simscope-player.js`: 499,812 B, **132.9 KB gzip**
  (`src/simscope/_assets/simscope-player.js`).
- The full proposed dependency set (react-dom, zustand,
  react-resizable-panels, @tanstack/react-virtual, the 10 Radix primitives,
  uPlot, camera-controls, the three r186 subset) bundles to **1,123 KB min,
  321 KB gzip, 271 KB brotli** (measured, one esbuild bundle). Add our own
  app code and Tailwind's generated CSS (typically tens of KB). So the full
  app is roughly 1.3-1.5 MB of inline JS/CSS per export: larger than viser's
  compressed client (819 KB) and far smaller than Plotly or Bokeh inline.
- **Keep two export shapes**, because decks embed many viewers (D6, mkdeck):
  1. *Player-only* (`<simscope-player>` custom element, no React): today's
     ~133 KB gz runtime + pack. For mkdeck slides and 6-up compare slides.
  2. *App* (the React shell around the same element): for "open this run in
     a browser and explore it" exports.
  This requires the rule that **the custom element stays framework-free** and
  the React app only wraps it. That rule is also what keeps R3F out (4.3).
- Inline the JS as a plain `<script type="module">` text node, not base64 +
  `eval` (k3d's trick is CSP-hostile, html-export.md). If size matters, the
  viser trick (compressed payload decoded at load) can be applied to the pack
  only, where `DecompressionStream` is already used.

## 8. Shortlist

The dependencies I would actually pick (runtime unless marked):

| # | Dependency | Version (2026-09-30) | Licence | gzip cost | Replaces / role |
|---|---|---|---|---|---|
| 1 | three | 0.186.1 | MIT | 142.7 KB (subset) | upgrade from 0.150.1; stays the renderer |
| 2 | camera-controls | 3.1.2 | MIT | 10.5 KB | OrbitControls; smooth follow, animated ortho presets, serialisable state |
| 3 | react + react-dom | 19.3.0 | MIT | 68.9 KB | app shell only (never inside the player element) |
| 4 | Radix (`radix-ui`) + shadcn/ui copy-in components + lucide-react | 1.6.7 / CLI 4.21.0 / 1.49.0 | MIT / MIT / ISC | 53.7 KB for 10 primitives | UI primitives, dark/light theme |
| 5 | Tailwind CSS (build-time) | 4.3.3 | MIT | CSS only | styling, `dark` class also drives viewport background token |
| 6 | zustand | 5.0.15 | MIT | 0.5 KB | app state; clock store read by rAF outside React render |
| 7 | react-resizable-panels | 4.14.1 | MIT | 19.3 KB | left/right sidebars, collapsible bottom timeline |
| 8 | @tanstack/react-virtual | 3.14.13 | MIT | 8.0 KB | run list for 100s-1000s of runs, env picker for 1000s of envs |
| 9 | uPlot | 1.6.32 | MIT | 23.5 KB | realtime plots with a moving playhead |
| 10 | Starlette + uvicorn (Python) | 1.7.0 / 0.54.0 | BSD-3-Clause | n/a | HTTP + Range/ETag file serving + SSE live tail; replaces viser |
| dev | Vite (or keep esbuild alone) | 8.3.1 | MIT | build-time | one bundler for app + player |

Total browser dependency cost measured as one bundle: 321 KB gzip.
Python viewer extra becomes `starlette`, `uvicorn`, `watchfiles` (already
present) instead of `viser` (46 `requires_dist` lines including extras, 3.6 MB wheel,
https://pypi.org/pypi/viser/json).

## 9. Everything else, with verdicts

| Candidate | Verdict | One-line reason |
|---|---|---|
| Rerun web viewer 0.38.1 | Borrow | Best timeline and entity-tracking UX; 51 MB wasm, no ortho (#2497), version-coupled `.rrd` |
| Foxglove (closed) / Lichtblick 1.29.1 | Borrow | Follow modes Pose/Heading/Position/Off, orbit-relative-to-frame camera, speed ladder; MPL-2.0, so ideas not files |
| MuJoCo Studio web viewer (3.14) | Borrow | Server shape (one port, HTTP + latest-wins stream); experimental and broken in the wheel (#3580) |
| mujoco_wasm / `@mujoco/mujoco` | Ignore | Physics in the browser; 22 MB; we replay poses |
| mjviser | Ignore (D7 stands) | Vendor conversion code only |
| Brax HTML viewer | Ignore | CDN-bound; importer source only (D15) |
| Isaac Lab `ViewerCfg` | Borrow | `(env_index, asset_name, body_name)` follow-target addressing |
| Genesis viewer | Borrow | `rendered_envs_idx` render/focus subset idea |
| viser 1.1.1 | Drop | No ortho, docking limits, Python-side camera |
| meshcat / meshcat-python | Ignore | Python side last released 2021 |
| Polyscope, dm_control viewer, Open3D, trame/pyvista, Kubric | Ignore | Desktop, pixel streaming, second UI framework, or not a viewer |
| urdf-loaders, ros3djs | Ignore | We ship geometry, not URDF/ROS |
| @react-three/fiber + drei | Ignore (borrow drei `Grid` shader idea) | Conflicts with the shared-renderer design; +123 KB gz |
| three `WebGPURenderer` | Ignore for now | 257 KB gz subset, `ShaderMaterial` unsupported, no benefit at our scene sizes |
| three-mesh-bvh | Ignore for now | `instanceId` picking suffices |
| Base UI 1.8.0 | Viable alternative | shadcn's new default; 1.8x the size of Radix for our set |
| dockview 8.4.0 | Ignore | Open-core (proprietary `dockview-enterprise`), 95 KB gz, docking not required |
| flexlayout-react 0.11.1 | Ignore | Pre-1.0, 51 KB gz, docking not required |
| golden-layout 2.6.0 | Ignore | Last release 2022 |
| react-virtuoso | Ignore | TanStack Virtual is smaller and headless |
| @xzdarcy/react-timeline-editor | Ignore | Clip-editor model, 3-year release gap, old deps |
| vis-timeline | Ignore | Date-centric, DOM-per-item, heavy peers |
| wavesurfer.js | Ignore | Audio-bound; regions plugin is a reference |
| Perfetto UI | Borrow | WASD zoom/pan, pinned tracks, area selection |
| CS Demo Manager, demoparser, awpy | Borrow | Event-list highlights, pre/post-roll, gap skip, camera switch at midpoint |
| SciPy `find_peaks` | Borrow vocabulary only | Do not add SciPy; ~40 lines of numpy |
| lightweight-charts | Ignore | Apache-2.0 NOTICE requires a visible TradingView link |
| Chart.js, ECharts, Plotly, Observable Plot | Ignore | Heavier, slower, or SVG re-render |
| `websockets` 17.1 | Fallback | Zero-dep, MuJoCo's choice; use if we ever need WS or want one dep only |
| aiohttp, granian, hypercorn | Ignore | Heavier with no gain |
| stdlib `http.server` | Ignore | We would own Range/ETag parsing, a known source of security bugs |

## 10. Five design ideas to borrow

1. **Follow camera = orbit state relative to a target resolved on the
   render thread** (Lichtblick `CameraState` + `followFrameId`; Rerun
   `EyeControls3D.tracking_entity`). Modes Position / Heading / Pose / Off.
   Implement with camera-controls `moveTo(..., true)` + `smoothTime` using
   the pose at the interpolated playback time. Target addressed as
   `(env, body)` like Isaac Lab `ViewerCfg(env_index, asset_name, body_name)`.
2. **Focus set for scale** (Genesis `rendered_envs_idx`, Isaac `env_index`):
   render all envs instanced; follow, plot and draw contacts only for K
   focused envs (default 1, cap ~8); rank candidates by highlight score so
   "which of 4,096 robots" has an answer.
3. **Highlights as a sparse event list plus a playback plan** (CS Demo
   Manager): events `{t, env, kind, score}` from robust-z peak picking
   (SciPy `find_peaks` vocabulary: height, distance, prominence) computed in
   Python; highlight reel with pre-roll/post-roll, skip gaps > N s, and
   switch focus at the midpoint when two events are close.
4. **One master clock, panes never self-play** (artifacts-server
   `static/app.js` master clock; viewers "never self-play"): a zustand clock
   store advanced in one rAF; every player, plot playhead and compare pane
   reads it. Compare camera sync = broadcast camera-controls `toJSON()` state
   from the pane being dragged. Because uPlot moves only its cursor, drop
   artifacts-server's 40 ms plot-restyle throttle.
5. **Timeline interaction model from Rerun + Perfetto + Lichtblick**: canvas
   time strip with marker lanes; drag to select a loop region (Rerun loop
   selection, Perfetto area selection with draggable edges); W/S zoom, A/D
   pan (Perfetto); click-to-type time and shift-to-snap (Rerun 0.27); speed
   ladder 0.1x-5x (Lichtblick). Keep K/J/L play/step (D13).

## 11. Where "own only the integration layer" is not true

Honest accounting. These parts have no battle-tested dependency and are ours
to write and maintain regardless of the stack:

- **Timeline strip with highlight lanes** (section 2.1): no library fits;
  ~400-600 lines, the biggest single owned UI component.
- **Highlight detection** (Python, numpy): ~100-200 lines incl. tests. Small,
  but it is product logic.
- **Follow camera, focus set, compare sync**: ~300 lines on top of
  camera-controls.
- **App shell**: layout, run browser, inspector, settings, theme tokens.
  Mostly shadcn composition, but still several thousand lines of TSX over
  time. This is the real maintenance cost of D16 and it is larger than the
  viser GUI code it replaces only if scope creeps. Guard it: no annotation
  UI (already cut), no docking, no plot builder (a fixed set of channel
  plots), no settings beyond theme/ground/contacts/follow.
- **Server API**: Starlette routes over `library`/`index` (~300-500 lines).

Everything generic (rendering, controls, primitives, layout splitters,
virtualisation, plotting, HTTP correctness) is covered by the shortlist, and
every shortlisted package is MIT/ISC/BSD, maintained in 2026, and bundles
into the wheel and the exported HTML with no CDN. The two single-maintainer
risks are camera-controls (yomotsu) and uPlot (leeoniya); both are small
(10.5 KB and 23.5 KB gz) and MIT, so vendoring is the exit if either stalls.
