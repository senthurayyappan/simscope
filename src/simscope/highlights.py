"""Automatic highlights: the moments where a rollout's physics peaks.

A highlight is a marker on the timeline. Two kinds are built in, both
computed from signals every simulator provides, so they mean the same for any
robot or task (viewer v3.2 contracts 9):

``contact``
    The **net contact force**: the norm of the sum of all the force vectors
    of the ``contacts`` stream (format spec 5, viewer contracts 7). A run
    without a ``contacts`` stream gets none.
``acceleration``
    The **centre-of-mass acceleration**: the second difference of the centre
    of mass, in m/s^2. The centre of mass is the mean of the body positions
    weighted by ``Body.mass``; a scene without masses uses the plain mean of
    the bodies other than the world. A robot standing still reads about 0,
    free fall reads about 9.8, and an impact or a push-off is a peak.

A signal is scored per env by a robust z-score ``(x - median) / max(1.4826 *
MAD, floor)``. The floor keeps flat and intermittent signals from exploding
(see ``SPREAD_FLOOR``). A highlight is a local maximum within +-0.25 s whose
score is above 6. The top 10 per env and kind are kept, and the top 50 per
kind across envs; markers of one kind within 0.15 s merge. ``ratio`` says
how many times the run's typical peak the value is.

Nothing else is built in: there are no task words such as "jump" or "fall"
here. To mark something that is specific to your robot, register your own
kind with :func:`register`, or add explicit events with
``Annotations.add_event`` (see "Custom markers" in the getting-started
guide).

Everything is vectorized over ``[T, E]`` and reads the run one window at a
time, decoding env chunks on threads, so 1,000 frames of 4,096 envs take a
few seconds and a single 400-frame run takes milliseconds. Teleports (env
resets) are masked out.

Example:
    >>> from simscope import highlights
    >>> doc = highlights.load_or_compute(rollout, cache_dir)
    >>> [(h["t"], h["kind"]) for h in doc["highlights"]]
"""

import concurrent.futures
import dataclasses
import json
import logging
import math
import os
import pathlib
import re
from collections.abc import Callable, Sequence
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import core, library
from simscope.io import blockfile, cas, codecs

logger = logging.getLogger(__name__)

DETECTOR_VERSION = "simscope/3"
"""Version of the built-in detectors; a change invalidates cached results."""

FORMAT = "simscope-highlights/2"
FILE_NAME = "highlights.json"
KEY_NAME = "highlights.key"

CONTACT = "contact"
ACCELERATION = "acceleration"

_LABELS = {CONTACT: "Contact force", ACCELERATION: "Acceleration"}

CONTACTS_STREAM = "contacts"
ROOT_NAMES = ("torso", "base", "trunk", "pelvis", "chassis")

GRAVITY = 9.81
"""Standard gravity in m/s^2, for the ``g`` of a detail."""

MERGE_S = 0.15
"""Markers of one kind closer than this merge into one."""
PER_ENV = 10
"""Most highlights per env and kind."""
PER_KIND = 50
"""Most highlights per kind across envs."""

Z_THRESHOLD = 6.0
"""Least robust z-score of a highlight."""
WINDOW_S = 0.25
"""A highlight is the largest score within this many seconds."""
MAD_SIGMA = 1.4826
"""Scales the median absolute deviation to a standard deviation."""
REL_FLOOR = 0.05
"""Scale floor as a fraction of the median, so a steady load is not flat."""
SPREAD_FLOOR = 0.25
"""Scale floor as a fraction of the signal's usual peak excursion.

A gait's contact force is zero half the time, so its MAD is near zero and
every stride would score as an outlier. The usual peak is the ``k``-th
largest value, ``k = max(TOP_MIN, TOP_FRACTION * T)``; a highlight has to
beat it by 50 %."""
TOP_FRACTION = 0.05
TOP_MIN = 3
CONTACT_FLOOR = 1.0
"""Scale floor of the net contact force, in newtons."""
ACCEL_FLOOR = 0.5
"""Scale floor of the acceleration, in m/s^2 (q16d noise is about 0.04)."""
TELEPORT_SPEED = 20.0
"""A centre-of-mass step faster than this (m/s) is a reset, not motion."""
MIN_FRAMES = 8
"""Fewest frames a signal needs for a typical level to mean anything."""

KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
"""What a custom kind's key looks like: lower case, digits and ``_``."""
COLOR_PATTERN = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
"""What a custom kind's colour looks like: ``#rgb`` or ``#rrggbb``."""
MAX_LABEL = 40
"""Longest label of a custom kind, in characters."""

_CANDIDATE_CHUNK = 1 << 18
_MAX_WORKERS = 3
_WIDE = 64  # floats per env-frame above which threads pay off
_ENV_CHUNK = 256


@dataclasses.dataclass(frozen=True)
class Highlight:
    """One marker on the timeline (viewer contracts 9.3).

    Attributes:
        t: Time in seconds (the start, for a span).
        frame: Frame index.
        env: Env index.
        kind: Key of the kind of marker, such as ``"contact"``.
        score: Number that ranks the marker within its kind (higher is more
            notable). The built-in kinds use the robust z-score.
        value: The headline measurement, in the unit of the kind: newtons of
            ``contact``, m/s^2 of ``acceleration``.
        body: Body index the marker belongs to, or ``None``.
        label: Name shown for this marker; the kind's label if left empty.
        detail: One short phrase with the numbers behind the marker, with
            units, such as ``"412 N, 5.1 times typical"``.
        t1: End of a span in seconds, or ``None`` for a moment.
        frame1: End frame of a span, or ``None``.
        ratio: How many times the typical level the value is, or ``None``.
        also: Keys of other kinds that were merged into this marker.
    """

    t: float
    frame: int
    env: int
    kind: str
    score: float
    value: float
    body: int | None = None
    label: str = ""
    detail: str = ""
    t1: float | None = None
    frame1: int | None = None
    ratio: float | None = None
    also: tuple[str, ...] = ()


Detector = Callable[[library.Rollout], list[Highlight]]
"""A custom detector: returns highlights whose ``kind`` is its key."""


@dataclasses.dataclass(frozen=True)
class _Kind:
    """A registered kind of highlight."""

    key: str
    label: str
    color: str | None
    detector: Detector | None  # None: built in, produced by a pass


_REGISTRY: dict[str, _Kind] = {}


def register(
    key: str,
    detector: Detector,
    *,
    label: str,
    color: str | None = None,
) -> None:
    """Adds your own kind of marker to the ones :func:`detect` runs.

    The detector runs once per run, in the background, and its markers are
    cached with the built-in ones. Adding or changing a detector refreshes
    the cache. A detector that raises, or returns something invalid, is
    logged and skipped; the other kinds still work.

    Args:
        key: Name of the kind: a lower case letter, then lower case letters,
            digits and ``_``, at most 32 characters. It must be new (see
            :func:`unregister`).
        detector: ``detector(rollout)`` returns a list of :class:`Highlight`
            whose ``kind`` equals ``key``. Each has a ``t`` in seconds, a
            ``frame`` inside the run, and an ``env`` of the run. A span also
            sets ``t1`` and ``frame1``. It is called once for the whole run;
            ``detect`` keeps the envs it was asked for.
        label: Display name of the kind (at most 40 characters), used for
            highlights that have no label of their own.
        color: A CSS hex colour for the marker, such as ``"#d9480f"``, or
            ``None`` for the viewer's default.

    Raises:
        ValueError: If the key, label or colour is invalid, or the key is
            already registered.
    """
    if not isinstance(key, str) or not KEY_PATTERN.match(key):
        raise ValueError(
            f"kind key {key!r} must be lower case letters, digits and _, "
            "start with a letter, and have at most 32 characters"
        )
    if key in _REGISTRY:
        raise ValueError(f"kind {key!r} is already registered")
    if not 1 <= len(label) <= MAX_LABEL:
        raise ValueError(f"label must have 1 to {MAX_LABEL} characters")
    if color is not None and not (
        isinstance(color, str) and COLOR_PATTERN.match(color)
    ):
        raise ValueError(f"color {color!r} must be a hex colour like #d9480f")
    _REGISTRY[key] = _Kind(key, label, color, detector)


def unregister(key: str) -> None:
    """Removes a kind, built-in or registered.

    Args:
        key: Kind key.

    Raises:
        KeyError: If no such kind is registered.
    """
    del _REGISTRY[key]


def kinds() -> list[dict[str, str]]:
    """Lists the registered kinds as ``{key, label}`` objects.

    A custom kind that has a colour also carries ``color``.
    """
    out = []
    for kind in _REGISTRY.values():
        entry = {"key": kind.key, "label": kind.label}
        if kind.detector is not None and kind.color is not None:
            entry["color"] = kind.color
        out.append(entry)
    return out


def root_body(names: Sequence[str] | core.Scene) -> int:
    """Picks the followed (root) body of a scene.

    That is the first of :data:`ROOT_NAMES` (exact names first, then
    prefixes), else the first body that is not the world. The derived
    root-pose stream and the player's follow camera use this same rule
    (``FOLLOW_ALIASES`` in ``web/src/core/player.js``).

    Args:
        names: Body names in scene order, or the scene itself.

    Returns:
        A body index.
    """
    if isinstance(names, core.Scene):
        names = [b.name for b in names.bodies]
    names = [n.lower() for n in names]
    for test in (str.__eq__, str.startswith):
        for wanted in ROOT_NAMES:
            for i, name in enumerate(names):
                if test(name, wanted):
                    return i
    for i, name in enumerate(names):
        if name != "world":
            return i
    return 0


# -- reading ---------------------------------------------------------------

Reducer = Callable[[npt.NDArray[np.float32], int], npt.NDArray[np.float32]]
"""Maps a window ``[t, e, c]`` of envs starting at ``lo`` to ``[t, e, ...]``."""


def _scan(
    run: library.Rollout,
    name: str,
    envs: npt.NDArray[np.intp],
    comps: Sequence[int],
    reduce: Reducer,
) -> npt.NDArray[np.float32]:
    """Reduces a stream window by window, decoding env chunks on threads.

    Args:
        run: A finished run.
        name: Stream name.
        envs: Env indices to read.
        comps: Components (flattened item indices) to decode.
        reduce: Maps a window ``[t, e, len(comps)]`` and the index of its
            first env within ``envs`` to ``[t, e, *rest]``. It runs on
            worker threads and must not keep the window.

    Returns:
        ``[n_frames, len(envs), *rest]``.
    """
    reader = run.stream(name)
    k = math.prod(reader.item_shape)
    cols = np.asarray(comps, np.intp)
    n_frames, bf, n_envs = reader.n_frames, reader.block_frames, reader.n_envs
    n_windows = -(-n_frames // bf)
    table = reader.directory
    offsets = table["offset"].astype(np.int64) + blockfile.BLOCK_HEADER.size
    lengths = table["clen"].astype(np.int64)
    codec_ids = table["codec"].astype(np.int64)
    chunks = [envs[i : i + _ENV_CHUNK] for i in range(0, len(envs), _ENV_CHUNK)]
    out: npt.NDArray[np.float32] | None = None
    fd = os.open(run.path / run.manifest.streams[name].file, os.O_RDONLY)

    def job(at: tuple[int, int]) -> None:
        nonlocal out
        w, c = at
        t0 = w * bf
        n = min(bf, n_frames - t0)
        window = np.empty((n, len(chunks[c]), len(cols)), np.float32)
        for j, env in enumerate(chunks[c].tolist()):
            i = w * n_envs + env
            payload = os.pread(fd, int(lengths[i]), int(offsets[i]))
            window[:, j] = codecs.decode_components(
                payload, int(codec_ids[i]), n, k, cols
            )
        lo = c * _ENV_CHUNK
        part = reduce(window, lo)
        if out is None:  # the first job runs alone, before the threads
            out = np.empty((n_frames, len(envs), *part.shape[2:]), np.float32)
        out[t0 : t0 + n, lo : lo + part.shape[1]] = part

    jobs = [(w, c) for w in range(n_windows) for c in range(len(chunks))]
    try:
        if not jobs:
            return np.empty((0, len(envs)), np.float32)
        job(jobs[0])
        rest = jobs[1:]
        # Small items decode in microseconds and threads then only contend
        # for the GIL, so only wide ones (poses) get workers.
        workers = _MAX_WORKERS if k >= _WIDE else 1
        if workers == 1 or len(rest) < 4:
            for j in rest:
                job(j)
        else:
            with concurrent.futures.ThreadPoolExecutor(workers) as pool:
                for f in [pool.submit(job, j) for j in rest]:
                    f.result()
    finally:
        os.close(fd)
    assert out is not None
    return out


def _net_force(
    window: npt.NDArray[np.float32], _lo: int
) -> npt.NDArray[np.float32]:
    """Norm of the sum of the K force vectors, ``[t, e, 3K] -> [t, e]``."""
    total = window.reshape(*window.shape[:2], -1, 3).sum(axis=2)
    return np.sqrt(np.einsum("...i,...i->...", total, total))


def _weighted_mean(
    window: npt.NDArray[np.float32],
    _lo: int,
    weights: npt.NDArray[np.float32],
) -> npt.NDArray[np.float32]:
    """Weighted mean of B positions, ``[t, e, 3B] -> [t, e, 3]``."""
    xyz = window.reshape(*window.shape[:2], len(weights), 3)
    return np.einsum("tebi,b->tei", xyz, weights)


class _Context:
    """Signals of one run, each read once and shared by the detectors."""

    def __init__(
        self, rollout: library.Rollout, envs: Sequence[int] | None
    ) -> None:
        self.rollout = rollout
        n = rollout.n_envs
        ids = np.arange(n) if envs is None else np.unique(np.asarray(envs, int))
        if ids.size and (ids[0] < 0 or ids[-1] >= n):
            raise IndexError(f"env index outside [0, {n})")
        self.envs = ids.astype(np.intp)
        self.dt = rollout.dt
        self.n_frames = rollout.n_frames

    def bodies(self) -> list[tuple[str, float]]:
        """Reads ``(name, mass)`` of every body of the scene."""
        run = self.rollout
        doc = json.loads(
            cas.ContentStore(run.path.parents[1]).get(
                run.manifest.scene, "scene"
            )
        )  # body names only: the full scene would load every mesh
        return [(b["name"], float(b.get("mass", 0.0))) for b in doc["bodies"]]

    def centre_of_mass(self) -> npt.NDArray[np.float32] | None:
        """Centre of mass of each env and frame, ``[T, len(envs), 3]``.

        Weighted by body mass if the scene has masses, else the plain mean
        of the bodies other than the world. ``None`` if there is no body.
        """
        bodies = self.bodies()
        masses = [m for _, m in bodies]
        if any(m > 0 for m in masses):
            used = [i for i, m in enumerate(masses) if m > 0]
            weights = np.asarray([masses[i] for i in used], np.float64)
        else:
            used = [
                i for i, (n, _) in enumerate(bodies) if n.lower() != "world"
            ]
            weights = np.ones(len(used))
        if not used:
            return None
        weights = (weights / weights.sum()).astype(np.float32)
        comps = [7 * i + c for i in used for c in range(3)]

        def reduce(
            window: npt.NDArray[np.float32], lo: int
        ) -> npt.NDArray[np.float32]:
            return _weighted_mean(window, lo, weights)

        return _scan(self.rollout, "body_pose", self.envs, comps, reduce)

    def net_contact_force(self) -> npt.NDArray[np.float32] | None:
        """Net contact force per env and frame, or ``None`` if none."""
        info = self.rollout.manifest.streams.get(CONTACTS_STREAM)
        if info is None or info.kind != "arrows":
            return None
        forces = [
            6 * i + j for i in range(info.item_shape[0]) for j in (3, 4, 5)
        ]
        return _scan(
            self.rollout, CONTACTS_STREAM, self.envs, forces, _net_force
        )


# -- scoring ---------------------------------------------------------------


def _robust_z(
    x: npt.NDArray[np.float32],
    bad: npt.NDArray[np.bool_],
    floor: float,
) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]]:
    """Robust z-scores of each env's series (columns of ``x``).

    Args:
        x: Signal, ``[T, E]``.
        bad: Frames to ignore (not finite, or teleports), ``[T, E]``.
        floor: Least scale, in the signal's unit.

    Returns:
        ``(z, typical)``. ``z`` is ``(x - median) / scale`` with ``-inf``
        where ``bad``; the scale is ``max(1.4826 * MAD, floor, 5 % of
        |median|, 25 % of the usual peak's excursion)``. ``typical`` is the
        usual peak (see ``SPREAD_FLOOR``) of each env, at least ``floor``:
        what a peak is measured against.
    """
    if bad.any():
        first = np.median(np.where(bad, 0.0, x), axis=0)
        x = np.where(bad, first, x)
    med = np.median(x, axis=0)
    mad = np.median(np.abs(x - med), axis=0)
    n = x.shape[0]
    k = min(n, max(TOP_MIN, math.ceil(TOP_FRACTION * n)))
    usual = np.partition(x, n - k, axis=0)[n - k]  # the k-th largest
    scale = np.maximum(
        MAD_SIGMA * mad,
        np.maximum(
            floor,
            np.maximum(REL_FLOOR * np.abs(med), SPREAD_FLOOR * (usual - med)),
        ),
    )
    z = (x - med) / scale.astype(np.float32)
    z[bad] = -np.inf
    typical = np.maximum(usual, floor).astype(np.float32)
    return z.astype(np.float32, copy=False), typical


def _local_maxima(
    z: npt.NDArray[np.float32], threshold: float, half: int
) -> tuple[npt.NDArray[np.intp], npt.NDArray[np.intp]]:
    """Finds frames above ``threshold`` that top their +-``half`` window.

    Among equal neighbours the earliest wins. Cost is proportional to the
    number of frames above the threshold, not to the size of ``z``.

    Returns:
        Frame and column indices of the peaks.
    """
    cand = np.argwhere(z > threshold)
    n = z.shape[0]
    offsets = np.concatenate([np.arange(-half, 0), np.arange(1, half + 1)])
    frames: list[npt.NDArray[np.intp]] = []
    cols: list[npt.NDArray[np.intp]] = []
    for i in range(0, len(cand), _CANDIDATE_CHUNK):
        t, e = cand[i : i + _CANDIDATE_CHUNK].T
        at = t[:, None] + offsets[None, :]
        valid = (at >= 0) & (at < n)
        around = np.where(valid, z[np.clip(at, 0, n - 1), e[:, None]], -np.inf)
        centre = z[t, e][:, None]
        left = offsets[None, :] < 0
        beaten = np.where(left, around >= centre, around > centre)
        keep = ~beaten.any(axis=1)
        frames.append(t[keep])
        cols.append(e[keep])
    if not frames:
        return np.empty(0, np.intp), np.empty(0, np.intp)
    return np.concatenate(frames), np.concatenate(cols)


def _peaks(
    x: npt.NDArray[np.float32],
    dt: float,
    *,
    floor: float,
    bad: npt.NDArray[np.bool_] | None = None,
) -> tuple[
    npt.NDArray[np.intp],
    npt.NDArray[np.intp],
    npt.NDArray[np.float32],
    npt.NDArray[np.float32],
]:
    """Finds the peaks of a signal ``[T, E]``.

    Args:
        x: Signal.
        dt: Seconds per frame.
        floor: Least scale of the robust z-score, in the signal's unit.
        bad: Frames to ignore (those that are not finite are added).

    Returns:
        ``(frames, columns, scores, typical)`` of the kept peaks: the top
        ``PER_ENV`` of each column, best first within a column, at most
        ``PER_KIND`` overall (as a set), and the typical level per column.
    """
    empty = np.empty(0, np.intp)
    typical = np.ones(x.shape[1], np.float32)
    if x.shape[0] < MIN_FRAMES or x.shape[1] == 0:
        return empty, empty, np.empty(0, np.float32), typical
    invalid = ~np.isfinite(x)
    if bad is not None:
        invalid |= bad
    z, typical = _robust_z(x, invalid, floor)
    half = max(1, round(WINDOW_S / dt))
    t, col = _local_maxima(z, Z_THRESHOLD, min(half, x.shape[0]))
    if not len(t):
        return empty, empty, np.empty(0, np.float32), typical
    score = z[t, col]
    order = np.lexsort((-score, col))  # by env, best first
    t, col, score = t[order], col[order], score[order]
    starts = np.flatnonzero(np.r_[True, col[1:] != col[:-1]])
    rank = np.arange(len(col)) - np.repeat(
        starts, np.diff(np.r_[starts, len(col)])
    )
    keep = rank < PER_ENV
    t, col, score = t[keep], col[keep], score[keep]
    best = np.argsort(-score, kind="stable")[:PER_KIND]
    return t[best], col[best], score[best], typical


_TIMES = chr(0xD7)  # the multiplication sign


def _times(ratio: float) -> str:
    """Formats a ratio with a multiplication sign, such as 5.1 times."""
    return f"{ratio:.1f}{_TIMES}"


# -- built-in kinds --------------------------------------------------------


def _contact(ctx: _Context) -> list[Highlight]:
    """Peaks of the net contact force."""
    force = ctx.net_contact_force()
    if force is None:
        return []
    t, col, score, typical = _peaks(force, ctx.dt, floor=CONTACT_FLOOR)
    found = []
    for i in range(len(t)):
        value = float(force[t[i], col[i]])
        ratio = value / float(typical[col[i]])
        found.append(
            Highlight(
                t=float(t[i] * ctx.dt),
                frame=int(t[i]),
                env=int(ctx.envs[col[i]]),
                kind=CONTACT,
                score=float(score[i]),
                value=value,
                label=_LABELS[CONTACT],
                detail=f"{value:.0f} N, {_times(ratio)} typical",
                ratio=ratio,
            )
        )
    return found


def _acceleration_magnitude(
    com: npt.NDArray[np.float32], dt: float
) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.bool_]]:
    """Gets the centre-of-mass acceleration from its positions.

    The 3-point stencil ``(x[t+1] - 2 x[t] + x[t-1]) / dt^2``.

    Args:
        com: Centre of mass, ``[T, E, 3]``.
        dt: Seconds per frame.

    Returns:
        ``(magnitude, bad)``, both ``[T, E]``. ``bad`` marks the two end
        frames, where there is no second difference, and the frames on
        either side of a step faster than a teleport (an env reset).
    """
    acc = np.zeros(com.shape[:2], np.float32)
    bad = np.zeros(com.shape[:2], bool)
    bad[0] = bad[-1] = True
    second = com[2:] - 2 * com[1:-1] + com[:-2]
    acc[1:-1] = np.sqrt(
        np.einsum("...i,...i->...", second, second)
    ) / np.float32(dt**2)
    step = com[1:] - com[:-1]
    jump = np.einsum("...i,...i->...", step, step) > (TELEPORT_SPEED * dt) ** 2
    bad[:-1] |= jump
    bad[1:] |= jump
    return acc, bad


def _acceleration(ctx: _Context) -> list[Highlight]:
    """Peaks of the centre-of-mass acceleration."""
    if ctx.n_frames < 3:
        return []
    com = ctx.centre_of_mass()
    if com is None or com.shape[0] < 3:
        return []
    acc, bad = _acceleration_magnitude(com, ctx.dt)
    t, col, score, typical = _peaks(acc, ctx.dt, floor=ACCEL_FLOOR, bad=bad)
    found = []
    for i in range(len(t)):
        value = float(acc[t[i], col[i]])
        found.append(
            Highlight(
                t=float(t[i] * ctx.dt),
                frame=int(t[i]),
                env=int(ctx.envs[col[i]]),
                kind=ACCELERATION,
                score=float(score[i]),
                value=value,
                label=_LABELS[ACCELERATION],
                detail=f"{value:.0f} m/s², {value / GRAVITY:.1f} g",
                ratio=value / float(typical[col[i]]),
            )
        )
    return found


_PASSES: tuple[tuple[str, Callable[[_Context], list[Highlight]]], ...] = (
    (CONTACT, _contact),
    (ACCELERATION, _acceleration),
)


def _install_builtins() -> None:
    """Registers the built-in kinds."""
    for key, label in _LABELS.items():
        _REGISTRY[key] = _Kind(key, label, None, None)


_install_builtins()


# -- caps, merging, custom results -----------------------------------------


def _cap(found: list[Highlight]) -> list[Highlight]:
    """Keeps the best ``PER_ENV`` of each env and kind, ``PER_KIND`` per kind.

    Args:
        found: Highlights of any kinds.

    Returns:
        The kept highlights, in no particular order.
    """
    best: dict[tuple[str, int], list[Highlight]] = {}
    for h in sorted(found, key=lambda h: -h.score):
        group = best.setdefault((h.kind, h.env), [])
        if len(group) < PER_ENV:
            group.append(h)
    per_kind: dict[str, list[Highlight]] = {}
    for (kind, _), group in best.items():
        per_kind.setdefault(kind, []).extend(group)
    out: list[Highlight] = []
    for group in per_kind.values():
        group.sort(key=lambda h: -h.score)
        out += group[:PER_KIND]
    return out


def _merge(found: list[Highlight]) -> list[Highlight]:
    """Merges moments of one env and kind that are within ``MERGE_S``.

    The higher score keeps the moment. Spans (markers with ``t1``) never
    merge.

    Args:
        found: Highlights of any kinds.

    Returns:
        The merged highlights.
    """
    spans = [h for h in found if h.t1 is not None]
    points = sorted(
        (h for h in found if h.t1 is None), key=lambda h: (-h.score, h.t)
    )
    kept: dict[tuple[str, int], list[Highlight]] = {}
    for h in points:
        near = kept.setdefault((h.kind, h.env), [])
        if all(abs(k.t - h.t) > MERGE_S + 1e-9 for k in near):
            near.append(h)
    return [h for group in kept.values() for h in group] + spans


def _check(
    key: str, found: object, n_frames: int, n_envs: int
) -> list[Highlight]:
    """Validates what a custom detector returned.

    Args:
        key: The detector's kind key.
        found: What it returned.
        n_frames: Frames of the run.
        n_envs: Envs of the run.

    Returns:
        The highlights, as a list.

    Raises:
        ValueError: With a message that names the detector, if the result
            is not a list of highlights of its kind with finite times and a
            frame and env inside the run.
    """
    who = f"detector {key!r}"
    if not isinstance(found, list | tuple):
        raise ValueError(
            f"{who} must return a list, got {type(found).__name__}"
        )
    for i, h in enumerate(found):
        if not isinstance(h, Highlight):
            raise ValueError(
                f"{who} returned a {type(h).__name__}, not Highlight"
            )
        where = f"{who}, highlight {i}"
        if h.kind != key:
            raise ValueError(f"{where}: kind is {h.kind!r}, not {key!r}")
        times = [h.t] if h.t1 is None else [h.t, h.t1]
        if not all(math.isfinite(x) for x in times) or h.t < 0:
            raise ValueError(f"{where}: t and t1 must be finite and >= 0")
        if h.t1 is not None and h.t1 < h.t:
            raise ValueError(f"{where}: t1 {h.t1} is before t {h.t}")
        frames = [h.frame] if h.frame1 is None else [h.frame, h.frame1]
        if not all(0 <= f < n_frames for f in frames):
            raise ValueError(
                f"{where}: frame must be in [0, {n_frames}), got {frames}"
            )
        if (h.t1 is None) != (h.frame1 is None):
            raise ValueError(f"{where}: set both t1 and frame1, or neither")
        if not 0 <= h.env < n_envs:
            raise ValueError(f"{where}: env must be in [0, {n_envs})")
        if not (math.isfinite(h.score) and math.isfinite(h.value)):
            raise ValueError(f"{where}: score and value must be finite")
    return list(found)


# -- public API ------------------------------------------------------------


def detect(
    rollout: library.Rollout, *, envs: Sequence[int] | None = None
) -> list[Highlight]:
    """Runs every registered detector on a finished run.

    A custom detector that raises, or whose result is invalid (see
    :func:`register`), is logged and skipped.

    Args:
        rollout: The run. It must not be recording.
        envs: Only look at these envs (built-in detectors read only them;
            custom detectors see the whole run and their result is
            filtered). ``None`` means all envs.

    Returns:
        The highlights, sorted by time (then env and kind).

    Raises:
        IndexError: If an env index is out of range.
        errors.FormatError: If the run is unfinished.
    """
    ctx = _Context(rollout, envs)
    wanted = None if envs is None else set(ctx.envs.tolist())
    found: list[Highlight] = []
    for key, run_pass in _PASSES:
        if key in _REGISTRY:
            found += _cap(run_pass(ctx))
    for kind in list(_REGISTRY.values()):
        if kind.detector is None:
            continue
        try:
            mine = _check(
                kind.key,
                kind.detector(rollout),
                rollout.n_frames,
                rollout.n_envs,
            )
        except Exception as exc:  # isolation point: one bad detector only
            logger.warning(
                "skipping detector %r: %s",
                kind.key,
                exc,
                exc_info=not isinstance(exc, ValueError),
            )
            continue
        found += [
            dataclasses.replace(h, label=h.label or kind.label)
            for h in mine
            if wanted is None or h.env in wanted
        ]
    merged = _merge(found)
    merged.sort(key=lambda h: (h.t, h.env, h.kind))
    return merged


def to_json(
    rollout: library.Rollout, highlights: Sequence[Highlight]
) -> dict[str, Any]:
    """Builds the ``highlights.json`` object (viewer contracts 9.3).

    Args:
        rollout: The run the highlights belong to.
        highlights: Highlights from :func:`detect`.

    Returns:
        The JSON-ready object. ``kinds`` lists the kinds that have at least
        one highlight (as its kind or among its ``also``), in registration
        order; a custom kind with a colour carries it.
    """
    ordered = sorted(highlights, key=lambda h: (h.t, h.env, h.kind))
    present = {h.kind for h in ordered} | {k for h in ordered for k in h.also}
    labels = {k["key"]: k["label"] for k in kinds()}

    def rounded(x: float | None, digits: int) -> float | None:
        return None if x is None else round(x, digits)

    return {
        "format": FORMAT,
        "detector": DETECTOR_VERSION,
        "run_id": rollout.manifest.id,
        "kinds": [k for k in kinds() if k["key"] in present],
        "highlights": [
            {
                "t": round(h.t, 6),
                "frame": h.frame,
                "t1": rounded(h.t1, 6),
                "frame1": h.frame1,
                "env": h.env,
                "kind": h.kind,
                "label": h.label or labels.get(h.kind, h.kind),
                "detail": h.detail,
                "score": round(h.score, 3),
                "ratio": rounded(h.ratio, 3),
                "value": round(h.value, 4),
                "body": h.body,
                "also": list(h.also),
            }
            for h in ordered
        ],
    }


def cache_key(rollout: library.Rollout) -> str:
    """Identifies the inputs of a cached result.

    Args:
        rollout: The run.

    Returns:
        A string of run id, detector version, the registered custom kinds
        (key, label and colour) and the manifest's modification time.
    """
    man = rollout.path / (
        "rollout.json"
        if (rollout.path / "rollout.json").exists()
        else "rollout.json.partial"
    )
    extra = ",".join(
        sorted(
            f"{k.key}:{k.label}:{k.color or ''}"
            for k in _REGISTRY.values()
            if k.detector is not None
        )
    )
    return (
        f"{rollout.manifest.id} {DETECTOR_VERSION} [{extra}] "
        f"{man.stat().st_mtime_ns}"
    )


def load_or_compute(
    rollout: library.Rollout, cache_dir: os.PathLike[str] | str
) -> dict[str, Any]:
    """Returns the highlights document, cached in ``cache_dir``.

    The cache is ``highlights.json`` plus a ``highlights.key`` file beside
    it; both are replaced atomically, the key last. A different run id,
    detector version, set of registered custom kinds or manifest mtime makes
    the next call recompute.

    Args:
        rollout: A finished run.
        cache_dir: Directory for the cache (created if missing), for example
            ``.simscope/derived/<run id>``.

    Returns:
        The ``highlights.json`` object.
    """
    cache = pathlib.Path(cache_dir)
    key = cache_key(rollout)
    doc_path, key_path = cache / FILE_NAME, cache / KEY_NAME
    try:
        if key_path.read_text("utf-8") == key:
            return json.loads(doc_path.read_bytes())
    except (OSError, ValueError):
        pass
    doc = to_json(rollout, detect(rollout))
    cache.mkdir(parents=True, exist_ok=True)
    cas.atomic_write(doc_path, json.dumps(doc, separators=(",", ":")).encode())
    cas.atomic_write(key_path, key.encode("utf-8"))
    logger.info("highlights for %s: %d", rollout.name, len(doc["highlights"]))
    return doc
