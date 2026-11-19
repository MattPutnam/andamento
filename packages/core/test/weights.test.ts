import { describe, expect, it } from "vitest";
import { contentSlots, createLayout, grid, hexagonal, matchSlots, tileSpans, weightedFeatures, weightedLayout, type LayoutOptions } from "@andamento/core";

// 6 x 4 grid of 50-unit squares.
const options: LayoutOptions = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 50 }) };

/** Which item each cell holds, by cell, as rows of the grid. */
const rows = (slots: number[], width = 6) => Array.from({ length: slots.length / width }, (_, r) => slots.slice(r * width, (r + 1) * width));

describe("weighted items", () => {
  it("rounds weights to whole tiles, at least 1", () => {
    expect(tileSpans([1, 2.4, 2.6, 0, -3, NaN])).toEqual([1, 2, 3, 1, 1, 1]);
  });

  it("gives heavier items featured tiles where they fall in reading order", () => {
    // Item 1 spans 4 tiles: 1 + 4 + 1 + … in reading order.
    const weights = [1, 4, 1, 1, 1];
    const { layout, features } = weightedLayout(options, weights);
    expect(features).toEqual([expect.objectContaining({ tiles: 4, item: 1 })]);
    const f = layout.cells.find((c) => c.featured !== undefined)!;
    expect(f.featuredItem).toBe(1);
    expect(f.merged).toHaveLength(4);
    const slots = contentSlots(layout, weights.length);
    expect(slots[f.index]).toBe(1);
    // Tiles 1–4 of the top row are where item 1 would go: its 2 x 2 block is centerd under them.
    expect(f.centroid).toEqual({ x: 150, y: 50 });
    // The others fill the remaining tiles in order.
    const order = layout.cells.filter((c) => slots[c.index]! >= 0 && c !== f).map((c) => slots[c.index]);
    expect(order).toEqual([0, 2, 3, 4]);
  });

  it("puts each feature near its place in the order", () => {
    // Twenty items; item 18 is heavy. Its 4 tiles would be the first four of the bottom row,
    // so its feature sits at the bottom left, not in the middle.
    const weights = Array.from({ length: 20 }, (_, i) => (i === 18 ? 4 : 1));
    const { layout } = weightedLayout(options, weights);
    const f = layout.cells.find((c) => c.featuredItem === 18)!;
    expect(f.centroid.y).toBe(150);
    expect(f.centroid.x).toBeLessThan(150);
  });

  it("sizes the tiles to fit every item's share with fit", () => {
    const weights = [3, 1, 1, 1, 1, 1, 1, 7, 1, 1];
    const { layout, options: used } = weightedLayout(options, weights, { fit: true });
    expect(used.tileScale).toBeGreaterThan(1); // 17 tiles: bigger than the 24 we started with
    const slots = contentSlots(layout, weights.length);
    expect(slots.filter((s) => s >= 0)).toHaveLength(10);
    // Biggest first: the 7-tile feature is features[0].
    const big = layout.cells.find((c) => c.featuredItem === 7)!;
    const small = layout.cells.find((c) => c.featuredItem === 0)!;
    expect(big.featured).toBe(0);
    expect(big.area).toBeGreaterThan(small.area * 2);
  });

  it("works with matchSlots, other tilings and features of your own", () => {
    const hex: LayoutOptions = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: hexagonal({ size: 20 }), features: [{ tiles: 3, at: { x: 40, y: 40 } }] };
    const weights = [1, 1, 3, 1, 1];
    const { layout, features } = weightedLayout(hex, weights);
    expect(features).toHaveLength(1);
    const mine = layout.cells.find((c) => c.featured === 0)!;
    const theirs = layout.cells.find((c) => c.featuredItem === 2)!;
    expect(mine.featuredItem).toBeUndefined();
    const slots = matchSlots(layout, [1, 2, 1, 0.5, 1]);
    expect(slots[theirs.index]).toBe(2);
    // Your own feature takes the first item not named by another.
    expect(slots[mine.index]).toBe(0);
    expect(new Set(slots.filter((s) => s >= 0))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it("changes nothing without heavy items", () => {
    expect(weightedFeatures(createLayout(options), [1, 1, 1])).toEqual([]);
    const { layout, options: used } = weightedLayout(options, [1, 1]);
    expect(used.features).toBeUndefined();
    expect(layout.cells).toHaveLength(24);
  });

  it("keeps crowded features compact rather than strips", () => {
    // 240 x 150 with a margin: a 6 x 4 grid whose bottom row is mostly cut off, and items
    // 0, 5 and 10 spanning 4 tiles each. The third has no free 2 x 2 left above the cut row.
    const crowded: LayoutOptions = { region: { x: 0, y: 0, width: 240, height: 150 }, tiling: grid({ width: 40 }), gap: 2, margin: 4 };
    const weights = Array.from({ length: 15 }, (_, i) => (i % 5 === 0 ? 4 : 1));
    const { layout } = weightedLayout(crowded, weights);
    const spans = (c: (typeof layout.cells)[number]) => {
      const at = c.merged!.map((id) => id.split(":")[0]!.split(",").map(Number) as [number, number]);
      const xs = new Set(at.map((p) => p[0])), ys = new Set(at.map((p) => p[1]));
      return [xs.size, ys.size];
    };
    const featured = layout.cells.filter((c) => c.featured !== undefined);
    expect(featured).toHaveLength(3);
    for (const f of featured) expect(Math.min(...spans(f))).toBe(2);
  });

  it("counts tiles the margin barely trims as whole", () => {
    // Every tile on the edge of a 5 x 3 grid of 50s loses a little to the margin; the first
    // feature is still a 2 x 2 block, not a T around the three untouched tiles.
    const trimmed: LayoutOptions = { region: { x: 0, y: 0, width: 240, height: 150 }, tiling: grid({ width: 50 }), gap: 2, margin: 4 };
    const l = createLayout({ ...trimmed, features: [{ tiles: 4, at: { x: 100, y: 25 } }] });
    const f = l.cells.find((c) => c.featured !== undefined)!;
    expect([...f.merged!].sort()).toEqual(["1,0:0", "1,1:0", "2,0:0", "2,1:0"]);
  });
});
