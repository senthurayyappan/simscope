// Pictures of the viewport: a PNG at a chosen scale, or a short GIF of a
// stretch of the run. The player draws the frames (core/player.js); this file
// only chooses the stretch, encodes, and hands the bytes to the browser.

import { GIFEncoder } from "./gif.ts";
import { buildPalette, indexFrame, sampleColors } from "./quantize.ts";

import type { PlayerLike } from "./core";

/** The longest GIF, in seconds. A longer run needs a loop region on the timeline. */
export const GIF_MAX_SECONDS = 5;
/** Frame rates whose delay is a whole number of centiseconds, the unit a GIF counts in. */
export const GIF_FPS = [10, 20, 25] as const;
export const GIF_WIDTHS = [480, 720, 960] as const;
/** Widths of a screenshot, in pixels. */
export const SHOT_WIDTHS = [1280, 1920, 3840] as const;
/** The shapes of a capture. A capture has a fixed size, whatever the pane it is taken from is. */
export const SHAPES = [
  { id: "16:9", aspect: 16 / 9 },
  { id: "4:3", aspect: 4 / 3 },
  { id: "1:1", aspect: 1 },
] as const;
export type ShapeId = (typeof SHAPES)[number]["id"];

export const aspectOf = (id: ShapeId): number => SHAPES.find((s) => s.id === id)?.aspect ?? 16 / 9;

const MIN_SECONDS = 0.1;
const EPS = 1e-6;

export interface GifWindow {
  /** The stretch of the run, in seconds of run time. */
  t0: number;
  t1: number;
  /** How long the GIF plays: the stretch divided by the playback speed. */
  seconds: number;
  /** Why this stretch cannot be a GIF, or null when it can. */
  problem: string | null;
}

/**
 * The stretch a GIF would show: the loop region when there is one, else the
 * whole run. The GIF plays it at the clock's `speed`, and must play for at most
 * `GIF_MAX_SECONDS`.
 */
export function gifWindow(duration: number, region: readonly [number, number] | null, speed = 1): GifWindow {
  const [t0, t1] = region ?? [0, duration];
  const seconds = (t1 - t0) / speed;
  const at = speed === 1 ? "" : ` at ${+speed.toFixed(2)}× speed`;
  let problem: string | null = null;
  if (!(duration > 0)) problem = "Open a run first";
  else if (seconds < MIN_SECONDS - EPS) problem = "Select a longer stretch on the timeline";
  else if (seconds > GIF_MAX_SECONDS + EPS) {
    problem = region
      ? `The selected stretch plays for ${seconds.toFixed(1)} s${at}. Shorten it to ${GIF_MAX_SECONDS} s or less`
      : `The run plays for ${seconds.toFixed(1)} s${at}. Drag on the timeline ruler to select ${GIF_MAX_SECONDS} s or less`;
  }
  return { t0, t1, seconds, problem };
}

/** Frames in a GIF of `seconds` at `fps`; the same count the player draws. */
export function gifFrames(seconds: number, fps: number): number {
  return Math.max(1, Math.round(seconds * fps));
}

/** A file name with no characters a file system dislikes. */
export function fileName(run: string, suffix: string, ext: string): string {
  const base = run.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 64) || "simscope";
  return `${base}${suffix ? `-${suffix}` : ""}.${ext}`;
}

/** Offer `blob` to the user as a download. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const seconds = (t: number) => `${t.toFixed(2).replace(/\.?0+$/, "")}s`;

/** Save the viewport as a PNG, `width` pixels wide in shape `shape`. */
export async function saveScreenshot(player: PlayerLike, run: string, width: number, shape: ShapeId): Promise<void> {
  const blob = await player.snapshot("image/png", { width, aspect: aspectOf(shape) });
  download(blob, fileName(run, `${seconds(player.clock.time)}-${width}w`, "png"));
}

export interface GifOptions {
  t0: number;
  t1: number;
  fps: number;
  width: number;
  shape: ShapeId;
  /** Times real time; the clock's speed. Default 1. */
  speed?: number;
  signal?: AbortSignal;
  onProgress?(p: { phase: "colours" | "frames"; done: number; total: number }): void;
}

/**
 * Draw and encode a GIF of `t0..t1`. It loops, and its last frame leads into its first.
 *
 * One palette serves every frame (see quantize.ts), so the run is drawn twice:
 * first a few small frames to choose the colours, then every frame to encode.
 */
export async function encodeGif(player: PlayerLike, { t0, t1, fps, width, shape, speed = 1, signal, onProgress }: GifOptions): Promise<Blob> {
  const aspect = aspectOf(shape);
  const hist = new Map<number, number>();
  for await (const f of player.captureFrames({ t0, t1, fps: Math.max(2, Math.round(fps / 4)), width: Math.round(width / 2), aspect, speed, signal })) {
    sampleColors(f.data, hist);
    onProgress?.({ phase: "colours", done: f.index + 1, total: f.count });
    await new Promise((done) => setTimeout(done, 0));
  }
  const palette = buildPalette(hist);
  const cache = new Map<number, number>();
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for await (const f of player.captureFrames({ t0, t1, fps, width, aspect, speed, signal })) {
    // The first frame's palette is the file's; the others use it.
    gif.writeFrame(indexFrame(f.data, palette, cache), f.width, f.height, f.index === 0 ? { palette, delay } : { delay });
    onProgress?.({ phase: "frames", done: f.index + 1, total: f.count });
    // Let the page paint and answer a click on Cancel between frames.
    await new Promise((done) => setTimeout(done, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

export async function saveGif(player: PlayerLike, run: string, opts: GifOptions): Promise<void> {
  const blob = await encodeGif(player, opts);
  download(blob, fileName(run, `${seconds(opts.t0)}-${seconds(opts.t1)}`, "gif"));
}
