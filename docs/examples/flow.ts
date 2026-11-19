import { createLayout, flow, imageFill, protoTileFill } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { scenePixels } from "./shared";

const region = { x: 0, y: 0, width: 240, height: 160 };
const rows = protoTileFill(["#e9c46a", "#f4a261"]);

/** Rows following the region's outline (the default). */
export function outline() {
  const layout = createLayout({ region, tiling: flow({ size: 9 }), gap: 0.8 });
  return renderToString(layout, { fill: rows, background: "#5b4636" });
}

/** Rows ringing two centre points, meeting the rows along the edges. */
export function centres() {
  const layout = createLayout({
    region,
    tiling: flow({ size: 8, centers: [{ x: 75, y: 75 }, { x: 175, y: 95 }], followEdges: true }),
    gap: 0.8,
  });
  return renderToString(layout, { fill: rows, background: "#5b4636" });
}

/** Rows along a guide curve, and parallel to it on both sides. */
export function guide() {
  const curve = Array.from({ length: 25 }, (_, i) => ({ x: (i / 24) * 240, y: 80 + 40 * Math.sin((i / 24) * 2 * Math.PI) }));
  const layout = createLayout({ region, tiling: flow({ size: 8, guides: [{ points: curve }] }), gap: 0.8 });
  return renderToString(layout, { fill: rows, background: "#5b4636" });
}

// #region mosaic
/** A mosaic: rows ringing the sun and following the coast, coloured from the picture. */
export function mosaic() {
  const pixels = scenePixels();
  const layout = createLayout({
    region,
    tiling: flow({
      size: 5,
      centers: [{ x: 149, y: 75 }],
      guides: [{ points: [{ x: 0, y: 99 }, { x: 240, y: 99 }] }],
      followEdges: true,
    }),
    gap: 0.6,
  });
  return renderToString(layout, { fill: imageFill(pixels), background: "#2b2524" });
}
// #endregion mosaic
