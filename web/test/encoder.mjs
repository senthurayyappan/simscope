// Test-only encoder for simscope format v1. It mirrors the spec so the
// decoders in src/format.js can be checked (and the demo pack built) without
// the Python writer. Not shipped in the player bundle.

import zlib from "node:zlib";

const crc32 = (bytes) => zlib.crc32(bytes) >>> 0;
const deflate = (bytes) => new Uint8Array(zlib.deflateRawSync(bytes, { level: 6 }));
const align8 = (n) => (n + 7) & ~7;

function concat(chunks) {
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function u32Bits(f32) {
  return new Uint32Array(f32.buffer, f32.byteOffset, f32.length);
}

/** f32s payload for x: Float32Array [n, K]. */
function encodeF32s(x, k, n) {
  const bits = u32Bits(x);
  const planes = [0, 1, 2, 3].map(() => new Uint8Array(k * n));
  for (let c = 0; c < k; c++) {
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = bits[i * k + c];
      const d = (v - prev) >>> 0;
      prev = v;
      for (let b = 0; b < 4; b++) planes[b][c * n + i] = (d >>> (8 * b)) & 0xff;
    }
  }
  return concat(planes);
}

/** q16d payload; ranges are per component over this block. */
function encodeQ16d(x, k, n) {
  const lo = new Float32Array(k), step = new Float32Array(k);
  const planes = [new Uint8Array(k * n), new Uint8Array(k * n)];
  for (let c = 0; c < k; c++) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) {
      mn = Math.min(mn, x[i * k + c]);
      mx = Math.max(mx, x[i * k + c]);
    }
    lo[c] = mn;
    step[c] = mx === mn ? 0 : Math.fround((mx - Math.fround(mn)) / 65535);
    let prev = 0;
    for (let i = 0; i < n; i++) {
      let q = step[c] === 0 ? 0 : Math.round((x[i * k + c] - lo[c]) / step[c]);
      q = Math.min(Math.max(q, 0), 65535);
      const d = (q - prev) & 0xffff;
      prev = q;
      planes[0][c * n + i] = d & 0xff;
      planes[1][c * n + i] = d >>> 8;
    }
  }
  return concat([new Uint8Array(lo.buffer), new Uint8Array(step.buffer), ...planes]);
}

/**
 * Encode a block file.
 *
 * @param {object} o  `{itemShape, nEnvs, nFrames, blockFrames, codec, data,
 *   finalize}` with `data` a Float32Array `[nFrames, nEnvs, ...itemShape]`
 *   and `codec` "f32s" or "q16d". `finalize: false` omits the directory.
 */
export function encodeBlk(o) {
  const { itemShape, nEnvs, nFrames, blockFrames = 100, codec = "f32s", data } = o;
  const k = itemShape.reduce((a, b) => a * b, 1);
  const parts = [];
  const dir = [];
  let at = 64;
  for (let t0 = 0; t0 < nFrames; t0 += blockFrames) {
    const n = Math.min(blockFrames, nFrames - t0);
    for (let env = 0; env < nEnvs; env++) {
      const x = new Float32Array(n * k);
      for (let i = 0; i < n; i++) {
        x.set(data.subarray(((t0 + i) * nEnvs + env) * k, ((t0 + i) * nEnvs + env + 1) * k), i * k);
      }
      const payload = codec === "f32s" ? encodeF32s(x, k, n) : encodeQ16d(x, k, n);
      const comp = deflate(payload);
      const head = new Uint8Array(32);
      const dv = new DataView(head.buffer);
      head.set([0x53, 0x53, 0x42, 0x42]); // SSBB
      head[4] = codec === "f32s" ? 1 : 2;
      dv.setUint32(8, env, true);
      dv.setUint32(12, t0, true);
      dv.setUint32(16, n, true);
      dv.setUint32(20, comp.length, true);
      dv.setUint32(24, payload.length, true);
      dv.setUint32(28, crc32(comp), true);
      const pad = new Uint8Array(align8(at) - at);
      at += pad.length;
      parts.push(pad, head, comp);
      dir.push({ offset: at, env, t0, n, clen: comp.length, ulen: payload.length, codec: head[4] });
      at += 32 + comp.length;
    }
  }
  const finalize = o.finalize !== false;
  const dirBytes = new Uint8Array(32 * dir.length);
  const ddv = new DataView(dirBytes.buffer);
  dir.forEach((d, i) => {
    ddv.setBigUint64(32 * i, BigInt(d.offset), true);
    ddv.setUint32(32 * i + 8, d.env, true);
    ddv.setUint32(32 * i + 12, d.t0, true);
    ddv.setUint32(32 * i + 16, d.n, true);
    ddv.setUint32(32 * i + 20, d.clen, true);
    ddv.setUint32(32 * i + 24, d.ulen, true);
    dirBytes[32 * i + 28] = d.codec;
  });
  const header = new Uint8Array(64);
  const hdv = new DataView(header.buffer);
  header.set([0x53, 0x53, 0x42, 0x4b]); // SSBK
  hdv.setUint16(4, 1, true);
  hdv.setUint32(8, 64, true);
  hdv.setUint32(12, itemShape.length, true);
  itemShape.forEach((s, i) => hdv.setUint32(16 + 4 * i, s, true));
  hdv.setUint32(32, nEnvs, true);
  hdv.setUint32(36, finalize ? nFrames : 0, true);
  hdv.setUint32(40, blockFrames, true);
  if (finalize) {
    const dirOffset = align8(at);
    hdv.setUint32(44, dir.length, true);
    hdv.setBigUint64(48, BigInt(dirOffset), true);
    hdv.setUint32(56, dirBytes.length, true);
    parts.push(new Uint8Array(dirOffset - at), dirBytes);
  }
  hdv.setUint32(60, crc32(header.subarray(0, 60)), true);
  return concat([header, ...parts]);
}

/**
 * Encode a mesh blob. `codec` is "raw" or "q16". `verts` Float32Array [nv*3],
 * `faces` Uint32Array [nf*3], optional `normals` (raw only), `uvs` [nv*2].
 */
export function encodeMesh({ verts, faces, normals = null, uvs = null, codec = "raw" }) {
  const nv = verts.length / 3, nf = faces.length / 3;
  let payload;
  let flags = 0;
  if (codec === "raw") {
    if (normals) flags |= 1;
    if (uvs) flags |= 2;
    payload = concat(
      [verts, faces, normals, uvs]
        .filter(Boolean)
        .map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength)),
    );
  } else {
    if (uvs) flags |= 2;
    const quant = (arr, axes) => {
      const lo = new Float32Array(axes), step = new Float32Array(axes);
      const planes = [new Uint8Array(axes * nv), new Uint8Array(axes * nv)];
      for (let a = 0; a < axes; a++) {
        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < nv; i++) {
          mn = Math.min(mn, arr[i * axes + a]);
          mx = Math.max(mx, arr[i * axes + a]);
        }
        lo[a] = mn;
        step[a] = mx === mn ? 0 : Math.fround((mx - Math.fround(mn)) / 65535);
        let prev = 0;
        for (let i = 0; i < nv; i++) {
          const q = step[a] === 0 ? 0 : Math.min(65535, Math.max(0, Math.round((arr[i * axes + a] - lo[a]) / step[a])));
          const d = (q - prev) & 0xffff;
          prev = q;
          planes[0][a * nv + i] = d & 0xff;
          planes[1][a * nv + i] = d >>> 8;
        }
      }
      return { lo, step, planes };
    };
    const v = quant(verts, 3);
    const fplanes = [0, 1, 2, 3].map(() => new Uint8Array(3 * nf));
    let prev = 0;
    for (let i = 0; i < 3 * nf; i++) {
      const d = (faces[i] - prev) >>> 0;
      prev = faces[i];
      for (let b = 0; b < 4; b++) fplanes[b][i] = (d >>> (8 * b)) & 0xff;
    }
    const chunks = [new Uint8Array(v.lo.buffer), new Uint8Array(v.step.buffer), ...v.planes, ...fplanes];
    if (uvs) {
      const u = quant(uvs, 2);
      chunks.push(new Uint8Array(u.lo.buffer), new Uint8Array(u.step.buffer), ...u.planes);
    }
    payload = concat(chunks);
  }
  const comp = deflate(payload);
  const head = new Uint8Array(32);
  const dv = new DataView(head.buffer);
  head.set([0x53, 0x53, 0x4d, 0x48]); // SSMH
  dv.setUint16(4, 1, true);
  dv.setUint32(8, nv, true);
  dv.setUint32(12, nf, true);
  dv.setUint32(16, flags, true);
  head[20] = codec === "raw" ? 0 : 1;
  dv.setUint32(24, payload.length, true);
  dv.setUint32(28, crc32(comp), true);
  return concat([head, comp]);
}

/** Encode a pack from `{path: Uint8Array | string | object}` (objects -> JSON). */
export function encodePack(files) {
  const enc = new TextEncoder();
  const parts = [];
  const entries = [];
  let at = 32;
  for (const [path, value] of Object.entries(files)) {
    const bytes = value instanceof Uint8Array ? value : enc.encode(typeof value === "string" ? value : JSON.stringify(value));
    const pad = align8(at) - at;
    parts.push(new Uint8Array(pad), bytes);
    at += pad;
    entries.push({ path, offset: at, length: bytes.length });
    at += bytes.length;
  }
  const dirBytes = enc.encode(JSON.stringify({ entries }));
  const pad = align8(at) - at;
  const header = new Uint8Array(32);
  const dv = new DataView(header.buffer);
  header.set([0x53, 0x53, 0x50, 0x4b]); // SSPK
  dv.setUint16(4, 1, true);
  dv.setUint32(8, entries.length, true);
  dv.setBigUint64(16, BigInt(at + pad), true);
  dv.setUint32(24, dirBytes.length, true);
  dv.setUint32(28, crc32(dirBytes), true);
  return concat([header, ...parts, new Uint8Array(pad), dirBytes]);
}

export { crc32 as zlibCrc32 };
