# @andamento/react

React components for [Andamento](https://mattputnam.github.io/andamento/) tiling layouts. Split a region into hexagons,
herringbone, Penrose rhombs, hats, jigsaw pieces and more, and put any children in the tiles,
clipped to their shapes. Includes photo matching, focal points, featured tiles, keyboard
navigation, animated transitions and virtualization.

**[Manual](https://mattputnam.github.io/andamento/) · [React](https://mattputnam.github.io/andamento/frameworks/react) · [Examples](https://mattputnam.github.io/andamento/examples/) · [API](https://mattputnam.github.io/andamento/reference/) · [Playground](https://mattputnam.github.io/andamento/playground/)**

```bash
npm install @andamento/core @andamento/react
```

```tsx
import { TileLayout, coverStyle } from "@andamento/react";
import { hexagonal } from "@andamento/core";

<TileLayout
  options={{ region: { x: 0, y: 0, width: 240, height: 150 }, tiling: hexagonal({ size: 26 }), gap: 2 }}
  navigable animate aria-label="Photos"
>
  {photos.map((p) => <img key={p.src} src={p.src} alt={p.alt} style={coverStyle} />)}
</TileLayout>
```

MIT licensed.
