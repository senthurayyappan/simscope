"""Exports a run as a USD stage that Blender opens.

``export_usd`` writes one ``.usdz`` file: a zip, stored uncompressed, that
holds a text stage (``scene.usda``) and the scene's textures. Blender imports
it with File > Import > Universal Scene Description, and so does any other
USD tool. Nothing beyond numpy is needed: the stage is written as text.

The stage is Z-up, in metres, with one time code per recorded frame and
``timeCodesPerSecond`` set to the run's frame rate::

    /World                      Xform, the default prim
      /Looks/M<k>               one UsdPreviewSurface material per material
      /Prototypes               class: one mesh per shape, never drawn
      /<body>                   Xform, animated world pose of the body
        /<geom>                 Mesh that references its prototype

A run with several envs gets one ``/World/env_<i>`` Xform per exported env,
each holding that env's bodies. Body poses are world poses, so bodies are
siblings rather than nested, and an env's origin is added to its positions.

Visual geoms are written as they are. Collision geoms get ``purpose =
"guide"``: Blender leaves them out unless "Guide" is ticked on import.
Primitive shapes are tessellated the way the viewer draws them; a plane
becomes a quad, as wide as the plane, or (for an infinite plane) wide enough
to cover everything the run's bodies reach.

Given the same inputs, the output is byte-identical.
"""

import io
import math
import os
import pathlib
import re
import struct
import zipfile
from collections.abc import Iterable, Sequence
from typing import Any

import numpy as np
import numpy.typing as npt

from simscope import core, discover, library, transforms
from simscope.io import cas, pack

STAGE_NAME = "scene.usda"
"""The root layer inside the ``.usdz``; a package's first file."""
ALIGN = 64
"""USDZ needs every file's data to start at a multiple of 64 bytes."""
MAX_ENVS = 64
"""Exporting more envs than this needs an explicit ``envs`` list."""
GROUND_MARGIN = 2.0
"""Metres an infinite plane reaches past the run's bodies."""
_PAD_ID = 0x1986  # zip extra-field id of the alignment padding
_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
_RESERVED = frozenset({"Looks", "Prototypes"})
_BINDING = 'prepend apiSchemas = ["MaterialBindingAPI"]'

FloatArray = npt.NDArray[np.float32]


# -- shapes --
#
# Each shape is (points, faces, normals, uvs) in its own frame. The sizes and
# segment counts match web/src/core/scene.js, so Blender shows what the
# viewer shows.


class _Shape:
    """A triangle mesh ready to write."""

    def __init__(
        self,
        points: npt.ArrayLike,
        faces: npt.ArrayLike,
        normals: npt.ArrayLike | None = None,
        uvs: npt.ArrayLike | None = None,
    ) -> None:
        self.points = np.asarray(points, dtype=np.float32).reshape(-1, 3)
        self.faces = np.asarray(faces, dtype=np.int64).reshape(-1, 3)
        self.normals = (
            vertex_normals(self.points, self.faces)
            if normals is None
            else np.asarray(normals, dtype=np.float32).reshape(-1, 3)
        )
        self.uvs = (
            None if uvs is None else np.asarray(uvs, np.float32).reshape(-1, 2)
        )


def vertex_normals(points: FloatArray, faces: npt.NDArray) -> FloatArray:
    """Area-weighted vertex normals, as the viewer computes them.

    Args:
        points: Vertex positions, ``[V, 3]``.
        faces: Triangle vertex indices, ``[F, 3]``.

    Returns:
        Unit normals, ``[V, 3]``; ``+z`` for a vertex no face touches.
    """
    p = points.astype(np.float64)
    a, b, c = p[faces[:, 0]], p[faces[:, 1]], p[faces[:, 2]]
    face_n = np.cross(b - a, c - a)
    n = np.zeros_like(p)
    for k in range(3):
        np.add.at(n, faces[:, k], face_n)
    length = np.linalg.norm(n, axis=1)
    n[length == 0] = (0.0, 0.0, 1.0)
    length[length == 0] = 1.0
    return (n / length[:, None]).astype(np.float32)


def _rings(
    lats: Sequence[tuple[float, float]], radius: float, segments: int
) -> _Shape:
    """A surface of revolution about ``z`` from rings of latitude.

    Args:
        lats: ``(latitude, z offset)`` of each ring, bottom to top.
        radius: Sphere radius.
        segments: Segments around ``z``.
    """
    phi = np.linspace(0.0, 2.0 * math.pi, segments + 1)
    points, normals = [], []
    for lat, dz in lats:
        n = np.stack(
            [
                math.cos(lat) * np.cos(phi),
                math.cos(lat) * np.sin(phi),
                np.full_like(phi, math.sin(lat)),
            ],
            axis=1,
        )
        normals.append(n)
        points.append(n * radius + (0.0, 0.0, dz))
    faces = []
    width = segments + 1
    for i in range(len(lats) - 1):
        bottom_pole = math.isclose(abs(lats[i][0]), math.pi / 2)
        top_pole = math.isclose(abs(lats[i + 1][0]), math.pi / 2)
        for j in range(segments):
            a, b = i * width + j, i * width + j + 1
            c, d = b + width, a + width
            if not top_pole:
                faces.append((a, b, c))
            if not bottom_pole:
                faces.append((a, c, d))
    return _Shape(np.concatenate(points), faces, np.concatenate(normals))


def unit_sphere() -> _Shape:
    """A sphere of radius 1: 24 segments around, 16 from pole to pole."""
    lats = np.linspace(-math.pi / 2, math.pi / 2, 17)
    return _rings([(float(lat), 0.0) for lat in lats], 1.0, 24)


def capsule(radius: float, half_length: float) -> _Shape:
    """A capsule along ``z``: 16 segments around, 8 per cap."""
    cap = np.linspace(0.0, math.pi / 2, 9)
    lats = [(float(lat) - math.pi / 2, -half_length) for lat in cap]
    lats += [(float(lat), half_length) for lat in cap]
    return _rings(lats, radius, 16)


def unit_cylinder() -> _Shape:
    """A cylinder of radius 1 from ``z = -1`` to ``z = 1``, 24 segments."""
    seg = 24
    phi = np.linspace(0.0, 2.0 * math.pi, seg + 1)
    ring = np.stack([np.cos(phi), np.sin(phi), np.zeros_like(phi)], axis=1)
    up = np.array([0.0, 0.0, 1.0])
    side = np.concatenate([ring - up, ring + up])
    w = seg + 1
    faces = [(j, j + 1, j + 1 + w) for j in range(seg)]
    faces += [(j, j + 1 + w, j + w) for j in range(seg)]
    points, normals = [side], [np.concatenate([ring, ring])]
    for z in (-1.0, 1.0):
        base = sum(len(p) for p in points)
        points.append(np.vstack([up * z, ring + up * z]))
        normals.append(np.tile((0.0, 0.0, z), (w + 1, 1)))
        for j in range(seg):
            a, b = base + 1 + j, base + 2 + j
            faces.append((base, a, b) if z > 0 else (base, b, a))
    return _Shape(np.concatenate(points), faces, np.concatenate(normals))


# (normal, u, v) with u x v = normal, for the six faces of a box.
_BOX_FACES = (
    ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
    ((-1, 0, 0), (0, 0, 1), (0, 1, 0)),
    ((0, 1, 0), (0, 0, 1), (1, 0, 0)),
    ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
    ((0, 0, -1), (0, 1, 0), (1, 0, 0)),
)


def unit_box() -> _Shape:
    """A cube with edges of 1, centred on the origin."""
    points, normals, faces = [], [], []
    for n, u, v in _BOX_FACES:
        nn, uu, vv = (np.array(x, dtype=np.float64) for x in (n, u, v))
        base = len(points)
        for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            points.append(0.5 * (nn + su * uu + sv * vv))
            normals.append(nn)
        faces += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    return _Shape(points, faces, normals)


def plane(half_x: float, half_y: float) -> _Shape:
    """A quad facing ``+z``; its texture coordinates are in metres."""
    corners = [(-half_x, -half_y), (half_x, -half_y), (half_x, half_y)]
    corners.append((-half_x, half_y))
    points = [(x, y, 0.0) for x, y in corners]
    return _Shape(points, [(0, 1, 2), (0, 2, 3)], [(0, 0, 1)] * 4, corners)


# -- text --


def _f(x: float) -> str:
    """A float as USD text."""
    return f"{x:.9g}"


def _tuple(values: Iterable[float]) -> str:
    return "(" + ", ".join(_f(float(v)) for v in values) + ")"


def _rows(array: npt.NDArray, digits: int) -> str:
    """A ``[N, k]`` array as a USD list of tuples."""
    k = array.shape[1]
    fmt = "(" + ", ".join([f"%.{digits}g"] * k) + ")"
    return "[" + ", ".join(fmt % tuple(r) for r in array.tolist()) + "]"


def _ints(array: npt.NDArray) -> str:
    return "[" + ", ".join(map(str, array.ravel().tolist())) + "]"


def _string(text: str) -> str:
    """A USD string literal."""
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    return '"' + escaped.replace("\n", "\\n") + '"'


def prim_name(name: str, used: set[str], fallback: str) -> str:
    """A valid, unused USD prim name for ``name``, and marks it used.

    Args:
        name: The wanted name. A USD path (``/World/robot/base``) keeps only
            its last element.
        used: Names already taken among the siblings; updated.
        fallback: The name to use when ``name`` has no usable characters.

    Returns:
        ``[A-Za-z_][A-Za-z0-9_]*``, unique within ``used``.
    """
    base = name.rstrip("/").rsplit("/", 1)[-1]
    base = "".join(c if c.isascii() and c.isalnum() else "_" for c in base)
    base = re.sub("_+", "_", base).strip("_") or fallback
    if base[0].isdigit():
        base = "_" + base
    out, k = base, 1
    while out in used:
        out = f"{base}_{k}"
        k += 1
    used.add(out)
    return out


class _Writer:
    """Accumulates the lines of a ``.usda`` layer."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.depth = 0

    def line(self, text: str = "") -> None:
        self.parts.append("    " * self.depth + text + "\n" if text else "\n")

    def open(self, head: str, *meta: str) -> None:
        """Starts a prim, with optional metadata lines."""
        if meta:
            self.line(head + " (")
            for m in meta:
                self.line("    " + m)
            self.line(")")
        else:
            self.line(head)
        self.line("{")
        self.depth += 1

    def close(self) -> None:
        self.depth -= 1
        self.line("}")

    def text(self) -> str:
        return "".join(self.parts)


def _write_mesh_body(w: _Writer, shape: _Shape) -> None:
    """Writes the attributes of a ``Mesh`` prim."""
    n_faces = len(shape.faces)
    lo = shape.points.min(axis=0) if len(shape.points) else np.zeros(3)
    hi = shape.points.max(axis=0) if len(shape.points) else np.zeros(3)
    w.line(f"float3[] extent = [{_tuple(lo)}, {_tuple(hi)}]")
    w.line("int[] faceVertexCounts = [" + ", ".join(["3"] * n_faces) + "]")
    w.line(f"int[] faceVertexIndices = {_ints(shape.faces)}")
    w.line(f"normal3f[] normals = {_rows(shape.normals, 5)} (")
    w.line('    interpolation = "vertex"')
    w.line(")")
    w.line(f"point3f[] points = {_rows(shape.points, 7)}")
    if shape.uvs is not None:
        w.line(f"texCoord2f[] primvars:st = {_rows(shape.uvs, 7)} (")
        w.line('    interpolation = "vertex"')
        w.line(")")
    w.line('uniform token subdivisionScheme = "none"')


# -- materials --


_TEXTURE_EXT = {"image/png": "png", "image/jpeg": "jpg"}


def _texture_path(scene: core.Scene, index: int) -> str:
    ext = _TEXTURE_EXT[scene.textures[index].media_type]
    return f"textures/t{index}.{ext}"


def _write_material(
    w: _Writer, scene: core.Scene, index: int, path: str
) -> None:
    """Writes ``Material`` number ``index`` at ``path``."""
    m = scene.materials[index]
    r, g, b, a = m.rgba
    w.open(f'def Material "M{index}"')
    w.line(f"token outputs:surface.connect = <{path}/Surface.outputs:surface>")
    w.open('def Shader "Surface"')
    w.line('uniform token info:id = "UsdPreviewSurface"')
    if m.texture is None:
        w.line(f"color3f inputs:diffuseColor = {_tuple((r, g, b))}")
    else:
        w.line(
            "color3f inputs:diffuseColor.connect = "
            f"<{path}/Texture.outputs:rgb>"
        )
    w.line(f"float inputs:metallic = {_f(m.metallic)}")
    w.line(f"float inputs:opacity = {_f(a)}")
    w.line(f"float inputs:roughness = {_f(m.roughness)}")
    w.line("token outputs:surface")
    w.close()
    if m.texture is not None:
        # MuJoCo tints a texture by the material's colour, as `scale` does.
        w.open('def Shader "Texture"')
        w.line('uniform token info:id = "UsdUVTexture"')
        w.line(f"asset inputs:file = @{_texture_path(scene, m.texture)}@")
        w.line(f"float4 inputs:scale = {_tuple((r, g, b, 1.0))}")
        w.line(f"float2 inputs:st.connect = <{path}/Repeat.outputs:result>")
        w.line('token inputs:wrapS = "repeat"')
        w.line('token inputs:wrapT = "repeat"')
        w.line("float3 outputs:rgb")
        w.close()
        w.open('def Shader "Repeat"')
        w.line('uniform token info:id = "UsdTransform2d"')
        w.line(f"float2 inputs:in.connect = <{path}/St.outputs:result>")
        w.line(f"float2 inputs:scale = {_tuple(m.texrepeat)}")
        w.line("float2 outputs:result")
        w.close()
        w.open('def Shader "St"')
        w.line('uniform token info:id = "UsdPrimvarReader_float2"')
        w.line('string inputs:varname = "st"')
        w.line("float2 outputs:result")
        w.close()
    w.close()


# -- the stage --


def _shape_key(geom: core.Geom) -> tuple[Any, ...] | None:
    """The prototype a geom draws, and the scale that sizes it.

    Returns:
        ``(key, scale)``, or ``None`` for a plane or an unknown kind.
    """
    s, gs = geom.size, geom.scale

    def scaled(x: float, y: float, z: float) -> tuple[float, float, float]:
        return (x * gs[0], y * gs[1], z * gs[2])

    match geom.kind:
        case "box":
            return ("box",), scaled(2 * s[0], 2 * s[1], 2 * s[2])
        case "sphere":
            return ("sphere",), scaled(s[0], s[0], s[0])
        case "ellipsoid":
            return ("sphere",), scaled(s[0], s[1], s[2])
        case "cylinder":
            return ("cylinder",), scaled(s[0], s[0], s[1])
        case "capsule":
            return ("capsule", float(s[0]), float(s[1])), tuple(gs)
        case "mesh":
            return ("mesh", geom.mesh), tuple(gs)
    return None


def _prototype(key: tuple[Any, ...], scene: core.Scene) -> _Shape:
    match key:
        case ("box",):
            return unit_box()
        case ("sphere",):
            return unit_sphere()
        case ("cylinder",):
            return unit_cylinder()
        case ("capsule", radius, half):
            return capsule(radius, half)
        case ("mesh", index):
            m = scene.meshes[index]
            return _Shape(m.vertices, m.faces, m.normals, m.uvs)
    raise AssertionError(key)


def _xform_ops(
    w: _Writer,
    pos: Sequence[float],
    quat: Sequence[float],
    scale: Sequence[float] | None,
) -> None:
    """Writes a static translate, orient (xyzw in, wxyz out) and scale."""
    order = []
    if any(pos):
        w.line(f"float3 xformOp:translate = {_tuple(pos)}")
        order.append('"xformOp:translate"')
    x, y, z, qw = quat
    if (x, y, z) != (0.0, 0.0, 0.0):
        w.line(f"quatf xformOp:orient = {_tuple((qw, x, y, z))}")
        order.append('"xformOp:orient"')
    if scale is not None and tuple(scale) != (1.0, 1.0, 1.0):
        w.line(f"float3 xformOp:scale = {_tuple(scale)}")
        order.append('"xformOp:scale"')
    if order:
        w.line(f"uniform token[] xformOpOrder = [{', '.join(order)}]")


def _samples(values: npt.NDArray, digits: int) -> str:
    """``{0: (...), 1: (...)}`` for one row of values per frame."""
    k = values.shape[1]
    fmt = "%d: (" + ", ".join([f"%.{digits}g"] * k) + ")"
    rows = [fmt % (t, *row) for t, row in enumerate(values.tolist())]
    return "{" + ", ".join(rows) + "}"


def _write_body_pose(w: _Writer, poses: FloatArray) -> None:
    """Writes the animated pose of one body, ``[T, 7]`` xyzw."""
    pos, quat = poses[:, :3], poses[:, 3:]
    wxyz = quat[:, [3, 0, 1, 2]]
    if np.all(poses == poses[0]):
        _xform_ops(w, pos[0].tolist(), quat[0].tolist(), None)
        return
    w.line(f"float3 xformOp:translate.timeSamples = {_samples(pos, 7)}")
    w.line(f"quatf xformOp:orient.timeSamples = {_samples(wxyz, 7)}")
    w.line(
        'uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:orient"]'
    )


def _ground_half(geom: core.Geom, poses: FloatArray) -> tuple[float, float]:
    """Half extents of a plane's quad.

    A plane with a size keeps it. An infinite plane (size 0, MuJoCo's
    convention) covers every body position of the run, plus a margin.
    """
    if geom.size[0] > 0 and geom.size[1] > 0:
        return float(geom.size[0]), float(geom.size[1])
    xy = poses[..., :2].reshape(-1, 2) - np.asarray(geom.pos[:2])
    reach = float(np.abs(xy).max()) if xy.size else 0.0
    half = math.ceil(reach + GROUND_MARGIN)
    return half, half


def stage_text(
    scene: core.Scene,
    poses: FloatArray,
    *,
    fps: float,
    env_ids: Sequence[int] | None = None,
    title: str = "",
) -> str:
    """Returns the ``.usda`` text of a run.

    Args:
        scene: The run's scene.
        poses: World poses, ``[T, E, B, 7]`` with xyzw quaternions and the
            env origins already added.
        fps: Frames per second; one time code per frame.
        env_ids: The run's index of each env in ``poses``, used to name the
            env prims; ``None`` puts the bodies straight under ``/World``,
            which needs ``E == 1``.
        title: The stage's ``doc`` string.

    Returns:
        The layer, as text.
    """
    n_frames, n_envs, n_bodies, _ = poses.shape
    if n_bodies != scene.n_bodies:
        raise ValueError(
            f"poses have {n_bodies} bodies, the scene has {scene.n_bodies}"
        )
    if env_ids is None and n_envs != 1:
        raise ValueError("env_ids is needed for more than one env")
    by_body: dict[int, list[int]] = {}
    for j, g in enumerate(scene.geoms):
        if g.kind == "plane" or _shape_key(g) is not None:
            by_body.setdefault(g.body, []).append(j)
    protos: dict[tuple[Any, ...], str] = {}
    for g in scene.geoms:
        hit = _shape_key(g)
        if hit is None or hit[0] in protos:
            continue
        key = hit[0]
        if key[0] == "mesh":
            protos[key] = f"mesh_{key[1]}"
        elif key[0] == "capsule":
            protos[key] = f"capsule_{sum(k[0] == 'capsule' for k in protos)}"
        else:
            protos[key] = key[0]
    materials = sorted(
        {scene.geoms[j].material for js in by_body.values() for j in js}
    )

    w = _Writer()
    w.line("#usda 1.0")
    w.line("(")
    w.depth += 1
    w.line('defaultPrim = "World"')
    if title:
        w.line(f"doc = {_string(title)}")
    w.line(f"endTimeCode = {max(n_frames - 1, 0)}")
    w.line(f"framesPerSecond = {_f(fps)}")
    w.line("metersPerUnit = 1")
    w.line("startTimeCode = 0")
    w.line(f"timeCodesPerSecond = {_f(fps)}")
    w.line('upAxis = "Z"')
    w.depth -= 1
    w.line(")")
    w.line()
    w.open('def Xform "World"', 'kind = "assembly"')
    w.open('def Scope "Looks"')
    for k in materials:
        _write_material(w, scene, k, f"/World/Looks/M{k}")
    w.close()
    w.open('class Scope "Prototypes"')
    for key, name in protos.items():
        w.open(f'def Mesh "{name}"')
        _write_mesh_body(w, _prototype(key, scene))
        w.close()
    w.close()

    envs = [None] if env_ids is None else list(env_ids)
    for e, env in enumerate(envs):
        if env is not None:
            w.open(f'def Xform "env_{env}"')
        used = set(_RESERVED)
        for b, body in enumerate(scene.bodies):
            geoms = by_body.get(b)
            if not geoms:
                continue
            name = prim_name(body.name, used, f"body_{b}")
            w.open(f'def Xform "{name}"')
            _write_body_pose(w, poses[:, e, b])
            geom_names: set[str] = set()
            for j in geoms:
                g = scene.geoms[j]
                gname = prim_name(g.name, geom_names, f"{g.kind}_{j}")
                hit = _shape_key(g)
                if hit is None:  # a plane: its own quad
                    w.open(f'def Mesh "{gname}"', _BINDING)
                    _write_mesh_body(w, plane(*_ground_half(g, poses[:, e])))
                    scale = None
                else:
                    key, scale = hit
                    w.open(
                        f'def Mesh "{gname}"',
                        _BINDING,
                        "prepend references = "
                        f"</World/Prototypes/{protos[key]}>",
                    )
                _xform_ops(w, g.pos, g.quat, scale)
                w.line(f"rel material:binding = </World/Looks/M{g.material}>")
                if g.role == "collision":
                    w.line('uniform token purpose = "guide"')
                w.close()
            w.close()
        if env is not None:
            w.close()
    w.close()
    return w.text()


# -- packaging --


def usdz_bytes(files: Sequence[tuple[str, bytes]]) -> bytes:
    """Packs files into a USDZ archive.

    A USDZ is a zip with no compression whose file data all start at a
    multiple of 64 bytes. The first file is the root layer.

    Args:
        files: ``(name, data)`` pairs, the root layer first.

    Returns:
        The archive.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED) as zf:
        for name, data in files:
            info = zipfile.ZipInfo(name, date_time=_ZIP_TIME)
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o644 << 16
            header = 30 + len(name.encode()) + 4  # with the padding's id+size
            pad = -(buf.tell() + header) % ALIGN
            info.extra = struct.pack("<HH", _PAD_ID, pad) + b"\0" * pad
            zf.writestr(info, data)
    return buf.getvalue()


def _poses(run: library.Rollout, ids: list[int]) -> FloatArray:
    """World poses of the chosen envs, ``[T, E, B, 7]``."""
    poses = run.stream("body_pose").read(0, run.n_frames)[:, ids]
    poses = np.array(poses, dtype=np.float32)
    poses[..., :3] += run.env_origins[ids][None, :, None, :].astype(np.float32)
    q = poses[..., 3:]
    norm = np.linalg.norm(q, axis=-1, keepdims=True)
    q /= np.where(norm > 0, norm, 1.0)
    poses[..., 3:] = transforms.enforce_sign_continuity(q)
    return poses


def export_usd(
    library_root: os.PathLike[str] | str,
    run: str,
    out_path: os.PathLike[str] | str,
    *,
    envs: Sequence[int] | None = None,
) -> pathlib.Path:
    """Writes one run as a ``.usdz`` stage.

    Args:
        library_root: The library directory, or a folder that contains
            libraries.
        run: Run name.
        out_path: Destination file; parent folders are created. The suffix
            should be ``.usdz``.
        envs: The envs to export, in this order. ``None`` exports every env
            of a run that has up to 64 of them.

    Returns:
        The path written.

    Raises:
        FileNotFoundError: If there is no such run.
        ValueError: For a run that is still recording, an invalid ``envs``,
            or ``envs=None`` on a run with more than 64 envs.
    """
    root = pathlib.Path(library_root)
    hit = discover.by_name(root).get(run)
    owner = root if hit is None else hit.library
    with library.Rollout(owner, run) as rollout:
        if rollout.is_recording:
            raise ValueError(f"run {run!r} is still recording")
        n_envs = rollout.n_envs
        if envs is None:
            if n_envs > MAX_ENVS:
                raise ValueError(
                    f"run {run!r} has {n_envs} envs; pick up to {MAX_ENVS} "
                    "with envs"
                )
            ids = list(range(n_envs))
        else:
            ids = pack.check_envs(envs, n_envs, run)
        scene = rollout.scene
        poses = _poses(rollout, ids)
        fps = round(1.0 / rollout.dt, 3)
        text = stage_text(
            scene,
            poses,
            fps=fps,
            env_ids=None if n_envs == 1 else ids,
            title=f"simscope run {run}",
        )
    files = [(STAGE_NAME, text.encode())]
    used = {
        scene.materials[g.material].texture
        for g in scene.geoms
        if scene.materials[g.material].texture is not None
    }
    files += [
        (_texture_path(scene, k), scene.textures[k].data)
        for k in sorted(i for i in used if i is not None)
    ]
    out = pathlib.Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = cas.create_temp(out.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(usdz_bytes(files))
        os.replace(tmp, out)
    except BaseException:
        pathlib.Path(tmp).unlink(missing_ok=True)
        raise
    return out
