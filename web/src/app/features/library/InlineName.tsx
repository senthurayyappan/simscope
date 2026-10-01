import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface InlineNameProps {
  initial: string;
  label: string;
  maxLength?: number;
  /** Text size of the row being edited, so the field matches the name it replaces. */
  className?: string;
  /** A complaint to show under the field (one red line). */
  error?: string | null;
  /** Enter or blur. Return a promise resolving false to keep the editor open (the server refused). */
  onSave(value: string): void | Promise<boolean>;
  onCancel(): void;
  /** A restored draft: leaving the field keeps it open (Enter saves, Escape cancels) instead of saving by surprise. */
  restored?: boolean;
  /** The user edited the text. */
  onChange?(text: string): void;
}

/**
 * An inline name field in a list row: Enter or blur saves, Escape cancels. The
 * same height and font as the text it replaces. A refused name stays in the
 * field with the reason under it; leaving the field then cancels.
 */
export function InlineName({ initial, label, maxLength = 64, className, error, restored, onSave, onCancel, onChange }: InlineNameProps) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    el?.focus();
    // A restored draft keeps the caret at its end so typing continues it; a fresh name is selected to be replaced.
    if (restored) el?.setSelectionRange(el.value.length, el.value.length);
    else el?.select();
  }, []);
  const finish = (save: boolean, value: string) => {
    if (done.current) return;
    done.current = true;
    if (!save) {
      onCancel();
      return;
    }
    const result = onSave(value);
    if (result instanceof Promise) {
      void result.then((ok) => {
        if (ok) return;
        done.current = false;
        ref.current?.focus();
      });
    }
  };
  return (
    <>
      <input
        ref={ref}
        defaultValue={initial}
        maxLength={maxLength}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(true, e.currentTarget.value);
          else if (e.key === "Escape") finish(false, "");
          e.stopPropagation();
        }}
        // A name that was just refused is not sent again on blur: leaving means giving up.
        onBlur={(e) => !restored && finish(!error, e.currentTarget.value)}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30",
          className,
        )}
      />
      {error ? (
        <div role="alert" className="pointer-events-none absolute left-1.5 right-0 top-full z-30 -mt-0.5 rounded-sm bg-sidebar px-1 pb-1 pt-0.5 text-xs leading-4 text-destructive">
          {error}
        </div>
      ) : null}
    </>
  );
}
