// Pure helpers behind the api: sidecar defaults, run rows, base64. No core
// import, so node --test can load this file.

import type { Annotations, Manifest, RunRow } from "./types";

export const EMPTY_ANNOTATIONS: Annotations = {
  marks: { favorite: false, group: null, tags: [] },
  notes: [],
  ratings: [],
  events: [],
};

/** Fills in the fields a sidecar may omit. */
export function normalizeAnnotations(raw: Partial<Annotations> | null): Annotations {
  return {
    ...raw,
    marks: { ...EMPTY_ANNOTATIONS.marks, ...(raw?.marks ?? {}) },
    notes: raw?.notes ?? [],
    ratings: raw?.ratings ?? [],
    events: raw?.events ?? [],
  };
}

/** The mean `overall` rating of a sidecar, or null when unrated. */
export function meanRating(a: Annotations): number | null {
  const v = a.ratings.filter((r) => r.criterion === "overall").map((r) => r.value);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}

/** Applies a sidecar to a row, so the list updates without a refetch. */
export function rowWithAnnotations(row: RunRow, a: Annotations, recordTags?: string[]): RunRow {
  return {
    ...row,
    favorite: a.marks.favorite,
    group: a.marks.group ?? null,
    rating: meanRating(a),
    tags: recordTags ?? row.tags,
    n_notes: a.notes.length,
  };
}

/** A pack manifest to a row (no annotations applied yet). */
export function manifestToRow(m: Manifest): RunRow {
  return {
    name: m.name,
    id: m.id,
    created: m.created,
    status: m.status,
    dt: m.dt,
    n_frames: m.n_frames,
    n_envs: m.n_envs,
    n_bodies: m.n_bodies,
    favorite: false,
    group: null,
    rating: null,
    tags: m.tags ?? [],
    n_notes: 0,
    n_highlights: null,
    simulator: m.source?.simulator ?? "",
    importer: m.source?.importer ?? "",
    streams: Object.keys(m.streams ?? {}),
  };
}

/** Decodes base64 (whitespace allowed) without building a giant intermediate string twice. */
export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, "");
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
  if (native) return native.call(Uint8Array, clean);
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
