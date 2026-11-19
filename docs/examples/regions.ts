import { createLayout, herringbone, hexagonal, runningBond, voronoi } from "@andamento/core";
import { renderToString } from "@andamento/svg";

/** A wall with a door and a window: an L-shaped region with two holes. */
export function wall() {
  const layout = createLayout({
    region: [
      { x: 0, y: 0 }, { x: 180, y: 0 }, { x: 180, y: 60 }, { x: 260, y: 60 },
      { x: 260, y: 160 }, { x: 0, y: 160 },
    ],
    holes: [
      { x: 30, y: 70, width: 40, height: 90 }, // door, open at the bottom edge
      { x: 110, y: 30, width: 50, height: 40 }, // window
    ],
    tiling: runningBond({ width: 26, height: 12 }),
    gap: 1.5,
    margin: 3,
  });
  return renderToString(layout, { fill: ["#c8673c", "#b4532a", "#d97f52", "#a84a24"], background: "#efe7dc" });
}

/** An arch: the curve is approximated with short straight segments. */
export function arch() {
  const top = Array.from({ length: 33 }, (_, i) => {
    const a = Math.PI - (i / 32) * Math.PI;
    return { x: 100 + 80 * Math.cos(a), y: 90 - 80 * Math.sin(a) };
  });
  const layout = createLayout({
    region: [{ x: 20, y: 200 }, ...top, { x: 180, y: 200 }],
    tiling: herringbone({ length: 36, width: 12 }),
    gap: 1.2,
    margin: 3,
  });
  return renderToString(layout, { fill: ["#e9c46a", "#f4a261", "#e8b25e"], background: "#5b4636" });
}

/** A round region, cut from irregular stones. */
export function round() {
  const circle = Array.from({ length: 64 }, (_, i) => ({ x: 100 + 90 * Math.cos((i / 64) * 2 * Math.PI), y: 100 + 90 * Math.sin((i / 64) * 2 * Math.PI) }));
  const layout = createLayout({ region: circle, tiling: voronoi({ size: 26, seed: 4 }), gap: 2.5, cornerRadius: 3 });
  return renderToString(layout, { fill: ["#8ab17d", "#a7c59a", "#6d9a63", "#bcd3a8"], background: "#3d4a3a" });
}

/** A hole inside a single tile becomes a hole in that cell. */
export function holed() {
  const layout = createLayout({
    region: { x: 0, y: 0, width: 200, height: 120 },
    holes: [{ x: 92, y: 52, width: 16, height: 16 }],
    tiling: hexagonal({ size: 42 }),
    gap: 3,
  });
  return renderToString(layout, { fill: ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"], background: "#264653" });
}
