"""Block files (``*.blk``, spec 7): writer, reader and crash recovery."""

import collections
import dataclasses
import math
import mmap
import os
import pathlib
import struct
import threading
import zlib
from collections.abc import Sequence
from types import TracebackType
from typing import BinaryIO

import numpy as np
import numpy.typing as npt

from simscope import core, transforms
from simscope.io import codecs, errors

FILE_MAGIC = b"SSBK"
BLOCK_MAGIC = b"SSBB"
MAJOR = 1
MINOR = 0
HEADER = struct.Struct("<4sHHII4IIIIIQII")
BLOCK_HEADER = struct.Struct("<4sB3xIIIIII")
DIR_DTYPE = np.dtype(
    [
        ("offset", "<u8"),
        ("env", "<u4"),
        ("t0", "<u4"),
        ("n", "<u4"),
        ("clen", "<u4"),
        ("ulen", "<u4"),
        ("codec", "u1"),
        ("reserved", "V3"),
    ]
)
_DIR_FIELDS = ("offset", "env", "t0", "n", "clen", "ulen", "codec")
HEADER_SIZE = 64
DEFAULT_BLOCK_FRAMES = 100
assert HEADER.size == HEADER_SIZE
assert BLOCK_HEADER.size == 32
assert DIR_DTYPE.itemsize == 32

_MAX_NDIM = 4
_PAD = bytes(8)


def _align8(offset: int) -> int:
    """Rounds ``offset`` up to a multiple of 8."""
    return (offset + 7) & ~7


@dataclasses.dataclass(frozen=True)
class Header:
    """Parsed block-file header (spec 7.1).

    Attributes:
        item_shape: Shape of one env-frame item.
        n_envs: Number of envs.
        n_frames: Total frames, 0 while recording.
        block_frames: Nominal frames per block.
        n_blocks: Number of blocks, 0 while recording.
        dir_offset: Directory offset, 0 while recording.
        dir_length: Directory length in bytes.
    """

    item_shape: tuple[int, ...]
    n_envs: int
    n_frames: int
    block_frames: int
    n_blocks: int
    dir_offset: int
    dir_length: int

    @property
    def k(self) -> int:
        """Floats per env per frame."""
        return math.prod(self.item_shape)

    def pack(self) -> bytes:
        """Serializes the header, including its CRC."""
        shape = [*self.item_shape, 0, 0, 0, 0][:_MAX_NDIM]
        head = HEADER.pack(
            FILE_MAGIC,
            MAJOR,
            MINOR,
            HEADER_SIZE,
            len(self.item_shape),
            *shape,
            self.n_envs,
            self.n_frames,
            self.block_frames,
            self.n_blocks,
            self.dir_offset,
            self.dir_length,
            0,
        )
        return head[:60] + struct.pack("<I", zlib.crc32(head[:60]))

    @classmethod
    def parse(cls, buf: bytes | memoryview) -> "Header":
        """Parses and validates a header.

        Args:
            buf: At least 64 bytes from the start of a block file.

        Returns:
            The header.

        Raises:
            errors.FormatError: On a short file, bad magic, unknown major
                version, CRC mismatch, or inconsistent fields.
        """
        if len(buf) < HEADER_SIZE:
            raise errors.FormatError("block file shorter than its header")
        fields = HEADER.unpack_from(buf, 0)
        magic, major = fields[0], fields[1]
        if magic != FILE_MAGIC:
            raise errors.FormatError(f"bad block file magic {magic!r}")
        if major != MAJOR:
            raise errors.FormatError(
                f"unknown block file major version {major}"
            )
        if zlib.crc32(buf[:60]) != fields[-1]:
            raise errors.FormatError("block file header CRC mismatch")
        header_size, ndim = fields[3], fields[4]
        if header_size != HEADER_SIZE or ndim > _MAX_NDIM:
            raise errors.FormatError("invalid block file header fields")
        shape = tuple(fields[5 : 5 + ndim])
        n_envs, n_frames, block_frames, n_blocks = fields[9:13]
        if 0 in shape or n_envs < 1 or block_frames < 1:
            raise errors.FormatError("invalid block file header fields")
        return cls(
            shape,
            n_envs,
            n_frames,
            block_frames,
            n_blocks,
            fields[13],
            fields[14],
        )


@dataclasses.dataclass(frozen=True)
class EncodedBlock:
    """One encoded block, ready to be written.

    Attributes:
        env: Env index.
        n: Frames in the block.
        codec: Codec id actually used.
        ulen: Uncompressed payload length.
        payload: Compressed payload.
    """

    env: int
    n: int
    codec: int
    ulen: int
    payload: bytes


def encode_window(
    window: npt.NDArray[np.float32], codec: str | int = "f32s"
) -> list[EncodedBlock]:
    """Encodes one time window into one block per env (pure, no file I/O).

    Args:
        window: Float32 array ``[n, n_envs, K]`` for frames ``t0..t0+n-1``.
        codec: Requested codec. q16d falls back to f32s per block when the
            block has non-finite values.

    Returns:
        Encoded blocks in env order.
    """
    n, n_envs, k = window.shape
    blocks = []
    for env in range(n_envs):
        cid, payload = codecs.encode_block_auto(window[:, env, :], codec)
        blocks.append(
            EncodedBlock(env, n, cid, codecs.payload_ulen(cid, n, k), payload)
        )
    return blocks


DirEntry = tuple[int, int, int, int, int, int, int]


def pack_window(
    t0: int, blocks: Sequence[EncodedBlock], offset: int
) -> tuple[bytes, list[DirEntry]]:
    """Serializes encoded blocks with headers and 8-byte alignment.

    Args:
        t0: First frame index of the window.
        blocks: Encoded blocks of the window, in env order.
        offset: File offset where the first block will start (aligned to 8).

    Returns:
        ``(data, entries)``: the bytes to write at ``offset`` (each block
        padded to 8 bytes) and the directory entries
        ``(offset, env, t0, n, clen, ulen, codec)`` of the blocks.
    """
    parts = []
    entries: list[DirEntry] = []
    pos = offset
    for b in blocks:
        clen = len(b.payload)
        pad = -(32 + clen) % 8
        head = BLOCK_HEADER.pack(
            BLOCK_MAGIC,
            b.codec,
            b.env,
            t0,
            b.n,
            clen,
            b.ulen,
            zlib.crc32(b.payload),
        )
        parts += [head, b.payload, _PAD[:pad]]
        entries.append((pos, b.env, t0, b.n, clen, b.ulen, b.codec))
        pos += 32 + clen + pad
    return b"".join(parts), entries


def _dir_bytes(entries: Sequence[DirEntry]) -> bytes:
    """Packs directory entries into the 32-byte on-disk records."""
    arr = np.zeros(len(entries), DIR_DTYPE)
    if entries:
        cols = np.array(entries, dtype=np.uint64).T
        for name, col in zip(_DIR_FIELDS, cols, strict=True):
            arr[name] = col
    return arr.tobytes()


class BlockWriter:
    """Writes one stream as a block file.

    ``append`` copies frames into a preallocated ``[block_frames, n_envs, K]``
    buffer. Each time it fills, the window is encoded (one block per env) and
    written. Leaving the ``with`` block normally calls :meth:`finalize`; on an
    exception the file is closed unfinished so :func:`recover` can salvage it.

    Attributes:
        path: Destination path.
        item_shape: Shape of one env-frame item.
        n_envs: Number of envs.
        kind: Stream kind (``"pose"`` streams get sign continuity).
        codec: Requested codec name.
        block_frames: Frames per block.
    """

    def __init__(
        self,
        path: os.PathLike[str] | str,
        *,
        item_shape: Sequence[int],
        n_envs: int,
        kind: core.StreamKind,
        codec: str = "f32s",
        block_frames: int = DEFAULT_BLOCK_FRAMES,
    ) -> None:
        """Creates the file and writes a provisional header.

        Args:
            path: Destination path (overwritten).
            item_shape: Shape of one env-frame item, at most 4 dims, all > 0.
            n_envs: Number of envs (at least 1).
            kind: Stream kind. ``"pose"`` requires a last dim of 7.
            codec: ``"f32s"`` (lossless) or ``"q16d"``.
            block_frames: Frames per block (at least 1).

        Raises:
            ValueError: If an argument is invalid.
            errors.FormatError: If the codec is unknown.
        """
        self.path = pathlib.Path(path)
        self.item_shape = tuple(int(d) for d in item_shape)
        self.n_envs = int(n_envs)
        self.kind = kind
        self.block_frames = int(block_frames)
        self._codec_id = codecs.codec_id(codec)
        self.codec = codecs.BLOCK_CODEC_NAMES[self._codec_id]
        if len(self.item_shape) > _MAX_NDIM or 0 in self.item_shape:
            raise ValueError(f"invalid item_shape {self.item_shape}")
        if self.n_envs < 1 or self.block_frames < 1:
            raise ValueError("n_envs and block_frames must be at least 1")
        if kind == "pose" and self.item_shape[-1:] != (core.POSE_DIM,):
            raise ValueError("pose streams need a last item dim of 7")
        self._k = math.prod(self.item_shape)
        self._buf = np.empty(
            (self.block_frames, self.n_envs, self._k), np.float32
        )
        self._fill = 0
        self._n_frames = 0
        self._prev_quat: npt.NDArray[np.float32] | None = None
        self._entries: list[DirEntry] = []
        self._offset = HEADER_SIZE
        self._finalized = False
        self._file: BinaryIO | None = open(self.path, "wb")  # noqa: SIM115
        self._file.write(self._header(0, 0, 0, 0).pack())
        self._file.flush()  # tailing readers see the header at once

    def _header(
        self, n_frames: int, n_blocks: int, dir_offset: int, dir_len: int
    ) -> Header:
        """Builds a header for the current stream parameters."""
        return Header(
            self.item_shape,
            self.n_envs,
            n_frames,
            self.block_frames,
            n_blocks,
            dir_offset,
            dir_len,
        )

    @property
    def n_frames(self) -> int:
        """Frames appended so far, including the unflushed window."""
        return self._n_frames + self._fill

    def append(self, frames: npt.ArrayLike) -> None:
        """Appends frames to the stream.

        Args:
            frames: Array ``[n, n_envs, *item_shape]`` with n at least 1.
                It is copied; the caller may reuse it.

        Raises:
            ValueError: If the shape is wrong or the writer is finalized.
        """
        if self._file is None or self._finalized:
            raise ValueError("writer is closed")
        a = np.asarray(frames, dtype=np.float32)
        want = (self.n_envs, *self.item_shape)
        if a.ndim != len(want) + 1 or a.shape[1:] != want or a.shape[0] < 1:
            raise ValueError(
                f"expected frames of shape [n>=1, {', '.join(map(str, want))}]"
                f", got {a.shape}"
            )
        a = a.reshape(a.shape[0], self.n_envs, self._k)
        pos = 0
        while pos < a.shape[0]:
            take = min(a.shape[0] - pos, self.block_frames - self._fill)
            dst = self._buf[self._fill : self._fill + take]
            dst[...] = a[pos : pos + take]
            if self.kind == "pose":
                self._fix_signs(dst)
            self._fill += take
            pos += take
            if self._fill == self.block_frames:
                self._flush()

    def _fix_signs(self, chunk: npt.NDArray[np.float32]) -> None:
        """Enforces quaternion sign continuity on a buffer chunk in place."""
        n = chunk.shape[0]
        q = chunk.reshape(n, self.n_envs, -1, core.POSE_DIM)[..., 3:]
        fixed = transforms.enforce_sign_continuity(q, self._prev_quat)
        q[...] = fixed
        self._prev_quat = fixed[-1].copy()

    def _flush(self) -> None:
        """Encodes and writes the buffered window."""
        if self._fill == 0 or self._file is None:
            return
        blocks = encode_window(self._buf[: self._fill], self._codec_id)
        self.write_encoded(self._n_frames, blocks)  # advances _n_frames
        self._fill = 0

    def write_encoded(self, t0: int, blocks: Sequence[EncodedBlock]) -> None:
        """Writes already-encoded blocks of one window.

        Advances the frame count, so ``finalize`` records it.

        Args:
            t0: First frame index of the window.
            blocks: One encoded block per env, in env order.
        """
        assert self._file is not None
        data, entries = pack_window(t0, blocks, self._offset)
        self._file.write(data)
        self._file.flush()  # a tailing reader sees the window right away
        self._entries += entries
        self._offset += len(data)
        if blocks:
            self._n_frames = max(self._n_frames, t0 + blocks[0].n)

    def finalize(self) -> None:
        """Flushes the last window, writes the directory and the header."""
        if self._finalized or self._file is None:
            return
        self._flush()
        directory = _dir_bytes(self._entries)
        self._file.write(directory)
        header = self._header(
            self._n_frames, len(self._entries), self._offset, len(directory)
        )
        self._file.seek(0)
        self._file.write(header.pack())
        self._file.close()
        self._file = None
        self._finalized = True

    def close(self) -> None:
        """Closes the file without finalizing (the file stays recoverable)."""
        if self._file is not None:
            self._file.close()
            self._file = None

    def __enter__(self) -> "BlockWriter":
        """Returns the writer."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        """Finalizes on success; on error closes and leaves it unfinished."""
        if exc_type is None:
            self.finalize()
        else:
            self.close()


def _renormalize_poses(block: npt.NDArray[np.float32]) -> None:
    """Renormalizes the quaternion of every pose in a ``[n, K]`` block."""
    q = block.reshape(block.shape[0], -1, core.POSE_DIM)[..., 3:]
    norm = np.sqrt(np.sum(q * q, axis=-1, keepdims=True))
    np.divide(q, norm, out=q, where=norm > 0)


class BlockReader:
    """Random-access reader for a block file.

    The file is memory-mapped. ``read`` decodes only the blocks that overlap
    the requested window and keeps the most recent decoded blocks in an LRU
    cache. Instances are safe to share between threads.

    With ``partial=True`` the reader can also tail a file that a
    :class:`BlockWriter` is still writing (spec 7.3, D14): it builds the
    directory by scanning blocks and :meth:`refresh` picks up windows
    appended later. It never writes to the file, and only complete windows
    whose CRCs check out are visible, so a window the writer is in the middle
    of writing is never returned.

    Attributes:
        n_frames: Total frames (the complete windows found so far, for a
            file that is still being written).
        n_envs: Number of envs.
        item_shape: Shape of one env-frame item.
        block_frames: Nominal frames per block.
        n_blocks: Number of blocks.
        directory: Structured array of directory entries (``DIR_DTYPE``).
    """

    def __init__(
        self,
        source: os.PathLike[str] | str | bytes | bytearray | memoryview,
        *,
        cache_blocks: int = 64,
        kind: core.StreamKind | None = None,
        verify: bool = True,
        partial: bool = False,
    ) -> None:
        """Opens a block file or an in-memory block file.

        Args:
            source: A path, or the file bytes (for example a pack entry).
            cache_blocks: Decoded blocks to keep in the LRU cache.
            kind: The stream kind from the manifest. For ``"pose"`` streams,
                quaternions of q16d blocks are renormalized (spec 7.4).
            verify: Check each block's payload CRC when it is decoded.
            partial: Accept an unfinished file (``dir_offset == 0``) by
                scanning its blocks. A finished file opens as usual.

        Raises:
            errors.FormatError: If the file is unfinished and ``partial`` is
                false (use :func:`recover`), or is corrupt, or uses an
                unknown version or codec.
        """
        self._mm: mmap.mmap | None = None
        self._view: memoryview | None = None
        self._path: pathlib.Path | None = None
        self._verify = verify
        self._kind = kind
        self._cache_blocks = max(0, int(cache_blocks))
        self._cache: collections.OrderedDict[int, npt.NDArray[np.float32]] = (
            collections.OrderedDict()
        )
        self._lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._scan: _ScanState | None = None
        self._head: Header | None = None
        self._dir_buf = np.empty(0, DIR_DTYPE)
        if isinstance(source, str | os.PathLike):
            self._path = pathlib.Path(source)
            with open(source, "rb") as f:
                if os.fstat(f.fileno()).st_size < HEADER_SIZE:
                    raise errors.FormatError(f"{source}: shorter than header")
                self._mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
            self._view = memoryview(self._mm)
        else:
            self._view = memoryview(source).cast("B")
        try:
            self._init_from_view(self._view, partial)
        except BaseException:
            self.close()
            raise

    @property
    def finished(self) -> bool:
        """True if the file has its directory (it will not grow)."""
        return self._scan is None

    def _init_from_view(self, view: memoryview, partial: bool) -> None:
        """Parses the header and directory and validates them."""
        h = Header.parse(view)
        self.item_shape = h.item_shape
        self.n_envs = h.n_envs
        self.block_frames = h.block_frames
        self._k = h.k
        if h.dir_offset == 0:
            if not partial:
                raise errors.FormatError(
                    "block file is unfinished (dir_offset == 0); "
                    "run simscope.io.blockfile.recover() first"
                )
            self._head = h
            self._scan = _ScanState()
            self.n_frames = 0
            self.n_blocks = 0
            self.directory = self._dir_buf
            self._scan_more(view)
            return
        self._install_finished(view, h)

    def _install_finished(self, view: memoryview, h: Header) -> None:
        """Validates the directory of a finished file and adopts it.

        The directory is published before the counts, so a concurrent
        ``read`` never sees a count that its directory does not cover.
        """
        end = h.dir_offset + h.dir_length
        if h.dir_length != 32 * h.n_blocks or end > len(view):
            raise errors.FormatError("block directory is truncated or invalid")
        d = np.frombuffer(view, DIR_DTYPE, h.n_blocks, h.dir_offset).copy()
        self._check_directory(d, len(view), h.n_frames, h.n_blocks)
        self.directory = d
        self.n_blocks = h.n_blocks
        self.n_frames = h.n_frames
        self._scan = None
        self._head = None
        self._dir_buf = np.empty(0, DIR_DTYPE)

    def _scan_more(self, view: memoryview) -> None:
        """Scans blocks appended since the last scan and publishes them."""
        st, h = self._scan, self._head
        assert st is not None and h is not None
        _advance(view, h, st)
        if not st.kept:
            return
        new = np.frombuffer(_dir_bytes(st.kept), DIR_DTYPE)
        st.kept = []
        n = self.n_blocks
        if n + len(new) > len(self._dir_buf):
            grown = np.empty(max(64, 2 * (n + len(new))), DIR_DTYPE)
            grown[:n] = self._dir_buf[:n]
            self._dir_buf = grown
        self._dir_buf[n : n + len(new)] = new
        self.directory = self._dir_buf[: n + len(new)]
        self.n_blocks = n + len(new)
        self.n_frames = st.frames

    def refresh(self) -> int:
        """Picks up windows appended to a file that is still being written.

        Re-reads the header and scans only the bytes after the last known
        good window, so the cost is proportional to the new data. When the
        writer has finalized the file, the reader switches to the finished
        directory. A finished file, or an in-memory source, is left as is.

        Returns:
            The number of frames now readable.

        Raises:
            errors.FormatError: If the file shrank, or a finished file has
                an invalid directory.
            ValueError: If the reader is closed.
        """
        if self._view is None:
            raise ValueError("reader is closed")
        if self._scan is None or self._path is None:
            return self.n_frames
        with self._refresh_lock:
            if self._scan is None:
                return self.n_frames
            head, size = self._read_tail_state(self._path)
            if size < self._scan.end:
                raise errors.FormatError(f"{self._path}: file shrank")
            if size != len(self._view):
                # Also when it shrank (a concurrent recover): never touch
                # mapped pages past the end of the file.
                self._remap()
            view = self._view
            assert view is not None
            if head is not None and head.dir_offset != 0:
                self._install_finished(view, head)
            else:
                self._scan_more(view)
        return self.n_frames

    def _read_tail_state(self, path: pathlib.Path) -> tuple[Header | None, int]:
        """Reads the header, then the size (in that order, see refresh).

        Returns:
            ``(header, size)``. The header is ``None`` if it cannot be
            parsed yet (a torn write); the next refresh retries.
        """
        with open(path, "rb") as f:
            raw = f.read(HEADER_SIZE)
            size = os.fstat(f.fileno()).st_size
        try:
            return Header.parse(raw), size
        except errors.FormatError:
            return None, size

    def _remap(self) -> None:
        """Maps the file again after its size changed.

        The old map is not closed: a concurrent ``read`` may still hold a
        slice of it, and it is unmapped when the last one goes away.
        """
        assert self._path is not None
        with open(self._path, "rb") as f:
            mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        self._view, self._mm = memoryview(mm), mm

    def _check_directory(
        self, d: npt.NDArray, size: int, n_frames: int, n_blocks: int
    ) -> None:
        """Validates the directory against the header, vectorized."""
        e, bf = self.n_envs, self.block_frames
        n_windows = -(-n_frames // bf)
        if n_blocks != n_windows * e:
            raise errors.FormatError("block count does not match n_frames")
        if not np.isin(d["codec"], list(codecs.BLOCK_CODEC_NAMES)).all():
            bad = sorted(
                set(d["codec"].tolist()) - set(codecs.BLOCK_CODEC_NAMES)
            )
            raise errors.FormatError(f"unknown block codec id {bad[0]}")
        idx = np.arange(n_blocks)
        t0 = (idx // e) * bf
        n = np.minimum(bf, n_frames - t0)
        k = self._k
        ulen = np.where(
            d["codec"] == codecs.CODEC_F32S, 4 * k * n, 8 * k + 2 * k * n
        )
        ok = (
            (d["env"] == idx % e).all()
            and (d["t0"] == t0).all()
            and (d["n"] == n).all()
            and (d["ulen"] == ulen).all()
            and (d["offset"] % 8 == 0).all()
            and (d["offset"] + 32 + d["clen"].astype(np.uint64) <= size).all()
        )
        if not ok:
            raise errors.FormatError("block directory is inconsistent")

    def _block(self, idx: int) -> npt.NDArray[np.float32]:
        """Returns the decoded block ``idx`` from the cache or the file."""
        with self._lock:
            hit = self._cache.get(idx)
            if hit is not None:
                self._cache.move_to_end(idx)
                return hit
        assert self._view is not None
        ent = self.directory[idx]
        off, clen, n = int(ent["offset"]), int(ent["clen"]), int(ent["n"])
        head = BLOCK_HEADER.unpack_from(self._view, off)
        if head[0] != BLOCK_MAGIC:
            raise errors.FormatError(f"bad block magic at offset {off}")
        codec = int(ent["codec"])
        if (head[1], head[2], head[3], head[4], head[5]) != (
            codec,
            ent["env"],
            ent["t0"],
            n,
            clen,
        ):
            raise errors.FormatError(
                f"block header at {off} disagrees with directory"
            )
        payload = self._view[off + 32 : off + 32 + clen]
        try:
            if self._verify and zlib.crc32(payload) != head[7]:
                raise errors.FormatError(f"block CRC mismatch at offset {off}")
            out = np.empty((n, self._k), np.float32)
            codecs.decode_block_into(payload, codec, out)
        finally:
            payload.release()
        if self._kind == "pose" and codec == codecs.CODEC_Q16D:
            _renormalize_poses(out)
        out.flags.writeable = False
        with self._lock:
            if self._cache_blocks:
                self._cache[idx] = out
                while len(self._cache) > self._cache_blocks:
                    self._cache.popitem(last=False)
        return out

    def read(
        self,
        t0: int,
        t1: int,
        envs: Sequence[int] | npt.NDArray[np.integer] | None = None,
    ) -> npt.NDArray[np.float32]:
        """Reads frames ``t0 <= t < t1``.

        Args:
            t0: First frame.
            t1: One past the last frame.
            envs: Env indices to read, or ``None`` for all envs.

        Returns:
            A new float32 array ``[t1 - t0, len(envs), *item_shape]``.

        Raises:
            IndexError: If the frame range or an env index is out of range.
            ValueError: If the reader is closed.
        """
        if self._view is None:
            raise ValueError("reader is closed")
        if not 0 <= t0 <= t1 <= self.n_frames:
            raise IndexError(
                f"frame range [{t0}, {t1}) outside [0, {self.n_frames}]"
            )
        env_ids = (
            np.arange(self.n_envs)
            if envs is None
            else np.asarray(envs, dtype=np.int64).reshape(-1)
        )
        if env_ids.size and (env_ids.min() < 0 or env_ids.max() >= self.n_envs):
            raise IndexError(f"env index outside [0, {self.n_envs})")
        out = np.empty((t1 - t0, env_ids.size, self._k), np.float32)
        bf = self.block_frames
        for w in range(t0 // bf, -(-t1 // bf)):
            lo, hi = max(t0, w * bf), min(t1, (w + 1) * bf)
            for j, env in enumerate(env_ids.tolist()):
                blk = self._block(w * self.n_envs + env)
                out[lo - t0 : hi - t0, j] = blk[lo - w * bf : hi - w * bf]
        return out.reshape(t1 - t0, env_ids.size, *self.item_shape)

    def close(self) -> None:
        """Releases the memory map. Safe to call more than once."""
        self._cache.clear()
        if self._view is not None:
            self._view.release()
            self._view = None
        if self._mm is not None:
            self._mm.close()
            self._mm = None

    def __enter__(self) -> "BlockReader":
        """Returns the reader."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        """Closes the reader."""
        self.close()


@dataclasses.dataclass(frozen=True)
class RecoverResult:
    """Outcome of :func:`recover`.

    Attributes:
        n_frames: Frames kept.
        n_blocks: Blocks kept.
        dropped_bytes: Bytes removed from the end of the file (partial
            blocks and incomplete windows).
        already_finished: True if the file already had a directory and was
            left untouched.
    """

    n_frames: int
    n_blocks: int
    dropped_bytes: int
    already_finished: bool = False


@dataclasses.dataclass
class _ScanState:
    """Resumable state of a walk over the blocks of an unfinished file.

    Attributes:
        off: Offset where the next block should start. It stays put at a
            block that fails validation, so a later scan retries it.
        end: Offset just after the last complete window.
        frames: Frames in the complete windows.
        env: Env of the next block within the current window.
        win_n: Frames in the current window (set by its first block).
        closed: True once a short window was kept: it can only be the last.
        kept: Entries of complete windows not yet taken by the caller.
        pending: Entries of the incomplete window being read.
    """

    off: int = HEADER_SIZE
    end: int = HEADER_SIZE
    frames: int = 0
    env: int = 0
    win_n: int = 0
    closed: bool = False
    kept: list[DirEntry] = dataclasses.field(default_factory=list)
    pending: list[DirEntry] = dataclasses.field(default_factory=list)


def _advance(view: memoryview, h: Header, st: _ScanState) -> None:
    """Continues a block walk, keeping only complete valid windows (spec 7.3).

    Checks each block's magic, lengths and CRC, and stops at the first one
    that fails or is not fully present yet. Only the bytes after ``st.off``
    are read.

    Args:
        view: The whole file as currently visible.
        h: The parsed header.
        st: Scan state, advanced in place.
    """
    off, env, win_n, frames = st.off, st.env, st.win_n, st.frames
    size = len(view)
    k = h.k
    while not st.closed and off + 32 <= size:
        (magic, codec, b_env, b_t0, n, clen, ulen, crc) = (
            BLOCK_HEADER.unpack_from(view, off)
        )
        stop = (
            magic != BLOCK_MAGIC
            or codec not in codecs.BLOCK_CODEC_NAMES
            or b_env != env
            or b_t0 != frames
            or not 1 <= n <= h.block_frames
            or (env > 0 and n != win_n)
            or ulen != codecs.payload_ulen(codec, n, k)
            or off + 32 + clen > size
        )
        if stop:
            break
        with view[off + 32 : off + 32 + clen] as payload:
            if zlib.crc32(payload) != crc:
                break
        st.pending.append((off, env, b_t0, n, clen, ulen, codec))
        win_n = n
        off = _align8(off + 32 + clen)
        if env == h.n_envs - 1:
            st.kept += st.pending
            st.pending = []
            frames += n
            st.end = off
            env = 0
            if n < h.block_frames:
                st.closed = True  # a short window can only be the last one
        else:
            env += 1
    st.off, st.env, st.win_n, st.frames = off, env, win_n, frames


def _scan_blocks(
    view: memoryview, h: Header
) -> tuple[list[DirEntry], int, int]:
    """Walks blocks from offset 64 and keeps only complete valid windows.

    Args:
        view: The whole file.
        h: The parsed header.

    Returns:
        ``(entries, n_frames, end_offset)`` for the complete windows. A
        window is complete when all envs have a valid block.
    """
    st = _ScanState()
    _advance(view, h, st)
    return st.kept, st.frames, st.end


def recover(path: os.PathLike[str] | str) -> RecoverResult:
    """Rebuilds the directory of an unfinished block file (spec 7.3).

    Walks blocks from offset 64, keeps every complete time window (a block
    for every env) whose header and CRC check out, truncates the rest, then
    appends the directory and rewrites the header. A finished file is left
    untouched.

    Args:
        path: The block file.

    Returns:
        What was kept and dropped.

    Raises:
        errors.FormatError: If the file header is missing or corrupt.
    """
    path = pathlib.Path(path)
    with open(path, "r+b") as f:
        size = os.fstat(f.fileno()).st_size
        if size < HEADER_SIZE:
            raise errors.FormatError(f"{path}: shorter than header")
        with mmap.mmap(f.fileno(), 0) as mm, memoryview(mm) as view:
            h = Header.parse(view)
            if h.dir_offset != 0:
                blocks = h.n_blocks
                return RecoverResult(h.n_frames, blocks, 0, True)
            entries, frames, end = _scan_blocks(view, h)
        dropped = max(0, size - end)
        f.truncate(end)
        directory = _dir_bytes(entries)
        f.seek(end)
        f.write(directory)
        header = dataclasses.replace(
            h,
            n_frames=frames,
            n_blocks=len(entries),
            dir_offset=end,
            dir_length=len(directory),
        )
        f.seek(0)
        f.write(header.pack())
    return RecoverResult(frames, len(entries), dropped)
