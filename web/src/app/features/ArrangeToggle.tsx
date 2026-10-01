import { Columns2, LayoutGrid, Rows2 } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/tooltip";
import { ARRANGE_LABELS, effectiveArrangement, isArrangement, type Arrangement } from "@/lib/panes";
import { useApp } from "@/lib/store";

const ICONS: Record<Arrangement, typeof Columns2> = { side: Columns2, stack: Rows2, grid: LayoutGrid };

/**
 * How compared runs share the viewport: side by side, stacked, or a grid
 * (contracts §10.1). `count` is the number of runs the choice is for, which
 * only matters for the default shown before the user has chosen.
 */
export function ArrangeToggle({ count }: { count: number }) {
  const choice = useApp((s) => s.arrange);
  const setArrange = useApp((s) => s.setArrange);
  const value = effectiveArrangement(count, choice);
  return (
    <ToggleGroup type="single" value={value} onValueChange={(v) => isArrangement(v) && setArrange(v)} aria-label="Arrange compared runs" className="shrink-0">
      {(Object.keys(ICONS) as Arrangement[]).map((a) => {
        const Icon = ICONS[a];
        return (
          <Hint key={a} label={ARRANGE_LABELS[a]}>
            <ToggleGroupItem value={a} aria-label={ARRANGE_LABELS[a]} className="size-7 min-w-7 shrink-0 px-0 [&_svg]:size-5! [&_svg]:shrink-0">
              <Icon strokeWidth={1.75} />
            </ToggleGroupItem>
          </Hint>
        );
      })}
    </ToggleGroup>
  );
}
