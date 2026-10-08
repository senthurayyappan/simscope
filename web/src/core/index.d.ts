// Types of the player core.
//
// Hand-written. The app and the <simscope-player> element import only from
// `web/src/core/index.js`; this file is its typing. Everything marked
// "extension" is additive.

// ---- sources ----

/** One entry of a block file's directory. */
export interface BlockEntry {
  env: number;
  t0: number;
  n: number;
  offset: number;
  clen: number;
  ulen: number;
  codec: number;
}

/** Header and block directory of a `.blk` file (`format.parseBlk` shape, no block bytes). */
export interface BlkIndex {
  itemShape: number[];
  itemK: number;
  nEnvs: number;
  nFrames: number;
  blockFrames: number;
  blocks: BlockEntry[];
}

export interface Source {
  /** Whole entry at a §1 path; rejects with SourceError(status) if absent. */
  get(path: string): Promise<Uint8Array>;
  /** Parsed header + directory of a block file (no block bytes). */
  blockIndex(path: string, opts?: { refresh?: boolean }): Promise<BlkIndex>;
  /** Raw SSBB blocks of window w for the given envs, in the order asked. */
  blocks(path: string, w: number, envs: number[]): Promise<Uint8Array[]>;
  /** Run names this source holds. */
  runs(): Promise<string[]>;
}

/** An in-memory `.simscope` pack (inline export, fetched pack). */
export class PackSource implements Source {
  constructor(pack: Uint8Array | ArrayBuffer);
  /** Like the constructor, but also accepts a gzip-wrapped pack. */
  static open(pack: Uint8Array | ArrayBuffer): Promise<PackSource>;
  get(path: string): Promise<Uint8Array>;
  blockIndex(path: string, opts?: { refresh?: boolean }): Promise<BlkIndex>;
  blocks(path: string, w: number, envs: number[]): Promise<Uint8Array[]>;
  runs(): Promise<string[]>;
  /** Whether an entry exists (extension). */
  has(path: string): boolean;
}

/** `simscope serve`'s routes (contracts §2): `/files/`, `/api/blk`, `/api/blocks`, `/api/runs`. */
export class HttpSource implements Source {
  constructor(base?: string);
  get(path: string): Promise<Uint8Array>;
  blockIndex(path: string, opts?: { refresh?: boolean }): Promise<BlkIndex>;
  blocks(path: string, w: number, envs: number[]): Promise<Uint8Array[]>;
  runs(): Promise<string[]>;
}

/** `status` is 404 when the path is absent and 202 when a derived file is still pending. */
export class SourceError extends Error {
  constructor(message: string, status: number);
  status: number;
}

// ---- clock ----

export interface ClockEventMap {
  /** Time moved (playing, seeking or stepping). */
  time: CustomEvent<{ t: number }>;
  /** Playing, speed, loop, loop region or duration changed. */
  state: CustomEvent<Record<string, never>>;
  /** Playback reached the end of a non-looping clock (extension). */
  ended: CustomEvent<Record<string, never>>;
}

export class Clock extends EventTarget {
  // One clock may drive many players (compare).
  constructor();
  readonly time: number;
  readonly duration: number;
  readonly playing: boolean;
  speed: number;
  loop: boolean;
  loopRegion: [number, number] | null;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(t: number): void;
  step(frames: number, dt: number): void;
  /** Sets the duration claimed by the clock's owner (the max with every attached player's). */
  setDuration(seconds: number): void;
  /** Called by the shared rAF loop with the rAF timestamp. */
  tick(nowMs: number): void;
  /** Extension: a player claims `seconds` of the timeline (`pad` = the last frame's dwell time; `live`: playback waits at the end for more). */
  claim(owner: object, seconds: number, pad?: number, live?: boolean): void;
  /** Extension: drop a player's claim. */
  release(owner: object): void;
  /** Extension: a player that has not decoded its data yet stalls playback. */
  hold(owner: object, on: boolean): void;
  addEventListener<K extends keyof ClockEventMap>(
    type: K,
    listener: (ev: ClockEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

// ---- player ----

export type View = "iso" | "front" | "side" | "top";
export type FollowMode = "off" | "position" | "pose" | "heading";
export type GroundStyle = "checker" | "grid" | "none";
export type Theme = "light" | "dark";

/** An annotation event from `annotations.json`, for timeline markers. */
export interface RunEvent {
  t0: number;
  t1: number;
  label: string;
}

export interface RunInfo {
  run: string;
  dt: number;
  frames: number;
  /** Time of the last frame: `(frames - 1) * dt`. */
  duration: number;
  envs: number;
  bodies: string[];
  followBody: number;
  streams: { name: string; kind: string; shape: number[] }[];
  hasCollision: boolean;
  hasContacts: boolean;
  live: boolean;
  tiered: boolean;
  /** Extension: annotation events of the run (empty when there is no annotations.json). */
  events: RunEvent[];
  /** Extension: a ground plane is part of the scene. */
  hasGround: boolean;
  /** The player's compare slot colour (`PlayerOptions.color`, `setColor`), or null. */
  color: string | null;
}

export interface PlayerOptions {
  clock?: Clock;
  theme?: Theme;
  ground?: GroundStyle;
  view?: View;
  /** CSS colour, or "transparent"; default from the theme. */
  background?: string;
  /** The compare slot colour (any CSS colour): the element draws this player's markers in it; the app's pane dot uses it. It colours nothing in the viewport. Default none. */
  color?: string;
  // ---- extensions ----
  /** Initial follow mode. Default: "position" for single-env runs, else "off". */
  follow?: FollowMode;
  /** Draw through a WebGL context of its own (one big viewport) instead of the page's shared one. */
  direct?: boolean;
  /** Triangle budget of the focus tier above 64 envs. Default 5,000,000. */
  triangleBudget?: number;
  /** Metres of drawn arrow per unit of vector, on top of each stream's `scale`. */
  arrowScale?: number;
}

/** A serialisable camera: orbit, zoom and target (extension: the shape of `cameraState()`). */
export interface CameraState {
  v: 1;
  /** Orbit angles (rad) about the target, in camera-controls' z-up frame. */
  azimuth: number;
  polar: number;
  /** World height shown = scale / zoom; `zoom` is relative to `scale`. Where the zoom is heading, not where it is. */
  zoom: number;
  scale: number;
  /** Where the camera looks (world), at the moment of the state. */
  target: [number, number, number];
  /**
   * The pan: the target's offset from the followed body (or, not following,
   * from where the view was last framed), in metres along the view's right
   * and up axes. Camera-relative, so a state taken in one pane puts another
   * pane's view at the same screen offset from its own robot. Absent in a
   * state from before the pan was carried: `setCameraState` then moves a
   * camera that is not following to `target`.
   */
  pan?: [number, number];
  /** Whether the camera was following a body. */
  following: boolean;
}

export interface PlayerEventMap {
  loaded: CustomEvent<RunInfo>;
  focus: CustomEvent<{ env: number; focus: number[] }>;
  /** A user-driven camera change; `detail` is `cameraState()`. */
  camera: CustomEvent<CameraState>;
  progress: CustomEvent<{ pending: number }>;
  error: CustomEvent<{ error: Error; message: string }>;
  live: CustomEvent<{ frames: number }>;
  /** Follow mode or target changed (extension). */
  follow: CustomEvent<{ mode: FollowMode; env: number; body: number }>;
  /** The slot colour changed through `setColor` (extension). */
  color: CustomEvent<{ color: string | null }>;
}

/**
 * One highlight of `derived/<run>/highlights.json` (`simscope-highlights/2`,
 * contracts §8.2). A moment has `t1 === null`; a `jump` is a span from `t` to
 * `t1`.
 */
export interface HighlightEntry {
  t: number;
  frame: number;
  t1: number | null;
  frame1: number | null;
  env: number;
  /** `landing`, `jump`, `fall`, `contact_spike`, `torque_spike`, or a registered kind. */
  kind: string;
  /** Plain-language name, for example "Landing". */
  label: string;
  /** One line of detail, for example "4.1 g impact, after 0.38 s airborne"; may be empty. */
  detail: string;
  score: number;
  /** How many times the typical level, for the UI's "× typical"; null when it has none. */
  ratio: number | null;
  value: number;
  body: number | null;
  /** Kinds merged into this moment. */
  also: string[];
  /** @deprecated Alias of `kind`, kept for code written against `/1` documents. */
  signal: string;
}

/**
 * `derived/<run>/highlights.json`, always in the `/2` shape: `Player.highlights()`
 * upgrades a `/1` document (each signal becomes a moment of that kind, with no
 * detail), so readers need only this shape.
 */
export interface HighlightsDoc {
  /** The version the file was written in. */
  format: string;
  detector: string;
  run_id?: string;
  /** Only kinds present in `highlights`. */
  kinds: { key: string; label: string }[];
  highlights: HighlightEntry[];
  /** @deprecated `kinds` with an empty `unit`, kept for code written against `/1` documents. */
  signals: { key: string; label: string; unit: string }[];
}

/** `derived/<run>/summaries.json` (contracts §5.2). */
export interface SummariesDoc {
  columns: { key: string; label: string; unit: string; better: "high" | "low" }[];
  values: Record<string, number[]>;
}

/** One component of `derived/<run>/envelopes/<stream>.json` (contracts §5.3), as typed arrays. */
export interface EnvelopeDoc {
  dt: number;
  t0: number;
  components: number;
  component: number;
  p5: Float32Array;
  p50: Float32Array;
  p95: Float32Array;
}

export class Player extends EventTarget {
  constructor(canvas: HTMLCanvasElement, opts?: PlayerOptions);
  readonly clock: Clock;
  load(source: Source, run: string, opts?: { envs?: number[] }): Promise<RunInfo>;
  unload(): void;
  destroy(): void;
  info(): RunInfo | null;
  resize(width: number, height: number, dpr?: number): void;
  /** Extension: re-read a live run's manifest and block directories (the app calls this on /api/changes). */
  refresh(): Promise<void>;
  /** Extension: whether the canvas is on screen. The player observes its canvas itself; set to override. */
  visible: boolean;

  // Camera (orthographic, z-up, camera-controls underneath).
  /** Orbit to a named view and clear the pan. In a linked group, in every pane; position follow also refits the height for the view unless the user zoomed. */
  setView(view: View, opts?: { animate?: boolean }): void;
  /**
   * Fit the view to the selected and pinned envs ("focus") or to every env
   * ("all"), and clear the pan. Position follow with "focus" shows the whole
   * run, not frame 0: the middle of the followed body's height range over
   * every frame (plus the robot's reach, the ground, and the tops of static
   * geometry beside its path) is held, and that range is fitted with a 10%
   * margin. Until the run's series is decoded the frame-0 fit stands, and
   * then it is replaced once, animated, never while the clock plays.
   */
  frame(what?: "focus" | "all", opts?: { animate?: boolean }): void;
  setFollow(opts: { mode?: FollowMode; env?: number; body?: number }): void;
  follow(): { mode: FollowMode; env: number; body: number };
  cameraState(): CameraState;
  /** Apply a state from `cameraState()` (the orbit, zoom and pan; the target only for a state without a pan, and only when not following). */
  setCameraState(state: unknown, opts?: { animate?: boolean; keep?: boolean }): void;

  // Display.
  setTheme(theme: Theme, background?: string): void;
  setGround(style: GroundStyle): void;
  setContacts(on: boolean): void;
  setCollision(on: boolean): void;
  /** Show or hide visual geoms; independent of `setCollision` and `setContacts`. */
  setVisual(on: boolean): void;
  /** Set the compare slot colour (`PlayerOptions.color`); emits "color" when it changes. */
  setColor(css: string | null): void;
  /** Extension: colour the crowd proxies by a summaries column (null: one colour). */
  setCrowdColor(column: string | null): Promise<void>;
  /** Extension: playback of the drawn streams' window cache, for status lines. */
  stats(): { cachedBytes: number; pending: number; drawCalls: number; triangles: number; focusEnvs: number; threaded: boolean };

  // Envs (focus/crowd tiers are automatic above 64 envs).
  selectEnv(env: number): void;
  pinEnvs(envs: number[]): void;
  focusEnvs(): number[];
  pickEnv(clientX: number, clientY: number): number | null;

  // Data for plots and highlights (full timeline of one env).
  series(stream: string, env: number, component?: number): Promise<Float32Array>;
  bodySeries(kind: "height" | "speed", env: number, body: number): Promise<Float32Array>;
  /** The `/2` highlights document (spans included), or null when the run has none. */
  highlights(): Promise<HighlightsDoc | null>;
  summaries(): Promise<SummariesDoc | null>;
  envelope(stream: string, component?: number): Promise<EnvelopeDoc | null>;

  /** An image of the viewport. With `width` or `aspect` it is drawn again at that size and shape, whatever the pane is, about the centre of the view. */
  snapshot(type?: string, opts?: CaptureSize): Promise<Blob>;
  /** The pixel size of a capture of `opts` (the longest side is capped). */
  captureSize(opts?: CaptureSize): { width: number; height: number };
  /** Draw `t0..t1` frame by frame at `fps` and `width` pixels, for a GIF. The clock is paused meanwhile and put back after. */
  captureFrames(opts: CaptureOptions): AsyncGenerator<CaptureFrame, void, void>;

  addEventListener<K extends keyof PlayerEventMap>(
    type: K,
    listener: (ev: PlayerEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

/** A capture is `width` pixels wide in shape `aspect` (width / height); each defaults to the viewport's. */
export interface CaptureSize {
  width?: number;
  aspect?: number;
}

export interface CaptureOptions {
  t0: number;
  t1: number;
  fps?: number;
  width?: number;
  aspect?: number;
  /** Times real time; the stretch `t0..t1` then takes `(t1 - t0) / speed` seconds to play. Default 1. */
  speed?: number;
  signal?: AbortSignal;
}

/** One frame of a capture: RGBA bytes, `width` x `height`, the run at time `t`. */
export interface CaptureFrame {
  index: number;
  count: number;
  t: number;
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** One shared rAF loop ticks every clock once, then draws every visible player. */
export function startLoop(): void;

/**
 * Mirror user-driven camera changes between players (compare): orbit, zoom
 * and pan. A player that is following keeps following its own env; the pan is
 * an offset from each pane's own robot, in the view's right and up axes, so
 * every pane moves by the same screen distance (panes of equal pixel height).
 * Returns a function that stops the sync.
 *
 * With `alignGround` (default true) the players also share the height of their
 * camera targets, so world z = 0 sits on the same screen row under every
 * followed robot, including after a vertical pan: following players move only
 * x and y and hold one height, in every follow mode. That height is the
 * first player's standing height (its follow body's z at frame 0) until
 * every pane has decoded its run; then the group holds the middle of the
 * union of their vertical ranges and fits the most any pane needs (see
 * `Player.frame`), once, animated, not while the clock plays.
 * `setView()` and `frame()` on any player act on all of them and clear the
 * pan; loading a run into one of them frames the group again with the first
 * player's orbit.
 */
export function linkCameras(players: Player[], opts?: { alignGround?: boolean }): () => void;

/** Run one loop iteration by hand with a synthetic rAF timestamp (tests and benchmarks; extension). */
export function stepLoop(nowMs: number): void;

/** The clock shared by all players that name `name` (extension; the element's `sync` attribute). */
export function clockFor(name: string): Clock;

// ---- format (on-disk readers; pure, no DOM) ----

export namespace format {
  function crc32(bytes: Uint8Array, start?: number, end?: number): number;
  function inflate(bytes: Uint8Array, format?: string): Promise<Uint8Array>;
  function parsePack(bytes: Uint8Array): { entries: Map<string, Uint8Array> };
  function inflateIfGzip(bytes: Uint8Array): Promise<Uint8Array>;
  function unwrapPack(bytes: Uint8Array): Promise<{ entries: Map<string, Uint8Array> }>;
  function casPath(dir: string, sha256: string, ext?: string): string;
  function parseBlk(bytes: Uint8Array): BlkIndex & { bytes: Uint8Array };
  function indexWindows(blk: BlkIndex): (BlockEntry[] | undefined)[];
  function renormalizePoses(x: Float32Array): void;
  function decodeBlock(
    blk: { bytes: Uint8Array; itemK: number },
    block: { offset: number },
    options?: { pose?: boolean },
  ): Promise<Float32Array>;
  function decodeEnv(blk: BlkIndex & { bytes: Uint8Array }, env: number, options?: { pose?: boolean }): Promise<Float32Array>;
  function computeNormals(verts: Float32Array, faces: Uint32Array): Float32Array;
  function decodeMesh(bytes: Uint8Array): Promise<{
    verts: Float32Array;
    faces: Uint32Array;
    normals: Float32Array;
    uvs: Float32Array | null;
    nVerts: number;
    nFaces: number;
  }>;
  function parseJson(bytes: Uint8Array, what: string): any;
  function checkFormat(obj: unknown, family: string, what: string): void;
}
