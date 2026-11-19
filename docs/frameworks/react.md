# React

```bash
npm install @andamento/core @andamento/react
```

## `<TileLayout>`: any content, clipped to the tiles

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

- **Children:** each top-level child fills one tile, in reading order. `null` and `false`
  children are skipped, and children beyond the number of tiles aren't rendered.
- **Tiles:** absolutely positioned `<div>`s with a CSS `clip-path`, sized in percentages, so
  the layout scales with its container's width. Its height follows from `aspect-ratio`.
- **Pointer events:** clipping applies to them too, so hover and clicks follow the tile
  shapes.
- **State:** children keep their state (a video's position, a form's input) when the layout
  options change. Give them keys.
- **Server rendering:** tiles render in place, with nothing to measure (except with
  `virtualize`).

### Props

| Prop | |
|---|---|
| `options` | Layout options, as for `createLayout`. Or pass `layout`. |
| `layout` | A layout made already (e.g. with `useTileLayout`). |
| `children` | One per tile, in reading order. |
| `renderCell(cell, { slot })` | Render each tile from its cell instead of children. |
| `contentCells` | Which tiles take children: `"all"`, `"whole"` or a test. [More](/guide/content) |
| `placement` | `"reading"`, `"center"` or `"spread"`. [More](/guide/content) |
| `fit` | Size the tiles to the number of children: `true`, `"atLeast"` or `"nearest"`. |
| `aspects` | Width / height of each child, to match it to a tile of its shape. [More](/guide/photos) |
| `choose` | With `aspects`: `"shape"` also chooses which tiles get content. |
| `safeArea` | `true`, `"tile"` or `"visible"`: put content in the largest rectangle inside each tile. |
| `focalPoints` | `{ x, y, aspect? }` per child: what to keep in view. |
| `weights` | Tiles each child spans. [More](/guide/featured#important-items) |
| `fill` | Color of empty tiles: a color, palette or function. Defaults to `neutralPalette`. |
| `fallback` | What to render in empty tiles (fixed, or per cell). |
| `backdrop` | One element shown across all the tiles. [More](/guide/styling#one-picture-across-all-the-tiles) |
| `background` | The grout: any CSS background. |
| `relief` | Raised tiles: `true` or `{ bevel, light, strength, shadow, … }`. |
| `navigable` | Arrow-key navigation, one tab stop. [More](/guide/accessibility) |
| `onCellActivate(cell, { slot, empty })` | Enter, Space or a click on a tile. |
| `cellLabel` | Accessible name per tile. |
| `focusRing` | Focus ring color, or `false` to style it yourself. |
| `animate` | `true` or `{ duration, easing }`. [More](/guide/animation) |
| `virtualize` | `true` or `{ overscan }`. [More](/guide/virtualization) |
| `cellClassName`, `cellStyle` | Per tile, fixed or a function `(cell, { empty, slot })`. |
| Any `<div>` attribute | `className`, `style`, `aria-label`, `onPointerMove`, … go on the layout element. |

Tile wrappers carry `data-cell-id`, `data-empty` and `data-boundary`; the layout carries
`data-andamento`.

## `<SvgTileLayout>`: a single `<svg>`

Use it when you need a single `<svg>`: to export, print or embed. It takes the options of
[`renderToString`](/frameworks/svg-canvas) as props: `images`, `imageAspects`, `imageFit`,
`imageFocus`, `imageWeights`, `imageAlts`, `fill`, `stroke`, `strokeWidth`, `relief`,
`backdrop`, `background`, `title`, `contentCells`, `placement`, `choose`, `fit`. `renderCell(cell,
ctx)` renders SVG per cell, with `ctx.path`, `ctx.clipPath`, `ctx.fill`, `ctx.image` and
`ctx.slot`. `<SvgCellImage cell href />` draws an image clipped to a cell.

```tsx
<SvgTileLayout options={options} images={photos} imageAspects={aspects} relief title="Photos" />
```

## Hooks

| Hook | |
|---|---|
| `useTileLayout(options)` | A layout, worked out again only when the options change by value. |
| `useFitCount(options, count, fit)` | A layout sized to `count` items. |
| `useImageAspects(srcs)` | Loads images and returns their width / height. |
| `useImageFocus(srcs)` | Loads images and guesses each one's focal point (`estimateFocus`). |
| `useImageFill(src, options)` | Loads an image and returns an `imageFill` for it. |

`cellFromPointer(layout, event, options)` finds the cell under a pointer event; see
[Hit testing](/guide/hit-testing).
