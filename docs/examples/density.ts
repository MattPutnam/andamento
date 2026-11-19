import { createLayout, edgeSize, gradientFill, grid, hexagonal, imageFill, imageSize, radialSize, voronoi } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { scenePixels } from "./shared";

const region = { x: 0, y: 0, width: 240, height: 160 };

/** Small hexagons round a point, growing outwards. */
export function radial() {
  const layout = createLayout({
    region,
    tiling: hexagonal({ size: 22 }),
    sizeAt: radialSize({ center: { x: 150, y: 70 }, radius: 140, inner: 0.25 }),
    gap: 1,
  });
  return renderToString(layout, { fill: gradientFill(["#f6d365", "#e76f51", "#264653"], { shape: "radial" }), background: "#fbf8f3" });
}

/** Small squares along the edges: a grid nests exactly, like a quadtree. */
export function edges() {
  const layout = createLayout({
    region,
    tiling: grid({ width: 32 }),
    sizeAt: edgeSize([{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 160 }, { x: 0, y: 160 }], { distance: 40, edge: 0.25 }),
    gap: 1,
  });
  return renderToString(layout, { fill: ["#e76f51", "#f4a261", "#e9c46a", "#f1dca7"], background: "#fbf8f3" });
}

/** Small stones where a picture is dark, coloured from the same picture: a mosaic. */
export function picture() {
  const pixels = scenePixels();
  const layout = createLayout({
    region,
    tiling: voronoi({ size: 12, seed: 2 }),
    sizeAt: imageSize(pixels, region, { dark: 0.35 }),
    gap: 0.6,
  });
  return renderToString(layout, { fill: imageFill(pixels), background: "#1b1b24" });
}
