# Spike report: a timeline and browse UI inside viser (Phase 0 spike a)

**Status:** spike report, not a decision. The lead records the decision in the
[decision log](../specs/2026-09-30-simscope-proposal.md#decision-log) (D3).

**Date:** 2026-09-30. **Versions:** viser 1.1.1, Chrome 152 on Apple silicon,
Python 3.12.

## Question

D3 says the browse and annotate UI lives inside the viser app. The fallback is
a small Starlette page that hosts the timeline next to the viser scene. The
proposal (section 5) asks for these timeline features:

- Playback controls: play, pause, scrub, speed, loop.
- Timeline markers colored by event type.
- A hotkey that creates an instant event at the playhead. A second press
  closes it into a segment.
- A notes and rating panel.
- A browse panel over thousands of runs: search, filters, sort, paging.

The spike asks: do stock viser 1.1.1 GUI primitives carry a usable version of
this, with no client fork?

## Recommendation

**GO: stay inside viser for v1.** Every feature listed above works with stock
primitives, and the code is small and clean enough to ship (`ui.py` is about
830 lines, `models.py` holds the logic and is fully unit tested).

Two limits matter. Decide now whether they are acceptable:

1. **The timeline is a display, not a canvas.** Users cannot drag on it to
   create or resize a segment, and cannot click a marker to select it. Event
   creation and editing go through buttons, hotkeys, a dropdown, and a
   two-handle range slider.
2. **There is one lane.** Overlapping events draw on top of each other. Viser
   has no multi-track timeline (NVIDIA's fork needed 3,086 lines of
   `Timeline.tsx` for that).

If the product later needs direct manipulation or multi-lane tracks, switch to
the fallback below. The models, playback, and renderer do not change, because
`ui.py` is the only file that touches viser GUI calls.

## What was built

All under `src/simscope/viewer/`. Tests are in `tests/viewer/` (120 tests, all
headless). The runnable demo is `examples/viewer_demo.py`.

| File | Role |
| --- | --- |
| `ui.py` | `TimelineControls`, `BrowsePanel`, `NotesPanel`, `ClientSession`, `ViewerApp` |
| `models.py` | `EventStore` (instant-then-segment logic, HTML strip), `RunIndex` (fake 5,000-run index) |
| `playback.py` | `Playback` clock, with `add_listener` / `remove_listener` for the UI |

`ViewerApp` gives every browser tab its own `ClientSession`. A session owns that
tab's `SceneRenderer` on `client.scene`, its `Playback`, and its panels, so two
tabs can watch different runs.

## What worked

### Playback controls (works well)

Play/pause button (label and icon follow state), a `Step` button group
(-10, -1, +1, +10), a frame slider, a speed dropdown (0.25x to 4x), and a loop
checkbox.

The slider mirrors the playhead while playing: the playback thread assigns
`slider.value`. Two facts from the viser source shaped the code
(`_gui_handles.py`, the `value` setter):

- A server-side assignment runs the slider's `on_update` callbacks
  synchronously with `event.client_id is None`. The scrub callback ignores those
  events, or it would seek in a loop (`if event.client_id is not None`).
- Assigning an unchanged value is a no-op, so redundant updates are free.

Observed in the browser: clicking the play button, then waiting 2 s, showed
`t = 1.02 s`, frame 51, and a `Pause` label, with the scene moving. Clicking the
slider track at 60% jumped to frame 179 (`t = 3.58 s`).

### Timeline markers (partly works)

I tried three mechanisms:

| Mechanism | Result |
| --- | --- |
| Slider `marks` | **Works**, with limits. Marks show a text label under the track at any value. There is no color, no width (so no segments), and labels collide when events are close. `marks` is only a constructor argument; changing it later uses the private prop `_marks`. It is assignable and updates live (verified in the browser), but it is private API. |
| `add_html` strip | **Works well.** `add_html` sets `innerHTML` (`components/Html.tsx`), so an absolutely positioned `<div>` per event gives colored bars sized as percent of the duration, with hover tooltips (`title`). I updated `handle.content` on every change; the update is instant. It aligns with the slider track using `em` margins that skip the label column (6.9 em) and number box (3.9 em). Those numbers come from `components/common.tsx` and `Slider.tsx` and would need a re-check on a viser upgrade. It is display only: clicking or dragging it does nothing, and it cannot call back to Python. |
| `add_uplot` | Not used. `GuiUplotHandle` has no events, so it cannot report clicks or the cursor back to the server. It stays useful for plotting scalar streams. |

In the browser, a segment from 1.64 s to 3.24 s drew as a green bar exactly
under 27% to 54% of the slider track, with the `succ1` mark under its start.

### Instant event, then segment, with hotkeys (works)

`gui.add_command(label, hotkey=..., modifier=...)` registers a command in the
command palette and binds a keyboard shortcut. Viser 1.1.1 allows letters,
digits, space, enter, escape, arrows, and modifiers `cmd/ctrl`, `alt`, `shift`.
The client uses Mantine `useHotkeys` (`CommandPalette.tsx`).

Bindings in the demo: space toggles play, `M` marks an event, arrows step by
one frame, shift+arrows step by ten, escape cancels an open event.

Verified in the browser with real key events: `space` played, `M` created an
instant event at the playhead (button label became `Close event (M)`, a thin bar
appeared), a second `M` closed it into a segment and the label reset, and
`space` paused. I also confirmed hotkeys still fire while the slider has focus.
I did not verify typing in a text field. Mantine's default is to ignore hotkeys
while an `INPUT`, `TEXTAREA`, or `SELECT` has focus. Typing "m" into the search
box should therefore not create an event, but I did not test it.

Limit: the event time is the server's playhead when the command arrives, so it
includes network delay. For a 30 fps display and a local server this is well
under one frame; for a remote server it could be a few frames off. Event times
are editable afterwards.

### Segment editing (works, indirectly)

A dropdown picks an event. A `add_multi_slider` with two handles edits its start
and end, and a text box edits its label. A delete button removes it. Dragging a
handle updates the strip and the mark live. Selecting another event loads its
range into the slider (server-side assignments do not trigger the edit
callback, using the same `client_id is None` guard).

This is usable but not fluid: five widgets stand in for one drag gesture.

### Browse panel over 5,000 runs (works well)

`BrowsePanel` has a search box, a tag dropdown, a favorites checkbox, a sort
dropdown, a `Prev` / `Next` button group, and 20 result buttons per page.
Selecting a run swaps the rollout shown to that client only.

Two ways to draw the list, compared:

| Mode | Server-side refresh | Click to DOM change (browser) |
| --- | --- | --- |
| **Pooled**: 20 buttons created once, relabeled in place, hidden when unused | 0.25 ms | about 30 ms (6 clicks: 30-32 ms) |
| **Rebuild**: destroy and recreate a folder with 20 buttons | 1.31 ms | about 34 ms (6 clicks: 33-38 ms) |

The browser number is the time from `button.click()` to the first DOM mutation,
measured with a `MutationObserver` in the page. It includes one round trip to
the server on localhost. Both modes feel instant; pooled is the default because
it sends fewer messages and keeps scroll position stable.

Index queries over 5,000 rows take 0.02 to 0.5 ms (search 0.07 ms, sort by name
0.47 ms). They are vectorized numpy over columns. The real index will be SQLite,
but the shape of the query is the same.

Run swap: `ClientSession.load` (stop old clock, remove old nodes, build new
nodes, start new clock, rebind the timeline) took 3.0 to 3.3 ms on the server in
five consecutive swaps of an 8-body, 4-env scene. From the browser, the time until
the selected button turned green was 70 to 460 ms, which is dominated by the
button's color transition and the harness's timer throttling, so treat it as an
upper bound.

I typed a search and pressed Enter; the list filtered to 121 of 5,000 runs
(page 1 of 7). I did not check whether viser sends text on every keystroke or
only on commit, and that decides whether search-as-you-type is possible.

### Notes and rating panel (stub only)

A collapsed folder with a rating button group (1 to 5), favorite checkbox, tags
text, multi-line notes text, and a `Save` button that only logs. Nothing is
persisted. The multi-line `add_text` works. No blocker seen.

### Rendering (Part A, for context)

`SceneRenderer.update` for a G1-like scene (31 bodies, 56 dynamic instances per
env) against a real `ViserServer` with no clients connected:

| Envs | Instances | `update` | Pose math only | Target |
| --- | --- | --- | --- | --- |
| 1 | 56 | 0.09 ms | 0.04 ms | 0.5 ms |
| 16 | 896 | 0.13 ms | 0.09 ms | none |
| 256 | 14,336 | 0.67 ms | 0.59 ms | 5 ms |
| 1,024 | 57,344 | 2.4 ms | 2.3 ms | none |

Run `uv run python benchmarks/bench_viewer.py` to reproduce. In the browser the
demo drew 4 envs of a 9-geom chain (box, sphere, ellipsoid, cylinder, capsule,
mesh, a translucent capsule, a ground grid) and animated smoothly at 30 fps.

## What did not work, or is awkward

1. **No direct manipulation on the timeline.** See the recommendation. This is
   the main gap.
2. **No colored slider marks.** Color exists only in the HTML strip, so the
   strip and the slider are two elements that must stay aligned by CSS guess.
3. **The strip cannot report clicks.** Even though inline handlers such as
   `onclick` would run in the browser, the page has no channel back to Python.
   I did not try to build a hack with `fetch` to a side endpoint. It would be
   the first step of the fallback anyway.
4. **Overlapping events** draw on top of each other in one lane.
5. **`marks` uses a private prop** (`_marks`). It is one line in `ui._set_marks`.
6. **The control panel is a long vertical stack.** With 20 result buttons,
   playback controls scroll out of view unless they are placed first (they are).
   `gui.add_panel()` creates movable, dockable windows and might host the
   timeline as a bottom bar. I did not test it.
7. **Test-harness quirk, not a product issue.** Viser fires `on_client_connect`
   only after the browser sends its first camera message. The Browser pane in
   this environment was hidden (`document.hidden === true`), so
   `requestAnimationFrame` never ran and no client ever "connected". I worked
   around it with a small local proxy that injects a `MessageChannel`-based
   `requestAnimationFrame` shim into the viser page, and it is not part of the
   repo. Anyone testing the UI headlessly hits the same wall.

## Fallback design (if direct manipulation is required)

Keep the viser scene and every server-side component. Add a Starlette page:

- **Layout.** One page with the viser client in an `<iframe>` (or a second
  browser window) on top and a timeline `<canvas>` below.
- **Data.** `GET /api/run/{id}/events`, `POST` and `DELETE` for events, all
  backed by the same `EventStore` and, later, `annotations.json`. The timeline
  polls or holds a websocket for the playhead.
- **Control.** The page sends `seek`, `play`, and `pause` to a small
  `POST /api/session/{client}/control` endpoint, which calls the existing
  `Playback` methods. `Playback.add_listener` already gives the server a hook to
  push the frame number back.
- **Client size.** About 300 lines of plain JS: draw the ruler and event bars,
  drag to create or resize, click to select, shift-click to close a segment.
  No framework, so it works offline in the same single-file export.
- **What is reused.** `EventStore`, `Playback`, `SceneRenderer`, `RunIndex`,
  `BrowsePanel` (the browse and notes panels can stay in viser).
- **Cost.** A second HTTP surface (Starlette, next to viser's own server) and a
  session id that ties the iframe's viser client to the page. The two must stay
  in sync, and I did not prototype that.

## Open questions for the lead

1. Is "button and hotkey creates events, range slider edits them" acceptable for
   v1, or must users drag on the timeline?
2. Do we need overlapping events shown in separate lanes in v1? The proposal
   says events are typed by `event_types.json`; the same-type overlaps are the
   ones that hurt.
3. Should the demo's server-side event time be corrected for network delay?
   Sending the client's own frame estimate with the command is not possible in
   viser today.
