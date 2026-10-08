import { useRef } from "react";
import { PanelRightClose } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hint } from "@/components/ui/tooltip";
import { useApp, type InspectorTab } from "@/lib/store";
import { useScrollMemory } from "@/lib/use-scroll-memory";

import { Logo } from "../Logo";
import { EnvsTab } from "./EnvsTab";
import { MetadataTab } from "./MetadataTab";
import { PlotsTab } from "./PlotsTab";

/** The right panel opens on Plots (P2); Metadata is a table; Envs only exists for batched runs. */
export function Inspector({ onCollapse, brand = false }: { onCollapse(): void; brand?: boolean }) {
  const tab = useApp((s) => s.tab);
  const envs = useApp((s) => s.infos[s.active]?.envs ?? 1);
  const hasEnvs = envs > 1;
  const value: InspectorTab = tab === "envs" && !hasEnvs ? "plots" : tab;
  const manifestReady = useApp((s) => s.manifest !== null);
  const metaScroll = useRef<HTMLDivElement>(null);
  useScrollMemory(metaScroll, "metadata", value === "metadata" && manifestReady);

  const hide = (
    <Hint label="Hide panel" side="left">
      <Button variant="ghost" size="icon-sm" onClick={onCollapse} aria-label="Hide panel">
        <PanelRightClose />
      </Button>
    </Hint>
  );

  return (
    <Tabs value={value} onValueChange={(v) => useApp.setState({ tab: v as InspectorTab })} className="h-full min-h-0 flex-col gap-0 bg-card">
      {brand ? (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b pl-4 pr-2">
          <Logo />
          <span className="text-base font-semibold">simscope</span>
          <div className="ml-auto flex items-center">{hide}</div>
        </div>
      ) : null}
      <div className="flex h-10 shrink-0 items-center border-b px-2">
        <TabsList variant="line">
          <TabsTrigger value="plots">Plots</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          {hasEnvs ? <TabsTrigger value="envs">Envs</TabsTrigger> : null}
        </TabsList>
        {brand ? null : <div className="ml-auto flex items-center">{hide}</div>}
      </div>
      <TabsContent value="plots">
        <PlotsTab />
      </TabsContent>
      <TabsContent value="metadata" ref={metaScroll} className="overflow-y-auto overflow-x-hidden">
        <MetadataTab />
      </TabsContent>
      {hasEnvs ? (
        <TabsContent value="envs">
          <EnvsTab />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
