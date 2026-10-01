import { ChartLine, PanelLeftOpen, PanelRightOpen, Table2, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { useApp, type InspectorTab } from "@/lib/store";

import { Logo } from "./Logo";

/** The 40 px strip a collapsed sidebar leaves behind. */
export function LibraryRail({ onExpand }: { onExpand(): void }) {
  return (
    <div className="flex h-full flex-col items-center gap-1 bg-sidebar py-2">
      <Logo className="mb-1 size-[18px]" />
      <Hint label="Show library" side="right">
        <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label="Show library">
          <PanelLeftOpen />
        </Button>
      </Hint>
    </div>
  );
}

export function InspectorRail({ onExpand }: { onExpand(): void }) {
  const hasEnvs = useApp((s) => (s.infos[s.active]?.envs ?? 1) > 1);
  const tab = useApp((s) => s.tab);
  const open = (t: InspectorTab) => {
    useApp.setState({ tab: t });
    onExpand();
  };
  const item = (t: InspectorTab, label: string, Icon: typeof Table2) => (
    <Hint label={label} side="left">
      <Button variant="ghost" size="icon-sm" aria-pressed={tab === t} onClick={() => open(t)} aria-label={label} className="aria-pressed:bg-accent">
        <Icon />
      </Button>
    </Hint>
  );
  return (
    <div className="flex h-full flex-col items-center gap-1 bg-background py-2">
      <Hint label="Show panel" side="left">
        <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label="Show panel">
          <PanelRightOpen />
        </Button>
      </Hint>
      <div className="my-1 h-px w-5 bg-border" />
      {item("plots", "Plots", ChartLine)}
      {item("metadata", "Metadata", Table2)}
      {hasEnvs ? item("envs", "Envs", Layers) : null}
    </div>
  );
}
