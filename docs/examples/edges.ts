import { createLayout, hexagonal, type EdgeMode } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { outlined, photos } from "./shared";

/** The four edge modes, on hexagons in a rectangle (dashed line: the region). */
export function modes() {
  const out: Record<string, string> = {};
  for (const edges of ["clip", "inside", "overflow", "window"] as EdgeMode[]) {
    const layout = createLayout({
      region: { x: 0, y: 0, width: 200, height: 120 },
      tiling: hexagonal({ size: 30 }),
      gap: 3,
      cornerRadius: 6,
      edges,
    });
    out[edges] = outlined(renderToString(layout, { images: photos(30), background: "#f1ece4" }), layout);
  }
  return out;
}
