import { ChevronDown, Crosshair, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  MenuHint,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { frame, setView } from "@/lib/commands";
import type { FollowMode, ViewName } from "@/lib/core";
import { useApp } from "@/lib/store";

const VIEWS: { id: ViewName; label: string }[] = [
  { id: "iso", label: "Iso" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "top", label: "Top" },
];

const FOLLOW: { id: FollowMode; label: string; hint?: string }[] = [
  { id: "off", label: "Off" },
  { id: "position", label: "Position", hint: "Track x and y" },
  { id: "pose", label: "Pose", hint: "Track x, y and z" },
  { id: "heading", label: "Heading", hint: "Turn with the body's yaw" },
];

/** Camera presets, framing and follow in one menu, built like the speed menu (TL3). */
export function CameraMenu() {
  const view = useApp((s) => s.camView);
  const follow = useApp((s) => s.follow);
  const setFollowMode = useApp((s) => s.setFollowMode);
  const hasRun = useApp((s) => s.panes.length > 0);
  const multi = useApp((s) => (s.infos[s.active]?.envs ?? 1) > 1);
  return (
    <DropdownMenu>
      <Hint label="Camera">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 px-2" disabled={!hasRun} aria-label="Camera">
            <Video />
            <span className="@max-[34rem]:hidden">{VIEWS.find((v) => v.id === view)?.label ?? "Free"}</span>
            {follow !== "off" ? <Crosshair className="size-3.5" aria-label="Following" /> : null}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>View</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={view ?? ""} onValueChange={(v) => v && setView(v as ViewName)}>
          {VIEWS.map((v) => (
            <DropdownMenuRadioItem key={v.id} value={v.id}>
              {v.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => frame("focus")}>Frame</DropdownMenuItem>
        {multi ? (
          <DropdownMenuItem onSelect={() => frame("all")}>
            Frame all envs
            <DropdownMenuShortcut>0</DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center">
          Follow
          <DropdownMenuShortcut>F</DropdownMenuShortcut>
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={follow} onValueChange={(v) => setFollowMode(v as FollowMode)}>
          {FOLLOW.map((f) => (
            <DropdownMenuRadioItem key={f.id} value={f.id} className="items-start">
              <span>
                {f.label}
                {f.hint ? <MenuHint>{f.hint}</MenuHint> : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
