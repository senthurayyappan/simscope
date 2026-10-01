# simscope UI guidelines

**Status:** Proposed, 2026-09-30. Replaces the type, colour and overlay parts
of `web/src/app/DESIGN.md`. The audit of the
current app against these rules is
[ui-audit-2026-09-30.md](ui-audit-2026-09-30.md).

Every rule is one line: **the rule**, then *why*, then a source key. Keys are
listed under [Sources](#sources). A rule is binding: a change that breaks one
either fixes it or edits this file in the same commit with the reason.

## Principles

- P1. **The viewport and the data are the subject; chrome is neutral and quiet.** *Ink that is not data competes with data.* \[TUFTE-INK\]
- P2. **An element earns its place only if it changes what the user does next.** *Irrelevant or rarely needed information dilutes the relevant.* \[NN-8\]
- P3. **Use the stock shadcn component and its default look; deviate only with a reason written here.** *Users bring expectations from tools they know; shadcn is the house style.* \[JAKOB\] \[NN-4\]
- P4. **Colour means identity (which run, which kind of moment) or one reserved state; never decoration.** *If everything is coloured, nothing is.* \[RUI-COLOR\] \[WCAG-141\]
- P5. **Show each fact once per screen.** *A value repeated in a row, a header and a badge is redundant ink.* \[TUFTE-INK\]
- P7. **A reload never loses the user's place.** What identifies the view (which items are open, the arrangement, the time) lives in the URL, so it can be shared and survives a reload; this tab's workspace (camera, zoom, selection, filters, draft text) lives in `sessionStorage`; preferences (theme, view modes, toggles) live in `localStorage`. All three are read inside `try/catch` and a missing or stale value falls back to the default, never to an error. *An accidental reload or a crash should cost one second, not the session.* \[NN-3\] \[NN-5\]
- P6. **Frequent controls are visible; rare ones live one click away in a menu.** *Choice count drives decision time; rare options hide behind progressive disclosure.* \[HICK\] \[NN-PD\]

## Information

The test for anything on screen: *does it change what the user does next?*
If not, delete it or move it to the Metadata table.

- I1. **No badge for a default or universal state** ("Complete", "Ready"). Badge only a state that changes behaviour: `Recording`. *A badge every row has carries no information.* \[NN-8\]
- I2. **No machine-derived tags or chips** (`source:brax`, `source:rbundle`); source, importer and version live in Metadata. *They duplicate a field and look like user curation.* \[TUFTE-INK\]
- I3. **No section heading over one row of self-explaining controls** ("Curation" over stars and a heart). *Labels are a last resort.* \[RUI-LABELS\]
- I4. **Hide empty lanes, empty sections and zero counts** (a Marks lane with no marks, "0 highlights"). *Empty containers read as broken or as unexplained features.* \[NN-8\]
- I5. **A control whose effect is not obvious from its icon gets a text label, or moves into a menu item with a one-line description** (the highlight reel). *Recognition over recall.* \[NN-6\]
- I6. **A disabled control says why in its tooltip** ("No contact data in this run"). *Users must not guess system state.* \[NN-1\]
- I7. **Merge label and value into one phrase** ("4,096 envs", "50 Hz", "Frame 124 of 400") instead of a caption over a number. *Label:value pairs give everything equal weight.* \[RUI-LABELS\]
- I8. **A library row shows the run name and its duration, nothing else.** Everything else is a sort key or a Metadata row. *Rows are scanned by name; meta lines double row height for little gain.* \[NN-8\]
- I9. **No review-status system** (candidate / rejected) **and no tags.** Curation is a run's group, a pin, an optional star rating and notes. *One mechanism per job.* \[P6\]
- I10. **Prefer the detector's plain-language `label` and `detail`** (`"412 N, 3.1× typical"`) over internal numbers (`score 12`). *Speak the user's language.* \[NN-2\]

## Typography

- T1. **One family: Geist** (`'Geist Variable', system-ui, sans-serif`), the font of shadcn's site, its `next-app` template and its default `nova` preset. \[SHADCN-FONTS\] \[SHADCN-PRESET\]
- T2. **Bundle `@fontsource-variable/geist@5.3.0` (OFL-1.1), latin subset only:** `files/geist-latin-wght-normal.woff2`, 29,400 B, weights 100–900 in one variable file; inline it as a `data:font/woff2;base64,` URL in `app.css` at build time. Cost: 38.3 KB raw, about **29 KB gzip** (woff2 is already compressed). \[FONTSOURCE\]
- T3. **No monospace font anywhere in the UI**, readouts and plot values included; numbers use Geist with `tabular-nums`. *Geist's figures are proportional by default and switch to equal width with `tnum` (measured: "0000" and "1111" both 240 px at 100 px).* We deliberately differ from shadcn's chart tooltip (`font-mono tabular-nums`) and save Geist Mono's 23 KB. \[MDN-FVN\] \[GEIST-TYPE\]
- T4. **Sizes are Tailwind's defaults, unmodified:** `text-xs` 12/16 for meta, labels, badges, tooltips; `text-sm` 14/20 for every control, row, menu item and table cell; `text-base` 16/24 only for the run title in the panel header. Delete the custom `--text-*` overrides. *shadcn components are tuned for these steps; Material 3 uses the same 12/14/16 steps for body and labels, with labels at Medium weight.* \[SHADCN-NOVA\] \[M3-TYPE\] \[APPLE-TYPE\]
- T5. **Canvas text (ruler ticks, plot axes) is 11 px Geist, `muted-foreground`; nothing smaller anywhere.** *macOS's smallest text style is 10 pt; 11 px is the floor for glanceable numbers.* \[APPLE-TYPE\]
- T6. **Weights 400 and 500 only; 600 for the single title per panel.** *Hierarchy comes from weight and colour before size.* \[RUI-HIER\] \[APPLE-TYPE\]
- T7. **Sentence case for all text. No `uppercase`, no added `tracking`.** shadcn's `nova` stylesheet contains zero `uppercase` rules; sidebar group labels are `text-xs font-medium` at 70% foreground. *All caps hurts legibility and only helps for 1–2 isolated words.* \[NN-CAPS\] \[SHADCN-SIDEBAR\]
- T8. **`tabular-nums` on every number that updates in place or aligns in a column** (time readout, plot value, table numbers, counts); default proportional figures for prose. \[MDN-FVN\] \[GEIST-TYPE\]
- T9. **Secondary text is `muted-foreground`; nothing the user must read is lighter.** The current `--subtle` (2.9:1) is removed. *Low-contrast text is illegible; text needs 4.5:1.* \[NN-CONTRAST\] \[WCAG-143\]

### Font build recipe

```js
// build/app.mjs, before the Tailwind step: write src/app/font.css (generated, committed)
const woff2 = fs.readFileSync("node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2");
fs.writeFileSync("src/app/font.css", `@font-face{font-family:"Geist Variable";font-style:normal;font-display:swap;` +
  `font-weight:100 900;src:url(data:font/woff2;base64,${woff2.toString("base64")}) format("woff2");` +
  `unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`);
```

`app.css` imports `./font.css` and sets `--font-sans: "Geist Variable", system-ui, sans-serif;`
and drops `font-feature-settings: "cv11", "ss01"` (Inter features). The same CSS
serves `simscope serve` and `--ui full` exports, so `file://` works. The lean
`<simscope-player>` keeps the system stack (its controls are icons and one time).
The subset's `unicode-range` covers Latin-1 (×, ·, ², °, µ) and the minus sign
U+2212; anything else falls back to `system-ui`.

## Colour

### Neutral base and accent

- C1. **Base: shadcn `neutral` (chroma 0) tokens verbatim** — light `background` oklch(1 0 0), `foreground` oklch(0.145 0 0), `muted` oklch(0.97 0 0), `muted-foreground` oklch(0.556 0 0), `border` oklch(0.922 0 0), `ring` oklch(0.708 0 0), `sidebar` oklch(0.985 0 0); dark `background` oklch(0.145 0 0), `foreground` oklch(0.985 0 0), `card`/`sidebar` oklch(0.205 0 0), `muted` oklch(0.269 0 0), `muted-foreground` oklch(0.708 0 0), `border` oklch(1 0 0 / 10%). *Zero chroma lets data hues read as the only colour.* \[SHADCN-THEME\] \[GEIST-COLOR\]
- C2. **Primary accent: shadcn's neutral `primary`** (oklch(0.205 0 0) light, oklch(0.922 0 0) dark) for the Play button, the Compare button and checked boxes. Pressed toggles use `bg-muted` (shadcn `nova`), focus rings the neutral `ring`, active tabs `foreground`. Override shadcn's one chromatic token, dark `sidebar-primary` oklch(0.488 0.243 264.376), to `primary`. *Every hue is spent on the eight data slots below; any chromatic accent lands within ΔE 15 of one of them (measured: indigo-600 is 9.9 from slot 6, the current teal is 11.6 from slot 3), so a coloured chrome accent would be mistaken for data.* \[DATAVIZ\] \[SHADCN-NOVA\]
- C3. **Stars, pins and selection are neutral** (`foreground` fills, `bg-accent` rows). *Amber stars sat ΔE 6.6 from the acceleration colour; a rose heart 7.2 from a red kind.* \[P4\]
- C4. **One reserved state colour: shadcn `destructive`** for errors and `Recording` only, always with its text. *State colour without a label fails for colour-blind users.* \[WCAG-141\]
- C5. **Viewport background and ground are neutral greys**: light viewport oklch(0.97 0 0), checker oklch(0.94 0 0)/oklch(0.90 0 0); dark viewport oklch(0.18 0 0), checker oklch(0.24 0 0)/oklch(0.205 0 0). *The current dark checker (#33485f/#26384c) is a saturated blue that competes with run A.* \[P1\]

### Categorical palette

One fixed palette, eight slots, never cycled, never generated. Slots 1–4 are
**the things being compared**; slots 5–8 are **highlight kinds**.

| Slot | Role | Light | Dark |
| --- | --- | --- | --- |
| 1 | Run A · selected env | `oklch(0.62 0.20 257)` #2282fb | `oklch(0.66 0.177 257)` #4291fc |
| 2 | Run B · pinned env 1 | `oklch(0.62 0.166 47)` #d35f10 | `oklch(0.65 0.175 47)` #e16510 |
| 3 | Run C · pinned env 2 | `oklch(0.59 0.158 150)` #109646 | `oklch(0.62 0.165 150)` #15a04c |
| 4 | Run D · pinned env 3 | `oklch(0.60 0.20 335)` #c344ae | `oklch(0.63 0.20 335)` #ce4eb8 |
| 5 | Acceleration (built-in kind) | `oklch(0.66 0.133 78)` #be8614 | `oklch(0.67 0.135 78)` #c28914 |
| 6 | Contact force (built-in kind) | `oklch(0.54 0.20 295)` #7b4bd4 | `oklch(0.56 0.20 295)` #8151db |
| 7 | Reserved (a future built-in kind) | `oklch(0.67 0.20 352)` #eb54a2 | `oklch(0.67 0.20 352)` #eb54a2 |
| 8 | Reserved (a future built-in kind) | `oklch(0.57 0.20 25)` #d42f34 | `oklch(0.56 0.20 25)` #d02b31 |

Tokens: `--series-1` … `--series-4`, `--kind-acceleration`, `--kind-contact`, plus `--ink-future` oklch(0.65 0 0) light /
oklch(0.50 0 0) dark (3.1–3.3:1) for the not-yet-played part of a trace.

Validated with the `dataviz` skill's `validate_palette.js` (Machado 2009
CVD simulation, OKLab ΔE×100) on surfaces #ffffff, #fafafa, #0a0a0a, #171717:

| Set | Mode | Worst CVD ΔE (target 8, floor 6) | Worst normal ΔE (floor 15) | Contrast |
| --- | --- | --- | --- | --- |
| All 8, adjacent | light / dark | 7.4 / 7.8 WARN (run B↔C, deutan) | 15.1 / 15.8 | all ≥ 3:1 |
| Runs 1–4, all pairs | light / dark | 7.4 / 7.8 WARN | 21.8 / 22.2 | all ≥ 3:1 |
| Kinds 5–8, all pairs | light / dark | 8.8 / 10.9 PASS | 15.1 / 15.8 | all ≥ 3:1 |

- C6. **Slots 1–4 hold one identity dimension at a time:** runs A–D in compare; in a single run, the selected env (slot 1) and up to three pinned envs (slots 2–4). Never both. *Colour follows the entity; mixing dimensions repaints survivors.* \[DATAVIZ\]
- C7. **Runs always carry their letter A–D next to the colour** (pane header, lane label, legend, library row). *Runs sit in the CVD warn band (7.4/7.8), which is legal only with a second encoding.* \[DATAVIZ\] \[WCAG-141\]
- C8. **Kinds always carry their glyph** (acceleration `zap`, contact force `circle-dot`, any custom kind a `diamond` in the `color` its developer gave, else neutral); a span is a neutral bar ending at its glyph. *Shape is the primary channel, colour the fast one.* \[WCAG-141\]
- C9. **The same kind colour everywhere:** lane glyph, hover-card dot, plot tick, and the viewport's contact arrows (slot 6). Collision geoms are neutral (`foreground` at 35%), not orange. *Orange is run B.* \[NN-4\]
- C10. **Text never wears a data colour;** a dot, line key or glyph beside neutral text carries identity. *Light hues are illegible as text.* \[DATAVIZ\]
- C11. **No new hue without re-running the validator and updating this table.** \[DATAVIZ\]

## Layout and density

- L1. **4 px grid; shadcn control heights:** 28 px (`sm`) in bars and toolbars, 32 px (`default`) elsewhere; list rows 32 px (`SidebarMenuButton` h-8). \[SHADCN-SIDEBAR\]
- L2. **Sidebar 256 px default (shadcn `16rem`), 240 px minimum; right panel 320 px, 280 px minimum.** *Below 240 px run names and bars break.* \[SHADCN-SIDEBAR\]
- L3. **Every bar is tested at its panel's minimum width: nothing wraps, nothing scrolls sideways.** Text truncates; the full text is in a tooltip. *The compare bar wrapped one word per line at 220 px.* \[NN-4\]
- L4. **Long names are cut at 16 characters and end with `…`; the full name is in a tooltip (400 ms delay) and double-click renames.** *Showing the end of a name fills the row edge to edge and costs readability; the start identifies a run, the tooltip serves the rest.* \[NN-6\]
- L5. **Panels default to their content's size;** the timeline opens at transport + ruler + lanes, with no empty band taller than 24 px. \[TUFTE-INK\]
- L6b. **A row's pick checkbox is always on the left, in every state, at the same x; faint at rest, clearly stronger on hover.** *Controls that jump sides when state changes cannot be learned.* \[NN-4\]
- L6c. **Compare arrangement is the user's choice (side by side, stacked, grid), offered beside the Compare button and kept in exports.** \[NN-3\]
- L6a. **A selected row's ring is drawn above its neighbours** (inset ring on a raised row), so neighbours' hover fills and sticky headers never cut it; the first row under a sticky header keeps its full ring. *A broken selection outline reads as a bug.* \[NN-4\]
- L6. **Group with spacing and hairlines, not cards or boxes.** *Proximity already groups; boxes add ink.* \[PROXIMITY\] \[COMMON-REGION\]
- L7. **A toolbar has at most three groups, separated by a 1 px `border` divider.** \[APPLE-TOOLBARS\]
- L8. **Targets are at least 28 × 28 px; the Play button is 32 px.** *Small, distant targets are slow.* \[FITTS\]
- L9. **Long lists are sectioned, by date (`Today`, `Yesterday`, `This week`, `Last week` with weeks starting on Monday, then one section per month, from the run's recording time) or by group; each section shows 5 rows, then `Show N more`; headers stick and carry a count.** *Show the likely items first and the rest on request.* \[NN-PD\] \[LINEAR-DISPLAY\] \[OPENWEBUI\]
- L10. **Pinned runs form a `Pinned` section above all others in both views.** *Favourites sit above everything else in Linear's sidebar.* \[LINEAR-FAV\]

## Components

| Job | Component | Convention |
| --- | --- | --- |
| Library | `Sidebar` › `SidebarGroup` + `SidebarGroupLabel` + `Collapsible` + `SidebarMenu` | label `text-xs` 70% foreground, count in `SidebarMenuBadge` (`tabular-nums`) |
| "Show more" | `SidebarMenuButton size="sm"` | `Show 82 more`, muted, last item of the group |
| By date / by group | `ToggleGroup type="single" size="sm"` | two text items: `Date`, `Group` |
| Row actions, move to group | `ContextMenu` (right-click) + the same items in a row `DropdownMenu` | `Move to group ›`, `New group…`, `Remove from group` |
| Camera, speed, export | `DropdownMenu` with `RadioGroup` / items | trigger = icon + current value + chevron, same size |
| Viewport overlay toggles | `Toggle size="sm"` icon-only + `Tooltip` with `Kbd` | pressed = `bg-muted`; see Viewport overlays |
| Ground options | `Toggle` + chevron `Popover` | Blender's toggle-plus-popover |
| Right panel | `Tabs` (line variant): `Plots`, `Metadata`, `Envs` (only when envs > 1) | |
| Metadata | `Table`, two columns | key `muted-foreground`, value `text-sm`, numbers right-aligned `tabular-nums` |
| Highlight details | `HoverCard` | value-first rows, kind dot |
| State | `Badge variant="destructive"` | only `Recording` |

Anti-patterns (each one is a review failure):

- A1. **Caption-over-number stat grids** ("DURATION" over 7.98 s). Use a `Table` row. \[RUI-LABELS\]
- A2. **Badges for constants, chips for derived data, multi-line buttons** (a button with a description inside). Put descriptions in menu items. \[NN-8\]
- A3. **Custom primitives that shadow shadcn ones** (hand-rolled tag chips, glass pills, an accent-filled toggle). \[P3\]
- A4. **Section headings for single rows; `uppercase` anything.** \[T7\]
- A5. **Full-width text buttons in panels; a toggle that must be tried to be understood.** \[NN-6\]

## Timeline

- TL1. **Bar order:** `Camera ▾` at the left; transport (`⏮ ◀ ▶ ▶ ⏭`) centred on the bar's true centre; at the right, in order: readout, `Loop`, `1× ▾`, `Fit` (only while zoomed), `⌄` minimise. *Three groups: view, transport, playback; the primary control sits where the eye lands.* \[APPLE-TOOLBARS\]
- TL2. **The readout is one small phrase with no caption:** `2.49 / 7.98 s`, `text-xs tabular-nums`, current time `foreground`, `/ 7.98 s` muted, both on one baseline; click to type a time; the tooltip says `Frame 124 of 400`. It sits at the right end of the bar, before `Loop`. *Captions over values are labels of last resort.* \[RUI-LABELS\] \[FOXGLOVE-PLAYBACK\]
- TL3. **Camera is one `DropdownMenu` like speed:** trigger `video` icon + view name (`Iso`, `Free` after an orbit) + chevron, a crosshair dot while following; items: View radio (Iso, Front, Side, Top), `Frame` (F), `Frame all envs` (0), Follow radio (Off, Position, Pose, Heading) each with a one-line hint. \[P6\]
- TL4. **The playhead is neutral:** a 1.5 px `foreground` line with an 8 × 10 px `foreground` handle on the ruler; no accent flag. \[FOXGLOVE-PLOT\]
- TL5. **Lanes:** a lane per subject; with one subject the lane has no label (a label that restates the only thing there is is noise); in compare each lane is labelled with its run title. A `Labels` lane exists only when the run has labels. \[I4\] \[RERUN-TIMELINE\]
- TL6. **Markers are plain 14 px lucide icons in the kind colour: no ring, no disc, no badge.** Clusters become a neutral count pill only where markers really overlap. Hit target ≥ 24 px. *The icon is the mark; anything around it is ink.* \[TUFTE-INK\]
- TL7. **In compare, a lane label is `● A run-name` and its glyphs are in the run's colour;** the glyph shape still gives the kind. \[C7\]
- TL8. **Hover card is minimal:** the readout first (`42 m/s²` and a muted `4.3 g`; `127 N` and a muted `1.9× typical`), then one muted `text-xs` row with the kind name on the left and the time on the right (the run title above it in compare). No dot, no bold title, no score. *The numbers are the content; the name is a caption.* \[I10\] \[RUI-LABELS\]
- TL9. **No highlight-reel toggle in the bar;** `Highlights only` is a checkbox item in the speed menu with the hint `Plays 1 s around each highlight, skips the rest` (H). \[I5\]
- TL10. **No zoom buttons;** wheel and W/S zoom, A/D pan, `Fit` appears only when the view is zoomed. \[P2\]
- TL11. **Lane gutter 88 px; lane labels `text-xs` muted sentence case; lanes 24 px tall on hairline separators, no rounded lane fills.** \[L6\]
- TL12. **Loop region:** `foreground` 6% fill, 2 px `foreground` 40% edges on the ruler. \[P4\]

## Plots

- PL1. **The trace is in its slot colour from the start to the playhead and ends in an 8 px dot (2 px surface ring) at the current value; after the playhead it is `--ink-future`.** *Shows where you are and what is coming without a second chart.* \[DATAVIZ\] \[OBS-LINE\]
- PL2. **The playhead is a 1 px `muted-foreground` line through every plot, draggable to scrub.** \[FOXGLOVE-PLOT\]
- PL3. **Hover shows one shared crosshair across all plots (uPlot `cursor.sync`), a `foreground` 20% hairline; the header value switches to the hovered value.** \[GRAFANA-CROSSHAIR\] \[UPLOT\]
- PL4. **Header: channel name `text-sm` 500 left; value and unit right, `text-sm tabular-nums` (`0.264 m`); the remove button appears on hover.** \[I7\]
- PL5. **Axes recede:** ≤ 3 y ticks at 11 px muted, horizontal hairline grid only, no tick marks; x tick labels only on the bottom plot. *Erase redundant data-ink.* \[TUFTE-INK\]
- PL6. **Lines 1.5 px (the selected env 2 px when pinned envs are shown), no points, no area fill. The across-env band is `foreground` 8%, its median a 1 px `muted-foreground` solid line. Never dashed.** \[DATAVIZ\]
- PL7. **Plot height 120 px plus a 16 px axis band on the last plot.** \[DATAVIZ\]
- PL8. **A legend appears only for two or more series:** line key + letter or env number, neutral text, one row under the tab bar. \[DATAVIZ\]
- PL9. **Values use 3 significant digits and the stream's unit; the channel picker shows units right-aligned.** \[K2\]
- PL10. **Implementation:** stroke the series with a two-stop `CanvasGradient` split at `valToPos(t, "x", true)` and call `u.redraw(false)` from the frame loop (uPlot re-reads `stroke` on every draw but reuses cached paths, so no data is resent); the dot is a positioned element. \[UPLOT\]

## Viewport overlays

- V1. **Top-right toolbar, one row:** `Ground ▾` `Visual` `Collision` `Contacts` | `Sync cameras` (compare only) | `Export ▾` | `Theme`. *Overlay toggles are individual icon buttons, as in Blender's header.* \[BLENDER-OVERLAYS\] \[APPLE-TOOLBARS\]
- V2. **`Ground` toggles the ground; its chevron opens a popover with `Checkerboard` / `Grid`.** *Blender: the button toggles, the drop-down holds the details.* \[BLENDER-OVERLAYS\]
- V3. **`Visual`, `Collision`, `Contacts` are independent toggles with shortcuts in their tooltips** (C for contacts); absent data disables the toggle with a reason (I6). \[NN-7\]
- V4. **`Export ▾` lists `Player page` — "A small HTML file that plays this run. Works offline." and `Full viewer` — "The complete viewer in one HTML file. Works offline."; while comparing, the export is the compare view exactly as shown (same arrangement), with plain run titles only.** *In a standalone file, slot letters and colours mean nothing.* \[K4\]
- V5. **Nothing covers the robot's centre:** the env stepper (`Env 12 of 4,096 ‹ ›`) bottom-left only for multi-env runs; no "Following" chip (the camera trigger shows it). \[P1\]
- V6. **Compare panes: header pill `● A run-name ×`; the active pane gets a 2 px inset ring in its own slot colour.** \[C7\]
- V7. **Overlay surfaces are solid `bg-background/90` with a `border`; no backdrop blur over WebGL.** \[SHADCN-NOVA\]

## Motion

- M1. **Use shadcn's built-in enter and exit (fade plus 95% zoom, 100 ms); no custom keyframes.** \[SHADCN-NOVA\]
- M2. **Camera presets animate 250 ms; panels collapse without animation.** \[P1\]
- M3. **At most one looping animation on screen: the `Recording` dot.** No shimmer loops; `prefers-reduced-motion` stops it. *Perpetual motion steals attention.* \[NN-8\]
- M4. **Numbers never animate;** readouts and values jump to the new value. \[T8\]
- M5. **Anything slower than 400 ms shows progress in place** (a 2 px bar on the pane top). \[DOHERTY\] \[NN-1\]

## Copy

- K1. **Sentence case, no trailing colons, no all caps, no `·`-joined strings.** \[T7\]
- K2. **Value, space, SI unit:** `7.98 s`, `50 Hz`, `412 N`, `3.1 N·m`, `0.5×`; negatives use U+2212; thousands get commas (`4,096`). \[NN-4\]
- K3. **Counts are phrases:** `4,096 envs`, `3 runs`, `Show 82 more`. \[RUI-LABELS\]
- K4. **The user's nouns:** run, env, body, highlight, group. Never tier, pack, score, slot, status. \[NN-2\]
- K5. **Empty states are one sentence plus one action:** "No runs yet. Record with `simscope.Recorder` or run `simscope import`." \[NN-10\]
- K6. **Tooltips are verb phrases with the shortcut:** `Play` `K`, `Contacts` `C`. \[NN-7\]
- K7. **Errors say what failed and what to do,** with the raw message second. \[NN-9\]

## Patterns we borrow

| From | What it looks like | What simscope takes |
| --- | --- | --- |
| Linear | Group headers stay sticky while scrolling and show the group's item count; favourites sit above the team sections. \[LINEAR-DISPLAY\] \[LINEAR-FAV\] | Sticky date/group headers with a count; a `Pinned` section on top. |
| Linear redesign | Themes from three variables (base, accent, contrast) in LCH; less chrome, higher text contrast. \[LINEAR-REDESIGN\] | Neutral base, one ink ramp, colour left to data. |
| Raycast, Open WebUI | `List.Section` has a title and a subtitle beside it; chat history is grouped "Today, Yesterday, Previous 7 Days". \[RAYCAST-LIST\] \[OPENWEBUI\] | Date buckets `Today` · `Yesterday` · `Previous 7 days` · `Previous 30 days` · `August 2026`, count as subtitle. |
| Rerun | Timeline controls sit at the top of the timeline panel; each logged event is a circle on its entity's row; a vertical time line is dragged to scrub. \[RERUN-TIMELINE\] | One dot or glyph per event per lane; a plain draggable playhead. |
| Foxglove | The plot shows playback time as a vertical grey bar; hovering adds a yellow bar and a matching marker on the playback timeline. \[FOXGLOVE-PLOT\] | Grey playhead in plots; the plot hover mirrored as a hairline on the timeline. |
| Blender | The Overlays button toggles all overlays; its drop-down opens a popover with the detailed settings. \[BLENDER-OVERLAYS\] | Ground = toggle + chevron popover; other overlays as single icon toggles. |
| Final Cut Pro | Markers are coloured by type: standard blue, chapter orange, to-do red, done green. \[FCP-MARKERS\] | A fixed colour per highlight kind, never per instance. |
| Grafana, uPlot | "Shared crosshair": hovering one panel shows the crosshair on all panels; uPlot syncs cursors by key. \[GRAFANA-CROSSHAIR\] \[UPLOT\] | One crosshair across all plots. |

## Review checklist

Run against a 1440 × 900 screenshot in light and in dark, then at minimum panel widths.

1. [ ] Only Geist on screen; no monospace digits; no text smaller than 11 px.
2. [ ] No uppercase text, no letter-spaced captions.
3. [ ] No caption-over-number blocks; numbers that change are `tabular-nums`.
4. [ ] No badge except `Recording`; no chip that restates a field.
5. [ ] Every coloured mark is a run (with its letter), a pinned env, or a highlight kind (with its glyph); chrome is neutral.
6. [ ] No cyan or teal anywhere; no colour outside the palette table.
7. [ ] The playhead is neutral on the ruler and in every plot; traces are coloured only up to it and end in a dot.
8. [ ] The timeline bar has a camera menu, transport, a captionless readout, loop and speed; no reel, no zoom buttons.
9. [ ] No empty lane, no empty band under the lanes, no empty section.
10. [ ] The right panel opens on Plots; Metadata is a two-column table.
11. [ ] The viewport toolbar has the overlay toggles, Export and Theme; no Display menu.
12. [ ] Library rows are one line (name, duration) under date or group sections with `Show N more`.
13. [ ] In compare, each pane, lane and trace shows the same colour and letter.
14. [ ] At the minimum sidebar width no bar wraps and nothing scrolls sideways.
15. [ ] Body text and muted text measure ≥ 4.5:1; marks ≥ 3:1.

## Sources

Fetched 2026-09-30.

- \[APPLE-TOOLBARS\] Apple HIG toolbars (group by function, avoid overcrowding): https://developer.apple.com/design/human-interface-guidelines/toolbars
- \[APPLE-TYPE\] Apple HIG typography (macOS body 13 pt, minimum 10 pt): https://developer.apple.com/design/human-interface-guidelines/typography
- \[BLENDER-OVERLAYS\] Blender manual, Viewport Overlays: https://docs.blender.org/manual/en/latest/editors/3dview/display/overlays.html
- \[COMMON-REGION\] Laws of UX, Common Region: https://lawsofux.com/law-of-common-region/
- \[DATAVIZ\] Claude `dataviz` skill (color formula, marks, `validate_palette.js`); run locally, results above.
- \[DOHERTY\] Laws of UX, Doherty threshold: https://lawsofux.com/doherty-threshold/
- \[FCP-MARKERS\] Final Cut Pro, intro to markers: https://support.apple.com/guide/final-cut-pro/intro-to-markers-ver397279dd/mac
- \[FITTS\] Laws of UX, Fitts's law: https://lawsofux.com/fittss-law/
- \[FONTSOURCE\] `@fontsource-variable/geist` 5.3.0 file sizes: https://data.jsdelivr.com/v1/packages/npm/@fontsource-variable/geist@5.3.0?structure=flat ; package: https://fontsource.org/fonts/geist
- \[FOXGLOVE-PLAYBACK\] Foxglove playback: https://docs.foxglove.dev/docs/visualization/playback
- \[FOXGLOVE-PLOT\] Foxglove Plot panel ("a vertical gray bar"): https://docs.foxglove.dev/docs/visualization/panels/plot
- \[GEIST-COLOR\] Vercel Geist colours: https://vercel.com/geist/colors
- \[GEIST-TYPE\] Vercel Geist typography ("Tabular is used when conveying numbers"): https://vercel.com/geist/typography
- \[GRAFANA-CROSSHAIR\] Grafana dashboard settings, shared crosshair: https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/modify-dashboard-settings/
- \[HICK\] Laws of UX, Hick's law: https://lawsofux.com/hicks-law/
- \[JAKOB\] Laws of UX, Jakob's law: https://lawsofux.com/jakobs-law/
- \[LINEAR-DISPLAY\] Linear display options: https://linear.app/docs/display-options
- \[LINEAR-FAV\] Linear favorites: https://linear.app/docs/favorites
- \[LINEAR-REDESIGN\] Linear, how we redesigned the Linear UI: https://linear.app/now/how-we-redesigned-the-linear-ui
- \[M3-TYPE\] Material 3 type scale (label 11/12/14 sp Medium, body 12/14/16 sp Regular): https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Typography.md
- \[MDN-FVN\] MDN `font-variant-numeric`: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- \[NN-1\] … \[NN-10\] Nielsen, 10 usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- \[NN-CAPS\] NN/g, glanceable fonts: https://www.nngroup.com/articles/glanceable-fonts/ ; tabs: https://www.nngroup.com/articles/tabs-used-right/
- \[NN-CONTRAST\] NN/g, low-contrast text: https://www.nngroup.com/articles/low-contrast/
- \[NN-PD\] NN/g, progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- \[OBS-LINE\] Observable Plot line, varying stroke along a line: https://observablehq.com/plot/marks/line
- \[OPENWEBUI\] Open WebUI history ("grouped by time period"): https://docs.openwebui.com/features/chat-conversations/chat-features/history-search/
- \[PROXIMITY\] Laws of UX, Proximity: https://lawsofux.com/law-of-proximity/
- \[RAYCAST-LIST\] Raycast `List.Section`: https://developers.raycast.com/api-reference/user-interface/list
- \[RERUN-TIMELINE\] Rerun timeline: https://rerun.io/docs/reference/viewer/timeline
- \[RUI-COLOR\] Refactoring UI, building a palette: https://www.refactoringui.com/previews/building-your-color-palette
- \[RUI-HIER\] Refactoring UI book contents ("Hierarchy is everything"): https://www.refactoringui.com/book
- \[RUI-LABELS\] Refactoring UI, labels are a last resort: https://www.refactoringui.com/previews/labels-are-a-last-resort
- \[SHADCN-FONTS\] shadcn site fonts (Geist, Geist Mono): https://github.com/shadcn-ui/ui/blob/main/apps/v4/lib/fonts.ts ; template: https://github.com/shadcn-ui/ui/blob/main/templates/next-app/app/layout.tsx
- \[SHADCN-NOVA\] shadcn `nova` style: https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/styles/style-nova.css
- \[SHADCN-PRESET\] shadcn presets (`nova`: "Lucide / Geist"; `init --defaults` = `base-nova`): https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/preset/defaults.ts , https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/commands/init.ts
- \[SHADCN-SIDEBAR\] shadcn Sidebar: https://ui.shadcn.com/docs/components/sidebar ; source: https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/sidebar.tsx
- \[SHADCN-THEME\] shadcn `neutral` theme tokens: https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/themes.ts
- \[TUFTE-INK\] Data-ink ratio, erase non-data and redundant ink: https://jtr13.github.io/cc19/tuftes-principles-of-data-ink.html ; chartjunk: https://en.wikipedia.org/wiki/Chartjunk
- \[UPLOT\] uPlot types (cursor sync, `valToPos`, `redraw`): https://raw.githubusercontent.com/leeoniya/uPlot/master/dist/uPlot.d.ts
- \[WCAG-141\] WCAG 2.2 Use of Color: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- \[WCAG-143\] WCAG 2.2 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
