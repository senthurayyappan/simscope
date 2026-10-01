// Module-level runtime: the shared clock, the player registry, and the UI's
// rAF subscribers. None of this is React state: the clock changes 60 times a
// second and only refs/DOM writes may follow it (viewer v3 §2).

import { createClock, type ClockLike, type PlayerLike } from "./core";
import { useApp } from "./store";

let sharedClock: ClockLike | null = null;

/** The one master clock every pane and the timeline share. */
export function getClock(): ClockLike {
  return (sharedClock ??= createClock());
}

const players = new Map<number, PlayerLike>();

export function registerPlayer(pane: number, player: PlayerLike): () => void {
  players.set(pane, player);
  return () => {
    if (players.get(pane) === player) players.delete(pane);
  };
}

export function playerAt(index: number): PlayerLike | undefined {
  return players.get(index);
}

export function allPlayers(): PlayerLike[] {
  return [...players.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}

/** The player of the active pane (drives timeline, plots, keys). */
export function activePlayer(): PlayerLike | null {
  return players.get(useApp.getState().active) ?? null;
}

type FrameFn = (now: number) => void;
const subscribers = new Set<FrameFn>();
let raf = 0;

/** Cost of the UI's frame subscribers (timeline, readout, plot cursors); enable from the console with `?debug`. */
export const prof = { on: false, ms: 0, frames: 0, max: 0 };

function loop(now: number) {
  const t0 = prof.on ? performance.now() : 0;
  for (const fn of subscribers) fn(now);
  if (prof.on) {
    const d = performance.now() - t0;
    prof.ms += d;
    prof.frames++;
    if (d > prof.max) prof.max = d;
  }
  raf = subscribers.size ? requestAnimationFrame(loop) : 0;
}

/**
 * Runs `fn` every animation frame until the returned function is called.
 * The one loop serves the playhead, readout, plot cursors and reel driver.
 */
export function onFrame(fn: FrameFn): () => void {
  subscribers.add(fn);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(fn);
  };
}
