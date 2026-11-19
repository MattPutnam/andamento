# Layout options

These options shape every layout, whatever the pattern. The pictures use hexagons in a
160 × 110 region.

## Gap

`gap` is the space between neighbouring tiles: the grout. The renderers show the layout's
`background` through it.

<Figures :items="[
  { name: 'options-gap-0', caption: 'gap: 0' },
  { name: 'options-gap-2', caption: 'gap: 2' },
  { name: 'options-gap-6', caption: 'gap: 6' },
]" />

## Margin

`margin` keeps a border clear along the region's edge and round any holes.

<Figures :items="[
  { name: 'options-margin-0', caption: 'margin: 0' },
  { name: 'options-margin-10', caption: 'margin: 10' },
]" />

## Rounded corners

`cornerRadius` rounds every corner. A corner too small for the full radius gets the largest
radius that fits, so short edges and sharp corners stay tidy. SVG and canvas draw true arcs,
and the HTML renderers approximate them in the `clip-path`.

<Figures :items="[
  { name: 'options-radius-0', caption: 'cornerRadius: 0' },
  { name: 'options-radius-4', caption: 'cornerRadius: 4' },
  { name: 'options-radius-12', caption: 'cornerRadius: 12' },
]" />

## Rotation, origin and scale

- **`rotation`:** turns the pattern, in degrees.
- **`origin`:** shifts the pattern. For Penrose, the hat and the spectre it's the fixed centre
  the pattern grows from.
- **`tileScale`:** scales the whole pattern, whatever its size settings are called. This is how
  [`fit`](/guide/content#sizing-tiles-to-the-content) sizes tiles to the content.

The random patterns and `flow` ignore `rotation` and `origin`.

<Figures :items="[
  { name: 'options-rotation-0', caption: 'runningBond, rotation: 0' },
  { name: 'options-rotation-30', caption: 'rotation: 30' },
  { name: 'options-scale-half', caption: 'tileScale: 0.5' },
]" />

## Slivers at the edge

Where the region's edge cuts a tile, a small piece can be left behind. `minFill` drops cut
tiles smaller than that fraction of a whole tile.

<Figures :items="[
  { name: 'options-minfill-0', caption: 'minFill: 0' },
  { name: 'options-minfill-60', caption: 'minFill: 0.6' },
]" />

The code for these pictures:

<<< @/examples/options.ts

## All the options

| Option | Default | |
|---|---|---|
| `region` | (required) | A rectangle `{ x, y, width, height }` or a simple polygon. See [Regions](/guide/regions). |
| `tiling` | (required) | The pattern spec. See [Patterns](/guide/patterns). |
| `holes` | none | Rectangles or polygons to leave empty. |
| `gap` | 0 | Space between tiles. |
| `margin` | 0 | Border kept clear along the region's edge and round holes. |
| `cornerRadius` | 0 | Radius of every tile corner. |
| `rotation` | 0 | Pattern rotation, in degrees. |
| `origin` | region's top left | Where the pattern is anchored. |
| `edges` | `"clip"` | `"clip"`, `"inside"`, `"overflow"` or `"window"`. See [Edges](/guide/regions#edges). |
| `minFill` | 0 | Drop edge tiles smaller than this fraction of a tile. |
| `tileScale` | 1 | Scale the whole pattern. |
| `features` | none | Groups of tiles merged into bigger cells. See [Featured tiles](/guide/featured). |
| `sizeAt` | none | Vary the tile size across the region. See [Tile size by density](/guide/density). |
| `maxTiles` | 20000 | A safety cap on the number of tiles generated. |
