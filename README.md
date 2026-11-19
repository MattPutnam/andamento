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

#### Matching items to tile shapes

```tsx
const aspects = useImageAspects(photos); // width / height of each, once loaded
<TileLayout options={options} aspects={aspects} choose="shape">
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

With `aspects` (one width / height per child), each child goes in a tile of similar shape,
so `object-fit: cover` crops as little as possible: landscape photos in wide tiles,
portraits in tall ones. The arrangement minimises the total crop (as the difference in log
aspect ratio, which matching in sorted order solves exactly). By default the same tiles are
used as without matching (`placement`), only rearranged; `choose="shape"` also picks which
tiles get content by their shape, e.g. the vertical bricks of a herringbone for portraits.
Featured tiles still take the first children. A tile's shape is its bounding box, which is
what content is laid out in.

`<SvgTileLayout imageAspects={…}>` and `renderToString(layout, { imageAspects })` do the
same for `images`, and `matchSlots(layout, aspects, { cells, placement, choose })` in core
returns the item per cell. Children's order no longer follows reading order when matching.

#### Keeping content out of clipped corners

```tsx
<TileLayout options={{ region, tiling: hexagonal({ size: 60 }) }} safeArea>
  {labels.map((t) => <p key={t} style={{ margin: 0, height: "100%", display: "grid", placeItems: "center" }}>{t}</p>)}
</TileLayout>
```

Content normally fills a tile's bounding box and is clipped to the tile's shape, so text in a
triangle or hexagon loses its corners. With `safeArea`, each tile's content goes in a box at
the tile's *safe area*: the largest rectangle that fits inside its shape (holes and rounded
corners included), centred where it could slide. Add `aspects` and each child's box has the
child's own shape, so a photo or card shows whole and uncropped, as big as the tile allows.
The box has `data-safe-area`, and every tile shows its `fill` around it.

For SVG, `imageFit: "contain"` (on `<SvgTileLayout>` or `renderToString`) draws each image
whole inside its cell's safe area, at its `imageAspects` shape. In core,
`safeArea(cell, layout, { aspect })` returns the rectangle in layout units and
`safeAreaCss(cell, layout, { aspect })` places it inside the cell's element. It works for
any shape, convex or not, and is cached per cell; without `aspect` it finds the
largest-area rectangle of any shape.

#### Grout and relief

```tsx
<TileLayout options={{ region, tiling: hexagonal({ size: 40 }), gap: 4, cornerRadius: 3 }}
  background="#d8d2c4" relief={{ shadow: 2 }}>
  {children}
</TileLayout>
```

`gap` is the grout width and `background` its color (any CSS background, so a texture
works too). `relief` makes the tiles look raised: a bevel round each tile's edges, drawn
over its content, with faces turned towards the light brightened and the others darkened.
It follows rounded corners, holes and non-convex shapes, and narrows on thin tiles. Set
`shadow` and each tile also casts a soft shadow into the grout, away from the light.

| `relief` option | Default | |
|---|---|---|
| `bevel` | 8% of a typical tile's size | bevel width, layout units |
| `light` | 315 (top left) | where light comes from, degrees clockwise from the top |
| `strength` | 0.4 | opacity of the strongest highlight and shade |
| `shadow` | 0 (none) | how far shadows fall into the grout |
| `shadowBlur`, `shadowOpacity` | `shadow`, 0.35 | |

`relief` works the same on `<SvgTileLayout>` and `renderToString`. In core,
`bevelFacets(cell, layout, { width, light })` returns the bevel's faces, each with a
`shade` from 1 (facing the light) to -1; `reliefPaths` in `@andamento/svg` groups them into
a few paths per tile.

#### Keyboard navigation and accessibility

```tsx
<TileLayout options={options} navigable aria-label="Holiday photos"
  cellLabel={(cell, { slot }) => photos[slot]?.alt}
  onCellActivate={(cell, { slot }) => openPhoto(slot)}>
  {photos.map((p) => <img key={p.src} src={p.src} alt="" style={coverStyle} />)}
</TileLayout>
```

The layout is a list (`role="list"`, unless you pass another `role`) and each tile with
content a list item, in reading order. Tiles with nothing in them are hidden from assistive
technology as decoration. `cellLabel` gives tiles an accessible name.

With `navigable`, the tiles with content are one tab stop (a roving tabindex). The arrow keys
move to the nearest tile in that direction, in any tiling: hexagons, herringbone or
aperiodic hats. Home and End go to the first and last tile. `onCellActivate` runs on Enter,
Space or a click. Keys pressed in a tile's own inputs or buttons are left alone. The focused
tile gets a ring drawn inside its shape, because a CSS outline would be clipped away. Set
the ring's colour with `focusRing`, or pass `false` and style `[data-cell-id]:focus-visible`
yourself. In core, `cellInDirection(layout, cell, "left", accept?)` is the same navigation.

For SVG, `imageAlts` (on `<SvgTileLayout>` or `renderToString`) gives each image a text
alternative. Those cells become labelled images, the SVG a group of them, and the rest is
hidden as decoration.

#### Animated transitions

```tsx
<TileLayout options={options} animate>{children}</TileLayout>
<TileLayout options={options} animate={{ duration: 600, easing: "ease-in-out" }}>…</TileLayout>
```

With `animate`, tiles move smoothly when the layout or the children change. This covers
resizing the region, switching tilings, changing the gap or corner radius, and adding,
removing or reordering children.
- **Moving and reshaping:** a child keeps its tile element (give children keys), and the
  tile glides to its new place while its shape morphs, a square into a hexagon say.
- **Coming and going:** new tiles fade in, and removed ones stay a moment to fade out.
- **Colours:** empty-tile fills cross-fade.
- **Bevels:** a `relief` bevel fades in for the new shape as the tile arrives.

It is all CSS transitions, with no animation loop in JavaScript. Every tile's `clip-path`
is given the same number of points (see `resamplePolygon`, and `cellCss(…, { points })` in
core), which is what lets CSS morph between any two shapes. Cells with holes switch shape
without morphing. Animation is off for users who prefer reduced motion. Static SVG output
doesn't animate.

#### Virtualisation

```tsx
<TileLayout options={{ region: { x: 0, y: 0, width: 2000, height: 40000 }, tiling }} virtualize>
  {thousandsOfPhotos}
</TileLayout>
```

With `virtualize`, only the tiles in view are mounted, so layouts with thousands of tiles stay
quick. "In view" means within the window and any scrolling container, plus `overscan` pixels
round it (`virtualize={{ overscan: 600 }}`; default 300). Tiles mount and unmount as you
scroll or the layout resizes, checked at most once a frame. The view is measured in coarse
steps, so small scrolls don't re-render. Hit testing's spatial index finds the tiles in view.

Everything else keeps working:
- **Keyboard:** navigation reaches every tile. The tab stop stays mounted, and moving to a tile
  out of view mounts it, focuses it and scrolls to it.
- **Screen readers:** list items carry `aria-setsize` and `aria-posinset`, because they can't
  count tiles that aren't there.
- **Animation:** tiles scrolling in and out don't play the enter and exit animations.
- **Relief:** bevels are worked out per tile as it's first shown, and cast shadows for the
  tiles mounted.

Two limits:
- **`renderCell`:** it's only called for tiles in view, so every cell `contentCells` allows
  counts as having content.
- **Server rendering:** it renders the sized container without tiles, which appear once the
  page measures the view.

#### Hit testing

```tsx
const layout = useTileLayout(options);
<TileLayout layout={layout}
  onPointerMove={(e) => setHovered(cellFromPointer(layout, e, { tolerance: 4 })?.id)}>
  {children}
</TileLayout>
```

Each tile's own DOM events already follow its shape. Hit testing also works where there are
no tile elements: the gaps, an `<svg>`, a canvas, or plain layout geometry.
- **`cellAt(layout, point, { tolerance })`:** the cell whose visible shape (gap, rounded
  corners and holes included) contains a point in layout units. With `tolerance`, a point
  that close to a tile also counts, e.g. in the grout or for touch.
- **`nearestCell(layout, point, maxDistance?)`:** the containing cell, or else the one whose
  edge is closest.
- **`cellsInRect(layout, rect, { contain })`:** cells meeting a rectangle, or wholly inside
  it, for marquee selection or what's in view. Rectangles dragged up or left work too.
- **`screenToLayout(layout, box, clientX, clientY)`:** converts a screen point using the
  element's `getBoundingClientRect()`, letterboxed like SVG's default
  `preserveAspectRatio`. `cellFromPointer(layout, event, options)` in
  `@andamento/react` does both steps for an event handler.

A spatial index is built once per layout, so lookups stay fast on layouts with tens of
thousands of cells.

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

`imageFill(pixels, { fit, palette, fallback, samples })` colors each tile with the average
color of an image under it, for a mosaic. `pixels` is RGBA data (`{ width, height, data }`,
e.g. a canvas `ImageData`); the image covers the layout like `backdrop` does (`fit: "cover"`,
or `"contain"` / `"stretch"`). Averages are taken in linear light, the way colors mix by eye,
and `palette` snaps each tile to the nearest of a set of colors, like choosing from a box of
real tiles. In a browser, `loadImagePixels(url)` reads an image's pixels (it must be
same-origin, a data URL, or CORS-enabled), and in React:

```tsx
const fill = useImageFill("portrait.jpg", { palette: tileColors }); // undefined while loading
<SvgTileLayout options={options} fill={fill} />
```

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

## Canvas and PNG

```ts
import { renderToPng, drawLayout } from "@andamento/svg";

const png = await renderToPng(layout, { images, width: 1200, pixelRatio: 2, relief: true });
// or draw on a canvas you already have (synchronous; pass loaded images):
drawLayout(canvas.getContext("2d"), layout, { fill: palette, loaded });
```

The canvas renderer takes the same options as the SVG one and draws the same thing:
background, cast shadows, fills, images (`cover` or `contain`), the backdrop, bevels and
strokes, with rounded corners drawn as true arcs.
- **`renderToPng(layout, options)`:** loads the images, draws on an offscreen canvas and
  resolves to a `Blob`. Use `type` and `quality` for JPEG or WebP.
- **`width` and `pixelRatio`:** set the size; the height follows the layout's shape.
- **`renderToCanvas(layout, canvas, options)`:** the same, onto your own canvas.
- **`drawLayout(ctx, layout, options)`:** draws synchronously, scaled to fit the canvas and
  centred. Pass loaded images in `loaded`, e.g. from `loadImages(imagesUsed(layout, options))`.

It works with any 2D context. In Node, use a canvas package such as `@napi-rs/canvas` or
`skia-canvas`: pass its `loadImage` and `createCanvas` (or call `drawLayout` and its own
export).

Two cautions:
- **Images from other sites:** they load with `crossOrigin = "anonymous"`, so the server must
  allow it, or the browser won't let the canvas be exported. Images that fail to load show
  their cell's `fill`.
- **React content:** `<TileLayout>` children are HTML, so they can't be drawn; the canvas
  renderer draws images and colours.

## Development

```bash
npm install
npm test          # vitest, all packages
npm run build     # tsup → dist/ (ESM + CJS + .d.ts)
npm run typecheck # run after build: packages resolve each other through dist/
npm run dev       # playground at http://localhost:5173
```

### One picture across all tiles

```tsx
<TileLayout options={options} backdrop={<img src="mural.jpg" alt="" style={coverStyle} />} />
```

`backdrop` is rendered in every tile, sized and positioned to the whole layout, so the tiles
together show it as one picture, each through its own window, with the gaps and cut-outs
of the pattern in between. Any element that fills its box works; `coverStyle` crops an image
to cover the layout. It sits behind each tile's content, so children (if any) appear on top and
empty tiles show the picture instead of `fill`. Every tile holds its own copy: images load
once, but a video would play out of sync in each tile.

`<SvgTileLayout backdrop="mural.jpg">` and `renderToString(layout, { backdrop })` draw the
image once, clipped to all the cells. For other renderers, `backdropCss(cell, layout)` gives
the box to place inside each cell's element.

### Featured tiles

```ts
createLayout({
  region,
  tiling: hexagonal({ size: 30 }),
  features: [{ tiles: 7 }, { tiles: 3, at: { x: 40, y: 30 } }],
});
```

Each feature merges `tiles` neighbouring tiles into one bigger cell, for a hero image or a
highlighted item. The group grows from the tile nearest `at` (default: the middle of the
region), adding whichever neighbour keeps it most compact, so 4 grid tiles make a 2 × 2
square and 7 hexagons a flower; it prefers tiles the region edge doesn't cut. Features never
share tiles. To pick the tiles yourself, pass `ids` (tile ids are stable, so read them from a
layout without features).

Merging happens before the gap and edge handling, so a featured cell gets the same gap all
round and is cut, rounded and given neighbours like any other. Featured cells have
`featured` (their position in `features`) and `merged` (the ids of the tiles inside), and
take the first content: `<TileLayout>`'s first child goes to the first feature, and so on;
the rest follow `placement` as usual.

### Andamento flow

```ts
createLayout({ region, tiling: flow({ size: 8 }) }); // rows along the edges
createLayout({ region, tiling: flow({ size: 8, centers: [{ x: 300, y: 200 }], followEdges: true }) });
createLayout({ region, tiling: flow({ size: 8, guides: [{ points: curve }] }) });
```

*Andamento* is the flow of a mosaic: tesserae laid in rows (courses) that follow the
shapes of the picture. The `flow` tiling lays its rows along three kinds of guide:
- **The region's outline:** this is `followEdges`, the default when there's nothing else.
  Rows run round any holes too, as in opus vermiculatum.
- **Centre points:** each gets a round tessera, ringed by row after row.
- **Guide curves:** open or closed polylines in layout units. A row runs along each curve, with
  more rows parallel to it on both sides.

Where rows from different guides meet, they end against each other the way a mosaicist's
would: mitred at corners, and fitted together where rings meet straight rows.

The options:
- **`size`:** the row height.
- **`length`:** the tessera length along its row, as a multiple of `size` (default 1.3).
- **`jitter`:** how much tessera lengths vary (default 0.3).
- **`seed`:** varies the random lengths.
- **Row colours:** rows alternate `protoTile` 0 and 1, so `protoTileFill` can colour by row.

How it's built:
- **Rows:** each row is a band of a distance field. Its edges are the field's level lines, and
  tesserae are cut across it between seeds spaced along its centre line.
- **Exact cover:** the bands and cuts are assembled into tiles that cover the region exactly,
  with leftover crumbs merged into a neighbour in the same row.
- **Speed:** a 400 × 300 region with rows 10 high (about 1,000 tesserae) takes about a quarter
  of a second.
- **Limits:** `rotation`, `origin` and `sizeAt` don't apply. `tileScale` scales the rows.

### Tile size by density

```ts
createLayout({ region, tiling: hexagonal({ size: 30 }), sizeAt: radialSize({ center: { x: 400, y: 300 }, radius: 350 }) });
createLayout({ region, tiling: voronoi({ size: 40 }), sizeAt: imageSize(await loadImagePixels(url), bounds) });
```

`sizeAt` sets the tile size across the region. It gives the size wanted at each point, as a
factor of the tiling's own size: 1 as given, 0.5 half as big, 2 twice as big. This puts small
tiles round a focal point, along the edges, or wherever a picture has detail.

How the size changes depends on the tiling:
- **Voronoi and Delaunay:** the size changes smoothly. Sites are scattered more densely where
  tiles should be small, then evened out by density-weighted relaxation.
- **Every other tiling:** tiles are generated at the largest size wanted. Where tiles should be
  under about half that, groups of them are replaced by the same tiling at half the scale,
  then again, down to the smallest. A grid from the same origin nests exactly, like a quadtree.
  Other tilings are cut where a finer area meets a coarser one, and cut slivers are merged into
  a neighbour, so there are no crumbs or gaps.

Three helpers make size fields, each easing smoothly between its two sizes:
- **`radialSize({ center, radius, inner, outer })`:** small at a point, growing outwards.
- **`edgeSize(region, { distance, edge, middle, holes })`:** small along the edges.
- **`imageSize(pixels, box, { dark, light, invert })`:** small where a picture is dark (or
  light, with `invert`), covering `box` like `object-fit: cover`.

Everything else (gaps, holes, features, content placement, hit testing) works on the result
as usual. `maxTiles` still caps the count.

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
