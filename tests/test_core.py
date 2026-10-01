import numpy as np
import pytest

from simscope import core


def _box_scene(**overrides: object) -> core.Scene:
    fields: dict[str, object] = {
        "bodies": (core.Body("world"), core.Body("box", parent=0)),
        "geoms": (core.Geom(body=1, kind="box", size=(0.1, 0.1, 0.1)),),
    }
    fields.update(overrides)
    return core.Scene(**fields)  # ty: ignore[invalid-argument-type]


def test_scene_counts_bodies() -> None:
    assert _box_scene().n_bodies == 2


def test_scene_rejects_bad_parent() -> None:
    with pytest.raises(ValueError, match="invalid parent"):
        _box_scene(bodies=(core.Body("a", parent=5),))


def test_scene_rejects_mesh_geom_without_mesh() -> None:
    with pytest.raises(ValueError, match="invalid mesh"):
        _box_scene(geoms=(core.Geom(body=0, kind="mesh"),))


def test_mesh_validates_dtypes() -> None:
    with pytest.raises(ValueError, match="dtype"):
        core.Mesh(
            vertices=np.zeros((3, 3), np.float64),  # ty: ignore[invalid-argument-type]
            faces=np.zeros((1, 3), np.uint32),
        )


def test_mesh_accepts_valid_arrays() -> None:
    mesh = core.Mesh(
        vertices=np.zeros((3, 3), np.float32),
        faces=np.array([[0, 1, 2]], np.uint32),
        uvs=np.zeros((3, 2), np.float32),
    )
    assert mesh.faces.shape == (1, 3)


def test_body_mass_defaults_to_unknown_and_is_checked():
    assert core.Body("torso").mass == 0.0
    assert core.Body("torso", 0, mass=12.5).mass == 12.5
    for bad in (-1.0, float("nan"), float("inf")):
        with pytest.raises(ValueError, match="mass"):
            core.Body("torso", 0, mass=bad)
