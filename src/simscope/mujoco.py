"""Adapter for MuJoCo, MJX, and MuJoCo Warp.

``scene_from_model`` turns a compiled ``MjModel`` into a
``simscope.core.Scene``. ``poses`` turns simulator state into the
``[E, B, 7]`` pose array the recorder logs, converting MuJoCo's wxyz
quaternions to simscope's xyzw. Nothing here imports JAX or Warp: MJX and
Warp arrays only need to convert through ``np.asarray`` (or ``.numpy()``).

``contacts`` turns ``data.contact`` into the ``[1, K, 6]`` arrows frame of
the ``contacts`` stream (point and force on the robot, both in the world
frame), and ``add_contacts_stream`` declares that stream on a recorder with
the ``1 / (m g)`` drawing scale.

Importing this module imports ``mujoco``; ``import simscope`` does not.

Example:
    >>> from simscope import mujoco as smj
    >>> scene = smj.scene_from_model(model)
    >>> frame = smj.poses(data)  # [1, n_bodies, 7]
    >>> smj.add_contacts_stream(rec, model, max_contacts=16)
    >>> rec.log(frame, contacts=smj.contacts(model, data, max_contacts=16))
"""

import collections
import logging
import struct
import zlib
from typing import Any

import numpy as np
import numpy.typing as npt

try:
    import mujoco
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "simscope.mujoco needs the mujoco package: "
        "pip install 'simscope[mujoco]'"
    ) from e

from simscope import _mjviser, core

_LOG = logging.getLogger(__name__)

_GEOM = mujoco.mjtGeom
_KINDS: dict[int, core.GeomKind] = {
    int(_GEOM.mjGEOM_BOX): "box",
    int(_GEOM.mjGEOM_SPHERE): "sphere",
    int(_GEOM.mjGEOM_CAPSULE): "capsule",
    int(_GEOM.mjGEOM_CYLINDER): "cylinder",
    int(_GEOM.mjGEOM_ELLIPSOID): "ellipsoid",
    int(_GEOM.mjGEOM_PLANE): "plane",
    int(_GEOM.mjGEOM_MESH): "mesh",
    int(_GEOM.mjGEOM_HFIELD): "mesh",
}
_FIRST_COLLISION_GROUP = 3
"""Geom groups at or above this are hidden by default in MuJoCo and mjviser."""

_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_PNG_COLOR_TYPE = {3: 2, 4: 6}  # channels -> RGB, RGBA


def source_info() -> dict[str, str]:
    """Describes the simulator for a rollout manifest.

    Returns:
        ``{"simulator": "mujoco", "version": <mujoco version>}``. MJX and
        MuJoCo Warp are reported as ``mujoco`` too.
    """
    return {"simulator": "mujoco", "version": mujoco.__version__}


def scene_from_model(
    model: mujoco.MjModel, *, collision: bool = True
) -> core.Scene:
    """Builds a scene from a compiled MuJoCo model.

    Bodies keep MuJoCo's ids, so the pose stream from ``poses`` lines up
    with ``Scene.bodies``. Geoms are attached to ``geom_bodyid`` with
    ``geom_pos``/``geom_quat`` as their local pose. Mesh vertices are stored
    exactly as ``mjModel`` holds them (already recentered and scaled by the
    compiler), so the geom's local pose alone places them in the world and
    ``Geom.scale`` is always 1.

    Geom kinds: box, sphere, capsule, cylinder, ellipsoid, plane, and mesh
    map one to one with MuJoCo's ``geom_size`` (unused entries zeroed).
    Height fields are tessellated into meshes in the geom frame. Other
    geom types (SDF) are skipped with a single warning.

    Role rule (group only, as in mjviser, whose viewer shows groups 0-2 by
    default): a geom is ``"collision"`` if its ``geom_group`` is 3 or
    higher, or if its displayed alpha is 0; otherwise it is ``"visual"``.
    ``contype``/``conaffinity`` are deliberately ignored, because in plain
    MJCF a default (group 0) geom collides and is also the only thing to
    look at.

    Color rule (verified against ``mjv_updateScene``): a geom with a
    material takes ``mat_rgba`` unless its own ``rgba`` was set explicitly.
    Materials are deduplicated. Only 2D textures are exported, as PNG;
    cube maps and skyboxes are dropped. A mesh geom keeps its texture only
    if the mesh has texture coordinates. Texture coordinates follow OpenGL
    (``v = 0`` is the bottom of the image) and PNG rows are top-down.

    MuJoCo's stored mesh normals are not exported; viewers compute them.

    Args:
        model: A compiled ``mujoco.MjModel``.
        collision: If false, keep only ``"visual"`` geoms.

    Returns:
        The scene. Meshes, textures, and materials are deduplicated and
        include only what the kept geoms use.
    """
    body_names = [
        mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, i) or f"body{i}"
        for i in range(model.nbody)
    ]
    parents = model.body_parentid.tolist()
    if parents:
        parents[0] = -1
    masses = model.body_mass.tolist()
    if masses:
        masses[0] = 0.0  # the world body has no mass
    bodies = tuple(
        core.Body(name=name, parent=parent, mass=mass)
        for name, parent, mass in zip(body_names, parents, masses, strict=True)
    )

    types = model.geom_type
    supported = np.isin(types, list(_KINDS))
    supported &= ~((types == _GEOM.mjGEOM_MESH) & (model.geom_dataid < 0))
    _warn_skipped(model, types[~supported])

    rgba = _mjviser.effective_geom_rgba(model)
    hidden = (model.geom_group >= _FIRST_COLLISION_GROUP) | (rgba[:, 3] == 0)
    keep = supported if collision else supported & ~hidden
    ids = np.flatnonzero(keep)

    sizes = model.geom_size[ids].astype(np.float64)
    kept_types = types[ids]
    sizes[kept_types == _GEOM.mjGEOM_SPHERE, 1:] = 0.0
    sizes[
        (kept_types == _GEOM.mjGEOM_CAPSULE)
        | (kept_types == _GEOM.mjGEOM_CYLINDER),
        2,
    ] = 0.0
    sizes[
        (kept_types == _GEOM.mjGEOM_MESH) | (kept_types == _GEOM.mjGEOM_HFIELD)
    ] = 0.0
    positions = model.geom_pos[ids].tolist()
    quats = model.geom_quat[ids][:, [1, 2, 3, 0]].tolist()
    size_rows = sizes.tolist()

    builder = _SceneBuilder(model, rgba)
    geoms = []
    for k, gid in enumerate(ids.tolist()):
        material, mesh = builder.material_and_mesh(gid)
        geoms.append(
            core.Geom(
                body=int(model.geom_bodyid[gid]),
                kind=_KINDS[int(types[gid])],
                size=tuple(size_rows[k]),
                pos=tuple(positions[k]),
                quat=tuple(quats[k]),
                material=material,
                mesh=mesh,
                role="collision" if hidden[gid] else "visual",
                name=mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, gid)
                or "",
            )
        )
    return core.Scene(
        bodies=bodies,
        geoms=tuple(geoms),
        materials=tuple(builder.materials) or (core.Material(),),
        meshes=tuple(builder.meshes),
        textures=tuple(builder.textures),
    )


def poses(
    data_or_xpos: Any,
    xquat: Any | None = None,
    *,
    out: npt.NDArray[np.float32] | None = None,
) -> npt.NDArray[np.float32]:
    """Packs body poses into simscope's ``[E, B, 7]`` layout.

    Args:
        data_or_xpos: Either an object with ``xpos`` and ``xquat``
            attributes (``mujoco.MjData``, or an MJX data object), or the
            body positions ``xpos`` with shape ``[..., B, 3]``. Arrays may be
            numpy, JAX, or Warp; anything with a ``numpy()`` method uses it,
            everything else goes through ``np.asarray``.
        xquat: Body quaternions in wxyz order, shape ``[..., B, 4]``. Must be
            ``None`` when ``data_or_xpos`` is a data object.
        out: Optional preallocated float32 C-contiguous ``[E, B, 7]`` array
            to fill and return.

    Returns:
        A float32 C-contiguous array ``[E, B, 7]`` of ``xyz`` followed by
        quaternion ``xyzw``. A single ``MjData`` gives ``E = 1``; extra
        leading axes of batched input are flattened into ``E``. The result
        never aliases the input.

    Raises:
        ValueError: If shapes are inconsistent, or ``out`` is unsuitable.
        TypeError: If ``xquat`` is missing and the first argument has no
            ``xpos``/``xquat``.
    """
    if xquat is None:
        if not (
            hasattr(data_or_xpos, "xpos") and hasattr(data_or_xpos, "xquat")
        ):
            raise TypeError(
                "pass MjData (or an object with xpos and xquat), "
                "or both xpos and xquat arrays"
            )
        xpos_in, xquat_in = data_or_xpos.xpos, data_or_xpos.xquat
    else:
        xpos_in, xquat_in = data_or_xpos, xquat
    xpos = _to_numpy(xpos_in)
    quat = _to_numpy(xquat_in)
    if xpos.ndim < 2 or xpos.shape[-1] != 3:
        raise ValueError(f"xpos must have shape [..., B, 3], got {xpos.shape}")
    if quat.shape[:-1] != xpos.shape[:-1] or quat.shape[-1] != 4:
        raise ValueError(
            f"xquat must have shape {(*xpos.shape[:-1], 4)}, got {quat.shape}"
        )
    n_bodies = xpos.shape[-2]
    xpos = xpos.reshape(-1, n_bodies, 3)
    quat = quat.reshape(-1, n_bodies, 4)
    shape = (xpos.shape[0], n_bodies, core.POSE_DIM)
    if out is None:
        out = np.empty(shape, dtype=np.float32)
    elif (
        out.shape != shape
        or out.dtype != np.float32
        or not out.flags.c_contiguous
    ):
        raise ValueError(
            f"out must be a C-contiguous float32 array of shape {shape}"
        )
    out[..., :3] = xpos
    out[..., 3:6] = quat[..., 1:]
    out[..., 6] = quat[..., 0]
    return out


DEFAULT_MAX_CONTACTS = 16
"""Contact slots per frame that ``add_contacts_stream`` reserves."""

CONTACTS_STREAM = "contacts"
"""Name of the contacts stream (viewer contracts 7)."""

_GRAVITY = 9.81


def contacts(
    model: mujoco.MjModel,
    data: mujoco.MjData,
    out: npt.NDArray[np.float32] | None = None,
    *,
    max_contacts: int | None = None,
) -> npt.NDArray[np.float32]:
    """Packs the active contacts of one ``MjData`` for the contacts stream.

    Each row is ``[px, py, pz, fx, fy, fz]``: the contact point (m) and the
    force (N) that the world exerts on the robot, both in the world frame.
    MuJoCo's contact force (``mj_contactForce``, rotated out of the contact
    frame) is the force on geom 2, so the sign is flipped when the robot is
    geom 1. The fixed side is the one whose geom belongs to the world body
    (the ground, a wall); if neither geom does, the force on geom 2 is
    used. Unused rows are zero, and so are contacts that carry no force. If
    there are more than ``K`` force-carrying contacts, the ``K`` strongest
    are kept.

    For batched MJX or MuJoCo Warp data, convert each env to an ``MjData``
    (``mjx.get_data(model, batch)`` returns one per env) and call this once
    per env with ``out=frame[e]``, where ``frame`` is an ``[E, K, 6]``
    array. A fully batched path would need ``mj_contactForce`` on device
    and is left out on purpose.

    Args:
        model: The compiled model.
        data: Simulator state; contacts are read as of the last step.
        out: Optional float32 C-contiguous buffer to fill (and return),
            shape ``[K, 6]`` or ``[1, K, 6]``. It is zeroed first.
        max_contacts: ``K`` when ``out`` is not given.

    Returns:
        A float32 array ``[1, K, 6]`` (``out`` itself when it has that
        shape, else a view of it), ready for ``Recorder.log``.

    Raises:
        ValueError: If neither ``out`` nor ``max_contacts`` is given, they
            disagree, or ``out`` is unsuitable.
    """
    if out is None:
        if max_contacts is None or max_contacts < 1:
            raise ValueError("pass out, or max_contacts >= 1")
        out = np.zeros((1, max_contacts, 6), dtype=np.float32)
    else:
        if (
            out.dtype != np.float32
            or not out.flags.c_contiguous
            or out.ndim not in (2, 3)
            or out.shape[-1] != 6
            or (out.ndim == 3 and out.shape[0] != 1)
        ):
            raise ValueError(
                "out must be a C-contiguous float32 [K, 6] or [1, K, 6] "
                f"array, got {out.dtype} {out.shape}"
            )
        if max_contacts is not None and max_contacts != out.shape[-2]:
            raise ValueError(
                f"max_contacts={max_contacts} but out has {out.shape[-2]} rows"
            )
        out[...] = 0.0
    rows = out.reshape(-1, 6)
    n = int(data.ncon)
    if n == 0:
        return out.reshape(1, *rows.shape)
    contact = data.contact
    local = np.zeros(6)
    force = np.zeros((n, 3))
    for i in range(n):
        mujoco.mj_contactForce(model, data, i, local)
        force[i] = local[:3]
    frame = np.asarray(contact.frame[:n]).reshape(n, 3, 3)
    world = np.einsum("nji,nj->ni", frame, force)  # force on geom 2
    geoms = np.asarray(contact.geom[:n])
    fixed = model.geom_bodyid[geoms] == 0
    world[fixed[:, 1] & ~fixed[:, 0]] *= -1.0  # robot is geom 1
    magnitude = np.einsum("ni,ni->n", world, world)
    live = np.flatnonzero(magnitude > 0.0)
    if len(live) > len(rows):
        live = live[np.argsort(-magnitude[live], kind="stable")[: len(rows)]]
        live.sort()
    rows[: len(live), :3] = np.asarray(contact.pos[:n])[live]
    rows[: len(live), 3:] = world[live]
    return out.reshape(1, *rows.shape)


def contacts_scale(model: mujoco.MjModel) -> float:
    """Metres of drawn arrow per newton: one body weight draws as 1 m.

    Args:
        model: The compiled model.

    Returns:
        ``1 / (m g)`` with ``m`` the total mass and ``g`` gravity's
        magnitude, or ``1 / (m * 9.81)`` when the model has no gravity, or
        ``1.0`` when it has no mass.
    """
    mass = float(model.body_subtreemass[0])
    g = float(np.linalg.norm(model.opt.gravity)) or _GRAVITY
    return 1.0 / (mass * g) if mass > 0.0 else 1.0


def add_contacts_stream(
    recorder: Any,
    model: mujoco.MjModel,
    *,
    max_contacts: int = DEFAULT_MAX_CONTACTS,
    name: str = CONTACTS_STREAM,
) -> None:
    """Declares the contacts stream on a recorder.

    Call it before the first ``log``, then pass ``contacts(...)`` as the
    ``contacts`` keyword of ``log``.

    Args:
        recorder: A ``simscope.recorder.Recorder``.
        model: The compiled model (its mass sets the drawing scale).
        max_contacts: ``K``, the contact slots per frame.
        name: Stream name.
    """
    recorder.add_stream(
        name,
        "arrows",
        (max_contacts, 6),
        units="N",
        scale=contacts_scale(model),
    )


def _to_numpy(array: Any) -> np.ndarray:
    """Converts a numpy, JAX, or Warp array to numpy without importing them.

    Args:
        array: An array-like object.

    Returns:
        A numpy array (a view where possible).
    """
    if isinstance(array, np.ndarray):
        return array
    to_numpy = getattr(array, "numpy", None)
    if callable(to_numpy):
        return np.asarray(to_numpy())
    return np.asarray(array)


def _warn_skipped(model: mujoco.MjModel, skipped: np.ndarray) -> None:
    """Logs one warning for everything the adapter cannot represent.

    Args:
        model: The compiled model.
        skipped: The ``geom_type`` of each skipped geom.
    """
    counts: collections.Counter[str] = collections.Counter()
    for geom_type in skipped.tolist():
        try:
            counts[_GEOM(geom_type).name.removeprefix("mjGEOM_")] += 1
        except ValueError:
            counts[f"type{geom_type}"] += 1
    if model.nflex:
        counts["flex"] = int(model.nflex)
    if counts:
        summary = ", ".join(f"{n} {name}" for name, n in sorted(counts.items()))
        _LOG.warning(
            "simscope.mujoco skipped unsupported geometry: %s", summary
        )


class _SceneBuilder:
    """Accumulates deduplicated materials, textures, and meshes for a scene."""

    def __init__(
        self, model: mujoco.MjModel, rgba: npt.NDArray[np.float32]
    ) -> None:
        """Initializes empty tables.

        Args:
            model: The compiled model.
            rgba: Displayed color of every geom, ``[ngeom, 4]``.
        """
        self._model = model
        self._rgba = rgba
        self.materials: dict[core.Material, int] = {}
        self.textures: list[core.Texture] = []
        self.meshes: list[core.Mesh] = []
        self._texture_by_id: dict[int, int | None] = {}
        self._texture_by_png: dict[bytes, int] = {}
        self._mesh_by_key: dict[tuple[str, int, bool], int] = {}

    def material_and_mesh(self, gid: int) -> tuple[int, int | None]:
        """Resolves the material and mesh indices of one geom.

        Args:
            gid: Geom id, of a supported type.

        Returns:
            ``(material index, mesh index or None)``.
        """
        model = self._model
        geom_type = int(model.geom_type[gid])
        matid = int(model.geom_matid[gid])
        texid = _mjviser.texture_id(model, matid)
        has_texture = self._is_supported_texture(texid)

        mesh = None
        if geom_type == _GEOM.mjGEOM_MESH:
            mesh_id = int(model.geom_dataid[gid])
            has_texture &= int(model.mesh_texcoordnum[mesh_id]) > 0
            mesh = self._mesh(("mesh", mesh_id, has_texture))
        elif geom_type == _GEOM.mjGEOM_HFIELD:
            mesh = self._mesh(
                ("hfield", int(model.geom_dataid[gid]), has_texture)
            )
        return self._material(gid, matid, texid if has_texture else -1), mesh

    def _is_supported_texture(self, texid: int) -> bool:
        """Tells whether a texture id refers to an exportable 2D texture."""
        if texid < 0:
            return False
        model = self._model
        return bool(
            int(model.tex_type[texid]) == int(mujoco.mjtTexture.mjTEXTURE_2D)
            and int(model.tex_nchannel[texid]) in (1, 3, 4)
        )

    def _material(self, gid: int, matid: int, texid: int) -> int:
        """Returns the deduplicated material index of a geom."""
        model = self._model
        metallic, roughness = 0.0, 1.0
        repeat = (1.0, 1.0)
        texture = None
        if matid >= 0:
            metallic = _unless_negative(model.mat_metallic[matid], metallic)
            roughness = _unless_negative(model.mat_roughness[matid], roughness)
            if texid >= 0:
                texture = self._texture(texid)
                u, v = model.mat_texrepeat[matid].tolist()
                repeat = (u, v)
        r, g, b, a = self._rgba[gid].tolist()
        material = core.Material(
            rgba=(r, g, b, a),
            metallic=metallic,
            roughness=roughness,
            texture=texture,
            texrepeat=repeat,
        )
        return self.materials.setdefault(material, len(self.materials))

    def _texture(self, texid: int) -> int | None:
        """Encodes a texture once and returns its deduplicated index."""
        if texid in self._texture_by_id:
            return self._texture_by_id[texid]
        pixels = _mjviser.texture_pixels(self._model, texid)
        index = None
        if pixels is not None:
            png = _encode_png(pixels)
            if png not in self._texture_by_png:
                self._texture_by_png[png] = len(self.textures)
                self.textures.append(
                    core.Texture(
                        data=png,
                        media_type="image/png",
                        width=pixels.shape[1],
                        height=pixels.shape[0],
                    )
                )
            index = self._texture_by_png[png]
        self._texture_by_id[texid] = index
        return index

    def _mesh(self, key: tuple[str, int, bool]) -> int:
        """Builds a mesh or height field once and returns its index."""
        if key in self._mesh_by_key:
            return self._mesh_by_key[key]
        source, asset_id, with_uvs = key
        extract = (
            _mjviser.mesh_arrays if source == "mesh" else _mjviser.hfield_arrays
        )
        vertices, faces, uvs = extract(self._model, asset_id, with_uvs=with_uvs)
        self.meshes.append(core.Mesh(vertices, faces, uvs=uvs))
        self._mesh_by_key[key] = len(self.meshes) - 1
        return self._mesh_by_key[key]


def _unless_negative(value: float, default: float) -> float:
    """Returns ``value`` as a float, or ``default`` if MuJoCo left it unset."""
    return float(value) if value >= 0 else default


def _encode_png(pixels: npt.NDArray[np.uint8]) -> bytes:
    """Encodes 8-bit RGB or RGBA pixels as a PNG file.

    Args:
        pixels: A ``[H, W, 3]`` or ``[H, W, 4]`` uint8 array, top row first.

    Returns:
        The bytes of the PNG file, using filter type 0 and one IDAT chunk.
    """
    height, width, channels = pixels.shape
    raw = np.zeros((height, 1 + width * channels), dtype=np.uint8)
    raw[:, 1:] = pixels.reshape(height, width * channels)
    header = struct.pack(
        ">IIBBBBB", width, height, 8, _PNG_COLOR_TYPE[channels], 0, 0, 0
    )
    return (
        _PNG_SIGNATURE
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", zlib.compress(raw.tobytes(), 6))
        + _png_chunk(b"IEND", b"")
    )


def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    """Frames one PNG chunk with its length and CRC."""
    return (
        struct.pack(">I", len(payload))
        + tag
        + payload
        + struct.pack(">I", zlib.crc32(tag + payload))
    )
