"""Rollout manifests (``rollout.json``, spec 5), ULIDs and run names."""

import dataclasses
import datetime
import json
import os
import pathlib
import re
import time
from typing import Any

from simscope import core
from simscope.io import cas, errors

ROLLOUT_FORMAT = "simscope-rollout/1"
MANIFEST_NAME = "rollout.json"
PARTIAL_NAME = "rollout.json.partial"
BODY_POSE = "body_pose"

_RUN_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def validate_run_name(name: str) -> str:
    """Checks a run name against ``^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$``.

    Args:
        name: Candidate run name.

    Returns:
        The name, unchanged.

    Raises:
        ValueError: If the name is not valid.
    """
    if not isinstance(name, str) or not _RUN_NAME_RE.fullmatch(name):
        raise ValueError(
            f"invalid run name {name!r}: must match "
            "[A-Za-z0-9][A-Za-z0-9._-]{0,127}"
        )
    return name


def new_ulid(now_ms: int | None = None) -> str:
    """Generates a ULID: 48-bit ms timestamp plus 80 random bits.

    Args:
        now_ms: Unix time in milliseconds, or ``None`` for the current time.

    Returns:
        26 Crockford base32 characters.
    """
    ms = time.time_ns() // 1_000_000 if now_ms is None else now_ms
    if not 0 <= ms < 1 << 48:
        raise ValueError("timestamp does not fit in 48 bits")
    value = (ms << 80) | int.from_bytes(os.urandom(10), "big")
    return "".join(
        _CROCKFORD[(value >> (5 * i)) & 31] for i in range(25, -1, -1)
    )


def utc_now() -> str:
    """Returns the current UTC time as ``YYYY-MM-DDTHH:MM:SSZ``."""
    now = datetime.datetime.now(datetime.UTC).replace(microsecond=0)
    return now.strftime("%Y-%m-%dT%H:%M:%SZ")


def _vec3(o: Any) -> core.Vec3:
    """Parses a 3-element sequence of numbers."""
    if len(o) != 3:
        raise ValueError("env origin must have 3 components")
    return (float(o[0]), float(o[1]), float(o[2]))


@dataclasses.dataclass
class StreamInfo:
    """One stream entry of a manifest.

    Attributes:
        file: Block file name inside the run directory.
        kind: How viewers draw the stream.
        item_shape: Shape of one env-frame item.
        labels: Optional names for vector components.
        units: Optional unit string.
        scale: Optional metres drawn per unit of an ``arrows`` vector.
            Viewers use 1 when it is ``None``.
    """

    file: str
    kind: core.StreamKind
    item_shape: tuple[int, ...] = ()
    labels: tuple[str, ...] | None = None
    units: str | None = None
    scale: float | None = None

    def to_json(self) -> dict[str, Any]:
        """Returns the JSON object of this stream."""
        out: dict[str, Any] = {
            "file": self.file,
            "kind": self.kind,
            "item_shape": list(self.item_shape),
        }
        if self.labels is not None:
            out["labels"] = list(self.labels)
        if self.units is not None:
            out["units"] = self.units
        if self.scale is not None:
            out["scale"] = self.scale
        return out

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> "StreamInfo":
        """Parses a stream object, ignoring unknown fields.

        Raises:
            errors.FormatError: If a field is missing or invalid.
        """
        try:
            kind = obj["kind"]
            if kind not in core.STREAM_KINDS:
                raise errors.FormatError(f"unknown stream kind {kind!r}")
            labels = obj.get("labels")
            return cls(
                str(obj["file"]),
                kind,
                tuple(int(d) for d in obj["item_shape"]),
                None if labels is None else tuple(str(x) for x in labels),
                obj.get("units"),
                None if obj.get("scale") is None else float(obj["scale"]),
            )
        except errors.FormatError:
            raise
        except (KeyError, TypeError, ValueError) as exc:
            raise errors.FormatError(f"bad stream entry: {obj!r}") from exc


@dataclasses.dataclass
class RolloutManifest:
    """The manifest of one run (spec 5).

    Attributes:
        id: ULID, fixed at creation.
        name: Run name, equal to the run directory name.
        created: UTC creation time, ``YYYY-MM-DDTHH:MM:SSZ``.
        status: ``"recording"`` or ``"complete"``.
        dt: Seconds between frames.
        n_frames: Frames per stream.
        n_envs: Envs per stream.
        n_bodies: Bodies per pose.
        scene: Reference to the scene descriptor.
        streams: Streams by name. ``body_pose`` is required.
        env_scenes: Optional per-env scene references.
        env_origins: World offset per env, ``n_envs`` triples.
        source: Provenance (simulator and version).
        tags: Free-form tags set at record time.
        meta: Free-form metadata set at record time.
    """

    id: str
    name: str
    created: str
    dt: float
    n_frames: int
    n_envs: int
    n_bodies: int
    scene: cas.Ref
    streams: dict[str, StreamInfo]
    status: str = "complete"
    env_scenes: tuple[cas.Ref, ...] | None = None
    env_origins: tuple[core.Vec3, ...] | None = None
    source: dict[str, Any] = dataclasses.field(default_factory=dict)
    tags: tuple[str, ...] = ()
    meta: dict[str, Any] = dataclasses.field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        """Returns the JSON object of this manifest."""
        origins = self.env_origins or ((0.0, 0.0, 0.0),) * self.n_envs
        return {
            "format": ROLLOUT_FORMAT,
            "id": self.id,
            "name": self.name,
            "created": self.created,
            "status": self.status,
            "dt": self.dt,
            "n_frames": self.n_frames,
            "n_envs": self.n_envs,
            "n_bodies": self.n_bodies,
            "scene": self.scene.to_json(),
            "env_scenes": (
                None
                if self.env_scenes is None
                else [r.to_json() for r in self.env_scenes]
            ),
            "env_origins": [list(o) for o in origins],
            "streams": {k: v.to_json() for k, v in self.streams.items()},
            "source": self.source,
            "tags": list(self.tags),
            "meta": self.meta,
        }

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> "RolloutManifest":
        """Parses and validates a manifest, ignoring unknown fields.

        Args:
            obj: The parsed ``rollout.json``.

        Returns:
            The manifest.

        Raises:
            errors.FormatError: On an unknown format or major version, a
                missing field, or an invalid ``body_pose`` stream.
        """
        fmt = obj.get("format")
        if not isinstance(fmt, str) or not fmt.startswith("simscope-rollout/"):
            raise errors.FormatError(f"not a rollout manifest: {fmt!r}")
        if fmt.split("/", 1)[1].split(".")[0] != "1":
            raise errors.FormatError(f"unknown manifest version {fmt!r}")
        try:
            env_scenes = obj.get("env_scenes")
            origins = obj.get("env_origins")
            man = cls(
                id=str(obj["id"]),
                name=str(obj["name"]),
                created=str(obj["created"]),
                status=str(obj["status"]),
                dt=float(obj["dt"]),
                n_frames=int(obj["n_frames"]),
                n_envs=int(obj["n_envs"]),
                n_bodies=int(obj["n_bodies"]),
                scene=cas.Ref.from_json(obj["scene"]),
                streams={
                    str(k): StreamInfo.from_json(v)
                    for k, v in obj["streams"].items()
                },
                env_scenes=(
                    None
                    if env_scenes is None
                    else tuple(cas.Ref.from_json(r) for r in env_scenes)
                ),
                env_origins=(
                    None
                    if origins is None
                    else tuple(_vec3(o) for o in origins)
                ),
                source=dict(obj.get("source") or {}),
                tags=tuple(str(t) for t in obj.get("tags") or ()),
                meta=dict(obj.get("meta") or {}),
            )
        except (KeyError, TypeError, ValueError, AttributeError) as exc:
            if isinstance(exc, errors.FormatError):
                raise
            raise errors.FormatError(f"malformed manifest: {exc!r}") from exc
        man.validate()
        return man

    def validate(self) -> None:
        """Checks internal consistency.

        Raises:
            errors.FormatError: If the run name, status, env data or the
                required ``body_pose`` stream is invalid.
        """
        try:
            validate_run_name(self.name)
        except ValueError as exc:
            raise errors.FormatError(str(exc)) from exc
        if self.status not in ("recording", "complete"):
            raise errors.FormatError(f"invalid status {self.status!r}")
        pose = self.streams.get(BODY_POSE)
        if pose is None:
            raise errors.FormatError("manifest has no body_pose stream")
        if pose.kind != "pose" or pose.item_shape != (
            self.n_bodies,
            core.POSE_DIM,
        ):
            raise errors.FormatError("body_pose must be a pose [n_bodies, 7]")
        if self.env_scenes is not None and len(self.env_scenes) != self.n_envs:
            raise errors.FormatError("env_scenes must have n_envs entries")
        if (
            self.env_origins is not None
            and len(self.env_origins) != self.n_envs
        ):
            raise errors.FormatError("env_origins must have n_envs entries")


def read_manifest(run_dir: os.PathLike[str] | str) -> RolloutManifest:
    """Reads a run's manifest.

    Prefers ``rollout.json``; falls back to ``rollout.json.partial`` for a
    run that is still recording (or crashed).

    Args:
        run_dir: The run directory.

    Returns:
        The manifest.

    Raises:
        FileNotFoundError: If neither file exists.
        errors.FormatError: If the manifest is invalid.
    """
    run_dir = pathlib.Path(run_dir)
    path = run_dir / MANIFEST_NAME
    if not path.exists():
        path = run_dir / PARTIAL_NAME
    try:
        obj = json.loads(path.read_bytes())
    except json.JSONDecodeError as exc:
        raise errors.FormatError(f"{path}: invalid JSON: {exc}") from exc
    return RolloutManifest.from_json(obj)


def manifest_bytes(manifest: RolloutManifest) -> bytes:
    """Serializes a manifest: ``indent=2``, sorted keys, trailing newline."""
    text = json.dumps(manifest.to_json(), indent=2, sort_keys=True)
    return (text + "\n").encode("utf-8")


def write_manifest(
    run_dir: os.PathLike[str] | str,
    manifest: RolloutManifest,
    *,
    partial: bool,
) -> pathlib.Path:
    """Writes a manifest atomically.

    With ``partial=True`` the file is ``rollout.json.partial`` and the status
    must be ``"recording"``. With ``partial=False`` the file is
    ``rollout.json``, the status must be ``"complete"``, and any ``.partial``
    file is deleted afterwards.

    Args:
        run_dir: The run directory (created if missing).
        manifest: The manifest.
        partial: Whether this is an in-progress manifest.

    Returns:
        The path written.

    Raises:
        ValueError: If the status does not match ``partial``.
        errors.FormatError: If the manifest is inconsistent.
    """
    expected = "recording" if partial else "complete"
    if manifest.status != expected:
        raise ValueError(
            f"status is {manifest.status!r} but partial={partial} needs "
            f"{expected!r}"
        )
    manifest.validate()
    run_dir = pathlib.Path(run_dir)
    path = run_dir / (PARTIAL_NAME if partial else MANIFEST_NAME)
    cas.atomic_write(path, manifest_bytes(manifest))
    if not partial:
        (run_dir / PARTIAL_NAME).unlink(missing_ok=True)
    return path
