import { describe, expect, it } from "vitest";
import { cellShape, coverRect, createLayout, estimateFocus, grid, objectPosition, safeArea, type Pixels } from "@andamento/core";

// One tall tile (50 x 200) and a landscape photo: most of the photo's width is cropped.
const tall = createLayout({ region: { x: 0, y: 0, width: 100, height: 200 }, tiling: grid({ width: 50, height: 200 }) });
const cell = tall.cells[0]!;

describe("coverRect", () => {
  it("covers the cell's box, centred without a focus", () => {
    const r = coverRect(cell, tall, { aspect: 2 });
    expect(r).toEqual({ x: -175, y: 0, width: 400, height: 200 });
    expect(objectPosition(cell, tall, { aspect: 2 })).toBe("50% 50%");
  });

  it("brings the focus to the middle of the tile", () => {
    const r = coverRect(cell, tall, { aspect: 2, focus: { x: 0.3, y: 0.5 } });
    // 30% across the 400-wide image lands on the tile's middle, x = 25.
    expect(r.x + 0.3 * r.width).toBeCloseTo(25);
    expect(objectPosition(cell, tall, { aspect: 2, focus: { x: 0.3, y: 0.5 } })).toBe("27.143% 50%");
  });

  it("keeps the cell covered when the focus is near the image's edge", () => {
    const r = coverRect(cell, tall, { aspect: 2, focus: { x: 0, y: 0 } });
    expect(r.x).toBe(0);
    expect(objectPosition(cell, tall, { aspect: 2, focus: { x: 1, y: 1 } })).toBe("100% 50%");
  });

  it("aims at what shows of a cut tile", () => {
    // Window mode: the second column is half outside the region.
    const l = createLayout({ region: { x: 0, y: 0, width: 150, height: 100 }, tiling: grid({ width: 100 }), edges: "window" });
    const cut = l.cells.find((c) => c.boundary)!;
    expect(cellShape(cut).bbox.width).toBe(100);
    // A square photo exactly covers the square tile, so it can't move.
    const square = coverRect(cut, l, { aspect: 1, focus: { x: 0.5, y: 0.5 } });
    expect(square.x + 0.5 * square.width).toBeCloseTo(150);
    // A wide one can: its focus lands in the middle of the visible half (x = 125), not the tile's (150).
    const wide = coverRect(cut, l, { aspect: 3, focus: { x: 0.5, y: 0.5 } });
    expect(wide.x + 0.5 * wide.width).toBeCloseTo(125);
    const whole = coverRect(cut, l, { aspect: 3, focus: { x: 0.5, y: 0.5 }, within: "tile" });
    expect(whole.x + 0.5 * whole.width).toBeCloseTo(150);
    const s = safeArea(cut, l, { within: "visible" });
    expect(s.x + s.width / 2).toBeCloseTo(125);
  });
});

/** An image `w` x `h`: a sky gradient, a darker hill along the bottom, and a pale disc. */
function picture(w: number, h: number, disc: { x: number; y: number; r: number }): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      let c = [120 + (y / h) * 100, 160 + (y / h) * 80, 230, 255];
      if (y > h * (0.75 + 0.05 * Math.sin(x / 10))) c = [60, 110, 50, 255];
      if (Math.hypot(x - disc.x * w, y - disc.y * h) < disc.r * h) c = [255, 230, 120, 255];
      data.set(c, k);
    }
  }
  return { width: w, height: h, data };
}

describe("estimateFocus", () => {
  it("finds a subject that stands out from its surroundings", () => {
    for (const disc of [{ x: 0.75, y: 0.3, r: 0.1 }, { x: 0.2, y: 0.4, r: 0.08 }, { x: 0.5, y: 0.2, r: 0.12 }]) {
      const f = estimateFocus(picture(200, 150, disc));
      expect(Math.abs(f.x - disc.x)).toBeLessThan(0.06);
      expect(Math.abs(f.y - disc.y)).toBeLessThan(0.08);
    }
  });

  it("falls back to the middle for a plain image", () => {
    const data = new Uint8ClampedArray(40 * 30 * 4).fill(200);
    expect(estimateFocus({ width: 40, height: 30, data })).toEqual({ x: 0.5, y: 0.5, aspect: 40 / 30 });
  });
});
