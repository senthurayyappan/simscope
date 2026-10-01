"""Content-addressed storage for assets and scenes."""

import dataclasses
import hashlib
import os
import pathlib
import re
import threading
import time
import uuid
from collections.abc import Callable
from typing import Any, Literal

from simscope.io import errors

_HEX_RE = re.compile(r"^[0-9a-f]{64}$")

Kind = Literal["asset", "scene"]
_KIND_DIRS: dict[str, tuple[str, str]] = {
    "asset": ("assets", ""),
    "scene": ("scenes", ".json"),
}


@dataclasses.dataclass(frozen=True)
class Ref:
    """A reference to a content-addressed file.

    Attributes:
        sha256: 64-character lowercase hex SHA-256 of the file bytes.
        size: File size in bytes.
    """

    sha256: str
    size: int

    def __post_init__(self) -> None:
        """Validates the hash and size.

        Raises:
            ValueError: If ``sha256`` is not 64 lowercase hex characters or
                ``size`` is negative.
        """
        if not _HEX_RE.match(self.sha256):
            raise ValueError(f"invalid sha256 {self.sha256!r}")
        if self.size < 0:
            raise ValueError(f"invalid size {self.size}")

    def to_json(self) -> dict[str, Any]:
        """Returns the spec's ``{"sha256", "size"}`` object."""
        return {"sha256": self.sha256, "size": self.size}

    @classmethod
    def from_json(cls, obj: dict[str, Any]) -> "Ref":
        """Parses a reference object, ignoring unknown fields.

        Args:
            obj: A mapping with ``sha256`` and ``size``.

        Returns:
            The reference.

        Raises:
            errors.FormatError: If a field is missing or malformed.
        """
        try:
            return cls(str(obj["sha256"]), int(obj["size"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise errors.FormatError(f"bad content reference: {obj!r}") from exc

    @classmethod
    def of(cls, data: bytes | bytearray | memoryview) -> "Ref":
        """Computes the reference of some bytes.

        Args:
            data: The file contents.

        Returns:
            The reference.
        """
        return cls(hashlib.sha256(data).hexdigest(), memoryview(data).nbytes)


def create_temp(directory: pathlib.Path) -> tuple[int, str]:
    """Creates a temporary file next to its final destination.

    Unlike ``tempfile.mkstemp`` the mode honors the umask (0666 & ~umask), so
    published files are readable like any other file.

    Args:
        directory: Directory of the destination file.

    Returns:
        ``(fd, path)`` of the new file, opened for writing.
    """
    while True:
        name = str(directory / f".tmp-{uuid.uuid4().hex}")
        try:
            return os.open(
                name, os.O_CREAT | os.O_EXCL | os.O_WRONLY | _BINARY, 0o666
            ), name
        except FileExistsError:
            continue


_BINARY = getattr(os, "O_BINARY", 0)
"""Windows opens descriptors in text mode unless asked; 0 elsewhere."""

_RETRY_SECONDS = 2.0
"""How long a replace or delete keeps retrying while a reader holds the file."""

_read_lock = threading.Lock()


def open_read(path: os.PathLike[str] | str) -> int:
    """Opens a file for reading as a raw descriptor, in binary mode.

    Args:
        path: The file.

    Returns:
        A file descriptor. Close it with ``os.close``.
    """
    return os.open(path, os.O_RDONLY | _BINARY)


def read_at(fd: int, size: int, offset: int) -> bytes:
    """Reads ``size`` bytes at ``offset`` without moving a shared position.

    Uses ``os.pread`` where it exists. Windows has none, so there the seek
    and the read happen under one lock.

    Args:
        fd: A descriptor from :func:`open_read`.
        size: Bytes to read.
        offset: Where to start.

    Returns:
        The bytes read (fewer than ``size`` at the end of the file).
    """
    if hasattr(os, "pread"):
        return os.pread(fd, size, offset)
    with _read_lock:  # pragma: no cover - Windows only
        os.lseek(fd, offset, os.SEEK_SET)
        return os.read(fd, size)


def _retry_while_open(action: Callable[[], object]) -> None:
    """Runs ``action``, retrying briefly on Windows' sharing violations.

    Windows refuses to replace or delete a file that another handle has open,
    for example a viewer reading a manifest that the recorder rewrites. The
    other side only holds it for a moment, so a short retry is enough.
    """
    deadline = time.monotonic() + _RETRY_SECONDS
    delay = 0.002
    while True:
        try:
            action()
            return
        except PermissionError:
            if os.name != "nt" or time.monotonic() >= deadline:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 0.05)


def replace_file(
    src: os.PathLike[str] | str, dst: os.PathLike[str] | str
) -> None:
    """Moves ``src`` over ``dst`` atomically, waiting out Windows readers.

    Args:
        src: The new file.
        dst: The file to replace.
    """
    _retry_while_open(lambda: os.replace(src, dst))


def remove_file(path: os.PathLike[str] | str) -> None:
    """Deletes a file if it exists, waiting out Windows readers.

    Args:
        path: The file.
    """
    _retry_while_open(lambda: pathlib.Path(path).unlink(missing_ok=True))


def atomic_write(path: os.PathLike[str] | str, data: bytes) -> None:
    """Writes a file atomically: temp file in the same directory, then rename.

    Args:
        path: Destination. Parent directories are created.
        data: File contents.
    """
    target = pathlib.Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = create_temp(target.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        replace_file(tmp_name, target)
    except BaseException:
        pathlib.Path(tmp_name).unlink(missing_ok=True)
        raise


class ContentStore:
    """A directory of immutable files named by their SHA-256.

    Assets live at ``assets/<h0h1>/<hex>`` and scene descriptors at
    ``scenes/<h0h1>/<hex>.json`` under the library root.

    Attributes:
        root: The library root directory.
    """

    def __init__(self, root: os.PathLike[str] | str) -> None:
        """Creates a store handle. Nothing is created on disk until a put.

        Args:
            root: The library root.
        """
        self.root = pathlib.Path(root)

    def path(self, ref: Ref, kind: Kind = "asset") -> pathlib.Path:
        """Returns the file path for a reference.

        Args:
            ref: The content reference.
            kind: ``"asset"`` (meshes, textures) or ``"scene"``.

        Returns:
            The path, which may not exist.
        """
        subdir, suffix = _KIND_DIRS[kind]
        return self.root / subdir / ref.sha256[:2] / (ref.sha256 + suffix)

    def put(
        self, data: bytes | bytearray | memoryview, kind: Kind = "asset"
    ) -> Ref:
        """Stores bytes, skipping the write if the target already exists.

        Args:
            data: The file contents.
            kind: ``"asset"`` or ``"scene"``.

        Returns:
            The reference to the stored file.
        """
        ref = Ref.of(data)
        target = self.path(ref, kind)
        if not target.exists():
            atomic_write(target, bytes(data))
        return ref

    def has(self, ref: Ref, kind: Kind = "asset") -> bool:
        """Tells whether a file is present.

        Args:
            ref: The content reference.
            kind: ``"asset"`` or ``"scene"``.

        Returns:
            True if the file exists.
        """
        return self.path(ref, kind).is_file()

    def get(
        self, ref: Ref, kind: Kind = "asset", *, verify: bool = False
    ) -> bytes:
        """Reads a file and checks its size.

        Args:
            ref: The content reference.
            kind: ``"asset"`` or ``"scene"``.
            verify: Also check the SHA-256.

        Returns:
            The file contents.

        Raises:
            FileNotFoundError: If the file is missing.
            errors.FormatError: If the size or hash does not match.
        """
        data = self.path(ref, kind).read_bytes()
        if len(data) != ref.size:
            raise errors.FormatError(
                f"size mismatch for {ref.sha256}: file has {len(data)} "
                f"bytes, reference says {ref.size}"
            )
        if verify and hashlib.sha256(data).hexdigest() != ref.sha256:
            raise errors.FormatError(f"hash mismatch for {ref.sha256}")
        return data
