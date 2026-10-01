# Getting started

```bash
uv sync --extra viewer
uv run simscope --help
```

The workflow is record, serve, browse, export:

```bash
uv run python examples/viewer_demo.py --out demo_lib   # record a small MuJoCo run
uv run simscope serve demo_lib                         # http://127.0.0.1:8080
uv run simscope ls demo_lib
uv run simscope export demo_lib box_drop -o box.html           # lean player
uv run simscope export demo_lib box_drop -o box.html --ui full # whole app
```

The README has a complete MuJoCo recording example. `simscope serve` shows
runs that are still recording, and `simscope import` brings in `.rbundle`
files and Brax HTML viewers.

## Renaming runs

`simscope rename demo_lib old_name new_name` renames a run (in Python,
`Library.rename(old, new)`; in the app, double-click the name). A run's name
is its folder name; its id never changes, so notes, ratings, groups, cached
highlights and exports stay with it. A run that is still recording cannot be
renamed, and neither can one onto an existing name. Reopen any `Rollout` you
had open before the rename, because it still points at the old folder.

## Exports

`simscope export` writes one HTML file that works offline. A lean export
(the default) shows the run in a plain page: the player fills the window and a
single control bar sits under it. A full export (`--ui full`) is the whole app
with the same runs loaded.

To compare runs, export them with `--layout compare`. The file looks like the
app's compare view: the panes fill the page, each titled with its run name,
and one control bar at the bottom plays, steps and scrubs all of them
together. Pick how the panes sit with `--arrange`:

| `--arrange` | Panes |
| --- | --- |
| `side` | Side by side, left to right. The default for two runs. |
| `stack` | One above the other, top to bottom. |
| `grid` | Two by two; with three runs one cell stays empty. The default for three or four runs. |

```bash
uv run simscope export demo_lib run_a run_b -o compare.html --layout compare
uv run simscope export demo_lib run_a run_b run_c -o compare.html \
    --layout compare --arrange stack
```

Compare takes up to four runs, and `--arrange` only applies with
`--layout compare`. In Python, pass `layout="compare"` and `arrange="stack"`
to `simscope.export.export_html`. The viewer's Export button sends the
arrangement you are looking at.

## In the app

The library is on the left (by date or by group, five runs per section), the
plots and metadata on the right, and the timeline at the bottom; each
collapses. Keys: K play or pause, J and L step (Shift for 10 frames), F
follow, C contacts, M label the moment, `[` and `]` step envs, N and P step
runs, 1 to 5 rate, V pin, T theme.

Highlights are the markers on the timeline. Two kinds are built in, and they
mean the same for any robot: **Contact force** (the net force of the
`contacts` stream, such as "412 N, 5.1x typical") and **Acceleration** (the
acceleration of the centre of mass, such as "41 m/s², 4.2 g"). A peak is a
moment that stands out from the run's usual level. They are cached under
`.simscope/derived/` in the library and travel inside full exports (the lean
player does not draw them). Anything more
specific to your robot or task, such as a jump or a slip, is yours to add; see
the next section.

## Custom markers

There are two ways to put your own markers on the timeline.

**1. Compute them.** Write a function that takes the run and returns a list
of `highlights.Highlight`, and register it. Each `Highlight` has a time `t`
in seconds, a `frame`, an `env`, your kind's key, a `score` (higher is more
notable) and a `value`. Give `t1` and `frame1` as well to mark a span. This
one marks every stretch of at least 0.2 s where the root sits below 0.2 m:

```python
import numpy as np
from simscope import highlights

def low_stretches(rollout):
    poses = rollout.stream("body_pose").read(0, rollout.n_frames)  # [T, E, B, 7]
    z = poses[:, :, highlights.root_body(rollout.scene), 2]       # root height
    found = []
    for env in range(rollout.n_envs):
        low = np.r_[False, z[:, env] < 0.2, False]
        edges = np.flatnonzero(np.diff(low.astype(int)))          # starts, ends
        for start, end in zip(edges[::2], edges[1::2], strict=True):
            if (end - start) * rollout.dt >= 0.2:
                found.append(highlights.Highlight(
                    t=start * rollout.dt, frame=int(start),
                    t1=(end - 1) * rollout.dt, frame1=int(end - 1),
                    env=env, kind="low", score=float(end - start),
                    value=float(z[start:end, env].min()),
                    detail=f"under 0.2 m for {(end - start) * rollout.dt:.1f} s"))
    return found

highlights.register("low", low_stretches, label="Low", color="#d9480f")
```

The key is lower case letters, digits and `_`. The colour is optional (a CSS
hex colour). The detector runs once per run, in the background, and its
markers are cached with the built-in ones; changing the detector's label or
colour, or adding another detector, refreshes the cache. A detector that
raises, or returns a marker with a frame or env outside the run or a time
that is not finite, is logged with its name and skipped, and the other kinds
still show. Register before you serve or export, in the same process:

```python
from simscope import server
server.serve("my_library")      # the same as `simscope serve`, with your kinds
```

**2. Add them by hand.** An event is a marker you place yourself, with a time
or a span, a label and, if you like, a type with a colour. Events are saved
next to the run (`annotations.json`) and show in the Labels lane:

```python
from simscope import annotations, library

lib = library.Library("my_library")
lib.set_event_types([annotations.EventType(type_id="slip", name="Slip", color="#e59a1c")])
with lib.open("walk") as run:
    run.annotations.add_event("slip", t0=1.2, t1=1.5, label="left foot slips", env=0)
    run.annotations.save()
```

Use computed markers for something you can find from the data in every run,
and events for something you noticed.

## Development

Python:

```bash
uv run pre-commit install --hook-type pre-commit --hook-type commit-msg
uv run pre-commit run --all-files
uv run pytest --cov --cov-report=term-missing
uv run --group docs mkdocs serve
```

Browser code lives in `web/` (player core, `<simscope-player>` element, React
app). The built bundles are committed under `src/simscope/_assets/`, and CI
fails if they differ from a fresh build. Rebuild after editing `web/src`:

```bash
cd web && npm ci && npm run build && npm test
```

Add runtime dependencies with `uv add package-name`, development tools with
`uv add --dev tool-name`, and documentation tools with `uv add --group docs tool-name`.
Commit both `pyproject.toml` and `uv.lock` after dependency changes.
