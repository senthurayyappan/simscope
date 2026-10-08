import { useEffect } from "react";

import { linkCameras } from "@/lib/core";
import { allPlayers } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { arrangementGrid, effectiveArrangement } from "@/lib/panes";

import { Logo } from "./Logo";
import { Pane } from "./Pane";
import { ViewportToolbar } from "./ViewportToolbar";

export function Viewport() {
  const panes = useApp((s) => s.panes);
  const ready = useApp((s) => s.rowsLoaded);
  const sync = useApp((s) => s.cameraSync);
  const choice = useApp((s) => s.arrange);
  const count = panes.length;

  // Compare: link the panes' cameras as soon as their players exist (before the runs load), so the core
  // frames the group together and keeps ground planes aligned (it refits once each run is decoded).
  useEffect(() => {
    if (count < 2 || !sync) return;
    const players = allPlayers();
    if (players.length < count) return;
    return linkCameras(players);
  }, [count, sync]);

  // Panes fill the viewport in the chosen arrangement; every row and column is equal, so panes keep equal pixel sizes (ground alignment).
  const { cols, rows } = arrangementGrid(count, effectiveArrangement(count, choice));

  return (
    <div className="flex size-full flex-col overflow-hidden bg-viewport">
      {count > 1 ? (
        <div className="flex h-11 shrink-0 items-center justify-end border-b bg-card px-2">
          <ViewportToolbar inline />
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
      {count === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <Logo className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{ready ? "Choose a run from the library, or press N." : "Loading the library."}</p>
        </div>
      ) : (
        <div className="grid size-full gap-px bg-border" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {panes.map((p, i) => (
            <Pane key={`${count > 1 ? "m" : "s"}${i}`} index={i} run={p.name} slot={p.slot} count={count} />
          ))}
        </div>
      )}
      {count <= 1 ? <ViewportToolbar /> : null}
      </div>
    </div>
  );
}
