# Layouts and cells

## Making a layout

```ts
import { createLayout, herringbone } from "@andamento/core";

const layout = createLayout({
  region: { x: 0, y: 0, width: 240, height: 150 }, // a rectangle or any simple polygon
  holes: [{ x: 150, y: 40, width: 50, height: 60 }], // left empty
  tiling: herringbone({ length: 60, width: 30 }),
  gap: 2,
  margin: 4,
  cornerRadius: 3,
  rotation: 0,
  edges: "clip",
  minFill: 0.25,
  tileScale: 1,
});
```

`createLayout` is synchronous and deterministic: the same options always give the same
layout, including the random patterns, which take a `seed`. Every option is plain data, so
layouts can be saved as JSON and restored. The options are covered in
[Layout options](/guide/layout-options), [Regions, holes and edges](/guide/regions),
[Featured tiles](/guide/featured) and [Tile size by density](/guide/density).

**Units are yours.** Use centimeters for a floor plan, pixels for a web page, or anything else.
The renderers scale the layout to fit, so for a web page only the region's proportions
matter. The tiling sizes are in the same units as the region.

## The layout

```ts
interface Layout {
  region: Polygon;      // the region outline (before margin)
  holes: Polygon[];     // the region's holes (before margin)
  bounds: Rect;         // bounding box of the region: a good SVG viewBox
  cornerRadius: number; // applied by renderers
  view?: Shape[];       // edges: "window" only: the area tiles show in
  cells: Cell[];        // one per tile, in reading order
}
```

A `Polygon` is an array of `{ x, y }` points and a `Rect` is `{ x, y, width, height }`. The
y axis points down, as on screen.

## Cells

Each tile is a `Cell`:

| Field | |
|---|---|
| `id` | A stable id from the tile's position in the pattern, e.g. `"3,1:0"`. It stays the same when the region grows or the gap changes, so it suits React keys and saved selections. |
| `index` | Position in reading order: top to bottom, then left to right. |
| `polygon` | The visible shape, after the gap, margin and edge handling, with sharp corners. |
| `holes` | Holes in the shape, when a region hole falls wholly inside the tile. |
| `original` | The whole pattern tile, before gap and edges. |
| `tile` | With `edges: "window"`, for a cut cell: the whole tile. |
| `bbox`, `centroid`, `area` | Measured on `polygon` (and its holes). |
| `boundary` | The tile crosses the region's outline (it was cut, or sticks out). |
| `protoTile` | Which kind of tile this is within the pattern: herringbone's two directions, rhombille's three faces, a hat or a mirrored hat. Handy for coloring. |
| `neighbors` | Ids of the cells that share an edge with this one. |
| `featured`, `merged`, `featuredItem` | For a [featured tile](/guide/featured): its position in `features`, the ids of the tiles merged into it, and the item it's for. |

Corner rounding is applied when the cell is drawn, so `polygon`, `area` and `centroid`
describe the sharp shape; `roundedPolygon(cell.polygon, layout.cornerRadius)` gives the rounded
outline.

## Which content goes where

Content is assigned to cells in **reading order**: the first item to the first cell, and so on.
Several settings change that, and they're the same in every renderer:

- **Featured cells take content first**: the first item goes in the first feature.
- **`contentCells`** limits which cells take content, e.g. `"whole"` skips cells the region's
  edge cuts.
- **`placement`** decides where items go when there are fewer items than cells: packed from the
  top left, clustered in the middle, or spread evenly.
- **`aspects`** puts each item in a cell of a similar shape.
- **`weights`** gives important items bigger tiles.

The function behind all of them is `contentSlots(layout, count, options)` (or `matchSlots`
with aspects). It returns, for each cell, the index of the item it holds, or -1. Use it if you
draw layouts yourself. See [Placing content](/guide/content).

## Drawing it yourself

The renderers are thin. If you're drawing with something else, these helpers do the
geometry:

- `cellCss(cell, layout)`: `{ left, top, width, height, clipPath }` as percentages, to place an
  absolutely positioned element; `boundsAspectRatio(layout)` gives the container's
  `aspect-ratio`.
- `cellPath(layout, cell)` (in `@andamento/svg`): an SVG path with true arcs for rounded
  corners.
- `roundedPolygon`, `insetPolygon`, `safeArea`, `coverRect`, `bevelFacets`: rounded outlines,
  insets, the largest rectangle inside a shape, image placement, bevel faces.

See [Other frameworks](/frameworks/other).
