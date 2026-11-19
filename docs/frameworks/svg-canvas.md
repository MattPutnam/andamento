# SVG, canvas and PNG

`@andamento/svg` draws a layout without HTML: as an SVG string or element, on a canvas, or as a
PNG. Every picture in this manual is `renderToString` output.

```bash
npm install @andamento/core @andamento/svg
```

## SVG

```ts
import { createLayout, herringbone } from "@andamento/core";
import { renderToString, renderToElement } from "@andamento/svg";

const layout = createLayout({ region: { x: 0, y: 0, width: 240, height: 150 }, tiling: herringbone({ length: 60, width: 30 }), gap: 2 });
const svg = renderToString(layout, { images: imageUrls, background: "#f4f1ea" });
document.body.append(renderToElement(layout, { fill: ["#eee", "#ddd"] }));
```

Rounded corners are true arcs. The `<svg>` has a `viewBox` of the layout's bounds, so it
scales to any size.

### Options

| Option | |
|---|---|
| `images` | An array, assigned in reading order, or `(cell) => url`. |
| `repeatImages` | Start the array again when there are more cells than images. |
| `contentCells`, `placement` | Which cells take images, and where they go when there are fewer. |
| `imageAspects` | Width / height of each image, to match shapes. |
| `choose` | With `imageAspects`: `"shape"` also chooses which cells. |
| `imageFit` | `"cover"` (default) or `"contain"` (whole, in the safe area). |
| `containWithin` | `"tile"` or `"visible"`, for window layouts. |
| `imageFocus` | Focal point of each image. |
| `fill` | Color of cells without an image: a color, palette or function. Defaults to `defaultPalette`. |
| `stroke`, `strokeWidth` | An outline on top of each cell. |
| `relief` | Raised tiles. |
| `background` | Color painted over the region (the grout). |
| `backdrop` | One image across all the cells. |
| `title`, `imageAlts` | Accessible names. |
| `idPrefix` | Prefix for generated ids, when several layouts share a page. |
| `precision` | Decimal places (default 3). |
| `width`, `height` | Attributes for the `<svg>`. |

Lower-level pieces are exported too:

- **Paths:** `cellPath(layout, cell)`, `regionPath(layout)`, `viewPath(layout)` and
  `polygonToPath(polygon, precision, radius)`.
- **Structure:** `toSvgTree` and `serialize`.
- **Relief:** `reliefPaths`.

## Canvas and PNG

```ts
import { renderToPng, drawLayout } from "@andamento/svg";

const png = await renderToPng(layout, { images, width: 1200, pixelRatio: 2, relief: true });
// or draw on a canvas you already have (synchronous; pass loaded images):
drawLayout(canvas.getContext("2d"), layout, { fill: palette, loaded });
```

The canvas renderer takes the same options as the SVG one and draws the same thing: the
background, cast shadows, fills, images (`cover` or `contain`), the backdrop, bevels and
strokes, with rounded corners drawn as true arcs.

| Function | |
|---|---|
| `renderToPng(layout, options)` | Loads the images, draws on an offscreen canvas and resolves to a `Blob`. Use `type` and `quality` for JPEG or WebP. |
| `renderToCanvas(layout, canvas, options)` | The same, onto your own canvas. |
| `drawLayout(ctx, layout, options)` | Draws synchronously, scaled to fit the canvas and centerd. Pass loaded images in `loaded`, e.g. from `loadImages(imagesUsed(layout, options))`. |

`width` and `pixelRatio` set the size; the height follows the layout's shape.

It works with any 2D context. In Node, use a canvas package such as `@napi-rs/canvas` or
`skia-canvas`: pass its `loadImage` and `createCanvas`, or call `drawLayout` and use its own
export.

Two cautions:

- **Images from other sites:** they load with `crossOrigin = "anonymous"`, so the server must
  allow it, or the browser won't let the canvas be exported. Images that fail to load show their
  cell's `fill`.
- **HTML content:** `<TileLayout>` children are HTML, so they can't be drawn. The canvas
  renderer draws images and colors.
