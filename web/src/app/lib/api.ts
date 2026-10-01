// Data access for the app: one interface, two implementations. `HttpApi`
// talks to `simscope serve` (contracts §2); `PackApi` derives the same rows
// from an inline pack and is read-only.

import { createHttpSource, createPackSource, readJson, type Source } from "./core";
import { MockGroups, mockGroupsRequested } from "./mock-groups";
import { RenameError, renameMessage } from "./rename";
import {
  decodeBase64,
  manifestToRow,
  normalizeAnnotations,
  rowWithAnnotations,
} from "./rows";
import type {
  AnnotationOp,
  Annotations,
  Changes,
  GroupOp,
  GroupsDoc,
  HighlightsDoc,
  LibraryInfo,
  Manifest,
  RunRow,
} from "./types";

export interface Boot {
  mode: "http" | "pack";
  base?: string;
  token?: string;
  library?: string;
  writable?: boolean;
  pack?: string;
  runs?: string[];
  layout?: "single" | "grid" | "compare";
  /** Compare arrangement of a full export (contracts §10.2). */
  arrange?: "side" | "stack" | "grid";
}

export interface ExportOptions {
  runs: string[];
  layout: "single" | "grid" | "compare";
  ui: "lean" | "full";
  /** The compare arrangement being shown; sent as `arrange` (contracts §10.2). */
  arrange?: "side" | "stack" | "grid";
}

export interface Api {
  readonly mode: "http" | "pack";
  readonly writable: boolean;
  readonly source: Source;
  library(): Promise<LibraryInfo>;
  runs(): Promise<{ seq: number; runs: RunRow[] }>;
  changes(since: number): Promise<Changes | null>;
  manifest(name: string): Promise<Manifest>;
  annotations(name: string): Promise<Annotations>;
  annotate(name: string, op: AnnotationOp): Promise<Annotations>;
  /** Groups in library order, or null when this source has none (old server, read-only export without groups). */
  groups(): Promise<GroupsDoc | null>;
  groupOp(op: GroupOp): Promise<GroupsDoc>;
  /** Renames a run; throws `RenameError`. Read-only sources cannot (contracts §11.1). */
  rename(name: string, to: string): Promise<string>;
  /** A download URL (http mode only). */
  exportUrl(opts: ExportOptions): string | null;
}

export class PackApi implements Api {
  readonly mode = "pack" as const;
  readonly writable = false;
  private names: string[];
  private cache = new Map<string, RunRow>();

  constructor(
    readonly source: Source,
    names: string[],
    private title: string,
  ) {
    this.names = names;
  }

  async library(): Promise<LibraryInfo> {
    const names = await this.runNames();
    return { name: this.title, root: "", n_runs: names.length, seq: 0, writable: false };
  }

  private async runNames(): Promise<string[]> {
    if (this.names.length === 0) this.names = await this.source.runs();
    return this.names;
  }

  async manifest(name: string): Promise<Manifest> {
    const m = await readJson<Manifest>(this.source, `runs/${name}/rollout.json`);
    if (!m) throw new Error(`run ${name} is not in this pack`);
    return m;
  }

  async annotations(name: string): Promise<Annotations> {
    return normalizeAnnotations(await readJson<Annotations>(this.source, `runs/${name}/annotations.json`));
  }

  async runs(): Promise<{ seq: number; runs: RunRow[] }> {
    const names = await this.runNames();
    const rows = await Promise.all(
      names.map(async (name) => {
        const hit = this.cache.get(name);
        if (hit) return hit;
        const m = await this.manifest(name);
        const a = await this.annotations(name);
        const h = await readJson<HighlightsDoc>(this.source, `derived/${name}/highlights.json`).catch(() => null);
        const row = rowWithAnnotations(manifestToRow(m), a, m.tags ?? []);
        row.n_highlights = h ? h.highlights.length : null;
        this.cache.set(name, row);
        return row;
      }),
    );
    return { seq: 0, runs: rows };
  }

  async changes(): Promise<Changes | null> {
    return null;
  }

  async groups(): Promise<GroupsDoc | null> {
    const { runs } = await this.runs();
    const counts = new Map<string, number>();
    let ungrouped = 0;
    for (const r of runs) {
      if (r.group) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
      else ungrouped++;
    }
    const groups = [...counts.keys()].sort().map((name) => ({ name, count: counts.get(name) ?? 0 }));
    return { groups, ungrouped };
  }

  async groupOp(): Promise<GroupsDoc> {
    throw new Error("this export is read-only");
  }

  async annotate(): Promise<Annotations> {
    throw new Error("this export is read-only");
  }

  async rename(): Promise<string> {
    throw new Error("this export is read-only");
  }

  exportUrl(): string | null {
    return null;
  }
}

export class HttpApi implements Api {
  readonly mode = "http" as const;
  readonly source: Source;
  private mock: MockGroups | null = null;
  private rows: RunRow[] = [];

  constructor(
    private base: string,
    private token: string,
    readonly writable: boolean,
  ) {
    this.source = createHttpSource(base);
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, { cache: "no-cache", ...init });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = ((await res.json()) as { error?: string }).error ?? msg;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  }

  library() {
    return this.json<LibraryInfo>("/api/library");
  }

  async runs() {
    const doc = await this.json<{ seq: number; runs: RunRow[] }>("/api/runs");
    if (this.mock) doc.runs = this.mock.apply(doc.runs);
    this.rows = doc.runs;
    return doc;
  }

  async groups(): Promise<GroupsDoc | null> {
    const res = await fetch(`${this.base}/api/groups`, { cache: "no-cache" });
    if (res.ok) return (await res.json()) as GroupsDoc;
    if (res.status === 404 && mockGroupsRequested()) {
      this.mock ??= new MockGroups();
      if (this.rows.length) this.rows = this.mock.apply(this.rows);
      return this.mock.list(this.rows);
    }
    return null;
  }

  async groupOp(op: GroupOp): Promise<GroupsDoc> {
    if (this.mock) {
      this.mock.op(op);
      return this.mock.list(this.rows);
    }
    return this.json<GroupsDoc>("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Simscope-Token": this.token },
      body: JSON.stringify(op),
    });
  }

  async changes(since: number): Promise<Changes | null> {
    try {
      return await this.json<Changes>(`/api/changes?since=${since}`);
    } catch {
      return null; // server restarting; the next poll retries
    }
  }

  async manifest(name: string): Promise<Manifest> {
    const m = await readJson<Manifest>(this.source, `runs/${name}/rollout.json`);
    if (!m) throw new Error(`run ${name} has no manifest`);
    return m;
  }

  async annotations(name: string): Promise<Annotations> {
    const a = normalizeAnnotations(await readJson<Annotations>(this.source, `runs/${name}/annotations.json`));
    return this.mock ? this.mock.withGroup(name, a) : a;
  }

  async annotate(name: string, op: AnnotationOp): Promise<Annotations> {
    if (this.mock && op.op === "group") {
      this.mock.assign(name, op.value);
      return this.annotations(name);
    }
    const a = await this.json<Annotations>(`/api/runs/${encodeURIComponent(name)}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Simscope-Token": this.token },
      body: JSON.stringify(op),
    });
    const out = normalizeAnnotations(a);
    return this.mock ? this.mock.withGroup(name, out) : out;
  }

  async rename(name: string, to: string): Promise<string> {
    const res = await fetch(`${this.base}/api/runs/${encodeURIComponent(name)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Simscope-Token": this.token },
      body: JSON.stringify({ to }),
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        msg = ((await res.json()) as { error?: string }).error ?? msg;
      } catch {
        /* non-JSON error body */
      }
      throw new RenameError(res.status, renameMessage(res.status, msg));
    }
    return ((await res.json()) as { name: string }).name;
  }

  exportUrl({ runs, layout, ui, arrange }: ExportOptions): string {
    const q = new URLSearchParams({ runs: runs.join(","), layout, ui });
    if (arrange && runs.length > 1) q.set("arrange", arrange);
    return `${this.base}/api/export?${q}`;
  }
}

/** Reads the boot block the server or exporter put in the page. */
export function readBoot(): Boot {
  const el = document.getElementById("simscope-boot");
  if (!el?.textContent) return { mode: "http", base: "", token: "", writable: false };
  return JSON.parse(el.textContent) as Boot;
}

/** Builds the Api for a boot block. */
export async function createApi(boot: Boot): Promise<Api> {
  if (boot.mode === "pack") {
    const id = (boot.pack ?? "#simscope-pack").replace(/^#/, "");
    const el = document.getElementById(id);
    if (!el?.textContent) throw new Error(`this export file has no run data (#${id} is missing)`);
    const source = await createPackSource(decodeBase64(el.textContent));
    return new PackApi(source, boot.runs ?? [], boot.library ?? "Export");
  }
  return new HttpApi(boot.base ?? "", boot.token ?? "", !!boot.writable);
}
