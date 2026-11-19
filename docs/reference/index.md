# API reference

Everything each package exports, generated from the source's doc comments.

| Package | |
|---|---|
| [`@andamento/core`](./api/@andamento/core/) | Patterns, `createLayout`, content placement, fills, hit testing, keyboard navigation and CSS helpers. No DOM. |
| [`@andamento/svg`](./api/@andamento/svg/) | `renderToString`, `renderToElement`, `renderToPng`, `drawLayout` and SVG path helpers. |
| [`@andamento/react`](./api/@andamento/react/) | `<TileLayout>`, `<SvgTileLayout>` and hooks. |
| [`@andamento/vue`](./api/@andamento/vue/) | `<TileLayout>`, `<SvgTileLayout>` and composables. |
| [`@andamento/dom`](./api/@andamento/dom/) | `mountTileLayout`, `<andamento-layout>`, and the pieces the bindings share. |

## Where to start

- **Making a layout:** [`createLayout`](./api/@andamento/core/functions/createLayout.md),
  [`LayoutOptions`](./api/@andamento/core/interfaces/LayoutOptions.md),
  [`Layout`](./api/@andamento/core/interfaces/Layout.md),
  [`Cell`](./api/@andamento/core/interfaces/Cell.md).
- **Patterns:** the [`TilingSpec`](./api/@andamento/core/type-aliases/TilingSpec.md) union and
  each pattern's spec, e.g.
  [`HexagonalSpec`](./api/@andamento/core/interfaces/HexagonalSpec.md).
- **Content:** [`contentSlots`](./api/@andamento/core/functions/contentSlots.md),
  [`matchSlots`](./api/@andamento/core/functions/matchSlots.md),
  [`weightedLayout`](./api/@andamento/core/functions/weightedLayout.md),
  [`fitCount`](./api/@andamento/core/functions/fitCount.md).
- **Rendering:** [`RenderOptions`](./api/@andamento/svg/interfaces/RenderOptions.md),
  [React `TileLayoutProps`](./api/@andamento/react/interfaces/TileLayoutProps.md),
  [`TileLayoutConfig`](./api/@andamento/dom/interfaces/TileLayoutConfig.md) for
  `mountTileLayout`.
