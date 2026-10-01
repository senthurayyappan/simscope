import * as React from "react";
import { ToggleGroup as G } from "radix-ui";

import { cn } from "@/lib/utils";

/** shadcn ToggleGroup (outline-less default): items share a row, the active one is bg-muted. */
export function ToggleGroup({ className, ...props }: React.ComponentProps<typeof G.Root>) {
  return <G.Root className={cn("inline-flex items-center rounded-md", className)} {...props} />;
}

export function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof G.Item>) {
  return (
    <G.Item
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center gap-2 px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors first:rounded-l-md last:rounded-r-md hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-checked:bg-muted aria-checked:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
