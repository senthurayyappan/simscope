import * as React from "react"
import { cn } from "@/lib/utils"

// shadcn's Slider look and props, on a native range input: Radix's slider
// costs about 4 KB gzipped, more than the app's size budget has room for.
// One thumb only. The filled part of the track is a gradient set from the value.

function Slider({
  className,
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "min" | "max" | "step" | "type" | "onChange"> & {
  value: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?(value: number[]): void
}) {
  const v = value[0] ?? min
  const fill = max > min ? ((v - min) / (max - min)) * 100 : 0
  return (
    <input
      data-slot="slider"
      type="range"
      value={v}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onValueChange?.([Number(e.currentTarget.value)])}
      style={{ "--fill": `${fill}%` } as React.CSSProperties}
      className={cn(
        "h-3 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--primary)_var(--fill),var(--muted)_var(--fill))]",
        "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(to_right,var(--primary)_var(--fill),var(--muted)_var(--fill))]",
        "[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ring [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-[box-shadow] hover:[&::-webkit-slider-thumb]:ring-3 hover:[&::-webkit-slider-thumb]:ring-ring/50 focus-visible:[&::-webkit-slider-thumb]:ring-3 focus-visible:[&::-webkit-slider-thumb]:ring-ring/50",
        "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ring [&::-moz-range-thumb]:bg-white hover:[&::-moz-range-thumb]:ring-3 hover:[&::-moz-range-thumb]:ring-ring/50 focus-visible:[&::-moz-range-thumb]:ring-3 focus-visible:[&::-moz-range-thumb]:ring-ring/50",
        className
      )}
      {...props}
    />
  )
}

export { Slider }
