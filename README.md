# Andamento

Tiling layouts: split a region into grids, bricks, herringbone, chevron, hexagons, triangles,
Cairo pentagons, Penrose rhombs, jigsaw pieces, Mondrian-style rectangles and more, then put
anything you like in each tile. Photo walls, image galleries, dashboards, card grids, decorative
backgrounds.

| Package | What it does |
|---|---|
| `@andamento/core` | Pure TypeScript, no DOM. Generates a pattern, applies gap/margin/edge rules, returns `Cell[]`. Includes CSS placement helpers for any framework. |
| `@andamento/svg` | Renders a layout to an SVG string (`renderToString`) or DOM element (`renderToElement`). |
| `@andamento/react` | `<TileLayout>` (HTML, any children), `<SvgTileLayout>` (pure SVG), `useTileLayout()`. |

## React: any content, clipped to the tiles

```tsx
import { TileLayout, coverStyle } from "@andamento/react";
import { hexagonal } from "@andamento/core";

<TileLayout
  options={{ region: { x: 0, y: 0, width: 240, height: 150 }, tiling: hexagonal({ size: 26 }), gap: 2 }}
  background="#f4f1ea"
>
  <img src="beach.jpg" alt="" style={coverStyle} />
  <video src="clip.mp4" autoPlay muted loop style={coverStyle} />
  <Card title="Anything" />
  <button onClick={…}>Clickable</button>
</TileLayout>
```

- Each top-level child fills one tile, in reading order (top-to-bottom, left-to-right).
  `null`/`false` children are skipped; children beyond the number of tiles aren't rendered.
- Tiles are absolutely positioned `<div>`s with a CSS `clip-path`, sized in percentages, so the
  layout scales with the container's width (its height follows via `aspect-ratio`).
- Clipping also applies to pointer events, so hover and clicks follow the tile shapes.
- Children keep their state (video position, form input) when the layout options change.
- Other props: `renderCell(cell, { slot })` instead of children, `fallback` for empty tiles,
  `cellClassName` / `cellStyle` (fixed or per cell), plus any `<div>` attributes.

### Fewer children than tiles, and cut tiles

```tsx
<TileLayout options={options} contentCells="whole" placement="center" fill={["#eee", "#ddd", "#e6e2dc"]}>
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

- `contentCells`: which tiles may hold children. `"all"` (default), `"whole"` (skip tiles cut
  by the region outline, so content is never cropped by the edge), or `(cell) => boolean`.
- `placement`: where children go when there are fewer than tiles. `"reading"` (default)
  packs them from the top left, `"center"` clusters them in the middle, `"spread"` spaces them
  evenly. Children always run in reading order across the tiles chosen.
- `fill`: color of empty tiles. A color, a palette (neighbouring tiles get different
  entries), or `(cell) => color`. Defaults to `neutralPalette`, soft greys that keep the pattern
  visible; `fill="transparent"` hides empty tiles.
- Per-cell functions (`fallback`, `cellClassName`, `cellStyle`) get a second argument,
  `{ empty, slot }`: whether the tile has content, and the index of the child it holds.
- Tile wrappers carry `data-empty` and `data-boundary` attributes, for plain CSS:
  `[data-andamento] [data-empty] { opacity: 0.5 }`.

The core function behind this, `contentSlots(layout, count, { cells, placement })`, returns
the item index per cell (or -1) for other renderers.

#### Fill helpers

`fill` also takes a function `(cell, layout) => color`. Core has ready-made ones:

```ts
import { gradientFill, paletteFill, protoTileFill, randomFill } from "@andamento/core";

fill={paletteFill(["#eee", "#ddd", "#ccc"])}               // neighbours differ (same as passing the array)
fill={gradientFill(["#f6d365", "#fda085"], { angle: 45 })} // by position; also { shape: "radial" }
fill={protoTileFill(["#e7e5e4", "#d6d3d1"])}               // by tile shape, e.g. herringbone's two directions
fill={randomFill(["#eee", "#ddd", "#ccc"], 42)}            // stable per tile id across resizes
```

Gradients take hex colors and blend in OKLab, so the middle doesn't turn grey.

#### Sizing tiles to your content

```tsx
<TileLayout options={options} fit contentCells="whole">
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

`fit` scales the pattern so there are about as many tiles as children (counted by
`contentCells`): `true` or `"atLeast"` picks the largest tiles that still give every child a
tile, and `"nearest"` gets as close as possible to the number of children. It's ignored with
`layout` or `renderCell`. `<SvgTileLayout fit>` fits to the `images` array.

Under the hood this is `fitCount(options, count, { cells, mode })` in core, which returns
`{ options, layout, tileScale, count }`. It works for every pattern because it sets the new
`tileScale` layout option, which scales the whole pattern rather than a pattern-specific size
parameter. The tile count changes in steps, so the result can land slightly above `count`
(typically by a few percent), especially for herringbone-like patterns and whole tiles.
There's also a `useFitCount(options, count, fit)` hook.

Use `<SvgTileLayout>` when you need a single `<svg>` (export, print, embedding), with
`images`, `fill`, `stroke` and an SVG-level `renderCell`. It takes `contentCells` and
`placement` too (they decide where the `images` array goes), and `renderToString` accepts the
same options.

## Core

```ts
import { createLayout, herringbone } from "@andamento/core";
import { renderToString } from "@andamento/svg";

const layout = createLayout({
  region: { x: 0, y: 0, width: 240, height: 150 }, // any unit; a rectangle or any simple polygon
  holes: [{ x: 150, y: 40, width: 50, height: 60 }], // windows, doors, sockets: left empty
  tiling: herringbone({ length: 60, width: 30 }),
  gap: 2,
  margin: 4,       // kept clear along the region edge and around holes
  cornerRadius: 3, // round tile corners (shrinks to fit small corners)
  rotation: 0,
  edges: "clip",   // "clip" | "inside" | "overflow"
  minFill: 0.25,   // drop edge slivers smaller than 25% of a tile
  tileScale: 1,    // scale the whole pattern (see fitCount)
});

const svg = renderToString(layout, { images: imageUrls, background: "#f4f1ea" });
```

Patterns:

- Bricks and boards: `grid`, `runningBond`, `flemishBond`, `herringbone`, `chevron`, `basketweave`,
  `hopscotch` (two square sizes), `pinwheel`
- Regular polygons: `hexagonal`, `triangular`, `rhombille` (tumbling blocks), `octagonSquare`,
  `trihexagonal`, `rhombitrihexagonal`
- Curved and interlocking (non-convex tiles): `fishScale`, `jigsaw` (seeded tab directions)
- Aperiodic monotiles (a single shape that tiles without ever repeating): `hat` (about one hat
  in seven is mirrored; `protoTile` 4) and `spectre` (no mirrored tiles). `size` is the tile's
  width; `origin` is the pattern's fixed centre, as for `penrose`
- Escher-style: `isohedral({ ih, size, params?, edges?, amount? })`, any of the 81 isohedral
  types with freely shaped tiles. Edges are `"wave"` (default), `"straight"` or your own curves,
  one per edge class; `isohedralInfo(ih)` lists the type's shape parameters and which edges
  must be S-shaped (180° symmetric), U-shaped (mirror symmetric) or straight. `isohedralTypes`
  lists the types. `protoTile` is the tile's orientation class within the pattern
- Other: `cairo` (pentagons), `penrose` (a pattern that never repeats: thick and thin rhombs,
  or kites and darts with `variant: "kitesAndDarts"`; `origin` places the star at the pattern's
  centre, so set it to the middle of the region)
- Random, seeded (same `seed`, same layout): `voronoi` (irregular polygons, like crazy paving),
  `delaunay` (random triangles), `ashlar` (stone courses of random lengths), `mondrian`
  (random rectangles). `relax` controls how even Voronoi cells and triangles are.

### Your own tilings (advanced)

Nothing here checks that your tiles fit together; overlapping or gappy input simply produces
overlapping or gappy layouts.

```ts
import { checkPeriodic, periodic, tiles } from "@andamento/core";

// A repeating tiling: the motif is copied to every i·a + j·b (region units).
// Two L-trominoes filling a 3 × 2 block:
const trominoes = periodic({
  a: { x: 150, y: 0 },
  b: { x: 50, y: 100 },
  motif: [
    { polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 100 }] },
    { polygon: [{ x: 100, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 50 }, { x: 100, y: 50 }] },
  ],
});
checkPeriodic(trominoes); // { ok, gaps, overlaps, selfIntersecting, cellArea, motifArea }

// Or bring your own polygons: used as given (rotation and origin don't apply).
const custom = tiles({ tiles: [{ polygon: myPolygon, id: "hero", protoTile: 1 }, /* … */] });
```

Both get the usual gap, margin, edge handling, rounding, neighbours and rendering; `periodic`
also gets rotation, origin and lattice-based ids. Polygons can be non-convex but must be simple.
`checkPeriodic` samples one lattice cell and reports the fraction of points covered by no tile
(`gaps`) or by several (`overlaps`); `periodicDefinition(spec)` gives the `{ a, b, motif }` of
any built-in repeating pattern as a starting point.

`cell.protoTile` tells the tile types apart within a pattern (e.g. rhombille: 0 top, 1 right,
2 left face), which is handy for shading.
Every spec is a plain JSON object, so layouts can be saved and restored.

`cornerRadius` is applied when rendering: SVG uses true arcs, HTML approximates them in the
`clip-path` polygon. `Cell.polygon`, `area` and `centroid` describe the sharp-cornered shape;
`roundedPolygon(cell.polygon, layout.cornerRadius)` gives the rounded outline.

Each `Cell` has `id` (stable within a pattern), `index` (reading order), `polygon` (visible
shape), `original` (full pattern tile), `bbox`, `centroid`, `area`, `boundary` (crosses the
region outline), `protoTile` and `neighbors` (ids of cells sharing an edge).

For other frameworks, `cellCss(cell, layout)` returns `{ left, top, width, height, clipPath }`
as percentages, and `boundsAspectRatio(layout)` gives the container's `aspect-ratio`.

Lower-level helpers are exported too, e.g. `colorCells` (neighbour-aware color indices),
`insetPolygon`, `roundedPolygon`, `voronoiCells`, `delaunayTriangles` and `generateSubstitution`.

## Development

```bash
npm install
npm test          # vitest, all packages
npm run build     # tsup → dist/ (ESM + CJS + .d.ts)
npm run typecheck # run after build: packages resolve each other through dist/
npm run dev       # playground at http://localhost:5173
```

### Region shapes and holes

The region can be any simple polygon: an L-shaped wall, the space under stairs, an arch
(approximate the curve with short segments). `holes` are left empty: rectangles or polygons
that may overlap each other or stick out past the region edge. Tiles are cut around holes
like they're cut at the region edge (`edges: "inside"` skips any tile that would be cut, and
`"overflow"` keeps tiles that are partly visible whole), and `margin` keeps a border around
holes too. A margin can pinch a narrow part of the region shut, splitting it in two.

When a hole sits entirely inside one tile, the cell gets `holes` of its own; `area` and
`centroid` account for them, `cellCss` returns an even–odd `clip-path`, and `cellPath` adds
the holes as subpaths. `layout.holes` lists the region's holes, and `regionCss(layout)` /
`regionPath(layout)` draw the region with them.

Convex regions without holes use a faster clipping path; anything else goes through a general
polygon overlay, applied only to tiles near an edge, so it costs about the same.

## Limitations

- The region (and each hole) must be a single outline that doesn't cross itself. For a
  region in several separate parts, make one layout per part.
- The random patterns (`voronoi`, `delaunay`, `ashlar`, `mondrian`, `jigsaw`) ignore `rotation` and `origin`.
- Curved tiles are approximated with short straight segments. If `gap` is wider than a narrow
  part of a tile (a jigsaw neck, say), that part is dropped and the largest remaining piece is
  kept. If the region edge cuts a non-convex tile into separate parts, each part becomes its
  own cell: the largest keeps the tile's id, the others get `~1`, `~2`, ….
- Content is laid out in each tile's bounding box and clipped; for hexagons and cut edge tiles,
  keep important content near the centre.

## Credits

Isohedral tilings use [Tactile](https://github.com/isohedral/tactile-js) by Craig S. Kaplan
(BSD 3-Clause), vendored in `packages/core/src/vendor/tactile.ts` with its notice.

The hat tiling's metatile construction is ported from
[hatviz](https://github.com/isohedral/hatviz) by Craig S. Kaplan (BSD 3-Clause; the full
notice is in `packages/core/src/hat.ts`). The hat and spectre are due to David Smith,
Joseph Samuel Myers, Craig S. Kaplan and Chaim Goodman-Strauss (2023).
