// Data shapes the app reads (viewer v3 contracts §2, §4, §5). RunRow is what
// `/api/runs` returns; in pack mode the same shape is derived from the pack.

export interface RunRow {
  name: string;
  id: string;
  created: string;
  status: "complete" | "recording" | string;
  dt: number;
  n_frames: number;
  n_envs: number;
  n_bodies: number;
  favorite: boolean;
  /** The run's group (viewer v3.1), or null. */
  group?: string | null;
  rating: number | null;
  /** Record-time tags only; shown in Metadata, never as chips. */
  tags: string[];
  n_notes: number;
  n_highlights: number | null;
  simulator: string;
  importer: string;
  streams: string[];
}

export interface LibraryInfo {
  name: string;
  root: string;
  n_runs: number;
  seq: number;
  writable: boolean;
}

export interface Changes {
  seq: number;
  changed: string[];
  removed: string[];
  live: Record<string, number>;
}

export interface Note {
  id: string;
  author: string;
  created: string;
  updated: string;
  text: string;
}

export interface Rating {
  id: string;
  criterion: string;
  scale: string;
  value: number;
}

/** A user label at a moment (an untyped event, D26). */
export interface MarkEvent {
  id: string;
  type: string;
  label: string;
  t0: number;
  t1: number;
  env: number | null;
}

export interface Annotations {
  format?: string;
  run_id?: string;
  marks: { favorite: boolean; group?: string | null; tags: string[] };
  notes: Note[];
  ratings: Rating[];
  events: MarkEvent[];
}

export type AnnotationOp =
  | { op: "favorite"; value: boolean }
  | { op: "rate"; value: number }
  | { op: "group"; value: string | null }
  | { op: "note_add"; text: string }
  | { op: "event_add"; t0: number; t1: number | null; type: ""; label: string; env: number | null }
  | { op: "event_update"; id: string; label?: string; t0?: number; t1?: number | null }
  | { op: "remove"; id: string };

/** `GET /api/groups` (contracts §8.1). */
export interface GroupsDoc {
  groups: { name: string; count: number }[];
  ungrouped: number;
}

export type GroupOp =
  | { op: "create"; name: string }
  | { op: "rename"; name: string; to: string }
  | { op: "delete"; name: string }
  | { op: "move"; name: string; index: number };

export interface StreamInfo {
  file: string;
  kind: string;
  item_shape: number[];
  labels?: string[];
  units?: string;
}

/** The fields of rollout.json the app shows. */
export interface Manifest {
  id: string;
  name: string;
  created: string;
  status: string;
  dt: number;
  n_frames: number;
  n_envs: number;
  n_bodies: number;
  streams: Record<string, StreamInfo>;
  source?: { simulator?: string; importer?: string; version?: string; original?: string };
  tags?: string[];
  meta?: Record<string, unknown>;
}

import type { EnvelopeDoc, HighlightEntry, HighlightsDoc, SummariesDoc } from "./core";

export type Highlight = HighlightEntry;
export type { EnvelopeDoc, HighlightsDoc, SummariesDoc };
