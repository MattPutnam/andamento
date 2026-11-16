import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";
import { colorCells, createLayout, type EdgeMode, type Layout, type LayoutOptions, type TilingSpec, type TilingType } from "@andamento/core";
import { defaultPalette, renderToString } from "@andamento/svg";
import { TileLayout, coverStyle } from "@andamento/react";
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
}

const TILINGS: Record<TilingType, TilingDef> = {
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

type Content = "photos" | "cards" | "colors";
const CONTENT: [Content, string][] = [
  ["photos", "Photos"],
  ["cards", "Text cards"],
  ["colors", "Plain colours"],
];
const CARD_WORDS = ["Hello", "Tiles", "Any content", "Buttons", "Text", "Video", "Charts", "Links", "Cards", "Forms"];

export function App() {
  const [type, setType] = useState<TilingType>("herringbone");
  const [params, setParams] = useState(() =>
    Object.fromEntries(Object.entries(TILINGS).map(([k, d]) => [k, { ...d.defaults }])) as Record<TilingType, Record<string, number | string>>,
  );
  const [wall, setWall] = useState({ width: 240, height: 150 });
  const [gap, setGap] = useState(2);
  const [margin, setMargin] = useState(4);
  const [cornerRadius, setCornerRadius] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [edges, setEdges] = useState<EdgeMode>("clip");
  const [minFill, setMinFill] = useState(0.25);
  const [content, setContent] = useState<Content>("photos");
  const [uploads, setUploads] = useState<string[]>([]);
  const [background, setBackground] = useState("#f4f1ea");

  const def = TILINGS[type];
  const tiling = { type, ...params[type] } as TilingSpec;
  const options: LayoutOptions = {
    region: { x: 0, y: 0, width: wall.width, height: wall.height },
    tiling,
    gap,
    margin,
    cornerRadius,
    rotation: def.rotates ? rotation : 0,
    edges,
    minFill,
  };

  const optionsKey = JSON.stringify(options);
  const result = useMemo((): { layout: Layout } | { error: string } => {
    try {
      return { layout: createLayout(options) };
    } catch (e) {
      return { error: (e as Error).message };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const photos = useMemo(() => (uploads.length ? uploads : placeholderPhotos(60)), [uploads]);
  const layout = "layout" in result ? result.layout : undefined;
  const colors = useMemo(() => (layout ? colorCells(layout, defaultPalette.length) : []), [layout]);
  const colorOf = (i: number) => defaultPalette[colors[i] ?? 0]!;

  // Any React content works as children: one child per tile, in reading order.
  const children = layout?.cells.map((cell, i) => {
    if (content === "photos") return <img key={i} src={photos[i % photos.length]} alt="" style={coverStyle} className="photo" />;
    if (content === "cards")
      return (
        <div key={i} className="card" style={{ background: colorOf(i) }}>
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

  const download = () => {
    if (!layout) return;
    const svg = renderToString(layout, {
      images: content === "photos" ? photos : undefined,
      repeatImages: true,
      background,
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `andamento-${type}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
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
            <span>Background</span>
            <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} />
          </label>
        </section>

        <section>
          <h2>Pattern</h2>
          <div className="chips">
            {(Object.keys(TILINGS) as TilingType[]).map((t) => (
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
          {def.rotates && <Slider label="Rotation (°)" min={-90} max={90} step={1} value={rotation} onChange={setRotation} />}
        </section>

        <section>
          <h2>Spacing & edges</h2>
          <Slider label="Gap" min={0} max={10} step={0.5} value={gap} onChange={setGap} />
          <Slider label="Margin" min={0} max={30} step={1} value={margin} onChange={setMargin} />
          <Slider label="Corner radius" min={0} max={20} step={0.5} value={cornerRadius} onChange={setCornerRadius} />
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
          <button onClick={download} disabled={!("layout" in result)}>
            Download SVG
          </button>
        </div>
        <div className="canvas">
          {layout && (
            <TileLayout
              layout={layout}
              background={background}
              className="region"
              style={{ "--ratio": layout.bounds.width / layout.bounds.height } as CSSProperties}
              cellClassName="tile"
              cellStyle={content === "colors" ? (cell) => ({ background: colorOf(cell.index) }) : undefined}
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
        <output>{props.value}</output>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}
