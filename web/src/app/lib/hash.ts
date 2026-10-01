// What identifies the view lives in the URL hash (guideline P7), so it can be
// shared and survives a reload:
//
//   #run=a&t=2.10&tab=metadata            one run
//   #runs=a,b,c&arrange=stack&t=2.10      a compare; the order is slots A..D
//
// Pure functions only (no DOM), so the node tests can import them.

export type HashTab = "plots" | "metadata" | "envs";
export type HashArrange = "side" | "stack" | "grid";

export interface ViewHash {
  /** Open runs in slot order (A..D). */
  runs: string[];
  arrange: HashArrange | null;
  /** Seconds, or null when the hash has none. */
  t: number | null;
  tab: HashTab | null;
}

export const MAX_HASH_RUNS = 4;
const TABS: readonly string[] = ["plots", "metadata", "envs"];
const ARRANGES: readonly string[] = ["side", "stack", "grid"];

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Parses a location hash. Anything unreadable is dropped, never an error. */
export function parseHash(hash: string): ViewHash {
  const out: ViewHash = { runs: [], arrange: null, t: null, tab: null };
  const params = new Map<string, string>();
  for (const part of hash.replace(/^#/, "").split("&")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    if (!params.has(key)) params.set(key, part.slice(eq + 1));
  }
  const list = params.get("runs") ?? params.get("run");
  if (list) {
    const seen = new Set<string>();
    for (const raw of list.split(",")) {
      const name = decode(raw).trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.runs.push(name);
      }
    }
    out.runs.length = Math.min(out.runs.length, MAX_HASH_RUNS);
  }
  const arrange = params.get("arrange") ?? "";
  if (ARRANGES.includes(arrange)) out.arrange = arrange as HashArrange;
  const t = params.get("t");
  if (t !== undefined && /^\d+(\.\d+)?$/.test(t)) {
    const v = Number(t);
    if (Number.isFinite(v)) out.t = v;
  }
  const tab = params.get("tab") ?? "";
  if (TABS.includes(tab)) out.tab = tab as HashTab;
  return out;
}

/**
 * The hash for a view, short and readable: defaults (Plots tab, t of zero,
 * an arrangement for a single run) are left out. Empty when nothing is open.
 */
export function formatHash(v: { runs: string[]; arrange?: HashArrange | null; t?: number | null; tab?: HashTab | null }): string {
  const runs = v.runs.slice(0, MAX_HASH_RUNS);
  if (runs.length === 0) return "";
  const parts: string[] = [];
  if (runs.length === 1) parts.push(`run=${encodeURIComponent(runs[0])}`);
  else {
    parts.push(`runs=${runs.map((r) => encodeURIComponent(r)).join(",")}`);
    if (v.arrange) parts.push(`arrange=${v.arrange}`);
  }
  if (v.t !== null && v.t !== undefined && Number.isFinite(v.t) && v.t > 0.005) parts.push(`t=${v.t.toFixed(2)}`);
  if (v.tab && v.tab !== "plots") parts.push(`tab=${v.tab}`);
  return `#${parts.join("&")}`;
}

/** Splits wanted runs into those the library has (kept, in order) and those it lacks. */
export function resolveRuns(wanted: string[], known: ReadonlySet<string>): { kept: string[]; missing: string[] } {
  const kept: string[] = [];
  const missing: string[] = [];
  for (const name of wanted) (known.has(name) ? kept : missing).push(name);
  return { kept, missing };
}

/** The one-line notice for runs a link named that the library does not have; null when none. */
export function missingNotice(missing: string[]): string | null {
  if (missing.length === 0) return null;
  const shown = missing.slice(0, 3).join(", ") + (missing.length > 3 ? `, and ${missing.length - 3} more` : "");
  return missing.length === 1 ? `Run ${shown} was not found` : `Runs ${shown} were not found`;
}

/** Minimum gap between hash writes of the time while playing (replaceState is rate-limited in some browsers). */
export const PLAY_WRITE_MS = 2000;
/** Settle time after the last seek before a paused time is written. */
export const SEEK_SETTLE_MS = 250;

/**
 * When to write the time into the hash: while playing at most every
 * `PLAY_WRITE_MS`; paused (or seeking), once `SEEK_SETTLE_MS` after the last
 * change. Returns the delay in ms from `now`, never negative.
 */
export function timeWriteDelay(now: number, lastWrite: number, playing: boolean): number {
  if (playing) return Math.max(0, PLAY_WRITE_MS - (now - lastWrite));
  return SEEK_SETTLE_MS;
}
