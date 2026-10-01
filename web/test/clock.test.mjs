import assert from "node:assert/strict";
import test from "node:test";

import { Clock, clockFor } from "../src/core/clock.js";

/** Tick a playing clock at `hz` for `seconds` of wall time, starting at rAF time `t0`. */
function run(clock, seconds, hz = 60, t0 = 1000) {
  let now = t0;
  clock.rebase();
  clock.tick(now);
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    now += 1000 / hz;
    clock.tick(now);
  }
  return now;
}

test("a playing clock advances by wall time times speed", () => {
  const c = new Clock();
  c.setDuration(10);
  c.play();
  run(c, 1, 60);
  assert.ok(Math.abs(c.time - 1) < 1e-9, `t = ${c.time}`);
  c.speed = 2;
  run(c, 1, 60, 5000);
  assert.ok(Math.abs(c.time - 3) < 1e-9);
});

test("the first tick after play() does not jump, and idle time is not counted", () => {
  const c = new Clock();
  c.setDuration(10);
  c.play();
  c.tick(5000);
  assert.equal(c.time, 0);
  c.tick(5000 + 1000 / 60);
  assert.ok(Math.abs(c.time - 1 / 60) < 1e-9);
  c.rebase();
  c.tick(99999); // the loop slept; first frame after waking counts nothing
  assert.ok(Math.abs(c.time - 1 / 60) < 1e-9);
});

test("a long stall is capped so the playhead does not leap", () => {
  const c = new Clock();
  c.setDuration(100);
  c.play();
  c.tick(1000);
  c.tick(1000 + 30_000);
  assert.ok(c.time <= 0.25 + 1e-9);
});

test("a non-looping clock stops at the end and says so", () => {
  const c = new Clock();
  c.setDuration(1);
  const seen = [];
  c.addEventListener("ended", () => seen.push("ended"));
  c.addEventListener("state", () => seen.push("state"));
  c.play();
  run(c, 2, 60);
  assert.equal(c.time, 1);
  assert.equal(c.playing, false);
  assert.ok(seen.includes("ended"));
  // play() at the end restarts from 0
  c.play();
  assert.equal(c.time, 0);
  assert.equal(c.playing, true);
});

test("looping wraps past duration + the last frame's dwell", () => {
  const c = new Clock();
  c.claim("a", 1, 0.02);
  c.loop = true;
  c.play();
  run(c, 1.01, 100);
  assert.ok(c.time > 1, `still dwelling on the last frame, t = ${c.time}`);
  run(c, 0.1, 100, 9000);
  assert.ok(c.time < 0.2, `wrapped, t = ${c.time}`);
  assert.equal(c.playing, true);
});

test("loop region wraps inside the region and stops at its end when not looping", () => {
  const c = new Clock();
  c.setDuration(10);
  c.loop = true;
  c.loopRegion = [2, 3];
  c.seek(2);
  c.play();
  run(c, 2.5, 60);
  assert.ok(c.time >= 2 && c.time < 3, `t = ${c.time}`);
  c.loop = false;
  c.seek(2);
  run(c, 2, 60, 9000);
  assert.equal(c.time, 3);
  assert.equal(c.playing, false);
  c.loopRegion = [3, 2];
  assert.equal(c.loopRegion, null, "an empty region is cleared");
});

test("seek clamps and step lands on the frame grid", () => {
  const c = new Clock();
  c.setDuration(1);
  c.seek(-5);
  assert.equal(c.time, 0);
  c.seek(7);
  assert.equal(c.time, 1);
  c.seek(0.503);
  c.step(1, 0.02);
  assert.ok(Math.abs(c.time - 0.52) < 1e-9, `t = ${c.time}`);
  c.step(-2, 0.02);
  assert.ok(Math.abs(c.time - 0.48) < 1e-9);
  c.step(1000, 0.02);
  assert.equal(c.time, 1);
});

test("duration is the max over claims and shrinks when a player releases", () => {
  const c = new Clock();
  const a = {}, b = {};
  c.claim(a, 3, 0.01);
  c.claim(b, 5, 0.02);
  assert.equal(c.duration, 5);
  c.seek(4.5);
  c.release(b);
  assert.equal(c.duration, 3);
  assert.equal(c.time, 3, "time is clamped into the shorter timeline");
  c.setDuration(8);
  assert.equal(c.duration, 8);
});

test("a hold stalls a playing clock until released", () => {
  const c = new Clock();
  c.setDuration(10);
  const p = {};
  c.play();
  c.tick(1000);
  c.hold(p, true);
  c.tick(1500);
  c.tick(2000);
  assert.equal(c.time, 0);
  c.hold(p, false);
  c.tick(2016.6667);
  assert.ok(c.time > 0 && c.time < 0.02, "the stall is not banked");
});

test("events: time on seek and tick, state on play/pause/speed", () => {
  const c = new Clock();
  c.setDuration(2);
  const log = [];
  c.addEventListener("time", (e) => log.push(["time", e.detail.t]));
  c.addEventListener("state", () => log.push(["state"]));
  c.seek(1);
  c.speed = 2;
  c.play();
  c.tick(0.5);
  c.tick(1000);
  c.pause();
  assert.deepEqual(log[0], ["time", 1]);
  assert.ok(log.some((e) => e[0] === "state"));
  assert.ok(log.filter((e) => e[0] === "time").length >= 2);
  assert.equal(c.playing, false);
});

test("speed is clamped and ignores garbage", () => {
  const c = new Clock();
  c.speed = 1000;
  assert.equal(c.speed, 32);
  c.speed = -1;
  assert.equal(c.speed, 32);
  c.speed = "x";
  assert.equal(c.speed, 32);
  c.speed = 0.0001;
  assert.equal(c.speed, 0.01);
});

test("clockFor returns one clock per name", () => {
  assert.equal(clockFor("cmp"), clockFor("cmp"));
  assert.notEqual(clockFor("cmp"), clockFor("other"));
});

test("a timestamp that goes backwards counts nothing", () => {
  const c = new Clock();
  c.setDuration(10);
  c.play();
  c.tick(5000);
  c.tick(5100);
  const t = c.time;
  c.tick(200);
  assert.equal(c.time, t);
  c.tick(300);
  assert.ok(Math.abs(c.time - (t + 0.1)) < 1e-9);
});

test("jittery rAF timestamps advance time evenly, and the playhead still tracks real time", () => {
  const c = new Clock();
  c.setDuration(100);
  c.play();
  let now = 1000;
  c.tick(now);
  const steps = [];
  let last = c.time;
  for (let i = 0; i < 600; i++) {
    // The display ticks every 8.33 ms; the timestamp wobbles by +-1.5 ms.
    now = 1000 + (i + 1) * 1000 / 120 + (i % 2 ? 1.5 : -1.5);
    c.tick(now);
    steps.push(c.time - last);
    last = c.time;
  }
  const settled = steps.slice(60);
  const spread = Math.max(...settled) - Math.min(...settled);
  assert.ok(spread < 0.001 / 4, `step spread ${spread * 1000} ms; the raw timestamps would give 3 ms`);
  assert.ok(Math.abs(c.time - (now - 1000) / 1000) < 0.01, `tracks wall time: ${c.time} vs ${(now - 1000) / 1000}`);
});

test("a late frame is made up over several frames, not in one jump", () => {
  const c = new Clock();
  c.setDuration(100);
  c.play();
  let now = 1000;
  c.tick(now);
  const step = 1000 / 60;
  const frames = [];
  let last = 0;
  const advance = (dtMs) => {
    now += dtMs;
    c.tick(now);
    frames.push(c.time - last);
    last = c.time;
  };
  for (let i = 0; i < 60; i++) advance(step);
  advance(100); // a 100 ms hiccup
  for (let i = 0; i < 80; i++) advance(step);
  const after = frames.slice(60);
  assert.ok(Math.max(...after) < 2.2 * (step / 1000), `largest step ${Math.max(...after) * 1000} ms`);
  assert.ok(Math.abs(c.time - (now - 1000) / 1000) < 0.002, "the lost time was played back");
});

test("time spent waiting for data is not played back afterwards", () => {
  const c = new Clock();
  c.setDuration(100);
  const owner = {};
  c.play();
  let now = 1000;
  c.tick(now);
  for (let i = 0; i < 30; i++) c.tick((now += 1000 / 60));
  c.hold(owner, true);
  for (let i = 0; i < 30; i++) c.tick((now += 1000 / 60));
  const at = c.time;
  c.hold(owner, false);
  for (let i = 0; i < 10; i++) c.tick((now += 1000 / 60));
  assert.ok(c.time - at < 12 / 60, `resumed at normal speed: ${c.time - at}`);
});

test("a live claim waits at the end for more frames instead of ending, and plays on when it grows", () => {
  const c = new Clock();
  const p = {};
  c.claim(p, 1, 0.02, true);
  let ended = 0;
  c.addEventListener("ended", () => ended++);
  c.play();
  let now = 1000;
  c.tick(now);
  for (let i = 0; i < 120; i++) c.tick((now += 1000 / 60));
  assert.equal(c.time, 1);
  assert.equal(c.playing, true, "still playing at the live edge");
  assert.equal(ended, 0);
  c.claim(p, 2, 0.02, true); // a window arrived
  for (let i = 0; i < 30; i++) c.tick((now += 1000 / 60));
  assert.ok(c.time > 1.4 && c.time < 1.6, `t = ${c.time}`);
  c.claim(p, 2, 0.02, false); // the run finished
  for (let i = 0; i < 60; i++) c.tick((now += 1000 / 60));
  assert.equal(c.time, 2);
  assert.equal(c.playing, false);
  assert.equal(ended, 1);
});

test("a playing clock with nothing loaded waits instead of ending", () => {
  const c = new Clock();
  c.claim("a", 2);
  c.play();
  let ended = 0;
  c.addEventListener("ended", () => ended++);
  c.release("a"); // the run is being swapped for another
  for (let i = 1; i <= 5; i++) c.tick(i * 16);
  assert.equal(c.playing, true);
  assert.equal(ended, 0);
  c.claim("b", 2);
  for (let i = 6; i <= 20; i++) c.tick(i * 16);
  assert.equal(c.playing, true, "the new run plays on");
  assert.ok(c.time > 0);
});
