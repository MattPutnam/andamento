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
  vec,
  type Polygon,
  type Rect,
  type Vec,
} from "./geometry";
import { clipPolygonToConvex, insetPolygon } from "./offset";
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
  /** Pattern rotation in degrees (ignored by the random patterns: mondrian, voronoi, delaunay, ashlar, jigsaw). Defaults to 0. */
  rotation?: number;
  /**
   * Shifts the pattern (ignored by the random patterns). For penrose this is where the
   * ten-fold star at the pattern's centre sits. Defaults to the top-left of the region.
   */
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
    const convex = isConvex(original);
    // Each tile gives up half the gap on every side, so neighbours end up `gap` apart.
    const tile = gap <= 0 ? original : convex ? insetConvex(original, gap / 2) : insetPolygon(original, gap / 2);
    if (tile.length === 0) continue;
    const full = area(tile);

    let pieces: Polygon[];
    let boundary: boolean;
    if (edges === "inside") {
      if (!containsPolygon(inner, tile, tol)) continue;
      pieces = [tile];
      boundary = false;
    } else {
      // The region edge can cut a non-convex tile into separate parts; those become
      // separate cells, largest first.
      const cut = convex
        ? [clipConvex(tile, inner)]
        : clipPolygonToConvex(tile, inner)
            .filter((q) => area(q) > minArea)
            .sort((a, b) => area(b) - area(a));
      const visible = cut.reduce((sum, q) => sum + (q.length ? area(q) : 0), 0);
      if (visible <= minArea || visible < minFill * full) continue;
      boundary = visible < full - minArea;
      pieces = edges === "overflow" ? [tile] : cut;
    }

    pieces.forEach((polygon, k) => {
      drafts.push({
        // Extra parts of a tile split by the region edge get "~1", "~2", ….
        id: k === 0 ? t.id : `${t.id}~${k}`,
        polygon,
        original,
        bbox: bbox(polygon),
        centroid: centroid(polygon),
        area: area(polygon),
        boundary,
        protoTile: t.protoTile,
      });
    });
  }

  // Reading order: rows top-to-bottom, then left-to-right.
  const rowTol = 1e-6 * scaleRef;
  drafts.sort((p, q) => {
    const dy = p.centroid.y - q.centroid.y;
    return Math.abs(dy) > rowTol ? dy : p.centroid.x - q.centroid.x;
  });

  const neighbors = findNeighbors(
    drafts.map((d) => d.original),
    drafts.map((d) => !d.id.includes("~")),
    Math.max(tol * 10, 1e-9),
  );
  const cells: Cell[] = drafts.map((d, index) => ({
    ...d,
    index,
    neighbors: neighbors[index]!.map((k) => drafts[k]!.id),
  }));
  return { region, bounds, cornerRadius, cells };
}

/**
 * Edge-adjacency between polygons: two share an edge if they have overlapping boundary
 * segments on the same line (which also catches T-junctions, where one tile's edge runs
 * along part of another's). Edges are bucketed by their line, so the work grows with the
 * number of edges rather than with pairs of nearby tiles × their edges.
 */
function findNeighbors(polys: Polygon[], primary: boolean[], tol: number): number[][] {
  // Line of each edge: direction angle in [0, π) and signed offset from the origin.
  const angleStep = 1e-6;
  const offsetStep = Math.max(tol * 10, 1e-9);
  type Seg = { poly: number; t0: number; t1: number };
  // Buckets keyed by a number packing (angle, offset) exactly; offsets are measured from a
  // point near the tiles so they stay small. Anything beyond the packable range (tiles
  // absurdly far away) falls back to string keys.
  const buckets = new Map<number | string, Seg[]>();
  const add = (ka: number, ko: number, seg: Seg) => {
    const key = Math.abs(ko) < 2 ** 30 ? (ka + 2) * 2 ** 31 + (ko + 2 ** 30) : `${ka},${ko}`;
    const list = buckets.get(key);
    if (list) list.push(seg);
    else buckets.set(key, [seg]);
  };
  const ref = polys.find((p) => p.length > 0)?.[0] ?? { x: 0, y: 0 };
  // Parts of one tile (split by the region edge) share the same original; its main part
  // (the one without a "~n" suffix) stands for the tile.
  const owners = new Map<Polygon, number>();
  polys.forEach((p, i) => {
    if (primary[i] || !owners.has(p)) owners.set(p, i);
  });
  polys.forEach((p, i) => {
    if (owners.get(p) !== i) return;
    for (let k = 0; k < p.length; k++) {
      const a = p[k]!;
      const b = p[(k + 1) % p.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len <= tol) continue;
      let ux = (b.x - a.x) / len;
      let uy = (b.y - a.y) / len;
      if (uy < 0 || (uy === 0 && ux < 0)) {
        ux = -ux;
        uy = -uy;
      }
      // Directions just short of 180° are the same lines as those just past 0°.
      let angle = Math.atan2(uy, ux);
      if (angle > Math.PI - angleStep) {
        ux = -ux;
        uy = -uy;
        angle = Math.atan2(uy, ux);
      }
      const ax = a.x - ref.x, ay = a.y - ref.y;
      const ta = ux * ax + uy * ay;
      const tb = ux * (b.x - ref.x) + uy * (b.y - ref.y);
      const seg = { poly: i, t0: Math.min(ta, tb), t1: Math.max(ta, tb) };
      // Bucket by line. A value close to a rounding boundary also goes into the bucket on
      // the other side, so the same line computed with slightly different rounding still meets.
      const va = angle / angleStep;
      const vo = (ux * ay - uy * ax) / offsetStep;
      const ka = Math.round(va);
      const ko = Math.round(vo);
      const ea = va - ka > 0.49 ? 1 : va - ka < -0.49 ? -1 : 0;
      const eo = vo - ko > 0.49 ? 1 : vo - ko < -0.49 ? -1 : 0;
      add(ka, ko, seg);
      if (eo) add(ka, ko + eo, seg);
      if (ea) {
        add(ka + ea, ko, seg);
        if (eo) add(ka + ea, ko + eo, seg);
      }
    }
  });

  const pairs = new Set<string>();
  const result: number[][] = polys.map(() => []);
  const link = (i: number, j: number) => {
    const key = i < j ? `${i},${j}` : `${j},${i}`;
    if (pairs.has(key)) return;
    pairs.add(key);
    result[i]!.push(j);
    result[j]!.push(i);
  };
  for (const segs of buckets.values()) {
    // Sweep along the line: only segments whose intervals overlap are compared. (In a
    // lattice a whole row of tiles can put edges on one line, so pairwise would be slow.)
    segs.sort((a, b) => a.t0 - b.t0);
    const active: Seg[] = [];
    for (const s of segs) {
      for (let k = active.length - 1; k >= 0; k--) {
        if (active[k]!.t1 <= s.t0 + tol) active.splice(k, 1);
      }
      for (const o of active) {
        if (o.poly !== s.poly && Math.min(s.t1, o.t1) - Math.max(s.t0, o.t0) > tol) link(s.poly, o.poly);
      }
      active.push(s);
    }
  }
  // Parts of one tile get the same neighbours as the tile.
  polys.forEach((p, i) => {
    const owner = owners.get(p)!;
    if (owner !== i) result[i] = [...result[owner]!];
  });
  for (const list of result) list.sort((a, b) => a - b);
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
