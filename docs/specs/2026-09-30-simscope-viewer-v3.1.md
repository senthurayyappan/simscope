# simscope viewer v3.1: less, but better

**Status:** Accepted for implementation, 2026-09-30. Revises
[viewer v3](2026-09-30-simscope-viewer-v3.md) after the user reviewed the
running app. Visual rules come from the
[UI guidelines](../design/ui-guidelines.md) and the
[audit](../design/ui-audit-2026-09-30.md); this spec decides behaviour, data
and APIs. Interface changes are folded into the
[contracts](2026-09-30-simscope-viewer-v3-contracts.md) (§8 there).

## 1. What the user asked for

Summarised from the review, in their terms:

1. Fonts: follow shadcn's fonts; no system-mono number readouts; no
   all-uppercase captions.
2. Remove information shown "for the sake of it": the "Complete" badge,
   "brax"/"mujoco" badges on rows, the highlight reel button, the
   "Curation" title, and the status system.
3. No cyan accent. Several colours, one per category of thing.
4. Library: group runs by date and show a handful per group; replace tags
   with moving runs into groups; toggle the sidebar between "by date" and
   "by group". The compare selection bar must not overflow; it is understood
   that compare takes up to 4.
5. Timeline: keep it, refine it. Remove the purposeless "Marks" lane; add
   custom labels at timestamps; camera options in one popover like the speed
   one; a calmer time readout without a "TIME" caption.
6. Right panel: Plots first; then Metadata as a proper table.
7. Plots like viser's realtime plots: the trace coloured up to the playhead
   and ending in a dot, grey after it, a grey scrubbable playhead.
8. Viewport: Blender-style overlay buttons instead of a Display popover (a
   ground button with its own popover; toggles for visual, collision and
   contact geoms); export buttons in the top-right toolbar.
9. Highlights: "height drop" is confusing; markers must be general across robots (net contact force and COM acceleration only) with an API for custom ones.
10. Compare: every run's highlights on the shared timeline, one colour per
    run (max 4) with a matching dot on its pane; ground planes at the same
    screen height, so a 1 m wall and a 0.8 m wall compare honestly.

## 2. Decisions

These extend the proposal's decision log as D23–D30.

| ID | Decision |
| --- | --- |
| D23 | **Every element must change what the user does next.** Removed: the Complete badge (only a recording run is marked, with LIVE), source badges on rows (they move to Metadata), the highlight reel, the Curation heading, the flag/status system, and the tag UI. |
| D24 | **Groups replace tags.** A run belongs to at most one group ("move to group"). Groups are ordered and may be empty. The library shows runs by date (default) or by group; each section shows 5 runs and a "Show N more" row. |
| D25 | **Highlights are general** (revised 2026-10-01, §4): built-in kinds are only net contact force and centre of mass acceleration; developers add their own. Each marker carries a plain-language label and detail. Markers of one kind within 0.15 s merge. |
| D26 | **Timeline labels.** Users can label a moment ("custom labels at timestamps"): press M or use the ruler's context menu, type a name. Labels are untyped `events` in `annotations.json` and appear in a Labels lane that exists only when a run has labels. The Marks lane is removed. This revises D20 in one place: labels are the only manual annotation. |
| D27 | **Compare identity and alignment.** Compare slots 1–4 have fixed colours from the categorical palette. Each run's highlights get their own lane in that colour, and its pane shows a matching dot. All panes share camera orientation, orthographic scale and the follow target's height, so world z = 0 sits at the same screen row under every followed robot. |
| D28 | **Right panel = Plots, Metadata** (plus Envs when a run has more than one env). Metadata is a two-column table; rating, favourite and notes live there without a heading. |
| D29 | **Progress plots.** Each trace is drawn in its colour up to the playhead and ends in a dot at the current value; the rest is muted grey. The playhead is a grey line that can be dragged to scrub. A window control switches between the whole run and a rolling window (2 s, 5 s) that scrolls with playback, as viser's realtime plots do. |
| D30 | **Viewport overlays are individual toggle buttons** (visual, collision, contacts; ground opens a popover with its style), then Export, then theme, top-right. Camera presets, frame and follow live in one popover in the timeline bar. |

## 3. Library: dates and groups

- **By date (default):** sections Today, Yesterday, This week, Last week
  (weeks start on Monday), then one per month (`August`, or `August 2025` in
  an earlier year), by the run's
  `created` time in the viewer's local timezone. Newest first within a
  section.
- **By group:** one section per group in the library's order, then
  Ungrouped. A section header shows the name and count and collapses.
- Each section shows its first 5 runs; "Show N more" expands it in place.
  Search and the favourites filter apply first; an active search expands
  every section.
- A row is the run name plus one muted line: duration and, for batched runs,
  the env count. Recording runs show a LIVE indicator; favourites a filled
  heart. Nothing else.
- Row actions (hover "…" button and right-click): Move to group ▸ (groups,
  New group…, Remove from group), Favourite, Add to compare, Export.
  Shift- and Cmd-click select several rows for Move to group and Compare.
- The compare bar: "2 selected" and a primary "Compare" button and a clear
  button, on one line.

## 4. Highlights

Superseded on 2026-10-01 by the general highlights of the
[contracts](2026-09-30-simscope-viewer-v3-contracts.md) §9: the only
built-in kinds are `contact` (net contact force) and `acceleration` (centre
of mass acceleration), and developers add their own with
`highlights.register` or explicit annotation events. The task-specific kinds
tried first (landing, jump, fall, torque spike) were removed because they
only made sense for the vault and roll rollouts used to build the viewer.

## 5. Compare

- Slot colours come from the palette's first four categorical colours, in
  pane order. The pane's top-left shows a dot in its colour next to the run
  name.
- The timeline shows one highlight lane per run, in its colour, labelled
  with its dot; in single-run view highlights are coloured by kind.
- Ground alignment (D27): `linkCameras` shares azimuth, polar angle, ortho
  scale and the target's z; follow moves only x and y per pane, holding the
  shared z (the first run's standing height). Test: project
  `(robot_x, robot_y, 0)` of each pane to screen space; the rows must match
  within 1 px.

## 6. Data and API changes

- `annotations.json` (annotations spec, minor bump): `marks.group` (string
  or null). `marks.flag`, `marks.status` and curation `marks.tags` are
  deprecated: read and preserved, never written by the viewer.
- `.simscope/groups.json`: `{"format": "simscope-groups/1", "groups":
  [{"name": "Vault sweep", "created": "…"}]}`, ordered. Created on first
  write. A group referenced by a run but missing here is shown after the
  listed ones.
- Index and `RunRow`: add `group`; drop `flag` and `mark_status`; `tags` are
  record-time tags only (shown in Metadata).
- Server: `GET /api/groups`; `POST /api/groups` with `{"op": "create" |
  "rename" | "delete" | "move", ...}`; annotation ops gain `group`
  (`{"op": "group", "value": str | null}`) and `event_update`; `event_add`
  is used for labels with `type: ""`. `tag_add`, `tag_remove`, `status` and
  `flag` return 400 "unsupported op".
- Highlights JSON `simscope-highlights/2`: records gain `kind`, `label`,
  `detail`, optional `t1`/`frame1` for spans, and `ratio`; `signal` is
  replaced by `kind`.
- Core: `setVisual(on)`, per-player `color` (compare slot) and shared-z
  follow in `linkCameras`; the element draws jump spans on its scrub bar.

## 7. Visual design

Decided by the [UI guidelines](../design/ui-guidelines.md) (binding, with a
review checklist) and the [audit](../design/ui-audit-2026-09-30.md) (the
wireframes). Highlights of the decisions:

- **Type:** Geist (`@fontsource-variable/geist` 5.3.0, OFL-1.1, latin subset,
  29 KB woff2 inlined in the app CSS), shadcn's own font; Tailwind's default
  sizes; sentence case; tabular numerals; no monospace, no uppercase.
- **Colour:** shadcn's neutral tokens, no accent hue. Colour only carries
  identity: compare runs A–D (blue, orange, green, magenta; also pinned
  envs) and highlight kinds (acceleration amber, contact force violet,
  custom kinds in their own colour), with a glyph for every kind and a letter for every run. The
  palette passes the `dataviz` validator for normal vision (the run set sits
  in the colour-blind warning band, hence the letters).
- **Pinned** replaces favourites (a pin, not a heart or star); a single run
  may pin up to 3 envs (4 series colours in total).
- **Imported runs** carry their original recording time as `created`
  (embedded timestamp in the name, else the file's mtime), so the library's
  date sections are real.
