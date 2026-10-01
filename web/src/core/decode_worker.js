// The decode worker: block and mesh decoding off the main thread.
//
// `handle()` is the whole protocol, a pure async function over plain
// messages, so tests call it directly and the main thread can fall back to
// running it in-process when a worker cannot be created. The worker entry
// (the bottom of this file) is bundled into a string by build/player.mjs,
// committed as decode_worker.generated.js, and started from a Blob URL, which
// is what lets exports run from file:// with no separate worker file.
//
// Messages (structured clone, buffers transferred):
//   {id, op: "blocks", blocks: ArrayBuffer[], itemK, pose}
//        -> {id, ok: true, arrays: ArrayBuffer[]}   one [n, K] f32 per block
//   {id, op: "window", blocks: ArrayBuffer[], itemK, pose}
//        -> {id, ok: true, data: ArrayBuffer, n}    one [n, blocks, K] f32: frame-major, env in block order
//   {id, op: "mesh", bytes: ArrayBuffer}
//        -> {id, ok: true, mesh: {verts, faces, normals, uvs, nVerts, nFaces}}
//   failures -> {id, ok: false, error: string}

import * as fmt from "./format.js";

/** Decode every raw SSBB block in `msg.blocks`; returns the reply and its transfer list. */
async function decodeBlocks(msg) {
  const arrays = await Promise.all(
    msg.blocks.map((buf) => {
      const bytes = new Uint8Array(buf);
      return fmt.decodeBlock({ bytes, itemK: msg.itemK }, { offset: 0 }, { pose: !!msg.pose });
    }),
  );
  const buffers = arrays.map((a) => a.buffer);
  return { reply: { ok: true, arrays: buffers }, transfer: buffers };
}

// Blocks decoded at once inside one window job: bounds the inflate streams alive.
const WINDOW_CHUNK = 256;

/**
 * Decode all blocks of one window into one dense `[n, E, K]` array, so that
 * a frame of every env is contiguous (the crowd tier reads one root pose per
 * env per frame; thousands of separate typed arrays would cost a cache miss each).
 */
async function decodeWindow(msg) {
  const E = msg.blocks.length, K = msg.itemK;
  let out = null, n = 0;
  for (let at = 0; at < E; at += WINDOW_CHUNK) {
    const chunk = msg.blocks.slice(at, at + WINDOW_CHUNK);
    const arrays = await Promise.all(chunk.map((buf) => fmt.decodeBlock({ bytes: new Uint8Array(buf), itemK: K }, { offset: 0 }, { pose: !!msg.pose })));
    if (!out) {
      n = arrays[0].length / K;
      out = new Float32Array(n * E * K);
    }
    arrays.forEach((a, i) => {
      if (a.length !== n * K) throw new Error("blocks of one window differ in length");
      const env = at + i;
      for (let t = 0; t < n; t++) out.set(a.subarray(t * K, (t + 1) * K), (t * E + env) * K);
    });
  }
  return { reply: { ok: true, data: out.buffer, n }, transfer: [out.buffer] };
}

async function decodeMesh(msg) {
  const mesh = await fmt.decodeMesh(new Uint8Array(msg.bytes));
  const transfer = [mesh.verts.buffer, mesh.faces.buffer, mesh.normals.buffer];
  if (mesh.uvs) transfer.push(mesh.uvs.buffer);
  return { reply: { ok: true, mesh }, transfer: [...new Set(transfer)] };
}

/** Handle one request message. Never throws: failures come back as `{ok: false}`. */
export async function handle(msg) {
  try {
    if (msg.op === "blocks") return await decodeBlocks(msg);
    if (msg.op === "window") return await decodeWindow(msg);
    if (msg.op === "mesh") return await decodeMesh(msg);
    return { reply: { ok: false, error: `unknown op ${msg.op}` }, transfer: [] };
  } catch (err) {
    return { reply: { ok: false, error: err && err.message ? err.message : String(err) }, transfer: [] };
  }
}

// ---- worker entry ----

if (typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage = async (e) => {
    const { id } = e.data;
    const { reply, transfer } = await handle(e.data);
    self.postMessage({ id, ...reply }, transfer);
  };
}
