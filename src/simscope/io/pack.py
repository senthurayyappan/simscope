"""Packs (``*.simscope``): one file holding a library subtree."""

import contextlib
import dataclasses
import json
import mmap
import os
import pathlib
import shutil
import struct
import tempfile
import zlib
from collections.abc import Mapping, Sequence
from types import TracebackType
from typing import BinaryIO

from simscope import core, discover
from simscope.io import blockfile, cas, codecs, errors, manifest, scene

MAGIC = b"SSPK"
MAJOR = 1
MINOR = 0
MINOR_DERIVED = 1
"""Minor version of a pack that carries ``derived/`` entries."""
DERIVED_PREFIX = "derived/"
HEADER = struct.Struct("<4sHHIIQII")
HEADER_SIZE = 32
ANNOTATIONS_NAME = "annotations.json"
POSTER_NAME = "poster.png"
assert HEADER.size == HEADER_SIZE

_COPY_CHUNK = 1 << 20
_MESH_CODEC_OFFSET = 20

Source = bytes | pathlib.Path


def asset_path(ref: cas.Ref) -> str:
    """Pack path of an asset blob."""
    return f"assets/{ref.sha256[:2]}/{ref.sha256}"


def scene_path(ref: cas.Ref) -> str:
    """Pack path of a scene descriptor."""
    return f"scenes/{ref.sha256[:2]}/{ref.sha256}.json"


@dataclasses.dataclass
class _Collector:
    """Accumulates pack entries and caches per-library transcodes."""

    store: cas.ContentStore
    transcode: bool
    entries: dict[str, Source] = dataclasses.field(default_factory=dict)
    scene_map: dict[cas.Ref, cas.Ref] = dataclasses.field(default_factory=dict)
    mesh_map: dict[cas.Ref, cas.Ref] = dataclasses.field(default_factory=dict)

    def add_asset(
        self, ref: cas.Ref, store: cas.ContentStore | None = None
    ) -> None:
        """Adds an asset blob unchanged.

        Args:
            ref: The asset reference.
            store: Content store to read, or this collector's store.
        """
        source = self.store if store is None else store
        self.entries[asset_path(ref)] = source.get(ref)

    def add_mesh(
        self, ref: cas.Ref, store: cas.ContentStore | None = None
    ) -> cas.Ref:
        """Adds a mesh blob, transcoding raw meshes to q16 if requested.

        Args:
            ref: The mesh reference.
            store: Content store to read, or this collector's store.

        Returns:
            The reference of the blob that was stored in the pack.
        """
        if ref in self.mesh_map:
            return self.mesh_map[ref]
        source = self.store if store is None else store
        blob = source.get(ref)
        if self.transcode and blob[_MESH_CODEC_OFFSET] == codecs.MESH_RAW:
            blob = codecs.encode_mesh(codecs.decode_mesh(blob), "q16")
        new = cas.Ref.of(blob)
        self.entries[asset_path(new)] = blob
        self.mesh_map[ref] = new
        return new

    def add_scene(
        self, ref: cas.Ref, store: cas.ContentStore | None = None
    ) -> cas.Ref:
        """Adds a scene descriptor with its meshes and textures.

        Args:
            ref: The scene reference.
            store: Content store to read, or this collector's store.

        Returns:
            The reference of the descriptor stored in the pack (new when
            meshes were transcoded).
        """
        if ref in self.scene_map:
            return self.scene_map[ref]
        source = self.store if store is None else store
        data = source.get(ref, "scene")
        doc = json.loads(data)
        for tex in doc.get("textures", []):
            self.add_asset(cas.Ref.from_json(tex), source)
        changed = False
        for mesh in doc.get("meshes", []):
            old = cas.Ref.from_json(mesh)
            new = self.add_mesh(old, source)
            if new != old:
                mesh.update(new.to_json())
                changed = True
        if changed:
            data = scene.canonical_bytes(doc)
        new_ref = cas.Ref.of(data)
        self.entries[scene_path(new_ref)] = data
        self.scene_map[ref] = new_ref
        return new_ref


def transcode_stream(
    src: os.PathLike[str] | str,
    dst: os.PathLike[str] | str,
    codec: str = "q16d",
    *,
    kind: core.StreamKind = "pose",
    envs: Sequence[int] | None = None,
) -> None:
    """Re-encodes a block file window by window (bounded memory).

    Args:
        src: Source block file.
        dst: Destination block file.
        codec: Target codec.
        kind: Stream kind, which selects quaternion sign handling.
        envs: Keep only these envs, in this order (env ``i`` of the output
            is env ``envs[i]`` of the source). ``None`` keeps all.
    """
    with blockfile.BlockReader(src, cache_blocks=0) as r:
        n_out = r.n_envs if envs is None else len(envs)
        with blockfile.BlockWriter(
            dst,
            item_shape=r.item_shape,
            n_envs=n_out,
            kind=kind,
            codec=codec,
            block_frames=r.block_frames,
        ) as w:
            for t0 in range(0, r.n_frames, r.block_frames):
                w.append(r.read(t0, min(t0 + r.block_frames, r.n_frames), envs))


def check_envs(envs: Sequence[int], n_envs: int, what: str) -> list[int]:
    """Validates an env subset against a run.

    Args:
        envs: Env indices to keep.
        n_envs: Number of envs the run has.
        what: Run name, for the error message.

    Returns:
        The indices as a list of ints.

    Raises:
        ValueError: If the list is empty, repeats an index, or names an env
            the run does not have.
    """
    ids = [int(e) for e in envs]
    if not ids:
        raise ValueError("envs must not be empty")
    if len(set(ids)) != len(ids):
        raise ValueError("envs must not repeat an index")
    bad = [e for e in ids if not 0 <= e < n_envs]
    if bad:
        raise ValueError(
            f"run {what!r} has {n_envs} envs, but envs asks for {bad[:3]}"
        )
    return ids


def subset_annotations(data: bytes, envs: Sequence[int]) -> bytes:
    """Restricts an ``annotations.json`` to an env subset.

    Events and spatial annotations of envs that are kept follow them to
    their new index; those of other envs are dropped. Records without an
    env (``null``) stay. Unknown fields are preserved.

    Args:
        data: The sidecar bytes.
        envs: Kept envs, in output order.

    Returns:
        The sidecar bytes, with only the kept envs.
    """
    doc = json.loads(data)
    new = {env: i for i, env in enumerate(envs)}
    for key in ("events", "spatial"):
        kept = []
        for rec in doc.get(key, []):
            env = rec.get("env")
            if env is None:
                kept.append(rec)
            elif env in new:
                kept.append({**rec, "env": new[env]})
        if key in doc:
            doc[key] = kept
    text = json.dumps(doc, indent=2, sort_keys=True, ensure_ascii=False)
    return (text + "\n").encode("utf-8")


def _source_codec(path: pathlib.Path) -> str:
    """Names the codec to keep when re-encoding a block file unchanged."""
    return "q16d" if _only_q16d(path) else "f32s"


def _only_q16d(path: pathlib.Path) -> bool:
    """Tells whether every block of a finished block file is q16d."""
    with blockfile.BlockReader(path, cache_blocks=0) as r:
        return bool((r.directory["codec"] == codecs.CODEC_Q16D).all())


def _write_entries(
    out: BinaryIO, entries: dict[str, Source]
) -> list[dict[str, str | int]]:
    """Writes entry bytes (aligned to 8) and returns directory records."""
    records: list[dict[str, str | int]] = []
    for path in sorted(entries):
        src = entries[path]
        out.write(bytes(-out.tell() % 8))
        offset = out.tell()
        if isinstance(src, bytes):
            out.write(src)
        else:
            with open(src, "rb") as f:
                shutil.copyfileobj(f, out, _COPY_CHUNK)
        records.append(
            {"path": path, "offset": offset, "length": out.tell() - offset}
        )
    return records


def write_pack(
    library_root: os.PathLike[str] | str,
    run_names: list[str],
    out_path: os.PathLike[str] | str,
    *,
    transcode: bool = True,
    annotations: bool = True,
    posters: bool = True,
    envs: Sequence[int] | None = None,
    derived: Mapping[str, Source] | None = None,
) -> pathlib.Path:
    """Writes runs and everything they reference into one pack file.

    With ``transcode=True`` (the export default), pose streams are re-encoded
    with ``q16d``, raw meshes are re-encoded as q16, and scenes are rewritten
    with the new mesh references (so their hashes change). Other streams and
    textures are copied unchanged. Each asset is stored once, however many
    runs share it. The library is not modified.

    Args:
        library_root: The library directory, or a folder that contains
            libraries. A run is taken from the nested library that holds it
            when it is not a direct child of ``library_root/runs``.
        run_names: Runs to include (each must be complete).
        out_path: The pack file to write (replaced atomically).
        transcode: Whether to shrink the pack as described above.
        annotations: Whether to include each run's ``annotations.json``.
        posters: Whether to include each run's ``poster.png``.
        envs: Keep only these envs of every run, in this order. Streams are
            re-encoded for them (the source codec, or q16d poses with
            ``transcode``), ``env_origins`` and ``env_scenes`` are cut to
            them, and the events of other envs leave ``annotations.json``.
        derived: Extra entries by pack path, all under ``derived/``
            (contracts 1). A pack that has any records minor version 1.

    Returns:
        The output path.

    Raises:
        ValueError: On duplicate run names, a run that is still recording,
            an invalid ``envs`` for a run, or a ``derived`` path outside
            ``derived/``.
        FileNotFoundError: If a run or referenced file is missing.
    """
    root = pathlib.Path(library_root)
    out_path = pathlib.Path(out_path)
    if len(set(run_names)) != len(run_names):
        raise ValueError("duplicate run names")
    for path in derived or {}:
        if not path.startswith(DERIVED_PREFIX) or ".." in path.split("/"):
            raise ValueError(f"derived entries live under derived/: {path!r}")
    col = _Collector(cas.ContentStore(root), transcode)
    found = discover.by_name(root)
    stores = {root: col.store}
    with tempfile.TemporaryDirectory(prefix="simscope-pack-") as tmp_name:
        tmp = pathlib.Path(tmp_name)
        for name in run_names:
            hit = found.get(name)
            lib_root = root if hit is None else hit.library
            store = stores.get(lib_root)
            if store is None:
                store = cas.ContentStore(lib_root)
                stores[lib_root] = store
            _add_run(
                col,
                lib_root,
                manifest.validate_run_name(name),
                tmp,
                sidecars=_sidecars(annotations=annotations, posters=posters),
                envs=envs,
                store=store,
            )
        col.entries.update(derived or {})
        out_path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_out = cas.create_temp(out_path.parent)
        try:
            with os.fdopen(fd, "wb") as out:
                out.write(bytes(HEADER_SIZE))
                records = _write_entries(out, col.entries)
                out.write(bytes(-out.tell() % 8))
                dir_offset = out.tell()
                directory = json.dumps(
                    {"entries": records},
                    separators=(",", ":"),
                    ensure_ascii=False,
                ).encode("utf-8")
                out.write(directory)
                out.seek(0)
                out.write(
                    HEADER.pack(
                        MAGIC,
                        MAJOR,
                        MINOR_DERIVED if derived else MINOR,
                        len(records),
                        0,
                        dir_offset,
                        len(directory),
                        zlib.crc32(directory),
                    )
                )
            os.replace(tmp_out, out_path)
        except BaseException:
            pathlib.Path(tmp_out).unlink(missing_ok=True)
            raise
    return out_path


def _sidecars(*, annotations: bool, posters: bool) -> tuple[str, ...]:
    """Names the optional per-run files a pack should carry."""
    names = []
    if annotations:
        names.append(ANNOTATIONS_NAME)
    if posters:
        names.append(POSTER_NAME)
    return tuple(names)


def _add_run(
    col: _Collector,
    root: pathlib.Path,
    name: str,
    tmp: pathlib.Path,
    *,
    sidecars: tuple[str, ...],
    envs: Sequence[int] | None = None,
    store: cas.ContentStore | None = None,
) -> None:
    """Collects the entries of one run, plus the named sidecar files.

    Args:
        col: Pack entry collector.
        root: Library root that owns the run.
        name: Run name, already validated.
        tmp: Scratch folder for transcoded streams.
        sidecars: Optional per-run files to copy.
        envs: Env subset, or ``None`` for every env.
        store: Content store of ``root``. The collector's store when omitted.
    """
    run_dir = root / "runs" / name
    if not (run_dir / manifest.MANIFEST_NAME).exists():
        if (run_dir / manifest.PARTIAL_NAME).exists():
            raise ValueError(f"run {name!r} is still recording")
        raise FileNotFoundError(run_dir / manifest.MANIFEST_NAME)
    man = manifest.read_manifest(run_dir)
    if man.name != name:
        raise errors.FormatError(f"manifest name {man.name!r} != dir {name!r}")
    if envs is not None:
        ids = check_envs(envs, man.n_envs, name)
        man.n_envs = len(ids)
        if man.env_origins is not None:
            man.env_origins = tuple(man.env_origins[i] for i in ids)
        if man.env_scenes is not None:
            man.env_scenes = tuple(man.env_scenes[i] for i in ids)
    else:
        ids = None
    man.scene = col.add_scene(man.scene, store)
    if man.env_scenes is not None:
        man.env_scenes = tuple(col.add_scene(r, store) for r in man.env_scenes)
    prefix = f"runs/{name}/"
    col.entries[prefix + manifest.MANIFEST_NAME] = manifest.manifest_bytes(man)
    for stream in man.streams.values():
        src = run_dir / stream.file
        pose = col.transcode and stream.kind == "pose"
        if ids is not None or (pose and not _only_q16d(src)):
            dst = tmp / f"{name}-{stream.file}"
            codec = "q16d" if pose else _source_codec(src)
            transcode_stream(src, dst, codec, kind=stream.kind, envs=ids)
            src = dst
        col.entries[prefix + stream.file] = src
    for sidecar in sidecars:
        path = run_dir / sidecar
        if path.is_file():
            data = path.read_bytes()
            if ids is not None and sidecar == ANNOTATIONS_NAME:
                data = subset_annotations(data, ids)
            col.entries[prefix + sidecar] = data


class PackReader:
    """Read access to a pack, from a file (memory-mapped) or from bytes.

    ``read`` returns zero-copy memoryview slices of the pack. Close readers
    opened with :meth:`stream` before closing the pack.
    """

    def __init__(
        self, source: os.PathLike[str] | str | bytes | bytearray | memoryview
    ) -> None:
        """Opens a pack and reads its directory.

        Args:
            source: A path, or the pack bytes.

        Raises:
            errors.FormatError: On a bad magic, unknown major version, CRC
                mismatch or invalid directory.
        """
        self._mm: mmap.mmap | None = None
        self._view: memoryview | None = None
        if isinstance(source, str | os.PathLike):
            with open(source, "rb") as f:
                if os.fstat(f.fileno()).st_size < HEADER_SIZE:
                    raise errors.FormatError(f"{source}: shorter than header")
                self._mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
            self._view = memoryview(self._mm)
        else:
            self._view = memoryview(source).cast("B")
        try:
            self._entries = self._parse(self._view)
        except BaseException:
            self.close()
            raise

    @staticmethod
    def _parse(view: memoryview) -> dict[str, tuple[int, int]]:
        """Validates the header and returns ``path -> (offset, length)``."""
        if len(view) < HEADER_SIZE:
            raise errors.FormatError("pack shorter than its header")
        magic, major, _minor, n, _res, dir_off, dir_len, crc = (
            HEADER.unpack_from(view, 0)
        )
        if magic != MAGIC:
            raise errors.FormatError(f"bad pack magic {magic!r}")
        if major != MAJOR:
            raise errors.FormatError(f"unknown pack major version {major}")
        if dir_off + dir_len > len(view):
            raise errors.FormatError("pack directory is truncated")
        with view[dir_off : dir_off + dir_len] as raw:
            if zlib.crc32(raw) != crc:
                raise errors.FormatError("pack directory CRC mismatch")
            try:
                records = json.loads(bytes(raw))["entries"]
            except (ValueError, KeyError, TypeError) as exc:
                raise errors.FormatError(f"bad pack directory: {exc}") from exc
        entries: dict[str, tuple[int, int]] = {}
        for rec in records:
            path, off, length = rec["path"], rec["offset"], rec["length"]
            if (
                path.startswith("/")
                or ".." in path.split("/")
                or off + length > len(view)
            ):
                raise errors.FormatError(f"invalid pack entry {path!r}")
            entries[path] = (off, length)
        if len(entries) != n:
            raise errors.FormatError("pack entry count mismatch")
        return entries

    def paths(self) -> list[str]:
        """Returns all entry paths, sorted."""
        return sorted(self._entries)

    def __contains__(self, path: object) -> bool:
        """Tells whether an entry exists."""
        return path in self._entries

    def read(self, path: str) -> memoryview:
        """Returns an entry's bytes as a zero-copy view.

        Args:
            path: Entry path, for example ``runs/walk/rollout.json``.

        Returns:
            A read-only memoryview into the pack.

        Raises:
            KeyError: If the entry does not exist.
            ValueError: If the reader is closed.
        """
        if self._view is None:
            raise ValueError("pack reader is closed")
        off, length = self._entries[path]
        return self._view[off : off + length]

    def runs(self) -> list[str]:
        """Returns the names of the runs in the pack, sorted."""
        return sorted(
            p.split("/")[1]
            for p in self._entries
            if p.startswith("runs/")
            and p.endswith("/" + manifest.MANIFEST_NAME)
        )

    def manifest(self, run: str) -> manifest.RolloutManifest:
        """Parses a run's manifest.

        Args:
            run: Run name.

        Returns:
            The manifest.
        """
        with self.read(f"runs/{run}/{manifest.MANIFEST_NAME}") as raw:
            return manifest.RolloutManifest.from_json(json.loads(bytes(raw)))

    def _asset(self, ref: cas.Ref) -> bytes:
        """Returns a blob's bytes, checking the size."""
        with self.read(asset_path(ref)) as raw:
            if len(raw) != ref.size:
                raise errors.FormatError(f"size mismatch for {ref.sha256}")
            return bytes(raw)

    def scene(self, ref: cas.Ref) -> core.Scene:
        """Loads a scene and its assets from the pack.

        Args:
            ref: Reference from a manifest (``scene`` or ``env_scenes``).

        Returns:
            The scene. Transcoded meshes have no normals.
        """
        with self.read(scene_path(ref)) as raw:
            doc = json.loads(bytes(raw))
        return scene.scene_from_json(doc, self._asset)

    def stream(
        self, run: str, name: str, *, cache_blocks: int = 64
    ) -> blockfile.BlockReader:
        """Opens a stream of a run for random access.

        Args:
            run: Run name.
            name: Stream name from the run's manifest.
            cache_blocks: Decoded blocks to cache.

        Returns:
            A reader over the block file inside the pack, with the stream
            kind set so q16d poses are renormalized.
        """
        info = self.manifest(run).streams[name]
        return blockfile.BlockReader(
            self.read(f"runs/{run}/{info.file}"),
            cache_blocks=cache_blocks,
            kind=info.kind,
        )

    def close(self) -> None:
        """Releases the memory map. Safe to call more than once."""
        if self._view is not None:
            self._view.release()
            self._view = None
        if self._mm is not None:
            # Views still exported: the map closes when they are dropped.
            with contextlib.suppress(BufferError):
                self._mm.close()
            self._mm = None

    def __enter__(self) -> "PackReader":
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
