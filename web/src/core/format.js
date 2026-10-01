// simscope format v1 decoders (docs/specs/2026-09-30-simscope-format-v1.md).
//
// Pure functions over Uint8Array, no DOM and no three.js, so Node can test
// them. Everything is little-endian. Every failure throws an Error whose
// message starts with "simscope:" so it is easy to grep for.

const TEXT = new TextDecoder();

function fail(message) {
  throw new Error(`simscope: ${message}`);
}

// ---- CRC-32 (zlib/PNG polynomial), table driven ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 of `bytes[start:end]` as an unsigned integer. */
export function crc32(bytes, start = 0, end = bytes.length) {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function magic(bytes, at) {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** A Float32Array over `bytes[at : at + 4 * n]`, copying if unaligned. */
function f32At(bytes, at, n) {
  const abs = bytes.byteOffset + at;
  if (at + 4 * n > bytes.length) fail("truncated float data");
  if (abs % 4 === 0) return new Float32Array(bytes.buffer, abs, n);
  return new Float32Array(bytes.slice(at, at + 4 * n).buffer);
}

// ---- inflate ----

/**
 * Inflate deflate-raw (RFC 1951, no wrapper) bytes with the browser's own
 * DecompressionStream. `format` may be "gzip" for a gzip-wrapped pack.
 */
export async function inflate(bytes, format = "deflate-raw") {
  const stream = new DecompressionStream(format);
  const writer = stream.writable.getWriter();
  // Errors surface on the readable side; do not await (would deadlock on
  // back-pressure for large inputs).
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  try {
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  } catch (err) {
    return fail(`inflate failed (${err && err.message ? err.message : err})`);
  }
}

async function inflateChecked(bytes, ulen, what) {
  const out = await inflate(bytes);
  if (out.length !== ulen) fail(`${what}: inflated ${out.length} bytes, expected ${ulen}`);
  return out;
}

// ---- pack (SSPK) ----

/**
 * Parse a `.simscope` pack.
 *
 * Returns `{entries: Map<path, Uint8Array>}`. Entry arrays are views into
 * `bytes`, not copies. A gzip-wrapped pack must be inflated by the caller
 * (see `unwrapPack`).
 */
export function parsePack(bytes) {
  if (bytes.length < 32 || magic(bytes, 0) !== "SSPK") fail("not a simscope pack (bad SSPK magic)");
  const dv = view(bytes);
  const major = dv.getUint16(4, true);
  if (major !== 1) fail(`unsupported pack major version ${major}`);
  const nEntries = dv.getUint32(8, true);
  const dirOffset = Number(dv.getBigUint64(16, true));
  const dirLength = dv.getUint32(24, true);
  const dirCrc = dv.getUint32(28, true);
  if (dirOffset + dirLength > bytes.length) fail("pack directory out of bounds");
  if (crc32(bytes, dirOffset, dirOffset + dirLength) !== dirCrc) fail("pack directory CRC mismatch");
  let directory;
  try {
    directory = JSON.parse(TEXT.decode(bytes.subarray(dirOffset, dirOffset + dirLength)));
  } catch (err) {
    return fail(`pack directory is not valid JSON (${err.message})`);
  }
  const list = directory && directory.entries;
  if (!Array.isArray(list) || list.length !== nEntries) fail("pack directory entry count mismatch");
  const entries = new Map();
  for (const e of list) {
    if (e.offset + e.length > dirOffset) fail(`pack entry out of bounds: ${e.path}`);
    entries.set(e.path, bytes.subarray(e.offset, e.offset + e.length));
  }
  return { entries };
}

/** `bytes` inflated if they carry a gzip header, else as given. */
export async function inflateIfGzip(bytes) {
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return inflate(bytes, "gzip");
  return bytes;
}

/** Inflate `bytes` first if they carry a gzip header, then `parsePack`. */
export async function unwrapPack(bytes) {
  return parsePack(await inflateIfGzip(bytes));
}

/** Repository path of a content-addressed file: `<dir>/<h0h1>/<sha><ext>`. */
export function casPath(dir, sha256, ext = "") {
  return `${dir}/${sha256.slice(0, 2)}/${sha256}${ext}`;
}

// ---- block file (SSBK / SSBB) ----

const HEADER_SIZE = 64;
const BLOCK_HEADER = 32;
const CODEC_F32S = 1;
const CODEC_Q16D = 2;

function readBlockHeader(bytes, at) {
  const dv = view(bytes);
  return {
    offset: at,
    env: dv.getUint32(at + 8, true),
    t0: dv.getUint32(at + 12, true),
    n: dv.getUint32(at + 16, true),
    clen: dv.getUint32(at + 20, true),
    ulen: dv.getUint32(at + 24, true),
    codec: bytes[at + 4],
    crc: dv.getUint32(at + 28, true),
  };
}

/**
 * Parse a `.blk` file's header and directory (blocks stay compressed).
 *
 * Returns `{itemShape, itemK, nEnvs, nFrames, blockFrames, blocks, bytes}`.
 * `blocks` is in `(t0, env)` order; `blocks[i]` has offset/env/t0/n/clen/
 * ulen/codec. An unfinished file (`dir_offset = 0`) is rejected: recovering
 * it is the writer library's job, not the player's.
 */
export function parseBlk(bytes) {
  if (bytes.length < HEADER_SIZE || magic(bytes, 0) !== "SSBK") fail("bad SSBK magic in block file");
  const dv = view(bytes);
  const major = dv.getUint16(4, true);
  if (major !== 1) fail(`unsupported block file major version ${major}`);
  if (crc32(bytes, 0, 60) !== dv.getUint32(60, true)) fail("block file header CRC mismatch");
  const itemNdim = dv.getUint32(12, true);
  if (itemNdim > 4) fail(`bad item_ndim ${itemNdim}`);
  const itemShape = [];
  let itemK = 1;
  for (let i = 0; i < itemNdim; i++) {
    itemShape.push(dv.getUint32(16 + 4 * i, true));
    itemK *= itemShape[i];
  }
  const nEnvs = dv.getUint32(32, true);
  const nFrames = dv.getUint32(36, true);
  const blockFrames = dv.getUint32(40, true);
  const nBlocks = dv.getUint32(44, true);
  const dirOffset = Number(dv.getBigUint64(48, true));
  const dirLength = dv.getUint32(56, true);
  if (dirOffset === 0) fail("unfinished block file (dir_offset = 0); recover or finalize it with the simscope library first");
  if (dirLength !== 32 * nBlocks || dirOffset < HEADER_SIZE || dirOffset + dirLength > bytes.length) {
    fail("bad block directory");
  }
  const blocks = new Array(nBlocks);
  for (let i = 0; i < nBlocks; i++) {
    const e = dirOffset + 32 * i;
    blocks[i] = {
      offset: Number(dv.getBigUint64(e, true)),
      env: dv.getUint32(e + 8, true),
      t0: dv.getUint32(e + 12, true),
      n: dv.getUint32(e + 16, true),
      clen: dv.getUint32(e + 20, true),
      ulen: dv.getUint32(e + 24, true),
      codec: bytes[e + 28],
    };
  }
  return { bytes, itemShape, itemK, nEnvs, nFrames, blockFrames, blocks };
}

/**
 * Index blocks as `[window][env] -> block`, where window `w` covers frames
 * `w * blockFrames ..`. Returns an array of arrays (missing entries are
 * undefined).
 */
export function indexWindows(blk) {
  const windows = [];
  for (const b of blk.blocks) {
    if (b.env >= blk.nEnvs) fail(`block env ${b.env} out of range`);
    const w = Math.floor(b.t0 / blk.blockFrames);
    (windows[w] || (windows[w] = new Array(blk.nEnvs)))[b.env] = b;
  }
  return windows;
}

/** Unshuffle 4 byte planes, prefix-sum modulo 2^32 (f32s payload). */
function decodeF32s(payload, k, n) {
  const plane = k * n;
  const out = new Uint32Array(plane); // [n, K] row-major
  const p0 = payload.subarray(0, plane);
  const p1 = payload.subarray(plane, 2 * plane);
  const p2 = payload.subarray(2 * plane, 3 * plane);
  const p3 = payload.subarray(3 * plane, 4 * plane);
  for (let c = 0; c < k; c++) {
    let acc = 0;
    const base = c * n;
    for (let i = 0; i < n; i++) {
      const j = base + i;
      acc = (acc + ((p0[j] | (p1[j] << 8) | (p2[j] << 16) | (p3[j] << 24)) >>> 0)) >>> 0;
      out[i * k + c] = acc;
    }
  }
  return new Float32Array(out.buffer);
}

/** Unshuffle 2 planes, prefix-sum modulo 2^16, dequantize (q16d payload). */
function decodeQ16d(payload, k, n) {
  const lo = f32At(payload, 0, k);
  const step = f32At(payload, 4 * k, k);
  const plane = k * n;
  const p0 = payload.subarray(8 * k, 8 * k + plane);
  const p1 = payload.subarray(8 * k + plane, 8 * k + 2 * plane);
  const out = new Float32Array(plane);
  for (let c = 0; c < k; c++) {
    let acc = 0;
    const base = c * n;
    const l = lo[c];
    const s = step[c];
    for (let i = 0; i < n; i++) {
      const j = base + i;
      acc = (acc + (p0[j] | (p1[j] << 8))) & 0xffff;
      out[i * k + c] = Math.fround(l + Math.fround(acc * s));
    }
  }
  return out;
}

/**
 * Renormalize the xyzw quaternion of every [.., 7] pose row in place.
 *
 * Every step rounds to f32 (sequential sum of squares, sqrt, divide) so the
 * result matches the Python reference writer bit for bit.
 */
export function renormalizePoses(x) {
  const f = Math.fround;
  for (let i = 0; i + 7 <= x.length; i += 7) {
    const qx = x[i + 3], qy = x[i + 4], qz = x[i + 5], qw = x[i + 6];
    const norm = f(Math.sqrt(f(f(f(f(qx * qx) + f(qy * qy)) + f(qz * qz)) + f(qw * qw))));
    if (norm > 0) {
      x[i + 3] = qx / norm;
      x[i + 4] = qy / norm;
      x[i + 5] = qz / norm;
      x[i + 6] = qw / norm;
    }
  }
}

/**
 * Decode one block to a Float32Array of shape `[n, K]` (row-major).
 *
 * @param {object} blk  result of `parseBlk`.
 * @param {object} block  one entry of `blk.blocks`.
 * @param {{pose?: boolean}} options  `pose: true` renormalizes q16d
 *   quaternions (the stream's items are `[B, 7]`).
 */
export async function decodeBlock(blk, block, options = {}) {
  const { bytes, itemK } = blk;
  const at = block.offset;
  if (at + BLOCK_HEADER > bytes.length || magic(bytes, at) !== "SSBB") fail(`bad SSBB magic at offset ${at}`);
  const h = readBlockHeader(bytes, at);
  if (h.codec !== CODEC_F32S && h.codec !== CODEC_Q16D) fail(`unknown block codec ${h.codec}`);
  const start = at + BLOCK_HEADER;
  if (start + h.clen > bytes.length) fail(`block at offset ${at} is truncated`);
  const compressed = bytes.subarray(start, start + h.clen);
  if (crc32(compressed) !== h.crc) fail(`block CRC mismatch at offset ${at}`);
  if (h.codec === CODEC_F32S) {
    if (h.ulen !== 4 * itemK * h.n) fail(`block ulen ${h.ulen} does not match f32s layout (${4 * itemK * h.n})`);
    return decodeF32s(await inflateChecked(compressed, h.ulen, "block"), itemK, h.n);
  }
  const want = 8 * itemK + 2 * itemK * h.n;
  if (h.ulen !== want) fail(`block ulen ${h.ulen} does not match q16d layout (${want})`);
  const payload = await inflateChecked(compressed, want, "block");
  const x = decodeQ16d(payload, itemK, h.n);
  if (options.pose) renormalizePoses(x);
  return x;
}

/** Decode every block of one env into one `[nFrames, K]` array (tests, tools). */
export async function decodeEnv(blk, env, options = {}) {
  const out = new Float32Array(blk.nFrames * blk.itemK);
  const mine = blk.blocks.filter((b) => b.env === env);
  const parts = await Promise.all(mine.map((b) => decodeBlock(blk, b, options)));
  mine.forEach((b, i) => out.set(parts[i], b.t0 * blk.itemK));
  return out;
}

// ---- mesh blob (SSMH) ----

/** Area-weighted vertex normals, into a fresh Float32Array. */
export function computeNormals(verts, faces) {
  const normals = new Float32Array(verts.length);
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f] * 3, b = faces[f + 1] * 3, c = faces[f + 2] * 3;
    const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
    const vx = verts[c] - verts[a], vy = verts[c + 1] - verts[a + 1], vz = verts[c + 2] - verts[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      normals[i] += nx;
      normals[i + 1] += ny;
      normals[i + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len > 0) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    } else {
      normals[i + 2] = 1;
    }
  }
  return normals;
}

/** Undo the axis-major, delta-coded, 2-plane u16 quantization (spec §6). */
function dequantAxes(payload, at, count, axes, lo, step) {
  const plane = axes * count;
  const p0 = payload.subarray(at, at + plane);
  const p1 = payload.subarray(at + plane, at + 2 * plane);
  const out = new Float32Array(plane);
  for (let a = 0; a < axes; a++) {
    let acc = 0;
    for (let i = 0; i < count; i++) {
      const j = a * count + i;
      acc = (acc + (p0[j] | (p1[j] << 8))) & 0xffff;
      out[i * axes + a] = Math.fround(lo[a] + Math.fround(acc * step[a]));
    }
  }
  return out;
}

/**
 * Decode a mesh blob.
 *
 * Returns `{verts: Float32Array, faces: Uint32Array, normals: Float32Array,
 * uvs: Float32Array | null, nVerts, nFaces}`. q16 blobs carry no normals, so
 * they are computed here.
 */
export async function decodeMesh(bytes) {
  if (bytes.length < 32 || magic(bytes, 0) !== "SSMH") fail("bad SSMH magic in mesh blob");
  const dv = view(bytes);
  const major = dv.getUint16(4, true);
  if (major !== 1) fail(`unsupported mesh major version ${major}`);
  const nv = dv.getUint32(8, true);
  const nf = dv.getUint32(12, true);
  const flags = dv.getUint32(16, true);
  const codec = bytes[20];
  const ulen = dv.getUint32(24, true);
  const compressed = bytes.subarray(32);
  if (crc32(compressed) !== dv.getUint32(28, true)) fail("mesh CRC mismatch");
  if (codec !== 0 && codec !== 1) fail(`unknown mesh codec ${codec}`);
  const hasNormals = (flags & 1) !== 0;
  const hasUvs = (flags & 2) !== 0;
  const payload = await inflateChecked(compressed, ulen, "mesh");

  if (codec === 0) {
    let at = 0;
    const take = (n) => {
      const a = f32At(payload, at, n);
      at += 4 * n;
      return a;
    };
    const verts = take(3 * nv);
    const faces = new Uint32Array(payload.slice(at, at + 12 * nf).buffer);
    at += 12 * nf;
    const normals = hasNormals ? take(3 * nv) : computeNormals(verts, faces);
    const uvs = hasUvs ? take(2 * nv) : null;
    return { verts, faces, normals, uvs, nVerts: nv, nFaces: nf };
  }

  // q16
  if (hasNormals) fail("q16 mesh must not have the normals flag");
  const pv = payload;
  const vlo = f32At(pv, 0, 3), vstep = f32At(pv, 12, 3);
  const verts = dequantAxes(pv, 24, nv, 3, vlo, vstep);
  let at = 24 + 6 * nv;
  const fplane = 3 * nf;
  const faces = new Uint32Array(fplane);
  const fp = [0, 1, 2, 3].map((b) => pv.subarray(at + b * fplane, at + (b + 1) * fplane));
  let acc = 0;
  for (let i = 0; i < fplane; i++) {
    acc = (acc + ((fp[0][i] | (fp[1][i] << 8) | (fp[2][i] << 16) | (fp[3][i] << 24)) >>> 0)) >>> 0;
    faces[i] = acc;
  }
  at += 4 * fplane;
  let uvs = null;
  if (hasUvs) {
    const ulo = f32At(pv, at, 2), ustep = f32At(pv, at + 8, 2);
    uvs = dequantAxes(pv, at + 16, nv, 2, ulo, ustep);
  }
  return { verts, faces, normals: computeNormals(verts, faces), uvs, nVerts: nv, nFaces: nf };
}

// ---- JSON entries ----

/** Parse a UTF-8 JSON pack entry. */
export function parseJson(bytes, what) {
  try {
    return JSON.parse(TEXT.decode(bytes));
  } catch (err) {
    return fail(`${what} is not valid JSON (${err.message})`);
  }
}

/** Check a `format` field such as "simscope-scene/1": the major must be 1. */
export function checkFormat(obj, family, what) {
  const fmt = obj && obj.format;
  const m = typeof fmt === "string" ? /^([a-z-]+)\/(\d+)$/.exec(fmt) : null;
  if (!m || m[1] !== family) fail(`${what}: expected format "${family}/1", got ${JSON.stringify(fmt)}`);
  if (Number(m[2]) !== 1) fail(`${what}: unsupported major version ${m[2]}`);
}
