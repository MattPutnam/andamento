import { createLayout, hexagonal } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { photos } from "./shared";

/** A photo wall of hexagons, with a featured flower of seven in the middle and raised tiles. */
export default function hero() {
  const layout = createLayout({
    region: { x: 0, y: 0, width: 300, height: 200 },
    tiling: hexagonal({ size: 26 }),
    gap: 3,
    margin: 4,
    cornerRadius: 4,
    features: [{ tiles: 7 }],
  });
  return renderToString(layout, {
    images: photos(40),
    background: "#e9e3d8",
    relief: { shadow: 1.5 },
  });
}
