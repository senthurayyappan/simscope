// Reload never loses the user's place (guideline P7): hash, preferences and workspace, all tolerant of stale or corrupt values.

import assert from "node:assert/strict";
import test from "node:test";

import { formatHash, missingNotice, parseHash, PLAY_WRITE_MS, resolveRuns, SEEK_SETTLE_MS, timeWriteDelay } from "../src/app/lib/hash.ts";
import {
  createPrefs,
  createSession,
  emptySession,
  importLegacyPrefs,
  PREFS_KEY,
  sanitizePrefs,
  sanitizeSession,
  SESSION_KEY,
  sessionMatches,
  VERSION,
} from "../src/app/lib/persist.ts";

const memory = (init = {}) => {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    data,
  };
};

test("hash: a single run keeps the exact #run=a form", () => {
  assert.deepEqual(parseHash("#run=crate-1"), { runs: ["crate-1"], arrange: null, t: null, tab: null });
  assert.equal(formatHash({ runs: ["crate-1"] }), "#run=crate-1");
  assert.equal(formatHash({ runs: ["a"], t: 2.1, tab: "metadata" }), "#run=a&t=2.10&tab=metadata");
});

test("hash: a compare is ordered runs plus the arrangement, and round-trips", () => {
  const v = { runs: ["a", "b.2", "c_3"], arrange: "stack", t: 12.345, tab: "envs" };
  const h = formatHash(v);
  assert.equal(h, "#runs=a,b.2,c_3&arrange=stack&t=12.35&tab=envs".replace("12.35", (12.345).toFixed(2)));
  assert.deepEqual(parseHash(h), { runs: ["a", "b.2", "c_3"], arrange: "stack", t: Number((12.345).toFixed(2)), tab: "envs" });
});

test("hash: defaults stay out of the URL; nothing open means no hash", () => {
  assert.equal(formatHash({ runs: ["a"], t: 0, tab: "plots", arrange: "side" }), "#run=a");
  assert.equal(formatHash({ runs: ["a", "b"] }), "#runs=a,b");
  assert.equal(formatHash({ runs: [] }), "");
  assert.equal(formatHash({ runs: ["a", "b", "c", "d", "e"] }), "#runs=a,b,c,d");
});

test("hash: unreadable parts are dropped, never an error", () => {
  assert.deepEqual(parseHash(""), { runs: [], arrange: null, t: null, tab: null });
  assert.deepEqual(parseHash("#garbage&&=&x"), { runs: [], arrange: null, t: null, tab: null });
  const v = parseHash("#runs=a,,a,%E0%A4%A,b&arrange=diagonal&t=-3&tab=nope");
  assert.deepEqual(v.runs, ["a", "%E0%A4%A", "b"]);
  assert.equal(v.arrange, null);
  assert.equal(v.t, null);
  assert.equal(v.tab, null);
  assert.equal(parseHash("#run=a&t=abc").t, null);
  assert.equal(parseHash("#run=a&t=1e9x").t, null);
  assert.equal(parseHash("#runs=a&run=b").runs[0], "a");
});

test("hash: unknown runs are dropped and named in one line", () => {
  const known = new Set(["a", "c"]);
  assert.deepEqual(resolveRuns(["a", "gone", "c"], known), { kept: ["a", "c"], missing: ["gone"] });
  assert.equal(missingNotice(["gone"]), "Run gone was not found");
  assert.equal(missingNotice(["x", "y"]), "Runs x, y were not found");
  assert.equal(missingNotice(["a", "b", "c", "d", "e"]), "Runs a, b, c, and 2 more were not found");
  assert.equal(missingNotice([]), null);
});

test("hash: the time is written at most every 2 s while playing and settles quickly when paused", () => {
  assert.equal(timeWriteDelay(10_000, 10_000, true), PLAY_WRITE_MS);
  assert.equal(timeWriteDelay(11_500, 10_000, true), PLAY_WRITE_MS - 1500);
  assert.equal(timeWriteDelay(20_000, 10_000, true), 0);
  assert.equal(timeWriteDelay(10_001, 10_000, false), SEEK_SETTLE_MS);
});

test("prefs: only valid fields survive", () => {
  const p = sanitizePrefs({
    theme: "dark",
    view: "sideways",
    folded: ["a", 3, "b"],
    visual: "yes",
    speed: 2,
    follow: "heading",
    sizes: { left: 300, right: "wide" },
    collapsed: { timeline: true },
    extra: 1,
  });
  assert.deepEqual(p, { theme: "dark", folded: ["a", "b"], speed: 2, follow: "heading", sizes: { left: 300 }, collapsed: { timeline: true } });
  assert.deepEqual(sanitizePrefs(null), {});
  assert.deepEqual(sanitizePrefs([1]), {});
  assert.equal(sanitizePrefs({ speed: -1 }).speed, undefined);
  assert.equal(sanitizePrefs({ speed: Infinity }).speed, undefined);
});

test("prefs: the old one-key-per-setting storage is imported once", () => {
  const legacy = { "simscope.theme": "light", "simscope.ground": "off", "simscope.groundkind": "grid", "simscope.sizes": '{"left":280}', "simscope.collapsed": "{bad", "simscope.plotwindow": "5" };
  const p = importLegacyPrefs((k) => legacy[k] ?? null);
  assert.deepEqual(p, { theme: "light", groundOn: false, groundKind: "grid", plotWindow: "5", sizes: { left: 280 } });
  const store = memory(legacy);
  const area = createPrefs(() => store);
  assert.equal(area.read().theme, "light");
  area.patch({ theme: "dark" });
  const again = createPrefs(() => store);
  assert.equal(again.read().theme, "dark");
  assert.equal(again.read().groundKind, "grid"); // carried into the blob by the first write
});

test("areas: another version, corrupt JSON, or storage that throws read as nothing saved", () => {
  const wrong = memory({ [PREFS_KEY]: JSON.stringify({ v: VERSION + 1, data: { theme: "dark" } }) });
  assert.deepEqual(createPrefs(() => wrong).read(), {});
  const corrupt = memory({ [PREFS_KEY]: "{not json", [SESSION_KEY]: "42" });
  assert.deepEqual(createPrefs(() => corrupt).read(), {});
  assert.deepEqual(createSession(() => corrupt).read(), emptySession());
  const throwing = () => {
    throw new Error("blocked");
  };
  const blocked = createPrefs(throwing);
  assert.deepEqual(blocked.read(), {});
  assert.doesNotThrow(() => blocked.patch({ theme: "dark" }));
  assert.equal(blocked.read().theme, "dark"); // still remembered for this page
  const setThrows = createSession(() => ({ getItem: () => null, removeItem: () => {}, setItem: throwing }));
  assert.doesNotThrow(() => setThrows.patch({ query: "x" }));
  assert.doesNotThrow(() => setThrows.clear());
});

test("areas: write, read back, clear", () => {
  const store = memory();
  const a = createSession(() => store);
  a.patch({ query: "crate", runs: ["a"] });
  assert.equal(JSON.parse(store.data.get(SESSION_KEY)).v, VERSION);
  const b = createSession(() => store);
  assert.equal(b.read().query, "crate");
  assert.deepEqual(b.read().runs, ["a"]);
  b.clear();
  assert.equal(store.data.has(SESSION_KEY), false);
  assert.deepEqual(b.read(), emptySession());
});

test("session: stale and hostile values fall back to empty ones", () => {
  const s = sanitizeSession({
    runs: ["a", 3, "b"],
    active: 9,
    picks: [{ name: "a", slot: 1 }, { name: "b", slot: 7 }, "x"],
    cams: [{ state: { v: 1, azimuth: 1, polar: 1, zoom: 2, scale: 3, target: [0, 1, 2], following: true, pan: [0.5, "x"] }, env: 3 }, { state: { v: 2 } }, null],
    pinned: [1, "a", 2],
    playing: "yes",
    t: -1,
    loop: [3, 2],
    view: [0, 5],
    query: "q".repeat(500),
    expanded: ["pinned"],
    scroll: { library: 120, bad: "x" },
    notes: { a: "text", b: "", c: 7 },
    label: { t: 1.5, text: "hi", id: "e1" },
    rename: { name: "a", text: "b" },
  });
  assert.deepEqual(s.runs, ["a", "b"]);
  assert.equal(s.active, 0);
  assert.deepEqual(s.picks, [{ name: "a", slot: 1 }]);
  assert.equal(s.cams.length, 3);
  assert.equal(s.cams[0].state.following, true);
  assert.equal(s.cams[0].state.pan, undefined);
  assert.equal(s.cams[0].env, 3);
  assert.equal(s.cams[1], null);
  assert.deepEqual(s.pinned, [1, 2]);
  assert.equal(s.playing, false);
  assert.equal(s.t, null);
  assert.equal(s.loop, null);
  assert.deepEqual(s.view, [0, 5]);
  assert.equal(s.query.length, 200);
  assert.deepEqual(s.scroll, { library: 120 });
  assert.deepEqual(s.notes, { a: "text" });
  assert.deepEqual(s.label, { t: 1.5, text: "hi", id: "e1" });
  assert.deepEqual(s.rename, { name: "a", text: "b" });
  assert.deepEqual(sanitizeSession("junk"), emptySession());
});

test("session: the workspace applies only to the same runs in the same order", () => {
  const s = { ...emptySession(), runs: ["a", "b", "c"] };
  assert.equal(sessionMatches(s, ["a", "b", "c"]), true);
  assert.equal(sessionMatches(s, ["a", "c", "b"]), false);
  assert.equal(sessionMatches(s, ["a", "b"]), false);
  assert.equal(sessionMatches(emptySession(), []), true);
});
