"""Background computation of derived files (contracts 2 and 5).

A request for ``derived/<run>/...`` never blocks: it is answered at once from
the cache, or a job is queued on a small pool and the request gets "pending"
until the file exists. Jobs for one file are never queued twice, and a job
that failed is remembered (for that manifest) so a broken run is reported
instead of retried on every poll.
"""

import concurrent.futures
import enum
import logging
import pathlib
import threading

from simscope import derived
from simscope.io import errors
from simscope.server import state as state_mod

logger = logging.getLogger(__name__)

WORKERS = 2
"""Derived passes that may run at once."""


class Status(enum.Enum):
    """Outcome of asking for a derived file."""

    READY = "ready"
    PENDING = "pending"
    MISSING = "missing"  # no such run
    NOT_APPLICABLE = "not_applicable"
    FAILED = "failed"


class Jobs:
    """Runs derived-data passes on a thread pool."""

    def __init__(self, state: state_mod.LibraryState, workers: int = WORKERS):
        """Creates the pool.

        Args:
            state: The library state, told when highlights are counted.
            workers: Pool size (at most 2 is sensible: a pass is already
                multi-threaded inside).
        """
        self._state = state
        self._pool = concurrent.futures.ThreadPoolExecutor(
            min(workers, WORKERS), thread_name_prefix="simscope-derived"
        )
        self._pending: dict[
            tuple[str, str, str], concurrent.futures.Future
        ] = {}
        self._failed: dict[tuple[str, str, str], str] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._warmer: threading.Thread | None = None

    def request(
        self, run: str, what: str
    ) -> tuple[Status, pathlib.Path | str | None]:
        """Returns a derived file if it is ready, else queues its job.

        Args:
            run: Run name.
            what: Path relative to ``derived/<run>/``.

        Returns:
            ``(status, value)``: the file path for ``READY``, an error
            message for ``FAILED``, otherwise ``None``.
        """
        try:
            rollout = self._state.lib.open(run)
        except FileNotFoundError:
            return Status.MISSING, None
        except errors.FormatError as exc:
            return Status.FAILED, str(exc)
        try:
            if not derived.applicable(rollout, what):
                return Status.NOT_APPLICABLE, None
            cache = derived.cache_dir(self._state.root, rollout)
            path = derived.fresh(rollout, cache, what)
            if path is not None:
                return Status.READY, path
            key = (rollout.manifest.id, what, derived.manifest_digest(rollout))
        finally:
            rollout.close()
        with self._lock:
            if key in self._failed:
                return Status.FAILED, self._failed[key]
            if key not in self._pending:
                future = self._pool.submit(self._run, run, what, key)
                self._pending[key] = future
        return Status.PENDING, None

    def _run(self, run: str, what: str, key: tuple[str, str, str]) -> None:
        """Computes one derived file (worker thread)."""
        try:
            self.compute(run, what)
        except Exception as exc:
            logger.exception("deriving %s for %s failed", what, run)
            with self._lock:
                self._failed[key] = f"{type(exc).__name__}: {exc}"
        finally:
            with self._lock:
                self._pending.pop(key, None)

    def compute(self, run: str, what: str) -> pathlib.Path | None:
        """Computes a derived file now, in the calling thread.

        Args:
            run: Run name.
            what: Path relative to ``derived/<run>/``.

        Returns:
            The file path, or ``None`` if not applicable.
        """
        rollout = self._state.lib.open(run)
        try:
            cache = derived.cache_dir(self._state.root, rollout)
            path = derived.ensure(rollout, cache, what)
            if what == derived.HIGHLIGHTS and path is not None:
                count = derived.highlight_count(cache)
                if count is not None:
                    self._state.set_highlights(run, count)
            return path
        finally:
            rollout.close()

    def start_warmer(self) -> None:
        """Computes highlights of every complete run in the background.

        Newest first, one run at a time, so the library's highlight counts
        fill in without competing with what the user is looking at.
        """
        if self._warmer is None:
            self._warmer = threading.Thread(
                target=self._warm, name="simscope-warm", daemon=True
            )
            self._warmer.start()

    def _warm(self) -> None:
        """Worker for :meth:`start_warmer`."""
        names = [
            name
            for name, info in self._state.snapshot()
            if info.status == "complete"
        ]
        for name in names:
            if self._stop.is_set():
                return
            try:
                self.compute(name, derived.HIGHLIGHTS)
            except Exception:
                logger.exception("highlights for %s failed", name)

    def stop(self) -> None:
        """Stops the warmer and waits for running passes."""
        self._stop.set()
        if self._warmer is not None:
            self._warmer.join(timeout=2)
        self._pool.shutdown(wait=False, cancel_futures=True)
