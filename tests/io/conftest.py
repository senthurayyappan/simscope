import importlib.util
import pathlib

import pytest

FIXTURES = pathlib.Path(__file__).parent.parent / "fixtures"


def _load_fixture_module():
    spec = importlib.util.spec_from_file_location(
        "make_format_fixtures", FIXTURES / "make_format_fixtures.py"
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="session")
def fixtures_module():
    return _load_fixture_module()


@pytest.fixture
def library(tmp_path, fixtures_module):
    """A two-run library whose scenes share one mesh."""
    root = tmp_path / "lib"
    names = fixtures_module.build_library(root)
    return root, names
