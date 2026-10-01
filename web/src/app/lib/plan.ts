// What this page load was asked to restore (guideline P7): the URL hash and
// this tab's saved workspace, read once at start, before anything rewrites
// them. The store reads it to open the right runs; `restore.ts` applies the
// rest (cameras, time, drafts) as each pane finishes loading. No imports from
// the store, so both may import this file.

import { parseHash, type ViewHash } from "./hash";
import { sessionMatches, workspace, type SavedCamera, type Session } from "./persist";

function readHash(): ViewHash {
  try {
    return parseHash(location.hash);
  } catch {
    return parseHash("");
  }
}

/** The hash and the workspace as they were when the page loaded. */
export const plan: { hash: ViewHash; session: Session } = {
  hash: readHash(),
  session: workspace.read(),
};

/** What is still to be applied to the panes that are loading. */
export interface Pending {
  runs: string[];
  cams: (SavedCamera | null)[];
  /** Pane indices that have not finished loading. */
  waiting: Set<number>;
  t: number;
  playing: boolean;
  loop: [number, number] | null;
  view: [number, number] | null;
  pinned: number[];
  label: Session["label"];
}

let pending: Pending | null = null;

/**
 * Prepares the restore for the runs the page is about to open. The workspace
 * only applies to the same runs in the same order (a link to other runs, or a
 * run that went away, starts that view fresh); the time comes from the hash.
 */
export function armRestore(runs: string[], hashT: number | null): void {
  const s = plan.session;
  const same = sessionMatches(s, runs);
  pending = {
    runs,
    cams: same ? s.cams : [],
    waiting: new Set(runs.map((_, i) => i)),
    t: hashT ?? (same ? (s.t ?? 0) : 0),
    playing: same && s.playing,
    loop: same ? s.loop : null,
    view: same ? s.view : null,
    pinned: same ? s.pinned : [],
    label: same ? s.label : null,
  };
}

export function currentPending(): Pending | null {
  return pending;
}

export function clearPending(): void {
  pending = null;
}

/** The saved camera for a pane, if it still belongs to that run. */
export function savedCamera(index: number, run: string): SavedCamera | null {
  return pending && pending.runs[index] === run ? (pending.cams[index] ?? null) : null;
}

/**
 * A pane finished loading (or failed). Returns the pending restore when it
 * was the last one awaited, so the caller can apply what needs every pane
 * (time, loop, timeline span); null otherwise.
 */
export function paneSettled(index: number, run: string): Pending | null {
  const p = pending;
  if (!p || p.runs[index] !== run || !p.waiting.delete(index)) return null;
  if (p.waiting.size > 0) return null;
  pending = null;
  return p;
}
