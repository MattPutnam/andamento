# @andamento/core

Tiling layouts in pure TypeScript, with no DOM: split a region into hexagons, herringbone,
Penrose rhombs, the hat monotile, jigsaw pieces, random stones, mosaic rows and more (29
patterns in all). You get back a list of cells, each with its polygon, bounding box, center,
neighbors and a stable id. The package also places content in the cells, colors them, and
handles hit testing, keyboard navigation and CSS placement.

**[Manual](https://mattputnam.github.io/andamento/) · [Patterns](https://mattputnam.github.io/andamento/guide/patterns) · [Examples](https://mattputnam.github.io/andamento/examples/) · [API](https://mattputnam.github.io/andamento/reference/) · [Playground](https://mattputnam.github.io/andamento/playground/)**

```bash
npm install @andamento/core
```

```ts
import { createLayout, hexagonal } from "@andamento/core";

const layout = createLayout({
  region: { x: 0, y: 0, width: 240, height: 150 },
  tiling: hexagonal({ size: 26 }),
  gap: 2,
  cornerRadius: 3,
});

for (const cell of layout.cells) console.log(cell.id, cell.polygon);
```

To draw layouts, use a renderer:

- [`@andamento/react`](https://www.npmjs.com/package/@andamento/react): React components.
- [`@andamento/vue`](https://www.npmjs.com/package/@andamento/vue): Vue components.
- [`@andamento/dom`](https://www.npmjs.com/package/@andamento/dom): a web component, and plain DOM.
- [`@andamento/svg`](https://www.npmjs.com/package/@andamento/svg): SVG, canvas and PNG.

The isohedral tilings and the hat tiling use code by Craig S. Kaplan under the BSD 3-Clause
license; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

MIT licensed.
