import { describe, expect, it } from "vitest";
import { contentSlots, createLayout, grid, hexagonal, voronoi } from "@andamento/core";

// 10 x 10 grid of 10-unit cells.
const square = createLayout({ region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 10 }) });
const filled = (slots: number[]) => slots.map((s, i) => (s >= 0 ? i : -1)).filter((i) => i >= 0);

describe("contentSlots", () => {
  it("fills the first cells in reading order by default", () => {
    const slots = contentSlots(square, 3);
    expect(filled(slots)).toEqual([0, 1, 2]);
    expect(slots.slice(0, 4)).toEqual([0, 1, 2, -1]);
  });

  it("clamps the count and numbers every cell for Infinity", () => {
    expect(contentSlots(square, 500).filter((s) => s >= 0)).toHaveLength(100);
    expect(contentSlots(square, Infinity)[99]).toBe(99);
    expect(contentSlots(square, 0).every((s) => s === -1)).toBe(true);
    expect(contentSlots(square, -2).every((s) => s === -1)).toBe(true);
  });

  it("skips cut tiles with cells: whole", () => {
    // 105 wide: the last column is cut to 5 units.
    const layout = createLayout({ region: { x: 0, y: 0, width: 105, height: 100 }, tiling: grid({ width: 10 }) });
    const slots = contentSlots(layout, Infinity, { cells: "whole" });
    layout.cells.forEach((c) => expect(slots[c.index]! >= 0).toBe(!c.boundary));
    expect(slots.filter((s) => s >= 0)).toHaveLength(100);
    // The 11th whole tile is the first of the second row, not the cut tile ending row 1.
    const eleventh = layout.cells[slots.indexOf(10)]!;
    expect(eleventh.bbox.x).toBeCloseTo(0);
    expect(contentSlots(layout, Infinity, { cells: (c) => c.protoTile === 99 }).every((s) => s === -1)).toBe(true);
  });

  it("places items around the middle with placement: center", () => {
    const slots = contentSlots(square, 4, { placement: "center" });
    const chosen = filled(slots).map((i) => square.cells[i]!.centroid);
    expect(chosen.map((p) => [p.x, p.y])).toEqual([[45, 45], [55, 45], [45, 55], [55, 55]]);
    // Still in reading order across the chosen cells.
    expect(filled(slots).map((i) => slots[i])).toEqual([0, 1, 2, 3]);
  });

  it("spreads items evenly with placement: spread", () => {
    const slots = contentSlots(square, 4, { placement: "spread" });
    const chosen = filled(slots).map((i) => square.cells[i]!.centroid);
    // One per quadrant, near the quadrant centres (25, 25) etc.
    for (const q of [[25, 25], [75, 25], [25, 75], [75, 75]]) {
      expect(chosen.some((p) => Math.hypot(p.x - q[0]!, p.y - q[1]!) <= 8)).toBe(true);
    }
    expect(filled(slots).map((i) => slots[i])).toEqual([0, 1, 2, 3]);
  });

  it("spread picks distinct cells and is deterministic", () => {
    const layout = createLayout({ region: { x: 0, y: 0, width: 400, height: 300 }, tiling: voronoi({ size: 20, seed: 3 }) });
    for (const n of [1, 7, 50, layout.cells.length - 1]) {
      const a = contentSlots(layout, n, { placement: "spread" });
      expect(a.filter((s) => s >= 0).sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(contentSlots(layout, n, { placement: "spread" })).toEqual(a);
    }
  });

  it("spread stays fast on large layouts", () => {
    const layout = createLayout({ region: { x: 0, y: 0, width: 2000, height: 1500 }, tiling: hexagonal({ size: 10 }), maxTiles: 50000 });
    const t = performance.now();
    contentSlots(layout, Math.floor(layout.cells.length / 2), { placement: "spread" });
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe("backdropCss", () => {
  it("places a layout-sized box so every cell shows its own piece", async () => {
    const { backdropCss } = await import("@andamento/core");
    const l = createLayout({ region: { x: 0, y: 0, width: 400, height: 200 }, tiling: grid({ width: 100 }) });
    expect(backdropCss(l.cells[0]!, l)).toEqual({ left: "0%", top: "0%", width: "400%", height: "200%" });
    // Cell (2, 1): its box starts 200 right and 100 down, i.e. 2 and 1 cell-sizes.
    expect(backdropCss(l.cells.find((c) => c.bbox.x === 200 && c.bbox.y === 100)!, l)).toEqual({ left: "-200%", top: "-100%", width: "400%", height: "200%" });
  });
});
