# Regions, holes and edges

## Region shapes

The region can be a rectangle or any simple polygon, convex or not, as long as its outline
doesn't cross itself. Examples: an L-shaped wall, the space under the stairs, a circle, or an
arch (approximate curves with short straight segments).

<Figures :items="[
  { name: 'regions-wall', caption: 'An L-shaped wall with a door and a window' },
  { name: 'regions-arch', caption: 'An arch' },
  { name: 'regions-round', caption: 'A circle of stones' },
]" />

<<< @/examples/regions.ts

## Holes

`holes` are left empty: doors, windows, sockets, a fireplace. They're rectangles or
polygons. They may overlap each other or stick out past the region's edge, as the door does
above. Tiles are cut round holes the same way they're cut at the region's edge, and `margin`
keeps a border round holes too.

A hole that falls entirely inside one tile becomes a hole in that cell (`cell.holes`).
`area` and `centroid` allow for it, `cellCss` returns an even-odd `clip-path`, and
`cellPath` adds the hole as a subpath.

<Figure name="regions-holed" caption="A hole inside a single hexagon." />

`layout.holes` lists the region's holes. `regionCss(layout)` and `regionPath(layout)` draw the
region with them, for example to shade the area behind the tiles.

A margin can pinch a narrow part of the region shut, which splits it in two.

## Edges

`edges` decides what happens to tiles that cross the region's edge (or a hole's). The dashed
line in the pictures is the region.

<Figures :columns="2" :items="[
  { name: 'edges-clip', caption: '&quot;clip&quot; (default): tiles are cut to the region. A cut tile is the piece inside, so rounding gives the cut new round corners.' },
  { name: 'edges-inside', caption: '&quot;inside&quot;: only tiles that fit entirely inside are kept.' },
  { name: 'edges-overflow', caption: '&quot;overflow&quot;: every tile that touches the region is kept whole, sticking out past it.' },
  { name: 'edges-window', caption: '&quot;window&quot;: tiles stay whole, and the region is a window onto them. The cut is a straight line through the rounded tile.' },
]" />

<<< @/examples/edges.ts

### Window edges

In `"clip"` mode a cut tile *is* the piece left inside the region. Rounding, relief and
content all treat the cut as a real edge: the bevel runs along it and a photo is centred in
the sliver. That suits work that ends at the region's edge, like a tiled floor.

With `edges: "window"` the tiles stay whole and the region only hides part of them:

- Each cut cell gets `tile`, the whole tile (after the gap). `polygon` is still the part that
  shows (its largest piece, if the outline cuts the tile in two; that stays one cell).
  `layout.view` is the area tiles show in: the region less its margin and holes.
- `cellShape(cell)` gives the shape to draw (the whole tile, or the cell's own polygon), and
  `visibleShapes(cell, layout)` gives the rounded shape less what's outside the view.
- Every renderer rounds, bevels and fills the whole tile, then hides what's outside the view
  with a straight, sharp cut. `cellCss` places the element over the whole tile and clips it to
  what shows; SVG and canvas clip to `viewPath(layout)`. Hit testing only finds what shows.
- Content sits where it would in the whole tile, so a photo at the edge is partly hidden.
  [Safe areas](/guide/photos#safe-areas) fit the whole tile too. To fit the part that shows
  instead, use `safeArea="visible"` in the components, `safeArea(cell, layout, { within:
  "visible" })` in core, or `containWithin: "visible"` with SVG's `imageFit: "contain"`.
  [Focal points](/guide/photos#focal-points) always aim at the part that shows.

Convex regions without holes use a fast clipping path. Anything else goes through a general
polygon overlay, applied only to tiles near an edge, so it costs about the same.
