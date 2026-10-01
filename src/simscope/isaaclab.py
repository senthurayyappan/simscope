"""Adapter for Isaac Lab 3.0+ (Isaac Sim 6.x).

``scene_from_env`` reads the static scene from the live USD stage. ``poses``
and ``PoseBuffer`` read ``asset.data.body_link_pose_w`` every step and give
the ``[E, B, 7]`` layout the recorder logs. Isaac Lab 3.0 already uses xyzw
quaternions and world-frame poses that include the env origins, so no
conversion is needed.

Nothing here imports torch, warp, isaaclab, omni, or isaacsim at import time.
Arrays are duck-typed (numpy, torch, Warp, or Isaac Lab's ``ProxyArray``) and
torch or Warp are imported lazily inside the branch that needs them.
Importing this module does import ``pxr``, which only exists after Isaac Sim
has started (for example after ``AppLauncher``); ``import simscope`` does not.

``contacts`` turns a ``ContactSensor``'s net body forces into the
``[E, B, 6]`` arrows frame of the ``contacts`` stream, and
``add_contacts_stream`` declares that stream with the ``1 / (m g)`` scale.

Example:
    >>> from simscope import isaaclab as sil
    >>> scene = sil.scene_from_env(env, ["robot", "cube"])
    >>> frame = sil.poses(env, ["robot", "cube"])  # [E, B, 7]
    >>> sil.add_contacts_stream(rec, n_bodies=len(sensor.body_names), mass=m)
    >>> rec.log(frame, contacts=sil.contacts(sensor, robot))
"""

import collections
import dataclasses
import hashlib
import importlib
import importlib.metadata
import logging
import re
from collections.abc import Sequence
from typing import Any

import numpy as np
import numpy.typing as npt

try:
    # Loaded dynamically: pxr ships no type stubs, so every pxr name is Any.
    Usd: Any = importlib.import_module("pxr.Usd")
    UsdGeom: Any = importlib.import_module("pxr.UsdGeom")
    UsdPhysics: Any = importlib.import_module("pxr.UsdPhysics")
    UsdShade: Any = importlib.import_module("pxr.UsdShade")
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "simscope.isaaclab needs pxr, which ships with Isaac Sim "
        "(import it after the app has launched), or pip install usd-core"
    ) from e

from simscope import core

_LOG = logging.getLogger(__name__)

_ENV_REGEX_MACRO = "{ENV_REGEX_NS}"
_ENV_REGEX_FALLBACKS = (r"env_\[\^/\]\+", r"env_\.\*", r"env_\[\^/\]\*")
_GLOB_CHARS = frozenset("[]*?^()|+")


def source_info() -> dict[str, str]:
    """Describes the simulator for a rollout manifest.

    Returns:
        ``{"simulator": "isaaclab", "version": <isaaclab version>}``. The
        version is ``"unknown"`` if the ``isaaclab`` package metadata cannot
        be found.
    """
    try:
        version = importlib.metadata.version("isaaclab")
    except importlib.metadata.PackageNotFoundError:
        version = "unknown"
    return {"simulator": "isaaclab", "version": version}


def poses(env: Any, assets: Sequence[str]) -> npt.NDArray[np.float32]:
    """Reads body poses for the named assets as a host array.

    Args:
        env: An Isaac Lab environment (or a gym wrapper around one).
        assets: Scene entity names, such as ``["robot", "cube"]``. Each must
            be an articulation, rigid object, or rigid object collection.

    Returns:
        A new float32 C-contiguous array ``[E, B, 7]`` of ``xyz`` followed by
        quaternion ``xyzw`` in the world frame (env origins included).
        Bodies are ordered by asset, then by each asset's ``body_names``.

    Raises:
        ValueError: If an asset's pose array has the wrong shape, or the
            assets disagree on the number of envs.
    """
    arrays = [_to_host(a) for a in _pose_sources(env, assets)]
    for array in arrays:
        _check_pose_shape(array.shape)
    n_envs = arrays[0].shape[0]
    n_bodies = sum(a.shape[1] for a in arrays)
    out = np.empty((n_envs, n_bodies, core.POSE_DIM), dtype=np.float32)
    start = 0
    for array in arrays:
        if array.shape[0] != n_envs:
            raise ValueError("assets have different numbers of envs")
        out[:, start : start + array.shape[1]] = array
        start += array.shape[1]
    return out


def env_origins(env: Any) -> npt.NDArray[np.float32]:
    """Reads the world origin of every env.

    Args:
        env: An Isaac Lab environment (or a gym wrapper around one).

    Returns:
        A float32 array ``[E, 3]``.

    Raises:
        ValueError: If ``env.scene.env_origins`` is not ``[E, 3]``.
    """
    origins = _to_host(_scene(env).env_origins)
    if origins.ndim != 2 or origins.shape[1] != 3:
        raise ValueError(f"env_origins must be [E, 3], got {origins.shape}")
    return origins


def step_dt(env: Any) -> float:
    """Returns the env step interval, which is the recorded frame ``dt``.

    Args:
        env: An Isaac Lab environment (or a gym wrapper around one).

    Returns:
        ``env.step_dt`` in seconds (physics dt times decimation).
    """
    return float(_unwrap(env).step_dt)


CONTACTS_STREAM = "contacts"
"""Name of the contacts stream (viewer contracts 7)."""

_GRAVITY = 9.81


def contacts(
    sensor: Any,
    bodies: Any,
    *,
    out: npt.NDArray[np.float32] | None = None,
) -> npt.NDArray[np.float32]:
    """Packs a ``ContactSensor``'s net body forces for the contacts stream.

    Row ``b`` of env ``e`` is ``[px, py, pz, fx, fy, fz]``: the position of
    sensor body ``b`` (where the arrow is drawn) and the net contact force
    on it, both in the world frame (``sensor.data.net_forces_w``). Bodies
    without contact give zero rows, which deflate to nothing. ``K`` is the
    number of sensor bodies.

    Args:
        sensor: An Isaac Lab ``ContactSensor`` (anything with
            ``data.net_forces_w`` of shape ``[E, B, 3]``).
        bodies: Where the sensor bodies are. Either the asset that owns
            them (an articulation: its ``body_names`` are matched against
            ``sensor.body_names`` and ``data.body_link_pose_w`` is read), or
            an array of their positions or poses in sensor-body order,
            ``[E, B, 3]`` or ``[E, B, 7]``.
        out: Optional float32 C-contiguous ``[E, B, 6]`` array to fill.

    Returns:
        A float32 array ``[E, B, 6]`` on the host (``out`` if given).

    Raises:
        ValueError: If the shapes disagree, a sensor body is not found in
            the asset, or ``out`` is unsuitable.
    """
    forces = _to_host(sensor.data.net_forces_w)
    if forces.ndim != 3 or forces.shape[-1] != 3:
        raise ValueError(f"net_forces_w must be [E, B, 3], got {forces.shape}")
    if hasattr(bodies, "body_names") and hasattr(bodies, "data"):
        names = list(bodies.body_names)
        try:
            ids = [names.index(n) for n in sensor.body_names]
        except ValueError as exc:
            raise ValueError(
                f"sensor bodies {list(sensor.body_names)} are not all in "
                f"the asset's bodies {names}"
            ) from exc
        positions = _to_host(bodies.data.body_link_pose_w)[:, ids, :3]
    else:
        positions = _to_host(bodies)[..., :3]
    if positions.shape != forces.shape:
        raise ValueError(
            f"positions {positions.shape} do not match forces {forces.shape}"
        )
    shape = (*forces.shape[:2], 6)
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
    out[..., :3] = positions
    out[..., 3:] = forces
    return out


def add_contacts_stream(
    recorder: Any,
    n_bodies: int,
    *,
    mass: float,
    name: str = CONTACTS_STREAM,
) -> None:
    """Declares the contacts stream on a recorder.

    Call it before the first ``log``, then pass ``contacts(...)`` as the
    ``contacts`` keyword of ``log``.

    Args:
        recorder: A ``simscope.recorder.Recorder``.
        n_bodies: ``K``, the number of sensor bodies.
        mass: Robot mass in kg; one body weight (``mass * 9.81`` N) is drawn
            as a 1 m arrow.
        name: Stream name.

    Raises:
        ValueError: If ``mass`` is not positive.
    """
    if mass <= 0:
        raise ValueError(f"mass must be positive, got {mass}")
    recorder.add_stream(
        name,
        "arrows",
        (n_bodies, 6),
        units="N",
        scale=1.0 / (mass * _GRAVITY),
    )


class PoseBuffer:
    """Stages poses in a device-side ring buffer, one host copy per block.

    ``push`` copies this step's poses into a preallocated buffer on the same
    device as the source arrays, so it never synchronizes with the host.
    ``drain`` then moves everything to the host in a single transfer. For
    numpy sources (CPU) it uses a preallocated numpy buffer instead.

    Attributes:
        capacity: Maximum number of frames held between drains.
    """

    def __init__(self, env: Any, assets: Sequence[str], capacity: int) -> None:
        """Binds the buffer to an env and a list of assets.

        The device buffer is allocated lazily at the first ``push``, with the
        same framework and device as the first pose array.

        Args:
            env: An Isaac Lab environment (or a gym wrapper around one).
            assets: Scene entity names, in pose order.
            capacity: Frames to hold between drains.

        Raises:
            ValueError: If ``capacity`` is not positive or ``assets`` is
                empty.
        """
        if capacity <= 0:
            raise ValueError(f"capacity must be positive, got {capacity}")
        self.capacity = capacity
        self._sources = _asset_data(env, assets)
        self._buffer: Any = None
        self._is_torch = False
        self._slices: list[tuple[int, int]] = []
        self._count = 0

    def __len__(self) -> int:
        """Returns the number of frames waiting to be drained."""
        return self._count

    @property
    def full(self) -> bool:
        """Whether the next ``push`` would overflow the buffer."""
        return self._count >= self.capacity

    def push(self) -> None:
        """Copies the current poses into the ring buffer on the device.

        Raises:
            BufferError: If the buffer is full; call ``drain`` first.
            ValueError: If an asset's pose array changed shape.
            TypeError: If the assets mix torch and numpy arrays.
        """
        if self._count >= self.capacity:
            raise BufferError("PoseBuffer is full; call drain() first")
        arrays = [_as_array(d.body_link_pose_w) for d in self._sources]
        if self._buffer is None:
            self._allocate(arrays)
        frame = self._buffer[self._count]
        for array, (lo, hi) in zip(arrays, self._slices, strict=True):
            if _is_torch(array) != self._is_torch:
                raise TypeError("assets mix torch and numpy pose arrays")
            if tuple(array.shape) != (frame.shape[0], hi - lo, core.POSE_DIM):
                raise ValueError(f"pose array changed shape: {array.shape}")
            if self._is_torch:
                frame[:, lo:hi].copy_(array)
            else:
                frame[:, lo:hi] = array
        self._count += 1

    def drain(self) -> npt.NDArray[np.float32]:
        """Moves the buffered frames to the host and empties the buffer.

        Returns:
            A new float32 array ``[n, E, B, 7]`` with ``n = len(self)``
            before the call. Uses exactly one device-to-host copy.
        """
        n, self._count = self._count, 0
        if self._buffer is None:
            return np.empty((0, 0, 0, core.POSE_DIM), dtype=np.float32)
        block = self._buffer[:n]
        if not self._is_torch:
            return block.copy()
        if block.device.type == "cpu":
            block = block.clone()
        return block.cpu().numpy()

    def _allocate(self, arrays: list[Any]) -> None:
        """Allocates the buffer to match the first pose arrays.

        Args:
            arrays: Pose arrays of every asset, each ``[E, B_i, 7]``.

        Raises:
            ValueError: If an array is not ``[E, B_i, 7]`` or the assets
                disagree on ``E``.
        """
        first = arrays[0]
        n_envs = first.shape[0]
        self._slices = []
        start = 0
        for array in arrays:
            _check_pose_shape(array.shape)
            if array.shape[0] != n_envs:
                raise ValueError("assets have different numbers of envs")
            self._slices.append((start, start + array.shape[1]))
            start += array.shape[1]
        shape = (self.capacity, n_envs, start, core.POSE_DIM)
        self._is_torch = _is_torch(first)
        if self._is_torch:
            torch = importlib.import_module("torch")  # Only inside Isaac.

            self._buffer = torch.empty(
                shape, dtype=torch.float32, device=first.device
            )
        else:
            self._buffer = np.empty(shape, dtype=np.float32)


def _unwrap(env: Any) -> Any:
    """Returns the base env behind gym wrappers."""
    return getattr(env, "unwrapped", env)


def _scene(env: Any) -> Any:
    """Returns the ``InteractiveScene`` of an env."""
    return _unwrap(env).scene


def _asset_data(env: Any, assets: Sequence[str]) -> list[Any]:
    """Looks up the ``data`` object of each named asset.

    Args:
        env: An Isaac Lab environment.
        assets: Scene entity names.

    Returns:
        The ``asset.data`` objects, in order.

    Raises:
        ValueError: If ``assets`` is empty.
    """
    if not assets:
        raise ValueError("assets must not be empty")
    scene = _scene(env)
    return [scene[name].data for name in assets]


def _pose_sources(env: Any, assets: Sequence[str]) -> list[Any]:
    """Reads ``body_link_pose_w`` of each asset.

    Isaac Lab 3.0 documents this array as ``(num_instances, num_bodies)`` of
    ``wp.transformf``, which is ``(N, B, 7)`` in torch, with the orientation
    in ``(x, y, z, w)`` order, in the simulation world frame
    (``source/isaaclab/isaaclab/assets/articulation/base_articulation_data.py``
    lines 777-785; the PhysX articulation, rigid object and collection data
    classes and the OVPhysX one follow the same contract).

    Args:
        env: An Isaac Lab environment.
        assets: Scene entity names.

    Returns:
        The raw pose arrays, one per asset.
    """
    return [d.body_link_pose_w for d in _asset_data(env, assets)]


def _check_pose_shape(shape: Sequence[int]) -> None:
    """Checks that a pose array shape is ``[E, B, 7]``.

    Args:
        shape: The array shape.

    Raises:
        ValueError: If the shape is not three-dimensional with a last axis
            of size 7.
    """
    if len(shape) != 3 or shape[-1] != core.POSE_DIM:
        raise ValueError(f"body_link_pose_w must be [E, B, 7], got {shape}")


def _is_torch(array: Any) -> bool:
    """Tells whether an object is a torch tensor without importing torch."""
    return type(array).__module__.partition(".")[0] == "torch"


def _as_array(array: Any) -> Any:
    """Turns any supported pose container into a numpy or torch array.

    Args:
        array: A numpy array, torch tensor, Warp array, Isaac Lab
            ``ProxyArray``, or anything with a ``numpy()`` method.

    Returns:
        A numpy array or torch tensor sharing memory with the input where
        possible. Nothing is copied to the host.
    """
    if isinstance(array, np.ndarray):
        return array
    cls = type(array)
    # ProxyArray forwards unknown attributes to torch (with a deprecation
    # warning), so identify it on the class and use its explicit accessor.
    if hasattr(cls, "torch") and hasattr(cls, "warp"):
        return array.torch
    root = cls.__module__.partition(".")[0]
    if root == "torch":
        return array
    if root == "warp":
        try:
            warp = importlib.import_module("warp")  # Only inside Isaac.

            return warp.to_torch(array)
        except ImportError:
            return np.asarray(array.numpy())
    to_numpy = getattr(array, "numpy", None)
    if callable(to_numpy):
        return np.asarray(to_numpy())
    return np.asarray(array)


def _to_host(array: Any) -> npt.NDArray[np.float32]:
    """Copies a pose container to a float32 numpy array on the host.

    Args:
        array: Anything ``_as_array`` accepts.

    Returns:
        A float32 numpy array (a view of the input when it is already host
        float32 numpy).
    """
    array = _as_array(array)
    if _is_torch(array):
        array = array.detach().cpu().numpy()
    return np.asarray(array, dtype=np.float32)


def scene_from_env(
    env: Any, assets: Sequence[str], *, collision: bool = True
) -> core.Scene:
    """Builds a scene from the live USD stage of an Isaac Lab env.

    For each asset, the body prims are those of env 0. An articulation's
    bodies are its links, named by ``asset.body_names``; a rigid object is its
    root prim; a rigid object collection is one prim per object. Body paths
    come from the physics view's ``link_paths`` when it offers them, and
    otherwise from a search of the asset's root prim subtree. ``poses`` and
    the returned scene use the same body order (asset by asset, then each
    asset's own ``body_names`` order), so frame ``[e, b]`` is
    ``Scene.bodies[b]`` in env ``e``. Each body is named by its prim path.

    Args:
        env: An Isaac Lab environment (or a gym wrapper around one).
        assets: Scene entity names, in pose order.
        collision: If false, keep only ``"visual"`` geoms.

    Returns:
        The scene, extracted with ``scene_from_stage``.

    Raises:
        ValueError: If an asset's body prims cannot be located, or ``assets``
            is empty.
    """
    if not assets:
        raise ValueError("assets must not be empty")
    scene = _scene(env)
    stage = _stage(env)
    body_paths: list[str] = []
    for name in assets:
        body_paths.extend(_asset_body_paths(scene, stage, scene[name]))
    return scene_from_stage(stage, body_paths, collision=collision)


def _stage(env: Any) -> Any:
    """Returns the USD stage of an env.

    Args:
        env: An Isaac Lab environment.

    Returns:
        ``scene.stage``, or ``env.sim.stage`` if the scene has none.

    Raises:
        ValueError: If no stage can be found.
    """
    unwrapped = _unwrap(env)
    for owner in (unwrapped.scene, getattr(unwrapped, "sim", None)):
        stage = getattr(owner, "stage", None)
        if stage is not None:
            return stage
    raise ValueError("cannot find the USD stage on env.scene or env.sim")


def _env0_path(scene: Any, expr: str) -> str:
    """Resolves a scene prim path expression to the path in env 0.

    Args:
        scene: The ``InteractiveScene``.
        expr: A prim path that may contain ``{ENV_REGEX_NS}`` or the
            scene's env regex (``/World/envs/env_[^/]+``).

    Returns:
        A literal prim path.

    Raises:
        ValueError: If wildcard characters remain after the substitution.
    """
    env0 = str(scene.env_prim_paths[0])
    path = expr.replace(_ENV_REGEX_MACRO, env0)
    regex_ns = getattr(scene, "env_regex_ns", None)
    if isinstance(regex_ns, str) and regex_ns in path:
        path = path.replace(regex_ns, env0)
    else:
        leaf = env0.rsplit("/", 1)[-1]
        for pattern in _ENV_REGEX_FALLBACKS:
            path = re.sub(pattern, leaf, path)
    if _GLOB_CHARS & set(path):
        raise ValueError(f"cannot resolve {expr!r} to one prim path: {path!r}")
    return path


def _asset_body_paths(scene: Any, stage: Any, asset: Any) -> list[str]:
    """Finds the env-0 prim path of every body of an asset.

    Args:
        scene: The ``InteractiveScene``.
        stage: The USD stage.
        asset: An articulation, rigid object, or rigid object collection.

    Returns:
        One prim path per entry of ``asset.body_names``, in that order.

    Raises:
        ValueError: If a body has no matching prim.
    """
    names = list(asset.body_names)
    objects = getattr(asset.cfg, "rigid_objects", None)
    if isinstance(objects, dict):  # rigid object collection
        return [_env0_path(scene, objects[n].prim_path) for n in names]
    root = _env0_path(scene, asset.cfg.prim_path)
    if len(names) == 1 and root.rsplit("/", 1)[-1] == names[0]:
        return [root]  # rigid object
    by_name = _link_paths_by_name(asset, root)
    if not by_name or any(n not in by_name for n in names):
        by_name = _prims_by_name(stage, root)
    missing = [n for n in names if n not in by_name]
    if missing:
        raise ValueError(f"no prim under {root} for bodies {missing}")
    return [by_name[n] for n in names]


def _link_paths_by_name(asset: Any, root: str) -> dict[str, str]:
    """Maps link names to env-0 prim paths using the physics view.

    Args:
        asset: An articulation.
        root: The env-0 root prim path of the asset.

    Returns:
        A dict from link name to path, empty if the view exposes no
        ``link_paths`` or they do not belong to ``root`` (which means they
        are not env 0's).
    """
    view = getattr(asset, "root_view", None)
    link_paths = getattr(view, "link_paths", None)
    if not link_paths:
        return {}
    paths = [str(p) for p in link_paths[0]]
    if not all(p == root or p.startswith(root + "/") for p in paths):
        return {}
    return {p.rsplit("/", 1)[-1]: p for p in paths}


def _prims_by_name(stage: Any, root: str) -> dict[str, str]:
    """Indexes the prims under ``root`` by name, preferring rigid bodies.

    Args:
        stage: The USD stage.
        root: Path of the subtree to search (included in the search).

    Returns:
        A dict from prim name to path. If several prims share a name, the
        first one in traversal order wins unless a later one has
        ``UsdPhysics.RigidBodyAPI`` and the earlier one does not.
    """
    prim = stage.GetPrimAtPath(root)
    if not prim.IsValid():
        return {}
    found: dict[str, tuple[str, bool]] = {}
    for child in Usd.PrimRange(prim, Usd.TraverseInstanceProxies()):
        name = child.GetName()
        rigid = child.HasAPI(UsdPhysics.RigidBodyAPI)
        if name not in found or (rigid and not found[name][1]):
            found[name] = (str(child.GetPath()), rigid)
    return {name: path for name, (path, _) in found.items()}


# --------------------------------------------------------------------------
# USD stage extraction
#
# Matrices are numpy float64 4x4 in USD's row-vector convention: a point maps
# as ``p_out = p_in @ M`` and the translation is the last row.
# --------------------------------------------------------------------------

_INFINITE_PLANE_METRES = 100.0
"""A UsdGeom.Plane at least this wide (in metres) becomes an infinite plane."""
_SHEAR_TOL = 1e-4
_UNIFORM_RTOL = 1e-4
_ARC_SEGMENTS = 32
_CAP_RINGS = 8
_AXES = {"X": 0, "Y": 1, "Z": 2}

# Rows are the images of the shape-frame axes (x, y, z) in USD-local axes.
# Cylinder, capsule and cone run along local +z in the shape frame.
# fmt: off
_AXIS_ROT = {
    0: np.array([[0.0, 0, -1], [0, 1, 0], [1, 0, 0]]),
    1: np.array([[1.0, 0, 0], [0, 0, -1], [0, 1, 0]]),
    2: np.eye(3),
}
# UsdGeom.Plane: the normal is the axis; width and length run along the next
# two axes cyclically (Z: x,y; X: y,z; Y: z,x).
_PLANE_ROT = {
    0: np.array([[0.0, 1, 0], [0, 0, 1], [1, 0, 0]]),
    1: np.array([[0.0, 0, 1], [1, 0, 0], [0, 1, 0]]),
    2: np.eye(3),
}
# fmt: on

_COLOR_INPUTS = (
    "diffuseColor",
    "diffuse_color_constant",
    "diffuse_reflection_color",
    "base_color",
    "diffuse_tint",
)
_OPACITY_INPUTS = ("opacity", "opacity_constant", "geometry_opacity")
_METALLIC_INPUTS = ("metallic", "metallic_constant", "metalness")
_ROUGHNESS_INPUTS = (
    "roughness",
    "reflection_roughness_constant",
    "specular_reflection_roughness",
    "specular_roughness",
)


def _matrix(gf_matrix: Any) -> npt.NDArray[np.float64]:
    """Converts a ``Gf.Matrix4d`` to a numpy 4x4."""
    return np.array(gf_matrix, dtype=np.float64).reshape(4, 4)


def _rigid_part(m: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
    """Removes scale and shear from a transform, keeping rotation and shift.

    Args:
        m: A 4x4 row-vector transform.

    Returns:
        The 4x4 transform with the nearest proper rotation (polar factor) in
        place of the linear part.
    """
    u, _, vt = np.linalg.svd(m[:3, :3])
    if np.linalg.det(u @ vt) < 0:
        u[:, -1] *= -1
    out = np.eye(4)
    out[:3, :3] = u @ vt
    out[3, :3] = m[3, :3]
    return out


def _rotation_to_quat(m: npt.NDArray[np.float64]) -> core.Quat:
    """Converts a row-vector rotation matrix to an xyzw quaternion.

    Args:
        m: A proper 3x3 rotation acting on row vectors (``p @ m``).

    Returns:
        A unit quaternion ``(x, y, z, w)`` with ``w >= 0``.
    """
    r = m.T  # the equivalent column-vector matrix
    trace = r[0, 0] + r[1, 1] + r[2, 2]
    if trace > 0:
        s = 2.0 * np.sqrt(trace + 1.0)
        q = [
            (r[2, 1] - r[1, 2]) / s,
            (r[0, 2] - r[2, 0]) / s,
            (r[1, 0] - r[0, 1]) / s,
            0.25 * s,
        ]
    else:
        i = int(np.argmax(np.diag(r)))
        j, k = (i + 1) % 3, (i + 2) % 3
        s = 2.0 * np.sqrt(1.0 + r[i, i] - r[j, j] - r[k, k])
        q = [0.0] * 4
        q[i] = 0.25 * s
        q[j] = (r[j, i] + r[i, j]) / s
        q[k] = (r[k, i] + r[i, k]) / s
        q[3] = (r[k, j] - r[j, k]) / s
    quat = np.array(q)
    quat /= np.linalg.norm(quat)
    if quat[3] < 0:
        quat = -quat
    x, y, z, w = quat.tolist()
    return (x, y, z, w)


def _vec3(values: Sequence[float] | npt.NDArray[np.float64]) -> core.Vec3:
    """Converts three numbers to a tuple of Python floats."""
    x, y, z = (float(v) for v in values)
    return (x, y, z)


def _is_uniform(values: npt.NDArray[np.float64]) -> bool:
    """Tells whether all entries are equal within a relative tolerance."""
    return bool(np.ptp(values) <= _UNIFORM_RTOL * np.max(np.abs(values)))


def _triangulate(
    counts: npt.NDArray[np.int64], indices: npt.NDArray[np.int64]
) -> npt.NDArray[np.int64]:
    """Fan-triangulates polygons without a Python loop.

    Args:
        counts: Vertex count of every face, ``[F]``.
        indices: Concatenated face vertex indices.

    Returns:
        Triangle indices ``[T, 3]``. Faces with fewer than 3 vertices give
        no triangles.
    """
    starts = np.cumsum(counts) - counts
    n_tri = np.maximum(counts - 2, 0)
    face = np.repeat(np.arange(len(counts)), n_tri)
    within = np.arange(int(n_tri.sum())) - np.repeat(
        np.cumsum(n_tri) - n_tri, n_tri
    )
    first = starts[face]
    return np.stack(
        (
            indices[first],
            indices[first + within + 1],
            indices[first + within + 2],
        ),
        axis=1,
    )


def _revolve(
    profile: Sequence[tuple[float, float]], segments: int = _ARC_SEGMENTS
) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.int64]]:
    """Revolves an ``(r, z)`` profile about +z into a closed mesh.

    Args:
        profile: Points from the top pole to the bottom pole. Walking the
            profile must keep the solid on its right, so triangles face
            outward.
        segments: Number of samples around the axis.

    Returns:
        ``(vertices [V, 3], faces [F, 3])`` with degenerate triangles at the
        poles removed.
    """
    rings = len(profile)
    r, z = np.array(profile, dtype=np.float64).T
    theta = np.linspace(0.0, 2.0 * np.pi, segments, endpoint=False)
    verts = np.stack(
        (
            np.outer(r, np.cos(theta)),
            np.outer(r, np.sin(theta)),
            np.repeat(z[:, None], segments, axis=1),
        ),
        axis=-1,
    ).reshape(-1, 3)
    i, j = np.meshgrid(np.arange(rings - 1), np.arange(segments), indexing="ij")
    a = (i * segments + j).ravel()
    b = (i * segments + (j + 1) % segments).ravel()
    c = ((i + 1) * segments + (j + 1) % segments).ravel()
    d = ((i + 1) * segments + j).ravel()
    faces = np.concatenate(
        (np.stack((a, d, c), axis=1), np.stack((a, c, b), axis=1))
    )
    tri = verts[faces]
    area = np.linalg.norm(
        np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1
    )
    return verts, faces[area > 1e-9 * area.max()]


def _capsule_profile(radius: float, half: float) -> list[tuple[float, float]]:
    """Returns the ``(r, z)`` outline of a capsule, top pole first."""
    phi = np.linspace(0.0, np.pi / 2, _CAP_RINGS + 1)
    top = [(radius * np.sin(p), half + radius * np.cos(p)) for p in phi]
    bottom = [(r, -z) for r, z in reversed(top)]
    return [(float(r), float(z)) for r, z in top + bottom]


@dataclasses.dataclass(frozen=True)
class _Shape:
    """A USD geometry prim reduced to what the exporter needs.

    Attributes:
        kind: ``box``, ``sphere``, ``capsule``, ``cylinder``, ``cone``,
            ``frustum``, ``plane`` or ``mesh``.
        dims: Kind-specific sizes in stage units: box half-extents; sphere
            ``(radius,)``; capsule, cylinder and cone ``(radius, height)``;
            frustum ``(radius_top, radius_bottom, height)``; plane
            ``(width, length)``.
        axis: Index of the USD axis a capsule, cylinder, cone, frustum or
            plane is aligned with.
        points: Mesh vertices in stage units, ``[V, 3]``.
        faces: Mesh triangles, ``[T, 3]``.
    """

    kind: str
    dims: tuple[float, ...] = ()
    axis: int = 2
    points: npt.NDArray[np.float64] | None = None
    faces: npt.NDArray[np.int64] | None = None


def _read_mesh(prim: Any) -> _Shape | None:
    """Reads a ``UsdGeom.Mesh`` as a triangle mesh.

    Args:
        prim: A prim of type ``UsdGeom.Mesh``.

    Returns:
        The shape, or ``None`` if the mesh is empty or malformed.
    """
    mesh = UsdGeom.Mesh(prim)
    points = mesh.GetPointsAttr().Get()
    counts = mesh.GetFaceVertexCountsAttr().Get()
    indices = mesh.GetFaceVertexIndicesAttr().Get()
    if not points or counts is None or indices is None:
        return None
    verts = np.asarray(points, dtype=np.float64).reshape(-1, 3)
    faces = _triangulate(
        np.asarray(counts, dtype=np.int64), np.asarray(indices, dtype=np.int64)
    )
    if not len(faces) or faces.min() < 0 or faces.max() >= len(verts):
        return None
    if mesh.GetOrientationAttr().Get() == UsdGeom.Tokens.leftHanded:
        faces = faces[:, ::-1]
    return _Shape("mesh", points=verts, faces=np.ascontiguousarray(faces))


def _read_shape(prim: Any) -> _Shape | None:
    """Reads the geometry of a supported ``UsdGeom`` prim.

    Args:
        prim: A prim, possibly an instance proxy.

    Returns:
        The shape, or ``None`` if the prim type is unsupported or the
        geometry is empty.
    """
    if prim.IsA(UsdGeom.Mesh):
        return _read_mesh(prim)
    if prim.IsA(UsdGeom.Cube):
        half = UsdGeom.Cube(prim).GetSizeAttr().Get() / 2.0
        return _Shape("box", (half, half, half))
    if prim.IsA(UsdGeom.Sphere):
        return _Shape("sphere", (UsdGeom.Sphere(prim).GetRadiusAttr().Get(),))
    for schema, kind in (
        (UsdGeom.Capsule, "capsule"),
        (UsdGeom.Cylinder, "cylinder"),
        (UsdGeom.Cone, "cone"),
    ):
        if prim.IsA(schema):
            api = schema(prim)
            axis = _AXES[str(api.GetAxisAttr().Get())]
            dims = (api.GetRadiusAttr().Get(), api.GetHeightAttr().Get())
            return _Shape(kind, dims, axis)
    if prim.IsA(UsdGeom.Plane):
        plane = UsdGeom.Plane(prim)
        axis = _AXES[str(plane.GetAxisAttr().Get())]
        dims = (plane.GetWidthAttr().Get(), plane.GetLengthAttr().Get())
        return _Shape("plane", dims, axis)
    return _read_tapered(prim)


def _read_tapered(prim: Any) -> _Shape | None:
    """Reads the newer ``Capsule_1`` and ``Cylinder_1`` schemas.

    Args:
        prim: A prim.

    Returns:
        A capsule or cylinder when both radii match, a frustum when a
        cylinder tapers, and ``None`` for anything else (including tapered
        capsules).
    """
    for name, kind in (("Capsule_1", "capsule"), ("Cylinder_1", "cylinder")):
        schema = getattr(UsdGeom, name, None)
        if schema is None or not prim.IsA(schema):
            continue
        api = schema(prim)
        top = api.GetRadiusTopAttr().Get()
        bottom = api.GetRadiusBottomAttr().Get()
        height = api.GetHeightAttr().Get()
        axis = _AXES[str(api.GetAxisAttr().Get())]
        if abs(top - bottom) <= 1e-9 * max(top, bottom, 1e-30):
            return _Shape(kind, (top, height), axis)
        if kind == "cylinder":
            return _Shape("frustum", (top, bottom, height), axis)
    return None


def _box_mesh(
    half: Sequence[float],
) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.int64]]:
    """Builds a box with outward-facing triangles.

    Args:
        half: Half-extents along x, y, z.

    Returns:
        ``(vertices [8, 3], faces [12, 3])``.
    """
    corners = np.array(
        [[x, y, z] for z in (-1, 1) for y in (-1, 1) for x in (-1, 1)],
        dtype=np.float64,
    )
    faces = np.array(
        [
            [0, 2, 3], [0, 3, 1],  # -z
            [4, 5, 7], [4, 7, 6],  # +z
            [0, 1, 5], [0, 5, 4],  # -y
            [2, 6, 7], [2, 7, 3],  # +y
            [0, 4, 6], [0, 6, 2],  # -x
            [1, 3, 7], [1, 7, 5],  # +x
        ]
    )  # fmt: skip
    return corners * np.asarray(half), faces


def _tessellate(
    shape: _Shape,
) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.int64]]:
    """Builds triangles for a shape in USD-local axes and stage units.

    Args:
        shape: Any shape. Meshes pass through; the rest are generated
            with outward-facing triangles.

    Returns:
        ``(vertices [V, 3], faces [T, 3])``.
    """
    kind, dims = shape.kind, shape.dims
    if kind == "mesh":
        assert shape.points is not None and shape.faces is not None
        return shape.points, shape.faces
    rotation = _AXIS_ROT[shape.axis]
    if kind == "capsule":
        radius, height = dims
        verts, faces = _revolve(_capsule_profile(radius, height / 2))
    elif kind == "sphere":
        verts, faces = _revolve(_capsule_profile(dims[0], 0.0))
    elif kind == "box":
        verts, faces = _box_mesh(dims)
    elif kind == "cylinder":
        radius, height = dims
        half = height / 2
        verts, faces = _revolve(
            [(0.0, half), (radius, half), (radius, -half), (0.0, -half)]
        )
    elif kind in ("cone", "frustum"):
        top, bottom = (0.0, dims[0]) if kind == "cone" else dims[:2]
        half = dims[-1] / 2
        verts, faces = _revolve(
            [(0.0, half), (top, half), (bottom, -half), (0.0, -half)]
        )
    elif kind == "plane":
        rotation = _PLANE_ROT[shape.axis]
        w, length = dims[0] / 2, dims[1] / 2
        verts = np.array(
            [[-w, -length, 0], [w, -length, 0], [w, length, 0], [-w, length, 0]]
        )
        faces = np.array([[0, 1, 2], [0, 2, 3]])
    else:
        raise ValueError(f"cannot tessellate a {kind}")
    return verts @ rotation, faces


def _shader_value(shader: Any, names: Sequence[str]) -> Any:
    """Returns the first authored value among the named shader inputs."""
    for name in names:
        shader_input = shader.GetInput(name)
        if shader_input:
            value = shader_input.Get()
            if value is not None:
                return value
    return None


def _surface_shader(prim: Any) -> Any:
    """Finds the surface shader of a prim's bound material.

    Args:
        prim: A geometry prim, possibly an instance proxy.

    Returns:
        A ``UsdShade.Shader``, or ``None`` if there is no bound material or
        no surface shader (all-purpose, then ``mdl`` render context).
    """
    material = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
    if not material:
        return None
    for context in ("", "mdl"):
        shader = material.ComputeSurfaceSource(context)[0]
        if shader:
            return shader
    return None


def _display_mean(values: Any, width: int) -> list[float] | None:
    """Averages a ``displayColor`` or ``displayOpacity`` primvar."""
    if values is None or len(values) == 0:
        return None
    array = np.asarray(values, dtype=np.float64).reshape(-1, width)
    return array.mean(axis=0).tolist()


def _read_material(prim: Any) -> core.Material:
    """Collapses a prim's appearance into one constant PBR material.

    Order of precedence, applied per property: the bound material's surface
    shader, then the prim's ``displayColor``/``displayOpacity`` primvars, then
    the ``core.Material`` defaults. ``UsdPreviewSurface`` inputs are read
    directly. MDL shaders (OmniPBR, OmniSurface) are read best-effort through
    their constant inputs (``diffuse_color_constant`` and the like); this is
    lossy by design. Textures and texture-driven inputs are not exported.

    Args:
        prim: A geometry prim, possibly an instance proxy.

    Returns:
        The material.
    """
    default = core.Material()
    rgb: Sequence[float] | None = None
    opacity = metallic = roughness = None
    shader = _surface_shader(prim)
    if shader is not None:
        rgb = _shader_value(shader, _COLOR_INPUTS)
        opacity = _shader_value(shader, _OPACITY_INPUTS)
        metallic = _shader_value(shader, _METALLIC_INPUTS)
        roughness = _shader_value(shader, _ROUGHNESS_INPUTS)
    gprim = UsdGeom.Gprim(prim)
    if rgb is None:
        rgb = _display_mean(gprim.GetDisplayColorAttr().Get(), 3)
    if opacity is None:
        found = _display_mean(gprim.GetDisplayOpacityAttr().Get(), 1)
        opacity = found[0] if found else None
    if (
        rgb is None
        and opacity is None
        and metallic is None
        and roughness is None
    ):
        return default
    rgb = default.rgba[:3] if rgb is None else tuple(rgb)[:3]
    values = np.clip(
        [
            *rgb,
            1.0 if opacity is None else opacity,
            default.metallic if metallic is None else metallic,
            default.roughness if roughness is None else roughness,
        ],
        0.0,
        1.0,
    )
    r, g, b, a, m, rough = (float(np.float32(v)) for v in values)
    return core.Material(rgba=(r, g, b, a), metallic=m, roughness=rough)


def scene_from_stage(
    stage: Any, body_paths: Sequence[str], *, collision: bool = True
) -> core.Scene:
    """Builds a scene from bodies and geometry on a USD stage.

    Bodies are the prims at ``body_paths``, in that order, all with parent
    ``-1``: the runtime supplies a world pose per body per frame, so the tree
    is not needed. Each body owns the geometry prims in its subtree, stopping
    at any nested prim that is itself in ``body_paths``. Instance proxies are
    traversed.

    Output is in metres: ``metersPerUnit`` is applied to sizes, vertices,
    and offsets. A geom's pose is stored relative to its body prim (the USD
    world transform with scale removed, which is what PhysX reports as the
    link pose), so the stage's up axis cancels out and needs no rotation:
    the pose stream fixes the world frame, and Isaac Lab stages are Z-up. A
    Y-up stage logs a warning, because its world poses would have to be
    rotated by the caller (+90 degrees about x) to be Z-up.

    Geometry mapping:

    * ``Cube`` gives ``box``; ``Sphere`` gives ``sphere`` (``ellipsoid``
      under non-uniform scale); ``Capsule`` gives ``capsule`` (uniform scale
      only); ``Cylinder`` gives ``cylinder`` (uniform radial scale). ``axis``
      is honoured by rotating the shape onto local +z. Anything that a
      primitive cannot express (non-uniform capsule, ``Cone``, tapered
      ``Cylinder_1``, sheared transforms) is tessellated into a ``mesh``.
    * ``Mesh`` gives ``mesh`` with polygons fan-triangulated. Non-uniform
      scale goes into ``Geom.scale``. Per-face materials (``GeomSubset``),
      normals, and UVs are not exported.
    * ``Plane`` at least 100 m wide is an infinite ``plane``; smaller ones
      become a two-triangle mesh.
    * Other types (points, curves, point instancers) are skipped with one
      warning.

    Role rule: a geom is ``"collision"`` if its computed purpose is
    ``guide`` or ``proxy``, or if it (or an ancestor up to the body) has
    ``UsdPhysics.CollisionAPI`` and its purpose is not ``render``. Everything
    else is ``"visual"``. Refinement: if that would leave a body with no
    visual geom, its default-purpose collision geoms are promoted to
    ``"visual"``, because in Isaac Lab spawned primitives are usually both
    the only shape and the collider. Invisible prims are skipped.

    Material rule: see ``_read_material``. Bound ``UsdPreviewSurface`` values
    win, then MDL constants, then ``displayColor``/``displayOpacity``. No
    textures are exported.

    Meshes and materials are deduplicated by content.

    Args:
        stage: A ``Usd.Stage``.
        body_paths: Prim paths of the bodies, in pose order.
        collision: If false, keep only ``"visual"`` geoms.

    Returns:
        The scene. Body names are the prim paths, and geom names are paths
        relative to their body.

    Raises:
        ValueError: If ``body_paths`` is empty, has duplicates, or names a
            prim that does not exist.
    """
    paths = [str(p) for p in body_paths]
    if not paths:
        raise ValueError("body_paths must not be empty")
    if len(set(paths)) != len(paths):
        raise ValueError("body_paths must not contain duplicates")
    prims = [stage.GetPrimAtPath(p) for p in paths]
    missing = [p for p, prim in zip(paths, prims, strict=True) if not prim]
    if missing:
        raise ValueError(f"no such prims on the stage: {missing}")
    builder = _SceneBuilder(stage, set(paths), collision)
    for index, prim in enumerate(prims):
        builder.add_body(index, prim)
    return builder.finish(tuple(core.Body(name=p) for p in paths))


class _SceneBuilder:
    """Walks body subtrees and accumulates geoms, meshes, and materials."""

    def __init__(self, stage: Any, body_set: set[str], collision: bool) -> None:
        """Reads the stage units and prepares the transform cache.

        Args:
            stage: A ``Usd.Stage``.
            body_set: Paths of all bodies; traversal stops at these.
            collision: Whether to keep collision geoms.
        """
        self._body_set = body_set
        self._collision = collision
        self._mpu = float(UsdGeom.GetStageMetersPerUnit(stage) or 1.0)
        self._unit = np.diag([self._mpu] * 3 + [1.0])
        self._unit_inv = np.diag([1.0 / self._mpu] * 3 + [1.0])
        if str(UsdGeom.GetStageUpAxis(stage)) == "Y":
            _LOG.warning(
                "stage is Y-up: geoms are exported relative to their bodies, "
                "so recorded world poses must already be Z-up (Isaac Lab "
                "stages always are)"
            )
        self._xforms = UsdGeom.XformCache(Usd.TimeCode.Default())
        self._geoms: list[core.Geom] = []
        self._materials: dict[core.Material, int] = {}
        self._meshes: list[core.Mesh] = []
        self._mesh_index: dict[bytes, int] = {}
        self._skipped: collections.Counter[str] = collections.Counter()

    def finish(self, bodies: tuple[core.Body, ...]) -> core.Scene:
        """Logs skipped prims and assembles the scene.

        Args:
            bodies: The scene bodies.

        Returns:
            The finished scene.
        """
        if self._skipped:
            summary = ", ".join(
                f"{n} {name}" for name, n in sorted(self._skipped.items())
            )
            _LOG.warning("simscope.isaaclab skipped geometry: %s", summary)
        return core.Scene(
            bodies=bodies,
            geoms=tuple(self._geoms),
            materials=tuple(self._materials) or (core.Material(),),
            meshes=tuple(self._meshes),
        )

    def add_body(self, index: int, body: Any) -> None:
        """Adds the geoms of one body.

        Args:
            index: Index of the body in the scene.
            body: The body prim.
        """
        body_path = str(body.GetPath())
        body_metres = self._to_metres(_rigid_part(self._world(body)))
        to_body = np.linalg.inv(body_metres)
        candidates = self._candidates(body, body_path)
        if not any(role == "visual" for _, role, _ in candidates):
            candidates = [
                (prim, "visual" if promotable else role, promotable)
                for prim, role, promotable in candidates
            ]
        for prim, role, _ in candidates:
            if role == "collision" and not self._collision:
                continue
            local = self._to_metres(self._world(prim)) @ to_body
            geom = self._make_geom(index, prim, role, body_path, local)
            if geom is not None:
                self._geoms.append(geom)

    def _world(self, prim: Any) -> npt.NDArray[np.float64]:
        """Returns the local-to-world matrix of a prim in stage units."""
        return _matrix(self._xforms.GetLocalToWorldTransform(prim))

    def _to_metres(self, m: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
        """Re-expresses a stage-unit transform for geometry measured in metres.

        Local geometry is scaled by ``mpu`` first, so the transform is
        conjugated by the unit change; only translations pick up ``mpu``.
        """
        return self._unit_inv @ m @ self._unit

    def _candidates(
        self, body: Any, body_path: str
    ) -> list[tuple[Any, core.GeomRole, bool]]:
        """Lists the visible geometry prims of a body with their roles.

        Args:
            body: The body prim.
            body_path: Its path.

        Returns:
            ``(prim, role, promotable)`` tuples, where ``promotable`` marks
            default-purpose collision geoms that may become visual.
        """
        found: list[tuple[Any, core.GeomRole, bool]] = []
        iterator = iter(Usd.PrimRange(body, Usd.TraverseInstanceProxies()))
        for prim in iterator:
            path = str(prim.GetPath())
            if path != body_path and path in self._body_set:
                iterator.PruneChildren()
                continue
            if prim.IsA(UsdShade.Material):
                iterator.PruneChildren()
                continue
            if not prim.IsA(UsdGeom.Gprim):
                continue
            imageable = UsdGeom.Imageable(prim)
            if imageable.ComputeVisibility() == UsdGeom.Tokens.invisible:
                continue
            purpose = imageable.ComputePurpose()
            has_collider = self._has_collider(prim, body_path)
            if purpose in (UsdGeom.Tokens.guide, UsdGeom.Tokens.proxy):
                found.append((prim, "collision", False))
            elif has_collider and purpose != UsdGeom.Tokens.render:
                found.append((prim, "collision", True))
            else:
                found.append((prim, "visual", False))
        return found

    @staticmethod
    def _has_collider(prim: Any, body_path: str) -> bool:
        """Tells whether a prim or an ancestor up to the body collides."""
        while prim:
            if prim.HasAPI(UsdPhysics.CollisionAPI):
                return True
            if str(prim.GetPath()) == body_path:
                break
            prim = prim.GetParent()
        return False

    def _make_geom(
        self,
        body: int,
        prim: Any,
        role: core.GeomRole,
        body_path: str,
        local: npt.NDArray[np.float64],
    ) -> core.Geom | None:
        """Converts one geometry prim into a geom.

        Args:
            body: Index of the owning body.
            prim: The geometry prim.
            role: The geom role.
            body_path: Path of the owning body prim.
            local: Geom-to-body transform in metres, row-vector convention.

        Returns:
            The geom, or ``None`` if it was skipped.
        """
        shape = _read_shape(prim)
        linear, pos = local[:3, :3], local[3, :3]
        scale = np.linalg.norm(linear, axis=1)
        if shape is None or scale.min() <= 1e-12 * scale.max():
            self._skipped[str(prim.GetTypeName())] += 1
            return None
        rotation = linear / scale[:, None]
        sheared = bool(
            np.abs(rotation @ rotation.T - np.eye(3)).max() > _SHEAR_TOL
        )
        if not sheared and np.linalg.det(rotation) < 0:
            rotation[0] *= -1  # a mirror: keep it as a negative scale
            scale[0] *= -1
        path = str(prim.GetPath())
        name = path[len(body_path) + 1 :] or str(prim.GetName())
        material = self._material(_read_material(prim))
        spec = None if sheared else self._primitive(shape, np.abs(scale))
        if spec is not None:
            kind, size, axis_rot = spec
            return core.Geom(
                body=body,
                kind=kind,
                size=size,
                pos=_vec3(pos),
                quat=_rotation_to_quat(axis_rot @ rotation),
                material=material,
                role=role,
                name=name,
            )
        points, faces = _tessellate(shape)
        points = points * self._mpu
        if sheared:
            points = points @ linear
            rotation, scale = np.eye(3), np.ones(3)
        mesh = self._mesh(points, faces)
        return core.Geom(
            body=body,
            kind="mesh",
            pos=_vec3(pos),
            quat=_rotation_to_quat(rotation),
            scale=_vec3(scale),
            material=material,
            mesh=mesh,
            role=role,
            name=name,
        )

    def _primitive(
        self, shape: _Shape, scale: npt.NDArray[np.float64]
    ) -> tuple[core.GeomKind, core.Vec3, npt.NDArray[np.float64]] | None:
        """Maps a shape to a simscope primitive under a local scale.

        Args:
            shape: The USD shape.
            scale: Absolute per-axis scale in the prim's local axes.

        Returns:
            ``(kind, size, axis_rotation)`` where ``axis_rotation`` takes the
            shape frame (extruded along +z) to the prim's local axes, or
            ``None`` if the shape needs a mesh under this scale.
        """
        m = self._mpu
        kind, dims, axis = shape.kind, shape.dims, shape.axis
        if kind == "box":
            half = m * scale * np.asarray(dims)
            return "box", _vec3(half), np.eye(3)
        if kind == "sphere":
            if _is_uniform(scale):
                radius = m * dims[0] * scale[0]
                return "sphere", _vec3((radius, 0.0, 0.0)), np.eye(3)
            return "ellipsoid", _vec3(m * dims[0] * scale), np.eye(3)
        if kind == "plane":
            extent = m * max(dims) * scale[[i for i in range(3) if i != axis]]
            if extent.max() >= _INFINITE_PLANE_METRES:
                return "plane", (0.0, 0.0, 0.0), _PLANE_ROT[axis]
            return None
        radial = scale[[i for i in range(3) if i != axis]]
        if kind == "capsule" and _is_uniform(scale):
            size = (m * dims[0] * scale[0], m * dims[1] / 2 * scale[0], 0.0)
            return "capsule", _vec3(size), _AXIS_ROT[axis]
        if kind == "cylinder" and _is_uniform(radial):
            size = (m * dims[0] * radial[0], m * dims[1] / 2 * scale[axis], 0.0)
            return "cylinder", _vec3(size), _AXIS_ROT[axis]
        return None

    def _material(self, material: core.Material) -> int:
        """Returns the deduplicated index of a material."""
        return self._materials.setdefault(material, len(self._materials))

    def _mesh(
        self, points: npt.NDArray[np.float64], faces: npt.NDArray[np.int64]
    ) -> int:
        """Adds a mesh once and returns its deduplicated index.

        Args:
            points: Vertices in metres, ``[V, 3]``.
            faces: Triangles, ``[T, 3]``.

        Returns:
            The index into ``Scene.meshes``.
        """
        vertices = np.ascontiguousarray(points, dtype=np.float32)
        triangles = np.ascontiguousarray(faces, dtype=np.uint32)
        digest = hashlib.blake2b(vertices.tobytes(), digest_size=16)
        digest.update(triangles.tobytes())
        key = digest.digest()
        if key not in self._mesh_index:
            self._mesh_index[key] = len(self._meshes)
            self._meshes.append(core.Mesh(vertices, triangles))
        return self._mesh_index[key]
