// Pure logic of the app shell: library sections, time math, clustering, keys.
import assert from "node:assert/strict";
import test from "node:test";

import { buildSections, dateBucket, flatOrder, matchesQuery, nextUnrated, splitName, stepRun, SECTION_LIMIT } from "../src/app/lib/filters.ts";
import { formatCount, formatDuration, formatTimecode, formatValue, lastFrameTime, parseTime } from "../src/app/lib/format.ts";
import { isTypingTarget, resolveKey } from "../src/app/lib/keys.ts";
import {
  clampView,
  clusterHighlights,
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

test("clusters: glyphs closer than the gap merge; the most important kind represents them", () => {
  const h = (t, kind, score = 7) => ({ t, frame: 0, t1: null, frame1: null, env: 0, kind, label: kind, detail: "", score, ratio: null, value: 1, body: null, also: [], signal: kind });
  const items = [h(1.0, "contact_spike", 20), h(1.01, "landing", 7), h(1.02, "torque_spike", 30), h(4.0, "fall", 9)];
  const view = { t0: 0, t1: 8 };
  const c = clusterHighlights(items, view, 800, 6);
  assert.equal(c.length, 2);
  assert.equal(c[0].items.length, 3);
  assert.equal(c[0].best.kind, "landing");
  assert.equal(c[1].items.length, 1);
  assert.ok(kindRank("fall") > kindRank("landing") && kindRank("landing") > kindRank("contact_spike") && kindRank("contact_spike") > kindRank("torque_spike"));
  assert.equal(clusterHighlights(items, { t0: 0.99, t1: 1.03 }, 800, 6).length, 3);
  assert.equal(clusterHighlights(items, { t0: 3, t1: 5 }, 800, 6).length, 1);
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
  assert.equal(dateBucket(at(5), now).title, "Previous 7 days");
  assert.equal(dateBucket(at(20), now).title, "Previous 30 days");
  assert.equal(dateBucket(new Date(2026, 7, 14).toISOString(), now).title, "August 2026");
  assert.equal(dateBucket("garbage", now).title, "Undated");
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
  assert.deepEqual(secs.map((s) => s.title), ["Pinned", "Today", "Previous 7 days", "June 2026"]);
  assert.deepEqual(secs[2].runs.map((r) => r.name), ["b_week", "d_week"]);
  assert.deepEqual(flatOrder(secs).map((r) => r.name), ["a_today", "b_week", "d_week", "c_old"]);
  assert.deepEqual(buildSections(rows, { ...o, query: "week" }).map((s) => s.title), ["Pinned", "Previous 7 days"]);
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

test("library: next unrated, stepping, middle truncation keeps the tail", () => {
  const rows = [row("a", { rating: 3 }), row("b"), row("c")];
  assert.equal(nextUnrated(rows, "a").name, "b");
  assert.equal(nextUnrated(rows, "c").name, "b");
  assert.equal(stepRun(rows, "a", 1).name, "b");
  assert.equal(stepRun(rows, "c", 1).name, "c");
  assert.deepEqual(splitName("go2-crate_climb-upstream-20260910T003806Z"), ["go2-crate_climb-upstream-202609", "10T003806Z"]);
  assert.deepEqual(splitName("short"), ["short", ""]);
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
