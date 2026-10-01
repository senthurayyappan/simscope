import * as React from "react";
import { ContextMenu as M } from "radix-ui";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { menuItem, menuSurface } from "./dropdown-menu";

export const ContextMenu = M.Root;
export const ContextMenuTrigger = M.Trigger;
export const ContextMenuSub = M.Sub;

export function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content collisionPadding={8} className={cn(menuSurface, "min-w-48", className)} {...props} />
    </M.Portal>
  );
}

export function ContextMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return <M.Item className={cn(menuItem, className)} {...props} />;
}

export function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export function ContextMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto pl-4 text-xs text-muted-foreground", className)} {...props} />;
}

export function ContextMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof M.SubTrigger>) {
  return (
    <M.SubTrigger className={cn(menuItem, "data-[state=open]:bg-accent", className)} {...props}>
      {children}
      <ChevronRight className="ml-auto" />
    </M.SubTrigger>
  );
}

export function ContextMenuSubContent({ className, ...props }: React.ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent className={cn(menuSurface, "shadow-lg", className)} {...props} />
    </M.Portal>
  );
}
