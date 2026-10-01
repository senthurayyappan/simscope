import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { ArrowUpDown, ChevronDown, ChevronRight, Ellipsis, FolderPlus, PanelLeftClose, Search, SearchX, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Sidebar, SidebarFooter, SidebarHeader, SidebarMenuBadge } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildSections,
  flatOrder,
  shortName,
  SECTION_LIMIT,
  SORT_LABELS,
  type LibraryView,
  type Section,
  type SortKey,
} from "@/lib/filters";
import { MAX_COMPARE, useApp } from "@/lib/store";
import { seriesVar, SLOT_LETTERS } from "@/lib/palette";
import type { RunRow } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Logo } from "../Logo";
import { NameDialog } from "./NameDialog";
import { RunContextMenu } from "./RunMenu";
import { RunRowItem } from "./RunRow";

type Item =
  | { kind: "header"; section: Section }
  | { kind: "row"; section: Section; run: RunRow }
  | { kind: "more"; section: Section; remaining: number }
  | { kind: "empty"; section: Section }
  | { kind: "new-group" };

// Rows are 32 px plus 1 px of gap above and below, so a ring never touches its neighbour.
const HEIGHT = { header: 32, row: 34, more: 28, empty: 28, "new-group": 36 } as const;

export function Library({ onCollapse }: { onCollapse(): void }) {
  const s = useApp(
    useShallow((st) => ({
      rows: st.rows,
      loaded: st.rowsLoaded,
      view: st.libraryView,
      query: st.query,
      sort: st.sort,
      groups: st.groups,
      expanded: st.expanded,
      folded: st.folded,
      panes: st.panes,
      active: st.active,
      picks: st.picks,
      cursor: st.cursor,
      live: st.live,
      library: st.library,
      mode: st.api?.mode,
      writable: !!st.api?.writable,
    })),
  );
  const act = useApp.getState();
  const activeName = s.panes[s.active]?.name;
  const deferred = useDeferredValue(s.query);
  const searching = deferred.trim().length > 0;

  const groupNames = useMemo(() => s.groups?.groups.map((g) => g.name) ?? [], [s.groups]);
  const sections = useMemo(
    () => buildSections(s.rows, { view: s.view, query: deferred, sort: s.sort, groups: groupNames }),
    [s.rows, s.view, deferred, s.sort, groupNames],
  );
  const order = useMemo(() => flatOrder(sections), [sections]);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const sec of sections) {
      out.push({ kind: "header", section: sec });
      if (s.folded.includes(sec.id)) continue;
      const all = searching || s.expanded.includes(sec.id);
      let shown = all ? sec.runs : sec.runs.slice(0, SECTION_LIMIT);
      // The open run stays visible even when it is under "Show N more".
      if (!all && sec.kind !== "pinned") {
        const open = sec.runs.findIndex((r) => r.name === activeName);
        if (open >= SECTION_LIMIT) shown = [...shown, sec.runs[open]];
      }
      for (const run of shown) out.push({ kind: "row", section: sec, run });
      if (sec.runs.length === 0) out.push({ kind: "empty", section: sec });
      else if (shown.length < sec.runs.length) out.push({ kind: "more", section: sec, remaining: sec.runs.length - shown.length });
    }
    if (s.view === "group" && s.writable && s.groups) out.push({ kind: "new-group" });
    return out;
  }, [sections, s.folded, s.expanded, searching, s.view, s.writable, s.groups, activeName]);

  // Names for dialogs.
  const [dialog, setDialog] = useState<{ names: string[] } | null>(null);
  const onNewGroup = useCallback((names: string[]) => setDialog({ names }), []);

  // Virtual list with a sticky section header (TanStack's sticky recipe).
  const scroller = useRef<HTMLDivElement>(null);
  const stickyIdx = useRef(0);
  const headerIdx = useMemo(() => items.flatMap((it, i) => (it.kind === "header" ? [i] : [])), [items]);
  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: (i) => HEIGHT[items[i].kind],
    overscan: 10,
    rangeExtractor: useCallback(
      (range: Range) => {
        stickyIdx.current = [...headerIdx].reverse().find((i) => range.startIndex >= i) ?? -1;
        const keep = new Set(defaultRangeExtractor(range));
        if (stickyIdx.current >= 0) keep.add(stickyIdx.current);
        return [...keep].sort((a, b) => a - b);
      },
      [headerIdx],
    ),
  });

  // Keep the open run in view when it changes by key (N, P, U).
  useEffect(() => {
    if (!activeName) return;
    const i = items.findIndex((it) => it.kind === "row" && it.run.name === activeName && it.section.kind !== "pinned");
    if (i >= 0) virt.scrollToIndex(i, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeName]);

  const anchor = useRef<string | null>(null);
  const onOpen = useCallback((run: RunRow, e: React.MouseEvent) => {
    const st = useApp.getState();
    if (e.shiftKey && anchor.current) {
      const a = order.findIndex((r) => r.name === anchor.current);
      const b = order.findIndex((r) => r.name === run.name);
      if (a >= 0 && b >= 0) st.pickRange(order.slice(Math.min(a, b), Math.max(a, b) + 1).map((r) => r.name));
      return;
    }
    anchor.current = run.name;
    if (e.metaKey || e.ctrlKey) {
      st.togglePick(run.name);
      return;
    }
    st.setCursor(run.name);
    st.openRun(run.name);
  }, [order]);
  const onPick = useCallback((run: RunRow) => {
    anchor.current = run.name;
    useApp.getState().togglePick(run.name);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const rowIdx = items.flatMap((it, i) => (it.kind === "row" ? [i] : []));
    if (rowIdx.length === 0) return;
    const cur = rowIdx.findIndex((i) => (items[i] as Extract<Item, { kind: "row" }>).run.name === (s.cursor ?? activeName));
    const go = (k: number) => {
      const j = Math.min(rowIdx.length - 1, Math.max(0, k));
      const it = items[rowIdx[j]] as Extract<Item, { kind: "row" }>;
      act.setCursor(it.run.name);
      virt.scrollToIndex(rowIdx[j], { align: "auto" });
    };
    const at = cur < 0 ? 0 : cur;
    const row = (items[rowIdx[at]] as Extract<Item, { kind: "row" }>).run;
    switch (e.key) {
      case "ArrowDown":
        go(cur < 0 ? 0 : at + 1);
        break;
      case "ArrowUp":
        go(at - 1);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(rowIdx.length - 1);
        break;
      case "PageDown":
        go(at + 8);
        break;
      case "PageUp":
        go(at - 8);
        break;
      case "Enter":
        act.openRun(row.name);
        break;
      case " ":
        act.togglePick(row.name);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const slotOf = (name: string): number => {
    const p = s.picks.find((x) => x.name === name);
    if (p) return p.slot;
    if (s.panes.length > 1) return s.panes.find((x) => x.name === name)?.slot ?? -1;
    return -1;
  };

  const total = s.rows.length;
  const noGroupView = false;

  return (
    <Sidebar>
      <SidebarHeader className="gap-2 p-2 pb-1">
        <div className="flex h-8 items-center gap-2 px-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-2">
                <Logo className="size-[18px]" />
                <span className="text-sm font-semibold">simscope</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">{s.library?.name ?? "Library"}</TooltipContent>
          </Tooltip>
          <Hint label="Hide library" side="right">
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onCollapse} aria-label="Hide library">
              <PanelLeftClose />
            </Button>
          </Hint>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={s.query}
            onChange={(e) => act.setQuery(e.target.value)}
            placeholder="Search runs"
            className="pl-8 pr-8"
            aria-label="Search runs"
          />
          {s.query ? (
            <button
              type="button"
              onClick={() => act.setQuery("")}
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="flex h-7 items-center justify-between gap-2">
          {s.groups && (s.groups.groups.length > 0 || s.writable) ? (
            <ToggleGroup type="single" value={s.view} onValueChange={(v) => v && act.setLibraryView(v as LibraryView)} aria-label="Group runs by">
              <ToggleGroupItem value="date">Date</ToggleGroupItem>
              <ToggleGroupItem value="group">Group</ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <span className="px-2 text-sm text-muted-foreground">{total === 1 ? "1 run" : `${total.toLocaleString("en-US")} runs`}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 text-muted-foreground">
                <ArrowUpDown className="size-3.5" />
                {SORT_LABELS[s.sort]}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={s.sort} onValueChange={(v) => act.setSort(v as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <DropdownMenuRadioItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarHeader>

      <div
        ref={scroller}
        role="listbox"
        aria-label="Runs"
        aria-multiselectable
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="group/list min-h-0 flex-1 overflow-y-auto overflow-x-hidden border-t outline-none"
      >
        {!s.loaded ? (
          <ListSkeleton />
        ) : total === 0 ? (
          <Empty icon="folder" text="No runs yet. Record with simscope.Recorder or run simscope import." />
        ) : noGroupView ? null : items.length === 0 ? (
          <Empty icon="search" text={`No runs match “${deferred.trim()}”.`} action={<Button variant="outline" size="sm" onClick={() => act.setQuery("")}>Clear search</Button>} />
        ) : (
          <div className="relative w-full px-1" style={{ height: virt.getTotalSize() }}>
            {virt.getVirtualItems().map((v) => {
              const it = items[v.index];
              const isSticky = v.index === stickyIdx.current && it.kind === "header";
              const style: React.CSSProperties = isSticky
                ? { position: "sticky", top: 0, zIndex: 2, height: v.size }
                : { position: "absolute", top: 0, left: 4, right: 4, height: v.size, transform: `translateY(${v.start}px)` };
              return (
                <div key={`${v.index}:${it.kind}:${it.kind === "row" ? `${it.section.id}/${it.run.name}` : it.kind === "new-group" ? "" : it.section.id}`} style={style}>
                  {it.kind === "header" ? (
                    <SectionHeader
                      section={it.section}
                      folded={s.folded.includes(it.section.id)}
                      writable={s.writable}
                    />
                  ) : it.kind === "row" ? (
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div>
                          <RunRowItem
                            run={it.run}
                            active={it.run.name === activeName}
                            cursor={it.run.name === s.cursor && it.section.kind !== "pinned"}
                            slot={slotOf(it.run.name)}
                            picked={s.picks.some((p) => p.name === it.run.name)}
                            pickMode={s.picks.length > 0}
                            liveFrames={s.live[it.run.name]}
                            onOpen={onOpen}
                            onPick={onPick}
                            onNewGroup={onNewGroup}
                          />
                        </div>
                      </ContextMenuTrigger>
                      <RunContextMenu run={it.run} onNewGroup={onNewGroup} />
                    </ContextMenu>
                  ) : it.kind === "more" ? (
                    <button
                      type="button"
                      onClick={() => act.expandSection(it.section.id)}
                      className="flex h-7 w-full items-center rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      Show {it.remaining.toLocaleString("en-US")} more
                    </button>
                  ) : it.kind === "empty" ? (
                    <div className="flex h-7 items-center px-2 text-sm text-muted-foreground">No runs in this group</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDialog({ names: [] })}
                      className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <FolderPlus className="size-4" />
                      New group
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {s.picks.length > 0 ? (
        <SidebarFooter className="border-t p-2">
          <PickBar />
        </SidebarFooter>
      ) : null}

      <NameDialog
        open={dialog !== null}
        title="New group"
        description={dialog && dialog.names.length ? `${dialog.names.length === 1 ? "The run moves" : `${dialog.names.length} runs move`} into it.` : undefined}
        submit="Create"
        onClose={() => setDialog(null)}
        onSubmit={(value) => {
          const d = dialog;
          setDialog(null);
          if (!d) return;
          if (d.names.length) void act.moveToGroup(d.names, value);
          else void act.groupOp({ op: "create", name: value });
        }}
      />
    </Sidebar>
  );
}

function SectionHeader({
  section,
  folded,
  writable,
}: {
  section: Section;
  folded: boolean;
  writable: boolean;
}) {
  const toggleFolded = useApp((s) => s.toggleFolded);
  const [editing, setEditing] = useState(false);
  const Chevron = folded ? ChevronRight : ChevronDown;
  const editable = writable && section.kind === "group";
  const { text, cut } = shortName(section.title);
  const title = <span className="truncate">{text}</span>;

  if (editing) {
    // The same row, the same font: the name becomes a field; count and menu step aside.
    const save = (value: string) => {
      setEditing(false);
      const next = value.trim();
      if (next && next !== section.title) void useApp.getState().groupOp({ op: "rename", name: section.title, to: next });
    };
    return (
      <div className="flex h-8 items-center bg-sidebar px-1">
        <InlineName initial={section.title} onSave={save} onCancel={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="group/header flex h-8 items-center bg-sidebar">
      <button
        type="button"
        onClick={() => toggleFolded(section.id)}
        onDoubleClick={() => editable && setEditing(true)}
        aria-expanded={!folded}
        className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md px-1 text-left text-xs font-medium text-sidebar-foreground/70 outline-hidden transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Chevron className="size-3.5 shrink-0" />
        {cut ? (
          <Tooltip>
            <TooltipTrigger asChild>{title}</TooltipTrigger>
            <TooltipContent side="right">{section.title}</TooltipContent>
          </Tooltip>
        ) : (
          title
        )}
      </button>
      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-6 opacity-0 focus-visible:opacity-100 group-hover/header:opacity-100 data-[state=open]:opacity-100" aria-label={`Actions for ${section.title}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setTimeout(() => setEditing(true), 0)}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void useApp.getState().groupOp({ op: "delete", name: section.title })}>Delete group</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <SidebarMenuBadge>{section.runs.length}</SidebarMenuBadge>
    </div>
  );
}

/** An inline name field in a list row: Enter or blur saves, Escape cancels. Same height and font as the text it replaces. */
function InlineName({ initial, onSave, onCancel }: { initial: string; onSave(v: string): void; onCancel(): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save: boolean, value: string) => {
    if (done.current) return;
    done.current = true;
    if (save) onSave(value);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      defaultValue={initial}
      maxLength={64}
      aria-label="Group name"
      spellCheck={false}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true, e.currentTarget.value);
        else if (e.key === "Escape") finish(false, "");
        e.stopPropagation();
      }}
      onBlur={(e) => finish(true, e.currentTarget.value)}
      onClick={(e) => e.stopPropagation()}
      className="h-7 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  );
}

/** One line: slot dots, a count, Clear, Compare (L3: nothing wraps at 240 px). */
function PickBar() {
  const picks = useApp((s) => s.picks);
  const { clearPicks, openCompare } = useApp.getState();
  const sorted = [...picks].sort((a, b) => a.slot - b.slot);
  return (
    <div className="flex h-8 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground" title={`${picks.length} runs`}>
        {sorted.map((p) => (
          <span key={p.name} className="flex shrink-0 items-center gap-1" title={p.name}>
            <span className="size-2 rounded-full" style={{ background: seriesVar(p.slot) }} />
            {SLOT_LETTERS[p.slot]}
          </span>
        ))}
      </div>
      <Hint label="Clear selection">
        <Button variant="ghost" size="icon-sm" onClick={clearPicks} aria-label="Clear selection">
          <X />
        </Button>
      </Hint>
      {picks.length < 2 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled>
                Compare
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">Pick at least two runs. Compare takes up to {MAX_COMPARE}.</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" onClick={openCompare}>
          Compare
        </Button>
      )}
    </div>
  );
}

function Empty({ icon, text, action }: { icon: "folder" | "search"; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center">
      {icon === "search" ? <SearchX className="size-5 text-muted-foreground" /> : null}
      <p className={cn("text-sm text-muted-foreground")}>{text}</p>
      {action}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-8 items-center px-2">
          <div className="h-3 rounded bg-muted" style={{ width: `${40 + ((i * 23) % 45)}%` }} />
        </div>
      ))}
    </div>
  );
}
