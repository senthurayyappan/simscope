"""Crash-safe, low-overhead rollout recorder.

``Recorder.log`` only validates cheaply and copies one frame into a
preallocated window buffer ``[block_frames, E, K]`` per stream. When a
window fills it is handed to one background thread that applies pose sign
continuity, encodes (deflate releases the GIL, so this overlaps with the
simulator) and appends the blocks to the ``.blk`` files. Every finished
window is flushed to the OS, so a crash loses at most the window in flight;
``Library.recover`` restores the rest.
"""

import concurrent.futures
import json
import logging
import math
import os
import pathlib
import queue
import shutil
import threading
import time
from collections.abc import Mapping, Sequence
from types import TracebackType
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import core, transforms
from simscope.io import blockfile, cas, codecs, manifest
from simscope.io import scene as scene_io

logger = logging.getLogger(__name__)

_SIGN_CHUNK = 1 << 21
"""Max elements per sign-continuity pass, to bound temporary memory."""
_POLL_S = 0.05


class RecorderError(RuntimeError):
    """Raised for lifecycle errors, such as logging to a closed recorder."""


class _Stream:
    """Static description of one recorded stream."""

    def __init__(
        self,
        index: int,
        name: str,
        kind: core.StreamKind,
        item_shape: tuple[int, ...],
        n_envs: int,
        codec: str,
        labels: tuple[str, ...] | None = None,
        units: str | None = None,
    ) -> None:
        self.index = index
        self.name = name
        self.kind = kind
        self.item_shape = item_shape
        self.k = int(np.prod(item_shape, dtype=np.int64))
        self.frame_shape = (n_envs, *item_shape)
        self.codec = codec
        self.labels = labels
        self.units = units
        self.info = manifest.StreamInfo(
            f"{name}.blk", kind, item_shape, labels, units
        )


class _Window:
    """One block-sized buffer per stream, plus where it belongs in time."""

    __slots__ = ("arrays", "frames", "n", "t0")

    def __init__(
        self, streams: Sequence[_Stream], block_frames: int, n_envs: int
    ) -> None:
        self.arrays = [
            np.empty((block_frames, n_envs, s.k), np.float32) for s in streams
        ]
        # Views shaped [block_frames, E, *item]; writes land in `arrays`.
        self.frames = [
            a.reshape(block_frames, n_envs, *s.item_shape)
            for a, s in zip(self.arrays, streams, strict=True)
        ]
        self.n = 0
        self.t0 = 0


class _StreamWriter(blockfile.BlockWriter):
    """A ``BlockWriter`` fed with pre-encoded windows from the worker."""

    def write_window(
        self, t0: int, blocks: Sequence[blockfile.EncodedBlock], n: int
    ) -> None:
        """Appends one encoded window and flushes it to the OS.

        Args:
            t0: First frame index of the window.
            blocks: One encoded block per env.
            n: Frames in the window.
        """
        del n  # write_encoded advances the frame count from the blocks.
        self.write_encoded(t0, blocks)
        if self._file is not None:
            self._file.flush()


def _frame_error(name: str, want: tuple[int, ...], got: tuple[int, ...]):
    """Builds the error for a frame of the wrong shape."""
    return ValueError(f"stream {name!r}: expected shape {want}, got {got}")


class Recorder:
    """Records one rollout into a library.

    Create it with ``Library.record``. Use it as a context manager: leaving
    the ``with`` block normally calls :meth:`close` (status ``"complete"``);
    leaving it on an exception calls :meth:`abort`, which keeps the run
    recoverable (``rollout.json.partial``). Not thread-safe: call ``log``
    from one thread.

    Attributes:
        name: Run name.
        path: Run directory.
        dt: Seconds per frame.
        n_envs: Envs per frame.
        block_frames: Frames per block.
    """

    def __init__(
        self,
        root: pathlib.Path,
        name: str,
        *,
        scene: core.Scene,
        dt: float,
        n_envs: int = 1,
        env_origins: npt.ArrayLike | None = None,
        source: Mapping[str, Any] | None = None,
        tags: Sequence[str] = (),
        meta: Mapping[str, Any] | None = None,
        codec: str = "f32s",
        block_frames: int = blockfile.DEFAULT_BLOCK_FRAMES,
        overwrite: bool = False,
        max_pending: int = 2,
        encode_threads: int | None = None,
        created: str | None = None,
    ) -> None:
        """Validates arguments. Nothing is written until the first ``log``.

        Args:
            root: The library root.
            name: Run name, ``[A-Za-z0-9][A-Za-z0-9._-]{0,127}``.
            scene: The static scene. Its body count fixes the pose shape.
            dt: Seconds between frames (positive).
            n_envs: Number of parallel envs.
            env_origins: World offset of each env, shape ``[n_envs, 3]``, or
                ``None`` for zeros.
            source: Provenance, such as ``{"simulator": "mujoco", ...}``.
            tags: Record-time tags.
            meta: Free-form JSON-serializable metadata.
            codec: Codec of the pose stream: ``"f32s"`` (lossless) or
                ``"q16d"``. Other streams use their own codec (default
                ``"f32s"``).
            block_frames: Frames per block.
            overwrite: Replace an existing run of this name. The whole run
                directory (including its annotations) is deleted when
                recording starts.
            created: When the run was recorded, ``YYYY-MM-DDTHH:MM:SSZ``
                (UTC). Importers pass the time of the original recording;
                ``None`` means now.
            max_pending: Full windows that may wait for the encoder before
                ``log`` blocks.
            encode_threads: Threads the background writer fans a window's
                per-env blocks out to (deflate releases the GIL, so this
                scales). ``None`` picks 1 for fewer than 4 envs, else up
                to 4.

        Raises:
            ValueError: If an argument is invalid.
            FileExistsError: If the run exists and ``overwrite`` is false.
        """
        self.name = manifest.validate_run_name(name)
        self._root = pathlib.Path(root)
        self.path = self._root / "runs" / name
        if not dt > 0 or not math.isfinite(dt):
            raise ValueError(f"dt must be positive and finite, got {dt!r}")
        if n_envs < 1 or block_frames < 1 or max_pending < 1:
            raise ValueError("n_envs, block_frames, max_pending must be >= 1")
        codecs.codec_id(codec)
        self.dt = float(dt)
        self.n_envs = int(n_envs)
        self.block_frames = int(block_frames)
        self._scene = scene
        self._codec = codec
        self._overwrite = overwrite
        self._max_pending = int(max_pending)
        if encode_threads is None:
            encode_threads = 1 if n_envs < 4 else min(4, os.cpu_count() or 1)
        if encode_threads < 1:
            raise ValueError("encode_threads must be at least 1")
        self._encode_threads = int(encode_threads)
        self._pool: concurrent.futures.ThreadPoolExecutor | None = None
        self._source = dict(source or {})
        self._tags = tuple(str(t) for t in tags)
        self._meta = dict(meta or {})
        json.dumps([self._source, self._meta], allow_nan=False)  # early check
        self._origins = self._parse_origins(env_origins)
        self._check_free()
        self._id = manifest.new_ulid()
        self._created = created or manifest.utc_now()
        self._specs: list[_Stream] = []
        self._by_name: dict[str, _Stream] = {}
        self._started = False
        self._closed = False
        self._error: BaseException | None = None
        self._stats = {"stalls": 0, "stall_seconds": 0.0, "close_seconds": 0.0}

    # -- setup --

    def _parse_origins(
        self, origins: npt.ArrayLike | None
    ) -> tuple[core.Vec3, ...] | None:
        """Validates env origins into a tuple of triples."""
        if origins is None:
            return None
        arr = np.asarray(origins, dtype=np.float64)
        if arr.shape != (self.n_envs, 3) or not np.isfinite(arr).all():
            raise ValueError(
                f"env_origins must be finite with shape ({self.n_envs}, 3)"
            )
        return tuple((float(x), float(y), float(z)) for x, y, z in arr)

    def _check_free(self) -> None:
        """Raises if a finished or in-progress run of this name exists."""
        if self._overwrite:
            return
        for fname in (manifest.MANIFEST_NAME, manifest.PARTIAL_NAME):
            if (self.path / fname).exists():
                raise FileExistsError(
                    f"run {self.name!r} exists in {self._root}; "
                    "pass overwrite=True to replace it"
                )

    def add_stream(
        self,
        name: str,
        kind: core.StreamKind,
        item_shape: Sequence[int] = (),
        *,
        labels: Sequence[str] | None = None,
        units: str | None = None,
        codec: str = "f32s",
        scale: float | None = None,
    ) -> None:
        """Declares an extra stream. Call before the first ``log``.

        Args:
            name: Stream name; also the keyword given to ``log``.
            kind: How viewers draw it (``"scalar"``, ``"vector"``,
                ``"arrows"``, ``"points"`` or ``"polyline"``).
            item_shape: Shape of one env-frame item (``()`` for a scalar,
                ``(K,)`` for a vector, ``(K, 6)`` for arrows, ...).
            labels: Optional component names.
            units: Optional unit string.
            codec: ``"f32s"`` (lossless, default) or ``"q16d"``.
            scale: For ``arrows`` streams, metres drawn per unit of vector.
                ``None`` means viewers use 1.

        Raises:
            RecorderError: If recording already started.
            ValueError: If the name is taken or invalid, or the kind and
                shape do not fit.
        """
        if self._started or self._closed:
            raise RecorderError("streams must be declared before the first log")
        try:
            manifest.validate_run_name(name)
        except ValueError as exc:
            raise ValueError(f"invalid stream name {name!r}") from exc
        if name == manifest.BODY_POSE or name in self._by_name:
            raise ValueError(f"stream {name!r} is already declared")
        if kind not in core.STREAM_KINDS or kind == "pose":
            raise ValueError(f"extra stream kind must be non-pose: {kind!r}")
        codecs.codec_id(codec)
        shape = tuple(int(d) for d in item_shape)
        if kind == "scalar" and shape != ():
            raise ValueError("scalar streams have item_shape ()")
        if kind == "vector" and len(shape) != 1:
            raise ValueError("vector streams need item_shape (K,)")
        if kind == "arrows" and (len(shape) != 2 or shape[1] != 6):
            raise ValueError("arrows streams need item_shape (K, 6)")
        if kind in ("points", "polyline") and (
            len(shape) != 2 or shape[1] != 3
        ):
            raise ValueError(f"{kind} streams need item_shape (K, 3)")
        if 0 in shape or len(shape) > 4:
            raise ValueError(f"invalid item_shape {shape}")
        if labels is not None and len(labels) != (shape[-1] if shape else 1):
            raise ValueError("labels must have one entry per component")
        spec = _Stream(
            len(self._specs) + 1,
            name,
            kind,
            shape,
            self.n_envs,
            codec,
            None if labels is None else tuple(labels),
            units,
        )
        if scale is not None:
            if kind != "arrows":
                raise ValueError("scale applies to arrows streams only")
            spec.info.scale = float(scale)
        self._register(spec)

    def _register(self, spec: _Stream) -> None:
        """Adds a stream description."""
        self._specs.append(spec)
        self._by_name[spec.name] = spec

    def _start(
        self,
        pose_shape: tuple[int, ...],
        extra_shapes: Mapping[str, tuple[int, ...]],
    ) -> None:
        """Validates the first frame, then creates files and the worker.

        Args:
            pose_shape: Shape of one frame of poses, ``[E, B, 7]`` or
                ``[B, 7]`` when ``n_envs == 1``.
            extra_shapes: Per-frame shape of every stream given to the
                first ``log``. Undeclared scalars are auto-declared.

        Raises:
            ValueError: If shapes disagree with the scene or declarations.
        """
        n_bodies = self._scene.n_bodies
        want = (self.n_envs, n_bodies, core.POSE_DIM)
        if pose_shape not in (want, want[1:]) or (
            pose_shape == want[1:] and self.n_envs != 1
        ):
            raise _frame_error("poses", want, pose_shape)
        pose = _Stream(
            0,
            manifest.BODY_POSE,
            "pose",
            (n_bodies, core.POSE_DIM),
            self.n_envs,
            self._codec,
        )
        specs = [pose, *self._specs]
        for name, shape in extra_shapes.items():
            if name in self._by_name:
                continue
            if shape not in ((), (self.n_envs,)):
                raise ValueError(
                    f"stream {name!r} was not declared; call add_stream() "
                    "before the first log (only scalars can be inferred)"
                )
            spec = _Stream(len(specs), name, "scalar", (), self.n_envs, "f32s")
            specs.append(spec)
            self._by_name[name] = spec
        self._specs = specs
        self._open_files()

    def _open_files(self) -> None:
        """Writes the scene and partial manifest, opens writers and worker."""
        self._check_free()
        if self._overwrite and self.path.exists():
            shutil.rmtree(self.path)
        self.path.mkdir(parents=True, exist_ok=True)
        ref = scene_io.put_scene(cas.ContentStore(self._root), self._scene)
        self._manifest = manifest.RolloutManifest(
            id=self._id,
            name=self.name,
            created=self._created,
            dt=self.dt,
            n_frames=0,
            n_envs=self.n_envs,
            n_bodies=self._scene.n_bodies,
            scene=ref,
            streams={s.name: s.info for s in self._specs},
            status="recording",
            env_origins=self._origins,
            source=self._source,
            tags=self._tags,
            meta=self._meta,
        )
        self._writers = [
            _StreamWriter(
                self.path / s.info.file,
                item_shape=s.item_shape,
                n_envs=self.n_envs,
                kind=s.kind,
                codec=s.codec,
                block_frames=self.block_frames,
            )
            for s in self._specs
        ]
        manifest.write_manifest(self.path, self._manifest, partial=True)
        self._n_extra = len(self._specs) - 1
        self._pose_shape = self._specs[0].frame_shape
        n_windows = self._max_pending + 1
        windows = [
            _Window(self._specs, self.block_frames, self.n_envs)
            for _ in range(n_windows)
        ]
        self._win = windows[0]
        self._free_q: queue.Queue[_Window] = queue.Queue()
        for w in windows[1:]:
            self._free_q.put(w)
        self._work_q: queue.Queue[_Window | None] = queue.Queue()
        self._fill = 0
        self._next_t0 = 0
        self._prev_quat: npt.NDArray[np.float32] | None = None
        if self._encode_threads > 1 and self.n_envs > 1:
            self._pool = concurrent.futures.ThreadPoolExecutor(
                self._encode_threads, thread_name_prefix="simscope-encode"
            )
        self._thread = threading.Thread(
            target=self._worker, name="simscope-recorder", daemon=True
        )
        self._thread.start()
        self._started = True

    # -- logging --

    @property
    def n_frames(self) -> int:
        """Frames logged so far."""
        return self._next_t0 + self._fill if self._started else 0

    @property
    def stats(self) -> dict[str, float]:
        """Backpressure counters.

        ``stalls`` counts the times ``log`` had to wait for the encoder,
        ``stall_seconds`` the total wait, and ``close_seconds`` how long the
        last ``close`` took.
        """
        return dict(self._stats)

    def log(self, poses: npt.ArrayLike, **streams: npt.ArrayLike) -> None:
        """Records one frame.

        Args:
            poses: Body poses ``[E, B, 7]`` (or ``[B, 7]`` when there is one
                env), xyzw quaternions.
            **streams: One value per declared stream, each ``[E, *item]``.
                Scalar streams also accept a Python float (used for every
                env) and, when there is one env, no leading axis. A name
                that was never declared is declared as a scalar on the
                first frame if its value is a float or has shape ``[E]``.

        Raises:
            RecorderError: If the recorder is closed.
            ValueError: If a shape is wrong or a stream is missing or
                undeclared. The frame is not recorded.
            Exception: A failure of the background writer, re-raised.
        """
        if self._error is not None or self._closed:
            self._raise_pending()
        if not self._started:
            self._start(
                np.shape(poses), {k: np.shape(v) for k, v in streams.items()}
            )
        elif len(streams) != self._n_extra:
            self._check_names(streams)
        i = self._fill
        frames = self._win.frames
        by_name = self._by_name
        shape = getattr(poses, "shape", None)
        if shape == self._pose_shape:
            np.copyto(frames[0][i], poses)
        else:
            frames[0][i] = self._coerce(self._specs[0], poses)
        for name, value in streams.items():
            spec = by_name.get(name)
            if spec is None:
                self._check_names(streams)
                raise AssertionError("unreachable")  # pragma: no cover
            if getattr(value, "shape", None) == spec.frame_shape:
                np.copyto(frames[spec.index][i], value)
            else:
                frames[spec.index][i] = self._coerce(spec, value)
        self._fill = i + 1
        if self._fill == self.block_frames:
            self._submit()

    def _check_names(self, streams: Mapping[str, Any]) -> None:
        """Raises a clear error for missing or undeclared streams."""
        extra = sorted(set(streams) - self._by_name.keys())
        missing = sorted(self._by_name.keys() - set(streams))
        if extra:
            raise ValueError(
                f"undeclared streams {extra}: call add_stream() before the "
                "first log"
            )
        if missing:
            raise ValueError(f"missing streams {missing} in this frame")

    def _coerce(self, spec: _Stream, value: Any) -> npt.NDArray[np.float32]:
        """Converts one frame value to an array that fits ``spec``.

        Returns:
            An array broadcastable to ``spec.frame_shape``: exactly that
            shape, that shape with the env axis added, or (scalars only) a
            0-d array.
        """
        a = np.asarray(value, dtype=np.float32)
        if a.shape == spec.frame_shape:
            return a
        if self.n_envs == 1 and a.shape == spec.frame_shape[1:]:
            return a[None]
        if spec.kind == "scalar" and a.ndim == 0:
            return a
        raise _frame_error(spec.name, spec.frame_shape, a.shape)

    def log_frames(
        self, poses: npt.ArrayLike, **streams: npt.ArrayLike
    ) -> None:
        """Records ``n`` frames at once, without a Python loop over frames.

        Args:
            poses: Body poses ``[n, E, B, 7]`` (or ``[n, B, 7]`` when there
                is one env), for example ``PoseBuffer.drain()`` output.
            **streams: One array per declared stream, each
                ``[n, E, *item]`` (scalars may be ``[n]`` when there is one
                env).

        Raises:
            RecorderError: If the recorder is closed.
            ValueError: If a shape is wrong or a stream is missing or
                undeclared. Nothing is recorded.
            Exception: A failure of the background writer, re-raised.
        """
        if self._error is not None or self._closed:
            self._raise_pending()
        arrays = {
            k: np.asarray(v, dtype=np.float32) for k, v in streams.items()
        }
        pose_arr = np.asarray(poses, dtype=np.float32)
        if pose_arr.ndim < 1:
            raise ValueError("poses must have a leading frame axis")
        n = pose_arr.shape[0]
        if not self._started:
            self._start(
                pose_arr.shape[1:], {k: a.shape[1:] for k, a in arrays.items()}
            )
        elif len(arrays) != self._n_extra:
            self._check_names(arrays)
        batch = [self._coerce_batch(self._specs[0], pose_arr, n)]
        for name, a in arrays.items():
            if name not in self._by_name:
                self._check_names(arrays)
            spec = self._by_name[name]
            batch.append((spec, self._coerce_batch(spec, a, n)[1]))
        pos = 0
        while pos < n:
            take = min(n - pos, self.block_frames - self._fill)
            lo, hi = self._fill, self._fill + take
            frames = self._win.frames
            for spec, a in batch:
                np.copyto(frames[spec.index][lo:hi], a[pos : pos + take])
            self._fill = hi
            pos += take
            if self._fill == self.block_frames:
                self._submit()

    def _coerce_batch(
        self, spec: _Stream, a: npt.NDArray[np.float32], n: int
    ) -> tuple[_Stream, npt.NDArray[np.float32]]:
        """Checks a ``[n, E, *item]`` array and adds the env axis if needed."""
        want = (n, *spec.frame_shape)
        if a.shape == want:
            return spec, a
        if self.n_envs == 1 and a.shape == (n, *spec.frame_shape[1:]):
            return spec, a[:, None]
        raise _frame_error(spec.name, want, a.shape)

    # -- window hand-off --

    def _submit(self) -> None:
        """Queues the full current window and switches to a free one."""
        win = self._win
        win.n = self._fill
        win.t0 = self._next_t0
        self._next_t0 += self._fill
        self._work_q.put(win)
        try:
            self._win = self._free_q.get_nowait()
        except queue.Empty:
            self._win = self._wait_for_window()
        self._fill = 0

    def _wait_for_window(self) -> _Window:
        """Blocks until the encoder frees a window (backpressure)."""
        start = time.perf_counter()
        while True:
            try:
                win = self._free_q.get(timeout=_POLL_S)
                break
            except queue.Empty:
                if not self._thread.is_alive():
                    raise RecorderError("recorder thread died") from None
        self._stats["stalls"] += 1
        self._stats["stall_seconds"] += time.perf_counter() - start
        return win

    def _worker(self) -> None:
        """Encodes and writes queued windows until it gets ``None``."""
        while True:
            win = self._work_q.get()
            try:
                if win is None:
                    return
                if self._error is None:
                    self._write_window(win)
            except BaseException as exc:
                logger.error("recording worker failed: %r", exc)
                self._error = exc
            finally:
                if win is not None:
                    self._free_q.put(win)
                self._work_q.task_done()

    def _write_window(self, win: _Window) -> None:
        """Encodes a window for every stream and appends it."""
        n = win.n
        for spec, arr, writer in zip(
            self._specs, win.arrays, self._writers, strict=True
        ):
            data = arr[:n]
            if spec.kind == "pose":
                self._fix_signs(data)
            blocks = self._encode(data, spec.codec)
            writer.write_window(win.t0, blocks, n)
        # Keep the partial manifest's frame count current, so the index (and
        # any `simscope serve` watching the folder) sees live progress.
        self._manifest.n_frames = win.t0 + n
        manifest.write_manifest(self.path, self._manifest, partial=True)

    def _encode(
        self, data: npt.NDArray[np.float32], codec: str
    ) -> Sequence[blockfile.EncodedBlock]:
        """Encodes a window, one block per env, using the thread pool."""
        if self._pool is None:
            return blockfile.encode_window(data, codec)
        n, n_envs, k = data.shape

        def encode_env(env: int) -> blockfile.EncodedBlock:
            cid, payload = codecs.encode_block_auto(data[:, env, :], codec)
            return blockfile.EncodedBlock(
                env, n, cid, codecs.payload_ulen(cid, n, k), payload
            )

        return list(self._pool.map(encode_env, range(n_envs)))

    def _fix_signs(self, data: npt.NDArray[np.float32]) -> None:
        """Applies quaternion sign continuity to a pose window in place."""
        n = data.shape[0]
        n_bodies = self._scene.n_bodies
        q = data.reshape(n, self.n_envs, n_bodies, core.POSE_DIM)[..., 3:]
        prev = self._prev_quat
        if prev is None:
            prev_full = None
            self._prev_quat = prev = np.empty(q.shape[1:], np.float32)
        else:
            prev_full = prev
        step = max(1, _SIGN_CHUNK // (n * n_bodies * 4))
        for lo in range(0, self.n_envs, step):
            sl = slice(lo, lo + step)
            fixed = transforms.enforce_sign_continuity(
                q[:, sl], None if prev_full is None else prev_full[sl]
            )
            q[:, sl] = fixed
            prev[sl] = fixed[-1]

    # -- lifecycle --

    def _raise_pending(self) -> None:
        """Raises the worker's error, or a closed-recorder error."""
        if self._error is not None:
            raise self._error
        raise RecorderError(f"recorder for {self.name!r} is closed")

    def flush(self) -> None:
        """Waits until every full window is on disk.

        Raises:
            Exception: A failure of the background writer, re-raised.
        """
        if not self._started or self._closed:
            return
        self._work_q.join()
        if self._error is not None:
            raise self._error

    def _drain(self) -> None:
        """Queues the partial window, then stops and joins the worker."""
        if self._fill:
            win = self._win
            win.n = self._fill
            win.t0 = self._next_t0
            self._next_t0 += self._fill
            self._fill = 0
            self._work_q.put(win)
        self._work_q.put(None)
        self._thread.join()
        if self._pool is not None:
            self._pool.shutdown()

    def close(self) -> None:
        """Finishes the run: flushes, writes directories and the manifest.

        Does nothing if no frame was logged (no run is created). Safe to
        call twice.

        Raises:
            Exception: A failure of the background writer. The files stay
                recoverable (``rollout.json.partial`` remains).
        """
        if self._closed:
            return
        self._closed = True
        if not self._started:
            return
        start = time.perf_counter()
        try:
            self._drain()
            if self._error is not None:
                raise self._error
            for writer in self._writers:
                writer.finalize()
            self._manifest.n_frames = self._next_t0
            self._manifest.status = "complete"
            manifest.write_manifest(self.path, self._manifest, partial=False)
        finally:
            for writer in self._writers:
                writer.close()
            self._stats["close_seconds"] = time.perf_counter() - start

    def abort(self) -> None:
        """Stops without finishing the run, keeping it recoverable.

        Flushes what it can and leaves ``rollout.json.partial`` in place.
        Never raises; use ``Library.recover`` to complete the run.
        """
        if self._closed:
            return
        self._closed = True
        if not self._started:
            return
        try:
            self._drain()
        finally:
            for writer in self._writers:
                writer.close()
        if self._error is not None:
            logger.error(
                "run %r aborted after a writer error: %r",
                self.name,
                self._error,
            )

    def __enter__(self) -> "Recorder":
        """Returns the recorder."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        """Closes on success; aborts (keeping the run recoverable) on error."""
        if exc_type is None:
            self.close()
        else:
            self.abort()
