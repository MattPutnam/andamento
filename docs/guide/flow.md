# Andamento flow

*Andamento* is the flow of a mosaic: tesserae laid in rows (courses) that follow the shapes of
the picture. The `flow` tiling lays its rows along three kinds of guide.

<Figures :items="[
  { name: 'flow-outline', caption: 'Along the region\'s outline (the default)' },
  { name: 'flow-centres', caption: 'Ringing centre points' },
  { name: 'flow-guide', caption: 'Along a guide curve' },
]" />

- **The region's outline (`followEdges`):** the default when there's nothing else. Rows run
  round any holes too, as in *opus vermiculatum*.
- **Centre points (`centers`):** each gets a round tessera, ringed by row after row.
- **Guide curves (`guides`):** open or closed polylines in layout units. A row runs along each
  curve, with more rows parallel to it on both sides.

Where rows from different guides meet, they end against each other the way a mosaicist's
would: mitred at corners, and fitted together where rings meet straight rows.

<<< @/examples/flow.ts

## A mosaic

Rows that ring the sun and run along the horizon, coloured from the picture with `imageFill`:

<Figure name="flow-mosaic" caption="flow({ size: 5, centers: [sun], guides: [horizon], followEdges: true }) with imageFill" />

## Options

| Option | Default | |
|---|---|---|
| `size` | (required) | The row height: each tessera's width across its row. |
| `length` | 1.3 | Tessera length along its row, as a multiple of `size`. |
| `jitter` | 0.3 | How much tessera lengths vary, from 0 (all alike) to 0.9. |
| `guides` | none | `{ points, closed? }[]`: curves for rows to follow. |
| `centers` | none | Points for rows to circle. |
| `followEdges` | true without guides or centres | Rows also run along the region's outline and round holes. |
| `seed` | 1 | Varies the random lengths. |

Rows alternate `protoTile` 0 and 1, so `protoTileFill` can colour by row.

## How it's built

- **Rows:** each row is a band of a distance field. Its edges are the field's level lines, and
  tesserae are cut across it between seeds spaced along its centre line.
- **Exact cover:** the bands and cuts are assembled into tiles that cover the region exactly,
  with leftover crumbs merged into a neighbour in the same row.
- **Speed:** a 400 × 300 region with rows 10 high (about 1,000 tesserae) takes about a quarter
  of a second.
- **Limits:** `rotation`, `origin` and `sizeAt` don't apply. `tileScale` scales the rows.
