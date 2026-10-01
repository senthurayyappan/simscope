// Stand-in for the groups API (contracts §8.1) while the server stream is
// unfinished. Active only with `?mock=groups` in the page URL and only when
// `GET /api/groups` answers 404; groups then live in localStorage of this
// browser. Delete this file once the server ships groups.

import type { Annotations, GroupOp, GroupsDoc, RunRow } from "./types";

const KEY = "simscope.mock.groups";

interface State {
  order: string[];
  assign: Record<string, string>;
}

function load(): State {
  try {
    return { order: [], assign: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<State>) };
  } catch {
    return { order: [], assign: {} };
  }
}

function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the mock forgets on reload */
  }
}

export function mockGroupsRequested(): boolean {
  return new URLSearchParams(location.search).get("mock") === "groups";
}

export class MockGroups {
  private s = load();

  /** Rows with the mock's group assignments applied. */
  apply(rows: RunRow[]): RunRow[] {
    return rows.map((r) => ({ ...r, group: this.s.assign[r.name] ?? r.group ?? null }));
  }

  withGroup(name: string, a: Annotations): Annotations {
    return { ...a, marks: { ...a.marks, group: this.s.assign[name] ?? a.marks.group ?? null } };
  }

  assign(name: string, group: string | null) {
    if (group === null) delete this.s.assign[name];
    else {
      this.s.assign[name] = group;
      if (!this.s.order.includes(group)) this.s.order.push(group);
    }
    save(this.s);
  }

  list(rows: RunRow[]): GroupsDoc {
    const counts = new Map<string, number>();
    let ungrouped = 0;
    for (const r of this.apply(rows)) {
      if (r.group) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);
      else ungrouped++;
    }
    const names = [...this.s.order, ...[...counts.keys()].filter((g) => !this.s.order.includes(g)).sort()];
    return { groups: names.map((name) => ({ name, count: counts.get(name) ?? 0 })), ungrouped };
  }

  op(op: GroupOp) {
    const s = this.s;
    if (op.op === "create") {
      if (!s.order.some((g) => g.toLowerCase() === op.name.toLowerCase())) s.order.push(op.name);
    } else if (op.op === "rename") {
      s.order = s.order.map((g) => (g === op.name ? op.to : g));
      for (const k of Object.keys(s.assign)) if (s.assign[k] === op.name) s.assign[k] = op.to;
    } else if (op.op === "delete") {
      s.order = s.order.filter((g) => g !== op.name);
      for (const k of Object.keys(s.assign)) if (s.assign[k] === op.name) delete s.assign[k];
    } else {
      s.order = s.order.filter((g) => g !== op.name);
      s.order.splice(op.index, 0, op.name);
    }
    save(s);
  }
}
