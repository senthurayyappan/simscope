import { Camera, Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/tooltip";
import { GIF_FPS, GIF_MAX_SECONDS, GIF_WIDTHS, gifFrames, gifWindow, saveGif, saveScreenshot, SHOT_SCALES } from "@/lib/capture";
import { activePlayer, getClock, onFrame } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { readStore, writeStore } from "@/lib/utils";

const PREFS = "simscope.capture";

interface Prefs {
  scale: number;
  fps: number;
  width: number;
}

const DEFAULTS: Prefs = { scale: 2, fps: 20, width: 720 };

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(readStore(PREFS) ?? "{}") as Partial<Prefs>;
    const pick = <T extends number>(list: readonly T[], v: unknown, fallback: T) => (list.includes(v as T) ? (v as T) : fallback);
    return {
      scale: pick(SHOT_SCALES, raw.scale, DEFAULTS.scale),
      fps: pick(GIF_FPS, raw.fps, DEFAULTS.fps),
      width: pick(GIF_WIDTHS, raw.width, DEFAULTS.width),
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
    return { duration: c.duration, a: r ? r[0] : -1, b: r ? r[1] : -1 };
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    if (!open) return;
    return onFrame(() => {
      const next = read();
      setV((p) => (p.duration === next.duration && p.a === next.a && p.b === next.b ? p : next));
    });
  }, [open]);
  return v;
}

const fmt = (t: number) => `${t.toFixed(2)} s`;

/** Capture the viewport: a PNG at a chosen scale, or a short GIF of the stretch selected on the timeline. */
export function CaptureMenu() {
  const run = useApp((s) => s.panes[s.active]?.name ?? "");
  const compare = useApp((s) => s.panes.length > 1);
  const hasRun = useApp((s) => s.panes.length > 0);
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const stretch = useStretch(open);

  const set = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeStore(PREFS, JSON.stringify(next));
  };

  const win = gifWindow(stretch.duration, stretch.a >= 0 ? [stretch.a, stretch.b] : null);
  const frames = win.problem ? 0 : gifFrames(win.t1 - win.t0, prefs.fps);
  const player = activePlayer();
  const shot = player?.captureSize?.({ scale: prefs.scale });
  const busy = progress !== null;
  const gifHeight = player?.captureSize?.({ width: prefs.width }).height ?? "";

  const shoot = async () => {
    const p = activePlayer();
    if (!p) return;
    setError(null);
    try {
      await saveScreenshot(p, run, prefs.scale);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The screenshot failed");
    }
  };

  const pickStretch = () => {
    const c = getClock();
    const t = Math.min(c.time, Math.max(c.duration - GIF_MAX_SECONDS, 0));
    c.loopRegion = [t, Math.min(t + GIF_MAX_SECONDS, c.duration)];
    c.loop = true;
  };

  const record = async () => {
    const p = activePlayer();
    if (!p || win.problem) return;
    setError(null);
    const ctl = new AbortController();
    abort.current = ctl;
    setProgress({ done: 0, total: frames });
    try {
      await saveGif(p, run, { t0: win.t0, t1: win.t1, fps: prefs.fps, width: prefs.width, signal: ctl.signal, onProgress: (done, total) => setProgress({ done, total }) });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "The GIF failed");
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  // A capture owns the player: leaving the menu open is fine, but a closed menu must not keep one running unseen.
  useEffect(() => () => abort.current?.abort(), []);

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
      <PopoverContent align="end" className="w-72 gap-0 p-0">
        <section className="flex flex-col gap-2 p-3">
          <h3 className="text-sm font-medium">Screenshot</h3>
          <div className="flex items-center justify-between gap-2">
            <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={String(prefs.scale)} onValueChange={(v) => v && set({ scale: Number(v) })} aria-label="Screenshot scale">
              {SHOT_SCALES.map((s) => (
                <ToggleGroupItem key={s} value={String(s)} aria-label={`${s} times`} className="px-2.5 tabular-nums">
                  {s}×
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span className="text-xs text-muted-foreground tabular-nums">{shot ? `${shot.width} × ${shot.height}` : ""}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={shoot} disabled={busy}>
            <Download />
            Save PNG
          </Button>
          {compare ? <p className="text-xs text-muted-foreground">Captures the active run.</p> : null}
        </section>
        <Separator />
        <section className="flex flex-col gap-2 p-3">
          <h3 className="text-sm font-medium">GIF</h3>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{stretch.a >= 0 ? "Selected stretch" : "Whole run"}</span>
            <span className="tabular-nums">{win.problem && !(stretch.duration > 0) ? "" : `${fmt(win.t0)} to ${fmt(win.t1)}`}</span>
          </div>
          {win.problem ? (
            <>
              <p className="text-xs text-muted-foreground">{win.problem}.</p>
              {stretch.duration > GIF_MAX_SECONDS ? (
                <Button variant="outline" size="sm" onClick={pickStretch}>
                  Select {GIF_MAX_SECONDS} s from the playhead
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={String(prefs.fps)} onValueChange={(v) => v && set({ fps: Number(v) })} aria-label="Frame rate" disabled={busy}>
                  {GIF_FPS.map((f) => (
                    <ToggleGroupItem key={f} value={String(f)} aria-label={`${f} frames per second`} className="px-2 tabular-nums">
                      {f}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <span className="text-xs text-muted-foreground">frames per second</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={String(prefs.width)} onValueChange={(v) => v && set({ width: Number(v) })} aria-label="Width" disabled={busy}>
                  {GIF_WIDTHS.map((w) => (
                    <ToggleGroupItem key={w} value={String(w)} aria-label={`${w} pixels wide`} className="px-2 tabular-nums">
                      {w}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <span className="text-xs text-muted-foreground">pixels wide</span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {frames} frames of {prefs.width} × {gifHeight}
              </p>
            </>
          )}
          {busy ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="flex-1" disabled>
                <Loader2 className="animate-spin" />
                <span className="tabular-nums">
                  {progress.done} of {progress.total} frames
                </span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => abort.current?.abort()}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={record} disabled={!!win.problem}>
              <Download />
              Save GIF
            </Button>
          )}
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </section>
      </PopoverContent>
    </Popover>
  );
}
