"""Benchmarks for ``simscope.highlights``.

Run ``uv run python benchmarks/bench_highlights.py`` (add ``--quick`` for a
small run). Budgets (decision D12):

* a single 400-frame run is scored in at most 20 ms;
* 1,000 frames of 4,096 envs with 20 bodies and a contacts stream are
  scored in at most 3 s.

Every env walks (a bobbing root with stride-like contact forces) and a
quarter of them make one ballistic hop, whose touchdown is an impact of the
centre of mass and of the contact force, so both kinds have peaks to find.
Only the contact and acceleration signals are read (the acceleration decodes
the position of every body). The large run is written to a
temporary library first (not timed); the timing covers ``detect`` on a
freshly opened rollout, which includes decoding the streams it reads.
"""

import argparse
import tempfile
import time
from collections.abc import Callable

import numpy as np

from simscope import core, highlights, library

DT = 0.02
TARGET_SINGLE_MS = 20.0
TARGET_LARGE_S = 3.0
N_BODIES = 20
N_CONTACTS = 4
STAND = 0.4
FLIGHT_S = 0.6
HOPPERS = 0.25
GRAVITY = 9.81


def make_scene(n_bodies: int) -> core.Scene:
    """Builds a scene of ``n_bodies`` bodies, the second one a torso."""
    names = ["world", "torso"] + [f"link{i}" for i in range(n_bodies - 2)]
    bodies = tuple(  # masses, as the MuJoCo adapter records them
        core.Body(n, -1 if i == 0 else 0, mass=0.0 if i == 0 else 1.0 + i / 10)
        for i, n in enumerate(names)
    )
    return core.Scene(bodies=bodies)


class Behaviour:
    """What each env does: its stride, and when it hops, if it does.

    Attributes:
        phase: Stride phase of each env, radians.
        hop_at: Take-off time of each env in seconds (``inf``: never).
    """

    def __init__(self, envs: int, seconds: float, *, first: bool) -> None:
        """Draws the behaviour of ``envs`` envs.

        Args:
            envs: Number of envs.
            seconds: Length of the run.
            first: Make env 0 hop, so a single-env run has an impact.
        """
        rng = np.random.default_rng(0)
        self.phase = rng.uniform(0, 2 * np.pi, envs)
        hops = rng.uniform(1.0, seconds - 2.0, envs)
        self.hop_at = np.where(rng.random(envs) < HOPPERS, hops, np.inf)
        if first:
            self.hop_at[0] = seconds / 4


def synth_chunk(
    rng: np.random.Generator,
    behaviour: Behaviour,
    t0: int,
    n: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Builds poses and contacts for frames ``t0 .. t0 + n``."""
    envs = len(behaviour.phase)
    t = ((t0 + np.arange(n)) * DT)[:, None]
    phase = behaviour.phase[None, :]
    flight = t - behaviour.hop_at[None, :]
    flying = (flight >= 0) & (flight < FLIGHT_S)
    arc = np.where(flying, 0.5 * GRAVITY * flight * (FLIGHT_S - flight), 0.0)
    poses = np.zeros((n, envs, N_BODIES, 7), np.float32)
    poses[..., 6] = 1.0
    poses[:, :, 1, 0] = 0.8 * t + 0.02 * np.sin(6 * t + phase)
    poses[:, :, 1, 2] = STAND + 0.03 * np.sin(8 * t + phase) + arc
    freq = rng.uniform(4, 10, (1, envs, N_BODIES - 2, 1))
    joint_phase = rng.uniform(0, 6.28, (1, envs, N_BODIES - 2, 3))
    poses[:, :, 2:, :3] = 0.2 * np.sin(
        t[..., None, None] * freq + joint_phase
    )  # smooth limb motion, as a real gait is
    contacts = np.zeros((n, envs, N_CONTACTS, 6), np.float32)
    landed = (flight >= FLIGHT_S) & (flight < FLIGHT_S + 0.1)  # the touchdown
    stance = 60 * np.maximum(0, np.sin(8 * t + phase)) * ~flying
    contacts[..., 5] = (stance + 300 * landed)[..., None]
    return poses, contacts


def record(
    lib: library.Library, name: str, frames: int, envs: int
) -> library.Rollout:
    """Records a synthetic run and opens it."""
    rng = np.random.default_rng(1)
    behaviour = Behaviour(envs, frames * DT, first=True)
    with lib.record(name, scene=make_scene(N_BODIES), dt=DT, n_envs=envs) as r:
        r.add_stream("contacts", "arrows", (N_CONTACTS, 6), units="N")
        for t0 in range(0, frames, 100):
            n = min(100, frames - t0)
            poses, contacts = synth_chunk(rng, behaviour, t0, n)
            # One hard hit, so there is something to find in every run.
            if t0 == 100:
                contacts[70, min(7, envs - 1), 0, 5] = 900.0
            r.log_frames(poses, contacts=contacts)
    return lib.open(name)


def timed(
    fn: Callable[[], list[highlights.Highlight]], repeats: int
) -> tuple[float, list[highlights.Highlight]]:
    """Returns the best wall time of ``fn`` in seconds, and its result."""
    best, result = float("inf"), []
    for _ in range(repeats):
        start = time.perf_counter()
        result = fn()
        best = min(best, time.perf_counter() - start)
    return best, result


def kinds_of(found: list[highlights.Highlight]) -> str:
    """Counts highlights by kind, for the report line."""
    counts: dict[str, int] = {}
    for h in found:
        counts[h.kind] = counts.get(h.kind, 0) + 1
    return ", ".join(f"{n} {k}" for k, n in sorted(counts.items()))


def main() -> None:
    """Runs the benchmarks and prints a table."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    big_frames, big_envs = (200, 256) if args.quick else (1000, 4096)
    with tempfile.TemporaryDirectory(prefix="bench-highlights-") as tmp:
        lib = library.Library(tmp)
        record(lib, "single", 400, 1).close()

        def single():
            with lib.open("single") as run:
                return highlights.detect(run)

        single()
        secs, found = timed(single, 20)
        ok = secs * 1e3 <= TARGET_SINGLE_MS
        print(
            f"single run, 400 frames: {secs * 1e3:7.2f} ms "
            f"(budget {TARGET_SINGLE_MS:.0f} ms) "
            f"{'ok' if ok else 'OVER'}  [{kinds_of(found)}]"
        )

        print(f"recording {big_frames} frames x {big_envs} envs ...")
        start = time.perf_counter()
        record(lib, "large", big_frames, big_envs).close()
        print(f"  recorded in {time.perf_counter() - start:.1f} s")

        def large():
            with lib.open("large") as run:
                return highlights.detect(run)

        secs, found = timed(large, 3)
        ok = secs <= TARGET_LARGE_S or args.quick
        print(
            f"{big_frames} frames x {big_envs} envs: {secs:7.2f} s "
            f"(budget {TARGET_LARGE_S:.0f} s) {'ok' if ok else 'OVER'}  "
            f"[{kinds_of(found)}]"
        )
        lib.close()


if __name__ == "__main__":
    main()
