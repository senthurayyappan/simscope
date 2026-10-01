"""Benchmark for the importers on the real rollouts on this machine.

Run ``uv run python benchmarks/bench_import.py`` (``--quick`` imports a few
files only). Budgets (decision D12):

* one 13 MB Brax HTML imports in at most 1.5 s;
* the whole set of Brax pages (about 64) imports in at most 60 s, using the
  process pool of the ``simscope import`` command.

It also reports how much the content store shrinks the library compared
with the inputs. Missing inputs are skipped.
"""

import argparse
import pathlib
import shutil
import tempfile
import time

from simscope import importers, library

HOME = pathlib.Path.home()
BRAX_DIRS = (
    HOME / "Projects/barkour-bench/slides/dmpc-vault-2026-09/assets",
    HOME / "Projects/barkour-dmpc/outputs",
)
RBUNDLE_DIR = HOME / "Projects/dial-mpc/artifacts"
TARGET_ONE_S = 1.5
TARGET_ALL_S = 60.0


def tree_bytes(root: pathlib.Path) -> int:
    """Total size of the files of a library."""
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


def run_batch(
    name: str,
    files: list[tuple[pathlib.Path, str]],
    jobs: int | None,
) -> float:
    """Imports files into a fresh library and prints the numbers.

    Returns:
        Elapsed seconds.
    """
    root = pathlib.Path(tempfile.mkdtemp(prefix="simscope-bench-"))
    try:
        lib = library.Library(root / "lib")
        start = time.perf_counter()
        results = list(importers.import_files(lib, files, jobs=jobs))
        elapsed = time.perf_counter() - start
        failed = [r for r in results if r.name is None]
        src = sum(p.stat().st_size for p, _ in files)
        out = tree_bytes(root / "lib")
        print(
            f"{name}: {len(results) - len(failed)}/{len(files)} files in"
            f" {elapsed:.1f} s (jobs={jobs}); input {src / 1e6:.0f} MB ->"
            f" library {out / 1e6:.0f} MB ({out / max(src, 1):.1%})"
        )
        for r in failed:
            print(f"  failed {r.path}: {r.error}")
        return elapsed
    finally:
        shutil.rmtree(root, ignore_errors=True)


def main() -> None:
    """Runs the benchmark."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    brax = [
        (p, f)
        for p, f in importers.find_importable(
            [d for d in BRAX_DIRS if d.exists()]
        )
        if f == "brax"
    ]
    rbundles = (
        importers.find_importable([RBUNDLE_DIR]) if RBUNDLE_DIR.exists() else []
    )
    print(f"found {len(brax)} Brax pages, {len(rbundles)} rbundles")
    if brax:
        biggest = max(brax, key=lambda pf: pf[0].stat().st_size)
        t = run_batch(f"one page ({biggest[0].name})", [biggest], 1)
        ok = "OK" if t <= TARGET_ONE_S else "MISS"
        print(f"  budget {TARGET_ONE_S} s: {ok}")
    if rbundles:
        run_batch("rbundles, serial", rbundles[: 4 if args.quick else None], 1)
    if brax:
        files = brax[:8] if args.quick else brax
        t = run_batch("brax, serial", files[: 4 if args.quick else 8], 1)
        t = run_batch("brax, parallel", files, None)
        if not args.quick:
            ok = "OK" if t <= TARGET_ALL_S else "MISS"
            print(f"  budget {TARGET_ALL_S} s: {ok}")


if __name__ == "__main__":
    main()
