# simscope frontend: architecture and scale review of D16

Date: 2026-09-30. Reviewer brief: `review_architecture.md` (scratchpad).
Scope: proposed D16 (own React + shadcn/Tailwind frontend around the existing
three.js player; Python becomes a small HTTP + WebSocket server; the exported
HTML is the same app with an embedded pack; viser removed).

Status: Complete, 2026-09-30.

Method: I read the proposal and decision log, the format spec, the viewer UI
v2 spec, the research reports, all of `player/src/*.js`, the Python backbone
(`library.py`, `index.py`, `export.py`, `io/blockfile.py`), and the
artifacts-server viewer spec and `app.js`. Scale numbers are computed from the
byte layouts in `docs/specs/2026-09-30-simscope-format-v1.md` and the code
paths in `player/src/{format,player,scene}.js`. Dependency facts come from the
npm registry, PyPI JSON, GitHub API and bundlephobia, retrieved 2026-09-30,
with URLs inline.

Measurements I ran myself are labelled **measured**. They were run in Node
26.7 (V8, the same JS engine as Chrome) on this machine, in
`scratchpad/archreview/`, using the repo's own `player/src/format.js`,
`player/src/scene.js` and `player/test/encoder.mjs` on synthetic motion. No
server was started and nothing in the repo was changed apart from this file.
Browser timings will differ; the shape of the numbers will not.

## 1. Verdict

**Agree with changes.** Moving the live viewer off viser is right. The two
complaints that drive it cannot be fixed inside viser: viser 1.1.1 has no
orthographic camera, and follow has to round-trip through Python. The move
also pays for itself in lines of code. It deletes about 11.6k lines of Python
(6,633 in `src/simscope/viewer/`, 4,336 in `tests/viewer/`, 611 in
`benchmarks/bench_viewer.py`). It also drops viser and the eight direct
dependencies it brings beyond numpy (imageio, msgspec, requests, rich, tqdm,
trimesh, websockets, zstandard; <https://pypi.org/pypi/viser/json>), plus
their transitive ones (pillow, pygments, urllib3, and others). In their place we own about 6.6k lines of TS/JS (2.2k already exist in
`player/src`, and about 1k is shadcn-generated), plus about 1.3k lines of
Python (§4). I would ship D16 with
six changes:

1. **Two shells over one player core, not "one app everywhere".** The deck
   element stays lean and vanilla, at about 165 KB gz. The React app shell
   comes to about 380 KB gz and is used by `simscope serve` and by full
   standalone exports. mkdeck must never load React, and never an iframe per
   player.
2. **The server is a byte server, not a frame server.** It passes compressed
   blocks and CAS assets through as they are on disk. The browser owns the
   clock, the camera, and decoding (in a Web Worker). That is what makes
   follow smooth.
3. **No WebSocket.** Live tail is a 1 s poll of `/api/changes?since=N`.
   D14 already sets live latency at one block, 2 s by default. SSE hits the
   browser's 6-connection-per-host limit over HTTP/1.1.
4. **Scale is a data-tier problem first.** Past about 64 envs the viewer
   splits into a *focus* tier (full detail, at most about 16 envs) and a
   *crowd* tier (one proxy per env, drawn from a server-derived root-pose
   stream). The current player would try to decode 229 MB per window at
   4,096 envs (§2).
5. **Highlights, per-env summaries and envelopes are computed once, in
   Python/numpy, and cached.** They are baked into packs for export. There
   is no second JS implementation to drift.
6. **Fewer tools.** Keep esbuild and drop Vite. Keep `node --test` and drop
   Vitest. Run Playwright from pytest. Skip react-three-fiber and drei.

**The strongest argument against D16 that I could not refute:** it
permanently adds a second codebase (TypeScript, React, Tailwind, a Node
toolchain, a committed minified bundle) to a Python library that one person
maintains. No choice of dependency removes that cost. shadcn in particular is
not a dependency but copied-in source that we own. The only mitigation is
cutting scope hard: no manual annotation UI, no drag editing, no docking
system, no command palette, no multi-user. A second-order point: the move
does *not* by itself fix the scale problem. A React UI over today's player
would still stutter at 4,096 envs and still judder in follow at 50 Hz data on
a 60 Hz display (§2.6). Most of the real work is in the player core and the
server's derived data, not in the UI.

## 2. Scale analysis

### 2.1 What the player does today (from the code)

These points are read from `player/src/*.js`:

- **Instancing: yes, per geom bucket, across bodies and envs.**
  `scene.js` makes one `InstancedMesh` per (role, geometry, material) with
  `E * n` instances. Draw calls equal the number of buckets, about the
  number of distinct geoms, and do not grow with E. Per frame, `apply()`
  composes `E*B` body transforms and `E*G` instance matrices in JS, then
  re-uploads the whole `instanceMatrix`.
- **Two paths are not instanced.**
  - `createPolylineLayer` makes **one `Line` per env** (`overlays.js`). At
    4,096 envs that is 4,096 draw calls and 4,096 buffer uploads per frame.
  - Planes get one `LineSegments` per env, capped at 16
    (`MAX_PLANE_ENVS`), which is fine.
- **Windowing.** A window is one block per env (100 frames).
  `WindowedStream.request()` decodes *all envs* of a window at once with
  `Promise.all`, and `_prefetch` keeps windows `w-1, w, w+1`. Inflate goes
  through `DecompressionStream`. The unshuffle, prefix-sum and dequantize
  loops run **synchronously on the main thread**.
- **Pack loading.** `element.js` fetches or base64-decodes the **whole pack**
  into one `ArrayBuffer`. There is no way to load an env subset or a window
  on demand over HTTP.
- **Clock.** `frameAt()` floors, so there is **no pose interpolation**.
  Follow uses **env 0 only** (`_follow(arrs[0], ...)`) and moves target and
  camera by the raw per-frame delta of the chosen body.
- **Camera.** A fixed `CAMERA_DISTANCE = 100` with `far = 400`. An infinite
  grid is 30 m half-size, re-centred on the target.
- **Meshes.** Decoded on the main thread at load, and `computeNormals` runs
  there too for q16 meshes. Each player builds its own GPU geometries, so
  there is no page-level cache across players.

### 2.2 Unit costs (measured, Node 26 / V8)

One window = 100 frames x E envs x 20 bodies (K = 140 floats per env per
frame), with 30 primitive geoms per env:

| E | decoded f32 per window | q16d bytes (synthetic) | decode 1 window, all envs (q16d / f32s) | `apply()` per frame | instance upload per frame |
| --- | --- | --- | --- | --- | --- |
| 1 | 56 KB | 14 KB | ~1 ms | ~0 ms | 2 KB |
| 64 | 3.6 MB | 0.87 MB | 22 / 10 ms | 0.03 ms | 0.12 MB |
| 256 | 14.3 MB | 3.5 MB | 43 / 26 ms | 0.12 ms | 0.49 MB |
| 1,024 | 57 MB | 13.9 MB | 108 / 101 ms | 0.55 ms | 2.0 MB |
| 4,096 | **229 MB** | 55 MB | **394 / 448 ms** | 2.3 ms | **7.9 MB** |

- The per-block floor is **0.13–0.18 ms** when blocks are decoded one after
  another. For small blocks `DecompressionStream` setup dominates, so
  per-block cost, not per-byte cost, sets the limit at large E.
- The synthetic data compresses better than real data. For sizes below I
  use the measured ratios from the proposal instead: `q16d` 0.19–0.32x raw,
  `f32s` 0.49–0.69x raw.
- Decode *time* is roughly independent of compressibility, because the JS
  loops touch every float.

### 2.3 The five scenarios

**(a) 1 env x 400 frames x 14 bodies** (K = 98)

- Poses raw: 400 x 98 x 4 = 157 KB. On disk: `q16d` 30–50 KB, `f32s`
  77–108 KB. 4 blocks, a 128 B directory.
- Decode everything: about 1 ms. Decoded memory: 157 KB.
- Draw calls: one per geom bucket (tens). Triangles: whatever the robot has.
- **Do: load the whole run, no windowing.** Export size is the runtime plus
  meshes plus about 50 KB.

**(b) 4,096 envs x 1,000 frames x 20 bodies** (K = 140)

- Poses raw: 1,000 x 4,096 x 140 x 4 = **2.29 GB**. On disk: `f32s` (the
  archive the server holds) 1.12–1.58 GB. As `q16d`: 436–734 MB.
- Blocks: 10 windows x 4,096 = 40,960 blocks, so a **1.31 MB directory**,
  parsed into 40,960 JS objects.
- Today's player at this size:
  - fetches the whole pack (0.4–1.6 GB) into one buffer;
  - decodes 229 MB per window in about 0.4 s of main-thread work, which is
    a 24-frame stall every 2 s of sim time (dt = 0.02);
  - holds 3 windows, which is **688 MB** of decoded poses before overlays;
  - issues 4,096 concurrent `DecompressionStream`s per window.

  It does not work.
- Rendering is a second, independent wall:
  - With 30 primitive geoms of about 600 triangles each (capsule(8,16),
    sphere(24,16) = 768), a robot is about 18k triangles. 4,096 of them is
    **74M triangles per frame**.
  - With G1 meshes (393,270 faces, `docs/research/simulators.md`) it would
    be **1.6G triangles per frame**.
  - A laptop GPU budget at 60 fps is on the order of 5–20M triangles per
    frame. That is my estimate, not a measurement.
- Instancing keeps draw calls flat, but it does nothing for triangles or
  upload bandwidth: 7.9 MB x 60 fps = 470 MB/s.
- **Export:** impossible as a single file. Chrome caps a string at
  536,870,888 chars (html-export research), so base64 caps the pack at
  about 400 MB. `export.py` has no env subsetting today, so that must be
  added.

**(c) 10k-frame single runs** (G1, 31 bodies, K = 217)

- Poses raw: 10,000 x 217 x 4 = 8.7 MB (14 bodies: 3.9 MB). On disk:
  `q16d` 1.6–2.8 MB, `f32s` 4.3–6.0 MB. 100 blocks, a 3.2 KB directory.
- Decode everything: about 100 blocks x 0.2 ms plus loops, **under 50 ms**,
  and 8.7 MB in memory.
- **Do: load it all.** Windowing only earns its keep when E x T x K is
  large.
- The real issues are UI ones:
  - 10k frames on a 1,200 px timeline is 8 frames per pixel, so the
    timeline needs frame-step keys and a zoomable range.
  - Plots need min/max-per-pixel decimation when many series are shown.
  - Highlight icons need clustering, at most one per about 6 px.

**(d) A library of 2,000 runs**

- `RunInfo` has 16 fields (`index.py`), about 350 B as JSON (a 64-char
  scene hash and a 26-char ULID dominate). 2,000 rows is about 700 KB raw,
  about 120 KB gzip. 5,000 rows is about 1.75 MB raw.
- The index builds 5,000 runs in 0.13 s (proposal).
- **Do:** one `GET /api/runs` that returns every row with an ETag. Filter
  and sort in the browser (under 5 ms for 5k rows). Render with TanStack
  Virtual, about 30 DOM rows.
- No server pagination is needed below about 20k runs. Drop `scene_hash`
  from list rows.
- Scenes and assets are content-addressed, so serve them with
  `Cache-Control: immutable`. Switching between runs of the same robot then
  re-downloads nothing. The CAS gives us that for free.

**(e) A CAD run with 30 MB of meshes**

- Scaling the crate scene (22.6 MB raw = 625,835 verts and 1,255,264
  faces) gives 30 MB of about **830k verts and 1.67M triangles**.
- Library storage is codec 0 deflate-raw, about 0.49x (gzip -9 on the
  crate), so **about 15 MB on the wire** from localhost.
- In the browser: inflate about 55 ms at 550 MB/s, normals about 50 ms if
  absent, and about 40 MB of GPU buffers.
- On export, q16 gives 0.135x (crate: 22.6 to 3.04 MB), so **about 4 MB**,
  or 5.4 MB as base64. It is shared by every run in the pack through the
  CAS.
- Rendering: 1.67M triangles per env. That means **at most 2–3 envs at full
  detail** under a 5M-triangle budget, and proxies for the rest.
- Mesh decode must move off the main thread, because today it freezes the
  page for about 100–200 ms at load.

### 2.4 What must be windowed or streamed, and what can load whole

| Data | Load whole when | Otherwise |
| --- | --- | --- |
| `body_pose` | E x T x K x 4 B ≤ 64 MB decoded (for example E ≤ 16 at 10k frames x 31 bodies, or E ≤ 64 at 1k frames x 20 bodies) | Focus envs: window by window, env-subset requests. Crowd: derived root stream (§2.5) |
| scalar and vector streams | Always for the selected env. [T, E] for E = 4,096, T = 1,000 is 16 MB raw per scalar | Envelopes (p5/p50/p95 across envs, [3, T]) come from the server |
| arrows, contacts, polylines | Focus envs only | Never for the crowd |
| meshes and textures | Always, since they are shared and immutable | Proxies for crowd envs |
| index rows | Always (≤ 20k runs) | Server pagination only past about 20k |
| block directories | Small E | At large E the client never sees the directory: the server selects blocks |

### 2.5 Staying at 60 fps at 4,096 envs: concrete design

**Budgets per frame:**
- ≤ 4 ms of main-thread JS
- ≤ 2 MB of GPU upload
- ≤ 5M triangles (configurable)
- no main-thread decode
- ≤ 256 MB of decoded data held (an LRU by bytes, not "3 windows")

**Two tiers, switched on automatically when E > 64:**

1. **Focus tier (F):**
   - Membership: the selected env, up to 4 pinned envs, and nearest
     neighbours added until the triangle budget is used (G1: about 12 envs;
     CAD: 2–3).
   - Rendering: full geoms, collision toggle, contacts and arrows, pose
     interpolation, follow.
   - Data: `GET /api/runs/{run}/streams/body_pose/windows/{w}?envs=17,18,...`
     returns the raw SSBB blocks for those envs only. The server slices
     them out of the mmap with no decode (`BlockReader` already has the
     directory).
   - Cost: 56 KB decoded per env per window, so 16 envs is 0.9 MB. Decode
     is about 3 ms, in the worker.
2. **Crowd tier (C):**
   - Rendering: every env gets **one proxy**, a unit capsule or box scaled
     to the robot's frame-0 bounding box and posed by the root body. That
     is one `InstancedMesh`, 4,096 instances, one draw call, about 2.4M
     triangles at 576 each (or 49k with a 12-triangle box), and 262 KB of
     upload per frame.
   - Colour: `instanceColor` by a per-env scalar at time t (reward, "fell",
     contact force). This is the view that makes 4,096 envs readable at a
     glance.
   - Data: a **server-derived overview stream** `[T, E, 1, 7]` (root pose)
     in the same block format, cached in `.simscope/derived/<run>/`. Size
     for this run: 115 MB raw, 22–37 MB as `q16d`, and 11.5 MB decoded per
     window. Deriving it means one pass over the `f32s` archive (about
     1.1–1.6 GB compressed). I estimate 5–15 s of numpy in a background
     thread, once per run, reported through `/api/changes`.
   - Alternative: the recorder writes the stream for free, since it has
     `[E, B, 7]` in hand. That is a format convention decision, so defer it.
     Deriving needs no format change, and `.simscope/` is already the
     derived cache.
   - Draw the focus envs' proxies hidden (or the full envs over them) so the
     two tiers never double-draw.
3. **Everything else:**
   - Decode in **one Web Worker** (`DecompressionStream` is available in
     workers). Transfer `ArrayBuffer`s back, cap concurrency at about 8
     streams, and prefetch w+1 only for the focus tier.
   - Fix the polyline layer: one `LineSegments` with all envs in one buffer,
     focus tier only.
   - Pick envs with a CPU ray-to-sphere test against the 4,096 root
     positions (about 0.1 ms). Do not use `Raycaster` on the instanced
     meshes, because three's `InstancedMesh.raycast` tests every instance's
     triangles.
   - Shadows off in crowd mode.

### 2.6 What "follow", "plot", "contacts" and "highlights" mean with thousands of envs

- **Follow** means following the *selected env's* follow body (torso, base,
  or pelvis, as today, but no longer env 0 only). It needs three things to
  be smooth, and viser lacked all three:
  1. **Pose interpolation at render time.** Lerp positions and nlerp
     quaternions between frames `floor(t/dt)` and `+1`, for the focus tier
     only. At dt = 0.02 (50 Hz) on a 60 Hz display, flooring repeats 10
     frames per second. When the camera is locked to the robot, the whole
     world visibly stutters. Interpolation is about 60 lines of code.
  2. **A damped camera target.** Critically damped smoothing (SmoothDamp,
     which camera-controls implements through `smoothTime`) of the
     *interpolated* follow point. By default only x and y are followed, and
     z is held at its frame-0 height, so gait bob does not shake the view.
  3. **User orbit kept as an offset.** Follow moves target and camera
     together (as `_follow` does now). A user drag pauses follow for about
     300 ms, not forever.
- **Frame all** switches follow off and fits the ortho `scale` to the
  bounding box of all env roots at the current frame.
- **Env picker:**
  - click in the viewport (ray-to-sphere);
  - `[` and `]` for previous and next env in the current sort;
  - a virtualized env list in the right sidebar, sortable by server-computed
    per-env summaries: return, min root z ("fell"), peak contact force,
    peak root acceleration, number of highlights. For [T, E] = [1000, 4096]
    these are computed in numpy in milliseconds from scalar streams, and
    from the overview stream for root-derived ones.
- **Plot:**
  - the selected env's series as a line;
  - the **p5–p95 band plus the median across envs** as uPlot bands, from
    `GET /api/runs/{run}/envelope?stream=reward`, which returns [3, T]
    floats (12 KB for T = 1,000);
  - at most 8 pinned envs as extra lines;
  - never 4,096 lines.
  - The playhead is a CSS-transformed overlay positioned with
    `u.valToPos(t)`, with no redraw per frame. The viewer UI v2 spec
    concluded "playhead as text" only because viser's `add_uplot` resends
    the data.
- **Contacts: the recorder records none today** (`grep -i contact` finds
  nothing in `mujoco.py`, `isaaclab.py` or `recorder.py`). The frontend
  cannot show what is not stored, so this is adapter work first.
  - Record contacts as an `arrows` stream `[K, 6]`, which the format
    already has, with zero padding. The arrow layer already hides
    zero-length arrows.
  - Isaac: per-body net contact force, K = B.
  - MuJoCo: K = the max contacts per env.
  - Zeros deflate to almost nothing, so a sparse contact stream is cheap
    even at 4,096 envs.
  - The viewer draws contacts for the focus tier only: instanced points
    plus arrows, with a toggle.
- **Highlights:** Python computes them once per run into
  `.simscope/derived/<run>/highlights.json`, and export bakes them into the
  pack as `runs/<name>/highlights.json`. That is a minor pack-format
  addition, one optional entry.
  - Signals: contact-force magnitude, body acceleration from second
    differences of positions (`q16d` noise is about
    15 µm / dt² ≈ 0.04 m/s², negligible), torque from streams whose label
    or units say so, and root-height drops.
  - Detector: robust z-score `(x - median) / (1.4826 · MAD)` > 6, then a
    local maximum within ±0.25 s (`sliding_window_view(...).max`), fully
    vectorized over [T, E] with no scipy. Keep the top 10 per env per
    signal and the top 50 across envs.
  - The timeline shows the selected env's highlights plus an "all envs"
    lane. Clicking one selects its env and seeks.

## 3. Dependency proposal

### 3.1 Sources and method

- Versions, dates and licences: `https://registry.npmjs.org/<pkg>` and
  `https://pypi.org/pypi/<pkg>/json`.
- Stars, open issues and last push: `https://api.github.com/repos/<repo>`.
- Top contributors: `https://api.github.com/repos/<repo>/contributors`.
- Bundle sizes are **measured** with esbuild 0.28.2 (`--bundle --minify`,
  production `NODE_ENV`), gzip -9, and importing only what we would use.
  bundlephobia (`https://bundlephobia.com/api/size?package=...`) is quoted
  where noted.
- Everything was retrieved on 2026-09-30.

### 3.2 Frontend: recommended set

| Package | Use | Version (date) | Licence | Size (min / gz) | Maintenance | What we own on top |
| --- | --- | --- | --- | --- | --- | --- |
| **three** | renderer, geometry, instancing | 0.186.1 (2026-09-24); we pin 0.150.1 today | MIT | player-like subset: r186 547 KB / **136 KB**; r150 450 KB / 115 KB | 116k stars, 380 open issues, pushed today, monthly releases | scene building, instancing, overlays, ground shader, LOD tiers |
| **camera-controls** | orbit, pan, ortho zoom, SmoothDamp transitions, `fitToBox`, `updateCameraUp()` for z-up | 3.1.2 (2025-11-17); peer `three >=0.126.1` | MIT | 45 KB / **10 KB** | 2.4k stars, 102 open issues, pushed 2026-09-09. **Bus factor 1** (yomotsu has 779 commits; the next contributor has 21) | follow logic, presets, compare sync. It is small and MIT, so it can be vendored if abandoned |
| **react** + **react-dom** | UI shell | 19.3.0 (2026-09-09) | MIT | 223 KB / **69 KB** (`react-dom/client` plus a component) | 251k stars, Meta | nothing |
| **radix-ui** (through shadcn) | accessible primitives: Slider, Tooltip, DropdownMenu, Dialog, Tabs, Toggle(Group), Popover, Select, Switch, Separator | 1.6.7 (2026-07-24) | MIT | those 12 primitives: +**52 KB gz** over React | 19k stars, 362 open issues, last commit 2026-07-31 (WorkOS) | nothing. The shadcn wrappers are copied source (below) |
| **tailwindcss** (+ `@tailwindcss/cli`) | build-time CSS | 4.3.3 (2026-07-16) | MIT | runtime 0. Output CSS is about 10 KB gz (estimate) | 98k stars, 88 open issues | theme tokens |
| **shadcn** (CLI, not a dependency) | generates component source into our tree | 4.21.0 (2026-09-04) | MIT | 0 | 125k stars, 1,821 open issues | **all of the generated TSX** (about 1k lines for 12 components). Run with `npx shadcn@4.21.0 add ...`; not in `package.json` |
| clsx, tailwind-merge, class-variance-authority | shadcn helpers | 2.1.1 / 3.7.0 / 0.7.1 (cva last released 2024-11) | MIT / MIT / Apache-2.0 | about 3 KB gz together | cva is stale but tiny and finished | nothing |
| **lucide-react** | icons (tree-shaken) | 1.49.0 (2026-09-29) | ISC | 24 icons: **4 KB gz** marginal (measured) | active | nothing |
| **react-resizable-panels** | resizable, collapsible left, right and bottom panels (shadcn "Resizable") | 4.14.1 (2026-09-27) | MIT | **19 KB gz** marginal over React (measured) | 5.4k stars, 0 open issues. Bus factor 1 (bvaughn) | layout persistence |
| **@tanstack/react-virtual** | run list (2k–20k rows), env list (4,096 rows) | 3.14.13 (2026-09-14) | MIT | **7.5 KB gz** marginal (measured) | 7.1k stars, 119 open issues, two active maintainers | row renderers |
| **zustand** | UI state (selection, filters, layout, theme) | 5.0.15 (2026-08-13) | MIT | **0.4 KB gz** marginal (measured) | 59k stars, 7 open issues | store shape. The clock and camera stay *outside* React state (§4) |
| **uplot** | plots, 60 fps playhead overlay, bands | 1.6.32 (2025-03-14) | MIT | 52 KB / **23 KB** | 10.5k stars, 134 open issues, pushed 2026-09-28, but no npm release in 18 months. **Bus factor 1** (leeoniya 1,514 commits). viser bundles it too | plot panel, playhead overlay, decimation |
| **esbuild** | the only bundler: TSX, CSS import, deterministic IIFE, `--watch --serve` for dev | 0.28.2 (2026-08-08), already pinned | MIT | build only | 40k stars. **Bus factor 1** (evanw 4,278 commits) | `build.mjs` (two entries) |
| **typescript** | `tsc --noEmit` in CI | current | Apache-2.0 | build only | Microsoft | nothing |

**Measured totals, all of the above tree-shaken together:**

- **1,132 KB min / 322 KB gz / 429 KB as base64(gz)** without our own code.
- Our code (about 6k lines) and the CSS add roughly 50–70 KB gz, so the
  **full app is about 380 KB gz**.
- The lean deck player (three r186, camera-controls, our core, no React) is
  about **165 KB gz**, against 133 KB gz today (`src/simscope/_assets/`
  measured: 499,812 B min / 132,871 B gz).

### 3.3 Frontend: evaluated and rejected

| Candidate | Finding | Decision |
| --- | --- | --- |
| three r150 (stay) | Works today. But it is 36 releases behind. r152 changed colour management to `SRGBColorSpace` by default, and r155 made physically-correct lights the default (https://github.com/mrdoob/three.js/wiki/Migration-Guide). Every new renderer feature (ground shader, contacts, proxies) written against r150 would have to be ported later. The move costs +21 KB gz | **Upgrade once, in migration phase 1, behind a screenshot diff.** Then pin, and bump deliberately about twice a year |
| OrbitControls | 4.4 KB gz. It captures `camera.up` only in its constructor (the r150 workaround in `player.js::_makeControls`). It has no smoothing or transitions, so we would own SmoothDamp, preset tweens and fit-to-box (about 150 lines) | Fallback if camera-controls dies |
| @react-three/fiber | 9.8.1, 57 KB gz, peer `three >=0.156`. It assumes one `<Canvas>` = one WebGL context and React-driven scene graphs. Our scene is imperative typed-array writes into `instanceMatrix`, and the deck element must run without React. Two renderers would follow | **Reject** |
| @react-three/drei | 10.7.9, 520 KB gz full per bundlephobia, 21 dependencies | **Reject** (camera-controls is what drei wraps anyway) |
| Preact 11.0.0 | 7 KB gz with compat, which would save about 62 KB gz. Radix and shadcn target React, and compat bugs would be ours | Reject for the app shell. The lean player needs no framework at all |
| Solid 1.9.15 | 8 KB gz, 36k stars. No first-party shadcn, and a smaller ecosystem | Reject |
| Base UI (`@base-ui/react` 1.8.0) | shadcn's default since July 2026 (https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default). Measured +88 KB gz for the same 12 components, against +52 KB gz for Radix. 11k stars, very active | Acceptable. **Prefer Radix** (`shadcn init -b radix`) for size and install base, and revisit at v2 |
| Plotly (`plotly.js-dist-min` 4.1.1) | 4.6 MB min / **1.4 MB gz**. artifacts-server uses it lazily | **Reject** (it would triple the export) |
| Chart.js 4.5.1 | 68 KB gz, canvas-based, slower on large series, no bands without plugins | Reject |
| lightweight-charts 5.2.1 | 62 KB gz, Apache-2.0. Its time axis is built for finance, and seconds-since-start fits badly | Reject |
| Vite 8.3.1 | Now Rolldown-based, which replaced esbuild and Rollup (https://vite.dev/blog/announcing-vite8-beta). Fast refresh is nice, but it is a second bundler with a young core and its own determinism story | **Reject.** esbuild `--watch` plus live reload, served *by simscope's own server* in dev mode, is enough, and there is no dev proxy to configure |
| vite-plugin-singlefile 2.3.3 | Only needed with Vite | Reject |
| Vitest 5.0.3 | 13 dependencies. The core is framework-free, Node 26 strips TS types natively (`process.features.typescript === "strip"`), and `node --test` already runs the format goldens | **Reject.** Keep `node --test` for units |
| cmdk, sonner, docking libraries | Not required | **Cut** |
| meshoptimizer 1.3.0 (simplifier) | MIT, 8.5k stars, 5 open issues. Could make true decimated LODs | Not now. Frame-0 bounding-box proxies are enough (§2.5) |

### 3.4 Python server

| Option | Facts | Decision |
| --- | --- | --- |
| stdlib `http.server.ThreadingHTTPServer` | 0 dependencies. **No Range support**: the source of `http/server.py` in the project's Python 3.12.13 has no occurrence of "Range". The docs warn it is not for production. We would own routing, Range, ETag, streaming and a test client | Reject. Owning Range parsing is exactly the wrong kind of ownership: Starlette's changelog shows Range security fixes (https://github.com/Kludex/starlette/blob/main/docs/release-notes.md) |
| **Starlette** 1.7.0 (2026-09-23) | BSD-3. Only depends on `anyio`, which `watchfiles` already brings. `FileResponse` with Range, ETag and `If-Range`. `StreamingResponse`, `TrustedHostMiddleware`, `TestClient`. 12.6k stars, 59 open issues, maintained by Kludex (plus lovelydinosaur historically) | **Use** |
| **uvicorn** 0.54.0 (2026-09-25) | BSD-3. Adds `click` and `h11` (pure Python). 11k stars, 109 open issues | **Use** (`uvicorn.Server` run in-process from `simscope serve`) |
| aiohttp 3.14.3 | Apache-2.0/MIT. 8 dependencies with C extensions (multidict, yarl, frozenlist, propcache, ...) | Reject |
| websockets 17.1 | BSD-3, 0 dependencies, bus factor 1 (aaugustin 1,696 commits). Also the package behind viser's clash with Omniverse Kit (viser #675) | **Not needed** (below) |
| watchfiles 1.3.0 | already a dependency (index refresh) | keep |
| httpx 0.28.1 | needed by Starlette's `TestClient`. Last release 2024-12 | dev dependency only |
| Playwright for Python 1.63.0 (2026-09-15) + pytest-playwright 0.9.0 | Apache-2.0. Browser tests in **pytest**: start the Starlette app on port 0 in-process and drive Chromium, so there is no Node test runner for e2e | dev dependency group |

**The resulting `[viewer]` extra:** `starlette`, `uvicorn`, `watchfiles`.
Transitively that is `anyio`, `idna`, `click` and `h11`. It replaces `viser`
and its eight direct dependencies.

**What a live tail needs.** D14 makes the recorder write blocks to disk and
the server tail them, so latency is one block (100 frames, 2 s at
dt = 0.02). The browser only has to learn "run X now has N frames":

- `GET /api/changes?since=<seq>` returns
  `{seq, runs_changed: [...], runs: {name: n_frames}}`. The client polls it
  every 1 s while any run is recording, and every 5 s otherwise. That adds
  at most 1 s on top of the block latency.
- **Do not use SSE.** Over HTTP/1.1, which uvicorn serves, EventSource is
  limited to 6 connections per browser per host *across all tabs*, and the
  issue is marked won't-fix in Chrome and Firefox
  (https://developer.mozilla.org/en-US/docs/Web/API/EventSource). A seventh
  simscope tab would hang its fetches.
- **Do not use a WebSocket.** Nothing is bidirectional or latency-critical,
  now that the camera and clock live in the browser.
- Mutations (marks, rating, tags, export) are plain `POST`s.

**Security** (it is a local tool, but it serves a filesystem):
- Bind 127.0.0.1 by default.
- `TrustedHostMiddleware` for `localhost`/`127.0.0.1`, which blocks DNS
  rebinding.
- A per-process random token for `POST`s, printed in the launch URL like
  Jupyter's.
- Validate run names with the spec's regex before any path join.

## 4. What we own (the integration layer)

The line counts are estimates for the end state. "Exists" means it is already
in `player/src` and carries over, with changes.

### 4.1 Player core (framework-free; shared by the deck element and the app)

| Piece | Lines | Notes |
| --- | --- | --- |
| Format decode (`format.js`) | 431 (exists) | unchanged, and the spec's reference reader |
| Decode worker plus message protocol | +150 | blocks and meshes decoded off the main thread; transferables; concurrency cap |
| `Source` interface: `PackSource` (inline or fetched pack) and `HttpSource` (server endpoints, env subsets) | +200 | the one seam between export and live |
| Window cache (LRU by bytes, focus and crowd streams) | ~250 (replaces `WindowedStream`) | |
| Clock (play, seek, speed, loop, and a master clock for compare) | ~150 (split out of `player.js`) | replaces export.py's `_MASTER` script (about 130 lines of JS in Python strings) |
| Pose interpolation (focus tier) | +60 | |
| Scene building and instancing (`scene.js`) | 383 (exists) + ~120 | plus a page-level geometry and material cache keyed by mesh sha256, shared across players |
| LOD tiers, crowd proxies, `instanceColor` by scalar | +200 | |
| Ground shader (MuJoCo checkerboard, or white with grey grid; fwidth antialiasing; sized to the frustum) | +120 | replaces the 30 m `LineSegments` grid |
| Overlays: arrows (exists), polylines (rewrite to one buffer), contacts | 142 + ~120 | |
| Camera: presets, follow with damping, frame-all, compare camera sync (on camera-controls) | ~250 (replaces about 120 in `player.js` plus `camera.js`) | |
| Shared renderer: direct mode for a single big viewport, and blit mode for decks and compare | 119 + ~40 | |
| Env picking (ray-to-sphere) | +40 | |
| `<simscope-player>` element (lean controls) | 431 (exists) | keeps its API. Adds `env`, `follow` and the highlight markers |
| **Subtotal** | **about 3.3k** (2.2k exist) | |

### 4.2 App shell (React + shadcn)

| Piece | Lines | Notes |
| --- | --- | --- |
| Layout: left and right sidebars, collapsible bottom timeline, theme | ~250 | react-resizable-panels. Panels collapse and resize, and a setting swaps sides. **No drag-to-dock** |
| Library list: search, filter chips, sort, virtualized rows | ~350 | client-side filtering over all rows |
| Run header and inspector (info hierarchy, marks, rating, tags, notes as display) | ~300 | |
| Viewport component (mounts the core `Player`, forwards resize and visibility) | ~120 | the clock never enters React state: subscribers update DOM through refs from one rAF loop |
| Timeline: ruler, playhead, scrub, zoom range, lanes for events, highlights and all-env highlights, camera and speed controls | ~500 | no drag editing. kimodo's 3,086-line `Timeline.tsx` is the warning |
| Plots panel (uPlot wrapper, envelopes, pinned envs, playhead overlay) | ~300 | |
| Env picker panel (virtualized, sort by summaries) | ~200 | |
| Compare view (2–4 panes, one clock, camera-sync options) | ~200 | |
| Keyboard map | ~100 | port of viewer UI v2 §7, minus the event keys |
| shadcn-generated components | ~1,000 | owned but generated, and rarely edited |
| **Subtotal** | **about 3.3k** (of which 1k generated) | |

### 4.3 Python server (`simscope.server`, replacing `simscope.viewer`)

| Piece | Lines | Notes |
| --- | --- | --- |
| Starlette app, routes, static assets, dev mode (serve `player/dist` with esbuild watch) | ~250 | |
| Run and index endpoints (`/api/runs`, `/api/runs/{name}`, marks `POST`s through `annotations.py`) | ~200 | |
| Block, scene and asset byte endpoints (mmap slices, immutable caching, env-subset windows) | ~200 | uses `BlockReader` and the live reader as they are |
| `/api/changes` (watchfiles to a sequence number; live `n_frames`) | ~100 | |
| Derived cache: overview root stream, per-env summaries, envelopes | ~300 | numpy, one window at a time, background thread |
| Highlights detector | ~200 | numpy only, golden-tested |
| Security (host check, POST token) | ~50 | |
| **Subtotal** | **about 1.3k** | |

**Tests we would add:** about 600 lines of pytest for the API and derived
data, about 400 of Playwright (pytest), and about 300 of `node --test` for
the worker, clock and interpolation.

### 4.4 What we delete

- `src/simscope/viewer/` (22 modules, 6,633 lines), `tests/viewer/` (4,336
  lines), and `benchmarks/bench_viewer.py` (611 lines). About 11.6k lines.
  - A few pieces are worth porting as pure functions first:
    `viewer/spatial.py::intersect_plane` and `nearest_env`, and
    `viewer/source.py::ArrayFrameSource` for the synthetic library.
- The `viser==1.1.1` pin and its dependency tree.
- The viser-specific parts of the specs: viewer UI v2 §2–§8, and D3/D13,
  which D16 supersedes. Also the "two renderers can drift" risk (proposal
  risk 1) and the viser/player visual-diff criterion. **There is now one
  renderer.**
- export.py's `_MASTER` compare script, which moves into the core clock.
- The manual event-creation UI (`viewer/annotate.py`, `viewer/events.py`).
  `annotations.py` stays as the programmatic API.

**Net:** about 11.6k lines of Python deleted, about 7.9k lines added (3.3k
core, 2.2k of it existing; 3.3k app shell; 1.3k server), plus about 1.3k
lines of tests. The complexity moves from Python into TS, which is the real
cost (§1). But the total owned code does not grow, and the part that is
*ours alone* shrinks: format, core, server and detectors.

## 5. Risks and mitigations

### 5.1 Two toolchains (Python and Node)

- **Risk.** Python-only contributors cannot rebuild the UI. Node, npm and
  platform-specific binaries appear in CI: esbuild and Tailwind's
  `@tailwindcss/oxide` ship per-platform binaries as optional dependencies,
  and npm lockfiles written on macOS have historically dropped the Linux
  variants.
- **Mitigation.**
  - Commit the built assets (as today) so `pip install` and `uv sync` never
    need Node.
  - One `make assets` target.
  - Pin Node in `.nvmrc` and `engines`, and use `npm ci` in CI on Linux.
  - Regenerate the lockfile with `npm install --os=linux --cpu=x64` checks
    if CI fails on a missing binary.
  - Keep the dev-dependency list short: esbuild, typescript,
    @tailwindcss/cli, and the runtime packages. That is it.
  - The shadcn CLI is run ad hoc with `npx`, never installed.

### 5.2 A deterministic, committed bundle

- **Risk.** The app bundle is about 1.2 MB of minified single-line JS. Every
  UI change rewrites most of it, so git history grows by roughly the gzip
  size (about 380 KB) per changed commit. Minifier renames also defeat
  delta compression. Tailwind output must also be byte-stable.
- **Mitigation.**
  - Build twice in CI and `cmp`, as well as `git diff --exit-code` against
    the committed file.
  - Squash-merge UI PRs so there is one bundle revision per PR. At 200 UI
    PRs that is about 75 MB of history, which is acceptable.
  - If the repo passes 150 MB, stop committing the *app* bundle: build it
    in the release workflow before `uv build`, since the `uv_build` backend
    has no build hooks, and keep committing only the lean player that
    mkdeck vendors.
  - Pass `legalComments: "eof"` and a sorted `LICENSES.txt` generated from
    `node_modules`, extending what `build.mjs` does for three.

### 5.3 Browser testing

- **Risk.** WebGL in headless CI. Chrome removed the automatic SwiftShader
  fallback (html-export research §3.7). Safari and Firefox are unmeasured.
- **Mitigation.**
  - Playwright (Python) with `--use-angle=swiftshader
    --enable-unsafe-swiftshader`.
  - Three layers of tests:
    1. DOM and state tests that need no WebGL (timeline, library, compare
       clock);
    2. small-viewport screenshot tests with a pixel tolerance on 3 fixed
       scenes;
    3. a zero-network-requests test on exported files over `file://`,
       which the proposal already requires.
  - Run Firefox and WebKit weekly rather than per PR.
  - Keep `benchmarks/` browser-free by benchmarking decode and apply in
    Node, as in §2.2.

### 5.4 Size budget for exported HTML and mkdeck decks

| Budget | Value | Basis |
| --- | --- | --- |
| Lean `simscope-player` runtime, shared once per deck | ≤ **175 KB gz** (≤ 235 KB base64) | 133 KB today, plus r186 (+21), camera-controls (+10) and new core code |
| Full-app export runtime | ≤ **400 KB gz** (≤ 535 KB base64) | 322 KB gz measured for dependencies, plus our code |
| Poses per embedded rollout in a deck | ≤ **1 MB** | single env, `q16d`, 60 s of G1 at 50 Hz is about 0.65 MB |
| Meshes per deck | shared through the CAS, typically ≤ 3 MB | G1 about 1–1.3 MB q16 (estimated from the crate's 0.135x); CAD about 4 MB |
| Whole deck HTML | ≤ **25 MB** | 57 MB loaded with DOMContentLoaded at 119 ms and a 244 MB heap (html-export research), so 25 MB leaves headroom for decks with other media |
| Envs in any export | ≤ **64 by default**, with `--envs` selection | §2.3(b). Requires env subsetting in `export.py` |
| Live players decoded at once in a deck | ≤ **8** (LRU, unload beyond) | today a player never unloads until disconnected, so a 30-slide deck accumulates 30 decoded runs and 30 copies of each mesh on the GPU |

The proposal's "20 s G1 HTML ≤ 4 MB" still holds with the full app: about
1.3 MB of meshes and about 0.2 MB of poses gives about 2 MB as base64, plus
0.5 MB of runtime.

### 5.5 Z-up orthographic camera gotchas

1. **The up vector.** OrbitControls reads `camera.up` once. With
   camera-controls, set `camera.up = (0, 0, 1)` before construction and
   call `updateCameraUp()` after any change. **Keep z-up for every view,
   including top.** Today's player switches the top view to y-up and
   rebuilds the controls.
2. **Top view.** A polar angle of exactly 0 is degenerate for
   look-at-with-up. Use polar = 1e-3 rad and clamp `minPolarAngle` there.
   Azimuth then sets screen orientation, keeping +x to the right.
3. **Near and far clipping.** A fixed `CAMERA_DISTANCE = 100` with
   `far = 400` clips large scenes. A 64 x 64 Isaac grid at 2.5 m spacing is
   160 m across, and its iso half-diagonal is about 113 m, more than the
   100 m distance, so geometry behind the camera is cut. Derive distance and
   far from scene bounds: distance = 2 x radius, far = 4 x radius. Ortho
   depth is linear, so precision stays fine (400 m / 2^24 ≈ 24 µm).
4. **Two zoom models.** The player sizes the frustum from `scale` (world
   height), while camera-controls zooms ortho through `camera.zoom`. Pick
   one: fix the frustum from `scale` at load, let the controls own `zoom`,
   and report effective scale = scale / zoom. Screen-size markers
   (contacts, pins) use world-per-pixel = effective scale / canvas height.
5. **Ground.** The infinite grid is a 30 m half-size mesh and runs out in
   frame-all views. Use one ground-plane shader sized to the frustum each
   frame, with fwidth antialiasing for the checkerboard (otherwise ortho top
   views moiré badly). Draw it with `polygonOffset` or `depthWrite = false`
   to avoid z-fighting with feet at z = 0.
6. **Picking.** `InstancedMesh.raycast` uses the bounding sphere. With
   `frustumCulled = false` and instances moved every frame, a stale sphere
   makes picks miss. Use our own ray-to-sphere test on env roots instead
   (§2.5).
7. **Lights and shadows.** The key light is fixed in world space (3, 3, 6).
   If shadows are added (single env only), the shadow camera must follow
   the view target or shadows vanish under follow.

### 5.6 WebGL context limits with many players on one page

- **The limits.** Chrome keeps 16 live contexts (measured, html-export
  research). Firefox defaults to `webgl.max-contexts` 32, and to 2 per
  principal on mobile (https://bugzilla.mozilla.org/show_bug.cgi?id=1421481).
  Safari's number is unverified.
- **The existing `SharedRenderer`** (one context, blitting into per-player
  2D canvases) is the right design, and it must stay the only renderer.
  - **Decks:** inline `<simscope-player>` only. Never a `<deck-embed>`
    iframe of an exported app, because each iframe is a new context *and*
    a new React app.
  - **The app:** compare panes share the one context. Add a *direct mode*
    when one player owns the page, so a 3456 x 2234 main viewport does not
    pay a 7.7 MP `drawImage` blit per frame.
  - **GPU memory:** share geometries across players in one page, keyed by
    mesh sha256. That is possible *because* there is one renderer.
- **Open items:** measure the Safari and Firefox limit and the blit cost in
  migration phase 0. Also check that Blob-URL workers start from `file://`
  pages in all three browsers (unverified). If they do not, exports decode
  on the main thread, which is fine at ≤ 64 envs (22 ms per window).

### 5.7 Scope creep (the risk that decides whether D16 stays cheap)

- **Not building:**
  - a docking system;
  - drag editing on the timeline;
  - a command palette;
  - multi-user;
  - a React scene graph;
  - a second plotting library;
  - JS-side detectors.
- **Written down as non-goals in the new UI spec:**
  - thumbnails, which already exist as `poster.png` in packs;
  - LOD mesh decimation, since box proxies are enough;
  - WebGPU.

## 6. Migration plan

Each phase ships on its own. `simscope serve` keeps working throughout: it
stays on viser until phase 3 flips the default. Exports and mkdeck keep the
`<simscope-player>` API in every phase.

| Phase | Scope | Ships | Stays green |
| --- | --- | --- | --- |
| **0. Spikes** (about 1 week) | (a) A worker decode plus an env-subset window endpoint at 4,096 x 1,000 x 20 in Chrome, Firefox and Safari; measure the frame time of the focus and crowd tiers. (b) camera-controls with z-up ortho, follow plus interpolation at dt = 0.02 on 60 and 120 Hz displays; judge smoothness side by side with today's player. (c) A Blob-URL worker from `file://`. (d) esbuild plus Tailwind plus shadcn (Radix) app skeleton: byte-identical builds on macOS and Linux CI, and bundle size against §5.4 | A go or no-go per item, recorded as D16 in the proposal's decision log (also superseding D3 and D13) | everything, since nothing merges except docs |
| **1. Player core** | three r150 to r186 behind a screenshot diff; camera-controls; interpolation; decode worker; `Source` interface (`PackSource` only); byte-LRU window cache; polyline fix; page geometry cache and player LRU; ground shader; direct-mode renderer; `env`/`follow` element attributes | a new `simscope-player.js`. Exports and mkdeck get smooth follow and ortho presets first | `node --test` format goldens, `tests/test_export.py`, the offline-export test, the 30-slide deck criterion |
| **2. Server, read-only** | `simscope.server` on Starlette and uvicorn: `/api/runs`, run and manifest, scene, asset and window byte endpoints, `/api/changes`, security. `HttpSource` in the core. A minimal app shell: viewport, bottom timeline, library list. Behind `simscope serve --ui web` | a usable web viewer next to viser | all viser tests (still default), plus new API pytest and a Playwright smoke test |
| **3. Features and default flip** | plots (uPlot), compare (master clock, camera sync), theme, keyboard, marks, rating and tags `POST`s, information hierarchy; derived cache (overview stream, per-env summaries, envelopes), crowd tier and env picker; highlights detector and timeline lanes. Contacts land in *adapters* (`mujoco.py`, `isaaclab.py`) as `arrows` streams. Then `--ui web` becomes the default | the D16 feature set | benchmarks in CI (D12): run switch ≤ 200 ms first frame, 4,096-env crowd at ≤ 4 ms of main-thread time per frame in the Node benchmark, `/api/runs` ≤ 50 ms at 5k runs |
| **4. Full-app export** | `simscope export --ui full|lean` (lean by default for `--layout` decks), `--envs` subsetting, highlights baked into packs (a minor pack version bump), budget checks as tests | standalone shareable app exports | the offline tests in 3 browsers, size-budget tests |
| **5. Delete viser** | remove `src/simscope/viewer/`, `tests/viewer/`, `bench_viewer.py`, the `viser` pin and `_mjviser` naming if nothing else needs it; rewrite viewer UI v2 as a v3 spec; update proposal §5, the risks, and the success criteria ("visual diff viser vs player" is gone) | a smaller wheel, one renderer | the full suite. `pip install simscope[viewer]` no longer pulls viser |

**Ordering rationale.** Phase 1 fixes the user's biggest complaint (smooth
follow and ortho) in the exported and deck player *before* any server
exists. It also de-risks the renderer under the conditions the app will
use. Scale (the derived cache and tiers) lands with the features in phase 3,
because it needs the server. Deletion comes last, so there is always a
working `serve`.

## 7. Key sources

- Repo: `player/src/{format,player,scene,overlays,renderer,element}.js`,
  `src/simscope/{export,index,library}.py`, `src/simscope/io/blockfile.py`,
  `docs/specs/2026-09-30-simscope-{proposal,format-v1,viewer-ui-v2}.md`,
  `docs/research/{html-export,storage,simulators,viser}.md`.
- artifacts-server: `docs/specs/2026-06-30-native-rollout-viewer-design.md`,
  `artifacts_server/static/app.js` (master clock, lines 60–85; lazy Plotly).
- npm registry: https://registry.npmjs.org/three,
  https://registry.npmjs.org/camera-controls,
  https://registry.npmjs.org/react, https://registry.npmjs.org/radix-ui,
  https://registry.npmjs.org/@base-ui/react,
  https://registry.npmjs.org/uplot,
  https://registry.npmjs.org/@tanstack/react-virtual,
  https://registry.npmjs.org/zustand,
  https://registry.npmjs.org/react-resizable-panels,
  https://registry.npmjs.org/esbuild, https://registry.npmjs.org/vite,
  https://registry.npmjs.org/vitest,
  https://registry.npmjs.org/@react-three/fiber,
  https://registry.npmjs.org/@react-three/drei,
  https://registry.npmjs.org/preact,
  https://registry.npmjs.org/plotly.js-dist-min,
  https://registry.npmjs.org/tailwindcss,
  https://registry.npmjs.org/shadcn.
- PyPI: https://pypi.org/pypi/starlette/json,
  https://pypi.org/pypi/uvicorn/json, https://pypi.org/pypi/viser/json,
  https://pypi.org/pypi/websockets/json,
  https://pypi.org/pypi/aiohttp/json,
  https://pypi.org/pypi/playwright/json.
- GitHub API: https://api.github.com/repos/mrdoob/three.js,
  https://api.github.com/repos/yomotsu/camera-controls,
  https://api.github.com/repos/leeoniya/uPlot,
  https://api.github.com/repos/radix-ui/primitives,
  https://api.github.com/repos/mui/base-ui,
  https://api.github.com/repos/Kludex/starlette (and `/contributors` for
  each).
- three.js migration guide:
  https://github.com/mrdoob/three.js/wiki/Migration-Guide
- shadcn Base UI default:
  https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- Vite 8 on Rolldown: https://vite.dev/blog/announcing-vite8-beta
- The EventSource connection limit:
  https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- Starlette Range handling:
  https://github.com/Kludex/starlette/blob/main/docs/release-notes.md
- Firefox mobile context limit:
  https://bugzilla.mozilla.org/show_bug.cgi?id=1421481
- camera-controls z-up and ortho examples:
  https://yomotsu.github.io/camera-controls/examples/camera-up.html,
  https://yomotsu.github.io/camera-controls/examples/orthographic.html
