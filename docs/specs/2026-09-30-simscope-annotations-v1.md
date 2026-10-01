# simscope annotations v1

**Status:** Normative, 2026-09-30; minor revision 1.1 (additive) from
[viewer v3.1](2026-09-30-simscope-viewer-v3.1.md): run groups, labels as
untyped events, and three deprecated marks. The format tag stays
`simscope-annotations/1`; readers of 1.0 ignore what is new. This spec
defines the curation sidecar that sits next to each rollout, the library's
event-type registry, and its ordered list of run groups. Decisions D8 and D9
in the [proposal](2026-09-30-simscope-proposal.md) apply: sidecars are the
source of truth, git merges them, and the SQLite index is only a cache.

## 1. Files

| Path | Written by | Contents |
| --- | --- | --- |
| `runs/<name>/annotations.json` | viewer, API | marks, notes, ratings, events, and spatial annotations for one run |
| `.simscope/event_types.json` | code, API, or by hand | the library's event vocabulary |
| `.simscope/groups.json` | viewer, API, or by hand | the library's ordered run groups (§5) |

- Both files are UTF-8 JSON written with `indent=2`, `sort_keys=True`, and a
  trailing newline. Writers write a temporary file in the same directory,
  then rename it over the old one.
- A missing `annotations.json` means "no annotations". Writers create it on
  the first change.
- Rollout data (`rollout.json`, `*.blk`, `scenes/`, `assets/`) is never
  modified by curation.
- Readers ignore unknown fields. Writers keep unknown fields they read, so
  newer tools do not lose data when older tools save.

## 2. Records

Every record in a list has these common fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | ULID, unique within the file |
| `author` | string | who made it: the OS user name by default |
| `created` | string | RFC 3339 UTC timestamp, such as `2026-09-30T12:00:00Z` |
| `updated` | string | RFC 3339 UTC timestamp of the last change |

Lists are sorted by `id` when written. ULIDs sort by time, so the order is
chronological, and two people's appends merge in git without conflict.

## 3. `annotations.json`

```json
{
  "format": "simscope-annotations/1",
  "run_id": "01J9Z3…",
  "marks": {"favorite": true, "group": "Vault sweep", "flag": null, "status": null, "tags": []},
  "notes": [{"id": "01J…", "author": "ada", "created": "…", "updated": "…", "text": "Front-left foot slips."}],
  "ratings": [{"id": "01J…", "author": "ada", "created": "…", "updated": "…",
               "criterion": "overall", "scale": "stars5", "value": 4, "rationale": "clean gait"}],
  "events": [{"id": "01J…", "author": "ada", "created": "…", "updated": "…",
              "type": "fall", "label": "falls at 3.2 s",
              "t0": 3.2, "t1": 3.2, "f0": 160, "f1": 160, "env": null, "props": {"severity": "major"}}],
  "spatial": [{"id": "01J…", "author": "ada", "created": "…", "updated": "…",
               "kind": "point", "frame": "world", "t": 3.2, "f": 160, "env": 0,
               "position": [0.4, 0.1, 0.02], "size": null, "label": "slip", "event": "01J…"}]
}
```

### 3.1 `run_id`
The `id` from the run's `rollout.json`. It lets a tool check that a sidecar
still belongs to its run after a folder is copied or renamed.

### 3.2 `marks`
A single object: the last write wins, and it has no per-record metadata.

| Field | Type | Default |
| --- | --- | --- |
| `favorite` | bool | `false` |
| `group` | string or null | `null` (the run's group, §5; at most one) |
| `flag` | string or null | `null` (**deprecated**) |
| `status` | string or null | `null` (**deprecated**) |
| `tags` | list of strings | `[]`, stored sorted and unique (**deprecated**) |

`group` is new in 1.1. Its value is a group name as in §5; a name that
`groups.json` does not list still counts, and is shown after the listed ones.
Merging two sidecars takes the side that changed `group` relative to their
common base, as it does for `flag` and `status`.

`flag`, `status` and the curation `tags` are deprecated since viewer v3.1
(decision D23: nothing in the viewer needs a status system, and groups
replace tags). Readers keep them and writers write them back unchanged, so a
file from an older tool loses nothing, but the viewer neither shows nor
changes them and the index ignores them. The `tags` of `rollout.json`, set at
record time, are separate and stay.

### 3.3 `notes`
Each note has `text`, a Markdown string.

### 3.4 `ratings`
- `criterion` is a free string. `"overall"` is the default.
- `scale` is `"stars5"` (integer 1–5), `"score100"` (0–100), or `"thumb"`
  (-1 or 1).
- `value` is a number on that scale. `rationale` is an optional string.
- One author has at most one rating per `criterion`. A new rating replaces
  the old one and keeps its `id`.

### 3.5 `events`
A time instant or segment on the run's timeline.

Events come from code or from the viewer's labels. A script or notebook adds
them with `rollout.annotations.add_event(...)` (then `save()`), and the
server's annotation API (`POST /api/runs/<name>/annotations`) writes the same
records: `{"op": "event_add", ...}` creates one and `{"op": "event_update",
"id", "label"?, "t0"?, "t1"?}` edits it. The viewer does not draw typed
events by hand (viewer v3, decision D20). Its one manual annotation is the
**label** (viewer v3.1, decision D26, which revises D20 in that one place):
a name at a moment, made by pressing M or from the ruler's context menu. A
label is an untyped event, `type` `""`, with `t0 == t1`, and the viewer draws
labels in a Labels lane that exists only for runs that have some.

The automatic highlights (landings, jumps, falls, contact and torque spikes)
are a separate, derived file, `highlights.json` (see the [viewer v3
contracts](2026-09-30-simscope-viewer-v3-contracts.md) 8.2); they are never
written into `annotations.json`, and a pack carries them as
`derived/<run>/highlights.json`.

- `t0 <= t1` in seconds. `t0 == t1` is an instant.
- `f0` and `f1` are the frames nearest to `t0` and `t1`:
  `floor(t / dt + 0.5)`, rounding half up as JavaScript's `Math.round`
  does, clipped to `[0, n_frames - 1]`. Writers snap on save, and viewers
  seek to the frame. Editing a time snaps the frames again.
- `env` is an env index, or `null` for all envs.
- `type` is a key into `event_types.json`, or `""` for untyped (a label). An
  unknown type is allowed, and viewers draw it in a neutral color.
- `label` is a short display string. `props` is an object of typed values
  (§4).

### 3.6 `spatial`
A 3D point or box at a moment in time. Like events, they are added by code
(`rollout.annotations.add_spatial(...)`), not by clicking in the viewer.

- `kind` is `"point"` or `"box"`.
- `frame` is `"world"`, or `"body:<index>"` for body-attached coordinates.
- `t` and `f` locate it in time, as for events. `env` is an env index.
- `position` is `[x, y, z]` in metres. `size` is the box's `[hx, hy, hz]`
  half-extents, or `null` for a point.
- `event` optionally links it to an event `id`.

## 4. `.simscope/event_types.json`

```json
{
  "format": "simscope-event-types/1",
  "types": {
    "fall": {"name": "Fall", "color": "#d33b3b", "key": "f",
             "props": {"severity": {"type": "select", "options": ["minor", "major"]}}},
    "slip": {"name": "Slip", "color": "#e59a1c", "key": "s", "props": {}}
  }
}
```

- `color` is a `#rrggbb` hex string.
- `key` is an optional single-character hotkey. The viewer no longer drops
  events from the keyboard (viewer v3, D20); the field stays so that older
  files load and round-trip.
- Each entry in `props` has a `type`: `"text"`, `"number"`, `"bool"`, or
  `"select"` (with `options`).
- If the file is missing, the library uses a built-in default of `fall`,
  `slip`, `success`, and `note`.

## 5. `.simscope/groups.json`

```json
{
  "format": "simscope-groups/1",
  "groups": [
    {"name": "Vault sweep", "created": "2026-09-30T12:00:00Z"},
    {"name": "Crates", "created": "2026-09-30T12:05:00Z"}
  ]
}
```

- The list is the order in which the viewer shows groups. A group may be
  empty. A run belongs to at most one group, through `marks.group` (§3.2).
- A name has 1 to 64 printable characters, without leading or trailing
  space, and is unique case-insensitively. When a run is moved into a group
  whose name matches an existing one in another case, the existing spelling
  is used.
- A group that runs use (`marks.group`) but the list lacks is shown after the
  listed ones, alphabetically. A missing file means no listed groups.
- Writers replace the file atomically, create it on the first write, and keep
  fields they do not know (top level and per group). Renaming a group
  rewrites `marks.group` in every member's sidecar (each file atomically);
  deleting one clears it, so its members become ungrouped.
- The viewer's server offers `GET /api/groups` and `POST /api/groups` with
  the ops `create`, `rename`, `delete` and `move` (reorder), and the
  annotation op `{"op": "group", "value": name | null}` that moves one run
  (viewer v3 contracts 8.1).

## 6. Index cache

`.simscope/index.sqlite` mirrors the fields that browsing needs from every
run's `rollout.json` and `annotations.json`: name, id, created, status,
frame, env, and body counts, dt, scene hash, record-time tags, the favorite
mark and the group, the note and event counts, and the mean `overall` rating.
(The deprecated `flag`, `status` and curation `tags` are not indexed.) It
stores each source file's mtime and size so rescans skip unchanged runs. It
carries a schema version: a cache from an older version is dropped and
rebuilt. Deleting it loses nothing, because the next scan rebuilds it.
