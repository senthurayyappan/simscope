"""SQLite index cache over ``rollout.json`` and ``annotations.json``.

The index lives at ``<library>/.simscope/index.sqlite``. It is a disposable
cache (decision D8): the sidecars stay the source of truth, and a missing,
corrupt or out-of-date-schema file is dropped and rebuilt on the next scan.

``Index.refresh`` finds every rollout library under the root, a direct
``runs/`` folder or one nested further down, and re-reads only runs whose
files changed.
"""

import dataclasses
import json
import logging
import os
import pathlib
import sqlite3
import threading
from collections.abc import Iterable, Sequence
from typing import Any

from simscope import discover
from simscope.io import manifest

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 3
Signature = tuple[int, int, int, int, int]
"""``(m_mtime, m_size, m_partial, a_mtime, a_size)`` of a run."""
INVALID = "invalid"
"""Status shown for a run whose ``rollout.json`` could not be read."""

_SCHEMA = """
CREATE TABLE runs (
    name TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    created TEXT NOT NULL,
    status TEXT NOT NULL,
    dt REAL NOT NULL,
    n_frames INTEGER NOT NULL,
    n_envs INTEGER NOT NULL,
    n_bodies INTEGER NOT NULL,
    scene_hash TEXT NOT NULL,
    favorite INTEGER NOT NULL,
    grp TEXT,
    n_events INTEGER NOT NULL,
    n_notes INTEGER NOT NULL,
    rating REAL,
    tags TEXT NOT NULL,
    hay TEXT NOT NULL,
    m_mtime INTEGER NOT NULL,
    m_size INTEGER NOT NULL,
    m_partial INTEGER NOT NULL,
    a_mtime INTEGER NOT NULL,
    a_size INTEGER NOT NULL,
    lib_rel TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE run_tags (
    tag TEXT NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (tag, name)
) WITHOUT ROWID;
CREATE INDEX runs_created ON runs (created);
"""

_COLUMNS = [
    *("name", "id", "created", "status", "dt", "n_frames", "n_envs"),
    *("n_bodies", "scene_hash", "favorite", "grp"),
    *("n_events", "n_notes", "rating", "tags", "hay", "m_mtime", "m_size"),
    *("m_partial", "a_mtime", "a_size", "lib_rel"),
]
_UPSERT = (
    f"INSERT OR REPLACE INTO runs ({', '.join(_COLUMNS)}) "
    f"VALUES ({', '.join('?' * len(_COLUMNS))})"
)
_INFO_COLUMNS = _COLUMNS[:15]
_SORTS = {
    "created": "created {d}, name",
    "name": "name {d}",
    "n_frames": "n_frames {d}, name",
    "rating": "rating IS NULL, rating {d}, name",
}


@dataclasses.dataclass(frozen=True)
class RunInfo:
    """Summary of one rollout, as browsing needs it.

    Attributes:
        name: Run name (the directory name).
        id: The run's ULID.
        created: UTC creation time.
        status: ``"recording"``, ``"complete"`` or ``"invalid"`` (the
            manifest could not be read).
        dt: Seconds per frame.
        n_frames: Frames per stream.
        n_envs: Envs per stream.
        n_bodies: Bodies per pose.
        scene_hash: SHA-256 of the scene descriptor.
        favorite: Whether the run is starred.
        group: Name of the group the run belongs to, or ``None``.
        n_events: Number of events.
        n_notes: Number of notes.
        rating: Mean ``overall`` rating, or ``None``.
        tags: Record-time tags, sorted and unique. (Curation tags, a
            deprecated field of the sidecar, are not indexed.)
    """

    name: str
    id: str
    created: str
    status: str
    dt: float
    n_frames: int
    n_envs: int
    n_bodies: int
    scene_hash: str
    favorite: bool
    group: str | None
    n_events: int
    n_notes: int
    rating: float | None
    tags: tuple[str, ...]


@dataclasses.dataclass(frozen=True)
class RefreshStats:
    """What a refresh did.

    Attributes:
        added: Runs seen for the first time.
        updated: Runs whose files changed.
        removed: Runs that vanished.
        unchanged: Runs skipped because their stat signature matched.
    """

    added: int = 0
    updated: int = 0
    removed: int = 0
    unchanged: int = 0


def _stat(path: str) -> tuple[int, int]:
    """Returns ``(mtime_ns, size)``, or ``(0, -1)`` if the file is missing."""
    try:
        st = os.stat(path)
    except OSError:
        return 0, -1
    return st.st_mtime_ns, st.st_size


def _read_json(path: str) -> Any:
    """Reads a JSON file, returning ``None`` if it is missing or invalid."""
    try:
        with open(path, "rb") as f:
            return json.loads(f.read())
    except (OSError, ValueError):
        return None


def _summarize_annotations(obj: Any) -> tuple[Any, ...]:
    """Extracts marks, counts and rating from a parsed annotations file.

    Returns:
        ``(favorite, group, n_events, notes, rating)``.
    """
    if not isinstance(obj, dict):
        return False, None, 0, [], None
    marks = obj.get("marks")
    marks = marks if isinstance(marks, dict) else {}
    notes = [
        n["text"]
        for n in obj.get("notes") or ()
        if isinstance(n, dict) and isinstance(n.get("text"), str)
    ]
    overall = [
        r["value"]
        for r in obj.get("ratings") or ()
        if isinstance(r, dict)
        and r.get("criterion", "overall") == "overall"
        and isinstance(r.get("value"), int | float)
    ]
    events = obj.get("events")
    group = marks.get("group")
    return (
        bool(marks.get("favorite", False)),
        group if isinstance(group, str) and group else None,
        len(events) if isinstance(events, list) else 0,
        notes,
        sum(overall) / len(overall) if overall else None,
    )


def _row(
    name: str,
    m_path: str,
    signature: Signature,
    a_path: str,
) -> tuple[tuple[Any, ...], list[str]]:
    """Builds the index row for one run from its files.

    Args:
        name: Run directory name.
        m_path: Path of ``rollout.json`` or ``rollout.json.partial``.
        signature: ``(m_mtime, m_size, m_partial, a_mtime, a_size)``.
        a_path: Path of ``annotations.json``.

    Returns:
        ``(row, tags)`` where ``row`` follows ``_COLUMNS``.
    """
    obj = _read_json(m_path)
    try:
        if not isinstance(obj, dict):
            raise ValueError("not a JSON object")
        fmt = obj["format"]
        if not fmt.startswith("simscope-rollout/1"):
            raise ValueError(f"unknown format {fmt!r}")
        head: tuple[Any, ...] = (
            str(obj["id"]),
            str(obj["created"]),
            str(obj["status"]),
            float(obj["dt"]),
            int(obj["n_frames"]),
            int(obj["n_envs"]),
            int(obj["n_bodies"]),
            str(obj["scene"]["sha256"]),
        )
        record_tags = [str(t) for t in obj.get("tags") or ()]
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        logger.warning("%s: unreadable manifest: %s", m_path, exc)
        head = ("", "", INVALID, 0.0, 0, 0, 0, "")
        record_tags = []
    fav, group, n_events, notes, rating = _summarize_annotations(
        _read_json(a_path) if signature[4] >= 0 else None
    )
    tags = sorted(set(record_tags))
    hay = "\n".join([name, *tags, *([group] if group else []), *notes]).lower()
    row = (
        name,
        *head,
        int(fav),
        group,
        n_events,
        len(notes),
        rating,
        json.dumps(tags),
        hay,
        *signature,
    )
    return row, tags


def _like(term: str) -> str:
    r"""Escapes a search term for ``LIKE ... ESCAPE '\'``."""
    escaped = term.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped.lower()}%"


class Index:
    """The scan cache of one library.

    Thread-safe: a lock serializes access to the SQLite connection. If the
    cache cannot be created on disk (for example a read-only library) it
    falls back to an in-memory database.

    Attributes:
        root: The library root.
        path: The index file.
    """

    def __init__(self, root: os.PathLike[str] | str) -> None:
        """Creates a handle. The database opens lazily.

        Args:
            root: The library root.
        """
        self.root = pathlib.Path(root)
        self.path = self.root / ".simscope" / "index.sqlite"
        self._conn: sqlite3.Connection | None = None
        self._lock = threading.RLock()
        self._looked = False

    # -- connection management --

    def _connect(self) -> sqlite3.Connection:
        """Returns the open connection, creating or rebuilding as needed."""
        if self._conn is not None:
            return self._conn
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._open(str(self.path))
        except sqlite3.DatabaseError:
            logger.warning("dropping corrupt index %s", self.path)
            self._drop_files()
            conn = self._open(str(self.path))
        except OSError as exc:
            logger.warning("index unavailable (%s); using memory", exc)
            conn = self._open(":memory:")
        self._conn = conn
        return conn

    def _open(self, target: str) -> sqlite3.Connection:
        """Opens a database and makes sure the schema is current."""
        conn = sqlite3.connect(
            target, check_same_thread=False, isolation_level=None, timeout=30
        )
        try:
            if target != ":memory:":
                conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            version = conn.execute("PRAGMA user_version").fetchone()[0]
            if version != SCHEMA_VERSION:
                if version != 0:
                    logger.info("index schema %d is stale; rebuilding", version)
                self._reset_schema(conn)
            else:
                conn.execute("SELECT COUNT(*) FROM runs").fetchone()
        except sqlite3.DatabaseError:
            conn.close()
            raise
        return conn

    @staticmethod
    def _reset_schema(conn: sqlite3.Connection) -> None:
        """Drops every table and creates the current schema."""
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute("DROP TABLE IF EXISTS runs")
            conn.execute("DROP TABLE IF EXISTS run_tags")
            for stmt in _SCHEMA.split(";"):
                if stmt.strip():
                    conn.execute(stmt)
            conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise

    def _absent(self) -> bool:
        """True if nothing was ever indexed (so queries need not create it)."""
        return self._conn is None and not self.path.exists()

    def _drop_files(self) -> None:
        """Deletes the database file and its WAL companions."""
        for suffix in ("", "-wal", "-shm"):
            pathlib.Path(str(self.path) + suffix).unlink(missing_ok=True)

    def close(self) -> None:
        """Closes the connection. The index reopens on the next use."""
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None

    def rebuild(self) -> RefreshStats:
        """Drops every row and rescans all runs."""
        with self._lock:
            self._reset_schema(self._connect())
            return self.refresh()

    # -- refresh --

    def refresh(self) -> RefreshStats:
        """Brings the index up to date with the rollouts under ``root``.

        Finds every library under the root, not only ``root/runs``, then
        stats each run's manifest and annotations file. Only runs whose
        mtime, size or library changed are re-read. The database update
        happens in one transaction.

        Returns:
            Counts of added, updated, removed and unchanged runs.
        """
        self._looked = True
        found = discover.find_runs(self.root)
        if not found and self._conn is None and not self.path.exists():
            return RefreshStats()
        with self._lock:
            return self._refresh(found)

    def _refresh(self, found: list[discover.FoundRun]) -> RefreshStats:
        """Implements :meth:`refresh` with the lock held."""
        conn = self._connect()
        known = {
            row[0]: (tuple(row[1:6]), row[6])
            for row in conn.execute(
                "SELECT name, m_mtime, m_size, m_partial, a_mtime, a_size, "
                "lib_rel FROM runs"
            )
        }
        seen: set[str] = set()
        changed: list[tuple[str, str, Signature, str, str]] = []
        added = unchanged = 0
        for run in found:
            lib_rel = discover.rel_library(self.root, run.library)
            d = str(run.run_dir) + os.sep
            m_path = d + manifest.MANIFEST_NAME
            m_mtime, m_size = _stat(m_path)
            partial = 0
            if m_size < 0:
                m_path = d + manifest.PARTIAL_NAME
                m_mtime, m_size = _stat(m_path)
                if m_size < 0:
                    continue  # not a run (yet)
                partial = 1
            a_path = d + "annotations.json"
            a_mtime, a_size = _stat(a_path)
            sig: Signature = (m_mtime, m_size, partial, a_mtime, a_size)
            seen.add(run.name)
            old = known.get(run.name)
            if old == (sig, lib_rel):
                unchanged += 1
                continue
            added += old is None
            changed.append((run.name, m_path, sig, a_path, lib_rel))
        removed = [n for n in known if n not in seen]
        if not changed and not removed:
            return RefreshStats(unchanged=unchanged)
        rows, tag_rows = [], []
        for name, m_path, sig, a_path, lib_rel in changed:
            row, tags = _row(name, m_path, sig, a_path)
            rows.append((*row, lib_rel))
            tag_rows += [(t, name) for t in tags]
        conn.execute("BEGIN IMMEDIATE")
        try:
            if removed:
                _delete_names(conn, removed)
            if changed:
                _delete_names(conn, [c[0] for c in changed], runs=False)
                conn.executemany(_UPSERT, rows)
                conn.executemany("INSERT INTO run_tags VALUES (?, ?)", tag_rows)
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        return RefreshStats(
            added, len(changed) - added, len(removed), unchanged
        )

    # -- queries --

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
    ) -> list[RunInfo]:
        """Returns matching runs.

        Args:
            text: Whitespace-separated terms; a run must contain every term
                (case-insensitive) in its name, tags, group or note text.
            tags: Record-time tags a run must have (all of them).
            favorite: If set, only runs with this favorite mark.
            status: If set, only runs whose manifest status
                (``"recording"``, ``"complete"``) equals it.
            sort: ``"created"``, ``"name"``, ``"n_frames"`` or ``"rating"``
                (runs without a rating sort last).
            descending: Sort direction.
            limit: Maximum rows, or ``None`` for all.
            offset: Rows to skip.

        Returns:
            The page of runs.

        Raises:
            ValueError: If ``sort`` is unknown.
        """
        if sort not in _SORTS:
            raise ValueError(f"sort must be one of {sorted(_SORTS)}")
        where, params = _filters(text, tags, favorite, status)
        order = _SORTS[sort].format(d="DESC" if descending else "ASC")
        sql = (
            f"SELECT {', '.join(_INFO_COLUMNS)} FROM runs{where} "
            f"ORDER BY {order} LIMIT ? OFFSET ?"
        )
        params += [-1 if limit is None else int(limit), max(0, int(offset))]
        with self._lock:
            if self._absent():
                return []
            rows = self._connect().execute(sql, params).fetchall()
        return [_info(r) for r in rows]

    def count(
        self,
        text: str | None = None,
        tags: Iterable[str] = (),
        favorite: bool | None = None,
        status: str | None = None,
    ) -> int:
        """Returns how many runs match the filters of :meth:`query`."""
        where, params = _filters(text, tags, favorite, status)
        with self._lock:
            if self._absent():
                return 0
            sql = f"SELECT COUNT(*) FROM runs{where}"
            return self._connect().execute(sql, params).fetchone()[0]

    def get(self, name: str) -> RunInfo | None:
        """Returns one run's summary, or ``None`` if it is not indexed."""
        with self._lock:
            if self._absent():
                return None
            row = (
                self._connect()
                .execute(
                    f"SELECT {', '.join(_INFO_COLUMNS)} FROM runs "
                    "WHERE name = ?",
                    (name,),
                )
                .fetchone()
            )
        return None if row is None else _info(row)

    def owner(self, name: str, *, scan: bool = False) -> pathlib.Path | None:
        """Returns the library root that holds ``name``, or ``None``.

        Args:
            name: Run name.
            scan: When the run is missing from the index, scan once. Further
                calls do not scan again until :meth:`refresh`.

        Returns:
            The library folder recorded for that run. ``None`` when the run
            is not indexed. This does not create an index just to answer,
            unless ``scan`` finds runs and therefore writes the cache.
        """
        rel = self._lib_rel(name)
        if rel is None and scan and not self._looked:
            self.refresh()
            rel = self._lib_rel(name)
        if rel is None:
            return None
        return self.root if rel == "" else self.root.joinpath(rel)

    def owners(self) -> list[pathlib.Path]:
        """Returns nested library folders that hold indexed runs.

        The index root itself is omitted: its runs live in its ``runs/``.

        Returns:
            Those folders, in path order.
        """
        with self._lock:
            if self._absent():
                return []
            rows = (
                self._connect()
                .execute(
                    "SELECT DISTINCT lib_rel FROM runs WHERE lib_rel != ''"
                )
                .fetchall()
            )
        return [self.root.joinpath(rel) for rel in sorted(r[0] for r in rows)]

    def _lib_rel(self, name: str) -> str | None:
        """Returns the stored library path of ``name``, or ``None``."""
        with self._lock:
            if self._absent():
                return None
            row = (
                self._connect()
                .execute("SELECT lib_rel FROM runs WHERE name = ?", (name,))
                .fetchone()
            )
        return None if row is None else row[0]


def _delete_names(
    conn: sqlite3.Connection, names: Sequence[str], *, runs: bool = True
) -> None:
    """Deletes runs (and their tags) by name, in batches."""
    for i in range(0, len(names), 500):
        batch = list(names[i : i + 500])
        marks = ",".join("?" * len(batch))
        conn.execute(f"DELETE FROM run_tags WHERE name IN ({marks})", batch)
        if runs:
            conn.execute(f"DELETE FROM runs WHERE name IN ({marks})", batch)


def _filters(
    text: str | None,
    tags: Iterable[str],
    favorite: bool | None,
    status: str | None,
) -> tuple[str, list[Any]]:
    """Builds a parameterized WHERE clause."""
    clauses: list[str] = []
    params: list[Any] = []
    for term in (text or "").split():
        clauses.append("hay LIKE ? ESCAPE '\\'")
        params.append(_like(term))
    tag_list = sorted(set(tags))
    if tag_list:
        marks = ",".join("?" * len(tag_list))
        clauses.append(
            "name IN (SELECT name FROM run_tags WHERE tag IN "
            f"({marks}) GROUP BY name HAVING COUNT(*) = ?)"
        )
        params += [*tag_list, len(tag_list)]
    if favorite is not None:
        clauses.append("favorite = ?")
        params.append(int(favorite))
    if status is not None:
        clauses.append("status = ?")
        params.append(status)
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params


def _info(row: Sequence[Any]) -> RunInfo:
    """Converts a database row (``_INFO_COLUMNS`` order) to a RunInfo."""
    r = list(row)
    r[9] = bool(r[9])
    r[14] = tuple(json.loads(r[14]))
    return RunInfo(*r)
