"""Tests for simscope.highlights: built-in peaks and custom kinds."""

import json
import logging
import os
import pathlib
import re
from typing import Any

import numpy as np
import pytest

from simscope import core, highlights, library

DT = 0.02
N = 200
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


def scene(names=("world", "torso", "foot"), masses=None):
    masses = masses or [0.0] * len(names)
    return core.Scene(
        bodies=tuple(
            core.Body(n, -1 if i == 0 else 0, mass=masses[i])
            for i, n in enumerate(names)
        )
    )


def base_poses(n=N, envs=1, bodies=3):
    """Identity poses with the torso 1 m up, standing still."""
    poses = np.zeros((n, envs, bodies, 7), np.float32)
    poses[..., 6] = 1.0
    poses[:, :, 1, 2] = 1.0
    return poses


def record(
    lib,
    name,
    poses,
    names=("world", "torso", "foot"),
    masses=None,
    codec="f32s",
    **streams,
):
    envs = poses.shape[1]
    with lib.record(
        name, scene=scene(names, masses), dt=DT, n_envs=envs, codec=codec
    ) as rec:
        for key, (kind, data, units) in streams.items():
            rec.add_stream(key, kind, data.shape[2:], units=units)
        rec.log_frames(poses, **{k: v[1] for k, v in streams.items()})
    return lib.open(name)


def by_kind(found):
    out: dict[str, list] = {}
    for h in found:
        out.setdefault(h.kind, []).append(h)
    return out


def test_only_two_kinds_are_built_in():
    assert [k["key"] for k in highlights.kinds()] == ["contact", "acceleration"]
    assert [k["label"] for k in highlights.kinds()] == [
        "Contact force",
        "Acceleration",
    ]


def test_root_body_rules():
    assert highlights.root_body(["world", "leg", "Torso"]) == 2
    assert highlights.root_body(["world", "leg", "base_link"]) == 2
    assert highlights.root_body(["world", "leg", "arm"]) == 1
    assert highlights.root_body(["trunk"]) == 0
    assert highlights.root_body(scene(("world", "x", "trunk"))) == 2


# -- contact ----------------------------------------------------------------


def test_contact_is_the_norm_of_the_summed_forces(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 4, 6), np.float32)
    contacts[:, 0, 1, 5] = 40.0
    contacts[30, 0, 2, 3:6] = (300.0, 0.0, 400.0)  # |F| = 500 alone
    # Two feet pushing against each other cancel: no net force, however hard.
    contacts[100, 0, 0, 3:6] = (900.0, 0.0, 0.0)
    contacts[100, 0, 3, 3:6] = (-900.0, 0.0, 0.0)
    run = record(lib, "hit", poses, contacts=("arrows", contacts, "N"))
    (hit,) = highlights.detect(run)
    assert (hit.kind, hit.frame, hit.env) == ("contact", 30, 0)
    # The vectors add: (300, 0, 400) and the 40 N of slot 1 make (300, 0, 440).
    assert hit.value == pytest.approx(np.hypot(300, 440), rel=1e-5)
    assert hit.body is None and hit.label == "Contact force"
    assert hit.ratio == pytest.approx(hit.value / 40, rel=0.02)
    assert hit.detail == f"533 N, {hit.ratio:.1f}\u00d7 typical"
    assert hit.score > highlights.Z_THRESHOLD


def test_two_feet_add_up_where_one_would_not_stand_out(lib):
    # Each slot peaks at 300 N, below what stands out on its own, but the
    # feet push the same way, so the net force is 600 N against a 40 N base.
    poses = base_poses()
    contacts = np.zeros((N, 1, 2, 6), np.float32)
    contacts[:, 0, 0, 5] = 20.0
    contacts[:, 0, 1, 5] = 20.0
    contacts[60, 0, :, 5] = 300.0
    run = record(lib, "feet", poses, contacts=("arrows", contacts, "N"))
    (hit,) = highlights.detect(run)
    assert hit.frame == 60 and hit.value == pytest.approx(600.0)


def test_a_run_without_contacts_has_no_contact_markers(lib):
    run = record(lib, "none", base_poses())
    assert highlights.detect(run) == []


def test_flat_and_smooth_signals_have_no_highlights(lib):
    poses = base_poses(envs=2)
    t = np.arange(N) * DT
    poses[:, 1, 1, 0] = 0.5 * np.sin(2 * t)  # gentle sway
    contacts = np.zeros((N, 2, 2, 6), np.float32)
    contacts[..., 5] = 100.0  # steady load
    run = record(lib, "flat", poses, contacts=("arrows", contacts, "N"))
    assert highlights.detect(run) == []


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


def test_nearby_peaks_keep_the_larger(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[100, 0, 0, 5] = 300.0
    contacts[103, 0, 0, 5] = 500.0  # 0.06 s later: within the window
    contacts[150, 0, 0, 5] = 200.0  # 1 s later: its own highlight
    run = record(lib, "near", poses, contacts=("arrows", contacts, "N"))
    frames = {h.frame: h.value for h in highlights.detect(run)}
    assert frames == {103: 500.0, 150: 200.0}


def test_plateau_yields_one_peak(lib):
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


# -- acceleration -----------------------------------------------------------


def test_acceleration_peak_at_a_velocity_step(lib):
    poses = base_poses()
    t = np.arange(N)
    # The torso starts moving at 3 m/s at frame 100. The foot stays, so the
    # centre of mass (the plain mean of the two) moves at 1.5 m/s.
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(t - 100, 0)
    run = record(lib, "step", poses)
    (hit,) = highlights.detect(run)
    assert (hit.kind, hit.frame, hit.env) == ("acceleration", 100, 0)
    assert hit.t == pytest.approx(100 * DT)
    assert hit.value == pytest.approx(1.5 / DT, rel=1e-3)
    assert hit.body is None and hit.label == "Acceleration"
    assert hit.detail == f"{hit.value:.0f} m/s², {hit.value / G:.1f} g"
    assert hit.score > highlights.Z_THRESHOLD and hit.ratio is not None


def test_the_centre_of_mass_is_weighted_by_body_mass(lib):
    poses = base_poses()
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    heavy = record(lib, "heavy", poses, masses=[0.0, 9.0, 1.0])
    light = record(lib, "light", poses, masses=[0.0, 1.0, 9.0])
    (a,) = highlights.detect(heavy)
    (b,) = highlights.detect(light)
    assert a.value == pytest.approx(0.9 * 3 / DT, rel=1e-3)
    assert b.value == pytest.approx(0.1 * 3 / DT, rel=1e-3)
    # A body of unknown mass (0) is left out when the others have masses.
    third = record(lib, "unknown", poses, masses=[0.0, 4.0, 0.0])
    assert highlights.detect(third)[0].value == pytest.approx(3 / DT, rel=1e-3)


def test_the_world_body_is_not_in_the_plain_mean(lib):
    # A world body is at the origin and never moves; it must not pull the
    # mean. With only the torso left, the centre of mass is the torso.
    poses = base_poses(bodies=2)
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    run = record(lib, "alone", poses, names=("world", "torso"))
    assert highlights.detect(run)[0].value == pytest.approx(3 / DT, rel=1e-3)


def test_free_fall_is_g_and_standing_is_zero(lib):
    n = 60
    t = np.arange(n) * DT
    poses = base_poses(n=n, bodies=2)
    poses[:, 0, 1, 2] = 100 - 0.5 * G * t**2  # falling the whole run
    fall = record(lib, "fall", poses, names=("world", "torso"))
    com = highlights._Context(fall, None).centre_of_mass()
    assert com is not None
    acc, bad = highlights._acceleration_magnitude(com, DT)
    assert acc[5:-5, 0] == pytest.approx(G, rel=2e-2)
    assert bad[0, 0] and bad[-1, 0] and not bad[1:-1].any()
    still = record(lib, "still", base_poses(bodies=2), names=("world", "torso"))
    com = highlights._Context(still, None).centre_of_mass()
    assert com is not None
    assert not highlights._acceleration_magnitude(com, DT)[0].any()


def test_an_impact_is_a_peak_and_a_slow_lift_is_not(lib):
    # A body falls from 1 m, is stopped dead by the ground, rests, and is
    # then lifted slowly. Only the stop stands out.
    t = np.arange(N) * DT
    z = np.maximum(0.3, 1.3 - 0.5 * G * t**2)  # hits the ground at 4.4 m/s
    ramp = np.clip((t[120:] - t[120]) / 1.0, 0, 1)
    z[120:] += 0.6 * (1 - np.cos(np.pi * ramp)) / 2
    poses = base_poses(bodies=2)
    poses[:, 0, 1, 2] = z
    run = record(lib, "impact", poses, names=("world", "torso"))
    (hit,) = highlights.detect(run)
    assert hit.kind == "acceleration"
    assert abs(hit.frame - round(np.sqrt(2 / G) / DT)) <= 1  # the stop
    assert hit.value > 100  # 4.4 m/s stopped within a frame or two


def test_teleports_are_not_accelerations(lib):
    poses = base_poses()
    poses[150:, 0, 1, 0] = 7.0  # a reset moves the robot 7 m in one frame
    poses[150:, 0, 2, 0] = 7.0
    assert highlights.detect(record(lib, "reset", poses)) == []


def test_acceleration_of_many_envs(lib):
    envs = 300
    poses = base_poses(envs=envs)
    for env in (0, 255, 256, 299):
        poses[:, env, 1, 0] = (
            3 * DT * np.maximum(np.arange(N) - 100 + env % 7, 0)
        )
    found = {h.env: h.frame for h in highlights.detect(record(lib, "m", poses))}
    assert found == {
        0: 100,
        255: 100 - 255 % 7,
        256: 100 - 256 % 7,
        299: 100 - 299 % 7,
    }


def test_q16d_poses_give_the_same_peak(lib):
    poses = base_poses()
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    run = record(lib, "q16", poses, codec="q16d")
    assert set(run.stream("body_pose").directory["codec"].tolist()) == {2}
    (hit,) = highlights.detect(run)
    assert (hit.kind, hit.frame) == ("acceleration", 100)
    assert hit.value == pytest.approx(1.5 / DT, rel=0.05)


def test_short_runs_do_not_fail(lib):
    for n in (1, 2, 3, 4, 7, 8):
        run = record(lib, f"short{n}", base_poses(n=n))
        assert highlights.detect(run) == []


def test_non_finite_poses_are_ignored(lib):
    poses = base_poses(envs=2)
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    poses[50:52, 1, 1, 2] = np.nan
    poses[:, 1, 2, 0] = np.nan  # a body that is never there
    run = record(lib, "nan", poses)
    assert [(h.env, h.frame) for h in highlights.detect(run)] == [(0, 100)]


def test_both_kinds_can_mark_one_moment(lib):
    poses = base_poses()
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[100, 0, 0, 5] = 700.0
    run = record(lib, "both", poses, contacts=("arrows", contacts, "N"))
    found = by_kind(highlights.detect(run))
    assert set(found) == {"contact", "acceleration"}
    assert found["contact"][0].frame == found["acceleration"][0].frame == 100


# -- custom kinds -----------------------------------------------------------


def hard_stop(rollout):
    """A small detector: the first frame the torso is below half a metre."""
    poses = rollout.stream("body_pose").read(0, rollout.n_frames)
    low = np.flatnonzero(poses[:, 0, 1, 2] < 0.5)
    if not len(low):
        return []
    f = int(low[0])
    return [
        highlights.Highlight(
            t=f * rollout.dt,
            frame=f,
            env=0,
            kind="low_torso",
            score=10.0,
            value=float(poses[f, 0, 1, 2]),
            detail=f"torso at {poses[f, 0, 1, 2]:.2f} m",
        )
    ]


def test_register_a_detector_with_a_colour(lib):
    poses = base_poses()
    poses[120:, 0, 1, 2] = 0.3
    run = record(lib, "custom", poses)
    highlights.register(
        "low_torso", hard_stop, label="Low torso", color="#d9480f"
    )
    (mine,) = by_kind(highlights.detect(run))["low_torso"]
    assert (mine.kind, mine.frame, mine.label) == (
        "low_torso",
        120,
        "Low torso",
    )
    doc = highlights.to_json(run, [mine])
    assert doc["kinds"] == [
        {"key": "low_torso", "label": "Low torso", "color": "#d9480f"}
    ]
    # The built-in kinds carry no colour; neither does a custom one without.
    assert all("color" not in k for k in highlights.kinds()[:2])
    highlights.register("plain", lambda r: [], label="Plain")
    assert "color" not in highlights.kinds()[-1]
    highlights.unregister("low_torso")
    assert "low_torso" not in by_kind(highlights.detect(run))


@pytest.mark.parametrize(
    "key",
    [
        "",
        "Jump",
        "9lives",
        "has space",
        "a-b",
        "x" * 33,
        "contact",
        "acceleration",
    ],
)
def test_register_rejects_bad_keys(key):
    with pytest.raises(ValueError):
        highlights.register(key, lambda r: [], label="X")


@pytest.mark.parametrize(
    "color", ["red", "#12", "#12345", "d9480f", "#gggggg", 3]
)
def test_register_rejects_bad_colours(color):
    with pytest.raises(ValueError, match="color"):
        highlights.register("ok", lambda r: [], label="X", color=color)
    assert "ok" not in highlights._REGISTRY


def test_register_accepts_short_and_long_hex():
    highlights.register("short", lambda r: [], label="S", color="#abc")
    highlights.register("long", lambda r: [], label="L", color="#ABCDEF")


def test_register_checks_labels_and_repeats():
    with pytest.raises(ValueError, match="label"):
        highlights.register("a", lambda r: [], label="")
    with pytest.raises(ValueError, match="label"):
        highlights.register("a", lambda r: [], label="x" * 41)
    highlights.register("a", lambda r: [], label="A")
    with pytest.raises(ValueError, match="already registered"):
        highlights.register("a", lambda r: [], label="A")


def make(kind="mine", **fields: Any):
    base: dict[str, Any] = {
        "t": 0.5,
        "frame": 25,
        "env": 0,
        "score": 9.0,
        "value": 1.0,
    }
    return highlights.Highlight(kind=kind, **{**base, **fields})


def test_spans_survive_with_both_ends(lib):
    run = record(lib, "span", base_poses())
    highlights.register(
        "mine",
        lambda r: [make(t=0.5, frame=25, t1=1.0, frame1=50)],
        label="Mine",
    )
    (h,) = highlights.detect(run)
    assert (h.t1, h.frame1) == (1.0, 50)
    entry = highlights.to_json(run, [h])["highlights"][0]
    assert (entry["t"], entry["t1"], entry["frame1"]) == (0.5, 1.0, 50)


@pytest.mark.parametrize(
    ("bad", "why"),
    [
        (lambda: [make(kind="other")], "kind"),
        (lambda: [make(frame=N)], "frame"),
        (lambda: [make(frame=-1)], "frame"),
        (lambda: [make(env=1)], "env"),
        (lambda: [make(t=float("nan"))], "finite"),
        (lambda: [make(t=float("inf"))], "finite"),
        (lambda: [make(t=-1.0)], "finite"),
        (lambda: [make(t1=1.0)], "both t1 and frame1"),
        (lambda: [make(t1=0.1, frame1=5)], "before"),
        (lambda: [make(t1=1.0, frame1=N + 5)], "frame"),
        (lambda: [make(score=float("nan"))], "finite"),
        (lambda: [{"t": 1}], "not Highlight"),
        (lambda: "nope", "must return a list"),
    ],
)
def test_invalid_results_name_the_detector_and_are_skipped(
    lib, caplog, bad, why
):
    run = record(lib, "bad", base_poses())
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[60, 0, 0, 5] = 900.0
    good = record(lib, "good", base_poses(), contacts=("arrows", contacts, "N"))
    highlights.register("mine", lambda r: bad(), label="Mine")
    with caplog.at_level(logging.WARNING, logger="simscope.highlights"):
        assert highlights.detect(run) == []
        found = highlights.detect(good)
    assert [h.kind for h in found] == ["contact"]  # the built-ins still run
    assert "detector 'mine'" in caplog.text and why in caplog.text


def test_a_detector_that_raises_is_logged_and_skipped(lib, caplog):
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[60, 0, 0, 5] = 900.0
    run = record(lib, "boom", base_poses(), contacts=("arrows", contacts, "N"))

    def boom(rollout):
        raise RuntimeError("no luck")

    highlights.register("boom", boom, label="Boom")
    highlights.register("fine", lambda r: [make(kind="fine")], label="Fine")
    with caplog.at_level(logging.WARNING, logger="simscope.highlights"):
        found = highlights.detect(run)
    assert sorted(h.kind for h in found) == ["contact", "fine"]
    assert "skipping detector 'boom': no luck" in caplog.text


def test_custom_results_are_filtered_by_env_and_labelled(lib):
    run = record(lib, "envs", base_poses(envs=3))
    highlights.register(
        "mine",
        lambda r: [make(env=0), make(env=2, label="Own label")],
        label="Mine",
    )
    assert [(h.env, h.label) for h in highlights.detect(run)] == [
        (0, "Mine"),
        (2, "Own label"),
    ]
    assert [h.env for h in highlights.detect(run, envs=[2])] == [2]


def test_markers_of_one_kind_within_a_moment_merge(lib):
    run = record(lib, "merge", base_poses())
    highlights.register(
        "mine",
        lambda r: [
            make(t=1.0, frame=50, score=5.0),
            make(t=1.10, frame=55, score=9.0),  # 0.10 s later: wins
            make(t=1.30, frame=65, score=4.0),  # 0.20 s from the winner
            make(t=2.0, frame=100, t1=2.5, frame1=125, score=1.0),
            make(t=2.05, frame=102, t1=2.4, frame1=120, score=1.0),
        ],
        label="Mine",
    )
    highlights.register(
        "other", lambda r: [make("other", t=1.05, frame=52)], label="O"
    )
    found = highlights.detect(run)
    points = sorted((h.kind, h.frame) for h in found if h.t1 is None)
    assert points == [("mine", 55), ("mine", 65), ("other", 52)]
    assert len([h for h in found if h.t1 is not None]) == 2  # spans never merge


def test_unregistered_builtin_kinds_are_skipped(lib):
    poses = base_poses()
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[100, 0, 0, 5] = 700.0
    run = record(lib, "skip", poses, contacts=("arrows", contacts, "N"))
    assert {h.kind for h in highlights.detect(run)} == {
        "contact",
        "acceleration",
    }
    highlights.unregister("acceleration")
    assert {h.kind for h in highlights.detect(run)} == {"contact"}
    highlights.unregister("contact")
    assert highlights.detect(run) == []


def test_detector_runs_are_cached_with_the_built_ins(lib, tmp_path):
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[30, 0, 0, 5] = 500.0
    run = record(lib, "cache", base_poses(), contacts=("arrows", contacts, "N"))
    cache = tmp_path / "derived" / run.manifest.id
    calls = []

    def mine(rollout):
        calls.append(1)
        return [make()]

    highlights.register("mine", mine, label="Mine", color="#112233")
    doc = highlights.load_or_compute(run, cache)
    assert {h["kind"] for h in doc["highlights"]} == {"contact", "mine"}
    assert highlights.load_or_compute(run, cache) == doc
    assert len(calls) == 1  # the second call was a cache hit
    # Changing the colour (or label) of a kind refreshes the cache.
    highlights.unregister("mine")
    highlights.register("mine", mine, label="Mine", color="#445566")
    again = highlights.load_or_compute(run, cache)
    assert len(calls) == 2
    assert again["kinds"][-1]["color"] == "#445566"


# -- documents --------------------------------------------------------------


def test_to_json_shape_and_order(lib):
    poses = base_poses()
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[30, 0, 0, 5] = 500.0
    poses[:, 0, 1, 0] = 3 * DT * np.maximum(np.arange(N) - 100, 0)
    run = record(lib, "doc", poses, contacts=("arrows", contacts, "N"))
    doc = highlights.to_json(run, highlights.detect(run))
    assert doc["format"] == "simscope-highlights/2"
    assert doc["detector"] == highlights.DETECTOR_VERSION == "simscope/3"
    assert doc["run_id"] == run.manifest.id
    assert doc["kinds"] == [
        {"key": "contact", "label": "Contact force"},
        {"key": "acceleration", "label": "Acceleration"},
    ]
    times = [h["t"] for h in doc["highlights"]]
    assert times == sorted(times) == [pytest.approx(0.6), pytest.approx(2.0)]
    assert set(doc["highlights"][0]) == {
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
    assert doc["highlights"][0]["t1"] is None
    assert doc["highlights"][0]["also"] == []
    json.dumps(doc)


def test_kinds_present_only_as_also_are_listed(lib):
    run = record(lib, "also", base_poses())
    merged = make(kind="mine", also=("other",))
    highlights.register("mine", lambda r: [], label="Mine")
    highlights.register("other", lambda r: [], label="Other", color="#abcdef")
    keys = [k["key"] for k in highlights.to_json(run, [merged])["kinds"]]
    assert keys == ["mine", "other"]


def test_load_or_compute_caches_and_invalidates(lib, tmp_path):
    contacts = np.zeros((N, 1, 1, 6), np.float32)
    contacts[30, 0, 0, 5] = 500.0
    run = record(
        lib, "cache2", base_poses(), contacts=("arrows", contacts, "N")
    )
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
    monkeypatch.setattr(highlights, "DETECTOR_VERSION", "simscope/4")
    assert highlights.cache_key(run) != key


# -- the worked examples of the getting-started guide -----------------------


def guide_blocks():
    """The python code blocks of the "Custom markers" section."""
    text = (
        pathlib.Path(__file__).parents[1] / "docs" / "getting-started.md"
    ).read_text()
    section = text.split("## Custom markers", 1)[1].split("\n## ", 1)[0]
    return re.findall(r"```python\n(.*?)```", section, re.S)


def test_the_guides_computed_marker_example_runs(lib):
    detector_code, serve_code, event_code = guide_blocks()
    assert "server.serve" in serve_code
    assert len(detector_code.strip().splitlines()) <= 22  # a short detector
    exec(detector_code, {})  # registers "low"
    z = np.full(N, 0.5)
    z[40:80] = 0.1  # 0.8 s below 0.2 m
    z[120:123] = 0.1  # too short to count
    poses = base_poses()
    poses[:, 0, 1, 2] = z
    run = record(lib, "guide", poses)
    (mine,) = by_kind(highlights.detect(run))["low"]
    assert (mine.frame, mine.frame1) == (40, 79)
    assert mine.t1 == pytest.approx(79 * DT) and mine.label == "Low"
    assert mine.detail == "under 0.2 m for 0.8 s"
    doc = highlights.to_json(run, [mine])
    assert doc["kinds"] == [{"key": "low", "label": "Low", "color": "#d9480f"}]
    assert event_code.count("add_event") == 1


def test_the_guides_event_example_runs(lib, tmp_path):
    _, _, event_code = guide_blocks()
    record(lib, "walk", base_poses())
    exec(event_code.replace("my_library", str(lib.root)), {})
    run = library.Library(lib.root).open("walk")
    (event,) = run.annotations.events
    assert (event.type, event.t0, event.t1, event.label, event.env) == (
        "slip",
        1.2,
        1.5,
        "left foot slips",
        0,
    )
    assert library.Library(lib.root).event_types()["slip"].color == "#e59a1c"
