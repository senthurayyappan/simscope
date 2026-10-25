<p align="center">
  <img src="https://raw.githubusercontent.com/senthurayyappan/simscope/main/docs/images/banner.webp" alt="simscope playing a quadruped's jump over a wall, with the run library, plots, and timeline around the 3D view" width="900">
</p>

<p align="center">
  <a href="https://pypi.org/project/simscope/"><img src="https://img.shields.io/pypi/v/simscope" alt="PyPI"></a>
  <a href="https://github.com/senthurayyappan/simscope/actions/workflows/ci.yml"><img src="https://github.com/senthurayyappan/simscope/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://senthurayyappan.github.io/simscope/"><img src="https://img.shields.io/badge/docs-github.io%2Fsimscope-blue" alt="Docs"></a>
  <a href="https://github.com/senthurayyappan/simscope/blob/main/pyproject.toml"><img src="https://img.shields.io/badge/Python-3.12%20%7C%203.13%20%7C%203.14-3776AB?logo=python&logoColor=white" alt="Python"></a>
  <a href="https://github.com/senthurayyappan/simscope/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License"></a>
</p>

simscope is a viewer for robot simulation rollouts. Record rollouts from MuJoCo or Isaac Lab, or import ones you already have, then browse, compare, and annotate them in the browser. Any rollout exports as one HTML file that plays offline.

## Install

```bash
pip install "simscope[viewer,mujoco]"
```

simscope needs Python 3.12 or newer. The extras are optional. `viewer` is what `simscope serve` runs on, and `mujoco` is for recording from MuJoCo. Without them, everything else still works: recording from your own code, importing, and exporting. Isaac Lab needs no extra, because you install simscope into its environment. With uv, use `uv add "simscope[viewer,mujoco]"`.

### From source

To develop or modify simscope, work from a clone. This path needs [uv](https://docs.astral.sh/uv/getting-started/installation/):

```bash
git clone https://github.com/senthurayyappan/simscope
cd simscope
uv sync --extra viewer --extra mujoco
```

In a clone, put `uv run` in front of the commands below, as in `uv run simscope serve rollouts`. The built browser code is committed, so you only need Node to change it.

## Quickstart

This script drops a box in MuJoCo and records its pose, its contact forces, and its height:

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

Run it, then serve the folder it wrote:

```bash
simscope serve rollouts
```

`serve` prints an address, `http://127.0.0.1:8080` by default. Open it and select `drop`. The camera follows the box, the plot shows `height`, and the timeline marks the landing twice, as a peak in center-of-mass acceleration and a peak in net contact force. Contact forces are drawn as arrows.

To share the rollout, export it as one HTML file, or as a USD file for Blender:

```bash
simscope export rollouts drop -o drop.html
simscope usd rollouts drop -o drop.usdz
```

The HTML file is the player page. Add `--ui full` to export the whole viewer instead.

For Isaac Lab, call `simscope.isaaclab` from inside the environment: `scene_from_env`, `PoseBuffer`, and `contacts`. To replay rollouts you already have, run `simscope import rollouts episode.rbundle` (it also reads Brax HTML pages), then serve the folder.

## Features

- [Browse](https://senthurayyappan.github.io/simscope/getting-started/) a folder by date or by group, with search, ratings, pins, and notes.
- [Compare](https://senthurayyappan.github.io/simscope/getting-started/#exports) up to four rollouts on one clock, with cameras and ground aligned.
- See peaks in contact force and center-of-mass acceleration on the timeline, or [add your own markers](https://senthurayyappan.github.io/simscope/getting-started/#custom-markers).
- Follow a body, switch between iso, front, side, and top views, and toggle contacts and collision shapes.
- Light the scene from the camera or from a fixed sun, and [capture screenshots and GIFs](https://senthurayyappan.github.io/simscope/getting-started/#screenshots-and-gifs) of the viewport.
- [Export](https://senthurayyappan.github.io/simscope/getting-started/#exports) one HTML file: `--ui lean` is the player, and `--ui full` is the whole app.
- [Open a rollout in Blender](https://senthurayyappan.github.io/simscope/getting-started/#usd-for-blender) as a `.usdz` file.
- Stay interactive with thousands of envs: nearby envs are drawn in full and the rest as simple shapes.
- Put an export on an [mkdeck](https://github.com/senthurayyappan/mkdeck) slide: `![Rollout](assets/box.html)`.

The [documentation](https://senthurayyappan.github.io/simscope/) covers the workflow, the [CLI](https://senthurayyappan.github.io/simscope/cli/), and the [API](https://senthurayyappan.github.io/simscope/api/). [Design](https://senthurayyappan.github.io/simscope/design/) explains why simscope exists and records the decisions behind it.

## Develop

```bash
make install
make check
make test
```

The [developing guide](https://senthurayyappan.github.io/simscope/developing/) covers the browser build and where to add an adapter or a marker.

## Contribute and license

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](https://github.com/senthurayyappan/simscope/blob/main/CONTRIBUTING.md) first.

simscope is [Apache 2.0](https://github.com/senthurayyappan/simscope/blob/main/LICENSE.md) licensed. Copyright 2026 Senthur Ayyappan. The package also carries three.js, camera-controls, React, Radix, uPlot, Inter, and other libraries under their own licenses, and code adapted from mjviser. See [THIRD_PARTY_NOTICES.md](https://github.com/senthurayyappan/simscope/blob/main/THIRD_PARTY_NOTICES.md).
