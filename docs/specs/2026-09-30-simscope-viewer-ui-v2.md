# simscope viewer UI v2

**Status:** Superseded by [viewer v3](2026-09-30-simscope-viewer-v3.md)
(decision D16), 2026-09-30. The viser viewer this spec describes has been
deleted. Kept as history: §1 lists the problems that led to v3.

The original status read: accepted for implementation, 2026-09-30, after a
design review against the viser 1.1.1 source. It redesigned the `simscope
serve` interface inside Viser (decision D13) using only public viser API.

## 1. Problems with v1 (from the demo)

1. Everything sits in one scrolling column. The run list, the main way to
   move between runs, is at the bottom under about 25 controls.
2. There is no context for the open run: its name, source, duration, tags,
   and rating are not shown anywhere.
3. Every button is a full-width, text-only, brand-blue block. The destructive
   "Delete event" is as prominent as "Play".
4. Internal details leak into the UI: `Env (-1 = all)`, `5. (untyped)`,
   numbered type labels, and a raw frame number box.
5. Stepping controls (`-10 -1 +1 +10`, `Go to start`) clutter playback.
6. The camera never follows the robot, and there are no camera presets.
7. Recorded scalar streams are never plotted.
8. Viser's own chrome competes with the app. The light theme and plain grid
   look unfinished.
9. Rating and moving to the next run both need mouse trips across the screen.

## 2. Layout

Three docked panels are built per client with `client.gui`. The 3D view
takes the middle.

```text
┌──────────────┬──────────────────────────────────────┬────────────────────┐
│ LIBRARY      │                                      │ TIMELINE           │
│ [Runs][Cmp]  │                                      │ ⏮ ◀ ▶ ▶| ⏭  1× ⟳   │
│ search       │                                      │ 2.14 / 8.00 s · f107│
│ ☆ status sort│              3D scene                │ ═══════●══════════ │
│ tag chips    │        (camera follows the run)      │ ▮▮ event strip ▮▮  │
│ ──────────── │                                      │ [Fall F][Slip S]…  │
│ ★ trot_f2.0 +│                                      ├────────────────────┤
│   trot_f1.5 +│                                      │ [Run][Plot][View]  │
│ ● live_trot +│                                      │  tab content       │
│ ‹  1 / 4  ›  │                                      │                    │
└──────────────┴──────────────────────────────────────┴────────────────────┘
```

- **Left, Library:** `client.gui.add_panel()`, docked left, width 300. It has
  two tabs:
  - Runs: search, filters, the run list, and the pager.
  - Compare: the picked runs, and the Open action.
- **Right column, top, Timeline:** its own panel, docked right. It holds
  transport, time, the scrubber, the event strip, and the event-type buttons.
  Annotating happens where playback is watched.
- **Right column, below, Inspector:** the main panel,
  `main_panel.dock_below(timeline)`. It has three tabs: Run, Plot, and View.
- **Order constraint:** dock the Timeline first, then call
  `main_panel.dock_below(timeline)`, because the anchor must already be
  docked.
- **Cleanup:** panels are top-level entities, so `ClientSession.close()`
  must `remove()` every panel it created, or they leak.
- **Narrow screens:** viser's mobile bottom sheet shows the panels as
  collapsible sections, in the order Timeline, Inspector, Library.

## 3. Theme and chrome

- `configure_theme(dark_mode=True, brand_color=(76, 139, 245),
  show_logo=False, show_share_button=False, control_width="large")`.
- Label the Library panel with `set_panel_label`:
  `simscope · <folder> · N runs`. Dev Settings cannot be hidden (it is client
  state), so leave it.
- Scene:
  - `set_up_direction("+z")` and `configure_default_lights()`
  - one environment map from the wheel, sent once per client (30–130 KB)
  - a grid at z = 0 with muted minor lines and stronger section lines
- Color use:
  - brand blue for the single primary action in an area
  - gray for secondary actions
  - red only for destructive actions, which always need a second
    confirming click
  - amber for favorites, green for LIVE
- **Button groups have no per-option color or selected state** in viser
  1.1.1. Anything that must show selection is a row of pooled `add_button`s
  with `color=`, or it carries the state in its label. That covers tag
  chips, star rating, event types, presets, and the pager.

## 4. Library panel

- **Search:** a text box that updates results as you type. It matches name,
  tags, and notes.
- **Filters:** a favorites toggle button (amber when on), a status dropdown
  (Any, Complete, Recording, Candidate, Rejected), and a sort dropdown
  (Newest, Name, Longest, Top rated).
- **Tag chips:** pooled buttons for the 8 most common tags in the current
  results. A chip toggles a filter. Selected chips are brand blue, the
  others gray.
- **Run list:** 12 per page. Each row is a run button with a label such as
  `★ name · 8.0 s` or `● name · live`, plus a small `+` compare button. The
  open run is brand blue. The row's hint shows tags, creation time, and
  source.
- **Pager:** `‹` and `›` buttons with a `2 / 5` label between them.
- **Compare tab:** the picked runs (2–4), each with a remove button, then
  "Open comparison" as the primary action.

## 5. Timeline panel

- **Transport:** icon buttons:
  - `PLAYER_SKIP_BACK` (start)
  - `PLAYER_TRACK_PREV` (step back)
  - `PLAYER_PLAY` / `PLAYER_PAUSE` (primary)
  - `PLAYER_TRACK_NEXT` (step forward)
  - `PLAYER_SKIP_FORWARD` (end)

  They are followed by a speed dropdown (0.25×–4×) and a loop toggle
  (`REPEAT`).
- **Readout:** `2.14 s / 8.00 s · frame 107`, updated at most about 10 Hz.
  A green `LIVE` marker is added for recording runs, plus a "Follow live
  edge" toggle.
- **Scrubber:** the frame slider, and no number box.
- **Event strip:** keeps v1's lanes, per-env rows, ruler, and playhead drawn
  inside it, restyled for the dark theme. An open event shows as
  "recording…".
- **Event types:** one pooled button per type, in its color, labelled
  `Fall · F`. A click or the key drops an event at the playhead, and a
  second press closes it into a segment.
- **Selected event,** in a folder under the strip:
  - a dropdown of `type · label · 1.20–2.40 s`; picking one seeks to it
  - label and type controls
  - the range slider
  - env as a dropdown (`All`, `0`, `1`, …), replacing -1
  - a small red Delete that asks for confirmation on the first click

## 6. Inspector tabs

**Run** (`INFO_CIRCLE`)
- **Header** (markdown): run name, status badge, duration, frames, envs, dt,
  source and importer, record-time tags, and the current rating as text
  (`★★★★☆`).
- **Curation:**
  - five star buttons, with the rated ones amber
  - a favorite toggle
  - flag and status dropdowns
  - a tags text box with an Apply button
- **Notes:** the latest 3 notes, a text box, and "Add note".
- **Export:** "Export HTML" (`FILE_EXPORT`) and "Export pack" (`DOWNLOAD`).
  A notification is shown, then the download starts.

**Plot** (`CHART_LINE`)
- A dropdown picks a scalar or vector stream. It is plotted with `add_uplot`
  against time, downsampled to at most 500 points when the run opens.
- Assigning `data` resends every series, so the playhead is shown as text,
  not a moving line: `height = 0.412 m at 2.14 s`. The text updates at about
  5 Hz. The plot data is rebuilt only when the stream or run changes.

**View** (`CAMERA`)
- **Follow:** Off / On. The default target is the first moving body, or one
  named `torso`, `base`, or `trunk`.
  - Follow updates `look_at` only, at 10 Hz or less, so the user's orbit
    offset is kept.
  - It skips updates for about 300 ms after the user moves the camera.
  - Presets and Frame turn it off.
- **Presets:** pooled buttons for Iso, Front, Side, and Top, framed on the
  current frame's bounding box. "Frame run" (`FOCUS_2`) fits the camera to
  the current frame.
- **Display:** show collision, show ground grid, and envs shown for batched
  runs (1, 4, 16, or all up to 64).
- **Opening a run** fits the camera to frame 0 with the iso preset. This
  overrides URL camera parameters, which is acceptable.

**Spatial points:** a "Place point" toggle in the Run tab. While it is on,
`scene.on_click` gives a ray, which is intersected with the ground plane
z = 0 (or the env's origin plane) on the server. The point is stored at the
current time.

## 7. Keyboard

| Key | Action |
| --- | --- |
| K | play / pause |
| J / L | step one frame back / forward |
| Shift+J / Shift+L | step 10 frames |
| N / P | next / previous run in the current list |
| U | next unrated run |
| 1–5 | set the star rating |
| V | toggle favorite |
| F, S, G, O | drop or close an event of the default types fall, slip, success, note (from `event_types.json`) |

- Keys used above are added to `RESERVED_KEYS`. Event-type keys that collide
  are skipped with a warning, and the default `note` type
  uses O (not N, which is next run).
- Hotkeys are already suppressed while a text box has focus.

## 8. Behaviour and performance

- **Opening a run:** frames the camera, fills the Run tab, resets the event
  folder, and builds the plot only if the Plot tab has a stream selected.
- **Locking and rates:** every widget refresh stays under the session lock.
  GUI updates driven by playback are limited to about 10 Hz, apart from the
  3D pose update.
- **Budgets,** in `benchmarks/bench_viewer.py`:
  - run switch ≤ 100 ms server side, including framing and the Run tab
  - page change ≤ 20 ms
  - playback tick ≤ 1 ms at E=1
  - follow update ≤ 0.2 ms
  - steady-state GUI messages per client during playback ≤ 30/s, excluding
    3D pose updates
- **Leak test:** 100 connect/disconnect cycles leave no panels, commands,
  threads, or scene nodes behind.
- **Network:** no private viser API and no network requests. Icons and HDRIs
  ship in the wheel.

## 9. Out of scope

- Drag editing on the timeline (see D13's exit criteria).
- Thumbnails in the run list.
- Multi-user presence.
