import type { ComponentType, ReactNode } from "react";
import { FolderInput, FolderPlus, FolderX, GitCompareArrows, Pencil, Pin, PinOff, Play } from "lucide-react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_COMPARE, useApp } from "@/lib/store";
import type { RunRow } from "@/lib/types";

// The same items serve the right-click menu and the row's "…" menu (guidelines: Components).
interface Kit {
  Content: ComponentType<{ children?: ReactNode; className?: string; align?: "start" | "end" }>;
  Item: ComponentType<{ children?: ReactNode; onSelect?: () => void; disabled?: boolean }>;
  Separator: ComponentType;
  Shortcut: ComponentType<{ children?: ReactNode }>;
  Sub: ComponentType<{ children?: ReactNode }>;
  SubTrigger: ComponentType<{ children?: ReactNode }>;
  SubContent: ComponentType<{ children?: ReactNode; className?: string }>;
}

const contextKit: Kit = {
  Content: ContextMenuContent,
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

const dropdownKit: Kit = {
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
};

export const RunContextMenu = (p: RunMenuProps) => <Menu kit={contextKit} {...p} />;
export const RunDropdownMenu = (p: RunMenuProps) => <Menu kit={dropdownKit} {...p} />;

export interface RunMenuProps {
  run: RunRow;
  onNewGroup(names: string[]): void;
}

function Menu({ kit, run, onNewGroup }: RunMenuProps & { kit: Kit }) {
  const picks = useApp((s) => s.picks);
  const rows = useApp((s) => s.rows);
  const groups = useApp((s) => s.groups);
  const writable = useApp((s) => !!s.api?.writable);
  const { openRun, togglePick, annotateRun, moveToGroup } = useApp.getState();
  const { Content, Item, Separator, Shortcut, Sub, SubTrigger, SubContent } = kit;

  const picked = picks.some((p) => p.name === run.name);
  // The menu acts on every picked run when the clicked one is among them.
  const targets = picked ? picks.map((p) => p.name) : [run.name];
  const anyGrouped = rows.some((r) => targets.includes(r.name) && r.group);
  const full = !picked && picks.length >= MAX_COMPARE;

  return (
    <Content className="w-56" align="end">
      <Item onSelect={() => openRun(run.name)}>
        <Play />
        Open
        <Shortcut>⏎</Shortcut>
      </Item>
      <Item onSelect={() => togglePick(run.name)} disabled={full}>
        <GitCompareArrows />
        {picked ? "Remove from compare" : full ? "Compare takes up to 4 runs" : "Add to compare"}
        {!full ? <Shortcut>Space</Shortcut> : null}
      </Item>
      {writable ? (
        <>
          <Item onSelect={() => void annotateRun(run.name, { op: "favorite", value: !run.favorite })}>
            {run.favorite ? <PinOff /> : <Pin />}
            {run.favorite ? "Unpin" : "Pin"}
          </Item>
          {/* After the menu closes, so its focus return does not end the editor at once. */}
          <Item onSelect={() => setTimeout(() => useApp.getState().startRename(run.name), 80)}>
            <Pencil />
            Rename
          </Item>
          {groups ? (
            <>
              <Separator />
              <Sub>
                <SubTrigger>
                  <FolderInput className="size-4 text-muted-foreground" />
                  {targets.length > 1 ? `Move ${targets.length} runs to group` : "Move to group"}
                </SubTrigger>
                <SubContent className="w-48">
                  {groups.groups.map((g) => (
                    <Item key={g.name} onSelect={() => void moveToGroup(targets, g.name)}>
                      <span className="truncate">{g.name}</span>
                    </Item>
                  ))}
                  {groups.groups.length ? <Separator /> : null}
                  <Item onSelect={() => onNewGroup(targets)}>
                    <FolderPlus />
                    New group…
                  </Item>
                </SubContent>
              </Sub>
              {anyGrouped ? (
                <Item onSelect={() => void moveToGroup(targets, null)}>
                  <FolderX />
                  Remove from group
                </Item>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Content>
  );
}
