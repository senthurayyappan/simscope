"""Find rollout libraries under a folder.

``ls``, ``serve`` and ``export`` take a directory. That directory may be one
library (``DIR/runs/<name>/``) or a folder that contains libraries further
down, one per finished run. :func:`find_runs` returns every rollout either
way.

Search does not follow symlinks. Inside a library it does not enter
``runs/``, ``scenes/`` or ``assets/``: those hold that library's own data,
not another library. A directory of the same name that is not inside a
library is still searched.
"""

import dataclasses
import logging
import os
import pathlib
from collections import deque

from simscope.io import manifest

logger = logging.getLogger(__name__)

_LIBRARY_SKIP = frozenset({"runs", "scenes", "assets"})
"""Directories inside a library that hold its data, not nested libraries."""


@dataclasses.dataclass(frozen=True)
class FoundRun:
    """One rollout found under a folder.

    Attributes:
        name: Run directory name.
        library: Library root that owns the run (the parent of ``runs/``).
        run_dir: The run directory.
    """

    name: str
    library: pathlib.Path
    run_dir: pathlib.Path


def find_runs(root: os.PathLike[str] | str) -> list[FoundRun]:
    """Returns every rollout library under ``root``, including ``root``.

    A rollout is ``<library>/runs/<name>/`` with ``rollout.json`` or
    ``rollout.json.partial``. ``library`` may be ``root`` or a subdirectory.
    Shallower libraries win when two runs share a name, and ``root`` itself
    wins over a descendant. At the same depth the lexicographically smaller
    relative path wins. The skipped run is logged.

    Args:
        root: Directory to search. A missing directory yields no runs.

    Returns:
        The runs, in discovery order.
    """
    start = pathlib.Path(root)
    found: dict[str, FoundRun] = {}
    order: list[str] = []
    queue: deque[pathlib.Path] = deque((start,))
    while queue:
        current = queue.popleft()
        entries = _entries(current)
        runs = next((entry for entry in entries if entry.name == "runs"), None)
        is_library = runs is not None and _is_dir(runs)
        if is_library and runs is not None:
            _collect(current, pathlib.Path(runs.path), found, order)
        skip = _LIBRARY_SKIP if is_library else frozenset()
        children = [
            entry
            for entry in entries
            if entry.name not in skip and _descend(entry)
        ]
        for entry in sorted(children, key=lambda item: item.name):
            queue.append(pathlib.Path(entry.path))
    return [found[name] for name in order]


def by_name(root: os.PathLike[str] | str) -> dict[str, FoundRun]:
    """Returns :func:`find_runs` keyed by run name.

    Args:
        root: Directory to search.

    Returns:
        One entry per run name. Collisions keep the winner of
        :func:`find_runs`.
    """
    return {run.name: run for run in find_runs(root)}


def rel_library(root: pathlib.Path, library: pathlib.Path) -> str:
    """Returns ``library`` relative to ``root``, or ``""`` when they match.

    Args:
        root: The directory that was searched.
        library: A library root returned by :func:`find_runs`.

    Returns:
        A forward-slash relative path, or an empty string.
    """
    if library == root:
        return ""
    return library.relative_to(root).as_posix()


def _entries(path: pathlib.Path) -> list[os.DirEntry[str]]:
    """Lists ``path``, or nothing if it cannot be read."""
    try:
        with os.scandir(path) as scan:
            return list(scan)
    except OSError:
        return []


def _is_dir(entry: os.DirEntry[str]) -> bool:
    """Tells whether ``entry`` is a directory, without following links."""
    try:
        return entry.is_dir(follow_symlinks=False)
    except OSError:
        return False


def _descend(entry: os.DirEntry[str]) -> bool:
    """Tells whether search should enter ``entry``."""
    name = entry.name
    if not name or name[0] == ".":
        return False
    return _is_dir(entry)


def _is_run_name(name: str) -> bool:
    """Tells whether ``name`` is a valid run directory name."""
    try:
        manifest.validate_run_name(name)
    except ValueError:
        return False
    return True


def _has_manifest(run_dir: pathlib.Path) -> bool:
    """Tells whether a run directory holds a manifest."""
    return (run_dir / manifest.MANIFEST_NAME).is_file() or (
        run_dir / manifest.PARTIAL_NAME
    ).is_file()


def _collect(
    library: pathlib.Path,
    runs_dir: pathlib.Path,
    found: dict[str, FoundRun],
    order: list[str],
) -> None:
    """Records the runs in one library's ``runs/`` folder."""
    entries = _entries(runs_dir)
    entries.sort(key=lambda item: item.name)
    for entry in entries:
        name = entry.name
        if not _is_dir(entry) or not _is_run_name(name):
            continue
        run_dir = pathlib.Path(entry.path)
        if not _has_manifest(run_dir):
            continue
        if name in found:
            logger.warning(
                "skipping run %r in %s; %s already has that name",
                name,
                library,
                found[name].library,
            )
            continue
        found[name] = FoundRun(name, library, run_dir)
        order.append(name)
