import { createLayout, hexagonal, runningBond, type LayoutOptions } from "@andamento/core";
import { renderToString } from "@andamento/svg";

const fill = ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"];
const draw = (options: Partial<LayoutOptions>) =>
  renderToString(
    createLayout({ region: { x: 0, y: 0, width: 160, height: 110 }, tiling: hexagonal({ size: 20 }), ...options }),
    { fill, background: "#264653" },
  );

/** `gap`: the grout between tiles. */
export const gaps = () => ({ "gap-0": draw({ gap: 0 }), "gap-2": draw({ gap: 2 }), "gap-6": draw({ gap: 6 }) });

/** `margin`: a border kept clear along the region's edge. */
export const margins = () => ({ "margin-0": draw({ gap: 2, margin: 0 }), "margin-10": draw({ gap: 2, margin: 10 }) });

/** `cornerRadius`: rounded tiles (it shrinks to fit small corners). */
export const corners = () => ({
  "radius-0": draw({ gap: 3, cornerRadius: 0 }),
  "radius-4": draw({ gap: 3, cornerRadius: 4 }),
  "radius-12": draw({ gap: 3, cornerRadius: 12 }),
});

/** `rotation` (degrees) and `tileScale`. */
export const transforms = () => {
  const bricks = (o: Partial<LayoutOptions>) => draw({ tiling: runningBond({ width: 40, height: 18 }), gap: 2, ...o });
  return { "rotation-0": bricks({}), "rotation-30": bricks({ rotation: 30 }), "scale-half": bricks({ tileScale: 0.5 }) };
};

/** `minFill`: drop slivers at the edge smaller than this share of a tile. */
export const slivers = () => ({ "minfill-0": draw({ gap: 2, minFill: 0 }), "minfill-60": draw({ gap: 2, minFill: 0.6 }) });
