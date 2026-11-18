import { bevelFacets, lightVector, type Cell, type Layout } from "@andamento/core";

/**
 * Makes tiles look raised: a bevel round each tile's edges, lit from one side, and
 * optionally a shadow each tile casts into the grout (the gaps) on the other.
 */
export interface ReliefOptions {
  /** Bevel width in layout units. Defaults to 8% of a typical tile's size; 0 for none. */
  bevel?: number;
  /** Direction the light comes from: degrees clockwise from the top (default 315, top left). */
  light?: number;
  /** Opacity of the brightest highlight and the darkest bevel shadow, 0–1. Defaults to 0.4. */
  strength?: number;
  /** How far tiles' shadows fall into the grout, in layout units (default 0: no shadow). */
  shadow?: number;
  /** Blur of the cast shadow (standard deviation, layout units). Defaults to `shadow`. */
  shadowBlur?: number;
  /** Opacity of the cast shadow. Defaults to 0.35. */
  shadowOpacity?: number;
}

/** One layer of a cell's bevel: all its faces of about the same shade, as one path. */
export interface ReliefPath {
  d: string;
  /** "#fff" for highlights, "#000" for shadows. */
  fill: string;
  opacity: number;
}

/** The default bevel width for a layout: 8% of the square root of the mean tile area. */
export function defaultBevel(layout: Layout): number {
  const n = layout.cells.length;
  if (n === 0) return 0;
  const mean = layout.cells.reduce((s, c) => s + c.area, 0) / n;
  return 0.08 * Math.sqrt(mean);
}

const LEVELS = 8;

/**
 * A cell's bevel as a few paths (faces grouped into shade levels), in layout coordinates,
 * to draw over the cell's content. Pass the bevel width from `defaultBevel` if not set.
 */
export function reliefPaths(layout: Layout, cell: Cell, relief: ReliefOptions, bevel: number, precision = 3): ReliefPath[] {
  const strength = relief.strength ?? 0.4;
  const facets = bevelFacets(cell, layout, { width: bevel, light: relief.light });
  const f = (n: number) => Number(n.toFixed(precision));
  const groups = new Map<number, string[]>();
  for (const facet of facets) {
    const level = Math.round(facet.shade * LEVELS);
    if (level === 0) continue;
    const d = "M" + facet.polygon.map((p) => `${f(p.x)} ${f(p.y)}`).join("L") + "Z";
    const list = groups.get(level);
    if (list) list.push(d);
    else groups.set(level, [d]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, ds]) => ({
      d: ds.join(""),
      fill: level > 0 ? "#fff" : "#000",
      opacity: Number(((Math.abs(level) / LEVELS) * strength).toFixed(3)),
    }));
}

/** Offset of the cast shadow (away from the light), or undefined for none. */
export function shadowOffset(relief: ReliefOptions): { dx: number; dy: number; blur: number; opacity: number } | undefined {
  const s = relief.shadow ?? 0;
  if (!(s > 0)) return undefined;
  const l = lightVector(relief.light);
  return { dx: -l.x * s, dy: -l.y * s, blur: relief.shadowBlur ?? s, opacity: relief.shadowOpacity ?? 0.35 };
}
