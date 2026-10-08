import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApp } from "@/lib/store";
import { readBoot } from "@/lib/api";
import { isSoloExport } from "@/lib/boot";
import { prefs } from "@/lib/persist";

import { Drivers } from "./features/Drivers";
import { ErrorToast } from "./features/ErrorToast";
import { Inspector } from "./features/inspector/Inspector";
import { Library } from "./features/library/Library";
import { InspectorRail, LibraryRail } from "./features/Rail";
import { TimelinePanel } from "./features/timeline/Timeline";
import { timelineHeight } from "@/lib/timeline-math";
import { Viewport } from "./features/Viewport";

// Panel sizes are kept in pixels, not the percentages react-resizable-panels
// stores, so a size saved in a small window cannot squeeze the viewport in a
// large one. Every restored size is clamped against the current window.
const LIBRARY = { def: 256, min: 240, max: 420 };
const INSPECTOR = { def: 320, min: 280, max: 440 };
const CENTRE_MIN = 384; // the compare toolbar, with Export as an icon, needs about 380 px

interface Sizes {
  left?: number;
  right?: number;
}

function readSizes(): Sizes {
  return prefs.read().sizes ?? {};
}

const clampPx = (v: number | undefined, r: { def: number; min: number; max: number }) =>
  Math.round(Math.min(r.max, Math.max(r.min, Number.isFinite(v) ? (v as number) : r.def)));

/** Initial sidebar and timeline sizes for this window. */
function initialSizes(): { left: number; right: number; timeline: number } {
  const saved = readSizes();
  let left = clampPx(saved.left, LIBRARY);
  let right = clampPx(saved.right, INSPECTOR);
  const room = window.innerWidth - CENTRE_MIN;
  if (left + right > room) {
    // Give back from the inspector first, then the library, down to their minimums.
    right = Math.max(INSPECTOR.min, room - left);
    left = Math.max(LIBRARY.min, Math.min(left, room - right));
  }
  return { left, right, timeline: timelineHeight(0) };
}

type Collapsed = { left?: boolean; right?: boolean; timeline?: boolean };

function readCollapsed(): Collapsed {
  return prefs.read().collapsed ?? {};
}

function writeCollapsed(c: Collapsed) {
  prefs.patch({ collapsed: c });
}

const RAIL = 40;
const TRANSPORT = 44;

export function App() {
  const left = usePanelRef();
  const right = usePanelRef();
  const bottom = usePanelRef();
  const leftCollapsed = useApp((s) => s.leftCollapsed);
  const rightCollapsed = useApp((s) => s.rightCollapsed);
  const timelineCollapsed = useApp((s) => s.timelineCollapsed);

  const [init] = useState(initialSizes);
  // A full export of one run has nothing to list or group: no library, and the brand moves to the inspector.
  const [solo] = useState(() => isSoloExport(readBoot()));

  // Remember pixel sizes after the user drags a handle (never while collapsed).
  const saveSizes = (_: unknown, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction) return;
    const next: Sizes = { ...readSizes() };
    if (left.current && !left.current.isCollapsed()) next.left = clampPx(left.current.getSize().inPixels, LIBRARY);
    if (right.current && !right.current.isCollapsed()) next.right = clampPx(right.current.getSize().inPixels, INSPECTOR);
    prefs.patch({ sizes: next });
  };

  // Collapsed panels are remembered (only by the user's own toggles; the
  // narrow-window rule below is not persisted).
  useEffect(() => {
    const saved = readCollapsed();
    if (saved.left) left.current?.collapse();
    if (saved.right) right.current?.collapse();
    if (saved.timeline) bottom.current?.collapse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Narrow windows: tuck the sidebars away.
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      if (w < 900 && !right.current?.isCollapsed()) right.current?.collapse();
      if (w < 640 && !left.current?.isCollapsed()) left.current?.collapse();
    };
    fit();
    let timer = 0;
    const onResize = () => {
      clearTimeout(timer);
      timer = window.setTimeout(fit, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The timeline opens at its content height (L5) and follows the lane count.
  const lanes = useRef(0);
  const onLanes = useCallback((count: number) => {
    lanes.current = count;
    const panel = bottom.current;
    if (panel && !panel.isCollapsed()) panel.resize(`${timelineHeight(count)}px`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (ref: typeof left, key: "left" | "right" | "timeline") => () => {
    const panel = ref.current;
    if (!panel) return;
    const collapse = !panel.isCollapsed();
    if (collapse) panel.collapse();
    else if (key === "timeline") {
      // expand() would restore a remembered size, which is stale after a restore-collapsed start or a lane change
      // (the timeline then opens half hidden); always open at the content height for the current lanes.
      panel.expand();
      panel.resize(`${timelineHeight(lanes.current)}px`);
    } else panel.expand();
    writeCollapsed({ ...readCollapsed(), [key]: collapse });
  };

  return (
    <TooltipProvider>
      <div className="h-dvh w-full overflow-hidden bg-background text-foreground">
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChanged={saveSizes}
          resizeTargetMinimumSize={{ coarse: 20, fine: 8 }}
        >
          {solo ? null : (
            <>
              <ResizablePanel
                id="library"
                defaultSize={`${init.left}px`}
                minSize={`${LIBRARY.min}px`}
                maxSize={`${LIBRARY.max}px`}
                groupResizeBehavior="preserve-pixel-size"
                collapsible
                collapsedSize={`${RAIL}px`}
                panelRef={left}
                onResize={(s) => useApp.setState({ leftCollapsed: s.inPixels < RAIL + 24 })}
              >
                {leftCollapsed ? <LibraryRail onExpand={toggle(left, "left")} /> : <Library onCollapse={toggle(left, "left")} />}
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          <ResizablePanel id="centre" minSize={`${CENTRE_MIN}px`}>
            <ResizablePanelGroup
              orientation="vertical"
              onLayoutChanged={saveSizes}
              resizeTargetMinimumSize={{ coarse: 20, fine: 8 }}
            >
              <ResizablePanel id="viewport" minSize="140px">
                <Viewport />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel
                id="timeline"
                defaultSize={`${init.timeline}px`}
                minSize={`${timelineHeight(0)}px`}
                maxSize="60%"
                collapsible
                collapsedSize={`${TRANSPORT + 1}px`}
                panelRef={bottom}
                groupResizeBehavior="preserve-pixel-size"
                onResize={(s) => useApp.setState({ timelineCollapsed: s.inPixels < TRANSPORT + 24 })}
              >
                <TimelinePanel collapsed={timelineCollapsed} onToggleCollapse={toggle(bottom, "timeline")} onLanes={onLanes} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            id="inspector"
            defaultSize={`${init.right}px`}
            minSize={`${INSPECTOR.min}px`}
            maxSize={`${INSPECTOR.max}px`}
            groupResizeBehavior="preserve-pixel-size"
            collapsible
            collapsedSize={`${RAIL}px`}
            panelRef={right}
            onResize={(s) => useApp.setState({ rightCollapsed: s.inPixels < RAIL + 24 })}
          >
            {rightCollapsed ? <InspectorRail brand={solo} onExpand={toggle(right, "right")} /> : <Inspector brand={solo} onCollapse={toggle(right, "right")} />}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Drivers />
      <ErrorToast />
    </TooltipProvider>
  );
}
