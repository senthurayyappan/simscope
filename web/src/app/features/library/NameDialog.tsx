import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** One text field in a dialog: new group, rename group. */
export function NameDialog({
  open,
  title,
  description,
  initial = "",
  submit,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  initial?: string;
  submit: string;
  onSubmit(value: string): void;
  onClose(): void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);
  const ok = value.trim().length > 0 && value.trim().length <= 64;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onSubmit(value.trim());
          }}
        >
          <div className="grid gap-1.5">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </div>
          <Input autoFocus value={value} maxLength={64} onChange={(e) => setValue(e.target.value)} aria-label="Name" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok}>
              {submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
