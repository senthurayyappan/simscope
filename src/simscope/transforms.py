"""Vectorized quaternion and pose math.

Quaternions are xyzw. Poses are ``[..., 7]`` arrays of
position xyz followed by quaternion xyzw. Every function broadcasts over
leading axes and never loops in Python.
"""

import numpy as np
import numpy.typing as npt

FloatArray = npt.NDArray[np.floating]


def wxyz_to_xyzw(quat: npt.ArrayLike) -> npt.NDArray[np.float32]:
    """Reorders quaternions from wxyz to xyzw.

    Args:
        quat: Quaternions with shape ``[..., 4]`` in wxyz order.

    Returns:
        A new float32 array with shape ``[..., 4]`` in xyzw order.
    """
    q = np.asarray(quat, dtype=np.float32)
    return np.ascontiguousarray(q[..., [1, 2, 3, 0]])


def xyzw_to_wxyz(quat: npt.ArrayLike) -> npt.NDArray[np.float32]:
    """Reorders quaternions from xyzw to wxyz.

    Args:
        quat: Quaternions with shape ``[..., 4]`` in xyzw order.

    Returns:
        A new float32 array with shape ``[..., 4]`` in wxyz order.
    """
    q = np.asarray(quat, dtype=np.float32)
    return np.ascontiguousarray(q[..., [3, 0, 1, 2]])


def quat_mul(a: FloatArray, b: FloatArray) -> FloatArray:
    """Multiplies quaternions ``a * b`` (apply ``b``, then ``a``).

    Args:
        a: Quaternions with shape ``[..., 4]``, xyzw.
        b: Quaternions with shape ``[..., 4]``, xyzw. Broadcasts with ``a``.

    Returns:
        The products with the broadcast shape, xyzw.
    """
    ax, ay, az, aw = np.moveaxis(a, -1, 0)
    bx, by, bz, bw = np.moveaxis(b, -1, 0)
    return np.stack(
        (
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        ),
        axis=-1,
    )


def quat_rotate(quat: FloatArray, vec: FloatArray) -> FloatArray:
    """Rotates vectors by unit quaternions.

    Args:
        quat: Unit quaternions with shape ``[..., 4]``, xyzw.
        vec: Vectors with shape ``[..., 3]``. Broadcasts with ``quat``.

    Returns:
        The rotated vectors with the broadcast shape.
    """
    u = quat[..., :3]
    w = quat[..., 3:4]
    t = 2.0 * np.cross(u, vec)
    return vec + w * t + np.cross(u, t)


def compose_poses(parent: FloatArray, child: FloatArray) -> FloatArray:
    """Composes poses: expresses ``child`` (given in ``parent``) in world.

    Args:
        parent: Poses with shape ``[..., 7]``.
        child: Poses relative to ``parent`` with shape ``[..., 7]``.
            Broadcasts with ``parent``.

    Returns:
        World poses with the broadcast shape ``[..., 7]``.
    """
    pq = parent[..., 3:]
    pos = parent[..., :3] + quat_rotate(pq, child[..., :3])
    return np.concatenate((pos, quat_mul(pq, child[..., 3:])), axis=-1)


def quat_to_matrix(quat: FloatArray) -> FloatArray:
    """Converts unit quaternions to rotation matrices.

    Args:
        quat: Unit quaternions with shape ``[..., 4]``, xyzw.

    Returns:
        Rotation matrices with shape ``[..., 3, 3]``.
    """
    x, y, z, w = np.moveaxis(quat, -1, 0)
    return np.stack(
        (
            1 - 2 * (y * y + z * z),
            2 * (x * y - z * w),
            2 * (x * z + y * w),
            2 * (x * y + z * w),
            1 - 2 * (x * x + z * z),
            2 * (y * z - x * w),
            2 * (x * z - y * w),
            2 * (y * z + x * w),
            1 - 2 * (x * x + y * y),
        ),
        axis=-1,
    ).reshape((*quat.shape[:-1], 3, 3))


def enforce_sign_continuity(
    quat: FloatArray, previous: FloatArray | None = None
) -> FloatArray:
    """Flips quaternion signs so consecutive frames stay in one hemisphere.

    ``q`` and ``-q`` are the same rotation. Keeping ``dot(q[t], q[t-1]) >= 0``
    makes time deltas small, which the block codecs rely on.

    Args:
        quat: Quaternions with shape ``[T, ..., 4]``, time first.
        previous: The quaternion frame just before ``quat[0]``, with shape
            ``[..., 4]``, or ``None`` to leave frame 0 unchanged.

    Returns:
        A new array with the same shape, with signs flipped where needed.
    """
    q = np.array(quat, copy=True)
    if q.shape[0] == 0:
        return q
    if previous is not None:
        q[0] *= np.where(np.sum(q[0] * previous, axis=-1) < 0, -1, 1)[..., None]
    if q.shape[0] > 1:
        flips = np.sum(q[1:] * q[:-1], axis=-1) < 0
        # Each flip toggles the sign of every later frame.
        parity = np.cumsum(flips, axis=0) % 2
        q[1:] *= np.where(parity == 1, -1, 1)[..., None]
    return q
