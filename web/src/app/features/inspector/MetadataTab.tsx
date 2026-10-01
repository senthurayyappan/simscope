import { useState } from "react";
import { ChevronDown, ChevronRight, Pin, PinOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baseName, streamSummary } from "@/lib/metadata";
import { Textarea } from "@/components/ui/input";
import { noteDraft, setNoteDraft } from "@/lib/sync";
import { formatCount, formatDuration, formatRate, formatRecorded, formatValue, lastFrameTime } from "@/lib/format";
import { meanRating } from "@/lib/rows";
import { useApp } from "@/lib/store";
import type { Manifest } from "@/lib/types";

import { Stars } from "./Stars";

const Key = ({ children }: { children: string }) => (
  <TableCell className="truncate py-1.5 pl-4 pr-2 align-top text-muted-foreground" title={children}>
    {children}
  </TableCell>
);

/** A value cell: one line, truncated, the full text in a tooltip when it was cut. */
function Val({ children, full }: { children: React.ReactNode; full?: string }) {
  const text = full ?? (typeof children === "string" ? children : undefined);
  const body = <span className="block truncate">{children}</span>;
  return (
    <TableCell className="num min-w-0 py-1.5 pl-2 pr-4 text-right">
      {text ? (
        <Tooltip>
          <TooltipTrigger asChild>{body}</TooltipTrigger>
          <TooltipContent side="left" className="max-w-64 break-all">
            {text}
          </TooltipContent>
        </Tooltip>
      ) : (
        body
      )}
    </TableCell>
  );
}
const Row = ({ k, children, full }: { k: string; children: React.ReactNode; full?: string }) => (
  <TableRow>
    <Key>{k}</Key>
    <Val full={full}>{children}</Val>
  </TableRow>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell colSpan={2} className="px-4 pb-1 pt-4 text-xs font-medium text-muted-foreground">
      {children}
    </TableCell>
  </TableRow>
);

function cap(s: string): string {
  const names: Record<string, string> = { mujoco: "MuJoCo", brax: "Brax", isaaclab: "Isaac Lab", isaac: "Isaac" };
  return names[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

/** Flattens `meta.metrics` / `meta.config` objects into dotted keys with numeric or short string values. */
function flatten(obj: unknown, prefix = ""): [string, string][] {
  if (obj === null || typeof obj !== "object") return [];
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "number") out.push([key, formatValue(v)]);
    else if (typeof v === "string" || typeof v === "boolean") out.push([key, String(v)]);
    else if (v && typeof v === "object" && !Array.isArray(v)) out.push(...flatten(v, key));
  }
  return out;
}

const label = (k: string) => {
  const t = k.replace(/[._]/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** The second tab: a two-column table (key muted, value right-aligned), then notes. */
export function MetadataTab() {
  const name = useApp((s) => s.panes[s.active]?.name);
  const manifest = useApp((s) => s.manifest);
  const annotations = useApp((s) => s.annotations);
  const info = useApp((s) => s.infos[s.active]);
  const groups = useApp((s) => s.groups);
  const writable = useApp((s) => !!s.api?.writable);
  const annotate = useApp((s) => s.annotate);
  const moveToGroup = useApp((s) => s.moveToGroup);
  const [configOpen, setConfigOpen] = useState(false);

  if (!name) return <p className="px-4 py-6 text-sm text-muted-foreground">Choose a run to see its metadata.</p>;

  const rating = annotations ? meanRating(annotations) : null;
  const pinned = annotations?.marks.favorite ?? false;
  const group = annotations?.marks.group ?? null;
  const live = manifest?.status === "recording" || info?.live;
  const metrics = flatten(manifest?.meta?.metrics);
  const config = flatten(manifest?.meta?.config);
  const m = manifest as Manifest | null;

  return (
    <div className="min-w-0 pb-6">
      <div className="flex items-center gap-2 px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold" title={name}>
          {name}
        </h2>
        {live ? (
          <Badge variant="destructive">
            <span className="size-1.5 rounded-full bg-destructive animate-pulse-dot" />
            Recording
          </Badge>
        ) : null}
        {writable ? (
          <Hint label={pinned ? "Unpin" : "Pin"}>
            <Button variant="ghost" size="icon-sm" aria-pressed={pinned} onClick={() => void annotate({ op: "favorite", value: !pinned })} aria-label={pinned ? "Unpin" : "Pin"}>
              {pinned ? <PinOff /> : <Pin />}
            </Button>
          </Hint>
        ) : null}
      </div>

      <Table className="table-fixed">
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "60%" }} />
        </colgroup>
        <TableBody>
          <Row k="Duration">{info ? formatDuration(info.duration) : m ? formatDuration(lastFrameTime(m.n_frames, m.dt)) : "-"}</Row>
          <Row k="Frames">{formatCount(info?.frames ?? m?.n_frames ?? 0)}</Row>
          <Row k="Rate">{formatRate(info?.dt ?? m?.dt ?? 0)}</Row>
          <Row k="Envs">{formatCount(info?.envs ?? m?.n_envs ?? 1)}</Row>
          <Row k="Bodies">{formatCount(info?.bodies.length ?? m?.n_bodies ?? 0)}</Row>
          {m?.created ? <Row k="Recorded">{formatRecorded(m.created)}</Row> : null}
          {m?.source?.simulator ? (
            <Row k="Source">{cap(m.source.simulator) + (m.source.version ? ` ${m.source.version}` : "")}</Row>
          ) : null}
          {m?.source?.importer ? <Row k="Importer">{cap(m.source.importer)}</Row> : null}
          {m?.source?.original ? (
            <Row k="Source file" full={m.source.original}>
              {baseName(m.source.original)}
            </Row>
          ) : null}
          {m?.tags?.length ? <Row k="Tags" full={m.tags.join(", ")}>
              {m.tags.join(", ")}
            </Row> : null}
          {groups ? (
            <Row k="Group">
              {writable ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="-mr-2 ml-auto flex max-w-full gap-1 px-2">
                      <span className="truncate">{group ?? "Ungrouped"}</span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {groups.groups.map((g) => (
                      <DropdownMenuItem key={g.name} onSelect={() => void moveToGroup([name], g.name)}>
                        {g.name}
                      </DropdownMenuItem>
                    ))}
                    {groups.groups.length && group ? <DropdownMenuSeparator /> : null}
                    {group ? <DropdownMenuItem onSelect={() => void moveToGroup([name], null)}>Remove from group</DropdownMenuItem> : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                (group ?? "Ungrouped")
              )}
            </Row>
          ) : null}
          <TableRow>
            <Key>Rating</Key>
            <TableCell className="py-1 pl-2 pr-3">
              <div className="flex min-w-0 justify-end">
                <Stars value={rating} disabled={!writable} onRate={(v) => void annotate({ op: "rate", value: v })} />
              </div>
            </TableCell>
          </TableRow>

          {m && Object.keys(m.streams).length ? (
            <>
              <Sub>Streams</Sub>
              {Object.entries(m.streams).map(([sname, s]) => (
                <Row key={sname} k={sname}>
                  {streamSummary(s.item_shape, s.units)}
                </Row>
              ))}
            </>
          ) : null}

          {metrics.length ? (
            <>
              <Sub>Metrics</Sub>
              {metrics.map(([k, v]) => (
                <Row key={k} k={label(k)}>
                  {v}
                </Row>
              ))}
            </>
          ) : null}

          {config.length ? (
            <>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="p-0">
                  <button
                    type="button"
                    onClick={() => setConfigOpen((o) => !o)}
                    aria-expanded={configOpen}
                    className="flex w-full items-center gap-1 px-4 pb-1 pt-4 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    {configOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    Config
                  </button>
                </TableCell>
              </TableRow>
              {configOpen
                ? config.map(([k, v]) => (
                    <Row key={k} k={label(k)}>
                      {v}
                    </Row>
                  ))
                : null}
            </>
          ) : null}
        </TableBody>
      </Table>

      <Notes writable={writable} />
    </div>
  );
}

function Notes({ writable }: { writable: boolean }) {
  const notes = useApp((s) => s.annotations?.notes ?? NO_NOTES);
  const annotate = useApp((s) => s.annotate);
  const run = useApp((s) => s.panes[s.active]?.name ?? null);
  // An unsent note survives a reload, per run (guideline P7).
  const [draft, setDraftState] = useState(() => noteDraft(run));
  const [draftRun, setDraftRun] = useState(run);
  if (draftRun !== run) {
    setDraftRun(run);
    setDraftState(noteDraft(run));
  }
  const setDraft = (text: string) => {
    setDraftState(text);
    setNoteDraft(run, text);
  };
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    void annotate({ op: "note_add", text });
    setDraft("");
  };
  if (!writable && notes.length === 0) return null;
  return (
    <div className="space-y-3 px-4 pt-4">
      <div className="text-xs font-medium text-muted-foreground">Notes</div>
      {[...notes].reverse().map((n) => (
        <article key={n.id}>
          <p className="whitespace-pre-wrap break-words text-sm">{n.text}</p>
          <footer className="mt-0.5 text-xs text-muted-foreground">{n.author}</footer>
        </article>
      ))}
      {writable ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            placeholder="Write a note"
            rows={2}
            aria-label="New note"
          />
          {draft.trim() ? (
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={submit}>
                Add note
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const NO_NOTES: never[] = [];
