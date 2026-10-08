# Getting started

simscope needs Python 3.12 or newer and [uv](https://docs.astral.sh/uv/getting-started/installation/). It is not on PyPI yet, so work from a clone:

```bash
git clone https://github.com/senthurayyappan/simscope
cd simscope
uv sync --extra viewer --extra mujoco
```

The built browser code is in the repository, so this install does not need Node.

```bash
uv run python examples/viewer_demo.py --out demo_lib
uv run simscope serve demo_lib
uv run simscope ls demo_lib
uv run simscope export demo_lib box_drop -o box.html
```

`serve` opens http://127.0.0.1:8080. The [CLI reference](cli.md) lists every flag.

## Record

A recording wraps the simulation loop. This one drops a box and logs its pose, its contact forces, and its height:

```python
import mujoco
import simscope
from simscope import mujoco as smj

model = mujoco.MjModel.from_xml_string(
    "<mujoco><worldbody><geom type='plane' size='2 2 0.1'/>"
    "<body pos='0 0 1'><freejoint/><geom type='box' size='.1 .1 .1'/></body>"
    "</worldbody></mujoco>"
)
data = mujoco.MjData(model)

lib = simscope.Library("rollouts")
with lib.record("drop", scene=smj.scene_from_model(model), dt=0.02) as rec:
    smj.add_contacts_stream(rec, model, max_contacts=16)
    for _ in range(100):
        for _ in range(10):
            mujoco.mj_step(model, data)
        rec.log(
            smj.poses(data),
            contacts=smj.contacts(model, data, max_contacts=16),
            height=float(data.xpos[1, 2]),
        )
```

Open the rollout with `simscope serve rollouts`. The camera follows the box. The plot shows `height`. The timeline marks the landing twice, once for center-of-mass acceleration and once for net contact force. Contact forces are drawn as arrows.

For Isaac Lab, call `simscope.isaaclab` from inside that environment: `scene_from_env`, `PoseBuffer`, and `contacts`.

`examples/viewer_demo.py` records a longer tumbling drop into a folder you choose with `--out`.

## In the app

The library sits on the left, five rollouts per section, grouped by date or by group. Plots and metadata sit on the right. The timeline sits at the bottom. Each region collapses.

| Key | Action |
| --- | --- |
| K | Play or pause |
| J, L | Step one frame. Shift steps ten |
| F | Follow the selected body |
| C | Contacts |
| M | Label the moment |
| `[`, `]` | Step envs |
| N, P | Next or previous rollout |
| U | Next unrated rollout |
| 1 to 5 | Rate |
| V | Pin or unpin |
| 0 | Frame the whole scene |
| W, S | Zoom |
| A, D | Pan |
| T | Theme |

Highlights are the markers on the timeline. Two kinds are built in, and they mean the same thing for any rollout. **Contact force** is the net force of the `contacts` stream. **Acceleration** is the acceleration of the centre of mass. A peak is a moment that stands out from that rollout's usual level. The markers are cached under `.simscope/derived/` and travel inside a full export. The lean player does not draw them.

Anything else you want marked is yours to add. The next section shows how.

## Custom markers

There are two ways to put your own markers on the timeline.

**Compute them.** Write a function that takes the rollout and returns a list of `highlights.Highlight`, and register it. Each `Highlight` has a time `t` in seconds, a `frame`, an `env`, your kind's key, a `score` (higher is more notable), and a `value`. Set `t1` and `frame1` to mark a span. This detector marks every stretch of at least 0.2 s where the root sits below 0.2 m:

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

The key is lower case letters, digits, and `_`. The colour is a CSS hex colour, and it is optional. The detector runs once per rollout, in the background, and its markers are cached with the built-in ones. Changing the label or the colour, or adding another detector, refreshes the cache. A detector that raises, or that returns a marker with a frame or env outside the rollout or a time that is not finite, is logged and skipped. The other kinds still show.

Register before you serve or export, in the same process:

```python
from simscope import server
server.serve("my_library")
```

**Add them by hand.** An event is a marker you place yourself, with a time or a span, a label, and an optional type. Events are saved next to the rollout in `annotations.json` and show in the Labels lane:

```python
from simscope import annotations, library

lib = library.Library("rollouts")
lib.set_event_types([annotations.EventType(type_id="landing", name="Landing", color="#e59a1c")])
with lib.open("drop") as rollout:
    rollout.annotations.add_event("landing", t0=0.4, t1=0.5, label="box lands", env=0)
    rollout.annotations.save()
```

Use a detector for something the data can find in every rollout. Use an event for something you noticed.

## Screenshots and GIFs

The viewport has two groups of controls. View options sit at the top left: the theme, the ground, geometry, contacts, and for a comparison the arrangement. Capture and Export sit at the top right.

The arrow beside the ground button opens its menu. Choose a checkerboard or a grid, and a colour: Automatic, Light, Dark, or MuJoCo blue. Automatic follows the theme. The other colours stay the same in light and dark mode, so you can have a dark ground under a light interface. The choice is remembered.

The camera button opens the capture menu. It works in the served app and in a full export. It captures the active pane. The menu stays open while you pan, zoom, hide a sidebar, or move the stretch on the timeline. Close it with the camera button or Escape.

A capture has a fixed size, so it does not depend on your window or your screen. Pick a shape (16:9, 4:3, or 1:1) and a width. While the menu is open, the pane outlines the frame it will save: the largest frame of that shape that fits in the view, centred on it. Pan, zoom, or orbit to change the framing.

A screenshot is a PNG, 1280, 1920, or 3840 pixels wide. The longest side is capped at 8192 pixels, or at what your GPU allows.

A GIF plays for at most 5 seconds, so it stays small enough to share. It shows the loop region when there is one, and the whole run otherwise. It plays at the speed set on the timeline, so at 2× a 10-second stretch makes a 5-second GIF, and at 0.5× a 2.5-second stretch does. For a stretch that plays for longer than 5 seconds:

1. Drag on the timeline ruler to select a stretch. Or press **Select 5 s from the playhead** in the capture menu.
2. Drag inside the selection to slide it along the timeline. Drag an edge to resize it.
3. Pick a width (480, 720, or 960 pixels) and FPS (10, 20, or 25), then save.

The GIF loops, and its last frame leads into its first. The camera follows as in playback. The clock pauses while the GIF renders and returns to where it was. You can cancel at any time.

A GIF has 256 colours, shared by every frame. The viewer draws the run twice to choose them, so a dark ground does not flicker or fade into the background.

## Exports

`simscope export` writes one HTML file that works offline. A lean export, the default, fills the window with the player and puts one control bar under it. A full export (`--ui full`) is the whole app, with the same rollouts loaded, and it includes highlights.

To compare rollouts, pass `--layout compare`. The panes fill the page. Each pane is titled with its rollout name, and one control bar plays, steps, and scrubs all of them together. `--arrange` sets how the panes sit:

| `--arrange` | Panes |
| --- | --- |
| `side` | Side by side, left to right. The default for two rollouts |
| `stack` | One above the other |
| `grid` | Two by two. With three rollouts, one cell stays empty. The default for three or four rollouts |

```bash
uv run simscope export demo_lib drop_a drop_b -o compare.html --layout compare
uv run simscope export demo_lib drop_a drop_b drop_c -o compare.html \
    --layout compare --arrange stack
```

Compare takes up to four rollouts. `--arrange` applies only with `--layout compare`. In Python, pass `layout="compare"` and `arrange="stack"` to `simscope.export.export_html`. The viewer's Export button sends the arrangement you are looking at.

Without `--layout`, one rollout exports as `single` and several rollouts export as `grid`.

A lean file on an mkdeck slide is an image of that file. Copy it next to the deck and write `![Rollout](assets/box.html)`.

## Rename

`simscope rename demo_lib old_name new_name` renames a rollout. In Python, call `Library.rename(old, new)`. In the app, double-click the name.

The name is the folder name. The id never changes, so notes, ratings, groups, cached highlights, and exports stay with the rollout. A rollout that is still recording cannot be renamed. The new name must not already exist. Reopen any `Rollout` you had open, because it still points at the old folder.

## Import

`simscope import rollouts path/to/episode.rbundle` reads `.rbundle` files and Brax HTML pages. Pass a folder to import every such file inside it. `--tag` adds a tag, and `--overwrite` replaces a rollout that already has that name.

## Work on simscope

[Developing](developing.md) covers the layout, the checks, and where to add an adapter or a marker. Pull requests and releases are in [CONTRIBUTING.md](https://github.com/senthurayyappan/simscope/blob/main/CONTRIBUTING.md).
