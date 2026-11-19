import { createLayout, grid, hexagonal, weightedLayout } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { photos } from "./shared";

// #region features
/** Featured tiles: a flower of 7 hexagons in the middle, and 3 more near the top left. */
export function features() {
  const layout = createLayout({
    region: { x: 0, y: 0, width: 260, height: 170 },
    tiling: hexagonal({ size: 22 }),
    gap: 2.5,
    cornerRadius: 3,
    features: [{ tiles: 7 }, { tiles: 3, at: { x: 50, y: 40 } }],
  });
  return renderToString(layout, { images: photos(60), background: "#e9e3d8" });
}
// #endregion features

// #region weights
/** Important items: every fifth photo spans 4 tiles, placed where it falls in the order. */
export function weights() {
  const items = photos(32);
  const weights = items.map((_, i) => (i % 5 === 0 ? 4 : 1));
  const { layout } = weightedLayout(
    { region: { x: 0, y: 0, width: 260, height: 170 }, tiling: grid({ width: 40, height: 30 }), gap: 3, cornerRadius: 3 },
    weights,
    { fit: true },
  );
  return renderToString(layout, { images: items, background: "#e9e3d8" });
}
// #endregion weights

/** A hero: one item that spans 9 tiles, with the rest round it. */
export function hero() {
  const items = photos(30);
  const { layout } = weightedLayout(
    { region: { x: 0, y: 0, width: 260, height: 170 }, tiling: grid({ width: 40, height: 34 }), gap: 3, cornerRadius: 3 },
    items.map((_, i) => (i === 0 ? 9 : 1)),
    { fit: true },
  );
  return renderToString(layout, { images: items, background: "#e9e3d8" });
}
