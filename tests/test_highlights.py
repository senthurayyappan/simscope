"""Tests for simscope.highlights: golden moments on synthetic runs."""

import json
import math
import os

import numpy as np
import pytest

from simscope import core, highlights, library

DT = 0.02
N = 250
G = 9.81


@pytest.fixture
def lib(tmp_path):
    lib = library.Library(tmp_path / "lib")
    yield lib
    lib.close()


@pytest.fixture(autouse=True)
def clean_registry():
    before = dict(highlights._REGISTRY)
    yield
    highlights._REGISTRY.clear()
    highlights._REGISTRY.update(before)


def scene(names=("world", "torso", "foot")):
    return core.Scene(
        bodies=tuple(
            core.Body(n, -1 if i == 0 else 0) for i, n in enumerate(names)
        )
    )


def base_poses(n=N, envs=1, bodies=3):
    """Identity poses with the torso 1 m up, standing still."""
    poses = np.zeros((n, envs, bodies, 7), np.float32)
    poses[..., 6] = 1.0
    poses[:, :, 1, 2] = 1.0
    return poses


def record(lib, name, poses, names=("world", "torso", "foot"), **streams):
    envs = poses.shape[1]
    with lib.record(name, scene=scene(names), dt=DT, n_envs=envs) as rec:
        for key, (kind, data, units) in streams.items():
            rec.add_stream(key, kind, data.shape[2:], units=units)
        rec.log_frames(poses, **{k: v[1] for k, v in streams.items()})
    return lib.open(name)


def simulate(segments, n=N, z0=0.3):
    """Integrates the vertical motion of a root body piece by piece.

    Args:
        segments: ``(seconds, accel, ground)`` triples. In a segment with a
            ground, arriving there stops the body dead, as a landing does.
            A segment with ``None`` ignores the ground (a crouch, a push-off,
            a flight over a platform). After the last segment the body keeps
            falling onto the last ground it saw.
        n: Frames to sample.
        z0: Where the body starts.

    Returns:
        ``(z, touchdowns)``: the height of each frame, and the times at
        which the body hit a ground.
    """
    sub = 25
    h = DT / sub
    z, v = z0, 0.0
    out = np.empty(n)
    touchdowns: list[float] = []
    steps = []
    for seconds, accel, ground in segments:
        steps += [(accel, ground)] * round(seconds / h)
    last_ground = next(g for _, _, g in reversed(segments) if g is not None)
    steps += [(-G, last_ground)] * max(0, n * sub - len(steps))
    for i, (accel, ground) in enumerate(steps[: n * sub]):
        if i % sub == 0:
            out[i // sub] = z
        was = z
        v += accel * h
        z += v * h
        if ground is not None and z <= ground and v < 0:
            if was > ground + 1e-9:
                touchdowns.append(i * h)
            z, v = ground, 0.0
    return out, touchdowns


def jump_segments(
    lead=1.0, crouch=0.15, push=0.10, air=1.0, tail=1.0, ground=0.3
):
    """Stand, crouch, push off, fly, land and stand again."""
    return [
        (lead, -G, ground),
        (crouch, -6.0, None),
        (push, 30.0, None),
        (air, -G, ground),
        (tail, -G, ground),
    ]


def tilt_quats(angle):
    """Quaternions (xyzw) of rotations about x by ``angle`` radians."""
    q = np.zeros((len(angle), 4), np.float32)
    q[:, 0] = np.sin(angle / 2)
    q[:, 3] = np.cos(angle / 2)
    return q


def root_run(lib, name, z, angle=None):
    """Records a one-env run: the torso is at ``z``, tilted by ``angle``."""
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    if angle is not None:
        poses[:, 0, 1, 3:] = tilt_quats(np.asarray(angle))
    return record(lib, name, poses)


def stance_contacts(n, lift, touchdown, force=80.0):
    """Contact force of one slot: the ground pushes except in flight."""
    t = np.arange(n) * DT
    contacts = np.zeros((n, 1, 1, 6), np.float32)
    contacts[:, 0, 0, 5] = np.where((t < lift) | (t >= touchdown), force, 0)
    return contacts


def by_kind(found):
    out: dict[str, list] = {}
    for h in found:
        out.setdefault(h.kind, []).append(h)
    return out


def test_root_body_rules():
    assert highlights.root_body(["world", "leg", "Torso"]) == 2
    assert highlights.root_body(["world", "leg", "base_link"]) == 2
    assert highlights.root_body(["world", "leg", "arm"]) == 1
    assert highlights.root_body(["trunk"]) == 0
    assert highlights.root_body(scene(("world", "x", "trunk"))) == 2


def test_jump_and_landing(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    run = root_run(lib, "jump", z)
    found = by_kind(highlights.detect(run))
    assert set(found) == {"jump", "landing"}
    (jump,), (landing,) = found["jump"], found["landing"]
    land_t = touchdowns[0]
    assert landing.t == pytest.approx(land_t, abs=DT)
    assert jump.t1 == pytest.approx(landing.t) and jump.frame1 == landing.frame
    # The take-off is where the push crosses +0.5 m/s: 1.15 s + 1.4/30 s.
    assert jump.t == pytest.approx(1.1967, abs=2 * DT)
    assert jump.frame == pytest.approx(60, abs=1)
    apex = float(z.max())
    assert f"apex {apex:.2f} m" in jump.detail
    assert jump.value == pytest.approx(jump.t1 - jump.t)
    assert f"{jump.value:.2f} s airborne" in jump.detail
    steps = np.diff(z)  # steps[i] is the move from frame i to i + 1
    peak = (steps[landing.frame] - steps[landing.frame - 1]) / DT**2
    assert landing.ratio == pytest.approx(peak / G + 1, rel=0.01)
    assert landing.detail.startswith(f"{landing.ratio:.1f} g impact, after ")
    assert landing.value == pytest.approx(landing.ratio * G, rel=1e-3)
    assert landing.label == "Landing" and jump.label == "Jump"
    assert landing.body == jump.body == 1 and landing.env == jump.env == 0


def test_push_off_is_not_a_landing(lib):
    # Crouch at 0.9 m/s, then push to 2.1 m/s. The body is still in the air
    # when the run ends, so there is no landing and no jump.
    z, _ = simulate(jump_segments(air=3.0), n=75)
    run = root_run(lib, "push", z)
    assert highlights.detect(run) == []


def test_hard_landing_without_a_jump(lib):
    # A step off a ledge 0.3 m above the floor: no take-off, 2.4 m/s on
    # arrival.
    segments = [(0.5, 0.0, None), (3.0, -G, 0.5)]
    z, touchdowns = simulate(segments, z0=0.8, n=100)
    (landing,) = highlights.detect(root_run(lib, "ledge", z))
    assert landing.kind == "landing"
    assert landing.t == pytest.approx(touchdowns[0], abs=DT)
    assert landing.ratio is not None and landing.ratio > 5
    assert landing.detail.endswith("after a 0.28 m drop")


def test_a_body_dropped_from_height_does_not_fall(lib):
    # It starts 0.95 m up, lands and rests at 0.05 m: that is where it
    # stands, not "below half of its first height".
    z, touchdowns = simulate([(3.0, -G, 0.05)], z0=1.0, n=100)
    (landing,) = highlights.detect(root_run(lib, "dropped", z))
    assert landing.kind == "landing"
    assert landing.t == pytest.approx(touchdowns[0], abs=DT)
    assert landing.detail.endswith("after a 0.95 m drop")
    stand = highlights._standing_height(z[:, None].astype(np.float32), DT)
    assert stand[0] == pytest.approx(0.05, abs=1e-6)
    # A robot that stands from the first frame is measured there, even if it
    # later rests higher on a ledge.
    ledge = np.where(np.arange(100) < 40, 0.3, 0.6)[:, None].astype(np.float32)
    assert highlights._standing_height(ledge, DT)[0] == pytest.approx(0.3)


def test_small_hop_is_not_a_landing(lib):
    # Up at 0.8 m/s: 3 cm. It comes down at 0.8 m/s, a 4 g stop, but that is
    # neither a real jump (10 cm) nor a fast fall (1 m/s).
    segments = [(1.0, -G, 0.3), (0.04, 20.0, None), (2.0, -G, 0.3)]
    z, touchdowns = simulate(segments, n=100)
    assert touchdowns and z.max() - 0.3 < 0.05
    assert highlights.detect(root_run(lib, "hop", z)) == []


def test_landing_on_a_platform_after_a_real_jump(lib):
    # Take off at 2.1 m/s (rise 22 cm) and land on a platform 4 cm below the
    # apex, at 0.9 m/s: slow, but it ends a real jump.
    segments = jump_segments()[:3]
    apex = simulate([*segments, (2.0, -G, 0.0)], n=120)[0].max()
    z, touchdowns = simulate([*segments, (2.0, -G, apex - 0.04)], n=120)
    found = by_kind(highlights.detect(root_run(lib, "platform", z)))
    (landing,) = found["landing"]
    assert landing.t == pytest.approx(touchdowns[-1], abs=DT)
    assert 3 < landing.ratio < 8  # 0.9 m/s stopped in a frame
    (jump,) = found["jump"]
    assert jump.t1 == landing.t


def test_flipping_in_the_air_is_not_a_fall(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    t = np.arange(len(z)) * DT
    to, land = 1.2, touchdowns[0]
    angle = np.where(
        (t > to) & (t < land), (t - to) / (land - to) * 2 * np.pi, 0
    )
    run = root_run(lib, "flip", z, angle)
    assert {h.kind for h in highlights.detect(run)} == {"jump", "landing"}


def test_landing_on_the_back_is_a_fall(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    t = np.arange(len(z)) * DT
    land = touchdowns[0]
    angle = np.where(
        t > 1.2, math.radians(150) * np.minimum((t - 1.2) / 0.3, 1), 0
    )
    run = root_run(lib, "back", z, angle)
    found = by_kind(highlights.detect(run))
    assert set(found) == {"jump", "landing", "fall"} or set(found) == {
        "jump",
        "fall",
    }
    (fall,) = found["fall"]
    assert fall.t == pytest.approx(land, abs=DT)  # lands tipped over
    assert "tipped 150" in fall.detail
    assert fall.value == pytest.approx(150, abs=1)
    assert fall.also == ("landing",)  # the landing merged into it
    assert "also landing" in fall.detail


def test_tipping_over_on_the_ground(lib):
    z = np.full(N, 0.3)
    t = np.arange(N) * DT
    angle = math.radians(90) * np.clip((t - 2.0) / 0.2, 0, 1)
    run = root_run(lib, "tip", z, angle)
    (fall,) = highlights.detect(run)
    assert fall.kind == "fall"
    # The posture counts from the first frame beyond 60 degrees.
    first = int(np.argmax(np.degrees(angle) > 60))
    assert fall.frame == first
    seconds = (N - first) * DT
    assert fall.detail == f"tipped 90\u00b0 and stayed down for {seconds:.1f} s"
    assert fall.ratio is None
    assert fall.score == pytest.approx(1.5, abs=0.05)
    assert fall.body == 1


def test_a_brief_tilt_is_not_a_fall(lib):
    z = np.full(N, 0.3)
    angle = np.zeros(N)
    angle[100:110] = math.radians(80)  # 0.2 s
    assert highlights.detect(root_run(lib, "wobble", z, angle)) == []


def test_collapse_is_a_fall(lib):
    z = np.full(N, 0.3)
    sink = np.sin(np.linspace(0, np.pi / 2, 20)) ** 2  # a soft 0.4 s sink
    z[100:120] = 0.3 - 0.22 * sink
    z[120:150] = 0.08  # below half its standing height for 0.6 s
    z[150:] = 0.3
    (fall,) = highlights.detect(root_run(lib, "collapse", z))
    assert fall.kind == "fall"
    assert fall.detail == "dropped to 0.08 m and stayed flat for 0.8 s"
    assert fall.frame >= 110 and fall.value == 0.0


def test_tilt_is_measured_from_the_first_frame(lib):
    # A base frame that is not z-up at rest: pitched 90 degrees from frame 0.
    z = np.full(N, 0.3)
    poses = base_poses()
    poses[:, 0, 1, 2] = z
    pitch = np.array([0, np.sin(math.pi / 4), 0, np.cos(math.pi / 4)])
    poses[:, 0, 1, 3:] = pitch
    assert highlights.detect(record(lib, "pitched", poses)) == []
    # It then rolls 90 degrees about the world x axis: that is a fall.
    t = np.arange(N) * DT
    roll = tilt_quats(math.radians(90) * np.clip((t - 2.0) / 0.2, 0, 1))
    q = _quat_mul(roll, pitch)
    poses[:, 0, 1, 3:] = q
    (fall,) = highlights.detect(record(lib, "pitched_roll", poses))
    assert fall.kind == "fall" and fall.value == pytest.approx(90, abs=1)


def _quat_mul(a, b):
    """Hamilton product of xyzw quaternions, ``a`` after ``b`` (arrays)."""
    b = np.broadcast_to(b, a.shape)
    ax, ay, az, aw = a.T
    bx, by, bz, bw = b.T
    return np.stack(
        [
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
            aw * bw - ax * bx - ay * by - az * bz,
        ],
        axis=-1,
    ).astype(np.float32)


def test_flat_and_smooth_signals_have_no_highlights(lib):
    poses = base_poses(envs=2)
    t = np.arange(N) * DT
    poses[:, 1, 1, 0] = 0.5 * np.sin(2 * t)  # gentle sway
    contacts = np.zeros((N, 2, 2, 6), np.float32)
    contacts[..., 5] = 100.0  # steady load
    run = record(lib, "flat", poses, contacts=("arrows", contacts, "N"))
    assert highlights.detect(run) == []


def test_teleport_is_not_a_landing(lib):
    poses = base_poses()
    poses[:150, 0, 1, 2] = 0.6
    poses[150:, 0, 1, 0] = 7.0  # a reset: 7 m away in one frame,
    poses[150:, 0, 1, 2] = 0.4  # and 20 cm down
    assert highlights.detect(record(lib, "reset", poses)) == []


def test_contact_spike_and_unit(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 4, 6), np.float32)
    contacts[:, 0, 1, 5] = 40.0
    contacts[30, 0, 2, 3:6] = (300.0, 0.0, 400.0)  # |F| = 500
    run = record(lib, "hit", poses, contacts=("arrows", contacts, "N"))
    (hit,) = highlights.detect(run)
    assert (hit.kind, hit.frame, hit.env) == ("contact_spike", 30, 0)
    assert hit.value == pytest.approx(500.0)
    assert hit.body is None and hit.label == "Contact spike"
    assert hit.ratio == pytest.approx(500 / 40, rel=0.02)
    assert hit.detail == f"500 N, {hit.ratio:.1f}\u00d7 typical"


def test_torque_spike_uses_streams_named_torque(lib):
    poses = base_poses()
    torque = np.full((N, 1, 3), 0.5, np.float32)
    torque[70, 0, 2] = -40.0
    other = np.zeros((N, 1), np.float32)
    other[20, 0] = 1e3  # a reward spike must not count
    run = record(
        lib,
        "tq",
        poses,
        joint_torque=("vector", torque, "N m"),
        reward=("scalar", other, None),
    )
    (hit,) = highlights.detect(run)
    assert (hit.kind, hit.frame) == ("torque_spike", 70)
    assert hit.value == pytest.approx(40.0)
    assert hit.detail.startswith("40.0 N·m on joint 2, ")
    assert hit.detail.endswith("\u00d7 typical")
    assert hit.ratio == pytest.approx(40 / 0.5, rel=0.05)


def test_envs_and_subset(lib):
    poses = base_poses(envs=5)
    contacts = np.zeros((N, 5, 1, 6), np.float32)
    contacts[60, 3, 0, 5] = 900.0
    run = record(lib, "many", poses, contacts=("arrows", contacts, "N"))
    (hit,) = highlights.detect(run)
    assert hit.env == 3
    assert highlights.detect(run, envs=[3])[0].env == 3
    assert highlights.detect(run, envs=[0, 1, 2]) == []
    with pytest.raises(IndexError):
        highlights.detect(run, envs=[5])


def test_nearby_spikes_keep_the_larger(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[100, 0, 0, 5] = 300.0
    contacts[103, 0, 0, 5] = 500.0  # 0.06 s later: within the window
    contacts[150, 0, 0, 5] = 200.0  # 1 s later: its own highlight
    run = record(lib, "near", poses, contacts=("arrows", contacts, "N"))
    frames = {h.frame: h.value for h in highlights.detect(run)}
    assert frames == {103: 500.0, 150: 200.0}


def test_plateau_yields_one_spike(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[80:83, 0, 0, 5] = 400.0
    run = record(lib, "plateau", poses, contacts=("arrows", contacts, "N"))
    assert [h.frame for h in highlights.detect(run)] == [80]


def test_top_ten_per_env(lib):
    n = 1000
    poses = base_poses(n=n)
    contacts = np.zeros((n, 1, 1, 6), np.float32)
    spikes = np.arange(20) * 40 + 20  # 0.8 s apart
    contacts[spikes, 0, 0, 5] = 100.0 + np.arange(20)
    run = record(lib, "ten", poses, contacts=("arrows", contacts, "N"))
    found = highlights.detect(run)
    assert len(found) == highlights.PER_ENV
    assert sorted(h.value for h in found) == [110.0 + i for i in range(10)]


def test_top_fifty_per_kind_across_envs(lib):
    envs = 80
    poses = base_poses(envs=envs)
    contacts = np.zeros((N, envs, 1, 6), np.float32)
    contacts[40, :, 0, 5] = 200.0 + np.arange(envs)
    run = record(lib, "fifty", poses, contacts=("arrows", contacts, "N"))
    found = highlights.detect(run)
    assert len(found) == highlights.PER_KIND
    assert {h.env for h in found} == set(range(envs - 50, envs))


def test_markers_within_a_moment_merge(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    land = round(touchdowns[0] / DT)
    contacts = stance_contacts(len(z), 1.25, touchdowns[0])
    contacts[land + 2, 0, 0, 5] = 700.0  # 0.04 s after the landing
    torque = np.full((len(z), 1, 2), 1.0, np.float32)
    torque[land + 5, 0, 1] = 30.0  # 0.10 s after it
    streams = {
        "contacts": ("arrows", contacts, "N"),
        "joint_torque": ("vector", torque, "N m"),
    }
    found = by_kind(highlights.detect(record(lib, "merge", poses, **streams)))
    assert set(found) == {"jump", "landing"}
    (landing,) = found["landing"]
    assert landing.also == ("contact_spike", "torque_spike")
    assert "also contact spike (700 N" in landing.detail
    assert "also torque spike (30.0 N\u00b7m on joint 1" in landing.detail
    # Further away than 0.15 s, a spike stands alone.
    torque[land + 5, 0, 1] = 1.0
    contacts[land + 2, 0, 0, 5] = 80.0
    contacts[land + 12, 0, 0, 5] = 700.0
    found = by_kind(highlights.detect(record(lib, "alone", poses, **streams)))
    assert found["landing"][0].also == ()
    assert [h.frame for h in found["contact_spike"]] == [land + 12]


def test_flight_from_contact_force(lib):
    # With a contacts stream, the take-off is the first frame without
    # contact: earlier than the +0.5 m/s crossing of the push.
    z, touchdowns = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    t = np.arange(len(z)) * DT
    lift = 1.0 + 0.15 + 0.10  # the push ends: the feet leave the ground
    contacts = np.zeros((len(z), 1, 1, 6), np.float32)
    on_ground = (t < lift) | (t >= touchdowns[0])
    contacts[:, 0, 0, 5] = np.where(on_ground, 80.0, 0.0)
    run = record(lib, "flight", poses, contacts=("arrows", contacts, "N"))
    found = by_kind(highlights.detect(run))
    (jump,) = found["jump"]
    assert jump.t == pytest.approx(lift, abs=DT)
    assert jump.t1 == pytest.approx(touchdowns[0], abs=DT)


def test_a_bump_in_the_air_needs_ground_contact(lib):
    # A jerk of the root in mid-air stops the descent like an impact would.
    # With contact force known, a landing needs the ground.
    segments = [
        (1.0, -G, 0.3),
        (0.15, -6.0, None),
        (0.10, 40.0, None),  # up at 3.1 m/s
        (0.50, -G, None),  # over the apex, down at 1.8 m/s
        (0.04, 60.0, None),  # the jerk: the fall stops
        (2.0, -G, 0.3),
    ]
    z, touchdowns = simulate(segments, n=150)
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    plain = by_kind(highlights.detect(record(lib, "bump", poses)))
    assert len(plain["landing"]) == 2  # z alone cannot tell
    contacts = stance_contacts(len(z), 1.25, touchdowns[0])
    run = record(lib, "air", poses, contacts=("arrows", contacts, "N"))
    found = by_kind(highlights.detect(run))
    (landing,) = found["landing"]
    assert landing.t == pytest.approx(touchdowns[0], abs=DT)
    assert found["jump"][0].t1 == landing.t


def test_register_and_unregister(lib):
    poses = base_poses()
    run = record(lib, "custom", poses)

    def mine(rollout):
        return [
            highlights.Highlight(0.5, 25, 0, "mine", 9.0, 1.0),
            highlights.Highlight(0.1, 5, 0, "mine", 7.0, 2.0, detail="early"),
        ]

    highlights.register("mine", mine, label="Mine")
    with pytest.raises(ValueError, match="already registered"):
        highlights.register("mine", mine, label="Mine")
    found = highlights.detect(run)
    assert [h.frame for h in found] == [5, 25]  # sorted by time
    assert {h.label for h in found} == {"Mine"}  # the kind's label fills in
    doc = highlights.to_json(run, found)
    assert doc["kinds"] == [{"key": "mine", "label": "Mine"}]
    highlights.unregister("mine")
    assert highlights.detect(run) == []


def test_detector_must_return_its_own_kind(lib):
    run = record(lib, "liar", base_poses())
    highlights.register(
        "a",
        lambda r: [highlights.Highlight(0.0, 0, 0, "b", 7.0, 1.0)],
        label="A",
    )
    with pytest.raises(ValueError, match="'b'"):
        highlights.detect(run)


def test_unregistered_builtin_kinds_are_skipped(lib):
    z, _ = simulate(jump_segments(air=0.8))
    run = root_run(lib, "skip", z)
    highlights.unregister("jump")
    assert [h.kind for h in highlights.detect(run)] == ["landing"]
    highlights.unregister("landing")
    assert highlights.detect(run) == []


def test_to_json_shape_and_order(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    contacts = stance_contacts(len(z), 1.25, touchdowns[0], force=60.0)
    contacts[200, 0, 0, 5] = 900.0
    run = record(lib, "doc", poses, contacts=("arrows", contacts, "N"))
    doc = highlights.to_json(run, highlights.detect(run))
    assert doc["format"] == "simscope-highlights/2"
    assert doc["detector"] == highlights.DETECTOR_VERSION == "simscope/2.1"
    assert doc["run_id"] == run.manifest.id
    assert [k["key"] for k in doc["kinds"]] == [
        "landing",
        "jump",
        "contact_spike",
    ]
    assert doc["kinds"][0] == {"key": "landing", "label": "Landing"}
    times = [h["t"] for h in doc["highlights"]]
    assert times == sorted(times)
    jump = next(h for h in doc["highlights"] if h["kind"] == "jump")
    assert set(jump) == {
        "t",
        "frame",
        "t1",
        "frame1",
        "env",
        "kind",
        "label",
        "detail",
        "score",
        "ratio",
        "value",
        "body",
        "also",
    }
    assert jump["t1"] > jump["t"] and jump["ratio"] is None
    spike = next(h for h in doc["highlights"] if h["kind"] == "contact_spike")
    assert spike["t1"] is None and spike["frame1"] is None
    assert spike["body"] is None and spike["also"] == []
    json.dumps(doc)


def test_load_or_compute_caches_and_invalidates(lib, tmp_path):
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[30, 0, 0, 5] = 500.0
    run = record(lib, "cache", base_poses(), contacts=("arrows", contacts, "N"))
    cache = tmp_path / "derived" / run.manifest.id
    doc = highlights.load_or_compute(run, cache)
    assert len(doc["highlights"]) == 1
    assert (cache / "highlights.json").is_file()

    # A hit does not run the detectors: plant a marker in the file.
    path = cache / "highlights.json"
    planted = {**doc, "highlights": []}
    path.write_text(json.dumps(planted))
    assert highlights.load_or_compute(run, cache) == planted

    # A newer manifest recomputes.
    manifest = run.path / "rollout.json"
    st = manifest.stat()
    os.utime(manifest, ns=(st.st_atime_ns, st.st_mtime_ns + 10**9))
    assert highlights.load_or_compute(run, cache) == doc

    # So does another registered detector.
    path.write_text(json.dumps(planted))
    highlights.register("x", lambda r: [], label="X")
    assert highlights.load_or_compute(run, cache) == doc

    # And a corrupt file.
    path.write_text("not json")
    (cache / "highlights.key").write_text(highlights.cache_key(run))
    assert highlights.load_or_compute(run, cache) == doc


def test_cache_key_includes_the_detector_version(lib, monkeypatch):
    run = record(lib, "version", base_poses())
    key = highlights.cache_key(run)
    monkeypatch.setattr(highlights, "DETECTOR_VERSION", "simscope/3")
    assert highlights.cache_key(run) != key


def test_short_runs_do_not_fail(lib):
    for n in (1, 2, 3, 4, 5):
        run = record(lib, f"short{n}", base_poses(n=n))
        assert highlights.detect(run) == []


def test_non_finite_values_are_ignored(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[10, 0, 0, 5] = np.nan
    contacts[50, 0, 0, 5] = 800.0
    run = record(lib, "nan", poses, contacts=("arrows", contacts, "N"))
    assert [h.frame for h in highlights.detect(run)] == [50]


def test_periodic_gait_contact_has_no_outliers(lib):
    t = np.arange(N) * DT
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[:, 0, 0, 5] = 60 * np.maximum(0, np.sin(8 * t))  # stance/swing
    run = record(lib, "gait", base_poses(), contacts=("arrows", contacts, "N"))
    assert highlights.detect(run) == []
    contacts[110, 0, 0, 5] = 200.0  # one stumble, far above any stride
    run2 = record(
        lib, "gait2", base_poses(), contacts=("arrows", contacts, "N")
    )
    assert [h.frame for h in highlights.detect(run2)] == [110]


def test_many_envs_cross_the_chunk_boundary(lib):
    envs = 300  # more than one decode chunk
    poses = base_poses(n=N, envs=envs)
    contacts = np.zeros((N, envs, 1, 6), np.float32)
    for env in (0, 255, 256, 299):
        contacts[40 + env // 10, env, 0, 5] = 900.0
    run = record(lib, "chunks", poses, contacts=("arrows", contacts, "N"))
    found = {h.env: h.frame for h in highlights.detect(run)}
    assert found == {0: 40, 255: 65, 256: 65, 299: 69}


def test_landings_in_many_envs(lib):
    envs = 300
    z, touchdowns = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z), envs=envs)
    poses[:, :, 1, 2] = z[:, None]
    shift = np.arange(envs) % 7  # envs jump 0..6 frames apart
    for env in range(envs):
        poses[:, env, 1, 2] = np.roll(z, int(shift[env]))
    run = record(lib, "landings", poses)
    found = by_kind(highlights.detect(run))
    assert len(found["landing"]) == highlights.PER_KIND
    assert {h.env % 7 for h in found["landing"]} <= set(range(7))
    first = round(touchdowns[0] / DT)
    for h in found["landing"]:
        assert h.frame == first + int(shift[h.env])


def test_q16d_poses_give_the_same_landing(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    with lib.record("q16", scene=scene(), dt=DT, n_envs=1, codec="q16d") as rec:
        rec.log_frames(poses)
    with lib.open("q16") as run:
        assert set(run.stream("body_pose").directory["codec"].tolist()) == {2}
        found = by_kind(highlights.detect(run))
    assert set(found) == {"jump", "landing"}
    assert found["landing"][0].t == pytest.approx(touchdowns[0], abs=DT)


def test_root_body_is_the_named_torso(lib):
    z, _ = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z))
    poses[:, 0, 2, 2] = z  # the foot jumps, the torso does not
    run = record(lib, "foot", poses)
    assert highlights.detect(run) == []
    run2 = record(lib, "nameless", poses, names=("world", "a", "b"))
    assert highlights.detect(run2) == []  # body 1 is the first non-world


def test_the_strongest_of_several_torque_streams_wins(lib):
    poses = base_poses()
    hip = np.full((N, 1, 3), 0.5, np.float32)
    knee = np.full((N, 1, 2), 0.5, np.float32)
    hip[60, 0, 1] = 20.0
    knee[60, 0, 0] = 30.0  # the larger one, in the other stream
    run = record(
        lib,
        "two",
        poses,
        hip_torque=("vector", hip, "N m"),
        knee_torque=("vector", knee, "N m"),
    )
    (hit,) = highlights.detect(run)
    assert hit.value == pytest.approx(30.0)
    assert hit.detail.startswith("30.0 N·m on joint 0, ")


def test_jumps_do_not_merge_and_kinds_list_the_merged_ones(lib):
    z, touchdowns = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z))
    poses[:, 0, 1, 2] = z
    land = round(touchdowns[0] / DT)
    contacts = stance_contacts(len(z), 1.25, touchdowns[0])
    contacts[60, 0, 0, 5] = 900.0  # a spike at the take-off, 1.2 s in
    contacts[land + 1, 0, 0, 5] = 900.0  # and one at the landing
    run = record(lib, "spans", poses, contacts=("arrows", contacts, "N"))
    found = highlights.detect(run)
    kinds = sorted(h.kind for h in found)
    # The span stays; the spike at its start stands alone (spans never
    # absorb); the spike at the landing folds into the landing.
    assert kinds == ["contact_spike", "jump", "landing"]
    doc = highlights.to_json(run, found)
    assert {k["key"] for k in doc["kinds"]} == {
        "contact_spike",
        "jump",
        "landing",
    }
    landing = next(h for h in found if h.kind == "landing")
    assert landing.also == ("contact_spike",)
    only_also = [h for h in found if h.kind == "landing"]
    present = highlights.to_json(run, only_also)["kinds"]
    assert [k["key"] for k in present] == ["landing", "contact_spike"]


def test_subset_of_envs_for_landings(lib):
    z, _ = simulate(jump_segments(air=0.8))
    poses = base_poses(n=len(z), envs=4)
    for env in range(4):
        poses[:, env, 1, 2] = z if env in (1, 3) else 0.3
    run = record(lib, "subset", poses)
    assert {h.env for h in highlights.detect(run)} == {1, 3}
    found = highlights.detect(run, envs=[3, 0])
    assert {h.env for h in found} == {3}
    assert {h.kind for h in found} == {"jump", "landing"}


def tilted_run(lib, name, frames, *, n=N, angle=80.0, extra=None):
    """A run that stands still, tilted by ``angle`` degrees on ``frames``."""
    z = np.full(n, 0.3)
    tilt = np.zeros(n)
    tilt[frames] = math.radians(angle)
    poses = base_poses(n=n)
    poses[:, 0, 1, 2] = z
    poses[:, 0, 1, 3:] = tilt_quats(tilt)
    if extra is not None:
        extra(poses)
    return record(lib, name, poses)


def test_rearing_and_getting_up_is_not_a_fall(lib):
    # Tilted past 60 degrees for 0.6 s, then upright again: climbing or
    # rolling over something, not a robot that tipped over.
    run = tilted_run(lib, "rear", slice(100, 130))
    assert highlights.detect(run) == []
    # Even 1.4 s down is a recovery.
    assert highlights.detect(tilted_run(lib, "rear2", slice(100, 170))) == []
    # Staying down for 1.6 s and then getting up is a fall.
    (fall,) = highlights.detect(tilted_run(lib, "down", slice(100, 180)))
    assert fall.kind == "fall" and fall.frame == 100
    assert fall.detail == "tipped 80\u00b0 and stayed down for 1.6 s"


def test_tipped_over_at_the_end_of_the_run_is_a_fall(lib):
    # Down to the last frame for 0.6 s: it never got up.
    (fall,) = highlights.detect(tilted_run(lib, "end", slice(N - 30, N)))
    assert fall.frame == N - 30
    assert fall.detail == "tipped 80\u00b0 and stayed down for 0.6 s"
    # 0.4 s is too short to tell from a pose on the way to something else.
    assert highlights.detect(tilted_run(lib, "end2", slice(N - 20, N))) == []


def test_tipped_over_until_the_env_resets_is_a_fall(lib):
    def reset(poses):
        poses[130:, 0, 1, 0] = 7.0  # a reset puts it 7 m away, upright

    run = tilted_run(lib, "reset", slice(100, 130), extra=reset)
    (fall,) = highlights.detect(run)
    assert fall.frame == 100
    assert fall.detail == "tipped 80\u00b0 and stayed down for 0.6 s"
    # The same posture without a reset is a recovery.
    assert highlights.detect(tilted_run(lib, "noreset", slice(100, 130))) == []


def test_a_belly_flop_is_a_fall_and_a_dip_is_not(lib):
    sink = np.sin(np.linspace(0, np.pi / 2, 20)) ** 2  # a soft 0.4 s sink

    def run_with(flat_frames):
        z = np.full(N, 0.3)
        z[100:120] = 0.3 - 0.25 * sink
        z[120 : 120 + flat_frames] = 0.05
        z[120 + flat_frames :] = 0.3
        return root_run(lib, f"flop{flat_frames}", z)

    (fall,) = highlights.detect(run_with(20))  # flat for 0.4 s
    assert fall.detail.startswith("dropped to 0.05 m and stayed flat for ")
    assert fall.value == 0.0 and fall.kind == "fall"
    assert highlights.detect(run_with(2)) == []  # a dip of 0.04 s


def test_tipped_and_flat_is_one_fall(lib):
    z = np.full(N, 0.3)
    z[100:] = 0.08  # lying on its side: low and tilted
    angle = np.zeros(N)
    angle[100:] = math.radians(90)
    (fall,) = highlights.detect(root_run(lib, "side", z, angle))
    assert fall.frame == 100 and fall.detail.startswith("tipped 90")
