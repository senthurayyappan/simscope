// Pure logic of the app shell: library sections, time math, clustering, keys.
import assert from "node:assert/strict";
import test from "node:test";

import { buildSections, dateBucket, flatOrder, matchesQuery, nextUnrated, shortName, stepRun, SECTION_LIMIT } from "../src/app/lib/filters.ts";
import { isSoloExport } from "../src/app/lib/boot.ts";
import { kindVar, validColor } from "../src/app/lib/palette.ts";
import { formatCount, formatDuration, formatTimecode, formatValue, lastFrameTime, parseTime } from "../src/app/lib/format.ts";
import { isTypingTarget, resolveKey } from "../src/app/lib/keys.ts";
import {
  BOTTOM_PAD,
  BAR_H,
  GUTTER,
  LANE_H,
  RIGHT_PAD,
  RULER_H,
  clampView,
  clusterHighlights,
  laneCenterY,
  laneTop,
  timeToX,
  timelineHeight,
  xToTime,
  followPlayhead,
  kindRank,
  niceStep,
  panView,
  snapFrame,
  tickLabel,
  ticks,
  zoomView,
} from "../src/app/lib/timeline-math.ts";

const row = (name, extra = {}) => ({
  name, id: name, created: "2026-09-30T00:00:00Z", status: "complete", dt: 0.02, n_frames: 100, n_envs: 1,
  n_bodies: 3, favorite: false, group: null, rating: null, tags: [], n_notes: 0,
  n_highlights: null, simulator: "brax", importer: "brax", streams: [], ...extra,
});

test("format: durations, timecodes, typed time", () => {
  assert.equal(formatDuration(8), "8.00 s");
  assert.equal(formatDuration(125), "2:05.00 s");
  assert.equal(formatDuration(lastFrameTime(250, 0.02)), "4.98 s");
  assert.equal(lastFrameTime(0, 0.02), 0);
  assert.equal(formatTimecode(2.14159), "2.14");
  assert.equal(formatTimecode(65.5), "1:05.50");
  assert.equal(formatCount(4096), "4,096");
  assert.equal(parseTime("2.14", 0.02), 2.14);
  assert.equal(parseTime("2.14 s", 0.02), 2.14);
  assert.equal(parseTime("1:05.5", 0.02), 65.5);
  assert.ok(Math.abs(parseTime("f107", 0.02) - 2.14) < 1e-9);
  assert.ok(Math.abs(parseTime("107f", 0.02) - 2.14) < 1e-9);
  assert.equal(parseTime("250ms", 0.02), 0.25);
  assert.equal(parseTime("abc", 0.02), null);
});

test("ticks: adaptive step and labels", () => {
  assert.equal(niceStep(8, 800, 80), 1);
  assert.equal(niceStep(0.8, 800, 80), 0.1);
  assert.equal(niceStep(600, 800, 80), 60);
  const t = ticks({ t0: 0, t1: 8 }, 800, 80);
  const majors = t.filter((x) => x.major).map((x) => x.t);
  assert.deepEqual(majors, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(t.length, 41);
  assert.equal(tickLabel(2.5, 0.5), "2.5");
  assert.equal(tickLabel(65, 5), "1:05");
  assert.equal(tickLabel(3, 1), "3");
});

test("view: clamp, zoom keeps the anchor, pan, follow", () => {
  assert.deepEqual(clampView({ t0: -1, t1: 1 }, 8, 0.05), { t0: 0, t1: 2 });
  assert.deepEqual(clampView({ t0: 7, t1: 10 }, 8, 0.05), { t0: 5, t1: 8 });
  assert.deepEqual(clampView({ t0: 0, t1: 20 }, 8, 0.05), { t0: 0, t1: 8 });
  const z = zoomView({ t0: 0, t1: 8 }, 4, 0.5, 8, 0.05);
  assert.deepEqual(z, { t0: 2, t1: 6 });
  const a = zoomView({ t0: 0, t1: 8 }, 2, 0.5, 8, 0.05);
  assert.equal(a.t0, 1);
  assert.equal(a.t1, 5);
  assert.deepEqual(panView({ t0: 0, t1: 4 }, 0.5, 8, 0.05), { t0: 2, t1: 6 });
  assert.deepEqual(panView({ t0: 4, t1: 8 }, 1, 8, 0.05), { t0: 4, t1: 8 });
  assert.deepEqual(followPlayhead({ t0: 0, t1: 2 }, 1, 8, 0.05), { t0: 0, t1: 2 });
  const f = followPlayhead({ t0: 0, t1: 2 }, 3, 8, 0.05);
  assert.ok(f.t0 < 3 && f.t1 > 3 && Math.abs(f.t1 - f.t0 - 2) < 1e-9);
  assert.equal(snapFrame(0.113, 0.02), 0.12);
});

test("clusters: close markers merge, sit at their first member; contact then acceleration then custom names them", () => {
  const h = (t, kind, score = 7) => ({ t, frame: 0, t1: null, frame1: null, env: 0, kind, label: kind, detail: "", score, ratio: null, value: 1, body: null, also: [], signal: kind });
  const items = [h(1.0, "acceleration", 20), h(1.01, "contact", 7), h(1.02, "my_kind", 30), h(4.0, "acceleration", 9)];
  const view = { t0: 0, t1: 8 };
  const c = clusterHighlights(items, view, 800, 6);
  assert.equal(c.length, 2);
  assert.equal(c[0].items.length, 3);
  assert.equal(c[0].best.kind, "contact");
  assert.equal(c[0].x, 100, "a cluster is where its first member is");
  assert.equal(c[1].items.length, 1);
  assert.ok(kindRank("contact") > kindRank("acceleration") && kindRank("acceleration") > kindRank("my_kind"));
  assert.equal(clusterHighlights(items, { t0: 0.99, t1: 1.03 }, 800, 6).length, 3);
  assert.equal(clusterHighlights(items, { t0: 3, t1: 5 }, 800, 6).length, 1);
});

test("strip geometry: one time-to-pixel mapping for ruler, glyphs and pointer", () => {
  const W = 1000;
  const lane = W - GUTTER - RIGHT_PAD;
  for (const view of [{ t0: 0, t1: 8 }, { t0: 2.5, t1: 3.5 }, { t0: 0, t1: 0.2 }]) {
    assert.equal(timeToX(view.t0, view, W), GUTTER, "the view's start is the gutter's right edge");
    assert.ok(Math.abs(timeToX(view.t1, view, W) - (GUTTER + lane)) < 1e-9, "the view's end is the lane's right edge");
    for (const t of [view.t0, (view.t0 + view.t1) / 2, view.t1]) assert.ok(Math.abs(xToTime(timeToX(t, view, W), view, W) - t) < 1e-9);
  }
  // A glyph for a marker at t is drawn at timeToX(t) and the cluster that holds it reports the same pixel from the lane edge.
  const view = { t0: 1, t1: 3 };
  const mk = { t: 2.25, frame: 0, t1: null, frame1: null, env: 0, kind: "contact", label: "", detail: "", score: 9, ratio: null, value: 1, body: null, also: [], signal: "contact" };
  const [c] = clusterHighlights([mk], view, lane, 14);
  assert.ok(Math.abs(GUTTER + c.x - timeToX(2.25, view, W)) < 1e-9);
  // Lanes tile the strip below the ruler; glyphs sit on a lane's centre.
  assert.equal(laneTop(0), RULER_H);
  assert.equal(laneTop(2), RULER_H + 2 * LANE_H);
  assert.equal(laneCenterY(1), RULER_H + LANE_H + LANE_H / 2);
  assert.ok(LANE_H >= 24, "glyph hit targets stay at least 24 px");
});

test("timeline height: bar, border, ruler, lanes, padding", () => {
  assert.equal(timelineHeight(0), BAR_H + 1 + RULER_H + BOTTOM_PAD);
  for (let n = 1; n <= 5; n++) assert.equal(timelineHeight(n) - timelineHeight(n - 1), LANE_H);
  assert.equal(timelineHeight(1), 111);
});

test("highlight kinds: built-ins have palette slots, custom kinds a validated hex or neutral", () => {
  assert.equal(kindVar("contact"), "var(--kind-contact)");
  assert.equal(kindVar("acceleration"), "var(--kind-acceleration)");
  assert.equal(kindVar("my_kind", "#c8102e"), "#c8102e");
  assert.equal(kindVar("my_kind", "red; background:url(x)"), "var(--muted-foreground)");
  assert.equal(kindVar("my_kind"), "var(--muted-foreground)");
  assert.equal(validColor("#abc"), "#abc");
  assert.equal(validColor("#12345"), null);
  assert.equal(validColor("rgb(0,0,0)"), null);
  assert.equal(validColor(undefined), null);
});

test("keys: the v3 map, modifiers ignored, typing suppressed", () => {
  assert.deepEqual(resolveKey({ key: "k" }), { type: "toggle-play" });
  assert.deepEqual(resolveKey({ key: "L", shiftKey: true }), { type: "step", frames: 10 });
  assert.deepEqual(resolveKey({ key: "j" }), { type: "step", frames: -1 });
  assert.deepEqual(resolveKey({ key: "3" }), { type: "rate", value: 3 });
  assert.deepEqual(resolveKey({ key: "]" }), { type: "env", delta: 1 });
  assert.deepEqual(resolveKey({ key: "0" }), { type: "frame-all" });
  assert.equal(resolveKey({ key: "c", metaKey: true }), null);
  assert.equal(resolveKey({ key: "x" }), null);
  assert.equal(resolveKey({ key: "h" }), null, "the highlight reel key is gone");
  for (const [k, t] of Object.entries({ n: "run", p: "run", u: "next-unrated", v: "favorite", f: "follow", w: "zoom", s: "zoom", a: "pan", d: "pan", m: "label", c: "contacts", t: "theme" })) {
    assert.equal(resolveKey({ key: k }).type, t, k);
  }
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget({ tagName: "INPUT", closest: () => null }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: false, closest: () => null }), false);
});

import { buildChannels, defaultChannelIds } from "../src/app/lib/channels.ts";

test("channels: derived first, scalars whole, vector components labelled", () => {
  const ch = buildChannels({
    body_pose: { file: "b", kind: "pose", item_shape: [3, 7] },
    reward: { file: "r", kind: "scalar", item_shape: [] },
    tau: { file: "t", kind: "vector", item_shape: [2], labels: ["hip", "knee"], units: "Nm" },
    forces: { file: "f", kind: "arrows", item_shape: [4, 6] },
  });
  assert.deepEqual(ch.map((c) => c.id), ["body:height", "body:speed", "s:reward", "v:tau:0", "v:tau:1"]);
  assert.equal(ch[3].label, "hip");
  assert.equal(ch[3].unit, "Nm");
  assert.deepEqual(defaultChannelIds(ch), ["body:height", "body:speed", "s:reward", "v:tau:0"]);
});

import { decodeBase64, manifestToRow, meanRating, normalizeAnnotations, rowWithAnnotations } from "../src/app/lib/rows.ts";

test("pack rows: manifest to row, sidecar folded in, read-only defaults", () => {
  const m = {
    id: "01X", name: "trot", created: "2026-09-30T00:00:00Z", status: "complete", dt: 0.02, n_frames: 400, n_envs: 4,
    n_bodies: 6, streams: { body_pose: { file: "b", kind: "pose", item_shape: [6, 7] }, reward: { file: "r", kind: "scalar", item_shape: [] } },
    source: { simulator: "mujoco", importer: "x" }, tags: ["source:mujoco"],
  };
  const row = manifestToRow(m);
  assert.deepEqual(row.streams, ["body_pose", "reward"]);
  assert.equal(row.simulator, "mujoco");
  assert.equal(row.rating, null);
  const a = normalizeAnnotations({
    marks: { favorite: true, tags: ["good"] },
    ratings: [{ criterion: "overall", value: 4 }, { criterion: "overall", value: 5 }, { criterion: "gait", value: 1 }],
    notes: [{ text: "hi" }],
  });
  assert.equal(a.marks.group, null);
  assert.equal(meanRating(a), 4.5);
  const folded = rowWithAnnotations(row, a, m.tags);
  assert.equal(folded.favorite, true);
  assert.equal(folded.rating, 4.5);
  assert.equal(folded.n_notes, 1);
  assert.deepEqual(folded.tags, ["source:mujoco"], "curation tags are no longer shown");
  assert.equal(folded.group, null);
  assert.deepEqual(normalizeAnnotations(null).events, []);
  assert.equal(meanRating(normalizeAnnotations(null)), null);
  assert.deepEqual([...decodeBase64("AQID\nBA==")], [1, 2, 3, 4]);
});

test("format: three significant digits, true minus, thousands separators", () => {
  assert.equal(formatValue(0.2644), "0.264");
  assert.equal(formatValue(7.981), "7.98");
  assert.equal(formatValue(412.4), "412");
  assert.equal(formatValue(-1.7), "\u22121.7");
  assert.equal(formatValue(4096.4), "4,096");
  assert.equal(formatValue(0), "0");
  assert.equal(formatValue(Number.NaN), "-");
});

test("library dates: buckets in local time, newest first", () => {
  const now = new Date(2026, 8, 30, 15, 0);
  const at = (days, hour = 9) => new Date(2026, 8, 30 - days, hour).toISOString();
  assert.equal(dateBucket(at(0), now).title, "Today");
  assert.equal(dateBucket(at(1), now).title, "Yesterday");
  // 2026-09-30 is a Wednesday: this week started on Monday the 28th.
  assert.equal(dateBucket(at(2), now).title, "This week");
  assert.equal(dateBucket(at(3), now).title, "Last week"); // Sunday the 27th
  assert.equal(dateBucket(at(9), now).title, "Last week"); // Monday the 21st
  assert.equal(dateBucket(at(10), now).title, "September"); // Sunday the 20th: earlier in the month
  assert.equal(dateBucket(new Date(2026, 7, 14).toISOString(), now).title, "August");
  assert.equal(dateBucket(new Date(2025, 11, 14).toISOString(), now).title, "December 2025");
  assert.equal(dateBucket("garbage", now).title, "Undated");
});

test("library dates: on a Monday there is no 'This week' beyond today and yesterday", () => {
  const now = new Date(2026, 9, 5, 12, 0); // Monday 2026-10-05
  const at = (d) => new Date(2026, 9, 5 - d, 9).toISOString();
  assert.equal(dateBucket(at(0), now).title, "Today");
  assert.equal(dateBucket(at(1), now).title, "Yesterday"); // Sunday
  assert.equal(dateBucket(at(2), now).title, "Last week"); // Saturday the 3rd
  assert.equal(dateBucket(at(7), now).title, "Last week"); // Monday the 28th
  assert.equal(dateBucket(at(8), now).title, "September"); // Sunday the 27th
});

test("library sections: by date, pinned first, search first, empty sections never appear", () => {
  const now = new Date(2026, 8, 30, 15, 0);
  const at = (days) => new Date(2026, 8, 30 - days, 9).toISOString();
  const rows = [
    row("a_today", { created: at(0) }),
    row("b_week", { created: at(4), favorite: true }),
    row("c_old", { created: new Date(2026, 5, 2).toISOString() }),
    row("d_week", { created: at(5) }),
  ];
  const o = { view: "date", query: "", sort: "newest", groups: [], now };
  const secs = buildSections(rows, o);
  assert.deepEqual(secs.map((s) => s.title), ["Pinned", "Today", "Last week", "June"]);
  assert.deepEqual(secs[2].runs.map((r) => r.name), ["b_week", "d_week"]);
  assert.deepEqual(flatOrder(secs).map((r) => r.name), ["a_today", "b_week", "d_week", "c_old"]);
  assert.deepEqual(buildSections(rows, { ...o, query: "week" }).map((s) => s.title), ["Pinned", "Last week"]);
  assert.equal(buildSections(rows, { ...o, query: "zzz" }).length, 0);
  assert.equal(SECTION_LIMIT, 5);
});

test("library sections: by group follows the library order, extras after, Ungrouped last", () => {
  const rows = [
    row("r1", { group: "Vault" }),
    row("r2", { group: "Sweep" }),
    row("r3", { group: "Unlisted" }),
    row("r4"),
    row("r5", { group: "Vault" }),
  ];
  const o = { view: "group", query: "", sort: "name", groups: ["Sweep", "Vault", "Empty"] };
  const secs = buildSections(rows, o);
  assert.deepEqual(secs.map((s) => s.title), ["Sweep", "Vault", "Empty", "Unlisted", "Ungrouped"]);
  assert.deepEqual(secs[1].runs.map((r) => r.name), ["r1", "r5"]);
  assert.equal(secs[2].runs.length, 0);
  // While searching, an empty group disappears (I4).
  assert.ok(!buildSections(rows, { ...o, query: "r1" }).some((s) => s.title === "Empty"));
  assert.ok(matchesQuery(row("x", { group: "Vault" }), "vault"));
});

test("library: next unrated, stepping, names cut at 16 characters", () => {
  const rows = [row("a", { rating: 3 }), row("b"), row("c")];
  assert.equal(nextUnrated(rows, "a").name, "b");
  assert.equal(nextUnrated(rows, "c").name, "b");
  assert.equal(stepRun(rows, "a", 1).name, "b");
  assert.equal(stepRun(rows, "c", 1).name, "c");
  assert.deepEqual(shortName("go2-crate_climb-upstream-20260910T003806Z"), { text: "go2-crate_climb-…", cut: true });
  assert.deepEqual(shortName("0123456789abcdef"), { text: "0123456789abcdef", cut: false }, "16 characters fit");
  assert.deepEqual(shortName("0123456789abcdefg"), { text: "0123456789abcdef…", cut: true });
  // Cut at a character, never inside a surrogate pair.
  const emoji = "😀".repeat(20);
  assert.equal(shortName(emoji).text, "😀".repeat(16) + "…");
});

import { baseName, streamSummary } from "../src/app/lib/metadata.ts";

test("metadata: the source file shows its file name, streams their shape and unit", () => {
  assert.equal(baseName("/Users/ada/projects/slides/assets/l_d000_playback.html"), "l_d000_playback.html");
  assert.equal(baseName("C:\\runs\\a\\rollout.rbundle"), "rollout.rbundle");
  assert.equal(baseName("plain.html"), "plain.html");
  assert.equal(baseName("/"), "/");
  assert.equal(streamSummary([14, 7]), "[14, 7]");
  assert.equal(streamSummary([], "N"), "scalar N");
  assert.equal(streamSummary([3], "N·m"), "[3] N·m");
});

import { ARRANGEMENTS, arrangementGrid, carryPaneState, defaultArrangement, effectiveArrangement } from "../src/app/lib/panes.ts";
import { G, readout } from "../src/app/lib/format.ts";
import { MSG_CHARS, MSG_EXISTS, MSG_LONG, MSG_RECORDING, MSG_START, RenameError, renameIn, renameKey, renameMessage, validateRunName } from "../src/app/lib/rename.ts";

test("compare: panes that keep their index and run keep their state (the 'only the last run has a lane' bug)", () => {
  const prev = [{ name: "a" }, { name: "b" }, { name: "c" }];
  const infos = { 0: "A", 1: "B", 2: "C" };
  // Compare [a, b, c] again with d added: a, b, c are not reloaded by their panes, so they must stay.
  assert.deepEqual(carryPaneState(prev, [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }], infos), { 0: "A", 1: "B", 2: "C" });
  // A different run in a slot drops that slot's state (its pane reloads and refills it).
  assert.deepEqual(carryPaneState(prev, [{ name: "a" }, { name: "x" }, { name: "c" }], infos), { 0: "A", 2: "C" });
  // Closing the first pane shifts everyone: every index now holds another run.
  assert.deepEqual(carryPaneState(prev, [{ name: "b" }, { name: "c" }], infos), {});
  // From a single run to a compare whose first run is the same: the pane is recreated by the app (new key) but the state is
  // refilled on load, so carrying it is harmless.
  assert.deepEqual(carryPaneState([{ name: "a" }], [{ name: "a" }, { name: "b" }], { 0: "A" }), { 0: "A" });
  assert.deepEqual(carryPaneState([], [{ name: "a" }], {}), {});
});

test("compare arrangement: defaults, remembered choice, grid shapes", () => {
  assert.equal(defaultArrangement(2), "side");
  assert.equal(defaultArrangement(3), "grid");
  assert.equal(defaultArrangement(4), "grid");
  assert.equal(effectiveArrangement(3, null), "grid");
  assert.equal(effectiveArrangement(3, "stack"), "stack");
  assert.deepEqual(ARRANGEMENTS, ["side", "stack", "grid"]);
  assert.deepEqual(arrangementGrid(3, "side"), { cols: 3, rows: 1 });
  assert.deepEqual(arrangementGrid(4, "stack"), { cols: 1, rows: 4 });
  assert.deepEqual(arrangementGrid(3, "grid"), { cols: 2, rows: 2 });
  assert.deepEqual(arrangementGrid(4, "grid"), { cols: 2, rows: 2 });
  assert.deepEqual(arrangementGrid(2, "grid"), { cols: 2, rows: 1 });
  assert.deepEqual(arrangementGrid(1, "stack"), { cols: 1, rows: 1 });
});

test("hover card fields: the number is the point; acceleration in m/s2 and g, contact in N and x typical", () => {
  const h = (kind, value, ratio = null, detail = "", label = kind) => ({ kind, label, detail, value, ratio });
  assert.deepEqual(readout(h("acceleration", 164.1, 4.2, "", "Acceleration")), { title: "Acceleration", main: "164 m/s²", sub: `${(164.1 / G).toPrecision(3)} g` });
  assert.equal(readout(h("acceleration", 164.1)).sub, "16.7 g");
  assert.deepEqual(readout(h("contact", 127.4, 1.93, "", "Contact force")), { title: "Contact force", main: "127 N", sub: "1.9× typical" });
  assert.equal(readout(h("contact", 127.4, 12.4)).sub, "12× typical");
  assert.equal(readout(h("contact", 127.4)).sub, null);
  assert.deepEqual(readout(h("my_marker", 1, 2, "slipped 3 cm", "My marker")), { title: "My marker", main: "slipped 3 cm", sub: null });
  assert.equal(readout(h("my_marker", 1, 2, "", "My marker")).main, "My marker");
});

test("rename: name rules, server errors as one line, re-keying by run name", () => {
  assert.equal(validateRunName("crate-2"), null);
  assert.equal(validateRunName("a"), null);
  assert.equal(validateRunName("A.b_c-1"), null);
  assert.equal(validateRunName("a".repeat(128)), null);
  assert.equal(validateRunName("a".repeat(129)), MSG_LONG);
  assert.equal(validateRunName("has space"), MSG_CHARS);
  assert.equal(validateRunName("slash/name"), MSG_CHARS);
  assert.equal(validateRunName("-lead"), MSG_START);
  assert.equal(validateRunName(".hidden"), MSG_START);
  assert.equal(validateRunName(""), MSG_START);

  assert.equal(renameMessage(400, "bad"), MSG_CHARS);
  assert.equal(renameMessage(409, "a run named 'x' already exists"), MSG_EXISTS);
  assert.equal(renameMessage(409, "the run is still recording"), MSG_RECORDING);
  assert.match(renameMessage(404, "no such run"), /no longer exists/);
  assert.match(renameMessage(403, "read-only"), /read-only/);
  assert.equal(new RenameError(409, "m").status, 409);

  const panes = [{ name: "a", slot: 0 }, { name: "b", slot: 2 }];
  assert.deepEqual(renameIn(panes, "b", "c"), [{ name: "a", slot: 0 }, { name: "c", slot: 2 }]);
  assert.equal(renameIn(panes, "zzz", "c"), panes);
  assert.deepEqual(renameKey({ a: 1, b: 2 }, "a", "x"), { b: 2, x: 1 });
  const rec = { a: 1 };
  assert.equal(renameKey(rec, "nope", "x"), rec);
});

test("a full export of exactly one run drops the library; a served app or a multi-run export keeps it", () => {
  assert.equal(isSoloExport({ mode: "pack", runs: ["a"] }), true);
  assert.equal(isSoloExport({ mode: "pack", runs: ["a", "b"] }), false);
  assert.equal(isSoloExport({ mode: "pack", runs: [] }), false);
  assert.equal(isSoloExport({ mode: "pack" }), false);
  assert.equal(isSoloExport({ mode: "http", runs: ["a"] }), false, "a served library is always browsable");
});

test("capture: the GIF stretch is the loop region or the whole run, and at most five seconds", async () => {
  const { gifFrames, gifWindow, GIF_MAX_SECONDS, fileName } = await import("../src/app/lib/capture.ts");
  assert.equal(GIF_MAX_SECONDS, 5);
  assert.deepEqual(gifWindow(3, null), { t0: 0, t1: 3, problem: null });
  assert.deepEqual(gifWindow(8, [1.65, 6.65]), { t0: 1.65, t1: 6.65, problem: null });
  assert.equal(gifWindow(5, null).problem, null, "exactly five seconds is allowed");
  assert.match(gifWindow(8, null).problem, /run is 8\.0 s.*up to 5 s/);
  assert.match(gifWindow(8, [0, 6]).problem, /selected stretch is 6\.0 s/);
  assert.equal(gifWindow(0, null).problem, "Open a run first");
  assert.match(gifWindow(8, [1, 1.01]).problem, /longer stretch/);
  assert.equal(gifFrames(5, 20), 100);
  assert.equal(gifFrames(2.98, 20), 60);
  assert.equal(gifFrames(0.01, 10), 1);
  assert.equal(fileName("20260911 run/1", "2s", "gif"), "20260911_run_1-2s.gif");
  assert.equal(fileName("", "", "png"), "simscope.png");
});

test("capture: shapes have fixed sizes", async () => {
  const { aspectOf, sizeOf, SHAPES } = await import("../src/app/lib/capture.ts");
  assert.deepEqual(SHAPES.map((s) => s.id), ["16:9", "4:3", "1:1"]);
  assert.deepEqual(sizeOf(1920, "16:9"), { width: 1920, height: 1080 });
  assert.deepEqual(sizeOf(1920, "4:3"), { width: 1920, height: 1440 });
  assert.deepEqual(sizeOf(1920, "1:1"), { width: 1920, height: 1920 });
  assert.equal(aspectOf("4:3"), 4 / 3);
});

test("capture: encodeGif writes one looping GIF frame per captured frame, with one palette", async () => {
  const { encodeGif } = await import("../src/app/lib/capture.ts");
  const w = 4, h = 4;
  const frame = (i, count, rgb) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < w * h; p++) data.set([...rgb, 255], p * 4);
    return { index: i, count, t: i / 10, width: w, height: h, data };
  };
  const asked = [];
  const player = {
    async *captureFrames(opts) {
      asked.push(opts);
      const colours = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
      const n = asked.length === 1 ? 1 : 3;
      for (let i = 0; i < n; i++) yield frame(i, n, colours[i]);
    },
  };
  const done = [];
  const blob = await encodeGif(player, { t0: 1, t1: 1.3, fps: 10, width: 8, shape: "4:3", onProgress: (p) => done.push([p.phase, p.done, p.total]) });
  assert.equal(asked.length, 2, "a pass for the colours, a pass for the frames");
  assert.equal(asked[1].t0, 1);
  assert.equal(asked[1].fps, 10);
  assert.equal(asked[1].width, 8);
  assert.equal(asked[1].aspect, 4 / 3);
  assert.ok(asked[0].width <= asked[1].width && asked[0].fps <= asked[1].fps, "the first pass is the smaller one");
  assert.deepEqual(done, [["colours", 1, 1], ["frames", 1, 3], ["frames", 2, 3], ["frames", 3, 3]]);
  assert.equal(blob.type, "image/gif");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 6)), "GIF89a");
  assert.equal(bytes.at(-1), 0x3b, "the trailer");
  assert.equal(bytes[6] | (bytes[7] << 8), w);
  assert.equal(bytes[8] | (bytes[9] << 8), h);
  assert.ok(bytes[10] & 0x80, "a global colour table");
  // Graphic control extension: 0x21 0xF9 0x04 flags delay(2) ...; a delay of 10 fps is 10 centiseconds.
  const delays = [];
  let locals = 0;
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4) delays.push(bytes[i + 4] | (bytes[i + 5] << 8));
    if (bytes[i] === 0x2c && i + 9 < bytes.length && (bytes[i + 9] & 0x80) && bytes[i + 5] === w) locals++;
  }
  assert.deepEqual(delays, [10, 10, 10]);
  assert.equal(locals, 0, "no frame has a colour table of its own");
  assert.ok(new TextDecoder("latin1").decode(bytes).includes("NETSCAPE2.0"), "loops forever");
});

test("quantize: near-identical darks keep their own palette entries, and a palette is the same for every frame", async () => {
  const { buildPalette, indexFrame, sampleColors } = await import("../src/app/lib/quantize.ts");
  const px = (n, rgb) => Array.from({ length: n }, () => [...rgb, 255]).flat();
  // A dark background, a ground a few levels lighter, and a mid fade between them, as in the viewer.
  const frame = Uint8ClampedArray.from([...px(500, [25, 25, 25]), ...px(300, [31, 31, 31]), ...px(100, [28, 28, 28]), ...px(5, [200, 120, 40])]);
  const hist = new Map();
  sampleColors(frame, hist, 1);
  assert.equal(hist.size, 4);
  const palette = buildPalette(hist);
  assert.ok(Number.isInteger(Math.log2(palette.length)), "a power of two");
  const idx = indexFrame(frame, palette, new Map());
  const at = (i) => palette[idx[i]].join(",");
  assert.equal(at(0), "25,25,25");
  assert.equal(at(500), "31,31,31");
  assert.equal(at(800), "28,28,28");
  assert.equal(at(900), "200,120,40");
  assert.equal(new Set([idx[0], idx[500], idx[800]]).size, 3, "three distinct entries for three nearly equal greys");
});

test("quantize: many colours are shared out in 256 entries, most common ones exactly", async () => {
  const { buildPalette, indexFrame, sampleColors } = await import("../src/app/lib/quantize.ts");
  const data = [];
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 4; b++) data.push(r * 8, g * 8, b * 64, 255);
  for (let i = 0; i < 2000; i++) data.push(10, 20, 30, 255); // the most common colour
  const frame = Uint8ClampedArray.from(data);
  const hist = new Map();
  sampleColors(frame, hist, 1);
  const palette = buildPalette(hist);
  assert.equal(palette.length, 256);
  const idx = indexFrame(frame, palette, new Map());
  assert.deepEqual(palette[idx[idx.length - 1]], [10, 20, 30]);
  assert.deepEqual(buildPalette(hist), palette, "deterministic");
});
