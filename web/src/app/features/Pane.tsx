import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { applyDisplay, applyFollow, stepEnv } from "@/lib/commands";
import { createPlayer, type PlayerLike, type RunInfo } from "@/lib/core";
import { formatCount } from "@/lib/format";
import { cssVar, seriesVar, SLOT_LETTERS } from "@/lib/palette";
import { restoreCamera, restoreEnv, settlePane } from "@/lib/restore";
import { getClock, registerPlayer } from "@/lib/runtime";
import { useApp } from "@/lib/store";
import { scheduleSession } from "@/lib/sync";

/** The viewport background comes from the same tokens as the chrome. */
export function viewportColor(): string {
  return cssVar("--viewport") || "#2e2e2e";
}

/**
 * One 3D pane: a canvas, a core Player on the shared clock, and the overlays
 * that belong to a single pane (run header in compare, env stepper).
 */
export function Pane({ index, run, slot, count }: { index: number; run: string; slot: number; count: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerLike | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = useApp((s) => s.api);
  const theme = useApp((s) => s.resolvedTheme);
  const info = useApp((s) => s.infos[index]);
  const env = useApp((s) => s.envs[index] ?? 0);
  const isActive = useApp((s) => s.active === index);
  const guide = useApp((s) => s.captureGuide);
  const follow = useApp((s) => s.follow);
  const refreshTick = useApp((s) => s.refresh[run] ?? 0);

  // Create the player once per pane.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const s = useApp.getState();
    const p = createPlayer(el, {
      clock: getClock(),
      theme: s.resolvedTheme,
      ground: s.groundOn ? s.groundKind : "none",
      view: s.camView ?? "iso",
      background: viewportColor(),
      // One big viewport draws through its own context; compare panes share one.
      direct: count === 1,
      follow: s.follow,
    });
    player.current = p;
    // A reload puts the saved camera back before the first frame is drawn.
    restoreCamera(index, run, p);
    const unregister = registerPlayer(index, p);

    const on = <T,>(type: string, fn: (detail: T) => void) =>
      p.addEventListener(type, (e) => fn((e as CustomEvent<T>).detail));
    on<{ env: number }>("focus", (d) => useApp.getState().setEnv(index, d.env));
    on<{ error: unknown; message?: string }>("error", (d) => setError(d.message ?? String((d.error as Error)?.message ?? d.error)));
    // A user orbit leaves the preset behind; the camera menu then reads "Free".
    on<unknown>("camera", () => {
      if (useApp.getState().camView !== null) useApp.setState({ camView: null });
      scheduleSession();
    });
    on<{ frames: number }>("live", (d) => {
      const st = useApp.getState();
      const cur = st.infos[index];
      if (!cur) return;
      st.setInfo(index, { ...cur, frames: d.frames, duration: Math.max(0, d.frames - 1) * cur.dt });
      if (st.followLive && index === st.active) getClock().seek(Math.max(0, d.frames - 1) * cur.dt);
    });

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) p.resize?.(width, height, window.devicePixelRatio || 1);
    });
    if (box.current) ro.observe(box.current);

    return () => {
      ro.disconnect();
      unregister();
      p.destroy?.();
      player.current = null;
      useApp.getState().setInfo(index, undefined);
    };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the run.
  useEffect(() => {
    const p = player.current;
    if (!p || !api) return;
    let stale = false;
    setLoading(true);
    setError(null);
    p.load(api.source, run)
      .then((loaded: RunInfo) => {
        if (stale) return;
        const st = useApp.getState();
        st.setInfo(index, loaded);
        applyDisplay(p);
        p.setColor?.(cssVar(`--series-${slot + 1}`));
        // Crowd runs start un-followed unless the user chose a mode before.
        if (!st.followChosen && loaded.envs > 1 && st.follow !== "off") st.set({ follow: "off" });
        applyFollow(p, useApp.getState().follow);
        restoreCamera(index, run, p);
        restoreEnv(index, run, p, loaded.envs);
        setLoading(false);
        settlePane(index, run);
        void p.highlights?.().then((doc) => {
          if (!stale) useApp.getState().setHighlights(index, doc);
        });
      })
      .catch((e: unknown) => {
        if (stale) return;
        setLoading(false);
        setError(String((e as Error)?.message ?? e));
        settlePane(index, run);
      });
    return () => {
      stale = true;
    };
  }, [api, run, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    player.current?.setTheme?.(theme, viewportColor());
    player.current?.setColor?.(cssVar(`--series-${slot + 1}`));
  }, [theme, slot]);

  useEffect(() => {
    if (player.current && info) applyFollow(player.current, follow);
  }, [follow, info?.run]); // eslint-disable-line react-hooks/exhaustive-deps

  const pinned = useApp((s) => s.pinned);
  useEffect(() => {
    if (isActive && count === 1) player.current?.pinEnvs?.(pinned);
  }, [pinned, isActive, count, info?.run]);

  useEffect(() => {
    if (refreshTick > 0) void player.current?.refresh?.();
  }, [refreshTick]);

  // Click (not drag) picks an env.
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (useApp.getState().active !== index) useApp.getState().setActive(index);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4 || performance.now() - d.t > 500) return;
    const hit = player.current?.pickEnv?.(e.clientX, e.clientY);
    if (hit !== null && hit !== undefined) player.current?.selectEnv?.(hit);
  };

  const compare = count > 1;
  return (
    <div ref={box} className="relative size-full min-h-0 min-w-0 overflow-hidden bg-viewport" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <canvas ref={canvas} className="absolute inset-0 block size-full touch-none outline-none" />
      {compare && isActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 ring-2 ring-inset" style={{ ["--tw-ring-color" as string]: seriesVar(slot) }} />
      ) : null}

      {isActive && guide ? (
        // The frame a capture will save: the largest one of that shape that fits in the view, about its centre.
        <div className="pointer-events-none absolute inset-0 z-10 [container-type:size]">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] ring-1 ring-white/80"
            style={{ width: `min(100cqw, 100cqh * ${guide})`, aspectRatio: String(guide) }}
          />
        </div>
      ) : null}

      {loading ? <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-muted-foreground/40" /> : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-lg border bg-card p-4 text-center">
            <TriangleAlert className="mx-auto mb-2 size-5 text-destructive" />
            <div className="text-sm font-medium">Could not open {run}. Choose another run, or check the server.</div>
            <p className="mt-1 break-words text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {compare ? (
        <div className="absolute left-3 top-3 z-20 flex h-8 max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-popover pl-2.5 pr-0.5 text-sm shadow-md ring-1 ring-foreground/10">
          <span className="size-2 shrink-0 rounded-full" style={{ background: seriesVar(slot) }} />
          <span className="shrink-0 text-xs text-muted-foreground">{SLOT_LETTERS[slot]}</span>
          <span className="truncate" title={run}>
            {run}
          </span>
          <Hint label="Close pane">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 shrink-0"
              aria-label={`Close ${run}`}
              onClick={(e) => {
                e.stopPropagation();
                useApp.getState().closePane(index);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X />
            </Button>
          </Hint>
        </div>
      ) : null}

      {info && info.envs > 1 ? <EnvStepper index={index} env={env} envs={info.envs} /> : null}
    </div>
  );
}

function EnvStepper({ index, env, envs }: { index: number; env: number; envs: number }) {
  const step = (d: number) => {
    useApp.getState().setActive(index);
    stepEnv(d);
  };
  return (
    <div
      className="absolute bottom-3 left-3 z-20 flex h-8 items-center gap-1 rounded-lg bg-popover pl-2.5 pr-0.5 text-sm shadow-md ring-1 ring-foreground/10"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="num">
        Env {formatCount(env)} of {formatCount(envs)}
      </span>
      <Hint label="Previous env" keys="[">
        <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Previous env" onClick={() => step(-1)}>
          <ChevronLeft />
        </Button>
      </Hint>
      <Hint label="Next env" keys="]">
        <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Next env" onClick={() => step(1)}>
          <ChevronRight />
        </Button>
      </Hint>
    </div>
  );
}
