# simscope: project proposal

**Status:** Direction accepted on 2026-09-30. The [decision log](#decision-log)
records every choice. Next step: turn this proposal into a spec, then a plan.

**Inputs:** Five related-work reports under [research](../research/index.md),
plus prior in-house work in artifacts-server (`.rbundle`, gallery, compare
view) and mkdeck (`.rollout` plus `HASH.meshes`, deck player).

## Summary

simscope is a focused, high-performance library for robot simulation
rollouts. It does four things:

- **Record** rollouts from MuJoCo (including MJX and MuJoCo Warp) and from
  Isaac Lab 3.0+ into one compact folder format.
- **Browse** a folder of thousands of rollouts with `simscope serve DIR`, a
  local web app with its own three.js player ([D16](#decision-log)).
- **Curate** rollouts in the viewer: favorite, tag, rate, compare side by
  side, and jump to automatically detected highlights.
- **Ship** rollouts as one offline HTML file with no CDN requests. The same
  player runs inside mkdeck slides.

The research found no tool that does all four. Rerun is the closest
competitor. It has no user annotation, and its viewer is about 50 MB, so it
cannot make a small standalone file ([platforms](../research/platforms.md)).
No viser-based project browses a folder of rollouts
([viser](../research/viser.md)).

## Why now

Each sim project has rebuilt part of this stack:

- artifacts-server owns a gallery, a curation dashboard, and a three.js
  viewer for `.rbundle`.
- mkdeck owns a fork of that viewer and a second format (`.rollout` plus
  `HASH.meshes`).
- Research code uses viser, Brax HTML, or mp4 directly.

The two in-house formats differ, and the two viewers drift apart
(`mkdeck/scripts/VENDOR_VIEWER.md`). Neither supports Isaac. simscope takes
over the format, the recorder, the local viewer, and the export player.
mkdeck and artifacts-server then consume it.

## Scope

simscope stays narrow on purpose. It supports two simulator families well
and nothing else. It ships one format, one server, and one player. It has no
plugin system and no adapter registry. We add a target only when a real
project needs it.

**In scope**

1. One data model and on-disk format.
2. Two adapters: MuJoCo (covering MJX and MuJoCo Warp) and Isaac Lab 3.0+.
3. A streaming, crash-safe recorder, with a live mode that uses the same API.
4. A local web server and app for browsing, scrubbing, comparing, and
   curating, with automatic highlights.
5. A single-file HTML export, and a JS player that mkdeck embeds.
6. One importer, for `.rbundle`, so the existing artifacts-server store can
   be backfilled.

**Deliberately out**

| Out | Why |
| --- | --- |
| Isaac Lab 2.x, Isaac Sim older than the 6.x line, Python 3.11 | Isaac Lab 3.0 is the target ([D3](#decision-log)). Supporting 2.x would double the conventions, because it uses wxyz order and Python 3.11. |
| Newton, Genesis, ManiSkill, Drake, PyBullet, Brax as sources | Not our simulators. Newton's viewer design is borrowed, but simscope does not depend on or adapt to it. |
| Importers for mkdeck `.rollout`, Brax HTML, and `motion.npz` | mkdeck keeps its own converter. We backfill `.rbundle` only. |
| Exports to `.glb`, `.viser`, MCAP, `.rrd`, Zarr, FiftyOne, and Label Studio | A second export path is a second renderer to keep correct. Users can still call viser's `as_html()` themselves. |
| Pairwise preference mode, keyframed 3D tracks, a flag-then-batch-action flow | Nice to have, but not part of marking and annotating. Revisit after v1. |
| Deformables, particles, cameras and lights from the scene, cubemaps | Not needed for rigid-body rollout review. |
| Multi-user hosting, authentication, remote storage | artifacts-server covers these. |
| Video rendering, physics replay | simscope stores poses, not simulator state. |

## What the research changed

| Earlier assumption | Finding | Consequence |
| --- | --- | --- |
| A viser HTML export inlines a 2.75 MB client (artifacts-server `docs/specs/2026-06-30-native-rollout-viewer-design.md`) | viser 1.1.1 ships an 819 KB self-extracting client. An `as_html()` export made zero network requests in Chrome ([viser](../research/viser.md)) | Size no longer rules out viser exports, but the next row still does. |
| Viser playback cannot be driven by a parent page | Still true in 1.1.1. Time, speed, and pause are React state in `FilePlayback.tsx`. The maintainer confirmed this in issue #600 | Decks need an owned player with a control API. |
| `.viser` recordings could serve as an archive | They are version-locked message logs. Newton pins `viser==1.0.26` for this reason. Backward seeks replay from frame 0 | Never store `.viser`. viser is a view layer only. |
| Gzip over the whole tail is fine (`.rbundle` v2) | Whole-file compression blocks windowed access, and HTTP `Range` applies to the encoded bytes (RFC 9110 §14) ([storage](../research/storage.md)) | Compress independent frame blocks. |
| Poses are the bulk of the data | Meshes dominate. Unitree G1 has 7.1 MB of raw meshes, against 0.87 MB for 1000 frames of poses ([simulators](../research/simulators.md)) | Content-address meshes and scenes across rollouts, and quantize meshes on export. |
| Isaac Lab uses wxyz quaternions | Isaac Lab 3.0 moved to xyzw. MuJoCo and the viser API use wxyz ([simulators](../research/simulators.md)) | Fix one canonical order ([D1](#decision-log)) and golden-test both adapters against it. |

## Architecture

```text
 producers (user's sim env)            simscope library (folder)                 consumers
┌─────────────────────────┐     ┌───────────────────────────────────┐    ┌──────────────────────────┐
│ MuJoCo / MJX / MJ Warp  │────▶│ runs/<name>/rollout.json           │───▶│ simscope serve (web app)│
│ Isaac Lab 3.0+          │────▶│            frames.blk  (blocks)    │    │  browse · scrub · compare│
│ importer: .rbundle      │────▶│            streams.blk (signals)   │◀───│  highlights · rate · tag │
└───────────┬─────────────┘     │            annotations.json (RW)   │    └──────────────────────────┘
            │ Recorder           │ assets/<sha256>   meshes, textures │    ┌──────────────────────────┐
            │ (numpy only)       │ scenes/<sha256>.json               │───▶│ simscope export          │
            ▼                    │ .simscope/index.sqlite (derived)   │    │  → single-file HTML      │
   live mode: same API ─────────▶│ .simscope/event_types.json         │    │  → .simscope pack        │
   streams into a running viewer └───────────────────────────────────┘    └────────────┬─────────────┘
                                                                                        ▼
                                                              simscope-player (JS, three.js, CDN-free)
                                                              custom element used by exports and mkdeck
```

The system has five parts:

1. `simscope.core` defines the data model and imports only numpy.
2. `simscope.io` reads and writes the block format, the CAS, the pack, and the
   index.
3. `simscope.mujoco` and `simscope.isaaclab` are the two adapters. Each one
   imports its simulator lazily.
4. `simscope.server`, `simscope.derived`, and `simscope.highlights` serve the
   library to the browser app in `web/`.
5. `simscope.export` writes HTML and ships the built `simscope-player` asset.

### Performance principles

Every hot path follows these rules. Phase 0 and CI enforce them with
benchmarks.

- **No per-body or per-frame Python loops.** Every array operation is
  vectorized numpy over `[T, E, B, ·]`.
- **Recording never blocks the sim step.**
  - `Recorder.log()` copies one frame into a preallocated block buffer.
  - Compression and writing happen on a background thread.
  - GPU state (MJX, Warp, Isaac) is gathered on device, then copied to the
    host once per block, not once per step.
- **Reads are zero-copy until decode.** The server mmaps block files and
  serves the raw blocks of the requested envs without decoding them. The
  browser decodes in a Web Worker into a byte-bounded LRU of windows.
- **The viewer draws once per display frame.** It interpolates poses between
  sim frames, uses one instanced mesh per unique mesh, and draws only a
  focus set of envs in full when E is large (tiers, [D19](#decision-log)).
- **Server memory is independent of library size.** Nothing is loaded until a
  run is opened. The index holds only summary rows.
- **The player decodes on demand.** It decodes block by block, draws through
  one shared WebGL renderer, uses instanced meshes, and renders only while
  visible or playing.

### 1. Data model (`simscope.core`)

The model is built from what MuJoCo and Isaac Lab actually expose. Newton's
split between a static `Model` and per-frame `State` is the closest prior art
([simulators](../research/simulators.md) §4).

- **Conventions.** Z-up, right-handed, metres, seconds, quaternions in xyzw
  order ([D1](#decision-log)). Adapters convert on the way in. The manifest
  records the source simulator and its version.
- **Scene.** A scene is immutable and content-addressed, so many rollouts
  share one.
  - `bodies[]`: id, name or path, parent.
  - `geoms[]`: body, kind, size, scale, local pose, material, mesh ref, and
    role (visual or collision). Kind is one of box, sphere, capsule,
    cylinder, ellipsoid, plane, hfield, or mesh. Adapters tessellate any
    other shape into a mesh, so the player stays small.
  - `materials[]`: rgba, metallic, roughness, and an optional 2D texture ref.
  - `meshes[]` and `textures[]`: CAS refs of the form `{sha256, size}`.
- **Trajectory.**
  - Time: `dt`, or explicit timestamps as `f64[T]`.
  - `body_pose f32[T, E, B, 7]`.
  - `env_origin [E, 3]`.
  - `scene_ref`: one scene hash, or E hashes when domain randomization gives
    each env its own scene.
- **Streams.** These match what `.rbundle` already carries:
  - `scalars`: reward, torques, and similar signals for plots.
  - `forces [T, E, B, 3]`.
  - `predictions`: ghost poses.
- **Annotations.** A separate, mutable model. See §4.

### 2. On-disk format and library (`simscope.io`)

This design follows the storage report ([storage](../research/storage.md)
"Recommended on-disk layout"). It keeps mkdeck's split of meshes from poses
and borrows block indexing from PMTiles and Genesis `.gstraj`.

```text
library/
  .simscope/index.sqlite         derived, rebuildable scan cache (gitignored)
  .simscope/event_types.json     typed event vocabulary (from Foxglove Event Types)
  assets/3f/a91c…e2              meshes and textures, sha256 CAS with a 2-char fan-out (DVC layout)
  scenes/9b/07d4…11.json         scene descriptors, also CAS
  runs/2026-09-29_walk_seed17/
    rollout.json                 manifest; written last and atomically (.partial while recording)
    frames.blk                   indexed, independently compressed pose blocks
    streams.blk                  optional signals in the same container
    annotations.json             mutable sidecar
```

- **Block file.**
  - Layout: a small header, then 8-byte-aligned blocks of about 100 frames,
    then a directory of `(env, t0, nframes, off, clen, ulen, crc32)` entries.
  - Each block is compressed on its own with deflate-raw. Browsers decode
    deflate-raw natively at about 540 MB/s with no JS
    (`DecompressionStream`). Brotli and zstd would save only 3–4% on poses,
    and Chrome decodes neither natively.
  - A 100-frame block costs about 5% in size against compressing the whole
    file. In return, a seek reads one block.
- **Two codecs.** Each block header names its codec
  ([D2](#decision-log)):
  - `f32s`: lossless. Byte shuffle plus integer delta of the float bits gives
    0.49–0.69× raw. This is the archive default.
  - `q16d`: int16 positions and quaternions, delta-coded, shuffled. It gives
    0.19–0.32× raw, with about 0.03 mm and 0.035° error on the benchmark
    humanoid. This is the export default.
- **Meshes.** Raw f32/u32 in the CAS. Export quantizes them to u16, then
  applies delta coding and gzip, all in pure numpy: 22.6 MB of crate meshes
  became 3.0 MB.
- **Pack (`*.simscope`).** One file concatenates a manifest, its blocks, and
  every referenced asset behind a PMTiles-style directory. It is the unit of
  HTML embedding and of hand-off to mkdeck and artifacts-server.
- **Index.** An `os.scandir` pass writes one summary row per run to SQLite
  (WAL mode). `watchfiles` triggers incremental rescans. 5,000 runs indexed in
  0.13 s, and a stat-only rescan took 11 ms. The index is disposable.
- **Importer.** `.rbundle` v1 and v2 only.

### 3. Adapters and recorder

```python
import simscope as ss
from simscope import mujoco as smj

lib = ss.Library("runs/")
scene = smj.scene_from_model(model)                  # dedups meshes and textures by hash
with lib.record("walk_seed17", scene=scene, dt=0.02, tags=["sweep_07"]) as rec:
    for step in range(n):
        ...
        rec.log(smj.poses(data), reward=r, torque=tau)  # MjData, or batched MJX/Warp arrays
```

- **MuJoCo, MJX, and MuJoCo Warp.**
  - The scene comes from `mjModel`. mjviser's `conversions.py` (Apache-2.0)
    covers textures, hfields, and mesh handling. We vendor the parts we need,
    with attribution ([D7](#decision-log)).
  - Poses come from `xpos` and `xquat`, which are wxyz. MJX and Warp batches
    arrive as `(nworld, nbody, ·)` arrays and pass through `np.asarray`, so
    simscope never imports JAX or Warp.
- **Isaac Lab 3.0+.**
  - `ss.isaaclab.Recorder(env, assets=[...])` is a per-step hook. It reads
    `asset.data.body_link_pose_w`, which is `(N, B, 7)` in xyzw and world
    frame, and gathers on the GPU once per block.
  - The scene is extracted from the live USD stage with the `pxr` that ships
    inside Isaac, so there is no `usd-core` dependency. Newton's
    `newton/_src/usd/` utilities are the reference for traversal: instance
    proxies, purposes, `metersPerUnit`, and `upAxis`.
  - The viewer always runs as a separate process, so its web server
    dependencies never share an interpreter with Omniverse Kit.
- **Crash safety.** The recorder closes each block as it fills and keeps
  `rollout.json.partial` until finalize. On restart, a scan recovers all
  complete blocks.
- **Live mode.** Any recording in progress is visible in `simscope serve`,
  which tails its finished blocks on disk (D14). Watching a run while it
  trains needs nothing beyond recording it.

### 4. Curation and annotation

The schema is a subset of the one in the platforms report
([platforms](../research/platforms.md) §4). It combines Foxglove Events,
FiftyOne `TemporalDetection`, LeRobot's sidecar location, and RoboArena's
rating fields.

- The source of truth is `runs/*/annotations.json` ([D8](#decision-log)). It
  is pretty-printed with sorted keys and written atomically, so git can diff
  and merge it. Rollout files are never rewritten.
- `annotations.json` holds five kinds of record:
  - `marks`: favorite, flag, status, and tags.
  - `notes`.
  - `ratings`: scale, value, criterion, and rationale.
  - `events`: `t0` and `t1` in seconds plus snapped frames `f0` and `f1`.
    `t0 == t1` means an instant. Properties are typed by `event_types.json`.
  - `spatial`: static points and boxes in the world frame or a body frame,
    optionally linked to an event.
- Each record has a ULID plus `author`, `created`, and `updated`, so two
  people's sidecars merge cleanly.
- The SQLite index caches marks and tags so filtering stays fast. It is
  always rebuilt from the sidecars. This differs from artifacts-server today,
  where the SQLite rows are the only copy.

### 5. Viewer server (`simscope serve DIR`)

The viewer is our own frontend ([D16](#decision-log); full design in the
[viewer v3 spec](2026-09-30-simscope-viewer-v3.md), seams in the
[contracts](2026-09-30-simscope-viewer-v3-contracts.md)). Python serves the
library over HTTP; the browser does all rendering.

- **Server** (`simscope.server`, Starlette and uvicorn). It exposes the
  library paths of the format spec (`/files/`, Range requests, immutable CAS),
  a run index with an ETag, a synthesized block index and env-subset block
  fetches (raw SSBB blocks, no server decode), a change feed for live runs,
  and an annotations endpoint guarded by a token. Server memory stays
  independent of library size.
- **Derived data** (`simscope.derived`). A root-pose stream for crowds,
  per-env summaries, and cross-env envelopes are computed once per run and
  cached in `.simscope/derived/` ([D19](#decision-log)).
- **Highlights** (`simscope.highlights`). Robust-z peaks in contact force,
  root acceleration, torque streams, and root-height drops replace manual
  event drawing; users can register detectors ([D20](#decision-log)).
- **App** (`web/src/app`, React 19, shadcn/Radix, Tailwind 4). Fixed slots:
  library left, inspector right, timeline at the bottom
  ([D17](#decision-log)). It browses, filters and sorts every run in the
  browser, curates (rating, favourite, tags, notes), compares two to four
  runs on one master clock, and plots with a cursor synced to the playhead.
- **Player core** (`web/src/core`). Orthographic, z-up camera; follow runs in
  the browser every frame with pose interpolation and a damped target
  ([D18](#decision-log)); above 64 envs a focus tier is drawn in full and the
  rest is one instanced proxy per env ([D19](#decision-log)); decoding runs
  in a Web Worker. Contact forces are recorded as a `contacts` arrows stream
  by the adapters and drawn for the focus set ([D22](#decision-log)).
- **Live runs.** The client polls the partial manifest once a second and
  fetches finished blocks ([D14](#decision-log), [D21](#decision-log)).

### 6. Export and the shared player

The owned player stays ([D4](#decision-log)): a slide must control playback
from outside the viewer, and annotations and highlights must travel with the
export. There is one renderer, the player core, for `serve` and for exports
([D16](#decision-log)).

- **`simscope-player`** lives in this repo ([D6](#decision-log)).
  - The framework-free core and the `<simscope-player>` custom element are
    built by a pinned esbuild into committed bundles in
    `src/simscope/_assets/`. CI rebuilds them and runs `git diff
    --exit-code`.
  - The element has the attributes `src`, `run`, `env`, `follow`, `view`,
    `ground`, `theme`, `sync` and more, and the methods `load`, `unload`,
    `play`, `pause`, `seek`, `setSpeed`, `setView`, and `snapshot`. It emits
    `ready`, `timeupdate`, `ended`, and `error`.
- **Single-file HTML** (`simscope export --ui lean|full`).
  - `lean` inlines the gzipped player runtime and one pack for all runs:
    players in the page, or mkdeck slides. `full` inlines the whole app
    with a boot block and supports `--envs` subsets.
  - Packs are base64 in `<script type="text/plain">` tags, decoded with
    `Uint8Array.fromBase64` and an `atob` fallback. Baked annotations and
    highlights show on the timeline. Output is deterministic (gzip
    `mtime=0`).
  - Everything is inline, because `file://` pages cannot `fetch` or load
    module scripts; the decode worker is created from a Blob URL.
- **Many players per page.** Chrome keeps 16 live WebGL contexts and evicts
  the oldest. The players share one renderer that draws each visible player
  into that player's own 2D canvas, decode only what is on screen, and keep a
  bounded number of runs loaded. The pack carries a poster PNG for each run.
- **mkdeck.** mkdeck vendors the tagged `simscope-player` build and reads
  `.simscope` packs, so the two viewer forks merge into one.

### 7. Relationship to existing projects

| Project | Relationship |
| --- | --- |
| artifacts-server | Stays the remote, authenticated host ([D5](#decision-log)). It later ingests `.simscope` packs and embeds `simscope-player`. That work happens in its own repo. |
| mkdeck | Consumes `simscope-player` and `.simscope` packs. Its `.rollout` converter stays in mkdeck. |
| mjviser | Source of the vendored MuJoCo conversion code. It is also an upstream for fixes. |

## Dependencies

| Scope | Packages | Notes |
| --- | --- | --- |
| core | `numpy`, stdlib (`zlib`, `hashlib`, `sqlite3`, `json`, `mmap`) | No compiled extras. |
| `[viewer]` | `starlette`, `uvicorn`, `watchfiles` (pinned) | BSD-3 and MIT. Replaces viser ([D16](#decision-log)). |
| `[mujoco]` | `mujoco>=3.14` | MJX and Warp arrays need no extra. |
| Isaac Lab | none installable | The adapter runs inside the user's Isaac Lab 3.0+ environment and uses its `pxr`. |
| browser (bundled) | three, camera-controls, uplot, react, react-dom, radix-ui, lucide-react, react-resizable-panels, @tanstack/react-virtual, zustand, tailwindcss | All MIT or ISC, pinned in `web/package.json`, about 372 KB gzipped for the app. Licences: `THIRD_PARTY_NOTICES.md`. |
| build only | esbuild, TypeScript, Tailwind CLI, Node 26 | The only bundler; output is deterministic and committed. |

## Success criteria

| Area | Target |
| --- | --- |
| Recording overhead | `Recorder.log()` adds under 50 µs per step for a single env, and at most one host copy per block for batched GPU envs. |
| Library scale | A 5,000-run library opens and lists in under 1 s. Server memory stays flat whatever the library size (the research measured about 45 MB baseline). `/api/runs` answers in 50 ms or less at 5,000 rows. |
| Run switch | The first frame of any rollout shows in 200 ms or less on a local server. A seek anywhere reads at most one block per env shown. |
| Crowd frames | At 4,096 envs: at most 4 ms of main-thread JS per frame, at most 2 MB of GPU upload per frame, at most 5M triangles, and no main-thread decode. |
| Size | Poses at or under 0.35× raw f32 under `q16d`. A 20 s G1 rollout exports as HTML in about 4 MB or less. Player bundle at most 250 KB gzipped; app bundle at most 450 KB gzipped. |
| Offline | An automated browser test checks that an exported file makes zero network requests and works from `file://` in Chrome, Firefox, and Safari. |
| Fidelity | Golden tests with asymmetric quaternions for both adapters. The Python and browser readers decode the same golden block files. |
| Decks | A 30-slide mkdeck deck with one rollout per slide and one 6-up compare slide plays without losing a WebGL context (at most 8 live contexts). |
| Durability | Killing the recorder mid-run leaves every complete block readable. Annotations survive a folder move and merge between two users. |

The performance rows are the budgets of the [viewer v3 spec](2026-09-30-simscope-viewer-v3.md)
section 15 and are checked by `benchmarks/` and `web/bench/` ([D12](#decision-log)).

## Phased plan

Phases 0 to 5 were the original plan. Viewer v3 replaced the Viser part of
phases 2 and 3 and added its own phases ([viewer v3 spec](2026-09-30-simscope-viewer-v3.md)
section 17).

| Phase | Scope | Exit criterion |
| --- | --- | --- |
| 0. Spikes | Recorder overhead and G1 size benchmarks, `file://` tests, quaternion goldens, the shared renderer across 20 viewers, and the Viser timeline spike (whose result led to [D16](#decision-log)) | The benchmark harness is in CI |
| 1. Core and format | Data model, block file, both codecs, CAS, pack, recorder, reader, index, `.rbundle` importer | Round-trip tests pass, and a backfill of the local artifacts-server store renders |
| 2. MuJoCo and Isaac Lab | Both adapters, contacts streams, live mode | One robot recorded in Isaac and in MuJoCo matches within tolerance |
| 3. Export and decks | `simscope-player`, single-file HTML, mkdeck integration | The offline and deck targets pass |
| 4. Viewer v3 | Player core, Starlette server with derived data, React app, highlights, contacts, lean and full exports | The v3 budgets pass; the Viser viewer is deleted (done) |
| 5. Later | Pairwise preference mode, keyframed 3D tracks, Playwright smoke flows in CI | Revisit on demand |

## Risks

1. **Two renderers can drift.** Gone: serve and exports both use the player
   core ([D16](#decision-log)). The remaining risk is drift between the
   Python and JS readers of the block format. Mitigation: golden block files
   written by Python and decoded by `node --test`.
2. **We own a frontend.** The app is about 6.6k lines of TypeScript that
   viser used to provide. Mitigation: battle-tested dependencies for
   everything except the integration layer, pinned exactly, and the tests and
   bundle budgets in CI. The two single-maintainer dependencies
   (camera-controls, uPlot) are small and MIT, and vendoring is the exit.
3. **Thousands of envs.** Decode, draw, and plot cost grow with `E`.
   Mitigation: focus and crowd tiers, env-subset block fetches, derived
   summaries and envelopes, and the crowd benchmark.
4. **Isaac Lab 3.0 is still early access.** Its data API may shift before
   release. Mitigation: the adapter touches only `body_link_pose_w`, the
   contact sensor, and the USD stage, and golden tests pin them.
5. **Mesh volume.** Menagerie-scale models run 4–23 MB raw. Mitigation: CAS
   dedup and quantization on export.
6. **Browser limits are only measured in Chrome.** Firefox and Safari were not
   measured for WebGL context limits or large-file loads. Phase 0 covers them.
7. **Bundles are committed.** A stale bundle would ship old code. Mitigation:
   CI rebuilds them and fails on any diff.

## Decision log

These choices were accepted on 2026-09-30. Changing one means editing this
table and saying why.

| ID | Decision | Rationale | Alternative rejected |
| --- | --- | --- | --- |
| D1 | Canonical quaternion order is xyzw. | It matches three.js, glTF, PhysX, Warp, and Isaac Lab 3.0, so the player and the Isaac adapter need no conversion. Only the MuJoCo adapter converts. | wxyz, which matches MuJoCo and the viser API. It would move the conversion into the player and the Isaac path. |
| D2 | The archive stores lossless `f32s` blocks. Exports use `q16d`. | Archived rollouts may feed analysis, so they keep full precision. Exports trade about 0.03 mm of error for about 2.5× smaller files. | `q16d` everywhere. That saves disk, but loses precision for good. |
| D3 | The browse and annotate UI lives inside the Viser app. If the Phase 0 spike shows viser's GUI cannot carry a usable timeline, the fallback is a minimal Starlette page that hosts the timeline next to the viser scene. We do not fork the viser client. | One process and one UI toolkit. A fork (like kimodo-viser) lags upstream and forces a matching Python fork. | Forking the viser client. Building a separate htmx dashboard like artifacts-server's. |
| D4 | Exports use our own `simscope-player`, not viser's `as_html()`. | Slides need outside control of playback, and annotations must travel with the export. viser offers neither (issue #600; GUI state is excluded from recordings). | viser `as_html()` as the export path. |
| D5 | simscope feeds artifacts-server as producer and player. It does not replace artifacts-server's gallery. | artifacts-server owns remote hosting and auth, which are out of scope here. | Folding the remote gallery into simscope. |
| D6 | `simscope-player` lives in this repo. mkdeck vendors the tagged build. | One source of truth for the format and its reader. It also ends the mkdeck and artifacts-server viewer fork. | A separate JS package repo. |
| D7 | Vendor the needed parts of mjviser's conversion code, with attribution. Do not depend on mjviser. | mjviser is at 0.0.x and brings its own viewer and GUI, which we don't use. We need only the model-to-geometry conversion. | A pinned `mjviser` dependency. |
| D8 | Annotations live in per-run sidecar JSON, merged through git. There is no shared live store. | Diffable, portable with the folder, and no server state to lose. Multi-user hosting belongs to artifacts-server. | SQLite as the source of truth, or a shared annotation service. |
| D9 | Simulator support is MuJoCo (including MJX and Warp) and Isaac Lab 3.0+ only. Python is 3.12 or later. | A focused, high-performance library. Isaac Lab 3.0 requires Python 3.12, which matches the template. | Isaac Lab 2.x, Newton, Genesis, and other sources. Python 3.11. |
| D10 | Export formats are single-file HTML and the `.simscope` pack only. `.rbundle` is the only importer. | Each extra format is another path to test and keep correct. | `.glb`, `.viser`, MCAP, `.rrd`, and Zarr exporters, plus mkdeck, Brax, and `motion.npz` importers. |
| D11 | Pose blocks are compressed with deflate-raw. | Every browser decodes it natively with no JS. zstd and brotli save only 3–4% on poses, and Chrome decodes neither natively. | zstd with a vendored WASM decoder. |
| D12 | Performance budgets are acceptance criteria, checked by benchmarks in CI. | Performance is a primary goal, not a later polish step. | Measuring performance ad hoc. |
| D13 | D3 resolved: GO, the timeline stays inside Viser for v1 (Phase 0 spike plus a design review, 2026-09-30). Events are created from the keyboard at the playhead, using the `key` of each type in `event_types.json`, and corrected with a two-handle range slider. The event strip is a display-only HTML element, and overlapping events get lanes assigned on the server. Guard rails: no private viser API (drop slider `marks`); hotkeys that have no native widget meaning (`K` play/pause, `J`/`L` step); escape labels and validate colors before they reach HTML. | The workflow is keyboard-first, like video annotation tools, and dragging is only a correction gesture. The fallback would add a second HTTP surface, an iframe, and a playhead sync channel. | The Starlette timeline fallback, now. **Switch to it if** any of these holds: a required feature needs pointer input on the timeline (click a marker, click to seek, drag to create); compare mode needs more than about 4 lanes; two viser upgrades in a row break the strip or the hotkeys; or users report the range slider as the bottleneck. |
| D14 | Live viewing tails the recording on disk. `simscope serve` shows runs whose status is "recording" and picks up each window the recorder finishes, so latency is one block (default 100 frames; pass a smaller `block_frames` for snappier live views). The recorder has no network path to the server. | It is one mechanism for live and recorded runs, it survives either process crashing, and it needs no protocol, port, or discovery. | A push channel from `Recorder` to a running server (`live=True`), which needs a second protocol and process coupling. |
| D15 | Amends D10: besides `.rbundle`, simscope imports self-contained Brax HTML viewers (`var system` JSON). Both importers write through the normal recorder, so meshes dedup in the CAS. | The team's real rollouts on disk are 63 Brax viewer pages (13 MB each, almost all duplicated CAD meshes) and 23 `.rbundle` runs. An importer with a concrete consumer is in scope. | Leaving that data in legacy formats, or converting it through monorepo26's `core.viz3d`. |
| D16 | **Supersedes D3 and D13.** The viewer frontend is our own: a framework-free three.js player core shared by the lean `<simscope-player>` element and a React 19 + shadcn/Radix + Tailwind app; Python serves the library over HTTP (Starlette + uvicorn). Viser is dropped. Spec: [viewer v3](2026-09-30-simscope-viewer-v3.md); reviews: [architecture](../research/2026-09-30-frontend-architecture-review.md), [landscape](../research/2026-09-30-frontend-landscape.md). | Viser 1.1.1 has no orthographic camera, docks panels only relative to other panels, allows no custom components, and moves the camera from Python at 10 Hz over a websocket, which judders. Two independent Opus reviews agreed: it deletes ~11.6k lines of viser-bound Python for ~6.6k lines of TS (2.2k existing, 1k generated) plus ~1.3k lines of Python, on MIT/BSD dependencies measured at 321 KB gz in total. One renderer for serve and export. | Keep viser and restyle (cannot meet the requirements); viser for 3D with a separate shadcn page (two clients, still no ortho or smooth follow). |
| D17 | Panels are fixed slots (left library, right inspector, bottom timeline), resizable and collapsible on react-resizable-panels. No drag-to-dock. | Decided with the user 2026-09-30. Docking libraries are open-core (dockview) or dead (golden-layout); owning docking is ~1.5k lines. | Drag-to-dock. |
| D18 | Follow runs in the browser per rendered frame, with pose interpolation between frames, a critically damped target, x/y-only by default, and a target addressed as (env, body). | Smoothness needs the camera to move in the same tick as the poses; flooring 50 Hz data on a 60 Hz display repeats frames. Borrowed from Lichtblick/Rerun follow modes and Isaac Lab `ViewerCfg` addressing. | Server-side follow (viser's model). |
| D19 | Scale by tiers: a focus set (≤ triangle budget, full detail, follow/plots/contacts) over a crowd tier of one instanced proxy per env posed by a server-derived root-pose stream; decode in a Web Worker; env-subset window requests; byte-bounded window cache. | At 4,096 envs × 20 bodies one window decodes to 229 MB and 74M triangles a frame; nothing else fits. Borrowed from Genesis `rendered_envs_idx`. | Load whole packs and draw every env at full detail (does not work past ~64 envs). |
| D20 | Manual event and spatial annotation UI is removed. Marks come from the `annotations.py` API and from automatic highlight detection (`simscope.highlights`: robust-z peaks in contact force, acceleration, torque and root-height drops), cached under `.simscope/derived/` and baked into packs. Curation UI (rating, favourite, tags, notes) stays. | Hand-placing events with only visual feedback is impractical; peaks in physical signals are what people want to jump to (CS demo highlight model). | Keep the v2 event buttons and hotkeys. |
| D21 | Live tail is a 1 s poll of the partial manifest plus immutable block fetches. No WebSocket or SSE. | Blocks are already tailed on disk (D14); SSE spends one of the browser's six per-host connections per tab; WebSocket adds a protocol and a dependency. | SSE (landscape report), WebSocket. |
| D22 | Contacts are recorded by the adapters as a `contacts` arrows stream `[K, 6]`, zero-padded, MuJoCo first, then Isaac Lab `ContactSensor`. The viewer draws them for the focus set only. | No adapter records contacts today; the viewer cannot show what is not stored. Zeros deflate to nothing, so sparse contacts are cheap at any E. | A dedicated contacts stream kind (format change for no gain). |
| D23 | Every UI element must change what the user does next. Removed: the Complete badge, source badges on rows, the highlight reel, the Curation heading, the flag/status system and the tag UI. | User review of v3 (2026-09-30): information "rendered for the sake of it" made the GUI gimmicky. Spec: [viewer v3.1](2026-09-30-simscope-viewer-v3.1.md); rules: [UI guidelines](../design/ui-guidelines.md). | Keeping them as optional chrome. |
| D24 | Groups replace tags: one group per run, ordered groups in `.simscope/groups.json`, library shown by date (default) or by group, 5 rows per section plus "Show N more". | Moving runs into groups and date sections is the standard pattern in the tools the user uses; tags were never used. | Free-form tags; multi-group membership. |
| D25 | Highlights are general: the only built-in kinds are `contact` (net contact force) and `acceleration` (centre-of-mass acceleration), found as robust-score peaks and merged within 0.15 s. Developers add kinds with `highlights.register` or explicit annotation events. Revised 2026-10-01; the first version (landing, jump, fall, torque spike) was task-specific. | A viewer for MuJoCo and Isaac Lab rollouts must not hard-code the vocabulary of the vault and roll tasks used to build it; two physical signals every simulator provides generalise. | Task-named kinds; per-task thresholds. |
| D26 | Users can add free-text labels at timestamps (untyped events); the Labels lane exists only when a run has labels. The Marks lane is removed. Revises D20 for labels only. | User asked for custom labels at timestamps; an always-empty lane had no purpose. | No manual annotation at all. |
| D27 | Compare slots 1–4 have fixed palette colours (pane dot, highlight lane). Linked panes share camera orientation, ortho scale and target height, so z = 0 sits at the same screen row under every followed robot. | Comparing a 1 m wall against a 0.8 m wall needs grounds aligned on screen. | Per-pane independent cameras. |
| D28 | The right panel is Plots, then Metadata (a two-column table holding rating, favourite and notes), plus Envs for batched runs. | Plots are the panel's main use; caption-over-number stats read as decoration. | Run / Plots tabs with stat tiles. |
| D29 | Progress plots: the trace is coloured up to the playhead and ends in a dot, muted after it; a grey, draggable playhead; whole-run or rolling 2 s / 5 s windows. | Matches viser's realtime plots, which the user found clearer than a cursor over a static trace. | Static trace with a moving line. |
| D30 | Viewport overlays are individual toggle buttons (visual, collision, contacts, ground popover), then Export and theme, top-right; camera presets, frame and follow are one popover in the timeline bar. | Blender-style overlay toggles are faster than a stacked menu; the timeline bar had too many buttons. | A Display popover; a row of camera buttons. |
| D31 | The UI follows [`docs/design/ui-guidelines.md`](../design/ui-guidelines.md): Geist (shadcn's font, inlined, 29 KB), shadcn neutral tokens with no accent hue, colour only for identity (a validated 8-slot palette: runs A–D, highlight kinds), Pinned replaces favourites, and imported runs keep their original recording time as `created`. | The user rejected the system-mono readouts, all-caps captions and cyan accent; the guide traces each rule to Nielsen, Refactoring UI, Tufte, Apple HIG and shadcn's own source, and the palette was validated for colour-vision deficiency. Date sections need real dates (all 87 imports had the import time). | A coloured accent; Inter or the system stack; star/heart curation. |
| D32 | Names in lists are cut at 16 characters with `…` (full name on hover); the timeline bar is camera menu, centred transport, then readout, loop and speed. | User review, 2026-10-01: showing the end of a name filled the row edge to edge and was hard to read. | Middle truncation. |

**Note on the Isaac target:** "Isaac 3.0+" is read here as Isaac Lab 3.0+,
which runs on the Isaac Sim 6.x line. Isaac Sim's own numbering went from
2023.1 to 4.0, so it never had a 3.0 release. Correct this note if a
different target was meant.
