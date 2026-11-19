import {
  createLayout, fishScale, gradientFill, hat, hopscotch, isohedral, mondrian, octagonSquare, penrose, protoTileFill,
  randomFill, rhombille, spectre, voronoi,
} from "@andamento/core";
import { renderToString } from "@andamento/svg";

const region = { x: 0, y: 0, width: 240, height: 160 };
const middle = { x: 120, y: 80 };

// #region terrazzo
/** Terrazzo: small random stones in a pale ground. */
export function terrazzo() {
  const layout = createLayout({ region, tiling: voronoi({ size: 9, relax: 1, seed: 11 }), gap: 2.2, cornerRadius: 2.5 });
  return renderToString(layout, { fill: randomFill(["#d9a38a", "#8f9e8b", "#e8d5b5", "#c6c1b9", "#b5654a", "#efe6da", "#efe6da"], 3), background: "#f3eee6" });
}
// #endregion terrazzo

// #region blocks
/** Tumbling blocks: rhombs shaded by face, raised. */
export function blocks() {
  const layout = createLayout({ region, tiling: rhombille({ size: 22 }), gap: 1.5, cornerRadius: 1 });
  return renderToString(layout, { fill: protoTileFill(["#f2e8cf", "#bc4749", "#386641"]), background: "#2b2b2b", relief: { strength: 0.3 } });
}
// #endregion blocks

// #region escher
/** An Escher-style tessellation: one shape in two orientations. */
export function escher() {
  const layout = createLayout({ region, tiling: isohedral({ ih: 28, size: 56, amount: 0.25 }), gap: 1.5 });
  return renderToString(layout, { fill: protoTileFill(["#264653", "#e9c46a"]), background: "#fbf8f3" });
}
// #endregion escher

// #region painting
/** A Mondrian: random rectangles, mostly white, with black lines. */
export function painting() {
  const layout = createLayout({ region, tiling: mondrian({ minSize: 28, maxSize: 110, splitChance: 0.45, snap: 4, seed: 9 }), gap: 3.5, margin: 3.5 });
  return renderToString(layout, { fill: randomFill(["#f5f1e8", "#f5f1e8", "#f5f1e8", "#f5f1e8", "#d72d2d", "#1f4fa3", "#f2c230"], 4), background: "#111" });
}
// #endregion painting

// #region hats
/** The hat monotile: the mirrored hats (protoTile 4) picked out. */
export function hats() {
  const layout = createLayout({ region, tiling: hat({ size: 22 }), origin: middle, gap: 1.2 });
  return renderToString(layout, { fill: protoTileFill(["#a8dadc", "#cfe8e9", "#86c5c9", "#bfe0e2", "#e63946"]), background: "#1d3557" });
}
// #endregion hats

// #region spectres
/** The spectre, in a sunset gradient. */
export function spectres() {
  const layout = createLayout({ region, tiling: spectre({ size: 22 }), origin: middle, gap: 1.2, cornerRadius: 1 });
  return renderToString(layout, { fill: gradientFill(["#355c7d", "#6c5b7b", "#c06c84", "#f67280", "#f8b195"], { angle: 60 }), background: "#fbf8f3" });
}
// #endregion spectres

// #region penroseStar
/** Penrose rhombs radiating from the star at the center. */
export function penroseStar() {
  const layout = createLayout({ region, tiling: penrose({ size: 20 }), origin: middle, gap: 1.2 });
  return renderToString(layout, { fill: gradientFill(["#ffd166", "#ef476f", "#3a0ca3"], { shape: "radial" }), background: "#fbf8f3" });
}
// #endregion penroseStar

// #region bathroom
/** A bathroom floor: hopscotch tiles with white grout, raised. */
export function bathroom() {
  const layout = createLayout({ region, tiling: hopscotch({ large: 46, small: 23 }), rotation: 12, gap: 2.5, cornerRadius: 1.5 });
  return renderToString(layout, { fill: protoTileFill(["#e8e4dc", "#2f4858"]), background: "#fdfcf9", relief: { shadow: 1.2, strength: 0.3 } });
}
// #endregion bathroom

// #region scales
/** Mermaid scales, darkening down the page. */
export function scales() {
  const layout = createLayout({ region, tiling: fishScale({ size: 26 }), gap: 1.5 });
  return renderToString(layout, { fill: gradientFill(["#b8f2e6", "#5e9ea0", "#264653"], { angle: 90 }), background: "#fbf8f3", relief: { strength: 0.25 } });
}
// #endregion scales

// #region floor
/** Octagons and squares: a classic floor. */
export function floor() {
  const layout = createLayout({ region, tiling: octagonSquare({ size: 24 }), rotation: 45, gap: 1.5, cornerRadius: 1 });
  return renderToString(layout, { fill: protoTileFill(["#f1e3c8", "#7f2b1d"]), background: "#c9b79c", relief: { strength: 0.25, shadow: 1 } });
}
// #endregion floor
