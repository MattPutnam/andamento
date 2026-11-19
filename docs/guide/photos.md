# Fitting photos

A photo covering its tile is cropped. These options choose which tile each photo goes in,
how it's cropped, and whether it's cropped at all.

## Matching photos to tile shapes

With `aspects` (one width / height per child), each child goes in a tile of similar shape, so
`object-fit: cover` crops as little as possible: landscape photos in wide tiles, portraits in
tall ones.

<Figures :items="[
  { name: 'fitting-in-order', caption: 'In reading order: wherever each photo falls' },
  { name: 'fitting-matched', caption: 'With imageAspects: each photo in a board of its own shape' },
]" />

<<< @/examples/fitting.ts#matching

- **What's minimized:** the arrangement minimizes the total crop, measured as the difference
  in log aspect ratio. Matching in sorted order solves that exactly.
- **Which tiles:** by default the same tiles are used as without matching (per `placement`),
  only rearranged. `choose="shape"` also picks which tiles get content by their shape, e.g. the
  upright bricks of a herringbone for portraits.
- **Featured tiles** still take the first children.
- **Order:** children's order no longer follows reading order when matching.

In React, `useImageAspects(srcs)` loads the images and returns their aspects. The SVG
renderers take `imageAspects`, and `matchSlots(layout, aspects, { cells, placement, choose })`
in core returns the item for each cell.

```tsx
const aspects = useImageAspects(photos);
<TileLayout options={options} aspects={aspects} choose="shape">
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

## Safe areas

Content normally fills its tile's bounding box and is clipped to the tile's shape, so text in a
triangle or hexagon loses its corners. With `safeArea`, each tile's content goes in a box at
the tile's **safe area**: the largest rectangle that fits inside its shape (holes and rounded
corners included), centerd where it could slide. Add `aspects` and each box has its child's own
shape, so a photo or card shows whole and uncropped, as big as the tile allows.

<Figure name="fitting-contain" caption="SVG with imageFit: &quot;contain&quot; and imageAspects: every photo whole." />

<<< @/examples/fitting.ts#contain

```tsx
<TileLayout options={{ region, tiling: hexagonal({ size: 60 }) }} safeArea>
  {labels.map((t) => <p key={t} style={{ margin: 0, height: "100%", display: "grid", placeItems: "center" }}>{t}</p>)}
</TileLayout>
```

- **The box:** it has `data-safe-area`, and every tile shows its `fill` round it.
- **SVG:** `imageFit: "contain"` (on `<SvgTileLayout>` or `renderToString`) draws each image
  whole inside its cell's safe area, at its `imageAspects` shape.
- **Core:** `safeArea(cell, layout, { aspect })` returns the rectangle in layout units, and
  `safeAreaCss(cell, layout, { aspect })` places it inside the cell's element. It works for any
  shape, convex or not, and is cached per cell. Without `aspect` it finds the largest-area
  rectangle of any shape.
- **Window layouts:** with `edges: "window"`, tiles cut by the region fit the whole tile unless
  you ask for `"visible"`.

## Focal points

A photo covering its tile is cropped round its middle, which can lose the subject in a
triangle, a tall thin tile, or a tile the region's edge cuts. Give each photo a **focal point**,
as fractions of its width and height, and its tile moves the photo so that point is as near the
middle of what shows as covering the tile allows.

<Figures :items="[
  { name: 'fitting-centerd', caption: 'Cropped round the middle: most suns are cut off' },
  { name: 'fitting-focused', caption: 'With imageFocus: every sun in view' },
]" />

<<< @/examples/fitting.ts#focus

```tsx
const focus = useImageFocus(photos); // or your own: [{ x: 0.3, y: 0.25 }, …]
<TileLayout options={options} focalPoints={focus}>
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

- **How it's applied:** each tile sets `--andamento-object-position`, which `coverStyle` uses
  as `object-position`. Use `var(--andamento-object-position)` with your own styles.
- **Exact placement:** it's exact when the photo's shape is known, from `aspects` or a focal
  point's own `aspect` (`{ x, y, aspect }`; `useImageFocus` includes it). Without it, the focus
  is used as the `object-position` percentage as it is.
- **The target:** the middle of the tile's safe area, so in a window layout it's the part that
  shows.
- **Guessing the focus:** `estimateFocus(pixels)` in core finds the spot whose color and
  brightness stand out most from their surroundings, leaning a little to the middle. It suits a
  subject against a plainer background; for busy pictures, give the focus yourself.
  `useImageFocus(srcs)` in React loads each image and runs it.
- **Other renderers:**
  - Vue takes `focalPoints` too.
  - `<andamento-layout>` reads `data-focus="0.3 0.25"` on children, or a `focalPoints`
    property, and `mountTileLayout` takes `focalPoints`.
  - SVG and canvas take `imageFocus` (by position in `images`) with `imageAspects`, or focal
    points with an `aspect`. The canvas renderers measure the images themselves.
  - In core, `coverRect(cell, layout, { aspect, focus })` gives where to draw an image, and
    `objectPosition(…)` the CSS for it.
