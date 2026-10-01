// Pure helpers for the compare view: which per-pane state survives a change of
// panes, and how panes are arranged (contracts §10.1).

export type Arrangement = "side" | "stack" | "grid";
export const ARRANGEMENTS: readonly Arrangement[] = ["side", "stack", "grid"];

export const ARRANGE_LABELS: Record<Arrangement, string> = {
  side: "Side by side",
  stack: "Stacked",
  grid: "Grid",
};

/** `side` for two runs, `grid` for three or four (10.1). */
export function defaultArrangement(count: number): Arrangement {
  return count <= 2 ? "side" : "grid";
}

/** The arrangement shown for `count` panes: the user's choice, else the default. */
export function effectiveArrangement(count: number, choice: Arrangement | null): Arrangement {
  return choice ?? defaultArrangement(count);
}

/** Rows and columns of the pane grid. A grid of two panes is two columns; of three, 2 x 2 with one empty cell. */
export function arrangementGrid(count: number, arrange: Arrangement): { cols: number; rows: number } {
  const n = Math.max(1, count);
  if (n === 1) return { cols: 1, rows: 1 };
  switch (arrange) {
    case "side":
      return { cols: n, rows: 1 };
    case "stack":
      return { cols: 1, rows: n };
    default:
      return n === 2 ? { cols: 2, rows: 1 } : { cols: 2, rows: 2 };
  }
}

export function isArrangement(v: unknown): v is Arrangement {
  return v === "side" || v === "stack" || v === "grid";
}

interface Named {
  name: string;
}

/**
 * Per-pane state (RunInfo, selected env, highlights) is keyed by pane index.
 * When the set of panes changes, the panes whose index and run are unchanged
 * keep their React component and do NOT reload, so their state must survive;
 * everything else is dropped and refilled when its pane loads. (Wiping all of
 * it left only the new panes with a timeline lane and plots.)
 */
export function carryPaneState<T>(
  prev: readonly Named[],
  next: readonly Named[],
  state: Record<number, T | undefined>,
): Record<number, T | undefined> {
  const out: Record<number, T | undefined> = {};
  next.forEach((p, i) => {
    if (prev[i]?.name === p.name && state[i] !== undefined) out[i] = state[i];
  });
  return out;
}
