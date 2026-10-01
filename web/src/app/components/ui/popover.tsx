import * as React from "react";
import { Popover as P } from "radix-ui";

import { markMenuClosed } from "@/lib/menu-focus";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;

export function PopoverContent({ className, align = "start", sideOffset = 4, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn("z-50 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-hidden data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out", className)}
        {...props}
        onCloseAutoFocus={(e) => {
          markMenuClosed();
          props.onCloseAutoFocus?.(e);
        }}
      />
    </P.Portal>
  );
}
