import struct
import zlib

import numpy as np

from simscope.io import blockfile, codecs

from .conftest import BF


def blk_index(client, path):
    r = client.get("/api/blk", params={"path": path})
    assert r.status_code == 200, r.text
    head = blockfile.Header.parse(r.content)
    d = np.frombuffer(
        r.content, blockfile.DIR_DTYPE, head.n_blocks, blockfile.HEADER_SIZE
    )
    return r, head, d


def lengths(r):
    return [int(x) for x in r.headers["x-simscope-block-lengths"].split(",")]


def test_blk_is_the_header_and_directory_of_the_file(client, lib_root):
    path = "runs/crowd/body_pose.blk"
    r, head, d = blk_index(client, path)
    assert r.headers["content-type"] == "application/octet-stream"
    assert r.headers["x-simscope-live"] == "0"
    with blockfile.BlockReader(lib_root / path) as ref:
        assert head.n_envs == ref.n_envs == 70
        assert head.n_frames == ref.n_frames == 30
        assert head.block_frames == BF
        assert head.item_shape == ref.item_shape == (3, 7)
        assert head.n_blocks == ref.n_blocks == 3 * 70
        np.testing.assert_array_equal(d, ref.directory)
    # Header then directory, nothing else, and the directory is at 64.
    assert head.dir_offset == 64
    assert len(r.content) == 64 + 32 * head.n_blocks


def test_blk_etag_and_304(client):
    r = client.get("/api/blk", params={"path": "runs/walk/body_pose.blk"})
    again = client.get(
        "/api/blk",
        params={"path": "runs/walk/body_pose.blk"},
        headers={"If-None-Match": r.headers["etag"]},
    )
    assert again.status_code == 304


def test_blocks_are_exactly_the_bytes_in_the_file(client, lib_root):
    path = "runs/crowd/body_pose.blk"
    data = (lib_root / path).read_bytes()
    _, head, d = blk_index(client, path)
    envs = [69, 0, 5, 5, 33]
    r = client.get(
        "/api/blocks",
        params={"path": path, "w": 1, "envs": ",".join(map(str, envs))},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/octet-stream"
    sizes = lengths(r)
    assert len(sizes) == len(envs) and sum(sizes) == len(r.content)
    pos = 0
    for env, size in zip(envs, sizes, strict=True):
        entry = d[1 * head.n_envs + env]
        start = int(entry["offset"])
        assert size == 32 + int(entry["clen"])
        assert r.content[pos : pos + size] == data[start : start + size]
        pos += size
    # Each slice is a whole block: header fields agree with the directory,
    # and the payload checks against its own CRC.
    pos = 0
    for env, size in zip(envs, sizes, strict=True):
        blk = r.content[pos : pos + size]
        magic, _codec, e, t0, n, clen, _ulen, crc = struct.unpack_from(
            "<4sB3xIIIIII", blk
        )
        assert magic == b"SSBB" and e == env and t0 == BF and n == BF
        assert clen == size - 32 and zlib.crc32(blk[32:]) == crc
        pos += size


def test_served_blocks_decode_to_the_recorded_poses(client, lib_root):
    path = "runs/crowd/body_pose.blk"
    with blockfile.BlockReader(lib_root / path, kind="pose") as ref:
        want = ref.read(0, 30)
    r = client.get("/api/blocks", params={"path": path, "w": 2, "envs": "7,8"})
    pos = 0
    for env, size in zip((7, 8), lengths(r), strict=True):
        blk = r.content[pos : pos + size]
        codec = blk[4]
        out = codecs.decode_block(blk[32:], codec, BF, 21)
        np.testing.assert_array_equal(out.reshape(BF, 3, 7), want[20:30, env])
        pos += size


def test_blocks_request_limits(client):
    path = "runs/crowd/body_pose.blk"
    get = lambda **q: client.get("/api/blocks", params={"path": path, **q})  # noqa: E731
    assert get(w=0, envs=",".join(map(str, range(70)))).status_code == 200
    assert get(w=0).status_code == 400  # no envs
    assert get(w=0, envs="").status_code == 400
    assert get(w="x", envs="0").status_code == 400
    assert get(w=-1, envs="0").status_code == 400
    assert get(w=0, envs="0,x").status_code == 400
    assert get(w=0, envs="70").status_code == 400  # out of range
    assert get(w=0, envs="-1").status_code == 400
    assert get(w=3, envs="0").status_code == 404  # beyond the last window
    assert get(w=99, envs="0").status_code == 404
    assert (
        client.get(
            "/api/blocks", params={"path": path, "envs": "0"}
        ).status_code
        == 400
    )


def test_at_most_256_envs_per_request(tmp_path):
    from simscope import library

    from .conftest import make_client, record

    root = tmp_path / "big"
    lib = library.Library(root)
    record(lib, "big", 10, 300, seed=4, extras=False)
    lib.close()
    with make_client(root) as c:
        path = "runs/big/body_pose.blk"
        ok = c.get(
            "/api/blocks",
            params={
                "path": path,
                "w": 0,
                "envs": ",".join(map(str, range(256))),
            },
        )
        assert ok.status_code == 200 and len(lengths(ok)) == 256
        many = c.get(
            "/api/blocks",
            params={
                "path": path,
                "w": 0,
                "envs": ",".join(map(str, range(257))),
            },
        )
        assert many.status_code == 400
        assert "256" in many.json()["error"]


def test_missing_block_file(client, lib_root):
    (lib_root / "runs" / "walk" / "reward.blk").unlink()
    r = client.get("/api/blk", params={"path": "runs/walk/reward.blk"})
    assert r.status_code == 404
    r = client.get(
        "/api/blocks",
        params={"path": "runs/nope/body_pose.blk", "w": 0, "envs": "0"},
    )
    assert r.status_code == 404


def test_corrupt_block_file_is_reported(client, lib_root):
    (lib_root / "runs" / "walk" / "reward.blk").write_bytes(
        b"not a block file" * 8
    )
    r = client.get("/api/blk", params={"path": "runs/walk/reward.blk"})
    assert r.status_code == 422 and "error" in r.json()


def test_a_live_run_grows_window_by_window(client, live):
    path = "runs/live/body_pose.blk"
    live.grow(20)
    r1, head, d = blk_index(client, path)
    assert r1.headers["x-simscope-live"] == "1"
    assert head.n_frames == 20 and head.n_blocks == 2 * 2
    not_yet = client.get(
        "/api/blocks", params={"path": path, "w": 2, "envs": "0,1"}
    )
    assert not_yet.status_code == 404
    live.grow(10)
    r2, head2, d2 = blk_index(client, path)
    assert r2.headers["etag"] != r1.headers["etag"]
    assert head2.n_frames == 30 and head2.n_blocks == 6
    np.testing.assert_array_equal(d2[:4], d)  # appended, never rewritten
    w2 = client.get("/api/blocks", params={"path": path, "w": 2, "envs": "1,0"})
    assert w2.status_code == 200 and len(lengths(w2)) == 2
    # The window is the same bytes that the finished file will hold.
    before = w2.content
    live.finish()
    r3, head3, _ = blk_index(client, path)
    assert r3.headers["x-simscope-live"] == "0"
    assert head3.n_frames == 30
    again = client.get(
        "/api/blocks", params={"path": path, "w": 2, "envs": "1,0"}
    )
    assert again.content == before
    # After finish the stored file has its own directory; ours matches it.
    with blockfile.BlockReader(live.rec.path / "body_pose.blk") as ref:
        assert ref.n_frames == 30
