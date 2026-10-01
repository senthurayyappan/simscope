import * as React from "react";
import { Toggle as T } from "radix-ui";

import { variants } from "@/lib/utils";

// Pressed = bg-muted (shadcn nova). aria-pressed, not data-state: a tooltip
// trigger overwrites data-state on the same element.
const toggleVariants = variants(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-muted aria-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  { size: { default: "h-8 px-2.5", sm: "h-7 px-2", icon: "size-8", "icon-sm": "size-7" } },
  { size: "default" },
);

export function Toggle({
  className,
  size,
  ...props
}: React.ComponentProps<typeof T.Root> & { size?: "default" | "sm" | "icon" | "icon-sm" }) {
  return <T.Root className={toggleVariants({ size }, className)} {...props} />;
}
