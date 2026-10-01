import numpy as np

from simscope import transforms


def _random_quats(rng: np.random.Generator, n: int) -> np.ndarray:
    q = rng.normal(size=(n, 4))
    return q / np.linalg.norm(q, axis=-1, keepdims=True)


def test_order_round_trip() -> None:
    q = np.array([[0.1, 0.2, 0.3, 0.9]], np.float32)
    back = transforms.wxyz_to_xyzw(transforms.xyzw_to_wxyz(q))
    np.testing.assert_array_equal(back, q)


def test_rotate_matches_matrix() -> None:
    rng = np.random.default_rng(0)
    q = _random_quats(rng, 64)
    v = rng.normal(size=(64, 3))
    expected = np.einsum("nij,nj->ni", transforms.quat_to_matrix(q), v)
    np.testing.assert_allclose(
        transforms.quat_rotate(q, v), expected, atol=1e-12
    )


def test_mul_composes_rotations() -> None:
    rng = np.random.default_rng(1)
    a, b = _random_quats(rng, 32), _random_quats(rng, 32)
    v = rng.normal(size=(32, 3))
    np.testing.assert_allclose(
        transforms.quat_rotate(transforms.quat_mul(a, b), v),
        transforms.quat_rotate(a, transforms.quat_rotate(b, v)),
        atol=1e-12,
    )


def test_compose_poses_quarter_turn() -> None:
    s = np.sqrt(0.5)
    parent = np.array([1.0, 0.0, 0.0, 0.0, 0.0, s, s])  # +90 deg about z
    child = np.array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0])
    world = transforms.compose_poses(parent, child)
    np.testing.assert_allclose(world[:3], [1.0, 1.0, 0.0], atol=1e-12)
    np.testing.assert_allclose(world[3:], [0.0, 0.0, s, s], atol=1e-12)


def test_sign_continuity() -> None:
    rng = np.random.default_rng(2)
    base = _random_quats(rng, 1)[0]
    signs = np.array([1, -1, -1, 1, -1])[:, None]
    q = base[None] * signs
    fixed = transforms.enforce_sign_continuity(q, previous=-base)
    np.testing.assert_allclose(fixed, np.repeat(-base[None], 5, axis=0))
