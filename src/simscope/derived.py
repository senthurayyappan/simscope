"""Derived data: files computed once per run and cached (contracts 5).

Everything here is "just more files in the existing formats", so the browser
reads it through the same path-addressed ``Source`` as the recording itself:

* ``root_pose.blk``: the followed body of every env, ``[E, 1, 7]`` ``q16d``
  blocks in the normal block format, for runs with more than
  :data:`CROWD_ENVS` envs. It is what the crowd tier draws.
* ``summaries.json``: one number per env for each of a few columns, which
  sorts the env picker.
* ``envelopes/<stream>.json``: the p5, p50 and p95 of a scalar or vector
  stream across envs, per frame.
* ``highlights.json``: the named moments of :mod:`simscope.highlights`
  (landings, jumps, falls, spikes); ``n_highlights`` counts them per env.

Files live in ``.simscope/derived/<run id>/`` next to a ``stamp.json`` that
holds the digest of the run's manifest: when the manifest changes, every
derived file of the run is discarded. Nothing is computed for a run that is
still recording.

Every pass reads one window at a time, and only the components it needs: a
block stores its components as separate byte planes, so the root body is
inflated from a 140-float item and unshuffled as 7 floats. A 4,096-env,
1,000-frame, 20-body run never holds more than one window of one body.
"""

import concurrent.futures
import hashlib
import json
import logging
import math
import os
import pathlib
import shutil
import tempfile
import threading
from collections.abc import Callable
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import core, highlights, library
from simscope.io import blockfile, cas, codecs, manifest

logger = logging.getLogger(__name__)

VERSION = 3
"""Bump to discard every cached derived file.

2: highlights are ``simscope-highlights/2`` (viewer v3.1).
3: detector simscope/2.1, a fall is a body that stayed down."""
CROWD_ENVS = 64
"""Runs with more envs than this get a ``root_pose.blk``."""
ROOT_POSE = "root_pose.blk"
SUMMARIES = "summaries.json"
HIGHLIGHTS = "highlights.json"
ENVELOPES = "envelopes/"
STAMP = "stamp.json"
_ROOT_STATS = "_root_stats.json"
_ENVELOPE_PERCENTILES = (5, 50, 95)
_WINDOW_BYTES = 64 << 20
"""Most decoded bytes of one envelope window read at a time."""
_CONTACT_BYTES = 32 << 20
"""Most decoded bytes of one contacts chunk read at a time."""
_SIG_DIGITS = 7

_locks: dict[pathlib.Path, threading.Lock] = {}
_locks_guard = threading.Lock()


# -- locations and validity --


def cache_root(lib_root: pathlib.Path) -> pathlib.Path:
    """Returns the folder that holds every run's derived cache.

    That is ``<library>/.simscope/derived``, or a per-library folder under
    the system temp directory when the library is read-only.

    Args:
        lib_root: The library folder.

    Returns:
        The cache folder (not necessarily created yet).
    """
    home = pathlib.Path(lib_root) / ".simscope"
    parent = home if home.exists() else pathlib.Path(lib_root)
    if os.access(parent, os.W_OK):
        return home / "derived"
    digest = hashlib.sha1(
        os.path.realpath(lib_root).encode(), usedforsecurity=False
    ).hexdigest()[:12]
    return pathlib.Path(tempfile.gettempdir()) / "simscope-derived" / digest


def cache_dir(lib_root: pathlib.Path, rollout: library.Rollout) -> pathlib.Path:
    """Returns the cache folder of one run, keyed by the run's ULID.

    Args:
        lib_root: The library folder.
        rollout: The run.

    Returns:
        ``.simscope/derived/<run id>`` (created on first write).
    """
    return cache_root(lib_root) / rollout.manifest.id


def manifest_digest(rollout: library.Rollout) -> str:
    """Hashes the run's manifest file, which is what invalidates the cache.

    Args:
        rollout: The run.

    Returns:
        A hex digest, or ``"missing"`` if the manifest cannot be read.
    """
    for name in (manifest.MANIFEST_NAME, manifest.PARTIAL_NAME):
        try:
            data = (rollout.path / name).read_bytes()
        except OSError:
            continue
        return hashlib.sha1(data, usedforsecurity=False).hexdigest()
    return "missing"


def _lock_for(cache: pathlib.Path) -> threading.Lock:
    """Returns the lock that serializes work on one cache folder."""
    with _locks_guard:
        return _locks.setdefault(cache, threading.Lock())


def _stamp_ok(rollout: library.Rollout, cache: pathlib.Path) -> bool:
    """Tells whether the cache folder was made for this manifest."""
    try:
        stamp = json.loads((cache / STAMP).read_bytes())
    except (OSError, ValueError):
        return False
    return stamp == {"version": VERSION, "manifest": manifest_digest(rollout)}


def _reset(rollout: library.Rollout, cache: pathlib.Path) -> None:
    """Discards the cache folder's files and stamps it for this manifest."""
    if cache.exists():
        for child in cache.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                child.unlink(missing_ok=True)
    stamp = {"version": VERSION, "manifest": manifest_digest(rollout)}
    cas.atomic_write(cache / STAMP, _dumps(stamp))


def _dumps(obj: Any) -> bytes:
    """Serializes compact JSON."""
    return json.dumps(obj, separators=(",", ":"), allow_nan=False).encode()


def envelope_name(stream: str) -> str:
    """Returns the derived file name of a stream's envelope."""
    return f"{ENVELOPES}{stream}.json"


def applicable(rollout: library.Rollout, what: str) -> bool:
    """Tells whether a derived file exists for this run at all.

    Args:
        rollout: The run.
        what: A path relative to ``derived/<run>/``: ``root_pose.blk``,
            ``summaries.json``, ``highlights.json`` or
            ``envelopes/<stream>.json``.

    Returns:
        False for a run that is still recording, for a root stream when
        there are at most :data:`CROWD_ENVS` envs, for an envelope of a
        stream that is not scalar or vector (or of a single env), for
        highlights when :mod:`simscope.highlights` is not available, and for
        anything else that is not derived data.
    """
    m = rollout.manifest
    if m.status != "complete":
        return False
    if what == ROOT_POSE:
        return m.n_envs > CROWD_ENVS
    if what == SUMMARIES:
        return True
    if what == HIGHLIGHTS:
        return True
    if what.startswith(ENVELOPES) and what.endswith(".json"):
        info = m.streams.get(what[len(ENVELOPES) : -len(".json")])
        return (
            info is not None
            and info.kind in ("scalar", "vector")
            and m.n_envs > 1
        )
    return False


def fresh(
    rollout: library.Rollout, cache: pathlib.Path, what: str
) -> pathlib.Path | None:
    """Returns the cached file if it is up to date, without computing.

    Args:
        rollout: The run.
        cache: The run's cache folder.
        what: See :func:`applicable`.

    Returns:
        The file path, or ``None`` if it must be computed first.
    """
    path = cache / what
    if path.is_file() and _stamp_ok(rollout, cache):
        return path
    return None


def highlight_count(cache: pathlib.Path) -> int | None:
    """Counts the highlights in a run's cached file, if it has one.

    Args:
        cache: The run's cache folder.

    Returns:
        The count, or ``None`` if nothing is cached.
    """
    try:
        doc = json.loads((cache / HIGHLIGHTS).read_bytes())
        return len(doc["highlights"])
    except (OSError, ValueError, KeyError, TypeError):
        return None


def ensure(
    rollout: library.Rollout, cache: pathlib.Path, what: str
) -> pathlib.Path | None:
    """Computes a derived file if it is missing or stale, and returns it.

    Blocks until the file exists; the server runs it in a worker thread.
    Two callers asking for the same run wait for each other, so a pass runs
    once. The file is written atomically.

    Args:
        rollout: The run (complete).
        cache: The run's cache folder, from :func:`cache_dir`.
        what: See :func:`applicable`.

    Returns:
        The file path, or ``None`` if :func:`applicable` is false.

    Raises:
        errors.FormatError: If the run's data is corrupt.
        OSError: If the cache cannot be written.
    """
    if not applicable(rollout, what):
        return None
    with _lock_for(cache):
        if not _stamp_ok(rollout, cache):
            _reset(rollout, cache)
        path = cache / what
        if path.is_file():
            return path
        if what == ROOT_POSE:
            _root_pass(rollout, cache)
        elif what == SUMMARIES:
            _write_json(path, _summaries(rollout, cache))
        elif what == HIGHLIGHTS:
            return _highlights(rollout, cache)
        else:
            stream = what[len(ENVELOPES) : -len(".json")]
            _write_json(path, _envelope(rollout, stream))
        return path


def _write_json(path: pathlib.Path, obj: Any) -> None:
    """Writes a JSON file atomically, creating its folder."""
    cas.atomic_write(path, _dumps(obj))


# -- reading a stream by component --


def _threads() -> int:
    """Threads one pass may use for inflating and encoding blocks."""
    return max(1, min(4, os.cpu_count() or 1))


def _renormalize(x: npt.NDArray[np.float32]) -> None:
    """Renormalizes the quaternion of each ``[..., 7]`` pose in place."""
    q = x[..., 3:]
    norm = np.sqrt(np.sum(q * q, axis=-1, keepdims=True))
    np.divide(q, norm, out=q, where=norm > 0)


class _Source:
    """A complete stream, read window by window and component by component."""

    def __init__(self, rollout: library.Rollout, name: str) -> None:
        info = rollout.manifest.streams[name]
        self.path = rollout.path / info.file
        self.kind = info.kind
        self.reader = rollout.stream(name)
        self.n_envs = self.reader.n_envs
        self.n_frames = self.reader.n_frames
        self.block_frames = self.reader.block_frames
        self.k = math.prod(self.reader.item_shape)
        self.n_windows = -(-self.n_frames // self.block_frames)
        self._dir = self.reader.directory

    def window(
        self,
        w: int,
        c0: int,
        c1: int,
        pool: concurrent.futures.Executor,
        envs: tuple[int, int] | None = None,
    ) -> npt.NDArray[np.float32]:
        """Reads components ``c0 <= c < c1`` of one window.

        Args:
            w: Window index.
            c0: First component.
            c1: One past the last component.
            pool: Executor that inflates blocks in parallel.
            envs: ``(first, stop)`` env range; all envs by default.

        Returns:
            A float32 array ``[n, envs, c1 - c0]``.
        """
        e0, e1 = envs or (0, self.n_envs)
        t0 = w * self.block_frames
        n = min(self.block_frames, self.n_frames - t0)
        out = np.empty((n, e1 - e0, c1 - c0), np.float32)
        d = self._dir
        pose = self.kind == "pose" and c0 % 7 == 0 and c1 % 7 == 0
        fd = os.open(self.path, os.O_RDONLY)
        try:

            def run(lo: int, hi: int) -> None:
                for env in range(lo, hi):
                    ent = d[w * self.n_envs + env]
                    payload = os.pread(
                        fd, int(ent["clen"]), int(ent["offset"]) + 32
                    )
                    codec = int(ent["codec"])
                    x = codecs.decode_components(
                        payload, codec, n, self.k, slice(c0, c1)
                    )
                    if pose and codec == codecs.CODEC_Q16D:
                        _renormalize(x.reshape(n, -1, 7))
                    out[:, env - e0] = x

            _fan_out(pool, e0, e1, run)
        finally:
            os.close(fd)
        return out


def _fan_out(
    pool: concurrent.futures.Executor,
    lo: int,
    hi: int,
    fn: Callable[[int, int], None],
) -> None:
    """Runs ``fn(a, b)`` over chunks of ``range(lo, hi)`` on the pool."""
    step = max(1, -(-(hi - lo) // (4 * _threads())))
    futures = [
        pool.submit(fn, a, min(a + step, hi)) for a in range(lo, hi, step)
    ]
    for f in futures:
        f.result()


# -- number formatting --


def _sig_list(a: npt.ArrayLike) -> list[Any]:
    """Rounds floats to 7 significant digits and lists them for JSON.

    Short literals keep derived files small. Non-finite values become
    ``None`` (``null``).

    Args:
        a: Any-shaped array.

    Returns:
        Nested lists of the same shape.
    """
    x = np.asarray(a, np.float64)
    finite = np.isfinite(x)
    out = np.zeros_like(x)
    v = x[finite]
    with np.errstate(divide="ignore"):
        mag = np.floor(np.log10(np.abs(v)))
    mag = np.where(np.isfinite(mag), mag, 0.0)
    p = mag - (_SIG_DIGITS - 1)  # decimal exponent of the last kept digit
    small = p < 0
    scale = 10.0 ** np.clip(np.abs(p), 0, 300)
    rounded = np.where(
        small, np.rint(v * scale) / scale, np.rint(v / scale) * scale
    )
    out[finite] = np.where(np.abs(p) > 22, v, rounded)
    if finite.all():
        return out.tolist()
    obj = out.astype(object)
    obj[~finite] = None
    return obj.tolist()


# -- root pose and its statistics --


def root_body(scene: core.Scene) -> int:
    """Picks the followed body (see :func:`simscope.highlights.root_body`).

    Args:
        scene: The run's scene.

    Returns:
        A body index (never the world body when another exists).
    """
    return highlights.root_body(scene)


def _root_pass(rollout: library.Rollout, cache: pathlib.Path) -> None:
    """Reads ``body_pose`` once for the root body's stream and statistics.

    Writes ``root_pose.blk`` when the run has more than :data:`CROWD_ENVS`
    envs, and ``_root_stats.json`` (minimum height and peak speed per env)
    always, so ``summaries.json`` does not read the poses again.
    """
    src = _Source(rollout, manifest.BODY_POSE)
    body = root_body(rollout.scene)
    n_envs, bf, dt = src.n_envs, src.block_frames, rollout.dt
    write = n_envs > CROWD_ENVS
    min_z = np.full(n_envs, np.inf)
    peak = np.zeros(n_envs)
    prev: npt.NDArray[np.float32] | None = None
    tmp = cache / (ROOT_POSE + ".part")
    cache.mkdir(parents=True, exist_ok=True)
    writer = (
        blockfile.BlockWriter(
            tmp,
            item_shape=(1, core.POSE_DIM),
            n_envs=n_envs,
            kind="pose",
            codec="q16d",
            block_frames=bf,
        )
        if write
        else None
    )
    try:
        with concurrent.futures.ThreadPoolExecutor(_threads()) as pool:
            for w in range(src.n_windows):
                r = src.window(w, 7 * body, 7 * body + 7, pool)  # [n, E, 7]
                pos = r[..., :3]
                np.minimum(min_z, pos[..., 2].min(axis=0), out=min_z)
                seq = pos if prev is None else np.concatenate([prev, pos])
                if len(seq) > 1:
                    speed = np.linalg.norm(np.diff(seq, axis=0), axis=-1) / dt
                    np.maximum(peak, speed.max(axis=0), out=peak)
                prev = pos[-1:]
                if writer is not None:
                    writer.write_encoded(w * bf, _encode_window(r, pool))
        if writer is not None:
            writer.finalize()
            os.replace(tmp, cache / ROOT_POSE)
    except BaseException:
        if writer is not None:
            writer.close()
        tmp.unlink(missing_ok=True)
        raise
    has_frames = src.n_frames > 0
    _write_json(
        cache / _ROOT_STATS,
        {
            "min_height": _sig_list(min_z) if has_frames else None,
            "peak_speed": _sig_list(peak) if has_frames else None,
        },
    )


def _encode_window(
    r: npt.NDArray[np.float32], pool: concurrent.futures.Executor
) -> list[blockfile.EncodedBlock]:
    """Encodes a ``[n, E, 7]`` root window as one ``q16d`` block per env."""
    n, n_envs, k = r.shape
    per_env = np.ascontiguousarray(r.transpose(1, 0, 2))
    blocks: list[blockfile.EncodedBlock | None] = [None] * n_envs

    def run(lo: int, hi: int) -> None:
        for env in range(lo, hi):
            cid, payload = codecs.encode_block_auto(per_env[env], "q16d")
            blocks[env] = blockfile.EncodedBlock(
                env, n, cid, codecs.payload_ulen(cid, n, k), payload
            )

    _fan_out(pool, 0, n_envs, run)
    return [b for b in blocks if b is not None]


def _root_stats(
    rollout: library.Rollout, cache: pathlib.Path
) -> dict[str, list[float] | None]:
    """Returns the cached root statistics, computing them on first use."""
    path = cache / _ROOT_STATS
    if not path.is_file():
        _root_pass(rollout, cache)
    return json.loads(path.read_bytes())


# -- summaries --


def _summaries(rollout: library.Rollout, cache: pathlib.Path) -> dict[str, Any]:
    """Builds ``summaries.json``: per-env columns for the env picker."""
    m = rollout.manifest
    stats = _root_stats(rollout, cache)
    columns: list[dict[str, str]] = []
    values: dict[str, Any] = {}

    def add(key: str, label: str, unit: str, better: str, v: Any) -> None:
        columns.append(
            {"key": key, "label": label, "unit": unit, "better": better}
        )
        values[key] = v

    reward = m.streams.get("reward")
    if reward is not None and reward.kind == "scalar":
        add("return", "Return", "", "high", _sig_list(_total(rollout)))
    if stats["min_height"] is not None:
        add("min_height", "Min height", "m", "high", stats["min_height"])
        add("peak_speed", "Peak speed", "m/s", "high", stats["peak_speed"])
    contacts = m.streams.get("contacts")
    if contacts is not None and contacts.kind == "arrows":
        add(
            "peak_contact_force",
            "Peak contact force",
            "N",
            "low",
            _sig_list(_peak_contact(rollout)),
        )
    counts = _highlight_counts(rollout, cache)
    if counts is not None:
        add("n_highlights", "Highlights", "", "low", counts)
    return {"columns": columns, "values": values}


def _total(rollout: library.Rollout) -> npt.NDArray[np.float64]:
    """Sums the ``reward`` stream over time, per env."""
    src = _Source(rollout, "reward")
    total = np.zeros(src.n_envs)
    with concurrent.futures.ThreadPoolExecutor(_threads()) as pool:
        for w in range(src.n_windows):
            total += src.window(w, 0, 1, pool).sum(axis=0, dtype=np.float64)[
                :, 0
            ]
    return total


def _peak_contact(rollout: library.Rollout) -> npt.NDArray[np.float64]:
    """Finds the largest contact force magnitude per env, over time."""
    src = _Source(rollout, "contacts")
    peak = np.zeros(src.n_envs)
    chunk = max(1, _CONTACT_BYTES // (src.block_frames * src.k * 4))
    with concurrent.futures.ThreadPoolExecutor(_threads()) as pool:
        for w in range(src.n_windows):
            for e0 in range(0, src.n_envs, chunk):
                e1 = min(e0 + chunk, src.n_envs)
                a = src.window(w, 0, src.k, pool, (e0, e1))
                force = a.reshape(len(a), e1 - e0, -1, 6)[..., 3:]
                mag = np.sqrt(np.sum(force * force, axis=-1, dtype=np.float64))
                np.maximum(peak[e0:e1], mag.max(axis=(0, 2)), out=peak[e0:e1])
    return peak


def _highlight_counts(
    rollout: library.Rollout, cache: pathlib.Path
) -> list[int] | None:
    """Counts highlights per env, or ``None`` if there are none to count."""
    if not applicable(rollout, HIGHLIGHTS):
        return None
    try:
        doc = _highlights_doc(rollout, cache)
    except Exception:
        logger.exception("highlights for %s failed", rollout.name)
        return None
    envs = np.array([h["env"] for h in doc["highlights"]], np.int64)
    n_envs = rollout.manifest.n_envs
    envs = envs[(envs >= 0) & (envs < n_envs)]
    return np.bincount(envs, minlength=n_envs).tolist()


# -- envelopes --


def _envelope(rollout: library.Rollout, stream: str) -> dict[str, Any]:
    """Computes p5, p50 and p95 across envs for every frame and component."""
    src = _Source(rollout, stream)
    t_total, n_envs, k = src.n_frames, src.n_envs, src.k
    bf = src.block_frames
    group = max(1, min(k, _WINDOW_BYTES // (bf * n_envs * 4)))
    out = np.empty((3, t_total, k), np.float32)
    with concurrent.futures.ThreadPoolExecutor(_threads()) as pool:
        for c0 in range(0, k, group):
            c1 = min(c0 + group, k)
            for w in range(src.n_windows):
                win = src.window(w, c0, c1, pool)  # [n, E, c]
                t0 = w * bf
                # Envs last so each percentile reads a contiguous row.
                flat = np.ascontiguousarray(win.transpose(0, 2, 1))
                pct = np.percentile(flat, _ENVELOPE_PERCENTILES, axis=-1)
                out[:, t0 : t0 + len(win), c0:c1] = pct
    by_component = out.transpose(0, 2, 1)  # [3, K, T]
    return {
        "dt": rollout.dt,
        "t0": 0,
        "components": k,
        "p5": _sig_list(by_component[0]),
        "p50": _sig_list(by_component[1]),
        "p95": _sig_list(by_component[2]),
    }


# -- highlights --


def _highlights_doc(
    rollout: library.Rollout, cache: pathlib.Path
) -> dict[str, Any]:
    """Loads or computes the highlights document of a run."""
    doc = highlights.load_or_compute(rollout, cache)
    path = cache / HIGHLIGHTS
    if not path.is_file():
        _write_json(path, doc)
    return doc


def _highlights(
    rollout: library.Rollout, cache: pathlib.Path
) -> pathlib.Path | None:
    """Produces ``highlights.json`` in the cache and returns its path."""
    _highlights_doc(rollout, cache)
    return cache / HIGHLIGHTS
