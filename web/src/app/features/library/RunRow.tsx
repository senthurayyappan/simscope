import { memo } from "react";
import { Ellipsis } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { shortName } from "@/lib/filters";
import { formatDuration, lastFrameTime } from "@/lib/format";
import { MAX_COMPARE, useApp } from "@/lib/store";
import { seriesVar, SLOT_LETTERS } from "@/lib/palette";
import type { RunRow as Row } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RunDropdownMenu } from "./RunMenu";

export interface RunRowProps {
  run: Row;
  active: boolean;
  cursor: boolean;
  /** Compare slot (A-D) while picked or open in a compare pane; else -1. */
  slot: number;
  picked: boolean;
  liveFrames: number | undefined;
  onOpen(run: Row, e: React.MouseEvent): void;
  onPick(run: Row): void;
  onNewGroup(names: string[]): void;
}

/**
 * One library row (I8): the name, cut at 16 characters with `…` (the full name
 * in a tooltip), and the duration. The selection ring is an inset shadow, so a
 * neighbour's hover background or the sticky header can never paint over it.
 */
export const RunRowItem = memo(function RunRowItem(p: RunRowProps) {
  const { run } = p;
  const live = run.status === "recording";
  const frames = live ? (p.liveFrames ?? run.n_frames) : run.n_frames;
  const { text, cut } = shortName(run.name);
  const name = <span className="min-w-0 flex-1 truncate">{text}</span>;
  return (
    <div
      role="option"
      aria-selected={p.active}
      data-active={p.active || undefined}
      data-cursor={p.cursor || undefined}
      onClick={(e) => p.onOpen(run, e)}
      className={cn(
        "group/row relative my-px flex h-8 w-full items-center gap-2 rounded-md pl-1.5 pr-1.5 text-sm transition-colors hover:bg-sidebar-accent data-[active]:z-10 data-[active]:bg-sidebar-accent data-[active]:font-medium",
        "group-focus-within/list:data-[cursor]:z-10 group-focus-within/list:data-[cursor]:shadow-[inset_0_0_0_2px_color-mix(in_oklab,var(--sidebar-ring)_70%,transparent)]",
      )}
    >
      {/* The pick box is always the first thing on the row, at the same x on every row, so picking never moves a name. */}
      <div className="flex w-4 shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
        <PickBox run={run} picked={p.picked} onPick={p.onPick} />
      </div>
      {cut ? (
        <Tooltip>
          <TooltipTrigger asChild>{name}</TooltipTrigger>
          <TooltipContent side="right">{run.name}</TooltipContent>
        </Tooltip>
      ) : (
        name
      )}
      {live ? <span className="size-1.5 shrink-0 rounded-full bg-destructive animate-pulse-dot" title="Recording" /> : null}
      {p.slot >= 0 ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={`Run ${SLOT_LETTERS[p.slot]}`}>
          <span className="size-2 rounded-full" style={{ background: seriesVar(p.slot) }} />
          {SLOT_LETTERS[p.slot]}
        </span>
      ) : null}
      <span className="num shrink-0 text-xs text-muted-foreground group-hover/row:hidden group-has-[[data-state=open]]/row:hidden">
        {formatDuration(lastFrameTime(frames, run.dt))}
      </span>
      <div className="hidden shrink-0 items-center group-hover/row:flex has-[[data-state=open]]:flex" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-6" aria-label={`Actions for ${run.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <RunDropdownMenu run={run} onNewGroup={p.onNewGroup} />
        </DropdownMenu>
      </div>
    </div>
  );
});

function PickBox({ run, picked, onPick }: { run: Row; picked: boolean; onPick(r: Row): void }) {
  const full = useApp((s) => s.picks.length >= MAX_COMPARE);
  const box = (
    <Checkbox
      checked={picked}
      disabled={full && !picked}
      onCheckedChange={() => onPick(run)}
      aria-label={`Compare ${run.name}`}
      // Faint at rest, stronger when the row is hovered, strongest under the pointer.
      className="data-[state=unchecked]:border-muted-foreground/35 data-[state=unchecked]:group-hover/row:border-muted-foreground/80 data-[state=unchecked]:hover:border-foreground"
    />
  );
  if (!full || picked) return box;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{box}</span>
      </TooltipTrigger>
      <TooltipContent side="right">Compare takes up to {MAX_COMPARE} runs</TooltipContent>
    </Tooltip>
  );
}
