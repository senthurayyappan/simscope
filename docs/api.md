# API reference

## Library and recording

`Library.rename(old, new)` renames a run: the folder and the `name` in
`rollout.json` change, and the run's id, annotations, groups and derived cache
stay. It refuses a run that is still recording and a name that exists, and a
`Rollout` opened before the rename must be reopened. The viewer offers the same
as `POST /api/runs/<name>/rename`.

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

Marks, notes, ratings, labels and run groups (`marks.group`, and the ordered
list in `.simscope/groups.json`) are in `simscope.annotations`. The detectors
of `simscope.highlights` find peaks of the net contact force and of the
centre-of-mass acceleration; `highlights.register` adds your own kind of
marker (see "Custom markers" in the getting-started guide).

::: simscope.annotations

::: simscope.highlights

## Derived data

::: simscope.derived

## Viewer server

`simscope serve` runs this app. It needs the `viewer` extra.

::: simscope.server

## Export

`export_html` writes one offline HTML file. For `layout="compare"` the
`arrange` keyword sets how the panes sit: `"side"` (side by side, the default
for one or two runs), `"stack"` (one above the other) or `"grid"` (two by two,
the default for three or four). Lean files carry no highlights; `ui="full"`
files do.

::: simscope.export

## Data model

::: simscope.core

::: simscope.transforms
