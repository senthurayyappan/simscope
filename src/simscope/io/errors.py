"""Exceptions raised by the storage layer."""


class FormatError(ValueError):
    """Raised when bytes on disk are not a simscope file.

    Examples are a bad magic, an unknown major version, an unknown codec id,
    a CRC mismatch, or a truncated file.
    """
