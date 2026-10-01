import * as React from "react";
import { Tabs as T } from "radix-ui";

import { cn } from "@/lib/utils";

export const Tabs = T.Root;

/** shadcn Tabs, line variant: a foreground underline on the active tab. */
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("flex h-10 shrink-0 items-stretch gap-1 border-b px-2", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "relative inline-flex items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground data-[state=active]:text-foreground",
        "after:absolute after:inset-x-1.5 after:bottom-[-1px] after:h-0.5 after:bg-foreground after:opacity-0 data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof T.Content>) {
  return <T.Content className={cn("min-h-0 flex-1 outline-none data-[state=inactive]:hidden", className)} {...props} />;
}
