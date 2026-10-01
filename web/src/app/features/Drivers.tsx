import { useEffect } from "react";

import { runAction } from "@/lib/commands";
import { isTypingTarget, resolveKey } from "@/lib/keys";
import { applyThemeClass, useApp } from "@/lib/store";

/** Headless effects: theme class, keyboard, polling, highlight reel. */
export function Drivers() {
  const theme = useApp((s) => s.themePref);

  // Theme: class on <html>; "system" follows the OS live.
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      applyThemeClass(dark ? "dark" : "light");
      if (useApp.getState().resolvedTheme !== (dark ? "dark" : "light")) {
        useApp.setState({ resolvedTheme: dark ? "dark" : "light" });
      }
    };
    apply();
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Keyboard (viewer v3 §13), suppressed while typing or in a menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat && e.key.length === 1 && "0123456789vtcfpunkm".includes(e.key.toLowerCase())) return;
      if (isTypingTarget(document.activeElement) || isTypingTarget(e.target as Element | null)) return;
      const action = resolveKey(e);
      if (action && runAction(action)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Live tail: poll /api/changes once a second (http mode only).
  const mode = useApp((s) => s.api?.mode);
  useEffect(() => {
    if (mode !== "http") return;
    let busy = false;
    const id = window.setInterval(async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        await useApp.getState().poll();
      } finally {
        busy = false;
      }
    }, 1000);
    return () => clearInterval(id);
  }, [mode]);

  return null;
}
