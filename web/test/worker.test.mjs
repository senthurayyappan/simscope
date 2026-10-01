// The decode worker's protocol, run in-process (the worker entry is the same
// `handle()` function) and through the main-thread decoder's fallback path.

import assert from "node:assert/strict";
import test from "node:test";

import { decodeBlocks, decodeMeshBlob, decoder } from "../src/core/decode.js";
import { handle } from "../src/core/decode_worker.js";
import * as fmt from "../src/core/format.js";
import { PackSource } from "../src/core/source.js";
import { encodeMesh } from "./encoder.mjs";
import { makeRunPack } from "./fixtures.mjs";

const bits = (f32) => Array.from(new Uint32Array(f32.buffer, f32.byteOffset, f32.length));

async function blocksOf(opts, w, envs) {
  const { pack, data } = makeRunPack(opts);
  const source = new PackSource(pack);
  return { blocks: await source.blocks("runs/r/body_pose.blk", w, envs), data };
}

test("blocks op: decodes every block to the same floats as format.decodeBlock", async () => {
  const { blocks, data } = await blocksOf({ T: 150, E: 3, B: 2 }, 1, [2, 0]);
  const K = 14;
  const { reply, transfer } = await handle({ op: "blocks", blocks: blocks.map((b) => b.buffer), itemK: K, pose: false });
  assert.equal(reply.ok, true);
  assert.equal(reply.arrays.length, 2);
  assert.equal(transfer.length, 2, "buffers are listed for transfer");
  const [a, b] = reply.arrays.map((buf) => new Float32Array(buf));
  assert.equal(a.length, 50 * K, "window 1 is short (frames 100..149)");
  for (const [arr, env] of [[a, 2], [b, 0]]) {
    for (const t of [0, 10, 49]) {
      const want = data.subarray(((100 + t) * 3 + env) * K, ((100 + t) * 3 + env + 1) * K);
      assert.deepEqual(bits(arr.subarray(t * K, (t + 1) * K)), bits(want));
    }
  }
});

test("blocks op: q16d poses are renormalized when asked", async () => {
  const { blocks } = await blocksOf({ T: 100, E: 1, B: 2, codec: "q16d" }, 0, [0]);
  const { reply } = await handle({ op: "blocks", blocks: blocks.map((b) => b.buffer), itemK: 14, pose: true });
  const x = new Float32Array(reply.arrays[0]);
  for (let t = 0; t < 100; t++) {
    const o = t * 14 + 3;
    assert.ok(Math.abs(Math.hypot(x[o], x[o + 1], x[o + 2], x[o + 3]) - 1) < 1e-6);
  }
});

test("blocks op: a corrupt block is an error reply, not a throw", async () => {
  const { blocks } = await blocksOf({ T: 100, E: 1, B: 2 }, 0, [0]);
  const bad = blocks[0].slice();
  bad[bad.length - 3] ^= 0xff; // flip payload bits: CRC mismatch
  const { reply, transfer } = await handle({ op: "blocks", blocks: [bad.buffer], itemK: 14, pose: false });
  assert.equal(reply.ok, false);
  assert.match(reply.error, /CRC|simscope/);
  assert.deepEqual(transfer, []);
});

test("unknown ops are rejected", async () => {
  const { reply } = await handle({ op: "nope" });
  assert.equal(reply.ok, false);
  assert.match(reply.error, /unknown op/);
});

test("mesh op: decodes raw and q16 meshes and lists the buffers to transfer", async () => {
  const verts = Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1);
  const faces = Uint32Array.of(0, 1, 2, 0, 1, 3, 0, 2, 3, 1, 2, 3);
  for (const codec of ["raw", "q16"]) {
    const bytes = encodeMesh({ verts, faces, codec });
    const { reply, transfer } = await handle({ op: "mesh", bytes: bytes.slice().buffer });
    assert.equal(reply.ok, true, codec);
    assert.equal(reply.mesh.nVerts, 4);
    assert.equal(reply.mesh.nFaces, 4);
    assert.deepEqual(Array.from(reply.mesh.faces), Array.from(faces));
    assert.ok(transfer.includes(reply.mesh.verts.buffer));
    assert.equal(new Set(transfer).size, transfer.length, "no buffer listed twice");
  }
});

test("the decoder client (in-process fallback without Worker) matches and keeps its queue honest", async () => {
  assert.equal(decoder.threaded, false, "Node has no Worker: decoding falls back to the main thread");
  const { blocks, data } = await blocksOf({ T: 100, E: 4, B: 2 }, 0, [0, 1, 2, 3]);
  const arrays = await decodeBlocks(blocks, 14, false);
  assert.equal(arrays.length, 4);
  assert.deepEqual(bits(arrays[3].subarray(0, 14)), bits(data.subarray((0 * 4 + 3) * 14, (0 * 4 + 3 + 1) * 14)));
  // More jobs than the cap of 8: all finish, none is lost or reordered.
  const fresh = await blocksOf({ T: 100, E: 1, B: 2 }, 0, [0]);
  const jobs = Array.from({ length: 30 }, () => decodeBlocks(fresh.blocks.map((b) => b.slice()), 14, false));
  assert.ok(decoder.inFlight <= 8);
  const all = await Promise.all(jobs);
  assert.equal(all.length, 30);
  assert.equal(decoder.pending, 0);
  await assert.rejects(decodeBlocks([new Uint8Array(40)], 14, false), /simscope/);
});

test("decodeMeshBlob copies its input: the caller's cached bytes stay usable", async () => {
  const verts = Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0);
  const bytes = encodeMesh({ verts, faces: Uint32Array.of(0, 1, 2), codec: "raw" });
  const mesh = await decodeMeshBlob(bytes);
  assert.equal(mesh.nVerts, 3);
  assert.equal(bytes.buffer.byteLength > 0, true, "the original buffer was not transferred away");
  assert.equal((await fmt.decodeMesh(bytes)).nFaces, 1);
});
