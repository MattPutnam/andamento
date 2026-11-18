import { describe, expect, it } from "vitest";
import { area, cellCss, createLayout, grid, hexagonal, resamplePolygon, signedArea, vec } from "@andamento/core";

const box = { x: 0, y: 0, width: 10, height: 10 };

describe("resamplePolygon", () => {
  it("adds points along the edges, keeping every corner and the shape", () => {
    const square = [vec(10, 0), vec(10, 10), vec(0, 10), vec(0, 0)];
    const r = resamplePolygon(square, 12, box);
    expect(r).toHaveLength(12);
    for (const v of square) expect(r).toContainEqual(v);
    expect(area(r)).toBeCloseTo(100, 9);
    // Starts at the top-left corner; equal sides get equal shares of the extra points.
    expect(r[0]).toEqual(vec(0, 0));
    const corners = square.map((v) => r.findIndex((p) => p.x === v.x && p.y === v.y)).sort((a, b) => a - b);
    expect(corners).toEqual([0, 3, 6, 9]);
  });

  it("runs every shape the same way round", () => {
    const cw = [vec(0, 0), vec(10, 0), vec(10, 10), vec(0, 10)];
    const ccw = [...cw].reverse();
    expect(Math.sign(signedArea(resamplePolygon(cw, 20, box)))).toBe(Math.sign(signedArea(resamplePolygon(ccw, 20, box))));
    expect(resamplePolygon(ccw, 20, box)[0]).toEqual(vec(0, 0));
  });

  it("leaves polygons with too many points alone", () => {
    const tri = [vec(0, 0), vec(10, 0), vec(0, 10)];
    expect(resamplePolygon(tri, 2, box)).toBe(tri);
  });
});

describe("cellCss points", () => {
  it("gives every clip path the same number of points, across tilings", () => {
    const region = { x: 0, y: 0, width: 300, height: 200 };
    const count = (clip: string) => clip.replace(/^polygon\(|\)$/g, "").split(",").length;
    for (const tiling of [grid({ width: 50 }), hexagonal({ size: 30 })]) {
      const l = createLayout({ region, tiling, cornerRadius: 4 });
      for (const c of l.cells) expect(count(cellCss(c, l, 4, { points: 72 }).clipPath)).toBe(72);
    }
    const l = createLayout({ region, tiling: grid({ width: 50 }) });
    expect(count(cellCss(l.cells[0]!, l).clipPath)).toBe(4);
  });
});
