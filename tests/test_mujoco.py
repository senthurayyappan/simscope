import logging
import struct
import subprocess
import sys
import types
import zlib

import mujoco
import numpy as np
import pytest

from simscope import core, transforms
from simscope import mujoco as smj

MODEL_XML = """
<mujoco>
  <compiler angle="degree"/>
  <asset>
    <texture name="checker" type="2d" builtin="checker"
             rgb1=".2 .3 .4" rgb2=".8 .7 .6" width="16" height="8"/>
    <texture name="checker_copy" type="2d" builtin="checker"
             rgb1=".2 .3 .4" rgb2=".8 .7 .6" width="16" height="8"/>
    <texture name="cube" type="cube" builtin="checker"
             rgb1=".2 .3 .4" rgb2=".8 .7 .6" width="8" height="8"/>
    <material name="chk" texture="checker" texrepeat="2 3" rgba="1 .9 .8 1"
              metallic="0.25" roughness="0.75"/>
    <material name="chk_twin" texture="checker" texrepeat="2 3"
              rgba="1 .9 .8 1" metallic="0.25" roughness="0.75"/>
    <material name="chk_copy" texture="checker_copy" texrepeat="1 1"/>
    <material name="red" rgba="1 0 0 1"/>
    <material name="cubemat" texture="cube"/>
    <mesh name="wedge" scale="1 2 .5" vertex="1 1 1  3 1 1  1 3 1  1 1 3"
          face="0 2 1  0 1 3  0 3 2  1 2 3"/>
    <mesh name="uvquad" vertex="0 0 0 1 0 0 1 1 0 0 1 0 0 0 1"
          texcoord="0 0 1 0 1 1 0 1 .5 .5" face="0 1 2  0 2 3  0 1 4"/>
    <hfield name="terrain" nrow="3" ncol="4" size="1 2 .5 .1"
            elevation="0 .1 .2 .3  .4 .5 .6 .7  .8 .9 1 0"/>
  </asset>
  <worldbody>
    <geom name="floor" type="plane" size="5 4 .1" material="red"/>
    <geom name="ground" type="hfield" hfield="terrain" pos="8 0 0"
          euler="10 20 30" material="chk"/>
    <body name="base" pos="0 0 1" euler="10 20 30">
      <freejoint/>
      <geom name="box" type="box" size=".1 .2 .3" pos=".1 .2 .3"
            euler="30 40 50" rgba="0 1 0 1"/>
      <geom name="wedge_geom" type="mesh" mesh="wedge" material="chk"/>
      <geom name="hidden_sphere" type="sphere" size=".15" group="3"
            material="chk_twin"/>
      <geom name="uv_geom" type="mesh" mesh="uvquad" material="chk_twin"
            pos="0 0 -1" euler="5 -10 15"/>
      <body name="arm" pos=".5 0 0" euler="0 90 20">
        <joint name="j1" type="hinge" axis="0 1 0"/>
        <geom name="capsule" type="capsule" size=".05 .2" pos="0 0 .2"
              euler="15 25 35"/>
        <geom name="cylinder" type="cylinder" size=".05 .1" pos=".1 0 0"
              material="cubemat"/>
        <body pos="0 0 .5" euler="70 -20 100">
          <joint name="ball" type="ball"/>
          <geom name="ellipsoid" type="ellipsoid" size=".1 .05 .2"
                rgba="0 0 1 .5"/>
          <geom name="ghost" type="sphere" size=".05" rgba="1 0 0 0"/>
          <geom name="copy_geom" type="sphere" size=".05"
                material="chk_copy"/>
        </body>
      </body>
    </body>
  </worldbody>
</mujoco>
"""

HFIELD_XML = """
<mujoco>
  <asset>
    <hfield name="h" nrow="4" ncol="5" size="1 2 .5 .1"
            elevation="0 .1 .2 .3 .4  .5 .6 .7 .8 .9
                       1 .1 .3 .2 .6  .4 .5 0 .7 .2"/>
  </asset>
  <worldbody>
    <geom name="h" type="hfield" hfield="h" pos="1 2 3" euler="20 30 40"/>
  </worldbody>
</mujoco>
"""


@pytest.fixture(scope="module")
def model() -> mujoco.MjModel:
    return mujoco.MjModel.from_xml_string(MODEL_XML)


def _random_state(model: mujoco.MjModel, seed: int) -> mujoco.MjData:
    """Forward-kinematics state with asymmetric random rotations."""
    rng = np.random.default_rng(seed)
    data = mujoco.MjData(model)
    qpos = rng.normal(size=model.nq)
    qpos[3:7] /= np.linalg.norm(qpos[3:7])  # free joint quaternion
    qpos[8:12] /= np.linalg.norm(qpos[8:12])  # ball joint quaternion
    data.qpos[:] = qpos
    mujoco.mj_forward(model, data)
    return data


def _local_pose(geom: core.Geom) -> np.ndarray:
    return np.array([*geom.pos, *geom.quat], dtype=np.float64)


def _geom_ids(model: mujoco.MjModel, scene: core.Scene) -> list[int]:
    return [
        mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, g.name)
        for g in scene.geoms
    ]


def _mesh_of(scene: core.Scene, geom: core.Geom) -> core.Mesh:
    assert geom.mesh is not None
    return scene.meshes[geom.mesh]


def _world_geom_poses(data: mujoco.MjData, scene: core.Scene) -> np.ndarray:
    body_poses = smj.poses(data)[0].astype(np.float64)
    return np.stack(
        [
            transforms.compose_poses(body_poses[g.body], _local_pose(g))
            for g in scene.geoms
        ]
    )


def test_source_info() -> None:
    assert smj.source_info() == {
        "simulator": "mujoco",
        "version": mujoco.__version__,
    }


def test_bodies(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    assert scene.n_bodies == model.nbody
    assert scene.bodies[0].parent == -1
    assert [b.parent for b in scene.bodies[1:]] == [0, 1, 2]
    assert [b.name for b in scene.bodies] == [
        "world",
        "base",
        "arm",
        "body3",  # unnamed bodies fall back to body<i>
    ]


def test_golden_world_poses(model: mujoco.MjModel) -> None:
    """Exported body poses composed with local geom poses match MuJoCo."""
    scene = smj.scene_from_model(model)
    assert len(scene.geoms) == model.ngeom
    ids = _geom_ids(model, scene)
    for seed in range(6):
        data = _random_state(model, seed)
        world = _world_geom_poses(data, scene)
        np.testing.assert_allclose(world[:, :3], data.geom_xpos[ids], atol=1e-5)
        got = transforms.quat_to_matrix(world[:, 3:])
        want = data.geom_xmat[ids].reshape(-1, 3, 3)
        np.testing.assert_allclose(got, want, atol=1e-5)


def test_golden_world_poses_are_not_symmetric(model: mujoco.MjModel) -> None:
    """Guards the golden test: a wrong quaternion order must be caught."""
    scene = smj.scene_from_model(model)
    data = _random_state(model, 0)
    ids = _geom_ids(model, scene)
    wrong = np.array(
        [
            transforms.compose_poses(
                np.concatenate(
                    [
                        data.xpos[g.body],
                        data.xquat[g.body],  # wxyz passed as xyzw
                    ]
                ),
                _local_pose(g),
            )
            for g in scene.geoms
        ]
    )
    got = transforms.quat_to_matrix(wrong[:, 3:])
    want = data.geom_xmat[ids].reshape(-1, 3, 3)
    assert not np.allclose(got, want, atol=1e-3)


def test_mesh_vertices_land_where_mujoco_puts_them(
    model: mujoco.MjModel,
) -> None:
    scene = smj.scene_from_model(model)
    data = _random_state(model, 3)
    world = _world_geom_poses(data, scene)
    n_checked = 0
    for j, geom in enumerate(scene.geoms):
        gid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, geom.name)
        if model.geom_type[gid] != mujoco.mjtGeom.mjGEOM_MESH:
            continue
        mesh = _mesh_of(scene, geom)
        ours = transforms.quat_rotate(
            world[j, None, 3:], mesh.vertices.astype(np.float64)
        )
        ours = ours + world[j, :3]

        mesh_id = model.geom_dataid[gid]
        v0 = model.mesh_vertadr[mesh_id]
        f0 = model.mesh_faceadr[mesh_id]
        verts = model.mesh_vert[v0 : v0 + model.mesh_vertnum[mesh_id]]
        faces = model.mesh_face[f0 : f0 + model.mesh_facenum[mesh_id]]
        theirs = (
            data.geom_xpos[gid] + verts @ data.geom_xmat[gid].reshape(3, 3).T
        )
        # Compare triangle corners so UV vertex splitting does not matter.
        np.testing.assert_allclose(ours[mesh.faces], theirs[faces], atol=1e-5)
        n_checked += 1
    assert n_checked == 2


def test_mesh_is_off_centre_and_scaled(model: mujoco.MjModel) -> None:
    """The fixture really exercises MuJoCo's recentering and scaling."""
    wedge = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_MESH, "wedge")
    assert np.linalg.norm(model.mesh_pos[wedge]) > 1.0
    np.testing.assert_allclose(model.mesh_scale[wedge], [1, 2, 0.5])
    geom = smj.scene_from_model(model).geoms[3]
    assert geom.name == "wedge_geom"
    assert geom.scale == (1.0, 1.0, 1.0)
    assert np.linalg.norm(geom.pos) > 1.0  # compensates the recentering


def test_hfield_matches_mujoco_raycasts() -> None:
    model = mujoco.MjModel.from_xml_string(HFIELD_XML)
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    scene = smj.scene_from_model(model)
    (geom,) = scene.geoms
    assert geom.kind == "mesh" and geom.mesh == 0
    mesh = scene.meshes[0]
    assert mesh.vertices.shape == (20, 3)
    assert mesh.faces.shape == (24, 3)

    rot = data.geom_xmat[0].reshape(3, 3)
    interior = np.array([r * 5 + c for r in (1, 2) for c in (1, 2, 3)])
    down = -rot[:, 2]
    for v in mesh.vertices[interior].astype(np.float64):
        origin = data.geom_xpos[0] + rot @ (v + np.array([0, 0, 10]))
        geomid = np.zeros(1, dtype=np.int32)
        dist = mujoco.mj_ray(model, data, origin, down, None, 1, -1, geomid)
        assert geomid[0] == 0
        hit = origin + dist * down
        expected = data.geom_xpos[0] + rot @ v
        np.testing.assert_allclose(hit, expected, atol=1e-5)
    # Triangles face +z in the geom frame.
    tri = mesh.vertices[mesh.faces].astype(np.float64)
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    assert np.all(normals[:, 2] > 0)


def test_primitive_kinds_and_sizes(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    by_name = {g.name: g for g in scene.geoms}
    assert by_name["floor"].kind == "plane"
    assert by_name["floor"].size == (5.0, 4.0, 0.1)
    assert by_name["box"].kind == "box"
    assert by_name["box"].size == (0.1, 0.2, 0.3)
    assert by_name["hidden_sphere"].kind == "sphere"
    assert by_name["hidden_sphere"].size == (0.15, 0.0, 0.0)
    assert by_name["capsule"].kind == "capsule"
    assert by_name["capsule"].size == (0.05, 0.2, 0.0)
    assert by_name["cylinder"].kind == "cylinder"
    assert by_name["cylinder"].size == (0.05, 0.1, 0.0)
    assert by_name["ellipsoid"].kind == "ellipsoid"
    assert by_name["ellipsoid"].size == (0.1, 0.05, 0.2)
    assert by_name["wedge_geom"].kind == "mesh"
    assert by_name["wedge_geom"].size == (0.0, 0.0, 0.0)
    assert by_name["ground"].kind == "mesh"
    assert by_name["box"].body == 1
    assert by_name["capsule"].body == 2


def test_roles_and_collision_flag(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    roles = {g.name: g.role for g in scene.geoms}
    assert roles["hidden_sphere"] == "collision"  # group 3
    assert roles["ghost"] == "collision"  # alpha 0
    assert roles["box"] == "visual"
    assert roles["floor"] == "visual"

    visual = smj.scene_from_model(model, collision=False)
    assert {g.name for g in visual.geoms} == {
        n for n, r in roles.items() if r == "visual"
    }
    assert all(g.role == "visual" for g in visual.geoms)
    assert len(visual.geoms) < len(scene.geoms)


def test_unused_assets_are_not_exported(model: mujoco.MjModel) -> None:
    visual = smj.scene_from_model(model, collision=False)
    full = smj.scene_from_model(model)
    assert len(visual.materials) < len(full.materials)
    assert visual.meshes and len(visual.textures) == 1


def test_material_dedup_and_fields(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    by_name = {g.name: g for g in scene.geoms}
    assert len(set(scene.materials)) == len(scene.materials)
    assert len(scene.materials) < len(scene.geoms)
    # Same appearance through two different MJCF materials.
    assert by_name["ground"].material == by_name["hidden_sphere"].material
    assert by_name["ground"].material == by_name["uv_geom"].material
    chk = scene.materials[by_name["ground"].material]
    assert chk.rgba == pytest.approx((1.0, 0.9, 0.8, 1.0))
    assert chk.metallic == pytest.approx(0.25)
    assert chk.roughness == pytest.approx(0.75)
    assert chk.texrepeat == (2.0, 3.0)
    assert chk.texture == 0
    # Unset metallic/roughness fall back to the core defaults.
    floor = scene.materials[by_name["floor"].material]
    assert (floor.metallic, floor.roughness) == (0.0, 1.0)
    assert floor.rgba == (1.0, 0.0, 0.0, 1.0)
    assert scene.materials[by_name["ellipsoid"].material].rgba == (
        0.0,
        0.0,
        1.0,
        pytest.approx(0.5),
    )


def test_colors_match_mujoco_renderer(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    data = _random_state(model, 1)
    mjv = mujoco.MjvScene(model, maxgeom=100)
    option = mujoco.MjvOption()
    option.geomgroup[:] = 1
    mujoco.mjv_updateScene(
        model,
        data,
        option,
        None,
        mujoco.MjvCamera(),
        mujoco.mjtCatBit.mjCAT_ALL,
        mjv,
    )
    ids = _geom_ids(model, scene)
    expected = {
        int(g.objid): np.array(g.rgba)
        for g in mjv.geoms[: mjv.ngeom]
        if g.objtype == mujoco.mjtObj.mjOBJ_GEOM
    }
    for gid, geom in zip(ids, scene.geoms, strict=True):
        got = scene.materials[geom.material].rgba
        if gid not in expected:  # MuJoCo does not draw alpha-0 geoms
            assert got[3] == 0.0 and geom.name == "ghost"
            continue
        np.testing.assert_allclose(got, expected[gid], atol=1e-6)


def test_texture_dedup_and_mesh_uv_handling(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    # "checker" and "checker_copy" have identical pixels; cube is dropped.
    assert len(scene.textures) == 1
    by_name = {g.name: g for g in scene.geoms}
    # A mesh without texcoords keeps no texture; with texcoords it has UVs.
    assert scene.materials[by_name["wedge_geom"].material].texture is None
    assert scene.materials[by_name["uv_geom"].material].texture == 0
    assert _mesh_of(scene, by_name["wedge_geom"]).uvs is None
    uv_mesh = _mesh_of(scene, by_name["uv_geom"])
    assert uv_mesh.uvs is not None
    assert uv_mesh.uvs.shape == (5, 2)
    assert uv_mesh.faces.dtype == np.uint32
    assert uv_mesh.vertices.dtype == np.float32
    # Height field of a textured material gets grid UVs.
    ground = _mesh_of(scene, by_name["ground"])
    assert ground.uvs is not None and ground.uvs.shape == (12, 2)
    # Cube map textures are dropped in favour of the flat color.
    assert scene.materials[by_name["cylinder"].material].texture is None


def test_mesh_dedup() -> None:
    xml = """
    <mujoco><asset>
      <mesh name="m" vertex="0 0 0 1 0 0 0 1 0 0 0 1"
            face="0 2 1 0 1 3 0 3 2 1 2 3"/>
    </asset><worldbody>
      <geom name="a" type="mesh" mesh="m"/>
      <geom name="b" type="mesh" mesh="m" pos="1 0 0"/>
    </worldbody></mujoco>
    """
    scene = smj.scene_from_model(mujoco.MjModel.from_xml_string(xml))
    assert len(scene.meshes) == 1
    assert scene.geoms[0].mesh == scene.geoms[1].mesh == 0


def _decode_png(data: bytes) -> tuple[int, int, int, int, np.ndarray]:
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, chunks = 8, []
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        tag = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        (crc,) = struct.unpack(">I", data[pos + 8 + length : pos + 12 + length])
        assert crc == zlib.crc32(tag + payload)
        chunks.append((tag, payload))
        pos += 12 + length
    tags = [t for t, _ in chunks]
    assert tags[0] == b"IHDR"
    assert tags[-1] == b"IEND"
    width, height, depth, color, comp, filt, interlace = struct.unpack(
        ">IIBBBBB", chunks[0][1]
    )
    assert (depth, comp, filt, interlace) == (8, 0, 0, 0)
    raw = zlib.decompress(b"".join(p for t, p in chunks if t == b"IDAT"))
    channels = {2: 3, 6: 4}[color]
    rows = np.frombuffer(raw, dtype=np.uint8).reshape(
        height, 1 + width * channels
    )
    assert np.all(rows[:, 0] == 0)  # filter type "none"
    pixels = rows[:, 1:].reshape(height, width, channels)
    return width, height, depth, color, pixels


def test_texture_png_matches_mujoco_pixels(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    (texture,) = scene.textures
    assert texture.media_type == "image/png"
    width, height, depth, color, pixels = _decode_png(texture.data)
    assert (width, height, depth, color) == (16, 8, 8, 2)
    assert (texture.width, texture.height) == (16, 8)
    tex = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_TEXTURE, "checker")
    source = model.tex_data[
        model.tex_adr[tex] : model.tex_adr[tex] + 16 * 8 * 3
    ].reshape(8, 16, 3)
    # PNG rows run top to bottom; MuJoCo stores them bottom to top.
    np.testing.assert_array_equal(pixels, source[::-1])
    assert len(set(map(tuple, pixels.reshape(-1, 3)))) == 2


@pytest.mark.parametrize("channels", [3, 4])
def test_encode_png_round_trip(channels: int) -> None:
    rng = np.random.default_rng(0)
    pixels = rng.integers(0, 256, size=(5, 7, channels), dtype=np.uint8)
    width, height, _, color, decoded = _decode_png(smj._encode_png(pixels))
    assert (width, height) == (7, 5)
    assert color == {3: 2, 4: 6}[channels]
    np.testing.assert_array_equal(decoded, pixels)


def test_grayscale_texture_becomes_rgb() -> None:
    xml = """
    <mujoco><asset>
      <texture name="t" type="2d" builtin="checker" rgb1="1 1 1" rgb2="0 0 0"
               width="4" height="4"/>
      <material name="m" texture="t"/>
    </asset><worldbody><geom type="sphere" size=".1" material="m"/>
    </worldbody></mujoco>
    """
    scene = smj.scene_from_model(mujoco.MjModel.from_xml_string(xml))
    assert len(scene.textures) == 1


def test_poses_shape_and_order() -> None:
    xml = """
    <mujoco><compiler angle="degree"/><worldbody>
      <body pos="1 2 3" euler="90 0 0"><geom type="sphere" size=".1"/></body>
    </worldbody></mujoco>
    """
    model = mujoco.MjModel.from_xml_string(xml)
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    out = smj.poses(data)
    assert out.shape == (1, 2, 7)
    assert out.dtype == np.float32 and out.flags.c_contiguous
    np.testing.assert_allclose(out[0, 0], [0, 0, 0, 0, 0, 0, 1], atol=1e-7)
    np.testing.assert_allclose(out[0, 1, :3], [1, 2, 3])
    s = np.sqrt(0.5)
    np.testing.assert_allclose(out[0, 1, 3:], [s, 0, 0, s], atol=1e-6)
    # The result is a copy, not a view of MuJoCo's memory.
    data.xpos[1, 0] = 99.0
    assert out[0, 1, 0] == 1.0


def test_poses_batched_matches_per_env(model: mujoco.MjModel) -> None:
    datas = [_random_state(model, seed) for seed in range(3)]
    xpos = np.stack([d.xpos for d in datas])
    xquat = np.stack([d.xquat for d in datas])
    batched = smj.poses(xpos, xquat)
    assert batched.shape == (3, model.nbody, 7)
    for e, data in enumerate(datas):
        np.testing.assert_array_equal(batched[e], smj.poses(data)[0])
    # Extra leading axes flatten into E; float32 input works too.
    grid = smj.poses(
        xpos.reshape(3, 1, -1, 3).astype(np.float32),
        xquat.reshape(3, 1, -1, 4).astype(np.float32),
    )
    assert grid.shape == batched.shape
    np.testing.assert_allclose(grid, batched, atol=1e-6)


def test_poses_accepts_device_array_like_objects(
    model: mujoco.MjModel,
) -> None:
    class Fake:
        """Stands in for a Warp array (has .numpy())."""

        def __init__(self, array: np.ndarray) -> None:
            self._array = array

        def numpy(self) -> np.ndarray:
            return self._array

    data = _random_state(model, 0)
    want = smj.poses(data)
    got = smj.poses(Fake(data.xpos), Fake(data.xquat))
    np.testing.assert_array_equal(got, want)
    namespace = types.SimpleNamespace(xpos=data.xpos, xquat=data.xquat)
    np.testing.assert_array_equal(smj.poses(namespace), want)


def test_poses_out_buffer_and_errors(model: mujoco.MjModel) -> None:
    data = _random_state(model, 0)
    buf = np.empty((1, model.nbody, 7), dtype=np.float32)
    assert smj.poses(data, out=buf) is buf
    np.testing.assert_array_equal(buf, smj.poses(data))
    with pytest.raises(ValueError, match="out must be"):
        smj.poses(data, out=np.empty((2, model.nbody, 7), dtype=np.float32))
    with pytest.raises(ValueError, match="xquat must have shape"):
        smj.poses(data.xpos, data.xquat[:-1])
    with pytest.raises(ValueError, match="xpos must have shape"):
        smj.poses(data.xpos[:, :2], data.xquat)
    with pytest.raises(TypeError):
        smj.poses(data.xpos)


def test_scene_is_usable_with_core_validation(model: mujoco.MjModel) -> None:
    scene = smj.scene_from_model(model)
    # Scene.__post_init__ already validated cross references; sanity-check
    # a few invariants the io layer relies on.
    assert scene.materials
    assert all(m.vertices.dtype == np.float32 for m in scene.meshes)
    assert all(g.scale == core.UNIT_SCALE for g in scene.geoms)


def test_unsupported_geoms_warn_once(
    model: mujoco.MjModel, caplog: pytest.LogCaptureFixture
) -> None:
    sdf = np.array([int(mujoco.mjtGeom.mjGEOM_SDF)] * 3)
    with caplog.at_level(logging.WARNING, logger="simscope.mujoco"):
        smj._warn_skipped(model, sdf)
        smj._warn_skipped(model, sdf[:0])
    assert len(caplog.records) == 1
    assert "3 SDF" in caplog.records[0].getMessage()


def test_import_simscope_does_not_import_mujoco() -> None:
    code = (
        "import sys, simscope, simscope.core, simscope.transforms;"
        "assert 'mujoco' not in sys.modules, 'mujoco imported';"
        "import simscope.mujoco;"
        "assert 'mujoco' in sys.modules"
    )
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_model_without_geoms_or_visual_geoms() -> None:
    empty = smj.scene_from_model(
        mujoco.MjModel.from_xml_string(
            "<mujoco><worldbody><body/></worldbody></mujoco>"
        )
    )
    assert empty.n_bodies == 2 and not empty.geoms
    assert empty.materials == (core.Material(),)

    only_collision = mujoco.MjModel.from_xml_string(
        '<mujoco><worldbody><geom type="sphere" size=".1" group="4"/>'
        "</worldbody></mujoco>"
    )
    assert len(smj.scene_from_model(only_collision).geoms) == 1
    assert not smj.scene_from_model(only_collision, collision=False).geoms


BOX_XML = """
<mujoco>
  <option timestep="0.002"/>
  <worldbody>
    <geom name="floor" type="plane" size="5 5 .1"/>
    <body name="box" pos="0 0 .3">
      <freejoint/>
      <geom name="box_geom" type="box" size=".1 .1 .1" mass="2"/>
    </body>
  </worldbody>
</mujoco>
"""


def rest_state(xml: str = BOX_XML, steps: int = 1500):
    model = mujoco.MjModel.from_xml_string(xml)
    data = mujoco.MjData(model)
    for _ in range(steps):
        mujoco.mj_step(model, data)
    return model, data


def test_contacts_resting_box_carries_its_weight() -> None:
    model, data = rest_state()
    frame = smj.contacts(model, data, max_contacts=8)
    assert frame.shape == (1, 8, 6) and frame.dtype == np.float32
    total = frame[0, :, 3:].sum(axis=0)
    weight = 2.0 * 9.81
    np.testing.assert_allclose(total, [0, 0, weight], atol=1e-2 * weight)
    used = np.abs(frame[0]).sum(axis=1) > 0
    assert used.sum() == data.ncon == 4
    assert np.all(frame[0, ~used] == 0)  # unused rows are zero
    # Contact points are the box's bottom corners, on the floor.
    np.testing.assert_allclose(frame[0, used, 2], 0.0, atol=2e-3)
    assert np.all(np.abs(frame[0, used, :2]) > 0.09)


def test_contacts_force_is_on_the_robot_whichever_geom_order() -> None:
    # Put the robot geom first: the floor (world body) is then geom 2.
    xml = BOX_XML.replace(
        '<geom name="floor" type="plane" size="5 5 .1"/>', ""
    ).replace(
        "</worldbody>",
        '<geom name="floor" type="plane" size="5 5 .1"/></worldbody>',
    )
    model, data = rest_state(xml)
    frame = smj.contacts(model, data, max_contacts=8)
    np.testing.assert_allclose(
        frame[0, :, 3:].sum(axis=0), [0, 0, 2 * 9.81], atol=0.2
    )


def test_contacts_keeps_the_strongest_when_full() -> None:
    model, data = rest_state()
    frame = smj.contacts(model, data, max_contacts=2)
    assert (np.abs(frame[0]).sum(axis=1) > 0).all()
    full = smj.contacts(model, data, max_contacts=8)
    strongest = np.sort(np.linalg.norm(full[0, :, 3:], axis=1))[-2:]
    np.testing.assert_allclose(
        np.sort(np.linalg.norm(frame[0, :, 3:], axis=1)), strongest, rtol=1e-5
    )


def test_contacts_out_buffer_and_errors() -> None:
    model, data = rest_state()
    out = np.full((3, 5, 6), 7.0, np.float32)
    frame = smj.contacts(model, data, out[1], max_contacts=5)
    assert frame.shape == (1, 5, 6) and np.shares_memory(frame, out)
    assert np.all(out[0] == 7.0) and np.all(out[2] == 7.0)  # only out[1]
    assert np.linalg.norm(out[1, :, 3:].sum(axis=0)) > 10  # was zeroed, filled
    with pytest.raises(ValueError, match="max_contacts"):
        smj.contacts(model, data)
    with pytest.raises(ValueError, match="out must be"):
        smj.contacts(
            model,
            data,
            np.zeros((4, 6), np.float64),  # ty: ignore[invalid-argument-type]
        )
    with pytest.raises(ValueError, match="rows"):
        smj.contacts(model, data, out[1], max_contacts=4)


def test_contacts_airborne_is_all_zero() -> None:
    model = mujoco.MjModel.from_xml_string(BOX_XML)
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    assert data.ncon == 0
    assert not smj.contacts(model, data, max_contacts=4).any()


def test_contacts_scale_is_inverse_weight() -> None:
    model = mujoco.MjModel.from_xml_string(BOX_XML)
    assert smj.contacts_scale(model) == pytest.approx(1 / (2.0 * 9.81))


def test_contacts_stream_round_trip(tmp_path) -> None:
    from simscope import library

    model, data = rest_state()
    lib = library.Library(tmp_path / "lib")
    with lib.record("rest", scene=smj.scene_from_model(model), dt=0.002) as rec:
        smj.add_contacts_stream(rec, model, max_contacts=8)
        for _ in range(5):
            mujoco.mj_step(model, data)
            rec.log(
                smj.poses(data),
                contacts=smj.contacts(model, data, max_contacts=8),
            )
    with lib.open("rest") as run:
        info = run.manifest.streams["contacts"]
        assert info.kind == "arrows" and info.item_shape == (8, 6)
        assert info.scale == pytest.approx(1 / (2.0 * 9.81))
        assert info.units == "N"
        got = run.stream("contacts").read(0, 5)
    np.testing.assert_allclose(
        got[-1, 0, :, 3:].sum(axis=0), [0, 0, 2 * 9.81], atol=0.2
    )
