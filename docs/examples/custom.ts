import { createLayout, periodic, tiles } from "@andamento/core";
import { renderToString } from "@andamento/svg";

/** A repeating tiling of your own: two L-trominoes filling a 3 × 2 block, copied along a and b. */
export function trominoes() {
  const tiling = periodic({
    a: { x: 60, y: 0 },
    b: { x: 20, y: 40 },
    motif: [
      { polygon: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 40 }, { x: 0, y: 40 }] },
      { polygon: [{ x: 40, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 40 }, { x: 20, y: 40 }, { x: 20, y: 20 }, { x: 40, y: 20 }] },
    ],
  });
  const layout = createLayout({ region: { x: 0, y: 0, width: 240, height: 150 }, tiling, gap: 2, cornerRadius: 2 });
  return renderToString(layout, { fill: ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"], background: "#264653" });
}

/** Your own polygons, used as given: here a fan of wedges. */
export function fan() {
  const wedges = Array.from({ length: 9 }, (_, i) => {
    const a0 = Math.PI + (i / 9) * Math.PI, a1 = Math.PI + ((i + 1) / 9) * Math.PI;
    const at = (a: number, r: number) => ({ x: 120 + r * Math.cos(a), y: 140 + r * Math.sin(a) });
    return [
      { polygon: [at(a0, 30), at(a0, 75), at(a1, 75), at(a1, 30)], id: `in${i}` },
      { polygon: [at(a0, 75), at(a0, 130), at(a1, 130), at(a1, 75)], id: `out${i}`, protoTile: 1 },
    ];
  }).flat();
  const layout = createLayout({ region: { x: 0, y: 0, width: 240, height: 145 }, tiling: tiles({ tiles: wedges }), gap: 2.5, cornerRadius: 3 });
  return renderToString(layout, { fill: ["#e76f51", "#f4a261", "#e9c46a"], background: "#fbf8f3" });
}
