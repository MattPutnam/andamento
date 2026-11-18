// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createLayout, grid } from "@andamento/core";
import { cellFromPointer } from "@andamento/react";

const layout = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }), gap: 10 });

describe("cellFromPointer", () => {
  const el = document.createElement("div");
  // Shown at twice the size, offset on the page.
  el.getBoundingClientRect = () => ({ left: 100, top: 50, width: 600, height: 400, x: 100, y: 50, right: 700, bottom: 450, toJSON: () => ({}) });

  it("finds the cell under the pointer on the element showing the layout", () => {
    expect(cellFromPointer(layout, { clientX: 200, clientY: 150, currentTarget: el })).toBe(layout.cells[0]);
    expect(cellFromPointer(layout, { clientX: 650, clientY: 400, currentTarget: el })).toBe(layout.cells[5]);
  });

  it("sees the gaps, and snaps to the nearest tile with a tolerance", () => {
    // Layout x = 100: the middle of the gap between the first two tiles.
    const gap = { clientX: 300, clientY: 150, currentTarget: el };
    expect(cellFromPointer(layout, gap)).toBeUndefined();
    expect(cellFromPointer(layout, { ...gap, clientX: 296 }, { tolerance: 4 })).toBe(layout.cells[0]);
  });

  it("can measure another element, and copes with none", () => {
    expect(cellFromPointer(layout, { clientX: 200, clientY: 150, currentTarget: null }, { element: el })).toBe(layout.cells[0]);
    expect(cellFromPointer(layout, { clientX: 200, clientY: 150, currentTarget: null })).toBeUndefined();
  });
});
