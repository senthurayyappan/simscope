"""A simscope library: a folder of recorded rollouts.

``Library(root)`` is a cheap handle. The folder layout is
created lazily, by the first recording. ``lib.record`` returns a
:class:`~simscope.recorder.Recorder`, ``lib.open`` a :class:`Rollout`, and
``lib.query`` searches the SQLite index cache.
"""

import dataclasses
import logging
import os
import pathlib
import threading
from collections.abc import Iterable, Mapping, Sequence
from types import TracebackType
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import annotations, core, index, recorder
from simscope.io import blockfile, cas, errors, manifest
from simscope.io import scene as scene_io

logger = logging.getLogger(__name__)

RunInfo = index.RunInfo


class _PoseFrameSource:
    """Pose frames of one run, satisfying the viewer's ``FrameSource``.

    For a run that is still recording, ``n_frames`` follows the rollout's
    latest :meth:`Rollout.refresh`, and ``read`` is valid below it.

    Attributes:
        env_origins: World offset of every env, ``[n_envs, 3]``. Viewers add
            it to positions; ``read`` returns the stored poses unchanged.
    """

    def __init__(
        self,
        rollout: "Rollout",
        reader: blockfile.BlockReader,
        dt: float,
        env_origins: npt.NDArray[np.float64],
    ) -> None:
        self._rollout = rollout
        self._reader = reader
        self._dt = dt
        self.env_origins = env_origins

    @property
    def n_frames(self) -> int:
        """Frames readable as of the rollout's latest refresh."""
        return self._rollout.n_frames

    @property
    def n_envs(self) -> int:
        """Number of envs."""
        return self._reader.n_envs

    @property
    def dt(self) -> float:
        """Seconds between frames."""
        return self._dt

    def read(self, t0: int, t1: int) -> npt.NDArray[np.float32]:
        """Reads frames ``t0 <= t < t1``.

        Args:
            t0: First frame.
            t1: One past the last frame.

        Returns:
            A new array ``[t1 - t0, n_envs, n_bodies, 7]``.

        Raises:
            IndexError: If the range is outside the run.
        """
        return self._reader.read(t0, t1)


class Rollout:
    """One recorded run, opened for reading.

    Block files open lazily and are memory-mapped; nothing is decoded until
    a window is read. Close the rollout (or use ``with``) to release them.

    A run that is still recording (``rollout.json.partial``) can be tailed:
    call :meth:`refresh` to pick up the windows the recorder has finished
    since. Only complete windows count, so ``n_frames`` never includes a
    window that is half written. When the recorder finishes, ``refresh``
    switches to the final manifest and ``is_recording`` becomes false.

    Attributes:
        name: Run name.
        path: Run directory.
        manifest: The parsed ``rollout.json`` (or ``.partial``).
    """

    def __init__(self, root: pathlib.Path, name: str) -> None:
        """Reads the manifest.

        Args:
            root: The library root.
            name: Run name.

        Raises:
            FileNotFoundError: If the run does not exist.
            errors.FormatError: If the manifest is invalid.
        """
        self._root = pathlib.Path(root)
        self.name = manifest.validate_run_name(name)
        self.path = self._root / "runs" / name
        if not self.path.is_dir():
            raise FileNotFoundError(f"no run {name!r} in {self._root}")
        self.manifest = manifest.read_manifest(self.path)
        self._readers: dict[str, blockfile.BlockReader] = {}
        self._scene: core.Scene | None = None
        self._annotations: annotations.Annotations | None = None
        self._lock = threading.RLock()
        self._tailing = False
        self._live_frames = 0

    @property
    def is_recording(self) -> bool:
        """True while the recorder has not finished the run.

        It reflects the manifest as of the last :meth:`refresh`. A run whose
        recorder crashed stays "recording" until :meth:`Library.recover`.
        """
        return self.manifest.status == "recording"

    @property
    def dt(self) -> float:
        """Seconds between frames."""
        return self.manifest.dt

    @property
    def n_frames(self) -> int:
        """Frames per stream.

        For a recording run this is the count found by the latest
        :meth:`refresh` (0 before the first one).
        """
        if self.is_recording:
            return self._live_frames
        return self.manifest.n_frames

    @property
    def n_envs(self) -> int:
        """Envs per stream."""
        return self.manifest.n_envs

    @property
    def env_origins(self) -> npt.NDArray[np.float64]:
        """World offset of each env, ``[n_envs, 3]`` (zeros if unset)."""
        origins = self.manifest.env_origins
        if origins is None:
            return np.zeros((self.n_envs, 3))
        return np.asarray(origins, dtype=np.float64)

    @property
    def scene(self) -> core.Scene:
        """The scene, loaded from the content store on first use."""
        if self._scene is None:
            store = cas.ContentStore(self._root)
            self._scene = scene_io.load_scene(store, self.manifest.scene)
        return self._scene

    def stream(self, name: str, *, live: bool = False) -> blockfile.BlockReader:
        """Returns the reader of a stream, opening it on first use.

        Args:
            name: Stream name from the manifest.
            live: Allow a stream of a recording run, tailing its file. It is
                implied once :meth:`refresh` or :meth:`frame_source` has been
                called. Without it, a run that is not complete raises, since
                it may have crashed.

        Returns:
            A shared ``BlockReader``; it is closed with the rollout. For a
            recording run its ``n_frames`` only advances in :meth:`refresh`.

        Raises:
            KeyError: If the run has no such stream.
            errors.FormatError: If the run is unfinished and not read with
                ``live`` (see :meth:`Library.recover`), or a file is corrupt.
        """
        info = self.manifest.streams.get(name)
        if info is None:
            raise KeyError(
                f"run {self.name!r} has no stream {name!r}; "
                f"it has {sorted(self.manifest.streams)}"
            )
        with self._lock:
            reader = self._readers.get(name)
            if reader is None:
                partial = self.is_recording
                if partial and not (live or self._tailing):
                    raise errors.FormatError(
                        f"run {self.name!r} is unfinished "
                        f"(status {self.manifest.status!r}); "
                        "call Library.recover() first"
                    )
                reader = blockfile.BlockReader(
                    self.path / info.file, kind=info.kind, partial=partial
                )
                self._readers[name] = reader
            return reader

    def refresh(self) -> int:
        """Picks up what the recorder has written since the last call.

        Re-reads the manifest (``rollout.json.partial``, or the final
        ``rollout.json`` once the run is complete) and refreshes every stream
        reader. The cost is proportional to the new data. On a run that was
        complete when opened this does nothing.

        Returns:
            Frames readable in every stream: the minimum across streams while
            recording, and the manifest's count once complete.

        Raises:
            errors.FormatError: If the manifest or a block file is corrupt.
        """
        with self._lock:
            if self.manifest.status == "complete":
                return self.manifest.n_frames
            self._tailing = True
            self.manifest = self._read_manifest()
            counts = []
            for name in self.manifest.streams:
                reader = self._live_reader(name)
                counts.append(0 if reader is None else reader.refresh())
            self._live_frames = min(counts, default=0)
            if self._annotations is not None:
                self._annotations.n_frames = self.n_frames
            return self.n_frames

    def _read_manifest(self) -> manifest.RolloutManifest:
        """Reads the manifest, tolerating the partial-to-final handover."""
        try:
            return manifest.read_manifest(self.path)
        except FileNotFoundError:
            # The recorder wrote rollout.json and removed the partial file
            # between our two lookups; the final file exists now.
            return manifest.read_manifest(self.path)

    def _live_reader(self, name: str) -> blockfile.BlockReader | None:
        """Opens a tailing reader, or ``None`` if its file has no header."""
        try:
            return self.stream(name, live=True)
        except errors.FormatError:
            file = self.path / self.manifest.streams[name].file
            if file.stat().st_size >= blockfile.HEADER_SIZE:
                raise
            return None  # the recorder has created the file, not written it

    def frame_source(self, stream: str = "body_pose") -> _PoseFrameSource:
        """Returns a viewer-ready source of pose frames.

        For a recording run this refreshes the rollout first, and the
        source's ``n_frames`` then follows each :meth:`refresh`.

        Args:
            stream: A pose stream; ``body_pose`` by default.

        Returns:
            An object with ``n_frames``, ``n_envs``, ``dt`` and
            ``read(t0, t1) -> [t1 - t0, E, B, 7]``.

        Raises:
            ValueError: If the stream is not a pose stream.
        """
        info = self.manifest.streams.get(stream)
        if info is not None and info.kind != "pose":
            raise ValueError(f"stream {stream!r} is {info.kind}, not pose")
        if self.is_recording:
            self.refresh()
        return _PoseFrameSource(
            self, self.stream(stream), self.dt, self.env_origins
        )

    def reload_annotations(self) -> annotations.Annotations:
        """Re-reads the curation sidecar from disk, dropping unsaved edits.

        Returns:
            The freshly loaded annotations, which :attr:`annotations` returns
            from then on.
        """
        self._annotations = None
        return self.annotations

    @property
    def annotations(self) -> annotations.Annotations:
        """The run's curation sidecar (loaded once; call ``save()``)."""
        if self._annotations is None:
            self._annotations = annotations.Annotations.load(
                self.path, self.manifest.id, self.dt, self.n_frames
            )
        return self._annotations

    def close(self) -> None:
        """Releases every open block file."""
        with self._lock:
            for reader in self._readers.values():
                reader.close()
            self._readers.clear()

    def __enter__(self) -> "Rollout":
        """Returns the rollout."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        """Closes the rollout."""
        self.close()


@dataclasses.dataclass(frozen=True)
class RecoverReport:
    """What :meth:`Library.recover` did.

    Attributes:
        name: Run name.
        n_frames: Frames in the recovered run.
        already_complete: True if the run was finished and left untouched.
        streams: Frames each stream held before they were aligned.
        dropped_frames: Frames removed from streams that were ahead of the
            shortest one (a crash between two streams' writes).
    """

    name: str
    n_frames: int
    already_complete: bool
    streams: Mapping[str, int]
    dropped_frames: int


class Library:
    """A folder of rollouts.

    Attributes:
        root: The library folder.
    """

    def __init__(self, root: os.PathLike[str] | str) -> None:
        """Creates a handle. Nothing is created on disk yet.

        Args:
            root: The library folder; it and its layout are created by the
                first recording.
        """
        self.root = pathlib.Path(root)
        self._index = index.Index(self.root)

    @property
    def runs_dir(self) -> pathlib.Path:
        """The ``runs/`` folder."""
        return self.root / "runs"

    def run_dir(self, name: str) -> pathlib.Path:
        """Returns a run's folder (which may not exist).

        Raises:
            ValueError: If the name is invalid.
        """
        return self.runs_dir / manifest.validate_run_name(name)

    def record(
        self,
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
        encode_threads: int | None = None,
        created: str | None = None,
    ) -> recorder.Recorder:
        """Starts recording a run.

        Use the result as a context manager, calling ``add_stream`` for
        extra streams and ``log`` once per step.

        Args:
            name: Run name, ``[A-Za-z0-9][A-Za-z0-9._-]{0,127}``.
            scene: The static scene.
            dt: Seconds between frames.
            n_envs: Number of parallel envs.
            env_origins: World offset per env, ``[n_envs, 3]``.
            source: Provenance, for example from ``mujoco.source_info()``.
            tags: Record-time tags.
            meta: Free-form JSON metadata.
            codec: Pose codec, ``"f32s"`` (lossless) or ``"q16d"``.
            block_frames: Frames per block.
            overwrite: Replace an existing run (deletes its folder).
            encode_threads: Threads the writer spreads per-env encoding over;
                ``None`` chooses from the env count.
            created: Recording time (UTC, ``YYYY-MM-DDTHH:MM:SSZ``);
                ``None`` means now. Importers pass the original time.

        Returns:
            The recorder.

        Raises:
            ValueError: If an argument is invalid.
            FileExistsError: If the run exists and ``overwrite`` is false.
        """
        return recorder.Recorder(
            self.root,
            name,
            scene=scene,
            dt=dt,
            n_envs=n_envs,
            env_origins=env_origins,
            source=source,
            tags=tags,
            meta=meta,
            codec=codec,
            block_frames=block_frames,
            overwrite=overwrite,
            encode_threads=encode_threads,
            created=created,
        )

    def open(self, name: str) -> Rollout:
        """Opens a run for reading.

        Args:
            name: Run name.

        Returns:
            The rollout.

        Raises:
            FileNotFoundError: If there is no such run.
            errors.FormatError: If its manifest is invalid.
        """
        return Rollout(self.root, name)

    def rename(self, old: str, new: str) -> None:
        """Renames a run.

        A run is known by its folder name and the ``name`` in its manifest;
        its ``id`` never changes, so annotations, groups, the derived cache
        and exports keep belonging to it. Only ``rollout.json`` is
        rewritten (atomically); streams, scenes and assets are untouched.
        If the folder cannot be renamed, the manifest is put back.

        :class:`Rollout` objects opened before the rename keep pointing at
        the old folder; reopen the run with :meth:`open`.

        Args:
            old: The run's current name.
            new: The new name, ``[A-Za-z0-9][A-Za-z0-9._-]{0,127}``.

        Raises:
            ValueError: If a name is invalid or the run is still recording.
            FileNotFoundError: If there is no run ``old``.
            FileExistsError: If a run ``new`` exists.
            OSError: If the folder cannot be renamed (for example on
                Windows while a file in it is open).
            errors.FormatError: If the manifest is invalid.
        """
        old_dir, new_dir = self.run_dir(old), self.run_dir(new)
        if not old_dir.is_dir():
            raise FileNotFoundError(f"no run {old!r} in {self.root}")
        if not (old_dir / manifest.MANIFEST_NAME).is_file():
            raise ValueError(f"run {old!r} is still recording")
        # On a case-insensitive filesystem a case-only rename names the same
        # folder; that is a rename, not a clash.
        if os.path.lexists(new_dir) and (
            old == new or not old_dir.samefile(new_dir)
        ):
            raise FileExistsError(f"run {new!r} already exists")
        from simscope import derived  # circular at module level

        m = manifest.read_manifest(old_dir)
        with Rollout(self.root, old) as run:
            before = derived.fingerprint(run)
        m.name = new
        m.validate()
        cas.atomic_write(
            old_dir / manifest.MANIFEST_NAME, manifest.manifest_bytes(m)
        )
        try:
            os.rename(old_dir, new_dir)
        except OSError:
            m.name = old
            cas.atomic_write(
                old_dir / manifest.MANIFEST_NAME, manifest.manifest_bytes(m)
            )
            raise
        try:
            with Rollout(self.root, new) as run:
                derived.carry_over(self.root, run, before)
        except Exception:  # isolation point: a cold cache is only slower
            logger.warning("derived cache of %r not carried over", new)
        self._index.refresh()
        logger.info("renamed run %r to %r", old, new)

    # -- browsing --

    def refresh(self) -> index.RefreshStats:
        """Rescans ``runs/`` and updates the index (incrementally)."""
        return self._index.refresh()

    def runs(self, refresh: bool = True) -> list[RunInfo]:
        """Lists every run, newest first.

        Args:
            refresh: Update the index first (cheap when nothing changed).

        Returns:
            One summary per run.
        """
        return self.query(limit=None, refresh=refresh)

    def query(
        self,
        text: str | None = None,
        tags: Iterable[str] = (),
        favorite: bool | None = None,
        status: str | None = None,
        sort: str = "created",
        descending: bool = True,
        limit: int | None = 50,
        offset: int = 0,
        *,
        refresh: bool = True,
    ) -> list[RunInfo]:
        """Searches the index. See :meth:`simscope.index.Index.query`.

        Args:
            text: Terms that must all appear in name, tags, group or notes.
            tags: Record-time tags a run must have (all of them).
            favorite: Only runs with this favorite mark.
            status: Manifest status to match (``"recording"``,
                ``"complete"``).
            sort: ``"created"``, ``"name"``, ``"n_frames"`` or ``"rating"``.
            descending: Sort direction.
            limit: Page size, or ``None`` for all.
            offset: Rows to skip.
            refresh: Update the index first.

        Returns:
            The matching page of run summaries. The ``n_frames`` of a run
            that is still recording counts the windows written so far, since
            the recorder rewrites its partial manifest after each window.
        """
        if refresh:
            self._index.refresh()
        rows = self._index.query(
            text, tags, favorite, status, sort, descending, limit, offset
        )
        return rows

    def count(
        self,
        text: str | None = None,
        tags: Iterable[str] = (),
        favorite: bool | None = None,
        status: str | None = None,
        *,
        refresh: bool = True,
    ) -> int:
        """Counts runs matching the filters of :meth:`query`."""
        if refresh:
            self._index.refresh()
        return self._index.count(text, tags, favorite, status)

    def close(self) -> None:
        """Closes the index connection (it reopens on demand)."""
        self._index.close()

    # -- event types --

    def event_types(self) -> dict[str, annotations.EventType]:
        """Returns the event vocabulary (the built-in one if unset)."""
        return annotations.load_event_types(self.root)[0]

    def set_event_types(
        self,
        types: Mapping[str, annotations.EventType]
        | Iterable[annotations.EventType],
    ) -> None:
        """Writes ``.simscope/event_types.json``.

        Args:
            types: Entries by id, or an iterable of entries (keyed by their
                ``type_id``). Unknown fields already in the file are kept.
        """
        if isinstance(types, Mapping):
            entries = dict(types)
        else:
            entries = {t.type_id: t for t in types}
        _, extra = annotations.load_event_types(self.root)
        annotations.save_event_types(self.root, entries, extra)

    # -- recovery --

    def recover(self, name: str) -> RecoverReport:
        """Repairs a run whose recording crashed.

        Every block file is recovered (complete windows kept, the rest cut
        off), streams are aligned to the shortest one, and the manifest is
        rewritten as ``"complete"``. A finished run is left untouched.
        Do not call it while a recorder is still writing the run.

        Args:
            name: Run name.

        Returns:
            What was kept.

        Raises:
            FileNotFoundError: If the run or its manifest is missing.
            errors.FormatError: If the manifest is invalid.
        """
        run_dir = self.run_dir(name)
        if (run_dir / manifest.MANIFEST_NAME).exists():
            cas.remove_file(run_dir / manifest.PARTIAL_NAME)
            m = manifest.read_manifest(run_dir)
            return RecoverReport(name, m.n_frames, True, {}, 0)
        m = manifest.read_manifest(run_dir)
        frames: dict[str, int] = {}
        for sname, info in m.streams.items():
            frames[sname] = _recover_stream(run_dir / info.file)
        # An unusable stream (-1) has no frames, so nothing can be kept.
        common = max(0, min(frames.values(), default=0))
        dropped = 0
        for sname, info in m.streams.items():
            path = run_dir / info.file
            if frames[sname] < 0:
                _write_empty(path, info, m.n_envs)
                frames[sname] = 0
            elif frames[sname] > common:
                dropped += frames[sname] - common
                _truncate_stream(path, common)
        m.n_frames = common
        m.status = "complete"
        manifest.write_manifest(run_dir, m, partial=False)
        logger.info("recovered run %r: %d frames", name, common)
        return RecoverReport(name, common, False, frames, dropped)


def _recover_stream(path: pathlib.Path) -> int:
    """Recovers one block file.

    Returns:
        Frames kept, or -1 if the file is missing or has no valid header.
    """
    try:
        return blockfile.recover(path).n_frames
    except (FileNotFoundError, errors.FormatError) as exc:
        logger.warning("cannot recover %s: %s", path, exc)
        return -1


def _write_empty(
    path: pathlib.Path, info: manifest.StreamInfo, n_envs: int
) -> None:
    """Replaces an unusable block file with an empty finished one."""
    with blockfile.BlockWriter(
        path, item_shape=info.item_shape, n_envs=n_envs, kind=info.kind
    ):
        pass  # leaving the block finalizes an empty stream


def _truncate_stream(path: pathlib.Path, n_frames: int) -> None:
    """Cuts a finished block file back to its first ``n_frames`` frames.

    ``n_frames`` must fall on a window boundary (or the end of the file).
    """
    with blockfile.BlockReader(path, verify=False) as reader:
        directory = reader.directory
        shape, n_envs = reader.item_shape, reader.n_envs
        block_frames = reader.block_frames
    keep = int(np.count_nonzero(directory["t0"] < n_frames))
    end = int(directory["offset"][keep]) if keep < len(directory) else 0
    if end == 0:
        return
    body = directory[:keep].tobytes()
    header = blockfile.Header(
        shape, n_envs, n_frames, block_frames, keep, end, len(body)
    )
    with open(path, "r+b") as f:
        f.truncate(end)
        f.seek(end)
        f.write(body)
        f.seek(0)
        f.write(header.pack())
