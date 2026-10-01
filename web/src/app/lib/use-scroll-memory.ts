import { useEffect, useRef, type RefObject } from "react";

import { savedScroll, setScroll } from "./sync";

/**
 * Remembers a scroll container's offset for this tab (guideline P7) and puts
 * it back on mount once `ready` (its content exists). The restore waits a
 * second at most for the content to be tall enough, and gives way at once to
 * the user scrolling first.
 */
export function useScrollMemory(ref: RefObject<HTMLElement | null>, id: string, ready = true): void {
  const done = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let raf = 0;
    let tries = 0;
    const target = savedScroll(id);
    const apply = () => {
      if (done.current) return;
      if (!ready) return;
      if (target <= 0 || node.scrollHeight - node.clientHeight >= target - 1 || tries++ > 60) {
        done.current = true;
        node.scrollTop = target;
        return;
      }
      raf = requestAnimationFrame(apply);
    };
    apply();
    const onScroll = () => {
      done.current = true;
      cancelAnimationFrame(raf);
      setScroll(id, node.scrollTop);
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      node.removeEventListener("scroll", onScroll);
    };
  }, [ref, id, ready]);
}
