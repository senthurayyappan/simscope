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

export { onFrame, prof } from "./frame";
