import { describe, expect, it } from "vitest";
import {
  createLayout,
  fitCount,
  gradientFill,
  grid,
  herringbone,
  hexagonal,
  hat,
  imageFill,
  loadImagePixels,
  paletteFill,
  protoTileFill,
  randomFill,
  voronoi,
} from "@andamento/core";

const square = createLayout({ region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 10 }) });
const cell = (x: number, y: number) => square.cells.find((c) => c.bbox.x === x * 10 && c.bbox.y === y * 10)!;

describe("fill helpers", () => {
  it("paletteFill colors neighbors differently", () => {
    const f = paletteFill(["#a00", "#0a0", "#00a"]);
    for (const c of square.cells) {
      for (const id of c.neighbors) expect(f(c, square)).not.toBe(f(square.cells.find((d) => d.id === id)!, square));
    }
  });

  it("protoTileFill colors by prototile", () => {
    const layout = createLayout({ region: { x: 0, y: 0, width: 200, height: 200 }, tiling: herringbone({ length: 40, width: 20 }) });
    const f = protoTileFill(["h", "v"]);
    for (const c of layout.cells) expect(f(c, layout)).toBe(c.protoTile === 0 ? "h" : "v");
  });

  it("randomFill depends only on the cell id and seed", () => {
    const f = randomFill(["a", "b", "c", "d"], 7);
    const bigger = createLayout({ region: { x: 0, y: 0, width: 200, height: 150 }, tiling: grid({ width: 10 }) });
    for (const c of square.cells) expect(f(c, square)).toBe(f(bigger.cells.find((d) => d.id === c.id)!, bigger));
    const used = new Set(square.cells.map((c) => f(c, square)));
    expect(used.size).toBe(4);
    const g = randomFill(["a", "b", "c", "d"], 8);
    expect(square.cells.some((c) => f(c, square) !== g(c, square))).toBe(true);
  });

  it("gradientFill runs between the stops along the angle", () => {
    const lr = gradientFill(["#000000", "#ffffff"]);
    const left = lr(cell(0, 5), square);
    const right = lr(cell(9, 5), square);
    expect(parseInt(left.slice(1, 3), 16)).toBeLessThan(40);
    expect(parseInt(right.slice(1, 3), 16)).toBeGreaterThan(215);
    // Same column, same color.
    expect(lr(cell(3, 0), square)).toBe(lr(cell(3, 9), square));
    const down = gradientFill(["#000", "#fff"], { angle: 90 });
    expect(down(cell(0, 3), square)).toBe(down(cell(9, 3), square));
    expect(down(cell(0, 0), square)).not.toBe(down(cell(0, 9), square));
    // Exact stop colors survive the OKLab round trip.
    expect(gradientFill(["#e9d8a6"])(cell(0, 0), square)).toBe("#e9d8a6");
    const radial = gradientFill(["#ff0000", "#0000ff"], { shape: "radial" });
    expect(radial(cell(4, 4), square)).toBe(radial(cell(5, 5), square));
    expect(radial(cell(0, 0), square)).not.toBe(radial(cell(4, 4), square));
    expect(() => gradientFill(["red"])).toThrow(/hex/);
  });
});

describe("tileScale", () => {
  it("scales the pattern about its origin and keeps ids", () => {
    const base = { region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 10 }) };
    const twice = createLayout({ ...base, tileScale: 2 });
    expect(twice.cells).toHaveLength(25);
    expect(twice.cells[0]!.bbox.width).toBeCloseTo(20);
    const same = createLayout({ ...base, tiling: grid({ width: 20 }) });
    expect(twice.cells.map((c) => c.id)).toEqual(same.cells.map((c) => c.id));
    expect(twice.cells.map((c) => c.polygon)).toEqual(same.cells.map((c) => c.polygon));
    expect(() => createLayout({ ...base, tileScale: 0 })).toThrow(/tileScale/);
  });
});

describe("fitCount", () => {
  const region = { x: 0, y: 0, width: 300, height: 200 };

  it("finds the largest tiles giving at least n cells", () => {
    const { layout, count, tileScale, options } = fitCount({ region, tiling: grid({ width: 10 }) }, 6);
    expect(count).toBe(6);
    expect(layout.cells).toHaveLength(6);
    expect(tileScale).toBeGreaterThan(9); // 100-unit squares
    expect(createLayout(options).cells).toHaveLength(6);
  });

  it("works for many patterns, from either side", () => {
    for (const tiling of [hexagonal({ size: 10 }), herringbone({ length: 60, width: 30 }), voronoi({ size: 20, seed: 2 }), hat({ size: 20 })]) {
      for (const n of [5, 40]) {
        const r = fitCount({ region, tiling }, n);
        expect(r.count).toBeGreaterThanOrEqual(n);
        // Not wildly more: within a factor that allows for whole edge rows appearing at once.
        expect(r.count).toBeLessThan(n * 2 + 12);
        // Slightly bigger tiles give fewer than n.
        expect(createLayout({ ...r.options, tileScale: r.tileScale * 1.01 }).cells.length).toBeLessThan(n);
      }
    }
  });

  it("counts only whole tiles with cells: whole", () => {
    const r = fitCount({ region, tiling: hexagonal({ size: 10 }) }, 12, { cells: "whole" });
    expect(r.layout.cells.filter((c) => !c.boundary).length).toBe(r.count);
    expect(r.count).toBeGreaterThanOrEqual(12);
  });

  it("mode nearest may land below n", () => {
    const atLeast = fitCount({ region, tiling: grid({ width: 10 }) }, 7);
    const nearest = fitCount({ region, tiling: grid({ width: 10 }) }, 7, { mode: "nearest" });
    expect(Math.abs(nearest.count - 7)).toBeLessThanOrEqual(Math.abs(atLeast.count - 7));
  });

  it("handles counts near maxTiles and rejects bad counts", () => {
    const r = fitCount({ region, tiling: grid({ width: 50 }), maxTiles: 3000 }, 2000);
    expect(r.count).toBeGreaterThanOrEqual(2000);
    expect(() => fitCount({ region, tiling: grid({ width: 50 }) }, 0)).toThrow(RangeError);
  });
});

describe("imageFill", () => {
  // A 4 × 2 image: columns green, red, blue, yellow.
  const cols = [[0, 255, 0], [255, 0, 0], [0, 0, 255], [255, 255, 0]];
  const pixels = {
    width: 4,
    height: 2,
    data: Uint8ClampedArray.from({ length: 4 * 2 * 4 }, (_, i) => {
      const px = (i >> 2) % 4;
      return i % 4 === 3 ? 255 : cols[px]![i % 4]!;
    }),
  };
  const square = createLayout({ region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 50 }) });
  const colorsOf = (f: ReturnType<typeof imageFill>, l = square) => l.cells.map((c) => f(c, l));

  it("covers the layout by default, cropping the image's sides", () => {
    // The square shows the middle two columns: red on the left, blue on the right.
    expect(colorsOf(imageFill(pixels))).toEqual(["#ff0000", "#0000ff", "#ff0000", "#0000ff"]);
  });

  it("averages in linear light, and can stretch", () => {
    // Stretched, each tile covers two columns. Green + red mixed in linear light: 0.5 → #bc.
    expect(colorsOf(imageFill(pixels, { fit: "stretch" }))).toEqual(["#bcbc00", "#bcbcbc", "#bcbc00", "#bcbcbc"]);
  });

  it("uses the fallback where the image doesn't reach", () => {
    // Contained, the 4:2 image spans the square's width and its middle half vertically.
    const tall = createLayout({ region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 100, height: 20 }) });
    const c = colorsOf(imageFill(pixels, { fit: "contain", fallback: "#123456" }), tall);
    expect(c[0]).toBe("#123456");
    expect(c[4]).toBe("#123456");
    expect(c[2]).not.toBe("#123456");
  });

  it("weights by alpha and skips transparent pixels", () => {
    const half = { width: 2, height: 1, data: Uint8ClampedArray.from([255, 0, 0, 255, 0, 0, 255, 0]) };
    const one = createLayout({ region: { x: 0, y: 0, width: 100, height: 50 }, tiling: grid({ width: 100, height: 50 }) });
    expect(colorsOf(imageFill(half), one)).toEqual(["#ff0000"]);
  });

  it("snaps to a palette", () => {
    const f = imageFill(pixels, { palette: ["#ee1111", "#1111ee", "#ffffff"] });
    expect(colorsOf(f)).toEqual(["#ee1111", "#1111ee", "#ee1111", "#1111ee"]);
    expect(() => imageFill(pixels, { palette: ["red"] })).toThrow(/imageFill needs hex/);
  });

  it("follows the cell shape, holes included, and caches per layout", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 100, height: 100 }, tiling: grid({ width: 100 }), holes: [{ x: 50, y: 0, width: 50, height: 100 }] });
    // Only the left half is tiled: it's all red under "cover".
    const f = imageFill(pixels, { samples: 64 });
    expect(colorsOf(f, l)).toEqual(["#ff0000"]);
    expect(f(l.cells[0]!, l)).toBe("#ff0000");
  });

  it("is fast on a big layout", () => {
    const big = { width: 256, height: 180, data: Uint8ClampedArray.from({ length: 256 * 180 * 4 }, (_, i) => (i * 7919) % 256) };
    const l = createLayout({ region: { x: 0, y: 0, width: 1000, height: 700 }, tiling: hexagonal({ size: 8 }) });
    const t = performance.now();
    colorsOf(imageFill(big), l);
    expect(performance.now() - t).toBeLessThan(2000);
  });

  it("loadImagePixels needs a browser", async () => {
    await expect(loadImagePixels("x.png")).rejects.toThrow(/browser/);
  });
});
