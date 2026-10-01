"""Exports runs as one offline HTML file or as a ``.simscope`` pack.

The HTML file has no external dependencies. It carries:

* the player runtime (``simscope-player.js``), gzipped and base64-encoded in a
  ``<script type="text/plain">`` block, plus a tiny classic bootstrap script
  that decodes it (``Uint8Array.fromBase64`` with an ``atob`` fallback),
  gunzips it with ``DecompressionStream`` and starts it from a ``blob:``
  script;
* one pack holding every run (shared scenes and meshes are stored once),
  base64-encoded in a second ``<script type="text/plain">`` block that all
  players reference with ``src="#simscope-pack"``;
* the full third-party license text, in an HTML comment at the end.

Given the same inputs, the output is byte-identical: entries are sorted and
gzip uses a fixed level and ``mtime=0``. No timestamps are written.

Annotation sidecars (``annotations.json``) are copied verbatim into the pack,
so notes, ratings and author names travel with it. Pass ``annotations=False``
to leave them out.

``ui="full"`` swaps the lean ``<simscope-player>`` page for the whole app
(``simscope-app.js`` and ``.css``) started from a boot block that points at the
same inline pack (viewer contracts 6). Either way the pack also carries the
run's derived data under ``derived/<run>/`` (highlights always; the crowd
root-pose stream and per-env summaries for more than 64 envs), and
``envs=[...]`` exports only those envs.
"""

import base64
import gzip
import html
import importlib
import importlib.resources
import json
import logging
import os
import pathlib
import tempfile
from collections.abc import Sequence
from typing import Any, Literal

from simscope import highlights, library
from simscope.io import cas, manifest, pack

logger = logging.getLogger(__name__)

Layout = Literal["single", "grid", "compare"]
Ui = Literal["lean", "full"]

RUNTIME_ASSET = "simscope-player.js"
APP_ASSET = "simscope-app.js"
APP_CSS_ASSET = "simscope-app.css"
LICENSES_ASSET = "simscope-web.LICENSES.txt"
PACK_ID = "simscope-pack"
RUNTIME_ID = "simscope-runtime"
BOOT_ID = "simscope-boot"
CROWD_ENVS = 64
"""Runs exported with more envs than this carry the crowd-tier files."""
COMPARE_SYNC = "compare"
"""Name of the shared clock of a compare page."""
COMPARE_SLOTS = (
    ("A", "#2282fb"),
    ("B", "#d35f10"),
    ("C", "#109646"),
    ("D", "#c344ae"),
)
"""The compare slots in page order: a letter and a colour each.

The colours are the app's categorical palette, ``oklch(0.62 0.20 257)``,
``oklch(0.62 0.166 47)``, ``oklch(0.59 0.158 150)`` and ``oklch(0.60 0.20
335)``, written as sRGB hex so the page does not depend on ``oklch()``
support. Compare takes up to four runs."""
GZIP_LEVEL = 9
_WRAP = 4096  # base64 line length; whitespace is ignored by both decoders
_LAYOUTS = ("single", "grid", "compare")
_UIS = ("lean", "full")


def read_asset(name: str) -> bytes:
    """Returns the bytes of a file shipped in ``simscope/_assets``.

    Args:
        name: File name, for example ``simscope-player.js``.

    Returns:
        The file contents.
    """
    resource = importlib.resources.files("simscope") / "_assets" / name
    return resource.read_bytes()


def _check_runs(runs: Sequence[str]) -> list[str]:
    """Validates run names and returns them as a list, in the given order."""
    if isinstance(runs, str):
        raise TypeError("runs must be a sequence of run names, not a string")
    names = [manifest.validate_run_name(name) for name in runs]
    if not names:
        raise ValueError("at least one run is required")
    if len(set(names)) != len(names):
        raise ValueError("duplicate run names")
    return names


def _check_layout(layout: str, names: list[str]) -> list[str]:
    """Checks that a layout can show this many runs.

    Raises:
        ValueError: For several runs with ``layout="single"``, or more runs
            than there are compare slots with ``layout="compare"``.
    """
    if layout == "single" and len(names) != 1:
        raise ValueError(
            f'layout="single" needs exactly one run, got {len(names)}'
        )
    if layout == "compare" and len(names) > len(COMPARE_SLOTS):
        raise ValueError(
            f'layout="compare" takes up to {len(COMPARE_SLOTS)} runs, '
            f"got {len(names)}"
        )
    return names


def _derived_module() -> Any:
    """Imports :mod:`simscope.derived`, or returns ``None`` if absent."""
    try:
        return importlib.import_module("simscope.derived")
    except ImportError:
        return None


def _subset_highlights(
    doc: dict[str, Any], envs: Sequence[int]
) -> dict[str, Any]:
    """Restricts a highlights document to an env subset, renumbering envs."""
    new = {env: i for i, env in enumerate(envs)}
    kept: list[dict[str, Any]] = [
        {**h, "env": new[h["env"]]}
        for h in doc["highlights"]
        if h["env"] in new
    ]
    present = {h["kind"] for h in kept} | {
        k for h in kept for k in h.get("also", ())
    }
    return {
        **doc,
        "kinds": [k for k in doc["kinds"] if k["key"] in present],
        "highlights": kept,
    }


def _compact(doc: Any) -> bytes:
    """Serializes JSON without spaces (derived files are read by machines)."""
    return json.dumps(doc, separators=(",", ":"), allow_nan=False).encode()


def _run_highlights(
    run: library.Rollout,
    derived: Any,
    root: pathlib.Path,
    scratch: pathlib.Path,
    ids: Sequence[int] | None,
) -> pack.Source:
    """Returns the ``highlights.json`` entry of one run."""
    if derived is not None:
        cache = derived.cache_dir(root, run)
        path = derived.ensure(run, cache, derived.HIGHLIGHTS)
        doc = json.loads(path.read_bytes())
        whole: pack.Source = path
    else:
        doc = highlights.load_or_compute(run, scratch / run.name)
        whole = _compact(doc)
    return whole if ids is None else _compact(_subset_highlights(doc, ids))


def _crowd_entries(
    run: library.Rollout,
    derived: Any,
    root: pathlib.Path,
    scratch: pathlib.Path,
    ids: Sequence[int] | None,
) -> dict[str, pack.Source]:
    """Returns the root-pose stream and summaries of a run with many envs."""
    cache = derived.cache_dir(root, run)
    out: dict[str, pack.Source] = {}
    root_pose = derived.ensure(run, cache, derived.ROOT_POSE)
    if root_pose is not None:
        if ids is not None:
            cut = scratch / f"{run.name}-{derived.ROOT_POSE}"
            pack.transcode_stream(root_pose, cut, "q16d", kind="pose", envs=ids)
            root_pose = cut
        out[derived.ROOT_POSE] = root_pose
    summaries = derived.ensure(run, cache, derived.SUMMARIES)
    if summaries is not None:
        if ids is None:
            out[derived.SUMMARIES] = summaries
        else:
            doc = json.loads(summaries.read_bytes())
            doc["values"] = {
                k: [v[i] for i in ids] for k, v in doc["values"].items()
            }
            out[derived.SUMMARIES] = _compact(doc)
    return out


def derived_entries(
    library_root: os.PathLike[str] | str,
    runs: Sequence[str],
    scratch: pathlib.Path,
    *,
    envs: Sequence[int] | None = None,
) -> dict[str, pack.Source]:
    """Collects the ``derived/<run>/`` pack entries of runs.

    Highlights are included for every run whose highlights can be computed.
    A run that still has more than 64 envs after ``envs`` also gets its
    crowd-tier ``root_pose.blk`` and ``summaries.json``, when
    :mod:`simscope.derived` is present. Nothing is computed for a run that
    is still recording, and a derived file that fails to compute is left out
    with a warning: derived data is optional in a pack.

    Args:
        library_root: The library directory.
        runs: Run names (validated by the caller).
        scratch: A folder for files made on the way; it must outlive the
            pack write.
        envs: The env subset of the export, if any.

    Returns:
        Entries by pack path, ready for ``write_pack(derived=...)``.

    Raises:
        ValueError: If ``envs`` is invalid for a run.
    """
    root = pathlib.Path(library_root)
    derived = _derived_module()
    entries: dict[str, pack.Source] = {}
    for name in runs:
        try:
            run = library.Rollout(root, name)
        except FileNotFoundError:
            continue  # write_pack reports it
        with run:
            if run.is_recording:
                continue
            ids = (
                None
                if envs is None
                else pack.check_envs(envs, run.n_envs, name)
            )
            n_out = run.n_envs if ids is None else len(ids)
            prefix = f"{pack.DERIVED_PREFIX}{name}/"
            try:
                entries[prefix + highlights.FILE_NAME] = _run_highlights(
                    run, derived, root, scratch, ids
                )
            except Exception:  # isolation point: optional data must not fail
                logger.warning("no highlights for %s", name, exc_info=True)
            if derived is None or n_out <= CROWD_ENVS:
                continue
            try:
                found = _crowd_entries(run, derived, root, scratch, ids)
            except Exception:  # isolation point: optional data must not fail
                logger.warning("no crowd data for %s", name, exc_info=True)
                continue
            entries.update({prefix + k: v for k, v in found.items()})
    return entries


def build_pack(
    library_root: os.PathLike[str] | str,
    runs: Sequence[str],
    *,
    transcode: bool = True,
    annotations: bool = True,
    envs: Sequence[int] | None = None,
    derived: bool = True,
) -> bytes:
    """Builds one pack holding all runs.

    All runs go through :func:`simscope.io.pack.write_pack` together, so
    shared scenes and meshes are stored once. Each run's ``poster.png`` is
    included when it exists.

    Args:
        library_root: The library directory.
        runs: Names of the runs to include.
        transcode: Whether to shrink the pack (q16d poses, q16 meshes).
        annotations: Whether to keep each run's ``annotations.json``.
        envs: Keep only these envs of every run (see
            :func:`simscope.io.pack.write_pack`).
        derived: Whether to add the ``derived/<run>/`` entries of
            :func:`derived_entries`. Computing them caches files under the
            library's ``.simscope/derived``.

    Returns:
        The pack bytes.

    Raises:
        ValueError: On an empty or duplicate run list, an invalid run name,
            a run that is still recording, or an invalid ``envs``.
        FileNotFoundError: If a run or a file it references is missing.
    """
    root = pathlib.Path(library_root)
    names = _check_runs(runs)
    with tempfile.TemporaryDirectory(prefix="simscope-export-") as tmp:
        scratch = pathlib.Path(tmp)
        extra = (
            derived_entries(root, names, scratch, envs=envs) if derived else {}
        )
        out = scratch / "export.simscope"
        pack.write_pack(
            root,
            names,
            out,
            transcode=transcode,
            annotations=annotations,
            envs=envs,
            derived=extra or None,
        )
        return out.read_bytes()


def _write_atomic(path: pathlib.Path, data: bytes) -> pathlib.Path:
    """Writes ``data`` to ``path`` via a temporary file and a rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = cas.create_temp(path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
    except BaseException:
        pathlib.Path(tmp).unlink(missing_ok=True)
        raise
    return path


def export_pack(
    library_root: os.PathLike[str] | str,
    runs: Sequence[str],
    out_path: os.PathLike[str] | str,
    *,
    transcode: bool = True,
    annotations: bool = True,
    envs: Sequence[int] | None = None,
    derived: bool = True,
) -> pathlib.Path:
    """Writes runs to a ``.simscope`` pack.

    Args:
        library_root: The library directory.
        runs: Names of the runs to include.
        out_path: The pack file to write (replaced atomically).
        transcode: Whether to shrink the pack (q16d poses, q16 meshes).
        annotations: Whether to keep each run's ``annotations.json``.
        envs: Keep only these envs of every run.
        derived: Whether to add highlights and crowd data (see
            :func:`build_pack`).

    Returns:
        The output path.

    Raises:
        ValueError: On an empty or duplicate run list, an invalid run name,
            a run that is still recording, or an invalid ``envs``.
        FileNotFoundError: If a run or a file it references is missing.
    """
    data = build_pack(
        library_root,
        runs,
        transcode=transcode,
        annotations=annotations,
        envs=envs,
        derived=derived,
    )
    return _write_atomic(pathlib.Path(out_path), data)


def _b64_block(data: bytes) -> str:
    """Base64-encodes bytes as lines of ``_WRAP`` characters."""
    text = base64.b64encode(data).decode("ascii")
    return "\n".join(text[i : i + _WRAP] for i in range(0, len(text), _WRAP))


def gzip_runtime(runtime: bytes) -> bytes:
    """Compresses the player runtime deterministically.

    Args:
        runtime: The player IIFE.

    Returns:
        A gzip stream (fixed level, ``mtime=0``, no file name).
    """
    return gzip.compress(runtime, compresslevel=GZIP_LEVEL, mtime=0)


_CSS = """\
:root{color-scheme:light dark;--bg:#fbfaf7;--fg:#1d1d1b;--muted:#6b6a64;\
--line:#d9d6cc;--panel:#f0eee7;--accent:#3b6ea5;--mark:#d1495b}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ebeae5;\
--muted:#9a988f;--line:#3a3935;--panel:#222220;--accent:#7aa7d8}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);\
font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
h1{font-size:1.4rem;font-weight:600;margin:0 0 16px}
.players{display:grid;gap:16px;\
grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))}
.single .players{grid-template-columns:minmax(0,960px)}
figure{margin:0;min-width:0}
figcaption{margin-top:6px;font-size:13px;color:var(--muted)}
.slot{margin-right:6px;font-weight:600;color:var(--fg)}
simscope-player{border:1px solid var(--line);border-radius:6px}
.error{color:#b3261e;margin:0 0 16px}
.master{display:flex;align-items:center;gap:12px;margin:0 0 16px;\
padding:8px 12px;background:var(--panel);border:1px solid var(--line);\
border-radius:6px}
.master[hidden]{display:none}
.master button,.master select{font:inherit;color:inherit;background:none;\
border:1px solid var(--line);border-radius:4px;padding:2px 10px;\
cursor:pointer}
.master button:disabled{opacity:.5;cursor:default}
.track{position:relative;flex:1;min-width:60px;height:28px}
.marks{position:absolute;left:0;right:0;top:2px;height:6px}
.marks i{position:absolute;top:0;height:6px;min-width:3px;\
background:var(--mark);border-radius:1px;opacity:.85;cursor:pointer}
.scrub{position:absolute;left:0;right:0;bottom:0;width:100%;height:18px;\
margin:0;accent-color:var(--accent)}
.time{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:13px}
@media (max-width:520px){.master{flex-wrap:wrap}.track{flex-basis:100%;\
order:3}}
"""

# Classic script: gunzip the runtime and run it from a blob: URL. Nothing
# here touches the network.
_BOOTSTRAP = """\
(function () {
  var $ = function (id) { return document.getElementById(id); };
  function fail(err) {
    var box = $("simscope-error");
    box.textContent = "simscope: could not start the player (" +
      (err && err.message || err) + "). Open this file in a current browser.";
    box.hidden = false;
  }
  async function start() {
    var text = $("%(runtime)s").textContent.trim();
    var bytes = Uint8Array.fromBase64 ? Uint8Array.fromBase64(text) :
      Uint8Array.from(atob(text), function (c) { return c.charCodeAt(0); });
    var stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream("gzip"));
    var js = await new Response(stream).blob();
    var script = document.createElement("script");
    script.src = URL.createObjectURL(
      new Blob([js], { type: "text/javascript" }));
    script.onload = function () {
      URL.revokeObjectURL(script.src);
      $("%(runtime)s").remove();
      script.remove();
    };
    script.onerror = function () { fail("the runtime did not load"); };
    document.head.appendChild(script);
  }
  start().catch(fail);
})();
""".replace("%(runtime)s", RUNTIME_ID)

# Starts the shared control of layout="compare" once the runtime has defined
# the element (the global SimscopePlayer is set when its script ends). The
# control itself, play button, scrubber, run rows of highlight markers and the
# colour dots of the captions, is attachMaster in the runtime.
_MASTER = """\
customElements.whenDefined("simscope-player").then(function () {
  SimscopePlayer.attachMaster(
    document.getElementById("ss-master"), "%(sync)s");
});
""".replace("%(sync)s", COMPARE_SYNC)


def _player_tag(
    run: str, layout: Layout, autoplay: bool, loop: bool, slot: int = 0
) -> str:
    """Returns the ``<figure>`` markup of one player.

    Args:
        run: Run name.
        layout: The page layout.
        autoplay: Whether the player starts by itself (not in ``compare``).
        loop: Whether the player restarts at its end (not in ``compare``).
        slot: Position of the run in a ``compare`` page, 0 for A.
    """
    attrs = [f'src="#{PACK_ID}"', f'run="{html.escape(run, quote=True)}"']
    name = html.escape(run)
    caption = ""
    if layout == "compare":
        letter, color = COMPARE_SLOTS[slot]
        # nocontrols: the master control drives playback; sync and color
        # make the player read its clock and tint its markers.
        attrs += ["nocontrols", f'sync="{COMPARE_SYNC}"', f'color="{color}"']
        caption = (
            f'<figcaption><span class="slot">{letter}</span>{name}</figcaption>'
        )
    else:
        attrs += ["autoplay"] * autoplay + ["loop"] * loop
        if layout != "single":
            caption = f"<figcaption>{name}</figcaption>"
    return (
        f"<figure><simscope-player {' '.join(attrs)}></simscope-player>"
        f"{caption}</figure>"
    )


def _master_tag(autoplay: bool, loop: bool) -> str:
    """Returns the markup of the shared control of ``layout="compare"``."""
    speeds = "".join(
        f'<option value="{s}"{" selected" if s == "1" else ""}>{s}x</option>'
        for s in ("0.25", "0.5", "1", "2", "4")
    )
    return (
        f'<div class="master" id="ss-master" hidden '
        f'data-autoplay="{int(autoplay)}" data-loop="{int(loop)}">'
        '<button type="button" id="ss-play" aria-label="Play" disabled>'
        "Play</button>"
        '<div class="track"><div class="marks" id="ss-marks"></div>'
        '<input class="scrub" id="ss-scrub" type="range" min="0" max="1000" '
        'value="0" step="1" aria-label="Seek all runs" disabled></div>'
        '<span class="time" id="ss-time">0.00s / 0.00s</span>'
        f'<select id="ss-speed" aria-label="Speed">{speeds}</select></div>'
    )


def _licences() -> str:
    """Returns the third-party licence text, safe inside an HTML comment."""
    text = read_asset(LICENSES_ASSET).decode("utf-8").strip()
    return text.replace("--", "- -")  # keep the comment well-formed


def _boot_block(names: Sequence[str], layout: Layout) -> str:
    """Returns the ``simscope-boot`` JSON script of a full export."""
    boot = {
        "mode": "pack",
        "pack": f"#{PACK_ID}",
        "runs": list(names),
        "layout": layout,
        "writable": False,
    }
    text = json.dumps(boot, sort_keys=True, ensure_ascii=True)
    text = text.replace("<", "\\u003c")  # no </script> or <!-- in the block
    return f'<script id="{BOOT_ID}" type="application/json">{text}</script>'


_FULL_CSS = (
    "#simscope-error{font:14px/1.5 system-ui,sans-serif;color:#b3261e;"
    "padding:16px}#simscope-error[hidden]{display:none}"
)


def _full_page(
    pack_bytes: bytes, names: Sequence[str], heading: str, layout: Layout
) -> bytes:
    """Builds the page of ``ui="full"``: the app, a boot block, the pack."""
    css = read_asset(APP_CSS_ASSET).decode("utf-8")
    if "</style" in css.lower():
        raise ValueError("the app stylesheet must not contain </style")
    runtime = gzip_runtime(read_asset(APP_ASSET))
    parts = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<link rel="icon" href="data:,">',  # no /favicon.ico request
        f"<title>{html.escape(heading)}</title>",
        f"<style>{_FULL_CSS}</style>",
        f"<style>\n{css.strip()}\n</style>",
        "</head>",
        "<body>",
        '<div id="app"></div>',
        '<p id="simscope-error" role="alert" hidden></p>',
        "<noscript>This page needs JavaScript.</noscript>",
        _boot_block(names, layout),
        f'<script type="text/plain" id="{RUNTIME_ID}">\n'
        f"{_b64_block(runtime)}\n</script>",
        f'<script type="text/plain" id="{PACK_ID}">\n'
        f"{_b64_block(pack_bytes)}\n</script>",
        f"<script>\n{_BOOTSTRAP}</script>",
        "</body>",
        "</html>",
        f"<!--\n{_licences()}\n-->",
        "",
    ]
    return "\n".join(part for part in parts if part).encode("utf-8")


def build_html(
    pack_bytes: bytes,
    runs: Sequence[str],
    *,
    title: str | None = None,
    layout: Layout = "grid",
    autoplay: bool = True,
    loop: bool = True,
    ui: Ui = "lean",
) -> bytes:
    """Builds the HTML page around an existing pack.

    Args:
        pack_bytes: A pack holding at least the named runs.
        runs: Runs to show, in page order.
        title: Page title; defaults to the run name for a single run and to
            ``"simscope export"`` otherwise.
        layout: ``"single"`` (exactly one run), ``"grid"`` (independent
            players), or ``"compare"`` (players driven by one shared control).
        autoplay: Whether playback starts once the players are ready
            (``ui="lean"`` only; the app has its own controls).
        loop: Whether playback restarts at the end (``ui="lean"`` only).
        ui: ``"lean"`` for ``<simscope-player>`` elements, ``"full"`` for the
            whole app.

    Returns:
        The UTF-8 page.

    Raises:
        ValueError: On an unknown layout or ``ui``, an empty run list,
            several runs with ``layout="single"``, or more than four with
            ``layout="compare"``.
    """
    if ui not in _UIS:
        raise ValueError(f"ui must be one of {_UIS}, got {ui!r}")
    if layout not in _LAYOUTS:
        raise ValueError(f"layout must be one of {_LAYOUTS}, got {layout!r}")
    names = _check_layout(layout, _check_runs(runs))
    heading = (
        title
        if title is not None
        else (names[0] if layout == "single" else "simscope export")
    )
    if ui == "full":
        return _full_page(pack_bytes, names, heading, layout)
    runtime = gzip_runtime(read_asset(RUNTIME_ASSET))
    licenses = _licences()
    players = "\n".join(
        _player_tag(n, layout, autoplay, loop, slot)
        for slot, n in enumerate(names)
    )
    parts = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<link rel="icon" href="data:,">',  # no /favicon.ico request
        f"<title>{html.escape(heading)}</title>",
        f"<style>\n{_CSS}</style>",
        "</head>",
        f'<body class="{layout}">',
        "<main>",
        f"<h1>{html.escape(heading)}</h1>",
        '<p class="error" id="simscope-error" role="alert" hidden></p>',
        '<noscript><p class="error">This page needs JavaScript.</p></noscript>',
        _master_tag(autoplay, loop) if layout == "compare" else "",
        f'<div class="players">\n{players}\n</div>',
        "</main>",
        f'<script type="text/plain" id="{RUNTIME_ID}">\n'
        f"{_b64_block(runtime)}\n</script>",
        f'<script type="text/plain" id="{PACK_ID}">\n'
        f"{_b64_block(pack_bytes)}\n</script>",
        f"<script>\n{_BOOTSTRAP}</script>",
        f"<script>\n{_MASTER}</script>" if layout == "compare" else "",
        "</body>",
        "</html>",
        f"<!--\n{licenses}\n-->",
        "",
    ]
    return "\n".join(part for part in parts if part).encode("utf-8")


def export_html(
    library_root: os.PathLike[str] | str,
    runs: Sequence[str],
    out_path: os.PathLike[str] | str,
    *,
    title: str | None = None,
    layout: Layout = "grid",
    transcode: bool = True,
    annotations: bool = True,
    autoplay: bool = True,
    loop: bool = True,
    ui: Ui = "lean",
    envs: Sequence[int] | None = None,
) -> pathlib.Path:
    """Exports runs as one self-contained HTML file.

    The file makes no network requests and works from ``file://``. With
    ``ui="lean"`` runs appear as ``<simscope-player>`` elements in the order
    given; with ``ui="full"`` the page is the whole app, started on the same
    pack. One pack holds all runs, so scenes and meshes shared between runs
    are stored once, and it carries each run's derived data (highlights, and
    for more than 64 envs the crowd root-pose stream and summaries). Output
    is deterministic for equal inputs.

    A pack is inlined as base64 in a string, which Chrome caps at 512 MiB, so
    very large runs need ``envs`` to pick a subset.

    Args:
        library_root: The library directory.
        runs: Names of the runs to export.
        out_path: The HTML file to write (replaced atomically).
        title: Page title; defaults to the run name for a single run and to
            ``"simscope export"`` otherwise.
        layout: ``"single"`` for exactly one run, ``"grid"`` for independent
            players, or ``"compare"`` for up to four players driven in
            lockstep by a shared play/pause button, scrubber and speed
            control, each in its own colour and lettered A to D, with its
            highlights on the shared timeline. Runs of different durations
            stop at their own ends.
        transcode: Whether to shrink the pack (q16d poses, q16 meshes).
        annotations: Whether to include each run's ``annotations.json``, so
            events show as timeline markers.
        autoplay: Whether playback starts once the players are ready
            (``ui="lean"``).
        loop: Whether playback restarts at the end (``ui="lean"``). With
            ``"compare"`` the shared control restarts every run when the
            longest one ends.
        ui: ``"lean"`` (the default) or ``"full"``.
        envs: Export only these envs of every run, in this order; they are
            renumbered from 0. ``None`` exports all.

    Returns:
        The output path.

    Raises:
        ValueError: On an unknown layout or ``ui``, an empty or duplicate run
            list, an invalid run name, several runs with ``layout="single"``,
            more than four with ``layout="compare"``, a run that is still
            recording, or an invalid ``envs``.
        FileNotFoundError: If a run or a file it references is missing.
    """
    if ui not in _UIS:
        raise ValueError(f"ui must be one of {_UIS}, got {ui!r}")
    names = _check_layout(layout, _check_runs(runs))
    data = build_pack(
        library_root,
        names,
        transcode=transcode,
        annotations=annotations,
        envs=envs,
    )
    page = build_html(
        data,
        names,
        title=title,
        layout=layout,
        autoplay=autoplay,
        loop=loop,
        ui=ui,
    )
    return _write_atomic(pathlib.Path(out_path), page)
