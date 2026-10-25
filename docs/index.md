# simscope

simscope is a viewer for robot simulation rollouts. Record rollouts from MuJoCo or Isaac Lab, or import ones you already have, then browse, compare, and annotate them in the browser. Any rollout exports as one HTML file that plays offline.

## Install

```bash
pip install "simscope[viewer,mujoco]"
```

simscope needs Python 3.12 or newer. [Getting started](getting-started.md) explains the extras and how to install from source.

## How it works

A library is a folder of rollouts. Record into it from MuJoCo or Isaac Lab 3.0+, or import `.rbundle` files and Brax HTML pages you already have. `simscope serve` shows the folder in the browser. `simscope export` writes one HTML file that uses the same player and makes no network requests. The browser code ships inside the package, so using simscope does not require Node.

## Features

- Record a rollout and open it while it is still recording.
- Replay a `.rbundle` file or a Brax HTML page.
- Browse by date or by group, with search, ratings, pins, and notes.
- Compare up to four rollouts on one clock, with cameras and ground aligned.
- Mark peaks in contact force and center-of-mass acceleration, or add your own markers.
- Light the scene from the camera or from a fixed sun, and capture screenshots and GIFs of the viewport.
- Export one offline HTML file. A lean file is the player, and a full file is the whole app.
- Open a rollout in Blender as a USD file.
- Put an export on an [mkdeck](https://github.com/senthurayyappan/mkdeck) slide.

## Where to start

1. [Getting started](getting-started.md) installs simscope, records a rollout, opens it, and exports it.
2. The [CLI](cli.md) lists every command.
3. The [API reference](api.md) covers the Python library.
4. [Design](design.md) explains why simscope exists and records the decisions behind it.
5. [Developing](developing.md) is for changing or extending the code.
