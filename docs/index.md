# simscope

simscope records robot simulation rollouts and replays ones you already have. A folder of rollouts opens in the browser, and any rollout exports as one HTML file that plays offline.

## What simscope is

A library is a folder of rollouts. Record new ones from MuJoCo or Isaac Lab 3.0+, or import `.rbundle` files and Brax HTML pages you already have. `simscope serve` opens the folder in the browser. `simscope export` writes one HTML file that uses the same player and makes no network requests.

simscope needs Python 3.12 or newer. The browser code ships inside the package, so using it does not require Node.

## Who it is for

simscope is for people who produce robot simulations, or who already have saved rollouts, and want to look through them and hand one file to someone else.

## Features

- Record a rollout and open it while it is still recording.
- Replay a `.rbundle` file or a Brax HTML page.
- Browse by date or by group. Search, rate, pin, and add notes.
- Compare up to four rollouts on one clock. Cameras and ground stay aligned.
- Mark peaks in contact force and in center-of-mass acceleration. Add your own markers.
- Export one offline HTML file. A lean file is the player. A full file is the whole app.
- Put an export on an [mkdeck](https://github.com/senthurayyappan/mkdeck) slide.

## Where to start

1. [Getting started](getting-started.md) records a rollout, opens it, and exports it.
2. The [CLI](cli.md) lists every command.
3. The [API reference](api.md) covers the Python library.
4. [Design](design.md) records why simscope exists and the decisions behind it.
5. [Developing](developing.md) is for changing or extending the code.
