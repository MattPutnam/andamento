import { bbox, rectPolygon, transform, vec, type Polygon, type Rect, type Vec } from "./geometry";
import { mulberry32 } from "./random";
import { generateAshlar, generateDelaunay, generateVoronoi } from "./procedural";
import { generateSubstitution, penroseRhombs } from "./substitution";

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

export interface TriangularSpec {
  type: "triangular";
  /** Side length of each equilateral triangle. */
  size: number;
}

export interface RhombilleSpec {
  type: "rhombille";
  /** Side length of each rhombus. Three rhombi form a hexagon ("tumbling blocks"). */
  size: number;
}

export interface OctagonSquareSpec {
  type: "octagonSquare";
  /** Edge length shared by the octagons and the small squares. */
  size: number;
}

export interface TrihexagonalSpec {
  type: "trihexagonal";
  /** Edge length shared by the hexagons and triangles. */
  size: number;
}

export interface RhombitrihexagonalSpec {
  type: "rhombitrihexagonal";
  /** Edge length shared by the hexagons, squares and triangles. */
  size: number;
}

export interface CairoSpec {
  type: "cairo";
  /** Spacing of the underlying square grid; each pentagon is roughly this wide. */
  size: number;
}

export interface HopscotchSpec {
  type: "hopscotch";
  /** Side of the large squares. */
  large: number;
  /** Side of the small squares. Must not exceed `large`. */
  small: number;
}

export interface PinwheelSpec {
  type: "pinwheel";
  /** Long side of each rectangle. Must be greater than `width`. */
  length: number;
  /** Short side of each rectangle. The centre squares have side `length - width`. */
  width: number;
}

export interface FlemishBondSpec {
  type: "flemishBond";
  /** Length of the long bricks (stretchers). */
  length: number;
  /** Course height. */
  height: number;
  /** Length of the short bricks (headers). Defaults to `length / 2`. */
  header?: number;
}

export interface ChevronSpec {
  type: "chevron";
  /** Long side of each plank. */
  length: number;
  /** Plank width, measured across the plank. */
  width: number;
  /** Plank slope in degrees from horizontal, between 0 and 90 (exclusive). Defaults to 45. */
  angle?: number;
}

export interface VoronoiSpec {
  type: "voronoi";
  /** Typical cell width: about one cell per size × size area. */
  size: number;
  /** Rounds of Lloyd relaxation; more rounds give more even, rounder cells. Defaults to 2. */
  relax?: number;
  /** Seed for the deterministic random generator. Defaults to 1. */
  seed?: number;
}

export interface DelaunaySpec {
  type: "delaunay";
  /** Typical spacing of the triangle corners. */
  size: number;
  /** Rounds of Lloyd relaxation on the corners; more rounds give more even triangles. Defaults to 2. */
  relax?: number;
  /** Seed for the deterministic random generator. Defaults to 1. */
  seed?: number;
}

export interface AshlarSpec {
  type: "ashlar";
  /** Typical course (row) height. */
  height: number;
  /** Shortest stone. */
  minLength: number;
  /** Longest stone. */
  maxLength: number;
  /** How much course heights vary, 0–0.9, as a fraction of `height`. Defaults to 0. */
  heightVariation?: number;
  /** Seed for the deterministic random generator. Defaults to 1. */
  seed?: number;
}

export interface PenroseSpec {
  type: "penrose";
  /** Edge length of the rhombs. */
  size: number;
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
  | TriangularSpec
  | RhombilleSpec
  | OctagonSquareSpec
  | TrihexagonalSpec
  | RhombitrihexagonalSpec
  | CairoSpec
  | HopscotchSpec
  | PinwheelSpec
  | FlemishBondSpec
  | ChevronSpec
  | VoronoiSpec
  | DelaunaySpec
  | AshlarSpec
  | PenroseSpec
  | MondrianSpec;

export type TilingType = TilingSpec["type"];

export const grid = (p: Omit<GridSpec, "type">): GridSpec => ({ type: "grid", ...p });
export const runningBond = (p: Omit<RunningBondSpec, "type">): RunningBondSpec => ({ type: "runningBond", ...p });
export const herringbone = (p: Omit<HerringboneSpec, "type">): HerringboneSpec => ({ type: "herringbone", ...p });
export const basketweave = (p: Omit<BasketweaveSpec, "type">): BasketweaveSpec => ({ type: "basketweave", ...p });
export const hexagonal = (p: Omit<HexagonalSpec, "type">): HexagonalSpec => ({ type: "hexagonal", ...p });
export const triangular = (p: Omit<TriangularSpec, "type">): TriangularSpec => ({ type: "triangular", ...p });
export const rhombille = (p: Omit<RhombilleSpec, "type">): RhombilleSpec => ({ type: "rhombille", ...p });
export const octagonSquare = (p: Omit<OctagonSquareSpec, "type">): OctagonSquareSpec => ({ type: "octagonSquare", ...p });
export const trihexagonal = (p: Omit<TrihexagonalSpec, "type">): TrihexagonalSpec => ({ type: "trihexagonal", ...p });
export const rhombitrihexagonal = (p: Omit<RhombitrihexagonalSpec, "type">): RhombitrihexagonalSpec => ({
  type: "rhombitrihexagonal",
  ...p,
});
export const cairo = (p: Omit<CairoSpec, "type">): CairoSpec => ({ type: "cairo", ...p });
export const hopscotch = (p: Omit<HopscotchSpec, "type">): HopscotchSpec => ({ type: "hopscotch", ...p });
export const pinwheel = (p: Omit<PinwheelSpec, "type">): PinwheelSpec => ({ type: "pinwheel", ...p });
export const flemishBond = (p: Omit<FlemishBondSpec, "type">): FlemishBondSpec => ({ type: "flemishBond", ...p });
export const chevron = (p: Omit<ChevronSpec, "type">): ChevronSpec => ({ type: "chevron", ...p });
export const voronoi = (p: Omit<VoronoiSpec, "type">): VoronoiSpec => ({ type: "voronoi", ...p });
export const delaunay = (p: Omit<DelaunaySpec, "type">): DelaunaySpec => ({ type: "delaunay", ...p });
export const ashlar = (p: Omit<AshlarSpec, "type">): AshlarSpec => ({ type: "ashlar", ...p });
export const penrose = (p: Omit<PenroseSpec, "type">): PenroseSpec => ({ type: "penrose", ...p });
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

const deg = (d: number) => (d * Math.PI) / 180;
const polar = (r: number, degrees: number): Vec => vec(r * Math.cos(deg(degrees)), r * Math.sin(deg(degrees)));

/** Regular polygon with `n` corners at circumradius `r` around the origin, first corner at `startDeg`. */
function regular(n: number, r: number, startDeg: number): Polygon {
  return Array.from({ length: n }, (_, k) => polar(r, startDeg + (360 / n) * k));
}

/** Cairo bar half-length (as a fraction of the grid size) that makes all pentagon sides equal. */
const CAIRO_BAR = (Math.sqrt(7) - 1) / 6;

/** Tilings generated procedurally (seeded) rather than from a repeating motif. */
export type ProceduralSpec = MondrianSpec | VoronoiSpec | DelaunaySpec | AshlarSpec;

export function periodicDefinition(spec: Exclude<TilingSpec, ProceduralSpec | PenroseSpec>): PeriodicDefinition {
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
    case "triangular": {
      const s = positive("triangular.size", spec.size);
      const h = (Math.sqrt(3) / 2) * s;
      // A strip of alternating up/down triangles, repeated with a half-triangle shift per row.
      return {
        a: vec(s, 0),
        b: vec(s / 2, h),
        motif: [
          { polygon: [vec(0, h), vec(s / 2, 0), vec(s, h)], protoTile: 0 },
          { polygon: [vec(s / 2, 0), vec((3 * s) / 2, 0), vec(s, h)], protoTile: 1 },
        ],
      };
    }
    case "rhombille": {
      const s = positive("rhombille.size", spec.size);
      const r3 = Math.sqrt(3);
      // A pointy hexagon split into three rhombi from its centre: top, right and left faces of a cube.
      const v = regular(6, s, 30);
      const face = (k: number): Polygon => [vec(0, 0), v[k % 6]!, v[(k + 1) % 6]!, v[(k + 2) % 6]!];
      return {
        a: vec(r3 * s, 0),
        b: vec((r3 / 2) * s, 1.5 * s),
        motif: [
          { polygon: face(3), protoTile: 0 },
          { polygon: face(5), protoTile: 1 },
          { polygon: face(1), protoTile: 2 },
        ],
      };
    }
    case "octagonSquare": {
      const s = positive("octagonSquare.size", spec.size);
      const c = s / Math.SQRT2;
      const w = s + 2 * c;
      const octagon = [vec(c, 0), vec(w - c, 0), vec(w, c), vec(w, w - c), vec(w - c, w), vec(c, w), vec(0, w - c), vec(0, c)];
      const diamond = [vec(c, 0), vec(0, c), vec(-c, 0), vec(0, -c)];
      return {
        a: vec(w, 0),
        b: vec(0, w),
        motif: [
          { polygon: octagon, protoTile: 0 },
          { polygon: diamond, protoTile: 1 },
        ],
      };
    }
    case "trihexagonal": {
      const s = positive("trihexagonal.size", spec.size);
      const h = (Math.sqrt(3) / 2) * s;
      // Flat hexagons touching corner to corner, with triangles in the gaps.
      return {
        a: vec(2 * s, 0),
        b: vec(s, 2 * h),
        motif: [
          { polygon: regular(6, s, 0), protoTile: 0 },
          { polygon: [vec(s, 0), vec(1.5 * s, h), vec(0.5 * s, h)], protoTile: 1 },
          { polygon: [vec(s, 0), vec(0.5 * s, -h), vec(1.5 * s, -h)], protoTile: 2 },
        ],
      };
    }
    case "rhombitrihexagonal": {
      const s = positive("rhombitrihexagonal.size", spec.size);
      const d = s * (1 + Math.sqrt(3));
      // Pointy hexagon; a square on each edge facing a neighbour (0°, 60°, 120°) and a
      // triangle in each corner between two of those squares (30°, 90°).
      const square = (dir: number): Polygon => {
        const p = polar(s, dir - 30);
        const q = polar(s, dir + 30);
        const n = polar(s, dir);
        return [p, q, vec(q.x + n.x, q.y + n.y), vec(p.x + n.x, p.y + n.y)];
      };
      const triangle = (corner: number): Polygon => {
        const v = polar(s, corner);
        const n1 = polar(s, corner - 30);
        const n2 = polar(s, corner + 30);
        return [v, vec(v.x + n1.x, v.y + n1.y), vec(v.x + n2.x, v.y + n2.y)];
      };
      return {
        a: vec(d, 0),
        b: vec(d / 2, (Math.sqrt(3) / 2) * d),
        motif: [
          { polygon: regular(6, s, 30), protoTile: 0 },
          { polygon: square(0), protoTile: 1 },
          { polygon: square(60), protoTile: 1 },
          { polygon: square(120), protoTile: 1 },
          { polygon: triangle(30), protoTile: 2 },
          { polygon: triangle(90), protoTile: 2 },
        ],
      };
    }
    case "cairo": {
      const L = positive("cairo.size", spec.size);
      const h = L / 2;
      const u = CAIRO_BAR * L;
      // Checkerboard of squares holding alternately a horizontal and a vertical bar; each
      // bar end is joined to the two nearest corners. Every grid edge then separates two
      // pieces that merge into one pentagon. Listed here: the four around a horizontal-bar square.
      return {
        a: vec(L, L),
        b: vec(L, -L),
        motif: [
          { polygon: [vec(0, 0), vec(h, -h + u), vec(L, 0), vec(h + u, h), vec(h - u, h)], protoTile: 0 },
          { polygon: [vec(L, 0), vec(L + h, h - u), vec(L + h, h + u), vec(L, L), vec(h + u, h)], protoTile: 1 },
          { polygon: [vec(0, L), vec(h - u, h), vec(h + u, h), vec(L, L), vec(h, L + h - u)], protoTile: 0 },
          { polygon: [vec(0, 0), vec(h - u, h), vec(0, L), vec(-h, h + u), vec(-h, h - u)], protoTile: 1 },
        ],
      };
    }
    case "hopscotch": {
      const A = positive("hopscotch.large", spec.large);
      const B = positive("hopscotch.small", spec.small);
      if (B > A) throw new RangeError("hopscotch.small must not exceed hopscotch.large");
      // Pythagorean tiling: each large square is stepped down by the small square's side.
      return {
        a: vec(A, B),
        b: vec(-B, A),
        motif: [
          { polygon: rectPolygon(0, 0, A, A), protoTile: 0 },
          { polygon: rectPolygon(A - B, A, B, B), protoTile: 1 },
        ],
      };
    }
    case "pinwheel": {
      const L = positive("pinwheel.length", spec.length);
      const W = positive("pinwheel.width", spec.width);
      if (L <= W) throw new RangeError("pinwheel.length must be greater than pinwheel.width");
      // Four rectangles turning around a small square; neighbouring pinwheels share rectangles.
      return {
        a: vec(L, -W),
        b: vec(W, L),
        motif: [
          { polygon: rectPolygon(0, 0, L, W), protoTile: 0 },
          { polygon: rectPolygon(L, 0, W, L), protoTile: 1 },
          { polygon: rectPolygon(W, W, L - W, L - W), protoTile: 2 },
        ],
      };
    }
    case "flemishBond": {
      const L = positive("flemishBond.length", spec.length);
      const H = positive("flemishBond.height", spec.height);
      const D = positive("flemishBond.header", spec.header ?? L / 2);
      // Each course alternates stretcher and header; the next course is shifted so its
      // headers sit centred over the stretchers below.
      return {
        a: vec(L + D, 0),
        b: vec((L + D) / 2, H),
        motif: [
          { polygon: rectPolygon(0, 0, L, H), protoTile: 0 },
          { polygon: rectPolygon(L, 0, D, H), protoTile: 1 },
        ],
      };
    }
    case "chevron": {
      const len = positive("chevron.length", spec.length);
      const w = positive("chevron.width", spec.width);
      const angle = spec.angle ?? 45;
      if (!(angle > 0 && angle < 90)) throw new RangeError("chevron.angle must be between 0 and 90 degrees");
      const t = deg(angle);
      const c = len * Math.cos(t); // column width
      const rise = c * Math.tan(t);
      const step = w / Math.cos(t); // vertical spacing of planks within a column
      // Two columns of parallelograms with vertical ends, sloping up then down: ^ shapes.
      return {
        a: vec(2 * c, 0),
        b: vec(0, step),
        motif: [
          { polygon: [vec(0, 0), vec(c, -rise), vec(c, -rise + step), vec(0, step)], protoTile: 0 },
          { polygon: [vec(c, -rise), vec(2 * c, 0), vec(2 * c, step), vec(c, -rise + step)], protoTile: 1 },
        ],
      };
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
  switch (spec.type) {
    case "mondrian":
      return generateMondrian(spec, ctx);
    case "voronoi":
      return generateVoronoi(spec, ctx);
    case "delaunay":
      return generateDelaunay(spec, ctx);
    case "ashlar":
      return generateAshlar(spec, ctx);
    case "penrose":
      return generateSubstitution(penroseRhombs, positive("penrose.size", spec.size), ctx, "Penrose", "p");
  }
  return generatePeriodic(periodicDefinition(spec), ctx);
}
