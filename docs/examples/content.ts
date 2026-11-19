import { createLayout, hexagonal, type ContentPlacement } from "@andamento/core";
import { neutralPalette, renderToString } from "@andamento/svg";
import { photos } from "./shared";

const layout = createLayout({ region: { x: 0, y: 0, width: 200, height: 130 }, tiling: hexagonal({ size: 22 }), gap: 2.5, cornerRadius: 3 });

/** Seven photos and more tiles than that: where `placement` puts them. */
export function placement() {
  const out: Record<string, string> = {};
  for (const p of ["reading", "center", "spread"] as ContentPlacement[]) {
    out[p] = renderToString(layout, { images: photos(7), placement: p, fill: neutralPalette, background: "#fbf8f3" });
  }
  return out;
}

/** `contentCells: "whole"`: content only in tiles the region's edge doesn't cut. */
export function cells() {
  return {
    all: renderToString(layout, { images: photos(40), fill: neutralPalette, background: "#fbf8f3" }),
    whole: renderToString(layout, { images: photos(40), contentCells: "whole", fill: neutralPalette, background: "#fbf8f3" }),
  };
}
