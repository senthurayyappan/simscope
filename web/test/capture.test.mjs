// Capturing the viewport: images at a chosen size, and a run drawn frame by frame for a GIF.
import assert from "node:assert/strict";
import test from "node:test";

import { Clock, H, pane, W } from "./headless.mjs";

/** A stand-in for the offscreen renderer that records what each frame showed. */
function fakeOffscreen() {
  const log = { frames: [], blobs: [], disposed: 0 };
  const make = () => ({
    maxSize: 4096,
    pixels(player, w, h) {
      log.frames.push({ t: player.clock.time, w, h, x: player.r.parts[0].poses[7], playing: player.clock.playing, ignored: player.update(1) });
      return new Uint8ClampedArray(w * h * 4);
    },
    blob(player, w, h, type) {
      log.blobs.push({ w, h, type });
      return Promise.resolve(new Blob(["x"], { type }));
    },
    dispose() {
      log.disposed++;
    },
  });
  return { log, make };
}

async function loaded() {
  const clock = new Clock();
  const fake = fakeOffscreen();
  const p = await pane(clock, { run: "a", start: [0, 0, 0.28], vel: [0.6, 0, 0] }, { offscreen: fake.make });
  return { clock, p, ...fake };
}

test("captureSize: scale of the viewport, a width at its shape, and a cap", async () => {
  const { p } = await loaded();
  assert.deepEqual(p.captureSize(), { width: W, height: H });
  assert.deepEqual(p.captureSize({ scale: 2 }), { width: 2 * W, height: 2 * H });
  assert.deepEqual(p.captureSize({ width: 200 }), { width: 200, height: 150 });
  p.resize(W, H, 2);
  assert.deepEqual(p.captureSize({ scale: 2 }), { width: 4 * W, height: 4 * H });
  const huge = p.captureSize({ scale: 100 });
  assert.equal(Math.max(huge.width, huge.height), 8192);
  assert.ok(Math.abs(huge.width / huge.height - W / H) < 0.01, "the shape is kept");
});

test("snapshot with a scale draws again at that size", async () => {
  const { p, log } = await loaded();
  const blob = await p.snapshot("image/png", { scale: 3 });
  assert.equal(blob.type, "image/png");
  assert.deepEqual(log.blobs, [{ w: 3 * W, h: 3 * H, type: "image/png" }]);
  assert.equal(log.disposed, 1);
  await p.snapshot("image/png", { scale: 100 });
  assert.equal(Math.max(log.blobs[1].w, log.blobs[1].h), 4096, "capped to what the GPU allows");
});

test("captureFrames draws the run at t0 + i / fps, then puts the clock back", async () => {
  const { p, clock, log } = await loaded();
  clock.seek(1.2);
  const seen = [];
  for await (const f of p.captureFrames({ t0: 0.5, t1: 1.5, fps: 10, width: 200 })) seen.push(f);
  assert.equal(seen.length, 10);
  assert.deepEqual(seen.map((f) => f.index), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(seen.every((f) => f.count === 10 && f.width === 200 && f.height === 150 && f.data.length === 200 * 150 * 4));
  seen.forEach((f, i) => assert.ok(Math.abs(f.t - (0.5 + i / 10)) < 1e-9));
  seen.forEach((f, i) => assert.ok(Math.abs(log.frames[i].t - f.t) < 1e-9, "each frame is drawn at its own time"));
  const xs = log.frames.map((f) => f.x);
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), "the robot moves between frames");
  assert.ok(log.frames.every((f) => f.ignored === false), "the live loop leaves the player alone during a capture");
  assert.equal(clock.time, 1.2);
  assert.equal(log.disposed, 1);
  assert.equal(p._capturing, false);
});

test("captureFrames pauses a playing clock and starts it again after", async () => {
  const { p, clock, log } = await loaded();
  clock.play();
  for await (const f of p.captureFrames({ t0: 0, t1: 0.3, fps: 10, width: 100 })) assert.ok(f);
  assert.ok(log.frames.every((f) => !f.playing));
  assert.equal(clock.playing, true);
});

test("captureFrames stops on abort and still cleans up", async () => {
  const { p, clock, log } = await loaded();
  clock.seek(0.4);
  const ctl = new AbortController();
  let n = 0;
  await assert.rejects(async () => {
    for await (const f of p.captureFrames({ t0: 0, t1: 2, fps: 10, width: 100, signal: ctl.signal })) {
      assert.ok(f);
      if (++n === 3) ctl.abort();
    }
  }, { name: "AbortError" });
  assert.equal(n, 3);
  assert.equal(clock.time, 0.4);
  assert.equal(log.disposed, 1);
  assert.equal(p._capturing, false);
});

test("captureFrames stops early when the consumer stops", async () => {
  const { p, log } = await loaded();
  for await (const f of p.captureFrames({ t0: 0, t1: 2, fps: 10, width: 100 })) {
    assert.ok(f);
    break;
  }
  assert.equal(log.disposed, 1);
  assert.equal(p._capturing, false);
});

test("captureFrames refuses a second capture and a bad stretch", async () => {
  const { p } = await loaded();
  await assert.rejects(p.captureFrames({ t0: 1, t1: 1 }).next(), /t1 > t0/);
  const first = p.captureFrames({ t0: 0, t1: 1, fps: 10, width: 100 });
  await first.next();
  await assert.rejects(p.captureFrames({ t0: 0, t1: 1 }).next(), /already running/);
  await first.return();
});
