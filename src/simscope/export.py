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
same inline pack (viewer contracts 6). The pack also carries each
run's derived data under ``derived/<run>/``: the highlights (full exports
only, because the lean player does not draw them) and, for more than 64 envs,
the crowd root-pose stream and per-env summaries. ``envs=[...]`` exports only
those envs.

The lean page is deliberately bare (viewer contracts 10): a dark/light
neutral background and the ``<simscope-player>`` elements, nothing else. The
runtime lays out a ``compare`` page itself, in the arrangement named by
``data-arrange``, and adds the one shared control bar.
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

from simscope import _icon, highlights, library
from simscope.io import cas, manifest, pack

logger = logging.getLogger(__name__)

Layout = Literal["single", "grid", "compare"]
Arrange = Literal["side", "stack", "grid"]
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
COMPARE_MAX = 4
"""A compare page takes up to this many runs."""
ARRANGEMENTS = ("side", "stack", "grid")
"""How a compare page lays out its panes: side by side (a horizontal split),
stacked (a vertical split), or a 2 x 2 grid (one cell empty for three
runs)."""
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
    if layout == "compare" and len(names) > COMPARE_MAX:
        raise ValueError(
            f'layout="compare" takes up to {COMPARE_MAX} runs, got {len(names)}'
        )
    return names


def _arrangement(
    layout: str, arrange: str | None, n_runs: int
) -> Arrange | None:
    """Resolves the arrangement of a page.

    Args:
        layout: The page layout.
        arrange: The requested arrangement, or ``None`` for the default.
        n_runs: How many runs the page shows.

    Returns:
        ``None`` unless the layout is ``"compare"``; otherwise the
        arrangement, which defaults to ``"side"`` for up to two runs and to
        ``"grid"`` for three or four.

    Raises:
        ValueError: For an unknown arrangement, or one given to a layout
            other than ``"compare"``.
    """
    if arrange is not None and arrange not in ARRANGEMENTS:
        raise ValueError(
            f"arrange must be one of {ARRANGEMENTS}, got {arrange!r}"
        )
    if layout != "compare":
        if arrange is not None:
            raise ValueError('arrange needs layout="compare"')
        return None
    if arrange is not None:
        return arrange
    return "side" if n_runs <= 2 else "grid"


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
    with_highlights: bool = True,
) -> dict[str, pack.Source]:
    """Collects the ``derived/<run>/`` pack entries of runs.

    Highlights are included for every run whose highlights can be computed,
    unless ``with_highlights`` is false.
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
        with_highlights: Whether to include ``highlights.json``. Lean HTML
            exports leave it out: the player does not draw highlights.

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
            if with_highlights:
                try:
                    entries[prefix + highlights.FILE_NAME] = _run_highlights(
                        run, derived, root, scratch, ids
                    )
                except Exception:  # isolation point: optional data
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
    with_highlights: bool = True,
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
        with_highlights: Whether those entries include ``highlights.json``
            (``derived`` must be true for it to matter).

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
            derived_entries(
                root,
                names,
                scratch,
                envs=envs,
                with_highlights=with_highlights,
            )
            if derived
            else {}
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


# The whole page style of a lean export (viewer contracts 10): the runtime
# lays out and styles everything else. The background only stops a flash of
# the wrong colour before the runtime has started; the greys are the app's
# oklch(0.97 0 0) and oklch(0.18 0 0).
_CSS = """\
:root{color-scheme:light dark}
html,body{margin:0;height:100%;background:#f5f5f5}
@media (prefers-color-scheme:dark){html,body{background:#121212}}
"""
_ERROR_STYLE = (
    "margin:0;padding:16px;font:14px/1.5 system-ui,sans-serif;color:#b3261e"
)

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
# the element (the global SimscopePlayer is set when its script ends).
# attachMaster builds the arrangement, the titles and the one control bar.
_MASTER = """\
customElements.whenDefined("simscope-player").then(function () {
  SimscopePlayer.attachMaster(
    document.getElementById("ss-master"), "%(sync)s");
});
""".replace("%(sync)s", COMPARE_SYNC)


def _player(run: str, extra: str = "") -> str:
    """Returns a ``<simscope-player>`` element for a run.

    Args:
        run: Run name.
        extra: Further attributes, such as ``sync="compare"``.
    """
    attrs = f'src="#{PACK_ID}" run="{html.escape(run, quote=True)}"'
    if extra:
        attrs += f" {extra}"
    return f"<simscope-player {attrs}></simscope-player>"


def _figure(run: str, extra: str = "") -> str:
    """Returns a ``<figure>``: the run name as its title, then the player."""
    return (
        f"<figure><figcaption>{html.escape(run)}</figcaption>"
        f"{_player(run, extra)}</figure>"
    )


def _content(
    names: Sequence[str],
    layout: Layout,
    arrange: Arrange | None,
    autoplay: bool,
    loop: bool,
) -> str:
    """Returns the body markup of a lean page, below the error boxes.

    ``single`` is one bare player. ``grid`` is a titled player per run.
    ``compare`` is the box the runtime turns into the shared layout.
    """
    flags = " ".join(
        ["autoplay"] * autoplay + ["loop"] * loop + ["themetoggle"]
    )
    if layout == "single":
        return _player(names[0], flags)
    if layout == "grid":
        return "\n".join(_figure(n, flags) for n in names)
    figures = "\n".join(_figure(n, f'sync="{COMPARE_SYNC}"') for n in names)
    return (
        f'<div id="ss-master" data-arrange="{arrange}" '
        f'data-autoplay="{int(autoplay)}" data-loop="{int(loop)}">\n'
        f"{figures}\n</div>"
    )


def _licences() -> str:
    """Returns the third-party licence text, safe inside an HTML comment."""
    text = read_asset(LICENSES_ASSET).decode("utf-8").strip()
    return text.replace("--", "- -")  # keep the comment well-formed


def _boot_block(
    names: Sequence[str], layout: Layout, arrange: Arrange | None = None
) -> str:
    """Returns the ``simscope-boot`` JSON script of a full export.

    ``arrange`` is written (as ``"arrange"``) for compare layouts only.
    """
    boot: dict[str, Any] = {
        "mode": "pack",
        "pack": f"#{PACK_ID}",
        "runs": list(names),
        "layout": layout,
        "writable": False,
    }
    if arrange is not None:
        boot["arrange"] = arrange
    text = json.dumps(boot, sort_keys=True, ensure_ascii=True)
    text = text.replace("<", "\\u003c")  # no </script> or <!-- in the block
    return f'<script id="{BOOT_ID}" type="application/json">{text}</script>'


_FULL_CSS = (
    "#simscope-error{font:14px/1.5 system-ui,sans-serif;color:#b3261e;"
    "padding:16px}#simscope-error[hidden]{display:none}"
)


def _full_page(
    pack_bytes: bytes,
    names: Sequence[str],
    heading: str,
    layout: Layout,
    arrange: Arrange | None,
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
        _icon.ICON_LINK,  # a data URI: no /favicon.ico request
        f"<title>{html.escape(heading)}</title>",
        f"<style>{_FULL_CSS}</style>",
        f"<style>\n{css.strip()}\n</style>",
        "</head>",
        "<body>",
        '<div id="app"></div>',
        '<p id="simscope-error" role="alert" hidden></p>',
        "<noscript>This page needs JavaScript.</noscript>",
        _boot_block(names, layout, arrange),
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
    arrange: Arrange | None = None,
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
            players), or ``"compare"`` (panes driven by one shared control).
        arrange: For ``layout="compare"``, how the panes sit: ``"side"``,
            ``"stack"`` or ``"grid"``. ``None`` picks ``"side"`` for one or
            two runs and ``"grid"`` for three or four.
        autoplay: Whether playback starts once the players are ready
            (``ui="lean"`` only; the app has its own controls).
        loop: Whether playback restarts at the end (``ui="lean"`` only).
        ui: ``"lean"`` for ``<simscope-player>`` elements, ``"full"`` for the
            whole app.

    Returns:
        The UTF-8 page.

    Raises:
        ValueError: On an unknown layout, ``ui`` or ``arrange``, an
            ``arrange`` without ``layout="compare"``, an empty run list,
            several runs with ``layout="single"``, or more than four with
            ``layout="compare"``.
    """
    if ui not in _UIS:
        raise ValueError(f"ui must be one of {_UIS}, got {ui!r}")
    if layout not in _LAYOUTS:
        raise ValueError(f"layout must be one of {_LAYOUTS}, got {layout!r}")
    names = _check_layout(layout, _check_runs(runs))
    where = _arrangement(layout, arrange, len(names))
    heading = (
        title
        if title is not None
        else (names[0] if layout == "single" else "simscope export")
    )
    if ui == "full":
        return _full_page(pack_bytes, names, heading, layout, where)
    runtime = gzip_runtime(read_asset(RUNTIME_ASSET))
    licenses = _licences()
    parts = [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        _icon.ICON_LINK,  # a data URI: no /favicon.ico request
        f"<title>{html.escape(heading)}</title>",
        f"<style>\n{_CSS}</style>",
        "</head>",
        "<body>",
        f'<p id="simscope-error" role="alert" hidden style="{_ERROR_STYLE}">'
        "</p>",
        f'<noscript><p style="{_ERROR_STYLE}">This page needs JavaScript.</p>'
        "</noscript>",
        _content(names, layout, where, autoplay, loop),
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
    arrange: Arrange | None = None,
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
    are stored once. A full export's pack also carries each run's
    highlights; for more than 64 envs, either kind carries the crowd root-pose
    stream and summaries. Output is deterministic for equal inputs.

    A lean page is bare: the players fill the window and the runtime adds one
    control bar (viewer contracts 10). A ``compare`` page looks like the
    app's compare view: the panes fill the page, each with its run name as a
    title and nothing else, and one control bar below them drives every pane.

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
            lockstep by one shared control bar (play and pause, step, a
            scrubber, the time, loop and speed). Runs of different durations
            stop at their own ends.
        arrange: For ``layout="compare"``, how the panes sit: ``"side"``
            (side by side), ``"stack"`` (one above the other) or ``"grid"``
            (two by two). The default is ``"side"`` for one or two runs and
            ``"grid"`` for three or four. In a full export it is the
            arrangement the app opens with.
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
        ValueError: On an unknown layout, ``ui`` or ``arrange``, an
            ``arrange`` without ``layout="compare"``, an empty or duplicate
            run list, an invalid run name, several runs with
            ``layout="single"``, more than four with ``layout="compare"``, a
            run that is still recording, or an invalid ``envs``.
        FileNotFoundError: If a run or a file it references is missing.
    """
    if ui not in _UIS:
        raise ValueError(f"ui must be one of {_UIS}, got {ui!r}")
    names = _check_layout(layout, _check_runs(runs))
    _arrangement(layout, arrange, len(names))  # refuse before packing
    data = build_pack(
        library_root,
        names,
        transcode=transcode,
        annotations=annotations,
        envs=envs,
        with_highlights=ui == "full",
    )
    page = build_html(
        data,
        names,
        title=title,
        layout=layout,
        arrange=arrange,
        autoplay=autoplay,
        loop=loop,
        ui=ui,
    )
    return _write_atomic(pathlib.Path(out_path), page)
