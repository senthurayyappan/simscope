# simscope web

Browser code for simscope (viewer v3, `docs/specs/2026-09-30-simscope-viewer-v3.md`):

- `src/core/`: the framework-free player core (sources, decode worker, clock, scene, camera, tiers). The only renderer.
- `src/element/`: the lean `<simscope-player>` custom element (decks, mkdeck, lean exports).
- `src/app/`: the React + shadcn app shell for `simscope serve` and full exports. It imports only `src/core/index.js`, typed by `src/core/index.d.ts`.

## Build and test

```sh
cd web
npm ci
npm run build      # writes ../src/simscope/_assets/ (simscope-player.js, simscope-app.js/.css, licences)
npm test           # node --test test/*.test.mjs (Node >= 22; tested on 26)
node bench/frame.mjs   # per-frame CPU cost of the tiers at 4,096 envs, no GPU
```

The builds are byte-reproducible and committed; CI rebuilds them and runs
`git diff --exit-code`. The decode worker is bundled on its own first by
`build/player.mjs` into `src/core/decode_worker.generated.js` (a string the
core turns into a Blob URL at run time, so it works from `file://`). That file
is committed too: the app bundle imports the same core.

The lean bundle is about 186 KB gzipped (budget 250 KB).

## The core (`src/core/index.js`)

```js
import { Player, PackSource, HttpSource, Clock, startLoop, linkCameras } from "./core/index.js";

const player = new Player(canvas, { theme: "dark", ground: "checker", view: "iso" });
player.resize(width, height, devicePixelRatio);            // the app owns sizing
await player.load(new HttpSource(""), "trot_f2");          // or new PackSource(bytes)
player.clock.play();                                       // players never self-play
player.setFollow({ mode: "position", env: 0 });
player.addEventListener("camera", (e) => other.setCameraState(e.detail));
player.setVisual(true); player.setCollision(false); player.setContacts(true);   // three independent switches
player.setColor("#e4572e");                                // compare slot colour, see info().color
```

The contract is `docs/specs/2026-09-30-simscope-viewer-v3-contracts.md` §3;
`index.d.ts` is the typing and lists the additive extras (`refresh()`,
`setCrowdColor()`, `stats()`, `clockFor()`, `stepLoop()`, and the `direct` and
`follow` options). The `renderer` option replaces the WebGL renderer, so tests
run players headless (`test/compare.test.mjs`).

How the pieces fit:

- **Sources** (`source.js`): `PackSource` (a pack in memory) and `HttpSource`
  (`/files/`, `/api/blk`, `/api/blocks`; a 202 is retried with backoff). Both
  answer the same paths, so serve and exports share every code path.
- **Decode** (`decode.js`, `decode_worker.js`): block and mesh decoding run in
  one Web Worker made from a Blob URL, with buffers transferred and at most 8
  jobs in flight. Without a worker the same handler runs on the main thread.
- **Cache** (`cache.js`): decoded windows in an LRU bounded by bytes (256 MB).
  Runs that decode to 64 MB or less are loaded whole in the background.
- **Clock and loop** (`clock.js`, `loop.js`): one rAF loop ticks every distinct
  `Clock` once, then updates and draws every visible player. Frame times are
  smoothed (`FrameTimer`): rAF timestamps wobble, and the wobble would move a
  followed robot by speed times wobble.
- **Camera** (`camera.js`): orthographic, z-up, on camera-controls. Presets
  animate in about 250 ms. The frustum is fixed from `scale`; camera-controls
  owns `zoom`; `frame()` fits a box exactly for the current orbit.
- **Follow** (`follow.js`, `player.js`): poses are interpolated between frames
  (lerp and nlerp with a sign fix); the camera target chases the interpolated
  body with critical damping (0.12 s), in the same tick as the poses. Modes
  `off|position|pose|heading`. A pan (right drag) is kept as an offset from
  the followed point, in the view's right and up axes, so the robot keeps its
  place on screen while it moves (follow is not paused); `frame()` and
  `setView()` clear it. The followed body follows the rule of Python's
  `highlights.root_body` (`FOLLOW_ALIASES`).
- **Framing** (`extent.js`, `player.js`): position follow holds the camera at
  one height and follows the robot in x and y. That height and the world
  height shown come from the whole run, not frame 0: the vertical range of
  the robot's geometry over the run (the followed body and what moves with it,
  as world boxes on up to 1,024 sampled frames), the ground (z = 0) and the
  tops of the static geometry within a metre of the path (walls, crates), with
  a 10% margin. The camera holds the middle of that range. It is fitted for
  the view: in an oblique view a wall beside the path moves on screen with the
  robot, so the exact rows for the view's up vector are used (side and front
  reduce to the z range). The series is decoded by the worker (`envArray`)
  after the load; until then the frame-0 fit stands, then the fit replaces it
  once, in about 250 ms, never while the clock plays and not after the user
  zoomed by hand. `frame()` and choosing a view refit it. Live runs, `pose`
  and `off` follow, and `frame("all")` keep the frame-0 fit.
- **Tiers** (`tiers.js`, `crowd.js`): above 64 envs, a focus set (selected,
  pinned, nearest, up to the triangle budget) is drawn in full and every other
  env is one instanced proxy posed by `derived/<run>/root_pose.blk`.
- **Colours** (`theme.js`): the viewport's palette in oklch, converted to sRGB
  by a small pure helper (three converts to linear itself). Background and
  ground are neutral greys (light viewport 0.97, checker 0.94 / 0.90; dark
  0.18, 0.24 / 0.205; the grid the same greys a step off). Contact points and
  arrows are the contact kind's violet (light 0.54 0.20 295, dark 0.56 0.20
  295); other arrow and polyline streams are a neutral grey; collision geoms
  are the foreground colour at 35%. All follow `setTheme(theme, background)`;
  only an explicit `background` overrides the viewport grey. `info().color`
  is the compare slot colour (pane dot), separate from all of these.
- **Ground** (`ground.js`): a shader plane, checker or grid, antialiased with
  `fwidth`, theme aware, sized to the view.
- **Overlays** (`overlays.js`): arrows, contact points (the `contacts` stream,
  toggled by `setContacts`) and polylines, for the focus envs, one buffer each.

### Compare

Players that name the same clock play in step:

```html
<simscope-player sync="cmp" src="#pack" run="a"></simscope-player>
<simscope-player sync="cmp" src="#pack" run="b"></simscope-player>
<script>SimscopePlayer.attachMaster(document.getElementById("ss-master"), "cmp");</script>
```

`attachMaster` is the master control that `export.py` used to inline (play,
scrubber, time, speed, markers) rebuilt on the shared `Clock`. In the app,
mount several `Player`s on one `Clock` and call `linkCameras(players)`.

`linkCameras(players, {alignGround = true})` makes the panes one camera. A
drag in any pane gives the others its orbit and zoom, and a following pane
keeps following its own env. With `alignGround`, world z = 0 also sits on the
same screen row under every followed robot, so a 1 m wall and a 0.8 m wall
compare honestly. In an orthographic view that row depends only on the orbit
angles, the world height shown and the target's z, so the group shares those:

- Following panes move the target in x and y only and hold one shared height
  in every follow mode. A robot that starts higher stands higher on the same
  ground. Until every pane has decoded its run the shared height is the first
  player's standing height (its follow body's z at frame 0) and each pane has
  its frame-0 fit; then the group holds the middle of the union of the panes'
  vertical ranges (see Framing above) and shows the most any pane needs, so a
  robot that jumps or climbs stays in frame in every pane.
- `setView()` and `frame()` on any player act on all of them; `frame()` gives
  every pane the largest world height any of them needs, so none is cropped.
- Loading a run into a pane frames the group again, with the first player's
  orbit. Panes of the same size then show the same pixels per metre.
- A pan in any pane moves every pane by the same screen distance. It is
  shared as `pan` in the camera state, a camera-relative offset (metres along
  the view's right and up axes) from each pane's own robot (or, not following,
  from where the pane was last framed), so panes with different robots in
  different places stay consistent, and the vertical part is shared too, so
  the ground stays on one row. `frame()`, `setView()` and loading a run clear
  it. A single player's `cameraState()` / `setCameraState()` round-trips it.
  Heading follow keeps each pane's own azimuth. Panes with different heights
  in pixels have different pixels per metre, so give them equal heights.

At 1 env per pane this is the whole story. Above 64 envs a pane starts with
follow off (the camera is not tied to any robot); turn follow on for one env
per pane and the same alignment applies. Cost: one loop over at most four
players per frame.

## `<simscope-player>`

The CDN-free custom element. It plays `.simscope` packs (format spec:
`docs/specs/2026-09-30-simscope-format-v1.md`) with three.js r186 and makes no
network requests at runtime.

```html
<script type="text/plain" id="pack">…base64 of a .simscope pack…</script>
<script src="simscope-player.js"></script>
<simscope-player src="#pack" run="walk" autoplay loop view="iso"></simscope-player>
```

`src` is a URL or `#id` of an inline base64 script (the only form that works
from `file://`). Attributes: `run`, `autoplay`, `loop`, `speed`, `view`
(`iso|front|side|top`), `background` (CSS colour or `transparent`),
`collision` (show collision geoms), `nocontrols`, and, new in v3:

| Attribute | Meaning |
| --- | --- |
| `env` | which env to show and follow (default 0) |
| `follow` | `off`, `position`, `pose`, `heading`; absent: `position` for a single-env run, else `off` |
| `ground` | `checker` (default), `grid`, `none` |
| `theme` | `light` (default) or `dark` |
| `sync` | name of a shared clock (compare) |

Methods: `load()`, `unload()`, `play()`, `pause()`, `seek(t)`, `setSpeed(x)`,
`setView(name)`, `snapshot()` (a Promise of a PNG Blob); properties `player`
(the core `Player`), `clock`, `currentTime`, `duration`, `playing`. Events:
`ready` (`{duration, frames, dt, run, events}`), `timeupdate`
(`{t, duration}`), `ended`, `error`. Highlight markers from
`derived/<run>/highlights.json` are drawn on the scrub bar when the pack has
them: `jump` spans as thin bars, other moments as ticks (no two closer than 6
px; the strongest wins), with a tooltip of the label, the detail and the
time. A `/1` document draws neutral ticks named after their signal. The
element also takes `color="<css colour>"` (its compare slot), which colours
its markers and is what `player.info().color` reports.

`attachMaster` (the shared control of a compare page) draws one row of
markers per player in the strip above the scrubber, in that player's `color`,
with the same rules, and puts a dot in the same colour in front of the name in
the player's `<figure><figcaption>`. A page needs only `sync` and `color`
attributes on its players; the rows and dots are made with inline styles.

A page with many players shares one WebGL context (the blit renderer), decodes
only what is on screen, and keeps at most 8 runs loaded: a player that
scrolled away is unloaded when a ninth needs room and its last frame stays on
its canvas.

## Benchmarks (`bench/`)

Budgets (viewer v3 §15): at most 4 ms of main-thread JS per frame, 2 MB of GPU
upload per frame, no main-thread decode, at 4,096 envs.

```sh
node web/bench/frame.mjs                       # CPU only: interpolation, instance matrices, crowd proxies
uv run python web/bench/gen_big.py /tmp/lib big_4096 4096 1000 contacts
uv run simscope serve /tmp/lib --port 8772 &
python3 web/bench/devserver.py 8791 --up http://127.0.0.1:8772 --root .
# open http://127.0.0.1:8791/web/bench/crowd.html?run=big_4096  (result in the page and window.result)
```

## Layout

| File | Role |
| --- | --- |
| `src/core/index.js`, `index.d.ts` | the public API and its types |
| `src/core/format.js` | pack, block, and mesh decoders; CRC-32; no DOM |
| `src/core/source.js` | `PackSource`, `HttpSource`, `SourceError` |
| `src/core/run.js` | reading a run's manifest, stream directories and derived files |
| `src/core/decode.js`, `decode_worker.js` | the decode worker and its protocol |
| `src/core/cache.js` | byte LRU and the block store |
| `src/core/clock.js`, `loop.js` | `Clock`, `FrameTimer`, the shared rAF loop |
| `src/core/player.js` | `Player` |
| `src/core/camera.js` | camera rig on camera-controls |
| `src/core/follow.js`, `interp.js` | damping, root body rule; pose interpolation |
| `src/core/tiers.js`, `picking.js`, `crowd.js` | focus set, ray picking, crowd proxies |
| `src/core/theme.js` | oklch to sRGB, the viewport palette |
| `src/core/scene.js`, `overlays.js`, `ground.js` | scene building, arrows, polylines, ground |
| `src/core/renderer.js` | shared (blit) and direct renderers |
| `src/core/compare.js` | `linkCameras`, the ground-aligned camera group |
| `src/core/extent.js` | the run's vertical range and the world height that fits it (pure) |
| `src/element/` | the custom element and `attachMaster`; `marks.js` lays out the scrub-bar markers |
| `test/headless.mjs` | helpers: players without WebGL, projection, a simulated drag |
| `test/encoder.mjs` | test-only encoder that mirrors the spec |
| `demo/make_demo.mjs` | writes `demo/demo.simscope` and `demo/index.html` |

Golden files from the Python writer (`tests/fixtures/format/`) are decoded by
`test/format.test.mjs` when present.

## Demo

```sh
node demo/make_demo.mjs && open demo/index.html   # works from file://
```
