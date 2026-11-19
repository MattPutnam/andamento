# Color, pictures and relief

## Fills

`fill` colors tiles that have no content (in the SVG and canvas renderers, every tile without
an image). It takes:

- **A color:** every tile the same.
- **A palette:** an array of colors, given so neighboring tiles always differ.
- **A function:** `(cell, layout) => color`.

Core has ready-made functions:

<Figures :columns="4" :items="[
  { name: 'styling-palette', caption: 'paletteFill: neighbors differ' },
  { name: 'styling-gradient', caption: 'gradientFill: by position' },
  { name: 'styling-proto-tile', caption: 'protoTileFill: by kind of tile' },
  { name: 'styling-random', caption: 'randomFill: stable per tile' },
]" />

```ts
import { gradientFill, paletteFill, protoTileFill, randomFill } from "@andamento/core";

fill={paletteFill(["#eee", "#ddd", "#ccc"])}               // neighbors differ (same as passing the array)
fill={gradientFill(["#f6d365", "#fda085"], { angle: 45 })} // by position; also { shape: "radial" }
fill={protoTileFill(["#e7e5e4", "#d6d3d1"])}               // by kind of tile, e.g. herringbone's two directions
fill={randomFill(["#eee", "#ddd", "#ccc"], 42)}            // random, but stable per tile id across resizes
```

- **Gradients** take hex colors and blend in OKLab, so the middle doesn't turn gray.
  `angle` is in degrees (0 runs left to right, 90 top to bottom), and `shape: "radial"` runs
  from the region's middle out to its corners.
- **Palettes** are colored with `colorCells(layout, n)`, which gives neighbor-aware color
  indices. It's exported if you need the indices yourself.
- **Defaults:** `defaultPalette` (warm earth colors, the SVG default) and `neutralPalette`
  (soft grays, the HTML default for empty tiles) are exported from the renderers.

## Mosaics

`imageFill(pixels, options)` colors each tile with the average color of a picture under it.
Averages are taken in linear light, the way colors mix by eye. Add a `palette` and each tile
snaps to the nearest of a set of colors, like choosing from a box of real tiles.

<Figures :items="[
  { name: 'styling-mosaic-average', caption: 'Penrose rhombs, each the average color under it' },
  { name: 'styling-mosaic-palette', caption: 'Snapped to a box of twelve tile colors' },
]" />

<<< @/examples/styling.ts#mosaic

| `imageFill` option | Default | |
|---|---|---|
| `fit` | `"cover"` | How the picture is laid over the layout: `"cover"`, `"contain"` or `"stretch"`. |
| `palette` | none | Snap each tile to the nearest of these colors. |
| `fallback` | `"#d6d3d1"` | For tiles outside the picture. |
| `samples` | 256 | Points sampled per tile. |

`pixels` is RGBA data (`{ width, height, data }`, e.g. a canvas `ImageData`). In a browser,
`loadImagePixels(url)` reads an image's pixels; it must be same-origin, a data URL, or
CORS-enabled. In React:

```tsx
const fill = useImageFill("portrait.jpg", { palette: tileColors }); // undefined while loading
<SvgTileLayout options={options} fill={fill} />
```

Combine it with [`imageSize`](/guide/density) for small tiles where the picture has detail,
or with [`flow`](/guide/flow) for rows that follow its shapes.

## One picture across all the tiles

`backdrop` shows one picture across the whole layout, each tile showing its own piece, with
the gaps and cut-outs of the pattern in between.

<Figure name="styling-backdrop" caption="A jigsaw with a backdrop, raised." />

<<< @/examples/styling.ts#backdrop

- **HTML components:** `backdrop` is an element, rendered in every tile and sized and
  positioned to the whole layout. Any element that fills its box works, and `coverStyle` crops
  an image to cover the layout.
  - It sits behind each tile's content, so children appear on top and empty tiles show the
    picture instead of `fill`.
  - Every tile holds its own copy: images load once, but a video would play out of sync in
    each tile.
- **SVG:** `<SvgTileLayout backdrop="mural.jpg">` and `renderToString(layout, { backdrop })`
  draw the image once, clipped to all the cells.
- **Other renderers:** `backdropCss(cell, layout)` gives the box to place inside each cell's
  element.

```tsx
<TileLayout options={options} backdrop={<img src="mural.jpg" alt="" style={coverStyle} />} />
```

## Grout and relief

`gap` is the grout's width and `background` its color. In the HTML components
`background` is any CSS background, so a texture works too. `relief` makes the tiles look
raised:

- **Bevel:** a bevel runs round each tile's edges, drawn over its content. Faces turned
  towards the light are brightened and the others darkened.
- **Any shape:** it follows rounded corners, holes and non-convex shapes, and narrows on thin
  tiles.
- **Shadow:** set `shadow` and each tile also casts a soft shadow into the grout, away from
  the light.

<Figures :items="[
  { name: 'styling-flat', caption: 'No relief' },
  { name: 'styling-raised', caption: 'relief: { shadow: 2 }' },
  { name: 'styling-lit-from-right', caption: 'relief: { light: 90, strength: 0.6, shadow: 2 }' },
]" />

| `relief` option | Default | |
|---|---|---|
| `bevel` | 8% of a typical tile's size | Bevel width, in layout units. |
| `light` | 315 (top left) | Where the light comes from, in degrees clockwise from the top. |
| `strength` | 0.4 | Opacity of the strongest highlight and shade. |
| `shadow` | 0 (none) | How far shadows fall into the grout. |
| `shadowBlur` | `shadow` | |
| `shadowOpacity` | 0.35 | |

`relief: true` uses the defaults. It works the same in every renderer.

In core, `bevelFacets(cell, layout, { width, light })` returns the bevel's faces, each with a
`shade` from 1 (facing the light) to -1. `reliefPaths` in `@andamento/svg` groups them into a
few paths per tile.

## Outlines

The SVG and canvas renderers take `stroke` and `strokeWidth`, drawn on top of each cell.
