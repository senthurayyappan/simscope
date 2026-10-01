import { cn } from "@/lib/utils";

/** The mark: a magnifying glass with a trace in its lens. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.75" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M7 11.4c.9 0 1.1-2.6 2-2.6s1.1 3.4 2 3.4 1.1-4.2 2-4.2.9 3 1.5 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
