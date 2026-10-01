# simscope viewer v3: own frontend

**Status:** Accepted for implementation, 2026-09-30. Interfaces between the
work streams: [viewer v3 contracts](2026-09-30-simscope-viewer-v3-contracts.md). Supersedes
[viewer UI v2](2026-09-30-simscope-viewer-ui-v2.md) §2–§8 and decisions D3
and D13 (see D16–D22 in the [proposal](2026-09-30-simscope-proposal.md)).
Grounded in two reviews:
[frontend-architecture-review](../research/2026-09-30-frontend-architecture-review.md)
(scale arithmetic, ownership accounting, migration) and
[frontend-landscape](../research/2026-09-30-frontend-landscape.md)
(dependency survey, borrowed designs).

## 1. Why v2 is replaced

The v2 demo on the real library showed problems that viser cannot fix:

1. **Follow judders.** Follow ran in Python at 10 Hz and sent `look_at` over
   the websocket, separately from the poses. The camera lands a frame after
   the robot moves, in 100 ms steps.
2. **No orthographic camera.** Iso/front/side/top must be orthographic, as in
   artifacts-server and mkdeck. Viser's client has no orthographic camera.
3. **No bottom timeline.** Viser panels dock only relative to other panels.
   The timeline belongs at the bottom centre, wide, with camera and speed
   controls around it.
4. **Generic, dated look.** Mantine widgets, full-width buttons, pooled
   "chips" to fake selection state, `name · 8.0 s` labels. The UI must be
   built from shadcn components with a real information hierarchy.
5. **Manual annotation is not useful.** Dropping events by hand with only
   visual feedback is impractical. Marks must come from an API and from
   automatic highlight detection.
6. **Scale.** Isaac runs have thousands of envs. Following, plotting and
   contact drawing must adapt; the current player loads whole packs and
   decodes on the main thread, which does not survive 4,096 envs.

## 2. Architecture

```text
┌─────────────────────────── browser ────────────────────────────┐
│ App shell (React 19 + shadcn/Radix + Tailwind 4)               │
│   library · inspector · timeline · plots · compare · theme     │
│        │ props/refs                     ▲ subscribe            │
│        ▼                                │                      │
│ Player core (framework-free TS, one module)                    │
│   Source ─ decode worker ─ window cache ─ scene ─ camera       │
│   clock (master) ─ interpolation ─ tiers ─ overlays ─ ground   │
│        ▲                                                       │
│   <simscope-player> element (lean controls; decks, mkdeck)     │
└────────┼───────────────────────────────────────────────────────┘
         │ HTTP (Range, ETag, immutable CAS)      inline pack (export)
┌────────┴──────────── python ───────────────────────────────────┐
│ simscope.server (Starlette + uvicorn)                          │
│   /api/runs · run · scene · assets · windows?envs= · changes   │
│   derived cache: root stream · per-env summaries · envelopes   │
│   highlights detector (numpy) · annotations API                │
│ library · index · recorder · importers · export  (unchanged)   │
└────────────────────────────────────────────────────────────────┘
```

- **One player core, two shells.** The core is framework-free and is the
  only renderer. The lean `<simscope-player>` element (decks, mkdeck) and
  the React app (`simscope serve`, full standalone export) both mount it.
  React never enters the core.
- **The clock never enters React state.** One `requestAnimationFrame` loop
  advances a master clock in a zustand store read outside render; players,
  the timeline playhead and plot cursors update the DOM through refs.
- **Viser is dropped.** The viser viewer (`simscope.viewer`) and the `viser`
  dependency were deleted on 2026-09-30; `simscope serve` serves this app.

## 3. Dependencies

Runtime, all bundled into the wheel and into exports, no CDN:

| Dependency | Version | Licence | gz | Role |
| --- | --- | --- | --- | --- |
| three | 0.186.1 | MIT | ~143 KB | renderer (upgrade from r150) |
| camera-controls | 3.1.2 | MIT | 10.5 KB | orbit, ortho, damped follow, presets, JSON state |
| react, react-dom | 19.3 | MIT | 69 KB | app shell only |
| radix-ui + shadcn copies + lucide-react | 1.6 / CLI 4.21 / 1.49 | MIT/ISC | ~54 KB | UI primitives, icons |
| tailwindcss | 4.3 | MIT | build-time | styling, theme tokens |
| zustand | 5.0 | MIT | 0.5 KB | app and clock state |
| react-resizable-panels | 4.14 | MIT | 19 KB | sidebars, collapsible timeline |
| @tanstack/react-virtual | 3.14 | MIT | 8 KB | run list, env list |
| uplot | 1.6.32 | MIT | 23.5 KB | plots with a moving cursor |
| starlette, uvicorn (Python) | 1.7 / 0.54 | BSD-3 | – | server; replaces viser |

Dev: esbuild 0.28 (the only bundler; deterministic committed output as
today), TypeScript, `node --test`, Playwright (run from pytest).
Rejected with reasons in the landscape report §9: R3F/drei, dockview,
golden-layout, Rerun, Plotly/ECharts/Chart.js, lightweight-charts, SSE and
WebSocket for the live tail (a 1 s poll of the partial manifest suffices).

Single-maintainer risks: camera-controls and uPlot. Both are small and MIT;
vendoring is the exit.

## 4. Layout

Fixed slots, resizable and collapsible (react-resizable-panels; no
drag-to-dock, decided with the user):

```text
┌────────────┬──────────────────────────────────────┬──────────────┐
│ LIBRARY    │                                      │ INSPECTOR    │
│ search     │                                      │ Run · Envs   │
│ filters    │            viewport                  │ · Plots      │
│ run rows   │                                      │              │
│ (virtual)  │                                      │              │
├────────────┴──────────────────────────────────────┴──────────────┤
│ [iso][front][side][top][frame][follow ▾]  ⏮ ◀ ▶ ▶ ⏭  [0.5×▾] ⟳ │
│ ruler ────────────────●──────────────────────────────── 2.14 s  │
│ ▲ highlights   ▲   ▲        ▲         (marks lane, read-only)   │
└──────────────────────────────────────────────────────────────────┘
```

- Left sidebar (Library), right sidebar (Inspector), bottom Timeline. Each
  collapses to a thin handle; the timeline minimises to a single transport
  row. Sizes persist in `localStorage`.
- **Theme:** dark and light, toggled in the top-right of the viewport;
  `class="dark"` drives both shadcn tokens and the viewport background and
  ground colours. Follows the OS by default.
- Icons from lucide; icon buttons everywhere transport and camera controls
  appear. No full-width text buttons.
- **Information hierarchy:** a run row is a title line (name, weight 500)
  and a meta line of separate muted fields (duration, envs, source) with
  spacing, never `·`-joined strings. Status is a badge; favourite is an icon.

## 5. Viewport

- **Camera:** orthographic, z-up, on camera-controls. Presets iso, front,
  side, top animate over 250 ms and keep the ortho `scale` fitted to the
  focus set. "Frame" fits the focus set; "Frame all" fits every env root.
- **Follow** (the biggest v2 complaint) runs in the browser every rendered
  frame:
  - target addressed as `(env, body)`, body defaulting to torso/base/trunk
    (Isaac Lab `ViewerCfg` addressing);
  - **pose interpolation**: positions lerp and quaternions nlerp between
    frames `floor(t/dt)` and `+1` for the focus tier, so 50 Hz data on a
    60/120 Hz display does not repeat frames;
  - a critically damped target (`smoothTime` ≈ 0.12 s);
  - modes Off / Position (x,y only, z held at frame-0 height; default) /
    Pose (x,y,z) / Heading (yaw follows the body);
  - the user's orbit and pan are kept as an offset (follow is never paused).
- **Ground:** a shader plane sized to the frustum: MuJoCo-style
  checkerboard (default) or white with grey grid lines, `fwidth`
  antialiased, theme-aware. Replaces the 30 m line grid.
- **Toggles:** contacts, collision geoms, ground style, shadows (off in
  crowd mode).
- **Contacts:** drawn for the focus set only as instanced points plus force
  arrows from the `contacts` arrows stream (§10).
- **Picking:** click selects an env by a CPU ray-to-sphere test against env
  roots (no `Raycaster` on instanced meshes).

## 6. Scale: focus and crowd tiers

Automatically on when `n_envs > 64`; the same code path at small E.

- **Focus tier:** the selected env, up to 4 pinned envs, then nearest
  neighbours until a triangle budget (5M by default) is spent. Full geoms,
  interpolation, follow, contacts, plots.
- **Crowd tier:** every env drawn as one instanced proxy (unit box/capsule
  scaled to the frame-0 bounding box) posed by the root body from a
  **server-derived root-pose stream** `[T, E, 1, 7]` cached in
  `.simscope/derived/<run>/`. `instanceColor` by a per-env scalar at `t`
  (reward, fell, peak contact). One draw call at 4,096 envs.
- **Data path:** `GET …/windows/{w}?envs=…` returns raw SSBB blocks for the
  requested envs only (an mmap slice, no server decode). Decoding runs in
  one Web Worker with transferables and a concurrency cap of 8; the window
  cache is an LRU by bytes (256 MB), not "three windows".
- **Budgets per frame:** ≤ 4 ms main-thread JS, ≤ 2 MB GPU upload, ≤ 5M
  triangles, no main-thread decode. Measured in `player/bench`.
- **Env picker** (Inspector › Envs): a virtualised list sortable by
  server-computed per-env summaries (return, min root z, peak contact force,
  peak root acceleration, highlight count); `[` / `]` step envs.
- **Plots** show the selected env, up to 8 pinned envs, and a p5–p95 band
  with the median across envs from `GET …/envelope?stream=…` (`[3, T]`).
  Never one line per env.
- Small runs (E·T·K·4 B ≤ 64 MB decoded) load whole; 10k-frame single runs
  are fine, they only need timeline zoom and min/max plot decimation.

## 7. Timeline

Owned canvas component (~500 lines; no library fits):

- Ruler with adaptive ticks, playhead, click/drag to scrub, wheel to zoom
  (W/S) and pan (A/D), drag on the ruler to set a loop region, click the
  readout to type a time, Shift snaps to frames.
- Lanes: **highlights** (icons by kind, clustered to ≥ 6 px apart, the
  selected env's lane plus an "all envs" lane), **marks** from
  `annotations.json` (read-only).
- Around the strip: camera presets and follow on the left; transport
  (start, step back, play/pause, step forward, end), speed ladder
  (0.1×–5×), loop on the right. Readout `2.14 s / 8.00 s · frame 107`
  rendered as labelled fields, not a joined string.
- A `LIVE` badge and "follow live edge" while a run is recording; the
  duration grows as the partial manifest is polled once a second.
- Highlight reel: play only highlights with 1 s pre-roll and post-roll,
  skipping gaps; switches the focus env at the midpoint between close
  events (CS Demo Manager's model).

## 8. Highlights and marks (replaces manual annotation)

- The manual event/spatial creation UI is removed. `annotations.py` stays
  as the public API for programmatic marks: `Rollout.add_event(...)`,
  `add_note`, `set_rating`, `set_marks`. Ratings, favourite, tags and notes
  keep a small curation UI in the Inspector (they are how runs are sorted
  and shortlisted).
- **Detector** (Python, numpy only, `simscope.highlights`): signals are
  contact-force magnitude, body acceleration (second differences of
  positions; q16d noise is negligible), torque streams (by name or units),
  and root-height drops. Score = robust z `(x − median) / (1.4826·MAD)`,
  keep local maxima within ±0.25 s above 6, top 10 per env per signal, top 50 per signal
  across envs. Vectorised over `[T, E]`.
- **Storage:** `derived/<name>/highlights.json`, cached on disk in
  `.simscope/derived/<run id>/` and stored as a pack entry on export (see
  the [contracts](2026-09-30-simscope-viewer-v3-contracts.md)).
- Users can register extra detectors: `simscope.highlights.register(name, fn)`
  where `fn(rollout) -> list[Highlight]`.

## 9. Library and Inspector

- **Library:** `GET /api/runs` returns every row once (ETag); search,
  filters (favourites, status, tags), and sort run in the browser;
  TanStack Virtual renders ~30 rows. No server pagination below 20k runs.
- **Inspector › Run:** header (name, status badge, duration, frames, envs,
  dt, source), curation (stars, favourite, tags, notes), export buttons.
- **Inspector › Envs:** the picker of §6.
- **Inspector › Plots:** a fixed channel list (recorded scalars, derived
  height and speed of the followed body); uPlot with a CSS-positioned
  playhead cursor (`valToPos`), no data resend per frame.

## 10. Compare

2–4 panes over one master clock. Camera sync broadcasts camera-controls
`toJSON()` from the pane being dragged; follow applies per pane to its own
selected env. One shared WebGL renderer blits into the panes.

## 11. Contacts (adapter work first)

No adapter records contacts today. Add a `contacts` arrows stream `[K, 6]`
(point, force), zero-padded; the arrow layer hides zero-length arrows and
zeros deflate to nothing.
- MuJoCo: `data.contact` + `mj_contactForce`, K = a configured max per env.
- Isaac Lab: `ContactSensor` net forces per body, K = B.

## 12. Server API (`simscope.server`)

| Route | Returns |
| --- | --- |
| `GET /api/runs` | index rows (ETag) |
| `GET /api/runs/{name}` | manifest, annotations, highlights, summaries |
| `GET /api/runs/{name}/streams/{s}/windows/{w}?envs=a,b` | raw blocks (mmap slice), `immutable` |
| `GET /api/runs/{name}/envelope?stream=` | `[3, T]` f32 |
| `GET /api/scenes/{sha}`, `/api/assets/{sha}` | CAS bytes, `immutable` |
| `GET /api/changes?since=` | sequence number from watchfiles; live `n_frames` |
| `POST /api/runs/{name}/marks` etc. | through `annotations.py`; same-origin + token |
| `GET /` and `/assets/*` | the built app |

Derived data (root stream, summaries, envelopes, highlights) is computed
once per run in a background thread and cached in `.simscope/derived/`.

## 13. Keyboard

K play/pause · J/L step (Shift ×10) · N/P next/previous run · U next
unrated · 1–5 rate · V favourite · `[`/`]` env · F follow · 0 frame all ·
W/S zoom, A/D pan timeline · H highlight reel · C contacts · T theme.

## 14. Exports

- `simscope export --ui lean` (default for mkdeck): `<simscope-player>` +
  pack, ~165 KB gz runtime. Budget: ≤ 250 KB gz runtime, and a 30-slide
  deck must keep ≤ 8 live WebGL contexts (players outside the viewport
  release theirs).
- `simscope export --ui full`: the whole app inline, ~400 KB gz runtime;
  supports `--envs` subsetting (packs over 400 MB base64 cannot inline).
- Both work from `file://` (the decode worker is created from a Blob URL).

## 15. Tests and budgets

- `node --test`: format goldens, clock, interpolation, worker protocol,
  highlight clustering, tier membership.
- pytest: server API, derived cache, highlights detector (golden files),
  export budgets; Playwright smoke flows (open run, scrub, follow, compare,
  theme) run from pytest.
- Benchmarks (D12): run switch ≤ 200 ms to first frame; 4,096-env crowd ≤ 4
  ms main-thread per frame; `/api/runs` ≤ 50 ms at 5k rows; player bundle
  ≤ 250 KB gz, app ≤ 450 KB gz.
- CI rebuilds `player/` and `app/` and diffs the committed output.

## 16. Out of scope

Drag-to-dock panels, drag editing on the timeline, a plot builder, manual
event drawing, thumbnails, multi-user presence, WebGPU, mesh decimation.

## 17. Phases

All phases were implemented on 2026-09-30 by parallel agents against the
[contracts](2026-09-30-simscope-viewer-v3-contracts.md), then reviewed.

| Phase | Scope | Status |
| --- | --- | --- |
| A | Player core: three r186, camera-controls, ortho presets, interpolation, damped follow, decode worker, `Source`, byte-LRU cache, ground shader, tiers, picking, contacts overlay, `env`/`follow` attributes | done |
| B | Server: Starlette app, routes of §12, derived cache | done |
| C | App shell: layout, theme, library, inspector, timeline, plots, compare, keyboard | done |
| D | Highlights detector and API, contacts in adapters and the rbundle importer, lean/full exports with `--envs`, size budgets | done |
| E | Viser deletion, docs, CI job for `web/` | done |

Open: Playwright flows (§15), shadows, Firefox/Safari and `file://` checks,
and Isaac Lab contacts on a real sensor.
