import assert from "node:assert/strict";
import test from "node:test";

import { BlockStore, ByteLRU, makeStream } from "../src/core/cache.js";
import { PackSource } from "../src/core/source.js";
import { makeRunPack } from "./fixtures.mjs";

test("ByteLRU: evicts the least recently used past the byte budget", () => {
  const c = new ByteLRU(100);
  c.set("a", 1, 40);
  c.set("b", 2, 40);
  assert.equal(c.bytes, 80);
  c.get("a"); // a is now newer than b
  c.set("c", 3, 40);
  assert.equal(c.has("b"), false, "b was the oldest");
  assert.equal(c.has("a"), true);
  assert.equal(c.has("c"), true);
  assert.equal(c.bytes, 80);
});

test("ByteLRU: replacing a key re-counts its bytes; peek does not refresh; delete frees", () => {
  const c = new ByteLRU(100);
  c.set("a", 1, 60);
  c.set("a", 2, 10);
  assert.equal(c.bytes, 10);
  c.set("b", 3, 50);
  c.set("c", 4, 50);
  c.peek("a"); // must not protect it
  assert.equal(c.has("a"), false);
  assert.equal(c.delete("b"), true);
  assert.equal(c.bytes, 50);
  assert.equal(c.delete("zzz"), false);
  c.clear();
  assert.equal(c.bytes, 0);
  assert.equal(c.size, 0);
});

test("ByteLRU: one entry bigger than the budget is kept alone, not evicted on arrival", () => {
  const c = new ByteLRU(10);
  c.set("a", 1, 5);
  c.set("big", 2, 50);
  assert.equal(c.has("big"), true);
  assert.equal(c.has("a"), false);
  assert.equal(c.bytes, 50);
});

async function store(opts) {
  const { pack, data } = makeRunPack(opts);
  const source = new PackSource(pack);
  const index = await source.blockIndex("runs/r/body_pose.blk");
  return { source, stream: makeStream(1, "runs/r/body_pose.blk", index, false), data, store: new BlockStore(source) };
}

test("BlockStore decodes requested envs once and serves them synchronously", async () => {
  const { stream, store: s, data } = await store({ T: 250, E: 3, B: 2 });
  assert.equal(stream.nWindows, 3);
  assert.equal(s.get(stream, 0, 1), undefined);
  await s.request(stream, 0, [1, 2]);
  assert.equal(s.ready(stream, 0, [1, 2]), true);
  assert.equal(s.ready(stream, 0, [0, 1]), false);
  const a = s.get(stream, 0, 2);
  const K = 2 * 7, E = 3;
  assert.equal(a.length, 100 * K);
  for (const t of [0, 57, 99]) for (let k = 0; k < K; k++) assert.equal(a[t * K + k], data[(t * E + 2) * K + k]);
  // the last window is short
  await s.request(stream, 2, [0]);
  assert.equal(s.get(stream, 2, 0).length, 50 * K);
  assert.ok(s.bytes > 0);
});

test("BlockStore: concurrent requests for the same window share one fetch", async () => {
  const { source, stream, store: s } = await store({ T: 100, E: 4, B: 2 });
  let calls = 0;
  const real = source.blocks.bind(source);
  source.blocks = (...args) => {
    calls++;
    return real(...args);
  };
  await Promise.all([s.request(stream, 0, [0, 1]), s.request(stream, 0, [1, 2]), s.request(stream, 0, [0, 1, 2])]);
  assert.equal(calls, 2, "the second call only asked for the env that was not in flight (2)");
  assert.equal(s.ready(stream, 0, [0, 1, 2]), true);
  await s.request(stream, 0, [0, 1, 2]);
  assert.equal(calls, 2, "nothing more once cached");
});

test("BlockStore: epoch bumps when data lands, pending counts jobs, errors reject and clean up", async () => {
  const { source, stream, store: s } = await store({ T: 100, E: 2, B: 2 });
  const e0 = s.epoch;
  const pendings = [];
  s.onChange = (p) => pendings.push(p);
  await s.request(stream, 0, [0]);
  assert.ok(s.epoch > e0);
  assert.deepEqual(pendings, [1, 0]);
  source.blocks = async () => {
    throw new Error("window not written");
  };
  await assert.rejects(s.request(stream, 0, [1]), /window not written/);
  assert.equal(s.pending, 0);
  assert.equal(s.inflight.size, 0, "a failed fetch can be retried");
});

test("BlockStore: requests outside the stream resolve quietly; the LRU bounds memory", async () => {
  const { source, stream } = await store({ T: 300, E: 2, B: 2 });
  const tiny = new BlockStore(source, 100 * 14 * 4 * 2 + 10); // room for ~2 env-windows
  await tiny.request(stream, 99, [0]);
  await tiny.request(stream, -1, [0]);
  await tiny.request(stream, 0, [0, 1]);
  await tiny.request(stream, 1, [0, 1]);
  assert.ok(tiny.bytes <= 100 * 14 * 4 * 2 + 10);
  assert.equal(tiny.has(stream, 1, 1), true, "newest kept");
  assert.equal(tiny.has(stream, 0, 0), false, "oldest evicted");
});
