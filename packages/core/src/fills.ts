import { colorCells, type Cell, type Layout } from "./layout";
import { mulberry32 } from "./random";

/**
 * A color per cell. Renderers' `fill` props accept these; they're plain functions, so
 * you can also call them yourself (`fill(cell, layout)`) for other renderers.
 */
export type CellFill = (cell: Cell, layout: Layout) => string;

/** Neighbouring cells get different colors from `colors` (as far as the palette allows). */
export function paletteFill(colors: readonly string[]): CellFill {
  if (colors.length === 0) throw new RangeError("paletteFill needs at least one color");
  const cache = new WeakMap<Layout, number[]>();
  return (cell, layout) => {
    let indices = cache.get(layout);
    if (!indices) {
      indices = colorCells(layout, colors.length);
      cache.set(layout, indices);
    }
    return colors[indices[cell.index] ?? 0]!;
  };
}

/** One color per prototile, e.g. herringbone's horizontal and vertical bricks. */
export function protoTileFill(colors: readonly string[]): CellFill {
  if (colors.length === 0) throw new RangeError("protoTileFill needs at least one color");
  return (cell) => colors[cell.protoTile % colors.length]!;
}

/**
 * A random color per cell. The choice depends only on the cell's id and `seed`, so a tile
 * keeps its color when the layout is resized or the region changes.
 */
export function randomFill(colors: readonly string[], seed = 1): CellFill {
  if (colors.length === 0) throw new RangeError("randomFill needs at least one color");
  return (cell) => colors[Math.floor(mulberry32(hashString(cell.id) ^ Math.imul(seed, 0x9e3779b1))() * colors.length)]!;
}

export interface GradientOptions {
  /**
   * Direction of a linear gradient in degrees: 0 runs left to right, 90 top to bottom
   * (y grows downward). Defaults to 0.
   */
  angle?: number;
  /** "radial" runs from the region's centre (first stop) out to its corners (last stop). */
  shape?: "linear" | "radial";
}

/**
 * Color by position: each cell takes the gradient's color at its centroid. Stops are hex
 * colors (#rgb or #rrggbb), spaced evenly and blended in the OKLab color space, which
 * keeps the middle of the gradient from going muddy.
 */
export function gradientFill(stops: readonly string[], options: GradientOptions = {}): CellFill {
  if (stops.length === 0) throw new RangeError("gradientFill needs at least one color");
  const labs = stops.map((s) => srgbToOklab(parseHex(s)));
  const { angle = 0, shape = "linear" } = options;
  const dx = Math.cos((angle * Math.PI) / 180);
  const dy = Math.sin((angle * Math.PI) / 180);
  return (cell, layout) => {
    const b = layout.bounds;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const px = cell.centroid.x - cx;
    const py = cell.centroid.y - cy;
    let t: number;
    if (shape === "radial") {
      t = Math.hypot(px, py) / (Math.hypot(b.width, b.height) / 2 || 1);
    } else {
      // Project onto the direction; the region's corners map to 0 and 1.
      const half = (Math.abs(dx) * b.width + Math.abs(dy) * b.height) / 2 || 1;
      t = ((px * dx + py * dy) / half + 1) / 2;
    }
    return toHex(oklabToSrgb(sample(labs, Math.min(1, Math.max(0, t)))));
  };
}

type Triple = [number, number, number];

function sample(stops: Triple[], t: number): Triple {
  if (stops.length === 1) return stops[0]!;
  const x = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function parseHex(s: string): Triple {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) throw new RangeError(`gradientFill needs hex colors like "#e9d8a6" (got ${JSON.stringify(s)})`);
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Triple;
}

function toHex(c: Triple): string {
  return "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function srgbToOklab(c: Triple): Triple {
  const [r, g, b] = c.map(toLinear) as Triple;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToSrgb([L, a, b]: Triple): Triple {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => fromLinear(Math.max(0, v))) as Triple;
}
