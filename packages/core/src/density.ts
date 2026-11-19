import { area, bbox, centroid, containsPolygon, ensurePositive, isConvex, rectPolygon, sharesEdge, vec, type Polygon, type Rect, type Vec } from "./geometry";
import { pointInPolygon } from "./offset";
import { overlay } from "./overlay";
import { generateTiles, type RawTile, type TilingSpec } from "./tilings";

/**
 * Tile size across a region, as a factor of the tiling's own size at each point: 1 is the
 * size the tiling is given, 0.5 half that. See `LayoutOptions.sizeAt`.
 */
export type SizeField = (point: Vec) => number;

/** Smallest and largest values of a size field over a box, from a grid of samples. */
export function fieldRange(field: SizeField, box: Rect, samples = 33): { min: number; max: number } {
  let min = Infinity, max = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const v = field(vec(box.x + (box.width * i) / (samples - 1), box.y + (box.height * j) / (samples - 1)));
      if (v > 0 && Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  if (!(max > 0)) throw new RangeError("sizeAt must return positive numbers");
  return { min, max };
}

interface RefineContext {
  spec: TilingSpec;
  rotation: number;
  origin: Vec;
  /** Scale the coarsest tiles were generated at (pattern units → layout units). */
  scale: number;
  /** The field divided by its largest value: 1 for the coarsest tiles. */
  want: SizeField;
  /** How many times tiles may be halved. */
  levels: number;
  maxTiles: number;
  scaleRef: number;
  tol: number;
}

/**
 * Make tiles smaller where the size field asks: tiles wanting to be under about half their
 * size are replaced, as a group, by the same tiling at half the scale, cut to the area
 * they covered; and so on down. Fine tiles cut into slivers at the edge of a finer area
 * are merged into a neighbour. Tilings that halve exactly (a grid from the same origin, say)
 * nest without cuts.
 */
export function refineTiles(raw: RawTile[], ctx: RefineContext): RawTile[] {
  const out: RawTile[] = [];
  let current = raw.map((t) => ({ ...t, polygon: ensurePositive(t.polygon) }));
  let total = current.length;
  for (let level = 0; current.length; level++) {
    const s = 2 ** -level;
    const refine: RawTile[] = [];
    for (const t of current) {
      // Halve when the wanted size is nearer half the current size than the current size.
      if (level < ctx.levels && ctx.want(centroid(t.polygon)) < s / Math.SQRT2) refine.push(t);
      else out.push(t);
    }
    if (!refine.length) break;
    total -= refine.length;
    current = subdivide(refine, ctx, level + 1);
    total += current.length;
    if (total > ctx.maxTiles) {
      throw new RangeError(`Tiles are too small for this region (over ${ctx.maxTiles} tiles with sizeAt). Use larger sizes or raise maxTiles.`);
    }
  }
  return out;
}

/** The tiling at level `level` (scale halved that many times), cut to the union of `parents`. */
function subdivide(parents: RawTile[], ctx: RefineContext, level: number): RawTile[] {
  const scale = ctx.scale * 2 ** -level;
  const box = bbox(parents.flatMap((p) => p.polygon));
  const down = (v: Vec) => vec(v.x / scale, v.y / scale);
  const fine = generateTiles(ctx.spec, {
    region: rectPolygon(box.x, box.y, box.width, box.height).map(down),
    rotation: ctx.rotation,
    origin: down(ctx.origin),
    maxTiles: ctx.maxTiles,
  });

  // Parents by bucket, to find the few under each fine tile.
  const pb = parents.map((p) => bbox(p.polygon));
  const cell = Math.max(Math.sqrt((box.width * box.height) / parents.length), 1e-9);
  const cols = Math.max(1, Math.ceil(box.width / cell)), rows = Math.max(1, Math.ceil(box.height / cell));
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const range = (r: Rect) => [
    Math.max(0, Math.floor((r.x - box.x) / cell)), Math.max(0, Math.floor((r.y - box.y) / cell)),
    Math.min(cols - 1, Math.floor((r.x + r.width - box.x) / cell)), Math.min(rows - 1, Math.floor((r.y + r.height - box.y) / cell)),
  ] as const;
  pb.forEach((r, i) => {
    const [c0, r0, c1, r1] = range(r);
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) buckets[y * cols + x]!.push(i);
  });
  const convex = parents.map((p) => isConvex(p.polygon));

  type Piece = RawTile & { nominal: number };
  const pieces: Piece[] = [];
  for (const t of fine) {
    const polygon = ensurePositive(t.polygon.map((v) => vec(v.x * scale, v.y * scale)));
    const fb = bbox(polygon);
    const [c0, r0, c1, r1] = range(fb);
    const cand = new Set<number>();
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) for (const i of buckets[y * cols + x]!) cand.add(i);
    const under = [...cand].filter((i) => {
      const b = pb[i]!;
      return b.x < fb.x + fb.width && fb.x < b.x + b.width && b.y < fb.y + fb.height && fb.y < b.y + b.height;
    });
    if (!under.length) continue;
    const id = `${t.id}@${level}`;
    const nominal = area(polygon);
    const home = under.find((i) => convex[i] && containsPolygon(parents[i]!.polygon, polygon, ctx.tol));
    if (home !== undefined) {
      pieces.push({ id, polygon, protoTile: t.protoTile, nominal });
      continue;
    }
    // Across the edge of the finer area: keep the part inside it.
    const loops = under.map((i) => parents[i]!.polygon);
    const shapes = overlay([polygon, ...loops], (p) => pointInPolygon(p, polygon) && loops.some((l) => pointInPolygon(p, l)), ctx.scaleRef);
    // Even tiny pieces are kept (they're merged into a neighbour below): dropping one would
    // leave a hole.
    shapes.forEach((s, j) => pieces.push({ id: j ? `${id}~${j}` : id, polygon: s.outer, protoTile: t.protoTile, nominal }));
  }
  return mergeSlivers(pieces, ctx.scaleRef, ctx.tol);
}

/**
 * Merge pieces under 30% of their full tile's area into the neighbour they share the most
 * with (or any neighbour sharing an edge), so cuts don't leave crumbs.
 */
export function mergeSlivers(pieces: (RawTile & { nominal: number; group?: number })[], scaleRef: number, tol0: number): RawTile[] {
  const alive = pieces.map(() => true);
  const polys = pieces.map((p) => p.polygon);
  const small = pieces.map((p, i) => i).filter((i) => area(polys[i]!) < 0.3 * pieces[i]!.nominal).sort((a, b) => area(polys[a]!) - area(polys[b]!));
  const boxes = polys.map(bbox);
  const tol = Math.max(tol0 * 10, 1e-9);
  for (const i of small) {
    if (!alive[i]) continue;
    const bi = boxes[i]!;
    // The biggest neighbour sharing an edge, from the same group (a flow row) if there is one.
    let best = -1, bestArea = -1;
    for (let j = 0; j < pieces.length; j++) {
      if (j === i || !alive[j]) continue;
      const bj = boxes[j]!;
      if (bj.x > bi.x + bi.width + tol || bi.x > bj.x + bj.width + tol || bj.y > bi.y + bi.height + tol || bi.y > bj.y + bj.height + tol) continue;
      if (!sharesEdge(polys[i]!, polys[j]!, tol)) continue;
      const a = area(polys[j]!) + (pieces[j]!.group !== undefined && pieces[j]!.group === pieces[i]!.group ? 1e12 : 0);
      if (a > bestArea) { bestArea = a; best = j; }
    }
    if (best < 0) continue;
    const a = polys[i]!, b = polys[best]!;
    const union = overlay([a, b], (p) => pointInPolygon(p, a) || pointInPolygon(p, b), scaleRef);
    if (union.length !== 1 || union[0]!.holes.length) continue;
    polys[best] = union[0]!.outer;
    boxes[best] = bbox(polys[best]!);
    alive[i] = false;
  }
  const out: RawTile[] = [];
  pieces.forEach((p, i) => {
    if (alive[i]) out.push({ id: p.id, polygon: polys[i]!, protoTile: p.protoTile });
  });
  return out;
}

/* ---------- Size fields ---------- */

/**
 * Smaller tiles round a point, growing with distance: `inner` (the size factor at the
 * point) to `outer` at `radius` and beyond, with a smooth ease between.
 */
export function radialSize(options: { center: Vec; radius: number; inner?: number; outer?: number }): SizeField {
  const { center, radius } = options;
  const inner = options.inner ?? 0.25, outer = options.outer ?? 1;
  return (p) => {
    const t = Math.min(1, Math.hypot(p.x - center.x, p.y - center.y) / (radius || 1));
    return inner + (outer - inner) * (t * t * (3 - 2 * t));
  };
}

/**
 * Smaller tiles along a region's edges (and its holes' edges): `edge` (the size factor at the
 * edge) to `middle` at `distance` in and beyond. Pass the layout's region and holes.
 */
export function edgeSize(region: Polygon, options: { distance: number; edge?: number; middle?: number; holes?: Polygon[] }): SizeField {
  const edge = options.edge ?? 0.25, middle = options.middle ?? 1;
  const loops = [region, ...(options.holes ?? [])];
  return (p) => {
    let d = Infinity;
    for (const l of loops) {
      for (let i = 0; i < l.length; i++) {
        const a = l[i]!, b = l[(i + 1) % l.length]!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        d = Math.min(d, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
      }
    }
    const t = Math.min(1, d / (options.distance || 1));
    return edge + (middle - edge) * (t * t * (3 - 2 * t));
  };
}

/**
 * Tile size from a picture's brightness: dark areas get `dark` (default 0.25), light ones
 * `light` (default 1), so detail gathers where the picture has it. `pixels` is RGBA data, as
 * from `loadImagePixels`; the picture covers `box` (normally the layout's bounds), cropped
 * like `object-fit: cover`. Use `invert` for small tiles in the light.
 */
export function imageSize(
  pixels: { width: number; height: number; data: ArrayLike<number> },
  box: Rect,
  options: { dark?: number; light?: number; invert?: boolean } = {},
): SizeField {
  const dark = options.dark ?? 0.25, light = options.light ?? 1;
  const { width: w, height: h, data } = pixels;
  const s = Math.max(box.width / w, box.height / h);
  const ox = box.x + (box.width - w * s) / 2, oy = box.y + (box.height - h * s) / 2;
  return (p) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor((p.x - ox) / s)));
    const y = Math.min(h - 1, Math.max(0, Math.floor((p.y - oy) / s)));
    const k = (y * w + x) * 4;
    let lum = (0.2126 * data[k]! + 0.7152 * data[k + 1]! + 0.0722 * data[k + 2]!) / 255;
    if (options.invert) lum = 1 - lum;
    return dark + (light - dark) * lum;
  };
}
