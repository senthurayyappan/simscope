// The one shared requestAnimationFrame loop.
//
// Each display frame it ticks every distinct Clock once (players never
// self-play), then updates and draws every visible player. It sleeps when
// nothing is playing, animating or waiting for data, and wakes on any
// `invalidate()`. Because all clocks advance first and all players draw
// second, several players on one clock (compare) always show the same time.

import { FrameTimer } from "./clock.js";

const players = new Set();
const timer = new FrameTimer(); // smoothed wall dt for cameras (same as the clocks use)
let raf = 0;
let lastNow = 0;

/** Ask for a frame. Cheap to call repeatedly. */
export function wake() {
  if (!raf && players.size && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(frame);
}

export function addPlayer(player) {
  players.add(player);
  wake();
}

export function removePlayer(player) {
  players.delete(player);
}

function frame(now) {
  raf = 0;
  const dt = timer.step(lastNow ? Math.max((now - lastNow) / 1000, 0) : 0);
  lastNow = now;
  const clocks = new Set();
  for (const p of players) clocks.add(p.clock);
  for (const c of clocks) c.tick(now);
  let more = false;
  for (const p of players) {
    if (!p.visible) continue;
    const changed = p.update(dt, now);
    if (changed || p.dirty) p.renderer.draw(p);
    if (p.needsFrame()) more = true;
  }
  if (more) wake();
  else {
    // Asleep: the next frame must not count the idle time as playback.
    lastNow = 0;
    timer.reset();
    for (const c of clocks) c.rebase();
  }
}

/** Start the loop (idempotent; players start it themselves). */
export function startLoop() {
  wake();
}

/**
 * Run one loop iteration by hand with a synthetic timestamp (tests and
 * benchmarks drive the loop at an exact frame rate this way; not for apps).
 */
export function stepLoop(now) {
  if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
  raf = 0;
  frame(now);
}
