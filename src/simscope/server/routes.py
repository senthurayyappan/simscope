"""HTTP handlers (contracts 2).

Handlers are plain functions so Starlette runs them on its thread pool: they
do file I/O and never need to await anything, except the annotation route,
which reads a request body.
"""

import inspect
import json
import logging
import os
import pathlib
import re
import tempfile
from typing import Any

from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import (
    FileResponse,
    JSONResponse,
    Response,
    StreamingResponse,
)

from simscope import annotations, export
from simscope.io import blockfile, errors, manifest
from simscope.server import blocks, jobs, security, static
from simscope.server import state as state_mod

logger = logging.getLogger(__name__)

_NO_CACHE = "no-cache"
_IMMUTABLE = "public, max-age=31536000, immutable"
_MAX_BODY = 64 << 10
_JSON_TYPE = "application/json"
_STREAM_CHUNK = 1 << 20
_NOT_APPLICABLE = "no such derived data for this run"


class Services:
    """Everything a handler needs, stored on ``app.state``."""

    def __init__(
        self,
        state: state_mod.LibraryState,
        job_runner: jobs.Jobs,
        block_store: blocks.BlockStore,
    ) -> None:
        """Bundles the services.

        Args:
            state: The library state.
            job_runner: The derived-data jobs.
            block_store: The open block files.
        """
        self.state = state
        self.jobs = job_runner
        self.blocks = block_store


def _svc(request: Request) -> Services:
    """Returns the services of the app handling ``request``."""
    return request.app.state.services


def error(status: int, message: str, **headers: str) -> JSONResponse:
    """Builds the ``{"error": ...}`` reply of contracts 2."""
    return JSONResponse({"error": message}, status_code=status, headers=headers)


# -- conditional responses --


def _etag_matches(request: Request, etag: str) -> bool:
    """Tells whether ``If-None-Match`` already holds this ETag."""
    header = request.headers.get("if-none-match")
    if not header:
        return False
    if header.strip() == "*":
        return True
    weak = etag.removeprefix("W/")
    return any(
        tag.strip().removeprefix("W/") == weak for tag in header.split(",")
    )


def _not_modified(etag: str, cache: str) -> Response:
    return Response(
        status_code=304, headers={"ETag": etag, "Cache-Control": cache}
    )


def _file_etag(st: os.stat_result) -> str:
    return f'"{st.st_mtime_ns:x}-{st.st_size:x}"'


def file_response(
    request: Request,
    path: pathlib.Path,
    *,
    immutable: bool = False,
    media_type: str | None = None,
) -> Response:
    """Serves a file with ETag, conditional GET, and Range support.

    Args:
        request: The request (for ``If-None-Match`` and ``Range``).
        path: The file.
        immutable: Send the year-long immutable cache header (CAS files).
        media_type: Override of the guessed content type.

    Returns:
        A 304, a 404 if the file is gone, or the file. A block file that a
        recorder is still writing is sent up to its size at this moment, so
        a growing file never contradicts its ``Content-Length``.
    """
    try:
        st = path.stat()
    except OSError:
        return error(404, "not found")
    cache = _IMMUTABLE if immutable else _NO_CACHE
    etag = _file_etag(st)
    if _etag_matches(request, etag):
        return _not_modified(etag, cache)
    headers = {"ETag": etag, "Cache-Control": cache}
    if path.suffix == ".blk" and _unfinished(path):
        return _partial_blk(path, st.st_size, headers)
    return FileResponse(
        path, headers=headers, stat_result=st, media_type=media_type
    )


def _unfinished(path: pathlib.Path) -> bool:
    """Tells whether a block file still lacks its directory."""
    try:
        with open(path, "rb") as f:
            head = f.read(blockfile.HEADER_SIZE)
        return blockfile.Header.parse(head).dir_offset == 0
    except (OSError, errors.FormatError):
        return False


def _partial_blk(
    path: pathlib.Path, size: int, headers: dict[str, str]
) -> Response:
    """Streams the first ``size`` bytes of a file that may be growing."""

    def chunks():
        left = size
        with open(path, "rb") as f:
            while left > 0:
                data = f.read(min(_STREAM_CHUNK, left))
                if not data:
                    break
                left -= len(data)
                yield data

    return StreamingResponse(
        chunks(),
        media_type="application/octet-stream",
        headers={**headers, "Content-Length": str(size)},
    )


# -- library, runs, changes --


def library_info(request: Request) -> Response:
    """``GET /api/library``."""
    st = _svc(request).state
    return JSONResponse(
        {
            "name": st.name,
            "root": st.root_real,
            "n_runs": st.n_runs(),
            "seq": st.seq,
            "writable": st.writable,
        },
        headers={"Cache-Control": _NO_CACHE},
    )


def runs(request: Request) -> Response:
    """``GET /api/runs``: every row, ETag on ``seq``."""
    st = _svc(request).state
    gzipped = "gzip" in request.headers.get("accept-encoding", "")
    seq, body = st.runs_body(gzipped=gzipped)
    etag = f'W/"runs-{seq}"'
    if _etag_matches(request, etag):
        return _not_modified(etag, _NO_CACHE)
    headers = {
        "ETag": etag,
        "Cache-Control": _NO_CACHE,
        "Vary": "Accept-Encoding",
    }
    if gzipped:
        headers["Content-Encoding"] = "gzip"
    return Response(body, media_type=_JSON_TYPE, headers=headers)


def changes(request: Request) -> Response:
    """``GET /api/changes?since=``."""
    try:
        since = int(request.query_params.get("since", "0"))
    except ValueError:
        return error(400, "since must be an integer")
    return JSONResponse(
        _svc(request).state.changes(since),
        headers={"Cache-Control": "no-store"},
    )


# -- files and derived data --


def _resolve(
    st: state_mod.LibraryState, target: security.Target
) -> pathlib.Path | None:
    """Maps a parsed path to a file inside the library, or ``None``."""
    if target.kind == "cas":
        return _resolve_cas(st, target.path)
    run_dir = st.lib.run_dir(target.run)
    if target.file == manifest.MANIFEST_NAME:
        candidate = run_dir / manifest.MANIFEST_NAME
        if not candidate.is_file():
            candidate = run_dir / manifest.PARTIAL_NAME
    else:
        candidate = run_dir / target.file
    if not candidate.is_file():
        return None
    return security.confine(st.root_real, candidate)


def _resolve_cas(st: state_mod.LibraryState, rel: str) -> pathlib.Path | None:
    """Finds a content-addressed file in the root or a nested library."""
    direct = st.root / rel
    if direct.is_file():
        return security.confine(st.root_real, direct)
    for lib_root in st.index.owners():
        candidate = lib_root / rel
        if not candidate.is_file():
            continue
        confined = security.confine(st.root_real, candidate)
        if confined is not None:
            return confined
    return None


def _derived(
    request: Request, target: security.Target
) -> tuple[pathlib.Path | None, Response | None]:
    """Resolves a derived path to a ready file, or to the reply to send."""
    status, value = _svc(request).jobs.request(target.run, target.file)
    match status:
        case jobs.Status.READY:
            assert isinstance(value, pathlib.Path)
            return value, None
        case jobs.Status.PENDING:
            return None, JSONResponse(
                {"status": "pending"},
                status_code=202,
                headers={"Retry-After": "1", "Cache-Control": "no-store"},
            )
        case jobs.Status.FAILED:
            return None, error(500, f"could not derive: {value}")
        case jobs.Status.MISSING:
            return None, error(404, "no such run")
        case _:
            return None, error(404, _NOT_APPLICABLE)


def files(request: Request) -> Response:
    """``GET /files/<path>``."""
    target = security.parse_path(request.path_params["path"])
    if target is None:
        return error(404, "not found")
    st = _svc(request).state
    if target.kind == "derived":
        path, reply = _derived(request, target)
        if reply is not None:
            return reply
    else:
        path = _resolve(st, target)
    if path is None:
        return error(404, "not found")
    return file_response(request, path, immutable=target.immutable)


def _block_file(
    request: Request,
) -> tuple[pathlib.Path | None, Response | None]:
    """Resolves the ``path=`` query of the block routes to a ``.blk`` file."""
    target = security.parse_path(request.query_params.get("path", ""))
    if target is None or not target.path.endswith(".blk"):
        return None, error(400, "path must name a .blk file of the library")
    if target.kind == "derived":
        return _derived(request, target)
    path = _resolve(_svc(request).state, target)
    if path is None:
        return None, error(404, "not found")
    return path, None


def blk(request: Request) -> Response:
    """``GET /api/blk?path=``: header and directory of a block file."""
    path, reply = _block_file(request)
    if path is None:
        assert reply is not None
        return reply
    try:
        reader, etag = _svc(request).blocks.reader(path)
    except FileNotFoundError:
        return error(404, "not found")
    except errors.FormatError as exc:
        return error(422, str(exc))
    if _etag_matches(request, etag):
        return _not_modified(etag, _NO_CACHE)
    return Response(
        blocks.index_bytes(reader),
        media_type="application/octet-stream",
        headers={
            "ETag": etag,
            "Cache-Control": _NO_CACHE,
            "X-Simscope-Live": "0" if reader.finished else "1",
        },
    )


def _int(value: str | None, name: str) -> int:
    """Parses a non-negative integer query value."""
    try:
        n = int(value or "")
    except ValueError:
        raise ValueError(f"{name} must be an integer") from None
    if n < 0:
        raise ValueError(f"{name} must not be negative")
    return n


def blocks_route(request: Request) -> Response:
    """``GET /api/blocks?path=&w=&envs=``: raw blocks of one window."""
    path, reply = _block_file(request)
    if path is None:
        assert reply is not None
        return reply
    q = request.query_params
    try:
        window = _int(q.get("w"), "w")
        envs = [_int(e, "envs") for e in q.get("envs", "").split(",") if e]
    except ValueError as exc:
        return error(400, str(exc))
    if not envs:
        return error(400, "envs must list at least one env")
    if len(envs) > blocks.MAX_ENVS:
        return error(400, f"at most {blocks.MAX_ENVS} envs per request")
    try:
        reader, _ = _svc(request).blocks.reader(path)
        parts = blocks.read_blocks(reader, path, window, envs)
    except FileNotFoundError:
        return error(404, "not found")
    except errors.FormatError as exc:
        return error(422, str(exc))
    except IndexError:
        return error(400, "env out of range")
    if parts is None:
        return error(404, "window not written yet")
    # A window never changes once it exists, whatever the file does next.
    return Response(
        b"".join(parts),
        media_type="application/octet-stream",
        headers={
            "X-Simscope-Block-Lengths": ",".join(str(len(p)) for p in parts),
            "Cache-Control": "private, max-age=3600, immutable"
            if reader.finished
            else _NO_CACHE,
        },
    )


# -- writes --


class BadOpError(ValueError):
    """An annotation op the client got wrong (400)."""


def _field(op: dict[str, Any], key: str, types: tuple[type, ...]) -> Any:
    """Returns ``op[key]`` if it has one of ``types`` (bool is not int)."""
    value = op.get(key)
    if not isinstance(value, types) or (
        isinstance(value, bool) and bool not in types
    ):
        names = "/".join(t.__name__ for t in types)
        raise BadOpError(f"{key!r} must be {names}")
    return value


def _opt_str(op: dict[str, Any], key: str) -> str | None:
    if op.get(key) is None:
        return None
    return _field(op, key, (str,))


def _event_changes(
    ann: annotations.Annotations, op: dict[str, Any]
) -> dict[str, Any]:
    """Reads the fields an ``event_update`` op changes.

    Moving an instant (``t0 == t1``) without naming ``t1`` keeps it an
    instant, which is what a label is.

    Raises:
        BadOpError: If a field has the wrong type.
        KeyError: If the op names no event.
    """
    event_id = _field(op, "id", (str,))
    event = next((e for e in ann.events if e.id == event_id), None)
    if event is None:
        raise KeyError(event_id)
    changes: dict[str, Any] = {}
    if "label" in op:
        changes["label"] = _field(op, "label", (str,))
    if "t0" in op:
        changes["t0"] = _field(op, "t0", (int, float))
        if event.t0 == event.t1 and "t1" not in op:
            changes["t1"] = changes["t0"]
    if "t1" in op:
        t1 = op["t1"]
        changes["t1"] = (
            changes.get("t0", event.t0)
            if t1 is None
            else _field(op, "t1", (int, float))
        )
    return changes


def apply_op(
    ann: annotations.Annotations, op: dict[str, Any], author: str | None
) -> None:
    """Applies one annotation op of contracts 2.1 and 8.1 in memory.

    ``tag_add``, ``tag_remove``, ``status`` and ``flag`` were removed in
    viewer v3.1 (decision D23) and are rejected like any unknown op.

    Args:
        ann: The run's annotations.
        op: The decoded request body.
        author: Author of records the op creates.

    Raises:
        BadOpError: If the op is unsupported or malformed.
        KeyError: If ``remove`` or ``event_update`` names no record.
    """
    kind = op.get("op")
    if kind == "favorite":
        ann.set_favorite(_field(op, "value", (bool,)))
    elif kind == "rate":
        value = _field(op, "value", (int, float))
        if not 1 <= value <= 5:
            raise BadOpError("'value' must be 1 to 5")
        ann.rate(value, scale="stars5", author=author)
    elif kind == "group":
        try:
            ann.set_group(_opt_str(op, "value"))
        except ValueError as exc:
            raise BadOpError(str(exc)) from exc
    elif kind == "note_add":
        text = _field(op, "text", (str,))
        if not text.strip():
            raise BadOpError("'text' must not be empty")
        ann.add_note(text, author=author)
    elif kind == "event_add":
        t1 = op.get("t1")
        env = op.get("env")
        if t1 is not None:
            t1 = _field(op, "t1", (int, float))
        if env is not None:
            env = _field(op, "env", (int,))
        ann.add_event(
            _field(op, "type", (str,)),
            t0=_field(op, "t0", (int, float)),
            t1=t1,
            label=_field(op, "label", (str,)) if "label" in op else "",
            env=env,
            author=author,
        )
    elif kind == "event_update":
        changes = _event_changes(ann, op)
        ann.update_event(op["id"], **changes)
    elif kind == "remove":
        if not ann.remove(_field(op, "id", (str,))):
            raise KeyError(op["id"])
    else:
        raise BadOpError(f"unsupported op {kind!r}")


def _write_annotations(
    st: state_mod.LibraryState, name: str, op: dict[str, Any]
) -> dict[str, Any]:
    """Applies one op to a run's sidecar under its lock and saves it."""
    if op.get("op") == "group" and isinstance(op.get("value"), str):
        # A run may only join a group that exists: make it, and use the
        # spelling the library already has.
        try:
            op = {**op, "value": st.ensure_group(op["value"])}
        except state_mod.GroupError as exc:
            raise BadOpError(str(exc)) from exc
    return st.edit_annotations(name, lambda ann: apply_op(ann, op, st.author))


async def _write_request(
    request: Request,
) -> tuple[dict[str, Any] | None, Response | None]:
    """Checks a write and decodes its body.

    Returns:
        ``(body, None)`` for a good request, else ``(None, reply)``.
    """
    st = _svc(request).state
    why = security.check_write(request.headers, st.token)
    if why is not None:
        return None, error(403, why)
    if not st.writable:
        return None, error(403, "the library is read-only")
    body = await request.body()
    if len(body) > _MAX_BODY:
        return None, error(413, "request body too large")
    try:
        obj = json.loads(body)
    except ValueError:
        return None, error(400, "body must be JSON")
    if not isinstance(obj, dict):
        return None, error(400, "body must be a JSON object")
    return obj, None


async def annotate(request: Request) -> Response:
    """``POST /api/runs/<name>/annotations``."""
    st = _svc(request).state
    name = request.path_params["name"]
    obj, reply = await _write_request(request)
    if reply is not None:
        return reply
    assert obj is not None
    try:
        manifest.validate_run_name(name)
    except ValueError:
        return error(404, "no such run")
    if st.info(name) is None:
        return error(404, "no such run")
    try:
        result = await run_in_threadpool(_write_annotations, st, name, obj)
    except BadOpError as exc:
        return error(400, str(exc))
    except KeyError as exc:
        return error(404, f"no record {exc.args[0]!r}")
    except (errors.FormatError, FileNotFoundError) as exc:
        return error(409, str(exc))
    except ValueError as exc:  # the annotations module's own validation
        return error(400, str(exc))
    return JSONResponse(result, headers={"Cache-Control": "no-store"})


async def rename_run(request: Request) -> Response:
    """``POST /api/runs/<name>/rename`` with ``{"to": "<new name>"}``."""
    st = _svc(request).state
    name = request.path_params["name"]
    obj, reply = await _write_request(request)
    if reply is not None:
        return reply
    assert obj is not None
    new = obj.get("to")
    if not isinstance(new, str):
        return error(400, "to must be a string")
    try:
        manifest.validate_run_name(new)
    except ValueError as exc:
        return error(400, str(exc))
    try:
        manifest.validate_run_name(name)
    except ValueError:
        return error(404, "no such run")
    info = st.info(name)
    if info is None:
        return error(404, "no such run")
    if info.status == "recording":
        return error(409, "the run is still recording")
    if st.info(new) is not None:
        return error(409, f"a run named {new!r} already exists")
    try:
        await run_in_threadpool(st.rename_run, name, new)
    except FileNotFoundError:
        return error(404, "no such run")
    except FileExistsError:
        return error(409, f"a run named {new!r} already exists")
    except (ValueError, errors.FormatError, OSError) as exc:
        return error(409, str(exc))
    return JSONResponse({"name": new}, headers={"Cache-Control": "no-store"})


def groups(request: Request) -> Response:
    """``GET /api/groups``."""
    return JSONResponse(
        _svc(request).state.groups_view(),
        headers={"Cache-Control": "no-store"},
    )


async def change_groups(request: Request) -> Response:
    """``POST /api/groups``."""
    st = _svc(request).state
    obj, reply = await _write_request(request)
    if reply is not None:
        return reply
    assert obj is not None
    try:
        result = await run_in_threadpool(st.change_groups, obj)
    except state_mod.GroupError as exc:
        return error(exc.status, str(exc))
    return JSONResponse(result, headers={"Cache-Control": "no-store"})


# -- export --


_RUN_LIST = re.compile(r"^[A-Za-z0-9._,-]+$")


def export_route(request: Request) -> Response:
    """``GET /api/export?runs=&layout=&arrange=&ui=&envs=``: a download."""
    st = _svc(request).state
    q = request.query_params
    raw = q.get("runs", "")
    if not raw or not _RUN_LIST.match(raw):
        return error(400, "runs must list run names")
    names = raw.split(",")
    try:
        for name in names:
            manifest.validate_run_name(name)
    except ValueError as exc:
        return error(400, str(exc))
    if len(set(names)) != len(names):
        return error(400, "duplicate run names")
    if any(st.info(n) is None for n in names):
        return error(404, "no such run")
    layout = q.get("layout") or ("single" if len(names) == 1 else "grid")
    if layout not in ("single", "grid", "compare"):
        return error(400, "layout must be single, grid or compare")
    arrange = q.get("arrange") or None
    if arrange is not None and arrange not in export.ARRANGEMENTS:
        return error(400, "arrange must be side, stack or grid")
    if layout != "compare":
        arrange = None  # only a compare page has an arrangement
    ui = q.get("ui", "lean")
    if ui not in ("lean", "full"):
        return error(400, "ui must be lean or full")
    envs = None
    if q.get("envs"):
        try:
            envs = [_int(e, "envs") for e in q["envs"].split(",") if e]
        except ValueError as exc:
            return error(400, str(exc))
    kwargs: dict[str, Any] = {}
    supported = inspect.signature(export.export_html).parameters
    for key, value, default in (("ui", ui, "lean"), ("envs", envs, None)):
        if key in supported:
            kwargs[key] = value
        elif value != default:
            return error(501, f"export option {key!r} is not available yet")
    with tempfile.TemporaryDirectory(prefix="simscope-export-") as tmp:
        out = pathlib.Path(tmp) / "export.html"
        try:
            export.export_html(
                st.root,
                names,
                out,
                layout=layout,
                arrange=arrange,
                **kwargs,
            )
        except ValueError as exc:  # still recording, bad layout for the runs
            return error(400, str(exc))
        except FileNotFoundError as exc:
            return error(404, str(exc))
        data = out.read_bytes()
    filename = f"{names[0]}.html" if len(names) == 1 else "simscope-export.html"
    return Response(
        data,
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


# -- page and assets --


def index(request: Request) -> Response:
    """``GET /``: the app page with its boot block."""
    st = _svc(request).state
    page = static.index_page(
        token=st.token, library=st.name, writable=st.writable
    )
    return Response(
        page,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )


def asset(request: Request) -> Response:
    """``GET /assets/<name>``: a built bundle from ``simscope/_assets``."""
    name = request.path_params["name"]
    media = static.ASSET_TYPES.get(name)
    path = static.ASSETS_DIR / name
    if media is None or not path.is_file():
        return error(404, "not found")
    return file_response(request, path, media_type=media)
