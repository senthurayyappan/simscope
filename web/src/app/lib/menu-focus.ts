// When a menu or popover closes, Radix returns focus to its trigger. A tooltip
// on that trigger would open on the focus event and stay until the user clicks
// elsewhere. Menus stamp their close time here; `Hint` ignores focus-opens for
// a moment after it.

let closedAt = -Infinity;

export function markMenuClosed(): void {
  closedAt = performance.now();
}

export function menuJustClosed(withinMs = 400): boolean {
  return performance.now() - closedAt < withinMs;
}
