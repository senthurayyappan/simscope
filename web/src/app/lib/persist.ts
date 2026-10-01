// Where the app remembers things (guideline P7). Three places, one module:
//
//   URL hash         what identifies the view            -> lib/hash.ts
//   sessionStorage   this tab's workspace (camera, filters, drafts)
//   localStorage     preferences across sessions
//
// Each storage area is one versioned JSON blob. A blob from another version,
// a corrupt one, or storage that throws all read as "nothing saved": the app
// then starts from its defaults and never shows an error. No DOM at import
// time, so the node tests can use it with a fake `Storage`.

export const VERSION = 1;
export const PREFS_KEY = "simscope.prefs";
export const SESSION_KEY = "simscope.session";

export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// ---- preferences (localStorage) ----

export interface Prefs {
  theme: "light" | "dark" | "system";
  view: "date" | "group";
  sort: "newest" | "name" | "longest";
  /** Section ids the user folded. */
  folded: string[];
  visual: boolean;
  collision: boolean;
  contacts: boolean;
  groundOn: boolean;
  groundKind: "checker" | "grid";
  cameraSync: boolean;
  speed: number;
  loop: boolean;
  plotWindow: "all" | "5" | "2";
  follow: "off" | "position" | "pose" | "heading";
  arrange: "side" | "stack" | "grid";
  sizes: { left?: number; right?: number };
  collapsed: { left?: boolean; right?: boolean; timeline?: boolean };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const num = (v: unknown, lo = -Infinity, hi = Infinity): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined;
const strings = (v: unknown, max: number, maxLen = 200): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= maxLen).slice(0, max) : undefined;

/** The object without its undefined fields. */
function defined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Keeps only the valid fields of a stored preferences object. */
export function sanitizePrefs(raw: unknown): Partial<Prefs> {
  if (!isObj(raw)) return {};
  const out: Partial<Prefs> = {};
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  set("theme", oneOf(raw.theme, ["light", "dark", "system"]));
  set("view", oneOf(raw.view, ["date", "group"]));
  set("sort", oneOf(raw.sort, ["newest", "name", "longest"]));
  set("folded", strings(raw.folded, 200));
  set("visual", bool(raw.visual));
  set("collision", bool(raw.collision));
  set("contacts", bool(raw.contacts));
  set("groundOn", bool(raw.groundOn));
  set("groundKind", oneOf(raw.groundKind, ["checker", "grid"]));
  set("cameraSync", bool(raw.cameraSync));
  set("speed", num(raw.speed, 0.01, 64));
  set("loop", bool(raw.loop));
  set("plotWindow", oneOf(raw.plotWindow, ["all", "5", "2"]));
  set("follow", oneOf(raw.follow, ["off", "position", "pose", "heading"]));
  set("arrange", oneOf(raw.arrange, ["side", "stack", "grid"]));
  if (isObj(raw.sizes)) set("sizes", defined({ left: num(raw.sizes.left, 0, 5000), right: num(raw.sizes.right, 0, 5000) }));
  if (isObj(raw.collapsed)) set("collapsed", defined({ left: bool(raw.collapsed.left), right: bool(raw.collapsed.right), timeline: bool(raw.collapsed.timeline) }));
  return out;
}

/**
 * Preferences saved by versions before this module, one localStorage key each.
 * Read once, when no versioned blob exists yet.
 */
export function importLegacyPrefs(get: (key: string) => string | null): Partial<Prefs> {
  const json = (key: string): unknown => {
    try {
      const v = get(key);
      return v === null ? undefined : JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  const ground = get("simscope.ground");
  return sanitizePrefs({
    theme: get("simscope.theme") ?? undefined,
    view: get("simscope.view") ?? undefined,
    sort: get("simscope.sort") ?? undefined,
    groundOn: ground === null ? undefined : ground !== "off",
    groundKind: get("simscope.groundkind") ?? undefined,
    plotWindow: get("simscope.plotwindow") ?? undefined,
    follow: get("simscope.follow") ?? undefined,
    arrange: get("simscope.arrange") ?? undefined,
    sizes: json("simscope.sizes"),
    collapsed: json("simscope.collapsed"),
  });
}

// ---- workspace (sessionStorage) ----

/** A camera as `Player.cameraState()` returns it, plus the env the pane showed. */
export interface SavedCamera {
  state: {
    v: 1;
    azimuth: number;
    polar: number;
    zoom: number;
    scale: number;
    target: [number, number, number];
    pan?: [number, number];
    following: boolean;
  };
  env: number;
}

export interface Session {
  /** Runs open in the panes when this was saved; cameras and times only apply to the same runs. */
  runs: string[];
  active: number;
  picks: { name: string; slot: number }[];
  cams: (SavedCamera | null)[];
  pinned: number[];
  playing: boolean;
  t: number | null;
  loop: [number, number] | null;
  /** The timeline's visible span. */
  view: [number, number] | null;
  query: string;
  expanded: string[];
  /** Scroll offsets by container id (`library`, `metadata`, `plots`, `envs`). */
  scroll: Record<string, number>;
  /** Unsent note text by run name. */
  notes: Record<string, string>;
  label: { t: number; id?: string; text: string } | null;
  rename: { name: string; text: string } | null;
}

export const emptySession = (): Session => ({
  runs: [],
  active: 0,
  picks: [],
  cams: [],
  pinned: [],
  playing: false,
  t: null,
  loop: null,
  view: null,
  query: "",
  expanded: [],
  scroll: {},
  notes: {},
  label: null,
  rename: null,
});

function sanitizeCamera(raw: unknown): SavedCamera | null {
  if (!isObj(raw) || !isObj(raw.state)) return null;
  const s = raw.state;
  const azimuth = num(s.azimuth);
  const polar = num(s.polar);
  const zoom = num(s.zoom);
  const scale = num(s.scale);
  const t = s.target;
  if (s.v !== 1 || azimuth === undefined || polar === undefined || zoom === undefined || scale === undefined) return null;
  if (!(zoom > 0) || !(scale > 0)) return null;
  if (!Array.isArray(t) || t.length !== 3 || !t.every((x) => num(x) !== undefined)) return null;
  const state: SavedCamera["state"] = { v: 1, azimuth, polar, zoom, scale, target: [t[0], t[1], t[2]] as [number, number, number], following: s.following === true };
  const pan = s.pan;
  if (Array.isArray(pan) && pan.length === 2 && num(pan[0]) !== undefined && num(pan[1]) !== undefined) state.pan = [pan[0], pan[1]];
  return { state, env: num(raw.env, 0) ?? 0 };
}

const pair = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  return a !== undefined && b !== undefined && b > a ? [a, b] : null;
};

/** Keeps only the valid fields of a stored session; the rest take their empty values. */
export function sanitizeSession(raw: unknown): Session {
  const out = emptySession();
  if (!isObj(raw)) return out;
  out.runs = strings(raw.runs, 4) ?? [];
  out.active = Math.floor(num(raw.active, 0, 3) ?? 0);
  if (Array.isArray(raw.picks)) {
    for (const p of raw.picks.slice(0, 4)) {
      if (isObj(p) && typeof p.name === "string" && p.name.length <= 200 && num(p.slot, 0, 3) !== undefined) out.picks.push({ name: p.name, slot: Math.floor(p.slot as number) });
    }
  }
  if (Array.isArray(raw.cams)) out.cams = raw.cams.slice(0, 4).map(sanitizeCamera);
  out.pinned = Array.isArray(raw.pinned) ? raw.pinned.filter((x): x is number => num(x, 0, 1e7) !== undefined).slice(0, 3) : [];
  out.playing = raw.playing === true;
  out.t = num(raw.t, 0, 1e7) ?? null;
  out.loop = pair(raw.loop);
  out.view = pair(raw.view);
  out.query = typeof raw.query === "string" ? raw.query.slice(0, 200) : "";
  out.expanded = strings(raw.expanded, 200) ?? [];
  if (isObj(raw.scroll)) for (const [k, v] of Object.entries(raw.scroll).slice(0, 20)) if (num(v, 0, 1e7) !== undefined) out.scroll[k] = v as number;
  if (isObj(raw.notes)) {
    for (const [k, v] of Object.entries(raw.notes).slice(0, 50)) if (typeof v === "string" && v.length > 0) out.notes[k] = v.slice(0, 20000);
  }
  if (isObj(raw.label) && num(raw.label.t, 0, 1e7) !== undefined && typeof raw.label.text === "string") {
    out.label = { t: raw.label.t as number, text: raw.label.text.slice(0, 500) };
    if (typeof raw.label.id === "string" && raw.label.id.length <= 100) out.label.id = raw.label.id;
  }
  if (isObj(raw.rename) && typeof raw.rename.name === "string" && typeof raw.rename.text === "string") {
    out.rename = { name: raw.rename.name, text: raw.rename.text.slice(0, 200) };
  }
  return out;
}

/** True when the saved workspace belongs to exactly these runs, in this order. */
export function sessionMatches(s: Session, runs: string[]): boolean {
  return s.runs.length === runs.length && s.runs.every((r, i) => r === runs[i]);
}

// ---- areas ----

let quietDepth = 0;

/** Runs `fn`; state changes made inside are not written to the preferences (a link's or an export's own choices). */
export function quietly(fn: () => void): void {
  quietDepth++;
  try {
    fn();
  } finally {
    quietDepth--;
  }
}

export const isQuiet = (): boolean => quietDepth > 0;

/** One versioned JSON blob in a storage area; reads never throw, writes never throw. */
export class Area<T> {
  private cache: T | null = null;
  private readonly storage: () => Store | null;
  private readonly key: string;
  private readonly load: (raw: unknown, store: Store | null) => T;
  private readonly empty: () => T;

  constructor(storage: () => Store | null, key: string, load: (raw: unknown, store: Store | null) => T, empty: () => T) {
    this.storage = storage;
    this.key = key;
    this.load = load;
    this.empty = empty;
  }

  private blob(): T {
    let store: Store | null = null;
    try {
      store = this.storage();
    } catch {
      store = null;
    }
    let raw: unknown;
    try {
      const text = store?.getItem(this.key);
      if (text) {
        const doc = JSON.parse(text) as unknown;
        if (isObj(doc) && doc.v === VERSION) raw = doc.data;
        else raw = undefined;
      }
    } catch {
      raw = undefined;
    }
    try {
      return this.load(raw, raw === undefined && !this.hasBlob(store) ? store : null);
    } catch {
      return this.empty();
    }
  }

  private hasBlob(store: Store | null): boolean {
    try {
      return !!store?.getItem(this.key);
    } catch {
      return false;
    }
  }

  /** The saved value (sanitised); the same object until something is written. */
  read(): T {
    return (this.cache ??= this.blob());
  }

  /** Replaces fields and writes the blob. The in-memory value updates even when storage is blocked. */
  patch(change: Partial<T>): void {
    this.cache = { ...this.read(), ...change };
    this.flush();
  }

  /** Writes the in-memory value to storage now. */
  flush(): void {
    try {
      this.storage()?.setItem(this.key, JSON.stringify({ v: VERSION, data: this.cache ?? this.empty() }));
    } catch {
      /* storage is full, blocked or gone: the value is simply not remembered */
    }
  }

  /** Forgets everything, in memory and in storage (tests, and "reset"). */
  clear(): void {
    this.cache = null;
    try {
      this.storage()?.removeItem(this.key);
    } catch {
      /* nothing to clear */
    }
  }

  /** Drops the in-memory copy so the next read goes to storage (tests). */
  reload(): void {
    this.cache = null;
  }
}

export function createPrefs(storage: () => Store | null): Area<Partial<Prefs>> {
  return new Area<Partial<Prefs>>(
    storage,
    PREFS_KEY,
    (raw, legacySource) => {
      if (raw !== undefined) return sanitizePrefs(raw);
      return legacySource ? importLegacyPrefs((k) => legacySource.getItem(k)) : {};
    },
    () => ({}),
  );
}

export function createSession(storage: () => Store | null): Area<Session> {
  return new Area<Session>(storage, SESSION_KEY, (raw) => sanitizeSession(raw), emptySession);
}

/** `?debug&nostorage` makes both areas behave as if the browser blocked storage (for checking P7). */
function blocked(): boolean {
  try {
    return /[?&]debug\b/.test(location.search) && /[?&]nostorage\b/.test(location.search);
  } catch {
    return false;
  }
}

const local = (): Store | null => {
  if (blocked()) throw new Error("storage blocked");
  return localStorage;
};
const session = (): Store | null => {
  if (blocked()) throw new Error("storage blocked");
  return sessionStorage;
};

export const prefs = createPrefs(local);
export const workspace = createSession(session);
