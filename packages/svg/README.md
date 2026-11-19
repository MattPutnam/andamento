# @andamento/svg

Draws [`@andamento/core`](https://www.npmjs.com/package/@andamento/core) tiling layouts as
an SVG string or element, on a canvas, or as a PNG. Images, fills, rounded corners, raised
tiles and one picture across all the tiles are all supported.

**[Manual](https://mattputnam.github.io/andamento/) · [SVG, canvas and PNG](https://mattputnam.github.io/andamento/frameworks/svg-canvas) · [Examples](https://mattputnam.github.io/andamento/examples/) · [API](https://mattputnam.github.io/andamento/reference/)**

```bash
npm install @andamento/core @andamento/svg
```

```ts
import { createLayout, herringbone } from "@andamento/core";
import { renderToString, renderToPng } from "@andamento/svg";

const layout = createLayout({ region: { x: 0, y: 0, width: 240, height: 150 }, tiling: herringbone({ length: 60, width: 20 }), gap: 2 });
const svg = renderToString(layout, { fill: ["#e9c46a", "#f4a261", "#e76f51"], background: "#264653" });
const png = await renderToPng(layout, { images: photoUrls, width: 1200, relief: true });
```

MIT licensed.
