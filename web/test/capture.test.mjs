// Capturing the viewport: images at a chosen size, and a run drawn frame by frame for a GIF.
import assert from "node:assert/strict";
import test from "node:test";

import { Clock, H, pane, W } from "./headless.mjs";

/** A stand-in for the offscreen renderer that records what each frame showed. */
function fakeOffscreen() {
  const log = { frames: [], blobs: [], disposed: 0 };
  const make = () => ({
    maxSize: 4096,
    pixels(player, w, h, camera) {
      log.frames.push({ t: player.clock.time, w, h, camera, x: player.r.parts[0].poses[7], playing: player.clock.playing, ignored: player.update(1) });
      return new Uint8ClampedArray(w * h * 4);
    },
    blob(player, w, h, type, camera) {
      log.blobs.push({ w, h, type, camera });
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

test("captureSize: a width in a shape, whatever the pane is, with a cap", async () => {
  const { p } = await loaded();
  assert.deepEqual(p.captureSize(), { width: W, height: H }, "the pane's own size by default");
  assert.deepEqual(p.captureSize({ width: 1920, aspect: 16 / 9 }), { width: 1920, height: 1080 });
  assert.deepEqual(p.captureSize({ width: 1600, aspect: 4 / 3 }), { width: 1600, height: 1200 });
  assert.deepEqual(p.captureSize({ width: 1440, aspect: 1 }), { width: 1440, height: 1440 });
  assert.deepEqual(p.captureSize({ aspect: 1 }), { width: W, height: W });
  p.resize(W, H, 2);
  assert.deepEqual(p.captureSize({ width: 1920, aspect: 16 / 9 }), { width: 1920, height: 1080 }, "not tied to the device");
  const huge = p.captureSize({ width: 100000, aspect: 16 / 9 });
  assert.equal(Math.max(huge.width, huge.height), 8192);
  assert.ok(Math.abs(huge.width / huge.height - 16 / 9) < 0.01, "the shape is kept");
});

test("snapshot draws again at a width and shape", async () => {
  const { p, log } = await loaded();
  const blob = await p.snapshot("image/png", { width: 1920, aspect: 16 / 9 });
  assert.equal(blob.type, "image/png");
  assert.deepEqual([log.blobs[0].w, log.blobs[0].h, log.blobs[0].type], [1920, 1080, "image/png"]);
  assert.equal(log.disposed, 1);
  await p.snapshot("image/png", { width: 100000, aspect: 1 });
  assert.equal(Math.max(log.blobs[1].w, log.blobs[1].h), 4096, "capped to what the GPU allows");
});

test("the capture frame is the largest one of its shape that fits in the view, about its centre", async () => {
  const { p, log } = await loaded(); // the pane is 400 x 300, 4:3
  const shown = (cam) => [(cam.right - cam.left) / cam.zoom, (cam.top - cam.bottom) / cam.zoom];
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  await p.snapshot("image/png", { width: 800, aspect: 16 / 9 }); // settles the view's own zoom
  let [vw, vh] = shown(p.rig.camera);
  let [w, h] = shown(log.blobs[0].camera);
  assert.ok(near(w, vw) && near(h, vw / (16 / 9)), "wider than the view: same width, less height");
  await p.snapshot("image/png", { width: 800, aspect: 1 });
  [vw, vh] = shown(p.rig.camera);
  [w, h] = shown(log.blobs[1].camera);
  assert.ok(near(h, vh) && near(w, vh), "narrower than the view: same height, less width");
  await p.snapshot("image/png", { width: 800, aspect: 4 / 3 });
  [vw, vh] = shown(p.rig.camera);
  [w, h] = shown(log.blobs[2].camera);
  assert.ok(near(w, vw) && near(h, vh), "the view's own shape: all of it");
  assert.equal(log.blobs[1].camera.zoom, p.rig.camera.zoom);
  assert.ok(log.blobs[0].camera.position.distanceTo(p.rig.camera.position) < 1e-9, "the same place and direction");
});

test("the ground is sized for the capture frame", async () => {
  const { p, log } = await loaded();
  const seen = [];
  const update = p.ground.update.bind(p.ground);
  p.ground.update = (cx, cy, viewHeight, aspect, up, worldPerPx) => {
    seen.push({ viewHeight, aspect, worldPerPx });
    return update(cx, cy, viewHeight, aspect, up, worldPerPx);
  };
  await p.snapshot("image/png", { width: 1000, aspect: 2 });
  assert.ok(log.blobs.length === 1);
  const last = seen.at(-1);
  assert.equal(last.aspect, 2);
  assert.ok(Math.abs(last.worldPerPx - last.viewHeight / 500) < 1e-12, "metres per output pixel");
});

test("captureFrames draws the run at t0 + i / fps, then puts the clock back", async () => {
  const { p, clock, log } = await loaded();
  clock.seek(1.2);
  const seen = [];
  for await (const f of p.captureFrames({ t0: 0.5, t1: 1.5, fps: 10, width: 200, aspect: 2 })) seen.push(f);
  assert.equal(seen.length, 10);
  assert.deepEqual(seen.map((f) => f.index), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(seen.every((f) => f.count === 10 && f.width === 200 && f.height === 100 && f.data.length === 200 * 100 * 4));
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
