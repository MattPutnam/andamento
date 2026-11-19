import { vec, type Polygon, type Vec } from "./geometry";
import { apply, IDENTITY, inv, mul, translate, type Affine } from "./hat";
import { boxesOverlap, coversBox, grow, type Box } from "./cover";

/*
 * The "spectre" chiral aperiodic monotile (Smith, Myers, Kaplan & Goodman-Strauss, 2023),
 * Tile(1,1), built with the supertile construction from the paper: nine cluster types,
 * where the Γ cluster is the two-spectre "mystic", and each level places eight
 * clusters of the level below around a quadrilateral, then mirrors the result.
 */

const R3 = Math.sqrt(3) / 2;

/** Tile(1,1): fourteen unit edges (two of them collinear), angles in multiples of 30°. */
export const SPECTRE: Polygon = [
  vec(0, 0), vec(1, 0), vec(1.5, -R3), vec(1.5 + R3, 0.5 - R3),
  vec(1.5 + R3, 1.5 - R3), vec(2.5 + R3, 1.5 - R3), vec(3 + R3, 1.5), vec(3, 2),
  vec(3 - R3, 1.5), vec(2.5 - R3, 1.5 + R3), vec(1.5 - R3, 1.5 + R3), vec(0.5 - R3, 1.5 + R3),
  vec(-R3, 1.5), vec(0, 1),
];

export type SpectreLabel = "Gamma1" | "Gamma2" | "Delta" | "Theta" | "Lambda" | "Xi" | "Pi" | "Sigma" | "Phi" | "Psi";
type Cluster = "Gamma" | "Delta" | "Theta" | "Lambda" | "Xi" | "Pi" | "Sigma" | "Phi" | "Psi";
const CLUSTERS: Cluster[] = ["Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi"];

type Node = { kind: "tile"; label: SpectreLabel } | { kind: "meta"; children: { T: Affine; node: Node }[]; quad: Vec[] };

const rotDeg = (deg: number): Affine => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0];
};
const MIRROR: Affine = [-1, 0, 0, 0, 1, 0];

/** Which cluster sits in each of the eight slots of a supertile (null: slot left empty). */
const SUPER_RULES: Record<Cluster, (Cluster | null)[]> = {
  Gamma: ["Pi", "Delta", null, "Theta", "Sigma", "Xi", "Phi", "Gamma"],
  Delta: ["Xi", "Delta", "Xi", "Phi", "Sigma", "Pi", "Phi", "Gamma"],
  Theta: ["Psi", "Delta", "Pi", "Phi", "Sigma", "Pi", "Phi", "Gamma"],
  Lambda: ["Psi", "Delta", "Xi", "Phi", "Sigma", "Pi", "Phi", "Gamma"],
  Xi: ["Psi", "Delta", "Pi", "Phi", "Sigma", "Psi", "Phi", "Gamma"],
  Pi: ["Psi", "Delta", "Xi", "Phi", "Sigma", "Psi", "Phi", "Gamma"],
  Sigma: ["Xi", "Delta", "Xi", "Phi", "Sigma", "Pi", "Lambda", "Gamma"],
  Phi: ["Psi", "Delta", "Psi", "Phi", "Sigma", "Pi", "Phi", "Gamma"],
  Psi: ["Psi", "Delta", "Psi", "Phi", "Sigma", "Psi", "Phi", "Gamma"],
};

/**
 * Placement of slots 1–7, each relative to the slot before: turn by `angle` (cumulative),
 * then translate so the turned quad's corner `to` meets the previous slot's corner `from`.
 */
const SLOT_STEPS: [angle: number, from: number, to: number][] = [
  [60, 3, 1], [0, 2, 0], [60, 3, 1], [60, 3, 1], [0, 2, 0], [60, 3, 1], [-120, 3, 3],
];

function baseClusters(): Record<Cluster, Node> {
  const quad = [SPECTRE[3]!, SPECTRE[5]!, SPECTRE[7]!, SPECTRE[11]!];
  const out = {} as Record<Cluster, Node>;
  for (const c of CLUSTERS) {
    out[c] =
      c === "Gamma"
        ? {
            kind: "meta",
            quad,
            children: [
              { T: IDENTITY, node: { kind: "tile", label: "Gamma1" } },
              { T: mul(translate(SPECTRE[8]!.x, SPECTRE[8]!.y), rotDeg(30)), node: { kind: "tile", label: "Gamma2" } },
            ],
          }
        : { kind: "meta", quad, children: [{ T: IDENTITY, node: { kind: "tile", label: c } }] };
  }
  return out;
}

function supertiles(level: Record<Cluster, Node>): Record<Cluster, Node> {
  const quad = (level.Delta as Extract<Node, { kind: "meta" }>).quad;
  const slots: Affine[] = [IDENTITY];
  let total = 0;
  let rotation = IDENTITY;
  let turned = quad;
  for (const [angle, from, to] of SLOT_STEPS) {
    if (angle !== 0) {
      total += angle;
      rotation = rotDeg(total);
      turned = quad.map((q) => apply(rotation, q));
    }
    const target = apply(slots[slots.length - 1]!, quad[from]!);
    const shift = translate(target.x - turned[to]!.x, target.y - turned[to]!.y);
    slots.push(mul(shift, rotation));
  }
  const placed = slots.map((T) => mul(MIRROR, T));
  const superQuad = [apply(placed[6]!, quad[2]!), apply(placed[5]!, quad[1]!), apply(placed[3]!, quad[2]!), apply(placed[0]!, quad[1]!)];

  const out = {} as Record<Cluster, Node>;
  for (const c of CLUSTERS) {
    const children: { T: Affine; node: Node }[] = [];
    SUPER_RULES[c].forEach((sub, i) => {
      if (sub) children.push({ T: placed[i]!, node: level[sub] });
    });
    out[c] = { kind: "meta", quad: superQuad, children };
  }
  return out;
}

/**
 * The supertile of type `cluster` at `level`, and the transform from its coordinates to
 * those of the level-0 cluster at the end of the chain that follows `slot` at every level
 * (the slot must hold the same cluster type), so every level extends the one before.
 */
export function spectreSupertile(level: number, cluster: Cluster = "Delta", slot = 1): { root: Node; toAnchor: Affine } {
  if (SUPER_RULES[cluster][slot] !== cluster) throw new RangeError(`slot ${slot} of ${cluster} is not a ${cluster}`);
  // Children skip empty slots, so map the slot to its child index.
  const child = SUPER_RULES[cluster].slice(0, slot).filter((c) => c !== null).length;
  let clusters = baseClusters();
  let toAnchor: Affine = IDENTITY;
  for (let k = 0; k < level; k++) {
    clusters = supertiles(clusters);
    const top = clusters[cluster] as Extract<Node, { kind: "meta" }>;
    toAnchor = mul(toAnchor, inv(top.children[child]!.T));
  }
  return { root: clusters[cluster], toAnchor };
}

const LABELS: SpectreLabel[] = ["Gamma1", "Gamma2", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Phi", "Psi"];
export const SPECTRE_LABEL_INDEX = Object.fromEntries(LABELS.map((l, i) => [l, i])) as Record<SpectreLabel, number>;
export const SPECTRE_WIDTH = Math.max(...SPECTRE.flatMap((a) => SPECTRE.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
/**
 * Patterns grow around the level-0 Δ spectre, following the Δ in slot 1 of each Δ
 * supertile. (Other self-similar chains, such as Γ in slot 7, sit on their parent's edge
 * and only grow in some directions; Δ/1 grows in all of them, about 2.7× per level.)
 */
const ANCHOR = vec(SPECTRE.reduce((s, p) => s + p.x, 0) / SPECTRE.length, SPECTRE.reduce((s, p) => s + p.y, 0) / SPECTRE.length);

export interface SpectreTile {
  polygon: Polygon;
  label: SpectreLabel;
}

type Bounds = { x0: number; y0: number; x1: number; y1: number };
const nodeBounds = new WeakMap<Node, Bounds>();

/** Bounds of every spectre inside `n`, in n's coordinates (nodes are shared: measured once). */
function boundsOf(n: Node): Bounds {
  if (n.kind === "tile") {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of SPECTRE) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x0, y0, x1, y1 };
  }
  const cached = nodeBounds.get(n);
  if (cached) return cached;
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const ch of n.children) {
    const c = placed(ch.node, ch.T);
    b.x0 = Math.min(b.x0, c.x0); b.y0 = Math.min(b.y0, c.y0);
    b.x1 = Math.max(b.x1, c.x1); b.y1 = Math.max(b.y1, c.y1);
  }
  nodeBounds.set(n, b);
  return b;
}

function placed(n: Node, T: Affine): Bounds {
  const b = boundsOf(n);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of [vec(b.x0, b.y0), vec(b.x1, b.y0), vec(b.x1, b.y1), vec(b.x0, b.y1)]) {
    const q = apply(T, p);
    x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
  }
  return { x0, y0, x1, y1 };
}

/** Spectres covering `box` (in tile units, relative to the pattern's center). */
export function spectresCovering(box: Box, maxTiles: number): SpectreTile[] {
  const near = grow(box, SPECTRE_WIDTH);
  for (let level = 1; level <= 10; level++) {
    const { root, toAnchor } = spectreSupertile(level);
    const toLocal = mul(translate(-ANCHOR.x, -ANCHOR.y), toAnchor);
    const out: SpectreTile[] = [];
    const visit = (n: Node, T: Affine) => {
      if (n.kind === "tile") {
        out.push({ polygon: SPECTRE.map((p) => apply(T, p)), label: n.label });
        if (out.length > maxTiles) {
          throw new RangeError(`Tiles are too small for this region (more than ${maxTiles} spectre tiles). Increase the size or raise maxTiles.`);
        }
        return;
      }
      if (!boxesOverlap(placed(n, T), near)) return;
      for (const ch of n.children) visit(ch.node, mul(T, ch.T));
    };
    visit(root, toLocal);
    if (coversBox(out.map((t) => t.polygon), box, SPECTRE_WIDTH)) return out;
  }
  throw new RangeError("spectre: region too large for the supported number of levels");
}
