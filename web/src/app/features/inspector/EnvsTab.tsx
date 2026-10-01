import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronDown, Pin, PinOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { selectEnv, setEnvOrder } from "@/lib/commands";
import { formatCount, formatValue } from "@/lib/format";
import { activePlayer } from "@/lib/runtime";
import { MAX_PINNED, useApp } from "@/lib/store";
import type { SummariesDoc } from "@/lib/types";
import { useScrollMemory } from "@/lib/use-scroll-memory";
import { cn } from "@/lib/utils";

const ROW = 32;

/** Loads the per-env summaries, retrying while the server is still computing them. */
function useSummaries(run: string | undefined): { doc: SummariesDoc | null; pending: boolean } {
  const [state, setState] = useState<{ doc: SummariesDoc | null; pending: boolean }>({ doc: null, pending: true });
  useEffect(() => {
    let stale = false;
    let timer = 0;
    let tries = 0;
    setState({ doc: null, pending: true });
    const load = async () => {
      const p = activePlayer();
      const doc = (await p?.summaries?.().catch(() => null)) ?? null;
      if (stale) return;
      if (doc) setState({ doc, pending: false });
      else if (++tries < 8) timer = window.setTimeout(load, 1500);
      else setState({ doc: null, pending: false });
    };
    void load();
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [run]);
  return state;
}

export function EnvsTab() {
  const info = useApp((s) => s.infos[s.active]);
  const env = useApp((s) => s.envs[s.active] ?? 0);
  const pinned = useApp((s) => s.pinned);
  const togglePin = useApp((s) => s.togglePin);
  const { doc, pending } = useSummaries(info?.run);
  const envs = info?.envs ?? 0;

  const [sortKey, setSortKey] = useState("index");
  const [flip, setFlip] = useState(false);
  const chosen = useRef(false);
  // Until the user picks, rank by the first summary column (usually the return).
  useEffect(() => {
    if (doc && !chosen.current && doc.columns.length > 0) setSortKey(doc.columns[0].key);
  }, [doc]);
  useEffect(() => {
    chosen.current = false;
    setSortKey("index");
    setFlip(false);
  }, [info?.run]);
  const col = doc?.columns.find((c) => c.key === sortKey);
  const values = col ? doc!.values[col.key] : null;
  // "Best first": descending for high-is-better columns, ascending for low.
  const descending = (col?.better === "high") !== flip;

  const order = useMemo(() => {
    const idx = Array.from({ length: envs }, (_, i) => i);
    if (values) {
      const sign = descending ? -1 : 1;
      idx.sort((a, b) => sign * ((values[a] ?? 0) - (values[b] ?? 0)) || a - b);
    } else if (flip) idx.reverse();
    return idx;
  }, [envs, values, descending, flip]);

  useEffect(() => {
    setEnvOrder(order);
    return () => setEnvOrder(null);
  }, [order]);

  const range = useMemo(() => {
    if (!values) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return { lo, hi };
  }, [values]);

  const scroller = useRef<HTMLDivElement>(null);
  useScrollMemory(scroller, "envs", order.length > 0);
  const virt = useVirtualizer({ count: order.length, getScrollElement: () => scroller.current, estimateSize: () => ROW, overscan: 12 });

  // Bring the selected env into view when it changes by key or click elsewhere.
  useEffect(() => {
    const i = order.indexOf(env);
    if (i >= 0) virt.scrollToIndex(i, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env, order]);

  const [goto, setGoto] = useState("");
  const submitGoto = () => {
    const n = Number.parseInt(goto, 10);
    if (Number.isFinite(n) && n >= 0 && n < envs) selectEnv(n);
    setGoto("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-0 flex-1 justify-between">
              <span className="truncate">
                <span className="text-muted-foreground">Sort by </span>
                {col?.label ?? "Env index"}
              </span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52">
            <DropdownMenuRadioGroup value={sortKey} onValueChange={(v) => {
                chosen.current = true;
                setSortKey(v);
                setFlip(false);
              }}>
              <DropdownMenuRadioItem value="index">Env index</DropdownMenuRadioItem>
              {doc?.columns.map((c) => (
                <DropdownMenuRadioItem key={c.key} value={c.key}>
                  {c.label}
                  {c.unit ? <span className="ml-auto pl-3 text-xs text-muted-foreground">{c.unit}</span> : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Hint label={descending ? "Highest first" : "Lowest first"}>
          <Button variant="outline" size="icon-sm" onClick={() => setFlip((f) => !f)} aria-label="Reverse order">
            {descending ? <ArrowDown /> : <ArrowUp />}
          </Button>
        </Hint>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitGoto();
          }}
        >
          <Input
            value={goto}
            onChange={(e) => setGoto(e.target.value.replace(/\D/g, ""))}
            placeholder="Go to #"
            inputMode="numeric"
            className="num h-7 w-[72px] text-sm"
            aria-label="Go to env number"
          />
        </form>
      </div>

      {!doc && pending ? (
        <p className="shrink-0 px-4 pt-2 text-xs text-muted-foreground">Computing per-env summaries</p>
      ) : !doc ? (
        <p className="shrink-0 px-4 pt-2 text-xs text-muted-foreground">No per-env summaries for this run; sorted by index.</p>
      ) : null}

      <div className="flex shrink-0 items-center px-4 pb-1 pt-2">
        <span className="text-xs font-medium text-muted-foreground">Env</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground">{col ? `${col.label}${col.unit ? ` ${col.unit}` : ""}` : `${formatCount(envs)} envs`}</span>
        <span className="w-7" />
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Environments">
        <div style={{ height: virt.getTotalSize(), position: "relative" }}>
          {virt.getVirtualItems().map((v) => {
            const e = order[v.index];
            const selected = e === env;
            const isPinned = pinned.includes(e);
            const val = values?.[e];
            const frac = range && val !== undefined && range.hi > range.lo ? (val - range.lo) / (range.hi - range.lo) : null;
            return (
              <div
                key={e}
                role="option"
                aria-selected={selected}
                onClick={() => selectEnv(e)}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: v.size, transform: `translateY(${v.start}px)` }}
                className={cn(
                  "group/env flex items-center gap-2 px-4 text-sm transition-colors hover:bg-accent/60",
                  selected && "bg-accent",
                )}
              >
                <span className="num w-12 shrink-0 text-sm">{e}</span>
                <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
                  {frac !== null ? (
                    <>
                      <div className="absolute inset-0 bg-muted" />
                      <div
                        className={cn("absolute inset-y-0 left-0 rounded-full", selected ? "bg-foreground" : "bg-foreground/25")}
                        style={{ width: `${Math.max(3, frac * 100)}%` }}
                      />
                    </>
                  ) : null}
                </div>
                <span className="num w-16 shrink-0 text-right text-sm text-muted-foreground">
                  {val !== undefined ? formatValue(val) : ""}
                </span>
                <button
                  type="button"
                  aria-pressed={isPinned}
                  aria-label={isPinned ? `Unpin env ${e}` : `Pin env ${e}`}
                  title={isPinned ? "Unpin from plots" : pinned.length >= MAX_PINNED ? `At most ${MAX_PINNED} pinned` : "Pin to plots"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    togglePin(e);
                  }}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                    isPinned ? "text-foreground opacity-100" : "opacity-0 group-hover/env:opacity-100",
                  )}
                >
                  {isPinned ? <Pin className="size-3.5 fill-current" /> : <PinOff className="size-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
