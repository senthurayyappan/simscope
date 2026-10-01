import * as React from "react";

import { cn } from "@/lib/utils";

// The pieces of shadcn's Sidebar the library uses, with its class strings.
// The provider, mobile sheet and cookie logic are not needed: our sidebar is a
// resizable panel.

export function Sidebar({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar" className={cn("flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground", className)} {...props} />;
}
export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}
export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-2", className)} {...props} />;
}
export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("pointer-events-none flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground/70", className)}
      {...props}
    />
  );
}
