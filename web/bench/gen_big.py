"""Synthetic many-env run for the player benchmarks.

E envs x T frames x 20 bodies, about 40 capsule, sphere, box and cylinder
geoms per env, envs on a square grid 2.5 m apart, each circling at its own
speed. With ``contacts`` the run also has a zero-padded ``contacts`` arrows
stream.

    uv run python web/bench/gen_big.py LIB NAME E T [contacts]
    uv run python web/bench/gen_big.py /tmp/lib big_4096 4096 1000 contacts
"""

import argparse
import math
import time

import numpy as np
import numpy.typing as npt

from simscope import core, library

N_BODIES = 20
DT = 0.02
RADIUS = 0.8  # m, of each env's circle
SPACING = 2.5  # m between env origins
WINDOW = 100  # frames logged at a time


def make_scene() -> core.Scene:
    """Builds the robot: a torso box and 18 limb bodies, plus a floor."""
    names = ["world", "torso"] + [
        f"{leg}_{seg}"
        for leg in ("fl", "fr", "hl", "hr")
        for seg in ("hip", "thigh", "calf", "foot")
    ]
    names += [f"extra{i}" for i in range(len(names), N_BODIES)]
    bodies = tuple(
        core.Body(n, -1 if i == 0 else (1 if i > 1 else 0))
        for i, n in enumerate(names[:N_BODIES])
    )
    geoms = [
        core.Geom(body=0, kind="plane", size=(0.0, 0.0, 1.0), name="floor"),
        core.Geom(body=1, kind="box", size=(0.3, 0.15, 0.08)),
    ]
    for b in range(2, N_BODIES):
        geoms.append(
            core.Geom(
                body=b,
                kind="capsule",
                size=(0.03, 0.09, 0.0),
                pos=(0, 0, -0.09),
            )
        )
        geoms.append(core.Geom(body=b, kind="sphere", size=(0.04, 0.0, 0.0)))
    for k in range(2):
        geoms.append(
            core.Geom(
                body=1,
                kind="cylinder",
                size=(0.05, 0.05, 0.0),
                pos=(0.2 * (k - 0.5), 0.0, 0.1),
            )
        )
    material = core.Material(rgba=(0.55, 0.62, 0.72, 1.0))
    return core.Scene(bodies=bodies, geoms=tuple(geoms), materials=(material,))


def make_poses(
    t0: int,
    n: int,
    omega: npt.NDArray[np.float32],
    phase: npt.NDArray[np.float32],
) -> npt.NDArray[np.float32]:
    """Poses for frames ``t0 .. t0 + n`` of every env, ``[n, E, B, 7]``.

    Args:
        t0: First frame.
        n: Number of frames.
        omega: Angular speed of each env's circle, ``[E]``.
        phase: Starting angle of each env, ``[E]``.

    Returns:
        Poses in env coordinates (the recorder adds the env origins).
    """
    n_envs = omega.shape[0]
    t = (np.arange(t0, t0 + n, dtype=np.float32) * DT)[:, None]
    ang = omega[None] * t + phase[None]
    poses = np.zeros((n, n_envs, N_BODIES, 7), np.float32)
    poses[..., 6] = 1.0
    cx, cy = RADIUS * np.cos(ang), RADIUS * np.sin(ang)
    yaw = ang + np.pi / 2
    qz, qw = np.sin(yaw / 2), np.cos(yaw / 2)
    poses[:, :, 1, 0] = cx
    poses[:, :, 1, 1] = cy
    poses[:, :, 1, 2] = 0.30 + 0.02 * np.sin(6 * t + phase[None])
    poses[:, :, 1, 5] = qz
    poses[:, :, 1, 6] = qw
    for b in range(2, N_BODIES):
        leg = (b - 2) // 4
        off_x = 0.22 if leg in (0, 1) else -0.22
        off_y = 0.12 if leg % 2 == 0 else -0.12
        swing = 0.4 * np.sin(6 * t + phase[None] + leg * 1.5 + (b - 2) % 4)
        poses[:, :, b, 0] = cx + off_x * np.cos(yaw) - off_y * np.sin(yaw)
        poses[:, :, b, 1] = cy + off_x * np.sin(yaw) + off_y * np.cos(yaw)
        poses[:, :, b, 2] = 0.3 - 0.06 * ((b - 2) % 4)
        # Yaw times a pitch about the body's y axis (unit quaternions).
        sy, cp = np.sin(swing / 2), np.cos(swing / 2)
        poses[:, :, b, 3] = -qz * sy
        poses[:, :, b, 4] = qw * sy
        poses[:, :, b, 5] = qz * cp
        poses[:, :, b, 6] = qw * cp
    return poses


def main() -> None:
    """Records the run."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lib", help="library directory (created)")
    parser.add_argument("name", help="run name")
    parser.add_argument("envs", type=int)
    parser.add_argument("frames", type=int)
    parser.add_argument("contacts", nargs="?", help="add a contacts stream")
    args = parser.parse_args()

    n_envs = args.envs
    side = math.ceil(math.sqrt(n_envs))
    idx = np.arange(n_envs)
    origins = np.stack(
        [(idx % side) * SPACING, (idx // side) * SPACING, np.zeros(n_envs)], 1
    ).astype(np.float32)
    rng = np.random.default_rng(1)
    omega = rng.uniform(0.3, 0.9, n_envs).astype(np.float32)
    phase = rng.uniform(0, 2 * np.pi, n_envs).astype(np.float32)

    lib = library.Library(args.lib)
    start = time.time()
    with lib.record(
        args.name,
        scene=make_scene(),
        dt=DT,
        n_envs=n_envs,
        env_origins=origins,
        overwrite=True,
    ) as rec:
        if args.contacts:
            rec.add_stream("contacts", "arrows", (4, 6), units="N")
        for t0 in range(0, args.frames, WINDOW):
            n = min(WINDOW, args.frames - t0)
            extra = {}
            if args.contacts:
                c = np.zeros((n, n_envs, 4, 6), np.float32)
                c[..., 5] = 50.0
                extra["contacts"] = c
            rec.log_frames(make_poses(t0, n, omega, phase), **extra)
            print(f"{t0 + n}/{args.frames} frames, {time.time() - start:.1f}s")
    lib.close()


if __name__ == "__main__":
    main()
