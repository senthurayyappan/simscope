"""Curation sidecars, the event-type registry and run groups (annotations v1).

``runs/<name>/annotations.json`` holds marks, notes, ratings, events and
spatial annotations for one run. ``.simscope/event_types.json`` holds the
library's event vocabulary and ``.simscope/groups.json`` the ordered list of
run groups (a run belongs to at most one, ``marks.group``). All are
pretty-printed with sorted keys and written atomically, so git can diff and
merge them (decision D8).

Every record carries a ULID ``id`` plus ``author``, ``created`` and
``updated``. Lists are sorted by ``id`` when written, so two people's
appends merge cleanly; :func:`merge` is the programmatic equivalent.
"""

import copy
import dataclasses
import getpass
import json
import logging
import math
import os
import pathlib
import re
from typing import Any, Literal, Self, cast

from simscope.io import cas, errors, manifest

logger = logging.getLogger(__name__)

ANNOTATIONS_FORMAT = "simscope-annotations/1"
EVENT_TYPES_FORMAT = "simscope-event-types/1"
GROUPS_FORMAT = "simscope-groups/1"
FILE_NAME = "annotations.json"
MAX_GROUP_NAME = 64
"""Longest group name, in characters."""
DEFAULT_CRITERION = "overall"

RatingScale = Literal["stars5", "score100", "thumb"]
RATING_SCALES: tuple[RatingScale, ...] = ("stars5", "score100", "thumb")
_SCALE_RANGES: dict[str, tuple[float, float]] = {
    "stars5": (1, 5),
    "score100": (0, 100),
    "thumb": (-1, 1),
}
SPATIAL_KINDS = ("point", "box")
PROP_TYPES = ("text", "number", "bool", "select")

_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_FRAME_RE = re.compile(r"^(world|body:\d+)$")


def default_author() -> str:
    """Returns the OS user name, which is the default record author."""
    try:
        return getpass.getuser()
    except (OSError, KeyError, ImportError):
        return "unknown"


def _dump(obj: dict[str, Any]) -> bytes:
    """Serializes to the spec's on-disk form (indent 2, sorted, newline)."""
    text = json.dumps(
        obj, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False
    )
    return (text + "\n").encode("utf-8")


def _read_json(path: pathlib.Path) -> dict[str, Any]:
    """Reads a JSON object from ``path``.

    Raises:
        errors.FormatError: If the file is not a JSON object.
    """
    try:
        obj = json.loads(path.read_bytes())
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise errors.FormatError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(obj, dict):
        raise errors.FormatError(f"{path}: expected a JSON object")
    return obj


def _check_format(obj: dict[str, Any], prefix: str, path: object) -> None:
    """Rejects files whose format tag or major version is unknown."""
    fmt = obj.get("format")
    if not isinstance(fmt, str) or not fmt.startswith(prefix + "/"):
        raise errors.FormatError(f"{path}: not a {prefix} file: {fmt!r}")
    if fmt.split("/", 1)[1].split(".")[0] != "1":
        raise errors.FormatError(f"{path}: unknown version {fmt!r}")


# ---------------------------------------------------------------- records


@dataclasses.dataclass(kw_only=True)
class _JsonRecord:
    """Base: dataclass <-> JSON with unknown-field preservation.

    Attributes:
        extra: Fields the reader did not know, written back unchanged so
            newer tools do not lose data (spec 1).
    """

    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        """Returns the JSON object, known fields over unknown ones."""
        out = copy.deepcopy(self.extra)
        for f in dataclasses.fields(self):
            if f.name != "extra":
                out[f.name] = copy.deepcopy(getattr(self, f.name))
        return out

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> Self:
        """Parses a JSON object, keeping unknown fields.

        Raises:
            errors.FormatError: If a required field is missing or invalid.
        """
        names = {f.name for f in dataclasses.fields(cls)}
        names.discard("extra")
        known = {k: v for k, v in obj.items() if k in names}
        extra = {k: v for k, v in obj.items() if k not in names}
        try:
            return cls(**known, extra=extra)
        except (TypeError, ValueError) as exc:
            raise errors.FormatError(
                f"bad {cls.__name__} record {obj!r}: {exc}"
            ) from exc


@dataclasses.dataclass(kw_only=True)
class Record(_JsonRecord):
    """Fields common to every list record (spec 2).

    Attributes:
        id: ULID, unique within the file.
        author: Who made the record.
        created: RFC 3339 UTC creation time.
        updated: RFC 3339 UTC time of the last change.
    """

    id: str
    author: str
    created: str
    updated: str


@dataclasses.dataclass(kw_only=True)
class Marks(_JsonRecord):
    """Run-level marks. The last write wins (spec 3.2).

    ``flag``, ``status`` and ``tags`` are deprecated since viewer v3.1
    (decision D23): they are read and written back unchanged so that no data
    is lost, but nothing sets them and the viewer does not show them.

    Attributes:
        favorite: Whether the run is starred.
        group: Name of the group the run belongs to, or ``None``.
        flag: Deprecated. Free-text flag such as ``"review"``, or ``None``.
        status: Deprecated. Free-text status, or ``None``.
        tags: Deprecated. Curation tags, stored sorted and unique.
        extra: Unknown fields read from disk.
    """

    favorite: bool = False
    group: str | None = None
    flag: str | None = None
    status: str | None = None
    tags: list[str] = dataclasses.field(default_factory=list)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    def __post_init__(self) -> None:
        """Normalizes tags to a sorted, unique list."""
        self.favorite = bool(self.favorite)
        self.tags = sorted({str(t) for t in self.tags})


@dataclasses.dataclass(kw_only=True)
class Note(Record):
    """A Markdown note (spec 3.3).

    Attributes:
        text: The note body, Markdown.
    """

    text: str = ""


@dataclasses.dataclass(kw_only=True)
class Rating(Record):
    """A rating on one criterion (spec 3.4).

    Attributes:
        criterion: Free string, ``"overall"`` by default.
        scale: ``"stars5"``, ``"score100"`` or ``"thumb"``.
        value: Number on that scale.
        rationale: Optional explanation.
    """

    criterion: str = DEFAULT_CRITERION
    scale: RatingScale = "stars5"
    value: float = 0
    rationale: str | None = None


@dataclasses.dataclass(kw_only=True)
class Event(Record):
    """A time instant or segment on the timeline (spec 3.5).

    Attributes:
        type: Key into the event-type registry, or ``""`` if untyped.
        label: Short display string.
        t0: Start in seconds.
        t1: End in seconds (``t0 == t1`` for an instant).
        f0: Frame nearest ``t0``.
        f1: Frame nearest ``t1``.
        env: Env index, or ``None`` for all envs.
        props: Typed property values.
    """

    type: str = ""
    label: str = ""
    t0: float = 0.0
    t1: float = 0.0
    f0: int = 0
    f1: int = 0
    env: int | None = None
    props: dict[str, Any] = dataclasses.field(default_factory=dict)


@dataclasses.dataclass(kw_only=True)
class Spatial(Record):
    """A 3D point or box at a moment in time (spec 3.6).

    Attributes:
        kind: ``"point"`` or ``"box"``.
        frame: ``"world"`` or ``"body:<index>"``.
        t: Time in seconds.
        f: Frame nearest ``t``.
        env: Env index.
        position: ``[x, y, z]`` in metres.
        size: Box half-extents ``[hx, hy, hz]``, or ``None`` for a point.
        label: Short display string.
        event: Optional id of a linked event.
    """

    kind: str = "point"
    frame: str = "world"
    t: float = 0.0
    f: int = 0
    env: int = 0
    position: list[float] = dataclasses.field(default_factory=lambda: [0.0] * 3)
    size: list[float] | None = None
    label: str = ""
    event: str | None = None


_LIST_TYPES: dict[str, type[Record]] = {
    "notes": Note,
    "ratings": Rating,
    "events": Event,
    "spatial": Spatial,
}


# --------------------------------------------------------- event registry


@dataclasses.dataclass(kw_only=True)
class EventType(_JsonRecord):
    """One entry of the event vocabulary (spec 4).

    Attributes:
        type_id: The key the entry is stored under, such as ``"fall"``.
        name: Display name.
        color: ``#rrggbb`` hex color.
        key: Optional single-character hotkey.
        props: Property specs by name; each has a ``type`` of ``"text"``,
            ``"number"``, ``"bool"`` or ``"select"`` (with ``options``).
        extra: Unknown fields read from disk.
    """

    type_id: str
    name: str
    color: str = "#888888"
    key: str | None = None
    props: dict[str, dict[str, Any]] = dataclasses.field(default_factory=dict)
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validates color, hotkey and property specs.

        Raises:
            ValueError: If a field is invalid.
        """
        if not _COLOR_RE.match(self.color):
            raise ValueError(f"event type {self.type_id!r}: bad color")
        if self.key is not None and len(self.key) != 1:
            raise ValueError(f"event type {self.type_id!r}: key must be 1 char")
        for pname, spec in self.props.items():
            ptype = spec.get("type")
            if ptype not in PROP_TYPES:
                raise ValueError(
                    f"event type {self.type_id!r} prop {pname!r}: "
                    f"unknown type {ptype!r}"
                )
            if ptype == "select" and not isinstance(spec.get("options"), list):
                raise ValueError(
                    f"event type {self.type_id!r} prop {pname!r}: "
                    "select needs options"
                )

    def to_json(self) -> dict[str, Any]:
        """Returns the JSON object (without ``type_id``)."""
        out = copy.deepcopy(self.extra)
        out.update(
            name=self.name,
            color=self.color,
            key=self.key,
            props=copy.deepcopy(self.props),
        )
        return out

    @classmethod
    def from_json(cls, obj: dict[str, Any], type_id: str = "") -> Self:
        """Parses one entry.

        Args:
            obj: The entry's JSON object.
            type_id: The key it was stored under.

        Raises:
            errors.FormatError: If the entry is invalid.
        """
        known = {"name", "color", "key", "props"}
        try:
            return cls(
                type_id=type_id,
                name=str(obj.get("name", type_id)),
                color=str(obj.get("color", "#888888")),
                key=obj.get("key"),
                props=dict(obj.get("props") or {}),
                extra={k: v for k, v in obj.items() if k not in known},
            )
        except (TypeError, ValueError, AttributeError) as exc:
            raise errors.FormatError(
                f"bad event type {type_id!r}: {exc}"
            ) from exc


def default_event_types() -> dict[str, EventType]:
    """Returns the built-in vocabulary used when the file is missing."""
    severity = {"type": "select", "options": ["minor", "major"]}
    return {
        t.type_id: t
        for t in (
            EventType(
                type_id="fall",
                name="Fall",
                color="#d33b3b",
                key="f",
                props={"severity": severity},
            ),
            EventType(type_id="slip", name="Slip", color="#e59a1c", key="s"),
            EventType(
                type_id="success", name="Success", color="#2f9e44", key="g"
            ),
            EventType(type_id="note", name="Note", color="#4c6ef5", key="o"),
        )
    }


def event_types_path(root: os.PathLike[str] | str) -> pathlib.Path:
    """Returns ``<root>/.simscope/event_types.json``."""
    return pathlib.Path(root) / ".simscope" / "event_types.json"


def load_event_types(
    root: os.PathLike[str] | str,
) -> tuple[dict[str, EventType], dict[str, Any]]:
    """Loads the event vocabulary of a library.

    Args:
        root: The library root.

    Returns:
        ``(types, extra)``: the entries by id, and unknown top-level fields.
        The built-in default (and no extra) when the file is missing.

    Raises:
        errors.FormatError: If the file is invalid.
    """
    path = event_types_path(root)
    if not path.is_file():
        return default_event_types(), {}
    obj = _read_json(path)
    _check_format(obj, "simscope-event-types", path)
    raw = obj.get("types") or {}
    if not isinstance(raw, dict):
        raise errors.FormatError(f"{path}: 'types' must be an object")
    types = {
        str(k): EventType.from_json(v, str(k)) for k, v in sorted(raw.items())
    }
    extra = {k: v for k, v in obj.items() if k not in ("format", "types")}
    return types, extra


def save_event_types(
    root: os.PathLike[str] | str,
    types: dict[str, EventType],
    extra: dict[str, Any] | None = None,
) -> pathlib.Path:
    """Writes the event vocabulary atomically.

    Args:
        root: The library root.
        types: Entries by id.
        extra: Unknown top-level fields to keep.

    Returns:
        The path written.
    """
    obj = dict(extra or {})
    obj["format"] = EVENT_TYPES_FORMAT
    obj["types"] = {k: v.to_json() for k, v in sorted(types.items())}
    path = event_types_path(root)
    cas.atomic_write(path, _dump(obj))
    return path


# ------------------------------------------------------------------ groups


def check_group_name(name: object) -> str:
    """Validates a group name and returns it without surrounding spaces.

    Args:
        name: The proposed name.

    Returns:
        The name, 1 to ``MAX_GROUP_NAME`` printable characters.

    Raises:
        ValueError: If it is not a string, is empty or too long, or has
            characters that cannot be printed (such as a newline).
    """
    if not isinstance(name, str):
        raise ValueError("a group name must be a string")
    name = name.strip()
    if not 1 <= len(name) <= MAX_GROUP_NAME:
        raise ValueError(f"a group name has 1 to {MAX_GROUP_NAME} characters")
    if not name.isprintable():
        raise ValueError("a group name must be printable text")
    return name


@dataclasses.dataclass(kw_only=True)
class Group(_JsonRecord):
    """One entry of ``.simscope/groups.json`` (spec 5).

    Attributes:
        name: The group's name, unique case-insensitively.
        created: RFC 3339 UTC creation time.
        extra: Unknown fields read from disk.
    """

    name: str
    created: str = ""
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)


def groups_path(root: os.PathLike[str] | str) -> pathlib.Path:
    """Returns ``<root>/.simscope/groups.json``."""
    return pathlib.Path(root) / ".simscope" / "groups.json"


def load_groups(
    root: os.PathLike[str] | str,
) -> tuple[list[Group], dict[str, Any]]:
    """Loads the ordered groups of a library.

    A group whose name repeats an earlier one (ignoring case) is dropped.

    Args:
        root: The library root.

    Returns:
        ``(groups, extra)``: the groups in library order, and unknown
        top-level fields. No groups when the file is missing.

    Raises:
        errors.FormatError: If the file is invalid.
    """
    path = groups_path(root)
    if not path.is_file():
        return [], {}
    obj = _read_json(path)
    _check_format(obj, "simscope-groups", path)
    raw = obj.get("groups") or []
    if not isinstance(raw, list) or not all(isinstance(g, dict) for g in raw):
        raise errors.FormatError(f"{path}: 'groups' must be a list of objects")
    groups: list[Group] = []
    seen: set[str] = set()
    for entry in raw:
        group = Group.from_json(entry)
        try:
            group.name = check_group_name(group.name)
        except ValueError as exc:
            raise errors.FormatError(f"{path}: {exc}") from exc
        if group.name.casefold() not in seen:
            seen.add(group.name.casefold())
            groups.append(group)
    extra = {k: v for k, v in obj.items() if k not in ("format", "groups")}
    return groups, extra


def save_groups(
    root: os.PathLike[str] | str,
    groups: list[Group],
    extra: dict[str, Any] | None = None,
) -> pathlib.Path:
    """Writes the ordered groups atomically.

    Args:
        root: The library root.
        groups: The groups in library order.
        extra: Unknown top-level fields to keep.

    Returns:
        The path written.
    """
    obj = dict(extra or {})
    obj["format"] = GROUPS_FORMAT
    obj["groups"] = [g.to_json() for g in groups]
    path = groups_path(root)
    cas.atomic_write(path, _dump(obj))
    return path


def utc_now() -> str:
    """Returns the current UTC time as RFC 3339 with seconds precision."""
    return manifest.utc_now()


def _finite(name: str, value: float) -> float:
    """Returns ``value`` as a finite float.

    Raises:
        ValueError: If it is NaN or infinite.
    """
    v = float(value)
    if not math.isfinite(v):
        raise ValueError(f"{name} must be finite, got {value!r}")
    return v


# ------------------------------------------------------------ Annotations


class Annotations:
    """The curation sidecar of one run, loaded into memory.

    Mutators change the in-memory state and mark it dirty; :meth:`save`
    writes it. ``author`` arguments default to the OS user name.

    Attributes:
        path: Location of ``annotations.json``.
        run_id: The run's id from ``rollout.json``.
        dt: Seconds per frame, used to snap events to frames.
        n_frames: Frames in the run, used to clip snapped frames.
        marks: Run-level marks.
        notes: Notes, sorted by id.
        ratings: Ratings, sorted by id.
        events: Events, sorted by id.
        spatial: Spatial annotations, sorted by id.
        extra: Unknown top-level fields read from disk.
        id_mismatch: True if the file on disk belonged to another run id.
    """

    def __init__(
        self,
        path: os.PathLike[str] | str,
        run_id: str,
        dt: float,
        n_frames: int,
    ) -> None:
        """Creates an empty annotation set (nothing is read or written).

        Args:
            path: Location of ``annotations.json``.
            run_id: The run's id.
            dt: Seconds per frame (positive).
            n_frames: Frames in the run.

        Raises:
            ValueError: If ``dt`` is not positive.
        """
        if not dt > 0:
            raise ValueError(f"dt must be positive, got {dt!r}")
        self.path = pathlib.Path(path)
        self.run_id = run_id
        self.dt = float(dt)
        self.n_frames = int(n_frames)
        self.marks = Marks()
        self.notes: list[Note] = []
        self.ratings: list[Rating] = []
        self.events: list[Event] = []
        self.spatial: list[Spatial] = []
        self.extra: dict[str, Any] = {}
        self.id_mismatch = False
        self._dirty = False

    # -- persistence --

    @classmethod
    def load(
        cls,
        run_dir: os.PathLike[str] | str,
        run_id: str,
        dt: float,
        n_frames: int,
    ) -> Self:
        """Loads ``annotations.json`` from a run directory.

        A missing file means "no annotations". If the file's ``run_id``
        differs from ``run_id`` a warning is logged and ``id_mismatch`` is
        set; the records are kept and ``save`` will write the current id.

        Args:
            run_dir: The run directory.
            run_id: The run's id.
            dt: Seconds per frame.
            n_frames: Frames in the run.

        Returns:
            The annotations.

        Raises:
            errors.FormatError: If the file exists but is invalid.
        """
        ann = cls(pathlib.Path(run_dir) / FILE_NAME, run_id, dt, n_frames)
        if ann.path.is_file():
            ann._fill(_read_json(ann.path))
        return ann

    def _fill(self, obj: dict[str, Any]) -> None:
        """Populates this object from a parsed file."""
        _check_format(obj, "simscope-annotations", self.path)
        file_id = obj.get("run_id")
        if file_id not in (None, self.run_id):
            logger.warning(
                "%s belongs to run %s, not %s", self.path, file_id, self.run_id
            )
            self.id_mismatch = True
        marks = obj.get("marks")
        self.marks = (
            Marks.from_json(marks) if isinstance(marks, dict) else Marks()
        )
        for key, rec_type in _LIST_TYPES.items():
            items = obj.get(key) or []
            if not isinstance(items, list):
                raise errors.FormatError(f"{self.path}: {key!r} must be a list")
            records = [rec_type.from_json(o) for o in items]
            records.sort(key=lambda r: r.id)
            getattr(self, key)[:] = records
        known = {"format", "run_id", "marks", *_LIST_TYPES}
        self.extra = {k: v for k, v in obj.items() if k not in known}

    def to_json(self) -> dict[str, Any]:
        """Returns the file contents, lists sorted by id."""
        out = copy.deepcopy(self.extra)
        out["format"] = ANNOTATIONS_FORMAT
        out["run_id"] = self.run_id
        out["marks"] = self.marks.to_json()
        for key in _LIST_TYPES:
            records = sorted(getattr(self, key), key=lambda r: r.id)
            out[key] = [r.to_json() for r in records]
        return out

    @property
    def dirty(self) -> bool:
        """True if there are changes that ``save`` has not written."""
        return self._dirty

    def save(self) -> bool:
        """Writes ``annotations.json`` atomically.

        Nothing is written if there are no changes and no file exists yet,
        because writers create the file on the first change (spec 1).

        Returns:
            True if the file was written.
        """
        if not self._dirty and not self.path.exists():
            return False
        cas.atomic_write(self.path, _dump(self.to_json()))
        self._dirty = False
        self.id_mismatch = False
        return True

    # -- helpers --

    def _touch(self) -> str:
        """Marks the state dirty and returns the current timestamp."""
        self._dirty = True
        return utc_now()

    def _new(
        self, rec_type: type[Record], author: str | None, **fields: Any
    ) -> Any:
        """Builds a record with a fresh id and timestamps and appends it."""
        now = self._touch()
        rec = rec_type(
            id=manifest.new_ulid(),
            author=author or default_author(),
            created=now,
            updated=now,
            **fields,
        )
        for key, cls in _LIST_TYPES.items():
            if cls is rec_type:
                getattr(self, key).append(rec)
        return rec

    def snap(self, t: float) -> int:
        """Returns the frame nearest to ``t`` seconds, clipped to the run.

        Uses ``floor(t / dt + 0.5)`` (round half up, as JavaScript's
        ``Math.round``) so the Python and player sides agree.

        Args:
            t: Time in seconds.

        Returns:
            A frame index in ``[0, max(n_frames - 1, 0)]``.
        """
        f = math.floor(_finite("t", t) / self.dt + 0.5)
        return int(min(max(f, 0), max(self.n_frames - 1, 0)))

    def get(self, record_id: str) -> Any:
        """Returns the record with this id.

        Raises:
            KeyError: If there is none.
        """
        for key in _LIST_TYPES:
            for rec in getattr(self, key):
                if rec.id == record_id:
                    return rec
        raise KeyError(record_id)

    def remove(self, record_id: str) -> bool:
        """Removes the record with this id.

        Spatial annotations linked to a removed event keep their ``event``
        field; readers treat a dangling link as unlinked.

        Args:
            record_id: A note, rating, event or spatial id.

        Returns:
            True if a record was removed.
        """
        for key in _LIST_TYPES:
            records = getattr(self, key)
            for i, rec in enumerate(records):
                if rec.id == record_id:
                    del records[i]
                    self._dirty = True
                    return True
        return False

    # -- marks --

    def set_favorite(self, value: bool = True) -> None:
        """Sets or clears the favorite mark."""
        self.marks.favorite = bool(value)
        self._dirty = True

    def set_group(self, group: str | None) -> None:
        """Moves the run into a group, or out of every group with ``None``.

        Args:
            group: The group's name (see :func:`check_group_name`), or
                ``None``.

        Raises:
            ValueError: If the name is invalid.
        """
        self.marks.group = None if group is None else check_group_name(group)
        self._dirty = True

    # -- notes --

    def add_note(self, text: str, *, author: str | None = None) -> Note:
        """Adds a Markdown note.

        Args:
            text: The note body.
            author: Defaults to the OS user name.

        Returns:
            The new note.
        """
        return self._new(Note, author, text=text)

    def update_note(self, note_id: str, text: str) -> Note:
        """Replaces a note's text.

        Raises:
            KeyError: If there is no note with this id.
        """
        for note in self.notes:
            if note.id == note_id:
                note.text = text
                note.updated = self._touch()
                return note
        raise KeyError(note_id)

    # -- ratings --

    def rate(
        self,
        value: float,
        *,
        criterion: str = DEFAULT_CRITERION,
        scale: RatingScale = "stars5",
        rationale: str | None = None,
        author: str | None = None,
    ) -> Rating:
        """Rates the run, replacing the author's rating for the criterion.

        A replacement keeps the old ``id`` and ``created`` (spec 3.4).

        Args:
            value: A number on ``scale``: 1-5 for ``stars5``, 0-100 for
                ``score100``, -1 or 1 for ``thumb``.
            criterion: What is rated.
            scale: The scale of ``value``.
            rationale: Optional explanation.
            author: Defaults to the OS user name.

        Returns:
            The new or updated rating.

        Raises:
            ValueError: If the scale or value is invalid.
        """
        if scale not in _SCALE_RANGES:
            raise ValueError(f"unknown rating scale {scale!r}")
        value = _finite("value", value)
        lo, hi = _SCALE_RANGES[scale]
        if (
            not lo <= value <= hi
            or (scale == "stars5" and value % 1)
            or (scale == "thumb" and value not in (-1, 1))
        ):
            raise ValueError(f"value {value!r} is invalid for scale {scale!r}")
        num: float = int(value) if value == int(value) else value
        who = author or default_author()
        for rating in self.ratings:
            if rating.author == who and rating.criterion == criterion:
                rating.scale, rating.value = scale, num
                rating.rationale = rationale
                rating.updated = self._touch()
                return rating
        return self._new(
            Rating,
            who,
            criterion=criterion,
            scale=scale,
            value=num,
            rationale=rationale,
        )

    # -- events --

    def _event_times(self, t0: float, t1: float | None) -> tuple[float, float]:
        """Validates ``t0 <= t1`` and defaults ``t1`` to ``t0``."""
        a = _finite("t0", t0)
        b = a if t1 is None else _finite("t1", t1)
        if a > b:
            raise ValueError(f"event needs t0 <= t1, got {a} > {b}")
        return a, b

    def add_event(
        self,
        type: str = "",  # noqa: A002
        *,
        t0: float,
        t1: float | None = None,
        label: str = "",
        env: int | None = None,
        props: dict[str, Any] | None = None,
        author: str | None = None,
    ) -> Event:
        """Adds an event, snapping ``f0`` and ``f1`` to the nearest frames.

        Args:
            type: Key into the event-type registry, or ``""``.
            t0: Start in seconds.
            t1: End in seconds; defaults to ``t0`` (an instant).
            label: Short display string.
            env: Env index, or ``None`` for all envs.
            props: Typed property values.
            author: Defaults to the OS user name.

        Returns:
            The new event.

        Raises:
            ValueError: If ``t0 > t1`` or a time is not finite.
        """
        a, b = self._event_times(t0, t1)
        return self._new(
            Event,
            author,
            type=type,
            label=label,
            t0=a,
            t1=b,
            f0=self.snap(a),
            f1=self.snap(b),
            env=env,
            props=dict(props or {}),
        )

    def update_event(self, event_id: str, **changes: Any) -> Event:
        """Changes fields of an event and re-snaps its frames.

        Args:
            event_id: The event's id.
            **changes: Any of ``type``, ``label``, ``t0``, ``t1``, ``env``
                and ``props``.

        Returns:
            The updated event.

        Raises:
            KeyError: If there is no event with this id.
            ValueError: If a field is unknown or the times are invalid.
        """
        allowed = {"type", "label", "t0", "t1", "env", "props"}
        bad = set(changes) - allowed
        if bad:
            raise ValueError(f"cannot update event fields {sorted(bad)}")
        for ev in self.events:
            if ev.id != event_id:
                continue
            a, b = self._event_times(
                changes.get("t0", ev.t0), changes.get("t1", ev.t1)
            )
            for name in ("type", "label", "env"):
                if name in changes:
                    setattr(ev, name, changes[name])
            if "props" in changes:
                ev.props = dict(changes["props"])
            ev.t0, ev.t1 = a, b
            ev.f0, ev.f1 = self.snap(a), self.snap(b)
            ev.updated = self._touch()
            return ev
        raise KeyError(event_id)

    # -- spatial --

    def add_spatial(
        self,
        kind: str,
        position: tuple[float, float, float] | list[float],
        *,
        t: float,
        env: int = 0,
        frame: str = "world",
        size: tuple[float, float, float] | list[float] | None = None,
        label: str = "",
        event: str | None = None,
        author: str | None = None,
    ) -> Spatial:
        """Adds a 3D point or box, snapping ``f`` to the nearest frame.

        Args:
            kind: ``"point"`` or ``"box"``.
            position: ``[x, y, z]`` in metres.
            t: Time in seconds.
            env: Env index.
            frame: ``"world"`` or ``"body:<index>"``.
            size: Half-extents of a box (required for ``"box"``).
            label: Short display string.
            event: Optional id of a linked event.
            author: Defaults to the OS user name.

        Returns:
            The new annotation.

        Raises:
            ValueError: If an argument is invalid.
        """
        if kind not in SPATIAL_KINDS:
            raise ValueError(f"spatial kind must be one of {SPATIAL_KINDS}")
        if not _FRAME_RE.match(frame):
            raise ValueError(f"frame must be 'world' or 'body:<i>': {frame!r}")
        pos = [_finite("position", v) for v in position]
        if len(pos) != 3:
            raise ValueError("position needs 3 components")
        dims = None
        if kind == "box":
            if size is None:
                raise ValueError("a box needs a size")
            dims = [_finite("size", v) for v in size]
            if len(dims) != 3:
                raise ValueError("size needs 3 components")
        elif size is not None:
            raise ValueError("a point has no size")
        t = _finite("t", t)
        return self._new(
            Spatial,
            author,
            kind=kind,
            frame=frame,
            t=t,
            f=self.snap(t),
            env=int(env),
            position=pos,
            size=dims,
            label=label,
            event=event,
        )


# ------------------------------------------------------------------ merge


def _newer(a: Record, b: Record) -> Record:
    """Picks the record with the later ``updated`` (ties: larger JSON)."""
    ka = (a.updated, json.dumps(a.to_json(), sort_keys=True))
    kb = (b.updated, json.dumps(b.to_json(), sort_keys=True))
    return a if ka >= kb else b


def _merge_lists(
    a: list[Any], b: list[Any], base: list[Any] | None
) -> list[Any]:
    """Unions two record lists by id; newer ``updated`` wins on a clash.

    With a ``base``, an id that was in the base but is absent from one side
    counts as deleted there and is dropped from the result.
    """
    a_by, b_by = {r.id: r for r in a}, {r.id: r for r in b}
    dropped: set[str] = set()
    if base is not None:
        base_ids = {r.id for r in base}
        dropped = (base_ids - a_by.keys()) | (base_ids - b_by.keys())
    out = []
    for rid in sorted(a_by.keys() | b_by.keys()):
        if rid in dropped:
            continue
        if rid in a_by and rid in b_by:
            out.append(copy.deepcopy(_newer(a_by[rid], b_by[rid])))
        else:
            out.append(copy.deepcopy(a_by.get(rid) or b_by[rid]))
    return out


def _dedupe_ratings(ratings: list[Rating]) -> list[Rating]:
    """Keeps one rating per (author, criterion): the most recently updated."""
    best: dict[tuple[str, str], Rating] = {}
    for r in ratings:
        key = (r.author, r.criterion)
        best[key] = cast(Rating, _newer(best[key], r)) if key in best else r
    return sorted(best.values(), key=lambda r: r.id)


def _merge_marks(a: Marks, b: Marks, base: Marks | None) -> Marks:
    """Merges marks; favorite is OR-ed and deprecated tags are unioned.

    ``group`` (like the deprecated ``flag`` and ``status``) takes the side
    that changed relative to ``base``; without a base (or if both changed)
    ``b``'s value wins when it is set.
    """
    out = copy.deepcopy(a)
    out.extra = {**b.extra, **a.extra}
    out.favorite = a.favorite or b.favorite
    tags = set(a.tags) | set(b.tags)
    if base is not None:
        tags -= set(base.tags) - (set(a.tags) & set(b.tags))
    out.tags = sorted(tags)
    for name in ("group", "flag", "status"):
        va, vb = getattr(a, name), getattr(b, name)
        if base is not None:
            v0 = getattr(base, name)
            chosen = va if vb == v0 else vb
        else:
            chosen = vb if vb is not None else va
        setattr(out, name, chosen)
    return out


def merge(
    a: Annotations, b: Annotations, base: Annotations | None = None
) -> Annotations:
    """Merges two annotation sets that diverged from a common base (D8).

    List entries merge by id: the union of both sides, and where the same id
    exists on both sides the one with the later ``updated`` wins. Ratings are
    then reduced to one per author and criterion. This is what a textual git
    merge of the two sorted files would do, without conflicts.

    Args:
        a: One side. The result takes its path, run id and dt.
        b: The other side ("theirs"; wins mark conflicts).
        base: The common ancestor, if known. It lets the merge propagate
            deletions and tell which side changed a mark.

    Returns:
        A new, dirty ``Annotations``. Neither input is modified.
    """
    out = Annotations(a.path, a.run_id, a.dt, a.n_frames)
    out.marks = _merge_marks(a.marks, b.marks, base.marks if base else None)
    for key in _LIST_TYPES:
        merged = _merge_lists(
            getattr(a, key),
            getattr(b, key),
            getattr(base, key) if base is not None else None,
        )
        if key == "ratings":
            merged = _dedupe_ratings(merged)
        getattr(out, key)[:] = merged
    out.extra = {**copy.deepcopy(b.extra), **copy.deepcopy(a.extra)}
    out._dirty = True
    return out
