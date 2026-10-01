# API reference

## Library and recording

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
list in `.simscope/groups.json`) are in `simscope.annotations`. The detector
of `simscope.highlights` finds landings, jumps, falls and contact and torque
spikes.

::: simscope.annotations

::: simscope.highlights

## Derived data

::: simscope.derived

## Viewer server

`simscope serve` runs this app. It needs the `viewer` extra.

::: simscope.server

## Export

::: simscope.export

## Data model

::: simscope.core

::: simscope.transforms
