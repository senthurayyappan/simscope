import * as React from "react";
import { Slot } from "radix-ui";

import { variants } from "@/lib/utils";

export const buttonVariants = variants(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      destructive: "bg-destructive text-white hover:bg-destructive/90",
      outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent data-[state=open]:bg-accent",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-8 px-3",
      sm: "h-7 gap-1.5 px-2.5",
      icon: "size-8",
      "icon-sm": "size-7",
    },
  },
  { variant: "default", size: "default" },
);

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "icon" | "icon-sm";
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={buttonVariants({ variant, size }, className)}
      {...props}
    />
  );
}
