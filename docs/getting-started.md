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

## In the app

The library is on the left (by date or by group, five runs per section), the
plots and metadata on the right, and the timeline at the bottom; each
collapses. Keys: K play or pause, J and L step (Shift for 10 frames), F
follow, C contacts, M label the moment, `[` and `]` step envs, N and P step
runs, 1 to 5 rate, V pin, T theme.

Highlights are named moments found by `simscope.highlights`: landings, jumps,
falls, contact spikes and torque spikes, each with a plain description such
as "4.1 g impact, after 0.38 s airborne". They are cached under
`.simscope/derived/` in the library and travel inside exports. Register your
own detector with `simscope.highlights.register`. Marks from code use
`simscope.annotations`.

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
