"""Payload codecs for block files (spec 7.4) and mesh blobs (spec 6).

All functions are pure. Block codecs turn an f32 ``[n, K]`` array (the frames
of one env) into a deflate-raw payload and back. The byte layout assumes a
little-endian host, which the format requires anyway.
"""

import struct
import sys
import zlib
from typing import Literal

import numpy as np
import numpy.typing as npt

from simscope import core
from simscope.io import errors

if sys.byteorder != "little":  # pragma: no cover
    raise ImportError("simscope.io requires a little-endian host")

CODEC_F32S = 1
CODEC_Q16D = 2
BLOCK_CODEC_IDS: dict[str, int] = {"f32s": CODEC_F32S, "q16d": CODEC_Q16D}
BLOCK_CODEC_NAMES: dict[int, str] = {v: k for k, v in BLOCK_CODEC_IDS.items()}

MESH_RAW = 0
MESH_Q16 = 1
MESH_CODEC_IDS: dict[str, int] = {"raw": MESH_RAW, "q16": MESH_Q16}

DEFLATE_LEVEL = 6
_U16_MAX = 65535

BlockCodec = Literal["f32s", "q16d"]
MeshCodec = Literal["raw", "q16"]
Payload = bytes | bytearray | memoryview


def codec_id(codec: str | int) -> int:
    """Resolves a block codec name or id to its numeric id.

    Args:
        codec: ``"f32s"``, ``"q16d"``, or the numeric id 1 or 2.

    Returns:
        The numeric codec id.

    Raises:
        errors.FormatError: If the codec is unknown.
    """
    if isinstance(codec, str):
        if codec not in BLOCK_CODEC_IDS:
            raise errors.FormatError(f"unknown block codec {codec!r}")
        return BLOCK_CODEC_IDS[codec]
    if codec not in BLOCK_CODEC_NAMES:
        raise errors.FormatError(f"unknown block codec id {codec}")
    return int(codec)


def payload_ulen(codec: str | int, n: int, k: int) -> int:
    """Returns the uncompressed payload length of a block.

    Args:
        codec: Block codec name or id.
        n: Frames in the block.
        k: Floats per frame.

    Returns:
        ``4*K*n`` for f32s and ``8*K + 2*K*n`` for q16d. (The spec text says
        ``4*K*n`` for q16d, which contradicts its two u8 planes.)
    """
    if codec_id(codec) == CODEC_F32S:
        return 4 * k * n
    return 8 * k + 2 * k * n


def deflate(data: Payload | npt.NDArray[np.uint8]) -> bytes:
    """Compresses bytes with deflate-raw at the spec level (6).

    Args:
        data: Bytes-like object or contiguous uint8 array.

    Returns:
        The raw deflate stream.
    """
    comp = zlib.compressobj(DEFLATE_LEVEL, zlib.DEFLATED, -15)
    return comp.compress(data) + comp.flush()


def inflate(payload: Payload, ulen: int, what: str = "payload") -> bytes:
    """Decompresses a deflate-raw stream and checks its length.

    Args:
        payload: The compressed bytes.
        ulen: Expected uncompressed length.
        what: Description used in error messages.

    Returns:
        The uncompressed bytes.

    Raises:
        errors.FormatError: If the stream is corrupt or has the wrong length.
    """
    try:
        raw = zlib.decompress(payload, -15, max(ulen, 1))
    except zlib.error as exc:
        raise errors.FormatError(f"{what}: bad deflate stream: {exc}") from exc
    if len(raw) != ulen:
        raise errors.FormatError(
            f"{what}: inflated to {len(raw)} bytes, expected {ulen}"
        )
    return raw


def shuffle(d: npt.NDArray[np.unsignedinteger]) -> npt.NDArray[np.uint8]:
    """Transposes ``[n, K]`` unsigned ints to component-major byte planes.

    Args:
        d: C-contiguous array of shape ``[n, K]`` (u16 or u32).

    Returns:
        A uint8 array of shape ``[itemsize, K, n]``. Plane ``b`` holds byte
        ``b`` (least significant first) of every element, laid out ``[K, n]``.
    """
    n, k = d.shape
    b = d.view(np.uint8).reshape(n, k, d.itemsize)
    return np.ascontiguousarray(b.transpose(2, 1, 0))


def unshuffle_into(
    planes: npt.NDArray[np.uint8], out: npt.NDArray[np.unsignedinteger]
) -> None:
    """Reverses :func:`shuffle` into a preallocated array.

    Args:
        planes: uint8 array of shape ``[itemsize, K, n]``.
        out: C-contiguous output of shape ``[n, K]``.
    """
    n, k = out.shape
    out.view(np.uint8).reshape(n, k, out.itemsize)[...] = planes.transpose(
        2, 1, 0
    )


def delta_encode(a: npt.NDArray[np.unsignedinteger]) -> npt.NDArray:
    """Delta-codes rows along axis 0 modulo the dtype width.

    Args:
        a: Unsigned integer array with at least one row.

    Returns:
        A new array where row 0 is absolute and row ``i`` is
        ``a[i] - a[i-1]``.
    """
    d = a.copy()
    np.subtract(a[1:], a[:-1], out=d[1:])
    return d


def delta_decode_inplace(a: npt.NDArray[np.unsignedinteger]) -> None:
    """Prefix-sums rows along axis 0 in place, modulo the dtype width.

    Args:
        a: Delta-coded unsigned integer array.
    """
    np.cumsum(a, axis=0, dtype=a.dtype, out=a)


def _as_block(x: npt.ArrayLike) -> npt.NDArray[np.float32]:
    """Validates and returns a C-contiguous float32 ``[n, K]`` array."""
    a = np.ascontiguousarray(x, dtype=np.float32)
    if a.ndim != 2 or a.shape[0] < 1 or a.shape[1] < 1:
        raise ValueError(f"block must have shape [n>=1, K>=1], got {a.shape}")
    return a


def _q16_ranges(
    x: npt.NDArray[np.float32],
) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]]:
    """Computes per-column ``lo`` and ``step`` for 16-bit quantization."""
    lo = x.min(axis=0)
    hi = x.max(axis=0)
    step = (hi - lo) / np.float32(_U16_MAX)
    return lo, step.astype(np.float32)


def _quantize(
    x: npt.NDArray[np.float32],
    lo: npt.NDArray[np.float32],
    step: npt.NDArray[np.float32],
) -> npt.NDArray[np.uint16]:
    """Quantizes ``x`` to u16 using per-column ``lo`` and ``step``."""
    safe = np.where(step > 0, step, np.float32(1.0))
    q = (x - lo) / safe
    np.rint(q, out=q)
    np.clip(q, 0, _U16_MAX, out=q)
    return q.astype(np.uint16)


def dequantize(
    q: npt.NDArray[np.uint16],
    lo: npt.NDArray[np.float32],
    step: npt.NDArray[np.float32],
    out: npt.NDArray[np.float32] | None = None,
) -> npt.NDArray[np.float32]:
    """Computes ``lo + q * step`` in float32, one rounding per operation.

    Args:
        q: Quantized values, broadcastable against ``lo`` and ``step``.
        lo: Per-component minimum.
        step: Per-component step.
        out: Optional float32 output with the shape of ``q``.

    Returns:
        The dequantized float32 array.
    """
    if out is None:
        out = np.empty(q.shape, np.float32)
    np.multiply(q, step, out=out, dtype=np.float32)
    np.add(out, lo, out=out)
    return out


def can_encode_q16d(x: npt.ArrayLike) -> bool:
    """Tells whether a block can be stored with q16d.

    Args:
        x: Block data ``[n, K]``.

    Returns:
        False if any value is NaN or infinite, or a column range overflows
        float32.
    """
    a = _as_block(x)
    lo, step = _q16_ranges(a)
    return bool(np.isfinite(lo).all() and np.isfinite(step).all())


def encode_block(x: npt.ArrayLike, codec: str | int) -> bytes:
    """Encodes one block into its compressed payload (spec 7.4).

    Args:
        x: Float32 data of shape ``[n, K]``: n frames of one env.
        codec: ``"f32s"`` or ``"q16d"`` (or the numeric id).

    Returns:
        The deflate-raw payload.

    Raises:
        ValueError: If ``x`` has the wrong shape, or the codec is q16d and
            ``x`` has non-finite values. Use :func:`encode_block_auto` to fall
            back to f32s.
        errors.FormatError: If the codec is unknown.
    """
    cid = codec_id(codec)
    a = _as_block(x)
    if cid == CODEC_F32S:
        d = delta_encode(a.view(np.uint32))
        return deflate(shuffle(d))
    lo, step = _q16_ranges(a)
    if not (np.isfinite(lo).all() and np.isfinite(step).all()):
        raise ValueError("q16d cannot encode non-finite values")
    q = _quantize(a, lo, step)
    planes = shuffle(delta_encode(q))
    comp = zlib.compressobj(DEFLATE_LEVEL, zlib.DEFLATED, -15)
    return (
        comp.compress(lo.tobytes())
        + comp.compress(step.tobytes())
        + comp.compress(planes)
        + comp.flush()
    )


def encode_block_auto(x: npt.ArrayLike, codec: str | int) -> tuple[int, bytes]:
    """Encodes a block, falling back to f32s when q16d is unsafe.

    Args:
        x: Float32 data of shape ``[n, K]``.
        codec: Requested codec.

    Returns:
        ``(codec_id, payload)`` where ``codec_id`` is the codec actually used.
    """
    cid = codec_id(codec)
    a = _as_block(x)
    if cid == CODEC_Q16D and not can_encode_q16d(a):
        cid = CODEC_F32S
    return cid, encode_block(a, cid)


def decode_block_into(
    payload: Payload,
    codec: str | int,
    out: npt.NDArray[np.float32],
) -> None:
    """Decodes a block payload into a preallocated array.

    Args:
        payload: The compressed payload.
        codec: Codec name or id from the block header.
        out: C-contiguous writable float32 array of shape ``[n, K]``.

    Raises:
        errors.FormatError: If the payload is corrupt or the codec unknown.
    """
    cid = codec_id(codec)
    n, k = out.shape
    raw = inflate(payload, payload_ulen(cid, n, k), "block payload")
    if cid == CODEC_F32S:
        planes = np.frombuffer(raw, np.uint8).reshape(4, k, n)
        bits = out.view(np.uint32)
        unshuffle_into(planes, bits)
        delta_decode_inplace(bits)
        return
    lo = np.frombuffer(raw, np.float32, k, 0)
    step = np.frombuffer(raw, np.float32, k, 4 * k)
    planes = np.frombuffer(raw, np.uint8, 2 * k * n, 8 * k).reshape(2, k, n)
    q = np.empty((n, k), np.uint16)
    unshuffle_into(planes, q)
    delta_decode_inplace(q)
    dequantize(q, lo, step, out)


def decode_block(
    payload: Payload, codec: str | int, n: int, k: int
) -> npt.NDArray[np.float32]:
    """Decodes a block payload into a new array.

    Args:
        payload: The compressed payload.
        codec: Codec name or id.
        n: Frames in the block.
        k: Floats per frame.

    Returns:
        Float32 array of shape ``[n, K]``.

    Raises:
        errors.FormatError: If the payload is corrupt or the codec unknown.
    """
    out = np.empty((n, k), np.float32)
    decode_block_into(payload, codec, out)
    return out


def decode_components(
    payload: Payload,
    codec: str | int,
    n: int,
    k: int,
    components: slice | npt.NDArray[np.intp],
) -> npt.NDArray[np.float32]:
    """Decodes only some components of a block payload.

    Payloads are component-major byte planes (spec 7.4), so after inflating,
    only the wanted planes are unshuffled and prefix-summed. Reading the 7
    floats of one body out of 140 is about 20 times less work than
    :func:`decode_block`. q16d quaternions are not renormalized.

    Args:
        payload: The compressed payload.
        codec: Codec name or id from the block header.
        n: Frames in the block.
        k: Floats per frame of the stream.
        components: The components to decode, as a slice or an index array.

    Returns:
        A new float32 array ``[n, c]``, ``c`` being the number of components.

    Raises:
        errors.FormatError: If the payload is corrupt or the codec unknown.
    """
    cid = codec_id(codec)
    raw = inflate(payload, payload_ulen(cid, n, k), "block payload")
    if cid == CODEC_F32S:
        planes = np.frombuffer(raw, np.uint8).reshape(4, k, n)[:, components]
        bits = np.empty((n, planes.shape[1]), np.uint32)
        unshuffle_into(planes, bits)
        delta_decode_inplace(bits)
        return bits.view(np.float32)
    lo = np.frombuffer(raw, np.float32, k, 0)[components]
    step = np.frombuffer(raw, np.float32, k, 4 * k)[components]
    planes = np.frombuffer(raw, np.uint8, 2 * k * n, 8 * k).reshape(2, k, n)
    planes = planes[:, components]
    q = np.empty((n, planes.shape[1]), np.uint16)
    unshuffle_into(planes, q)
    delta_decode_inplace(q)
    return dequantize(q, lo, step)


# --------------------------------------------------------------------------
# Mesh blobs (spec 6)
# --------------------------------------------------------------------------

MESH_MAGIC = b"SSMH"
MESH_MAJOR = 1
MESH_MINOR = 0
MESH_HEADER = struct.Struct("<4sHHIIIB3xII")
MESH_FLAG_NORMALS = 1
MESH_FLAG_UVS = 2


def _mesh_codec_id(codec: str | int) -> int:
    """Resolves a mesh codec name or id."""
    if isinstance(codec, str):
        if codec not in MESH_CODEC_IDS:
            raise errors.FormatError(f"unknown mesh codec {codec!r}")
        return MESH_CODEC_IDS[codec]
    if codec not in MESH_CODEC_IDS.values():
        raise errors.FormatError(f"unknown mesh codec id {codec}")
    return int(codec)


def _q16_axes(
    a: npt.NDArray[np.float32],
) -> tuple[bytes, bytes, npt.NDArray[np.uint8]]:
    """Quantizes ``[n, A]`` floats; returns lo bytes, step bytes, planes."""
    n, axes = a.shape
    if n == 0:
        lo = np.zeros(axes, np.float32)
        step = np.zeros(axes, np.float32)
        return lo.tobytes(), step.tobytes(), np.empty((2, axes, 0), np.uint8)
    lo, step = _q16_ranges(a)
    if not (np.isfinite(lo).all() and np.isfinite(step).all()):
        raise ValueError("q16 mesh cannot encode non-finite values")
    q = _quantize(a, lo, step)
    return lo.tobytes(), step.tobytes(), shuffle(delta_encode(q))


def _q16_axes_decode(
    raw: bytes, offset: int, n: int, axes: int
) -> tuple[npt.NDArray[np.float32], int]:
    """Decodes ``lo, step, planes`` at ``offset``; returns data and new end."""
    lo = np.frombuffer(raw, np.float32, axes, offset)
    step = np.frombuffer(raw, np.float32, axes, offset + 4 * axes)
    start = offset + 8 * axes
    size = 2 * axes * n
    planes = np.frombuffer(raw, np.uint8, size, start).reshape(2, axes, n)
    q = np.empty((n, axes), np.uint16)
    unshuffle_into(planes, q)
    delta_decode_inplace(q)
    return dequantize(q, lo, step), start + size


def encode_mesh(mesh: core.Mesh, codec: str | int = "raw") -> bytes:
    """Encodes a mesh into a full SSMH blob (header plus payload).

    Args:
        mesh: The mesh to encode.
        codec: ``"raw"`` (lossless, library storage) or ``"q16"`` (lossy
            export; normals are dropped).

    Returns:
        The blob bytes.

    Raises:
        ValueError: If a q16 mesh has non-finite vertices.
        errors.FormatError: If the codec is unknown.
    """
    cid = _mesh_codec_id(codec)
    v = np.ascontiguousarray(mesh.vertices, dtype=np.float32)
    f = np.ascontiguousarray(mesh.faces, dtype=np.uint32)
    uvs = mesh.uvs
    flags = MESH_FLAG_UVS if uvs is not None else 0
    comp = zlib.compressobj(DEFLATE_LEVEL, zlib.DEFLATED, -15)
    parts: list[bytes] = []
    ulen = 0

    def feed(data: bytes | npt.NDArray) -> None:
        nonlocal ulen
        ulen += memoryview(data).nbytes
        parts.append(comp.compress(data))

    if cid == MESH_RAW:
        feed(v)
        feed(f)
        if mesh.normals is not None:
            flags |= MESH_FLAG_NORMALS
            feed(np.ascontiguousarray(mesh.normals, dtype=np.float32))
        if uvs is not None:
            feed(np.ascontiguousarray(uvs, dtype=np.float32))
    else:
        lo, step, planes = _q16_axes(v)
        feed(lo)
        feed(step)
        feed(planes)
        fplanes = shuffle(delta_encode(f.reshape(-1, 1)))
        feed(fplanes)
        if uvs is not None:
            lo, step, planes = _q16_axes(
                np.ascontiguousarray(uvs, dtype=np.float32)
            )
            feed(lo)
            feed(step)
            feed(planes)
    parts.append(comp.flush())
    payload = b"".join(parts)
    header = MESH_HEADER.pack(
        MESH_MAGIC,
        MESH_MAJOR,
        MESH_MINOR,
        len(v),
        len(f),
        flags,
        cid,
        ulen,
        zlib.crc32(payload),
    )
    return header + payload


def decode_mesh(blob: Payload) -> core.Mesh:
    """Decodes a full SSMH blob into a mesh.

    Args:
        blob: The blob bytes (header plus payload).

    Returns:
        The mesh. A q16 blob has no normals.

    Raises:
        errors.FormatError: On a bad magic, unknown major version or codec,
            CRC mismatch, or corrupt payload.
    """
    view = memoryview(blob)
    if view.nbytes < MESH_HEADER.size:
        raise errors.FormatError("mesh blob shorter than its header")
    magic, major, _minor, nv, nf, flags, cid, ulen, crc = (
        MESH_HEADER.unpack_from(view, 0)
    )
    if magic != MESH_MAGIC:
        raise errors.FormatError(f"bad mesh magic {bytes(magic)!r}")
    if major != MESH_MAJOR:
        raise errors.FormatError(f"unknown mesh major version {major}")
    if cid not in MESH_CODEC_IDS.values():
        raise errors.FormatError(f"unknown mesh codec id {cid}")
    payload = view[MESH_HEADER.size :]
    if zlib.crc32(payload) != crc:
        raise errors.FormatError("mesh payload CRC mismatch")
    raw = inflate(payload, ulen, "mesh payload")
    normals = uvs = None
    if cid == MESH_RAW:
        pos = 0
        verts = np.frombuffer(raw, np.float32, 3 * nv, pos).reshape(nv, 3)
        pos += 12 * nv
        faces = np.frombuffer(raw, np.uint32, 3 * nf, pos).reshape(nf, 3)
        pos += 12 * nf
        if flags & MESH_FLAG_NORMALS:
            normals = np.frombuffer(raw, np.float32, 3 * nv, pos)
            normals = normals.reshape(nv, 3)
            pos += 12 * nv
        if flags & MESH_FLAG_UVS:
            uvs = np.frombuffer(raw, np.float32, 2 * nv, pos).reshape(nv, 2)
    else:
        verts, pos = _q16_axes_decode(raw, 0, nv, 3)
        planes = np.frombuffer(raw, np.uint8, 12 * nf, pos).reshape(
            4, 1, 3 * nf
        )
        pos += 12 * nf
        flat = np.empty((3 * nf, 1), np.uint32)
        unshuffle_into(planes, flat)
        delta_decode_inplace(flat)
        faces = flat.reshape(nf, 3)
        if flags & MESH_FLAG_UVS:
            uvs, _ = _q16_axes_decode(raw, pos, nv, 2)
    return core.Mesh(verts, faces, normals, uvs)
