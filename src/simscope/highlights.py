"""Automatic highlights: the named physical moments of a rollout.

A highlight is a moment worth jumping to, named for what physically
happened (viewer v3.1 spec 4, contracts 8.2). The built-in detector finds
five kinds:

``landing``
    A fast descent of the root body is stopped. The peak of the root's
    vertical acceleration with gravity removed (the proper acceleration, so a
    robot at rest reads 1 g) must reach 3 g, after the root fell at 1 m/s or
    more within the last 0.2 s. A slower arrival (0.5 m/s or more) counts if
    it ends a jump that rose 10 cm, and a soft landing from a drop of 1.5 m/s
    or more needs only 2 g. The descent must be stopped, and the root must
    not leave faster than it arrived: that is a take-off push (the crouch
    before a jump), not a landing. The impacts of one descent (front legs,
    then hind legs) are one landing, at the first of them.
``jump``
    A span from the take-off, the first frame at +0.5 m/s of the climb that
    leads to the apex, to the first impact that ends the flight. It rose at
    least 10 cm. With a ``contacts`` stream the take-off is the first frame
    without contact force, and an impact needs ground contact near it.
``fall``
    The body lay down and stayed there. Either its up axis tilted more than
    60 degrees from its frame-0 attitude and it stayed tilted for 1.5 s (or,
    if the run ends or the env resets while it is down, for 0.5 s), or its
    root sank below half its standing height and stayed there for 0.25 s.
    Frames inside a jump never count, so flipping in mid-air is not a fall
    and landing on the back is. A robot that is tilted past 60 degrees for a
    second and then gets up again was rearing against a wall or rolling over
    it, which is what the task asked for, so it is not a fall either. The
    standing height is the median of the first 0.2 s, or the height at which
    the root first comes to rest if that is lower, so a body dropped from a
    height is measured where it lands.
``contact_spike``
    Contact force magnitude far above the run's typical stride, from the
    ``contacts`` arrows stream (format spec 5, viewer contracts 7).
``torque_spike``
    ``|tau|`` far above typical in a scalar or vector stream whose name
    contains ``torque``.

Markers of any kind within 0.15 s merge into one moment that keeps the most
important kind (fall, landing, contact spike, torque spike, then registered
kinds) and names the others in its ``also`` and ``detail``. Spikes are
scored by a robust z-score ``(x - median) / max(1.4826 * MAD, floor)`` whose
floor keeps flat and intermittent signals from exploding (see
``SPREAD_FLOOR``). At most 10 markers per env and kind survive, and 50 per
kind across envs.

Everything is vectorized over ``[T, E]`` and reads the run one window at a
time, decoding env chunks on threads, so 1,000 frames of 4,096 envs take a
few seconds and a single 400-frame run takes milliseconds. Teleports (env
resets) are masked out of the derivative signals. Extra detectors plug in
with :func:`register`.

Example:
    >>> from simscope import highlights
    >>> doc = highlights.load_or_compute(rollout, cache_dir)
    >>> [(h["t"], h["kind"]) for h in doc["highlights"]]
"""

import concurrent.futures
import dataclasses
import functools
import json
import logging
import math
import os
import pathlib
from collections.abc import Callable, Sequence
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import core, library
from simscope.io import blockfile, cas, codecs

logger = logging.getLogger(__name__)

DETECTOR_VERSION = "simscope/2.1"
"""Version of the built-in detector; a change invalidates cached results."""

FORMAT = "simscope-highlights/2"
FILE_NAME = "highlights.json"
KEY_NAME = "highlights.key"

LANDING = "landing"
JUMP = "jump"
FALL = "fall"
CONTACT_SPIKE = "contact_spike"
TORQUE_SPIKE = "torque_spike"

_LABELS = {
    LANDING: "Landing",
    JUMP: "Jump",
    FALL: "Fall",
    CONTACT_SPIKE: "Contact spike",
    TORQUE_SPIKE: "Torque spike",
}
_MERGE_ORDER = (FALL, LANDING, CONTACT_SPIKE, TORQUE_SPIKE)
"""Kinds from most to least important when markers merge."""

CONTACTS_STREAM = "contacts"
TORQUE_MARK = "torque"
ROOT_NAMES = ("torso", "base", "trunk", "pelvis", "chassis")

GRAVITY = 9.81
"""Standard gravity in m/s^2; one ``g`` of the labels."""

# -- landings and jumps --
SEED_G = 1.5
"""Least peak (in g) of an impact that can end a flight."""
SEED_WINDOW_S = 0.1
"""An impact is the largest peak within this many seconds."""
ARRIVAL_S = 0.2
"""How far back the descent speed of an impact is looked up, in seconds."""
ARRIVAL_SPEED = 0.5
"""Least descent speed (m/s) of any landing."""
LAND_G = 3.0
"""Least peak (in g) of a landing: three times the robot's weight."""
HARD_SPEED = 1.0
"""Descent speed (m/s) at which a landing needs no preceding jump."""
DROP_MIN = 0.05
"""Least drop (m) from apex to touchdown that a landing's detail mentions."""
SOFT_G = 2.0
"""Least peak (in g) of a soft landing from a long drop."""
SOFT_SPEED = 1.5
"""Descent speed (m/s) at which a soft landing counts."""
ARREST_SPEED = 0.3
"""A landing stops the descent: afterwards no faster than this (m/s) down."""
JUMP_SPEED = 0.5
"""Upward root velocity (m/s) at which a take-off is recognised."""
JUMP_RISE = 0.1
"""Least rise (m) from take-off to apex of a jump.

A flight this high is a ``jump`` marker, and it vouches for a landing that
arrives slower than ``HARD_SPEED``."""
DESCENT_TOL = 0.1
"""Velocity (m/s) below which the root still counts as descending."""
SAME_FALL_S = 0.3
"""Impacts of one descent closer than this are a single landing."""
MAX_FLIGHT_S = 4.0
"""Longest flight whose take-off is searched for, in seconds."""

# -- falls --
FALL_TILT = 60.0
"""Tilt (degrees) from the frame-0 attitude that counts as fallen."""
FALL_LOW = 0.5
"""Fraction of the standing height below which the root counts as fallen."""
FALL_HOLD_S = 0.25
"""How long a body has to lie flat (root under ``FALL_LOW``), in seconds."""
FALL_STAY_S = 1.5
"""How long a tilted body has to stay down if it gets up again, in seconds.

A robot that is rearing against a wall or rolling over it is tilted past
``FALL_TILT`` for up to a second; one that tipped over stays down."""
FALL_END_S = 0.5
"""How long a tilted body has to stay down if the run ends, or the env
resets, while it is down."""
STAND_S = 0.2
"""Window at the start of a run that defines the standing height."""
REST_S = 1.0
"""How far into a run the standing height is looked for at rest."""
REST_SPEED = 0.5
"""Vertical speed (m/s) below which the root counts as at rest."""
REST_ACCEL = 0.3
"""Vertical acceleration (in g) below which the root counts as at rest.

Free fall, as at the apex of a jump, reads one g and is not rest."""
REST_FRAMES = 3
"""Frames at rest that make a standing height."""

# -- merging and caps --
MERGE_S = 0.15
"""Markers closer than this merge into one moment."""
PER_ENV = 10
"""Most highlights per env and kind."""
PER_KIND = 50
"""Most highlights per kind across envs."""

# -- spikes (robust z-score) --
Z_THRESHOLD = 6.0
"""Least robust z-score of a spike."""
WINDOW_S = 0.25
"""A spike is the largest score within this many seconds."""
MAD_SIGMA = 1.4826
"""Scales the median absolute deviation to a standard deviation."""
REL_FLOOR = 0.05
"""Scale floor as a fraction of the median, so a steady load is not flat."""
SPREAD_FLOOR = 0.25
"""Scale floor as a fraction of the signal's usual peak excursion.

A gait's contact force is zero half the time, so its MAD is near zero and
every stride would score as an outlier. The usual peak is the ``k``-th
largest value, ``k = max(TOP_MIN, TOP_FRACTION * T)``; a spike has to beat
it by 50 %."""
TOP_FRACTION = 0.05
TOP_MIN = 3
CONTACT_FLOOR = 1.0
"""Scale floor of contact force, in newtons."""
TORQUE_FLOOR = 0.05
"""Scale floor of torque, in the stream's units."""
FLIGHT_FRACTION = 0.05
"""Contact force below this fraction of a stride's peak means no contact."""
TELEPORT_SPEED = 20.0
"""A root step faster than this (m/s) is a reset, not motion."""

_CANDIDATE_CHUNK = 1 << 18
_GATHER_CHUNK = 1 << 16
_MAX_WORKERS = 3
_WIDE = 64  # floats per env-frame above which threads pay off
_ENV_CHUNK = 256


@dataclasses.dataclass(frozen=True)
class Highlight:
    """One highlighted moment (viewer contracts 8.2).

    Attributes:
        t: Time in seconds (of the take-off, for a span).
        frame: Frame index.
        env: Env index.
        kind: Key of the kind of moment, such as ``"landing"``.
        score: Ranking number of the moment within its kind.
        value: The headline measurement, in the unit of the kind: m/s^2 of a
            landing, seconds airborne of a jump, degrees of tilt of a fall,
            newtons of a contact spike, N m of a torque spike.
        body: Body index the moment belongs to, or ``None``.
        label: Plain-language name; the kind's label if left empty.
        detail: One sentence with the numbers behind the moment, with units.
        t1: End of a span in seconds, or ``None`` for a moment.
        frame1: End frame of a span, or ``None``.
        ratio: How many times the typical level the measurement is, or
            ``None`` if the kind has no typical level.
        also: Kinds of the markers that merged into this one.
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
"""A user detector: returns highlights whose ``kind`` is its key."""


@dataclasses.dataclass(frozen=True)
class _Kind:
    """A registered kind of highlight."""

    key: str
    label: str
    detector: Detector | None  # None: built in, produced by a pass


_REGISTRY: dict[str, _Kind] = {}


def register(key: str, detector: Detector, *, label: str) -> None:
    """Adds a detector to the ones :func:`detect` runs.

    Args:
        key: Kind key. It must be new (see :func:`unregister`).
        detector: ``detector(rollout)`` returns highlights whose ``kind``
            equals ``key``. It is called without an env filter; ``detect``
            filters its result.
        label: Display name of the kind, used for highlights that have no
            label of their own.

    Raises:
        ValueError: If ``key`` is empty or already registered.
    """
    if not key:
        raise ValueError("key must not be empty")
    if key in _REGISTRY:
        raise ValueError(f"kind {key!r} is already registered")
    _REGISTRY[key] = _Kind(key, label, detector)


def unregister(key: str) -> None:
    """Removes a kind, built-in or registered.

    Args:
        key: Kind key.

    Raises:
        KeyError: If no such kind is registered.
    """
    del _REGISTRY[key]


def kinds() -> list[dict[str, str]]:
    """Lists the registered kinds as ``{key, label}`` objects."""
    return [{"key": k.key, "label": k.label} for k in _REGISTRY.values()]


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
    comps: Sequence[int] | None,
    reduce: Reducer,
    frames: int | None = None,
) -> npt.NDArray[np.float32]:
    """Reduces a stream window by window, decoding env chunks on threads.

    Args:
        run: A finished run.
        name: Stream name.
        envs: Env indices to read.
        comps: Components (flattened item indices) to decode, or ``None``
            for all of them.
        reduce: Maps a window ``[t, e, len(comps)]`` and the index of its
            first env within ``envs`` to ``[t, e, *rest]``. It runs on
            worker threads and must not keep the window.
        frames: Read only the windows that cover this many frames (the
            result is cut to them); all windows by default.

    Returns:
        ``[n, len(envs), *rest]`` with ``n = n_frames``, or ``frames``.
    """
    reader = run.stream(name)
    k = math.prod(reader.item_shape)
    cols = np.arange(k) if comps is None else np.asarray(comps, np.intp)
    n_frames, bf, n_envs = reader.n_frames, reader.block_frames, reader.n_envs
    n_windows = -(-n_frames // bf)
    if frames is not None:
        n_windows = min(n_windows, -(-frames // bf))
    n_out = min(n_frames, n_windows * bf)
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
            out = np.empty((n_out, len(envs), *part.shape[2:]), np.float32)
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
    return out if frames is None else out[:frames]


def _as_is(
    window: npt.NDArray[np.float32], _lo: int
) -> npt.NDArray[np.float32]:
    """Keeps a window unchanged."""
    return window


def _max_force(
    window: npt.NDArray[np.float32], _lo: int
) -> npt.NDArray[np.float32]:
    """Largest force magnitude of the K arrows, ``[t, e, 3K] -> [t, e]``."""
    f = window.reshape(*window.shape[:2], -1, 3)
    return np.sqrt(np.einsum("...i,...i->...", f, f).max(-1))


def _max_abs(
    window: npt.NDArray[np.float32], _lo: int
) -> npt.NDArray[np.float32]:
    """Largest ``|x|`` over the item and where, ``[t, e, c] -> [t, e, 2]``."""
    flat = np.abs(window.reshape(*window.shape[:2], -1))
    at = flat.argmax(-1)
    peak = np.take_along_axis(flat, at[..., None], -1)[..., 0]
    return np.stack([peak, at.astype(np.float32)], axis=-1)


def _root_state(
    window: npt.NDArray[np.float32],
    lo: int,
    first: npt.NDArray[np.float32],
) -> npt.NDArray[np.float32]:
    """Reduces root poses to position and the cosine of the tilt.

    The tilt is the angle between world up and the direction that was up at
    frame 0 in the body's frame, so a base frame that is not z-up at rest
    (or a robot that starts tilted) reads 0 degrees there. With ``q`` the
    current attitude and ``q0`` the first one, that cosine is the z-z
    element of ``q * q0^-1``: ``1 - 2 (x^2 + y^2)`` of that product.

    Args:
        window: Root poses ``[t, e, 7]``.
        lo: Index of the first env of the window.
        first: Frame-0 root poses of all envs, ``[E, 7]``.

    Returns:
        ``[t, e, 4]``: x, y, z and the cosine of the tilt.
    """
    q0 = first[lo : lo + window.shape[1], 3:]
    x0, y0, z0, w0 = -q0[:, 0], -q0[:, 1], -q0[:, 2], q0[:, 3]
    x, y, z, w = (window[..., 3 + i] for i in range(4))
    xr = w * x0 + x * w0 + y * z0 - z * y0
    yr = w * y0 - x * z0 + y * w0 + z * x0
    out = np.empty((*window.shape[:2], 4), np.float32)
    out[..., :3] = window[..., :3]
    out[..., 3] = 1 - 2 * (xr * xr + yr * yr)
    return out


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
        self._root: npt.NDArray[np.float32] | None = None
        self._body: int | None = None
        self._read: dict[str, Any] = {}

    @property
    def body(self) -> int:
        """Index of the root body."""
        if self._body is None:
            run = self.rollout
            doc = json.loads(
                cas.ContentStore(run.path.parents[1]).get(
                    run.manifest.scene, "scene"
                )
            )  # body names only: the full scene would load every mesh
            self._body = root_body([b["name"] for b in doc["bodies"]])
        return self._body

    def root(self) -> npt.NDArray[np.float32]:
        """Root state ``[T, len(envs), 4]``: x, y, z, cosine of the tilt."""
        if self._root is None:
            base = 7 * self.body
            comps = range(base, base + 7)
            first = _scan(
                self.rollout, "body_pose", self.envs, comps, _as_is, frames=1
            )[0]
            self._root = _scan(
                self.rollout,
                "body_pose",
                self.envs,
                comps,
                functools.partial(_root_state, first=first),
            )
        return self._root

    def _once(self, key: str, read: Callable[[], Any]) -> Any:
        """Reads a signal the first time it is asked for."""
        if key not in self._read:
            self._read[key] = read()
        return self._read[key]

    def contact_force(self) -> npt.NDArray[np.float32] | None:
        """Largest contact force per env and frame, or ``None`` if none."""
        return self._once("force", self._read_force)

    def _read_force(self) -> npt.NDArray[np.float32] | None:
        info = self.rollout.manifest.streams.get(CONTACTS_STREAM)
        if info is None or info.kind != "arrows":
            return None
        forces = [
            6 * i + j for i in range(info.item_shape[0]) for j in (3, 4, 5)
        ]
        return _scan(
            self.rollout, CONTACTS_STREAM, self.envs, forces, _max_force
        )

    def torque(
        self,
    ) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]] | None:
        """Largest ``|tau|`` per env and frame, and the joint it is on.

        The streams are those whose name contains ``torque``; with several,
        the largest wins at each frame.

        Returns:
            ``(peak, joint)`` of shape ``[T, len(envs)]``, or ``None`` if the
            run has no torque stream.
        """
        return self._once("torque", self._read_torque)

    def _read_torque(
        self,
    ) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]] | None:
        names = [
            name
            for name, info in self.rollout.manifest.streams.items()
            if TORQUE_MARK in name.lower() and info.kind in ("scalar", "vector")
        ]
        peak: npt.NDArray[np.float32] | None = None
        joint: npt.NDArray[np.float32] | None = None
        for name in names:
            both = _scan(self.rollout, name, self.envs, None, _max_abs)
            if peak is None or joint is None:
                peak, joint = both[..., 0], both[..., 1]
                continue
            wins = both[..., 0] > peak
            peak = np.where(wins, both[..., 0], peak)
            joint = np.where(wins, both[..., 1], joint)
        if peak is None or joint is None:
            return None
        return peak, joint


# -- spike scoring ---------------------------------------------------------


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
        what a spike is measured against.
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


def _spikes(
    x: npt.NDArray[np.float32],
    dt: float,
    *,
    floor: float,
) -> tuple[
    npt.NDArray[np.intp],
    npt.NDArray[np.intp],
    npt.NDArray[np.float32],
    npt.NDArray[np.float32],
]:
    """Finds the spikes of a signal ``[T, E]``.

    Returns:
        ``(frames, columns, scores, typical)`` of the kept spikes: the top
        ``PER_ENV`` of each column, best first within a column, at most
        ``PER_KIND`` overall (as a set), and the typical level per column.
    """
    empty = np.empty(0, np.intp)
    typical = np.ones(x.shape[1], np.float32)
    if x.shape[0] == 0 or x.shape[1] == 0:
        return empty, empty, np.empty(0, np.float32), typical
    z, typical = _robust_z(x, ~np.isfinite(x), floor)
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


def _times(ratio: float) -> str:
    """Formats a ratio with a multiplication sign, such as 5.1 times."""
    return f"{ratio:.1f}\u00d7"


def _contact_spikes(ctx: _Context) -> list[Highlight]:
    """Contact force magnitudes far above the run's typical stride."""
    force = ctx.contact_force()
    if force is None:
        return []
    t, col, score, typical = _spikes(force, ctx.dt, floor=CONTACT_FLOOR)
    found = []
    for i in range(len(t)):
        value = float(force[t[i], col[i]])
        ratio = value / float(typical[col[i]])
        found.append(
            Highlight(
                t=float(t[i] * ctx.dt),
                frame=int(t[i]),
                env=int(ctx.envs[col[i]]),
                kind=CONTACT_SPIKE,
                score=float(score[i]),
                value=value,
                label=_LABELS[CONTACT_SPIKE],
                detail=f"{value:.0f} N, {_times(ratio)} typical",
                ratio=ratio,
            )
        )
    return found


def _torque_spikes(ctx: _Context) -> list[Highlight]:
    """``|tau|`` far above typical in the streams named ``torque``."""
    read = ctx.torque()
    if read is None:
        return []
    peak, joint = read
    t, col, score, typical = _spikes(peak, ctx.dt, floor=TORQUE_FLOOR)
    found = []
    for i in range(len(t)):
        value = float(peak[t[i], col[i]])
        ratio = value / float(typical[col[i]])
        where = int(joint[t[i], col[i]])
        found.append(
            Highlight(
                t=float(t[i] * ctx.dt),
                frame=int(t[i]),
                env=int(ctx.envs[col[i]]),
                kind=TORQUE_SPIKE,
                score=float(score[i]),
                value=value,
                label=_LABELS[TORQUE_SPIKE],
                detail=(
                    f"{value:.1f} N·m on joint {where}, {_times(ratio)} typical"
                ),
                ratio=ratio,
            )
        )
    return found


# -- landings, jumps, falls ------------------------------------------------


def _resets(
    pos: npt.NDArray[np.float32], dt: float
) -> tuple[npt.NDArray[np.bool_], npt.NDArray[np.bool_]]:
    """Finds root steps faster than a teleport (env resets).

    Args:
        pos: Root positions ``[T, E, 3]``.
        dt: Seconds per frame.

    Returns:
        ``(steps, frames)``: ``[T - 1, E]`` marks the steps that are resets,
        ``[T, E]`` marks the frames on either side of one, where a second
        difference or a centred velocity means nothing.
    """
    steps = np.linalg.norm(np.diff(pos, axis=0), axis=-1) > TELEPORT_SPEED * dt
    frames = np.zeros(pos.shape[:2], bool)
    frames[:-1] |= steps
    frames[1:] |= steps
    return steps, frames


def _walk_back(
    start: npt.NDArray[np.intp],
    cols: npt.NDArray[np.intp],
    holds: Callable[[npt.NDArray[np.intp], npt.NDArray[np.intp]], Any],
    limit: int,
) -> npt.NDArray[np.intp]:
    """Moves each frame back while ``holds`` is true one frame earlier.

    Args:
        start: First frame of each walk.
        cols: Column of each walk.
        holds: ``holds(frames, cols)`` says, for frames and columns, whether
            the walk may continue onto ``frames``.
        limit: Most steps.

    Returns:
        The frame each walk stopped on (never below 1).
    """
    at = start.copy()
    active = np.arange(len(at))
    for _ in range(limit):
        if not active.size:
            break
        prev = at[active] - 1
        go = (prev >= 1) & holds(np.maximum(prev, 1), cols[active])
        active = active[go]
        at[active] -= 1
    return at


@dataclasses.dataclass
class _Support:
    """Where the robot touches something, from contact force.

    Attributes:
        touching: ``[T, E]``, true where the contact force is more than a
            sliver of a stride's peak.
        known: ``[E]``, false for envs whose contact force is zero all the
            time, which says nothing about flight.
    """

    touching: npt.NDArray[np.bool_]
    known: npt.NDArray[np.bool_]


def _support(force: npt.NDArray[np.float32] | None) -> _Support | None:
    """Tells where the robot touches something, from contact force.

    Args:
        force: Largest contact force per frame and env, or ``None``.

    Returns:
        The contact state, or ``None`` if there is no force data or it is
        zero everywhere (so no flight can be told from it).
    """
    if force is None or not force.size:
        return None
    n = force.shape[0]
    k = min(n, max(TOP_MIN, math.ceil(TOP_FRACTION * n)))
    usual = np.partition(force, n - k, axis=0)[n - k]
    known = usual >= CONTACT_FLOOR
    if not known.any():
        return None
    threshold = np.maximum(FLIGHT_FRACTION * usual, 0.5 * CONTACT_FLOOR)
    return _Support(force > threshold[None, :], known)


def _liftoff(
    support: _Support,
    t: npt.NDArray[np.intp],
    col: npt.NDArray[np.intp],
    reach: int,
    limit: int,
) -> npt.NDArray[np.intp]:
    """Finds where the flight before an impact began, from contact force.

    Args:
        support: The contact state.
        t: Frame of each impact.
        col: Column of each impact.
        reach: Most frames between an impact and the touchdown it belongs to.
        limit: Most frames of flight.

    Returns:
        The first frame without contact of the flight that ends at the
        touchdown of each impact, or -1 if the robot was on the ground just
        before it (or never touched anything before).
    """
    touching = support.touching
    down = _walk_back(t, col, lambda f, c: touching[f, c], reach)
    take = _walk_back(down, col, lambda f, c: ~touching[f, c], limit)
    flew = (take <= down - 2) & touching[np.maximum(take - 1, 0), col]
    return np.where(flew, take, -1)


@dataclasses.dataclass
class _Flights:
    """Impacts that ended a descent, with the flight that led to them.

    All fields are arrays with one entry per impact, sorted by column and
    frame.

    Attributes:
        t: Frame of the impact peak.
        col: Column (env) of the impact.
        g: Peak proper acceleration in g.
        speed: Descent speed before the impact, m/s.
        apex: Frame of the apex of the flight.
        apex_z: Height of the apex.
        land_z: Height of the root at the impact.
        take: Take-off frame, or -1 if the descent has no take-off.
        rise: Height from take-off to apex (0 without take-off).
    """

    t: npt.NDArray[np.intp]
    col: npt.NDArray[np.intp]
    g: npt.NDArray[np.float32]
    speed: npt.NDArray[np.float32]
    apex: npt.NDArray[np.intp]
    apex_z: npt.NDArray[np.float32]
    land_z: npt.NDArray[np.float32]
    take: npt.NDArray[np.intp]
    rise: npt.NDArray[np.float32]


def _impacts(
    z: npt.NDArray[np.float32],
    dt: float,
    resets: tuple[npt.NDArray[np.bool_], npt.NDArray[np.bool_]],
    support: _Support | None,
) -> _Flights | None:
    """Finds the impacts that end a descent, and the flights before them.

    An impact is a peak of the proper vertical acceleration of the root of
    at least ``SEED_G``, after the root fell at ``ARRIVAL_SPEED`` or more
    within ``ARRIVAL_S``, and followed by less upward speed than the fall
    had (more would be a push-off). The flight before it is found from the
    root's vertical velocity: back to the apex, then back through the climb
    to the first frame at ``JUMP_SPEED`` upward.

    Args:
        z: Root heights ``[T, E]``.
        dt: Seconds per frame.
        resets: The result of :func:`_resets`.
        support: Where the robot touches something, or ``None`` if the run
            has no contact data. With it, an impact needs ground contact
            near it, and a flight begins where contact is lost.

    Returns:
        The impacts, or ``None`` if there are none.
    """
    n_frames = z.shape[0]
    steps_bad, frames_bad = resets
    u = np.diff(z, axis=0) / np.float32(dt)  # u[i]: frame i -> i + 1, m/s
    u[steps_bad] = 0
    gup = np.full(z.shape, -np.inf, np.float32)
    gup[1:-1] = (u[1:] - u[:-1]) / np.float32(dt * GRAVITY) + 1
    gup[frames_bad] = -np.inf
    half = max(1, round(SEED_WINDOW_S / dt))
    t, col = _local_maxima(gup, SEED_G, min(half, n_frames))
    if not len(t):
        return None
    order = np.lexsort((t, col))
    t, col = t[order], col[order]
    m = max(2, round(ARRIVAL_S / dt))
    pre = np.empty(len(t), np.float32)
    post = np.empty(len(t), np.float32)
    for i in range(0, len(t), _GATHER_CHUNK):
        s = slice(i, i + _GATHER_CHUNK)
        before = np.clip(t[s, None] + np.arange(-m, 0), 0, n_frames - 2)
        after = np.clip(t[s, None] + np.arange(0, m), 0, n_frames - 2)
        pre[s] = u[before, col[s, None]].min(axis=1)
        post[s] = u[after, col[s, None]].max(axis=1)
    keep = (pre <= -ARRIVAL_SPEED) & (post < -pre) & (post >= -ARREST_SPEED)
    if support is not None:
        near = np.clip(t[:, None] + np.arange(-2, 3), 0, n_frames - 1)
        touched = support.touching[near, col[:, None]].any(axis=1)
        keep &= touched | ~support.known[col]
    t, col, pre = t[keep], col[keep], pre[keep]
    if not len(t):
        return None
    g = gup[t, col]

    def vz(frames: npt.NDArray[np.intp], cols: npt.NDArray[np.intp]) -> Any:
        k = np.clip(frames, 1, n_frames - 2)
        return (z[k + 1, cols] - z[k - 1, cols]) / np.float32(2 * dt)

    limit = max(1, round(MAX_FLIGHT_S / dt))
    descent = _walk_back(t, col, lambda f, c: vz(f, c) < DESCENT_TOL, limit)
    near = np.clip(descent[:, None] + np.arange(-1, 2), 0, n_frames - 1)
    tops = z[near, col[:, None]]
    apex = np.clip(descent - 1 + tops.argmax(axis=1), 0, n_frames - 1)
    apex_z = tops.max(axis=1)
    start = _walk_back(apex, col, lambda f, c: vz(f, c) > -DESCENT_TOL, limit)
    take = _first_fast_climb(vz, start, apex, col, limit)
    if support is not None:
        lift = _liftoff(support, t, col, m, limit)
        take = np.where(support.known[col], lift, take)
    rise = np.where(take >= 0, apex_z - z[np.maximum(take, 0), col], 0)
    return _Flights(
        t=t,
        col=col,
        g=g,
        speed=-pre,
        apex=apex,
        apex_z=apex_z,
        land_z=z[t, col],
        take=take.astype(np.intp),
        rise=rise.astype(np.float32),
    )


def _first_fast_climb(
    vz: Callable[[npt.NDArray[np.intp], npt.NDArray[np.intp]], Any],
    start: npt.NDArray[np.intp],
    stop: npt.NDArray[np.intp],
    cols: npt.NDArray[np.intp],
    limit: int,
) -> npt.NDArray[np.intp]:
    """Finds the first frame in ``[start, stop]`` going up at JUMP_SPEED.

    Returns:
        One frame per walk, or -1 where there is none.
    """
    found = np.full(len(start), -1, np.intp)
    at = start.copy()
    active = np.arange(len(at))
    for _ in range(limit + 1):
        if not active.size:
            break
        hit = vz(at[active], cols[active]) >= JUMP_SPEED
        found[active[hit]] = at[active[hit]]
        active = active[~hit & (at[active] < stop[active])]
        at[active] += 1
    return found


def _one_per_group(
    keys: Sequence[npt.NDArray[Any]], pick: npt.NDArray[Any]
) -> npt.NDArray[np.intp]:
    """Returns the index of the best entry of each group of equal keys.

    Args:
        keys: Arrays that, taken together, name the group of each entry.
        pick: Values to maximise within a group.

    Returns:
        Indices into the entries, one per group, in group order.
    """
    if not len(pick):
        return np.empty(0, np.intp)
    order = np.lexsort((-pick, *reversed(keys)))
    same = np.ones(len(order) - 1, bool)
    for k in keys:
        same &= k[order][1:] == k[order][:-1]
    return order[np.r_[True, ~same]]


def _group_descents(fl: _Flights, dt: float) -> _Flights:
    """Merges the impacts of one descent into a single touchdown.

    Front legs, then hind legs, hit a few frames apart: impacts of one
    column that follow the same apex within ``SAME_FALL_S`` of each other
    are one landing. It happens at the first impact (the touchdown) and is
    as hard as the hardest one and as fast as the fastest descent.

    Args:
        fl: Impacts sorted by column and frame.
        dt: Seconds per frame.

    Returns:
        One entry per touchdown, in the same order.
    """
    gap = max(1, round(SAME_FALL_S / dt))
    new = np.ones(len(fl.t), bool)
    new[1:] = ~(
        (fl.col[1:] == fl.col[:-1])
        & (fl.apex[1:] == fl.apex[:-1])
        & (fl.t[1:] - fl.t[:-1] <= gap)
    )
    starts = np.flatnonzero(new)
    group = np.cumsum(new) - 1
    order = np.lexsort((-fl.g, group))
    hardest = order[np.r_[True, group[order][1:] != group[order][:-1]]]
    return _Flights(
        t=fl.t[starts],
        col=fl.col[starts],
        g=fl.g[hardest],
        speed=np.maximum.reduceat(fl.speed, starts),
        apex=fl.apex[starts],
        apex_z=fl.apex_z[starts],
        land_z=fl.land_z[starts],
        take=fl.take[starts],
        rise=fl.rise[starts],
    )


def _airborne(
    shape: tuple[int, int],
    take: npt.NDArray[np.intp],
    land: npt.NDArray[np.intp],
    col: npt.NDArray[np.intp],
) -> npt.NDArray[np.bool_] | None:
    """Marks the frames of the flights ``[take, land)``, or ``None``."""
    if not len(take):
        return None
    edges = np.zeros((shape[0] + 1, shape[1]), np.int16)
    np.add.at(edges, (take, col), 1)
    np.add.at(edges, (land, col), -1)
    return np.cumsum(edges[:-1], axis=0, dtype=np.int16) > 0


def _standing_height(
    z: npt.NDArray[np.float32], dt: float
) -> npt.NDArray[np.float32]:
    """Finds the height at which each env stands.

    That is the median height of the first ``STAND_S`` seconds, or lower if
    the root first comes to rest lower within the first ``REST_S`` seconds
    (``REST_FRAMES`` frames in a row with a small vertical speed and no
    acceleration, so not falling and not at the apex of a jump). A body that
    starts in the air and lands is thus measured where it stands, not where
    it was dropped from.

    Args:
        z: Root heights ``[T, E]``.
        dt: Seconds per frame.

    Returns:
        One height per column.
    """
    k = max(1, round(STAND_S / dt) + 1)
    first = np.median(z[:k], axis=0)
    head = z[: max(k, round(REST_S / dt) + 1)]
    if len(head) < REST_FRAMES:
        return first
    speed = np.gradient(head, dt, axis=0)
    accel = np.gradient(speed, dt, axis=0)
    rest = (np.abs(speed) < REST_SPEED) & (np.abs(accel) < REST_ACCEL * GRAVITY)
    idx = np.arange(len(head), dtype=np.int32)[:, None]
    run = idx - np.maximum.accumulate(np.where(rest, -1, idx), axis=0)
    settled = rest & (run == REST_FRAMES)
    end = np.argmax(settled, axis=0)  # the last frame of the first run
    found = settled.any(axis=0)
    cols = np.arange(head.shape[1])
    low = np.median(
        np.stack(
            [head[np.maximum(end - j, 0), cols] for j in range(REST_FRAMES)]
        ),
        axis=0,
    )
    return np.where(found, np.minimum(first, low), first).astype(np.float32)


def _episodes(
    mask: npt.NDArray[np.bool_],
) -> tuple[npt.NDArray[np.intp], npt.NDArray[np.intp], npt.NDArray[np.intp]]:
    """Finds the runs of true frames of each column.

    Args:
        mask: ``[T, E]`` booleans.

    Returns:
        ``(starts, columns, ends)``: the first frame, the column and the
        frame after the last, of every run, ordered by frame.
    """
    n_frames = mask.shape[0]
    empty = np.empty(0, np.intp)
    cols = np.flatnonzero(mask.any(axis=0))  # most columns never go down
    if not len(cols):
        return empty, empty, empty
    sub = mask[:, cols]
    idx = np.arange(n_frames, dtype=np.int32)[:, None]
    last_off = np.maximum.accumulate(np.where(sub, -1, idx), axis=0)
    starts = np.argwhere(sub & (idx - last_off == 1))
    next_off = np.where(sub, n_frames, idx)
    next_off = np.minimum.accumulate(next_off[::-1], axis=0)[::-1]
    frames, at = starts[:, 0], starts[:, 1]
    return frames, cols[at], next_off[frames, at].astype(np.intp)


@dataclasses.dataclass
class _Falls:
    """Falls found in a run, one entry each.

    Attributes:
        start: First frame of the fallen posture.
        col: Column (env).
        flat: True for a body lying flat, false for one tipped over.
        seconds: How long it stayed down.
        tilt: Largest tilt from the frame-0 attitude, degrees.
        lowest: Lowest root height.
        standing: The column's standing height.
    """

    start: npt.NDArray[np.intp]
    col: npt.NDArray[np.intp]
    flat: npt.NDArray[np.bool_]
    seconds: npt.NDArray[np.float64]
    tilt: npt.NDArray[np.float64]
    lowest: npt.NDArray[np.float64]
    standing: npt.NDArray[np.float64]


def _falls(
    z: npt.NDArray[np.float32],
    cos: npt.NDArray[np.float32],
    airborne: npt.NDArray[np.bool_] | None,
    resets: npt.NDArray[np.bool_],
    dt: float,
) -> _Falls:
    """Finds the bodies that tipped over and stayed down, or lie flat.

    A body has tipped over when its up axis is more than ``FALL_TILT`` from
    its frame-0 attitude and it stays down: for ``FALL_STAY_S``, or to the
    end of the run or an env reset if that is at least ``FALL_END_S``. A
    robot that gets up again sooner was rearing or rolling, not falling. A
    body lies flat when its root is under ``FALL_LOW`` of its standing height
    for ``FALL_HOLD_S``. Frames inside jumps never count.

    Args:
        z: Root heights ``[T, E]``.
        cos: Cosine of the tilt from the frame-0 attitude, ``[T, E]``.
        airborne: Frames inside jumps.
        resets: Frames next to an env reset, ``[T, E]``.
        dt: Seconds per frame.

    Returns:
        The falls.
    """
    n_frames = z.shape[0]
    stand = _standing_height(z, dt)
    tilted = cos < math.cos(math.radians(FALL_TILT))
    low = z < FALL_LOW * stand[None, :]
    if airborne is not None:
        tilted &= ~airborne
        low &= ~airborne

    def frames(seconds: float) -> int:
        return max(1, math.ceil(seconds / dt - 1e-9))

    t0, tc, te = _episodes(tilted)
    if len(t0):
        at_end = te >= n_frames
        reset = resets[np.minimum(te, n_frames - 1), tc] | resets[te - 1, tc]
        length = te - t0
        stays = (length >= frames(FALL_STAY_S)) | (
            (at_end | reset) & (length >= frames(FALL_END_S))
        )
        t0, tc, te = t0[stays], tc[stays], te[stays]
    l0, lc, le = _episodes(low)
    if len(l0):
        long = le - l0 >= frames(FALL_HOLD_S)
        l0, lc, le = l0[long], lc[long], le[long]
        # A body that is tipped over and flat is one fall: the tilted one.
        for i in range(len(l0)):
            same = (tc == lc[i]) & (t0 < le[i]) & (l0[i] < te)
            if same.any():
                le[i] = l0[i]
        keep = le > l0
        l0, lc, le = l0[keep], lc[keep], le[keep]
    start = np.concatenate([t0, l0])
    col = np.concatenate([tc, lc])
    end = np.concatenate([te, le])
    flat = np.concatenate([np.zeros(len(t0), bool), np.ones(len(l0), bool)])
    tilt = np.empty(len(start))
    lowest = np.empty(len(start))
    for i in range(len(start)):
        s, e, c = start[i], end[i], col[i]
        tilt[i] = np.degrees(np.arccos(np.clip(cos[s:e, c].min(), -1, 1)))
        lowest[i] = z[s:e, c].min()
    return _Falls(
        start=start,
        col=col,
        flat=flat,
        seconds=(end - start) * dt,
        tilt=tilt,
        lowest=lowest,
        standing=stand[col].astype(np.float64),
    )


def _motion(ctx: _Context) -> list[Highlight]:
    """Landings, jumps and falls of the root body."""
    root = ctx.root()
    n_frames = root.shape[0]
    if n_frames < 4 or not root.shape[1]:
        return []
    dt = ctx.dt
    z = np.ascontiguousarray(root[..., 2])
    resets = _resets(root[..., :3], dt)
    support = _support(ctx.contact_force())
    fl = _impacts(z, dt, resets, support)
    found: list[Highlight] = []
    airborne = None
    if fl is not None:
        fl = _group_descents(fl, dt)
        # One flight per take-off: the first touchdown after it ends it.
        flying = np.flatnonzero(fl.take >= 0)
        pick = _one_per_group([fl.col[flying], fl.take[flying]], -fl.t[flying])
        leads = flying[pick]
        jumps = leads[fl.rise[leads] >= JUMP_RISE]
        airborne = _airborne(
            z.shape, fl.take[jumps], fl.t[jumps], fl.col[jumps]
        )
        hard = (fl.g >= LAND_G) & (
            (fl.speed >= HARD_SPEED) | (fl.rise >= JUMP_RISE)
        )
        soft = (fl.g >= SOFT_G) & (fl.speed >= SOFT_SPEED)
        ends_flight = np.zeros(len(fl.t), bool)
        ends_flight[leads] = True
        found += _landing_marks(
            ctx, fl, np.flatnonzero(hard | soft), ends_flight
        )
        found += _jump_marks(ctx, fl, jumps)
    found += _fall_marks(ctx, z, root[..., 3], airborne, resets[1])
    return found


def _landing_marks(
    ctx: _Context,
    fl: _Flights,
    lands: npt.NDArray[np.intp],
    ends_flight: npt.NDArray[np.bool_],
) -> list[Highlight]:
    """Builds the landing highlights from accepted touchdowns."""
    dt = ctx.dt
    found = []
    for i in lands.tolist():
        g = float(fl.g[i])
        detail = f"{g:.1f} g impact"
        if ends_flight[i]:
            detail += f", after {(fl.t[i] - fl.take[i]) * dt:.2f} s airborne"
        elif (drop := float(fl.apex_z[i] - fl.land_z[i])) >= DROP_MIN:
            detail += f", after a {drop:.2f} m drop"
        found.append(
            Highlight(
                t=float(fl.t[i] * dt),
                frame=int(fl.t[i]),
                env=int(ctx.envs[fl.col[i]]),
                kind=LANDING,
                score=g,
                value=g * GRAVITY,
                body=ctx.body,
                label=_LABELS[LANDING],
                detail=detail,
                ratio=g,
            )
        )
    return found


def _jump_marks(
    ctx: _Context, fl: _Flights, jumps: npt.NDArray[np.intp]
) -> list[Highlight]:
    """Builds the jump spans from take-offs and the impacts that end them."""
    dt = ctx.dt
    found = []
    for i in jumps.tolist():
        air = float((fl.t[i] - fl.take[i]) * dt)
        apex = float(fl.apex_z[i])
        found.append(
            Highlight(
                t=float(fl.take[i] * dt),
                frame=int(fl.take[i]),
                env=int(ctx.envs[fl.col[i]]),
                kind=JUMP,
                score=air,
                value=air,
                body=ctx.body,
                label=_LABELS[JUMP],
                detail=f"{air:.2f} s airborne, apex {apex:.2f} m",
                t1=float(fl.t[i] * dt),
                frame1=int(fl.t[i]),
            )
        )
    return found


def _fall_marks(
    ctx: _Context,
    z: npt.NDArray[np.float32],
    cos: npt.NDArray[np.float32],
    airborne: npt.NDArray[np.bool_] | None,
    resets: npt.NDArray[np.bool_],
) -> list[Highlight]:
    """Builds the fall highlights from bodies that stayed down."""
    dt = ctx.dt
    falls = _falls(z, cos, airborne, resets, dt)
    found = []
    for i in range(len(falls.start)):
        seconds = falls.seconds[i]
        if falls.flat[i]:
            score = min(
                10.0, FALL_LOW * falls.standing[i] / max(falls.lowest[i], 1e-3)
            )
            detail = (
                f"dropped to {falls.lowest[i]:.2f} m "
                f"and stayed flat for {seconds:.1f} s"
            )
        else:
            score = falls.tilt[i] / FALL_TILT
            detail = (
                f"tipped {falls.tilt[i]:.0f}\u00b0 "
                f"and stayed down for {seconds:.1f} s"
            )
        found.append(
            Highlight(
                t=float(falls.start[i] * dt),
                frame=int(falls.start[i]),
                env=int(ctx.envs[falls.col[i]]),
                kind=FALL,
                score=float(score),
                value=float(falls.tilt[i]),
                body=ctx.body,
                label=_LABELS[FALL],
                detail=detail,
            )
        )
    return found


# -- merging ---------------------------------------------------------------


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


def _absorb(into: Highlight, other: Highlight) -> Highlight:
    """Merges ``other`` into ``into``, naming it in ``also`` and ``detail``."""
    also = list(into.also)
    for kind in (other.kind, *other.also):
        if kind != into.kind and kind not in also:
            also.append(kind)
    note = f"also {other.label.lower()}"
    if other.detail:
        note += f" ({other.detail})"
    detail = f"{into.detail}; {note}" if into.detail else note
    return dataclasses.replace(into, also=tuple(also), detail=detail)


def _merge(found: list[Highlight]) -> list[Highlight]:
    """Merges markers of one env that are within ``MERGE_S`` of each other.

    The most important kind keeps the moment (see ``_MERGE_ORDER``; kinds
    registered by users come last), the hardest first among equals; every
    other marker within ``MERGE_S`` of it is folded into it. Spans (jumps)
    never merge.

    Args:
        found: Highlights of any kinds.

    Returns:
        The merged highlights.
    """
    spans = [h for h in found if h.t1 is not None]
    points = [h for h in found if h.t1 is None]
    rank = {k: i for i, k in enumerate(_MERGE_ORDER)}
    for key in _REGISTRY:
        rank.setdefault(key, len(rank))
    points.sort(key=lambda h: (rank.get(h.kind, len(rank)), -h.score, h.t))
    kept: dict[int, list[int]] = {}
    out: list[Highlight] = []
    for h in points:
        for j in kept.get(h.env, ()):
            if abs(out[j].t - h.t) <= MERGE_S + 1e-9:
                out[j] = _absorb(out[j], h)
                break
        else:
            kept.setdefault(h.env, []).append(len(out))
            out.append(h)
    return out + spans


# -- public API ------------------------------------------------------------

_PASSES: tuple[
    tuple[tuple[str, ...], Callable[[_Context], list[Highlight]]], ...
] = (
    ((LANDING, JUMP, FALL), _motion),
    ((CONTACT_SPIKE,), _contact_spikes),
    ((TORQUE_SPIKE,), _torque_spikes),
)


def _install_builtins() -> None:
    """Registers the built-in kinds."""
    for key, label in _LABELS.items():
        _REGISTRY[key] = _Kind(key, label, None)


_install_builtins()


def detect(
    rollout: library.Rollout, *, envs: Sequence[int] | None = None
) -> list[Highlight]:
    """Runs every registered detector on a finished run.

    Args:
        rollout: The run. It must not be recording.
        envs: Only look at these envs (built-in detectors read only them;
            registered detectors see the whole run and their result is
            filtered). ``None`` means all envs.

    Returns:
        The highlights, merged and sorted by time (then env and kind).

    Raises:
        IndexError: If an env index is out of range.
        ValueError: If a registered detector returns a highlight whose
            kind is not its key.
        errors.FormatError: If the run is unfinished.
    """
    ctx = _Context(rollout, envs)
    wanted = None if envs is None else set(ctx.envs.tolist())
    found: list[Highlight] = []
    for keys, run_pass in _PASSES:
        if any(k in _REGISTRY for k in keys):
            found += [h for h in _cap(run_pass(ctx)) if h.kind in _REGISTRY]
    for kind in list(_REGISTRY.values()):
        if kind.detector is None:
            continue
        for h in kind.detector(rollout):
            if h.kind != kind.key:
                raise ValueError(
                    f"detector {kind.key!r} returned a {h.kind!r} highlight"
                )
            if wanted is None or h.env in wanted:
                found.append(
                    dataclasses.replace(h, label=h.label or kind.label)
                )
    merged = _merge(found)
    merged.sort(key=lambda h: (h.t, h.env, h.kind))
    return merged


def to_json(
    rollout: library.Rollout, highlights: Sequence[Highlight]
) -> dict[str, Any]:
    """Builds the ``highlights.json`` object (viewer contracts 8.2).

    Args:
        rollout: The run the highlights belong to.
        highlights: Highlights from :func:`detect`.

    Returns:
        The JSON-ready object. ``kinds`` lists the kinds that have at least
        one highlight (as its kind or among its ``also``), in registration
        order.
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
        A string of run id, detector version, registered extra detectors
        and the manifest's modification time.
    """
    man = rollout.path / (
        "rollout.json"
        if (rollout.path / "rollout.json").exists()
        else "rollout.json.partial"
    )
    extra = ",".join(
        sorted(k for k, s in _REGISTRY.items() if s.detector is not None)
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
    detector version, set of registered detectors or manifest mtime makes
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
