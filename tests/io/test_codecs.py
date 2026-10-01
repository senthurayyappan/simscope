import struct
import zlib

import numpy as np
import pytest

from simscope import core
from simscope.io import FormatError, codecs


def _smooth(n=100, k=217, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(n)[:, None] * 0.02
    x = np.sin(t * rng.uniform(1, 5, k) + rng.uniform(0, 6, k))
    return (x * rng.uniform(0.1, 2, k)).astype(np.float32)


def _ref_f32s_payload(x):
    """Independent, loop-based reference of spec 7.4 f32s steps 1-4."""
    n, k = x.shape
    bits = x.view(np.uint32).astype(np.uint64)
    d = bits.copy()
    for i in range(1, n):
        d[i] = (bits[i] - bits[i - 1]) & 0xFFFFFFFF
    out = bytearray()
    for b in range(4):
        for c in range(k):
            for i in range(n):
                out.append(int((d[i, c] >> (8 * b)) & 0xFF))
    return bytes(out)


def test_f32s_layout_matches_spec_reference():
    x = _smooth(7, 5)
    payload = codecs.encode_block(x, "f32s")
    raw = zlib.decompress(payload, -15)
    assert raw == _ref_f32s_payload(x)
    assert len(raw) == 4 * 5 * 7


def test_f32s_bit_exact_special_values():
    x = _smooth(20, 6)
    x[3, 0] = np.nan
    x[4, 1] = np.inf
    x[5, 2] = -np.inf
    x[6, 3] = -0.0
    x[7, 4] = 0.0
    x[8, 5] = np.float32(1e-45)  # denormal
    x.view(np.uint32)[9, 0] = 0x7FC01234  # NaN payload
    out = codecs.decode_block(codecs.encode_block(x, "f32s"), "f32s", 20, 6)
    assert out.view(np.uint32).tobytes() == x.view(np.uint32).tobytes()


def test_f32s_single_frame_and_single_component():
    x = np.array([[1.5]], np.float32)
    out = codecs.decode_block(codecs.encode_block(x, "f32s"), 1, 1, 1)
    assert out.tolist() == [[1.5]]


def _ref_q16d(x):
    n, k = x.shape
    lo = x.min(0)
    step = (x.max(0) - lo) / np.float32(65535)
    q = np.zeros((n, k), np.uint16)
    for c in range(k):
        if step[c] != 0:
            q[:, c] = np.clip(np.rint((x[:, c] - lo[c]) / step[c]), 0, 65535)
    return lo, step, q


def test_q16d_layout_matches_spec_reference():
    x = _smooth(9, 4)
    x[:, 2] = 3.0  # constant column -> step 0
    raw = zlib.decompress(codecs.encode_block(x, "q16d"), -15)
    n, k = x.shape
    assert len(raw) == 8 * k + 2 * k * n
    lo, step, q = _ref_q16d(x)
    assert np.frombuffer(raw, "<f4", k, 0).tolist() == lo.tolist()
    assert np.frombuffer(raw, "<f4", k, 4 * k).tolist() == step.tolist()
    assert step[2] == 0
    d = q.astype(np.int64).copy()
    d[1:] = (q[1:].astype(np.int64) - q[:-1]) & 0xFFFF
    body = raw[8 * k :]
    for b in range(2):
        plane = np.frombuffer(body, np.uint8, k * n, b * k * n).reshape(k, n)
        assert (plane == ((d.T >> (8 * b)) & 0xFF)).all()


def test_q16d_error_bound():
    x = _smooth(100, 50) * 10
    payload = codecs.encode_block(x, "q16d")
    out = codecs.decode_block(payload, "q16d", 100, 50)
    step = (x.max(0) - x.min(0)) / 65535
    eps = np.finfo(np.float32).eps * np.abs(x).max(0) * 2
    assert (np.abs(out - x) <= step / 2 + eps).all()
    assert step.max() > 0


def test_q16d_constant_column_exact():
    x = np.full((10, 3), 2.5, np.float32)
    out = codecs.decode_block(codecs.encode_block(x, "q16d"), "q16d", 10, 3)
    assert (out == x).all()


def test_q16d_rejects_nonfinite_and_auto_falls_back():
    x = _smooth(10, 3)
    x[2, 1] = np.nan
    with pytest.raises(ValueError, match="non-finite"):
        codecs.encode_block(x, "q16d")
    cid, payload = codecs.encode_block_auto(x, "q16d")
    assert cid == codecs.CODEC_F32S
    out = codecs.decode_block(payload, cid, 10, 3)
    assert out.view(np.uint32).tobytes() == x.view(np.uint32).tobytes()
    cid, _ = codecs.encode_block_auto(_smooth(10, 3), "q16d")
    assert cid == codecs.CODEC_Q16D


def test_unknown_codec_and_corrupt_payload():
    with pytest.raises(FormatError, match="unknown block codec"):
        codecs.encode_block(_smooth(2, 2), "zstd")
    with pytest.raises(FormatError, match="unknown block codec id 9"):
        codecs.decode_block(b"", 9, 2, 2)
    payload = codecs.encode_block(_smooth(4, 4), "f32s")
    with pytest.raises(FormatError):
        codecs.decode_block(payload, "f32s", 5, 4)  # wrong ulen


def _mesh(with_normals=True, with_uvs=True, n=200, seed=1):
    rng = np.random.default_rng(seed)
    v = rng.uniform(-1, 3, (n, 3)).astype(np.float32)
    f = rng.integers(0, n, (2 * n, 3)).astype(np.uint32)
    nrm = rng.normal(size=(n, 3)).astype(np.float32) if with_normals else None
    uv = rng.uniform(0, 1, (n, 2)).astype(np.float32) if with_uvs else None
    return core.Mesh(v, f, nrm, uv)


def test_mesh_raw_round_trip_and_header():
    m = _mesh()
    blob = codecs.encode_mesh(m, "raw")
    magic, major, minor, nv, nf, flags, codec, ulen, crc = struct.unpack_from(
        "<4sHHIIIB3xII", blob
    )
    assert (magic, major, minor, nv, nf, flags, codec) == (
        b"SSMH",
        1,
        0,
        200,
        400,
        3,
        0,
    )
    assert ulen == 12 * 200 + 12 * 400 + 12 * 200 + 8 * 200
    assert crc == zlib.crc32(blob[32:])
    assert zlib.decompress(blob[32:], -15)[: 12 * 200] == m.vertices.tobytes()
    d = codecs.decode_mesh(blob)
    assert d.normals is not None and d.uvs is not None
    assert np.array_equal(d.vertices, m.vertices)
    assert np.array_equal(d.faces, m.faces)
    assert np.array_equal(d.normals, m.normals)
    assert np.array_equal(d.uvs, m.uvs)


def test_mesh_raw_minimal():
    m = _mesh(False, False)
    d = codecs.decode_mesh(codecs.encode_mesh(m, "raw"))
    assert d.normals is None and d.uvs is None
    assert np.array_equal(d.vertices, m.vertices)


def test_mesh_q16_bounds_and_normals_dropped():
    m = _mesh()
    blob = codecs.encode_mesh(m, "q16")
    hdr = struct.unpack_from("<4sHHIIIB3xII", blob)
    assert hdr[5] == 2  # uv flag only
    assert hdr[6] == 1
    d = codecs.decode_mesh(blob)
    assert d.normals is None
    assert np.array_equal(d.faces, m.faces)
    step = (m.vertices.max(0) - m.vertices.min(0)) / 65535
    assert (np.abs(d.vertices - m.vertices) <= step / 2 + 1e-6).all()
    ustep = (m.uvs.max(0) - m.uvs.min(0)) / 65535
    assert (np.abs(d.uvs - m.uvs) <= ustep / 2 + 1e-6).all()


def test_mesh_q16_layout():
    m = _mesh(False, False, n=10)
    raw = zlib.decompress(codecs.encode_mesh(m, "q16")[32:], -15)
    assert len(raw) == 24 + 2 * 30 + 4 * 60
    lo = np.frombuffer(raw, "<f4", 3, 0)
    assert lo.tolist() == m.vertices.min(0).tolist()
    # Faces: delta of the flat u32 sequence, 4 byte planes.
    flat = m.faces.reshape(-1).astype(np.int64)
    d = flat.copy()
    d[1:] = (flat[1:] - flat[:-1]) & 0xFFFFFFFF
    body = raw[24 + 60 :]
    for b in range(4):
        plane = np.frombuffer(body, np.uint8, 60, b * 60)
        assert (plane == ((d >> (8 * b)) & 0xFF)).all()


def test_mesh_errors():
    blob = bytearray(codecs.encode_mesh(_mesh(), "raw"))
    bad = bytearray(blob)
    bad[0:4] = b"XXXX"
    with pytest.raises(FormatError, match="bad mesh magic"):
        codecs.decode_mesh(bad)
    bad = bytearray(blob)
    struct.pack_into("<H", bad, 4, 2)
    with pytest.raises(FormatError, match="major version"):
        codecs.decode_mesh(bad)
    bad = bytearray(blob)
    bad[20] = 7
    with pytest.raises(FormatError, match="unknown mesh codec"):
        codecs.decode_mesh(bad)
    bad = bytearray(blob)
    bad[-3] ^= 0xFF
    with pytest.raises(FormatError, match="CRC"):
        codecs.decode_mesh(bad)
    with pytest.raises(FormatError, match="unknown mesh codec"):
        codecs.encode_mesh(_mesh(), "zstd")


@pytest.mark.parametrize("codec", ["f32s", "q16d"])
@pytest.mark.parametrize(
    "components",
    [slice(0, 7), slice(7, 14), slice(3, 4), np.array([0, 5, 13], np.intp)],
    ids=["first-body", "second-body", "one", "scattered"],
)
def test_decode_components_matches_full_decode(codec, components):
    rng = np.random.default_rng(3)
    x = rng.normal(size=(50, 14)).astype(np.float32)
    cid, payload = codecs.encode_block_auto(x, codec)
    full = codecs.decode_block(payload, cid, 50, 14)
    part = codecs.decode_components(payload, cid, 50, 14, components)
    np.testing.assert_array_equal(part, full[:, components])
