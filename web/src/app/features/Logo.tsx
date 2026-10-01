import { cn } from "@/lib/utils";

/** The mark: a scope ring with a playhead tick and a trace through it. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
      <path
        d="M3.5 13.2c1.7 0 2.1-4.6 3.9-4.6s2 6.4 3.8 6.4 1.9-8.2 3.7-8.2 1.9 5.6 3.4 5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 2.5v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
