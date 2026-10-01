# API reference

The [getting started guide](getting-started.md) shows a recording, and the
[CLI reference](cli.md) lists the commands. This page is the Python API.

## Library and recording

`Library.rename(old, new)` renames a rollout. The folder and the `name` in
`rollout.json` change. The id, annotations, groups, and derived cache stay.
It refuses a rollout that is still recording, and it refuses a name that
already exists. Reopen a `Rollout` that was opened before the rename. The
viewer does the same thing through `POST /api/runs/<name>/rename`.

::: simscope.library

::: simscope.recorder

::: simscope.index

## Importers

::: simscope.importers

## Simulator adapters

Both adapters record the `contacts` stream the viewer draws as force arrows:
`add_contacts_stream` declares it and `contacts` packs one frame.

::: simscope.mujoco

::: simscope.isaaclab

## Curation and highlights

Marks, notes, ratings, labels, and groups (`marks.group`, and the ordered
list in `.simscope/groups.json`) are in `simscope.annotations`. The detectors
of `simscope.highlights` find peaks of the net contact force and of the
centre-of-mass acceleration. `highlights.register` adds your own kind of
marker. See [Custom markers](getting-started.md#custom-markers).

::: simscope.annotations

::: simscope.highlights

## Derived data

::: simscope.derived

## Viewer server

`simscope serve` starts this app. It needs the `viewer` extra.

::: simscope.server

## Export

`export_html` writes one offline HTML file. For `layout="compare"` the
`arrange` keyword sets how the panes sit: `"side"` (side by side, the default
for one or two rollouts), `"stack"` (one above the other), or `"grid"` (two
by two, the default for three or four). Lean files carry no highlights.
`ui="full"` files do.

::: simscope.export

## Data model

::: simscope.core

::: simscope.transforms

## Storage

`simscope.io` is the format v1 implementation: block files, the
content-addressed store, manifests, and packs. Most recordings go through
`Library` and never call this layer.

::: simscope.io
