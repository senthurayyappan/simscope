"""Tests for the Isaac Lab adapter.

Isaac Lab is not installed here. Scenes are built on in-memory USD stages
(``usd-core``) and the env is faked with plain objects.
"""

import dataclasses
import importlib
import subprocess
import sys
import types
from typing import Any

import numpy as np
import pytest

from simscope import core, transforms

pytest.importorskip("pxr")
Gf: Any = importlib.import_module("pxr.Gf")
Sdf: Any = importlib.import_module("pxr.Sdf")
Usd: Any = importlib.import_module("pxr.Usd")
UsdGeom: Any = importlib.import_module("pxr.UsdGeom")
UsdPhysics: Any = importlib.import_module("pxr.UsdPhysics")
UsdShade: Any = importlib.import_module("pxr.UsdShade")

from simscope import isaaclab as sil  # noqa: E402

ATOL = 1e-5

# --------------------------------------------------------------------------
# Stage builders
# --------------------------------------------------------------------------


def new_stage(up: str = "Z", mpu: float = 1.0):
    """Creates an in-memory stage with the given up axis and unit scale."""
    stage = Usd.Stage.CreateInMemory()
    UsdGeom.SetStageUpAxis(stage, up)
    UsdGeom.SetStageMetersPerUnit(stage, mpu)
    return stage


def place(prim, translate=(0, 0, 0), rotate=(0, 0, 0), scale=(1, 1, 1)):
    """Adds translate, rotateXYZ (degrees), and scale ops to a prim."""
    xform = UsdGeom.Xformable(prim)
    xform.AddTranslateOp().Set(Gf.Vec3d(*translate))
    xform.AddRotateXYZOp().Set(Gf.Vec3f(*rotate))
    xform.AddScaleOp().Set(Gf.Vec3f(*scale))
    return prim


def define(stage, schema, path, **placement):
    """Defines a prim of a schema class and places it."""
    prim = schema.Define(stage, path)
    place(prim.GetPrim(), **placement)
    return prim


def add_mesh(stage, path, points, counts, indices, **placement):
    """Defines a mesh prim with the given topology."""
    mesh = define(stage, UsdGeom.Mesh, path, **placement)
    mesh.GetPointsAttr().Set([Gf.Vec3f(*p) for p in points])
    mesh.GetFaceVertexCountsAttr().Set(counts)
    mesh.GetFaceVertexIndicesAttr().Set(indices)
    return mesh


TRIANGLE = ([(0, 0, 0), (1, 0, 0), (0, 2, 0.5)], [3], [0, 1, 2])
QUAD = ([(0, 0, 0), (1, 0, 0), (1.5, 1, 0.3), (0, 1, 0)], [4], [0, 1, 2, 3])
TETRA = (
    [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1)],
    [3, 3, 3, 3],
    [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
)


def build_rich_stage(up: str = "Z", mpu: float = 1.0):
    """Builds a two-body stage with every supported geometry.

    Returns:
        ``(stage, body_paths)``. Body ``/World/base`` has an asymmetric pose
        and a scaled ancestor of its own geometry; ``/World/base/arm`` is a
        nested body whose geometry must not be counted for ``base``.
    """
    stage = new_stage(up, mpu)
    UsdGeom.Xform.Define(stage, "/World")
    define(
        stage,
        UsdGeom.Xform,
        "/World/base",
        translate=(1.0, -2.0, 3.0),
        rotate=(10, -25, 40),
    )
    g = "/World/base/"
    define(
        stage,
        UsdGeom.Cube,
        g + "box",
        translate=(0.2, 0.1, -0.3),
        rotate=(30, 40, 50),
    ).GetSizeAttr().Set(0.6)
    define(
        stage,
        UsdGeom.Sphere,
        g + "sphere",
        translate=(0.5, 0, 0),
        scale=(2, 2, 2),
    ).GetRadiusAttr().Set(0.15)
    define(
        stage,
        UsdGeom.Sphere,
        g + "ellipsoid",
        translate=(0, 0.6, 0),
        rotate=(15, 25, 35),
        scale=(1, 2, 3),
    ).GetRadiusAttr().Set(0.1)
    for axis in "XYZ":
        cap = define(
            stage,
            UsdGeom.Capsule,
            g + f"capsule_{axis}",
            translate=(0.1, 0.2, 0.3),
            rotate=(20, 35, -50),
            scale=(1.5, 1.5, 1.5),
        )
        cap.GetAxisAttr().Set(axis)
        cap.GetRadiusAttr().Set(0.05)
        cap.GetHeightAttr().Set(0.4)
    for axis in "XY":
        cyl = define(
            stage,
            UsdGeom.Cylinder,
            g + f"cylinder_{axis}",
            translate=(-0.3, 0.2, 0.1),
            rotate=(-20, 15, 70),
        )
        cyl.GetAxisAttr().Set(axis)
        cyl.GetRadiusAttr().Set(0.07)
        cyl.GetHeightAttr().Set(0.5)
    # Non-uniform scale forces tessellation of these two.
    cap = define(
        stage,
        UsdGeom.Capsule,
        g + "capsule_squashed",
        translate=(0, 0, 0.5),
        rotate=(5, 10, 15),
        scale=(1, 1, 2),
    )
    cap.GetAxisAttr().Set("Y")
    cap.GetRadiusAttr().Set(0.05)
    cap.GetHeightAttr().Set(0.3)
    cyl = define(
        stage,
        UsdGeom.Cylinder,
        g + "cylinder_elliptic",
        translate=(0.4, 0, 0.5),
        rotate=(5, 10, 15),
        scale=(1, 2, 3),
    )
    cyl.GetAxisAttr().Set("Z")
    cyl.GetRadiusAttr().Set(0.05)
    cyl.GetHeightAttr().Set(0.3)
    cone = define(
        stage,
        UsdGeom.Cone,
        g + "cone",
        translate=(0, -0.5, 0.2),
        rotate=(25, -15, 5),
    )
    cone.GetAxisAttr().Set("Y")
    cone.GetRadiusAttr().Set(0.1)
    cone.GetHeightAttr().Set(0.3)
    add_mesh(
        stage,
        g + "tri",
        *TRIANGLE,
        translate=(0, 0, 1),
        rotate=(40, 50, 60),
        scale=(1, 2, 3),
    )
    add_mesh(
        stage, g + "quad", *QUAD, translate=(0, 1, 1), rotate=(-40, 20, 10)
    )
    # A sheared transform: non-uniform parent scale, rotated child.
    define(stage, UsdGeom.Xform, g + "skewed", scale=(1, 2, 3))
    add_mesh(stage, g + "skewed/tetra", *TETRA, rotate=(30, 40, 50))
    define(
        stage,
        UsdGeom.Cube,
        g + "skewed/box",
        translate=(1, 0, 0),
        rotate=(30, 40, 50),
    ).GetSizeAttr().Set(0.2)
    plane = define(
        stage,
        UsdGeom.Plane,
        g + "plane_x",
        translate=(0, 0, -1),
        rotate=(3, 4, 5),
    )
    plane.GetAxisAttr().Set("X")
    plane.GetWidthAttr().Set(2.0)
    plane.GetLengthAttr().Set(3.0)
    ground = define(stage, UsdGeom.Plane, g + "ground", translate=(0, 0, -5))
    ground.GetWidthAttr().Set(100000.0)
    ground.GetLengthAttr().Set(100000.0)
    # Nested body: its own pose, and one geom that belongs to it alone.
    define(
        stage,
        UsdGeom.Xform,
        g + "arm",
        translate=(0.5, 0.5, 0.5),
        rotate=(60, -30, 20),
    )
    define(
        stage,
        UsdGeom.Cube,
        g + "arm/hand",
        translate=(0, 0, 0.3),
        rotate=(10, 20, 30),
    ).GetSizeAttr().Set(0.1)
    return stage, ["/World/base", "/World/base/arm"]


# --------------------------------------------------------------------------
# Golden world-pose helpers (independent of the implementation)
# --------------------------------------------------------------------------


@dataclasses.dataclass
class Frame:
    """Stage units and up axis, as an independent numpy model."""

    up: str
    mpu: float

    def to_out(self, points):
        """Maps stage-world points to metres, Z-up."""
        p = np.asarray(points, dtype=np.float64) * self.mpu
        if self.up == "Y":
            q = np.array([np.sin(np.pi / 4), 0.0, 0.0, np.cos(np.pi / 4)])
            p = transforms.quat_rotate(q, p)
        return p

    def from_out(self, points):
        """Inverse of ``to_out``."""
        p = np.asarray(points, dtype=np.float64)
        if self.up == "Y":
            q = np.array([-np.sin(np.pi / 4), 0.0, 0.0, np.cos(np.pi / 4)])
            p = transforms.quat_rotate(q, p)
        return p / self.mpu


def usd_world(prim):
    """Returns the prim's local-to-world Gf matrix."""
    return UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(
        Usd.TimeCode.Default()
    )


def usd_points(prim, local_points, frame):
    """Transforms local points with USD's own math, into metres and Z-up."""
    m = usd_world(prim)
    world = [m.Transform(Gf.Vec3d(*map(float, p))) for p in local_points]
    return frame.to_out(np.array([list(w) for w in world]))


def usd_body_pose(prim, frame):
    """Returns the body pose (scale removed) as ``[px..pz, qx..qw]``."""
    m = usd_world(prim).RemoveScaleShear()
    quat = m.ExtractRotationQuat()  # (real, imaginary): wxyz, not xyzw
    imag = quat.GetImaginary()
    q = np.array([imag[0], imag[1], imag[2], quat.GetReal()])
    pos = np.array(list(m.ExtractTranslation()))
    if frame.up == "Y":
        up = np.array([np.sin(np.pi / 4), 0.0, 0.0, np.cos(np.pi / 4)])
        q = transforms.quat_mul(up, q)
    return np.concatenate([frame.to_out(pos), q])


def geom_points(geom, body_pose, points):
    """Places shape-frame points into the world via the exported data."""
    pts = np.asarray(points, dtype=np.float64) * np.asarray(geom.scale)
    local = np.concatenate([geom.pos, geom.quat])
    world = transforms.compose_poses(body_pose, local)
    return transforms.quat_rotate(world[3:], pts) + world[:3]


def mesh_of(scene, geom):
    """Returns the mesh a mesh geom refers to."""
    assert geom.mesh is not None
    return scene.meshes[geom.mesh]


def assert_same_points(actual, expected):
    """Asserts equal point arrays within the golden tolerance."""
    np.testing.assert_allclose(actual, expected, atol=ATOL, rtol=0)


AXES = {"X": np.eye(3)[0], "Y": np.eye(3)[1], "Z": np.eye(3)[2]}


def check_geom(stage, scene, geom, body_prim, frame):
    """Checks one exported geom against USD's own transforms."""
    body_pose = usd_body_pose(body_prim, frame)
    prim = stage.GetPrimAtPath(str(body_prim.GetPath()) + "/" + geom.name)
    assert prim, geom.name
    size = np.array(geom.size)
    if geom.kind == "mesh":
        check_mesh(scene, geom, body_pose, prim, frame)
    elif geom.kind == "box":
        half = UsdGeom.Cube(prim).GetSizeAttr().Get() / 2
        signs = np.array(
            [[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        )
        assert_same_points(
            geom_points(geom, body_pose, signs * size),
            usd_points(prim, signs * half, frame),
        )
    elif geom.kind in ("sphere", "ellipsoid"):
        radius = UsdGeom.Sphere(prim).GetRadiusAttr().Get()
        radii = size if geom.kind == "ellipsoid" else np.full(3, size[0])
        dirs = np.concatenate([np.eye(3), -np.eye(3), [[0, 0, 0]]])
        assert_same_points(
            geom_points(geom, body_pose, dirs * radii),
            usd_points(prim, dirs * radius, frame),
        )
    elif geom.kind in ("capsule", "cylinder"):
        check_round(geom, body_pose, prim, frame, size)
    elif geom.kind == "plane":
        axis = AXES[str(UsdGeom.Plane(prim).GetAxisAttr().Get())]
        origin, normal = usd_points(prim, [[0, 0, 0], axis], frame)
        assert_same_points(geom_points(geom, body_pose, [[0, 0, 0]])[0], origin)
        up = geom_points(geom, body_pose, [[0, 0, 1]])[0] - origin
        assert_same_points(
            up, (normal - origin) / np.linalg.norm(normal - origin)
        )
    else:  # pragma: no cover
        raise AssertionError(geom.kind)


def check_round(geom, body_pose, prim, frame, size):
    """Checks a capsule or cylinder: centre, axis, half-length, radius."""
    schema = UsdGeom.Capsule if geom.kind == "capsule" else UsdGeom.Cylinder
    api = schema(prim)
    axis = AXES[str(api.GetAxisAttr().Get())]
    half = api.GetHeightAttr().Get() / 2
    radius = api.GetRadiusAttr().Get()
    radial = np.cross(axis, [0.3, 0.5, 0.8])
    radial /= np.linalg.norm(radial)
    top, bottom, side = usd_points(
        prim, [axis * half, -axis * half, radial * radius], frame
    )
    centre = (top + bottom) / 2
    assert_same_points(geom_points(geom, body_pose, [[0, 0, 0]])[0], centre)
    direction = (top - bottom) / np.linalg.norm(top - bottom)
    up = geom_points(geom, body_pose, [[0, 0, 1]])[0] - centre
    assert_same_points(up, direction)
    assert size[1] == pytest.approx(np.linalg.norm(top - bottom) / 2, abs=ATOL)
    off_axis = (side - centre) - np.dot(side - centre, direction) * direction
    assert size[0] == pytest.approx(np.linalg.norm(off_axis), abs=ATOL)


def check_mesh(scene, geom, body_pose, prim, frame):
    """Checks mesh vertices, or the bounding box of a tessellated shape."""
    verts = mesh_of(scene, geom).vertices.astype(np.float64)
    world = geom_points(geom, body_pose, verts)
    if prim.IsA(UsdGeom.Mesh):
        points = [tuple(p) for p in UsdGeom.Mesh(prim).GetPointsAttr().Get()]
        assert len(points) == len(verts)
        assert_same_points(world, usd_points(prim, points, frame))
        return
    # Tessellated shape: map back into the prim's own frame and compare
    # the bounding box with the analytic shape.
    inverse = usd_world(prim).GetInverse()
    local = np.array(
        [list(inverse.Transform(Gf.Vec3d(*p))) for p in frame.from_out(world)]
    )
    extent = analytic_extent(prim)
    np.testing.assert_allclose(local.max(axis=0), extent, atol=ATOL)
    np.testing.assert_allclose(local.min(axis=0), -extent, atol=ATOL)


def analytic_extent(prim):
    """Returns the half bounding box of a primitive in its own frame."""
    if prim.IsA(UsdGeom.Cube):
        return np.full(3, UsdGeom.Cube(prim).GetSizeAttr().Get() / 2)
    if prim.IsA(UsdGeom.Plane):
        api = UsdGeom.Plane(prim)
        axis = "XYZ".index(api.GetAxisAttr().Get())
        extent = np.zeros(3)
        extent[(axis + 1) % 3] = api.GetWidthAttr().Get() / 2
        extent[(axis + 2) % 3] = api.GetLengthAttr().Get() / 2
        return extent
    schema = next(
        s
        for s in (UsdGeom.Cone, UsdGeom.Capsule, UsdGeom.Cylinder)
        if prim.IsA(s)
    )
    api = schema(prim)
    radius, height = api.GetRadiusAttr().Get(), api.GetHeightAttr().Get()
    extent = np.full(3, radius)
    extent["XYZ".index(api.GetAxisAttr().Get())] = height / 2 + (
        radius if schema is UsdGeom.Capsule else 0
    )
    return extent


# --------------------------------------------------------------------------
# Golden world poses
# --------------------------------------------------------------------------

UNITS = [("Z", 1.0), ("Y", 0.01), ("Y", 1.0), ("Z", 0.01)]


@pytest.mark.parametrize(("up", "mpu"), UNITS)
def test_golden_world_poses(up, mpu):
    stage, body_paths = build_rich_stage(up, mpu)
    scene = sil.scene_from_stage(stage, body_paths)
    frame = Frame(up, mpu)
    assert [b.name for b in scene.bodies] == body_paths
    assert all(b.parent == -1 for b in scene.bodies)
    names = {(g.body, g.name) for g in scene.geoms}
    expected_base = {
        "box", "sphere", "ellipsoid", "capsule_X", "capsule_Y", "capsule_Z",
        "cylinder_X", "cylinder_Y", "capsule_squashed", "cylinder_elliptic",
        "cone", "tri", "quad", "skewed/tetra", "skewed/box", "plane_x",
        "ground",
    }  # fmt: skip
    assert names == {(0, n) for n in expected_base} | {(1, "hand")}
    for geom in scene.geoms:
        body_prim = stage.GetPrimAtPath(body_paths[geom.body])
        check_geom(stage, scene, geom, body_prim, frame)


def test_golden_kinds():
    stage, body_paths = build_rich_stage()
    scene = sil.scene_from_stage(stage, body_paths)
    kinds = {g.name: g.kind for g in scene.geoms}
    assert kinds["box"] == "box"
    assert kinds["sphere"] == "sphere"
    assert kinds["ellipsoid"] == "ellipsoid"
    assert kinds["capsule_X"] == kinds["capsule_Z"] == "capsule"
    assert kinds["cylinder_Y"] == "cylinder"
    assert kinds["ground"] == "plane"
    for name in (
        "capsule_squashed", "cylinder_elliptic", "cone", "tri", "quad",
        "skewed/tetra", "skewed/box", "plane_x",
    ):  # fmt: skip
        assert kinds[name] == "mesh"
    sphere = next(g for g in scene.geoms if g.name == "sphere")
    assert sphere.size == pytest.approx((0.3, 0, 0))  # radius 0.15 * scale 2
    tri = next(g for g in scene.geoms if g.name == "tri")
    assert tri.scale == pytest.approx((1, 2, 3))  # non-uniform scale kept


def test_meshes_are_valid_and_outward_facing():
    stage, body_paths = build_rich_stage()
    scene = sil.scene_from_stage(stage, body_paths)
    for name in ("cone", "capsule_squashed", "cylinder_elliptic", "skewed/box"):
        geom = next(g for g in scene.geoms if g.name == name)
        mesh = mesh_of(scene, geom)
        tri = mesh.vertices[mesh.faces].astype(np.float64)
        volume = np.einsum(
            "ij,ij->i", tri[:, 0], np.cross(tri[:, 1], tri[:, 2])
        ).sum()
        assert volume > 0, name
        assert mesh.faces.max() < len(mesh.vertices)


def test_quaternion_order_asymmetric_rotation():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    cube = UsdGeom.Cube.Define(stage, "/b/c")
    cube.GetSizeAttr().Set(0.2)
    axis = Gf.Vec3d(1.0, 2.0, 3.0).GetNormalized()
    angle = 50.0
    rot = Gf.Rotation(axis, angle).GetQuat()  # real first
    UsdGeom.Xformable(cube).AddOrientOp().Set(
        Gf.Quatf(float(rot.GetReal()), *map(float, rot.GetImaginary()))
    )
    scene = sil.scene_from_stage(stage, ["/b"])
    half = np.radians(angle) / 2
    want = np.array([*(np.sin(half) * np.array(axis)), np.cos(half)])
    got = np.array(scene.geoms[0].quat)
    if got[3] * want[3] < 0:
        got = -got
    np.testing.assert_allclose(got, want, atol=1e-6)


def test_rotation_90_about_x_is_xyzw():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    cube = UsdGeom.Cube.Define(stage, "/b/c")
    UsdGeom.Xformable(cube).AddRotateXOp().Set(90.0)
    scene = sil.scene_from_stage(stage, ["/b"])
    np.testing.assert_allclose(
        scene.geoms[0].quat, [0.7071068, 0, 0, 0.7071068], atol=1e-6
    )


def test_body_pose_matters_not_only_relative_pose():
    """A geom on a rotated body keeps a pose relative to that body."""
    stage = new_stage()
    define(stage, UsdGeom.Xform, "/b", translate=(5, 6, 7), rotate=(0, 0, 90))
    define(stage, UsdGeom.Cube, "/b/c", translate=(1, 0, 0))
    scene = sil.scene_from_stage(stage, ["/b"])
    assert scene.geoms[0].pos == pytest.approx((1, 0, 0), abs=1e-9)


def test_y_up_centimetre_stage_output_is_z_up_metres():
    stage = new_stage("Y", 0.01)
    UsdGeom.Xform.Define(stage, "/b")  # body at the stage origin
    cube = define(stage, UsdGeom.Cube, "/b/c", translate=(100, 200, 300))
    cube.GetSizeAttr().Set(20)
    geom = sil.scene_from_stage(stage, ["/b"]).geoms[0]
    # The geom offset is relative to the body, so only the unit changes.
    assert geom.pos == pytest.approx((1.0, 2.0, 3.0), abs=1e-9)
    assert geom.size == pytest.approx((0.1, 0.1, 0.1))
    # The body pose in the pose stream is Z-up: an identity Y-up body is a
    # +90 degree turn about x, so the world position is (1, -3, 2).
    body = usd_body_pose(stage.GetPrimAtPath("/b"), Frame("Y", 0.01))
    np.testing.assert_allclose(
        body[3:], [0.70710678, 0, 0, 0.70710678], atol=1e-7
    )
    world = geom_points(geom, body, [[0, 0, 0]])[0]
    np.testing.assert_allclose(world, [1.0, -3.0, 2.0], atol=1e-6)


def test_y_up_body_pose_rotation():
    stage = new_stage("Y", 1.0)
    define(stage, UsdGeom.Xform, "/b", translate=(1, 2, 3))
    define(stage, UsdGeom.Cube, "/b/c", translate=(0, 1, 0))
    geom = sil.scene_from_stage(stage, ["/b"]).geoms[0]
    # Local offsets are unchanged: the body frame carries the up-axis
    # rotation, the geom frame is relative to it.
    assert geom.pos == pytest.approx((0, 1, 0), abs=1e-9)


# --------------------------------------------------------------------------
# Roles, visibility, materials, instancing, meshes
# --------------------------------------------------------------------------


def roles(scene):
    return {g.name: g.role for g in scene.geoms}


def test_roles_purposes_and_collision_api():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    define(stage, UsdGeom.Cube, "/b/visual")
    collider = define(stage, UsdGeom.Cube, "/b/collider")
    UsdPhysics.CollisionAPI.Apply(collider.GetPrim())
    guide = define(stage, UsdGeom.Sphere, "/b/guide")
    guide.GetPurposeAttr().Set(UsdGeom.Tokens.guide)
    proxy = define(stage, UsdGeom.Sphere, "/b/proxy")
    proxy.GetPurposeAttr().Set(UsdGeom.Tokens.proxy)
    both = define(stage, UsdGeom.Cube, "/b/render_and_collide")
    both.GetPurposeAttr().Set(UsdGeom.Tokens.render)
    UsdPhysics.CollisionAPI.Apply(both.GetPrim())
    # Collision applied to a parent Xform covers its geometry.
    parent = define(stage, UsdGeom.Xform, "/b/group")
    UsdPhysics.CollisionAPI.Apply(parent.GetPrim())
    define(stage, UsdGeom.Cube, "/b/group/inner")
    scene = sil.scene_from_stage(stage, ["/b"])
    assert roles(scene) == {
        "visual": "visual",
        "collider": "collision",
        "guide": "collision",
        "proxy": "collision",
        "render_and_collide": "visual",
        "group/inner": "collision",
    }
    visual_only = sil.scene_from_stage(stage, ["/b"], collision=False)
    assert set(roles(visual_only)) == {"visual", "render_and_collide"}
    assert all(g.role == "visual" for g in visual_only.geoms)


def test_lone_collider_is_promoted_to_visual():
    """A spawned cube that is also the collider still shows by default."""
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/cube")
    cube = define(stage, UsdGeom.Cube, "/cube/geom")
    UsdPhysics.CollisionAPI.Apply(cube.GetPrim())
    guide = define(stage, UsdGeom.Sphere, "/cube/guide")
    guide.GetPurposeAttr().Set(UsdGeom.Tokens.guide)
    scene = sil.scene_from_stage(stage, ["/cube"])
    assert roles(scene) == {"geom": "visual", "guide": "collision"}


def test_invisible_prims_are_skipped():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    define(stage, UsdGeom.Cube, "/b/shown")
    hidden = define(stage, UsdGeom.Cube, "/b/hidden")
    hidden.GetVisibilityAttr().Set(UsdGeom.Tokens.invisible)
    group = define(stage, UsdGeom.Xform, "/b/group")
    group.GetVisibilityAttr().Set(UsdGeom.Tokens.invisible)
    define(stage, UsdGeom.Cube, "/b/group/child")
    scene = sil.scene_from_stage(stage, ["/b"])
    assert [g.name for g in scene.geoms] == ["shown"]


def bind_preview(stage, geom_prim, name, **inputs):
    material = UsdShade.Material.Define(stage, f"/Looks/{name}")
    shader = UsdShade.Shader.Define(stage, f"/Looks/{name}/shader")
    shader.CreateIdAttr("UsdPreviewSurface")
    types = {
        "diffuseColor": Sdf.ValueTypeNames.Color3f,
        "opacity": Sdf.ValueTypeNames.Float,
        "metallic": Sdf.ValueTypeNames.Float,
        "roughness": Sdf.ValueTypeNames.Float,
    }
    for key, value in inputs.items():
        shader.CreateInput(key, types[key]).Set(value)
    material.CreateSurfaceOutput().ConnectToSource(
        shader.ConnectableAPI(), "surface"
    )
    UsdShade.MaterialBindingAPI.Apply(geom_prim).Bind(material)


def test_materials_preview_surface_and_display_color():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    a = define(stage, UsdGeom.Cube, "/b/a")
    bind_preview(
        stage, a.GetPrim(), "red", diffuseColor=Gf.Vec3f(1, 0.25, 0),
        opacity=0.5, metallic=0.75, roughness=0.125,
    )  # fmt: skip
    b = define(stage, UsdGeom.Cube, "/b/b")
    bind_preview(
        stage, b.GetPrim(), "red2", diffuseColor=Gf.Vec3f(1, 0.25, 0),
        opacity=0.5, metallic=0.75, roughness=0.125,
    )  # fmt: skip
    c = define(stage, UsdGeom.Cube, "/b/c")
    c.GetDisplayColorAttr().Set([Gf.Vec3f(0, 1, 0.5)])
    c.GetDisplayOpacityAttr().Set([0.25])
    define(stage, UsdGeom.Cube, "/b/d")  # nothing authored
    scene = sil.scene_from_stage(stage, ["/b"])
    by_name = {g.name: scene.materials[g.material] for g in scene.geoms}
    assert by_name["a"].rgba == (1.0, 0.25, 0.0, 0.5)
    assert by_name["a"].metallic == 0.75
    assert by_name["a"].roughness == 0.125
    assert by_name["c"].rgba == (0.0, 1.0, 0.5, 0.25)
    assert by_name["d"] == core.Material()
    # Identical materials from different prims are deduplicated.
    assert by_name["a"] is by_name["b"]
    assert len(scene.materials) == 3


def test_mdl_material_is_read_from_constants():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    cube = define(stage, UsdGeom.Cube, "/b/a")
    material = UsdShade.Material.Define(stage, "/Looks/omni")
    shader = UsdShade.Shader.Define(stage, "/Looks/omni/shader")
    shader.CreateIdAttr("OmniPBR")
    shader.CreateInput(
        "diffuse_color_constant", Sdf.ValueTypeNames.Color3f
    ).Set(Gf.Vec3f(0.2, 0.4, 0.6))
    shader.CreateInput(
        "reflection_roughness_constant", Sdf.ValueTypeNames.Float
    ).Set(0.3)
    material.CreateSurfaceOutput("mdl").ConnectToSource(
        shader.ConnectableAPI(), "out"
    )
    UsdShade.MaterialBindingAPI.Apply(cube.GetPrim()).Bind(material)
    scene = sil.scene_from_stage(stage, ["/b"])
    mat = scene.materials[scene.geoms[0].material]
    assert mat.rgba[:3] == pytest.approx((0.2, 0.4, 0.6))
    assert mat.roughness == pytest.approx(0.3)
    assert mat.texture is None


def test_instanceable_prims_and_mesh_dedup():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/Proto")
    add_mesh(stage, "/Proto/mesh", *TETRA)
    define(stage, UsdGeom.Cube, "/Proto/cube", translate=(2, 0, 0))
    define(stage, UsdGeom.Xform, "/b", translate=(1, 2, 3), rotate=(5, 6, 7))
    for i in range(2):
        inst = define(
            stage, UsdGeom.Xform, f"/b/inst{i}", translate=(0, i, 0),
            rotate=(0, 30 * i, 0), scale=(1, 1, 2),
        )  # fmt: skip
        inst.GetPrim().GetReferences().AddInternalReference("/Proto")
        inst.GetPrim().SetInstanceable(True)
    # The body prim itself may be an instance root.
    body2 = define(stage, UsdGeom.Xform, "/b2", translate=(4, 5, 6))
    body2.GetPrim().GetReferences().AddInternalReference("/Proto")
    body2.GetPrim().SetInstanceable(True)
    scene = sil.scene_from_stage(stage, ["/b", "/b2"])
    assert stage.GetPrimAtPath("/b/inst0").IsInstance()
    assert sorted((g.body, g.name) for g in scene.geoms) == [
        (0, "inst0/cube"),
        (0, "inst0/mesh"),
        (0, "inst1/cube"),
        (0, "inst1/mesh"),
        (1, "cube"),
        (1, "mesh"),
    ]
    assert len(scene.meshes) == 1  # one mesh shared by all three instances
    frame = Frame("Z", 1.0)
    for geom in scene.geoms:
        body = stage.GetPrimAtPath(scene.bodies[geom.body].name)
        check_geom_by_path(stage, scene, geom, body, frame)


def check_geom_by_path(stage, scene, geom, body_prim, frame):
    """Checks meshes and boxes under instance proxies against USD."""
    body_pose = usd_body_pose(body_prim, frame)
    prim = stage.GetPrimAtPath(str(body_prim.GetPath()) + "/" + geom.name)
    assert prim
    if geom.kind == "mesh":
        check_mesh(scene, geom, body_pose, prim, frame)
    else:
        half = UsdGeom.Cube(prim).GetSizeAttr().Get() / 2
        signs = np.array(
            [[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        )
        assert_same_points(
            geom_points(geom, body_pose, signs * np.array(geom.size)),
            usd_points(prim, signs * half, frame),
        )


def test_polygon_triangulation_and_orientation():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    pentagon = [(0, 0, 0), (2, 0, 0), (3, 1, 0), (1, 2, 0), (-1, 1, 0)]
    quad_pair = [*pentagon, (5, 0, 0), (6, 0, 0), (6, 1, 0), (5, 1, 0)]
    add_mesh(stage, "/b/mixed", quad_pair, [5, 4], [0, 1, 2, 3, 4, 5, 6, 7, 8])
    left = add_mesh(stage, "/b/left", *TRIANGLE)
    left.GetOrientationAttr().Set(UsdGeom.Tokens.leftHanded)
    scene = sil.scene_from_stage(stage, ["/b"])
    mixed = mesh_of(scene, scene.geoms[0])
    assert mixed.faces.tolist() == [
        [0, 1, 2], [0, 2, 3], [0, 3, 4], [5, 6, 7], [5, 7, 8],
    ]  # fmt: skip
    assert mixed.vertices.shape == (9, 3)
    flipped = mesh_of(scene, scene.geoms[1])
    assert flipped.faces.tolist() == [[2, 1, 0]]
    assert mixed.faces.dtype == np.uint32
    assert mixed.vertices.dtype == np.float32


def test_unsupported_and_empty_prims_are_skipped_with_one_warning(caplog):
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    define(stage, UsdGeom.Cube, "/b/ok")
    UsdGeom.Points.Define(stage, "/b/points").GetPointsAttr().Set(
        [Gf.Vec3f(0, 0, 0)]
    )
    UsdGeom.Mesh.Define(stage, "/b/empty")
    with caplog.at_level("WARNING", logger="simscope.isaaclab"):
        scene = sil.scene_from_stage(stage, ["/b"])
    assert [g.name for g in scene.geoms] == ["ok"]
    warnings = [r for r in caplog.records if r.name == "simscope.isaaclab"]
    assert len(warnings) == 1
    assert "Points" in warnings[0].getMessage()


def test_scene_from_stage_validates_paths():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    with pytest.raises(ValueError, match="empty"):
        sil.scene_from_stage(stage, [])
    with pytest.raises(ValueError, match="duplicates"):
        sil.scene_from_stage(stage, ["/b", "/b"])
    with pytest.raises(ValueError, match="/nope"):
        sil.scene_from_stage(stage, ["/b", "/nope"])


def test_body_without_geometry_and_scene_validates():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/empty")
    scene = sil.scene_from_stage(stage, ["/empty"])
    assert scene.geoms == ()
    assert scene.materials  # never empty


def test_mirrored_mesh_keeps_negative_scale():
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/b")
    add_mesh(stage, "/b/m", *TETRA, rotate=(10, 20, 30), scale=(-1, 2, 3))
    scene = sil.scene_from_stage(stage, ["/b"])
    geom = scene.geoms[0]
    assert np.prod(geom.scale) < 0
    check_mesh(
        scene, geom, usd_body_pose(stage.GetPrimAtPath("/b"), Frame("Z", 1.0)),
        stage.GetPrimAtPath("/b/m"), Frame("Z", 1.0),
    )  # fmt: skip


# --------------------------------------------------------------------------
# Fake Isaac Lab env
# --------------------------------------------------------------------------


class WarpLike:
    """Stands in for a Warp array: exposes ``numpy()`` only."""

    def __init__(self, array):
        self._array = array
        self.shape = array.shape

    def numpy(self):
        return self._array


class FakeProxyArray:
    """Stands in for Isaac Lab's ``ProxyArray``.

    The real class forwards unknown attributes to torch, so anything but
    the explicit ``torch``/``warp`` accessors must not be touched.
    """

    def __init__(self, array):
        self._array = array
        self.torch_reads = 0

    @property
    def torch(self):
        self.torch_reads += 1
        return self._array

    @property
    def warp(self):  # pragma: no cover - only the class attribute is checked
        raise AssertionError("warp must not be read")

    def __getattr__(self, name):
        raise AssertionError(f"implicit access to {name}")


class FakeData:
    def __init__(self, pose):
        self.body_link_pose_w = pose


class FakeAsset:
    def __init__(self, pose, body_names, prim_path, link_paths=None):
        self.data = FakeData(pose)
        self.body_names = body_names
        self.cfg = types.SimpleNamespace(prim_path=prim_path)
        if link_paths is not None:
            self.root_view = types.SimpleNamespace(link_paths=link_paths)


class FakeScene(dict):
    def __init__(self, stage, n_envs, assets, origins=None):
        super().__init__(assets)
        self.stage = stage
        self.env_prim_paths = [f"/World/envs/env_{i}" for i in range(n_envs)]
        self.env_regex_ns = "/World/envs/env_[^/]+"
        self.env_origins = (
            np.zeros((n_envs, 3), np.float32) if origins is None else origins
        )


class FakeEnv:
    def __init__(self, scene, step_dt=0.02):
        self.scene = scene
        self.step_dt = step_dt


def make_poses(rng, n_envs, n_bodies):
    pose = rng.normal(size=(n_envs, n_bodies, 7)).astype(np.float32)
    pose[..., 3:] /= np.linalg.norm(pose[..., 3:], axis=-1, keepdims=True)
    return pose


@pytest.fixture
def rng():
    return np.random.default_rng(0)


def fake_env_with_arrays(rng, n_envs=3, bodies=(4, 1, 2)):
    names = ["robot", "cube", "pair"]
    poses = [make_poses(rng, n_envs, b) for b in bodies]
    assets = {
        n: FakeAsset(p, [f"{n}{i}" for i in range(b)], f"/{n}")
        for n, p, b in zip(names, poses, bodies, strict=True)
    }
    return FakeEnv(FakeScene(None, n_envs, assets)), names, poses


def test_poses_concatenates_in_asset_order(rng):
    env, _, poses = fake_env_with_arrays(rng)
    out = sil.poses(env, ["cube", "robot"])
    assert out.dtype == np.float32
    assert out.shape == (3, 5, 7)
    assert out.flags.c_contiguous
    np.testing.assert_array_equal(out[:, :1], poses[1])
    np.testing.assert_array_equal(out[:, 1:], poses[0])
    out[:] = 0  # never aliases the simulator's array
    assert poses[0].any()


def test_poses_accepts_warp_like_proxy_and_float64(rng):
    env, names, poses = fake_env_with_arrays(rng)
    scene = env.scene
    scene["robot"].data.body_link_pose_w = WarpLike(poses[0])
    proxy = FakeProxyArray(poses[1])
    scene["cube"].data.body_link_pose_w = proxy
    scene["pair"].data.body_link_pose_w = poses[2].astype(np.float64)
    out = sil.poses(env, names)
    np.testing.assert_array_equal(out, np.concatenate(poses, axis=1))
    assert proxy.torch_reads == 1


def test_poses_is_unwrapped_from_gym_wrappers(rng):
    env, _, poses = fake_env_with_arrays(rng)
    wrapper = types.SimpleNamespace(unwrapped=env)
    np.testing.assert_array_equal(sil.poses(wrapper, ["robot"]), poses[0])


def test_poses_rejects_bad_shapes(rng):
    env, names, poses = fake_env_with_arrays(rng)
    env.scene["cube"].data.body_link_pose_w = poses[1][..., :6]
    with pytest.raises(ValueError, match="must be"):
        sil.poses(env, names)
    env.scene["cube"].data.body_link_pose_w = poses[1][:2]
    with pytest.raises(ValueError, match="numbers of envs"):
        sil.poses(env, names)
    with pytest.raises(ValueError, match="empty"):
        sil.poses(env, [])


def test_env_origins_and_step_dt(rng):
    origins = rng.normal(size=(3, 3)).astype(np.float32)
    env = FakeEnv(FakeScene(None, 3, {}, WarpLike(origins)), step_dt=0.05)
    out = sil.env_origins(env)
    np.testing.assert_array_equal(out, origins)
    assert out.dtype == np.float32
    assert sil.step_dt(env) == 0.05
    env.scene.env_origins = np.zeros((3, 2), np.float32)
    with pytest.raises(ValueError, match=r"\[E, 3\]"):
        sil.env_origins(env)


def test_source_info():
    info = sil.source_info()
    assert info["simulator"] == "isaaclab"
    assert isinstance(info["version"], str) and info["version"]


# --------------------------------------------------------------------------
# PoseBuffer
# --------------------------------------------------------------------------


def test_pose_buffer_numpy_round_trip(rng):
    env, names, poses = fake_env_with_arrays(rng)
    buf = sil.PoseBuffer(env, names, capacity=5)
    frames = []
    for _ in range(4):
        for asset, pose in zip(
            (env.scene[n] for n in names), poses, strict=True
        ):
            asset.data.body_link_pose_w = make_poses(rng, *pose.shape[:2])
        frames.append(sil.poses(env, names))
        buf.push()
    assert len(buf) == 4
    assert not buf.full
    block = buf.drain()
    assert block.shape == (4, 3, 7, 7)
    assert block.dtype == np.float32
    np.testing.assert_array_equal(block, np.stack(frames))
    assert len(buf) == 0
    assert buf.drain().shape == (0, 3, 7, 7)
    # The buffer is reusable, and the earlier block is not overwritten.
    saved = block.copy()
    buf.push()
    np.testing.assert_array_equal(block, saved)


def test_pose_buffer_full_and_errors(rng):
    env, names, poses = fake_env_with_arrays(rng)
    with pytest.raises(ValueError, match="capacity"):
        sil.PoseBuffer(env, names, capacity=0)
    with pytest.raises(ValueError, match="empty"):
        sil.PoseBuffer(env, [], capacity=2)
    buf = sil.PoseBuffer(env, names, capacity=2)
    buf.push()
    buf.push()
    assert buf.full
    with pytest.raises(BufferError, match="drain"):
        buf.push()
    assert buf.drain().shape[0] == 2
    buf.push()  # drained buffers accept frames again
    env.scene["cube"].data.body_link_pose_w = poses[1][:, :, :]
    env.scene["robot"].data.body_link_pose_w = poses[0][:, :3]
    with pytest.raises(ValueError, match="changed shape"):
        buf.push()


def test_pose_buffer_reads_proxy_and_warp_like(rng):
    env, names, poses = fake_env_with_arrays(rng)
    env.scene["robot"].data.body_link_pose_w = FakeProxyArray(poses[0])
    env.scene["cube"].data.body_link_pose_w = WarpLike(poses[1])
    buf = sil.PoseBuffer(env, names, capacity=2)
    buf.push()
    np.testing.assert_array_equal(buf.drain()[0], np.concatenate(poses, axis=1))


def test_pose_buffer_torch_path(rng):
    torch = pytest.importorskip("torch")
    env, names, poses = fake_env_with_arrays(rng)
    tensors = [torch.from_numpy(p.copy()) for p in poses]
    for name, tensor in zip(names, tensors, strict=True):
        env.scene[name].data.body_link_pose_w = tensor
    expected = []
    buf = sil.PoseBuffer(env, names, capacity=3)
    for step in range(3):
        for tensor in tensors:
            tensor += 0.5 * (step + 1)
        expected.append(np.concatenate([t.numpy() for t in tensors], axis=1))
        buf.push()
    block = buf.drain()
    np.testing.assert_array_equal(block, np.stack(expected))
    assert block.dtype == np.float32
    np.testing.assert_array_equal(
        sil.poses(env, names), np.concatenate([t.numpy() for t in tensors], 1)
    )
    env.scene["robot"].data.body_link_pose_w = poses[0]
    with pytest.raises(TypeError, match="mix"):
        buf.push()


# --------------------------------------------------------------------------
# scene_from_env
# --------------------------------------------------------------------------


def build_env_stage():
    """Two envs, each with a 3-link robot and a cube; env_0 is what counts."""
    stage = new_stage()
    UsdGeom.Xform.Define(stage, "/World")
    UsdGeom.Xform.Define(stage, "/World/envs")
    for i in range(2):
        env = f"/World/envs/env_{i}"
        define(stage, UsdGeom.Xform, env, translate=(10 * i, 0, 0))
        define(stage, UsdGeom.Xform, f"{env}/Robot")
        define(
            stage, UsdGeom.Xform, f"{env}/Robot/base", translate=(0, 0, 1)
        ).GetPrim().ApplyAPI(UsdPhysics.RigidBodyAPI)
        define(stage, UsdGeom.Cube, f"{env}/Robot/base/visual")
        define(
            stage,
            UsdGeom.Xform,
            f"{env}/Robot/arm",
            translate=(1, 0, 1),
            rotate=(0, 90, 0),
        ).GetPrim().ApplyAPI(UsdPhysics.RigidBodyAPI)
        define(stage, UsdGeom.Capsule, f"{env}/Robot/arm/visual")
        define(
            stage, UsdGeom.Xform, f"{env}/Robot/hand", translate=(2, 0, 1)
        ).GetPrim().ApplyAPI(UsdPhysics.RigidBodyAPI)
        define(stage, UsdGeom.Sphere, f"{env}/Robot/hand/visual")
        cube = define(stage, UsdGeom.Cube, f"{env}/Cube", translate=(0, 3, 0))
        cube.GetPrim().ApplyAPI(UsdPhysics.RigidBodyAPI)
        UsdPhysics.CollisionAPI.Apply(cube.GetPrim())
    return stage  # fmt: skip


def make_env(stage, robot_prim_path, with_link_paths, rng):
    link_paths = None
    if with_link_paths:  # PhysX lists links in its own (backend) order
        link_paths = [
            [f"/World/envs/env_{i}/Robot/{n}" for n in ("base", "arm", "hand")]
            for i in range(2)
        ]
    robot = FakeAsset(
        make_poses(rng, 2, 3),
        ["hand", "base", "arm"],  # public order differs from backend order
        robot_prim_path,
        link_paths,
    )
    cube = FakeAsset(make_poses(rng, 2, 1), ["Cube"], "{ENV_REGEX_NS}/Cube")
    scene = FakeScene(stage, 2, {"robot": robot, "cube": cube})
    return FakeEnv(scene)


@pytest.mark.parametrize("with_link_paths", [True, False])
@pytest.mark.parametrize(
    "prim_path",
    ["{ENV_REGEX_NS}/Robot", "/World/envs/env_[^/]+/Robot"],
)
def test_scene_from_env(prim_path, with_link_paths, rng):
    stage = build_env_stage()
    env = make_env(stage, prim_path, with_link_paths, rng)
    scene = sil.scene_from_env(env, ["robot", "cube"])
    assert [b.name for b in scene.bodies] == [
        "/World/envs/env_0/Robot/hand",
        "/World/envs/env_0/Robot/base",
        "/World/envs/env_0/Robot/arm",
        "/World/envs/env_0/Cube",
    ]
    assert scene.n_bodies == sil.poses(env, ["robot", "cube"]).shape[1]
    assert [(g.body, g.name, g.kind) for g in scene.geoms] == [
        (0, "visual", "sphere"),
        (1, "visual", "box"),
        (2, "visual", "capsule"),
        (3, "Cube", "box"),
    ]
    # The lone cube is both body and collider, so it stays visible.
    assert scene.geoms[3].role == "visual"
    only_cube = sil.scene_from_env(env, ["cube"], collision=False)
    assert [b.name for b in only_cube.bodies] == ["/World/envs/env_0/Cube"]


def test_scene_from_env_rigid_object_collection_and_errors(rng):
    stage = build_env_stage()
    cfgs = {
        "a": types.SimpleNamespace(prim_path="{ENV_REGEX_NS}/Cube"),
        "b": types.SimpleNamespace(prim_path="{ENV_REGEX_NS}/Robot/base"),
    }
    collection = types.SimpleNamespace(
        body_names=["b", "a"],
        cfg=types.SimpleNamespace(rigid_objects=cfgs),
        data=FakeData(make_poses(rng, 2, 2)),
    )
    env = FakeEnv(FakeScene(stage, 2, {"coll": collection}))
    scene = sil.scene_from_env(env, ["coll"])
    assert [b.name for b in scene.bodies] == [
        "/World/envs/env_0/Robot/base",
        "/World/envs/env_0/Cube",
    ]
    with pytest.raises(ValueError, match="empty"):
        sil.scene_from_env(env, [])
    ghost = FakeAsset(make_poses(rng, 2, 2), ["x", "y"], "{ENV_REGEX_NS}/Robot")
    env.scene["ghost"] = ghost
    with pytest.raises(ValueError, match="no prim under"):
        sil.scene_from_env(env, ["ghost"])
    weird = FakeAsset(
        make_poses(rng, 2, 1), ["x"], "/World/envs/env_.*/Robot/x"
    )
    env.scene["weird"] = weird
    weird.cfg.prim_path = "/World/other_[0-9]/Robot"
    with pytest.raises(ValueError, match="cannot resolve"):
        sil.scene_from_env(env, ["weird"])


def test_link_paths_from_another_env_are_ignored(rng):
    stage = build_env_stage()
    env = make_env(stage, "{ENV_REGEX_NS}/Robot", True, rng)
    # If the view's first row is not env 0, fall back to the stage search.
    env.scene["robot"].root_view.link_paths = [
        [f"/World/envs/env_1/Robot/{n}" for n in ("base", "arm", "hand")]
    ]
    scene = sil.scene_from_env(env, ["robot"])
    assert all("/env_0/" in b.name for b in scene.bodies)


# --------------------------------------------------------------------------
# Import hygiene
# --------------------------------------------------------------------------


def run_python(code):
    return subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def test_import_simscope_does_not_import_pxr_or_sims():
    code = (
        "import sys, simscope\n"
        "bad = [m for m in ('pxr', 'torch', 'warp', 'isaaclab', 'omni',"
        " 'isaacsim') if m in sys.modules]\n"
        "print(bad)"
    )
    assert run_python(code) == "[]"


def test_import_adapter_does_not_import_torch_or_isaac():
    code = (
        "import sys, simscope.isaaclab\n"
        "bad = [m for m in ('torch', 'warp', 'isaaclab', 'omni',"
        " 'isaacsim') if m in sys.modules]\n"
        "print(bad)"
    )
    assert run_python(code) == "[]"


def test_y_up_stage_logs_a_warning(caplog):
    stage = new_stage("Y", 0.01)
    UsdGeom.Xform.Define(stage, "/b")
    with caplog.at_level("WARNING", logger="simscope.isaaclab"):
        sil.scene_from_stage(stage, ["/b"])
    assert "Y-up" in caplog.text
    caplog.clear()
    with caplog.at_level("WARNING", logger="simscope.isaaclab"):
        stage_z = new_stage("Z", 1.0)
        UsdGeom.Xform.Define(stage_z, "/b")
        sil.scene_from_stage(stage_z, ["/b"])
    assert not caplog.records


# --------------------------------------------------------------------------
# Contacts
# --------------------------------------------------------------------------


class FakeSensor:
    def __init__(self, forces, body_names):
        self.data = types.SimpleNamespace(net_forces_w=forces)
        self.body_names = body_names


def test_contacts_from_asset_matches_sensor_bodies(rng):
    env, _, poses = fake_env_with_arrays(rng, n_envs=3, bodies=(4, 1, 2))
    robot = env.scene["robot"]  # bodies robot0 .. robot3
    forces = rng.normal(size=(3, 2, 3)).astype(np.float32)
    sensor = FakeSensor(WarpLike(forces), ["robot3", "robot1"])
    out = sil.contacts(sensor, robot)
    assert out.shape == (3, 2, 6) and out.dtype == np.float32
    np.testing.assert_array_equal(out[..., 3:], forces)
    np.testing.assert_array_equal(out[:, 0, :3], poses[0][:, 3, :3])
    np.testing.assert_array_equal(out[:, 1, :3], poses[0][:, 1, :3])
    with pytest.raises(ValueError, match="not all in"):
        sil.contacts(FakeSensor(forces, ["robot3", "nope"]), robot)


def test_contacts_from_positions_and_out_buffer(rng):
    forces = rng.normal(size=(2, 3, 3)).astype(np.float32)
    proxy = FakeProxyArray(forces)
    sensor = FakeSensor(proxy, ["a", "b", "c"])
    pose = make_poses(rng, 2, 3)
    out = np.full((2, 3, 6), 9.0, np.float32)
    got = sil.contacts(sensor, pose, out=out)
    assert got is out and proxy.torch_reads == 1
    np.testing.assert_array_equal(out[..., :3], pose[..., :3])
    np.testing.assert_array_equal(out[..., 3:], forces)
    np.testing.assert_array_equal(
        sil.contacts(sensor, pose[..., :3]), out
    )  # positions or poses
    with pytest.raises(ValueError, match="do not match"):
        sil.contacts(sensor, pose[:, :2])
    with pytest.raises(ValueError, match="out must be"):
        sil.contacts(
            sensor,
            pose,
            out=np.zeros((2, 3, 6), np.float64),  # ty: ignore[invalid-argument-type]
        )
    with pytest.raises(ValueError, match=r"\[E, B, 3\]"):
        sil.contacts(FakeSensor(forces[0], ["a"]), pose)


def test_contacts_stream_round_trip(tmp_path, rng):
    from simscope import library

    lib = library.Library(tmp_path / "lib")
    scene = core.Scene(
        bodies=(
            core.Body("world", -1),
            core.Body("foot", 0),
            core.Body("hand", 0),
        )
    )
    pose = make_poses(rng, 2, 3)
    forces = np.zeros((2, 2, 3), np.float32)
    forces[0, 0] = (0, 0, 120.0)
    sensor = FakeSensor(forces, ["foot", "hand"])
    with lib.record("isaac", scene=scene, dt=0.02, n_envs=2) as rec:
        sil.add_contacts_stream(rec, 2, mass=12.0)
        rec.log(pose, contacts=sil.contacts(sensor, pose[:, 1:]))
    with lib.open("isaac") as run:
        info = run.manifest.streams["contacts"]
        assert info.item_shape == (2, 6) and info.units == "N"
        assert info.scale == pytest.approx(1 / (12.0 * 9.81))
        got = run.stream("contacts").read(0, 1)
    assert got[0, 0, 0, 5] == 120.0
    with pytest.raises(ValueError, match="mass"):
        sil.add_contacts_stream(None, 2, mass=0)
