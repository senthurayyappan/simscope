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
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Hint } from "@/components/ui/tooltip";
import { setDisplay } from "@/lib/commands";
import { effectiveArrangement } from "@/lib/panes";

import { useApp, type GroundColor, type GroundKind, type ThemePref } from "@/lib/store";

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

const PILL = "pointer-events-auto flex items-center gap-0.5 rounded-lg bg-popover p-0.5 shadow-md ring-1 ring-foreground/10";

/**
 * Two groups of controls (V1). View options sit at the top left of the viewport: Blender-style overlay buttons, how
 * compared runs are laid out, and the theme. Capture and Export sit at the top right. Camera controls live in the
 * timeline bar. A comparison has one bar above its panes, with the groups at its two ends.
 */
export function ViewportToolbar({ inline = false }: { inline?: boolean }) {
  const info = useApp((s) => s.infos[s.active]);
  const panes = useApp((s) => s.panes.length);
  const compare = panes > 1;
  const hasRun = useApp((s) => s.panes.length > 0);
  const visual = useApp((s) => s.visual);
  const collision = useApp((s) => s.collision);
  const contacts = useApp((s) => s.contacts);
  const cameraSync = useApp((s) => s.cameraSync);
  const hasExport = useApp((s) => s.api?.mode === "http");
  const none = hasRun ? undefined : "Open a run first";

  const view = (
    <div className={PILL}>
      <ThemeMenu />
      <Divider />
      <GroundControl />
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
    </div>
  );

  const out = (
    <div className={PILL}>
      <CaptureMenu />
      {hasExport ? <ExportMenu compare={compare} /> : null}
    </div>
  );

  if (inline) {
    return (
      <div className="flex w-full items-center justify-between gap-2">
        {view}
        {out}
      </div>
    );
  }
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-20">{view}</div>
      <div className="pointer-events-none absolute right-3 top-3 z-20">{out}</div>
    </>
  );
}

/** What each ground colour looks like: two checker cells, for the swatch in the menu. */
const GROUND_COLORS: { id: GroundColor; label: string; cells: [string, string] }[] = [
  { id: "auto", label: "Automatic", cells: ["oklch(0.955 0 0)", "oklch(0.2 0 0)"] },
  { id: "light", label: "Light", cells: ["oklch(0.955 0 0)", "oklch(0.93 0 0)"] },
  { id: "dark", label: "Dark", cells: ["oklch(0.2 0 0)", "oklch(0.175 0 0)"] },
  { id: "mujoco", label: "Classic", cells: ["oklch(0.314 0.056 250)", "oklch(0.409 0.053 249.2)"] },
];

const GROUND_KINDS: { id: GroundKind; label: string }[] = [
  { id: "checker", label: "Checkerboard" },
  { id: "grid", label: "Grid" },
];

/**
 * The ground toggle, with a menu for its style and its colours. The menu opens below the toggle, its left edge under
 * the toggle's, so that it stays over the viewport. "Automatic" colours follow the theme; the others do not.
 */
function GroundControl() {
  const groundOn = useApp((s) => s.groundOn);
  const kind = useApp((s) => s.groundKind);
  const color = useApp((s) => s.groundColor);
  const setGroundKind = useApp((s) => s.setGroundKind);
  const setGroundColor = useApp((s) => s.setGroundColor);
  return (
    <Popover>
      <PopoverAnchor asChild>
        <div className="flex items-center">
          <Hint label="Show ground">
            <Toggle size="icon-sm" pressed={groundOn} onPressedChange={(v) => setDisplay({ groundOn: v })} aria-label="Show ground" className="rounded-r-none">
              <Grid3x3 />
            </Toggle>
          </Hint>
          <Hint label="Ground style and colour">
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="w-5 rounded-l-none px-0" aria-label="Ground style and colour">
                <ChevronDown />
              </Button>
            </PopoverTrigger>
          </Hint>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-56 gap-0 p-1">
        <Choices
          label="Ground"
          value={kind}
          options={GROUND_KINDS}
          onChange={(v) => {
            setGroundKind(v);
            setDisplay({ groundOn: true });
          }}
        />
        <Separator className="my-1" />
        <Choices
          label="Colour"
          value={color}
          options={GROUND_COLORS}
          onChange={(v) => {
            setGroundColor(v);
            setDisplay({ groundOn: true });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// A radio list inside a popover (Blender: the chevron opens the details).
function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; cells?: [string, string] }[];
  onChange(v: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col">
      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {options.map((it) => (
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
          {it.cells ? (
            <span
              aria-hidden
              className="ml-auto size-4 rounded-sm ring-1 ring-foreground/20"
              style={{ background: `linear-gradient(135deg, ${it.cells[0]} 50%, ${it.cells[1]} 50%)` }}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ExportMenu({ compare }: { compare: boolean }) {
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
              {/* A comparison has more controls on its bar, so its label needs more room. */}
              <span className={compare ? "@max-[31rem]/vp:hidden" : "@max-[29rem]/vp:hidden"}>Export</span>
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
