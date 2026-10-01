"""Simulator-neutral data model for scenes and rollouts.

These types are the in-memory contract shared by the adapters, the storage
layer, the viewer, and the exporter. The on-disk encoding is defined in
``docs/specs/2026-09-30-simscope-format-v1.md``.

Conventions (format spec §1): Z-up, right-handed, metres, seconds. A pose is
``[px, py, pz, qx, qy, qz, qw]`` with the quaternion in xyzw order.
"""

import dataclasses
import math
from typing import Literal

import numpy as np
import numpy.typing as npt

POSE_DIM = 7
"""Floats per pose: position xyz, then quaternion xyzw."""

GeomKind = Literal[
    "box", "sphere", "capsule", "cylinder", "ellipsoid", "plane", "mesh"
]
GEOM_KINDS: tuple[GeomKind, ...] = (
    "box",
    "sphere",
    "capsule",
    "cylinder",
    "ellipsoid",
    "plane",
    "mesh",
)

GeomRole = Literal["visual", "collision"]

StreamKind = Literal["pose", "scalar", "vector", "arrows", "points", "polyline"]
STREAM_KINDS: tuple[StreamKind, ...] = (
    "pose",
    "scalar",
    "vector",
    "arrows",
    "points",
    "polyline",
)

Vec3 = tuple[float, float, float]
Quat = tuple[float, float, float, float]
Rgba = tuple[float, float, float, float]

IDENTITY_QUAT: Quat = (0.0, 0.0, 0.0, 1.0)
UNIT_SCALE: Vec3 = (1.0, 1.0, 1.0)


@dataclasses.dataclass(frozen=True, eq=False)
class Mesh:
    """A triangle mesh in its geom's local frame.

    Attributes:
        vertices: Vertex positions, shape ``[V, 3]``, dtype float32.
        faces: Triangle vertex indices, shape ``[F, 3]``, dtype uint32.
        normals: Optional per-vertex normals, shape ``[V, 3]``, float32.
        uvs: Optional per-vertex texture coordinates, shape ``[V, 2]``,
            float32.
    """

    vertices: npt.NDArray[np.float32]
    faces: npt.NDArray[np.uint32]
    normals: npt.NDArray[np.float32] | None = None
    uvs: npt.NDArray[np.float32] | None = None

    def __post_init__(self) -> None:
        """Validates array shapes and dtypes.

        Raises:
            ValueError: If an array has the wrong shape or dtype.
        """
        n_verts = _check_array("vertices", self.vertices, np.float32, 3)
        _check_array("faces", self.faces, np.uint32, 3)
        normals, uvs = self.normals, self.uvs
        if (
            normals is not None
            and _check_array("normals", normals, np.float32, 3) != n_verts
        ):
            raise ValueError("normals must have one row per vertex")
        if (
            uvs is not None
            and _check_array("uvs", uvs, np.float32, 2) != n_verts
        ):
            raise ValueError("uvs must have one row per vertex")


@dataclasses.dataclass(frozen=True)
class Texture:
    """An encoded 2D image.

    Attributes:
        data: The encoded file bytes.
        media_type: ``"image/png"`` or ``"image/jpeg"``.
        width: Width in pixels.
        height: Height in pixels.
    """

    data: bytes
    media_type: Literal["image/png", "image/jpeg"]
    width: int
    height: int


@dataclasses.dataclass(frozen=True)
class Material:
    """Surface appearance of a geom.

    Attributes:
        rgba: Base color and opacity, each in ``[0, 1]``.
        metallic: PBR metalness in ``[0, 1]``.
        roughness: PBR roughness in ``[0, 1]``.
        texture: Index into ``Scene.textures``, or ``None``.
        texrepeat: Texture repeats along u and v.
    """

    rgba: Rgba = (0.8, 0.8, 0.8, 1.0)
    metallic: float = 0.0
    roughness: float = 1.0
    texture: int | None = None
    texrepeat: tuple[float, float] = (1.0, 1.0)


@dataclasses.dataclass(frozen=True)
class Body:
    """A rigid body that owns geoms and has one pose per frame.

    Attributes:
        name: Body name or USD path. Not required to be unique.
        parent: Index of the parent body, or ``-1`` for a root.
        mass: Mass in kilograms, or ``0.0`` if unknown (the world body, or
            a simulator that does not say). Highlights weight the centre of
            mass by it.

    Raises:
        ValueError: If ``mass`` is negative or not finite.
    """

    name: str
    parent: int = -1
    mass: float = 0.0

    def __post_init__(self) -> None:
        """Checks the mass."""
        if not (math.isfinite(self.mass) and self.mass >= 0):
            raise ValueError(f"body mass must be finite and >= 0: {self.mass}")


@dataclasses.dataclass(frozen=True)
class Geom:
    """A visual or collision shape attached to a body.

    ``kind`` and ``size`` follow format spec §4 (MuJoCo conventions).

    Attributes:
        body: Index into ``Scene.bodies``.
        kind: Shape kind.
        size: Kind-specific size parameters in metres.
        pos: Position in the body frame.
        quat: Orientation in the body frame, xyzw.
        scale: Component-wise scale applied to local vertices.
        material: Index into ``Scene.materials``.
        mesh: Index into ``Scene.meshes`` when ``kind == "mesh"``.
        role: Whether viewers show the geom by default.
        name: Optional geom name.
    """

    body: int
    kind: GeomKind
    size: Vec3 = (0.0, 0.0, 0.0)
    pos: Vec3 = (0.0, 0.0, 0.0)
    quat: Quat = IDENTITY_QUAT
    scale: Vec3 = UNIT_SCALE
    material: int = 0
    mesh: int | None = None
    role: GeomRole = "visual"
    name: str = ""


@dataclasses.dataclass(frozen=True, eq=False)
class Scene:
    """The static part of a rollout, shared by every frame and env.

    Attributes:
        bodies: Bodies, in the order of the pose stream.
        geoms: Geoms attached to bodies.
        materials: Materials referenced by geoms. Must not be empty when
            there are geoms.
        meshes: Meshes referenced by mesh geoms.
        textures: Textures referenced by materials.
    """

    bodies: tuple[Body, ...]
    geoms: tuple[Geom, ...] = ()
    materials: tuple[Material, ...] = (Material(),)
    meshes: tuple[Mesh, ...] = ()
    textures: tuple[Texture, ...] = ()

    def __post_init__(self) -> None:
        """Validates cross-references between scene elements.

        Raises:
            ValueError: If an index points outside its table, or a mesh geom
                has no mesh.
        """
        n_bodies = len(self.bodies)
        for i, body in enumerate(self.bodies):
            if not -1 <= body.parent < n_bodies or body.parent == i:
                raise ValueError(f"body {i} has invalid parent {body.parent}")
        for j, geom in enumerate(self.geoms):
            if not 0 <= geom.body < n_bodies:
                raise ValueError(f"geom {j} has invalid body {geom.body}")
            if not 0 <= geom.material < len(self.materials):
                raise ValueError(
                    f"geom {j} has invalid material {geom.material}"
                )
            if geom.kind == "mesh":
                if geom.mesh is None or not 0 <= geom.mesh < len(self.meshes):
                    raise ValueError(f"mesh geom {j} has invalid mesh")
            elif geom.mesh is not None:
                raise ValueError(f"geom {j} of kind {geom.kind} has a mesh")
        for k, material in enumerate(self.materials):
            texture = material.texture
            if texture is not None and not 0 <= texture < len(self.textures):
                raise ValueError(f"material {k} has invalid texture {texture}")

    @property
    def n_bodies(self) -> int:
        """Number of bodies, which is the pose count per frame."""
        return len(self.bodies)


def _check_array(
    name: str, array: npt.NDArray, dtype: type[np.generic], width: int
) -> int:
    """Checks that an array is 2D with a given width and dtype.

    Args:
        name: Field name for error messages.
        array: Array to check.
        dtype: Required dtype.
        width: Required size of the second axis.

    Returns:
        The size of the first axis.

    Raises:
        ValueError: If the shape or dtype does not match.
    """
    if array.dtype != dtype:
        raise ValueError(f"{name} must have dtype {np.dtype(dtype)}")
    if array.ndim != 2 or array.shape[1] != width:
        raise ValueError(f"{name} must have shape [N, {width}]")
    return array.shape[0]
