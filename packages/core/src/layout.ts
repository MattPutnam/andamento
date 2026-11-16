import {
  area,
  bbox,
  centroid,
  clipConvex,
  containsPolygon,
  ensurePositive,
  insetConvex,
  isConvex,
  rectPolygon,
  rectsOverlap,
  sharesEdge,
  vec,
  type Polygon,
  type Rect,
  type Vec,
} from "./geometry";
import { generateTiles, type TilingSpec } from "./tilings";

/**
 * How tiles at the edge of the region are treated.
 * - "clip":     cut tiles to the region outline (a full-bleed look).
 * - "inside":   keep only tiles that fit entirely inside the region.
 * - "overflow": keep every tile that touches the region, uncut.
 */
export type EdgeMode = "clip" | "inside" | "overflow";

export interface LayoutOptions {
  /** The area to tile: a rectangle or any convex polygon, in your own units (cm, px, in…). */
  region: Rect | Polygon;
  tiling: TilingSpec;
  /** Space between neighbouring tiles. Defaults to 0. */
  gap?: number;
  /** Empty border kept between the region outline and the tiles. Defaults to 0. */
  margin?: number;
  /** Pattern rotation in degrees (ignored by the random patterns: mondrian, voronoi, delaunay, ashlar). Defaults to 0. */
  rotation?: number;
  /** Shifts the pattern (ignored by the random patterns). Defaults to the top-left of the region. */
  origin?: Vec;
  /** Defaults to "clip". */
  edges?: EdgeMode;
  /**
   * Drop edge tiles that end up smaller than this fraction (0–1) of a full tile,
   * so you don't get slivers. Applies to "clip" and "overflow". Defaults to 0.
   */
  minFill?: number;
  /**
   * Round every tile corner with this radius, in region units. Corners too small
   * for the full radius get the largest radius that fits. Defaults to 0 (sharp).
   * Rounding is applied when rendering; `Cell.polygon`, `area` and `centroid`
   * describe the sharp-cornered shape.
   */
  cornerRadius?: number;
  /** Safety cap on generated tiles. Defaults to 20000. */
  maxTiles?: number;
}

export interface Cell {
  /** Stable id derived from the tile's position in the pattern. */
  id: string;
  /** Position in reading order (top-to-bottom, then left-to-right). Use it to assign content to cells. */
  index: number;
  /** Visible shape: after gap and edge handling. */
  polygon: Polygon;
  /** The full pattern tile before gap and edge handling. */
  original: Polygon;
  bbox: Rect;
  centroid: Vec;
  area: number;
  /** The tile crosses the region outline (it was cut in "clip" mode, or sticks out in "overflow"). */
  boundary: boolean;
  /** Which prototile this is a copy of (e.g. herringbone: 0 horizontal, 1 vertical). */
  protoTile: number;
  /** Ids of cells that share an edge with this one in the underlying pattern. */
  neighbors: string[];
}

export interface Layout {
  /** The region outline (before margin). */
  region: Polygon;
  /** Bounding box of the region; a good SVG viewBox. */
  bounds: Rect;
  /** Corner radius renderers apply to every cell (0 for sharp corners). */
  cornerRadius: number;
  cells: Cell[];
}

function toPolygon(region: Rect | Polygon): Polygon {
  if (Array.isArray(region)) return region.map((v) => vec(v.x, v.y));
  return rectPolygon(region.x, region.y, region.width, region.height);
}

export function createLayout(options: LayoutOptions): Layout {
  const region = ensurePositive(toPolygon(options.region));
  if (!isConvex(region)) throw new RangeError("region must be a convex polygon");
  const bounds = bbox(region);
  const scaleRef = Math.max(bounds.width, bounds.height);
  const tol = 1e-7 * scaleRef;

  const gap = Math.max(0, options.gap ?? 0);
  const margin = Math.max(0, options.margin ?? 0);
  const edges = options.edges ?? "clip";
  const minFill = Math.min(1, Math.max(0, options.minFill ?? 0));
  const cornerRadius = Math.max(0, options.cornerRadius ?? 0);

  const inner = margin > 0 ? insetConvex(region, margin) : region;
  if (inner.length === 0) return { region, bounds, cornerRadius, cells: [] };
  const innerBox = bbox(inner);

  const raw = generateTiles(options.tiling, {
    region: inner,
    rotation: options.rotation ?? 0,
    origin: options.origin ?? vec(bounds.x, bounds.y),
    maxTiles: options.maxTiles ?? 20000,
  });

  type Draft = Omit<Cell, "index" | "neighbors">;
  const drafts: Draft[] = [];
  const minArea = tol * scaleRef;

  for (const t of raw) {
    const original = ensurePositive(t.polygon);
    if (!rectsOverlap(bbox(original), innerBox)) continue;
    // Each tile gives up half the gap on every side, so neighbours end up `gap` apart.
    const tile = gap > 0 ? insetConvex(original, gap / 2) : original;
    if (tile.length === 0) continue;
    const full = area(tile);

    let polygon: Polygon;
    let boundary: boolean;
    if (edges === "inside") {
      if (!containsPolygon(inner, tile, tol)) continue;
      polygon = tile;
      boundary = false;
    } else {
      const cut = clipConvex(tile, inner);
      const visible = cut.length ? area(cut) : 0;
      if (visible <= minArea || visible < minFill * full) continue;
      boundary = visible < full - minArea;
      polygon = edges === "clip" ? cut : tile;
    }

    drafts.push({
      id: t.id,
      polygon,
      original,
      bbox: bbox(polygon),
      centroid: centroid(polygon),
      area: area(polygon),
      boundary,
      protoTile: t.protoTile,
    });
  }

  // Reading order: rows top-to-bottom, then left-to-right.
  const rowTol = 1e-6 * scaleRef;
  drafts.sort((p, q) => {
    const dy = p.centroid.y - q.centroid.y;
    return Math.abs(dy) > rowTol ? dy : p.centroid.x - q.centroid.x;
  });

  const neighbors = findNeighbors(drafts.map((d) => d.original), Math.max(tol * 10, 1e-9));
  const cells: Cell[] = drafts.map((d, index) => ({
    ...d,
    index,
    neighbors: neighbors[index]!.map((k) => drafts[k]!.id),
  }));
  return { region, bounds, cornerRadius, cells };
}

/** Edge-adjacency between polygons, using a sweep over x-sorted bounding boxes. */
function findNeighbors(polys: Polygon[], tol: number): number[][] {
  const boxes = polys.map((p) => bbox(p));
  const order = polys.map((_, i) => i).sort((a, b) => boxes[a]!.x - boxes[b]!.x);
  const result: number[][] = polys.map(() => []);
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi]!;
    const bi = boxes[i]!;
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj]!;
      const bj = boxes[j]!;
      if (bj.x > bi.x + bi.width + tol) break;
      if (!rectsOverlap(bi, bj, tol)) continue;
      if (sharesEdge(polys[i]!, polys[j]!, tol)) {
        result[i]!.push(j);
        result[j]!.push(i);
      }
    }
  }
  return result;
}

/**
 * Greedy graph colouring over cell adjacency: neighbouring cells get different
 * colour indices. Handy for placeholder fills. Returns one index per cell (by cell.index).
 */
export function colorCells(layout: Layout, colors: number): number[] {
  const byId = new Map(layout.cells.map((c) => [c.id, c.index]));
  const out: number[] = new Array(layout.cells.length).fill(-1);
  for (const c of layout.cells) {
    const used = new Set<number>();
    for (const n of c.neighbors) {
      const k = byId.get(n);
      if (k !== undefined && out[k]! >= 0) used.add(out[k]!);
    }
    let pick = 0;
    // Rotate the starting colour so large single-colour runs are avoided.
    for (let s = 0; s < colors; s++) {
      const cand = (c.index + s) % colors;
      if (!used.has(cand)) {
        pick = cand;
        break;
      }
    }
    out[c.index] = pick;
  }
  return out;
}
