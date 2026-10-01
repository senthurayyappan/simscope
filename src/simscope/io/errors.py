"""Exceptions raised by the storage layer."""


class FormatError(ValueError):
    """Raised when bytes on disk do not follow the simscope format spec.

    Examples are a bad magic, an unknown major version, an unknown codec id,
    a CRC mismatch, or a truncated file.
    """
