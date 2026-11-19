import { bbox, transform, vec, type Polygon, type Rect, type Vec } from "./geometry";
import type { GenerateContext, RawTile } from "./tilings";

/*
 * Substitution (subdivision) tilings: start from a patch of large pieces centerd on
 * the origin, then repeatedly replace every piece with smaller pieces according to
 * fixed rules. Penrose, Ammann–Beenker and Conway–Radin pinwheel tilings are built this
 * way (the last is unrelated to the repeating `pinwheel` pattern).
 */

/** A piece in a substitution system. `path` records how it was derived, which makes a stable id. */
export interface Piece {
  kind: number;
  points: Vec[];
  path: string;
}

export interface SubstitutionRule {
  /** Pieces at scale 1, centerd on the origin. */
  seed: Omit<Piece, "path">[];
  /** Radius of a disc around the origin that the seed patch fully covers, at scale 1. */
  coverRadius: number;
  /** Edge length of the final tiles at scale 1, before any subdivision. */
  edge: number;
  /** Each subdivision shrinks pieces by this factor. */
  factor: number;
  /**
   * The seed patch reproduces itself (scaled) every `period` subdivisions. Step counts
   * are rounded up to a multiple of it, so a larger region shows more of the same
   * pattern instead of a different one. Defaults to 1.
   */
  period?: number;
  /** Children of one piece, in the same coordinate frame. */
  subdivide(piece: Piece): Omit<Piece, "path">[];
  /** Turn the final pieces into tiles (e.g. join half-tiles into whole ones). */
  assemble(pieces: Piece[], tolerance: number): RawTile[];
}

/**
 * Subdivide `rule`'s seed until the final tiles have edge `size`, keeping only pieces
 * near the region, and assemble them. `ctx.origin` places the center of the seed patch;
 * `ctx.rotation` turns the whole pattern.
 */
export function generateSubstitution(
  rule: SubstitutionRule,
  size: number,
  ctx: GenerateContext,
  label: string,
  idPrefix = "s",
): RawTile[] {
  const theta = (ctx.rotation * Math.PI) / 180;
  // Work in the pattern's own frame: origin at the patch center, unrotated.
  const local = transform(
    ctx.region.map((v) => vec(v.x - ctx.origin.x, v.y - ctx.origin.y)),
    -theta,
    vec(0, 0),
  );
  const box = bbox(local);
  let reach = 0;
  for (const v of local) reach = Math.max(reach, Math.hypot(v.x, v.y));

  // Fewest subdivisions whose (scaled) seed patch covers the region with room to spare,
  // so that pieces cut off by the patch outline never reach the region.
  let steps = 0;
  const scaleFor = (n: number) => (size * rule.factor ** n) / rule.edge;
  const period = rule.period ?? 1;
  while (scaleFor(steps) * rule.coverRadius < reach + 4 * size || steps % period !== 0) steps++;
  const scale = scaleFor(steps);

  let pieces: Piece[] = rule.seed.map((p, i) => ({ kind: p.kind, points: p.points.map((v) => vec(v.x * scale, v.y * scale)), path: `${i}` }));
  for (let step = 1; step <= steps; step++) {
    // Pieces at this level have edges of about `edge`; anything further than a few edges
    // from the region can't contribute (children stay inside their parent).
    const edge = size * rule.factor ** (steps - step);
    const near = grow(box, 3 * edge);
    const next: Piece[] = [];
    for (const p of pieces) {
      rule.subdivide(p).forEach((c, k) => {
        if (overlaps(bbox(c.points), near)) next.push({ ...c, path: `${p.path}.${k}` });
      });
    }
    if (next.length > ctx.maxTiles * 4) {
      throw new RangeError(
        `Tiles are too small for this region (~${Math.round(next.length / 2)} ${label} tiles, limit ${ctx.maxTiles}). ` +
          "Increase the size or raise maxTiles.",
      );
    }
    pieces = next;
  }

  // Ids come from each tile's position in the pattern (in units of `size`), so they don't
  // depend on how many subdivisions a particular region needed.
  return rule.assemble(pieces, size * 1e-6).map((t) => {
    let cx = 0;
    let cy = 0;
    for (const v of t.polygon) {
      cx += v.x;
      cy += v.y;
    }
    const k = 100 / (size * t.polygon.length);
    return {
      id: `${idPrefix}${Math.round(cx * k)},${Math.round(cy * k)}`,
      protoTile: t.protoTile,
      polygon: transform(t.polygon, theta, ctx.origin),
    };
  });
}

const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, width: r.width + 2 * d, height: r.height + 2 * d });
const overlaps = (a: Rect, b: Rect) => a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** Key for an undirected edge, robust to tiny floating-point differences. */
export function edgeKey(a: Vec, b: Vec, tolerance: number): string {
  const q = (v: Vec) => `${Math.round(v.x / tolerance)},${Math.round(v.y / tolerance)}`;
  const ka = q(a);
  const kb = q(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const lerp = (a: Vec, b: Vec, t: number): Vec => vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

/**
 * Penrose P3 (thick and thin rhombs) via Robinson triangles. Each triangle is
 * (apex A, base B–C); two mirror-image triangles sharing a base form one rhomb.
 * Kind 0: 36° apex (half a thin rhomb). Kind 1: 108° apex (half a thick rhomb).
 */
export const penroseRhombs: SubstitutionRule = {
  // A "sun" of ten thin-rhomb halves around the origin, legs of length 1.
  seed: Array.from({ length: 10 }, (_, i) => {
    let b = vec(Math.cos(((2 * i - 1) * Math.PI) / 10), Math.sin(((2 * i - 1) * Math.PI) / 10));
    let c = vec(Math.cos(((2 * i + 1) * Math.PI) / 10), Math.sin(((2 * i + 1) * Math.PI) / 10));
    // Mirror every other triangle so neighbors pair up into rhombs.
    if (i % 2 === 0) [b, c] = [c, b];
    return { kind: 0, points: [vec(0, 0), b, c] };
  }),
  coverRadius: Math.cos(Math.PI / 10), // the decagon's inner radius
  edge: 1,
  factor: PHI,
  period: 4,
  subdivide({ kind, points: [a, b, c] }) {
    if (kind === 0) {
      const p = lerp(a!, b!, 1 / PHI);
      return [
        { kind: 0, points: [c!, p, b!] },
        { kind: 1, points: [p, c!, a!] },
      ];
    }
    const q = lerp(b!, a!, 1 / PHI);
    const r = lerp(b!, c!, 1 / PHI);
    return [
      { kind: 1, points: [r, c!, a!] },
      { kind: 1, points: [q, r, b!] },
      { kind: 0, points: [r, q, a!] },
    ];
  },
  assemble(pieces, tolerance) {
    const byBase = new Map<string, Piece[]>();
    for (const p of pieces) {
      const key = `${p.kind}:${edgeKey(p.points[1]!, p.points[2]!, tolerance)}`;
      const list = byBase.get(key);
      if (list) list.push(p);
      else byBase.set(key, [p]);
    }
    const tiles: RawTile[] = [];
    for (const pair of byBase.values()) {
      // Halves without a partner lie on the outline of the generated patch, outside the region.
      if (pair.length !== 2) continue;
      const [p, q] = pair[0]!.path < pair[1]!.path ? [pair[0]!, pair[1]!] : [pair[1]!, pair[0]!];
      const [a, b, c] = p.points;
      const polygon: Polygon = [a!, b!, q.points[0]!, c!];
      tiles.push({ id: p.path, polygon, protoTile: p.kind === 1 ? 0 : 1 });
    }
    return tiles;
  },
};

/** Join mirror-image half-tiles that share their axis (points[0]–points[1]) into whole tiles. */
function joinAlongAxis(pieces: Piece[], tolerance: number, protoTile: (kind: number) => number): RawTile[] {
  const byAxis = new Map<string, Piece[]>();
  for (const p of pieces) {
    // Directed: mirror twins share the same tip *and* the same axis end. Two halves that
    // merely touch along the same segment the other way round are not a pair.
    const q = (v: Vec) => `${Math.round(v.x / tolerance)},${Math.round(v.y / tolerance)}`;
    const key = `${p.kind}:${q(p.points[0]!)}>${q(p.points[1]!)}`;
    const list = byAxis.get(key);
    if (list) list.push(p);
    else byAxis.set(key, [p]);
  }
  const tiles: RawTile[] = [];
  for (const pair of byAxis.values()) {
    if (pair.length !== 2) continue; // half-tiles on the patch outline, outside the region
    const [p, q] = pair[0]!.path < pair[1]!.path ? [pair[0]!, pair[1]!] : [pair[1]!, pair[0]!];
    const [tip, axis, side] = p.points;
    tiles.push({ id: p.path, polygon: [tip!, side!, axis!, q.points[2]!], protoTile: protoTile(p.kind) });
  }
  return tiles;
}

/**
 * Penrose P2 (kites and darts) via half-tiles. Points are [tip, axis end, side corner]:
 * - kind 0, half-kite: 36° at the tip, legs tip–axis and tip–side of length φ (long sides).
 * - kind 1, half-dart: 36° at the tip and side, 108° at the axis end (the dart's reflex corner).
 * Mirror-image halves sharing the axis form one kite (convex) or dart (non-convex).
 */
export const penroseKitesAndDarts: SubstitutionRule = {
  // A "sun" of five kites meeting at their tips.
  seed: Array.from({ length: 10 }, (_, i) => {
    const axis = Math.floor(i / 2) * 72;
    const side = axis + (i % 2 === 0 ? 36 : -36);
    const at = (deg: number) => vec(PHI * Math.cos((deg * Math.PI) / 180), PHI * Math.sin((deg * Math.PI) / 180));
    return { kind: 0, points: [vec(0, 0), at(axis), at(side)] };
  }),
  coverRadius: PHI * Math.cos(Math.PI / 10), // the sun is a decagon of radius φ
  edge: PHI, // long side of kites and darts
  factor: PHI,
  period: 4,
  subdivide({ kind, points: [tip, axis, side] }) {
    if (kind === 0) {
      // x on the axis, 1 from the tip; w on the long side, 1 from the side corner. The two
      // new half-kites are mirror twins sharing the axis side → x; the half-dart sits at the tip.
      const x = lerp(tip!, axis!, 1 / PHI);
      const w = lerp(side!, tip!, 1 / PHI);
      return [
        { kind: 0, points: [side!, x, axis!] },
        { kind: 0, points: [side!, x, w] },
        { kind: 1, points: [tip!, w, x] },
      ];
    }
    const z = lerp(tip!, side!, 1 / PHI);
    return [
      { kind: 0, points: [tip!, axis!, z] },
      { kind: 1, points: [side!, z, axis!] },
    ];
  },
  assemble: (pieces, tolerance) => joinAlongAxis(pieces, tolerance, (kind) => kind),
};
