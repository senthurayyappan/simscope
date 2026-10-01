import * as React from "react";

import { variants } from "@/lib/utils";

const badgeVariants = variants(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      destructive: "border-transparent bg-destructive/10 text-destructive",
    },
  },
  { variant: "default" },
);

/** The only badge in the app is `Recording` (destructive); see UI guidelines I1. */
export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & { variant?: "default" | "secondary" | "outline" | "destructive" }) {
  return <span className={badgeVariants({ variant }, className)} {...props} />;
}
