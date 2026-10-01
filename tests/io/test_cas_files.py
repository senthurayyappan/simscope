import os

import pytest

from simscope.io import cas


def test_read_at_returns_the_bytes_at_an_offset(tmp_path):
    path = tmp_path / "f.bin"
    path.write_bytes(bytes(range(256)))
    fd = cas.open_read(path)
    try:
        assert cas.read_at(fd, 4, 10) == bytes([10, 11, 12, 13])
        assert cas.read_at(fd, 4, 254) == bytes([254, 255])  # short at the end
        assert cas.read_at(fd, 3, 0) == bytes([0, 1, 2])  # no shared position
    finally:
        os.close(fd)


def test_atomic_write_keeps_newlines_and_control_bytes(tmp_path):
    data = b"a\nb\r\nc\x1a\x00d\n"
    cas.atomic_write(tmp_path / "x.bin", data)
    assert (tmp_path / "x.bin").read_bytes() == data


def test_replace_waits_out_a_sharing_violation(tmp_path, monkeypatch):
    src, dst = tmp_path / "src", tmp_path / "dst"
    src.write_bytes(b"new")
    dst.write_bytes(b"old")
    real = os.replace
    calls = []

    def flaky(a, b):
        calls.append(1)
        if len(calls) < 3:
            raise PermissionError(13, "Access is denied")
        real(a, b)

    monkeypatch.setattr(cas.os, "name", "nt")
    monkeypatch.setattr(cas.os, "replace", flaky)
    cas.replace_file(src, dst)
    assert len(calls) == 3
    assert dst.read_bytes() == b"new"


def test_a_permission_error_is_raised_off_windows(tmp_path, monkeypatch):
    def deny(a, b):
        raise PermissionError(13, "denied")

    monkeypatch.setattr(cas.os, "replace", deny)
    (tmp_path / "a").write_bytes(b"x")
    with pytest.raises(PermissionError):
        cas.replace_file(tmp_path / "a", tmp_path / "b")


def test_replace_gives_up_after_the_deadline(tmp_path, monkeypatch):
    def deny(a, b):
        raise PermissionError(13, "denied")

    monkeypatch.setattr(cas.os, "name", "nt")
    monkeypatch.setattr(cas.os, "replace", deny)
    monkeypatch.setattr(cas, "_RETRY_SECONDS", 0.05)
    (tmp_path / "a").write_bytes(b"x")
    with pytest.raises(PermissionError):
        cas.replace_file(tmp_path / "a", tmp_path / "b")


def test_remove_file_ignores_a_missing_file(tmp_path):
    cas.remove_file(tmp_path / "nope")
    (tmp_path / "x").write_bytes(b"1")
    cas.remove_file(tmp_path / "x")
    assert not (tmp_path / "x").exists()
