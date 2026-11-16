import { bbox, rectPolygon, transform, vec, type Polygon, type Rect, type Vec } from "./geometry";
import { mulberry32 } from "./random";

/*
 * Tiling specs are plain, JSON-serialisable objects so a layout can be saved,
 * shared and used as a memo key. The helper functions below just add `type`.
 */

export interface GridSpec {
  type: "grid";
  /** Cell width. */
  width: number;
  /** Cell height. Defaults to `width` (squares). */
  height?: number;
}

export interface RunningBondSpec {
  type: "runningBond";
  width: number;
  height: number;
  /** Fraction of a brick each row is shifted by. Defaults to 0.5. */
  offset?: number;
}

export interface HerringboneSpec {
  type: "herringbone";
  /** Long side of each rectangle. Must be greater than `width`. */
  length: number;
  /** Short side of each rectangle. */
  width: number;
}

export interface BasketweaveSpec {
  type: "basketweave";
  /** Side of each square block (= length of each strip). */
  length: number;
  /** Strips per block. Defaults to 2. */
  strips?: number;
}

export interface HexagonalSpec {
  type: "hexagonal";
  /** Circumradius: centre-to-corner distance. */
  size: number;
  /** "pointy" puts a corner at the top; "flat" puts an edge at the top. Defaults to "pointy". */
  orientation?: "pointy" | "flat";
}

export interface MondrianSpec {
  type: "mondrian";
  /** No side is cut shorter than this. */
  minSize: number;
  /** Cells larger than this along either side are always split further (when possible). */
  maxSize: number;
  /** Chance (0–1) of splitting a cell that already fits within `maxSize`. Defaults to 0.4. */
  splitChance?: number;
  /** Seed for the deterministic random generator. Defaults to 1. */
  seed?: number;
  /** Snap split positions to multiples of this value (relative to each cell). */
  snap?: number;
}

export type TilingSpec =
  | GridSpec
  | RunningBondSpec
  | HerringboneSpec
  | BasketweaveSpec
  | HexagonalSpec
  | MondrianSpec;

export type TilingType = TilingSpec["type"];

export const grid = (p: Omit<GridSpec, "type">): GridSpec => ({ type: "grid", ...p });
export const runningBond = (p: Omit<RunningBondSpec, "type">): RunningBondSpec => ({ type: "runningBond", ...p });
export const herringbone = (p: Omit<HerringboneSpec, "type">): HerringboneSpec => ({ type: "herringbone", ...p });
export const basketweave = (p: Omit<BasketweaveSpec, "type">): BasketweaveSpec => ({ type: "basketweave", ...p });
export const hexagonal = (p: Omit<HexagonalSpec, "type">): HexagonalSpec => ({ type: "hexagonal", ...p });
export const mondrian = (p: Omit<MondrianSpec, "type">): MondrianSpec => ({ type: "mondrian", ...p });

/** A tile as produced by a generator, before gap/clipping is applied. */
export interface RawTile {
  /** Stable identifier, unique within one generated layout. */
  id: string;
  polygon: Polygon;
  /** Index of the prototile this tile is a copy of (e.g. herringbone: 0 = horizontal, 1 = vertical). */
  protoTile: number;
}

export interface GenerateContext {
  /** Area that must be covered. */
  region: Polygon;
  /** Pattern rotation in degrees. */
  rotation: number;
  /** Where the pattern's local origin sits. */
  origin: Vec;
  /** Safety cap on the number of tiles generated. */
  maxTiles: number;
}

/**
 * A periodic tiling: a motif of prototiles repeated at every point
 * i·a + j·b of a lattice.
 */
export interface PeriodicDefinition {
  a: Vec;
  b: Vec;
  motif: { polygon: Polygon; protoTile: number }[];
}

function positive(name: string, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number (got ${value})`);
  }
  return value;
}

export function periodicDefinition(spec: Exclude<TilingSpec, MondrianSpec>): PeriodicDefinition {
  switch (spec.type) {
    case "grid": {
      const w = positive("grid.width", spec.width);
      const h = positive("grid.height", spec.height ?? spec.width);
      return { a: vec(w, 0), b: vec(0, h), motif: [{ polygon: rectPolygon(0, 0, w, h), protoTile: 0 }] };
    }
    case "runningBond": {
      const w = positive("runningBond.width", spec.width);
      const h = positive("runningBond.height", spec.height);
      const offset = spec.offset ?? 0.5;
      return {
        a: vec(w, 0),
        b: vec(offset * w, h),
        motif: [{ polygon: rectPolygon(0, 0, w, h), protoTile: 0 }],
      };
    }
    case "herringbone": {
      const L = positive("herringbone.length", spec.length);
      const W = positive("herringbone.width", spec.width);
      if (L <= W) throw new RangeError("herringbone.length must be greater than herringbone.width");
      // A horizontal brick whose right end butts against the side of a vertical brick,
      // repeated along the (W, W) staircase and the (L, -L) diagonal.
      return {
        a: vec(W, W),
        b: vec(L, -L),
        motif: [
          { polygon: rectPolygon(0, 0, L, W), protoTile: 0 },
          { polygon: rectPolygon(L, W - L, W, L), protoTile: 1 },
        ],
      };
    }
    case "basketweave": {
      const L = positive("basketweave.length", spec.length);
      const n = Math.round(positive("basketweave.strips", spec.strips ?? 2));
      const t = L / n;
      const motif: PeriodicDefinition["motif"] = [];
      for (let k = 0; k < n; k++) motif.push({ polygon: rectPolygon(0, k * t, L, t), protoTile: 0 });
      for (let k = 0; k < n; k++) motif.push({ polygon: rectPolygon(L + k * t, 0, t, L), protoTile: 1 });
      // Checkerboard of horizontal/vertical blocks.
      return { a: vec(2 * L, 0), b: vec(L, L), motif };
    }
    case "hexagonal": {
      const s = positive("hexagonal.size", spec.size);
      const flat = spec.orientation === "flat";
      const start = flat ? 0 : 30;
      const hex: Polygon = [];
      for (let k = 0; k < 6; k++) {
        const ang = ((start + 60 * k) * Math.PI) / 180;
        hex.push(vec(s * Math.cos(ang), s * Math.sin(ang)));
      }
      const r3 = Math.sqrt(3);
      return flat
        ? { a: vec(1.5 * s, (r3 / 2) * s), b: vec(0, r3 * s), motif: [{ polygon: hex, protoTile: 0 }] }
        : { a: vec(r3 * s, 0), b: vec((r3 / 2) * s, 1.5 * s), motif: [{ polygon: hex, protoTile: 0 }] };
    }
  }
}

/** Enumerate every lattice copy of the motif that can touch `ctx.region`. */
export function generatePeriodic(def: PeriodicDefinition, ctx: GenerateContext): RawTile[] {
  const { a, b, motif } = def;
  const det = cross2(a, b);
  if (Math.abs(det) < 1e-12) throw new RangeError("Degenerate lattice");
  const theta = (ctx.rotation * Math.PI) / 180;

  // Lattice coordinates (i, j) of a point in the pattern's local frame.
  const toLattice = (q: Vec) => ({ i: (q.x * b.y - q.y * b.x) / det, j: (a.x * q.y - a.y * q.x) / det });

  // The region, mapped into the pattern's local (unrotated, unshifted) frame.
  const local = transform(
    ctx.region.map((v) => vec(v.x - ctx.origin.x, v.y - ctx.origin.y)),
    -theta,
    vec(0, 0),
  );
  const range = (pts: Vec[]) => {
    let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
    for (const p of pts) {
      const { i, j } = toLattice(p);
      i0 = Math.min(i0, i); i1 = Math.max(i1, i);
      j0 = Math.min(j0, j); j1 = Math.max(j1, j);
    }
    return { i0, i1, j0, j1 };
  };
  const reg = range(local);
  const mot = range(motif.flatMap((m) => m.polygon));

  const iMin = Math.floor(reg.i0 - mot.i1) - 1;
  const iMax = Math.ceil(reg.i1 - mot.i0) + 1;
  const jMin = Math.floor(reg.j0 - mot.j1) - 1;
  const jMax = Math.ceil(reg.j1 - mot.j0) + 1;

  const count = (iMax - iMin + 1) * (jMax - jMin + 1) * motif.length;
  if (count > ctx.maxTiles) {
    throw new RangeError(
      `Tiles are too small for this region (~${count} candidate tiles, limit ${ctx.maxTiles}). ` +
        "Increase the tile size or raise maxTiles.",
    );
  }

  const tiles: RawTile[] = [];
  const regionBox = bbox(local);
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const off = vec(i * a.x + j * b.x, i * a.y + j * b.y);
      motif.forEach((m, k) => {
        const placed = m.polygon.map((v) => vec(v.x + off.x, v.y + off.y));
        if (!overlapsBox(placed, regionBox)) return;
        tiles.push({ id: `${i},${j}:${k}`, polygon: transform(placed, theta, ctx.origin), protoTile: m.protoTile });
      });
    }
  }
  return tiles;
}

function cross2(a: Vec, b: Vec) {
  return a.x * b.y - a.y * b.x;
}

function overlapsBox(p: Polygon, r: Rect): boolean {
  const pb = bbox(p);
  return pb.x <= r.x + r.width && r.x <= pb.x + pb.width && pb.y <= r.y + r.height && r.y <= pb.y + pb.height;
}

/**
 * Random recursive guillotine partition of the region's bounding box.
 * Rotation and origin are ignored: Mondrian layouts are always axis-aligned to the region.
 */
export function generateMondrian(spec: MondrianSpec, ctx: GenerateContext): RawTile[] {
  const min = positive("mondrian.minSize", spec.minSize);
  const max = positive("mondrian.maxSize", spec.maxSize);
  const splitChance = spec.splitChance ?? 0.4;
  const snap = spec.snap && spec.snap > 0 ? spec.snap : 0;
  const rng = mulberry32(spec.seed ?? 1);
  const tiles: RawTile[] = [];

  const pickCut = (size: number): number | null => {
    const lo = min;
    const hi = size - min;
    if (hi < lo) return null;
    let cut = lo + rng() * (hi - lo);
    if (snap) {
      const sLo = Math.ceil(lo / snap) * snap;
      const sHi = Math.floor(hi / snap) * snap;
      if (sHi >= sLo) cut = Math.min(sHi, Math.max(sLo, Math.round(cut / snap) * snap));
    }
    return cut;
  };

  const split = (r: Rect, path: string) => {
    if (tiles.length >= ctx.maxTiles) {
      throw new RangeError(`Too many Mondrian cells (limit ${ctx.maxTiles}). Increase minSize or maxSize.`);
    }
    const canX = r.width >= 2 * min;
    const canY = r.height >= 2 * min;
    const fits = r.width <= max && r.height <= max;
    if ((!canX && !canY) || (fits && rng() >= splitChance)) {
      tiles.push({ id: `m${path}`, polygon: rectPolygon(r.x, r.y, r.width, r.height), protoTile: 0 });
      return;
    }
    // Prefer cutting across the longer side (and always cut an oversize side if possible).
    let vertical: boolean;
    if (canX && canY) {
      if (r.width > max && r.height <= max) vertical = true;
      else if (r.height > max && r.width <= max) vertical = false;
      else vertical = rng() < r.width / (r.width + r.height);
    } else {
      vertical = canX;
    }
    const cut = pickCut(vertical ? r.width : r.height)!;
    if (vertical) {
      split({ x: r.x, y: r.y, width: cut, height: r.height }, path + "0");
      split({ x: r.x + cut, y: r.y, width: r.width - cut, height: r.height }, path + "1");
    } else {
      split({ x: r.x, y: r.y, width: r.width, height: cut }, path + "0");
      split({ x: r.x, y: r.y + cut, width: r.width, height: r.height - cut }, path + "1");
    }
  };

  split(bbox(ctx.region), "");
  return tiles;
}

export function generateTiles(spec: TilingSpec, ctx: GenerateContext): RawTile[] {
  if (spec.type === "mondrian") return generateMondrian(spec, ctx);
  return generatePeriodic(periodicDefinition(spec), ctx);
}
