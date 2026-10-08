import { Box, ChevronDown, Download, FileCode2, Footprints, Grid3x3, Link2, Monitor, Moon, ScanEye, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MenuHint,
} from "@/components/ui/dropdown-menu";
import { ArrangeToggle } from "./ArrangeToggle";
import { CaptureMenu } from "./CaptureMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { Hint } from "@/components/ui/tooltip";
import { setDisplay } from "@/lib/commands";
import { effectiveArrangement } from "@/lib/panes";

import { useApp, type GroundKind, type ThemePref } from "@/lib/store";

const Divider = () => <div className="mx-0.5 h-4 w-px bg-border" />;

/** An icon toggle that may be disabled with a reason (I6): the tooltip sits on a wrapper because a disabled button gets no pointer events. */
function OverlayToggle({
  label,
  keys,
  disabledReason,
  pressed,
  onPressedChange,
  children,
}: {
  label: string;
  keys?: string;
  disabledReason?: string;
  pressed: boolean;
  onPressedChange(v: boolean): void;
  children: React.ReactNode;
}) {
  return (
    <Hint label={disabledReason ?? label} keys={disabledReason ? undefined : keys}>
      <span>
        <Toggle size="icon-sm" pressed={pressed && !disabledReason} disabled={!!disabledReason} onPressedChange={onPressedChange} aria-label={label}>
          {children}
        </Toggle>
      </span>
    </Hint>
  );
}

/** Blender-style overlay buttons, then Export and Theme (V1). Camera controls live in the timeline bar. */
export function ViewportToolbar({ inline = false }: { inline?: boolean }) {
  const info = useApp((s) => s.infos[s.active]);
  const panes = useApp((s) => s.panes.length);
  const compare = panes > 1;
  const hasRun = useApp((s) => s.panes.length > 0);
  const groundOn = useApp((s) => s.groundOn);
  const visual = useApp((s) => s.visual);
  const collision = useApp((s) => s.collision);
  const contacts = useApp((s) => s.contacts);
  const cameraSync = useApp((s) => s.cameraSync);
  const hasExport = useApp((s) => s.api?.mode === "http");
  const none = hasRun ? undefined : "Open a run first";

  return (
    <div className={inline ? "" : "pointer-events-none absolute right-3 top-3 z-20"}>
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-popover p-0.5 shadow-md ring-1 ring-foreground/10">
        <div className="flex items-center">
          <Hint label="Show ground">
            <Toggle size="icon-sm" pressed={groundOn} onPressedChange={(v) => setDisplay({ groundOn: v })} aria-label="Show ground" className="rounded-r-none">
              <Grid3x3 />
            </Toggle>
          </Hint>
          <GroundPopover />
        </div>
        <OverlayToggle label="Show visual geometry" disabledReason={none} pressed={visual} onPressedChange={(v) => setDisplay({ visual: v })}>
          <ScanEye />
        </OverlayToggle>
        <OverlayToggle
          label="Show collision geometry"
          disabledReason={none ?? (info && !info.hasCollision ? "No collision geometry in this run" : undefined)}
          pressed={collision}
          onPressedChange={(v) => setDisplay({ collision: v })}
        >
          <Box />
        </OverlayToggle>
        <OverlayToggle
          label="Show contact forces"
          keys="C"
          disabledReason={none ?? (info && !info.hasContacts ? "No contact data in this run" : undefined)}
          pressed={contacts}
          onPressedChange={(v) => setDisplay({ contacts: v })}
        >
          <Footprints />
        </OverlayToggle>
        {compare ? (
          <>
            <Divider />
            <ArrangeToggle count={panes} />
            <Hint label="Sync cameras">
              <Toggle size="icon-sm" pressed={cameraSync} onPressedChange={(v) => useApp.setState({ cameraSync: v })} aria-label="Sync cameras">
                <Link2 />
              </Toggle>
            </Hint>
          </>
        ) : null}
        <Divider />
        <CaptureMenu />
        {hasExport ? <ExportMenu /> : null}
        <Divider />
        <ThemeMenu />
      </div>
    </div>
  );
}

function GroundPopover() {
  const kind = useApp((s) => s.groundKind);
  const setGroundKind = useApp((s) => s.setGroundKind);
  return (
    <Popover>
      <Hint label="Ground style">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="w-5 rounded-l-none px-0" aria-label="Ground style">
            <ChevronDown />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-44 p-1">
        <DropdownMenuRadioGroupShim
          value={kind}
          onChange={(v) => {
            setGroundKind(v);
            setDisplay({ groundOn: true });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// A radio list inside a popover (Blender: the chevron opens the details).
function DropdownMenuRadioGroupShim({ value, onChange }: { value: GroundKind; onChange(v: GroundKind): void }) {
  const items: { id: GroundKind; label: string }[] = [
    { id: "checker", label: "Checkerboard" },
    { id: "grid", label: "Grid" },
  ];
  return (
    <div role="radiogroup" aria-label="Ground" className="flex flex-col">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Ground</div>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          onClick={() => onChange(it.id)}
          className="relative flex items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-sm outline-hidden hover:bg-accent focus-visible:bg-accent"
        >
          {value === it.id ? <span className="absolute left-2.5 size-1.5 rounded-full bg-foreground" /> : null}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function ExportMenu() {
  const api = useApp((s) => s.api);
  const panes = useApp((s) => s.panes);
  const arrange = useApp((s) => s.arrange);
  const disabled = panes.length === 0;
  const runs = panes.map((p) => p.name);
  const layout = runs.length > 1 ? "compare" : "single";
  const item = (ui: "lean" | "full", title: string, hint: string, Icon: typeof Download) => (
    <DropdownMenuItem asChild>
      <a href={api?.exportUrl({ runs, layout, ui, arrange: effectiveArrangement(runs.length, arrange) }) ?? "#"} download className="items-start gap-3 py-2">
        <Icon className="mt-0.5" />
        <span>
          {title}
          <MenuHint>{hint}</MenuHint>
        </span>
      </a>
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <Hint label={disabled ? "Open a run first" : runs.length > 1 ? "Export the compared runs" : "Export this run"}>
        <span>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={disabled} className="gap-1.5 px-2" aria-label="Export">
              <Download />
              <span className="@max-[29rem]/vp:hidden">Export</span>
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
        </span>
      </Hint>
      <DropdownMenuContent align="end" className="w-72">
        {item("lean", "Player page", runs.length > 1 ? `A small HTML file that plays these ${runs.length} runs side by side. Works offline.` : "A small HTML file that plays this run. Works offline.", FileCode2)}
        <DropdownMenuSeparator />
        {item("full", "Full viewer", runs.length > 1 ? `The complete viewer in one HTML file, with these ${runs.length} runs. Works offline.` : "The complete viewer in one HTML file. Works offline.", Download)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeMenu() {
  const pref = useApp((s) => s.themePref);
  const resolved = useApp((s) => s.resolvedTheme);
  const setTheme = useApp((s) => s.setTheme);
  const Icon = pref === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  return (
    <DropdownMenu>
      <Hint label="Theme" keys="T">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Theme">
            <Icon />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setTheme(v as ThemePref)}>
          <DropdownMenuRadioItem value="light">
            <Sun />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
