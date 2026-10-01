"""Raw block access for ``/api/blk`` and ``/api/blocks`` (contracts 2).

The server never decodes a block. A :class:`simscope.io.blockfile.BlockReader`
supplies the header and directory (and follows a file that is still being
written, scanning only the bytes added since the last request); the block
bytes themselves are sliced out of the file with ``pread``.
"""

import collections
import os
import pathlib
import threading
from collections.abc import Sequence

import numpy as np

from simscope.io import blockfile, cas, errors

MAX_ENVS = 256
"""Most envs one ``/api/blocks`` request may ask for."""
_MAX_OPEN = 64
_BLOCK_HEAD = 32

Signature = tuple[int, int, int]
"""``(inode, size, mtime_ns)`` of a block file."""


def signature(path: pathlib.Path) -> Signature:
    """Returns ``(inode, size, mtime_ns)``, raising if the file is missing."""
    st = os.stat(path)
    return st.st_ino, st.st_size, st.st_mtime_ns


class _Entry:
    """An open reader and the file signature it last saw."""

    def __init__(self, reader: blockfile.BlockReader, sig: Signature) -> None:
        self.reader = reader
        self.sig = sig
        self.lock = threading.Lock()


class BlockStore:
    """Keeps block files open so a window request costs one ``stat``."""

    def __init__(self) -> None:
        """Creates an empty store."""
        self._entries: collections.OrderedDict[str, _Entry] = (
            collections.OrderedDict()
        )
        self._lock = threading.Lock()

    def reader(self, path: pathlib.Path) -> tuple[blockfile.BlockReader, str]:
        """Returns an up-to-date reader of a block file.

        A finished file is opened once and reopened if the file is replaced.
        An unfinished one is refreshed in place, which costs time
        proportional to what the recorder appended.

        Args:
            path: The block file.

        Returns:
            ``(reader, etag)``. The etag changes whenever the readable
            content does.

        Raises:
            FileNotFoundError: If the file is missing or has no header yet.
            errors.FormatError: If the file is corrupt.
        """
        key = str(path)
        sig = signature(path)
        if sig[1] < blockfile.HEADER_SIZE:
            # The recorder has created the file but not written its header.
            raise FileNotFoundError(path)
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None:
                self._entries.move_to_end(key)
        if entry is None or (
            entry.sig != sig
            and (entry.reader.finished or sig[0] != entry.sig[0])
        ):
            entry = self._open(key, path, sig)
        elif entry.sig != sig:
            with entry.lock:
                try:
                    entry.reader.refresh()
                except errors.FormatError:
                    entry = self._open(key, path, sig)
                else:
                    entry.sig = sig
        reader = entry.reader
        etag = f'W/"{sig[0]:x}-{sig[1]:x}-{sig[2]:x}-{reader.n_blocks}"'
        return reader, etag

    def _open(self, key: str, path: pathlib.Path, sig: Signature) -> _Entry:
        """Opens (or reopens) a file and stores the entry."""
        reader = blockfile.BlockReader(
            path, cache_blocks=0, verify=False, partial=True
        )
        entry = _Entry(reader, sig)
        with self._lock:
            old = self._entries.pop(key, None)
            self._entries[key] = entry
            while len(self._entries) > _MAX_OPEN:
                self._entries.popitem(last=False)
        if old is not None and old.reader is not reader:
            old.reader.close()
        return entry

    def close(self) -> None:
        """Closes every open file."""
        with self._lock:
            entries, self._entries = (
                list(self._entries.values()),
                (collections.OrderedDict()),
            )
        for entry in entries:
            entry.reader.close()


def index_bytes(reader: blockfile.BlockReader) -> bytes:
    """Builds the body of ``/api/blk``: the header, then the directory.

    The reply is shaped like a finished block file that has had its blocks
    cut out: a valid 64-byte header (``dir_offset`` is 64, so the directory
    follows at once) and ``n_blocks`` 32-byte directory entries whose offsets
    still point into the real file. For a file that is still being written
    the counts cover complete windows only. ``fmt.parseBlk`` reads it as is.

    Args:
        reader: An up-to-date reader.

    Returns:
        The bytes.
    """
    d = reader.directory
    n_blocks = min(reader.n_blocks, len(d))
    head = blockfile.Header(
        reader.item_shape,
        reader.n_envs,
        reader.n_frames,
        reader.block_frames,
        n_blocks,
        blockfile.HEADER_SIZE,
        32 * n_blocks,
    )
    return head.pack() + d[:n_blocks].tobytes()


def read_blocks(
    reader: blockfile.BlockReader,
    path: pathlib.Path,
    window: int,
    envs: Sequence[int],
) -> list[bytes] | None:
    """Slices the raw ``SSBB`` blocks of one window out of the file.

    Args:
        reader: An up-to-date reader of ``path``.
        path: The block file.
        window: Window index (frames ``window * block_frames`` onward).
        envs: Env indices, in the order wanted.

    Returns:
        One ``bytes`` per env (the 32-byte block header plus payload), or
        ``None`` if the window is not complete yet.

    Raises:
        IndexError: If an env is out of range.
    """
    n_envs = reader.n_envs
    d = reader.directory
    n_blocks = min(reader.n_blocks, len(d))
    if window < 0 or (window + 1) * n_envs > n_blocks:
        return None
    ids = np.asarray(envs, np.int64)
    if ids.size and (ids.min() < 0 or ids.max() >= n_envs):
        raise IndexError("env out of range")
    rows = d[window * n_envs + ids]
    offsets = rows["offset"].tolist()
    lengths = (rows["clen"].astype(np.int64) + _BLOCK_HEAD).tolist()
    fd = cas.open_read(path)
    try:
        return [
            cas.read_at(fd, n, off)
            for off, n in zip(offsets, lengths, strict=True)
        ]
    finally:
        os.close(fd)
