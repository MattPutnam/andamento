import { bbox, transform, vec, type Polygon, type Vec } from "./geometry";
import { splitSelfIntersections } from "./offset";
import type { GenerateContext, IsohedralSpec, RawTile } from "./tilings";
import { EdgeShape, IsohedralTiling, tilingTypes } from "./vendor/tactile";

/*
 * Isohedral ("Escher-style") tilings: every tile is a congruent copy of one prototile, and
 * every tile is equivalent to every other under the tiling's symmetries. Craig Kaplan's
 * Tactile library (vendored in ./vendor) supplies the 81 isohedral types with free tile
 * shapes: the prototile's corners for given parameters, the copies' transforms, and for
 * each edge the transform from a canonical edge, (0,0)→(1,0), onto the tile outline.
 */

type Affine = [number, number, number, number, number, number];
const mulPt = (M: Affine, p: Vec): Vec => vec(M[0] * p.x + M[1] * p.y + M[2], M[3] * p.x + M[4] * p.y + M[5]);

/**
 * How a tiling edge may be shaped:
 * - "J": any curve.
 * - "S": looks the same after a 180° turn (like the letter S).
 * - "U": looks the same mirrored across its midpoint (like the letter U).
 * - "I": straight.
 */
export type EdgeKind = "J" | "S" | "U" | "I";
const KIND: Record<number, EdgeKind> = {
  [EdgeShape.J]: "J",
  [EdgeShape.S]: "S",
  [EdgeShape.U]: "U",
  [EdgeShape.I]: "I",
};

/** The isohedral types available (IH numbers; 81 of the 93 have freely shaped tiles). */
export const isohedralTypes: readonly number[] = [...tilingTypes];

export interface IsohedralInfo {
  /** Number of shape parameters, which move the tile's corners. */
  numParameters: number;
  defaultParameters: number[];
  /** Shape constraint of each edge class, in the order `edges` curves are given. */
  edgeKinds: EdgeKind[];
  /** Number of tile corners (tiling vertices). */
  numVertices: number;
}

function tilingFor(ih: number): InstanceType<typeof IsohedralTiling> {
  if (!tilingTypes.includes(ih)) {
    throw new RangeError(`isohedral.ih must be one of the isohedral types ${tilingTypes[0]}–${tilingTypes[tilingTypes.length - 1]} with free tile shapes (got ${ih})`);
  }
  return new IsohedralTiling(ih);
}

/** Parameters and edge constraints of an isohedral type, for building UIs. */
export function isohedralInfo(ih: number): IsohedralInfo {
  const t = tilingFor(ih);
  return {
    numParameters: t.numParameters(),
    defaultParameters: t.getParameters(),
    edgeKinds: Array.from({ length: t.numEdgeShapes() }, (_, i) => KIND[t.getEdgeShape(i)]!),
    numVertices: t.numVertices(),
  };
}

/**
 * Built-in edge curves, in canonical edge coordinates. For "J" edges the curve spans the
 * whole edge; for "S" and "U" edges it spans one half, and the other half is made from it
 * by the required symmetry, so any curve is valid.
 */
function presetCurve(kind: EdgeKind, style: "straight" | "wave", amount: number): Vec[] {
  if (style === "straight" || kind === "I" || amount === 0) return [];
  const n = 12;
  return Array.from({ length: n - 1 }, (_, k) => {
    const t = (k + 1) / n;
    // J: a bump then a dip; S and U halves: a single bump (the symmetry adds the rest).
    const y = kind === "J" ? amount * Math.sin(2 * Math.PI * t) : amount * Math.sin(Math.PI * t);
    return vec(t, y);
  });
}

/**
 * The prototile outline (in Tactile's coordinates) for a spec. Without an explicit
 * `amount`, the "wave" curves start at 0.15 and are lowered until the outline doesn't
 * cross itself (a few types with short edges or sharp corners need less).
 */
export function isohedralPrototile(spec: Omit<IsohedralSpec, "type" | "size">): Polygon {
  if (spec.amount !== undefined || Array.isArray(spec.edges) || spec.edges === "straight") return buildPrototile(spec);
  for (let amount = 0.15; ; amount *= 0.8) {
    try {
      return buildPrototile({ ...spec, amount });
    } catch (e) {
      if (amount < 0.01) throw e;
    }
  }
}

function buildPrototile(spec: Omit<IsohedralSpec, "type" | "size">): Polygon {
  const t = tilingFor(spec.ih);
  if (spec.params) {
    if (spec.params.length !== t.numParameters()) {
      throw new RangeError(`isohedral type ${spec.ih} takes ${t.numParameters()} parameters (got ${spec.params.length})`);
    }
    t.setParameters([...spec.params]);
  }
  const kinds = Array.from({ length: t.numEdgeShapes() }, (_, i) => KIND[t.getEdgeShape(i)]!);
  const amount = spec.amount ?? 0;
  const curves = kinds.map((kind, i) => {
    if (kind === "I") return [];
    const given = Array.isArray(spec.edges) ? spec.edges[i] : undefined;
    return given ?? presetCurve(kind, Array.isArray(spec.edges) ? "straight" : spec.edges ?? "wave", amount);
  });

  const outline: Vec[] = [];
  for (const part of t.parts() as Iterable<{ T: Affine; id: number; rev: boolean }>) {
    let seg = [vec(0, 0), ...curves[part.id]!, vec(1, 0)].map((p) => mulPt(part.T, p));
    if (part.rev) seg = seg.reverse();
    // Each part starts where the previous one ended.
    outline.push(...seg.slice(0, -1));
  }
  if (splitSelfIntersections(outline).length > 1) {
    throw new RangeError("isohedral: the edge curves make the tile overlap itself; reduce `amount` or change `edges`");
  }
  return outline;
}

const widthOf = (p: Polygon) => Math.max(...p.flatMap((a) => p.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));

export function generateIsohedral(spec: IsohedralSpec, ctx: GenerateContext): RawTile[] {
  const prototile = isohedralPrototile(spec);
  const t = tilingFor(spec.ih);
  if (spec.params) t.setParameters([...spec.params]);
  const w = widthOf(prototile);
  const k = spec.size / w;
  const theta = (ctx.rotation * Math.PI) / 180;
  const local = transform(
    ctx.region.map((v) => vec((v.x - ctx.origin.x) / k, (v.y - ctx.origin.y) / k)),
    -theta,
    vec(0, 0),
  );
  const box = bbox(local);
  // Tactile places tiles by their lattice cell; pad so tiles reaching in from outside count.
  const pad = 2 * w;
  const tiles: RawTile[] = [];
  const seen = new Set<string>();
  for (const placed of t.fillRegionBounds(box.x - pad, box.y - pad, box.x + box.width + pad, box.y + box.height + pad) as Iterable<{
    T: Affine;
    t1: number;
    t2: number;
    aspect: number;
  }>) {
    const polygon = prototile.map((p) => {
      const q = mulPt(placed.T, p);
      return vec(q.x * k, q.y * k);
    });
    const id = `i${placed.t1},${placed.t2}:${placed.aspect}`;
    // Tactile's fill can yield a lattice row twice when the region spans several passes
    // (its "rows done" check treats row 0 as none); a tile's lattice position is unique.
    if (seen.has(id)) continue;
    seen.add(id);
    tiles.push({ id, polygon: transform(polygon, theta, ctx.origin), protoTile: placed.aspect });
    if (tiles.length > ctx.maxTiles * 2) {
      throw new RangeError(`Tiles are too small for this region (more than ${ctx.maxTiles} isohedral tiles). Increase the size or raise maxTiles.`);
    }
  }
  return tiles;
}
