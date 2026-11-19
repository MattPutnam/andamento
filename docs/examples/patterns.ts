import { createLayout, protoTileFill, type TilingSpec } from "@andamento/core";
import { renderToString } from "@andamento/svg";

export interface PatternEntry {
  /** The tiling, exactly as passed to `createLayout`. */
  spec: TilingSpec;
  title: string;
  note: string;
  group: "Bricks and boards" | "Regular polygons" | "Curved and interlocking" | "Aperiodic" | "Escher-style" | "Random" | "Flow";
  /** Color by `protoTile` (the tile's kind within the pattern) rather than by neighbor. */
  byKind?: boolean;
  /** Put the pattern's origin in the middle of the region. */
  centerd?: boolean;
}

const W = 240, H = 150;

export const patterns: PatternEntry[] = [
  { group: "Bricks and boards", title: "Grid", spec: { type: "grid", width: 40, height: 30 }, note: "Rectangles in rows and columns." },
  { group: "Bricks and boards", title: "Running bond", spec: { type: "runningBond", width: 45, height: 22, offset: 0.5 }, note: "Brick courses, each shifted by `offset` of a brick." },
  { group: "Bricks and boards", title: "Flemish bond", spec: { type: "flemishBond", length: 40, header: 20, height: 18 }, note: "Long stretchers and short headers alternating along each course.", byKind: true },
  { group: "Bricks and boards", title: "Herringbone", spec: { type: "herringbone", length: 60, width: 20 }, note: "Boards laid in a zigzag; the two directions are protoTiles 0 and 1.", byKind: true },
  { group: "Bricks and boards", title: "Chevron", spec: { type: "chevron", length: 60, width: 20, angle: 45 }, note: "Parallelograms meeting at a point, like a parquet floor.", byKind: true },
  { group: "Bricks and boards", title: "Basketweave", spec: { type: "basketweave", length: 50, strips: 2 }, note: "Squares of `strips` parallel bricks, alternating direction.", byKind: true },
  { group: "Bricks and boards", title: "Hopscotch", spec: { type: "hopscotch", large: 45, small: 22 }, note: "Two sizes of square, pinwheeling round each other.", byKind: true },
  { group: "Bricks and boards", title: "Pinwheel", spec: { type: "pinwheel", length: 50, width: 22 }, note: "Four bricks round a small square.", byKind: true },
  { group: "Regular polygons", title: "Hexagonal", spec: { type: "hexagonal", size: 26, orientation: "pointy" }, note: "Honeycomb; `orientation` is \"pointy\" or \"flat\"." },
  { group: "Regular polygons", title: "Triangular", spec: { type: "triangular", size: 40 }, note: "Equilateral triangles, alternately up and down.", byKind: true },
  { group: "Regular polygons", title: "Rhombille", spec: { type: "rhombille", size: 24 }, note: "Tumbling blocks: three rhombs per hexagon, one per face (protoTiles 0–2).", byKind: true },
  { group: "Regular polygons", title: "Octagon and square", spec: { type: "octagonSquare", size: 20 }, note: "Octagons with small squares between them.", byKind: true },
  { group: "Regular polygons", title: "Trihexagonal", spec: { type: "trihexagonal", size: 22 }, note: "Hexagons and triangles: the kagome pattern.", byKind: true },
  { group: "Regular polygons", title: "Rhombitrihexagonal", spec: { type: "rhombitrihexagonal", size: 16 }, note: "Hexagons, squares and triangles.", byKind: true },
  { group: "Regular polygons", title: "Cairo", spec: { type: "cairo", size: 40 }, note: "Pentagons, as paved on the streets of Cairo.", byKind: true },
  { group: "Curved and interlocking", title: "Fish scale", spec: { type: "fishScale", size: 36 }, note: "Overlapping arcs. Tiles are non-convex." },
  { group: "Curved and interlocking", title: "Jigsaw", spec: { type: "jigsaw", size: 34, seed: 1 }, note: "Puzzle pieces; `seed` picks each tab's direction." },
  { group: "Aperiodic", title: "Penrose rhombs", spec: { type: "penrose", size: 24, variant: "rhombs" }, note: "Thick and thin rhombs that never repeat. `origin` places the star.", byKind: true, centerd: true },
  { group: "Aperiodic", title: "Penrose kites and darts", spec: { type: "penrose", size: 30, variant: "kitesAndDarts" }, note: "The other Penrose set.", byKind: true, centerd: true },
  { group: "Aperiodic", title: "Hat", spec: { type: "hat", size: 26 }, note: "The 2023 monotile: one shape, never repeating. Mirrored hats are protoTile 4.", byKind: true, centerd: true },
  { group: "Aperiodic", title: "Spectre", spec: { type: "spectre", size: 28 }, note: "A monotile that needs no mirrored copies.", byKind: true, centerd: true },
  { group: "Escher-style", title: "Isohedral IH41", spec: { type: "isohedral", ih: 41, size: 50, amount: 0.15 }, note: "One of the 81 isohedral types, with wavy edges.", byKind: true },
  { group: "Escher-style", title: "Isohedral IH28", spec: { type: "isohedral", ih: 28, size: 50, amount: 0.2 }, note: "Every tile the same shape, in two orientations.", byKind: true },
  { group: "Escher-style", title: "Isohedral IH7", spec: { type: "isohedral", ih: 7, size: 46, amount: 0.18 }, note: "Three orientations round each point.", byKind: true },
  { group: "Random", title: "Voronoi", spec: { type: "voronoi", size: 34, relax: 2, seed: 1 }, note: "Irregular polygons, like crazy paving. `relax` evens them out." },
  { group: "Random", title: "Delaunay", spec: { type: "delaunay", size: 40, relax: 2, seed: 1 }, note: "Random triangles." },
  { group: "Random", title: "Ashlar", spec: { type: "ashlar", height: 22, minLength: 20, maxLength: 70, heightVariation: 0.3, seed: 1 }, note: "Stone courses of random lengths and heights." },
  { group: "Random", title: "Mondrian", spec: { type: "mondrian", minSize: 30, maxSize: 90, splitChance: 0.4, snap: 5, seed: 3 }, note: "Random rectangles, split and split again." },
  { group: "Flow", title: "Flow", spec: { type: "flow", size: 8, centers: [{ x: 160, y: 70 }], followEdges: true }, note: "Rows of tesserae following the edges and ringing a center point.", byKind: true },
];

/** How a spec is written with the core's helper functions, e.g. `hexagonal({ size: 26 })`. */
export function specCode(spec: TilingSpec): string {
  const { type, ...params } = spec as unknown as Record<string, unknown> & { type: string };
  const value = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(value).join(", ")}]`
      : v && typeof v === "object"
        ? `{ ${Object.entries(v).map(([k, x]) => `${k}: ${value(x)}`).join(", ")} }`
        : typeof v === "string"
          ? `"${v}"`
          : String(v);
  return `${type}(${value(params)})`;
}

export const slug = (p: PatternEntry) => p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const colors = ["#2a9d8f", "#e9c46a", "#f4a261", "#e76f51", "#264653", "#8ab17d"];

/** One picture per pattern, keyed by slug. */
export function gallery(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of patterns) {
    const layout = createLayout({
      region: { x: 0, y: 0, width: W, height: H },
      tiling: p.spec,
      gap: p.spec.type === "flow" ? 0.8 : 1.5,
      ...(p.centerd ? { origin: { x: W / 2, y: H / 2 } } : {}),
    });
    out[slug(p)] = renderToString(layout, {
      fill: p.byKind ? protoTileFill(colors) : colors,
      background: "#fbf8f3",
      title: p.title,
      idPrefix: slug(p),
    });
  }
  return out;
}
