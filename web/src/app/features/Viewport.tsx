import { useEffect } from "react";

import { linkCameras } from "@/lib/core";
import { allPlayers } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

import { Logo } from "./Logo";
import { Pane } from "./Pane";
import { ViewportToolbar } from "./ViewportToolbar";

export function Viewport() {
  const panes = useApp((s) => s.panes);
  const ready = useApp((s) => s.rowsLoaded);
  const loaded = useApp((s) => Object.keys(s.infos).filter((k) => s.infos[Number(k)]).length);
  const sync = useApp((s) => s.cameraSync);
  const count = panes.length;

  // Compare: link the panes' cameras once every pane has loaded (core keeps ground planes aligned).
  useEffect(() => {
    if (count < 2 || !sync || loaded < count) return;
    const players = allPlayers();
    if (players.length < count) return;
    return linkCameras(players);
  }, [count, sync, loaded]);

  // Three panes sit in a 2 x 2 grid with an empty fourth cell, so none is a sliver.
  const grid = count <= 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2";

  return (
    <div className="flex size-full flex-col overflow-hidden bg-viewport">
      {count > 1 ? (
        <div className="flex h-11 shrink-0 items-center justify-end border-b bg-background px-2">
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
        <div className={cn("grid size-full gap-px bg-border", grid)}>
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
