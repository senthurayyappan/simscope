"""The ``simscope`` command line: serve, ls, export, pack, import, ...

Everything except ``serve`` works without the viewer extra. ``serve``
imports the server lazily, so the other commands never load starlette,
uvicorn, or watchfiles.
"""

import argparse
import dataclasses
import importlib
import json
import logging
import pathlib
import sys
import time
from collections.abc import Callable, Sequence

from simscope import export, importers, library
from simscope.io import errors, manifest

_SORTS = ("created", "name", "n_frames", "rating")
_RIGHT = frozenset({"FRAMES", "ENVS", "SECONDS", "RATING"})
_SERVER_DEPS = ("starlette", "uvicorn", "watchfiles")
_VIEWER_HINT = "the viewer is not installed: pip install 'simscope[viewer]'"


class UserError(Exception):
    """A problem the user can fix; ``main`` prints it and exits with 1."""


# -- helpers --


def _library_root(path: str) -> pathlib.Path:
    """Returns the library folder, which must exist.

    Raises:
        UserError: If ``path`` is not a directory.
    """
    root = pathlib.Path(path)
    if not root.is_dir():
        raise UserError(f"no library folder at {root}")
    return root


def _check_runs(root: pathlib.Path, names: Sequence[str]) -> None:
    """Checks that every name is a valid, existing run of the library.

    Raises:
        UserError: On a bad name, a missing run, or a duplicate.
    """
    if len(set(names)) != len(names):
        raise UserError("duplicate run names")
    for name in names:
        try:
            manifest.validate_run_name(name)
        except ValueError as exc:
            raise UserError(str(exc)) from exc
        run_dir = root / "runs" / name
        if not any(
            (run_dir / f).is_file()
            for f in (manifest.MANIFEST_NAME, manifest.PARTIAL_NAME)
        ):
            raise UserError(f"no run {name!r} in {root}")


def _human(n: float) -> str:
    """Formats a byte count, for example ``1.5 MB``."""
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    raise AssertionError("unreachable")  # pragma: no cover


def _table(header: Sequence[str], rows: Sequence[Sequence[str]]) -> str:
    """Formats rows as an aligned table; columns named in ``_RIGHT`` right."""
    cols = list(zip(header, *rows, strict=False))
    widths = [max(len(cell) for cell in col) for col in cols]
    right = {i for i, h in enumerate(header) if h in _RIGHT}

    def line(cells: Sequence[str]) -> str:
        parts = [
            c.rjust(w) if i in right else c.ljust(w)
            for i, (c, w) in enumerate(zip(cells, widths, strict=True))
        ]
        return "  ".join(parts).rstrip()

    return "\n".join([line(header), *(line(r) for r in rows)])


# -- commands --


def _cmd_serve(args: argparse.Namespace) -> int:
    root = _library_root(args.dir)
    try:
        backend = importlib.import_module("simscope.server")
    except ModuleNotFoundError as exc:
        if (exc.name or "").split(".")[0] not in _SERVER_DEPS:
            raise
        raise UserError(_VIEWER_HINT) from exc
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    print(
        f"serving {root} on http://{args.host}:{args.port}  (Ctrl-C to stop)",
        flush=True,
    )
    backend.serve(root, host=args.host, port=args.port, author=args.author)
    return 0


def _cmd_ls(args: argparse.Namespace) -> int:
    root = _library_root(args.dir)
    lib = library.Library(root)
    try:
        rows = lib.query(
            tags=args.tag or (),
            favorite=True if args.favorite else None,
            status=args.status,
            sort=args.sort,
            descending=args.sort != "name",
            limit=args.limit,
        )
    finally:
        lib.close()
    if args.json:
        for info in rows:
            print(json.dumps(dataclasses.asdict(info), sort_keys=True))
        return 0
    if not rows:
        print("no runs", file=sys.stderr)
        return 0
    header = (
        "NAME",
        "STATUS",
        "FRAMES",
        "ENVS",
        "SECONDS",
        "CREATED",
        "FAV",
        "RATING",
        "TAGS",
    )
    body = [
        (
            r.name,
            r.status,
            str(r.n_frames),
            str(r.n_envs),
            f"{r.n_frames * r.dt:.2f}",
            r.created,
            "*" if r.favorite else "",
            "-" if r.rating is None else f"{r.rating:.1f}",
            ",".join(r.tags),
        )
        for r in rows
    ]
    print(_table(header, body))
    return 0


def _cmd_export(args: argparse.Namespace) -> int:
    root = _library_root(args.dir)
    _check_runs(root, args.runs)
    layout = args.layout or ("single" if len(args.runs) == 1 else "grid")
    try:
        out = export.export_html(
            root,
            args.runs,
            args.output,
            title=args.title,
            layout=layout,
            transcode=not args.no_transcode,
            annotations=not args.no_annotations,
            ui=args.ui,
            envs=args.envs,
        )
    except ValueError as exc:  # still recording, bad layout or envs
        raise UserError(str(exc)) from exc
    print(f"wrote {out} ({_human(out.stat().st_size)})")
    return 0


def _cmd_pack(args: argparse.Namespace) -> int:
    root = _library_root(args.dir)
    _check_runs(root, args.runs)
    try:
        out = export.export_pack(
            root,
            args.runs,
            args.output,
            transcode=not args.no_transcode,
            annotations=not args.no_annotations,
        )
    except ValueError as exc:  # still recording
        raise UserError(str(exc)) from exc
    print(f"wrote {out} ({_human(out.stat().st_size)})")
    return 0


def _tree_bytes(root: pathlib.Path) -> int:
    """Total size of the data folders of a library (not the index cache)."""
    total = 0
    for sub in ("assets", "scenes", "runs"):
        for path in (root / sub).rglob("*"):
            if path.is_file():
                total += path.stat().st_size
    return total


def _cmd_import(args: argparse.Namespace) -> int:
    root = pathlib.Path(args.dir)
    if root.exists() and not root.is_dir():
        raise UserError(f"{root} is not a folder")
    files = importers.find_importable(args.paths)
    if not files:
        raise UserError("nothing to import: no .rbundle or Brax HTML files")
    lib = library.Library(root)
    before = _tree_bytes(root)
    started = time.perf_counter()
    imported = failed = 0
    try:
        for res in importers.import_files(
            lib,
            files,
            tags=args.tag or (),
            overwrite=args.overwrite,
            jobs=args.jobs,
        ):
            if res.name is None:
                failed += 1
                print(f"skipped {res.path}: {res.error}", file=sys.stderr)
                continue
            imported += 1
            print(f"{res.name}  {res.n_frames} frames  <- {res.path}")
        lib.refresh()
    finally:
        lib.close()
    if not imported:
        raise UserError("nothing imported")
    src_bytes = sum(p.stat().st_size for p, _ in files)
    added = _tree_bytes(root) - before
    print(
        f"imported {imported} runs"
        + (f", skipped {failed}" if failed else "")
        + f" in {time.perf_counter() - started:.1f} s: input"
        f" {_human(src_bytes)}, library grew by {_human(added)}"
        f" ({added / max(src_bytes, 1):.0%})"
    )
    return 0


def _cmd_recover(args: argparse.Namespace) -> int:
    root = _library_root(args.dir)
    _check_runs(root, [args.run])
    lib = library.Library(root)
    try:
        report = lib.recover(args.run)
    finally:
        lib.close()
    if report.already_complete:
        print(f"{report.name}: already complete, {report.n_frames} frames")
    else:
        print(
            f"{report.name}: recovered {report.n_frames} frames"
            f" (dropped {report.dropped_frames} from longer streams)"
        )
    return 0


def _cmd_info(args: argparse.Namespace) -> int:
    root = _library_root(args.dir)
    _check_runs(root, [args.run])
    lib = library.Library(root)
    try:
        with lib.open(args.run) as run:
            if run.is_recording:
                run.refresh()
            print(_describe(run))
    finally:
        lib.close()
    return 0


def _describe(run: library.Rollout) -> str:
    """Formats the manifest summary of a run for ``info``."""
    m = run.manifest
    frames = run.n_frames
    status = m.status
    if run.is_recording:
        status += f" ({frames} frames written so far)"
    files = [p for p in run.path.rglob("*") if p.is_file()]
    lines = [
        ("name", m.name),
        ("id", m.id),
        ("status", status),
        ("created", m.created),
        ("frames", str(frames)),
        ("envs", str(m.n_envs)),
        ("bodies", str(m.n_bodies)),
        ("dt", f"{m.dt:g} s ({1 / m.dt:.4g} Hz)"),
        ("duration", f"{frames * m.dt:.2f} s"),
        ("scene", m.scene.sha256),
        ("source", ", ".join(f"{k} {v}" for k, v in m.source.items()) or "-"),
        ("tags", ", ".join(m.tags) or "-"),
        ("on disk", _human(sum(p.stat().st_size for p in files))),
    ]
    width = max(len(k) for k, _ in lines)
    out = [f"{k.ljust(width)}  {v}" for k, v in lines]
    header = ("STREAM", "KIND", "SHAPE", "FILE", "SIZE")
    rows = []
    for name, info in m.streams.items():
        path = run.path / info.file
        size = path.stat().st_size if path.exists() else 0
        rows.append(
            (
                name,
                info.kind,
                "x".join(map(str, info.item_shape)) or "scalar",
                info.file,
                _human(size),
            )
        )
    return "\n".join([*out, "", _table(header, rows)])


# -- parser --


def _port(text: str) -> int:
    """Parses a TCP port for argparse."""
    value = int(text)
    if not 0 <= value <= 65535:
        raise argparse.ArgumentTypeError(f"port out of range: {text}")
    return value


def _positive(text: str) -> int:
    """Parses a positive integer for argparse."""
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError(f"must be at least 1: {text}")
    return value


def _env_list(text: str) -> list[int]:
    """Parses comma-separated env indices for argparse."""
    try:
        envs = [int(part) for part in text.split(",")]
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"expected comma-separated env indices: {text}"
        ) from None
    if any(e < 0 for e in envs):
        raise argparse.ArgumentTypeError(f"env indices are >= 0: {text}")
    return envs


def _build_parser() -> argparse.ArgumentParser:
    """Builds the argument parser with one subparser per command."""
    parser = argparse.ArgumentParser(
        prog="simscope",
        description="Record, browse, curate, and ship robot simulation "
        "rollouts.",
    )
    sub = parser.add_subparsers(dest="command", required=True, metavar="CMD")

    def add(name: str, func: Callable, help_: str) -> argparse.ArgumentParser:
        p = sub.add_parser(name, help=help_, description=help_)
        p.set_defaults(func=func)
        p.add_argument("dir", metavar="DIR", help="the library folder")
        return p

    p = add(
        "serve", _cmd_serve, "browse, compare, and curate runs in the browser"
    )
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=_port, default=8080)
    p.add_argument("--author", help="author of new annotations")

    p = add("ls", _cmd_ls, "list runs")
    p.add_argument("--tag", action="append", help="require a tag (repeatable)")
    p.add_argument("--favorite", action="store_true", help="only favorites")
    p.add_argument("--status", help="recording, complete, or a curation status")
    p.add_argument("--sort", choices=_SORTS, default="created")
    p.add_argument("--limit", type=_positive, help="at most N runs")
    p.add_argument("--json", action="store_true", help="one object per line")

    p = add("export", _cmd_export, "export runs as one self-contained HTML")
    p.add_argument("runs", nargs="+", metavar="RUN")
    p.add_argument("-o", "--output", required=True, metavar="OUT.html")
    p.add_argument("--layout", choices=("single", "grid", "compare"))
    p.add_argument("--title")
    p.add_argument(
        "--ui",
        choices=("lean", "full"),
        default="lean",
        help="lean: player elements; full: the whole app (default lean)",
    )
    p.add_argument(
        "--envs",
        type=_env_list,
        metavar="I,J,...",
        help="export only these envs (comma-separated indices)",
    )
    p.add_argument("--no-transcode", action="store_true")
    p.add_argument("--no-annotations", action="store_true")

    p = add("pack", _cmd_pack, "write runs to a .simscope pack")
    p.add_argument("runs", nargs="+", metavar="RUN")
    p.add_argument("-o", "--output", required=True, metavar="OUT.simscope")
    p.add_argument("--no-transcode", action="store_true")
    p.add_argument("--no-annotations", action="store_true")

    p = add("import", _cmd_import, "import .rbundle and Brax HTML rollouts")
    p.add_argument("paths", nargs="+", metavar="PATH", help="files or folders")
    p.add_argument("--tag", action="append", help="add a tag (repeatable)")
    p.add_argument("--overwrite", action="store_true", help="replace runs")
    p.add_argument("--jobs", type=_positive, help="worker processes")

    p = add("recover", _cmd_recover, "repair a run whose recording crashed")
    p.add_argument("run", metavar="RUN")

    p = add("info", _cmd_info, "summarize a run")
    p.add_argument("run", metavar="RUN")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Runs the command line.

    Args:
        argv: Arguments without the program name; ``sys.argv[1:]`` if
            ``None``.

    Returns:
        The exit status: 0 on success, 1 for a problem the user can fix (a
        missing run, a bad name; one line on stderr), 2 for a usage error,
        130 when interrupted.
    """
    parser = _build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:  # argparse exits on --help and usage errors
        return exc.code if isinstance(exc.code, int) else 2
    try:
        return args.func(args)
    except UserError as exc:
        print(f"simscope: error: {exc}", file=sys.stderr)
        return 1
    except (FileNotFoundError, errors.FormatError) as exc:
        print(f"simscope: error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130
