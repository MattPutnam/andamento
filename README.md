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
- Other props: `renderCell(cell)` instead of children, `fallback` for empty tiles,
  `cellClassName` / `cellStyle` (fixed or per cell), plus any `<div>` attributes.

Use `<SvgTileLayout>` when you need a single `<svg>` (export, print, embedding), with
`images`, `fill`, `stroke` and an SVG-level `renderCell`.

## Core

```ts
import { createLayout, herringbone } from "@andamento/core";
import { renderToString } from "@andamento/svg";

const layout = createLayout({
  region: { x: 0, y: 0, width: 240, height: 150 }, // any unit; rectangle or convex polygon
  tiling: herringbone({ length: 60, width: 30 }),
  gap: 2,
  margin: 4,
  cornerRadius: 3, // round tile corners (shrinks to fit small corners)
  rotation: 0,
  edges: "clip",   // "clip" | "inside" | "overflow"
  minFill: 0.25,   // drop edge slivers smaller than 25% of a tile
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
- Other: `cairo` (pentagons), `penrose` (a pattern that never repeats: thick and thin rhombs,
  or kites and darts with `variant: "kitesAndDarts"`; `origin` places the star at the pattern's
  centre, so set it to the middle of the region)
- Random, seeded (same `seed`, same layout): `voronoi` (irregular polygons, like crazy paving),
  `delaunay` (random triangles), `ashlar` (stone courses of random lengths), `mondrian`
  (random rectangles). `relax` controls how even Voronoi cells and triangles are.

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

Lower-level helpers are exported too, e.g. `colorCells` (neighbour-aware colour indices),
`insetPolygon`, `roundedPolygon`, `voronoiCells`, `delaunayTriangles` and `generateSubstitution`.

## Development

```bash
npm install
npm test          # vitest, all packages
npm run build     # tsup → dist/ (ESM + CJS + .d.ts)
npm run typecheck # run after build: packages resolve each other through dist/
npm run dev       # playground at http://localhost:5173
```

## Limitations

- The region (the outline being tiled) must be a convex polygon; rectangles are the common
  case. The tiles inside it can be any simple shape.
- The random patterns (`voronoi`, `delaunay`, `ashlar`, `mondrian`, `jigsaw`) ignore `rotation` and `origin`.
- Curved tiles are approximated with short straight segments. If `gap` is wider than a narrow
  part of a tile (a jigsaw neck, say), that part is dropped and the largest remaining piece is
  kept. If the region edge cuts a non-convex tile into separate parts, each part becomes its
  own cell: the largest keeps the tile's id, the others get `~1`, `~2`, ….
- Content is laid out in each tile's bounding box and clipped; for hexagons and cut edge tiles,
  keep important content near the centre.

## Credits

The hat tiling's metatile construction is ported from
[hatviz](https://github.com/isohedral/hatviz) by Craig S. Kaplan (BSD 3-Clause; the full
notice is in `packages/core/src/hat.ts`). The hat and spectre are due to David Smith,
Joseph Samuel Myers, Craig S. Kaplan and Chaim Goodman-Strauss (2023).
