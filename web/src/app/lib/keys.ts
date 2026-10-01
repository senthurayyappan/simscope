// The keyboard map (viewer v3 §13) as a pure function, so it can be tested
// without a DOM. The app feeds it KeyboardEvents and runs the action.

export type Action =
  | { type: "toggle-play" }
  | { type: "step"; frames: number }
  | { type: "run"; delta: -1 | 1 }
  | { type: "next-unrated" }
  | { type: "rate"; value: number }
  | { type: "favorite" }
  | { type: "env"; delta: -1 | 1 }
  | { type: "follow" }
  | { type: "frame-all" }
  | { type: "zoom"; factor: number }
  | { type: "pan"; fraction: number }
  | { type: "label" }
  | { type: "contacts" }
  | { type: "theme" }
  | { type: "escape" };

export interface KeyLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** Maps a key press to an action, or null when the app does not use it. */
export function resolveKey(e: KeyLike): Action | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const shift = !!e.shiftKey;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  switch (k) {
    case "k":
      return { type: "toggle-play" };
    case "j":
      return { type: "step", frames: shift ? -10 : -1 };
    case "l":
      return { type: "step", frames: shift ? 10 : 1 };
    case "n":
      return { type: "run", delta: 1 };
    case "p":
      return { type: "run", delta: -1 };
    case "u":
      return { type: "next-unrated" };
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
      return { type: "rate", value: Number(k) };
    case "v":
      return { type: "favorite" };
    case "[":
      return { type: "env", delta: -1 };
    case "]":
      return { type: "env", delta: 1 };
    case "f":
      return { type: "follow" };
    case "0":
      return { type: "frame-all" };
    case "w":
      return { type: "zoom", factor: 0.7 };
    case "s":
      return { type: "zoom", factor: 1 / 0.7 };
    case "a":
      return { type: "pan", fraction: -0.15 };
    case "d":
      return { type: "pan", fraction: 0.15 };
    case "m":
      return { type: "label" };
    case "c":
      return { type: "contacts" };
    case "t":
      return { type: "theme" };
    case "Escape":
      return { type: "escape" };
    default:
      return null;
  }
}

/** True if key events from `el` belong to a text field or an open menu. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return !!el.closest('[role="menu"],[role="listbox"],[role="dialog"],[role="combobox"]');
}
