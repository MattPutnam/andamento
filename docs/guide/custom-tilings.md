# Your own tilings

Two specs let you bring your own tiles. Nothing checks that your tiles fit together, so
overlapping or gappy input gives an overlapping or gappy layout.

<Figures :items="[
  { name: 'custom-trominoes', caption: 'periodic: two L-trominoes, repeated' },
  { name: 'custom-fan', caption: 'tiles: your own polygons, as given' },
]" />

<<< @/examples/custom.ts

## Repeating tilings: `periodic`

`periodic({ a, b, motif })` copies the `motif` (one or more polygons, in region units) to every
`i·a + j·b`. It gets everything the built-in patterns get: gap, margin, edges, rounding,
neighbors, rotation, origin, and stable lattice-based ids.

`checkPeriodic(spec)` samples one lattice cell and reports the fraction of points covered by
no tile (`gaps`) or by several (`overlaps`), plus whether any polygon crosses itself:

```ts
checkPeriodic(trominoes); // { ok, gaps, overlaps, selfIntersecting, cellArea, motifArea }
```

`periodicDefinition(spec)` gives the `{ a, b, motif }` of any built-in repeating pattern, as a
starting point for your own.

## Your own polygons: `tiles`

`tiles({ tiles: [{ polygon, id?, protoTile? }, …] })` uses your polygons as they are.
`rotation` and `origin` don't apply. Give each tile an `id` to keep it stable across changes,
and a `protoTile` to tell kinds of tile apart.

Polygons can be non-convex but must be simple: their outlines must not cross themselves.

## Lower-level helpers

The building blocks are exported too:

- **Coloring:** `colorCells` (neighbor-aware color indices).
- **Polygon operations:** `insetPolygon`, `roundedPolygon`, `overlay`.
- **Generators:** `voronoiCells`, `delaunayTriangles` and `generateSubstitution` (for
  substitution tilings like Penrose).
