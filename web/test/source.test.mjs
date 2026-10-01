import assert from "node:assert/strict";
import test from "node:test";

import { HttpSource, PackSource, parseBlkPrefix, SourceError } from "../src/core/source.js";
import { encodeBlk } from "./encoder.mjs";
import { makeRunPack, poseData } from "./fixtures.mjs";

const gz = async (bytes) => {
  const { gzipSync } = await import("node:zlib");
  return new Uint8Array(gzipSync(bytes));
};

// ---- PackSource ----

test("PackSource: get, runs, blockIndex, blocks", async () => {
  const { pack } = makeRunPack({ T: 250, E: 3, B: 2, run: "walk", files: { "runs/other/rollout.json": { format: "simscope-rollout/1" } } });
  const s = new PackSource(pack);
  assert.deepEqual((await s.runs()).sort(), ["other", "walk"]);
  assert.equal(s.has("runs/walk/rollout.json"), true);
  assert.equal((await s.get("runs/walk/rollout.json")).length > 10, true);
  const idx = await s.blockIndex("runs/walk/body_pose.blk");
  assert.deepEqual([idx.nEnvs, idx.nFrames, idx.blockFrames, idx.itemK], [3, 250, 100, 14]);
  assert.equal(idx.blocks.length, 9);
  assert.equal("bytes" in idx, false, "the directory carries no block bytes");
  const blocks = await s.blocks("runs/walk/body_pose.blk", 2, [2, 0]);
  assert.equal(blocks.length, 2);
  for (const b of blocks) {
    assert.equal(String.fromCharCode(...b.subarray(0, 4)), "SSBB");
    assert.equal(b.byteOffset, 0, "a copy, not a view into the pack");
    assert.equal(b.buffer.byteLength, b.length);
  }
  assert.equal(new DataView(blocks[0].buffer).getUint32(8, true), 2, "env order as asked");
});

test("PackSource: absent entries and windows reject with status 404", async () => {
  const s = new PackSource(makeRunPack({ T: 100, E: 1 }).pack);
  await assert.rejects(s.get("runs/r/nope.json"), (e) => e instanceof SourceError && e.status === 404);
  await assert.rejects(s.blockIndex("runs/r/nope.blk"), (e) => e.status === 404);
  await assert.rejects(s.blocks("runs/r/body_pose.blk", 5, [0]), (e) => e.status === 404);
  await assert.rejects(s.blocks("runs/r/body_pose.blk", 0, [3]), (e) => e.status === 404);
});

test("PackSource.open accepts a gzip-wrapped pack; the constructor takes an ArrayBuffer too", async () => {
  const { pack } = makeRunPack({ T: 100, E: 1 });
  const s = await PackSource.open(await gz(pack));
  assert.deepEqual(await s.runs(), ["r"]);
  const t = new PackSource(pack.buffer.slice(pack.byteOffset, pack.byteOffset + pack.byteLength));
  assert.deepEqual(await t.runs(), ["r"]);
  assert.throws(() => new PackSource(new Uint8Array(40)), /simscope/);
});

// ---- HttpSource against a stubbed fetch ----

function stubFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const r = await routes(String(url), calls.length);
    return new Response(r.body ?? null, { status: r.status ?? 200, headers: r.headers ?? {} });
  };
  return calls;
}

test("HttpSource.get: bytes from /files/<path>; 404 is a SourceError(404)", async () => {
  const calls = stubFetch((url) => (url.endsWith("rollout.json") ? { body: "{}" } : { status: 404 }));
  const s = new HttpSource("http://h/");
  assert.equal(new TextDecoder().decode(await s.get("runs/a/rollout.json")), "{}");
  assert.equal(calls[0], "http://h/files/runs/a/rollout.json");
  await assert.rejects(s.get("derived/a/highlights.json"), (e) => e instanceof SourceError && e.status === 404);
});

test("HttpSource.get: 202 retries until the file is ready (derived files)", async () => {
  let n = 0;
  stubFetch(() => (++n < 3 ? { status: 202, headers: { "Retry-After": "0" } } : { body: "ok" }));
  const s = new HttpSource("");
  const t0 = Date.now();
  assert.equal(new TextDecoder().decode(await s.get("derived/a/summaries.json")), "ok");
  assert.equal(n, 3);
  assert.ok(Date.now() - t0 < 2000, "backoff starts small");
});

test("HttpSource.get: other errors keep their status; network failure is status 0", async () => {
  stubFetch(() => ({ status: 500 }));
  await assert.rejects(new HttpSource("").get("x"), (e) => e.status === 500);
  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  await assert.rejects(new HttpSource("").get("x"), (e) => e.status === 0 && /offline/.test(e.message));
});

test("HttpSource.get: immutable CAS paths are fetched once", async () => {
  const calls = stubFetch(() => ({ body: "mesh" }));
  const s = new HttpSource("");
  const [a, b] = await Promise.all([s.get("assets/ab/abcdef"), s.get("assets/ab/abcdef")]);
  assert.equal(a, b);
  await s.get("scenes/ab/abcdef.json");
  await s.get("scenes/ab/abcdef.json");
  assert.equal(calls.length, 2);
  await s.get("runs/a/rollout.json");
  await s.get("runs/a/rollout.json");
  assert.equal(calls.length, 4, "mutable paths are never cached");
});

/** What /api/blk returns: the 64-byte header followed by the directory (a file-shaped prefix). */
function blkPrefix(file, { live = false } = {}) {
  const header = file.slice(0, 64);
  const dv = new DataView(header.buffer, header.byteOffset, 64);
  const dirOffset = Number(dv.getBigUint64(48, true)), dirLength = dv.getUint32(56, true);
  const dir = file.slice(dirOffset, dirOffset + dirLength);
  // A synthesized prefix: header with dir_offset = 64.
  dv.setBigUint64(48, 64n, true);
  dv.setUint32(60, 0, true); // CRC is not checked on this path
  void live;
  const out = new Uint8Array(64 + dir.length);
  out.set(header);
  out.set(dir, 64);
  return out;
}

test("parseBlkPrefix: header + directory, from either a finished or a synthesized header", () => {
  const file = encodeBlk({ itemShape: [2, 7], nEnvs: 2, nFrames: 250, blockFrames: 100, data: poseData(250, 2, 2) });
  const idx = parseBlkPrefix(blkPrefix(file));
  assert.deepEqual([idx.nEnvs, idx.nFrames, idx.blockFrames, idx.itemK, idx.blocks.length], [2, 250, 100, 14, 6]);
  assert.deepEqual(idx.blocks.map((b) => [b.t0, b.env]), [[0, 0], [0, 1], [100, 0], [100, 1], [200, 0], [200, 1]]);
  // A recording file: header says n_frames 0 and no directory; frames come from the entries.
  const header = file.slice(0, 64);
  const dv = new DataView(header.buffer, header.byteOffset, 64);
  dv.setUint32(36, 0, true);
  dv.setUint32(44, 0, true);
  dv.setBigUint64(48, 0n, true);
  dv.setUint32(56, 0, true);
  const dirOffset = Number(new DataView(file.buffer, file.byteOffset).getBigUint64(48, true));
  const live = new Uint8Array(64 + 4 * 32);
  live.set(header);
  live.set(file.slice(dirOffset, dirOffset + 4 * 32), 64);
  const li = parseBlkPrefix(live);
  assert.equal(li.blocks.length, 4);
  assert.equal(li.nFrames, 200, "frames covered by complete windows");
  assert.throws(() => parseBlkPrefix(new Uint8Array(64)), /block file header/);
});

test("HttpSource.blockIndex is cached until refresh; blocks splits at 256 envs and cuts the body by the length header", async () => {
  const file = encodeBlk({ itemShape: [], nEnvs: 2, nFrames: 100, blockFrames: 100, data: Float32Array.from({ length: 200 }, (_, i) => i) });
  let index = 0;
  const calls = stubFetch((url) => {
    if (url.includes("/api/blk")) {
      index++;
      return { body: blkPrefix(file) };
    }
    const envs = new URL(url).searchParams.get("envs").split(",").map(Number);
    const parts = envs.map((e) => new Uint8Array(10 + (e % 5)).fill(e % 250));
    const body = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of parts) {
      body.set(p, o);
      o += p.length;
    }
    return { body, headers: { "X-Simscope-Block-Lengths": parts.map((p) => p.length).join(",") } };
  });
  const s = new HttpSource("http://h");
  await s.blockIndex("runs/a/s.blk");
  await s.blockIndex("runs/a/s.blk");
  assert.equal(index, 1);
  await s.blockIndex("runs/a/s.blk", { refresh: true });
  assert.equal(index, 2);
  assert.match(calls[0], /\/api\/blk\?path=runs%2Fa%2Fs\.blk/);
  calls.length = 0;
  const envs = Array.from({ length: 600 }, (_, i) => (i * 7) % 600);
  const out = await s.blocks("runs/a/s.blk", 3, envs);
  assert.equal(calls.length, 3, "256 + 256 + 88 envs");
  assert.ok(calls.every((c) => /w=3&envs=/.test(c)));
  assert.equal(out.length, 600);
  out.forEach((b, i) => {
    assert.equal(b.length, 10 + (envs[i] % 5), `block ${i} length`);
    assert.ok(b.every((v) => v === envs[i] % 250), `block ${i} content is in the order asked`);
  });
});

test("HttpSource.blocks: a window the server has not written is a 404; a wrong length header is an error", async () => {
  stubFetch(() => ({ status: 404 }));
  await assert.rejects(new HttpSource("").blocks("p.blk", 0, [0]), (e) => e.status === 404);
  stubFetch(() => ({ body: new Uint8Array(4), headers: { "X-Simscope-Block-Lengths": "2,2" } }));
  await assert.rejects(new HttpSource("").blocks("p.blk", 0, [0]), /block lengths/);
});

test("HttpSource.runs lists names from /api/runs", async () => {
  stubFetch(() => ({ body: JSON.stringify({ seq: 1, runs: [{ name: "a" }, { name: "b" }] }) }));
  assert.deepEqual(await new HttpSource("").runs(), ["a", "b"]);
});
