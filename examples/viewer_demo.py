"""Records a small MuJoCo run with contact forces, then shows how to view it.

Usage::

    uv run python examples/viewer_demo.py [--out DIR]

The script drops a tumbling box onto a plane, records it with a ``contacts``
stream (the viewer draws these as force arrows), and prints the command that
serves the folder::

    uv run simscope serve DIR

Open the printed URL, pick the run, press K to play, and press C to toggle the
contact arrows. The same folder feeds ``simscope export`` for a shareable
HTML file.
"""

import argparse
import pathlib
import tempfile

import mujoco

from simscope import library
from simscope import mujoco as smj

MODEL_XML = """
<mujoco>
  <option timestep="0.002"/>
  <worldbody>
    <geom name="floor" type="plane" size="5 5 .1" rgba=".7 .7 .7 1"/>
    <body name="box" pos="0 0 .6">
      <freejoint/>
      <geom name="box_geom" type="box" size=".1 .15 .05" mass="2"
            rgba=".2 .5 .9 1"/>
    </body>
  </worldbody>
</mujoco>
"""

FRAME_DT = 0.02
"""Seconds between recorded frames (50 Hz)."""

MAX_CONTACTS = 8
"""Contact slots per frame (``K`` of the ``contacts`` stream)."""


def record_demo(root: pathlib.Path, name: str = "box_drop") -> pathlib.Path:
    """Records a box that falls, bounces, and comes to rest.

    Args:
        root: The library folder; created if missing.
        name: Run name.

    Returns:
        The library folder.
    """
    # The mujoco wheel ships no stubs, so ty cannot see these attributes.
    model = mujoco.MjModel.from_xml_string(MODEL_XML)  # ty: ignore[unresolved-attribute]
    data = mujoco.MjData(model)  # ty: ignore[unresolved-attribute]
    data.qvel[:] = (0.6, 0.0, 0.0, 2.0, 3.0, 1.0)  # drift and tumble
    substeps = round(FRAME_DT / model.opt.timestep)
    lib = library.Library(root)
    try:
        with lib.record(
            name,
            scene=smj.scene_from_model(model),
            dt=FRAME_DT,
            source=smj.source_info(),
            tags=["demo"],
            overwrite=True,
        ) as rec:
            smj.add_contacts_stream(rec, model, max_contacts=MAX_CONTACTS)
            for _ in range(150):  # 3 s
                for _ in range(substeps):
                    mujoco.mj_step(model, data)  # ty: ignore[unresolved-attribute]
                rec.log(
                    smj.poses(data),
                    contacts=smj.contacts(
                        model, data, max_contacts=MAX_CONTACTS
                    ),
                )
    finally:
        lib.close()
    return root


def main() -> None:
    """Records the demo run and prints how to serve it."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=pathlib.Path,
        default=None,
        help="Library folder (default: a new temporary folder).",
    )
    args = parser.parse_args()
    root = args.out or pathlib.Path(tempfile.mkdtemp(prefix="simscope_demo_"))
    record_demo(root)
    print(f"recorded box_drop into {root}")
    print(f"view it with:  uv run simscope serve {root}")


if __name__ == "__main__":
    main()
