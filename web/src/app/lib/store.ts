// App state. The playback clock is NOT here: it lives in the core's Clock and
// is read through refs in rAF subscribers (viewer v3 §2). This store holds
// what changes at human speed: the library, selection, curation, preferences.

import { create } from "zustand";

import type { Api } from "./api";
import type { FollowMode, RunInfo, ViewName } from "./core";
import { buildSections, flatOrder, nextUnrated, stepRun, type LibraryView, type SortKey } from "./filters";
import { MAX_SLOTS } from "./palette";
import { EMPTY_ANNOTATIONS, rowWithAnnotations } from "./rows";
import { readStore, writeStore } from "./utils";
import type { AnnotationOp, Annotations, GroupOp, GroupsDoc, HighlightsDoc, LibraryInfo, Manifest, RunRow } from "./types";

export type ThemePref = "light" | "dark" | "system";
export type InspectorTab = "plots" | "metadata" | "envs";
export type GroundKind = "checker" | "grid";
export type PlotWindow = "all" | "5" | "2";
export const MAX_COMPARE = MAX_SLOTS;
/** Pinned envs of a single run: the selected env plus three = four series colours. */
export const MAX_PINNED = 3;

export interface PaneRef {
  name: string;
  /** Compare slot 0-3 (A-D); keeps its colour while the run stays picked. */
  slot: number;
}

export interface AppState {
  api: Api | null;
  library: LibraryInfo | null;
  error: string | null;
  seq: number;
  rows: RunRow[];
  rowsLoaded: boolean;
  live: Record<string, number>;
  groups: GroupsDoc | null;

  libraryView: LibraryView;
  query: string;
  sort: SortKey;
  /** Section ids showing all their rows (otherwise 5 + "Show N more"). */
  expanded: string[];
  /** Section ids the user folded. */
  folded: string[];
  cursor: string | null;

  panes: PaneRef[];
  active: number;
  picks: PaneRef[];

  manifest: Manifest | null;
  annotations: Annotations | null;
  /** Highlights per pane index. */
  highlights: Record<number, HighlightsDoc | null | undefined>;
  infos: Record<number, RunInfo | undefined>;
  envs: Record<number, number | undefined>;
  pinned: number[];
  /** Bumped per run name when the server reports it changed (live tail). */
  refresh: Record<string, number>;

  themePref: ThemePref;
  resolvedTheme: "light" | "dark";
  camView: ViewName | null;
  follow: FollowMode;
  /** True once the user picked a follow mode (now or in an earlier session). */
  followChosen: boolean;
  lastFollow: FollowMode;
  groundOn: boolean;
  groundKind: GroundKind;
  visual: boolean;
  collision: boolean;
  contacts: boolean;
  cameraSync: boolean;
  tab: InspectorTab;
  plotWindow: PlotWindow;
  followLive: boolean;
  /** Set while the user types a label at time `t` (M). */
  labelDraft: { t: number; id?: string; text?: string } | null;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineCollapsed: boolean;
}

export interface AppActions {
  init(api: Api, layout?: { runs?: string[]; layout?: string }): Promise<void>;
  refreshRows(): Promise<void>;
  refreshGroups(): Promise<void>;
  setQuery(q: string): void;
  setSort(s: SortKey): void;
  setLibraryView(v: LibraryView): void;
  expandSection(id: string): void;
  toggleFolded(id: string): void;
  setCursor(name: string | null): void;
  openRun(name: string): void;
  openCompare(): void;
  closePane(index: number): void;
  setActive(index: number): void;
  togglePick(name: string): void;
  pickRange(names: string[]): void;
  clearPicks(): void;
  stepRun(delta: number): void;
  openNextUnrated(): void;
  annotate(op: AnnotationOp): Promise<void>;
  annotateRun(name: string, op: AnnotationOp): Promise<void>;
  moveToGroup(names: string[], group: string | null): Promise<void>;
  groupOp(op: GroupOp): Promise<void>;
  setInfo(pane: number, info: RunInfo | undefined): void;
  setEnv(pane: number, env: number): void;
  togglePin(env: number): void;
  setHighlights(pane: number, doc: HighlightsDoc | null): void;
  set(patch: Partial<AppState>): void;
  setTheme(pref: ThemePref): void;
  cycleFollow(): void;
  setFollowMode(mode: FollowMode): void;
  setGroundKind(kind: GroundKind): void;
  poll(): Promise<void>;
}

const lsKey = (k: string) => `simscope.${k}`;

function systemTheme(): "light" | "dark" {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function pick<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = readStore(lsKey(key));
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

const themePref = pick<ThemePref>("theme", ["light", "dark", "system"], "system");
const follow = pick<FollowMode>("follow", ["off", "position", "pose", "heading"], "position");

/** Puts the theme class on <html> now, so anything reading CSS tokens in the same commit sees it. */
export function applyThemeClass(resolved: "light" | "dark"): void {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

/** The lowest compare slot not used by `taken`. */
export function freeSlot(taken: readonly number[]): number {
  for (let i = 0; i < MAX_SLOTS; i++) if (!taken.includes(i)) return i;
  return -1;
}

export const useApp = create<AppState & AppActions>((set, get) => {
  let loadToken = 0;

  /** Fetches manifest and sidecar of the active run (highlights come from its player). */
  async function loadRunData(name: string | undefined) {
    const { api } = get();
    const token = ++loadToken;
    set({ manifest: null, annotations: null });
    if (!api || !name) return;
    try {
      const [manifest, annotations] = await Promise.all([api.manifest(name), api.annotations(name)]);
      if (token === loadToken) set({ manifest, annotations });
    } catch (e) {
      if (token === loadToken) set({ error: (e as Error).message });
    }
  }

  function writeHash(name: string | null) {
    try {
      history.replaceState(null, "", name ? `#run=${encodeURIComponent(name)}` : location.pathname + location.search);
    } catch {
      /* file:// in some browsers */
    }
  }

  function enterRuns(panes: PaneRef[], active = 0) {
    set({ panes, active, cursor: panes[active]?.name ?? null, infos: {}, envs: {}, highlights: {}, pinned: [], labelDraft: null });
    writeHash(panes[active]?.name ?? null);
    void loadRunData(panes[active]?.name);
  }

  /** Replaces one row (after a curation op) without refetching the list. */
  function patchRow(name: string, annotations: Annotations) {
    const { rows, manifest } = get();
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    const next = rowWithAnnotations(row, annotations, row.name === manifest?.name ? manifest.tags : undefined);
    set({ rows: rows.map((r) => (r === row ? next : r)) });
  }

  return {
    api: null,
    library: null,
    error: null,
    seq: 0,
    rows: [],
    rowsLoaded: false,
    live: {},
    groups: null,

    libraryView: pick<LibraryView>("view", ["date", "group"], "date"),
    query: "",
    sort: pick<SortKey>("sort", ["newest", "name", "longest"], "newest"),
    expanded: [],
    folded: [],
    cursor: null,

    panes: [],
    active: 0,
    picks: [],

    manifest: null,
    annotations: null,
    highlights: {},
    infos: {},
    envs: {},
    pinned: [],
    refresh: {},

    themePref,
    resolvedTheme: themePref === "system" ? systemTheme() : themePref,
    camView: "iso",
    follow,
    followChosen: readStore(lsKey("follow")) !== null,
    lastFollow: follow === "off" ? "position" : follow,
    groundOn: readStore(lsKey("ground")) !== "off",
    groundKind: pick<GroundKind>("groundkind", ["checker", "grid"], "checker"),
    visual: true,
    collision: false,
    contacts: false,
    cameraSync: true,
    tab: "plots",
    plotWindow: pick<PlotWindow>("plotwindow", ["all", "5", "2"], "all"),
    followLive: true,
    labelDraft: null,
    leftCollapsed: false,
    rightCollapsed: false,
    timelineCollapsed: false,

    async init(api, layout) {
      set({ api });
      try {
        const [library] = await Promise.all([api.library(), get().refreshRows()]);
        set({ library });
        await get().refreshGroups();
      } catch (e) {
        set({ error: (e as Error).message });
        return;
      }
      const rows = get().rows;
      const hashRun = /[#&]run=([^&]+)/.exec(location.hash)?.[1];
      const want = hashRun ? decodeURIComponent(hashRun) : null;
      const names = new Set(rows.map((r) => r.name));
      if (layout?.layout && layout.layout !== "single" && layout.runs?.length) {
        const picks = layout.runs.filter((n) => names.has(n)).slice(0, MAX_COMPARE);
        if (picks.length > 1) {
          enterRuns(picks.map((name, slot) => ({ name, slot })));
          return;
        }
      }
      if (want && names.has(want)) enterRuns([{ name: want, slot: 0 }]);
      else if (api.mode === "pack" && rows.length > 0) enterRuns([{ name: rows[0].name, slot: 0 }]);
    },

    async refreshRows() {
      const { api } = get();
      if (!api) return;
      const { seq, runs } = await api.runs();
      set({ rows: runs, seq, rowsLoaded: true });
    },

    async refreshGroups() {
      const { api } = get();
      if (!api) return;
      try {
        set({ groups: await api.groups() });
      } catch {
        set({ groups: null });
      }
    },

    setQuery: (query) => set({ query }),
    setSort(sort) {
      writeStore(lsKey("sort"), sort);
      set({ sort });
    },
    setLibraryView(libraryView) {
      writeStore(lsKey("view"), libraryView);
      set({ libraryView });
    },
    expandSection: (id) => set({ expanded: get().expanded.includes(id) ? get().expanded : [...get().expanded, id] }),
    toggleFolded(id) {
      const { folded } = get();
      set({ folded: folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id] });
    },
    setCursor: (cursor) => set({ cursor }),

    openRun(name) {
      const { panes } = get();
      if (panes.length === 1 && panes[0].name === name) return;
      enterRuns([{ name, slot: 0 }]);
    },

    openCompare() {
      const picks = [...get().picks].sort((a, b) => a.slot - b.slot);
      if (picks.length < 2) return;
      enterRuns(picks);
      set({ picks: [] });
    },

    closePane(index) {
      const { panes, active } = get();
      if (panes.length <= 1) return;
      const next = panes.filter((_, i) => i !== index);
      enterRuns(next, Math.min(active === index ? 0 : active > index ? active - 1 : active, next.length - 1));
    },

    setActive(index) {
      const { panes, active } = get();
      if (index === active || index >= panes.length) return;
      set({ active: index, cursor: panes[index].name, pinned: [], labelDraft: null });
      writeHash(panes[index].name);
      void loadRunData(panes[index].name);
    },

    togglePick(name) {
      const { picks } = get();
      if (picks.some((p) => p.name === name)) {
        set({ picks: picks.filter((p) => p.name !== name) });
        return;
      }
      const slot = freeSlot(picks.map((p) => p.slot));
      if (slot >= 0) set({ picks: [...picks, { name, slot }] });
    },

    pickRange(names) {
      let picks = [...get().picks];
      for (const name of names) {
        if (picks.some((p) => p.name === name)) continue;
        const slot = freeSlot(picks.map((p) => p.slot));
        if (slot < 0) break;
        picks = [...picks, { name, slot }];
      }
      set({ picks });
    },

    clearPicks: () => set({ picks: [] }),

    stepRun(delta) {
      const { rows, panes, active, cursor, query, sort, libraryView, groups } = get();
      const list = flatOrder(buildSections(rows, { view: libraryView, query, sort, groups: groups?.groups.map((g) => g.name) ?? [] }));
      const next = stepRun(list, panes[active]?.name ?? cursor, delta);
      if (next) get().openRun(next.name);
    },

    openNextUnrated() {
      const { rows, panes, active, query, sort, libraryView, groups } = get();
      const list = flatOrder(buildSections(rows, { view: libraryView, query, sort, groups: groups?.groups.map((g) => g.name) ?? [] }));
      const next = nextUnrated(list, panes[active]?.name ?? null);
      if (next) get().openRun(next.name);
    },

    async annotate(op) {
      const name = get().panes[get().active]?.name;
      if (name) await get().annotateRun(name, op);
    },

    async annotateRun(name, op) {
      const { api } = get();
      if (!api?.writable) return;
      try {
        const annotations = await api.annotate(name, op);
        patchRow(name, annotations);
        if (get().panes[get().active]?.name === name) set({ annotations });
        if (op.op === "group") await get().refreshGroups();
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    async moveToGroup(names, group) {
      const { api } = get();
      if (!api?.writable) return;
      try {
        if (group) await api.groupOp({ op: "create", name: group }).catch(() => undefined);
        for (const n of names) await get().annotateRun(n, { op: "group", value: group });
        await get().refreshGroups();
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    async groupOp(op) {
      const { api } = get();
      if (!api?.writable) return;
      try {
        set({ groups: await api.groupOp(op) });
        await get().refreshRows();
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    setInfo: (pane, info) => set({ infos: { ...get().infos, [pane]: info } }),

    setEnv(pane, env) {
      if (get().envs[pane] === env) return;
      set({ envs: { ...get().envs, [pane]: env } });
    },

    togglePin(env) {
      const { pinned } = get();
      if (pinned.includes(env)) set({ pinned: pinned.filter((e) => e !== env) });
      else if (pinned.length < MAX_PINNED) set({ pinned: [...pinned, env] });
    },

    setHighlights: (pane, doc) => set({ highlights: { ...get().highlights, [pane]: doc } }),
    set: (patch) => set(patch),

    setTheme(pref) {
      writeStore(lsKey("theme"), pref);
      const resolvedTheme = pref === "system" ? systemTheme() : pref;
      applyThemeClass(resolvedTheme);
      set({ themePref: pref, resolvedTheme });
    },

    cycleFollow() {
      const { follow, lastFollow } = get();
      get().setFollowMode(follow === "off" ? lastFollow : "off");
    },

    setFollowMode(mode) {
      writeStore(lsKey("follow"), mode);
      set({ followChosen: true, follow: mode, lastFollow: mode === "off" ? get().lastFollow : mode });
    },

    setGroundKind(kind) {
      writeStore(lsKey("groundkind"), kind);
      set({ groundKind: kind });
    },

    async poll() {
      const { api, seq, panes } = get();
      if (!api || api.mode !== "http") return;
      const ch = await api.changes(seq);
      if (!ch) return;
      const liveChanged = JSON.stringify(ch.live) !== JSON.stringify(get().live);
      if (ch.seq !== seq || ch.changed.length || ch.removed.length) {
        try {
          await get().refreshRows();
        } catch {
          /* transient; the next poll retries */
        }
      }
      if (liveChanged) set({ live: ch.live });
      const touched = panes.filter((p) => ch.changed.includes(p.name) || p.name in ch.live);
      if (touched.length) {
        const refresh = { ...get().refresh };
        for (const p of touched) refresh[p.name] = (refresh[p.name] ?? 0) + 1;
        set({ refresh });
        const cur = panes[get().active]?.name;
        if (cur && touched.some((p) => p.name === cur)) {
          const [manifest, annotations] = await Promise.all([api.manifest(cur), api.annotations(cur)]).catch(
            () => [null, null] as const,
          );
          if (manifest) set({ manifest, annotations: annotations ?? EMPTY_ANNOTATIONS });
        }
      }
    },
  };
});

/** The run open in the active pane. */
export function useActiveRun(): string | null {
  return useApp((s) => s.panes[s.active]?.name ?? null);
}
