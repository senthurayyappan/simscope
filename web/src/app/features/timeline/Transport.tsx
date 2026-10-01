import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play, Repeat, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger, Hint } from "@/components/ui/tooltip";
import { seekTo, stepFrames } from "@/lib/commands";
import { formatCount, formatTimecode, parseTime } from "@/lib/format";
import { getClock, onFrame } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { fitTimeline } from "@/lib/timeline-view";
import { cn } from "@/lib/utils";

import { CameraMenu } from "./CameraMenu";
import type { ClockSnapshot } from "./useClockSnapshot";

export const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 3, 5];

/** The timeline bar (TL1): camera | transport and readout | loop, speed, fit, minimise. */
export function Transport({
  snap,
  zoomed,
  collapsed,
  onToggleCollapse,
}: {
  snap: ClockSnapshot;
  zoomed: boolean;
  collapsed: boolean;
  onToggleCollapse(): void;
}) {
  const info = useApp((s) => s.infos[s.active]);
  const hasRun = !!info;
  const clock = getClock();

  return (
    <div className="@container flex h-11 shrink-0 items-center gap-2 overflow-hidden px-2">
      <div className="flex shrink-0 items-center">
        <CameraMenu />
      </div>

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-1">
        <Hint label="Go to start">
          <Button variant="ghost" size="icon-sm" className="@max-[40rem]:hidden" disabled={!hasRun} onClick={() => seekTo(0)} aria-label="Go to start">
            <SkipBack />
          </Button>
        </Hint>
        <Hint label="Step back" keys="J">
          <Button variant="ghost" size="icon-sm" disabled={!hasRun} onClick={() => stepFrames(-1)} aria-label="Step back">
            <StepBack />
          </Button>
        </Hint>
        <Hint label={snap.playing ? "Pause" : "Play"} keys="K">
          <Button size="icon" disabled={!hasRun} onClick={() => clock.toggle()} aria-label={snap.playing ? "Pause" : "Play"}>
            {snap.playing ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          </Button>
        </Hint>
        <Hint label="Step forward" keys="L">
          <Button variant="ghost" size="icon-sm" disabled={!hasRun} onClick={() => stepFrames(1)} aria-label="Step forward">
            <StepForward />
          </Button>
        </Hint>
        <Hint label="Go to end">
          <Button variant="ghost" size="icon-sm" className="@max-[40rem]:hidden" disabled={!hasRun} onClick={() => seekTo(clock.duration)} aria-label="Go to end">
            <SkipForward />
          </Button>
        </Hint>
        <Readout hasRun={hasRun} dt={info?.dt ?? 0.02} frames={info?.frames ?? 0} />
      </div>

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-0.5">
        <Hint label="Loop">
          <Toggle size="icon-sm" pressed={snap.loop} disabled={!hasRun} onPressedChange={(v) => (clock.loop = v)} aria-label="Loop">
            <Repeat />
          </Toggle>
        </Hint>
        <DropdownMenu>
          <Hint label="Playback speed">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="num gap-1 px-2" disabled={!hasRun}>
                {snap.speed}×
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuRadioGroup value={String(snap.speed)} onValueChange={(v) => (clock.speed = Number(v))}>
              {SPEEDS.map((s) => (
                <DropdownMenuRadioItem key={s} value={String(s)} className="num">
                  {s}×
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {zoomed ? (
          <Hint label="Show the whole run" keys="Esc">
            <Button variant="ghost" size="sm" className="px-2" onClick={fitTimeline}>
              Fit
            </Button>
          </Hint>
        ) : null}
        <Hint label={collapsed ? "Show timeline" : "Minimise timeline"}>
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapse} aria-label={collapsed ? "Show timeline" : "Minimise timeline"}>
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </Hint>
      </div>
    </div>
  );
}

/** `2.49 / 7.98 s`: no caption; click to type a time; the tooltip says `Frame 124 of 400` (TL2). */
function Readout({ hasRun, dt, frames }: { hasRun: boolean; dt: number; frames: number }) {
  const timeEl = useRef<HTMLSpanElement>(null);
  const totalEl = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(false);
  const [tip, setTip] = useState("");

  useEffect(() => {
    let lastT = NaN;
    let lastD = NaN;
    return onFrame(() => {
      const c = getClock();
      if (c.time !== lastT || c.duration !== lastD) {
        lastT = c.time;
        lastD = c.duration;
        if (timeEl.current) timeEl.current.textContent = hasRun ? formatTimecode(c.time) : "-";
        if (totalEl.current) totalEl.current.textContent = hasRun ? `${formatTimecode(c.duration)} s` : "";
      }
    });
  }, [dt, hasRun, editing]);

  const commit = (text: string) => {
    setEditing(false);
    const t = parseTime(text, dt);
    if (t !== null) seekTo(t);
  };

  if (editing) {
    return (
      <EditField initial={formatTimecode(getClock().time)} onCommit={commit} onCancel={() => setEditing(false)} />
    );
  }
  return (
    <Tooltip onOpenChange={(o) => o && setTip(`Frame ${formatCount(Math.round(getClock().time / dt))} of ${formatCount(frames)}`)}>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={!hasRun}
          onClick={() => setEditing(true)}
          className="num ml-2 flex h-7 items-baseline gap-1 rounded-md px-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          aria-label="Current time, click to type a time"
        >
          <span ref={timeEl} className="self-center font-medium" />
          <span className="text-muted-foreground">/</span>
          <span ref={totalEl} className="text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function EditField({ initial, onCommit, onCancel }: { initial: string; onCommit(v: string): void; onCancel(): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={initial}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !done.current) {
          done.current = true;
          onCommit(e.currentTarget.value);
        } else if (e.key === "Escape") {
          done.current = true;
          onCancel();
        }
        e.stopPropagation();
      }}
      onBlur={(e) => {
        if (!done.current) onCommit(e.currentTarget.value);
      }}
      className={cn("num ml-2 h-7 w-24 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50")}
      aria-label="Enter a time, such as 2.5, 1:05 or f120"
      spellCheck={false}
    />
  );
}
