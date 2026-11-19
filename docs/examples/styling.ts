import {
  createLayout, gradientFill, hexagonal, imageFill, jigsaw, paletteFill, penrose, protoTileFill, randomFill, rhombille, voronoi,
  type LayoutOptions,
} from "@andamento/core";
import { renderToString, type FillSource } from "@andamento/svg";
import { sceneImage, scenePixels } from "./shared";

const region = { x: 0, y: 0, width: 200, height: 130 };
const hexes: LayoutOptions = { region, tiling: hexagonal({ size: 18 }), gap: 2 };

/** The fill helpers, side by side. */
export function fills() {
  const draw = (fill: FillSource, options = hexes) =>
    renderToString(createLayout(options), { fill, background: "#fbf8f3" });
  return {
    palette: draw(paletteFill(["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"])),
    gradient: draw(gradientFill(["#f6d365", "#fda085", "#7b4397"], { angle: 30 })),
    "proto-tile": draw(protoTileFill(["#f4f1de", "#e07a5f", "#3d405b"]), { region, tiling: rhombille({ size: 20 }), gap: 1 }),
    random: draw(randomFill(["#ede0d4", "#e6ccb2", "#ddb892", "#b08968", "#7f5539"], 7), { region, tiling: voronoi({ size: 14, seed: 3 }), gap: 1.5 }),
  };
}

// #region mosaic
/** A mosaic: each tile the average colour of a picture under it, snapped to a box of tile colours. */
export function mosaic() {
  const tileColours = ["#1d1b3a", "#3b2f63", "#7a3b69", "#c44f78", "#e8766b", "#f6a35c", "#ffd58a", "#fff1cf", "#30263f", "#5a3d5c", "#d66868", "#26355f"];
  const layout = createLayout({ region: { x: 0, y: 0, width: 240, height: 160 }, tiling: penrose({ size: 7 }), origin: { x: 120, y: 80 }, gap: 0.5 });
  return {
    "mosaic-average": renderToString(layout, { fill: imageFill(scenePixels()), background: "#141418" }),
    "mosaic-palette": renderToString(layout, { fill: imageFill(scenePixels(), { palette: tileColours }), background: "#141418" }),
  };
}
// #endregion mosaic

// #region backdrop
/** One picture across all the tiles: a jigsaw. */
export function backdrop() {
  const layout = createLayout({ region: { x: 0, y: 0, width: 240, height: 160 }, tiling: jigsaw({ size: 40, seed: 5 }), gap: 1.5 });
  return renderToString(layout, { backdrop: sceneImage(), background: "#f1ece4", relief: { shadow: 1 } });
}
// #endregion backdrop

/** Grout and relief: raised tiles with a lit bevel and a shadow into the grout. */
export function relief() {
  const options: LayoutOptions = { region, tiling: hexagonal({ size: 24 }), gap: 4, cornerRadius: 3 };
  const fill = ["#e9c46a", "#f4a261", "#e76f51", "#2a9d8f"];
  return {
    flat: renderToString(createLayout(options), { fill, background: "#d8d2c4" }),
    raised: renderToString(createLayout(options), { fill, background: "#d8d2c4", relief: { shadow: 2 } }),
    "lit-from-right": renderToString(createLayout(options), { fill, background: "#d8d2c4", relief: { light: 90, strength: 0.6, shadow: 2 } }),
  };
}
