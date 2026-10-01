import { memo } from "react";
import { Ellipsis } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { splitName } from "@/lib/filters";
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
  pickMode: boolean;
  liveFrames: number | undefined;
  onOpen(run: Row, e: React.MouseEvent): void;
  onPick(run: Row): void;
  onNewGroup(names: string[]): void;
}

/** One library row (I8): the middle-truncated name and the duration; nothing else. */
export const RunRowItem = memo(function RunRowItem(p: RunRowProps) {
  const { run } = p;
  const live = run.status === "recording";
  const frames = live ? (p.liveFrames ?? run.n_frames) : run.n_frames;
  const [head, tail] = splitName(run.name);
  return (
    <div
      role="option"
      aria-selected={p.active}
      data-active={p.active || undefined}
      data-cursor={p.cursor || undefined}
      onClick={(e) => p.onOpen(run, e)}
      title={run.name}
      className={cn(
        "group/row relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-sidebar-accent data-[active]:bg-sidebar-accent data-[active]:font-medium",
        "group-focus-within/list:data-[cursor]:ring-2 group-focus-within/list:data-[cursor]:ring-sidebar-ring/60",
      )}
    >
      <div className="flex w-[22px] shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
        {p.slot >= 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`Run ${SLOT_LETTERS[p.slot]}`}>
            <span className="size-2 rounded-full" style={{ background: seriesVar(p.slot) }} />
            {SLOT_LETTERS[p.slot]}
          </span>
        ) : (
          <PickBox run={run} pickMode={p.pickMode} picked={p.picked} onPick={p.onPick} />
        )}
      </div>
      <span className="flex min-w-0 flex-1">
        <span className="truncate">{head}</span>
        <span className="shrink-0">{tail}</span>
      </span>
      {live ? <span className="size-1.5 shrink-0 rounded-full bg-destructive animate-pulse-dot" title="Recording" /> : null}
      <span className="num shrink-0 text-xs text-muted-foreground group-hover/row:hidden group-has-[[data-state=open]]/row:hidden">
        {formatDuration(lastFrameTime(frames, run.dt))}
      </span>
      <div className="hidden shrink-0 group-hover/row:block has-[[data-state=open]]:block" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mr-1.5 size-6" aria-label={`Actions for ${run.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <RunDropdownMenu run={run} onNewGroup={p.onNewGroup} />
        </DropdownMenu>
      </div>
    </div>
  );
});

function PickBox({ run, pickMode, picked, onPick }: { run: Row; pickMode: boolean; picked: boolean; onPick(r: Row): void }) {
  const full = useFull();
  const box = (
    <Checkbox
      checked={picked}
      disabled={full && !picked}
      onCheckedChange={() => onPick(run)}
      aria-label={`Compare ${run.name}`}
      className={cn("transition-opacity", pickMode ? "opacity-100" : "opacity-0 group-hover/row:opacity-100")}
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

function useFull() {
  return useApp((s) => s.picks.length >= MAX_COMPARE);
}
