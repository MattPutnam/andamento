import { describe, expect, it } from "vitest";
import {
  cairo,
  createLayout,
  grid,
  herringbone,
  hexagonal,
  rectPolygon,
  roundedPolygon,
  safeArea,
  safeAreaCss,
  triangular,
  vec,
  voronoi,
  type Cell,
  type Layout,
  type Rect,
} from "@andamento/core";
import {
  pointInPolygon,
} from "@andamento/core/internal";

const one = (region: Layout["region"] | Rect, extra: object = {}) =>
  createLayout({ region, tiling: grid({ width: 1000 }), ...extra });

function inShape(cell: Cell, layout: Layout, x: number, y: number) {
  const p = vec(x, y);
  return (
    pointInPolygon(p, roundedPolygon(cell.polygon, layout.cornerRadius)) &&
    !(cell.holes ?? []).some((h) => pointInPolygon(p, roundedPolygon(h, layout.cornerRadius)))
  );
}

/** The rectangle (shrunk by a hair) lies inside the cell: dense samples on its outline and inside. */
function fits(cell: Cell, layout: Layout, r: Rect, n = 24) {
  const e = 1e-6 * Math.max(cell.bbox.width, cell.bbox.height);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = r.x + e + ((r.width - 2 * e) * i) / n;
      const y = r.y + e + ((r.height - 2 * e) * j) / n;
      if (!inShape(cell, layout, x, y)) return false;
    }
  }
  return true;
}

/** Brute force: a grid of centers and aspects, binary-searching the size of each. */
function bruteForce(cell: Cell, layout: Layout, aspect?: number) {
  const b = cell.bbox;
  let best = 0;
  const aspects = aspect ? [aspect] : Array.from({ length: 9 }, (_, k) => (b.width / b.height) * Math.exp(-2 + (4 * k) / 8));
  const g = 11;
  for (const a of aspects) {
    for (let i = 1; i < g; i++) {
      for (let j = 1; j < g; j++) {
        const cx = b.x + (b.width * i) / g, cy = b.y + (b.height * j) / g;
        if (!inShape(cell, layout, cx, cy)) continue;
        let lo = 0, hi = Math.max(b.width, b.height);
        for (let it = 0; it < 14; it++) {
          const t = (lo + hi) / 2;
          const w = t * Math.sqrt(a), h = t / Math.sqrt(a);
          if (fits(cell, layout, { x: cx - w / 2, y: cy - h / 2, width: w, height: h }, 10)) lo = t;
          else hi = t;
        }
        best = Math.max(best, lo * lo);
      }
    }
  }
  return best;
}

describe("safeArea", () => {
  it("is the cell itself for a rectangle, or a centerd fit for a fixed aspect", () => {
    const l = one({ x: 0, y: 0, width: 20, height: 10 });
    const c = l.cells[0]!;
    expect(safeArea(c, l)).toEqual({ x: 0, y: 0, width: 20, height: 10 });
    expect(safeArea(c, l, { aspect: 1 })).toEqual({ x: 5, y: 0, width: 10, height: 10 });
    expect(safeArea(c, l, { aspect: 4 })).toEqual({ x: 0, y: 2.5, width: 20, height: 5 });
  });

  it("finds the largest rectangle in a right triangle", () => {
    const l = one([vec(0, 0), vec(10, 0), vec(0, 10)]);
    const r = safeArea(l.cells[0]!, l);
    // The best is the 5 x 5 square in the right-angle corner.
    expect(r.width * r.height).toBeCloseTo(25, 1);
    expect(r.x).toBeCloseTo(0, 2);
    expect(r.y).toBeCloseTo(0, 2);
    expect(fits(l.cells[0]!, l, r)).toBe(true);
    const wide = safeArea(l.cells[0]!, l, { aspect: 4 });
    // Width w, height w/4, corner on the hypotenuse: w + w/4 = 10.
    expect(wide.width).toBeCloseTo(8, 1);
    expect(wide.height).toBeCloseTo(2, 1);
  });

  it("goes around holes", () => {
    const l = one({ x: 0, y: 0, width: 100, height: 100 }, { holes: [rectPolygon(40, 40, 20, 20)] });
    const c = l.cells[0]!;
    expect(c.holes).toHaveLength(1);
    const r = safeArea(c, l);
    expect(r.width * r.height).toBeGreaterThan(3990);
    expect(r.width * r.height).toBeLessThan(4000.01);
    expect(fits(c, l, r)).toBe(true);
  });

  it("centers the area when it could slide", () => {
    // A 30 x 10 parallelogram-free case: a long hexagon-ish strip; square content slides along it.
    const l = one([vec(0, 5), vec(5, 0), vec(35, 0), vec(40, 5), vec(35, 10), vec(5, 10)]);
    const r = safeArea(l.cells[0]!, l, { aspect: 1 });
    expect(r.width).toBeCloseTo(10, 2);
    expect(r.x + r.width / 2).toBeCloseTo(20, 0);
  });

  it("matches brute force on real tile shapes", () => {
    const region = { x: 0, y: 0, width: 300, height: 200 };
    const cases: [string, Layout][] = [
      ["hexagon", createLayout({ region, tiling: hexagonal({ size: 40 }) })],
      ["triangle", createLayout({ region, tiling: triangular({ size: 60 }) })],
      ["cairo", createLayout({ region, tiling: cairo({ size: 60 }) })],
      ["voronoi", createLayout({ region, tiling: voronoi({ size: 70, seed: 3 }) })],
      ["herringbone", createLayout({ region, tiling: herringbone({ length: 60, width: 20 }), rotation: 30 })],
      ["rounded", createLayout({ region, tiling: hexagonal({ size: 40 }), cornerRadius: 10 })],
    ];
    for (const [name, l] of cases) {
      // A middle cell and a cut edge cell.
      const inner = l.cells.find((c) => !c.boundary) ?? l.cells[0]!;
      const edge = l.cells.find((c) => c.boundary) ?? l.cells[1]!;
      for (const c of [inner, edge]) {
        for (const aspect of [undefined, 1.5]) {
          const r = safeArea(c, l, { aspect });
          expect(fits(c, l, r), `${name} ${c.id} fits`).toBe(true);
          if (aspect) expect(r.width / r.height).toBeCloseTo(aspect, 6);
          const brute = bruteForce(c, l, aspect);
          expect(r.width * r.height, `${name} ${c.id} ${aspect}`).toBeGreaterThanOrEqual(brute * 0.99);
        }
      }
    }
  });

  it("is quick enough for a whole layout", () => {
    const l = createLayout({ region: { x: 0, y: 0, width: 1200, height: 800 }, tiling: voronoi({ size: 50, seed: 1 }), cornerRadius: 4 });
    const t = performance.now();
    for (const c of l.cells) safeArea(c, l);
    expect(performance.now() - t).toBeLessThan(3000);
  });

  it("handles empty cells and gives CSS inside the cell's box", () => {
    const l = one({ x: 0, y: 0, width: 20, height: 10 });
    expect(safeAreaCss(l.cells[0]!, l, { aspect: 1 })).toEqual({ left: "25%", top: "0%", width: "50%", height: "100%" });
    const degenerate = { ...l.cells[0]!, polygon: [], bbox: { x: 0, y: 0, width: 0, height: 0 } };
    expect(safeArea(degenerate, l)).toMatchObject({ width: 0, height: 0 });
  });
});
