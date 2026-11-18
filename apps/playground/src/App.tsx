import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import { colorCells, createLayout, fitCount, gradientFill, paletteFill, protoTileFill, randomFill, isohedralInfo, isohedralTypes, type EdgeMode, type Layout, type LayoutOptions, type TilingSpec, type TilingType } from "@andamento/core";
import { defaultPalette, renderToPng, renderToString } from "@andamento/svg";
import { TileLayout, cellFromPointer, coverStyle, neutralPalette, useImageAspects, useImageFill, type ContentPlacement, type FillSource } from "@andamento/react";
import { placeholderPhotos } from "./photos";

interface Param {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface TilingDef {
  label: string;
  params: Param[];
  defaults: Record<string, number | string>;
  rotates: boolean;
  /** Put the pattern's origin at the centre of the region (where Penrose has its star). */
  centred?: boolean;
}

/** Built-in patterns shown in the playground (custom "periodic" and "tiles" specs are code-only). */
type PlaygroundTiling = Exclude<TilingType, "periodic" | "tiles">;

const TILINGS: Record<PlaygroundTiling, TilingDef> = {
  grid: {
    label: "Grid",
    params: [
      { key: "width", label: "Cell width", min: 10, max: 120, step: 1 },
      { key: "height", label: "Cell height", min: 10, max: 120, step: 1 },
    ],
    defaults: { width: 40, height: 30 },
    rotates: true,
  },
  runningBond: {
    label: "Running bond",
    params: [
      { key: "width", label: "Brick width", min: 10, max: 120, step: 1 },
      { key: "height", label: "Brick height", min: 10, max: 120, step: 1 },
      { key: "offset", label: "Row offset", min: 0, max: 1, step: 0.05 },
    ],
    defaults: { width: 45, height: 30, offset: 0.5 },
    rotates: true,
  },
  herringbone: {
    label: "Herringbone",
    params: [
      { key: "length", label: "Length", min: 20, max: 160, step: 1 },
      { key: "width", label: "Width", min: 10, max: 80, step: 1 },
    ],
    defaults: { length: 60, width: 30 },
    rotates: true,
  },
  basketweave: {
    label: "Basketweave",
    params: [
      { key: "length", label: "Block size", min: 20, max: 160, step: 1 },
      { key: "strips", label: "Strips per block", min: 1, max: 5, step: 1 },
    ],
    defaults: { length: 60, strips: 2 },
    rotates: true,
  },
  hexagonal: {
    label: "Hexagons",
    params: [{ key: "size", label: "Size", min: 8, max: 80, step: 1 }],
    defaults: { size: 26, orientation: "pointy" },
    rotates: true,
  },
  triangular: {
    label: "Triangles",
    params: [{ key: "size", label: "Edge length", min: 8, max: 100, step: 1 }],
    defaults: { size: 34 },
    rotates: true,
  },
  rhombille: {
    label: "Rhombille",
    params: [{ key: "size", label: "Edge length", min: 8, max: 100, step: 1 }],
    defaults: { size: 22 },
    rotates: true,
  },
  octagonSquare: {
    label: "Octagons",
    params: [{ key: "size", label: "Edge length", min: 8, max: 100, step: 1 }],
    defaults: { size: 18 },
    rotates: true,
  },
  trihexagonal: {
    label: "Trihexagonal",
    params: [{ key: "size", label: "Edge length", min: 8, max: 100, step: 1 }],
    defaults: { size: 20 },
    rotates: true,
  },
  rhombitrihexagonal: {
    label: "Hex + squares",
    params: [{ key: "size", label: "Edge length", min: 8, max: 100, step: 1 }],
    defaults: { size: 14 },
    rotates: true,
  },
  cairo: {
    label: "Cairo",
    params: [{ key: "size", label: "Grid size", min: 10, max: 120, step: 1 }],
    defaults: { size: 40 },
    rotates: true,
  },
  hopscotch: {
    label: "Hopscotch",
    params: [
      { key: "large", label: "Large square", min: 10, max: 120, step: 1 },
      { key: "small", label: "Small square", min: 5, max: 120, step: 1 },
    ],
    defaults: { large: 45, small: 22 },
    rotates: true,
  },
  pinwheel: {
    label: "Pinwheel",
    params: [
      { key: "length", label: "Length", min: 20, max: 160, step: 1 },
      { key: "width", label: "Width", min: 10, max: 80, step: 1 },
    ],
    defaults: { length: 55, width: 25 },
    rotates: true,
  },
  flemishBond: {
    label: "Flemish bond",
    params: [
      { key: "length", label: "Stretcher", min: 10, max: 120, step: 1 },
      { key: "header", label: "Header", min: 5, max: 80, step: 1 },
      { key: "height", label: "Course height", min: 8, max: 80, step: 1 },
    ],
    defaults: { length: 40, header: 20, height: 18 },
    rotates: true,
  },
  chevron: {
    label: "Chevron",
    params: [
      { key: "length", label: "Length", min: 20, max: 160, step: 1 },
      { key: "width", label: "Width", min: 8, max: 80, step: 1 },
      { key: "angle", label: "Angle (°)", min: 15, max: 75, step: 1 },
    ],
    defaults: { length: 60, width: 20, angle: 45 },
    rotates: true,
  },
  fishScale: {
    label: "Fish scale",
    params: [{ key: "size", label: "Scale width", min: 10, max: 120, step: 1 }],
    defaults: { size: 36 },
    rotates: true,
  },
  jigsaw: {
    label: "Jigsaw",
    params: [
      { key: "size", label: "Piece size", min: 12, max: 120, step: 1 },
      { key: "seed", label: "Seed", min: 1, max: 999, step: 1 },
    ],
    defaults: { size: 30, seed: 1 },
    rotates: false,
  },
  voronoi: {
    label: "Voronoi",
    params: [
      { key: "size", label: "Cell size", min: 10, max: 100, step: 1 },
      { key: "relax", label: "Evenness", min: 0, max: 8, step: 1 },
      { key: "seed", label: "Seed", min: 1, max: 999, step: 1 },
    ],
    defaults: { size: 36, relax: 2, seed: 1 },
    rotates: false,
  },
  delaunay: {
    label: "Triangulated",
    params: [
      { key: "size", label: "Spacing", min: 12, max: 100, step: 1 },
      { key: "relax", label: "Evenness", min: 0, max: 8, step: 1 },
      { key: "seed", label: "Seed", min: 1, max: 999, step: 1 },
    ],
    defaults: { size: 40, relax: 2, seed: 1 },
    rotates: false,
  },
  ashlar: {
    label: "Ashlar",
    params: [
      { key: "height", label: "Course height", min: 8, max: 80, step: 1 },
      { key: "minLength", label: "Min length", min: 8, max: 120, step: 1 },
      { key: "maxLength", label: "Max length", min: 10, max: 200, step: 1 },
      { key: "heightVariation", label: "Height variation", min: 0, max: 0.9, step: 0.05 },
      { key: "seed", label: "Seed", min: 1, max: 999, step: 1 },
    ],
    defaults: { height: 22, minLength: 20, maxLength: 70, heightVariation: 0.3, seed: 1 },
    rotates: false,
  },
  penrose: {
    label: "Penrose",
    params: [{ key: "size", label: "Edge length", min: 6, max: 80, step: 1 }],
    defaults: { size: 22, variant: "rhombs" },
    rotates: true,
    centred: true,
  },
  hat: {
    label: "Hat",
    params: [{ key: "size", label: "Tile width", min: 10, max: 100, step: 1 }],
    defaults: { size: 30 },
    rotates: true,
    centred: true,
  },
  spectre: {
    label: "Spectre",
    params: [{ key: "size", label: "Tile width", min: 10, max: 100, step: 1 }],
    defaults: { size: 30 },
    rotates: true,
    centred: true,
  },
  isohedral: {
    label: "Escher (isohedral)",
    params: [
      { key: "size", label: "Tile width", min: 15, max: 150, step: 1 },
      { key: "amount", label: "Edge curve", min: 0, max: 0.4, step: 0.01 },
    ],
    defaults: { ih: 41, size: 50, amount: 0.15, edges: "wave" },
    rotates: true,
  },
  mondrian: {
    label: "Mondrian",
    params: [
      { key: "minSize", label: "Min side", min: 10, max: 100, step: 1 },
      { key: "maxSize", label: "Max side", min: 20, max: 200, step: 1 },
      { key: "splitChance", label: "Extra splits", min: 0, max: 1, step: 0.05 },
      { key: "snap", label: "Snap to", min: 0, max: 20, step: 1 },
      { key: "seed", label: "Seed", min: 1, max: 999, step: 1 },
    ],
    defaults: { minSize: 30, maxSize: 90, splitChance: 0.4, snap: 5, seed: 3 },
    rotates: false,
  },
};

type Content = "photos" | "cards" | "colors" | "picture" | "mosaic";

type RegionShape = "rectangle" | "l" | "arch" | "stairs" | "hexagon";
type HoleSet = "none" | "window-door" | "sockets" | "round";
type Pt = { x: number; y: number };

/** Example region outlines in a w × h box. */
function regionShape(shape: RegionShape, w: number, h: number): Pt[] | { x: number; y: number; width: number; height: number } {
  switch (shape) {
    case "rectangle":
      return { x: 0, y: 0, width: w, height: h };
    case "l":
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h * 0.45 }, { x: w * 0.45, y: h * 0.45 }, { x: w * 0.45, y: h }, { x: 0, y: h }];
    case "arch": {
      // A rectangle with a semicircular top, as short segments.
      const r = Math.min(w / 2, h);
      const top = Array.from({ length: 33 }, (_, i) => {
        const a = Math.PI + (i / 32) * Math.PI;
        return { x: w / 2 + Math.cos(a) * (w / 2), y: r + Math.sin(a) * r };
      });
      return [...top, { x: w, y: h }, { x: 0, y: h }];
    }
    case "stairs": {
      const steps = 6;
      const pts: Pt[] = [{ x: 0, y: h }];
      for (let i = 0; i < steps; i++) pts.push({ x: (w / steps) * i, y: h - (h / steps) * (i + 1) }, { x: (w / steps) * (i + 1), y: h - (h / steps) * (i + 1) });
      pts.push({ x: w, y: h });
      return pts;
    }
    case "hexagon":
      return Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * 2 * Math.PI;
        return { x: w / 2 + (Math.cos(a) * w) / 2, y: h / 2 + (Math.sin(a) * h) / 2 };
      });
  }
}

/** Example holes in a w × h box. */
function holesFor(set: HoleSet, w: number, h: number): (Pt[] | { x: number; y: number; width: number; height: number })[] {
  switch (set) {
    case "none":
      return [];
    case "window-door":
      return [
        { x: w * 0.58, y: h * 0.2, width: w * 0.24, height: h * 0.3 },
        { x: w * 0.12, y: h * 0.42, width: w * 0.16, height: h * 0.58 },
      ];
    case "sockets":
      return Array.from({ length: 5 }, (_, i) => ({ x: w * (0.1 + i * 0.18), y: h * 0.75, width: w * 0.05, height: h * 0.06 }));
    case "round":
      return [Array.from({ length: 40 }, (_, i) => {
        const a = (i / 40) * 2 * Math.PI;
        const r = Math.min(w, h) * 0.18;
        return { x: w * 0.5 + Math.cos(a) * r, y: h * 0.45 + Math.sin(a) * r };
      })];
  }
}

// Ways to color tiles without content, using the core fill helpers.
const EMPTY_FILLS = {
  neutral: neutralPalette,
  palette: paletteFill(defaultPalette),
  gradient: gradientFill(["#0a9396", "#e9d8a6", "#ee9b00"], { angle: 30 }),
  radial: gradientFill(["#e9d8a6", "#94d2bd", "#005f73"], { shape: "radial" }),
  shape: protoTileFill(["#d6d3d1", "#a8a29e", "#e7e5e4", "#78716c"]),
  random: randomFill(["#e7e5e4", "#d6d3d1", "#c4bfba", "#f5f5f4"], 1),
  transparent: "transparent",
} satisfies Record<string, FillSource>;
type EmptyFill = keyof typeof EMPTY_FILLS;

// A box of mosaic tile colors for the "Limited tile colors" option.
const MOSAIC_PALETTE = ["#f4f1ea", "#e9d8a6", "#c9a66b", "#8c5a3c", "#94d2bd", "#0a9396", "#005f73", "#e5989b", "#b5838d", "#6d6875", "#9b2226", "#2b2d42"];
const CONTENT: [Content, string][] = [
  ["photos", "Photos"],
  ["cards", "Text cards"],
  ["colors", "Plain colors"],
  ["picture", "One picture"],
  ["mosaic", "Mosaic"],
];
const CARD_WORDS = ["Hello", "Tiles", "Any content", "Buttons", "Text", "Video", "Charts", "Links", "Cards", "Forms"];

/** Isohedral playground params: shape parameters are stored as p0, p1, … next to ih. */
function isohedralSpec(p: Record<string, number | string>) {
  const ih = Number(p.ih);
  const info = isohedralInfo(ih);
  const shape = info.defaultParameters.map((d, i) => (p[`p${i}`] === undefined ? d : Number(p[`p${i}`])));
  return { type: "isohedral", ih, size: Number(p.size), amount: Number(p.amount), edges: p.edges, params: shape };
}

export function App() {
  const [type, setType] = useState<PlaygroundTiling>("herringbone");
  const [params, setParams] = useState(() =>
    Object.fromEntries(Object.entries(TILINGS).map(([k, d]) => [k, { ...d.defaults }])) as Record<PlaygroundTiling, Record<string, number | string>>,
  );
  const [wall, setWall] = useState({ width: 240, height: 150 });
  const [shape, setShape] = useState<RegionShape>("rectangle");
  const [holeSet, setHoleSet] = useState<HoleSet>("none");
  const [featureTiles, setFeatureTiles] = useState(0); // 0: no featured tile
  const [mosaicPalette, setMosaicPalette] = useState(false);
  const [matchShapes, setMatchShapes] = useState<"off" | "placement" | "shape">("off");
  const [safe, setSafe] = useState(false);
  const [reliefMode, setReliefMode] = useState<"off" | "bevel" | "shadow">("off");
  const [light, setLight] = useState(315);
  const [activated, setActivated] = useState<string>();
  const [animateChanges, setAnimateChanges] = useState(true);
  // Hit testing: the tile under the pointer, snapping to the nearest one from the grout.
  const [pointer, setPointer] = useState<{ id: string; index: number; inGap: boolean }>();
  const [gap, setGap] = useState(2);
  const [margin, setMargin] = useState(4);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [edges, setEdges] = useState<EdgeMode>("clip");
  const [minFill, setMinFill] = useState(0.25);
  const [content, setContent] = useState<Content>("photos");
  const [uploads, setUploads] = useState<string[]>([]);
  const [background, setBackground] = useState("#f4f1ea");
  const [itemCount, setItemCount] = useState(0); // 0: one item per tile
  const [contentCells, setContentCells] = useState<"all" | "whole">("all");
  const [placement, setPlacement] = useState<ContentPlacement>("reading");
  const [fitTiles, setFitTiles] = useState(false);
  const [emptyFill, setEmptyFill] = useState<EmptyFill>("neutral");

  const def = TILINGS[type];
  const tiling = (type === "isohedral" ? isohedralSpec(params.isohedral) : { type, ...params[type] }) as TilingSpec;
  const options: LayoutOptions = {
    region: regionShape(shape, wall.width, wall.height),
    ...(holeSet !== "none" ? { holes: holesFor(holeSet, wall.width, wall.height) } : {}),
    ...(featureTiles > 0 ? { features: [{ tiles: featureTiles }] } : {}),
    tiling,
    gap,
    margin,
    cornerRadius,
    rotation: def.rotates ? rotation : 0,
    ...(def.centred ? { origin: { x: wall.width / 2, y: wall.height / 2 } } : {}),
    edges,
    minFill,
  };

  // Raised tiles: a lit bevel, plus a shadow into the grout sized to the gap.
  const relief =
    reliefMode === "off" ? undefined : { light, ...(reliefMode === "shadow" ? { shadow: Math.max(1, gap * 0.6) } : {}) };

  const itemsShown = content === "photos" || content === "cards";
  const fitTo = fitTiles && itemCount > 0 && itemsShown ? itemCount : 0;
  const optionsKey = JSON.stringify(options);
  const result = useMemo((): { layout: Layout } | { error: string } => {
    try {
      // fitCount scales the pattern so there are about `fitTo` tiles for content.
      return { layout: fitTo ? fitCount(options, fitTo, { cells: contentCells }).layout : createLayout(options) };
    } catch (e) {
      return { error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, fitTo, contentCells]);

  const photos = useMemo(() => (uploads.length ? uploads : placeholderPhotos(60)), [uploads]);
  const layout = "layout" in result ? result.layout : undefined;
  // "One picture": your first photo, or a wide placeholder, across all the tiles.
  const picture = uploads[0] ?? photos[0]!;
  // "Mosaic": each tile takes the average color of the picture under it.
  const mosaic = useImageFill(content === "mosaic" ? picture : undefined, { palette: mosaicPalette ? MOSAIC_PALETTE : undefined });
  // Photo shapes, for matching photos to tile shapes.
  // Also with safe areas, so each photo's box has its shape and shows it whole.
  const photoAspects = useImageAspects(content === "photos" && (matchShapes !== "off" || safe) ? photos : undefined);
  const cellFill = content === "colors" ? defaultPalette : content === "mosaic" ? (mosaic ?? neutralPalette) : EMPTY_FILLS[emptyFill];
  const colors = useMemo(() => (layout ? colorCells(layout, defaultPalette.length) : []), [layout]);
  const colorOf = (i: number) => defaultPalette[colors[i] ?? 0]!;

  // Any React content works as children: one child per tile, in reading order.
  const numItems = layout ? (itemCount > 0 ? itemCount : layout.cells.length) : 0;
  const childAspects = photoAspects && Array.from({ length: numItems }, (_, i) => photoAspects[i % photoAspects.length]!);
  const children = Array.from({ length: itemsShown ? numItems : 0 }, (_, i) => {
    if (content === "photos") return <img key={i} src={photos[i % photos.length]} alt="" style={coverStyle} className="photo" />;
    if (content === "cards")
      return (
        // With safe areas the tile carries the color (cellStyle) and the card only the text.
        <div key={i} className="card" style={{ background: safe ? undefined : colorOf(i) }}>
          <strong>{i + 1}</strong>
          <span>{CARD_WORDS[i % CARD_WORDS.length]}</span>
        </div>
      );
    return null;
  });

  const setParam = (key: string, value: number | string) => setParams((p) => ({ ...p, [type]: { ...p[type], [key]: value } }));

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Data URLs (not blob: URLs) so downloaded SVGs stay self-contained.
    const urls = await Promise.all(
      files.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(f);
          }),
      ),
    );
    setUploads(urls);
    setContent("photos");
  };

  // The same picture as SVG or PNG.
  const exportOptions = () => ({
      images: content === "photos" ? (itemCount > 0 ? photos.slice(0, itemCount) : photos) : undefined,
      imageAspects: itemCount > 0 ? photoAspects?.slice(0, itemCount) : safe ? photoAspects : undefined,
      imageFit: safe ? "contain" : "cover",
      choose: matchShapes === "shape" ? "shape" : "placement",
      repeatImages: itemCount === 0,
      contentCells,
      placement,
      fill: cellFill,
      backdrop: content === "picture" ? picture : undefined,
      background,
      relief,
      imageAlts: content === "photos" ? photos.map((_, i) => `Photo ${i + 1}`) : undefined,
  } as const);
  const save = (blob: Blob, ext: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `andamento-${type}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const download = () => {
    if (!layout) return;
    save(new Blob([renderToString(layout, exportOptions())], { type: "image/svg+xml" }), "svg");
  };
  const downloadPng = async () => {
    if (!layout) return;
    // 1600 px wide, at twice the density for a sharp picture.
    save(await renderToPng(layout, { ...exportOptions(), width: 1600, pixelRatio: 2 }), "png");
  };

  return (
    <div className="app">
      <aside className="panel">
        <h1>Andamento</h1>
        <p className="sub">Tiling layouts with any content</p>

        <section>
          <h2>Region</h2>
          <Slider label="Width" min={50} max={500} step={5} value={wall.width} onChange={(v) => setWall({ ...wall, width: v })} />
          <Slider label="Height" min={50} max={400} step={5} value={wall.height} onChange={(v) => setWall({ ...wall, height: v })} />
          <label className="row">
            <span>Shape</span>
            <select value={shape} onChange={(e) => setShape(e.target.value as RegionShape)}>
              <option value="rectangle">Rectangle</option>
              <option value="l">L-shape</option>
              <option value="arch">Arch</option>
              <option value="stairs">Under the stairs</option>
              <option value="hexagon">Hexagon</option>
            </select>
          </label>
          <label className="row">
            <span>Holes</span>
            <select value={holeSet} onChange={(e) => setHoleSet(e.target.value as HoleSet)}>
              <option value="none">None</option>
              <option value="window-door">Window and door</option>
              <option value="sockets">Sockets</option>
              <option value="round">Round window</option>
            </select>
          </label>
          <label className="row">
            <span>Background</span>
            <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} />
          </label>
        </section>

        <section>
          <h2>Pattern</h2>
          <div className="chips">
            {(Object.keys(TILINGS) as PlaygroundTiling[]).map((t) => (
              <button key={t} className={t === type ? "chip on" : "chip"} onClick={() => setType(t)}>
                {TILINGS[t].label}
              </button>
            ))}
          </div>
          {def.params.map((p) => (
            <Slider key={p.key} label={p.label} min={p.min} max={p.max} step={p.step} value={Number(params[type][p.key])} onChange={(v) => setParam(p.key, v)} />
          ))}
          {type === "hexagonal" && (
            <label className="row">
              <span>Orientation</span>
              <select value={String(params.hexagonal.orientation)} onChange={(e) => setParam("orientation", e.target.value)}>
                <option value="pointy">Pointy top</option>
                <option value="flat">Flat top</option>
              </select>
            </label>
          )}
          {type === "isohedral" && (
            <>
              <label className="row">
                <span>Type</span>
                <select
                  value={String(params.isohedral.ih)}
                  onChange={(e) =>
                    // A new type has its own shape parameters: drop the old ones.
                    setParams((p) => ({ ...p, isohedral: { size: p.isohedral.size, amount: p.isohedral.amount, edges: p.isohedral.edges, ih: Number(e.target.value) } }))
                  }
                >
                  {isohedralTypes.map((ih) => (
                    <option key={ih} value={ih}>
                      IH{ih} ({isohedralInfo(ih).edgeKinds.join("")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="row">
                <span>Edges</span>
                <select value={String(params.isohedral.edges)} onChange={(e) => setParam("edges", e.target.value)}>
                  <option value="wave">Wave</option>
                  <option value="straight">Straight</option>
                </select>
              </label>
              {isohedralInfo(Number(params.isohedral.ih)).defaultParameters.map((d, i) => (
                <Slider
                  key={`${params.isohedral.ih}-${i}`}
                  label={`Shape ${i + 1}`}
                  min={Number((d - 0.5).toFixed(2))}
                  max={Number((d + 0.5).toFixed(2))}
                  step={0.01}
                  value={params.isohedral[`p${i}`] === undefined ? d : Number(params.isohedral[`p${i}`])}
                  onChange={(v) => setParam(`p${i}`, v)}
                />
              ))}
            </>
          )}
          {type === "penrose" && (
            <label className="row">
              <span>Tiles</span>
              <select value={String(params.penrose.variant)} onChange={(e) => setParam("variant", e.target.value)}>
                <option value="rhombs">Rhombs</option>
                <option value="kitesAndDarts">Kites and darts</option>
              </select>
            </label>
          )}
          {def.rotates &&<Slider label="Rotation (°)" min={-90} max={90} step={1} value={rotation} onChange={setRotation} />}
        </section>

        <section>
          <h2>Spacing & edges</h2>
          <Slider label="Gap" min={0} max={10} step={0.5} value={gap} onChange={setGap} />
          <Slider label="Margin" min={0} max={30} step={1} value={margin} onChange={setMargin} />
          <Slider label="Corner radius" min={0} max={20} step={0.5} value={cornerRadius} onChange={setCornerRadius} />
          <label className="row">
            <span>Relief</span>
            <select value={reliefMode} onChange={(e) => setReliefMode(e.target.value as typeof reliefMode)}>
              <option value="off">Flat</option>
              <option value="bevel">Bevelled tiles</option>
              <option value="shadow">Bevel + shadow in grout</option>
            </select>
          </label>
          <label className="row">
            <span>Animate changes</span>
            <input type="checkbox" checked={animateChanges} onChange={(e) => setAnimateChanges(e.target.checked)} />
          </label>
          {reliefMode !== "off" && <Slider label="Light from (degrees)" min={0} max={355} step={5} value={light} onChange={setLight} />}
          <Slider label="Featured tile (tiles merged)" min={0} max={12} step={1} value={featureTiles} onChange={setFeatureTiles} />
          <label className="row">
            <span>Edge tiles</span>
            <select value={edges} onChange={(e) => setEdges(e.target.value as EdgeMode)}>
              <option value="clip">Cut to region</option>
              <option value="inside">Whole tiles only</option>
              <option value="overflow">Let them overhang</option>
            </select>
          </label>
          {edges !== "inside" && <Slider label="Drop slivers under" min={0} max={0.9} step={0.05} value={minFill} onChange={setMinFill} />}
        </section>

        <section>
          <h2>Content</h2>
          <div className="chips">
            {CONTENT.map(([k, label]) => (
              <button key={k} className={k === content ? "chip on" : "chip"} onClick={() => setContent(k)}>
                {label}
              </button>
            ))}
          </div>
          {content === "mosaic" && (
            <label className="row">
              <span>Limited tile colors</span>
              <input type="checkbox" checked={mosaicPalette} onChange={(e) => setMosaicPalette(e.target.checked)} />
            </label>
          )}
          {itemsShown && (
            <>
              <Slider label="Items (0 = every tile)" min={0} max={60} step={1} value={itemCount} onChange={setItemCount} />
              <label className="row">
                <span>Content in</span>
                <select value={contentCells} onChange={(e) => setContentCells(e.target.value as "all" | "whole")}>
                  <option value="all">All tiles</option>
                  <option value="whole">Whole tiles only</option>
                </select>
              </label>
              <label className="row">
                <span>Keep inside tile shapes</span>
                <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
              </label>
              {itemCount > 0 && (
                <label className="row">
                  <span>Fit tiles to items</span>
                  <input type="checkbox" checked={fitTiles} onChange={(e) => setFitTiles(e.target.checked)} />
                </label>
              )}
              <label className="row">
                <span>Empty tiles</span>
                <select value={emptyFill} onChange={(e) => setEmptyFill(e.target.value as EmptyFill)}>
                  {Object.keys(EMPTY_FILLS).map((k) => (
                    <option key={k} value={k}>
                      {k[0]!.toUpperCase() + k.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              {content === "photos" && (
                <label className="row">
                  <span>Match photo shapes</span>
                  <select value={matchShapes} onChange={(e) => setMatchShapes(e.target.value as typeof matchShapes)}>
                    <option value="off">Off</option>
                    <option value="placement">Arrange within placement</option>
                    <option value="shape">Pick tiles by shape</option>
                  </select>
                </label>
              )}
              <label className="row">
                <span>Placement</span>
                <select value={placement} onChange={(e) => setPlacement(e.target.value as ContentPlacement)}>
                  <option value="reading">Reading order</option>
                  <option value="center">Centre</option>
                  <option value="spread">Spread out</option>
                </select>
              </label>
            </>
          )}
          <label className="upload">
            <input type="file" accept="image/*" multiple onChange={onUpload} />
            <span>{uploads.length ? `${uploads.length} photos loaded — replace…` : "Use your own photos…"}</span>
          </label>
          {uploads.length > 0 && (
            <button className="link" onClick={() => setUploads([])}>
              Back to placeholders
            </button>
          )}
        </section>
      </aside>

      <main className="stage">
        <div className="toolbar">
          {"layout" in result ? (
            <span>
              <strong>{result.layout.cells.length}</strong> tiles · {result.layout.cells.filter((c) => c.boundary).length} at the edge
            </span>
          ) : (
            <span className="error">{result.error}</span>
          )}
          <span className="hint" aria-live="polite">
            {pointer
              ? `Pointer: tile ${pointer.index + 1}${pointer.inGap ? " (in the grout, nearest)" : ""}`
              : activated
                ? `Opened ${activated}`
                : "Tab into the layout, then use the arrow keys"}
          </span>
          <button onClick={download} disabled={!("layout" in result)}>
            Download SVG
          </button>
          <button onClick={downloadPng} disabled={!("layout" in result)}>
            Download PNG
          </button>
        </div>
        <div className="canvas">
          {layout && (
            <TileLayout
              layout={layout}
              background={background}
              relief={relief}
              navigable
              animate={animateChanges}
              cellLabel={(_cell, s) => (content === "photos" ? `Photo ${s.slot + 1}` : content === "cards" ? `Card ${s.slot + 1}: ${CARD_WORDS[s.slot % CARD_WORDS.length]}` : undefined)}
              onCellActivate={(_cell, s) => setActivated(content === "photos" ? `Photo ${s.slot + 1}` : `Card ${s.slot + 1}`)}
              className={safe && content === "cards" ? "region show-safe" : "region"}
              style={{ "--ratio": layout.bounds.width / layout.bounds.height } as CSSProperties}
              cellClassName={(cell) => (cell.id === pointer?.id ? "tile pointed" : "tile")}
              onPointerMove={(e) => {
                const hit = cellFromPointer(layout, e, { tolerance: Math.max(gap, 2) });
                if (!hit) return setPointer(undefined);
                const exact = cellFromPointer(layout, e) === hit;
                if (hit.id !== pointer?.id || exact === pointer.inGap) setPointer({ id: hit.id, index: hit.index, inGap: !exact });
              }}
              onPointerLeave={() => setPointer(undefined)}
              contentCells={contentCells}
              placement={placement}
              fill={cellFill}
              backdrop={content === "picture" ? <img src={picture} alt="" style={coverStyle} /> : undefined}
              aspects={childAspects}
              safeArea={safe}
              cellStyle={safe && content === "cards" ? (_cell, s) => (s.slot >= 0 ? { background: colorOf(s.slot) } : {}) : undefined}
              choose={matchShapes === "shape" ? "shape" : "placement"}
              aria-label={`${def.label} layout`}
            >
              {children}
            </TileLayout>
          )}
        </div>
        <details className="code">
          <summary>Options</summary>
          <pre>{JSON.stringify(options, null, 2)}</pre>
        </details>
      </main>
    </div>
  );
}

function Slider(props: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>
        {props.label}
        <output>{Number(props.value.toFixed(3))}</output>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}
