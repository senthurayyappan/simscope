"""MuJoCo model-to-geometry helpers adapted from mjviser.

This module is adapted from ``mjviser/conversions.py`` in mjviser
(https://github.com/mujocolab/mjviser), which is licensed under the Apache
License, Version 2.0. The upstream copyright notice reads "Copyright 2025,
The mjlab Developers". Upstream commit:
``ae0b219a2049a95e1321214e4efd1d395ee4bf39``. The license text and this
attribution are reproduced in ``THIRD_PARTY_NOTICES.md``.

Changes made to the upstream code (Apache-2.0 section 4(b)): the trimesh and
Pillow outputs were replaced by plain numpy arrays; mesh unwrapping now
shares vertices with identical position and texture coordinate; the
heightfield address uses ``hfield_adr`` instead of a Python loop; texture
extraction returns pixel arrays; the cube-map, hull, site, and merging
helpers, and everything that touches the viewer, were dropped; the color rule
was checked against ``mjv_updateScene``.

Texture coordinate convention (kept from upstream): ``uvs`` follow OpenGL,
so ``(0, 0)`` is the bottom-left of the image as displayed. Pixel arrays
returned here are flipped to top-down row order to match, which is how PNG
and three.js (``flipY = true``) expect them.
"""

import mujoco
import numpy as np
import numpy.typing as npt

DEFAULT_GEOM_RGBA = np.array([0.5, 0.5, 0.5, 1.0], dtype=np.float32)
"""MuJoCo's default ``geom/@rgba``. A geom that still has it defers to its
material color."""


def texture_id(model: mujoco.MjModel, matid: int) -> int:
    """Returns the color texture id of a material.

    Args:
        model: The compiled model.
        matid: Material id, or a negative value for "no material".

    Returns:
        The id of the RGB texture, else of the RGBA texture, else ``-1``.
    """
    if matid < 0 or matid >= model.nmat:
        return -1
    for role in (
        mujoco.mjtTextureRole.mjTEXROLE_RGB,
        mujoco.mjtTextureRole.mjTEXROLE_RGBA,
    ):
        texid = int(model.mat_texid[matid, int(role)])
        if texid >= 0:
            return texid
    return -1


def texture_pixels(
    model: mujoco.MjModel, texid: int
) -> npt.NDArray[np.uint8] | None:
    """Extracts a 2D texture as top-down 8-bit RGB or RGBA pixels.

    MuJoCo stores rows bottom-up, so the rows are flipped, as in mjviser.
    Single-channel textures are expanded to RGB. Cube maps, skyboxes, and
    other channel counts are not supported.

    Args:
        model: The compiled model.
        texid: Texture id.

    Returns:
        A ``[H, W, 3]`` or ``[H, W, 4]`` uint8 array, or ``None`` if the
        texture is not a supported 2D texture.
    """
    if int(model.tex_type[texid]) != int(mujoco.mjtTexture.mjTEXTURE_2D):
        return None
    width = int(model.tex_width[texid])
    height = int(model.tex_height[texid])
    nchannel = int(model.tex_nchannel[texid])
    if nchannel not in (1, 3, 4) or width < 1 or height < 1:
        return None
    adr = int(model.tex_adr[texid])
    data = model.tex_data[adr : adr + width * height * nchannel]
    pixels = np.flipud(data.reshape(height, width, nchannel))
    if nchannel == 1:
        pixels = np.repeat(pixels, 3, axis=2)
    return np.ascontiguousarray(pixels, dtype=np.uint8)


def effective_geom_rgba(model: mujoco.MjModel) -> npt.NDArray[np.float32]:
    """Resolves the displayed color of every geom.

    Follows MuJoCo's own rule (verified against ``mjv_updateScene``): a geom
    uses its material color only when it has a material and its own
    ``rgba`` is still the default; otherwise ``geom_rgba`` wins. Upstream
    mjviser prefers the material color unconditionally.

    Args:
        model: The compiled model.

    Returns:
        A new ``[ngeom, 4]`` float32 array.
    """
    rgba = model.geom_rgba.astype(np.float32, copy=True)
    matid = model.geom_matid
    defer = (matid >= 0) & np.all(rgba == DEFAULT_GEOM_RGBA, axis=1)
    rgba[defer] = model.mat_rgba[matid[defer]]
    return rgba


def mesh_arrays(
    model: mujoco.MjModel, mesh_id: int, *, with_uvs: bool
) -> tuple[
    npt.NDArray[np.float32],
    npt.NDArray[np.uint32],
    npt.NDArray[np.float32] | None,
]:
    """Extracts a mesh asset in the frame MuJoCo stores it in.

    ``mesh_vert`` is already recentered and scaled by the compiler, and
    ``geom_pos``/``geom_quat`` of geoms using the mesh compensate for that.
    So the returned vertices need only the geom's own pose.

    When ``with_uvs`` is set and the mesh has texture coordinates, vertices
    are split so each unique (position, texcoord) pair becomes one vertex.

    Args:
        model: The compiled model.
        mesh_id: Mesh asset id.
        with_uvs: Whether to also return texture coordinates.

    Returns:
        ``(vertices, faces, uvs)`` with shapes ``[V, 3]``, ``[F, 3]`` and
        ``[V, 2]``; ``uvs`` is ``None`` when unused or unavailable.
    """
    vert_adr = int(model.mesh_vertadr[mesh_id])
    vert_num = int(model.mesh_vertnum[mesh_id])
    face_adr = int(model.mesh_faceadr[mesh_id])
    face_num = int(model.mesh_facenum[mesh_id])
    vertices = model.mesh_vert[vert_adr : vert_adr + vert_num]
    faces = model.mesh_face[face_adr : face_adr + face_num]

    texcoord_num = int(model.mesh_texcoordnum[mesh_id])
    if not with_uvs or texcoord_num == 0:
        return (
            vertices.astype(np.float32, copy=True),
            faces.astype(np.uint32),
            None,
        )

    texcoord_adr = int(model.mesh_texcoordadr[mesh_id])
    texcoords = model.mesh_texcoord[texcoord_adr : texcoord_adr + texcoord_num]
    face_texcoord = model.mesh_facetexcoord[face_adr : face_adr + face_num]
    pair = faces.ravel().astype(np.int64) * texcoord_num + face_texcoord.ravel()
    unique_pair, inverse = np.unique(pair, return_inverse=True)
    return (
        vertices[unique_pair // texcoord_num].astype(np.float32),
        inverse.reshape(-1, 3).astype(np.uint32),
        texcoords[unique_pair % texcoord_num].astype(np.float32),
    )


def hfield_arrays(
    model: mujoco.MjModel, hfield_id: int, *, with_uvs: bool
) -> tuple[
    npt.NDArray[np.float32],
    npt.NDArray[np.uint32],
    npt.NDArray[np.float32] | None,
]:
    """Tessellates a height field in the geom frame.

    Grid vertex ``(row, col)`` sits at ``x = -sx + 2 sx col / (ncol - 1)``,
    ``y = -sy + 2 sy row / (nrow - 1)`` and ``z = elevation * sz``. The
    base skirt below the field is not generated. Triangles wind
    counter-clockwise seen from +z.

    Args:
        model: The compiled model.
        hfield_id: Height field asset id.
        with_uvs: Whether to also return grid texture coordinates.

    Returns:
        ``(vertices, faces, uvs)`` with shapes ``[nrow*ncol, 3]``,
        ``[F, 3]`` and ``[nrow*ncol, 2]``; ``uvs`` is ``None`` unless
        ``with_uvs``.
    """
    nrow = int(model.hfield_nrow[hfield_id])
    ncol = int(model.hfield_ncol[hfield_id])
    sx, sy, sz, _base = model.hfield_size[hfield_id]
    adr = int(model.hfield_adr[hfield_id])
    elevation = model.hfield_data[adr : adr + nrow * ncol].reshape(nrow, ncol)

    xx, yy = np.meshgrid(np.linspace(-sx, sx, ncol), np.linspace(-sy, sy, nrow))
    vertices = np.stack((xx, yy, elevation * sz), axis=-1).reshape(-1, 3)

    rows, cols = np.mgrid[: nrow - 1, : ncol - 1]
    i0 = (rows * ncol + cols).ravel()
    faces = np.column_stack(
        (i0, i0 + 1, i0 + ncol + 1, i0, i0 + ncol + 1, i0 + ncol)
    ).reshape(-1, 3)

    uvs = None
    if with_uvs:
        uu, vv = np.meshgrid(np.linspace(0, 1, ncol), np.linspace(0, 1, nrow))
        uvs = np.stack((uu, vv), axis=-1).reshape(-1, 2).astype(np.float32)
    return vertices.astype(np.float32), faces.astype(np.uint32), uvs
