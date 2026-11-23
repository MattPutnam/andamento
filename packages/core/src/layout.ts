import {
  area,
  bbox,
  centroid,
  clipConvex,
  containsPolygon,
  convexHull,
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
import { clipPolygonToConvex, insetPolygon, insetPolygonPieces, outsetPolygon, pointInPolygon, splitSelfIntersections } from "./offset";
import { inShapes, overlay, shapeArea, shapeCentroid, type Shape } from "./overlay";
import { generateTiles, type TilingSpec } from "./tilings";
import { fieldRange, refineTiles } from "./density";

/**
 * How tiles at the edge of the region are treated.
 * - "clip":     cut tiles to the region outline (a full-bleed look).
 * - "inside":   keep only tiles that fit entirely inside the region.
 * - "overflow": keep every tile that touches the region, uncut.
 * - "window":   tiles stay whole and the region is a window onto them: renderers shape,
 *               round, bevel and fill each tile as the whole tile (`Cell.tile`) and hide
 *               what falls outside the region (`Layout.view`). A cut edge is a straight
 *               line through the tile, not a new corner.
 */
export type EdgeMode = "clip" | "inside" | "overflow" | "window";

export interface LayoutOptions {
  /**
   * The area to tile: a rectangle or any simple polygon (convex or not; it mustn't cross
   * itself), in your own units (cm, px, in…).
   */
  region: Rect | Polygon;
  /**
   * Areas inside the region to leave empty: windows, doors, sockets. Rectangles or
   * simple polygons; they may overlap each other or the region's edge. Tiles are cut
   * around them (or skipped, with `edges: "inside"`), and `margin` applies around them too.
   */
  holes?: (Rect | Polygon)[];
  tiling: TilingSpec;
  /** Space between neighboring tiles. Defaults to 0. */
  gap?: number;
  /** Empty border kept between the region outline (and any holes) and the tiles. Defaults to 0. */
  margin?: number;
  /** Pattern rotation in degrees (ignored by the random patterns: mondrian, voronoi, delaunay, ashlar, jigsaw). Defaults to 0. */
  rotation?: number;
  /**
   * Shifts the pattern (ignored by the random patterns). For penrose this is where the
   * ten-fold star at the pattern's center sits. Defaults to the top-left of the region.
   */
  origin?: Vec;
  /** Defaults to "clip". */
  edges?: EdgeMode;
  /**
   * Drop edge tiles that end up smaller than this fraction (0–1) of a full tile,
   * so you don't get slivers. Applies to "clip", "overflow" and "window". Defaults to 0.
   */
  minFill?: number;
  /**
   * Round every tile corner with this radius, in region units. Corners too small
   * for the full radius get the largest radius that fits. Defaults to 0 (sharp).
   * Rounding is applied when rendering; `Cell.polygon`, `area` and `centroid`
   * describe the sharp-cornered shape.
   */
  cornerRadius?: number;
  /**
   * Scale the whole pattern (every tile size in the tiling spec) by this factor, about
   * the pattern origin. Handy for fitting a tile count without knowing which size
   * parameters a pattern has; see `fitCount`. Defaults to 1.
   */
  tileScale?: number;
  /**
   * Featured tiles: groups of neighboring tiles merged into one bigger cell, e.g. for a
   * hero image. Merging happens before the gap and edge handling, so a featured cell gets
   * the same gap all round as any other. See `Feature`.
   */
  features?: Feature[];
  /**
   * Vary the tile size across the region: the size wanted at each point, as a factor of the
   * tiling's own size (1 as given, 0.5 half as big, 2 twice). Voronoi and Delaunay change
   * size smoothly; other tilings are generated at the largest size wanted and, where tiles
   * should be smaller, replaced by the same tiling at half the scale (again and again, down
   * to the smallest), cut to fit. Grids and other tilings that halve exactly nest without
   * cuts. See `radialSize`, `edgeSize` and `imageSize`.
   */
  sizeAt?: (point: Vec) => number;
  /** Safety cap on generated tiles. Defaults to 20000. */
  maxTiles?: number;
}

/**
 * A featured tile: `tiles` neighboring tiles merged into one cell. The group grows from
 * a tile near `at`, adding whichever neighbor keeps it most compact (so 4 grid tiles make
 * a 2 × 2 square, 7 hexagons a flower); several starting tiles are tried and the most
 * compact group kept, near `at` and avoiding tiles the region edge cuts. Features don't
 * share tiles: a later one grows among the tiles still free.
 */
export interface Feature {
  /** How many tiles to merge. Defaults to 4. Fewer are merged if the group runs out of room. */
  tiles?: number;
  /** Where the group starts, in region units. Defaults to the middle of the region. */
  at?: Vec;
  /**
   * Exact tile ids to merge instead (from a layout without features; ids are stable).
   * Overrides `tiles` and `at`. Tiles that aren't in the layout or are already taken are skipped.
   */
  ids?: string[];
  /**
   * Which content item (by position) goes in this featured cell. By default featured cells
   * take the first items, in `features` order. See `weightedLayout`.
   */
  item?: number;
}

export interface Cell {
  /** Stable id derived from the tile's position in the pattern. */
  id: string;
  /** Position in reading order (top-to-bottom, then left-to-right). Use it to assign content to cells. */
  index: number;
  /** Visible shape: after gap and edge handling. */
  polygon: Polygon;
  /**
   * Holes in the visible shape, when a region hole lies wholly inside the tile. Absent
   * otherwise. `area` and `centroid` account for them.
   */
  holes?: Polygon[];
  /** The full pattern tile before gap and edge handling. */
  original: Polygon;
  /**
   * With `edges: "window"`, for a cell the region outline cuts: the whole tile (after the
   * gap), which renderers shape, round and fill, letting the region hide the rest. `polygon`
   * is still the visible part (its largest piece, when the outline cuts the tile in two).
   * See `cellShape` and `visibleShapes`.
   */
  tile?: Polygon;
  bbox: Rect;
  centroid: Vec;
  area: number;
  /** The tile crosses the region outline (it was cut in "clip" mode, or sticks out in "overflow"). */
  boundary: boolean;
  /** Which prototile this is a copy of (e.g. herringbone: 0 horizontal, 1 vertical). */
  protoTile: number;
  /** Ids of cells that share an edge with this one in the underlying pattern. */
  neighbors: string[];
  /** For a featured cell: its position in `features`. Featured cells get content first. */
  featured?: number;
  /** For a featured cell: the content item it's for, when its feature names one (`Feature.item`). */
  featuredItem?: number;
  /** For a featured cell: ids of the tiles merged into it. */
  merged?: string[];
}

export interface Layout {
  /** The region outline (before margin). */
  region: Polygon;
  /** The region's holes (before margin), positively oriented. */
  holes: Polygon[];
  /** Bounding box of the region; a good SVG viewBox. */
  bounds: Rect;
  /** Corner radius renderers apply to every cell (0 for sharp corners). */
  cornerRadius: number;
  /**
   * With `edges: "window"`: the area tiles show in (the region less its margin and holes).
   * Renderers hide whatever part of a tile lies outside it.
   */
  view?: Shape[];
  cells: Cell[];
}

function toPolygon(region: Rect | Polygon): Polygon {
  if (Array.isArray(region)) return region.map((v) => vec(v.x, v.y));
  return rectPolygon(region.x, region.y, region.width, region.height);
}

export function createLayout(options: LayoutOptions): Layout {
  const region = ensurePositive(toPolygon(options.region));
  if (region.length < 3) throw new RangeError("region needs at least 3 corners");
  if (splitSelfIntersections(region).length > 1) throw new RangeError("region must not cross itself");
  if (area(region) === 0) throw new RangeError("region has no area");
  const holes: Polygon[] = [];
  for (const h of options.holes ?? []) {
    const hole = ensurePositive(toPolygon(h));
    if (hole.length >= 3 && splitSelfIntersections(hole).length > 1) throw new RangeError("holes must not cross themselves");
    if (hole.length >= 3 && area(hole) > 0) holes.push(hole);
  }
  // Convex regions without holes take the fast path: clipping against a convex outline.
  const simple = holes.length === 0 && isConvex(region);
  const bounds = bbox(region);
  const scaleRef = Math.max(bounds.width, bounds.height);
  const tol = 1e-7 * scaleRef;

  const gap = Math.max(0, options.gap ?? 0);
  const margin = Math.max(0, options.margin ?? 0);
  const edges = options.edges ?? "clip";
  const minFill = Math.min(1, Math.max(0, options.minFill ?? 0));
  const cornerRadius = Math.max(0, options.cornerRadius ?? 0);

  const empty: Layout = { region, holes, bounds, cornerRadius, cells: [] };
  // The area tiles may cover: the region less its margin and the (grown) holes.
  let inner: Polygon;
  let usable: Shape[] = [];
  let loops: Polygon[] = [];
  if (simple) {
    inner = margin > 0 ? insetConvex(region, margin) : region;
    if (inner.length === 0) return empty;
  } else {
    const outers = margin > 0 ? insetPolygonPieces(region, margin) : [region];
    const grown = holes.map((h) => (margin > 0 ? outsetPolygon(h, margin) : h)).filter((h) => h.length >= 3);
    usable = overlay(
      [...outers, ...grown],
      (p) => outers.some((o) => pointInPolygon(p, o)) && !grown.some((h) => pointInPolygon(p, h)),
      scaleRef,
    );
    if (usable.length === 0) return empty;
    loops = usable.flatMap((s) => [s.outer, ...s.holes]);
    // Generators only need to cover this; tiles are cut to the exact area below.
    inner = convexHull(usable.flatMap((s) => s.outer));
  }
  const innerBox = bbox(inner);
  // Region edges with their boxes, to find the few that reach each tile.
  const edgesOf = loops.flatMap((l) => l.map((a, i) => [a, l[(i + 1) % l.length]!] as const));
  const edgeBoxes = edgesOf.map(([a, b]) => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }));

  const k = options.tileScale ?? 1;
  if (!(k > 0) || !Number.isFinite(k)) throw new RangeError(`tileScale must be a positive number (got ${k})`);
  const origin = options.origin ?? vec(bounds.x, bounds.y);
  // With sizeAt, the pattern starts at the largest size wanted.
  const field = options.sizeAt;
  const range = field ? fieldRange(field, innerBox) : { min: 1, max: 1 };
  const k0 = k * range.max;
  const smooth = options.tiling.type === "voronoi" || options.tiling.type === "delaunay";
  // Scaling the pattern by k0 = generating in a region shrunk by 1/k0, then scaling back up.
  const down = (v: Vec) => vec(v.x / k0, v.y / k0);
  let raw = generateTiles(options.tiling, {
    region: k0 === 1 ? inner : inner.map(down),
    rotation: options.rotation ?? 0,
    origin: k0 === 1 ? origin : down(origin),
    maxTiles: options.maxTiles ?? 20000,
    // The exact area to tile and the pattern scale, for generators that follow the outline.
    outline: (simple ? [inner] : loops).map((l) => (k0 === 1 ? l : l.map(down))),
    unit: k0,
    ...(field && smooth ? { sizeAt: (p: Vec) => Math.min(1, field(vec(p.x * k0, p.y * k0)) / range.max) } : {}),
  });
  if (k0 !== 1) raw = raw.map((t) => ({ ...t, polygon: t.polygon.map((v) => vec(v.x * k0, v.y * k0)) }));
  if (field && !smooth && options.tiling.type !== "tiles" && options.tiling.type !== "flow" && range.min < range.max / Math.SQRT2) {
    raw = refineTiles(raw, {
      spec: options.tiling,
      rotation: options.rotation ?? 0,
      origin,
      scale: k0,
      want: (p) => field(p) / range.max,
      levels: Math.min(6, Math.round(Math.log2(range.max / range.min))),
      maxTiles: options.maxTiles ?? 20000,
      scaleRef,
      tol,
    });
  }

  type Draft = Omit<Cell, "index" | "neighbors">;
  const drafts: Draft[] = [];
  const minArea = tol * scaleRef;

  /** Gap, edge handling and clipping for one pattern tile; its visible piece(s) as drafts. */
  const place = (original: Polygon, id: string, protoTile: number): Draft[] => {
    const convex = isConvex(original);
    // Each tile gives up half the gap on every side, so neighbors end up `gap` apart.
    const tile = gap <= 0 ? original : convex ? insetConvex(original, gap / 2) : insetPolygon(original, gap / 2);
    if (tile.length === 0) return [];
    const full = area(tile);

    let pieces: Shape[];
    let boundary: boolean;
    if (!simple) {
      const tb = bbox(tile);
      const pad = tol;
      const near: Polygon[] = [];
      edgeBoxes.forEach((e, i) => {
        if (e.x1 >= tb.x - pad && e.x0 <= tb.x + tb.width + pad && e.y1 >= tb.y - pad && e.y0 <= tb.y + tb.height + pad) {
          near.push([...edgesOf[i]!]);
        }
      });
      let cut: Shape[];
      if (near.length === 0) {
        // No region edge reaches the tile's box: it's wholly in or wholly out.
        cut = inShapes(tile[0]!, loops) ? [{ outer: tile, holes: [] }] : [];
      } else {
        cut = overlay([tile, ...near], (p) => pointInPolygon(p, tile) && inShapes(p, loops), scaleRef)
          .filter((q) => shapeArea(q) > minArea)
          .sort((a, b) => shapeArea(b) - shapeArea(a));
      }
      const visible = cut.reduce((sum, q) => sum + shapeArea(q), 0);
      boundary = visible < full - minArea;
      if (edges === "inside") {
        if (boundary || cut.length !== 1 || cut[0]!.holes.length > 0) return [];
        pieces = [{ outer: tile, holes: [] }];
      } else {
        if (visible <= minArea || visible < minFill * full) return [];
        pieces = edges === "overflow" ? [{ outer: tile, holes: [] }] : cut;
      }
    } else if (edges === "inside") {
      if (!containsPolygon(inner, tile, tol)) return [];
      pieces = [{ outer: tile, holes: [] }];
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
      if (visible <= minArea || visible < minFill * full) return [];
      boundary = visible < full - minArea;
      pieces = (edges === "overflow" ? [tile] : cut).map((outer) => ({ outer, holes: [] }));
    }

    if (edges === "window" && boundary) {
      // One cell for the whole tile: its largest visible piece, with the tile to draw.
      const shape = pieces[0]!;
      const withHoles = shape.holes.length > 0;
      return [{
        id,
        polygon: shape.outer,
        ...(withHoles ? { holes: shape.holes.map((h) => ensurePositive(h)) } : {}),
        original,
        tile,
        bbox: bbox(shape.outer),
        centroid: withHoles ? shapeCentroid(shape) : centroid(shape.outer),
        area: withHoles ? shapeArea(shape) : area(shape.outer),
        boundary,
        protoTile,
      }];
    }

    return pieces.map((shape, k) => {
      const withHoles = shape.holes.length > 0;
      return {
        // Extra parts of a tile split by the region edge get "~1", "~2", ….
        id: k === 0 ? id : `${id}~${k}`,
        polygon: shape.outer,
        ...(withHoles ? { holes: shape.holes.map((h) => ensurePositive(h)) } : {}),
        original,
        bbox: bbox(shape.outer),
        centroid: withHoles ? shapeCentroid(shape) : centroid(shape.outer),
        area: withHoles ? shapeArea(shape) : area(shape.outer),
        boundary,
        protoTile,
      };
    });
  };

  for (const t of raw) {
    const original = ensurePositive(t.polygon);
    if (!rectsOverlap(bbox(original), innerBox)) continue;
    drafts.push(...place(original, t.id, t.protoTile));
  }

  if (options.features?.length) {
    const merged = mergeFeatures(drafts, options.features, region, scaleRef, Math.max(tol * 10, 1e-9));
    for (const m of merged) {
      const keep = new Set(m.members);
      const pieces = place(m.polygon, `feature${m.feature}`, m.protoTile).map((d) => ({
        ...d,
        featured: m.feature,
        ...(options.features![m.feature]!.item !== undefined ? { featuredItem: options.features![m.feature]!.item } : {}),
        merged: m.members,
      }));
      // Drop the merged tiles (and any extra parts of them) and add the featured cell.
      for (let i = drafts.length - 1; i >= 0; i--) if (keep.has(drafts[i]!.id.split("~")[0]!)) drafts.splice(i, 1);
      drafts.push(...pieces);
    }
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
  const view = edges === "window" ? (simple ? [{ outer: inner, holes: [] }] : usable) : undefined;
  return { region, holes, bounds, cornerRadius, ...(view ? { view } : {}), cells };
}

type FeatureDraft = { id: string; original: Polygon; boundary: boolean; protoTile: number; area: number };

/**
 * Choose the tile groups for `features` among the laid-out tiles, and merge each group's
 * pattern tiles into one outline. Groups that would merge into something other than a
 * single outline without holes (a ring, say) are left unmerged.
 */
function mergeFeatures(
  drafts: FeatureDraft[],
  features: Feature[],
  region: Polygon,
  scale: number,
  tol: number,
): { feature: number; members: string[]; polygon: Polygon; protoTile: number }[] {
  // Whole tiles only (not the extra parts of a split one), with their pattern geometry.
  const tiles = drafts.filter((d) => !d.id.includes("~"));
  const index = new Map(tiles.map((t, i) => [t.id, i]));
  const adj = findNeighbors(tiles.map((t) => t.original), tiles.map(() => true), tol);
  const cx = tiles.map((t) => centroid(t.original));
  const ar = tiles.map((t) => area(t.original));
  // How much of each tile is left inside the region; one that keeps most of itself (trimmed
  // by the margin, say) counts as whole.
  const kept = tiles.map((t, i) => (t.boundary ? Math.min(1, t.area / (ar[i]! || 1)) : 1));
  const cut = kept.map((k) => k < 0.6);
  const taken = new Uint8Array(tiles.length);
  const middle = centroid(region);
  const out: { feature: number; members: string[]; polygon: Polygon; protoTile: number }[] = [];

  features.forEach((f, k) => {
    let group: number[];
    if (f.ids) {
      group = f.ids.map((id) => index.get(id)).filter((i): i is number => i !== undefined && !taken[i]);
    } else {
      const want = Math.max(1, Math.floor(f.tiles ?? 4));
      const at = f.at ?? middle;
      // Score: (mostly) uncut tiles first, then distance to `to`, then distance to `at` (which keeps
      // the group centerd on `at` when several tiles are equally compact); then the earlier tile.
      const eps = 1e-9 * scale * scale;
      const d2 = (i: number, p: Vec) => (cx[i]!.x - p.x) ** 2 + (cx[i]!.y - p.y) ** 2;
      const better = (i: number, j: number, to: Vec) => {
        if (cut[i] !== cut[j]) return !cut[i];
        const a = d2(i, to) - d2(j, to);
        if (Math.abs(a) > eps) return a < 0;
        const b = d2(i, at) - d2(j, at);
        if (Math.abs(b) > eps) return b < 0;
        return i < j;
      };
      // Grow a group from each of the free tiles nearest `at`, and keep the best: the most
      // tiles, then the lowest cost (spread out, off-center from `at`, or cut by the edge).
      // Growing from the nearest tile alone can make a strip where a block fits a step away.
      const free: number[] = [];
      for (let i = 0; i < tiles.length; i++) if (!taken[i]) free.push(i);
      if (!free.length) return;
      free.sort((i, j) => (better(i, j, at) ? -1 : better(j, i, at) ? 1 : 0));
      const grow = (seed: number) => {
        const g = [seed];
        const inGroup = new Set(g);
        while (g.length < want) {
          // The group's center (area-weighted), and the free neighbor nearest it.
          let sx = 0, sy = 0, sw = 0;
          for (const i of g) { sx += cx[i]!.x * ar[i]!; sy += cx[i]!.y * ar[i]!; sw += ar[i]!; }
          const c = vec(sx / sw, sy / sw);
          let pick = -1;
          for (const i of g) {
            for (const j of adj[i]!) if (!taken[j] && !inGroup.has(j) && (pick < 0 || better(j, pick, c))) pick = j;
          }
          if (pick < 0) break;
          g.push(pick);
          inGroup.add(pick);
        }
        return g;
      };
      const cost = (g: number[]) => {
        let sx = 0, sy = 0, sw = 0, lost = 0;
        for (const i of g) { sx += cx[i]!.x * ar[i]!; sy += cx[i]!.y * ar[i]!; sw += ar[i]!; if (cut[i]) lost += (1 - kept[i]!) * ar[i]!; }
        if (!(sw > 0)) return Infinity;
        const c = vec(sx / sw, sy / sw);
        // Spread: the tiles' moment of inertia about the group's center over its area squared
        // (a 2 x 2 square of squares scores 1/8, an L 7/32, a 4 x 1 strip 5/16).
        let inertia = 0;
        for (const i of g) inertia += ar[i]! * d2(i, c);
        const spread = inertia / (sw * sw);
        // Distance from `at`, relative to the group's size; and the share cut off by the edge.
        const off = ((c.x - at.x) ** 2 + (c.y - at.y) ** 2) / sw;
        return spread + 0.15 * off + 0.6 * (lost / sw);
      };
      group = [];
      let bestCost = Infinity;
      for (const seed of free.slice(0, Math.max(8, 2 * want))) {
        const g = grow(seed);
        const gc = cost(g);
        if (g.length > group.length || (g.length === group.length && gc < bestCost - 1e-9)) {
          group = g;
          bestCost = gc;
        }
      }
    }
    if (group.length === 0) return;
    for (const i of group) taken[i] = 1;
    const polys = group.map((i) => tiles[i]!.original);
    const union = group.length === 1 ? [{ outer: polys[0]!, holes: [] }] : overlay(polys, (p) => polys.some((q) => pointInPolygon(p, q)), scale);
    if (union.length !== 1 || union[0]!.holes.length > 0) {
      for (const i of group) taken[i] = 0;
      return;
    }
    out.push({ feature: k, members: group.map((i) => tiles[i]!.id), polygon: union[0]!.outer, protoTile: tiles[group[0]!]!.protoTile });
  });
  return out;
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
  // Parts of one tile get the same neighbors as the tile, and are their neighbors too.
  const ownNeighbors = result.map((list) => [...list]);
  polys.forEach((p, i) => {
    const owner = owners.get(p)!;
    if (owner === i) return;
    result[i] = [...ownNeighbors[owner]!];
    for (const j of ownNeighbors[owner]!) result[j]!.push(i);
  });
  for (const list of result) list.sort((a, b) => a - b);
  return result;
}

/**
 * Greedy graph coloring over cell adjacency: neighboring cells get different
 * color indices. Handy for placeholder fills. Returns one index per cell (by cell.index).
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
    // Rotate the starting color so large single-color runs are avoided.
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
