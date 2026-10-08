import { useState } from "react";
import { Star } from "lucide-react";

import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Five neutral stars (C3). Hover previews; the filled count is the rounded mean rating. */
export function Stars({ value, onRate, disabled }: { value: number | null; onRate(v: number): void; disabled?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? (value === null ? 0 : Math.round(value));
  return (
    <div className="flex" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Hint key={n} label={`${n} star${n > 1 ? "s" : ""}`} keys={String(n)}>
          <button
            type="button"
            role="radio"
            aria-checked={Math.round(value ?? 0) === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onRate(n)}
            className="flex size-5 items-center justify-center rounded outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
          >
            <Star className={cn("size-3.5", n <= shown ? "fill-foreground text-foreground" : "text-muted-foreground")} strokeWidth={1.5} />
          </button>
        </Hint>
      ))}
    </div>
  );
}
