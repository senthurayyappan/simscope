import { useEffect } from "react";
import { TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";

export function ErrorToast() {
  const error = useApp((s) => s.error);
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => useApp.setState({ error: null }), 7000);
    return () => clearTimeout(id);
  }, [error]);
  if (!error) return null;
  return (
    <div role="alert" className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg bg-popover p-3 pr-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 break-words text-sm">{error}</p>
      <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => useApp.setState({ error: null })} aria-label="Dismiss">
        <X />
      </Button>
    </div>
  );
}
