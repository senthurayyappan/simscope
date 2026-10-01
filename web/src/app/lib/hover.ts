// The time a plot is hovered at, mirrored as a hairline on the timeline
// (the Foxglove pattern). Outside React: it changes on every pointer move.

let t: number | null = null;

export function setPlotHover(next: number | null): void {
  t = next;
}

export function getPlotHover(): number | null {
  return t;
}
