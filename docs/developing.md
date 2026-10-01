# Developing

simscope is a Python package and a browser player. Python records, stores, and serves rollouts. The browser plays them. Both sides read the same files. The writer is `src/simscope/io/`. The reader is `web/src/core/format.js`.

Pull requests, commit messages, and releases are in [CONTRIBUTING.md](https://github.com/senthurayyappan/simscope/blob/main/CONTRIBUTING.md). Design choices are in [Design](design.md). Change a decision there before changing the code that depends on it.

## Layout

| Path | What it is |
| --- | --- |
| `src/simscope/` | The Python package. `library.py` and `recorder.py` write rollouts. `io/` is the format. `mujoco.py` and `isaaclab.py` are the simulator adapters. `server/` is `simscope serve`. |
| `web/src/core/` | The player. The app and the `<simscope-player>` element both use it. `index.js` is the public surface, typed by `index.d.ts`. |
| `web/src/element/` | The `<simscope-player>` element used by a lean export and by an mkdeck slide. |
| `web/src/app/` | The React app for `simscope serve` and for a full export. |
| `src/simscope/_assets/` | The built player and app. The package ships these files, so a user does not need Node. |

## Checks

```bash
make install
make check
make test
make docs-test
cd web && npm ci && npm test && npm run build
```

`make install` installs the tools and the git hooks. `make check` lints, formats, and type-checks. Node 26 is what CI uses. After a change under `web/src/`, commit the rebuilt files in `src/simscope/_assets/` and `web/src/core/decode_worker.generated.js`. The build is byte for byte the same on every machine, and CI fails if the commit differs.

Do not add `tests/io/__init__.py`. Pytest would then treat `io` as a top-level package and shadow the standard library.

## Files an extension has to respect

Coordinates are Z-up, right-handed, in metres. Time is in seconds. A pose is `[px, py, pz, qx, qy, qz, qw]`, with the quaternion in xyzw order. Within a stream, flip `q` to `-q` when the dot product with the previous frame is negative, so the signs stay continuous.

A library is a folder:

```text
<library>/
  .simscope/index.sqlite          cache; deleting it loses nothing
  .simscope/event_types.json      event vocabulary
  .simscope/groups.json           ordered groups
  assets/<ab>/<sha256>            meshes and textures, stored once
  scenes/<ab>/<sha256>.json       static scenes, stored once
  runs/<name>/rollout.json        manifest; rollout.json.partial while recording
  runs/<name>/<stream>.blk        frame data
  runs/<name>/annotations.json    notes, ratings, labels; absent means none
```

A rollout name matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. `body_pose` is required. Frame `i` is at time `i * dt`. `env_origins` is the world offset the viewer adds to each env. Use zeros when the simulator already reports world poses.

A scene's geoms use these kinds. Convert anything else, and turn an unsupported shape into a mesh.

| `kind` | `size` | Shape |
| --- | --- | --- |
| `box` | `[hx, hy, hz]` | Half-extents, centred on the origin |
| `sphere` | `[r, 0, 0]` | Sphere |
| `capsule` | `[r, h, 0]` | Half-length `h` along local +z, plus caps |
| `cylinder` | `[r, h, 0]` | Half-length `h` along local +z |
| `ellipsoid` | `[rx, ry, rz]` | Radii |
| `plane` | `[hx, hy, spacing]` | z = 0, facing +z. A zero `hx` or `hy` is infinite |
| `mesh` | `[0, 0, 0]` | The referenced mesh |

`role` is `visual` or `collision`. Geom `pos` and `quat` are in the parent body's frame.

A stream is one array of shape `[n_frames, n_envs, *item_shape]`.

| `kind` | `item_shape` | Drawn as |
| --- | --- | --- |
| `pose` | `[B, 7]` | Body poses. `body_pose` uses this |
| `scalar` | `[]` | One plot value |
| `vector` | `[K]` | K plot values, named by `labels` |
| `arrows` | `[K, 6]` | `[ox, oy, oz, vx, vy, vz]` in the world frame |
| `points` | `[K, 3]` | World points |
| `polyline` | `[K, 3]` | One polyline |

Name an arrows stream `contacts` to record contact forces. Each row is the contact point in metres, then the force on the body in newtons. Pad unused slots with zeros. Set `units` to `N`.

Curation does not rewrite `rollout.json`. Notes, ratings, labels, and the group live in `annotations.json`. A label is an event with an empty `type`. Highlights are a separate derived file, not part of the sidecar. A rollout belongs to at most one group, named by `marks.group`. If `.simscope/event_types.json` is missing, the library uses four types: `fall`, `slip`, `success`, and `note`.

A reader rejects a major version it does not know, and an unknown codec. It accepts a newer minor version and ignores unknown JSON fields. A byte change goes in `src/simscope/io/` and in `web/src/core/format.js`. A compatible addition bumps the minor version. Anything a current reader would misread bumps the major version.

## Extend

**A simulator.** Follow `mujoco.py` or `isaaclab.py`. Provide a scene, body poses, and, when the simulator has them, contacts. There is no adapter registry. Add an adapter when a project needs that simulator.

**A marker.** Register a detector with `highlights.register`, as in [Custom markers](getting-started.md#custom-markers). The built-in kinds are contact force and center-of-mass acceleration. A label placed by hand goes through `annotations`.

**An importer.** Add it in `importers.py` and write through `Library.record`, so meshes are stored once. The current importers read `.rbundle` files and Brax HTML pages.

**The player.** `web/README.md` describes `index.js`. Tests for the player live in `web/test/` and run with `node --test`.
