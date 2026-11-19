import { createLayout, grid, herringbone, hexagonal } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { photoAspects, photoFocus, photos } from "./shared";

const images = photos(30);
const aspects = photoAspects(30); // width / height of each photo: every third is portrait

// #region matching
/** Matching photos to tile shapes: portraits in the upright boards, landscapes in the flat ones. */
export function matching() {
  const layout = createLayout({ region: { x: 0, y: 0, width: 220, height: 140 }, tiling: herringbone({ length: 56, width: 28 }), gap: 2.5 });
  return {
    "in-order": renderToString(layout, { images, background: "#e9e3d8" }),
    matched: renderToString(layout, { images, imageAspects: aspects, background: "#e9e3d8" }),
  };
}
// #endregion matching

// #region contain
/** Safe areas: each photo whole and uncropped, as big as its hexagon allows. */
export function contain() {
  const layout = createLayout({ region: { x: 0, y: 0, width: 220, height: 140 }, tiling: hexagonal({ size: 30 }), gap: 3, cornerRadius: 5 });
  return renderToString(layout, { images, imageAspects: aspects, imageFit: "contain", fill: ["#2f3e46", "#354f52", "#52796f"], background: "#1e2b30" });
}
// #endregion contain

// #region focus
/** Focal points: the sun in each photo stays in view, even in a tall, thin tile. */
export function focus() {
  const layout = createLayout({ region: { x: 0, y: 0, width: 220, height: 140 }, tiling: grid({ width: 27.5, height: 140 }), gap: 3 });
  return {
    centerd: renderToString(layout, { images, imageAspects: aspects, background: "#e9e3d8" }),
    focused: renderToString(layout, { images, imageAspects: aspects, imageFocus: photoFocus(30), background: "#e9e3d8" }),
  };
}
// #endregion focus
