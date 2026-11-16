import { useMemo, useState, type ChangeEvent } from "react";
import { createLayout, type EdgeMode, type Layout, type LayoutOptions, type TilingSpec, type TilingType } from "@andamento/core";
import { renderToString } from "@andamento/svg";
import { TileLayout } from "@andamento/react";
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

export function App() {
  const [type, setType] = useState<TilingType>("herringbone");
  const [params, setParams] = useState(() =>
    Object.fromEntries(Object.entries(TILINGS).map(([k, d]) => [k, { ...d.defaults }])) as Record<TilingType, Record<string, number | string>>,
  );
  const [wall, setWall] = useState({ width: 240, height: 150 });
  const [gap, setGap] = useState(2);
  const [margin, setMargin] = useState(4);
  const [rotation, setRotation] = useState(0);
  const [edges, setEdges] = useState<EdgeMode>("clip");
  const [minFill, setMinFill] = useState(0.25);
  const [showPhotos, setShowPhotos] = useState(true);
  const [uploads, setUploads] = useState<string[]>([]);
  const [wallColor, setWallColor] = useState("#f4f1ea");

  const def = TILINGS[type];
  const tiling = { type, ...params[type] } as TilingSpec;
  const options: LayoutOptions = {
    region: { x: 0, y: 0, width: wall.width, height: wall.height },
    tiling,
    gap,
    margin,
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
  const images = showPhotos ? photos : undefined;

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
    setShowPhotos(true);
  };

  const download = () => {
    if (!("layout" in result)) return;
    const svg = renderToString(result.layout, {
      images,
      repeatImages: true,
      background: wallColor,
      width: `${wall.width}cm`,
      height: `${wall.height}cm`,
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `photo-wall-${type}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="app">
      <aside className="panel">
        <h1>Andamento</h1>
        <p className="sub">Photo wall layouts</p>

        <section>
          <h2>Wall (cm)</h2>
          <Slider label="Width" min={50} max={500} step={5} value={wall.width} onChange={(v) => setWall({ ...wall, width: v })} />
          <Slider label="Height" min={50} max={400} step={5} value={wall.height} onChange={(v) => setWall({ ...wall, height: v })} />
          <label className="row">
            <span>Wall colour</span>
            <input type="color" value={wallColor} onChange={(e) => setWallColor(e.target.value)} />
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
          <label className="row">
            <span>Edge tiles</span>
            <select value={edges} onChange={(e) => setEdges(e.target.value as EdgeMode)}>
              <option value="clip">Cut to wall</option>
              <option value="inside">Whole tiles only</option>
              <option value="overflow">Let them overhang</option>
            </select>
          </label>
          {edges !== "inside" && <Slider label="Drop slivers under" min={0} max={0.9} step={0.05} value={minFill} onChange={setMinFill} />}
        </section>

        <section>
          <h2>Photos</h2>
          <label className="row">
            <span>Show photos</span>
            <input type="checkbox" checked={showPhotos} onChange={(e) => setShowPhotos(e.target.checked)} />
          </label>
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
              <strong>{result.layout.cells.length}</strong> frames · {result.layout.cells.filter((c) => c.boundary).length} at the edge
            </span>
          ) : (
            <span className="error">{result.error}</span>
          )}
          <button onClick={download} disabled={!("layout" in result)}>
            Download SVG
          </button>
        </div>
        <div className="canvas">
          {"layout" in result && (
            <TileLayout
              layout={result.layout}
              images={images}
              repeatImages
              background={wallColor}
              className="wall"
              title={`${def.label} photo wall`}
            />
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
