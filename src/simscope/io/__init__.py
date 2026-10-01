"""Storage format reference implementation (format spec v1).

Modules:
    codecs: Block payload codecs (f32s, q16d) and mesh blobs (raw, q16).
    blockfile: ``BlockWriter``, ``BlockReader`` and ``recover``.
    cas: ``Ref`` and the content-addressed ``ContentStore``.
    scene: Canonical scene descriptors (``put_scene``, ``load_scene``).
    manifest: ``RolloutManifest``, ULIDs and run-name validation.
    pack: ``write_pack`` and ``PackReader``.
"""

from simscope.io import errors
from simscope.io.blockfile import BlockReader, BlockWriter, recover
from simscope.io.cas import ContentStore, Ref
from simscope.io.manifest import (
    RolloutManifest,
    StreamInfo,
    new_ulid,
    read_manifest,
    validate_run_name,
    write_manifest,
)
from simscope.io.pack import PackReader, write_pack
from simscope.io.scene import load_scene, put_scene

FormatError = errors.FormatError

__all__ = [
    "BlockReader",
    "BlockWriter",
    "ContentStore",
    "FormatError",
    "PackReader",
    "Ref",
    "RolloutManifest",
    "StreamInfo",
    "load_scene",
    "new_ulid",
    "put_scene",
    "read_manifest",
    "recover",
    "validate_run_name",
    "write_manifest",
    "write_pack",
]
