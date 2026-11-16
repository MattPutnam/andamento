# Andamento

Tiling layouts for photo walls, rendered as SVG.

| Package | What it does |
|---|---|
| `@andamento/core` | Pure TypeScript, no DOM. Generates a pattern, applies gap/margin/edge rules, returns `Cell[]`. |
| `@andamento/svg` | Renders a layout to an SVG string (`renderToString`) or DOM element (`renderToElement`). |
| `@andamento/react` | `<TileLayout>` component, `useTileLayout()` hook, `<CellImage>`. |

```ts
import { createLayout, herringbone } from "@andamento/core";
import { renderToString } from "@andamento/svg";

const layout = createLayout({
  region: { x: 0, y: 0, width: 240, height: 150 }, // the wall, in any unit
  tiling: herringbone({ length: 60, width: 30 }),
  gap: 2,
  margin: 4,
  rotation: 0,
  edges: "clip",   // "clip" | "inside" | "overflow"
  minFill: 0.25,   // drop edge slivers smaller than 25% of a tile
});

const svg = renderToString(layout, { images: photoUrls, background: "#f4f1ea" });
```

```tsx
<TileLayout options={options} images={photoUrls} background="#f4f1ea" />
```

Patterns: `grid`, `runningBond`, `herringbone`, `basketweave`, `hexagonal`, `mondrian`.
Every spec is a plain JSON object, so layouts can be saved and restored.

Each `Cell` has `polygon` (visible shape), `original` (full pattern tile), `bbox`, `centroid`, `area`,
`index` (reading order, used to assign photos), `boundary`, `protoTile` and `neighbors`.

## Development

```bash
npm install
npm test          # vitest, all packages
npm run build     # tsup → dist/ (ESM + CJS + .d.ts)
npm run typecheck
npm run dev       # playground at http://localhost:5173
```

## Limitations

- The wall must be a convex polygon (rectangles are the common case).
- Mondrian ignores `rotation` and `origin`.
- Photos are fitted to each cell's bounding box (`object-fit: cover`); there's no focal-point control yet.
