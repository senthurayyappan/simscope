import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { selectEnv, seekTo } from "@/lib/commands";
import { formatTimecode, readout } from "@/lib/format";
import { getPlotHover } from "@/lib/hover";
import { validColor } from "@/lib/palette";
import { getClock, onFrame } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { followPlayhead, snapFrame, timelineHeight } from "@/lib/timeline-math";

export { timelineHeight };
import {
  fitTimeline,
  getTimelineView,
  panTimeline,
  setTimelineView,
  subscribeTimelineView,
  zoomTimeline,
} from "@/lib/timeline-view";
import type { MarkEvent } from "@/lib/types";
import { clamp, cn } from "@/lib/utils";

import {
  drawTimeline,
  GUTTER,
  hitAt,
  laneWidth,
  LANE_H,
  readPalette,
  RULER_H,
  timeAt,
  type DrawState,
  type Hit,
  type LaneSpec,
  type Palette,
} from "./draw";
import { Transport } from "./Transport";
import { useClockSnapshot } from "./useClockSnapshot";

type Drag =
  | { kind: "scrub" }
  | { kind: "ruler"; x0: number; t0: number; moved: boolean }
  | { kind: "edge"; edge: 0 | 1 }
  | { kind: "glyph"; hit: Hit; x: number; y: number };

const NO_LABELS: MarkEvent[] = [];
const DEBUG = new URLSearchParams(location.search).has("debug");

export function TimelinePanel({
  collapsed,
  onToggleCollapse,
  onLanes,
}: {
  collapsed: boolean;
  onToggleCollapse(): void;
  onLanes(count: number): void;
}) {
  const snap = useClockSnapshot();
  const lanes = useLanes();
  const [zoomed, setZoomed] = useState(false);
  const drafting = useApp((st) => st.labelDraft !== null);
  // The label field needs a row of its own below the lanes.
  useEffect(() => onLanes(lanes.length + (drafting ? 1 : 0)), [lanes.length, drafting, onLanes]);
  useEffect(() => {
    const check = () => {
      const v = getTimelineView();
      const d = getClock().duration;
      setZoomed(d > 0 && (v.t0 > 1e-6 || v.t1 < d - 1e-6));
    };
    check();
    return subscribeTimelineView(check);
  }, []);
  return (
    <div className="flex size-full min-h-0 flex-col bg-background">
      <Transport snap={snap} zoomed={zoomed} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      <div className="relative min-h-0 flex-1 border-t">
        <Strip lanes={lanes} playing={snap.playing} />
      </div>
    </div>
  );
}

/** One lane per subject (TL5, TL7); empty lanes do not exist (I4). */
function useLanes(): LaneSpec[] {
  const panes = useApp((s) => s.panes);
  const infos = useApp((s) => s.infos);
  const envs = useApp((s) => s.envs);
  const highlights = useApp((s) => s.highlights);
  const events = useApp((s) => s.annotations?.events ?? NO_LABELS);
  const active = useApp((s) => s.active);
  return useMemo(() => {
    const out: LaneSpec[] = [];
    // Custom kinds may carry a colour (contracts §9.3); only plain hex is used.
    const colorsOf = (i: number) => {
      const colors: Record<string, string> = {};
      for (const k of (highlights[i]?.kinds ?? []) as { key: string; color?: string }[]) {
        const c = validColor(k.color);
        if (c) colors[k.key] = c;
      }
      return colors;
    };
    const compare = panes.length > 1;
    panes.forEach((p, i) => {
      const items = highlights[i]?.highlights ?? [];
      const multi = (infos[i]?.envs ?? 1) > 1;
      const env = envs[i] ?? 0;
      if (compare) {
        const mine = multi ? items.filter((h) => h.env === env) : items;
        if (mine.length) out.push({ id: `run${i}`, label: p.name, slot: p.slot, items: mine, colors: colorsOf(i), pane: i });
      } else if (multi) {
        const mine = items.filter((h) => h.env === env);
        if (mine.length) out.push({ id: "env", label: `Env ${env}`, slot: null, items: mine, colors: colorsOf(i), pane: i });
        if (items.length) out.push({ id: "all", label: "All envs", slot: null, items, colors: colorsOf(i), pane: i });
      } else if (items.length) {
        out.push({ id: "highlights", label: "", slot: null, items, colors: colorsOf(i), pane: i });
      }
    });
    // User labels (type "") and developer markers (add_event with a type) share the lane.
    const labels = events;
    if (labels.length) out.push({ id: "labels", label: "Labels", slot: null, items: [], labels, pane: active });
    return out;
  }, [panes, infos, envs, highlights, events, active]);
}

function Strip({ lanes, playing }: { lanes: LaneSpec[]; playing: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const info = useApp((s) => s.infos[s.active]);
  const theme = useApp((s) => s.resolvedTheme);
  const writable = useApp((s) => !!s.api?.writable);
  const draft = useApp((s) => s.labelDraft);
  const [card, setCard] = useState<{ hit: Hit; left: number; top: number } | null>(null);
  const [ctxTime, setCtxTime] = useState(0);

  const model = useRef({ lanes, info, playing });
  model.current = { lanes, info, playing };
  const dirty = useRef(true);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const pal = useRef<Palette | null>(null);
  const hits = useRef<Hit[]>([]);
  const hover = useRef<{ t: number | null; hit: Hit | null }>({ t: null, hit: null });
  const drag = useRef<Drag | null>(null);
  const lastSeen = useRef({ time: NaN, duration: NaN, t0: NaN, t1: NaN, loopKey: "", run: "", plot: NaN as number | null });

  useEffect(() => {
    dirty.current = true;
  }, [lanes, info, playing]);
  useEffect(() => {
    pal.current = readPalette();
    dirty.current = true;
  }, [theme]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: Math.floor(width), h: Math.floor(height), dpr };
      const c = canvas.current;
      if (c) {
        c.width = Math.max(1, Math.floor(width * dpr));
        c.height = Math.max(1, Math.floor(height * dpr));
      }
      dirty.current = true;
    });
    ro.observe(el);
    const off = subscribeTimelineView(() => {
      dirty.current = true;
    });
    return () => {
      ro.disconnect();
      off();
    };
  }, []);

  // One rAF subscriber: keep the view fitted, follow the playhead, repaint on change.
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    return onFrame(() => {
      const m = model.current;
      const clock = getClock();
      const seen = lastSeen.current;
      const run = m.info?.run ?? "";

      if (run !== seen.run) {
        seen.run = run;
        fitTimeline();
      } else if (clock.duration !== seen.duration) {
        const v = getTimelineView();
        const wasFit = v.t0 <= 1e-6 && Math.abs(v.t1 - seen.duration) < 1e-3;
        if (wasFit || !(seen.duration > 0)) fitTimeline();
      }
      if (m.playing && !drag.current) {
        const v = getTimelineView();
        const next = followPlayhead(v, clock.time, clock.duration, 0.05);
        if (next !== v) setTimelineView(next);
      }

      const v = getTimelineView();
      const region = clock.loopRegion;
      const loopKey = region ? `${region[0]}:${region[1]}` : "";
      const plot = getPlotHover();
      if (
        !dirty.current &&
        seen.time === clock.time &&
        seen.duration === clock.duration &&
        seen.t0 === v.t0 &&
        seen.t1 === v.t1 &&
        seen.loopKey === loopKey &&
        seen.plot === plot
      )
        return;
      seen.time = clock.time;
      seen.duration = clock.duration;
      seen.t0 = v.t0;
      seen.t1 = v.t1;
      seen.loopKey = loopKey;
      seen.plot = plot;
      dirty.current = false;

      const { w, h, dpr } = size.current;
      if (w < 10 || h < 10) return;
      pal.current ??= readPalette();
      const state: DrawState = {
        width: w,
        height: h,
        dpr,
        view: v,
        duration: clock.duration,
        dt: m.info?.dt ?? 0.02,
        time: clock.time,
        loop: region,
        lanes: m.lanes,
        hoverT: hover.current.t,
        plotHoverT: plot,
        hoverHit: hover.current.hit,
        empty: !m.info || !(clock.duration > 0),
      };
      hits.current = drawTimeline(ctx, state, pal.current).hits;
      // `?debug`: lets scripted checks compare drawn pixels with the geometry (see test/app-lib.test.mjs for the pure part).
      if (DEBUG) (window as unknown as { __timeline: unknown }).__timeline = { hits: hits.current, view: v, width: w, height: h, dpr };
    });
  }, []);

  // Wheel: zoom around the pointer; shift or sideways wheel pans (non-passive so the page does not scroll).
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const sideways = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (sideways) {
        panTimeline((e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX) / Math.max(1, laneWidth(size.current.w)));
      } else {
        const t = timeAt(x, { view: getTimelineView(), width: size.current.w });
        zoomTimeline(Math.exp(clamp(e.deltaY, -240, 240) * (e.ctrlKey ? 0.01 : 0.0018)), t);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, r };
  };
  const tAt = (x: number, snapTo: boolean) => {
    const clock = getClock();
    const t = clamp(timeAt(x, { view: getTimelineView(), width: size.current.w }), 0, clock.duration);
    return snapTo ? snapFrame(t, model.current.info?.dt ?? 0) : t;
  };
  const xOfT = (t: number) => {
    const v = getTimelineView();
    return GUTTER + ((t - v.t0) / (v.t1 - v.t0)) * laneWidth(size.current.w);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !model.current.info) return;
    const { x, y } = local(e);
    if (x < GUTTER - 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const clock = getClock();
    if (y < RULER_H) {
      const region = clock.loopRegion;
      if (region && Math.abs(x - xOfT(region[0])) <= 6) drag.current = { kind: "edge", edge: 0 };
      else if (region && Math.abs(x - xOfT(region[1])) <= 6) drag.current = { kind: "edge", edge: 1 };
      else if (Math.abs(x - xOfT(clock.time)) <= 8) drag.current = { kind: "scrub" };
      else drag.current = { kind: "ruler", x0: x, t0: tAt(x, e.shiftKey), moved: false };
      return;
    }
    const hit = hitAt(hits.current, x, y);
    if (hit) {
      drag.current = { kind: "glyph", hit, x, y };
      return;
    }
    drag.current = { kind: "scrub" };
    seekTo(tAt(x, e.shiftKey));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y, r } = local(e);
    const d = drag.current;
    const clock = getClock();
    if (d) {
      if (d.kind === "scrub") seekTo(tAt(x, e.shiftKey));
      else if (d.kind === "ruler") {
        if (!d.moved && Math.abs(x - d.x0) > 3) d.moved = true;
        if (d.moved) {
          const b = tAt(x, e.shiftKey);
          clock.loopRegion = [Math.min(d.t0, b), Math.max(d.t0, b)];
          clock.loop = true;
        }
      } else if (d.kind === "edge" && clock.loopRegion) {
        const t = tAt(x, e.shiftKey);
        const [a, b] = clock.loopRegion;
        clock.loopRegion = d.edge === 0 ? [Math.min(t, b - 0.02), b] : [a, Math.max(t, a + 0.02)];
      } else if (d.kind === "glyph" && Math.hypot(x - d.x, y - d.y) > 4) {
        drag.current = { kind: "scrub" };
      }
      return;
    }
    const inside = x >= GUTTER && x <= size.current.w;
    const hit = y > RULER_H && inside ? hitAt(hits.current, x, y) : null;
    const prev = hover.current;
    hover.current = { t: inside ? tAt(x, false) : null, hit };
    dirty.current = true;
    if (canvas.current) {
      const region = clock.loopRegion;
      const onEdge = y < RULER_H && region && (Math.abs(x - xOfT(region[0])) <= 6 || Math.abs(x - xOfT(region[1])) <= 6);
      canvas.current.style.cursor = onEdge ? "ew-resize" : hit ? "pointer" : inside ? "col-resize" : "default";
    }
    if (hit) {
      if (prev.hit?.cluster?.best !== hit.cluster?.best || prev.hit?.label !== hit.label || !card) {
        setCard({ hit, left: r.left + hit.x, top: r.top + hit.y - 16 });
      }
    } else if (card) setCard(null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "ruler" && !d.moved) seekTo(d.t0);
    if (d.kind === "glyph") activate(d.hit, local(e).x);
  };

  const activate = (hit: Hit, _x: number) => {
    void _x;
    const st = useApp.getState();
    const info = model.current.info;
    if (hit.pane !== st.active) st.setActive(hit.pane);
    if (hit.label) {
      seekTo(hit.label.t0);
      return;
    }
    const c = hit.cluster;
    if (!c) return;
    if (c.items.length > 1) {
      const t0 = Math.min(...c.items.map((h) => h.t));
      const t1 = Math.max(...c.items.map((h) => h.t));
      const pad = Math.max((t1 - t0) * 0.25, (info?.dt ?? 0.02) * 4);
      setTimelineView({ t0: t0 - pad, t1: t1 + pad });
    }
    seekTo(c.best.t);
    if ((st.infos[hit.pane]?.envs ?? 1) > 1 && c.best.env !== st.envs[hit.pane]) selectEnv(c.best.env);
  };

  // Label entry (D26): M or the ruler's context menu opens it at a time.
  const draftX = draft ? clamp(xOfT(draft.t), GUTTER, Math.max(GUTTER, size.current.w - 190)) : 0;
  const commitLabel = (text: string) => {
    const st = useApp.getState();
    const d = st.labelDraft;
    st.set({ labelDraft: null });
    const label = text.trim();
    if (!d || !label) return;
    if (d.id) void st.annotate({ op: "event_update", id: d.id, label });
    else void st.annotate({ op: "event_add", t0: d.t, t1: null, type: "", label, env: null });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={wrap}
          className="absolute inset-0"
          onContextMenu={(e) => {
            const { x } = local(e);
            setCtxTime(tAt(x, false));
          }}
        >
          <canvas
            ref={canvas}
            className="absolute inset-0 block size-full touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (drag.current = null)}
            onPointerLeave={() => {
              if (drag.current) return;
              hover.current = { t: null, hit: null };
              dirty.current = true;
              setCard(null);
            }}
            onDoubleClick={(e) => {
              const { x, y } = local(e);
              if (y < RULER_H) {
                getClock().loopRegion = null;
                return;
              }
              const hit = hitAt(hits.current, x, y);
              if (hit?.label && hit.label.type === "" && writable) useApp.setState({ labelDraft: { t: hit.label.t0, id: hit.label.id, text: hit.label.label } });
            }}
            aria-label="Timeline"
          />
          {draft ? (
            <div className="absolute z-10" style={{ left: draftX, top: RULER_H + lanes.length * LANE_H - 1 }}>
              <Input
                autoFocus
                defaultValue={draft.text ?? ""}
                placeholder={`Label at ${formatTimecode(draft.t)} s`}
                className="h-6 w-44 bg-background text-sm"
                aria-label="Label name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabel(e.currentTarget.value);
                  else if (e.key === "Escape") useApp.setState({ labelDraft: null });
                  e.stopPropagation();
                }}
                onBlur={() => useApp.setState({ labelDraft: null })}
              />
            </div>
          ) : null}
          {card ? createPortal(<HitCard hit={card.hit} lane={lanes.find((l) => l.id === card.hit.lane)} left={card.left} top={card.top} multiEnv={(info?.envs ?? 1) > 1} />, document.body) : null}
        </div>
      </ContextMenuTrigger>
      {writable ? (
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => useApp.setState({ labelDraft: { t: ctxTime } })}>
            Add label at {formatTimecode(ctxTime)} s
          </ContextMenuItem>
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
}

/**
 * Hover card (contracts §11.2): the kind's name left and the time right in
 * muted small text, then the reading large on the left with its second value
 * muted on the right. In compare the run title is a first muted row.
 */
function HitCard({ hit, lane, left, top, multiEnv }: { hit: Hit; lane: LaneSpec | undefined; left: number; top: number; multiEnv: boolean }) {
  const run = lane?.slot !== null && lane?.slot !== undefined ? lane.label : null;
  let body: React.ReactNode;
  if (hit.label) {
    body = (
      <>
        <CardHead left={hit.label.type || "Label"} time={hit.label.t0} />
        <div className="mt-1 break-words text-base font-medium">{hit.label.label || hit.label.type || "Label"}</div>
      </>
    );
  } else {
    const c = hit.cluster!;
    const list = [...c.items].sort((a, b) => a.t - b.t).slice(0, 3);
    body = (
      <div className="space-y-2.5">
        {c.items.length > 1 ? <div className="text-xs text-muted-foreground">{c.items.length} highlights, click to zoom in</div> : null}
        {list.map((h, i) => {
          const r = readout(h);
          return (
            <div key={i} className={i > 0 || c.items.length > 1 ? "border-t pt-2.5 first:border-0 first:pt-0" : ""}>
              <CardHead left={multiEnv ? `${r.title}, env ${h.env}` : r.title} time={h.t} />
              <div className="num mt-1 flex items-baseline justify-between gap-4">
                <span className={cn("break-words font-medium leading-tight", r.sub ? "text-lg" : "text-base")}>{r.main}</span>
                {r.sub ? <span className="shrink-0 text-sm text-muted-foreground">{r.sub}</span> : null}
              </div>
            </div>
          );
        })}
        {c.items.length > list.length ? <div className="text-xs text-muted-foreground">and {c.items.length - list.length} more</div> : null}
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none fixed z-50 w-max min-w-[168px] max-w-64 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-3 py-2.5 text-popover-foreground shadow-md"
      style={{ left: clamp(left, 140, window.innerWidth - 140), top }}
    >
      {run ? <div className="mb-1.5 truncate text-xs text-muted-foreground">{run}</div> : null}
      {body}
    </div>
  );
}

function CardHead({ left, time }: { left: string; time: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
      <span className="truncate">{left}</span>
      <span className="num shrink-0">{formatTimecode(time)} s</span>
    </div>
  );
}
