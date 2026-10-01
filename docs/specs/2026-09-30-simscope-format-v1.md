# simscope format v1

**Status:** Normative, 2026-09-30. Minor 1 (2026-09-30, viewer v3) adds
the `contacts` stream convention and the pack's `derived/` entries. Revised the same day with clarifications
from the reference implementation (`simscope.io`), before any files were
published. This spec defines the bytes that the
Python writer (`simscope.io`) and the JavaScript reader (`simscope-player`)
must agree on. The design choices behind it are in the
[proposal](2026-09-30-simscope-proposal.md), decisions D1, D2, D10, and D11.
Any change to this document bumps the minor version (backward-compatible
additions) or the major version (anything else).

## 1. Conventions

- All multi-byte integers and floats are **little-endian**.
- Floats are IEEE-754 `f32` unless stated otherwise.
- Coordinates are Z-up, right-handed, in metres. Time is in seconds.
- A **pose** is 7 floats: `[px, py, pz, qx, qy, qz, qw]`. The quaternion is
  unit-norm and in **xyzw** order (D1).
- **Quaternion sign continuity.** Within a stream, a writer must flip `q` to
  `-q` whenever `dot(q_t, q_{t-1}) < 0`. Both represent the same rotation,
  and continuous signs keep deltas small. Readers must not assume anything
  about the sign of the first frame.
- "deflate-raw" means RFC 1951 with no zlib or gzip wrapper. In Python this
  is `zlib.compressobj(level, zlib.DEFLATED, -15)`. In browsers it is
  `DecompressionStream("deflate-raw")`. Writers use level 6.
- "Aligned to 8" means the next byte offset that is a multiple of 8. Writers
  fill padding with zero bytes. Readers ignore padding.
- CRC-32 is the zlib/PNG polynomial (`zlib.crc32`).
- Text is UTF-8. JSON files contain one object.

## 2. Library layout

A library is a directory. A pack (§8) is the same tree stored in one file.

```text
<library>/
  .simscope/index.sqlite            derived cache; never read by the player
  .simscope/event_types.json        annotation vocabulary (defined in a later spec)
  assets/<h0h1>/<sha256-hex>        content-addressed blobs (meshes §6, textures)
  scenes/<h0h1>/<sha256-hex>.json   content-addressed scene descriptors (§4)
  runs/<run-name>/rollout.json      manifest (§5)
  runs/<run-name>/<stream>.blk      block files (§7), named by the manifest
  runs/<run-name>/annotations.json  mutable sidecar (annotations spec)
  runs/<run-name>/poster.png        optional still image for PDF and no-WebGL fallback
```

- `<sha256-hex>` is the 64-character lowercase hex SHA-256 of the file's
  exact bytes. `<h0h1>` is its first two characters.
- A reference to a content-addressed file is the object
  `{"sha256": "<hex>", "size": <bytes>}`. Readers may verify both fields.
- A CAS file is immutable. Writers write it to a temporary file in the same
  directory, then rename it into place. If the target already exists, they
  skip the write.
- `<run-name>` matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`.

## 3. Canonical JSON

Every content-addressed JSON file uses canonical serialization, so equal
content gives equal hashes:

- Python `json.dumps(obj, sort_keys=True, separators=(",", ":"),
  ensure_ascii=False, allow_nan=False).encode("utf-8")`, with no trailing
  newline.
- Every float that came from an `f32` is first widened to Python `float` with
  `float(np.float32(x))`, so its shortest repr is deterministic.
- Integers stay integers. Tuples become lists.

Manifests (`rollout.json`) are not content-addressed. Writers pretty-print
them with `indent=2` and `sort_keys=True` for readable diffs.

## 4. Scene descriptor

A scene is the static part of a rollout. Many rollouts share one scene file.

```json
{
  "format": "simscope-scene/1",
  "bodies": [{"name": "world", "parent": -1}, {"name": "torso", "parent": 0, "mass": 12.5}],
  "geoms": [
    {"body": 1, "kind": "capsule", "size": [0.05, 0.2, 0.0],
     "pos": [0.0, 0.0, 0.0], "quat": [0.0, 0.0, 0.0, 1.0], "scale": [1.0, 1.0, 1.0],
     "material": 0, "mesh": null, "role": "visual", "name": "torso_geom"}
  ],
  "materials": [{"rgba": [0.8, 0.6, 0.4, 1.0], "metallic": 0.0, "roughness": 1.0,
                 "texture": null, "texrepeat": [1.0, 1.0]}],
  "meshes": [{"sha256": "…", "size": 12345, "n_verts": 100, "n_faces": 196}],
  "textures": [{"sha256": "…", "size": 999, "media_type": "image/png",
                "width": 256, "height": 256}]
}
```

- `bodies[i].parent` is the index of the parent body, or `-1`. Body 0 is
  usually the world. The per-frame pose stream (§5) has one pose per body, in
  this order.
- `bodies[i].mass` (optional, kg) is the body's mass. It is written only for
  a body above 0, so a scene without masses has the bytes, and the hash, it
  had before the field existed; absent means unknown (0). Highlights weight
  the centre of mass by it. The MuJoCo adapter fills it from `body_mass`.
- `geoms[j].body` indexes `bodies`. `pos` and `quat` place the geom in its
  body's frame. The geom's world pose is `body_pose ∘ (pos, quat)`.
- `material` indexes `materials`. `mesh` indexes `meshes`, or is `null`.
  `texture` indexes `textures`, or is `null`. `name` may be `""`.
- `role` is `"visual"` or `"collision"`. Viewers show visual geoms by default
  and toggle collision geoms.
- `scale` multiplies the geom's local vertices component-wise. Primitive
  sizes are already in metres, so `scale` is `[1, 1, 1]` for primitives.
- `kind` and `size` follow MuJoCo's conventions. Adapters convert anything
  else, and tessellate unsupported shapes (such as height fields and cones)
  into meshes.

| `kind` | `size` | Local shape |
| --- | --- | --- |
| `box` | `[hx, hy, hz]` half-extents | axis-aligned box centred on the origin |
| `sphere` | `[r, 0, 0]` | sphere |
| `capsule` | `[r, h, 0]` | cylinder of half-length `h` along local +z, plus hemispherical caps |
| `cylinder` | `[r, h, 0]` | cylinder of half-length `h` along local +z |
| `ellipsoid` | `[rx, ry, rz]` | ellipsoid with these radii |
| `plane` | `[hx, hy, spacing]` | plane z = 0 facing +z. `hx = 0` or `hy = 0` means infinite in that axis. `spacing` is the grid line spacing, where 0 means the viewer's default |
| `mesh` | `[0, 0, 0]` | the referenced mesh, times `scale` |

## 5. Rollout manifest (`rollout.json`)

```json
{
  "format": "simscope-rollout/1",
  "id": "01J9Z3…",
  "name": "walk_seed17",
  "created": "2026-09-30T12:00:00Z",
  "status": "complete",
  "dt": 0.02,
  "n_frames": 1000,
  "n_envs": 1,
  "n_bodies": 31,
  "scene": {"sha256": "…", "size": 18342},
  "env_scenes": null,
  "env_origins": [[0.0, 0.0, 0.0]],
  "streams": {
    "body_pose": {"file": "body_pose.blk", "kind": "pose", "item_shape": [31, 7]},
    "reward": {"file": "reward.blk", "kind": "scalar", "item_shape": []},
    "foot_forces": {"file": "foot_forces.blk", "kind": "arrows", "item_shape": [4, 6]}
  },
  "source": {"simulator": "mujoco", "version": "3.14.0"},
  "tags": ["sweep_07"],
  "meta": {}
}
```

- `id` is a ULID, fixed at creation. `name` equals the run directory name.
- `status` is `"recording"` or `"complete"`. While recording, the manifest
  is stored as `rollout.json.partial`. Finalize writes `rollout.json`
  atomically and deletes the `.partial` file.
- Frame `i` is at time `i * dt`. v1 supports a fixed `dt` only.
- `env_scenes` is `null`, or a list of `n_envs` scene references for runs
  where domain randomization gives each env its own scene. When it is set,
  it overrides `scene` per env.
- `env_origins` holds the world offset each viewer adds to every pose of
  env `e`. It is all zeros when the simulator already reports world poses
  that include env offsets.
- Every stream has shape `[n_frames, n_envs, *item_shape]` of f32.
  `body_pose` is required, with `kind` `"pose"` and `item_shape`
  `[n_bodies, 7]`.
- A stream's `kind` tells viewers how to draw it:

| `kind` | `item_shape` | Meaning |
| --- | --- | --- |
| `pose` | `[B, 7]` | body poses (§1) |
| `scalar` | `[]` | one value per frame per env, for plots |
| `vector` | `[K]` | K named values (`"labels"`: list of K strings) for plots |
| `arrows` | `[K, 6]` | K arrows as `[ox, oy, oz, vx, vy, vz]` in world frame |
| `points` | `[K, 3]` | K world points |
| `polyline` | `[K, 3]` | one world polyline of K vertices, as used for predictions |

- A stream may carry optional `"labels"` (list of strings) and `"units"`
  (string) fields.
- An `arrows` stream may carry an optional `"scale"`: metres of drawn arrow
  per unit of vector. The default is 1. Viewers draw an arrow of length
  `|v| * scale` and may clamp very long arrows for legibility.
- **Contacts (minor 1, convention).** An `arrows` stream named `contacts`
  records contact forces: item shape `[K, 6]`, each row the contact point
  (m, world frame) followed by the force on the robot (N, world frame), with
  zero rows for unused slots (zeros deflate to almost nothing). Its `scale`
  is metres per newton, by default `1 / (m g)` of the robot so that body
  weight draws as 1 m, and its `units` is `"N"`. MuJoCo writes one row per
  active contact, Isaac Lab one row per `ContactSensor` body. Viewers draw
  it for the focused envs only. Automatic highlights read the net force
  from it: the norm of the sum of the K force vectors of a frame.
- `source` records provenance. `tags` and `meta` are free-form, set at
  record time. Curation after recording goes in `annotations.json`, never
  here.

## 6. Mesh blob (`assets/…`)

A mesh blob is a 32-byte header followed by a deflate-raw payload.

```text
offset size field
0      4    magic "SSMH"
4      2    u16 major = 1
6      2    u16 minor = 0
8      4    u32 n_verts
12     4    u32 n_faces            triangles
16     4    u32 flags              bit 0: has normals; bit 1: has uvs
20     1    u8  codec              0 = raw, 1 = q16
21     3    reserved (0)
24     4    u32 ulen               uncompressed payload length
28     4    u32 crc32 of the compressed payload
32     …    deflate-raw(payload)
```

**Raw payload (`codec` 0), used for library storage:**

```text
f32 vertices[n_verts][3]
u32 faces[n_faces][3]
f32 normals[n_verts][3]      only if flags bit 0
f32 uvs[n_verts][2]          only if flags bit 1
```

**q16 payload (`codec` 1), used for exports:**

```text
f32 v_lo[3], f32 v_step[3]
u8  vertex planes[2][3 * n_verts]    see below
u8  face planes[4][3 * n_faces]
f32 uv_lo[2], f32 uv_step[2]         only if flags bit 1
u8  uv planes[2][2 * n_verts]        only if flags bit 1
```

- Vertices:
  1. For each axis `a`, `lo = min(v[:, a])` and
     `step = (max - lo) / 65535`. If max equals lo, `step = 0`.
  2. `q = round((v - lo) / step)` as u16, or 0 where `step = 0`.
  3. Take `q` in axis-major order (all x, then all y, then all z), and
     delta-code each axis's sequence modulo 2^16: the first value is
     absolute, and each later value is `q[i] - q[i-1]`.
  4. Byte-shuffle into 2 planes: plane 0 holds the low bytes, plane 1 the
     high bytes.
  5. Decode as `v = lo + q * step`.
- Faces: flatten to one u32 sequence, delta-code it modulo 2^32, then
  byte-shuffle it into 4 planes (plane `b` holds byte `b`).
- q16 has no normals, so readers compute vertex normals. flags bit 0 must
  be 0 when `codec` is 1.
- UVs are quantized like vertices, with 2 axes.

A texture blob is the raw file bytes (PNG or JPEG), with no header. Image
rows are stored top-down, as those formats define. UVs follow the OpenGL
convention: `(0, 0)` is the bottom-left of the image as viewed, and `v`
increases upward. This matches three.js textures with `flipY = true`.

## 7. Block file (`*.blk`)

A block file stores one stream: `[n_frames, n_envs, *item_shape]` f32. It is
split into independently compressed blocks, so a reader can fetch and decode
any window on its own.

### 7.1 File layout

```text
header (64 B) | block | block | … | directory
```

**Header:**

```text
offset size field
0      4    magic "SSBK"
4      2    u16 major = 1
6      2    u16 minor = 0
8      4    u32 header_size = 64
12     4    u32 item_ndim (0..4)
16     16   u32 item_shape[4]        unused entries are 0
32     4    u32 n_envs
36     4    u32 n_frames             0 while recording
40     4    u32 block_frames         the nominal frames per block (writer default 100)
44     4    u32 n_blocks             0 while recording
48     8    u64 dir_offset           0 while recording
56     4    u32 dir_length           bytes
60     4    u32 crc32 of header bytes 0..59
```

`K = prod(item_shape)`, or 1 when `item_ndim` is 0. This is the number of
floats per env per frame.

### 7.2 Block

Each block starts at an offset aligned to 8.

```text
offset size field
0      4    magic "SSBB"
4      1    u8  codec             1 = f32s, 2 = q16d
5      3    reserved (0)
8      4    u32 env
12     4    u32 t0                first frame index
16     4    u32 n                 frames in this block (1..block_frames)
20     4    u32 clen              compressed payload bytes
24     4    u32 ulen              uncompressed payload bytes
28     4    u32 crc32 of the compressed payload
32     clen deflate-raw(payload)
```

Every block, including the last, is followed by zero padding up to the next
multiple of 8. The directory is therefore aligned too.

Each block holds frames `t0 .. t0+n-1` of one env. The writer emits blocks
in `(t0, env)` order: all envs for one time window, then the next window.
Every block has `n = block_frames`, except the last window, which may be
shorter.

### 7.3 Directory

The directory is `n_blocks` entries of 32 bytes each, in the same
`(t0, env)` order as the blocks:

```text
0  u64 offset        of the block header
8  u32 env
12 u32 t0
16 u32 n
20 u32 clen
24 u32 ulen
28 u8  codec
29 3   reserved
```

**Empty streams.** A finished stream with no frames has `n_blocks = 0`,
`dir_offset = 64`, and `dir_length = 0`. `dir_offset = 0` always means
unfinished.

**Crash recovery.** A file with `dir_offset = 0` is unfinished. Recovery is a
writer-side repair, done by the Python `simscope.io.recover`. Viewers and the
JavaScript player reject unfinished files with a clear error, and never guess. The writer
keeps a valid header CRC even while recording, so recovery can trust the
header. A reader recovers the file as follows:

1. Walk the blocks from offset 64, checking each block's magic, lengths, and
   CRC. Stop at the first block that fails.
2. Keep only complete windows. A complete window has one valid block for
   every env, all with the same `t0`, and windows follow each other
   contiguously. A window shorter than `block_frames` may only be the last.
3. Truncate the file after the last complete window, then append the
   rebuilt directory and rewrite the header.

`finalize()` does the same last step: it appends the directory, then
rewrites the header.

### 7.4 Payload codecs

Let `x` be the block's data as f32 `[n, K]`: the `n` frames of one env.

**`f32s` (codec 1), lossless, the archive default:**

1. Reinterpret `x` as u32 bits, shape `[n, K]`.
2. Delta-code along time, modulo 2^32. Row 0 stays absolute, and each
   later row `i` becomes `bits[i] - bits[i-1]`.
3. Transpose to `[K, n]` (component-major), C-contiguous.
4. Byte-shuffle into 4 planes. Plane `b` holds byte `b` (least significant
   first) of every u32, so the payload is 4 planes of `K*n` bytes each.
5. deflate-raw. `ulen = 4 * K * n`.

The decoder reverses the steps: inflate, unshuffle, transpose back, prefix-sum
modulo 2^32, and reinterpret as f32. The round trip is bit-exact, including
NaN payloads.

**`q16d` (codec 2), lossy, the export default:**

1. For each component `k`, `lo[k] = min(x[:, k])` and
   `step[k] = (max(x[:, k]) - lo[k]) / 65535`. If max equals lo,
   `step[k] = 0`.
2. `q = round((x - lo) / step)`, clipped to 0..65535, as u16. Where
   `step = 0`, `q = 0`.
3. Delta-code `q` along time modulo 2^16, as in `f32s` step 2.
4. Transpose to `[K, n]`, then byte-shuffle into 2 planes.
5. The payload is `f32 lo[K] | f32 step[K] | plane0 | plane1`, compressed
   with deflate-raw. `ulen = 8*K + 2*K*n`.

The decoder computes `x = lo + q * step` in f32, rounding after each
operation: a float32 multiply, then a float32 add, with no fused
multiply-add. A JavaScript reader matches bit for bit with
`Math.fround(lo + Math.fround(q * step))`. For `pose` streams, readers
renormalize each decoded quaternion before use. The per-block,
per-component ranges bound the error at `step / 2`: about 15 µm for a
component spanning 2 m in one block, and about 1e-5 for quaternion
components.

Writers never use `q16d` for a block whose values contain NaN or ±inf, or
whose per-component range `max - lo` overflows f32. They fall back to `f32s`
for that block.

The block header does not record the stream kind, so a reader learns it from
the manifest (§5). Renormalization applies only to `q16d` blocks of `pose`
streams. `f32s` data stays bit-exact.

## 8. Pack (`*.simscope`)

A pack stores a library subtree in one file. It is used for export, HTML
embedding, and hand-off to mkdeck and artifacts-server.

```text
offset size field
0      4    magic "SSPK"
4      2    u16 major = 1
6      2    u16 minor = 0
8      4    u32 n_entries
12     4    reserved (0)
16     8    u64 dir_offset
24     4    u32 dir_length
28     4    u32 crc32 of the directory bytes
32     …    entry bytes, each aligned to 8
…           directory: UTF-8 JSON
```

The directory is JSON:
`{"entries": [{"path": "runs/walk/rollout.json", "offset": 32, "length": 1234}, …]}`.

- Paths use the §2 layout, with `/` separators and no leading slash. A pack
  holds one or more runs, plus exactly the scenes and assets they reference.
  Each asset is stored once, however many runs share it.
- A pack holds only `rollout.json` for each run, never
  `rollout.json.partial`.
- A pack may include `runs/<name>/annotations.json` so exports can bake in
  markers, and `runs/<name>/poster.png` for viewers that cannot use WebGL.
- **Derived entries (minor 1).** A pack may include derived data for a run
  under `derived/<name>/`, where `<name>` is the run name. All entries are
  optional, and viewers that do not know them ignore them:

  | Path | Contents |
  | --- | --- |
  | `derived/<name>/highlights.json` | automatic highlights (net contact force and centre-of-mass acceleration peaks, plus any custom kinds; `simscope-highlights/2`) |
  | `derived/<name>/root_pose.blk` | a block file `[E, 1, 7]` of the followed body's pose, `q16d`; written for packs with more than 64 envs, it is what the crowd tier draws |
  | `derived/<name>/summaries.json` | one number per env for each of a few columns, for sorting the env picker; written for packs with more than 64 envs |

  `highlights.json` is the object
  `{"format": "simscope-highlights/2", "detector": "simscope/3",
  "run_id": ..., "kinds": [{"key", "label", "color"?}], "highlights":
  [{"t", "frame", "t1", "frame1", "env", "kind", "label", "detail", "score",
  "ratio", "value", "body", "also"}]}`, sorted by `t` (a custom kind may
  have a span, `t1`; the viewer contracts, section 9, define every field). `env` indexes the envs of the pack, so an export that keeps a subset
  of envs renumbers them from 0 and drops the highlights of the others. The
  viewer contracts define the files in full. A writer records minor version
  1 in the header when the pack has any `derived/` entry, and minor 0
  otherwise.
- **Env subsets.** An export may keep only some envs of a run (for example
  to fit a browser's string limit). Every stream and the manifest's
  `n_envs`, `env_origins` and `env_scenes` are cut to those envs, which are
  renumbered from 0 in the order given, and `annotations.json` keeps only the
  records of kept envs (plus the ones for all envs), renumbered the same way.
- Entry bytes are stored as-is. Blocks and mesh blobs are already
  compressed.
- Writers sort entries by path and write the directory as compact JSON, so
  equal inputs give byte-identical packs. Readers must not rely on the order.

## 9. Compatibility rules

- A reader rejects a file whose major version it does not know. It accepts
  any minor version, and ignores unknown JSON fields and unknown flag bits.
- A reader rejects an unknown codec id with a clear error. It never guesses.
- All magic strings are ASCII: `SSBK`, `SSBB`, `SSMH`, `SSPK`.
