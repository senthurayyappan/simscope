"""Importers for rollouts that already exist on disk.

Two sources are supported, both written through ``Library.record`` so the
content store deduplicates their meshes across runs (decision D15):

* ``.rbundle`` files (artifacts-server / dial-mpc), via
  :func:`import_rbundle`;
* self-contained Brax HTML viewers (``var system = "..."``), via
  :func:`import_brax_html`.

:func:`import_path` sniffs a file (or walks a directory) and picks the
importer. Conventions of each source are documented in the section
comments below. Verified against the reference code and the real data:

``.rbundle`` (``core/viz3d/bundle.py``)
    ``[4B "RBDL"][u64 LE header length][JSON header][tail]``; the tail is
    gzip when ``header.compression == "gzip"``. ``buffers[k].off`` is a byte
    offset into the *uncompressed* tail and ``count`` an element count.
    ``body_pos`` is ``[T, B, 3]`` and ``body_quat`` ``[T, B, 4]`` in
    **wxyz** (MuJoCo ``xquat``), world frame, Z-up, metres. Body 0 is the
    MuJoCo world body. Geoms carry MuJoCo ``geom_size`` conventions (the
    same as the format spec: box half-extents, capsule/cylinder ``[r, h]``
    with the axis along local z, plane ``[hx, hy, spacing]``) and
    ``local_quat`` in wxyz. Mesh geoms hold the vertices already in the
    geom's local frame (``verts_count`` and ``faces_count`` count *elements*,
    three per vertex or face) and their ``size`` is the mesh bounding box,
    which is dropped. ``forces`` is ``[T, K, 2, 3]`` holding
    ``[anchor, vector]`` in world frame (Newtons); inactive feet are NaN. It
    is recorded as the ``contacts`` stream (viewer contracts 7), scaled so
    one body weight draws as 1 m.
    ``predictions`` is ``[T, H, L, 3]``. The scene has no body hierarchy,
    so every body gets ``parent = -1``.

Brax HTML (``brax/io/json.py``, ``brax/visualizer/js/system.js``)
    The page holds ``var system = "<base64 of zlib(JSON)>"`` with keys
    ``opt`` (``opt.timestep`` is the playback frame interval, so
    ``dt = opt.timestep``), ``link_names``, ``name``, ``geoms`` and
    ``states.x``. Z-up, metres, same as MuJoCo. ``states.x[t]`` has
    ``pos`` ``[L, 3]`` and ``rot`` ``[L, 4]`` (wxyz) for the ``L`` links, in
    the world frame; the world body is not in the state, so our body 0 is a
    fixed identity ``"world"`` and link ``i`` is body ``i + 1``. ``geoms``
    maps a link name to its geoms; ``link_idx`` (``-1`` for the world, which
    holds the floor and obstacles) gives the link, ``pos`` and ``rot``
    (wxyz) place the geom in the link frame. ``name`` is the type
    (``Plane``, ``Sphere``, ``Capsule``, ``Cylinder``, ``Box``, ``Mesh``;
    ``HeightMap`` is not drawn by Brax and is skipped) and ``size`` is
    MuJoCo's ``geom_size``: box half-extents, sphere ``[r]``, capsule and
    cylinder ``[r, half-length]`` with the axis along local z, plane
    ``[hx, hy, spacing]`` where zero half-extents mean infinite. Meshes carry
    ``vert`` ``[V, 3]`` and ``face`` ``[F, 3]`` in the geom's local frame
    (``size`` is then the bounding box, which is dropped). Numbers are
    rounded to six decimals, so quaternions are renormalized on import.
"""

import base64
import concurrent.futures
import dataclasses
import datetime
import gzip
import hashlib
import json
import logging
import math
import os
import pathlib
import re
import struct
import zlib
from collections.abc import Collection, Iterator, Mapping, Sequence
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import core, library, transforms

logger = logging.getLogger(__name__)

RBUNDLE_MAGIC = b"RBDL"
_SMALL_JSON_BYTES = 64 * 1024
_GRAVITY = 9.81
_NAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_MAX_NAME = 120
"""Longest base name, leaving room for a de-duplication suffix."""


class ImportFormatError(ValueError):
    """Raised when an input file is not a supported rollout."""


# -- shared helpers --


def unique_run_name(
    library_: library.Library,
    base: str,
    overwrite: bool = False,
    taken: Collection[str] = (),
) -> str:
    """Builds a valid, unused run name from free text.

    Args:
        library_: The target library.
        base: Desired name; invalid characters become ``_``.
        overwrite: Allow the name of a run already in the library.
        taken: Names to avoid in any case, such as those planned for other
            files of the same batch.

    Returns:
        The sanitized name, with ``-2``, ``-3``, ... appended if taken.
    """
    name = _NAME_CHARS.sub("_", base).strip("._-")[:_MAX_NAME] or "run"
    candidate, n = name, 1
    while candidate in taken or (
        not overwrite and library_.run_dir(candidate).exists()
    ):
        n += 1
        candidate = f"{name}-{n}"
    return candidate


def default_name(path: os.PathLike[str] | str) -> str:
    """Returns the unsanitized run name for a file.

    Args:
        path: An importable file.

    Returns:
        The parent folder name for a file called ``rollout.rbundle``, else
        the file stem.
    """
    p = pathlib.Path(path).resolve()
    return p.parent.name if p.name == "rollout.rbundle" else p.stem


def _json_safe(obj: Any) -> Any:
    """Replaces non-finite floats by ``None`` so the value is strict JSON."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, Mapping):
        return {str(k): _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_json_safe(v) for v in obj]
    return obj


def _read_small_json(path: pathlib.Path) -> Any | None:
    """Reads a JSON file if it exists and is small, else returns ``None``."""
    try:
        if path.stat().st_size > _SMALL_JSON_BYTES:
            return None
        return _json_safe(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return None


def _vec3(values: Sequence[float]) -> core.Vec3:
    """Converts three numbers to a float triple."""
    x, y, z = values[:3]
    return (float(x), float(y), float(z))


class _SceneBuilder:
    """Accumulates materials and de-duplicated meshes for one scene."""

    def __init__(self) -> None:
        self.geoms: list[core.Geom] = []
        self.materials: list[core.Material] = []
        self.meshes: list[core.Mesh] = []
        self._material_ids: dict[core.Rgba, int] = {}
        self._mesh_ids: dict[bytes, int] = {}

    def material(self, rgba: Sequence[float]) -> int:
        """Returns the index of the material with this color."""
        key = tuple(float(np.float32(c)) for c in rgba)
        if len(key) != 4:
            raise ImportFormatError(f"rgba needs 4 values, got {rgba!r}")
        idx = self._material_ids.get(key)
        if idx is None:
            idx = len(self.materials)
            self._material_ids[key] = idx
            self.materials.append(core.Material(rgba=key))
        return idx

    def mesh(
        self, vertices: npt.NDArray[np.float32], faces: npt.NDArray[np.uint32]
    ) -> int:
        """Returns the index of a mesh, adding it unless identical bytes exist.

        Args:
            vertices: ``[V, 3]`` float32.
            faces: ``[F, 3]`` uint32.

        Returns:
            The mesh index in the scene.
        """
        digest = hashlib.blake2b(digest_size=16)
        digest.update(struct.pack("<II", len(vertices), len(faces)))
        digest.update(vertices)
        digest.update(faces)
        key = digest.digest()
        idx = self._mesh_ids.get(key)
        if idx is None:
            idx = len(self.meshes)
            self._mesh_ids[key] = idx
            self.meshes.append(core.Mesh(vertices, faces))
        return idx

    def build(self, bodies: Sequence[core.Body]) -> core.Scene:
        """Returns the finished scene."""
        return core.Scene(
            bodies=tuple(bodies),
            geoms=tuple(self.geoms),
            materials=tuple(self.materials) or (core.Material(),),
            meshes=tuple(self.meshes),
        )


class _Stream:
    """An extra stream to record next to ``body_pose``."""

    def __init__(
        self,
        kind: core.StreamKind,
        data: npt.NDArray[np.float32],
        scale: float | None = None,
        units: str | None = None,
    ) -> None:
        self.kind = kind
        self.data = data
        self.scale = scale
        self.units = units


_STAMP = re.compile(
    r"(?<!\d)(20\d{2})(\d{2})(\d{2})[T_-]?(\d{2})(\d{2})(\d{2})(?:\d{3,6})?(?!\d)"
)


def recorded_time(path: os.PathLike[str] | str) -> str:
    """Estimates when a source file was recorded, as a UTC timestamp.

    A timestamp embedded in the file or its folder name wins (such as
    ``20260911-132437_x.html`` or ``crate-20260910T005846Z``), because
    copying a file changes its modification time. Otherwise the file's
    modification time is used.

    Args:
        path: The source file.

    Returns:
        ``YYYY-MM-DDTHH:MM:SSZ`` in UTC.
    """
    path = pathlib.Path(path)
    for text in (path.name, path.parent.name):
        m = _STAMP.search(text)
        if m:
            try:
                year, month, day, hour, minute, second = map(int, m.groups())
                when = datetime.datetime(year, month, day, hour, minute, second)
            except ValueError:
                continue
            return when.strftime("%Y-%m-%dT%H:%M:%SZ")
    mtime = datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.UTC)
    return mtime.strftime("%Y-%m-%dT%H:%M:%SZ")


def _write_run(
    library_: library.Library,
    name: str,
    *,
    scene: core.Scene,
    dt: float,
    poses: npt.NDArray[np.float32],
    streams: Mapping[str, _Stream],
    source: Mapping[str, Any],
    tags: Sequence[str],
    meta: Mapping[str, Any],
    overwrite: bool,
    created: str | None = None,
) -> None:
    """Records a whole run in one ``log_frames`` call."""
    with library_.record(
        name,
        scene=scene,
        dt=dt,
        source=source,
        tags=tags,
        meta=meta,
        overwrite=overwrite,
        created=created,
    ) as rec:
        for sname, stream in streams.items():
            rec.add_stream(
                sname,
                stream.kind,
                stream.data.shape[2:],
                scale=stream.scale,
                units=stream.units,
            )
        rec.log_frames(poses, **{k: s.data for k, s in streams.items()})


def _all_tags(user_tags: Sequence[str], auto: str) -> tuple[str, ...]:
    """User tags followed by the automatic source tag, without repeats."""
    return tuple(dict.fromkeys([*user_tags, auto]))


def _poses(
    pos: npt.NDArray[np.float32], quat_wxyz: npt.NDArray[np.float32]
) -> npt.NDArray[np.float32]:
    """Stacks ``[T, B, 3]`` positions and wxyz quats into xyzw poses."""
    return np.concatenate(
        (pos, transforms.wxyz_to_xyzw(quat_wxyz)), axis=-1, dtype=np.float32
    )


# -- .rbundle --

_RB_KINDS = frozenset(
    ("box", "sphere", "capsule", "cylinder", "ellipsoid", "plane", "mesh")
)
_MAX_PREDICTION_LINKS = 32


def _parse_rbundle(
    data: bytes | memoryview,
) -> tuple[dict[str, Any], memoryview]:
    """Splits an ``.rbundle`` into its JSON header and uncompressed tail.

    Raises:
        ImportFormatError: If the magic or header is invalid.
    """
    view = memoryview(data)
    if len(view) < 12 or bytes(view[:4]) != RBUNDLE_MAGIC:
        raise ImportFormatError("not an .rbundle (bad magic)")
    (hlen,) = struct.unpack("<Q", view[4:12])
    if 12 + hlen > len(view):
        raise ImportFormatError("truncated .rbundle header")
    try:
        header = json.loads(bytes(view[12 : 12 + hlen]))
    except ValueError as exc:
        raise ImportFormatError("invalid .rbundle header") from exc
    tail = view[12 + hlen :]
    if header.get("compression") == "gzip":
        tail = memoryview(gzip.decompress(tail))
    return header, tail


def _buffer(
    tail: memoryview, spec: Mapping[str, Any], dtype: type[np.generic]
) -> npt.NDArray:
    """Views a header buffer spec as an array."""
    arr = np.frombuffer(tail, dtype, count=spec["count"], offset=spec["off"])
    return arr.reshape(spec["shape"])


def _rbundle_geom(
    builder: _SceneBuilder,
    gj: Mapping[str, Any],
    tail: memoryview,
    n_bodies: int,
) -> core.Geom | None:
    """Converts one header geom, or returns ``None`` if unsupported."""
    kind = gj["type"]
    if kind not in _RB_KINDS:
        logger.warning(
            "skipping geom %r of unsupported kind %r", gj["name"], kind
        )
        return None
    if not 0 <= gj["body"] < n_bodies:
        raise ImportFormatError(
            f"geom {gj['name']!r} has bad body {gj['body']}"
        )
    mesh = None
    size = _vec3(gj["size"])
    if kind == "mesh":
        spec = gj.get("mesh")
        if spec is None:
            return None
        verts = np.frombuffer(
            tail, np.float32, spec["verts_count"], spec["verts_off"]
        ).reshape(-1, 3)
        faces = np.frombuffer(
            tail, np.uint32, spec["faces_count"], spec["faces_off"]
        ).reshape(-1, 3)
        mesh = builder.mesh(verts, faces)
        size = (0.0, 0.0, 0.0)  # the source stores the mesh's bounds here
    quat = transforms.wxyz_to_xyzw(gj["local_quat"])
    return core.Geom(
        body=int(gj["body"]),
        kind=kind,
        size=_vec3(size),
        pos=_vec3(gj["local_pos"]),
        quat=(float(quat[0]), float(quat[1]), float(quat[2]), float(quat[3])),
        material=builder.material(gj["rgba"]),
        mesh=mesh,
        role="collision" if gj.get("is_collision") else "visual",
        name=str(gj.get("name", "")),
    )


def _force_scale(
    arrows: npt.NDArray[np.float32], meta: Mapping[str, Any]
) -> float:
    """Metres of arrow per Newton: one body weight draws as 1 m.

    The mass comes from the bundle's metadata. Without it, the weight is
    estimated as the mean total vertical force, since a supported robot's
    ground reaction averages to its weight.
    """
    mass = meta.get("robot_mass_kg") or meta.get("total_mass_kg")
    if mass:
        weight = max(float(mass), 1e-3) * _GRAVITY
    else:
        weight = float(arrows[..., 5].sum(axis=1).mean())
    return 1.0 / weight if weight > 1.0 else 1.0 / _GRAVITY


def _rbundle_streams(
    header: Mapping[str, Any],
    tail: memoryview,
) -> dict[str, _Stream]:
    """Builds the contact-force and prediction streams in the header."""
    bufs = header["buffers"]
    streams: dict[str, _Stream] = {}
    if "forces" in bufs:
        forces = _buffer(tail, bufs["forces"], np.float32)
        # [T, K, 2, 3] -> [T, K, 6]; inactive feet (NaN) become zero-length.
        arrows = np.nan_to_num(forces.reshape(len(forces), -1, 6), nan=0.0)
        streams["contacts"] = _Stream(
            "arrows", arrows, _force_scale(arrows, header["meta"]), "N"
        )
    if "predictions" in bufs:
        preds = _buffer(tail, bufs["predictions"], np.float32)
        if preds.size and preds.ndim == 4:
            n_links = min(preds.shape[2], _MAX_PREDICTION_LINKS)
            for link in range(n_links):
                streams[f"predictions_{link}"] = _Stream(
                    "polyline", np.ascontiguousarray(preds[:, :, link])
                )
    return {
        k: _Stream(
            s.kind,
            np.ascontiguousarray(s.data[:, None], np.float32),
            s.scale,
            s.units,
        )
        for k, s in streams.items()
    }


def import_rbundle(
    lib: library.Library,
    path: os.PathLike[str] | str,
    *,
    name: str | None = None,
    tags: Sequence[str] = (),
    overwrite: bool = False,
) -> str:
    """Imports an ``.rbundle`` into a library.

    Args:
        lib: The target library.
        path: The ``.rbundle`` file. Sibling ``config.json`` and
            ``metrics.json`` (each under 64 KB) are copied into ``meta``.
        name: Run name. Default: the parent folder name for a file called
            ``rollout.rbundle``, else the file stem. It is sanitized and
            de-duplicated with a ``-N`` suffix unless ``overwrite``.
        tags: Extra tags; ``source:rbundle`` is always added.
        overwrite: Replace an existing run of the same name.

    Returns:
        The name of the new run.

    Raises:
        ImportFormatError: If the file is not a valid ``.rbundle``.
        OSError: If the file cannot be read.
    """
    path = pathlib.Path(path).resolve()
    header, tail = _parse_rbundle(path.read_bytes())
    bufs = header["buffers"]
    pos = _buffer(tail, bufs["body_pos"], np.float32)
    quat = _buffer(tail, bufs["body_quat"], np.float32)
    n_bodies = pos.shape[1]
    builder = _SceneBuilder()
    for gj in header["geoms"]:
        geom = _rbundle_geom(builder, gj, tail, n_bodies)
        if geom is not None:
            builder.geoms.append(geom)
    meta_in = header.get("meta", {})
    names = meta_in.get("body_names") or []
    bodies = [
        core.Body(
            str(names[i])
            if i < len(names)
            else ("world" if i == 0 else f"body_{i}")
        )
        for i in range(n_bodies)
    ]
    scene = builder.build(bodies)
    meta: dict[str, Any] = {"rbundle": _json_safe(meta_in)}
    for key in ("config", "metrics"):
        value = _read_small_json(path.with_name(f"{key}.json"))
        if value is not None:
            meta[key] = value
    run = unique_run_name(lib, name or default_name(path), overwrite)
    _write_run(
        lib,
        run,
        scene=scene,
        dt=float(meta_in.get("dt") or 1.0 / float(meta_in.get("fps", 50.0))),
        poses=_poses(pos, quat),
        streams=_rbundle_streams(header, tail),
        source={
            "simulator": "mujoco",
            "importer": "rbundle",
            "original": str(path),
        },
        tags=_all_tags(tags, "source:rbundle"),
        meta=meta,
        overwrite=overwrite,
        created=recorded_time(path),
    )
    return run


# -- Brax HTML --

_BRAX_KINDS: dict[str, core.GeomKind] = {
    "Plane": "plane",
    "Sphere": "sphere",
    "Capsule": "capsule",
    "Cylinder": "cylinder",
    "Box": "box",
    "Mesh": "mesh",
}
_BRAX_SYSTEM = re.compile(rb'var system = "([^"]*)"')
_BRAX_TITLE = re.compile(rb"<title>(.*?)</title>", re.DOTALL)
_SNIFF_BYTES = 64 * 1024


def _load_brax_system(data: bytes) -> tuple[dict[str, Any], str]:
    """Extracts the ``system`` JSON and page title from a Brax page.

    Raises:
        ImportFormatError: If the page has no decodable ``var system``.
    """
    match = _BRAX_SYSTEM.search(data)
    if match is None:
        raise ImportFormatError("no `var system` in the HTML page")
    try:
        raw = zlib.decompress(base64.b64decode(match.group(1)))
        system = json.loads(raw)
    except (ValueError, zlib.error) as exc:
        raise ImportFormatError("cannot decode `var system`") from exc
    title = _BRAX_TITLE.search(data[:_SNIFF_BYTES])
    text = title.group(1).decode("utf-8", "replace").strip() if title else ""
    return system, text


def _unit_quats(values: Any) -> npt.NDArray[np.float32]:
    """Converts wxyz quaternions to normalized xyzw float32."""
    q = np.asarray(values, dtype=np.float64)
    norm = np.linalg.norm(q, axis=-1, keepdims=True)
    q = q / np.where(norm > 0, norm, 1.0)
    return transforms.wxyz_to_xyzw(q)


def _brax_geom(
    builder: _SceneBuilder, gj: Mapping[str, Any], n_links: int
) -> core.Geom | None:
    """Converts one Brax geom, or returns ``None`` if it is not drawable."""
    kind = _BRAX_KINDS.get(gj["name"])
    if kind is None:
        logger.warning("skipping Brax geom of type %r", gj["name"])
        return None
    link = int(gj.get("link_idx", -1))
    if not -1 <= link < n_links:
        raise ImportFormatError(f"geom has bad link_idx {link}")
    mesh = None
    size = _vec3([*gj["size"], 0.0, 0.0, 0.0])
    if kind == "mesh":
        verts = np.array(gj["vert"], dtype=np.float32).reshape(-1, 3)
        faces = np.array(gj["face"], dtype=np.uint32).reshape(-1, 3)
        mesh = builder.mesh(verts, faces)
        size = (0.0, 0.0, 0.0)
    quat = _unit_quats(gj["rot"])
    return core.Geom(
        body=link + 1,
        kind=kind,
        size=size,
        pos=_vec3(gj["pos"]),
        quat=(
            float(quat[0]),
            float(quat[1]),
            float(quat[2]),
            float(quat[3]),
        ),
        material=builder.material(gj["rgba"]),
        mesh=mesh,
        name=f"{gj['name'].lower()}_{link}",
    )


def _brax_poses(states: Sequence[Mapping[str, Any]]) -> npt.NDArray[np.float32]:
    """Stacks ``states.x`` into ``[T, 1 + L, 7]`` poses with a world body."""
    pos = np.asarray([s["pos"] for s in states], dtype=np.float32)
    quat = _unit_quats([s["rot"] for s in states])
    poses = np.zeros((len(states), pos.shape[1] + 1, 7), np.float32)
    poses[:, 0, 6] = 1.0
    poses[:, 1:, :3] = pos
    poses[:, 1:, 3:] = quat
    return poses


def import_brax_html(
    lib: library.Library,
    path: os.PathLike[str] | str,
    *,
    name: str | None = None,
    tags: Sequence[str] = (),
    overwrite: bool = False,
) -> str:
    """Imports a self-contained Brax HTML viewer into a library.

    Args:
        lib: The target library.
        path: The HTML file containing ``var system = "..."``.
        name: Run name; default the file stem. Sanitized and de-duplicated
            with a ``-N`` suffix unless ``overwrite``.
        tags: Extra tags; ``source:brax`` is always added.
        overwrite: Replace an existing run of the same name.

    Returns:
        The name of the new run.

    Raises:
        ImportFormatError: If the page has no valid Brax ``system``.
        OSError: If the file cannot be read.
    """
    path = pathlib.Path(path).resolve()
    system, title = _load_brax_system(path.read_bytes())
    states = system["states"]["x"]
    if not states:
        raise ImportFormatError("the Brax page has no frames")
    poses = _brax_poses(states)
    n_links = poses.shape[1] - 1
    builder = _SceneBuilder()
    for link_geoms in system["geoms"].values():
        for gj in link_geoms:
            geom = _brax_geom(builder, gj, n_links)
            if geom is not None:
                builder.geoms.append(geom)
    names = [str(n) for n in system.get("link_names", [])]
    names += [f"link {i}" for i in range(len(names), n_links)]
    bodies = [core.Body("world"), *(core.Body(n) for n in names[:n_links])]
    meta = {"brax": {"title": title, "name": system.get("name", "")}}
    dt = float(system["opt"]["timestep"])
    run = unique_run_name(lib, name or default_name(path), overwrite)
    _write_run(
        lib,
        run,
        scene=builder.build(bodies),
        dt=dt,
        poses=poses,
        streams={},
        source={
            "simulator": "brax",
            "importer": "brax",
            "original": str(path),
        },
        tags=_all_tags(tags, "source:brax"),
        meta=meta,
        overwrite=overwrite,
        created=recorded_time(path),
    )
    return run


# -- dispatch --


def _sniff(path: pathlib.Path) -> str | None:
    """Returns ``"rbundle"``, ``"brax"`` or ``None`` for a file."""
    try:
        with path.open("rb") as f:
            head = f.read(_SNIFF_BYTES)
    except OSError:
        return None
    if head.startswith(RBUNDLE_MAGIC):
        return "rbundle"
    if b'var system = "' in head:
        return "brax"
    return None


def find_importable(
    paths: Sequence[os.PathLike[str] | str],
) -> list[tuple[pathlib.Path, str]]:
    """Finds importable files in files and directories (recursively).

    Args:
        paths: Files or directories. Files are sniffed by content; in
            directories only ``*.rbundle`` and ``*.html`` files are tried.

    Returns:
        ``(path, format)`` pairs, sorted by path, where format is
        ``"rbundle"`` or ``"brax"``.

    Raises:
        FileNotFoundError: If a path does not exist.
    """
    found: dict[pathlib.Path, str] = {}
    for p in map(pathlib.Path, paths):
        if p.is_dir():
            candidates = [
                f
                for f in p.rglob("*")
                if f.suffix in (".rbundle", ".html") and f.is_file()
            ]
        elif p.is_file():
            candidates = [p]
        else:
            raise FileNotFoundError(f"no such file or folder: {p}")
        for f in candidates:
            fmt = _sniff(f)
            if fmt is not None:
                found[f.resolve()] = fmt
            elif f == p:
                logger.warning("%s is not a supported rollout file", f)
    return sorted(found.items())


def import_one(
    lib: library.Library,
    path: os.PathLike[str] | str,
    fmt: str | None = None,
    **kwargs: Any,
) -> str:
    """Imports one file with the importer that matches its content.

    Args:
        lib: The target library.
        path: The file.
        fmt: ``"rbundle"`` or ``"brax"``, or ``None`` to sniff the file.
        **kwargs: ``name``, ``tags`` and ``overwrite``, as for
            :func:`import_rbundle`.

    Returns:
        The run name.

    Raises:
        ImportFormatError: If the file is not a supported rollout.
    """
    fmt = fmt or _sniff(pathlib.Path(path))
    if fmt == "rbundle":
        return import_rbundle(lib, path, **kwargs)
    if fmt == "brax":
        return import_brax_html(lib, path, **kwargs)
    raise ImportFormatError(f"{path} is not a supported rollout file")


def import_path(
    lib: library.Library, path: os.PathLike[str] | str, **kwargs: Any
) -> list[str]:
    """Imports a file, or every importable file under a directory.

    Args:
        lib: The target library.
        path: A ``.rbundle`` or Brax HTML file, or a directory searched
            recursively.
        **kwargs: ``tags`` and ``overwrite`` (and ``name`` for a single
            file), as for :func:`import_rbundle`.

    Returns:
        The names of the new runs, in path order.

    Raises:
        FileNotFoundError: If ``path`` does not exist.
        ImportFormatError: If ``path`` is a file of an unknown format.
    """
    p = pathlib.Path(path)
    if p.is_file() and _sniff(p) is None:
        raise ImportFormatError(f"{p} is not a supported rollout file")
    return [
        import_one(lib, f, fmt, **kwargs) for f, fmt in find_importable([p])
    ]


# -- batches --

_MAX_JOBS = 8
"""Default worker cap: a Brax page needs a few hundred MB while parsed."""


@dataclasses.dataclass(frozen=True)
class ImportResult:
    """The outcome of importing one file.

    Attributes:
        path: The input file.
        name: The new run, or ``None`` if the import failed.
        n_frames: Frames in the new run (0 on failure).
        error: A one-line message if the import failed, else ``None``.
    """

    path: pathlib.Path
    name: str | None
    n_frames: int = 0
    error: str | None = None


def _import_task(
    task: tuple[pathlib.Path, pathlib.Path, str, str, tuple[str, ...], bool],
) -> ImportResult:
    """Imports one planned file; runs in a worker process."""
    root, path, fmt, name, tags, overwrite = task
    lib = library.Library(root)
    try:
        run = import_one(
            lib, path, fmt, name=name, tags=tags, overwrite=overwrite
        )
        with lib.open(run) as rollout:
            n_frames = rollout.manifest.n_frames
    except (
        Exception
    ) as exc:  # isolation point: one bad file must not stop a batch
        logger.debug("import of %s failed", path, exc_info=True)
        return ImportResult(path, None, 0, f"{type(exc).__name__}: {exc}")
    finally:
        lib.close()
    return ImportResult(path, run, n_frames)


def import_files(
    lib: library.Library,
    files: Sequence[tuple[pathlib.Path, str]],
    *,
    tags: Sequence[str] = (),
    overwrite: bool = False,
    jobs: int | None = None,
) -> Iterator[ImportResult]:
    """Imports many files, in parallel processes, yielding in input order.

    Run names are planned up front, so workers never race for a name.
    Writes into the shared content store are atomic, so concurrent workers
    are safe. A file that fails is reported in its result; the others go on.

    Args:
        lib: The target library.
        files: ``(path, format)`` pairs from :func:`find_importable`.
        tags: Extra tags for every run.
        overwrite: Replace existing runs of the same names.
        jobs: Worker processes; ``None`` picks ``min(files, cpus, 8)``, and
            1 imports in this process.

    Yields:
        One result per file, in the order given.
    """
    taken: set[str] = set()
    tasks = []
    for path, fmt in files:
        name = unique_run_name(lib, default_name(path), overwrite, taken)
        taken.add(name)
        tasks.append((lib.root, path, fmt, name, tuple(tags), overwrite))
    if jobs is None:
        jobs = min(len(tasks), os.cpu_count() or 1, _MAX_JOBS)
    if jobs <= 1 or len(tasks) <= 1:
        for task in tasks:
            yield _import_task(task)
        return
    with concurrent.futures.ProcessPoolExecutor(jobs) as pool:
        yield from pool.map(_import_task, tasks)
