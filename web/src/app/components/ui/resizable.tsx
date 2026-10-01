import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

export const ResizablePanelGroup = ({ className, ...props }: React.ComponentProps<typeof Group>) => (
  <Group className={cn("size-full", className)} {...props} />
);
export const ResizablePanel = Panel;

/** A hairline with a wider invisible hit area; the accent shows on hover. */
export function ResizableHandle({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator className={cn("z-10 outline-none", className)} {...props} />;
}
