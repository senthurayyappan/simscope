# simscope related-work survey: logging / visualization / curation / annotation platforms

Snapshot date is 2026-09-29. Stars, licenses and release dates come from `gh api` and the PyPI JSON API. Rerun facts come from a shallow clone of `rerun-io/rerun` at `/private/tmp/claude-501/-Users-senthurayyappan-Projects-simscope/3cd0ceb1-4f12-4f06-ba0c-7c7e8581dba7/scratchpad/research/platforms/rerun` (paths below are `docs/content/...` in that clone). Other clones sit in the same directory: `fiftyone`, `lerobot-dataset-visualizer`, `meshcat-python`, `meshcat`, `mcap`, `uni-rlhf`. I did not build or run anything. Items I could not verify against a primary source are marked UNVERIFIED.

## 1. Executive summary

- **Rerun is the closest competitor, but it can't do the four things simscope is for.**
  - It has a built-in URDF importer, a catalog server (`rerun server -d name=DIR` turns a folder of `.rrd` files into a dataset), and segment properties that show up as queryable columns.
  - It has no user annotation model and no favorite/tag/rate UI.
  - It has no official standalone HTML. The web viewer wasm is ~42 MB raw from app.rerun.io (~14 MB compressed) and ~51 MB in the npm package.
  - The notebook widget loads its assets from `https://app.rerun.io` unless you set `RERUN_NOTEBOOK_ASSET=inline`. `nbconvert --to=html` is documented as broken (rerun issue #9304, open).
  - `.rrd` files are only guaranteed to open across adjacent minor versions. That is poor for an archive of thousands of rollouts.
  - The `rerun-sdk` wheel is 145–168 MB, and the SDK is pre-1.0 at 0.38.1.
  - Verdict: interoperate (optional `.rrd` export) and copy its catalog object model. Do not depend on it.
- **Nobody offers what simscope wants in one place.** I found no tool that combines rigid-body scrubbing, thousands of rollouts, durable annotations and a CDN-free single-file export. The partial matches:
  - FiftyOne has the best curation UX, and in-app annotation includes temporal "Events" and 3D cuboids. It needs MongoDB and has no standalone export.
  - Foxglove has the best timeline-event model, but the app is closed-source and the events live in its hosted Data Platform.
  - meshcat's `static_html()` has the best offline export precedent, but it is stale and has no curation.
- **Keep annotations out of the rollout file.** Foxglove keeps events in its Data Platform, not in the MCAP. LeRobot's visualizer writes `meta/lerobot_annotations.json` as a sidecar. Rerun `.rrd` layers are immutable. The pattern is a sidecar JSON per rollout, plus a rebuildable SQLite index.
- **The annotation vocabulary exists; copy it.**
  - Foxglove Events: time range plus typed properties, with admin-defined event types that have a color and a schema.
  - FiftyOne `TemporalDetection`: `label` plus `support` of `[first,last]` frames, plus `tags`.
  - Label Studio `timelinelabels` ranges, and CVAT tracks with `outside`/`occluded`/`keyframe` per frame.
  - rl-teacher comparisons with `left|right|tie|abstain`. RoboArena records progress 0–100, a preference, and a free-text rationale.
- **Two cheap interop wins.**
  - Write MCAP (MIT, Python `mcap` 1.5.0) as an optional export. Foxglove, Lichtblick (MPL-2.0) and FiftyOne 1.22 (native "multimodal" MCAP episodes with a shared playback clock) can then open the data.
  - Keep a derived `index.sqlite` so Datasette (Apache-2.0, 11.5k stars) can browse it for free.
- **The offline-HTML pattern is proven and small.** meshcat's `static_html()` inlines `main.min.js` (2.2 MB) plus msgpack draw commands into one file. The only external URL in that JS is a WebXR controller-profile CDN, used only for VR. This matches what artifacts-server's `export_html` already does. Rerun's route would be ~50+ MB per file.
- **artifacts-server already covers favorite, tags, notes, compare and saved views.** It has no timeline annotations, no ratings and no pairwise comparisons. Its curation state lives in SQLite, so it can't be reviewed in git.
- **Dashboard frameworks are not the bottleneck.** Streamlit, Gradio, marimo, Panel, NiceGUI and Trame are not a good fit. Keep FastAPI/htmx-style serving and iframe Viser.

## 2. Comparison matrix

Legend: Y = yes, P = partial, N = no. "Rigid-body" means time-scrubbed articulated or rigid-body playback.

| Tool | 3D rigid-body playback | Multi-rollout browse | Tag/rate | Timeline annotations | Standalone offline HTML | CDN-free | License | Python API | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Rerun 0.38.1 | Y (URDF, Transform3D, meshes) | Y (catalog server, folder as dataset) | P (properties as columns; no UI) | N (StateChange lanes only; bookmarks #7274 open) | N (see §3) | N by default (app.rerun.io) | Apache-2.0 / MIT | Y | interoperate, learn |
| Foxglove app | Y (URDF, 3D panel) | Y (hosted Data Platform) | Y (Events, hosted) | Y (Events + Event Types) | N | N/A | proprietary; Studio repo archived 2024-07 | P (`foxglove-sdk` 0.28.0, MIT) | interoperate via MCAP, learn |
| Lichtblick 1.29.1 | Y | P (open files, tabs) | N | N | N | Self-hostable (docker) | MPL-2.0 | N | ignore, MCAP-compatible |
| MCAP 1.5.0 | n/a (container) | n/a | P (Metadata records) | P (Attachments) | n/a | n/a | MIT | Y | interoperate (export format) |
| meshcat-python 0.3.2 / Drake Meshcat | Y (keyframe animation) | N | N | N | Y (`static_html`) | Y (except VR CDN) | MIT | Y | learn (offline pattern) |
| FiftyOne 1.22.1 | P (MCAP 3D tile; static `.fo3d`) | Y | Y (sample and label tags, saved views) | Y (Temporal Detections, in-app) | N | N/A | Apache-2.0 | Y | learn heavily, interoperate |
| LeRobot dataset visualizer | Y (URDF, SO-100/101, OpenArm only) | Y | P (flag episodes, session-only) | Y (language atoms) | N | N | Apache-2.0 | N (Next.js + FastAPI backend) | learn |
| Label Studio 1.23.2 / CVAT 2.77.0 | N | Y | Y | Y (video timeline, tracks) | N | N | Apache-2.0 / MIT | Y (SDKs) | learn schema; export target |
| W&B 0.30.0 | N (static Object3D files) | Y (runs) | Y | N | N | N (SaaS) | MIT | Y | ignore; `wandb.Html` for upload |
| TensorBoard 2.21.0 | P (mesh per step) | Y (logdir) | N | N | N | N | Apache-2.0 | Y | ignore |
| Aim 3.29.1 | N | Y | Y | N | N | N | Apache-2.0 | Y | ignore (dormant) |
| MLflow 3.16.1 | N | Y | Y (tags, notes) | N | N | N | Apache-2.0 | Y | ignore |
| ClearML 2.1.12 / Comet | N / P (Comet 3D panel: points, boxes) | Y | Y | N | N | N | Apache-2.0 / proprietary | Y | ignore |
| Streamlit / Gradio / marimo / Panel | N (Gradio Model3D: static file) | shell only | shell only | N | N | N | Apache-2.0 / BSD-3 | Y | ignore |
| NiceGUI 3.17.1 / Trame 4.0.0 | P (`ui.scene`; VTK) | shell only | N | N | N (Trame/PyVista: static scene) | N | MIT / Apache-2.0 | Y | ignore |
| mjviser | Y (MuJoCo on Viser) | N | N | N | N | Y (self-served) | Apache-2.0 | Y | learn (closest Viser prior art) |
| Uni-RLHF / rl-teacher | video clips | Y | Y (labels) | keypoints | N | N | MIT | P | learn schema |

## 3. Per-tool notes

### Rerun — https://github.com/rerun-io/rerun

- **Stats:** Apache-2.0 repo (PyPI: MIT OR Apache-2.0), 11.5k stars, 0.38.1 released 2026-09-16.
- **Data model:** the `.rrd` format is a sequence of `SetStoreInfo` and Arrow-IPC chunk messages plus an optional footer index, laid out per "Sorbet" (`concepts/logging-and-ingestion/rrd-format.md`). Timelines are first-class.
- **Robot logging:** the built-in URDF importer loads meshes and joint frames. You then send `Transform3D` with named `parent_frame`/`child_frame` (`howto/logging-and-ingestion/urdf.md`). I found no MuJoCo or Isaac integration in the docs. You would map body poses to Transforms yourself.
- **Catalog (0.27+; "data layer" blog, https://rerun.io/blog/data-layer-for-robot-learning):**
  - Datasets contain segments (one `.rrd` each, keyed by recording id). Segments have named layers; a layer is immutable, and re-registering it overwrites it.
  - Datasets can carry a blueprint and up to 12 static "assets" (URDF or mesh, at most 300 MiB total). Names with `.` render as a directory tree (`concepts/query-and-transform/catalog-object-model.md`).
  - Recording properties written with `rr.send_property()` become columns in the segment table you can filter and sort on (`concepts/query-and-transform/properties-and-segments.md`).
  - `rerun server -d name=DIR` loads a folder of RRDs as a dataset (`reference/cli.md`, `rerun server`). The OSS server keeps catalog metadata in memory and reads data on demand only for RRDs that have a footer (`howto/query-and-transform/overview.md`). The managed "Rerun Hub" is a private-preview commercial product.
- **Annotation gap:**
  - `AnnotationContext` only maps class ids to labels and colors. No user-authored timeline notes exist.
  - The `StateChange` archetype plus the state-timeline view draws colored lanes over time, but only as log-time data.
  - Open issues: bookmarks #7274 (opened 2024-08), a `Flag` component #10821, and timeline-selection events #10835. The catalog page says layers can hold "annotations", but that means re-registering a new immutable `.rrd` layer per edit.
- **Standalone HTML: no.**
  - Web viewer wasm is 42.4 MB raw from app.rerun.io (~14 MB stored), and the npm `@rerun-io/web-viewer` is 51.6 MB unpacked (16 MB tarball).
  - `rerun_notebook` defaults to `https://app.rerun.io/version/<v>/notebook/widget.js`. `inline` embeds about 31 MiB, with a known leak (`rerun_notebook/README.md`).
  - The npm package version must match the SDK version (`howto/integrations/embed-web.md`).
  - UNVERIFIED: whether inlining wasm as base64 into one HTML file works in practice. It would exceed ~55 MB per file, and I found nobody who has done it.
- **Compatibility:** "we only guarantee compatibility across adjacent minor versions" (`getting-started/data-in.md`). `rerun rrd migrate` exists.
- **Weight:** `rerun-sdk` wheels are 145–168 MB.
- **Verdict:** interoperate (optional `.rrd` writer, or `rerun server -d` for power users) and learn from the dataset/segment/layer/asset model.

### Foxglove and MCAP

- **Foxglove app:**
  - The Studio repo (https://github.com/foxglove/studio) is archived, last push 2024-07-18. The current app is proprietary with a hosted Data Platform.
  - The docs describe Events as time ranges (zero duration allowed) with optional metadata. Admin-defined Event Types carry a name, a color and typed properties (text, bool, number, single/multi-select). Events are created with `Cmd+E` at the playhead, and you drag to resize them on the playback bar. Select two or more events and choose Compare for the multi-recording view (https://docs.foxglove.dev/docs/data/events).
  - Layouts are JSON, with personal and org scopes and history (https://docs.foxglove.dev/docs/visualization/layouts).
  - Video export is desktop-only, Enterprise-only, and watermarked (https://docs.foxglove.dev/docs/visualization/video-export).
  - The "two years on" post says Studio 1.x had no catalog, events, devices or search (https://foxglove.dev/blog/foxglove-vs-foxglove-studio-two-years-on).
- **Lichtblick:** https://github.com/Lichtblick-Suite/lichtblick is a Foxglove Studio fork, MPL-2.0 (BMW AG and Foxglove copyright headers). It has 1.1k stars and v1.29.1 (2026-09-08). It runs in the browser or as a desktop app, and Docker `ghcr.io/lichtblick-suite/lichtblick` gives a self-hosted web app. It has no events or curation.
- **MCAP:** https://github.com/foxglove/mcap, MIT, 1.1k stars, Python `mcap` 1.5.0 (2026-09-24).
  - It is a chunked, indexed, append-only container with `Metadata` (name plus string map) and `Attachment` records (`website/docs/spec/index.md`).
  - Annotations should not go inside it, because it is append-only and CRC-protected.
- **Foxglove SDK:** `foxglove-sdk` 0.28.0 (2026-09-29, MIT) can write MCAP and stream over WebSocket.
- **Verdict:** interoperate through MCAP export and learn from Events plus Event Types. Do not depend on the Foxglove app.

### meshcat / meshcat-python / Drake Meshcat

- **Repos and releases:**
  - meshcat-python (https://github.com/meshcat-dev/meshcat-python) is MIT with 302 stars. Its last commit is 2023-08 and its last PyPI release is 0.3.2 (2021-11-07).
  - The JS repo (meshcat-dev/meshcat) is MIT with 340 stars, and its `dist/` is committed. It has only a v0.1.0 (2021) release, though it was pushed 2026-06.
- **`static_html()`:** `zmqserver.py` (`get_scene`) writes one file containing `main.min.js` inline plus the msgpack-encoded draw commands. That includes `SetAnimation` keyframe tracks, so it is scrubbable. `main.min.js` is 2.23 MB.
- **CDN check:** the only external URL in `main.min.js` is `cdn.jsdelivr.net/npm/@webxr-input-profiles/assets`, a controller-profile loader for VR. Drake's header states "AR/VR mode is not currently supported in offline mode (i.e., when saving as StaticHtml())" (`geometry/meshcat.h`).
- **Drake Meshcat (C++):** `StartRecording`, `PublishRecording` and `StaticHtml()` do the same thing (https://github.com/RobotLocomotion/drake).
- **Verdict:** learn (inline viewer plus binary command stream is a ~2–3 MB offline recipe). Do not depend on it.

### FiftyOne — https://github.com/voxel51/fiftyone

- **Stats:** Apache-2.0, 11.1k stars, v1.22.1 (2026-09-28/29). The backing store is MongoDB (`fiftyone-db` bundles mongod; `setup.py` pins pymongo and motor).
- **Curation UX:**
  - Sample tags and label tags are a first-class feature (`docs/source/user_guide/app.rst`, "Tags and tagging").
  - Saved views are named, with descriptions (`using_views.rst`).
  - The grid supports filters, selection, bulk tagging, and a plugin/operator system.
- **3D and multimodal:**
  - `.fo3d` scenes are static trees of meshes and point clouds, with 3D cuboid and polyline labels stored as `Detection.location/dimensions/rotation` (`using_datasets.rst`, 3D datasets).
  - The 1.22 "multimodal" datasets treat each MCAP or LeRobot v3 episode as a sample. A tiled viewer (image, 3D, plot, map, state/action) shares one playback clock, and it is available to all users (`docs/source/user_guide/multimodal.rst`).
  - The 3D tile renders point clouds, scene-update primitives, pose trajectories and frustums. UNVERIFIED: whether it renders articulated robot meshes or URDF. I grepped the docs and found no URDF support.
  - The SDK also infers a multimodal media type for `.rrd` (release notes), but I did not verify whether the App plays `.rrd`.
- **Annotations:** in-app annotation (OSS since 1.13.0) supports Classification, Detections, 2D and 3D polylines, 3D cuboids, and "Events (Temporal Detections)" (`annotation.rst`). `TemporalDetection` has `label`, `support` as inclusive integer `[first,last]` frames, and `confidence`, and every label has `tags` (`fiftyone/core/labels.py`).
- **Export:** none I could find.
- **Verdict:** learn heavily. Interoperate later by emitting MCAP or a FiftyOne-loadable layout, and by exporting annotations as `TemporalDetections`. It is too heavy to use as a dependency.

### Hugging Face LeRobot dataset visualizer

- **Repo:** https://github.com/huggingface/lerobot-dataset-visualizer, Apache-2.0, 132 stars, last commit 2026-09-28, no releases. The stack is Next.js, three.js, urdf-loader and hyparquet. The main `huggingface/lerobot` repo has 27.9k stars and v0.6.1 (2026-08-03).
- **Curation features:**
  - Episode navigation, synchronized video and charts, and a stats panel.
  - A Filtering panel: flag problematic episodes, then emit a `lerobot-edit-dataset ... delete_episodes` CLI command. Flags live only in `sessionStorage` (`src/context/flagged-episodes-context.tsx`), so they are not durable.
  - A 3D URDF viewer for SO-100, SO-101 and OpenArm only.
- **Annotation backend:**
  - An Annotations panel edits LeRobot v3.1 "language atoms" (`role, content, style, timestamp, camera, tool_calls`), split into `language_persistent` (subtask, plan, memory) and `language_events` (per-frame).
  - The FastAPI backend (`backend/app.py`) writes them to `meta/lerobot_annotations.json` as a sidecar, and snaps event timestamps to exact source-frame timestamps.
- **Offline:** not applicable; it is a server app.
- **Verdict:** learn (sidecar location, frame snapping, flag-then-batch-action). Interoperate only if simscope ever exports episodes as LeRobot datasets.

### Label Studio, CVAT, ELAN, W3C

- **Label Studio:** https://github.com/HumanSignal/label-studio, Apache-2.0, 28.4k stars, 1.23.2 (2026-09-29). Video timeline result is `{"value":{"ranges":[{"start":3,"end":5}],"timelinelabels":["Moving"]}}` (https://labelstud.io/tags/timelinelabels). It also has `Pairwise`, `Rating`, `Choices` and `TimeSeriesLabels` tags.
- **CVAT:** https://github.com/cvat-ai/cvat, MIT, 16.8k stars, v2.77.0 (2026-09-28). Its video XML has `<track id label source>` with per-frame shapes carrying `frame`, `outside`, `occluded` and `keyframe`, and interpolation between keyframes (https://docs.cvat.ai/docs/dataset_management/formats/format-cvat/). That is the pattern for a moving 3D region.
- **ELAN EAF:** tiers hold time-aligned annotations via `TIME_SLOT` references, with `CONTROLLED_VOCABULARY` entries (https://www.mpi.nl/tools/elan/EAF_Annotation_Format.pdf). This is the source for named layers ("tiers") and controlled vocabularies.
- **W3C Web Annotation:** `motivation`, plus `target` with a `FragmentSelector` such as the media-fragment `t=` (https://www.w3.org/TR/annotation-model/).
- **Verdict:** learn schemas. Label Studio JSON is an export target only.

### Preference and rating tools

- **rl-teacher** (https://github.com/nottombrown/rl-teacher): MIT, 565 stars, dormant since 2023-01. Its Django `Comparison` model has `media_url_1/2`, `response_kind='left_or_right'`, `response ∈ {left,right,tie,abstain}`, `shown_to_tasker_at`, `responded_at`, `priority` and `note`.
- **Uni-RLHF** (https://github.com/pickxiguapi/Uni-RLHF-Platform): MIT, 42 stars, last push 2024-11. It is a Flask plus Vue platform with project-level `feedback_type` (Comparative, Attribute, Evaluative, Keypoint, Visual per https://uni-rlhf.github.io/), multi-annotator assignment, and `label_info` stored as a JSON string.
- **RoboArena** (https://arxiv.org/abs/2506.18123): a double-blind A/B protocol. Each episode records a progress score 0–100, a preference and a free-text rationale. The code is at https://github.com/robo-arena/roboarena (115 stars).
- **B-Pref:** a scripted teacher, no UI.
- **Verdict:** learn schema.

### Experiment trackers

- **W&B:** MIT, 11.3k stars, wandb 0.30.0 (2026-09-09).
  - `wandb.Object3D` takes obj, gltf, glb, babylon, stl and `pts.json` files, or numpy point clouds with boxes and vectors (`wandb/sdk/data_types/object_3d.py`). These are static objects with no articulated playback.
  - The docs show a notice "The Weights & Biases domain will change on September 30".
  - Verdict: ignore, but `wandb.Html` could host simscope's standalone HTML for slide-deck users.
- **TensorBoard:** Apache-2.0, 7.2k stars, 2.21.0 (2026-06-29). The mesh plugin takes vertices, faces and colors per step (`tensorboard/plugins/mesh/README.md`). It has no tagging. Ignore, but it is the classic `--logdir` scan-a-folder model.
- **Aim:** Apache-2.0, 6.3k stars, v3.29.1 (2025-05-08), last commit 2025-12-31. It is effectively dormant. Ignore.
- **MLflow:** Apache-2.0, 28.2k stars, v3.16.1 (2026-09-17). It has run tags and notes but no 3D. The filesystem backend is deprecated per mlflow issue #18534 (search-result summary; the primary issue was not read, UNVERIFIED). Ignore.
- **ClearML** (2.1.12, 2026-08-19) and **Comet:** Comet's 3D panel handles `log_points_3d` points and boxes across steps and experiments (https://www.comet.com/docs/v2/guides/comet-ui/experiment-management/visualizations/3d-panel/). ClearML's 3D features are UNVERIFIED. Both are SaaS-style. Ignore.

### Dashboards and shells

- **Streamlit** 1.64.0, **Gradio** 6.29.0, **marimo** 0.25.0, **Panel** v1.9.4, **NiceGUI** v3.17.1 (MIT, has `ui.scene` on three.js), **Trame** 4.0.0 (Apache-2.0): all are usable as an app shell but add a framework dependency without solving scrubbing or annotation.
- **Gradio `Model3D`:** shows one static .obj/.glb/.stl/.gltf/.splat/.ply file (`gradio/components/model3d.py`).
- **PyVista/trame:** `export_html` (now `plotter.trame.export_html`) exports a static scene. UNVERIFIED: its CDN behavior.
- **Verdict:** ignore. marimo/anywidget is worth a look only if a notebook embed is wanted.

### Directory browsers

- **Datasette:** Apache-2.0, 11.5k stars, 0.65.5 (2026-09-16). Point it at SQLite and browse; a derived `index.sqlite` gets this for free.
- **Guild AI** (last release 2022-05, last push 2025-04), **Sacred** (0.8.7, 2024-11), **Omniboard** (last push 2023-02): dormant. **DVC** (3.67.1) Studio is SaaS; the useful idea is git-tracked params and metrics.
- **Verdict:** interoperate with Datasette; ignore the rest.

### mjviser

https://github.com/mujocolab/mjviser is Apache-2.0 with 263 stars, last push 2026-08-07, and has no GitHub releases. It is a MuJoCo viewer on Viser with keyframes, contacts and forces, and its README says `Viewer(model, data)` exposes a normal Viser server. The README also mentions a `motion_playback.py` example with a scrubber, per the search result (not read in source, UNVERIFIED). It has no browsing of many rollouts and no export. Learn from it. It is a possible upstream or peer project.

## 4. Annotation data model recommendation

**Storage (sidecar-first, SQLite as cache).**
- Canonical: `<rollout_dir>/annotations.json`, pretty-printed with sorted keys, written atomically. This is git- and diff-friendly, so annotations survive moving or copying a folder.
- Cross-rollout records go in `<root>/.simscope/comparisons.jsonl`, append-only, one JSON object per line.
- The event-type registry goes in `<root>/.simscope/event_types.json`, following Foxglove Event Types and ELAN controlled vocabularies.
- Derived: `<root>/.simscope/index.sqlite` (gitignored, rebuildable by scanning), so thousands of rollouts filter fast. Datasette can browse it.
- Provenance for this split: LeRobot sidecar `meta/lerobot_annotations.json`; Foxglove events kept outside the recording; artifacts-server `tags` table as the index shape.
- Key rollouts by content hash, with the path as a hint, so annotations follow renames (artifacts-server already uses `content_hash`).

```jsonc
// <rollout_dir>/annotations.json
{
  "schema_version": 1,
  "rollout": {"id": "blake3:9f2c…", "path_hint": "sweep_07/run_0123", "dt": 0.002, "n_frames": 5000},

  // Marks: cheap, single-user flags (LeRobot flagged episodes, artifacts-server favorite, rerun #10821 Flag)
  "marks": {"favorite": true, "flag": "review", "status": "candidate", "tags": ["falls", "sweep_07"]},

  // Free text (artifacts-server notes)
  "notes": [{"id": "01J…", "author": "senthura", "created": "2026-09-29T21:04:00Z", "text": "Front-left foot slips."}],

  // Ratings (RoboArena progress 0–100; Uni-RLHF evaluative; Label Studio Rating)
  "ratings": [{"id": "01J…", "rater": "senthura", "scale": "score100", "value": 62,
               "criterion": "task_progress", "rationale": "reaches target, then falls"}],

  // Timeline events / segments (Foxglove Events; FiftyOne TemporalDetection; Label Studio ranges; LeRobot language_events)
  "events": [
    {"id": "01J…", "type": "fall", "label": "falls at t=3.2s",
     "t0": 3.200, "t1": 3.200,            // seconds; t0==t1 => instant (Foxglove zero-duration)
     "f0": 1600, "f1": 1600,              // inclusive frame indices, snapped (FiftyOne support, LeRobot snap)
     "props": {"severity": "major"},      // typed by event_types.json (Foxglove Event Types)
     "author": "senthura", "created": "2026-09-29T21:05:00Z", "updated": "2026-09-29T21:05:00Z"}
  ],

  // 3D annotations (FiftyOne Detection location/dimensions/rotation; CVAT keyframes+outside; W3C Point/SvgSelector)
  "spatial": [
    {"id": "01J…", "kind": "box",           // point | box | sphere | polyline
     "frame_ref": "world",                  // or "body:<name>" for body-attached
     "geometry": {"location": [0.4, 0.1, 0.02], "dimensions": [0.2, 0.2, 0.1], "rotation": [0, 0, 0]},
     "keyframes": [{"t": 3.20, "geometry": {…}}, {"t": 3.60, "outside": true}],  // CVAT-style track, optional
     "label": "foot slip region", "event_id": "01J…"}
  ]
}
```

```jsonc
// <root>/.simscope/comparisons.jsonl  (one object per line)
// rl-teacher Comparison + RoboArena + Uni-RLHF comparative feedback
{"id": "01J…", "a": {"rollout": "blake3:9f2c…", "t0": 0, "t1": 5.0}, "b": {"rollout": "blake3:71ab…", "t0": 0, "t1": 5.0},
 "choice": "a",                      // a | b | tie | abstain
 "criterion": "overall", "rationale": "less torso pitch",
 "rater": "senthura", "blind": false, "shown_at": "…", "responded_at": "…"}

// <root>/.simscope/event_types.json  (Foxglove Event Types)
{"fall": {"name": "Fall", "color": "#d33", "props": {"severity": {"type": "select", "options": ["minor", "major"]}}}}
```

**Design notes.**
- **Time:** store seconds and frames. FiftyOne's `support` is frames and LeRobot snaps to source-frame timestamps; seconds are friendlier to humans and to Foxglove. Keep both and snap on write.
- **IDs and authors:** use ULIDs plus `author`/`created`/`updated`, per Foxglove's creator filter. This also lets you merge two people's sidecars.
- **Layers/tiers:** an optional `layer` string on events would give ELAN-style tiers, but it is not required for v1.
- **Interop mappings:** events map to FiftyOne `TemporalDetections`, Foxglove Events (API), Label Studio `timelinelabels`, a W3C Annotation (`FragmentSelector t=`), and a Rerun `StateChange`/`TextLog` layer. All are lossless enough for one-way export.
- **Not recommended:** SQLite as the source of truth (artifacts-server's current state; not reviewable in git), or writing into `.rrd`/MCAP (immutable or append-only).

## 5. UX patterns worth copying

- **Playhead-anchored event creation.** `Cmd+E` creates a zero-duration event at the playhead; drag edges on the playback bar to make it a segment; the sidebar lists events; events appear above the playback bar and are colored by type (Foxglove: https://docs.foxglove.dev/docs/data/events, https://foxglove.dev/blog/announcing-foxglove-events).
- **Multi-select then Compare.** Shift-select a range of events or rollouts, then open them side by side on one shared timeline. Each event stays anchored to its source's timestamp when you shift the offset (Foxglove Comparison mode). artifacts-server's 4-pane master clock already fits.
- **Typed event categories with validated properties**, so filtering and search work (`weather:rain`-style key:value search in Foxglove Events).
- **Sample and label tags as first-class, with bulk tagging on the grid selection, plus named saved views with descriptions** (FiftyOne `app.rst` "Tags and tagging"; `using_views.rst`).
- **Flag then batch action.** Flag bad episodes, then emit a ready-to-run CLI command such as `lerobot-edit-dataset ... delete_episodes` (LeRobot visualizer `filtering-panel.tsx`). Its flags are session-only; persist them, unlike the original.
- **Frame-snap on save** (LeRobot backend `POST /api/episodes/{ep}/atoms`).
- **Dot-delimited names render as a directory tree** (Rerun catalog).
- **Named views and time-range bookmarks** as blueprint-like presets. Rerun's #7274 shows the demand; simscope's saved-view snapshot could include them.
- **Double-blind, priority-ordered pairwise queue** with `abstain`/`tie`, shown-at and responded-at timestamps, and a rationale field (rl-teacher, RoboArena).
- **Offline single-file export = inlined viewer JS + msgpack command stream** (meshcat `zmqserver.py`); keep VR or CDN loaders out of the bundle.
- **Point a server at a folder and derive an index** (`rerun server -d name=DIR`; TensorBoard `--logdir`; Datasette on SQLite).

## 6. Caveats and unverified items

- Foxglove's paid tiers, on-prem "Standalone License" terms and the Data Platform events API schema were not read in detail. Only the docs page fetched is cited.
- Whether FiftyOne's 3D tile renders articulated robot meshes or URDF, and whether its App opens `.rrd`, is UNVERIFIED.
- Rerun inline single-file HTML feasibility and real file size are UNVERIFIED (extrapolated from asset sizes). A `rerun server` scale test with thousands of RRDs was not run.
- Viser's PyPI metadata says "MIT" but its LICENSE file is Apache-2.0. Check before dependency decisions.
- The MLflow file-store deprecation, ClearML 3D capability, PyVista/trame export CDN behavior, and the mjviser `motion_playback.py` scrubber are UNVERIFIED.
- The relevance of the W&B domain-change notice to the CoreWeave acquisition is UNVERIFIED.
- Isaac Sim data paths (USD/Replicator) were out of scope.

## 7. Key paths

- Rerun docs clone: `/private/tmp/claude-501/-Users-senthurayyappan-Projects-simscope/3cd0ceb1-4f12-4f06-ba0c-7c7e8581dba7/scratchpad/research/platforms/rerun/docs/content/`
- FiftyOne: `.../platforms/fiftyone/docs/source/user_guide/{multimodal,annotation,app,using_datasets}.rst`, `.../platforms/fiftyone/fiftyone/core/labels.py`
- LeRobot visualizer: `.../platforms/lerobot-dataset-visualizer/{backend/app.py,src/types/language.types.ts,src/components/filtering-panel.tsx}`
- meshcat: `.../platforms/meshcat-python/src/meshcat/servers/zmqserver.py`, `.../platforms/meshcat/dist/main.min.js`
- MCAP spec: `.../platforms/mcap/website/docs/spec/index.md`
- Uni-RLHF: `.../platforms/uni-rlhf/uni_rlhf/models.py`
- artifacts-server references: `~/Projects/artifacts-server/README.md`, `~/Projects/artifacts-server/docs/specs/2026-06-30-native-rollout-viewer-design.md`, `~/Projects/artifacts-server/artifacts_server/db.py`
