/*!
 * The "hat" aperiodic monotile (Smith, Myers, Kaplan & Goodman-Strauss, 2023), built
 * with the H/T/P/F metatile construction.
 *
 * The metatile outlines, the patch rules and the supertile construction below are ported
 * from hatviz (https://github.com/isohedral/hatviz), whose license follows:
 *
 * BSD 3-Clause License
 *
 * Copyright (c) 2023, Craig S. Kaplan
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import { vec, type Polygon, type Vec } from "./geometry";
import { boxesOverlap, coversBox, grow, type Box } from "./cover";

/** 2D affine transform [a, b, c, d, e, f]: x' = a·x + b·y + c, y' = d·x + e·y + f. */
export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 0, 1, 0];

export function mul(A: Affine, B: Affine): Affine {
  return [
    A[0] * B[0] + A[1] * B[3],
    A[0] * B[1] + A[1] * B[4],
    A[0] * B[2] + A[1] * B[5] + A[2],
    A[3] * B[0] + A[4] * B[3],
    A[3] * B[1] + A[4] * B[4],
    A[3] * B[2] + A[4] * B[5] + A[5],
  ];
}

export function inv(T: Affine): Affine {
  const det = T[0] * T[4] - T[1] * T[3];
  return [
    T[4] / det,
    -T[1] / det,
    (T[1] * T[5] - T[2] * T[4]) / det,
    -T[3] / det,
    T[0] / det,
    (T[2] * T[3] - T[0] * T[5]) / det,
  ];
}

export const apply = (M: Affine, p: Vec): Vec => vec(M[0] * p.x + M[1] * p.y + M[2], M[3] * p.x + M[4] * p.y + M[5]);
const rot = (a: number): Affine => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0];
export const translate = (x: number, y: number): Affine => [1, 0, x, 0, 1, y];
const rotAbout = (p: Vec, a: number): Affine => mul(translate(p.x, p.y), mul(rot(a), translate(-p.x, -p.y)));
const padd = (p: Vec, q: Vec): Vec => vec(p.x + q.x, p.y + q.y);
const psub = (p: Vec, q: Vec): Vec => vec(p.x - q.x, p.y - q.y);

/** Map the unit segment (0,0)→(1,0) onto p→q (rotation + uniform scale + translation). */
const matchSeg = (p: Vec, q: Vec): Affine => [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
/** Map segment p1→q1 onto p2→q2. */
export const matchTwo = (p1: Vec, q1: Vec, p2: Vec, q2: Vec): Affine => mul(matchSeg(p2, q2), inv(matchSeg(p1, q1)));

function intersect(p1: Vec, q1: Vec, p2: Vec, q2: Vec): Vec {
  const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
  const uA = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d;
  return vec(p1.x + uA * (q1.x - p1.x), p1.y + uA * (q1.y - p1.y));
}

const HR3 = Math.sqrt(3) / 2;
const hexPt = (x: number, y: number): Vec => vec(x + 0.5 * y, HR3 * y);

/** The hat: a 13-sided polykite (eight kites of a hexagonal grid). */
export const HAT: Polygon = [
  hexPt(0, 0), hexPt(-1, -1), hexPt(0, -2), hexPt(2, -2),
  hexPt(2, -1), hexPt(4, -2), hexPt(5, -1), hexPt(4, 0),
  hexPt(3, 0), hexPt(2, 2), hexPt(0, 3), hexPt(0, 2),
  hexPt(-1, 2),
];

/**
 * Hat labels, by the metatile a hat belongs to: "H1" is the one reflected hat in each H
 * metatile; the others are unreflected.
 */
export type HatLabel = "H1" | "H" | "T" | "P" | "F";

export interface HatLeaf {
  kind: "hat";
  label: HatLabel;
}

export interface MetaTile {
  kind: "meta";
  /** Approximate outline of the cluster, in its own coordinates. */
  shape: Polygon;
  children: { T: Affine; geom: Geom }[];
}

export type Geom = HatLeaf | MetaTile;

const hat = (label: HatLabel): HatLeaf => ({ kind: "hat", label });
const meta = (shape: Polygon, children: MetaTile["children"] = []): MetaTile => ({ kind: "meta", shape, children });
const evalChild = (m: MetaTile, n: number, i: number): Vec => {
  const ch = m.children[n]!;
  return apply(ch.T, (ch.geom as MetaTile).shape[i]!);
};

function initialMetatiles(): [MetaTile, MetaTile, MetaTile, MetaTile] {
  const hOutline = [vec(0, 0), vec(4, 0), vec(4.5, HR3), vec(2.5, 5 * HR3), vec(1.5, 5 * HR3), vec(-0.5, HR3)];
  const H = meta(hOutline, [
    { T: matchTwo(HAT[5]!, HAT[7]!, hOutline[5]!, hOutline[0]!), geom: hat("H") },
    { T: matchTwo(HAT[9]!, HAT[11]!, hOutline[1]!, hOutline[2]!), geom: hat("H") },
    { T: matchTwo(HAT[5]!, HAT[7]!, hOutline[3]!, hOutline[4]!), geom: hat("H") },
    { T: mul(translate(2.5, HR3), mul([-0.5, -HR3, 0, HR3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])), geom: hat("H1") },
  ]);
  const T = meta([vec(0, 0), vec(3, 0), vec(1.5, 3 * HR3)], [{ T: [0.5, 0, 0.5, 0, 0.5, HR3], geom: hat("T") }]);
  const pair = (label: HatLabel): MetaTile["children"] => [
    { T: [0.5, 0, 1.5, 0, 0.5, HR3], geom: hat(label) },
    { T: mul(translate(0, 2 * HR3), mul([0.5, HR3, 0, -HR3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), geom: hat(label) },
  ];
  const P = meta([vec(0, 0), vec(4, 0), vec(3, 2 * HR3), vec(-1, 2 * HR3)], pair("P"));
  const F = meta([vec(0, 0), vec(3, 0), vec(3.5, HR3), vec(3, 2 * HR3), vec(-1, 2 * HR3)], pair("F"));
  return [H, T, P, F];
}

/**
 * Which of the three H metatiles inside each H supertile (children 0–2) holds the previous
 * level. Chains 0 and 1 sit on their parent's edge, so the pattern would only grow in some
 * directions; chain 2 grows in all of them (covered radius ≈ 3, 7, 16, 37, 99… hat units).
 */
const ANCHOR_CHAIN = 2;

type Shape = "H" | "T" | "P" | "F";
/**
 * How to assemble a patch of metatiles around an H. Each rule places one new metatile:
 * [shape] at the origin; [child, edge, shape, edge] glues the new shape's edge to that
 * edge of an existing child; [childA, vertexA, childB, vertexB, shape, edge] glues it
 * between a vertex of each of two existing children.
 */
const PATCH_RULES: (readonly [Shape] | readonly [number, number, Shape, number] | readonly [number, number, number, number, Shape, number])[] = [
  ["H"],
  [0, 0, "P", 2], [1, 0, "H", 2], [2, 0, "P", 2], [3, 0, "H", 2], [4, 4, "P", 2],
  [0, 4, "F", 3], [2, 4, "F", 3], [4, 1, 3, 2, "F", 0], [8, 3, "H", 0], [9, 2, "P", 0],
  [10, 2, "H", 0], [11, 4, "P", 2], [12, 0, "H", 2], [13, 0, "F", 3], [14, 2, "F", 1],
  [15, 3, "H", 4], [8, 2, "F", 1], [17, 3, "H", 0], [18, 2, "P", 0], [19, 2, "H", 2],
  [20, 4, "F", 3], [20, 0, "P", 2], [22, 0, "H", 2], [23, 4, "F", 3], [23, 0, "F", 3],
  [16, 0, "P", 2], [9, 4, 0, 2, "T", 2], [4, 0, "F", 3],
];

export function constructPatch(H: MetaTile, T: MetaTile, P: MetaTile, F: MetaTile): MetaTile {
  const shapes = { H, T, P, F };
  const ret = meta([]);
  for (const r of PATCH_RULES) {
    if (r.length === 1) {
      ret.children.push({ T: IDENTITY, geom: shapes[r[0]] });
    } else if (r.length === 4) {
      const ch = ret.children[r[0]]!;
      const poly = (ch.geom as MetaTile).shape;
      const p = apply(ch.T, poly[(r[1] + 1) % poly.length]!);
      const q = apply(ch.T, poly[r[1]]!);
      const nshp = shapes[r[2]];
      const np = nshp.shape;
      ret.children.push({ T: matchTwo(np[r[3]]!, np[(r[3] + 1) % np.length]!, p, q), geom: nshp });
    } else {
      const chP = ret.children[r[0]]!;
      const chQ = ret.children[r[2]]!;
      const p = apply(chQ.T, (chQ.geom as MetaTile).shape[r[3]]!);
      const q = apply(chP.T, (chP.geom as MetaTile).shape[r[1]]!);
      const nshp = shapes[r[4]];
      const np = nshp.shape;
      ret.children.push({ T: matchTwo(np[r[5]]!, np[(r[5] + 1) % np.length]!, p, q), geom: nshp });
    }
  }
  return ret;
}

/** Move a metatile's outline (and children) so the outline's vertex average is the origin. */
function recenter(m: MetaTile): MetaTile {
  let cx = 0;
  let cy = 0;
  for (const p of m.shape) {
    cx += p.x;
    cy += p.y;
  }
  cx /= m.shape.length;
  cy /= m.shape.length;
  const M = translate(-cx, -cy);
  return meta(
    m.shape.map((p) => vec(p.x - cx, p.y - cy)),
    m.children.map((ch) => ({ T: mul(M, ch.T), geom: ch.geom })),
  );
}

/** Build the next level's H, T, P, F metatiles out of a patch of the current ones. */
export function constructMetatiles(patch: MetaTile): [MetaTile, MetaTile, MetaTile, MetaTile] {
  const bps1 = evalChild(patch, 8, 2);
  const bps2 = evalChild(patch, 21, 2);
  const rbps = apply(rotAbout(bps1, (-2 * Math.PI) / 3), bps2);
  const p72 = evalChild(patch, 7, 2);
  const p252 = evalChild(patch, 25, 2);
  const llc = intersect(bps1, rbps, evalChild(patch, 6, 2), p72);
  let w = psub(evalChild(patch, 6, 2), llc);

  const hOutline: Vec[] = [llc, bps1];
  w = apply(rot(-Math.PI / 3), w);
  hOutline.push(padd(hOutline[1]!, w));
  hOutline.push(evalChild(patch, 14, 2));
  w = apply(rot(-Math.PI / 3), w);
  hOutline.push(psub(hOutline[3]!, w));
  hOutline.push(evalChild(patch, 6, 2));

  const pick = (indices: number[]) => indices.map((i) => patch.children[i]!);
  const H = meta(hOutline, pick([0, 9, 16, 27, 26, 6, 1, 8, 10, 15]));
  const P = meta([p72, padd(p72, psub(bps1, llc)), bps1, llc], pick([7, 2, 3, 4, 28]));
  const F = meta(
    [bps2, evalChild(patch, 24, 2), evalChild(patch, 25, 0), p252, padd(p252, psub(llc, bps1))],
    pick([21, 20, 22, 23, 24, 25]),
  );
  const aaa = hOutline[2]!;
  const bbb = padd(hOutline[1]!, psub(hOutline[4]!, hOutline[5]!));
  const ccc = apply(rotAbout(bbb, -Math.PI / 3), aaa);
  const T = meta([bbb, ccc, aaa], pick([11]));
  return [recenter(H), recenter(T), recenter(P), recenter(F)];
}

/**
 * The H metatile at `level` (0 = the initial four-hat H), and the transform from its
 * coordinates to those of the level-0 H it contains. Each level's H contains the previous
 * level's H as its first child, so anchoring on the level-0 H makes every level an
 * extension of the one before.
 */
export function hatSupertile(level: number, chain: number | readonly number[] = ANCHOR_CHAIN): { H: MetaTile; toAnchor: Affine } {
  let tiles = initialMetatiles();
  let toAnchor: Affine = IDENTITY;
  for (let k = 0; k < level; k++) {
    tiles = constructMetatiles(constructPatch(...tiles));
    // Children 0–2 of every H supertile are H metatiles of the level below. The chosen
    // child's transform maps previous-H coordinates into new-H coordinates, so its inverse
    // takes us one level closer to the anchor.
    const pick = typeof chain === "number" ? chain : chain[k % chain.length]!;
    toAnchor = mul(toAnchor, inv(tiles[0].children[pick]!.T));
  }
  return { H: tiles[0], toAnchor };
}

type Bounds = { x0: number; y0: number; x1: number; y1: number };
const hatBoxes = new WeakMap<MetaTile, Bounds>();

/**
 * Bounding box of every hat inside `g`, in g's own coordinates. Hats stray well outside
 * the metatile outlines (by ~2.7× more per level), so pruning must use these real bounds.
 * Metatiles are shared between parents, so each is measured once.
 */
export function hatBounds(g: Geom): Bounds {
  if (g.kind === "hat") {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of HAT) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x0, y0, x1, y1 };
  }
  const cached = hatBoxes.get(g);
  if (cached) return cached;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ch of g.children) {
    const b = hatBounds(ch.geom);
    for (const p of [vec(b.x0, b.y0), vec(b.x1, b.y0), vec(b.x1, b.y1), vec(b.x0, b.y1)]) {
      const q = apply(ch.T, p);
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    }
  }
  const box = { x0, y0, x1, y1 };
  hatBoxes.set(g, box);
  return box;
}

/** Bounds of `g`'s hats after transform T (conservative: the transformed box's box). */
export function placedBounds(g: Geom, T: Affine): Bounds {
  const b = hatBounds(g);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of [vec(b.x0, b.y0), vec(b.x1, b.y0), vec(b.x1, b.y1), vec(b.x0, b.y1)]) {
    const q = apply(T, p);
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
  }
  return { x0, y0, x1, y1 };
}

const LABEL_INDEX: Record<HatLabel, number> = { H: 0, T: 1, P: 2, F: 3, H1: 4 };

/**
 * Widest extent of a hat as placed in the metatiles (which use the outline above at half
 * scale), used to turn the user's `size` into a scale.
 */
const HAT_WIDTH = (() => {
  const placed = HAT.map((p) => apply(hatSupertile(0).H.children[0]!.T, p));
  return Math.max(...placed.flatMap((a) => placed.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
})();

/** Middle of the level-0 H metatile: the fixed point every level grows around. */
const ANCHOR = (() => {
  const { H } = hatSupertile(0);
  return vec(H.shape.reduce((s, p) => s + p.x, 0) / H.shape.length, H.shape.reduce((s, p) => s + p.y, 0) / H.shape.length);
})();


export interface HatTile {
  polygon: Polygon;
  label: HatLabel;
}

/**
 * Hats covering `box` (in hat units, relative to the pattern's center): the smallest
 * level whose H supertile, grown around the anchor, actually covers the box.
 */
export function hatsCovering(box: Box, maxTiles: number): HatTile[] {
  const near = grow(box, HAT_WIDTH);
  for (let level = 1; level <= 14; level++) {
    const { H, toAnchor } = hatSupertile(level);
    const toLocal = mul(translate(-ANCHOR.x, -ANCHOR.y), toAnchor);
    const out: HatTile[] = [];
    const visit = (g: Geom, T: Affine) => {
      if (g.kind === "hat") {
        out.push({ polygon: HAT.map((p) => apply(T, p)), label: g.label });
        if (out.length > maxTiles) {
          throw new RangeError(`Tiles are too small for this region (more than ${maxTiles} hat tiles). Increase the size or raise maxTiles.`);
        }
        return;
      }
      if (!boxesOverlap(placedBounds(g, T), near)) return;
      for (const ch of g.children) visit(ch.geom, mul(T, ch.T));
    };
    visit(H, toLocal);
    if (coversBox(out.map((t) => t.polygon), box, HAT_WIDTH)) return out;
  }
  throw new RangeError("hat: region too large for the supported number of levels");
}

export { HAT_WIDTH, LABEL_INDEX };
