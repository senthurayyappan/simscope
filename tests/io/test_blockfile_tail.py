import os
import pathlib
import subprocess
import sys
import textwrap
import threading
import time

import numpy as np
import pytest

from simscope.io import FormatError, blockfile


def _data(n, e, shape, seed=0):
    rng = np.random.default_rng(seed)
    return rng.standard_normal((n, e, *shape)).astype(np.float32)


def _writer(path, e, shape, bf=5, kind="vector"):
    return blockfile.BlockWriter(
        path, item_shape=shape, n_envs=e, kind=kind, block_frames=bf
    )


def _unfinished(path, x, bf=5):
    """Writes ``x`` and leaves the file without a directory."""
    w = _writer(path, x.shape[1], x.shape[2:], bf)
    w.append(x)
    w.close()  # complete windows are on disk; the short tail is dropped
    return path


def test_unfinished_needs_partial(tmp_path):
    p = _unfinished(tmp_path / "a.blk", _data(12, 2, (3,)))
    with pytest.raises(FormatError, match="unfinished"):
        blockfile.BlockReader(p)
    with blockfile.BlockReader(p, partial=True) as r:
        assert not r.finished
        assert r.n_frames == 10 and r.n_blocks == 4


def test_partial_reads_match_and_refresh_grows(tmp_path):
    x = _data(23, 3, (2, 4))
    p = tmp_path / "a.blk"
    w = _writer(p, 3, (2, 4))
    with blockfile.BlockReader(p, partial=True) as r:
        assert (r.n_frames, r.n_blocks) == (0, 0)
        assert r.refresh() == 0
        seen = 0
        for lo in range(0, 18, 3):
            w.append(x[lo : lo + 3])
            got = r.refresh()
            assert got == (w.n_frames // 5) * 5
            assert got >= seen
            seen = got
            np.testing.assert_array_equal(r.read(0, got), x[:got])
            np.testing.assert_array_equal(
                r.read(max(0, got - 4), got, envs=[2, 0]),
                x[max(0, got - 4) : got][:, [2, 0]],
            )
        w.append(x[18:])
        w.finalize()
        assert r.refresh() == 23
        assert r.finished
        np.testing.assert_array_equal(r.read(0, 23), x)
        assert r.refresh() == 23  # no-op on a finished file
        with blockfile.BlockReader(p) as whole:
            np.testing.assert_array_equal(whole.directory, r.directory)


def test_finished_file_with_partial_flag_is_normal(tmp_path):
    x = _data(12, 2, (3,))
    p = tmp_path / "a.blk"
    with _writer(p, 2, (3,)) as w:
        w.append(x)
    with blockfile.BlockReader(p, partial=True) as r:
        assert r.finished and r.n_frames == 12
        assert r.refresh() == 12
        np.testing.assert_array_equal(r.read(0, 12), x)


def test_partial_bytes_source(tmp_path):
    x = _data(12, 2, (3,))
    p = _unfinished(tmp_path / "a.blk", x)
    with blockfile.BlockReader(p.read_bytes(), partial=True) as r:
        assert r.n_frames == 10
        assert r.refresh() == 10
        np.testing.assert_array_equal(r.read(0, 10), x[:10])


def test_empty_stream_becomes_finished_empty(tmp_path):
    p = tmp_path / "a.blk"
    w = _writer(p, 2, (3,))
    with blockfile.BlockReader(p, partial=True) as r:
        assert r.n_frames == 0 and not r.finished
        w.finalize()
        assert r.refresh() == 0
        assert r.finished


def test_short_last_window_and_finish(tmp_path):
    x = _data(13, 2, (3,))
    p = tmp_path / "a.blk"
    w = _writer(p, 2, (3,))
    w.append(x)
    with blockfile.BlockReader(p, partial=True) as r:
        assert r.n_frames == 10
        w.finalize()
        assert r.refresh() == 13
        assert r.finished
        np.testing.assert_array_equal(r.read(0, 13), x)


def test_short_header_raises(tmp_path):
    p = tmp_path / "a.blk"
    p.write_bytes(b"SSBK")
    with pytest.raises(FormatError, match="shorter"):
        blockfile.BlockReader(p, partial=True)


def test_torn_writes_never_expose_a_partial_window(tmp_path):
    """Grows a copy of a real file byte-range by byte-range."""
    x = _data(30, 3, (2, 2))
    src = _unfinished(tmp_path / "src.blk", x)
    raw = src.read_bytes()
    dst = tmp_path / "dst.blk"
    dst.write_bytes(raw[:64])
    with blockfile.BlockReader(dst, partial=True) as r:
        pos, seen = 64, 0
        rng = np.random.default_rng(1)
        while pos < len(raw):
            pos = min(len(raw), pos + int(rng.integers(1, 60)))
            with open(dst, "ab") as f:
                f.write(raw[len(dst.read_bytes()) : pos])
            got = r.refresh()
            assert got >= seen and got % 5 == 0
            seen = got
            np.testing.assert_array_equal(r.read(0, got), x[:got])
        assert seen == 30


def test_bad_crc_stops_the_scan(tmp_path):
    x = _data(20, 2, (3,))
    p = _unfinished(tmp_path / "a.blk", x)
    with blockfile.BlockReader(p, partial=True) as r:
        assert r.n_frames == 20
        third = int(r.directory["offset"][4])  # first block of window 2
    raw = bytearray(p.read_bytes())
    raw[third + 40] ^= 0xFF
    p.write_bytes(raw)
    with blockfile.BlockReader(p, partial=True) as r:
        assert r.n_frames == 10
        np.testing.assert_array_equal(r.read(0, 10), x[:10])


def test_refresh_only_checks_new_blocks(tmp_path, monkeypatch):
    x = _data(40, 3, (2,))
    p = tmp_path / "a.blk"
    w = _writer(p, 3, (2,))
    calls = []
    real = blockfile.zlib.crc32

    def counting(data, *args):
        calls.append(len(data))
        return real(data, *args)

    w.append(x[:20])
    with blockfile.BlockReader(p, partial=True) as r:
        monkeypatch.setattr(blockfile.zlib, "crc32", counting)
        assert r.refresh() == 20
        assert len(calls) == 1  # just the 60-byte header
        w.append(x[20:25])
        calls.clear()
        assert r.refresh() == 25
        assert len(calls) == 1 + 3  # header + the three new blocks
        w.close()


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="Windows cannot truncate, replace or shrink a file that another "
    "handle has memory-mapped, which this test does to simulate the writer",
)
def test_half_window_blocks_are_not_rechecked(tmp_path, monkeypatch):
    """A window with only some envs' blocks is resumed, not re-read."""
    x = _data(10, 3, (2,))
    src = _unfinished(tmp_path / "src.blk", x)
    raw = src.read_bytes()
    with blockfile.BlockReader(src, partial=True) as full:
        cut = int(full.directory["offset"][4])  # window 1, env 1
    dst = tmp_path / "dst.blk"
    dst.write_bytes(raw[:cut])
    calls = []
    real = blockfile.zlib.crc32
    with blockfile.BlockReader(dst, partial=True) as r:
        assert r.n_frames == 5
        monkeypatch.setattr(
            blockfile.zlib,
            "crc32",
            lambda d, *a: (calls.append(len(d)), real(d, *a))[1],
        )
        dst.write_bytes(raw)
        assert r.refresh() == 10
        # header + window 1's env 1 and env 2 (env 0 was checked before)
        assert len(calls) == 1 + 2


def test_reader_thread_tails_writer_thread(tmp_path):
    x = _data(200, 2, (3, 2), seed=4)
    p = tmp_path / "a.blk"
    w = _writer(p, 2, (3, 2), bf=7)
    done = threading.Event()
    errs: list[BaseException] = []

    def write():
        try:
            rng = np.random.default_rng(2)
            pos = 0
            while pos < len(x):
                step = int(rng.integers(1, 12))
                w.append(x[pos : pos + step])
                pos += step
                time.sleep(0.0005)
            w.finalize()
        except BaseException as exc:
            errs.append(exc)
        finally:
            done.set()

    t = threading.Thread(target=write)
    t.start()
    while not p.exists() or p.stat().st_size < 64:
        time.sleep(0.001)
    seen = 0
    with blockfile.BlockReader(p, partial=True) as r:
        while True:
            finished = done.is_set()
            got = r.refresh()
            assert got >= seen
            if got > seen:
                np.testing.assert_array_equal(r.read(seen, got), x[seen:got])
            seen = got
            if finished:
                break
    t.join()
    assert not errs
    assert seen == 200


def test_tails_a_writer_in_another_process(tmp_path):
    p = tmp_path / "a.blk"
    script = textwrap.dedent(
        """
        import sys, time
        import numpy as np
        from simscope.io import blockfile

        x = np.arange(60 * 2 * 3, dtype=np.float32).reshape(60, 2, 3)
        with blockfile.BlockWriter(
            sys.argv[1], item_shape=(3,), n_envs=2, kind="vector",
            block_frames=4,
        ) as w:
            for i in range(0, 60, 6):
                w.append(x[i : i + 6])
                time.sleep(0.01)
        """
    )
    env = dict(os.environ)
    src = pathlib.Path(blockfile.__file__).parents[2]
    env["PYTHONPATH"] = str(src) + os.pathsep + env.get("PYTHONPATH", "")
    proc = subprocess.Popen([sys.executable, "-c", script, str(p)], env=env)
    x = np.arange(60 * 2 * 3, dtype=np.float32).reshape(60, 2, 3)
    try:
        deadline = time.time() + 30
        while (not p.exists() or p.stat().st_size < 64) and (
            time.time() < deadline
        ):
            time.sleep(0.005)
        with blockfile.BlockReader(p, partial=True) as r:
            seen = 0
            while time.time() < deadline:
                finished = proc.poll() is not None
                got = r.refresh()
                assert got >= seen
                np.testing.assert_array_equal(r.read(seen, got), x[seen:got])
                seen = got
                if finished:
                    break
                time.sleep(0.002)
            assert seen == 60
            assert r.finished
    finally:
        proc.wait(timeout=30)
    assert proc.returncode == 0


def test_pose_kind_partial(tmp_path):
    rng = np.random.default_rng(0)
    q = rng.standard_normal((10, 1, 2, 4)).astype(np.float32)
    q /= np.linalg.norm(q, axis=-1, keepdims=True)
    x = np.concatenate([rng.standard_normal((10, 1, 2, 3)), q], -1)
    x = x.astype(np.float32)
    p = tmp_path / "a.blk"
    w = _writer(p, 1, (2, 7), bf=5, kind="pose")
    w.append(x)
    with blockfile.BlockReader(p, kind="pose", partial=True) as r:
        assert r.n_frames == 10
        assert r.read(0, 10).shape == (10, 1, 2, 7)
    w.close()


def test_concurrent_reads_survive_refresh_remaps(tmp_path):
    x = _data(160, 2, (4,), seed=9)
    p = tmp_path / "a.blk"
    w = _writer(p, 2, (4,), bf=4)
    w.append(x[:8])
    stop = threading.Event()
    errs: list[BaseException] = []
    with blockfile.BlockReader(p, partial=True, cache_blocks=2) as r:

        def read_loop(seed):
            rng = np.random.default_rng(seed)
            try:
                while not stop.is_set():
                    n = r.n_frames
                    a = int(rng.integers(0, n))
                    b = int(rng.integers(a, n + 1))
                    np.testing.assert_array_equal(r.read(a, b), x[a:b])
                    time.sleep(0.0002)
            except BaseException as exc:
                errs.append(exc)

        readers = [
            threading.Thread(target=read_loop, args=(i,)) for i in (1, 2)
        ]
        for t in readers:
            t.start()
        pos = 8
        while pos < 160:
            w.append(x[pos : pos + 4])
            pos += 4
            r.refresh()
        w.finalize()
        assert r.refresh() == 160
        stop.set()
        for t in readers:
            t.join()
    assert not errs


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="Windows cannot truncate, replace or shrink a file that another "
    "handle has memory-mapped, which this test does to simulate the writer",
)
def test_recover_under_an_open_reader_switches_to_the_directory(tmp_path):
    x = _data(20, 2, (3,))
    p = _unfinished(tmp_path / "a.blk", x)
    with open(p, "ab") as f:
        f.write(b"\x07" * 4000)  # junk the recovery will cut off
    with blockfile.BlockReader(p, partial=True) as r:
        assert r.n_frames == 20 and not r.finished
        assert blockfile.recover(p).dropped_bytes == 4000
        assert p.stat().st_size < 4000 + 20 * 100  # smaller than the old map
        assert r.refresh() == 20
        assert r.finished
        np.testing.assert_array_equal(r.read(0, 20), x)


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="Windows cannot truncate, replace or shrink a file that another "
    "handle has memory-mapped, which this test does to simulate the writer",
)
def test_shrunk_file_is_an_error_not_a_crash(tmp_path):
    x = _data(20, 2, (3,))
    p = _unfinished(tmp_path / "a.blk", x)
    with blockfile.BlockReader(p, partial=True) as r:
        os.truncate(p, 200)
        with pytest.raises(FormatError, match="shrank"):
            r.refresh()
