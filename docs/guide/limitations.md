# Limitations

- **Regions:** the region, and each hole, must be a single outline that doesn't cross itself.
  For a region in several separate parts, make one layout per part.
- **Rotation:** the random patterns (`voronoi`, `delaunay`, `ashlar`, `mondrian`, `jigsaw`) and
  `flow` ignore `rotation` and `origin`.
- **Curves:** curved tiles are approximated with short straight segments.
- **Wide gaps:** if `gap` is wider than a narrow part of a tile (a jigsaw neck, say), that part
  is dropped and the largest remaining piece is kept.
- **Split tiles:** if the region's edge cuts a non-convex tile into separate parts, each part
  becomes its own cell. The largest keeps the tile's id, and the others get `~1`, `~2`, ….
  With `edges: "window"`, the tile stays one cell instead.
- **Cropping:** content is laid out in each tile's bounding box and clipped. For hexagons and
  cut edge tiles, keep important content near the middle, or use
  [safe areas or focal points](/guide/photos).
- **Crowded features:** when heavy items crowd together, a later feature may come out as an L
  or T shape rather than a block.
- **Canvas:** the canvas renderer draws images and colors, not HTML children.
