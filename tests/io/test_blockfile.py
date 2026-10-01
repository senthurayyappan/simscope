import struct
import zlib

import numpy as np
import pytest

from simscope.io import FormatError, blockfile, codecs


def _data(n, e, shape, seed=0):
    rng = np.random.default_rng(seed)
    k = int(np.prod(shape, dtype=int))
    t = np.arange(n)[:, None, None] * 0.02
    x = np.sin(t * rng.uniform(1, 4, (e, k)) + rng.uniform(0, 6, (e, k)))
    return x.astype(np.float32).reshape(n, e, *shape)


def _write(path, x, *, kind="vector", codec="f32s", bf=10, chunks=None):
    n, e = x.shape[:2]
    with blockfile.BlockWriter(
        path,
        item_shape=x.shape[2:],
        n_envs=e,
        kind=kind,
        codec=codec,
        block_frames=bf,
    ) as w:
        for a, b in chunks or [(0, n)]:
            w.append(x[a:b])


def test_header_and_directory_parse_with_struct(tmp_path):
    x = _data(25, 3, (4, 2))
    p = tmp_path / "a.blk"
    _write(p, x, bf=10)
    raw = p.read_bytes()
    f = struct.unpack_from("<4sHHII4IIIIIQII", raw)
    magic, major, minor, hsize, ndim = f[:5]
    s0, s1, s2, s3, envs, nfr, bf, nblk, dir_off, dir_len, crc = f[5:]
    assert (magic, major, minor, hsize, ndim) == (b"SSBK", 1, 0, 64, 2)
    assert (s0, s1, s2, s3) == (4, 2, 0, 0)
    assert (envs, nfr, bf, nblk) == (3, 25, 10, 9)
    assert dir_len == 9 * 32 and dir_off + dir_len == len(raw)
    assert dir_off % 8 == 0
    assert crc == zlib.crc32(raw[:60])
    # Walk blocks by hand: (t0, env) order, aligned to 8.
    off = 64
    order = []
    for i in range(nblk):
        ent = struct.unpack_from("<QIIIIIB3x", raw, dir_off + 32 * i)
        assert ent[0] == off and off % 8 == 0
        bm, codec, env, t0, n, clen, ulen, pcrc = struct.unpack_from(
            "<4sB3xIIIIII", raw, off
        )
        assert bm == b"SSBB" and codec == 1
        assert (env, t0, n, clen, ulen, codec) == ent[1:]
        assert ulen == 4 * 8 * n
        assert pcrc == zlib.crc32(raw[off + 32 : off + 32 + clen])
        order.append((t0, env, n))
        off = (off + 32 + clen + 7) & ~7
    assert off == dir_off
    assert order == [
        (t, e, min(10, 25 - t)) for t in (0, 10, 20) for e in range(3)
    ]


def test_f32s_round_trip_multi_env_short_last_block(tmp_path):
    x = _data(23, 3, (5,))
    x[2, 1, 0] = np.nan
    x[3, 2, 1] = -0.0
    x[4, 0, 2] = np.inf
    p = tmp_path / "a.blk"
    _write(p, x)
    with blockfile.BlockReader(p) as r:
        assert (r.n_frames, r.n_envs, r.item_shape) == (23, 3, (5,))
        assert (r.block_frames, r.n_blocks) == (10, 9)
        full = r.read(0, 23)
        assert full.dtype == np.float32
        assert full.tobytes() == x.tobytes()
        assert r.read(5, 22, [2, 0]).tobytes() == x[5:22][:, [2, 0]].tobytes()
        assert r.read(10, 10).shape == (0, 3, 5)
        assert r.read(20, 23, [1]).shape == (3, 1, 5)


def test_uneven_appends_equal_single_append(tmp_path):
    x = _data(47, 2, (3, 2))
    a, b = tmp_path / "a.blk", tmp_path / "b.blk"
    _write(a, x, chunks=[(0, 47)])
    _write(b, x, chunks=[(0, 1), (1, 14), (14, 15), (15, 40), (40, 47)])
    assert a.read_bytes() == b.read_bytes()


def test_scalar_stream(tmp_path):
    x = _data(15, 2, ())
    p = tmp_path / "s.blk"
    _write(p, x)
    raw = p.read_bytes()
    assert struct.unpack_from("<I", raw, 12)[0] == 0
    with blockfile.BlockReader(p) as r:
        assert r.read(0, 15).shape == (15, 2)
        assert r.read(0, 15).tobytes() == x.tobytes()


def test_q16d_round_trip_and_fallback(tmp_path):
    x = _data(30, 2, (4,)) * 5
    x[15, 1, 2] = np.nan  # forces the (t 10..19, env 1) block to f32s
    p = tmp_path / "q.blk"
    _write(p, x, codec="q16d")
    with blockfile.BlockReader(p) as r:
        codec = r.directory["codec"].reshape(3, 2)
        assert codec.tolist() == [[2, 2], [2, 1], [2, 2]]
        out = r.read(0, 30)
    assert np.array_equal(out[10:20, 1], x[10:20, 1], equal_nan=True)
    for w in range(3):
        sl = slice(10 * w, 10 * w + 10)
        for e in range(2):
            if (w, e) == (1, 1):
                continue
            blk = x[sl, e]
            step = (blk.max(0) - blk.min(0)) / 65535
            assert (np.abs(out[sl, e] - blk) <= step / 2 + 1e-5).all()


def test_pose_sign_continuity_across_appends(tmp_path):
    n, b = 40, 2
    ang = np.linspace(0, 6 * np.pi, n)  # rotation about z, wraps the sign
    quat = np.stack(
        [np.zeros(n), np.zeros(n), np.sin(ang / 2), np.cos(ang / 2)], -1
    )
    # Deliberately flip signs randomly, as a simulator might.
    rng = np.random.default_rng(3)
    quat *= rng.choice([-1, 1], size=(n, 1))
    pose = np.zeros((n, 1, b, 7), np.float32)
    pose[..., 3:] = quat[:, None, None, :]
    p = tmp_path / "pose.blk"
    _write(
        p, pose, kind="pose", bf=7, chunks=[(0, 3), (3, 4), (4, 20), (20, n)]
    )
    with blockfile.BlockReader(p) as r:
        out = r.read(0, n)
    q = out[..., 3:]
    dots = np.sum(q[1:] * q[:-1], axis=-1)
    assert (dots >= 0).all()
    # Same rotations: q or -q.
    same = np.all(np.isclose(q, pose[..., 3:]), -1) | np.all(
        np.isclose(q, -pose[..., 3:]), -1
    )
    assert same.all()


def test_pose_kind_requires_seven(tmp_path):
    with pytest.raises(ValueError, match="last item dim"):
        blockfile.BlockWriter(
            tmp_path / "x.blk", item_shape=(3, 6), n_envs=1, kind="pose"
        )


def test_pose_q16d_reader_renormalizes(tmp_path):
    pose = np.zeros((20, 1, 3, 7), np.float32)
    rng = np.random.default_rng(1)
    q = rng.normal(size=(20, 1, 3, 4)).astype(np.float32)
    q /= np.linalg.norm(q, axis=-1, keepdims=True)
    pose[..., 3:] = q
    pose[..., :3] = rng.uniform(-2, 2, (20, 1, 3, 3))
    p = tmp_path / "pose.blk"
    _write(p, pose, kind="pose", codec="q16d")
    with blockfile.BlockReader(p, kind="pose") as r:
        out = r.read(0, 20)
    n = np.linalg.norm(out[..., 3:], axis=-1)
    assert np.allclose(n, 1.0, atol=1e-6)


def test_writer_shape_validation(tmp_path):
    w = blockfile.BlockWriter(
        tmp_path / "x.blk", item_shape=(3,), n_envs=2, kind="vector"
    )
    with pytest.raises(ValueError, match="expected frames"):
        w.append(np.zeros((4, 3), np.float32))
    with pytest.raises(ValueError, match="expected frames"):
        w.append(np.zeros((0, 2, 3), np.float32))
    w.close()
    with pytest.raises(ValueError, match="closed"):
        w.append(np.zeros((1, 2, 3), np.float32))


def test_empty_stream(tmp_path):
    p = tmp_path / "e.blk"
    with blockfile.BlockWriter(p, item_shape=(2,), n_envs=1, kind="vector"):
        pass
    with blockfile.BlockReader(p) as r:
        assert r.n_frames == 0 and r.n_blocks == 0
        assert r.read(0, 0).shape == (0, 1, 2)


def test_read_bounds(tmp_path):
    p = tmp_path / "a.blk"
    _write(p, _data(12, 2, (2,)))
    with blockfile.BlockReader(p) as r:
        with pytest.raises(IndexError):
            r.read(0, 13)
        with pytest.raises(IndexError):
            r.read(0, 5, [2])
    with pytest.raises(ValueError, match="closed"):
        r.read(0, 1)


def test_lru_cache_bounded(tmp_path):
    p = tmp_path / "a.blk"
    _write(p, _data(50, 1, (2,)))
    with blockfile.BlockReader(p, cache_blocks=2) as r:
        r.read(0, 50)
        assert len(r._cache) == 2
        assert set(r._cache) == {3, 4}
    with blockfile.BlockReader(p, cache_blocks=0) as r:
        assert r.read(0, 50).shape == (50, 1, 2)
        assert not r._cache


def test_in_memory_source(tmp_path):
    x = _data(20, 1, (3,))
    p = tmp_path / "a.blk"
    _write(p, x)
    with blockfile.BlockReader(p.read_bytes()) as r:
        assert r.read(0, 20).tobytes() == x.tobytes()


# --- errors ---------------------------------------------------------------


def test_bad_magic_version_crc_codec(tmp_path):
    p = tmp_path / "a.blk"
    _write(p, _data(12, 1, (2,)))
    good = bytearray(p.read_bytes())

    def opened(buf):
        return blockfile.BlockReader(bytes(buf))

    bad = bytearray(good)
    bad[0:4] = b"NOPE"
    with pytest.raises(FormatError, match="magic"):
        opened(bad)

    bad = bytearray(good)
    struct.pack_into("<H", bad, 4, 2)
    struct.pack_into("<I", bad, 60, zlib.crc32(bytes(bad[:60])))
    with pytest.raises(FormatError, match="major version"):
        opened(bad)

    bad = bytearray(good)
    bad[36] ^= 1  # n_frames, header CRC not updated
    with pytest.raises(FormatError, match="header CRC"):
        opened(bad)

    dir_off = struct.unpack_from("<Q", good, 48)[0]
    bad = bytearray(good)
    bad[dir_off + 28] = 9  # unknown codec id in directory
    with pytest.raises(FormatError, match="unknown block codec id 9"):
        opened(bad)

    bad = bytearray(good)
    bad[64 + 32 + 2] ^= 0xFF  # inside first payload
    r = opened(bad)
    with pytest.raises(FormatError, match="block CRC"):
        r.read(0, 5)
    r.close()


def test_unfinished_file_points_to_recover(tmp_path):
    p = tmp_path / "a.blk"
    w = blockfile.BlockWriter(p, item_shape=(2,), n_envs=1, kind="vector")
    w.append(np.zeros((25, 1, 2), np.float32))
    w.close()
    with pytest.raises(FormatError, match="recover"):
        blockfile.BlockReader(p)


# --- recovery ---------------------------------------------------------------


def test_recover_after_truncation_mid_block(tmp_path):
    x = _data(45, 2, (3,))
    p = tmp_path / "a.blk"
    w = blockfile.BlockWriter(
        p, item_shape=(3,), n_envs=2, kind="vector", block_frames=10
    )
    w.append(x)  # writes 4 windows (8 blocks); 5 frames stay buffered
    w.close()  # crash: no directory
    raw = p.read_bytes()
    # Locate block starts by walking.
    starts, off = [], 64
    while off + 32 <= len(raw):
        clen = struct.unpack_from("<I", raw, off + 20)[0]
        starts.append(off)
        off = (off + 32 + clen + 7) & ~7
    assert len(starts) == 8
    # Cut in the middle of block index 6 (window 3, env 0).
    p.write_bytes(raw[: starts[6] + 40])
    res = blockfile.recover(p)
    assert res.n_frames == 30 and res.n_blocks == 6
    assert res.dropped_bytes == 40
    with blockfile.BlockReader(p) as r:
        assert r.n_frames == 30
        assert r.read(0, 30).tobytes() == x[:30].tobytes()
    # Idempotent on a finished file.
    again = blockfile.recover(p)
    assert again.already_finished and again.n_frames == 30


def test_recover_drops_incomplete_window_and_bad_crc(tmp_path):
    x = _data(30, 3, (2,))
    p = tmp_path / "a.blk"
    w = blockfile.BlockWriter(
        p, item_shape=(2,), n_envs=3, kind="vector", block_frames=10
    )
    w.append(x)
    w.close()
    raw = bytearray(p.read_bytes())
    # 3 windows x 3 envs = 9 blocks. Drop the last env of the last window
    # by truncating inside it: window 2 is incomplete -> 20 frames kept.
    starts, off = [], 64
    while off + 32 <= len(raw):
        clen = struct.unpack_from("<I", raw, off + 20)[0]
        starts.append(off)
        off = (off + 32 + clen + 7) & ~7
    p.write_bytes(raw[: starts[8]])
    res = blockfile.recover(p)
    assert (res.n_frames, res.n_blocks) == (20, 6)
    assert res.dropped_bytes > 0
    with blockfile.BlockReader(p) as r:
        assert r.read(0, 20).tobytes() == x[:20].tobytes()
    # Corrupt a payload byte in window 1 -> only window 0 survives.
    p.write_bytes(bytes(raw))
    raw[starts[4] + 34] ^= 0xFF
    p.write_bytes(bytes(raw))
    res = blockfile.recover(p)
    assert (res.n_frames, res.n_blocks) == (10, 3)


def test_recover_empty_file_and_bad_header(tmp_path):
    p = tmp_path / "a.blk"
    w = blockfile.BlockWriter(p, item_shape=(2,), n_envs=1, kind="vector")
    w.close()
    res = blockfile.recover(p)
    assert (res.n_frames, res.n_blocks) == (0, 0)
    with blockfile.BlockReader(p) as r:
        assert r.n_frames == 0
    p.write_bytes(b"junk" * 40)
    with pytest.raises(FormatError):
        blockfile.recover(p)


def test_exception_in_with_leaves_recoverable_file(tmp_path):
    p = tmp_path / "a.blk"
    x = _data(20, 1, (2,))
    with (
        pytest.raises(RuntimeError),
        blockfile.BlockWriter(
            p, item_shape=(2,), n_envs=1, kind="vector", block_frames=10
        ) as w,
    ):
        w.append(x)
        raise RuntimeError("boom")
    assert blockfile.recover(p).n_frames == 20


def test_encode_window_is_pure():
    x = _data(10, 2, (3,)).reshape(10, 2, 3)
    blocks = blockfile.encode_window(x, "f32s")
    assert [b.env for b in blocks] == [0, 1]
    for b in blocks:
        out = codecs.decode_block(b.payload, b.codec, 10, 3)
        assert out.tobytes() == x[:, b.env].tobytes()
        assert b.ulen == 4 * 3 * 10
