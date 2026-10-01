![simscope: record robot rollouts, browse them in a browser, export one HTML file](https://raw.githubusercontent.com/senthurayyappan/simscope/main/docs/images/banner.jpg)

[![CI](https://github.com/senthurayyappan/simscope/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/senthurayyappan/simscope/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](https://github.com/senthurayyappan/simscope/blob/main/pyproject.toml)
[![uv](https://img.shields.io/badge/uv-managed-DE5FE9?logo=uv)](https://docs.astral.sh/uv/)
[![Ruff](https://img.shields.io/badge/lint-Ruff-D7FF64?logo=ruff)](https://docs.astral.sh/ruff/)

simscope records robot simulation rollouts from MuJoCo and Isaac Lab, serves a folder of them as a browser app, and exports any run as one HTML file that works offline. The viewer has its own three.js player, so a camera that follows a robot stays smooth, and a folder of thousands of runs or a run with thousands of envs stays interactive.

## Install

simscope needs Python 3.12 or newer and [uv](https://docs.astral.sh/uv/getting-started/installation/). It is not on PyPI yet, so work from a clone:

```bash
git clone https://github.com/senthurayyappan/simscope
cd simscope
uv sync --extra viewer --extra mujoco    # the browser app and the MuJoCo adapter
```

The built browser code is part of the repository, so you do not need Node to use it.

## Quickstart

```bash
uv run python examples/viewer_demo.py --out runs   # record a small MuJoCo run
uv run simscope serve runs                         # browse it at http://127.0.0.1:8080
uv run simscope ls runs                            # list the runs in the terminal
uv run simscope export runs box_drop -o box.html   # write one HTML file that plays the run
uv run simscope export runs box_drop -o box.html --ui full   # or the whole viewer, offline
```

## Example

A recording is a few lines around your simulation loop. This one drops a box on a plane and logs its pose, its contact forces, and its height:

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

lib = simscope.Library("runs")
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

Run `simscope serve runs` and open the run. The camera follows the box, the plot shows `height`, and the timeline marks the landing at 0.42 s twice: a peak in the center of mass acceleration (16.1 g) and a peak in the net contact force (1,435 N). The contact forces are drawn as arrows in the scene.

For Isaac Lab, use `simscope.isaaclab` inside your environment: `scene_from_env`, `PoseBuffer`, and `contacts`.

## What you can do

- [Browse a folder of runs](https://github.com/senthurayyappan/simscope/blob/main/docs/getting-started.md) by date or by group, search them, rate and pin them, and add notes.
- Open [several runs side by side](https://github.com/senthurayyappan/simscope/blob/main/docs/getting-started.md#exports) in one window, stacked, or in a grid. They share one clock, and the cameras and ground stay aligned, so a 1 m wall and a 0.8 m wall compare fairly.
- See where something happens. The timeline marks peaks in net contact force and in center of mass acceleration, and you can [add your own markers](https://github.com/senthurayyappan/simscope/blob/main/docs/getting-started.md#custom-markers) from Python.
- Follow a robot with an orthographic camera, switch between iso, front, side and top views, and turn contacts and collision shapes on and off.
- [Export](https://github.com/senthurayyappan/simscope/blob/main/docs/getting-started.md#exports) a run, or a comparison, as one HTML file with no network requests. The file looks like the viewer. Use `--ui lean` for a small player page and `--ui full` for the whole app.
- Import runs you already have: `simscope import runs path/to/rollout.rbundle` reads `.rbundle` files and Brax HTML viewers.
- Record runs with thousands of envs. The viewer draws the envs near the one you select in full detail and the rest as simple shapes, and it decodes in the background.
- Put an exported run on a [mkdeck](https://github.com/senthurayyappan/mkdeck) slide: copy the file next to your deck and write `![Run](assets/box.html)`.

The design is written down in [docs/specs](https://github.com/senthurayyappan/simscope/tree/main/docs/specs). The [proposal](https://github.com/senthurayyappan/simscope/blob/main/docs/specs/2026-09-30-simscope-proposal.md) records every decision, and [ui-guidelines.md](https://github.com/senthurayyappan/simscope/blob/main/docs/design/ui-guidelines.md) says how the interface is meant to look.

## Develop

```bash
make install          # install tools and the git hooks
make check            # lint, format, types, and dependencies
make test             # the Python tests
cd web && npm ci && npm test && npm run build    # the browser code (Node 26)
```

The browser code lives in `web/`, and `npm run build` writes the bundles that Python ships into `src/simscope/_assets/`. Commit the rebuilt bundles with your change. CI rebuilds them and fails if they differ. See [web/README.md](https://github.com/senthurayyappan/simscope/blob/main/web/README.md) for the player API.

## Contribute and license

Bug reports and pull requests are welcome, so read [CONTRIBUTING.md](https://github.com/senthurayyappan/simscope/blob/main/CONTRIBUTING.md) first. Use [Conventional Commits](https://www.conventionalcommits.org/), such as `feat: add export` or `fix: handle empty input`.

This project has no license yet. Add one before you publish or accept contributions. The package carries three.js, camera-controls, React, Radix, uPlot, Geist and other libraries under their own licenses, and code adapted from mjviser. See [THIRD_PARTY_NOTICES.md](https://github.com/senthurayyappan/simscope/blob/main/THIRD_PARTY_NOTICES.md).
