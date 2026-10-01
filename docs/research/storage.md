# simscope research track: storage formats, content-addressing, file/range serving

Everything below was measured or read from primary sources on 2026-09-29. Anything I could not verify is marked UNVERIFIED. All artifacts live in `/private/tmp/claude-501/-Users-senthurayyappan-Projects-simscope/3cd0ceb1-4f12-4f06-ba0c-7c7e8581dba7/scratchpad/research/storage/`. That directory holds `bench.py`, `meshbench.py`, `b64bench.py`, `indexbench.py`, `zarrtest.py`, `srv/`, `web/` and `js/`. Nothing in simscope or other projects was touched.

## Executive summary

1. **Whole-tail gzip and on-the-fly `Content-Encoding` are the wrong shape for scrubbing.** `.rbundle` v2 gzips the whole tail (`bundle_parser.js`), and the artifacts-server spec relies on HTTP `Content-Encoding` for wire compression. Both force a full download before frame 0 can be shown, and HTTP `Range` applies to the encoded representation (RFC 9110 s14, https://www.rfc-editor.org/rfc/rfc9110#section-14). The fix is independently compressed blocks of about 100 frames, listed in a small index, served as identity-encoded static bytes with `Range`. This is the PMTiles/Zarr-sharding pattern.
2. **Poses are cheap. Meshes and duplication are the real bytes.**
   - A 30-body, 50 Hz, 20 s rollout is 840 KB as raw f32. It shrinks to about 180–290 KB with int16 quantization, delta, byte-shuffle and deflate.
   - A menagerie-scale mesh set (40 meshes) is 4.27 MB raw and 1.96 MB gzipped. Across thousands of runs, mesh dedup by content hash matters far more than pose codecs. mkdeck's `.meshes` split is right. I would extend it to also content-address the static scene descriptor.
3. **Use browser-native deflate for the hot path.**
   - Chrome 152 (tested): `DecompressionStream` accepts gzip, deflate and deflate-raw, and rejects brotli and zstd.
   - caniuse: brotli is in Firefox 147+ and Safari 18.4+, but not Chrome. zstd is in no browser (Firefox 138–159 has it behind a flag).
   - Native gzip/deflate-raw decodes at roughly 540 MB/s with 0 KB of JS.
   - zstd19 saves only 2.7% and brotli11 only 4.3% over gzip6 on quantized pose blocks. Not worth a WASM decoder for poses.
4. **Quantize positions to int16 and quaternions to int16 (or smallest-three), then delta, byte-shuffle and deflate.**
   - Position error is about 0.03 mm and rotation error about 0.035 degrees.
   - Generic compression on f32 gains only 8–25%. The f32 delta+shuffle+zstd19 result is roughly 570 KB per rollout on the noisy set.
   - Keyframe decimation (RDP) helps only on smooth motion. It cuts 61–82% at 1–5 mm tolerance on the smooth set, but only 6–45% on the contact-noisy set.
5. **Do not adopt a standard container as the runtime format.** Zarr v3 sharded is the best standard and is a fine export target. It is a poor runtime fit because of codec plumbing in JS (zarrita core is 36 KB min, but 1.42 MB with numcodecs WASM bundled). Both zarrita and h5wasm have no way to express our quantized-delta codec without custom codecs. HDF5 needs whole-file download in the browser. Arrow JS cannot read IPC-compressed buffers. MCAP is a strong recording format but adds Foxglove-shaped structure we do not need.
6. **Recommended design:**
   - A folder-per-rollout with `rollout.json` plus one indexed block file. The same bytes can be concatenated into a single "pack" file, PMTiles-style, for HTML embedding.
   - A sha256 CAS `assets/` for meshes and scene descriptors.
   - A rebuildable SQLite index. Annotations live in a mutable sidecar and never inside immutable blobs.
   - This evolves `.rbundle`'s ideas and mkdeck's split rather than adopting anything wholesale. An adapter to Zarr/npz can be added later.
7. **Serving is easy and memory stays flat.**
   - Starlette `FileResponse` handled random 64 KB range reads on a 4 GB file at about 1.7k req/s, with RSS flat at 45 MB. It also streamed 2 GB with no RSS growth.
   - A 5000-rollout folder indexed into SQLite in 0.13 s warm. A stat-only incremental rescan took 11 ms.
8. **Single-file HTML: use `Uint8Array.fromBase64`, not an `atob` loop.**
   - In Chrome 152, decoding 25 MB of base64 took 5 ms with `fromBase64`, versus 625 ms for the `atob` loop mkdeck uses today and 210 ms for `fetch(data:)`.
   - A 134 MB HTML file with a 101 MB payload reached `domComplete` in 266 ms and decoded in 20 ms, with 263 MB JS heap.
   - Base64 costs a flat +33% on disk. Base122's README recommends against web use.

## Prior formats (grounding)

- **`.rbundle`** (`~/Projects/artifacts-server/artifacts_server/static/bundle_parser.js`): `RBDL` magic, u64 header length, JSON header, then a tail of f32/u32 buffers. v2 gzips the entire tail. Everything in a rollout, including meshes, is one blob. The design doc says "on-wire size is mitigated by HTTP compression, not by an in-format codec". That is fine for a dashboard but not for windowed access.
- **mkdeck** (`~/Projects/mkdeck/src/mkdeck/rollout.py`, `assets/mkdeck-rollout.js`):
  - Splits into `.rollout` (RSPL magic, JSON header, gzipped pose tail) and a shared `HASH.meshes` named by `sha256[:16]`.
  - Offsets index the concatenated mesh-tail plus pose-tail, so the reader never rewrites offsets.
  - Already uses `DecompressionStream("gzip")` (no vendored inflate).
  - Already embeds single-file decks as base64 in `<script data-mkd-rollout>`, decoded with an `atob` plus charCode loop. That loop is the 125× slowdown measured below.

## Benchmark methodology

**Pose data.** I generated it with MuJoCo 3.14.0, from a procedural MJCF with 30 bodies (torso, head, 4×6-link limbs, 4-link tail). It has 28 hinge joints under PD position actuators tracking sinusoids. The step is 0.002 s and I record every 10 steps for 50 Hz and 1000 frames, giving T=1000, N=30, 7 floats per body.

- **"dyn"**: free-floating base flailing on a ground plane. It is contact-noisy, so pessimistic for compression.
- **"fixed"**: fixed base, smoother.
- Real policies will land between the two. Real Isaac Sim rollouts are UNVERIFIED.
- Quaternion sign was made temporally continuous before all schemes.
- All figures are bytes for the whole 1000-frame rollout. B/frame is the byte figure divided by 1000.

**Meshes.** 40 OBJs from mujoco_menagerie (`unitree_go2` and `anybotics_anymal_c` assets, https://github.com/google-deepmind/mujoco_menagerie), welded on exact position. That gives 120,767 vertices and 234,897 triangles, positions only (no normals or UVs).

### Poses, bytes for 30 bodies × 1000 frames (raw f32 = 840,000 B)

| Scheme | dyn gzip6 | dyn zstd19 | dyn brotli11 | fixed gzip6 | Error |
|---|---|---|---|---|---|
| f32 AoS | 773,817 | 772,661 | 759,157 | 653,444 | lossless |
| f32 SoA + byte-shuffle | 614,194 | 600,651 | 587,393 | 460,323 | lossless |
| f32 SoA + int-delta of bits + shuffle | 579,158 | 567,302 | 556,432 | 411,692 | lossless |
| f16 SoA + shuffle | 260,488 | 253,230 | 242,307 | 184,786 | 1.0 mm / 0.06° (dyn), 0.2 mm (fixed) |
| int16 pos + int16 quat, SoA delta + shuffle | 266,105 | 258,812 | 254,771 | 181,845 | 0.031 mm / 0.035° (dyn), 0.012 mm (fixed) |
| same, second-order delta | 255,721 | 248,246 | 240,260 | 158,906 | same |
| int16 pos + smallest-three 10-bit quat (AoS, 300 KB raw) | 294,277 | 294,398 | 288,239 | 240,842 | 0.21° rot |
| RDP keyframes 5 mm / 1° | 169,739 (55% kept) | n/a | 159,813 | 54,281 (18% kept) | +quantization |
| RDP keyframes 1 mm / 0.25° | 279,625 (94% kept) | n/a | 262,055 | 112,079 (39% kept) | +quantization |

Random-access cost with independently compressed blocks (int16 delta + shuffle + gzip6):

| Block size | dyn total | fixed total |
|---|---|---|
| 25 frames | 299,824 | 214,083 |
| 50 frames | 290,316 | 201,492 |
| 100 frames | 278,866 | 191,772 |
| 250 frames | 271,064 | 186,443 |
| whole rollout | 266,105 | 181,845 |

A 100-frame block costs about 5% versus whole-file compression, and one block is about 28 KB (dyn) or 19 KB (fixed) on the wire. That is a good range-request size.

Other observations:
- Smallest-three at 10 bits saves raw bytes (10 B vs 14 B per body-frame) but its bits are noise-like and barely compress. Delta-coded int16 beats it after compression.
- meshopt's vertex codec on the same int16 pose records (via the PyPI wrapper) gave 307,527 B (dyn) and 223,959 B (fixed). That is worse than delta+shuffle+deflate.
- **Bytes/frame for 30 bodies at 50 Hz:**
  - Raw f32: 840 B/frame (16.8 KB/s).
  - Recommended int16 delta with 100-frame blocks: about 280 B/frame on the noisy set and about 190 B/frame on the smooth set.
  - Adding RDP on smooth data: about 55–110 B/frame.

### Meshes (40 meshes, 120,767 verts, 234,897 tris; raw f32 verts + u32 indices = 4,267,968 B)

| Encoding | Bytes | Notes |
|---|---|---|
| gzip6 of raw | 1,960,087 | |
| zstd19 of raw | 1,741,328 | |
| brotli11 of raw | 1,528,345 | |
| q16 positions + u32 indices | 3,543,366 | zstd19 gives 1,448,855 |
| meshopt (q16, vertex-cache and fetch optimized): 571,906 vertex + 282,460 index | 854,366 | gzip gives 729,063 |
| Draco 14-bit, level 7 | 383,143 | 14-bit quantization, so not identical to meshopt's 16-bit |

Draco is about 2.2× smaller than meshopt but needs a 286 KB WASM decoder (88 KB gzipped). The meshopt JS decoder is 26 KB min / 7.2 KB gzipped, with WASM inlined. The meshopt README says its decoders run at 3–6 GB/s and its output remains compressible by zstd (https://github.com/zeux/meshoptimizer).

### Browser measurements (Chrome 152 in the Claude Browser pane; Firefox and Safari NOT tested)

| Measurement | Result |
|---|---|
| `DecompressionStream` formats accepted | gzip, deflate, deflate-raw yes; brotli, zstd no (TypeError) |
| Decode of one 420 KB block, native gzip | 0.78 ms (536 MB/s) |
| Decode of one 420 KB block, native deflate-raw | 0.76 ms (552 MB/s) |
| Decode of one 420 KB block, fflate `inflateSync` | 1.47 ms (286 MB/s) |
| Decode of one 420 KB block, fflate `gunzipSync` | 3.94 ms (107 MB/s) |
| Decode of one 420 KB block, fzstd | 0.72 ms (586 MB/s) |
| base64 → bytes, 25 MB, `atob` + loop | 625 ms |
| base64 → bytes, 25 MB, `fetch("data:…")` | 210 ms |
| base64 → bytes, 25 MB, `Uint8Array.fromBase64` | 5 ms |
| Max JS string | 2^29−24 = 536,870,888 chars (2^29−23 throws), so at most about 402 MB of binary per single base64 text node |
| 134 MB HTML, 101 MB base64 payload in `<script type="application/octet-stream">` | `domComplete` 266 ms; `textContent` read 6 ms; `fromBase64` 20 ms; heap 263 MB |

### Base64 alternatives (int16-delta pose payload)

| Payload | Binary | base64 | ascii85/base85 | gzip of base64 text |
|---|---|---|---|---|
| Raw f32 | 840,000 | 1,120,000 (+33%) | 1,050,000 | 836,977 |
| Deflated pose blocks | 263,884 | 351,848 | 329,855 | 266,474 |

- Ascii85 is +25% and base122 is +14%. The Base122 README itself says it is "not recommended" for web pages because base64 gzips better and decodes slower (https://github.com/kevinAlbs/Base122).
- gzip of base64 text recovers the overhead, but only when the HTML is served or stored compressed, not when it is emailed as a plain file.

### Server and indexing (macOS APFS, page cache warm)

- Starlette 1.7.0 + uvicorn 0.54.0 `FileResponse` on a 4 GB sparse file:
  - 2000 random 64 KB range reads took 1.15 s (1742 req/s, 114 MB/s, single client).
  - RSS was 45.3 MB at start, 45.6 MB after the range reads, and 45.8 MB after streaming 2.1 GB.
  - It returned 206 with `Content-Range`, `Accept-Ranges: bytes` and an ETag. Suffix ranges and multi-range (`multipart/byteranges`) work.
  - Starlette's docs state Range support (https://www.starlette.dev/responses/), and its recent release notes show ongoing range hardening, including a 100-range cap (https://github.com/encode/starlette/blob/master/docs/release-notes.md).
- 5000 synthetic rollout dirs (21 files each):
  - Full scan + JSON parse + SQLite upsert: 0.13 s.
  - Stat-only incremental check: 0.011 s.
  - 1000 indexed browse queries: 0.40 s.
  - Cold-cache and network-filesystem behavior are UNVERIFIED.
- Hash speed on Apple silicon: sha256 (stdlib) 3.2 GB/s, blake3 2.5 GB/s (33 GB/s multithreaded), xxh3_128 20 GB/s. x86 numbers are UNVERIFIED.
- Zarr 3.4.0 write test (1000×30×7 f32):
  - 50-frame chunks, zstd: 21 files, 773 KB.
  - Blosc-zstd-shuffle: 694 KB.
  - Sharded (1 shard, 50-frame inner chunks): 2 files, 695 KB.
  - `Array.append` works.
  - Unsharded Zarr means a file per chunk, which does not scale to thousands of rollouts.

## Format comparison

JS sizes are minified / gzip -9, measured with esbuild 0.2x from npm latest as of today (`js/o_*.js`).

| Format | Random access | Compression | JS reader (min / gz) | Python writer | Append / streaming | Inlinable in HTML | Maturity / license | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Own block-indexed pack** (proposed) | directory then range read per block | per-block deflate-raw (or zstd) | about 3 KB hand-rolled, 0 KB inflate | numpy + zlib | yes: closed block files, manifest at finalize | yes, the pack is one blob | new | **Runtime format** |
| Zarr v3 (sharded) | shard index (offset,nbytes u64 pairs), then inner chunk; spec ratified, https://zarr-specs.readthedocs.io/en/latest/v3/codecs/sharding-indexed/index.html | Blosc, zstd, gzip, etc. via numcodecs | zarrita 0.7.5: 36 KB / 11.7 KB core; 1.42 MB / 474 KB with codecs bundled | zarr 3.4.0 (MIT, Python ≥3.12) | `append`/resize works; unsharded means many files | poorly (multi-file store) | mature, MIT | **Export/interchange adapter** |
| HDF5 (h5wasm) | chunked datasets, but whole file must be loaded in browser | gzip built in; others via plugins | h5wasm 0.10.3: about 4.15 MB / 984 KB gz (WASM inline) | h5py 3.16.0 (BSD-3) | SWMR append | no | mature; h5wasm license "SEE LICENSE" / NOASSERTION | **No** |
| NumPy `.npy` / `.npz` | `.npy` trivial offset; `.npz` zip central directory | zip deflate | npyjs 1.2.0: 5.6 KB / 2.2 KB; fflate for zip | numpy | none | yes | mature; Apache-2.0 | Import/debug only |
| safetensors | JSON header gives per-tensor offsets; mmap; sliced loading | none | none needed (~10 lines: read u64, JSON.parse, typed-array views) | safetensors 0.8.0 (Apache-2.0) | no; "no holes", 100 MB header cap | yes (raw) | mature | Inspiration (near-twin of `.rbundle`); no chunking or compression |
| Arrow IPC / Feather | footer with record-batch offsets | LZ4/ZSTD buffers exist in spec, but JS reader lacks IPC-buffer compression (https://github.com/apache/arrow/issues/24833) | apache-arrow 21.2 `tableFromIPC`: 219 KB / 50 KB | pyarrow 25.0.1 (53 MB wheel) | record-batch streaming | yes if uncompressed | mature, Apache-2.0 | **Skip** for poses |
| Parquet (hyparquet / parquet-wasm / DuckDB-WASM) | row-group range reads | snappy built in; zstd/brotli via hyparquet-compressors | hyparquet 1.31: 57 KB / 17.7 KB; parquet-wasm 5.25 MB wasm (1.66 MB gz); duckdb-wasm eh wasm 35.9 MB | pyarrow, duckdb | row-group append | no | mature | Only for tabular signals/index if ever; JSON suffices |
| Lance / LanceDB | good (designed for selective reads, https://lance.org/format/) | yes | no browser reader in the docs page I read; UNVERIFIED whether one exists | pylance 12.0.0 (87 MB wheel) | versioned append | no | young, Apache-2.0 | **No** |
| MCAP | chunk index + message index; time lookups | zstd or lz4 per chunk (https://mcap.dev/spec) | @mcap/core 2.3.0: 63 KB / 14.7 KB, plus user-supplied zstd/lz4 decompressor | mcap 1.5.0 (pure Python, 20 KB wheel) | streaming write is a core design goal | possible but awkward | mature (Foxglove), MIT | Runner-up recording format; no quantization/CAS story |
| msgpack / CBOR | none (sequential) | none | @msgpack/msgpack 21 KB / 5.9 KB; msgpackr 28 KB / 10.5 KB; cbor-x 29 KB / 10.8 KB | msgpack 1.2.3, cbor2 6.1.4 | trivial | yes | mature | Not for arrays; JSON is fine for metadata |
| FlatBuffers / Cap'n Proto | zero-copy offsets | none built in | flatbuffers 8.9 KB / 2.6 KB + generated code | flatbuffers 25.12.19 | no | yes | mature | Codegen build step; no |
| glTF/GLB | accessors/bufferViews into one BIN chunk | EXT_meshopt_compression (also compresses animation), KHR_draco, KHR_mesh_quantization (ratified) | meshopt decoder 26 KB / 7.2 KB; Draco WASM 286 KB (88 KB gz) | trimesh 5.1.0, pygltflib 1.16.5 | no | yes | mature; Khronos | **Use for mesh/scene assets (optional)**; not for trajectories |
| PMTiles | fixed 127-byte header + directory, 16 KB root fetch then 1 tile fetch | per-directory and per-tile | pmtiles 4.5.0: 19 KB / 7.4 KB | python `pmtiles` 3.8.1 | write-once, clustered | n/a | mature, BSD-3 | **Design inspiration** (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md) |

Notes on the table:
- PMTiles v3 detail: the root directory must fit in 16,257 compressed bytes, so a client's first request is 16,384 bytes. The tile-ID directory is varint delta-encoded. Identical tiles dedup via run-length entries.
- The EXT_meshopt_compression spec describes a QUATERNION filter and says animation data can be compressed (https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md). I did not test it on poses.
- sql.js-httpvfs is for browsing a SQLite file over range requests, needing `journal_mode=delete` and a tuned page size. It has no cache eviction, the last npm release was 2022-09, and the author calls it a small personal project (https://github.com/phiresky/sql.js-httpvfs). It is not needed here because the server can query SQLite itself.

## Content-addressed storage: what applies

- **DVC**: cache layout `files/md5/ab/cdef…`, with a `.dir` JSON manifest mapping relpath to hash (https://doc.dvc.org/user-guide/project-structure/internal-files). This is the layout to copy: two-hex fan-out, flat, one immutable file per hash, and a rollout manifest listing the asset hashes.
- **restic / borg / casync**: content-defined chunking (restic: Rabin, 512 KiB min / ~1 MiB avg / 8 MiB max, sha256 blob ids, https://restic.readthedocs.io/en/stable/100_references.html). CDC pays off only for near-duplicate large blobs. Mesh sets are either identical or different, so whole-file hashing is enough. Skip CDC. `fastcdc` 1.7.0 (MIT, pure Python) exists if that ever changes.
- **OCI / ORAS**: descriptor of `mediaType` + `digest` (`sha256:hex`) + `size` (https://github.com/opencontainers/image-spec/blob/main/descriptor.md). Worth mimicking in `rollout.json` asset references, so each ref is self-verifying (hash and size). No dependency needed.
- **IPFS CARv2**: sequence of blocks plus a digest-to-offset index for random access (https://ipld.io/specs/transport/car/carv2/). This is conceptually identical to the pack directory below. It is a useful proof that "blocks plus offset index" is the standard pattern, but no need to depend on it.
- **git-lfs, git-annex, ostree, Nix store**: same "hash names the file, manifests reference hashes" idea. None has a small embeddable Python library that beats about 40 lines of `hashlib` + `os.link`. I did not review their internals beyond the general model.
- **Small Python CAS libs**: `hashfs` is dead (last release 2019). `dvc-objects` 5.2.0 and `dvc-data` 3.18.3 (Apache-2.0) are real but bring DVC's dependency tree. `oras` 0.2.43 is only for registries. Recommendation: write the CAS in-house (`sha256`, write to temp then atomic rename, refcount table in SQLite, mark-and-sweep GC).
- **Extra dedup beyond meshes.** The static scene descriptor (geoms, materials, body tree, mesh refs) is identical across all runs of a model. CAS it as `scene/<hash>.json` (mkdeck currently dedups only meshes). Thousands of runs then carry only a hash.

## Recommended on-disk layout

### Library of many rollouts

```
library/
  .simscope/index.sqlite            # derived, rebuildable: id, path, mtime, n_frames, dt, tags, scene_hash, user marks cache
  assets/                           # CAS, immutable, shared across every run
    3f/a91c…e2.glb                  # mesh set or single mesh (sha256 hex, 2-char fan-out)
    9b/07d4…11.scene.json           # static scene descriptor (geoms, materials, body tree, mesh refs)
  runs/
    2026-09-29_walk_seed17/         # one folder per rollout
      rollout.json                  # manifest (small; written last, atomically)
      frames.blk                    # indexed block file (see below)
      signals.blk                   # optional: reward/torque/contact scalars, same container
      annotations.json              # MUTABLE sidecar: marks/notes/tags (blobs stay immutable)
```

### `rollout.json` (manifest)

```
{ "format":"simscope-rollout/1", "n_frames":1000, "dt":0.02, "envs":1, "n_bodies":30,
  "scene":{"sha256":"9b07…","size":18342},
  "frames":{"file":"frames.blk","layout":"q16d","block_frames":100,
            "streams":{"pos":{"shape":["T","N",3],"dtype":"u16","quant":"bbox"},
                       "quat":{"shape":["T","N",4],"dtype":"i16","scale":32767}}},
  "signals":{"reward":{"file":"signals.blk","dtype":"f32"}},
  "status":"complete", "meta":{…} }
```

- While recording, write `rollout.json.partial` and close each 100-frame block as it fills. A crash is recoverable by scanning complete blocks. `status` flips to `complete` on finalize.
- Asset refs use OCI-style `{sha256,size}` so readers can verify.

### `frames.blk` (PMTiles/safetensors-inspired, byte level)

```
0    "SIMB"  u8 major  u8 minor  u16 flags
8    u64 dir_off   u64 dir_len          # directory can sit at the end (append-friendly) or start
24   u32 n_blocks  u32 reserved
32   ... block payloads, each 8-byte aligned, each independently deflate-raw compressed ...
dir  entries of 28 B: u16 env, u32 t0, u16 nframes, u64 off, u32 clen, u32 ulen, u32 crc32
```

Block payload after inflate:

```
32 B header: u32 nframes | u16 nbodies | u8 codec | u8 flags | f32 pos_lo[3] | f32 pos_step[3]
planes:      7 components × N bodies × nframes int16 values, delta-coded in time (first = absolute)
             stored byte-shuffled (all low bytes, then all high bytes), then deflate-raw
```

- JS decode: `DecompressionStream("deflate-raw")`, then unshuffle, then prefix-sum in int16 (wraps mod 2^16, matching the encoder), then dequantize to `Float32Array`. This is about 30 lines, with no dependency.
- Batched envs: blocks are keyed by `(env, t0)`, so viewing one env reads one block per 100 frames, and viewing all envs at time t reads E blocks.
- The directory is 28 B per block. That is 10 blocks (280 B) for a 1000-frame single-env rollout, but 10k blocks (about 280 KB) for 1000 envs. For very large E, use a two-level root/leaf directory like PMTiles, or a separate `.idx`.
- Per-block position `lo`/`step` come from that block's bbox, which bounds quantization error by the block's extent. Use a per-rollout bbox if you prefer.
- **Single-file pack for HTML/export**: concatenate `rollout.json` + `frames.blk` + referenced CAS assets behind a PMTiles-style header and directory, keyed by path or hash. The existing `RSPL`/`RBDL` reader logic maps onto this directly.

### Should we evolve `.rbundle`, adopt mkdeck's split, or adopt a standard?

**Adopt mkdeck's split as the principle, evolve `.rbundle`'s ideas into the block-indexed layout above, and keep standards as exports.**

- `.rbundle` v2 is the wrong shape: one gzipped tail means no windowed access, and it carries meshes per file.
- mkdeck's split is correct (content-hashed meshes, per-run poses). It stops short in three places: poses are one gzipped tail, the scene descriptor is not shared, and there is no index of blocks.
- Zarr v3 sharded is the closest standard. You would still need custom codecs for quantized-delta in both Python and JS, and its browser reader is 36 KB without codecs and 1.4 MB with them. Its value is ecosystem access (xarray, numpy, DVC), which an exporter provides at low cost.
- MCAP is a serious alternative if Foxglove/ROS-style tooling matters. It gives streaming and indexing for free. Against it: no dedup of shared assets, whole-chunk zstd only, and a decoder dependency in JS.

## Serving design notes

- **Endpoints** (Starlette works, already installed as a FastAPI dependency in artifacts-server):
  - `GET /api/runs` served from SQLite.
  - `GET /runs/<id>/rollout.json` (small, gzipped or zstd content-coded, `ETag`).
  - `GET /runs/<id>/frames.blk` with `Range`, served by `FileResponse`.
  - `GET /assets/<sha>` served as identity encoding with `Cache-Control: public, max-age=31536000, immutable` and `ETag: "<sha>"`.
- **No on-the-fly compression for blocks or assets.** They are already compressed, and content coding conflicts with `Range` (RFC 9110 s14). Content-code only manifests, index JSON, and any `.glb` that is not pre-compressed. zstd `Content-Encoding` is supported in Chrome 123+, Firefox 126+ and Safari 26+ (https://caniuse.com/zstd), which is fine for JSON.
- **Memory profile.** Keep RSS flat by never loading blocks server-side, only opening files and letting the OS page cache serve ranges. Measured: 45 MB flat with a 4 GB file. Keep only small LRU caches (`cachetools`) of parsed manifests and directories. Use `mmap` only if the server has to read block contents itself, for example to transcode.
- **Indexing.** Scan with `os.scandir` at startup, store per-run summary rows in SQLite (WAL), and re-scan incrementally by stat. `watchfiles` 1.3.0 (Rust-based) can trigger a rescan of just the changed run. Ignore `*.partial` runs, or mark them "recording". The index is derived state, so delete-and-rebuild is always safe.
- **Dedup.** Assets are hashed at write time. If `assets/ab/cd…` exists, skip the write. Runs reference assets by hash. GC is refcount or mark-and-sweep from manifests. Optionally `os.link` or reflink into a run folder when materializing a self-contained export.
- **Server choices.** Starlette or FastAPI on uvicorn works and was measured. granian has built-in static serving with cache headers (https://github.com/emmett-framework/granian) but I did not benchmark it. Caddy `file_server` is the zero-Python option for pure static browsing (range support is standard; not benchmarked). Datasette is the same idea for the SQLite index but is heavier than needed.
- **Chunk size.** 100 frames (about 20–30 KB compressed) balances request count against about 5% compression loss. PMTiles' 16 KB first-fetch shows the same trade-off.
- **HTTP/1.1 vs 2 and CDN behavior** for many small range requests: UNVERIFIED for this workload.

## Single-file HTML embedding

- Store one `<script type="application/octet-stream" data-rollout="…">` per rollout or asset, containing base64 of already-deflated blocks. mkdeck already does this with `data-mkd-rollout`.
- Decode with `Uint8Array.fromBase64` (Baseline since September 2025 per MDN, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64), with the existing `atob` loop as fallback. That is 125× faster on 25 MB in Chrome 152.
- The disk cost is +33% on pre-compressed data, fixed. If the HTML is hosted with `Content-Encoding: gzip/br`, the overhead is recovered (gzip of base64 text was within 1% of binary size in the test). For email or Slack attachment sharing it is not.
- Practical limits:
  - V8's 536,870,888-char string cap (about 402 MB of binary per text node) means splitting into several script tags for very large decks.
  - `data:` URL cap is 512 MB in Chromium and Firefox and 2 GB in Safari (https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data).
  - Top-level `data:` navigation is blocked, but `fetch("data:…")` works.
  - 134 MB loaded fine in Chrome 152.
  - Firefox and Safari load times for big HTML are UNVERIFIED.
  - reveal.js-specific limits are UNVERIFIED. The practical constraint for decks is what recipients can receive (for example email attachment caps), not the browser.
- Dedup within a deck: hash-name the mesh script tags so slides that reuse a model share one copy. mkdeck already does this.
- A base122 or ascii85 encoding would save 8–19 points of overhead but is not worth the decoder, and the Base122 author advises against it on the web.

## Dependencies worth taking

**Python.**

| Package | Version / date | License | Size | Use |
|---|---|---|---|---|
| `numpy` (assumed present) | n/a | BSD | n/a | quantize, delta, shuffle |
| stdlib `zlib`, `hashlib`, `sqlite3`, `json` | n/a | PSF | 0 | deflate-raw blocks, sha256 CAS, index, manifests |
| `starlette` | 1.7.0, 2026-09-23 | BSD-3 | 0.08 MB | range-capable file serving |
| `uvicorn` | 0.54.0, 2026-09-25 | BSD-3 | 0.09 MB | server |
| `watchfiles` | 1.3.0, 2026-09-21 | MIT | 0.66 MB wheel | folder watching |
| `cachetools` | 7.2.0 | MIT | 0.02 MB | manifest/directory LRU |
| `zstandard` 0.25.0 or stdlib `compression.zstd` (Python 3.14, PEP 784, https://peps.python.org/pep-0784/) | 2025-09-14 | BSD-3 | 6.4 MB wheel | only if choosing zstd blocks or on-disk zstd |
| `zarr` | 3.4.0, 2026-09-15 | MIT | 0.38 MB (+numcodecs 1.5 MB); Python ≥3.12 | optional export extra |
| `trimesh` / `pygltflib` | 5.1.0 / 1.16.5 | MIT / see PyPI | 0.75 MB / 0.03 MB | mesh IO, `.glb` writing |
| `meshoptimizer` (PyPI wrapper of upstream) | 0.2.30a0 (alpha version tag), 2026-02-27 | MIT upstream | tiny | optional mesh compression; alpha maturity |
| `DracoPy` | 2.1.0, 2026-09-17 | Apache-2.0 | 6.1 MB | only if mesh size dominates exports |
| `mcap` | 1.5.0, 2026-09-24 | MIT | 0.02 MB | optional export |
| `blake3` | 1.0.10 | CC0/Apache-2.0 | 0.6 MB | not needed; sha256 is fast enough here |
| `msgspec` / `orjson` | 0.22.0 / 3.12.0 | BSD-3 / MPL-2.0+ | 0.25 / 0.22 MB | only if manifest parsing shows up in profiles |

**Vendored JS.**

| Item | Min / gzip | License | Take it? |
|---|---|---|---|
| Native `DecompressionStream("deflate-raw")` | 0 KB | n/a | **Yes**, primary path (Chrome 152 verified) |
| `fzstd` 0.1.1 | 7.0 KB / 3.4 KB | MIT | Only if zstd blocks are chosen (about 586 MB/s; unmaintained since 2024-03) |
| `fflate` 0.8.3 (inflate only) | 4.5 KB / 2.3 KB | MIT | Fallback for browsers without `DecompressionStream` |
| `meshopt_decoder.mjs` (meshoptimizer 1.3.0) | 26 KB / 7.2 KB | MIT | Only if meshes are meshopt-encoded |
| `npyjs` 1.2.0 | 5.6 KB / 2.2 KB | Apache-2.0 | Only for `.npy` import |
| `pmtiles` 4.5.0 | 19 KB / 7.4 KB | BSD-3 | No; borrow the design |
| Draco WASM decoder | 286 KB / 88 KB | Apache-2.0 | No, unless meshes dominate |
| zarrita, h5wasm, apache-arrow, duckdb-wasm, parquet-wasm | see comparison table | mixed | No for runtime |

## Concrete recommendations to the caller

1. Define the block-indexed pose format above (int16 delta + byte-shuffle + deflate-raw, 100-frame blocks, directory of `(env,t0,off,clen,ulen,crc)`), plus a CAS `assets/` for meshes and scene descriptors, plus a rebuildable SQLite index.
2. Keep the offline HTML path on base64 script tags, but switch the decoder to `Uint8Array.fromBase64` (fallback `atob`).
3. Start meshes as raw f32/u32 in the CAS with gzip. Meshopt is a 2.7× later win (0.73 MB vs 1.96 MB in my set). Reserve Draco for a proven need.
4. Serve blocks and assets as identity-encoded `FileResponse` with `Range` and immutable caching headers. Content-code only JSON.
5. Add Zarr/npz/MCAP exporters later if demanded. That demand is UNVERIFIED.

## Sources (non-obvious claims)

- DecompressionStream formats and support: https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream, https://caniuse.com/mdn-api_decompressionstream_decompressionstream_zstd, https://caniuse.com/mdn-api_decompressionstream_decompressionstream_brotli, plus my Chrome 152 test.
- zstd Content-Encoding support: https://caniuse.com/zstd
- PMTiles v3: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
- Zarr v3 sharding: https://zarr-specs.readthedocs.io/en/latest/v3/codecs/sharding-indexed/index.html
- safetensors format: https://raw.githubusercontent.com/huggingface/safetensors/main/README.md
- MCAP: https://mcap.dev/spec
- Lance: https://lance.org/format/
- h5wasm: https://raw.githubusercontent.com/usnistgov/h5wasm/main/README.md
- zarrita: https://raw.githubusercontent.com/manzt/zarrita.js/main/README.md
- Arrow JS IPC compression gap: https://github.com/apache/arrow/issues/24833
- hyparquet snappy built-in, zstd via a separate package: https://github.com/hyparam/hyparquet-compressors
- glTF EXT_meshopt_compression: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md
- glTF KHR_mesh_quantization: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md
- glTF KHR_draco_mesh_compression: https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md
- meshoptimizer: https://github.com/zeux/meshoptimizer
- PEP 784: https://peps.python.org/pep-0784/
- Base122: https://github.com/kevinAlbs/Base122
- Data URL limits: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data
- `Uint8Array.fromBase64`: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64
- DVC cache layout: https://doc.dvc.org/user-guide/project-structure/internal-files
- restic chunking: https://restic.readthedocs.io/en/stable/100_references.html
- CARv2: https://ipld.io/specs/transport/car/carv2/
- OCI descriptor: https://github.com/opencontainers/image-spec/blob/main/descriptor.md
- sql.js-httpvfs: https://github.com/phiresky/sql.js-httpvfs
- Starlette FileResponse range support: https://www.starlette.dev/responses/, https://github.com/encode/starlette/blob/master/docs/release-notes.md
- granian static serving: https://github.com/emmett-framework/granian
- npm and PyPI versions and dates: registry.npmjs.org and pypi.org JSON APIs, queried 2026-09-29.
- Prior formats: `/Users/senthurayyappan/Projects/artifacts-server/artifacts_server/static/bundle_parser.js`, `/Users/senthurayyappan/Projects/artifacts-server/docs/specs/2026-06-30-native-rollout-viewer-design.md`, `/Users/senthurayyappan/Projects/mkdeck/src/mkdeck/rollout.py`, `/Users/senthurayyappan/Projects/mkdeck/src/mkdeck/assets/mkdeck-rollout.js`.

## UNVERIFIED / not tested

- Real Isaac Sim rollout compressibility (my data is MuJoCo, procedural robot).
- Firefox and Safari behavior for DecompressionStream deflate-raw, big-HTML load times, and `Uint8Array.fromBase64` (only Chrome 152 was measured; caniuse/MDN cover the rest).
- Cold-cache and network-filesystem index scan times.
- x86 hash throughput.
- Whether a Lance browser reader exists.
- glTF meshopt QUATERNION filter on pose data.
- granian and Caddy range-serving performance.
- Starlette version that first added `FileResponse` range support.
- Licenses of individual menagerie models.
- h5wasm's exact license terms.
