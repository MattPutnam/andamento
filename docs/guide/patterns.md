---
outline: [2, 2]
---

# Patterns

Every pattern is a function in `@andamento/core` that returns a plain spec object, so
`hexagonal({ size: 26 })` is the same as `{ type: "hexagonal", size: 26 }`. Sizes are in
region units. Below, each picture is a 240 × 150 region with the spec shown.

Tiles are coloured so neighbours differ, or by `protoTile` (the kind of tile within the
pattern) where the pattern has several, like herringbone's two directions or rhombille's three
faces. Colour by kind yourself with `protoTileFill` (see
[Colour, pictures and relief](/guide/styling)).

Every pattern takes `rotation` and `origin` in the layout options, except the random ones
(`voronoi`, `delaunay`, `ashlar`, `mondrian`, `jigsaw`) and `flow`. Every pattern can be
scaled as a whole with `tileScale`.

<PatternGallery />

## Settings for each pattern

| Pattern | Settings |
|---|---|
| `grid` | `width`, `height` (defaults to `width`) |
| `runningBond` | `width`, `height`, `offset` (0–1 of a brick; default 0.5) |
| `flemishBond` | `length` (stretcher), `header`, `height` |
| `herringbone` | `length`, `width` |
| `chevron` | `length`, `width`, `angle` (degrees) |
| `basketweave` | `length` (square side), `strips` (bricks per square) |
| `hopscotch` | `large`, `small` (square sides) |
| `pinwheel` | `length`, `width` |
| `hexagonal` | `size` (centre to corner), `orientation` (`"pointy"` or `"flat"`) |
| `triangular`, `rhombille`, `octagonSquare`, `trihexagonal`, `rhombitrihexagonal`, `cairo`, `fishScale` | `size` |
| `jigsaw` | `size`, `seed` |
| `penrose` | `size`, `variant` (`"rhombs"` or `"kitesAndDarts"`); set `origin` to place the star |
| `hat`, `spectre` | `size` (the tile's width); `origin` is the pattern's fixed centre |
| `isohedral` | `ih` (one of `isohedralTypes`), `size`, `params`, `edges`, `amount` |
| `voronoi`, `delaunay` | `size`, `relax` (evenness), `seed` |
| `ashlar` | `height`, `minLength`, `maxLength`, `heightVariation`, `seed` |
| `mondrian` | `minSize`, `maxSize`, `splitChance`, `snap`, `seed` |
| `flow` | `size`, `length`, `jitter`, `guides`, `centers`, `followEdges`, `seed` (see [Andamento flow](/guide/flow)) |
| `periodic`, `tiles` | Your own tiles (see [Your own tilings](/guide/custom-tilings)) |

### Escher-style tilings

`isohedral({ ih, size, params?, edges?, amount? })` makes any of the 81 isohedral tiling
types, the family Escher drew his tessellations from. Every tile has the same shape, and the
shape's edges can be bent freely:

- `edges`: `"wave"` (default) or `"straight"`, or your own curves, one per edge class.
- `amount`: how far wave edges bend.
- `params`: the type's shape parameters.

`isohedralInfo(ih)` lists a type's parameters and which edges must be S-shaped (180°
symmetric), U-shaped (mirror symmetric) or straight. `isohedralTypes` lists the types. The
tile's orientation class is its `protoTile`.

### Aperiodic tilings

`penrose`, `hat` and `spectre` never repeat. They grow from a fixed centre, `origin`, which
defaults to the region's top left. Set it to the region's middle for a symmetrical
picture: Penrose then has its ten-fold star in the middle. About one hat in seven is a mirror
image, with `protoTile` 4; the spectre needs no mirrored tiles.
