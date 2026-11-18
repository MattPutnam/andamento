import { describe, expect, it } from "vitest";
import { createLayout, grid, hexagonal } from "@andamento/core";
import { drawLayout, imagesUsed, loadImages, rasterSize, renderToPng, tracePolygon, type CanvasContextLike, type CanvasImage } from "@andamento/svg";

type Op = [string, ...unknown[]];

/** A fake 2D context that records what's drawn, with the state at each fill. */
function recorder(width = 600, height = 400) {
  const ops: Op[] = [];
  const state = { fillStyle: "" as unknown, strokeStyle: "" as unknown, lineWidth: 1, lineJoin: "", globalAlpha: 1, shadowColor: "", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0 };
  const ctx = new Proxy(state as unknown as CanvasContextLike & typeof state, {
    get(target, prop: string) {
      if (prop === "canvas") return { width, height };
      if (prop in target) return (target as Record<string, unknown>)[prop];
      return (...args: unknown[]) => {
        if (prop === "fill" || prop === "stroke") ops.push([prop, ...args, { ...target }]);
        else ops.push([prop, ...args]);
      };
    },
    set(target, prop: string, value) {
      (target as Record<string, unknown>)[prop] = value;
      return true;
    },
  });
  return { ctx, ops };
}

const region = { x: 0, y: 0, width: 300, height: 200 };
const g = createLayout({ region, tiling: grid({ width: 100 }), gap: 10 });
const fills = (ops: Op[]) => ops.filter((o) => o[0] === "fill").map((o) => (o[o.length - 1] as { fillStyle: unknown }).fillStyle);

describe("drawLayout", () => {
  it("scales the layout to the canvas and fills every cell", () => {
    const { ctx, ops } = recorder();
    drawLayout(ctx, g, { fill: ["#111", "#222"], background: "#eee" });
    expect(ops.find((o) => o[0] === "setTransform")).toEqual(["setTransform", 2, 0, 0, 2, 0, 0]);
    const f = fills(ops);
    expect(f[0]).toBe("#eee"); // background first
    expect(f.slice(1)).toHaveLength(6);
    expect(new Set(f.slice(1))).toEqual(new Set(["#111", "#222"]));
    // Balanced save / restore.
    expect(ops.filter((o) => o[0] === "save").length).toBe(ops.filter((o) => o[0] === "restore").length);
  });

  it("centres a layout in a canvas of another shape", () => {
    const { ctx, ops } = recorder(300, 400);
    drawLayout(ctx, g);
    expect(ops.find((o) => o[0] === "setTransform")).toEqual(["setTransform", 1, 0, 0, 1, 0, 100]);
  });

  it("draws images covering their cells, clipped to the shape", () => {
    const img: CanvasImage = { width: 200, height: 100 };
    const { ctx, ops } = recorder();
    drawLayout(ctx, g, { images: ["a.jpg"], loaded: new Map([["a.jpg", img]]) });
    const draws = ops.filter((o) => o[0] === "drawImage");
    expect(draws).toHaveLength(1);
    // A 2:1 image in a 90 x 90 cell: the middle square of it, drawn over the cell's box.
    expect(draws[0]!.slice(2)).toEqual([50, 0, 100, 100, 5, 5, 90, 90]);
    const i = ops.indexOf(draws[0]!);
    expect(ops.slice(0, i).some((o) => o[0] === "clip" && o[1] === "evenodd")).toBe(true);
  });

  it("draws contained images whole in the safe area", () => {
    const img: CanvasImage = { width: 200, height: 100 };
    const { ctx, ops } = recorder();
    drawLayout(ctx, g, { images: ["a.jpg"], imageFit: "contain", imageAspects: [2], loaded: new Map([["a.jpg", img]]) });
    const [, , sx, sy, sw, sh, dx, dy, dw, dh] = ops.find((o) => o[0] === "drawImage")! as number[] & Op;
    expect([sx, sy, sw, sh]).toEqual([0, 0, 200, 100]);
    expect([dx, dy, dw, dh]).toEqual([5, 27.5, 90, 45]);
  });

  it("skips images that didn't load, showing the fill", () => {
    const { ctx, ops } = recorder();
    drawLayout(ctx, g, { images: ["missing.jpg"], fill: "#123" });
    expect(ops.some((o) => o[0] === "drawImage")).toBe(false);
    expect(fills(ops)).toEqual(Array(6).fill("#123"));
  });

  it("draws relief and cast shadows", () => {
    const { ctx, ops } = recorder();
    drawLayout(ctx, g, { relief: { bevel: 5, shadow: 3, light: 0 } });
    const shadow = ops.find((o) => o[0] === "fill" && (o[o.length - 1] as { shadowBlur: number }).shadowBlur > 0)!;
    const s = shadow[shadow.length - 1] as { shadowBlur: number; shadowOffsetY: number; shadowColor: string };
    // Device pixels: scale 2. Light from above: the shadow falls straight down.
    expect(s.shadowBlur).toBeCloseTo(12);
    expect(s.shadowOffsetY).toBeCloseTo(6);
    expect(s.shadowColor).toBe("rgba(0,0,0,0.35)");
    const bevels = ops.filter((o) => o[0] === "fill" && (o[o.length - 1] as { globalAlpha: number }).globalAlpha < 1);
    expect(bevels.length).toBe(12); // per cell: one lit layer, one dark
  });

  it("strokes cells", () => {
    const { ctx, ops } = recorder();
    drawLayout(ctx, g, { stroke: "#000", strokeWidth: 2 });
    const strokes = ops.filter((o) => o[0] === "stroke");
    expect(strokes).toHaveLength(6);
    expect((strokes[0]![1] as { lineWidth: number }).lineWidth).toBe(2);
  });
});

describe("tracePolygon", () => {
  it("draws rounded corners as arcs", () => {
    const { ctx, ops } = recorder();
    const l = createLayout({ region, tiling: hexagonal({ size: 40 }), cornerRadius: 5 });
    tracePolygon(ctx, l.cells[0]!.polygon, 5);
    expect(ops.filter((o) => o[0] === "arc").length).toBe(l.cells[0]!.polygon.length);
    expect(ops[ops.length - 1]![0]).toBe("closePath");
  });
});

describe("raster helpers", () => {
  it("sizes rasters from the layout", () => {
    expect(rasterSize(g)).toEqual({ w: 300, h: 200 });
    expect(rasterSize(g, { width: 1200, pixelRatio: 2 })).toEqual({ w: 2400, h: 1600 });
  });

  it("loads the images used, leaving out failures", async () => {
    expect(imagesUsed(g, { images: ["a", "b"], backdrop: "c" }).sort()).toEqual(["a", "b", "c"]);
    const loaded = await loadImages(["ok", "bad"], async (u) => {
      if (u === "bad") throw new Error("nope");
      return { width: 1, height: 1 };
    });
    expect([...loaded.keys()]).toEqual(["ok"]);
  });

  it("renders a PNG through any canvas", async () => {
    const { ctx, ops } = recorder(0, 0);
    let exported = "";
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void, type: string) => {
        exported = type;
        cb(new Blob(["x"], { type }));
      },
    };
    const blob = await renderToPng(g, {
      width: 150,
      pixelRatio: 2,
      images: ["a.jpg"],
      loadImage: async () => ({ width: 10, height: 10 }),
      createCanvas: () => canvas,
    });
    expect(blob.type).toBe("image/png");
    expect(exported).toBe("image/png");
    expect([canvas.width, canvas.height]).toEqual([300, 200]);
    expect(ops.some((o) => o[0] === "drawImage")).toBe(true);
    expect(ops.find((o) => o[0] === "setTransform")).toEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
  });
});
