# simscope

[![CI](https://github.com/senthurayyappan/simscope/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/senthurayyappan/simscope/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![uv](https://img.shields.io/badge/uv-managed-DE5FE9?logo=uv)](https://docs.astral.sh/uv/)
[![Ruff](https://img.shields.io/badge/lint-Ruff-D7FF64?logo=ruff)](https://docs.astral.sh/ruff/)

Record, browse, curate, and ship robot simulation rollouts. simscope saves
MuJoCo (including MJX and MuJoCo Warp) and Isaac Lab 3.0+ rollouts to a
compact folder format. `simscope serve` opens a folder of thousands of runs in
a browser app with its own three.js player: an orthographic camera that
follows a robot smoothly, a timeline with automatic highlights, side-by-side
compare, and curation (rating, pins, groups, notes). Runs with thousands of
envs stay interactive. `simscope export` writes single HTML files that make no
network requests, ready for slide decks (mkdeck).

## Get started

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then
run `make install`. Record a MuJoCo rollout:

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
    for _ in range(100):
        for _ in range(10):
            mujoco.mj_step(model, data)
        rec.log(smj.poses(data), height=float(data.xpos[1, 2]))
```

Record contact forces too, and the viewer draws them as arrows: call
`smj.add_contacts_stream(rec, model)` before the loop and pass
`contacts=smj.contacts(model, data, max_contacts=16)` to `rec.log`. For Isaac
Lab, use `simscope.isaaclab` (`scene_from_env`, `PoseBuffer`, `contacts`)
inside your Isaac environment. `examples/viewer_demo.py` records a small run
with contacts in a few seconds and prints the command to view it.

Then serve, browse, and export:

```bash
uv sync --extra viewer                # starlette, uvicorn, watchfiles
uv run simscope serve runs            # open http://127.0.0.1:8080
uv run simscope ls runs
uv run simscope export runs drop -o drop.html              # lean: <simscope-player>
uv run simscope export runs drop -o drop.html --ui full    # the whole app, offline
```

In the app, press K to play, F to follow a robot, H to play only the
highlights, C to toggle contacts, and `[` / `]` to step through envs. Highlights
(hard landings, torque spikes, falls) are found automatically
(`simscope.highlights`); marks you want to place yourself come from
`simscope.annotations`. Lean exports are what mkdeck embeds.

The design is in `docs/specs/`; start with the
[viewer v3 spec](docs/specs/2026-09-30-simscope-viewer-v3.md).

Without `make` (for example on Windows), run `uv sync` and
`uv run pre-commit install --hook-type pre-commit --hook-type commit-msg`
instead of `make install`.

Library code lives in `src/simscope/`, with tests in `tests/`. The browser code
lives in `web/`: the player core (`web/src/core`), the `<simscope-player>`
element (`web/src/element`), and the React app (`web/src/app`). The built
bundles are committed in `src/simscope/_assets/`, so a Python install needs no
Node. To rebuild them after changing `web/src`:

```bash
cd web && npm ci && npm run build && npm test
```

See `web/README.md` for the player API.

## Develop

| Command | Purpose |
| --- | --- |
| `make check` | Lint, format, type, and dependency checks |
| `make test` | Run tests with coverage |
| `make format` | Format code and apply safe lint fixes |
| `make docs` | Serve documentation locally |
| `make docs-test` | Build the documentation and fail on warnings |
| `make build` | Build a wheel and source distribution |
| `cd web && npm test` | Run the browser tests (Node 26) |

Add dependencies with `uv add package-name`, or `uv add --dev tool-name`
for development tools. Commit `pyproject.toml` and `uv.lock` together.

CI runs on pushes to main and on pull requests.

Use [Conventional Commits](https://www.conventionalcommits.org/), such as `feat: add export` or `fix: handle empty input`.
[Release Please](https://github.com/googleapis/release-please) uses them to prepare version bumps and changelogs.

See [CONTRIBUTING.md](https://github.com/senthurayyappan/simscope/blob/main/CONTRIBUTING.md) for release and docs deployment setup.

## License

This project has no license yet. Add one before you publish or accept contributions.
