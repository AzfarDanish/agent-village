# 3D scene guide

Everything visible is **procedural**: no `.glb`, no textures, no font files.
Primitives (`Box`, `Cone`, `Cylinder`, `Sphere`, `Icosahedron`) with
`flatShading` MeshStandardMaterial, one hemisphere + one shadow-casting
directional light, orthographic camera with orbit controls. Draw calls stay
under ~260, triangles under ~7k (see `diagnostics()` in the console).

## Where things live (`web/`)

| Area | Code | Notes |
|------|------|-------|
| Island, tiles, paths, plaza, trees, pond, windmill | `world.js` top half | Instanced tiles; everything else grouped meshes |
| Houses | `world.js:building(i)` | Per-role branches `i===0..3` — see below |
| Characters | `world.js` villager loop | Body/head/limbs groups; walk stride, work gestures, hover glance |
| Offices | `offices.js:createOffice(i, character)` | Two walls (north+west), tiled floor, full furniture set, per-role palette |
| Hover frames | `hover-frame.js` | Chunky cylinder edges + corner blobs; back corner hidden (9/12 edges, 7/8 corners) |
| Movement/state | `world.js:workerStep`, `animate` | `current_agent`/`meeting` from `/state` drive phases |

## Adding geometry

1. Use `mesh(geo, material, parent, x, y, z)` — shadows on by default.
2. Reuse `mat()`/`shared` materials; new colors should sit in the warm,
   muted palette (greens `#6d8e60`–`#a5b984`, creams, wood `#8e6948`).
3. Yard props go on the house **group** `g`; structure that the hover frame
   measures goes in `structure`. Keep `structure` bounds under ~2.6 units
   per side (`office-check.js` asserts this).
4. Animate in the `animate()` loop with `time`-based sine functions; respect
   `paused` and `prefers-reduced-motion` (see `media`).

## New house design (for a new role or a redesign)

1. Add the role to `ROLES`/`COLORS`/`HOMES` and the matching office palette
   in `offices.js:PALETTES`.
2. Write a new branch in `building(i)`: distinct silhouette (height,
   footprint, roof type), a front door via `doorway()`+`doorLeaf()` facing
   local `+z`, a `lampPos`, and optionally a `chimney` for smoke.
3. Keep the doorway near local `z≈0.7–1.0` — the entry animation walks the
   character to `(x, z+0.69)` in world space.
4. Entry/exit and the office occupant clone work off `houses[i]` and
   `villagers[i]` automatically; no other wiring needed.

## New office interior

Add a palette entry and vary furniture placement/materials in
`createOffice`. Required furniture set: table, laptop, computer, printer,
wall picture, pencil, lamp, books (`office-check.js` asserts all eight by
asset name). Walls stay north+west only.

## `diagnostics()` contract

`window.villageWorld.diagnostics()` is the test seam: view state, office
name/walls/furniture/occupant, per-house door + structure size, hover
object + frame counts, character phases. The `*-check.js` scripts assert
against it — extend it alongside any scene change, don't work around it.
