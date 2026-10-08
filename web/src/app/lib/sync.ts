// Keeps the three places of guideline P7 up to date while the app runs:
// preferences (localStorage), this tab's workspace (sessionStorage) and the
// URL hash. Nothing here is React state; it listens to the store, the clock,
// the players and the timeline, and writes late and rarely (never per frame).
// Reading back is `plan.ts` (what to restore) and `restore.ts` (applying it).

import { formatHash, timeWriteDelay } from "./hash";
import { effectiveArrangement } from "./panes";
import { isQuiet, prefs, workspace, type Prefs, type SavedCamera, type Session } from "./persist";
import { currentPending } from "./plan";
import { getClock, playerAt } from "./runtime";
import { useApp, type AppState } from "./store";
import { getTimelineView, subscribeTimelineView, viewSettled } from "./timeline-view";

// ---- preferences ----

/** Store fields that are preferences, and the key each is saved under. */
const PREF_FIELDS = {
  themePref: "theme",
  libraryView: "view",
  sort: "sort",
  folded: "folded",
  visual: "visual",
  collision: "collision",
  contacts: "contacts",
  groundOn: "groundOn",
  groundKind: "groundKind",
  groundColor: "groundColor",
  cameraSync: "cameraSync",
  plotWindow: "plotWindow",
  follow: "follow",
  arrange: "arrange",
} as const satisfies Partial<Record<keyof AppState, keyof Prefs>>;

function writePrefs(s: AppState, prev: AppState): void {
  if (isQuiet()) return;
  const change: Record<string, unknown> = {};
  for (const [field, key] of Object.entries(PREF_FIELDS) as [keyof typeof PREF_FIELDS, keyof Prefs][]) {
    if (s[field] === prev[field]) continue;
    // A follow mode is a preference only once the user chose one; "no choice yet" for the arrangement is not saved.
    if (field === "follow" && !s.followChosen) continue;
    if (field === "arrange" && s.arrange === null) continue;
    change[key] = s[field];
  }
  if (Object.keys(change).length) prefs.patch(change as Partial<Prefs>);
}

// ---- the URL hash ----

let hashOn = false;
let lastHash: string | null = null;
let lastWrite = 0;
let hashTimer = 0;

/** The hash for the open view, from the store and the clock. */
export function currentHash(): string {
  const s = useApp.getState();
  const runs = s.panes.map((p) => p.name);
  return formatHash({
    runs,
    arrange: runs.length > 1 ? effectiveArrangement(runs.length, s.arrange) : null,
    // Until the restored time is applied, the clock still reads 0; keep the time the link asked for.
    t: currentPending()?.t ?? getClock().time,
    tab: s.tab,
  });
}

function writeHash(): void {
  clearTimeout(hashTimer);
  hashTimer = 0;
  if (!hashOn) return;
  const next = currentHash();
  lastWrite = performance.now();
  if (next === lastHash) return;
  lastHash = next;
  try {
    history.replaceState(null, "", next || location.pathname + location.search);
  } catch {
    /* file:// in some browsers, or rate-limited: the link is simply not updated */
  }
}

function scheduleHash(): void {
  if (!hashOn || hashTimer) return;
  const delay = timeWriteDelay(performance.now(), lastWrite, getClock().playing);
  hashTimer = window.setTimeout(writeHash, delay);
}

// ---- the workspace ----

/** Text typed and not yet sent, kept outside React so a reload can recover it. */
const drafts = { labelText: null as string | null, renameText: null as string | null };

/** Called by the label field on every keystroke. */
export function setLabelText(text: string): void {
  drafts.labelText = text;
  scheduleSession();
}

/** Called by the rename field on every keystroke. */
export function setRenameText(text: string): void {
  drafts.renameText = text;
  scheduleSession();
}

/** The unsent note for a run, or "". */
export function noteDraft(run: string | null): string {
  return run ? (workspace.read().notes[run] ?? "") : "";
}

export function setNoteDraft(run: string | null, text: string): void {
  if (!run) return;
  const notes = { ...workspace.read().notes };
  if (text) notes[run] = text;
  else delete notes[run];
  workspace.patch({ notes });
}

/** The saved scroll offset of a container, or 0. */
export function savedScroll(id: string): number {
  return workspace.read().scroll[id] ?? 0;
}

export function setScroll(id: string, y: number): void {
  const scroll = workspace.read().scroll;
  if (Math.abs((scroll[id] ?? 0) - y) < 1) return;
  workspace.patch({ scroll: { ...scroll, [id]: Math.round(y) } });
  scheduleSession();
}

let sessionTimer = 0;

/** Writes the workspace soon. */
export function scheduleSession(): void {
  if (sessionTimer) return;
  sessionTimer = window.setTimeout(saveSession, 500);
}

function saveSession(): void {
  clearTimeout(sessionTimer);
  sessionTimer = 0;
  const s = useApp.getState();
  if (!hashOn) return; // still starting up: the saved workspace is what we are about to restore
  const clock = getClock();
  const change: Partial<Session> = {
    runs: s.panes.map((p) => p.name),
    active: s.active,
    picks: s.picks,
    pinned: s.pinned,
    query: s.query,
    expanded: s.expanded,
    label: s.labelDraft ? { t: s.labelDraft.t, id: s.labelDraft.id, text: drafts.labelText ?? s.labelDraft.text ?? "" } : null,
    rename: s.renaming ? { name: s.renaming.name, text: drafts.renameText ?? s.renaming.text ?? s.renaming.name } : null,
  };
  // Until the panes have applied the restored camera and time, the old values stand.
  if (!currentPending()) {
    const cams: (SavedCamera | null)[] = s.panes.map((_, i) => {
      const p = playerAt(i);
      if (!p || !s.infos[i] || !p.cameraState) return null;
      return { state: p.cameraState() as SavedCamera["state"], env: s.envs[i] ?? 0 };
    });
    const r = clock.loopRegion;
    const v = getTimelineView();
    Object.assign(change, {
      cams,
      playing: clock.playing,
      t: clock.time,
      loop: r ? [r[0], r[1]] : null,
    });
    // Before the timeline has fitted the run its span is a placeholder: keep what was saved.
    if (viewSettled() && v.t1 > v.t0) change.view = [v.t0, v.t1];
  }
  workspace.patch(change);
}

// ---- wiring ----

let started = false;

/**
 * Starts the listeners and applies the saved speed and loop. Call once, before
 * the library is read; `enableSync` after the first view is open.
 */
export function startSync(): void {
  if (started) return;
  started = true;
  const clock = getClock();
  const saved = prefs.read();
  if (saved.speed !== undefined) clock.speed = saved.speed;
  if (saved.loop !== undefined) clock.loop = saved.loop;

  useApp.subscribe((s, prev) => {
    writePrefs(s, prev);
    if (s.panes !== prev.panes || s.arrange !== prev.arrange || s.tab !== prev.tab) writeHash();
    if (
      s.panes !== prev.panes ||
      s.active !== prev.active ||
      s.picks !== prev.picks ||
      s.pinned !== prev.pinned ||
      s.query !== prev.query ||
      s.expanded !== prev.expanded ||
      s.labelDraft !== prev.labelDraft ||
      s.renaming !== prev.renaming ||
      s.envs !== prev.envs
    ) {
      if (s.labelDraft !== prev.labelDraft) drafts.labelText = null;
      if (s.renaming?.name !== prev.renaming?.name) drafts.renameText = null;
      scheduleSession();
    }
  });

  let speed = clock.speed;
  let loop = clock.loop;
  clock.addEventListener("state", () => {
    if (clock.speed !== speed || clock.loop !== loop) {
      speed = clock.speed;
      loop = clock.loop;
      prefs.patch({ speed, loop });
    }
    // Pausing writes the exact time; starting restarts the 2 s rhythm.
    if (clock.playing) scheduleHash();
    else writeHash();
    scheduleSession();
  });
  clock.addEventListener("time", () => scheduleHash());
  subscribeTimelineView(() => scheduleSession());

  const flush = () => {
    writeHash();
    saveSession();
    workspace.flush();
  };
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** The first view is open (or there is none): from now on the hash and workspace follow the app. */
export function enableSync(): void {
  hashOn = true;
  writeHash();
}
