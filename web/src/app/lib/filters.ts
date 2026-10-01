// Library sections: search, sort, and the two views (by date, by group).
// Pure, so node --test can load it. See UI guidelines L9, L10.

import type { RunRow } from "./types";

export type LibraryView = "date" | "group";
export type SortKey = "newest" | "name" | "longest";

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  name: "Name",
  longest: "Longest",
};

/** Runs shown per section before "Show N more". */
export const SECTION_LIMIT = 5;

export const PINNED_ID = "pinned";
export const UNGROUPED_ID = "group:";

export interface Section {
  id: string;
  title: string;
  kind: "pinned" | "date" | "group" | "ungrouped";
  runs: RunRow[];
}

/** Duration of a row, as the core defines it: the time of the last frame. */
export function duration(r: RunRow): number {
  return Math.max(0, r.n_frames - 1) * r.dt; // same as format.lastFrameTime (no value imports: node --test loads this file)
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const COMPARE: Record<SortKey, (a: RunRow, b: RunRow) => number> = {
  newest: (a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0),
  name: (a, b) => collator.compare(a.name, b.name),
  longest: (a, b) => duration(b) - duration(a),
};

/** Case-insensitive match of every search term against the name, group and record tags. */
export function matchesQuery(r: RunRow, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = `${r.name} ${r.group ?? ""} ${r.tags.join(" ")}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function sorted(rows: RunRow[], sort: SortKey): RunRow[] {
  const cmp = COMPARE[sort];
  return rows.sort((a, b) => cmp(a, b) || collator.compare(a.name, b.name));
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** The date section a recording time falls in, in the viewer's local timezone. */
export function dateBucket(created: string, now: Date = new Date()): { id: string; title: string; rank: number } {
  const t = new Date(created);
  if (Number.isNaN(t.getTime())) return { id: "date:unknown", title: "Undated", rank: -Infinity };
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86400000);
  if (days <= 0) return { id: "date:today", title: "Today", rank: 1e9 };
  if (days === 1) return { id: "date:yesterday", title: "Yesterday", rank: 1e9 - 1 };
  if (days <= 7) return { id: "date:week", title: "Previous 7 days", rank: 1e9 - 2 };
  if (days <= 30) return { id: "date:month", title: "Previous 30 days", rank: 1e9 - 3 };
  const title = t.toLocaleDateString("en", { month: "long", year: "numeric" });
  return { id: `date:${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`, title, rank: t.getFullYear() * 12 + t.getMonth() };
}

export interface SectionOptions {
  view: LibraryView;
  query: string;
  sort: SortKey;
  /** Group names in library order (`GET /api/groups`). */
  groups: readonly string[];
  now?: Date;
}

/** Pinned first, then the date or group sections. Search applies first; empty date sections never appear. */
export function buildSections(rows: readonly RunRow[], o: SectionOptions): Section[] {
  const hits = rows.filter((r) => matchesQuery(r, o.query));
  const out: Section[] = [];
  const pinned = sorted(hits.filter((r) => r.favorite), o.sort);
  if (pinned.length) out.push({ id: PINNED_ID, title: "Pinned", kind: "pinned", runs: pinned });

  if (o.view === "date") {
    const buckets = new Map<string, { title: string; rank: number; runs: RunRow[] }>();
    for (const r of hits) {
      const b = dateBucket(r.created, o.now);
      const hit = buckets.get(b.id) ?? { title: b.title, rank: b.rank, runs: [] };
      hit.runs.push(r);
      buckets.set(b.id, hit);
    }
    const ordered = [...buckets.entries()].sort((a, b) => b[1].rank - a[1].rank);
    for (const [id, b] of ordered) out.push({ id, title: b.title, kind: "date", runs: sorted(b.runs, o.sort) });
    return out;
  }

  const byGroup = new Map<string, RunRow[]>();
  for (const r of hits) {
    const g = r.group ?? "";
    byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
  }
  const listed = new Set(o.groups);
  const extra = [...byGroup.keys()].filter((g) => g && !listed.has(g)).sort((a, b) => collator.compare(a, b));
  for (const g of [...o.groups, ...extra]) {
    const runs = byGroup.get(g) ?? [];
    // An empty group stays visible (to move runs into) unless a search is active.
    if (runs.length === 0 && o.query.trim()) continue;
    out.push({ id: `group:${g}`, title: g, kind: "group", runs: sorted(runs, o.sort) });
  }
  const loose = byGroup.get("") ?? [];
  if (loose.length) out.push({ id: UNGROUPED_ID, title: "Ungrouped", kind: "ungrouped", runs: sorted(loose, o.sort) });
  return out;
}

/** Runs in the order the sidebar lists them, Pinned excluded (its rows repeat the sections'). */
export function flatOrder(sections: readonly Section[]): RunRow[] {
  return sections.filter((s) => s.kind !== "pinned").flatMap((s) => s.runs);
}

/** The next unrated run after `from` in `rows`, wrapping; null if none. */
export function nextUnrated(rows: readonly RunRow[], from: string | null): RunRow | null {
  if (rows.length === 0) return null;
  const start = from === null ? -1 : rows.findIndex((r) => r.name === from);
  for (let i = 1; i <= rows.length; i++) {
    const r = rows[(start + i + rows.length) % rows.length];
    if (r.rating === null && r.name !== from) return r;
  }
  return null;
}

/** The run `delta` places from `from` in `rows` (no wrap past the ends). */
export function stepRun(rows: readonly RunRow[], from: string | null, delta: number): RunRow | null {
  if (rows.length === 0) return null;
  const i = from === null ? -1 : rows.findIndex((r) => r.name === from);
  const j = Math.min(rows.length - 1, Math.max(0, (i < 0 ? (delta > 0 ? -1 : rows.length) : i) + delta));
  return rows[j];
}

/** Splits a run name for middle truncation: the head may be clipped, the last 10 characters never are (L4). */
export function splitName(name: string, tail = 10): [string, string] {
  if (name.length <= tail + 4) return [name, ""];
  return [name.slice(0, name.length - tail), name.slice(name.length - tail)];
}
