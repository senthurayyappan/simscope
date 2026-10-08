import { Camera, Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/tooltip";
import { aspectOf, GIF_FPS, GIF_MAX_SECONDS, GIF_WIDTHS, gifFrames, gifWindow, saveGif, saveScreenshot, SHAPES, SHOT_WIDTHS, type ShapeId } from "@/lib/capture";
import { activePlayer, getClock, onFrame } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { readStore, writeStore } from "@/lib/utils";

const PREFS = "simscope.capture";

type Tab = "image" | "gif";

interface Prefs {
  tab: Tab;
  shape: ShapeId;
  shotWidth: number;
  fps: number;
  gifWidth: number;
}

const DEFAULTS: Prefs = { tab: "image", shape: "16:9", shotWidth: 1920, fps: 20, gifWidth: 720 };

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(readStore(PREFS) ?? "{}") as Partial<Prefs>;
    const pick = <T,>(list: readonly T[], v: unknown, fallback: T) => (list.includes(v as T) ? (v as T) : fallback);
    return {
      tab: pick(["image", "gif"] as const, raw.tab, DEFAULTS.tab),
      shape: pick(SHAPES.map((s) => s.id), raw.shape, DEFAULTS.shape),
      shotWidth: pick(SHOT_WIDTHS, raw.shotWidth, DEFAULTS.shotWidth),
      fps: pick(GIF_FPS, raw.fps, DEFAULTS.fps),
      gifWidth: pick(GIF_WIDTHS, raw.gifWidth, DEFAULTS.gifWidth),
    };
  } catch {
    return DEFAULTS;
  }
}

/** The clock's duration and loop region, re-read while the menu is open. */
function useStretch(open: boolean) {
  const read = () => {
    const c = getClock();
    const r = c.loopRegion;
    return { duration: c.duration, speed: c.speed, a: r ? r[0] : -1, b: r ? r[1] : -1 };
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    if (!open) return;
    return onFrame(() => {
      const next = read();
      setV((p) => (p.duration === next.duration && p.speed === next.speed && p.a === next.a && p.b === next.b ? p : next));
    });
  }, [open]);
  return v;
}

const secs = (t: number) => `${t.toFixed(2)} s`;

/** One setting: its name on the left, its choices on the right. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  show = String,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange(v: T): void;
  disabled?: boolean;
  show?(v: T): string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={String(value)}
      onValueChange={(v) => {
        const hit = options.find((o) => String(o) === v);
        if (hit !== undefined) onChange(hit);
      }}
      aria-label={label}
      disabled={disabled}
    >
      {options.map((o) => (
        <ToggleGroupItem key={String(o)} value={String(o)} className="min-w-12 px-2 tabular-nums data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
          {show(o)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Capture the viewport: a PNG, or a short GIF of the stretch selected on the timeline. */
export function CaptureMenu() {
  const run = useApp((s) => s.panes[s.active]?.name ?? "");
  const compare = useApp((s) => s.panes.length > 1);
  const hasRun = useApp((s) => s.panes.length > 0);
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const [progress, setProgress] = useState<{ phase: "colours" | "frames"; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stretch = useStretch(open);

  const set = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeStore(PREFS, JSON.stringify(next));
  };

  // While the menu is open the active pane outlines the frame that will be saved.
  useEffect(() => {
    useApp.setState({ captureGuide: open ? aspectOf(prefs.shape) : null });
    return () => useApp.setState({ captureGuide: null });
  }, [open, prefs.shape]);

  const win = gifWindow(stretch.duration, stretch.a >= 0 ? [stretch.a, stretch.b] : null, stretch.speed);
  const frames = stretch.duration > 0 ? gifFrames(win.seconds, prefs.fps) : 0;
  const busy = progress !== null;

  const shoot = async () => {
    const p = activePlayer();
    if (!p) return;
    setError(null);
    try {
      await saveScreenshot(p, run, prefs.shotWidth, prefs.shape);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The screenshot failed");
    }
  };

  const pickStretch = () => {
    const c = getClock();
    // The longest stretch that plays for five seconds at the current speed.
    const span = GIF_MAX_SECONDS * c.speed;
    const t = Math.min(c.time, Math.max(c.duration - span, 0));
    c.loopRegion = [t, Math.min(t + span, c.duration)];
    c.loop = true;
  };

  const record = async () => {
    const p = activePlayer();
    if (!p || win.problem) return;
    setError(null);
    const ctl = new AbortController();
    abort.current = ctl;
    setProgress({ phase: "colours", done: 0, total: 1 });
    try {
      await saveGif(p, run, { t0: win.t0, t1: win.t1, fps: prefs.fps, width: prefs.gifWidth, shape: prefs.shape, speed: stretch.speed, signal: ctl.signal, onProgress: setProgress });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "The GIF failed");
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  // A capture owns the player: do not leave one running when the menu goes away.
  useEffect(() => () => abort.current?.abort(), []);

  const share = progress ? (progress.phase === "colours" ? 0 : progress.done / progress.total) : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label={hasRun ? "Capture" : "Open a run first"}>
        <span>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" disabled={!hasRun} aria-label="Capture">
              <Camera />
            </Button>
          </PopoverTrigger>
        </span>
      </Hint>
      {/* The menu stays open while the user works on the view (pan, zoom, hide a sidebar, move the stretch on the timeline). It closes with Escape or the camera button. */}
      <PopoverContent align="end" className="w-80 gap-0 p-0" onInteractOutside={(e) => e.preventDefault()}>
        <Tabs value={prefs.tab} onValueChange={(v) => set({ tab: v as Tab })} className="gap-0">
          <div className="h-10 border-b">
            <TabsList variant="line" className="h-full w-full gap-0">
              <TabsTrigger value="image" disabled={busy}>
                Screenshot
              </TabsTrigger>
              <TabsTrigger value="gif" disabled={busy}>
                GIF
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="image" className="flex flex-col gap-3 p-4">
            <Field label="Shape">
              <Choice label="Shape" value={prefs.shape} options={SHAPES.map((s) => s.id)} onChange={(shape) => set({ shape })} />
            </Field>
            <Field label="Width">
              <Choice label="Width in pixels" value={prefs.shotWidth} options={SHOT_WIDTHS} onChange={(shotWidth) => set({ shotWidth })} />
            </Field>
            <Button size="sm" onClick={shoot}>
              <Download />
              Save PNG
            </Button>
          </TabsContent>

          <TabsContent value="gif" className="flex flex-col gap-3 p-4">
            <Field label="Shape">
              <Choice label="Shape" value={prefs.shape} options={SHAPES.map((s) => s.id)} onChange={(shape) => set({ shape })} disabled={busy} />
            </Field>
            <Field label="Width">
              <Choice label="Width in pixels" value={prefs.gifWidth} options={GIF_WIDTHS} onChange={(gifWidth) => set({ gifWidth })} disabled={busy} />
            </Field>
            <Field label="FPS">
              <Choice label="Frames per second" value={prefs.fps} options={GIF_FPS} onChange={(fps) => set({ fps })} disabled={busy} />
            </Field>
            <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <span>{frames} frames</span>
              <span className={win.problem ? "text-destructive" : undefined} title={win.problem ? `${win.problem}.` : undefined}>
                {win.seconds.toFixed(2)} s
              </span>
            </div>
            {busy ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
                    <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${share * 100}%` }} />
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                    <Loader2 className="size-3 animate-spin" />
                    {progress.phase === "colours" ? "Choosing colours" : `Frame ${progress.done} of ${progress.total}`}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => abort.current?.abort()}>
                  Cancel
                </Button>
              </div>
            ) : win.problem ? (
              <Button variant="outline" size="sm" onClick={pickStretch} disabled={!(stretch.duration > GIF_MAX_SECONDS * stretch.speed)} title={`${win.problem}.`}>
                Select {GIF_MAX_SECONDS} s from the playhead
              </Button>
            ) : (
              <Button size="sm" onClick={record}>
                <Download />
                Save GIF
              </Button>
            )}
          </TabsContent>

          {compare || error ? (
            <div className="flex flex-col gap-1 border-t px-4 py-2.5">
              {compare ? <p className="text-xs text-muted-foreground">Captures the active run.</p> : null}
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
