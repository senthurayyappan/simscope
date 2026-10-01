# Viser and ecosystem: related-work report for simscope

Research date: 2026-09-29/30. Working files are under `/private/tmp/claude-501/-Users-senthurayyappan-Projects-simscope/3cd0ceb1-4f12-4f06-ba0c-7c7e8581dba7/scratchpad/research/viser/`. That directory holds the viser repo clone, the 1.1.1 wheel, mjviser, newton, isaaclab, mjlab and kimodo-viser clones, the benchmark scripts, and a venv with viser 1.1.1. Nothing in simscope or other projects was modified.

## Executive summary

1. **The "2.75 MB client per export" objection is obsolete.** Viser 1.1.1 (released 2026-09-15) ships `client/build/index.html` at 818,656 bytes. Version 1.0.30 was 2.89 MB, and 1.1.0 was 2.82 MB, which matches your local proteus install. The reduction (PR #771, commit `08c93789`) came from dropping the embedded font and the MDX compiler, and from shrinking the environment maps and applying zstd+base88 compression. The wheel went from 5.4 MB to 3.6 MB.
2. **"Zero CDN" is essentially true already.** I loaded a 1.1.1 `as_html()` export in a browser (served over localhost). `performance.getEntriesByType('resource')` was empty, so there were no subresource requests. I decoded the client JS and found one runtime CDN reference: `https://www.gstatic.com/draco/v1/decoders/` (`src/viser/client/src/mesh/GlbLoaderUtils.ts:6-8`). It is only hit when a Draco-compressed GLB is loaded. Trimesh's GLB export is not Draco-compressed by default, so simscope will not hit it unless it feeds Draco meshes. Fonts are the system stack, HDRIs are read from the wheel by the Python side (`src/viser/_assets/hdri/`), and uPlot is bundled.
3. **External playback control is still not a supported feature.** Time, speed and pause are React `useState` in `FilePlayback.tsx`. There is no `postMessage` handler and no URL param for time or pause. The maintainer confirmed in issue #600 (open) that driving embedded playback or loading different motions is "not really" supported. I did find a hack that works today from a same-origin parent. Dispatching `keydown {code:'Space'}` on the iframe window toggles pause. Setting the time `<input>` through the native value setter plus an `input` event seeks. Both were verified in a `srcdoc` iframe. It is brittle because it depends on Mantine DOM classes.
4. **`.viser` is a version-fragile format.** Every message is a viser-internal msgpack dict. The client only warns on a version mismatch (`FilePlayback.tsx:130-150`). Newton pins `viser==1.0.26` with the comment "1.0.24-1.0.26 changed playback-sensitive paths" (`newton/pyproject.toml:132`). Old `.viser` files have broken across releases, per the maintainer in issue #302. Do not use `.viser` as the on-disk archive format.
5. **The compact-format goal is not served by the `.viser` format either.** I measured a 17-body MuJoCo humanoid at 60 Hz, batched. It came to about 841 B/frame, against a raw f32 pose baseline of 476 B/frame, so roughly 1.8x. This includes a zstd-12 pass, and random-torque motion compresses poorly, so real rollouts will do better. The export path then base64-encodes the payload, which adds another 33%.
6. **Viser is a good live viewer and annotation UI substrate.** It offers batched instancing, per-client scenes (`client.scene`, new in 1.1.0), GUI sliders, buttons, tab groups, panels, uPlot, notifications, modals, file upload/download, a command palette, labels, click and pointer events, and `get_render` for thumbnails. The live path handled 4096 batched instances at 60 Hz with 0.12 ms mean Python-side cost per update.
7. **Viser has no history, persistence or timeline of its own.** The live server culls updates to the latest value per node and property (`_messages.py` `EntityLifecycle`). Client state is explicitly ephemeral, and GUI messages are excluded from recordings. So markers, notes, plots and ratings do not export through viser. simscope has to own storage of annotations and per-rollout streaming from disk.
8. **The evidence weakens two of the earlier objections but not the decisive one.** The first two are size and CDN, which are now mostly resolved. The third is the missing control API, which stands. Format instability is a new, fourth reason. Recommendation: keep an owned standalone renderer for export, and use viser for the live server. Details are at the end.

## Viser capabilities table

Version notes: latest is **1.1.1** (2026-09-15). License is MIT per pyproject/PyPI metadata, but the repo `LICENSE` file is Apache-2.0 (GitHub reports Apache-2.0). Both are permissive, but the mismatch is unresolved, so ship both notices. Repo: github.com/viser-project/viser, 2797 stars, last push 2026-09-25, 111 open issues, technical report arXiv 2507.22885.

| Feature | Supported? (version) | Notes | Implication for simscope |
|---|---|---|---|
| Wire protocol | Yes | msgpack via msgspec plus raw aligned binary buffers, zstd-compressed, over websocket (`infra/_messages.py:80-167`, `infra/_infra.py:932`). Strict client/server version match via the subprotocol (`docs/source/development.rst`). | Do not depend on the wire format. Use the Python API only. |
| `get_scene_serializer()` / `StateSerializer` | Yes (1.1.0 improved) | `insert_sleep(dt)` between updates. `serialize()` dedups identical buffers by sha256 and streams zstd level 12 (`infra/_infra.py:91-173`). Works headless with no client connected (I ran with `port=0` and no client). Docs still say "experimental". | Usable as a quick-export backend. Time is wall-clock seconds (`insert_sleep`), not frame index. |
| `as_html()` | Yes (1.0.25+, PR #673) | Injects `window.__VISER_EMBED_DATA__` (base64) into the client HTML (`_infra.py:175-204`). 1.1.1 measurements: N=100 instances, 600 frames = 1.7 MB. N=1000, 1000 frames = 15.6 MB. N=4096, 1000 frames = 61 MB. | Works offline. The client is 0.8 MB per file, but it is duplicated in every export. |
| Offline playback via `?playbackPath=` | Yes | One client build plus separate `.viser` files (`App.tsx:161`). It uses `fetch`, so it needs HTTP(s). `file://` untested (UNVERIFIED). | A shared client plus per-rollout data avoids duplicating the client, but not from `file://`. |
| Playback controls | Play/pause, time input, slider, speed (0.5-8x), scene-tree toggle | `FilePlayback.tsx:160-390`. Docked bar in 1.1.0. Spacebar toggles pause. | UI is fixed. No markers, no custom controls. |
| External drive (postMessage/URL/API) | **No** | Grep of `src/viser/client/src` finds no `message` listener. Window globals `__viserMutable` and `__viserSceneTree` exist but are E2E test hooks (`App.tsx:1345-1376`) and do not expose playback state. Camera has URL params: `initialCameraPosition`, `initialCameraLookAt`, `initialCameraUp`, `initialCameraFov`, `initialCameraNear`, `initialCameraFar`, plus `darkMode` and `logCamera`. | Same conclusion as before. The DOM-poke hack is verified but fragile. |
| Seek / scrubbing | Yes, but replay-based | Backward seek resets the scene and replays from message index 0 (`FilePlayback.tsx:236-243`). Issue #292 (open) documents rewind edge cases. The whole recording is decoded into memory. No keyframe index. | A 61 MB export used a 196 MB JS heap and loaded in about 4 s. Very long recordings scale linearly. |
| Instancing | Yes | `add_batched_meshes_simple`/`_trimesh`, `add_batched_glb`, `add_batched_axes`. Per-instance colors, opacities, scales, LOD (`_messages.py:1099-1183`). | Best fit for rigid bodies. One node updates all poses per frame. |
| Meshes | Yes | `add_mesh_simple` sends f32 vertices and u32 faces raw. `add_mesh_trimesh` exports to GLB (`_scene_api.py:2381-2428`). Skinned meshes are supported. | Draco GLBs would hit the gstatic CDN. Avoid them. |
| Point clouds / splats | Yes | f16/f32 points plus u8 colors. Splats use the antimatter15 packed layout, with dynamic updates in 1.1.0 (`GaussianSplatHandle.set_gaussians`). | Not core to us. |
| URDF | Yes | `viser.extras.ViserUrdf` (needs the optional `yourdfpy`). Issue #658 (batched URDF loading) is open. | Useful for Isaac assets. Loads one robot at a time. |
| MJCF / MuJoCo | Not in viser | Use mjviser (below). | Depend on mjviser or copy its converter. |
| GUI | Yes | Sliders, multi-slider, buttons, button groups, text, number, dropdown, checkbox, folders, tab groups, `add_panel` (floating panels, 1.1.0), markdown, HTML, images, progress bar, modal, notifications, upload button, `send_file_download`, `add_command` palette. Also `add_uplot` (bundled) and `add_plotly` (server sends `plotly.min.js` from the local Python package via `RunJavascriptMessage`; no CDN). | Sufficient for a rating/tag/notes panel and time-series plots. |
| 3D annotation | Yes | `add_label`, `add_3d_gui_container`, `add_transform_controls`, `on_click`, `on_pointer_event`, `on_rect_select`. | Good for in-viewer annotation. Only 3D labels reach the exports. |
| Camera control | Yes | `initial_camera`, `client.camera` read/write, `get_render()` (sped up in 1.1.0, PR #751). | `get_render` can generate rollout thumbnails, but needs a connected browser client. |
| Multi-client | Yes (1.1.0) | `client.scene` and `client.gui` are per-connection scopes with shadowing (`examples/03_interaction/08_per_client_scenes.py`). Client state is ephemeral: a reconnect is a new client (PR #758). | One server can show a different rollout per browser tab. Rebuild state in `on_client_connect`. |
| Scalability (live) | Good | Docs: thousands of separate nodes choke, tens of thousands of batched instances are fine (`docs/source/performance_tips.rst`). I measured 4096 instances at 60 Hz in the live path. 1.1.1 renders on demand (PR #776, `frameloop="demand"`). | Use batching. On-demand rendering helps idle iframes. |
| Server extension points | Partial | `viser.infra.WebsockServer(http_server_root=...)` is public and can serve a custom client. `ViserServer` hardcodes `client/build` (`_viser.py:1150`). | Possible to swap in a forked client, but it must match versions. |
| Plugin / custom component API | No | No plugin system exists (searched issues and docs). Extension means forking the client. | See Risks. |
| Client build | Vite 8, React 19, three.js r186, Mantine 9, Node >=24 | Source ships in the wheel under `viser/client/src`. Prebuilt single file at `viser/client/build/index.html`. `viser-build-client` rebuilds it. The 1.1.1 build is zstd-compressed, and the loader needs `DecompressionStream` and WASM. | You can copy the prebuilt file without Node. Patching needs Node. |

## Ecosystem projects

**mjviser** — https://github.com/mujocolab/mjviser
- License: Apache-2.0 on GitHub. PyPI metadata gives no license.
- Activity: 263 stars. Last commit 2026-08-07. Last PyPI release 0.0.14 (2026-05-07). It depends on `viser>=1.0.27`, `mujoco>=3.6`, `trimesh`, `pillow`.
- What it does: web MuJoCo viewer (sim controls, actuator and joint sliders, contacts and forces, convex hulls, keyframes, `mjGEOM_SDF`, textures, heightfields). `ViserMujocoScene.update_from_arrays/update_from_mjdata` uses batched meshes. Source read: `src/mjviser/scene.py`, 1490 lines, plus `conversions.py`, 724 lines.
- Playback: `examples/motion_playback.py` records qpos/qvel in-process and scrubs with a server-side slider, a play button, speed control and looping. It calls `mj_forward` per frame, so it needs the MuJoCo model and a live Python process. There is no `.viser` recording, no multi-rollout browsing, no annotation, no HTML export. I did not find an npz loader, so the search-engine claim about one is UNVERIFIED.
- Also: mjlab rebuilt its viewer on it (`mjlab/pyproject.toml` requires `mjviser>=0.0.14`; mjlab has 3153 stars).
- Verdict: **use as dependency, or vendor `conversions.py` and `scene.py`.** It is the best MuJoCo-to-viser geometry conversion available. Pin a version, because 0.0.x means an unstable API.

**Newton viewer (`newton.viewer.ViewerViser`)** — https://github.com/newton-physics/newton
- License: Apache-2.0. 5701 stars. Last push 2026-09-30. PyPI 1.0.0 (2026-02-27).
- Source: `newton/_src/viewer/viewer_viser.py`, 1765 lines. It has `record_to_viser=` (StateSerializer plus `insert_sleep` per frame, `save_recording`), `show_notebook()` (Sphinx docs iframe plus a local HTTP server for the client plus `playbackPath`), `log_scalar` live plots, and Gaussians.
- It pins `viser==1.0.26` in its docs and notebook extras (`pyproject.toml:132,143`).
- It has separate `ViewerFile`, a JSON/CBOR state history (`viewer_file.py`), that is not viser-based.
- No multi-rollout browsing and no annotation.
- Verdict: **learn from.** It shows the record-then-embed pattern and the version-pinning pain. It is only relevant as a dependency if simscope targets Newton models.

**Isaac Lab visualizers** — https://github.com/isaac-sim/IsaacLab
- License: BSD-3-Clause. 8252 stars. Last push 2026-09-30.
- `source/isaaclab_visualizers/isaaclab_visualizers/viser/viser_visualizer.py` (917 lines) wraps Newton's `ViewerViser`. It has a `record_to_viser` config field, share URL, sidebar controls, live plots, and a streaming camera.
- It is tied to Newton scene data (`cloning_contexts=("isaaclab_newton.cloner:...")`) and the `viser` extra is `viser>=1.0.16`. I did not run it, so end-to-end `.viser` recording from PhysX is UNVERIFIED.
- Verdict: **learn from.** It is the official Isaac-to-viser path, but it is live-oriented and Newton-coupled.

**uynitsuj/IsaacLab-Viser** — https://github.com/uynitsuj/IsaacLab-Viser
- No license. 11 stars. Last push 2025-06-24.
- Headless Isaac Lab plus viser web UI, against Isaac Sim 4.5. README says many features need manual work.
- Verdict: **ignore.** It is stale, and superseded by the official Isaac Lab visualizer.

**kimodo-viser (NVIDIA)** — https://github.com/nv-tlabs/kimodo-viser
- Apache-2.0. 23 stars. Last commit 2026-07-06. Its `__version__` says 1.0.16 (`src/viser/__init__.py:68`).
- A fork of viser that adds a full timeline UI: `Timeline.tsx` (3086 lines), plus `_timeline_api.py` (1782 lines) with tracks, keyframes, intervals, prompts, `on_keyframe_add/move/delete`, `set_frame_range`, `set_fps`, and arrow-key overlays. The README says the fork "may not be maintained long-term" and is not meant for merging upstream.
- Verdict: **learn from.** It is the closest existing design for timeline markers and annotations on top of viser. Reusing it means owning a client fork that is behind upstream.

**robot_keyframe_kit / viser-keyframe** — https://github.com/Stanford-TML/robot_keyframe_kit
- MIT. 171 stars. Last push 2026-03-27. It depends on `viser-keyframe==1.0.20`, a PyPI fork of viser with multi-column GUI for keyframe editors (`github.com/cymcymcymcym/viser_keyframe_ui`). The fork wheel is 29 MB (the old bundle size). It is a MuJoCo keyframe editor.
- Verdict: **learn from.** It is evidence that people fork viser to get editing UI, and forks lag upstream.

**Other viser consumers**
- robot-viewer (https://github.com/zixingjiang/robot-viewer): MIT, 9 stars. URDF/MJCF viewer plus IK via mink. Ignore.
- Motphys/UniLab (https://github.com/Motphys/UniLab): Apache-2.0, 947 stars. Has `viser_playback.py` (a server-side playback loop) and made viser a hard dependency (PR #1638). Learn from as another instance of the mjviser-style pattern.
- ManiSkill PR #1466 (https://github.com/haosulab/ManiSkill/pull/1466): a viser integration, still open. Ignore.
- pyroki (https://github.com/chungmin99/pyroki): MIT, 1787 stars, IK toolkit that uses viser for interactive viz. Not a viewer. Ignore.
- nerfstudio (12040 stars, last push 2025-07-29) and gsplat (5743 stars): viser-based viewers for radiance fields. Not relevant to sim rollouts.
- brentyi/egoallo: published `.viser` files against viser v0.2.12 only (issue #302). It is a warning about format breakage.
- kevinzakka/mjc_viewer (https://github.com/kevinzakka/mjc_viewer): MIT, 63 stars, last push 2022. Not viser. It exports a static trajectory HTML but has no meshes or heightfields yet. Ignore for viser purposes, but other tracks may want it as an offline-HTML precedent.

None of these has multi-rollout browsing, rollout marking or annotation. I found no viser-based project for browsing a folder of rollouts. The gap simscope targets appears to be open.

## Risks and gaps

1. **No external playback API.** `FilePlayback.tsx:60-64` holds `playbackSpeed`, `paused` and `currentTime` in local state. The only supported ways in are the initial-camera URL params. Issue #600 confirms the maintainer's answer: modify `FilePlayback.tsx` yourself. A vendored patch (a `postMessage` handler in about 50 lines) is plausible. It means building the client with Node >=24 and re-applying the patch per viser release.
2. **Recording format instability.** Version mismatch only produces a notification (`FilePlayback.tsx:130-150`). Newton pins an exact version. The maintainer told users in issue #302 that `.viser` files are "not generally compatible between versions". Since `as_html()` embeds the client that wrote the data, embeds stay self-consistent, but archived `.viser` files do not.
3. **Not a compact or seekable rollout format.** Poses travel as per-frame node-update messages (~1.8x raw f32 in my measurement, plus 33% base64 in HTML). There is no keyframe index. A backward seek replays from message 0. The entire recording is decoded into JS memory (196 MB heap for the 61 MB file). Issue #292 (open) notes that rewind has edge cases.
4. **Exports drop everything that is not scene geometry.** `include_in_scene_serialization=False` covers GUI, click bindings, notifications and so on (`_messages.py:340-353`). So GUI plots, markdown notes, timeline markers, ratings and tags are absent from any viser export. Only scene nodes, including 3D labels, survive.
5. **Extensibility means forking.** No plugin API exists. The two forks I found (kimodo-viser, viser-keyframe) are both stale relative to upstream (based on 1.0.16 and about 1.0.20) and one is a full timeline reimplementation. Also, the websocket handshake requires client and server versions to match, so a forked client needs a forked Python package.
6. **Open issues that touch us.** #728: skinned mesh does not loop in HTML export. #337 and #302: embedding `.viser` locally or in another page (answer: serve over HTTP). #600: controlling embedded playback. #675: viser and Isaac Sim conflict, because Omniverse bundles an older `websockets`; the fix is to `import viser` first, which is impractical inside Kit. Recording Isaac rollouts in simscope's own format in-process and converting offline in a separate process sidesteps this.
7. **`file://` behavior is UNVERIFIED.** The embedded path has no `fetch` and inlines everything, so it probably works, but the pane refused to open `file://`. A `srcdoc` iframe from a same-origin http page did work. `?playbackPath=` cannot work from `file://` because it uses `fetch`.
8. **Multiple embeds per deck.** Each iframe carries its own React and WebGL context. During testing the console showed "Too many active WebGL contexts" from another tab. 1.1.1's on-demand rendering reduces idle cost, but lazy-load and unload iframes per slide anyway.
9. **License wording mismatch (MIT metadata vs Apache-2.0 file).** Include both texts when redistributing the client. The built client also bundles many third-party licenses (React, three.js, Mantine, uPlot).
10. **Maturity churn.** Viser cut 47 commits between 1.0.30 and 1.1.1, including renamed line-width props (`thickness`) and a rewritten panel system. Pin versions.

## Recommendations

1. **Live server: build on viser.**
   - Use `ViserServer` (>=1.1.1, pinned) as the "point at a folder" browser.
   - Stream frames from simscope's on-disk format into `client.scene` batched meshes, so each browser tab can show a different rollout and scrub independently. The server is the only holder of frames, because viser keeps no history.
   - For MuJoCo, use mjviser's `ViserMujocoScene` or vendor its conversion code. For Isaac, record poses to simscope's format and replay through the same path.
   - Build the marking and annotation UI from GUI slider (with marks), buttons, tab groups, `add_uplot`, notifications, `add_label`, and click and pointer events.
   - Persist favorites, tags, ratings and notes in sidecar files or a small database that simscope owns. Viser's client state is ephemeral by contract.
   - Generate thumbnails with `client.get_render()` when a browser is connected.
2. **Standalone export: still own the renderer.**
   - The remaining reasons are the missing control API (a slide tool needs to set time and speed from the parent), the format instability, and that GUI-side data (markers, notes, plots) cannot ride along.
   - What changes from the earlier decision: file size is no longer a strong argument (0.8 MB vs 2.75 MB), and "no CDN" is nearly a non-issue (avoid Draco GLBs). If the export renderer's own effort is a concern, a viser export is now a credible zero-code fallback for a quick look. It is not a substitute when parent control is needed.
   - If you would rather not own a renderer, the middle path is a vendored patch of `FilePlayback.tsx` that adds a `postMessage` API (play, pause, seek, speed, ready and time events). This needs Node >=24 in your build and re-applying per viser bump. I would try upstreaming first, since the maintainer described the code as "designed to be lightweight / hackable".
3. **One on-disk format, two consumers.**
   - Define simscope's own compact format (poses as typed arrays, per-model shared meshes, content-addressed as mkdeck does). Do not use `.viser` as the archive.
   - Feed both the live viser adapter and the exporter from that format. This keeps the exporter independent of viser releases.
4. **Isolation for Isaac.** Record in-process to simscope's format without importing viser, and run the viser server as a separate process. This avoids the websockets clash (issue #675).
5. **Cheap spike before deciding on the patch path.** Prototype the DOM-poke control (verified above) in a reveal.js slide to see whether a viser export is acceptable for early demos. It would need only `srcdoc` iframes on the same origin.
6. **Extra option if timeline UI inside the viser client is wanted.** Study kimodo-viser's `Timeline.tsx` and `_timeline_api.py` before designing your own. It is the only public timeline-with-markers implementation on top of viser.

## Method notes

- Viser 1.1.1 was cloned at `56712d30` (main, 2026-09-24) and installed from PyPI in a venv. The wheel's client JS was decoded (base88 plus zstd) and grepped for URLs.
- Benchmarks: `bench1.py` (humanoid, batched vs per-node frames), `bench2.py` (batched instance export size and browser load), `live.py` (live server update cost). Browser checks used the Browser pane against localhost servers, which I stopped afterwards.
- Everything I could not check directly is marked UNVERIFIED above."
