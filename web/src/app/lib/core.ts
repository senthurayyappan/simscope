// The only file that imports the player core. The app depends on the
// contracts (§3) and feature-checks every method, so a half-finished core
// degrades the UI instead of breaking it. Never reach into core internals.

import * as core from "@core/index.js";

import type {
  Clock,
  EnvelopeDoc,
  HighlightEntry,
  HighlightsDoc,
  SummariesDoc,
  FollowMode,
  GroundStyle,
  Player,
  PlayerOptions,
  RunInfo,
  Source,
  View,
} from "@core/index.js";

export type { Clock, EnvelopeDoc, HighlightEntry, HighlightsDoc, SummariesDoc, FollowMode, GroundStyle, Player, PlayerOptions, RunInfo, Source };
export type ViewName = View;
/** The Player; every call the app makes on it is feature-checked with `?.`. */
export type PlayerLike = Player;
export type ClockLike = Clock;

interface CoreModule {
  Clock?: new () => Clock;
  Player?: new (canvas: HTMLCanvasElement, opts?: PlayerOptions) => Player;
  PackSource?: {
    new (pack: Uint8Array | ArrayBuffer): Source;
    open?(pack: Uint8Array | ArrayBuffer): Promise<Source>;
  };
  HttpSource?: new (base?: string) => Source;
  startLoop?: () => void;
  linkCameras?: (players: Player[], opts?: { alignGround?: boolean }) => () => void;
}

const api = core as unknown as CoreModule;

/** True when the core exports what the app needs to run at all. */
export const coreReady = !!(api.Clock && api.Player && api.PackSource && api.HttpSource);

export function createClock(): ClockLike {
  if (!api.Clock) throw new Error("the player core does not export Clock yet");
  return new api.Clock();
}

export function createPlayer(canvas: HTMLCanvasElement, opts: PlayerOptions): PlayerLike {
  if (!api.Player) throw new Error("the player core does not export Player");
  return new api.Player(canvas, opts);
}

/** Opens an inline pack; `open` also unwraps a gzip-wrapped pack when the core has it. */
export async function createPackSource(bytes: Uint8Array): Promise<Source> {
  if (!api.PackSource) throw new Error("the player core does not export PackSource yet");
  return api.PackSource.open ? api.PackSource.open(bytes) : new api.PackSource(bytes);
}

export function createHttpSource(base: string): Source {
  if (!api.HttpSource) throw new Error("the player core does not export HttpSource yet");
  return new api.HttpSource(base);
}

/** Links the panes' cameras (compare); returns the unlink function. Ground planes stay aligned. */
export function linkCameras(players: PlayerLike[]): () => void {
  return api.linkCameras?.(players, { alignGround: true }) ?? (() => {});
}

export function startLoop(): void {
  api.startLoop?.();
}

/** Reads a JSON entry from a source; null if it is absent (404) or pending. */
export async function readJson<T>(source: Source, path: string): Promise<T | null> {
  try {
    const bytes = await source.get(path);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404 || status === 202) return null;
    throw e;
  }
}
