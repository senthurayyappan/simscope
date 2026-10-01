"""What the server knows about a library, and how it learns of changes.

One :class:`LibraryState` per app. It keeps every run's index row in memory
(the row set is small: contracts 2 says all rows, no paging), the encoded
``/api/runs`` body for the current ``seq``, and a short log of which runs
changed at which ``seq`` for ``/api/changes``. A single ``watchfiles`` thread
is the only writer of that state besides :meth:`LibraryState.touch`, which the
annotation route calls so a client sees its own write at once.
"""

import collections
import dataclasses
import gzip
import json
import logging
import os
import pathlib
import threading
import time
from collections.abc import Callable, Iterable
from typing import Any

from simscope import annotations, derived, highlights, index, library
from simscope.io import errors, manifest

logger = logging.getLogger(__name__)

_LOG_LIMIT = 512
"""Change-log entries kept; a client further behind gets a full resync."""
_WATCH_DEBOUNCE_MS = 150
_WATCH_STEP_MS = 30
_WATCH_TIMEOUT_MS = 1000
_SAFETY_RESCAN_EVERY = 5
"""Idle watcher timeouts between full rescans (a missed-event backstop)."""


@dataclasses.dataclass(frozen=True)
class Extras:
    """Row fields that the SQLite index does not hold.

    Attributes:
        simulator: ``source.simulator`` of the manifest, or ``None``.
        importer: ``source.importer`` of the manifest, or ``None``.
        streams: Stream names, in manifest order.
        n_highlights: Highlights found, or ``None`` until computed.
    """

    simulator: str | None = None
    importer: str | None = None
    streams: tuple[str, ...] = ()
    n_highlights: int | None = None


def _read_extras(run_dir: pathlib.Path) -> Extras:
    """Reads ``source`` and the stream names from a run's manifest."""
    for name in (manifest.MANIFEST_NAME, manifest.PARTIAL_NAME):
        try:
            obj = json.loads((run_dir / name).read_bytes())
        except (OSError, ValueError):
            continue
        if not isinstance(obj, dict):
            continue
        source = obj.get("source")
        source = source if isinstance(source, dict) else {}
        streams = obj.get("streams")
        simulator, importer = source.get("simulator"), source.get("importer")
        return Extras(
            simulator if isinstance(simulator, str) else None,
            importer if isinstance(importer, str) else None,
            tuple(streams) if isinstance(streams, dict) else (),
        )
    return Extras()


class GroupError(Exception):
    """A group operation the library cannot do.

    Attributes:
        status: The HTTP status that describes it: 400 for a bad name or
            index, 404 for a group that does not exist, 409 for a name that
            is taken or a ``groups.json`` that cannot be read.
    """

    def __init__(self, status: int, message: str) -> None:
        """Creates the error.

        Args:
            status: HTTP status code.
            message: What went wrong.
        """
        super().__init__(message)
        self.status = status


def _group_name(op: dict[str, Any], key: str) -> str:
    """Reads and validates a group name from an op.

    Raises:
        GroupError: With status 400 if it is missing or invalid.
    """
    try:
        return annotations.check_group_name(op.get(key))
    except ValueError as exc:
        raise GroupError(400, f"{key!r}: {exc}") from exc


def _encode(obj: Any) -> bytes:
    """Serializes compact JSON."""
    return json.dumps(obj, separators=(",", ":"), allow_nan=False).encode()


class LibraryState:
    """The in-memory view of one library directory.

    Attributes:
        root: The library folder as given.
        root_real: Its real path (symlinks resolved), for confinement.
        name: Folder name, shown as the library name.
        author: Author of annotations made through the API.
        token: The per-process token that writes must present.
        writable: Whether the folder accepts writes.
        lib: The :class:`simscope.library.Library` handle.
    """

    def __init__(
        self,
        root: pathlib.Path,
        *,
        author: str | None,
        token: str,
    ) -> None:
        """Scans the library once.

        Args:
            root: The library folder (must exist).
            author: Author of new annotations; the OS user if ``None``.
            token: The write token.
        """
        self.root = pathlib.Path(root)
        self.root_real = os.path.realpath(self.root)
        self.name = pathlib.Path(self.root_real).name or str(self.root)
        self.author = author
        self.token = token
        self.writable = os.access(self.root, os.W_OK)
        self.lib = library.Library(self.root)
        self.index = index.Index(self.root)
        self._lock = threading.RLock()
        self._infos: dict[str, library.RunInfo] = {}
        self._extras: dict[str, Extras] = {}
        self._rows: dict[str, bytes] = {}
        self._body: tuple[int, bytes] | None = None
        self._gzipped: tuple[int, bytes] | None = None
        self._log: list[tuple[int, frozenset[str], frozenset[str]]] = []
        self._run_locks: dict[str, threading.Lock] = {}
        self._groups_lock = threading.Lock()
        # Wall-clock milliseconds: a restarted server starts above any seq
        # an old client remembers, so its next poll resyncs.
        self.seq = time.time_ns() // 1_000_000
        self._floor = self.seq
        """Changes after this seq are all in the log."""
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._scan(None)
        self.runs_body()  # build the first reply now, not on the first request

    # -- scanning --

    def _highlight_count(self, info: library.RunInfo) -> int | None:
        """Counts cached highlights of a run, or ``None`` if not cached."""
        path = derived.cache_root(self.root) / info.id / derived.HIGHLIGHTS
        try:
            doc = json.loads(path.read_bytes())
            if doc["detector"] != highlights.DETECTOR_VERSION:
                return None  # computed by an older detector
            return len(doc["highlights"])
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def _load_extras(self, info: library.RunInfo) -> Extras:
        """Builds the extra row fields of one run."""
        extras = _read_extras(self.lib.runs_dir / info.name)
        if info.status == "complete" and info.id:
            extras = dataclasses.replace(
                extras, n_highlights=self._highlight_count(info)
            )
        return extras

    def _scan(self, names: Iterable[str] | None) -> tuple[set[str], set[str]]:
        """Refreshes the index and diffs it against what is in memory.

        Args:
            names: Runs whose files were touched, or ``None`` to check all.

        Returns:
            ``(changed, removed)`` run names. A run that is still recording
            counts as changed whenever it was touched, because its blocks
            grew even when its manifest did not.
        """
        with self._lock:
            self.index.refresh()
            changed: set[str] = set()
            removed: set[str] = set()
            if names is None:
                fresh = {i.name: i for i in self.index.query(limit=None)}
                removed = set(self._infos) - set(fresh)
                changed = {
                    n
                    for n, i in fresh.items()
                    if self._infos.get(n) != i or i.status == "recording"
                }
                touched = fresh
            else:
                touched = {}
                for name in names:
                    info = self.index.get(name)
                    if info is None:
                        if name in self._infos:
                            removed.add(name)
                        continue
                    touched[name] = info
                    if self._infos.get(name) != info or (
                        info.status == "recording"
                    ):
                        changed.add(name)
            for name in removed:
                self._infos.pop(name, None)
                self._extras.pop(name, None)
                self._rows.pop(name, None)
            for name in changed:
                info = touched[name]
                self._infos[name] = info
                self._extras[name] = self._load_extras(info)
                self._rows.pop(name, None)
            if changed or removed:
                self._bump(changed, removed)
            return changed, removed

    def _bump(self, changed: set[str], removed: set[str]) -> None:
        """Advances ``seq`` and logs what changed (lock held)."""
        self.seq += 1
        self._log.append((self.seq, frozenset(changed), frozenset(removed)))
        if len(self._log) > _LOG_LIMIT:
            self._floor = self._log[-_LOG_LIMIT - 1][0]
            del self._log[:-_LOG_LIMIT]
        self._body = self._gzipped = None

    def rescan(self, names: Iterable[str] | None = None) -> bool:
        """Re-reads the library now and returns whether anything changed.

        Args:
            names: Runs to re-check, or ``None`` for all of them.

        Returns:
            True if ``seq`` advanced.
        """
        changed, removed = self._scan(names)
        return bool(changed or removed)

    def touch(self, name: str) -> None:
        """Re-reads one run after the server itself changed its files."""
        self._scan([name])

    def set_highlights(self, name: str, count: int) -> None:
        """Records a finished highlight computation and announces it."""
        with self._lock:
            old = self._extras.get(name)
            if old is None or old.n_highlights == count:
                return
            self._extras[name] = dataclasses.replace(old, n_highlights=count)
            self._rows.pop(name, None)
            self._bump({name}, set())

    # -- views --

    def run_lock(self, name: str) -> threading.Lock:
        """Returns the lock that serializes writes to one run's sidecar."""
        with self._lock:
            return self._run_locks.setdefault(name, threading.Lock())

    def edit_annotations(
        self,
        name: str,
        edit: Callable[[annotations.Annotations], None],
        *,
        announce: bool = True,
    ) -> dict[str, Any]:
        """Loads, changes and saves one run's sidecar under its lock.

        Args:
            name: Run name.
            edit: Changes the loaded annotations in place.
            announce: Re-read the run and advance ``seq`` at once. Turn it
                off to write many runs, then call :meth:`rescan` once.

        Returns:
            The saved ``annotations.json`` object.

        Raises:
            FileNotFoundError: If the run is gone.
            errors.FormatError: If its manifest or sidecar is invalid.
        """
        with self.run_lock(name):
            m = manifest.read_manifest(self.lib.run_dir(name))
            ann = annotations.Annotations.load(
                self.lib.run_dir(name), m.id, m.dt, m.n_frames
            )
            edit(ann)
            ann.save()
            result = ann.to_json()
        if announce:
            self.touch(name)
        return result

    def rename_run(self, old: str, new: str) -> None:
        """Renames a run and announces it at once.

        The old name goes into ``removed`` and the new one into ``changed``
        of ``/api/changes``, without waiting for the file watcher.

        Args:
            old: The run's current name.
            new: Its new name.

        Raises:
            ValueError: If a name is invalid or the run is recording.
            FileNotFoundError: If there is no run ``old``.
            FileExistsError: If a run ``new`` exists.
            OSError: If the folder cannot be renamed.
            errors.FormatError: If the manifest is invalid.
        """
        with self.run_lock(old):  # no sidecar write while the folder moves
            self.lib.rename(old, new)
        self._scan([old, new])

    # -- groups --

    def _load_groups(
        self,
    ) -> tuple[list[annotations.Group], dict[str, Any]]:
        """Reads ``groups.json``, failing as a 409 if it is invalid."""
        try:
            return annotations.load_groups(self.root)
        except errors.FormatError as exc:
            raise GroupError(409, str(exc)) from exc

    def _members(self, name: str) -> list[str]:
        """Returns the runs that belong to a group (ignoring case)."""
        key = name.casefold()
        with self._lock:
            return sorted(
                n
                for n, i in self._infos.items()
                if i.group is not None and i.group.casefold() == key
            )

    def _group_order(
        self, listed: list[annotations.Group]
    ) -> list[tuple[str, str | None]]:
        """Lists every group in library order as ``(name, created)``.

        The listed groups come first; groups that runs use but the file
        lacks follow, alphabetically.
        """
        known = {g.name.casefold() for g in listed}
        with self._lock:
            used = sorted(
                {i.group for i in self._infos.values() if i.group},
                key=lambda g: (g.casefold(), g),
            )
        order: list[tuple[str, str | None]] = [
            (g.name, g.created) for g in listed
        ]
        for name in used:
            if name.casefold() not in known:
                known.add(name.casefold())
                order.append((name, None))
        return order

    def groups_view(self) -> dict[str, Any]:
        """Builds the body of ``GET /api/groups``.

        Returns:
            ``{"groups": [{"name", "count"}], "ungrouped": int}`` in library
            order. An unreadable ``groups.json`` counts as no listed groups.
        """
        try:
            listed, _ = annotations.load_groups(self.root)
        except errors.FormatError:
            logger.exception("ignoring invalid groups.json")
            listed = []
        order = self._group_order(listed)
        counts: collections.Counter[str] = collections.Counter()
        ungrouped = 0
        with self._lock:
            for info in self._infos.values():
                if info.group:
                    counts[info.group.casefold()] += 1
                else:
                    ungrouped += 1
        return {
            "groups": [
                {"name": n, "count": counts[n.casefold()]} for n, _ in order
            ],
            "ungrouped": ungrouped,
        }

    def _save_order(
        self,
        order: list[tuple[str, str | None]],
        extra: dict[str, Any],
        listed: list[annotations.Group],
    ) -> None:
        """Writes ``groups.json`` with the groups in ``order``."""
        old = {g.name.casefold(): g for g in listed}
        now = annotations.utc_now()
        out = []
        for name, created in order:
            group = old.get(name.casefold())
            if group is None:
                group = annotations.Group(name=name, created=created or now)
            else:
                group.name = name
            out.append(group)
        annotations.save_groups(self.root, out, extra)

    def ensure_group(self, name: str) -> str:
        """Makes sure a group exists and returns its canonical spelling.

        Args:
            name: The group's name, in any case.

        Returns:
            The listed spelling if the group exists (listed, or used by a
            run), else the name as given, which is now listed last.

        Raises:
            GroupError: For an invalid name or an unreadable ``groups.json``.
        """
        try:
            name = annotations.check_group_name(name)
        except ValueError as exc:
            raise GroupError(400, str(exc)) from exc
        with self._groups_lock:
            listed, extra = self._load_groups()
            order = self._group_order(listed)
            for known, _ in order:
                if known.casefold() == name.casefold():
                    if known.casefold() not in {
                        g.name.casefold() for g in listed
                    }:
                        self._save_order(order, extra, listed)
                        self.bump()
                    return known
            self._save_order([*order, (name, None)], extra, listed)
            self.bump()
            return name

    def change_groups(self, op: dict[str, Any]) -> dict[str, Any]:
        """Applies one op of ``POST /api/groups``.

        Args:
            op: ``{"op": "create", "name"}``, ``{"op": "rename", "name",
                "to"}``, ``{"op": "delete", "name"}`` or ``{"op": "move",
                "name", "index"}``.

        Returns:
            The new body of ``GET /api/groups``.

        Raises:
            GroupError: If the op is malformed, names no group, or collides
                with an existing name.
        """
        kind = op.get("op")
        if kind not in ("create", "rename", "delete", "move"):
            raise GroupError(400, f"unsupported op {kind!r}")
        with self._groups_lock:
            listed, extra = self._load_groups()
            order = self._group_order(listed)
            names = {n.casefold(): n for n, _ in order}
            if kind == "create":
                new = _group_name(op, "name")
                if new.casefold() in {g.name.casefold() for g in listed}:
                    raise GroupError(409, f"group {new!r} exists")
                # A group that runs use but the file lacks is only listed now.
                new = names.get(new.casefold(), new)
                order = [(g.name, g.created) for g in listed] + [(new, None)]
                self._save_order(order, extra, listed)
                self.bump()
            else:
                self._change_existing(kind, op, order, names, extra, listed)
        return self.groups_view()

    def _change_existing(
        self,
        kind: str,
        op: dict[str, Any],
        order: list[tuple[str, str | None]],
        names: dict[str, str],
        extra: dict[str, Any],
        listed: list[annotations.Group],
    ) -> None:
        """Renames, deletes or moves a group (the groups lock is held)."""
        name = _group_name(op, "name")
        if name.casefold() not in names:
            raise GroupError(404, f"no group {name!r}")
        name = names[name.casefold()]
        position = [n for n, _ in order].index(name)
        members = self._members(name)
        if kind == "move":
            index_ = op.get("index")
            if not isinstance(index_, int) or isinstance(index_, bool):
                raise GroupError(400, "'index' must be an integer")
            entry = order.pop(position)
            order.insert(max(0, min(index_, len(order))), entry)
            self._save_order(order, extra, listed)
            self.bump()
            return
        if kind == "rename":
            to = _group_name(op, "to")
            if to.casefold() != name.casefold() and to.casefold() in names:
                raise GroupError(409, f"group {to!r} exists")
            order[position] = (to, order[position][1])
            self._save_order(order, extra, listed)
            self._rewrite_members(members, to)
        else:  # delete
            del order[position]
            self._save_order(order, extra, listed)
            self._rewrite_members(members, None)
        self.bump()

    def _rewrite_members(self, members: list[str], group: str | None) -> None:
        """Writes ``marks.group`` into the sidecars of ``members``.

        Each file is replaced atomically. The rows are re-read once at the
        end, so clients see one change.
        """
        done = []
        for name in members:
            try:
                self.edit_annotations(
                    name, lambda ann: ann.set_group(group), announce=False
                )
            except (FileNotFoundError, errors.FormatError):
                logger.exception("cannot move %s to group %r", name, group)
                continue
            done.append(name)
        self.rescan(done)

    def bump(self) -> None:
        """Advances ``seq`` for a change that touches no run row.

        The group list is one: clients that see ``seq`` move re-read it.
        """
        with self._lock:
            self._bump(set(), set())

    def snapshot(self) -> list[tuple[str, library.RunInfo]]:
        """Returns every run as ``(name, row)``, newest first."""
        with self._lock:
            items = sorted(self._infos.items(), key=lambda kv: kv[0])
        items.sort(key=lambda kv: kv[1].created, reverse=True)
        return items

    def info(self, name: str) -> library.RunInfo | None:
        """Returns one run's index row, or ``None``."""
        with self._lock:
            return self._infos.get(name)

    def n_runs(self) -> int:
        """Returns the number of runs."""
        with self._lock:
            return len(self._infos)

    def _row_bytes(self, info: library.RunInfo) -> bytes:
        """Returns the encoded ``RunRow`` of a run, cached until it changes."""
        row = self._rows.get(info.name)
        if row is None:
            ex = self._extras.get(info.name) or Extras()
            row = _encode(
                {
                    "name": info.name,
                    "id": info.id,
                    "created": info.created,
                    "status": info.status,
                    "dt": info.dt,
                    "n_frames": info.n_frames,
                    "n_envs": info.n_envs,
                    "n_bodies": info.n_bodies,
                    "favorite": info.favorite,
                    "group": info.group,
                    "rating": info.rating,
                    "tags": list(info.tags),
                    "n_notes": info.n_notes,
                    "n_highlights": ex.n_highlights,
                    "simulator": ex.simulator,
                    "importer": ex.importer,
                    "streams": list(ex.streams),
                }
            )
            self._rows[info.name] = row
        return row

    def runs_body(self, *, gzipped: bool = False) -> tuple[int, bytes]:
        """Returns ``(seq, body)`` of ``/api/runs`` for the current state.

        The body is built once per ``seq`` from per-row bytes that are kept
        until their run changes, so a live run costs one row to re-encode.

        Args:
            gzipped: Return the gzip-compressed body.

        Returns:
            The sequence number the body belongs to, and the bytes.
        """
        with self._lock:
            if self._body is None:
                infos = sorted(self._infos.values(), key=lambda i: i.name)
                infos.sort(key=lambda i: i.created, reverse=True)
                rows = b",".join(self._row_bytes(i) for i in infos)
                self._body = (
                    self.seq,
                    b'{"seq":%d,"runs":[%s]}' % (self.seq, rows),
                )
            if not gzipped:
                return self._body
            if self._gzipped is None:
                self._gzipped = (
                    self._body[0],
                    gzip.compress(self._body[1], compresslevel=3, mtime=0),
                )
            return self._gzipped

    def changes(self, since: int) -> dict[str, Any]:
        """Answers ``/api/changes?since=``.

        Args:
            since: The ``seq`` the client last saw.

        Returns:
            ``{"seq", "changed", "removed", "live"}``. When the server no
            longer remembers ``since`` (it restarted, or the client fell
            far behind) every run is reported as changed so the client
            reloads its rows.
        """
        with self._lock:
            live = {
                n: i.n_frames
                for n, i in self._infos.items()
                if i.status == "recording"
            }
            if since < self._floor or since > self.seq:
                return {
                    "seq": self.seq,
                    "changed": sorted(self._infos),
                    "removed": [],
                    "live": live,
                }
            changed: set[str] = set()
            removed: set[str] = set()
            for seq, ch, rm in self._log:
                if seq > since:
                    changed |= ch
                    removed |= rm
            changed -= removed
            return {
                "seq": self.seq,
                "changed": sorted(changed),
                "removed": sorted(removed),
                "live": live,
            }

    # -- background threads --

    def start(self, *, watch: bool = True) -> None:
        """Starts the file watcher.

        Args:
            watch: Set false to leave the state static (tests call
                :meth:`rescan` themselves).
        """
        if watch and not self._threads:
            thread = threading.Thread(
                target=self._watch, name="simscope-watch", daemon=True
            )
            thread.start()
            self._threads.append(thread)

    def stop(self) -> None:
        """Stops background threads and closes the index."""
        self._stop.set()
        for thread in self._threads:
            thread.join(timeout=5)
        self._threads.clear()
        self.lib.close()
        self.index.close()

    def _names_of(self, paths: Iterable[str]) -> set[str]:
        """Maps changed absolute paths to the names of the runs they touch."""
        prefix = os.path.join(self.root_real, "runs") + os.sep
        names = set()
        for path in paths:
            if path.startswith(prefix):
                name = path[len(prefix) :].split(os.sep, 1)[0]
                if name:
                    names.add(name)
        return names

    def _watch(self) -> None:
        """Turns file events into ``seq`` bumps until stopped."""
        import watchfiles

        marker = os.sep + ".simscope" + os.sep
        idle = 0

        def relevant(_change: watchfiles.Change, path: str) -> bool:
            return marker not in path

        try:
            for batch in watchfiles.watch(
                self.root_real,
                watch_filter=relevant,
                debounce=_WATCH_DEBOUNCE_MS,
                step=_WATCH_STEP_MS,
                rust_timeout=_WATCH_TIMEOUT_MS,
                yield_on_timeout=True,
                stop_event=self._stop,
                raise_interrupt=False,
            ):
                names: set[str] | None = self._names_of(p for _, p in batch)
                if not batch:
                    idle += 1
                    if idle % _SAFETY_RESCAN_EVERY:
                        continue
                    names = None  # backstop against missed events
                elif not names:
                    continue  # changes outside runs/ (assets, scenes)
                try:
                    self._scan(names)
                except Exception:
                    logger.exception("library rescan failed")
        except Exception:
            logger.exception("file watcher stopped; polling instead")
            self._poll()

    def _poll(self) -> None:
        """Fallback when the OS watcher is unavailable: rescan every 2 s."""
        while not self._stop.wait(2.0):
            try:
                self._scan(None)
            except Exception:
                logger.exception("library rescan failed")
