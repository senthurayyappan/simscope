import { useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import { ChevronDown, ListChecks, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { seekTo } from "@/lib/commands";
import { buildChannels, defaultChannelIds, type Channel } from "@/lib/channels";
import type { PlayerLike } from "@/lib/core";
import { formatValue } from "@/lib/format";
import { setPlotHover } from "@/lib/hover";
import { cssVar, seriesVar, SLOT_LETTERS, withAlpha } from "@/lib/palette";
import { getClock, onFrame, playerAt } from "@/lib/runtime";
import { useApp, type PlotWindow } from "@/lib/store";
import type { EnvelopeDoc } from "@/lib/types";
import { useScrollMemory } from "@/lib/use-scroll-memory";
import { clamp, cn } from "@/lib/utils";

const PLOT_H = 120;
const AXIS_H = 16;

/** One drawn series: a player, an env, and the slot colour it wears (C6: runs or envs, never both). */
interface SeriesSpec {
  key: string;
  pane: number;
  env: number;
  slot: number;
  label: string;
  player: PlayerLike;
  dt: number;
}

function useSeriesSpecs(): SeriesSpec[] {
  const panes = useApp((s) => s.panes);
  const active = useApp((s) => s.active);
  const infos = useApp((s) => s.infos);
  const envs = useApp((s) => s.envs);
  const pinned = useApp((s) => s.pinned);
  return useMemo(() => {
    const out: SeriesSpec[] = [];
    if (panes.length > 1) {
      panes.forEach((p, i) => {
        const player = playerAt(i);
        const info = infos[i];
        if (player && info) out.push({ key: `p${i}:${envs[i] ?? 0}`, pane: i, env: envs[i] ?? 0, slot: p.slot, label: SLOT_LETTERS[p.slot], player, dt: info.dt });
      });
      return out;
    }
    const player = playerAt(active);
    const info = infos[active];
    if (!player || !info) return out;
    const sel = envs[active] ?? 0;
    const list = [sel, ...pinned.filter((e) => e !== sel)];
    list.forEach((e, i) => out.push({ key: `e${e}`, pane: active, env: e, slot: i, label: `Env ${e}`, player, dt: info.dt }));
    return out;
  }, [panes, active, infos, envs, pinned]);
}

export function PlotsTab() {
  const info = useApp((s) => s.infos[s.active]);
  const manifest = useApp((s) => s.manifest);
  const win = useApp((s) => s.plotWindow);
  const theme = useApp((s) => s.resolvedTheme);
  const specs = useSeriesSpecs();
  const scroller = useRef<HTMLDivElement>(null);

  const channels = useMemo(() => {
    if (manifest) return buildChannels(manifest.streams);
    return buildChannels(Object.fromEntries((info?.streams ?? []).map((s) => [s.name, { file: "", kind: s.kind, item_shape: s.shape }])));
  }, [manifest, info?.streams]);

  const [selected, setSelected] = useState<string[]>([]);
  const run = info?.run;
  useEffect(() => {
    setSelected(defaultChannelIds(channels));
  }, [run, channels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useScrollMemory(scroller, "plots", !!info);

  if (!info) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">Open a run to plot its signals.</p>;
  }

  const shown = channels.filter((c) => selected.includes(c.id));
  const groups = [...new Set(channels.map((c) => c.group))];
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const recorded = channels.some((c) => !c.body);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="@container flex h-10 shrink-0 items-center gap-1 overflow-hidden px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 px-2" aria-label="Channels">
              <ListChecks />
              <span className="@max-[20rem]:hidden">Channels</span>
              <span className="num text-muted-foreground">{selected.length}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-64 overflow-y-auto">
            {groups.map((g, gi) => (
              <div key={g}>
                {gi > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuLabel>{g}</DropdownMenuLabel>
                {channels
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} onSelect={(e) => e.preventDefault()}>
                      <span className="truncate">{c.label}</span>
                      {c.unit ? <DropdownMenuShortcut>{c.unit}</DropdownMenuShortcut> : null}
                    </DropdownMenuCheckboxItem>
                  ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 px-2">
              <Timer />
              {win === "all" ? "Whole run" : `Last ${win} s`}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup
              value={win}
              onValueChange={(v) => useApp.setState({ plotWindow: v as PlotWindow })}
            >
              <DropdownMenuRadioItem value="all">Whole run</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="5">Last 5 s</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="2">Last 2 s</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Legend specs={specs} />
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto pb-4">
        {shown.map((c, i) => (
          <ChannelPlot
            key={c.id}
            channel={c}
            specs={specs}
            last={i === shown.length - 1}
            win={win}
            frames={info.frames}
            theme={theme}
            onClose={() => toggle(c.id)}
          />
        ))}
        {shown.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">Choose a channel to plot.</p> : null}
        {!recorded ? <p className="px-4 pt-3 text-sm text-muted-foreground">This run recorded only body poses.</p> : null}
      </div>
    </div>
  );
}

/** A legend only for two or more series: a line key and a letter or env number (PL8). */
function Legend({ specs }: { specs: SeriesSpec[] }) {
  if (specs.length < 2) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-xs text-muted-foreground">
      {specs.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: seriesVar(s.slot) }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

interface PlotData {
  n: number;
  dt: number;
  series: { spec: SeriesSpec; data: Float32Array }[];
  env: EnvelopeDoc | null;
}

/** Value at time t, linearly interpolated between samples. */
function valueAt(a: Float32Array, dt: number, t: number): number {
  const f = clamp(t / dt, 0, a.length - 1);
  const i = Math.floor(f);
  const j = Math.min(a.length - 1, i + 1);
  return a[i] + (a[j] - a[i]) * (f - i);
}

function ChannelPlot(props: {
  channel: Channel;
  specs: SeriesSpec[];
  last: boolean;
  win: PlotWindow;
  frames: number;
  theme: "light" | "dark";
  onClose(): void;
}) {
  const { channel, specs, last, win, frames, theme } = props;
  const host = useRef<HTMLDivElement>(null);
  const valueEl = useRef<HTMLSpanElement>(null);
  const plot = useRef<uPlot | null>(null);
  const overlay = useRef<{ line: HTMLDivElement; dots: HTMLDivElement[] } | null>(null);
  const hoverIdx = useRef<number | null>(null);
  const cur = useRef<{ data: PlotData | null; win: PlotWindow }>({ data: null, win });
  const [data, setData] = useState<PlotData | null>(null);
  const [failed, setFailed] = useState(false);
  const key = specs.map((s) => s.key).join("|");

  useEffect(() => {
    let stale = false;
    if (specs.length === 0) return;
    (async () => {
      const got = await Promise.all(
        specs.map(async (spec) => {
          const p = spec.player;
          const body = channel.body ? spec.player.info?.()?.followBody ?? 1 : 0;
          const arr = await (channel.body
            ? p.bodySeries?.(channel.body, spec.env, body)
            : p.series?.(channel.stream!, spec.env, channel.component)
          )?.catch(() => null);
          return arr ? { spec, data: arr } : null;
        }),
      );
      const series = got.filter((g): g is { spec: SeriesSpec; data: Float32Array } => !!g);
      const first = specs[0];
      const envelope =
        first.player.info?.()?.envs! > 1 && channel.stream && specs.length === 1 ? await (first.player.envelope?.(channel.stream, channel.component)?.catch(() => null) ?? null) : null;
      if (stale) return;
      const n = Math.min(...series.map((g) => g.data.length), envelope ? envelope.p50.length : Infinity);
      if (series.length === 0 || !Number.isFinite(n) || n < 2) {
        setFailed(true);
        setData(null);
        return;
      }
      setFailed(false);
      setData({ n, dt: first.dt, series, env: envelope });
    })();
    return () => {
      stale = true;
    };
  }, [channel.id, key, frames]); // eslint-disable-line react-hooks/exhaustive-deps

  cur.current = { data, win };

  // Build the plot. The trace colour is a gradient split at the playhead (PL10).
  useEffect(() => {
    const el = host.current;
    if (!el || !data) return;
    const fg = cssVar("--foreground");
    const muted = cssVar("--muted-foreground");
    const border = cssVar("--border");
    const future = cssVar("--ink-future");
    const slotColor = (slot: number) => cssVar(`--series-${slot + 1}`);
    const xs = new Float64Array(data.n);
    for (let i = 0; i < data.n; i++) xs[i] = i * data.dt;
    const cols: (Float32Array | number[])[] = [];
    const series: uPlot.Series[] = [{}];
    const add = (arr: Float32Array, s: uPlot.Series) => {
      cols.push(arr.length === data.n ? arr : arr.subarray(0, data.n));
      series.push({ points: { show: false }, ...s });
      return cols.length;
    };
    let bands: uPlot.Band[] = [];
    if (data.env) {
      const lo = add(data.env.p5, { stroke: "transparent", width: 0 });
      const hi = add(data.env.p95, { stroke: "transparent", width: 0 });
      add(data.env.p50, { stroke: muted, width: 1 });
      bands = [{ series: [hi, lo], fill: withAlpha(fg, 0.08) }];
    }
    const multi = data.series.length > 1;
    const progress = (color: string) => (u: uPlot) => {
      const x0 = u.bbox.left;
      const w = u.bbox.width;
      const px = u.valToPos(getClock().time, "x", true);
      const f = w > 0 ? clamp((px - x0) / w, 0, 1) : 1;
      const g = u.ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, color);
      g.addColorStop(f, color);
      g.addColorStop(f, future);
      g.addColorStop(1, future);
      return g;
    };
    data.series.forEach((g, i) => {
      add(g.data, { stroke: progress(slotColor(g.spec.slot)), width: multi && i === 0 ? 2 : 1.5 });
    });

    const width = Math.max(120, el.clientWidth);
    const height = PLOT_H + (last ? AXIS_H : 0);
    const u = new uPlot(
      {
        width,
        height,
        padding: [8, 12, 0, 0],
        legend: { show: false },
        select: { show: false, left: 0, top: 0, width: 0, height: 0 },
        cursor: { x: true, y: false, points: { show: false }, drag: { x: false, y: false, setScale: false }, sync: { key: "simscope" } },
        scales: { x: { time: false } },
        axes: [
          {
            show: last,
            size: AXIS_H + 4,
            gap: 2,
            stroke: muted,
            font: `11px ${cssVar("--font-sans")}`,
            grid: { show: false },
            ticks: { show: false },
            values: (_u, v) => v.map((t) => (Number.isInteger(t) ? String(t) : t.toFixed(1))),
          },
          {
            size: 40,
            gap: 4,
            space: 36,
            stroke: muted,
            font: `11px ${cssVar("--font-sans")}`,
            grid: { stroke: border, width: 1 },
            ticks: { show: false },
            values: (_u, v) => v.map((x) => formatValue(x)),
          },
        ],
        series,
        bands,
        hooks: {
          setCursor: [
            (uu) => {
              const idx = uu.cursor.idx ?? null;
              hoverIdx.current = idx;
              setPlotHover(idx === null ? null : idx * data.dt);
            },
          ],
        },
      },
      [xs as unknown as number[], ...(cols as unknown as number[][])],
      el,
    );

    // Playhead: a 1 px muted line, draggable, plus a dot per series at its current value.
    const line = document.createElement("div");
    line.style.cssText = `position:absolute;top:0;bottom:0;left:0;width:1px;background:${muted};pointer-events:none;will-change:transform;`;
    u.over.appendChild(line);
    const dots = data.series.map((g) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:0;top:0;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:9999px;background:${slotColor(g.spec.slot)};box-shadow:0 0 0 2px ${cssVar("--background")};pointer-events:none;will-change:transform;`;
      u.over.appendChild(d);
      return d;
    });
    overlay.current = { line, dots };
    u.over.style.cursor = "col-resize";
    let down = false;
    const seekAt = (e: PointerEvent) => {
      const r = u.over.getBoundingClientRect();
      seekTo(u.posToVal(clamp(e.clientX - r.left, 0, r.width), "x"));
    };
    u.over.addEventListener("pointerdown", (e) => {
      down = true;
      u.over.setPointerCapture(e.pointerId);
      seekAt(e);
    });
    u.over.addEventListener("pointermove", (e) => down && seekAt(e));
    u.over.addEventListener("pointerup", () => (down = false));
    u.over.addEventListener("pointerleave", () => setPlotHover(null));
    plot.current = u;
    return () => {
      u.destroy();
      plot.current = null;
      overlay.current = null;
      setPlotHover(null);
    };
  }, [data, theme, last]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 40) plot.current?.setSize({ width: w, height: PLOT_H + (last ? AXIS_H : 0) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [last]);

  // Playhead, dots, trace split and value readout: refs and canvas only, never React state.
  useEffect(() => {
    let lastT = NaN;
    let lastW = NaN;
    let lastIdx: number | null = -2;
    let lastWin = "";
    return onFrame(() => {
      const u = plot.current;
      const { data: d, win: wv } = cur.current;
      const ov = overlay.current;
      if (!u || !d || !ov) return;
      const t = getClock().time;
      const w = u.over.clientWidth;
      const idx = hoverIdx.current;
      if (t === lastT && w === lastW && idx === lastIdx && wv === lastWin) return;
      lastT = t;
      lastW = w;
      lastIdx = idx;
      lastWin = wv;
      if (wv !== "all") {
        const span = Number(wv);
        const tot = d.n * d.dt;
        const lo = clamp(t - span * 0.75, 0, Math.max(0, tot - span));
        u.setScale("x", { min: lo, max: lo + span });
      } else if (u.scales.x.min !== 0 || (u.scales.x.max ?? 0) < (d.n - 1) * d.dt - 1e-9) {
        u.setScale("x", { min: 0, max: (d.n - 1) * d.dt });
      } else u.redraw(false);
      const x = u.valToPos(t, "x");
      ov.line.style.transform = `translateX(${x.toFixed(1)}px)`;
      ov.line.style.opacity = x >= -1 && x <= w + 1 ? "1" : "0";
      d.series.forEach((g, i) => {
        const v = valueAt(g.data, d.dt, t);
        const y = u.valToPos(v, "y");
        const dot = ov.dots[i];
        dot.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        dot.style.opacity = x >= -1 && x <= w + 1 ? "1" : "0";
      });
      const head = d.series[0];
      if (valueEl.current && head) {
        const v = idx !== null ? head.data[clamp(idx, 0, head.data.length - 1)] : valueAt(head.data, d.dt, t);
        valueEl.current.textContent = formatValue(v);
      }
    });
  }, []);

  return (
    <section className="group/plot px-4 pb-1 pt-1">
      <header className="flex h-7 items-center gap-2">
        <h4 className="truncate text-sm font-medium">{channel.label}</h4>
        <span className="num ml-auto text-sm">
          <span ref={valueEl} />
          {channel.unit ? <span className="ml-1 text-muted-foreground">{channel.unit}</span> : null}
        </span>
        <button
          type="button"
          aria-label={`Remove ${channel.label}`}
          onClick={props.onClose}
          className="-mr-1 flex size-5 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/plot:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </header>
      <div className={cn("relative", failed && "opacity-60")} style={{ height: PLOT_H + (last ? AXIS_H : 0) }}>
        <div ref={host} className="size-full" />
        {failed ? <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No data for this channel</div> : null}
      </div>
    </section>
  );
}
