# simscope viewer v3: interface contracts

**Status:** Normative, 2026-09-30. The seams between the four v3 work
streams ([viewer v3](2026-09-30-simscope-viewer-v3.md)). Changing a contract
means editing this file first; implementers do not change a contract on
their own.

Design rule: **derived data is just more files in the existing formats.**
The browser reads a library over HTTP and a pack from memory through one
path-addressed `Source`, so `serve` and exports share every code path.

## 1. Paths

Both a library directory and a `.simscope` pack are addressed by the same
relative paths (format spec §2, §8):

| Path | Contents |
| --- | --- |
| `runs/<name>/rollout.json` | manifest (for a recording run the server answers with `rollout.json.partial`) |
| `runs/<name>/<stream>.blk` | block files |
| `runs/<name>/annotations.json` | curation sidecar (may be absent) |
| `scenes/<ab>/<sha>.json`, `assets/<ab>/<sha>` | CAS (`fmt.casPath`) |
| `derived/<name>/highlights.json` | §4 (may be absent) |
| `derived/<name>/root_pose.blk` | §5.1, a normal `pose` block file `[E, 1, 7]` |
| `derived/<name>/summaries.json` | §5.2 |
| `derived/<name>/envelopes/<stream>.json` | §5.3 |

On disk the server keeps `derived/` in `.simscope/derived/<run id>/`, keyed
by the run's ULID and invalidated when the run's manifest changes. Packs
store `derived/<name>/…` entries directly (format spec §8 allows extra
entries; the pack's minor version is bumped to record it).

## 2. HTTP API (`simscope.server`)

All JSON is UTF-8. Errors are `{"error": "<message>"}` with a 4xx/5xx code.

| Method, route | Response |
| --- | --- |
| `GET /` | the app page with the boot block (§6) |
| `GET /assets/simscope-app.js`, `.css`, `simscope-player.js` | built assets from `src/simscope/_assets/`, `Cache-Control: no-cache` + ETag |
| `GET /api/library` | `{"name": str, "root": str, "n_runs": int, "seq": int, "writable": bool}` |
| `GET /api/runs` | `{"seq": int, "runs": [RunRow]}`, ETag; all rows, no paging |
| `GET /files/<path>` | the bytes at a §1 path. CAS paths get `Cache-Control: public, max-age=31536000, immutable`; others `no-cache` + ETag. Range requests are honoured. `derived/` paths are computed on first request: `202 {"status": "pending"}` with `Retry-After: 1` until ready, `404` if not applicable (for example no root stream for E ≤ 64, or any derived file of a run that is still recording) |
| `GET /api/blk?path=<blk path>` | a synthesized, file-shaped index of a block file: a valid 64-byte header (`dir_offset = 64`, CRC correct, `n_frames`/`n_blocks` counting complete windows only) followed by the 32-byte directory entries, whose offsets point into the real file. `fmt.parseBlk` reads it unchanged. Header `X-Simscope-Live: 0\|1`. Also accepts `derived/…/root_pose.blk` with the `/files/` 202/404 rules |
| `GET /api/blocks?path=<blk path>&w=<window>&envs=<i,j,…>` | the raw SSBB blocks of window `w` for those envs, concatenated in the order asked, as `application/octet-stream`, with header `X-Simscope-Block-Lengths: <n0>,<n1>,…`. At most 256 envs per request. `404` if the window is not written yet |
| `GET /api/changes?since=<seq>` | `{"seq": int, "changed": [name], "removed": [name], "live": {name: n_frames}}`, answered at once (the client polls every 1 s). `seq` is opaque: an unknown or too-old `since` (for example after a server restart) returns every run in `changed`, so the client reloads its rows. `live` frame counts come from the partial manifest; `/api/blk` has the exact count |
| `POST /api/runs/<name>/annotations` | body `{"op": …}` (§2.1); returns the new `annotations.json` object. Requires header `X-Simscope-Token` equal to the boot token and an `Origin` matching the host |
| `GET /api/export?runs=a,b&layout=single\|grid\|compare&ui=lean\|full&envs=0,1` | an HTML download (`Content-Disposition: attachment`) |

`RunRow`:

```json
{"name": "trot_f2", "id": "01J…", "created": "2026-09-30T19:11:01Z",
 "status": "complete", "dt": 0.02, "n_frames": 400, "n_envs": 1,
 "n_bodies": 14, "favorite": false, "group": null,
 "rating": 4.0, "tags": ["source:brax"], "n_notes": 0,
 "n_highlights": 7, "simulator": "brax", "importer": "brax",
 "streams": ["body_pose", "contacts"]}
```

`n_highlights` is `null` until highlights are computed.

### 2.1 Annotation ops

`{"op": "favorite", "value": bool}` (shown as Pin), `{"op": "rate", "value":
1..5}` (criterion `overall`, scale `stars5`), `{"op": "group", "value":
str|null}`, `{"op": "note_add", "text": str}`, `{"op": "event_add",
"t0": float, "t1": float|null, "type": str, "label": str, "env": int|null}`,
`{"op": "remove", "id": str}`. The author is the server's `--author`.

## 3. Player core API (`web/src/core/index.js`, typed by `index.d.ts`)

The core is framework-free JS with a hand-written `index.d.ts`. The app and
the element import only from `web/src/core/index.js`.

```ts
export interface Source {
  /** Whole entry at a §1 path; rejects with SourceError(status) if absent. */
  get(path: string): Promise<Uint8Array>;
  /** Parsed header + directory of a block file (fmt.parseBlk shape, no block bytes). */
  blockIndex(path: string, opts?: { refresh?: boolean }): Promise<BlkIndex>;
  /** Raw SSBB blocks of window w for the given envs, in the order asked. */
  blocks(path: string, w: number, envs: number[]): Promise<Uint8Array[]>;
  /** Run names this source holds. */
  runs(): Promise<string[]>;
}
export class PackSource implements Source { constructor(pack: Uint8Array | ArrayBuffer); }
export class HttpSource implements Source { constructor(base?: string); }
export class SourceError extends Error { status: number; }  // 404 absent, 202 pending

export class Clock extends EventTarget {
  // One clock may drive many players (compare). Events: "time" {t}, "state".
  readonly time: number; readonly duration: number; readonly playing: boolean;
  speed: number; loop: boolean; loopRegion: [number, number] | null;
  play(): void; pause(): void; toggle(): void; seek(t: number): void;
  step(frames: number, dt: number): void;
  setDuration(seconds: number): void;   // max over attached players
  tick(nowMs: number): void;            // called by the shared rAF loop
}

export type View = "iso" | "front" | "side" | "top";
export type FollowMode = "off" | "position" | "pose" | "heading";
export interface RunInfo {
  run: string; dt: number; frames: number; duration: number; envs: number;
  bodies: string[]; followBody: number; streams: { name: string; kind: string; shape: number[] }[];
  hasCollision: boolean; hasContacts: boolean; live: boolean; tiered: boolean;
}
export interface PlayerOptions {
  clock?: Clock; theme?: "light" | "dark"; ground?: "checker" | "grid" | "none";
  view?: View; background?: string;     // CSS colour; default from theme
}

export class Player extends EventTarget {
  // Events: "loaded" RunInfo, "focus" {env, focus: number[]}, "camera"
  // (user-driven camera change; detail = cameraState()), "progress"
  // {pending}, "error" {error}, "live" {frames}.
  constructor(canvas: HTMLCanvasElement, opts?: PlayerOptions);
  readonly clock: Clock;
  load(source: Source, run: string, opts?: { envs?: number[] }): Promise<RunInfo>;
  unload(): void; destroy(): void;
  info(): RunInfo | null;
  resize(width: number, height: number, dpr?: number): void;

  // Camera (orthographic, z-up, camera-controls underneath).
  setView(view: View, opts?: { animate?: boolean }): void;
  frame(what?: "focus" | "all", opts?: { animate?: boolean }): void;
  setFollow(opts: { mode?: FollowMode; env?: number; body?: number }): void;
  follow(): { mode: FollowMode; env: number; body: number };
  cameraState(): unknown;                           // JSON-serialisable
  setCameraState(state: unknown, opts?: { animate?: boolean }): void;

  // Display.
  setTheme(theme: "light" | "dark", background?: string): void;
  setGround(style: "checker" | "grid" | "none"): void;
  setContacts(on: boolean): void; setCollision(on: boolean): void;

  // Envs (focus/crowd tiers are automatic above 64 envs).
  selectEnv(env: number): void; pinEnvs(envs: number[]): void;
  focusEnvs(): number[]; pickEnv(clientX: number, clientY: number): number | null;

  // Data for plots and highlights (full timeline of one env).
  series(stream: string, env: number, component?: number): Promise<Float32Array>;
  bodySeries(kind: "height" | "speed", env: number, body: number): Promise<Float32Array>;
  highlights(): Promise<HighlightsDoc | null>;      // derived/<run>/highlights.json
  summaries(): Promise<SummariesDoc | null>;
  envelope(stream: string, component?: number): Promise<EnvelopeDoc | null>;

  snapshot(type?: string): Promise<Blob>;
}
export function startLoop(): void;   // one shared rAF loop ticks clocks and draws players
export * as format from "./format.js";
```

**Implemented surface (2026-09-30).** `web/src/core/index.d.ts` is the typed
source of truth; it is a superset of the block above. The additions other
code relies on:

- `Clock.claim(owner, seconds, pad, live)`, `release(owner)` and
  `hold(owner, on)`: each player claims its duration, the clock's duration
  is the maximum claim, a `live` claim makes playback wait at the live edge
  instead of ending, and a hold pauses the clock while a player waits for
  data. `clockFor(name)` returns a named shared clock.
- `RunInfo.duration` is the time of the last frame, `(frames - 1) * dt`;
  the app formats every duration from this one definition.
  `RunInfo.events` and `RunInfo.hasGround` are extra fields.
- `cameraState()` returns `{v, azimuth, polar, zoom, scale, target,
  following}`, not camera-controls' `toJSON()`. `setCameraState` keeps the
  sender's world height even if the receiver's `scale` differs, and does not
  move the target of a player that is following. `linkCameras(players)`
  wires compare sync.
- `EnvelopeDoc` is one component: `{dt, t0, components, component, p5,
  p50, p95}` with `Float32Array`s (the JSON file of §5.3 holds all
  components).
- `load(source, run, {envs})` reads `envs` as `[selected, ...pinned]`.
- `Player` also has `refresh()` (live runs), `setCrowdColor(column|null)`,
  `stats()`, a `follow` event, `visible`, and the options `direct` (own
  WebGL context for one big viewport), `follow`, `triangleBudget` and
  `arrowScale`. `stepLoop()` drives the loop by hand in tests.
- The default follow body is `rootBody()` in `web/src/core/follow.js`, the
  same rule as `simscope.highlights.root_body` (§5).
- Following is never paused by a drag. A pan is folded into a camera-relative
  `pan = [right, up]` offset (metres along the view axes) on top of the
  followed point, so follow keeps running during and after a drag. (This
  replaces the earlier 300 ms pause, which could not be made consistent
  across linked panes while playing.)

- The rAF loop ticks each distinct `Clock` once per frame, then draws every
  visible player. Players never self-play; UI reads `clock.time` in its own
  rAF subscriber, never through React state.
- `series` decodes that env's blocks for every window (worker), caching by
  `(path, env)`. `bodySeries` derives from `body_pose` the same way.
- `live` runs: the player re-reads `blockIndex(..., {refresh: true})` when
  the app tells it the run changed (`player.refresh()`), and grows
  `clock.duration`.

## 4. Highlights (`simscope.highlights`, file `highlights.json`)

```json
{"format": "simscope-highlights/1", "detector": "simscope/1",
 "run_id": "01J…", "signals": [{"key": "contact_force", "label": "Contact force", "unit": "N"}],
 "highlights": [{"t": 1.24, "frame": 62, "env": 0, "signal": "contact_force",
                 "score": 8.3, "value": 412.0, "body": 3}]}
```

Sorted by `t`. `signals` lists only signals with at least one highlight.
`body` is the root body for `acceleration` and `height_drop` and `null` for
`contact_force` and `torque` (a contact slot is not a body). Caps: 10 per env
per signal, 50 per signal across envs (so one signal cannot crowd out the
others). Signal keys defined by the built-in detector:
`contact_force`, `acceleration` (root body, m/s²), `torque` (streams whose
name contains `torque`), `height_drop` (root z falling faster than 1 m/s).
Python API:

```python
@dataclasses.dataclass(frozen=True)
class Highlight:
    t: float; frame: int; env: int; signal: str; score: float; value: float
    body: int | None = None

Detector = Callable[[library.Rollout], list[Highlight]]
DETECTOR_VERSION: str                      # "simscope/1"
def register(key: str, detector: Detector, *, label: str, unit: str) -> None
def detect(rollout: library.Rollout, *, envs: Sequence[int] | None = None) -> list[Highlight]
def to_json(rollout: library.Rollout, highlights: list[Highlight]) -> dict
def load_or_compute(rollout: library.Rollout, cache_dir: pathlib.Path) -> dict
```

## 5. Derived data (`simscope.derived`)

1. **`root_pose.blk`:** body `root` (the followed body: torso/base/trunk,
   else the first non-world body) of every env, `[E, 1, 7]`, `q16d`,
   written only when `n_envs > 64`.
2. **`summaries.json`:** `{"columns": [{"key", "label", "unit",
   "better": "high"|"low"}], "values": {key: [E floats]}}`. Columns present
   when their data exists: `return` (sum of a scalar stream named `reward`),
   `min_height`, `peak_speed`, `peak_contact_force`, `n_highlights`.
3. **`envelopes/<stream>.json`:** `{"dt", "t0": 0, "components": n,
   "p5": [[T]…], "p50": […], "p95": […]}` across envs, one list per
   component; only for scalar/vector streams and `n_envs > 1`. The core's
   `envelope()` returns one component of it (§3).

```python
def cache_dir(lib_root: pathlib.Path, rollout: library.Rollout) -> pathlib.Path
def ensure(rollout, cache: pathlib.Path, what: str) -> pathlib.Path | None  # None: not applicable
```

`what` is the path relative to `derived/<name>/`: `root_pose.blk`,
`summaries.json`, `highlights.json` or `envelopes/<stream>.json`. The root
body is `simscope.highlights.root_body` (the first of torso, base, trunk,
pelvis, chassis; exact names, then prefixes; else the first non-world
body), and the player's follow default uses the same rule.

## 6. Boot block

`simscope serve` and full exports put one JSON block in the page:

```html
<script id="simscope-boot" type="application/json">
{"mode": "http", "base": "", "token": "…", "library": "vault_runs", "writable": true}
</script>
```

Full exports use `{"mode": "pack", "pack": "#simscope-pack", "runs": ["a"],
"layout": "single"|"grid"|"compare", "writable": false}` with the pack
inlined as base64 in `<script type="text/plain" id="simscope-pack">`, the
same as lean exports today.

## 7. Contacts stream

Stream name `contacts`, kind `arrows`, item shape `[K, 6]` = contact point
(m, world) then force on the robot (N, world), zero rows for unused slots.
Manifest `scale` is metres per newton for drawing (default `1 / (m g)` of
the robot, so body weight draws as 1 m). The rbundle importer names its
ground-reaction `forces` stream `contacts`.

## 8. v3.1 changes

Normative deltas from [viewer v3.1](2026-09-30-simscope-viewer-v3.1.md) §6.
Where this section and §1–§7 disagree, this section wins.

### 8.1 Groups

`GET /api/groups` → `{"groups": [{"name": str, "count": int}],
"ungrouped": int}` in library order (listed groups first, then groups that
runs reference but `groups.json` lacks, alphabetically).

`POST /api/groups` (token + Origin as for annotations) with one of:
`{"op": "create", "name": str}`, `{"op": "rename", "name": str, "to":
str}` (rewrites `marks.group` of every member), `{"op": "delete", "name":
str}` (members become ungrouped), `{"op": "move", "name": str, "index":
int}` (reorder). Returns the `GET` body. Names are 1–64 characters, unique
case-insensitively.

Annotation op `{"op": "group", "value": str | null}` moves a run (creating
the group if needed). `{"op": "event_update", "id": str, "label"?: str,
"t0"?: float, "t1"?: float | null}` edits a label. Labels are `event_add`
with `"type": ""`. `tag_add`, `tag_remove`, `status`, `flag` → 400.

`RunRow`: adds `"group": str | null`; drops `flag`, `mark_status`; `tags`
holds record-time tags only.

### 8.2 Highlights v2

> **Superseded in part by §9 (2026-10-01):** the document shape below still
> holds, but the kinds are now only `contact` and `acceleration` plus
> developer-defined ones. Read the kind names and the `value`/`score`/
> `ratio` notes in §8.4 as history.

```json
{"format": "simscope-highlights/2", "detector": "simscope/2", "run_id": "01J…",
 "kinds": [{"key": "landing", "label": "Landing"}],
 "highlights": [{"t": 1.36, "frame": 68, "t1": null, "frame1": null,
                 "env": 0, "kind": "landing", "label": "Landing",
                 "detail": "4.1 g impact, after 0.38 s airborne",
                 "score": 9.2, "ratio": 4.1, "value": 40.2, "body": 1,
                 "also": ["contact_spike"]}]}
```

Kinds: `landing`, `jump` (with `t1`/`frame1`), `fall`, `contact_spike`,
`torque_spike`, plus registered ones. `also` lists kinds merged into this
moment. `kinds` lists only kinds present. Python: `Highlight` gains `kind`,
`label`, `detail`, `t1`, `frame1`, `ratio`, `also`; `register(key, detector,
*, label)` (no unit). Readers of `/1` documents may drop them; the cache key
includes the detector version, so caches refresh.

### 8.3 Player core

- `setVisual(on: boolean)`: shows or hides visual geoms (collision and
  contacts have their own setters).
- `PlayerOptions.color?: string` and `setColor(css)`: the compare slot
  colour, used for this player's markers in the element and returned by
  `info().color`.
- `linkCameras(players, {alignGround: true})` (default true) makes a
  camera group: it shares azimuth, polar, ortho scale and target z;
  following players (every follow mode) move only x and y and hold the
  shared z. `setView()` and `frame()` on any member act on the whole group,
  and `frame()` gives every pane the largest world height any member needs.
  Loading a run into a member re-frames the group. `cameraState().zoom`
  reports the zoom being animated towards. Panes must have equal pixel
  heights for equal pixels per metre.
- Pan is synced too: a pan in any member shifts every member by the same
  screen-space offset, kept as a camera-relative `pan` offset on top of each
  pane's own follow target. `frame()`, `setView()`, loading a run and
  switching a pane's follow mode clear it group-wide. `cameraState()`
  carries `pan`; a state without `pan` still works. A receiver that is not
  following keeps its own framing and applies the shared offset instead of
  copying the sender's absolute target.
- Framing (`frame()`, and the automatic fit after load) uses the drawn
  geometry of the followed body and the bodies that move with it, over the
  whole run, plus the ground and the tops of static boxes near the path
  (`web/src/core/extent.js`). Collision geoms are not part of the extent.
- Vertical framing is trajectory-aware: the shared target z and ortho
  height cover the followed body's z range over the whole run, its radius,
  the ground, and static geometry near its path (union over a linked
  group). It refits once when the series is decoded, never during playback.
- `highlights()` returns the `/2` document (spans included). The element
  draws jump spans as bars and moments as ticks on its scrub bar.

### 8.4 Details settled during implementation

- `Highlight.value`, `score` and `ratio` per kind: landing: `value` is the
  proper acceleration in m/s², `score` and `ratio` are g (× body weight);
  jump: `value` and `score` are seconds airborne, `ratio` null; fall: `value`
  is the tilt in degrees, `score` is tilt ÷ 60°, `ratio` null; spikes:
  `value` is N or N·m, `score` the robust z, `ratio` is value ÷ the usual
  stride peak. `kinds` also lists kinds that occur only inside another
  marker's `also`. A jump ends at the first impact of 1.5 g or more; that
  impact does not always get its own Landing marker.
- `POST /api/groups` errors: 400 bad name, op or index; 404 unknown group;
  409 name exists or unreadable `groups.json`; 403 read-only library.
  `GET /api/groups` has no `seq`; every change bumps the library `seq`
  (create and move leave `changed` empty, rename and delete list the member
  runs).
- `event_update`: moving an instant without naming `t1` keeps it an instant,
  and `t1: null` turns a span into an instant; unknown id is 404, bad times
  400.
- Compare exports: every player has `sync="compare"` and a hex `color`
  (A #2282fb, B #d35f10, C #109646, D #c344ae); more than 4 runs is an
  error.

## 9. v3.2 changes: general highlights

Normative; wins over §4 and §8.2/§8.4 where they disagree. Reason: the v3.1
kinds (landing, jump, fall, torque spike) describe the vault and roll tasks
used to build the viewer; a general library must not hard-code a task's
vocabulary.

### 9.1 Built-in kinds

Exactly two, computed from physics every simulator provides:

| Kind | Signal | Label | `detail` example |
| --- | --- | --- | --- |
| `contact` | magnitude of the **net contact force** per frame: the norm of the sum of all force vectors of the `contacts` stream (runs without one get none) | `Contact force` | `412 N, 5.1× typical` |
| `acceleration` | magnitude of the robot's **centre-of-mass acceleration** per frame (second difference of the COM position) | `Acceleration` | `41 m/s², 4.2 g` |

- The COM is the mass-weighted mean of the body positions when the scene
  records body masses (`Body.mass`, optional, kg; the MuJoCo adapter fills it
  from `model.body_mass`), else the plain mean of the non-world body
  positions. Teleports (env resets) are masked as before.
- A peak is a local maximum within ±0.25 s whose robust score is above 6;
  markers within 0.15 s of the same kind merge. Caps: 10 per env, 50 overall
  per kind. `ratio` is value ÷ the run's typical peak; `value` is N or m/s²;
  `score` is the robust z.
- Nothing else is built in. There are no landing, jump, fall or torque kinds,
  and no hand-tuned task thresholds.

### 9.2 Custom markers (the developer API)

Two paths, both shown on the timeline:

1. **Computed markers:** `highlights.register(key, detector, *, label,
   color=None)` where `detector(rollout) -> list[Highlight]`. `color` is an
   optional CSS hex colour. A `Highlight` may be a span (`t1`, `frame1`). The
   detector runs in the background and its results are cached with the
   built-ins (the cache key includes the registered detectors' keys).
2. **Explicit markers:** annotation events, `Annotations.add_event(type="", *,
   t0, t1=None, label="", env=None, props=None)`; `.simscope/event_types.json` may give a
   type a colour. They appear in the Labels lane (see D26), coloured by their
   type when it has a colour, neutral otherwise.

### 9.3 `simscope-highlights/2` documents

Same shape as §8.2, with `kinds: [{"key", "label", "color"?}]` (the optional
`color` only for custom kinds) and `detector: "simscope/3"`. Readers must
treat unknown kinds generically: a diamond glyph, the kind's `color` or a
neutral. `also` is kept for merged kinds.

### 9.4 Scene bodies

`Body` gains optional `mass: float = 0.0` (kg; 0 means unknown). The scene
descriptor writes `"mass"` for a body only when it is above 0, so scenes
without masses keep their hashes. Format spec §4 documents it.

## 10. v3.3 changes: compare layout and exports

Normative; wins over earlier sections where they disagree.

### 10.1 Compare arrangement

The compare view has an **arrangement** chosen by the user: `side` (panes
side by side: horizontal split), `stack` (panes stacked: vertical split) or
`grid` (a 2 × 2 grid, one cell empty for three runs). Default: `side` for two
runs, `grid` for three or four. The app shows the choice as a three-way icon
toggle beside the Compare button in the pick bar, and in the viewport toolbar
while comparing. It is remembered in `localStorage`.

### 10.2 Exports

- `GET /api/export` gains `arrange=side|stack|grid`; the app passes the
  arrangement it is showing. Absent means the default of 10.1.
- Boot block of full exports (§6) gains `"arrange"`.
- **A compare export looks like the app's compare view:** panes fill the
  whole page in the chosen arrangement (no padding, hairline gaps), one title
  per pane and nothing else (no letters A–D, no colour dots: in a standalone
  file they carry no meaning), and **one** control bar at the bottom shared by
  every pane: play/pause (icon), step, a scrubber, the time readout, loop and
  speed. No highlight rows or ticks anywhere in a lean export.
- **A single-run lean export** has the same bar under one pane. Controls are
  icon buttons (no text labels like "Play"); neutral colours, same visual
  language as the app (rounded 6 px controls, hairlines, light/dark follows
  the system).
- Lean markup contract (written by `export.py`, laid out by the element):
  `<div id="ss-master" data-arrange="side|stack|grid">` containing one
  `<figure>` per run: `<figcaption>title</figcaption>` plus a
  `<simscope-player src="#simscope-pack" run="…" sync="compare">`. No `color`
  attribute, no letters. `SimscopePlayer.attachMaster(box, "compare")` builds
  the shared bar and styles the layout itself (the page needs no CSS beyond
  `html, body {margin: 0; height: 100%}`).
