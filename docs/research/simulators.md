# simscope related-work report: physics simulators, recording/export paths, scene extraction

Date of survey: 2026-09-29/30. All repos were shallow-cloned and read at HEAD. Wheels, npm and PyPI metadata were checked. Experiments I ran are labelled "measured". Clones and experiments are in `/private/tmp/claude-501/-Users-senthurayyappan-Projects-simscope/3cd0ceb1-4f12-4f06-ba0c-7c7e8581dba7/scratchpad/research/sims/`. That folder holds a venv with viser 1.1.1, mujoco 3.14.0 and usd-core, plus scripts `exp1.py` to `exp5.py`. Nothing in the simscope repo was touched.

## 1. Executive summary

1. **Viser 1.1.1 already solves "standalone offline HTML with zero CDN".** `server.get_scene_serializer().as_html()` inlines a single-file client (818 KB) and the recording as base64 in `window.__VISER_EMBED_DATA__` (`src/viser/infra/_infra.py:175-204`). I built a 600-frame humanoid page (1.44 MB) and loaded it over localhost. The only requests were the HTML and one `blob:` worker, `performance.getEntriesByType('resource')` was empty, and the scrub bar and playback worked (measured). Caveats:
   - The `.viser` file is a time-stamped message log tied to the client version. Newton's own code says the client must match the serializer (`newton/_src/viewer/viewer_viser.py:get_viser_client_dir`).
   - Seeking backward resets the scene and replays messages from t=0 (`FilePlayback.tsx:226-231`).
   - The whole recording is decompressed in browser memory.

   So keep a simscope-native archival format and generate `.viser`/HTML at export time.
2. **Newton (`newton.viewer`) is the closest analog to the interface simscope wants, and Isaac Lab 3.0 already builds on it.**
   - `ViewerBase` is the abstract interface. Its methods are `set_model`, `begin_frame`, `log_state`, `end_frame`, `log_mesh`, `log_instances`, `log_lines`, `log_points`, `log_scalar`, and so on.
   - Concrete backends: GL, RTX, Rerun, USD (time-sampled), **Viser (`.viser`)**, File (JSON/CBOR2), Null.
   - Internally Newton does what simscope needs: a static Model (`shape_body`, `shape_transform`, `shape_type`, `shape_scale`, `shape_source`), a geometry hash so identical meshes are stored once, and per-frame `state.body_q`.
   - Isaac Lab 3.0-EA (2026-09-16) ships Viser and Rerun visualizers that reuse Newton's viewers for PhysX-, OVPhysX- and Newton-backed sims.
   - Do not depend on Newton (it pulls warp-lang, 173 MB). Copy its structure.
3. **Isaac Lab 3.0-EA changed conventions.**
   - It requires Python 3.12 only and Isaac Sim 6.1, and it can run kitless with the Newton backend.
   - Quaternions moved from WXYZ to XYZW (`docs/source/migration`, `base_articulation_data.py`).
   - The stable PyPI `isaaclab` is 2.3.2.post1 (Python 3.11, WXYZ).
   - The adapter must treat quaternion order as per-source metadata.
4. **The Isaac Lab RecorderManager (HDF5) stores simulator state, not poses.**
   - It records `scene.get_state()`: root pose and velocity plus joint position and velocity per asset.
   - Replay needs the sim (`scripts/tools/replay_demos.py`).
   - Existing pose-level recordings in Isaac land are `.viser`, `.rrd`, Stage-Recorder/OVD time-sampled USD, and mp4.
   - Simscope needs its own recorder hook that reads `asset.data.body_link_pose_w`.
5. **Shipping body transforms is the only route that covers both MuJoCo-family and Isaac. Replaying qpos in browser with MuJoCo WASM is viable but MuJoCo-only.**
   - I ran official `@mujoco/mujoco` 3.14.0 WASM in Node. It is 10.3 MB raw, 2.5 MB gzip, 1.9 MB brotli.
   - It loads from an in-memory `wasmBinary`, with no fetch. Then `from_xml_string`, set qpos, `mj_forward`, read `xpos` all worked (measured, `wheels/mjwasm/package/t.mjs`).
   - A single-file HTML is feasible.
   - Downsides: MuJoCo-only, breaks under per-env domain randomization, and a Python-side `mj_forward` gives the same result cheaply.
   - Verdict: store transforms as canonical. Optionally keep a MuJoCo `qpos` sidecar (about 4x smaller for the humanoid: 28 vs 119 floats per frame) and materialise transforms server-side.
6. **Meshes dominate size, not poses.**
   - Unitree G1: 35 meshes, 196,692 verts, 393,270 faces = 7.1 MB raw, 3.4 MB zstd, 2.2 MB with u16 verts + zstd (measured).
   - 1000 frames of G1 poses (31 bodies × 28 B) is 0.87 MB.
   - Content-addressed meshes shared across rollouts (mkdeck's idea, Newton's geometry hash) are essential. Export should offer mesh decimation.
7. **Pose compression, measured on the MuJoCo humanoid (1000 frames, 17 bodies, 476 KB raw f32).** Numbers are for actively actuated motion; a falling-then-static run compresses much better.

| Encoding | Size vs raw f32 |
|---|---|
| Viser message log (`.viser`), N=1 | 1.75x (831 B/frame) |
| Viser message log, N=16 envs | 0.89x (425 B per env-frame) |
| Brax-style JSON + zlib | about 2.0x (b64: 2.8x) |
| USD `.usdc` (translate f64 + orient f32) | 1.86x |
| Lossless byte-shuffle + zstd-19 | 0.63–0.78x |
| int16-quantised + zstd | 0.37–0.5x |

   Default to lossless f32 chunks and offer an optional q16 mode.
8. **MuJoCo-side tooling already exists.**
   - `mjviser` (mujocolab, Apache-2.0) has a batched-scene `ViserMujocoScene` with `update_from_arrays(xpos, xmat)` and a `num_envs` argument. `mujoco_warp`'s own viewer uses it. Its `conversions.py` covers textures, cubemaps, hfields and primitives.
   - MuJoCo's `python/mujoco/usd` exporter works from `mjvScene` geoms and needs `pxr`.
   - Use mjviser as a dependency or reference for the MuJoCo path, not as the core.
9. **Licensing and weight for Isaac.**
   - The Isaac Sim repo is Apache-2.0, but Kit and assets are under NVIDIA's additional license (`IsaacSim/LICENSE`).
   - PyPI `isaacsim` 6.1.0.0 is "NVIDIA Proprietary Software" and pins Python ==3.12.*.
   - The Isaac adapter must be a lazy, optional module that runs inside the user's Isaac environment and takes numpy or torch arrays. The core must never import `isaacsim`, `omni` or `pxr`.

## 2. Per-simulator sections

### 2.1 MuJoCo / MJX / MuJoCo Warp

**Static scene** from `mjModel` (compiled, so it is sim-agnostic once read):
- Geoms: `geom_type/size/bodyid/pos/quat/rgba/matid/dataid/group/contype/conaffinity`.
- Meshes: `mesh_vert/face/normal/texcoord*` by address. `mesh_face` is int32 and `mesh_vert` is float32.
- Textures and materials: `mat_*`, `tex_data` (including cube maps).
- Other: hfield, cameras and lights, `flex_*` and `skin_*` (deformables), sites and tendons.
- Reference implementation: `mujocolab/mjviser` `src/mjviser/conversions.py:176-330`. It duplicates vertices when UVs exist, handles cubemap textures, and merges geoms.
- Portable packaging: `MjSpec.to_zip()/from_zip()` exists in 3.14 (verified in the venv).
- MuJoCo re-centres meshes to the inertial frame, but `geom_pos/quat` already compensate, so use them directly.

**Per-frame state:**
- MuJoCo: `d.xpos`, `d.xquat` (wxyz), `d.xmat` (flat 9), `geom_xpos/xmat`.
- MJX: `mjx.Data.xpos/xquat/geom_xpos` (`mjx/mujoco/mjx/_src/types.py:1054-1117`). Batches come from `vmap` and the leading axis is the batch. `mjx.get_data(m, d)` returns a list of `MjData`. There is now an `Impl.WARP` path.
- MuJoCo Warp: `xpos (nworld,nbody,3)`, `xquat (nworld,nbody,4)`, `geom_xpos/xmat` (`mujoco_warp/_src/types.py:2259-2271`, `math.py` uses wxyz).
- `mujoco.rollout` outputs physics state (qpos etc.), not poses, so forward kinematics is needed.

**Existing viewer / record / export paths:**
- `mujoco.viewer` is native GLFW with no recording.
- The mujoco_playground `render_array` replays `qpos/qvel/mocap/xfrc_applied` through `mj_forward`, renders offscreen with `mujoco.Renderer`, and outputs mp4 via mediapy (`mujoco_playground/_src/mjx_env.py:347-390`). That is the ecosystem's standard "replay qpos" idiom.
- `mjwarp-record` writes video (`mujoco_warp/record.py`). `mjwarp-viewer` uses `mjviser`.
- USD: `mujoco.usd.USDExporter` updates from `mjvScene` geoms and writes time-sampled USD (`python/mujoco/usd/exporter.py`). MuJoCo's docs say native USD animation export is not yet available (`doc/OpenUSD/exporting.rst`). `newton-physics/mujoco-usd-converter` 0.6.1 (Apache-2.0, alpha, 75 stars) converts MJCF assets to USD. It pins `mujoco<3.13`, which conflicts with 3.14.
- WASM: official `@mujoco/mujoco` 3.14.0 (Apache-2.0, `wasm/README.md`, still described as WIP). `zalo/mujoco_wasm` (MIT, 482 stars, last push 2026-08-23) is now just a three.js demo on the official bindings. Its `index.html` loads es-module-shims from unpkg (CDN), and it sets `xpos/xquat` after `mj_forward`. `live.mujoco.org` is a browser viewer with drag-and-drop, and its source is UNVERIFIED (probably `wasm/demo_app`).

**Offline-HTML story:**
- Route A: build a Viser scene and call `as_html()` (measured working).
- Route B: embed MuJoCo WASM plus XML plus qpos (feasible; mesh assets need the Emscripten virtual filesystem, UNVERIFIED).
- Route A is the recommendation.

**Adapter API sketch:**
```python
scene = mujoco_adapter.scene_from_model(mjm)                        # -> Scene (mesh/tex dedup by hash)
rec = RolloutWriter(folder, scene, dt=..., n_envs=E)
rec.append(poses=mujoco_adapter.poses(xpos, xquat))                 # [E,B,7] f32 (E=1 for MjData)
# MJX / Warp: same call, arrays pulled from device once per N steps
rec.append_stream("qpos", qpos)                                     # optional sidecar
```

### 2.2 Brax (how `brax.io.html` works)

- `html.render()` builds a Jinja page from `brax/visualizer/index.html`.
- The system JSON is zlib-compressed, base64-encoded and inlined in the page. It is decoded with pako in the browser.
- **CDN URLs in the page:**
  - `unpkg.com/es-module-shims@1.6.3` (54 KB)
  - `unpkg.com/three@0.150.1/build/three.module.js` (1.18 MB unminified) plus `three/addons/` (OrbitControls)
  - `cdn.jsdelivr.net/npm/lil-gui@0.18.0/+esm` (32 KB)
  - `unpkg.com/pako@2.1.0` (47 KB)
  - `cdn.jsdelivr.net/gh/google/brax@v{version}/brax/visualizer/js/viewer.js` (plus `system.js`, `animator.js`, `selector.js`, about 24 KB total)
- `base_url` can override only the viewer location; the other CDN URLs stay hard-coded (sources: `brax/io/html.py`, `brax/visualizer/index.html`).
- The system JSON (`brax/io/json.py`) has:
  - `geoms` keyed by link name, each with `name`, `link_idx`, `pos`, `rot`, `rgba`, `size` and (for meshes) `vert` and `face`.
  - `states.x[t].{pos,rot}` as float lists, with wxyz rot.
- `system.js:createTrajectory` converts wxyz to xyzw and builds one three.js `AnimationClip` with a `VectorKeyframeTrack` and `QuaternionKeyframeTrack` per link. The viewer is Z-up via `DEFAULT_UP.set(0,0,1)`.
- **Size** (my reproduction of the format on the 1000-frame humanoid): 2.4 MB JSON, 0.95 MB zlib, 1.27 MB base64, versus 0.45 MB raw f32.
- Lineage: `html.py` was first committed 2021-06-03 and `viewer.js` history in this repo begins 2023-03-29. Earlier lineage is UNVERIFIED. It is a small hand-written three.js r150 viewer, Apache-2.0. brax 0.14.2 was released 2026-03-15.
- **Zero-CDN version:** vendor five JS files, inline them and drop the importmap. Still, viser's client already does this.

### 2.3 Isaac Sim / Isaac Lab

**Static scene:**
- From the USD stage, traverse with `pxr`. Read `UsdGeom.Mesh` (`points`, `faceVertexCounts`, `faceVertexIndices`), the primitives (Cube, Sphere, Capsule, Cylinder, Cone, plus Plane-like meshes), and `UsdShade` materials.
- Isaac assets use MDL/OmniPBR, so material fidelity is lossy.
- Handle instance proxies (`Usd.TraverseInstanceProxies`), purposes (guide/proxy/render), non-uniform scale, `metersPerUnit` and `upAxis`. Note a fresh USD stage defaults to Y-up and 0.01 m per unit (measured), while Isaac sets Z-up and 1.0.
- Newton has already solved much of this in `newton/_src/usd/utils.py`, `_visuals.py` and `builder.add_usd` (UsdPreviewSurface, OmniPBR/MDL texture lookup, deformables cable/cloth/volume).
- I did not test Isaac traversal APIs against a real Isaac stage (written from knowledge).

**Per-frame state:**
- Isaac Lab 3.0: `asset.data.body_link_pose_w` is `(N,B,7)` `wp.transformf` in xyzw, the actor/link frame, in world coordinates that include env origins (`isaaclab/assets/articulation/base_articulation_data.py:777-1198`).
- The PhysX backend publishes `[m, xyzw]` with `transform_paths` (`isaaclab_physx/physics/physx_manager.py:187+`).
- `scene.get_state(is_relative=True)` subtracts env origins.
- Deformables come through nodal positions.

**Existing paths:**
- RecorderManager writes HDF5 with `initial_state`, `states`, `actions`, `obs`. Its format is robomimic-compatible (`envs/mdp/recorders/recorders.py`).
- Stage Recorder needs Fabric disabled. The OVD recorder bakes PhysX PVD into `baked_animation_recording.usda` (`docs/source/how-to/record_animation.rst`, `AnimationRecorder`).
- `VideoRecorderCfg` writes mp4.
- Livestream is `--livestream {0,1,2}`.
- Isaac Lab 3.0 visualizers: kit, newton, rerun (`record_to_rrd`), viser (`record_to_viser`, `share`) in `source/isaaclab_visualizers`.
- `isaaclab.scene_data.SceneDataProvider` and `SceneDataBackend` give a backend-neutral pose layer with formats Vec3_Quat, Transform, Matrix44 and so on. Viser and Rerun consume a Newton `Model` cloned from the stage via `isaaclab_newton.cloner`.
- BeyondMimic-style `motion.npz` (`body_pos_w`, `body_quat_w`, `joint_pos`, `body_lin_vel_w`, …) is a de facto pose-level interchange in the mjlab/Isaac world (`mjlab/scripts/csv_to_npz.py`).

**Offline-HTML story:** feed poses into Newton `ViewerViser(record_to_viser=...)` or a simscope Viser exporter.

**Adapter:**
```python
IsaacLabRecorder(env, assets=["robot", "cube"]).attach()        # per-step hook, reads body_link_pose_w
scene = usd_adapter.scene_from_stage(stage, body_paths)         # only where pxr exists; or from a saved .usd
```

### 2.4 NVIDIA Newton (newton-physics)

- Version 1.6.0, 2026-09-10 (main is 1.7.0.dev0). Apache-2.0, 5.7k stars. `newton` on PyPI needs only warp-lang, with importers/sim/examples as extras. The `sim` extra pins `mujoco~=3.12`.
- **Interface** (`newton/_src/viewer/viewer.py`, `docs/guide/visualization.rst`):
  - Loop: `set_model(model)`, `begin_frame(t)`, `log_state(state)`, `end_frame()`, `is_running/should_step`, `close`.
  - Abstract logging methods: `log_mesh(name, points, indices, normals, uvs, texture, color, roughness, metallic, dynamic, opacity)`, `log_instances(name, mesh, xforms, scales, colors, materials, opacities)`, `log_lines`, `log_points`, `log_array`, `log_scalar`, `apply_forces`. Non-abstract extras include `log_state`, `log_contacts`, `log_shapes`, `log_geo`, `log_arrows`.
  - Multi-world: `set_visible_worlds` and `set_world_offsets`. Layers add per-layer transforms.
- **Recording:**
  - `ViewerFile` writes `.json` or `.bin` (CBOR2) with the Model plus every Warp array on `State`. It excludes contacts and timestamps and has no per-world capture.
  - `ViewerViser` writes `.viser`.
  - `ViewerUSD` writes time-sampled USD with PointInstancers.
- Geometry types: NONE, PLANE, HFIELD, SPHERE, CAPSULE, ELLIPSOID, CYLINDER, BOX, MESH, CONE, CONVEX_MESH, GAUSSIAN. Newton uses xyzw (`ViewerViser._quats_xyzw_to_wxyz`).
- **Verdict: learn from, do not depend on.** Consider an optional `newton → simscope` adapter.

### 2.5 Others

- **Genesis** (30k stars, Apache-2.0, v1.4.2 2026-09-23). It has a `.gstraj` trajectory format: `Scene.export` (self-contained scene) followed by zstd-compressed chunks (default 64 frames) with per-chunk length and checksum. It is crash-safe, seekable, and has an exact mode versus a compressed mode that recomputes poses (`genesis/recorders/trajectory.py`). Replay needs the Genesis sim. No browser viewer. Worth copying the chunk/checksum/tail design.
- **ManiSkill** (3.4k stars, Apache-2.0, v3.0.1 2026-04-21). `RecordEpisode` writes HDF5 `traj_N/{actions, env_states, obs, ...}` with a JSON sidecar. `env_states` holds per-actor and per-articulation state and is sim-replay based (`docs/source/user_guide/datasets/demos.md`). It renders via SAPIEN and mp4.
- **Drake / Meshcat.** Drake is BSD-3-Clause with 4.2k stars, v1.57.0 2026-09-10, and its wheel is 44 MB. `Meshcat::StaticHtml()` inlines `meshcat.js` and base64 content-addressed assets, with zero CDN (`geometry/meshcat.cc:1923-1980`). Animations use `MeshcatAnimation` and three.js clips, and `MeshcatVisualizer.StartRecording/PublishRecording` feeds it. `meshcat.js` (meshcat-dev/meshcat, MIT, three ^0.176) has a 2.2 MB dist bundle. `meshcat-python` is stale (last push 2024-05, PyPI 0.3.2 from 2021-11). Very relevant precedent.
- **Warp `warp.render`** (OpenGLRenderer, UsdRenderer): still in warp 1.17.0. Newton viewers appear to supersede it (my inference; no deprecation notice found). Ignore.
- **robosuite** (MIT per LICENSE text, GitHub reports NOASSERTION; v1.5.2 2025-12-24). Its demo HDF5 stores `model_file` (XML) plus flattened `states`, and replays through MuJoCo (`scripts/playback_demonstrations_from_hdf5.py`).
- **LocoMuJoCo** (MIT, 1.5k stars, v1.1.0 2026-03-10). `TrajectoryData` holds `qpos, qvel, xpos, xquat, cvel, subtree_com, site_xpos, site_xmat, split_points`, with `TrajectoryInfo` (joint/body/site names, frequency, model subset). Precedent for "MuJoCo state plus body poses in one bundle".
- **LeRobot** (Apache-2.0, 27.9k stars, 0.6.1). Dataset v3 is parquet plus mp4 shards plus JSON/parquet metadata, with no scene geometry. Good template for episode metadata and sharding, not for geometry.
- **dm_control** (Apache-2.0, 1.0.47) has a native viewer and offscreen render. **PyBullet** (zlib, 3.2.7 from 2025-01-30) is stagnant. Specifics of both are UNVERIFIED. Ignore.

## 3. Existing tools table

| Name | URL | License | Stars / last activity | Does | Verdict |
|---|---|---|---|---|---|
| viser 1.1.1 | github.com/viser-project/viser | Apache-2.0 in LICENSE (pyproject says MIT; UNVERIFIED which governs, both permissive) | 2.8k, release 2026-09-15 | Three.js web viewer, batched meshes/GLB, `.viser` recording, `as_html()` offline (measured zero CDN) | **Use as dependency** (pin version; the client must match the serializer) |
| mjviser 0.0.14 | github.com/mujocolab/mjviser | Apache-2.0 | 263, push 2026-08-07 | Batched MuJoCo→viser scene with `update_from_arrays`, contacts, GUI | **Use as dependency or reference** for the MuJoCo path |
| Newton `newton.viewer` | github.com/newton-physics/newton | Apache-2.0 | 5.7k, v1.6.0 2026-09-10 | Backend-agnostic ViewerBase with GL/USD/Rerun/Viser/File/RTX | **Learn from** (heavy warp dependency) |
| IsaacLab 3.0-EA | github.com/isaac-sim/IsaacLab | BSD-3-Clause (repo; PyPI metapackage says NVIDIA Proprietary) | 8.3k, 2026-09-16 | Viser/Rerun/Newton/Kit visualizers, RecorderManager | **Learn from**, adapter target |
| Isaac Sim | github.com/isaac-sim/IsaacSim | Apache-2.0 plus NVIDIA additional license (Kit, assets) | 4.2k, v6.1.0 2026-09-10 | USD-based sim | **Ignore as dependency**; target only |
| MuJoCo 3.14.0 | github.com/google-deepmind/mujoco | Apache-2.0 | 15.4k, 2026-09-22 | Sim, viewer, `usd` exporter, `MjSpec.to_zip`, WASM | **Use as optional dependency** (MuJoCo adapter) |
| MuJoCo WASM `@mujoco/mujoco` | github.com/google-deepmind/mujoco/tree/main/wasm | Apache-2.0 | 3.14.0 2026-09-22 | Official JS bindings, 10.3 MB wasm | **Learn from** (viable, MuJoCo-only) |
| zalo/mujoco_wasm | github.com/zalo/mujoco_wasm | MIT | 482, 2026-08-23 | three.js demo (unpkg CDN) | **Learn from** |
| MuJoCo Warp | github.com/google-deepmind/mujoco_warp | Apache-2.0 | 1.5k, v3.14.0 2026-09-22 | Batched GPU MuJoCo, `mjwarp-record`, viewer via mjviser | **Optional adapter target** |
| MJX (in mujoco repo) | `mjx/` | Apache-2.0 | (same as mujoco) | JAX MuJoCo | **Optional adapter target** |
| MuJoCo Playground | github.com/google-deepmind/mujoco_playground | Apache-2.0 | 2.2k, v0.2.0 2026-03-16 | Envs; render by qpos replay to mp4 | **Learn from** |
| mjlab | github.com/mujocolab/mjlab | Apache-2.0 | 3.2k, v1.6.0 2026-08-09 | Isaac-Lab-like on MuJoCo Warp; viser viewer; `motion.npz` | **Learn from** |
| mujoco-usd-converter | github.com/newton-physics/mujoco-usd-converter | Apache-2.0 | 75, v0.6.1 2026-09-29 | MJCF→USD (alpha; pins mujoco<3.13) | **Ignore** (input-side, conflicts) |
| Brax `io.html` | github.com/google/brax | Apache-2.0 | 3.2k, v0.14.2 2026-03-15 | Inline JSON+pako page, 5 CDN deps, three r150 | **Learn from** (the format; CDN is the anti-pattern) |
| Drake Meshcat | github.com/RobotLocomotion/drake | BSD-3-Clause | 4.2k, v1.57.0 | Recording + `StaticHtml()` offline | **Learn from** |
| meshcat.js / meshcat-python | github.com/meshcat-dev/meshcat, /meshcat-python | MIT | 340 (push 2026-06-25) / 302 (push 2024-05) | Web viewer bundle / stale Python client | **Learn from** / **ignore** |
| Genesis | github.com/Genesis-Embodied-AI/Genesis | Apache-2.0 | 30k, v1.4.2 2026-09-23 | `.gstraj` chunked trajectory, `Scene.export` | **Learn from** (file design) |
| ManiSkill | github.com/haosulab/ManiSkill | Apache-2.0 | 3.4k, v3.0.1 2026-04-21 | HDF5 state trajectories, SAPIEN | **Learn from** |
| LocoMuJoCo | github.com/robfiras/loco-mujoco | MIT | 1.5k, v1.1.0 | Trajectory dataclasses | **Learn from** |
| LeRobot | github.com/huggingface/lerobot | Apache-2.0 | 27.9k, 0.6.1 | Parquet+mp4 episode dataset | **Learn from** (episode metadata only) |
| robosuite | github.com/ARISE-Initiative/robosuite | MIT (LICENSE text; GitHub NOASSERTION) | 2.6k, v1.5.2 | HDF5 states + XML | **Ignore** |
| robot_descriptions / Menagerie | github.com/robot-descriptions/robot_descriptions.py, github.com/google-deepmind/mujoco_menagerie | Apache-2.0 / per-model (BSD/Apache/…) | 833 / 4.1k | Robot model sources | **Use as test fixtures** |
| usd-core 26.8 | pypi.org/project/usd-core | LicenseRef-TOST-1.0 | 30–41 MB wheels, Python <3.15 | pxr bindings | **Optional dependency** (USD adapter only) |
| trimesh 5.1.0 | pypi.org/project/trimesh | MIT | (PyPI 2026-08-31) | Mesh IO, GLB export, PBR materials | **Use as optional dependency** |
| Rerun | github.com/rerun-io/rerun | MIT OR Apache-2.0 | 11.5k, v0.38.1 2026-09-16 | `.rrd`, web viewer; Isaac Lab and Newton backend | Out of my track; offline single-file HTML export UNVERIFIED |
| Warp `warp.render`, PyBullet, dm_control | github.com/NVIDIA/warp, /bulletphysics/bullet3, /google-deepmind/dm_control | Apache-2.0 / zlib / Apache-2.0 | active / stale (2025-01) / active | Legacy renderers / native viewers | **Ignore** |

## 4. Proposed canonical data model

**Header conventions (explicit, per rollout):** Z-up, right-handed, metres, seconds. `quat_order` is stored in the header and canonical quaternion order is xyzw (glTF, three.js, Warp/Newton, PhysX and Isaac Lab 3.0 are native; MuJoCo family and the viser API are wxyz and are converted in the adapter). This is a judgement call. Add golden tests with asymmetric quaternions per adapter.

**Scene** (content-addressed, immutable, shared by many rollouts):
- `frame`: up axis, unit scale.
- `bodies[]`: id, name/path, parent (-1 = world), kind (static, dynamic, mocap).
- `geoms[]`: id, body_id, kind ∈ {box, sphere, capsule, cylinder, ellipsoid, cone, plane, hfield, mesh}, `size[3]`, non-uniform `scale[3]`, `local_pos`, `local_quat`, `material_id`, `mesh_id`, `role` flags (visual, collision), `group`. Newton's GeoType list is the reference; the `.rbundle` set plus `cone` and `hfield`.
- `materials[]`: rgba, metallic, roughness, emissive, albedo/normal texture refs, double-sided.
- `meshes[]`: content-hashed blobs (verts f32 or q16, tri indices, optional normals and UVs), stored once per hash. `textures[]`: PNG/JPEG blobs.
- `cameras[]`, `lights[]`: static, parented to bodies.
- `deformables[]`: reserved. Topology is static and vertex positions live in a per-frame stream. Out of scope for v1 (MuJoCo flex/skin, Isaac nodal positions, Newton particles/tets).

**Trajectory** (per rollout folder):
- `time`: `t0`, `dt` or `f64[T]`.
- `body_pose`: `f32[T, E, B, 7]` (position xyz, quaternion xyzw), chunked along T with zstd (64 frames like `.gstraj`), append-safe with a checksummed tail index.
- `env_origin`: `[E,3]`. Isaac world poses already include origins, while MJX/Warp envs overlap and need viewer offsets (Newton `set_world_offsets`).
- `scene_ref`: one hash, or `[E]` hashes for domain-randomised variants (MJX and MJWarp support per-world model params).
- Optional streams, each self-describing:
  - `qpos`, `qvel` (MuJoCo replay sidecar)
  - `body_vel`
  - `forces[T,E,B,3]`
  - `predictions` (ghost poses, as in `.rbundle`)
  - `scalars` (reward and the like)
  - `camera_pose`
  - ragged `contacts` (pos, normal, force, body_a, body_b)
  - generic markers (points, lines, arrows), following Newton's `log_*`.

**Annotations** live in a separate sidecar file so tagging never rewrites bulk data: favorite, tags, rating, and time-range notes.

**Lossiness per sim:**
- MuJoCo family:
  - Textures and cubemaps are approximated.
  - `mjvScene` decor (contacts and so on) is dropped unless recorded as streams.
  - Per-env model params force scene variants.
  - Flex and skin are out of scope.
  - Body frame versus inertial frame: use the body frame (`xpos`), not `xipos`.
- Isaac / USD:
  - MDL materials collapse to constants or textures.
  - Instancing, PointInstancers and purposes need flattening.
  - Non-uniform prim scale needs `Geom.scale`.
  - `metersPerUnit` and `upAxis` are per stage.
  - Link (actor) frame versus COM frame: use the link frame.
  - Deformable and particle assets are out of scope.
  - Cameras and lights come only from USD.

## 5. Risks

- **Quaternion and axis conventions** are the top bug source: MuJoCo, MJX, MuJoCo Warp, viser API and USD's Python constructor use wxyz; Warp, Newton, PhysX, glTF, three.js and Isaac Lab 3.0 use xyzw; Isaac Lab 2.x uses wxyz. `metersPerUnit` (0.01 default for a new USD stage, measured) and up axis are further traps.
- **Isaac install weight and license:** `isaacsim` is a proprietary metapackage pinned to Python 3.12. The exact multi-GB install size is UNVERIFIED. Isaac Lab 3.0 is still EA, while pip `isaaclab` 2.3.2.post1 targets Python 3.11.
- **Version pinning collisions:** `newton[sim]` pins `mujoco~=3.12`; `newton` docs/notebook extras pin `viser==1.0.26`; `mujoco-usd-converter` pins `mujoco<3.13`; Isaac Lab pins `warp-lang==1.17.0`. Keep adapters in separate optional extras and do not import Newton in the core.
- **USD dependency:** the usd-core wheel is 30–41 MB, with Python <3.15 and a TOST-1.0 license. `.usdc` is 1.86x raw in my test. Keep USD out of the core.
- **Viser coupling:** `.viser` is version-locked to the client, playback needs the whole recording in memory, and backward scrubbing replays from t=0 (`FilePlayback.tsx:226-231`, code-verified, performance not measured). Batched runs with thousands of envs need env subsampling.
- **Embedded-client duplication:** each `as_html()` file carries 818 KB of client. A 10-rollout reveal.js deck would carry about 8 MB of client copies, or use lazy iframes.
- **Mesh volume and materials:** G1 alone is 7.1 MB raw of meshes. The default should be dedup plus optional u16 quantisation or decimation on export.
- **Quantised poses** are lossy (about 1e-5 of the per-body range) and should be opt-in.
- **MuJoCo WASM embedding:** compiled 10.3 MB, so a single file is about 3.4 MB base64 of gzip. Mesh-asset loading through Emscripten FS and the multi-threaded build's COOP/COEP requirements are UNVERIFIED for the embedded case.
- **Not verified:**
  - Isaac USD traversal APIs on a live Isaac stage.
  - Rerun offline HTML.
  - SAPIEN, PyBullet, dm_control specifics.
  - `live.mujoco.org` source.
  - Which of viser's Apache-2.0 LICENSE and MIT pyproject metadata governs.
  - glTF animation sizes (I did not build a GLB).
  - Brax JS history before 2023.

**Suggested next step:** prototype a `simscope` writer with the folder format above plus a Viser exporter. Then benchmark against the measured numbers here: `.viser` 0.9–1.75x raw, lossless shuffle-zstd 0.63–0.78x, q16+zstd 0.37–0.5x.
