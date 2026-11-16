import { colorCells, type Cell, type Layout, type Polygon } from "@andamento/core";

export const defaultPalette = ["#e9d8a6", "#94d2bd", "#ee9b00", "#0a9396", "#ca6702", "#bb3e03", "#ae2012", "#005f73"];

export type ImageSource = readonly string[] | ((cell: Cell) => string | undefined);
export type FillSource = string | readonly string[] | ((cell: Cell) => string);

export interface RenderOptions {
  /** Photos: an array assigned in reading order, or a function per cell. */
  images?: ImageSource;
  /** Reuse the images array from the start when there are more cells than photos. */
  repeatImages?: boolean;
  /**
   * Cell colour when there is no photo: a colour, a palette (neighbouring cells get
   * different entries), or a function. Defaults to `defaultPalette`.
   */
  fill?: FillSource;
  /** Outline drawn on top of each cell. */
  stroke?: string;
  strokeWidth?: number;
  /** Wall colour, painted over the whole region. Omit for transparent. */
  background?: string;
  /** Prefix for generated element ids; set it when several layouts share a page. */
  idPrefix?: string;
  /** Decimal places for coordinates. Defaults to 3. */
  precision?: number;
  /** Width/height attributes of the <svg>; it always gets a viewBox. */
  width?: string | number;
  height?: string | number;
  /** Accessible title. */
  title?: string;
}

/** `d` attribute for a polygon. */
export function polygonToPath(p: Polygon, precision = 3): string {
  if (p.length === 0) return "";
  const f = (n: number) => {
    const s = n.toFixed(precision);
    // Trim trailing zeros: "12.500" -> "12.5", "3.000" -> "3", "-0" -> "0".
    const t = s.includes(".") ? s.replace(/\.?0+$/, "") : s;
    return t === "-0" ? "0" : t;
  };
  return "M" + p.map((v) => `${f(v.x)} ${f(v.y)}`).join("L") + "Z";
}

export interface CellStyle {
  fill: string;
  image?: string;
}

/** Resolve the fill colour and photo for every cell (shared by the SVG and React renderers). */
export function resolveCellStyles(layout: Layout, opts: Pick<RenderOptions, "images" | "repeatImages" | "fill"> = {}): CellStyle[] {
  const fill = opts.fill ?? defaultPalette;
  let fillFor: (c: Cell) => string;
  if (typeof fill === "string") fillFor = () => fill;
  else if (typeof fill === "function") fillFor = fill;
  else {
    const palette = fill.length ? fill : defaultPalette;
    const colors = colorCells(layout, palette.length);
    fillFor = (c) => palette[colors[c.index]!]!;
  }

  const images = opts.images;
  const imageFor = (c: Cell): string | undefined => {
    if (!images) return undefined;
    if (typeof images === "function") return images(c);
    if (images.length === 0) return undefined;
    if (c.index < images.length) return images[c.index];
    return opts.repeatImages ? images[c.index % images.length] : undefined;
  };

  return layout.cells.map((c) => ({ fill: fillFor(c), image: imageFor(c) }));
}

/** Minimal element tree, serialisable to a string or built into DOM nodes. */
export interface SvgNode {
  tag: string;
  attrs: Record<string, string | number | undefined>;
  children: (SvgNode | string)[];
}

const el = (tag: string, attrs: SvgNode["attrs"] = {}, children: SvgNode["children"] = []): SvgNode => ({
  tag,
  attrs,
  children,
});

export function toSvgTree(layout: Layout, opts: RenderOptions = {}): SvgNode {
  const precision = opts.precision ?? 3;
  const prefix = opts.idPrefix ?? "andamento";
  const { x, y, width, height } = layout.bounds;
  const styles = resolveCellStyles(layout, opts);
  const r = (n: number) => Number(n.toFixed(precision));

  const children: SvgNode["children"] = [];
  if (opts.title) children.push(el("title", {}, [opts.title]));
  if (opts.background) {
    children.push(el("path", { d: polygonToPath(layout.region, precision), fill: opts.background, class: "andamento-wall" }));
  }

  layout.cells.forEach((cell, i) => {
    const d = polygonToPath(cell.polygon, precision);
    const style = styles[i]!;
    const parts: SvgNode[] = [el("path", { d, fill: style.fill })];
    if (style.image) {
      const clipId = `${prefix}-clip-${cell.index}`;
      parts.unshift(el("clipPath", { id: clipId }, [el("path", { d })]));
      parts.push(
        el("image", {
          href: style.image,
          x: r(cell.bbox.x),
          y: r(cell.bbox.y),
          width: r(cell.bbox.width),
          height: r(cell.bbox.height),
          preserveAspectRatio: "xMidYMid slice",
          "clip-path": `url(#${clipId})`,
        }),
      );
    }
    if (opts.stroke) {
      parts.push(el("path", { d, fill: "none", stroke: opts.stroke, "stroke-width": opts.strokeWidth ?? 1 }));
    }
    children.push(el("g", { class: "andamento-cell", "data-cell-id": cell.id, "data-index": cell.index }, parts));
  });

  return el(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `${r(x)} ${r(y)} ${r(width)} ${r(height)}`,
      width: opts.width,
      height: opts.height,
      role: opts.title ? "img" : undefined,
    },
    children,
  );
}

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

export function serialize(node: SvgNode | string): string {
  if (typeof node === "string") return escapeText(node);
  const attrs = Object.entries(node.attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join("");
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${node.children.map(serialize).join("")}</${node.tag}>`;
}

/** Render a layout to a standalone SVG document string. */
export function renderToString(layout: Layout, opts: RenderOptions = {}): string {
  return serialize(toSvgTree(layout, opts));
}

const SVG_NS = "http://www.w3.org/2000/svg";

function build(node: SvgNode | string, doc: Document): Node {
  if (typeof node === "string") return doc.createTextNode(node);
  const elem = doc.createElementNS(SVG_NS, node.tag);
  for (const [k, v] of Object.entries(node.attrs)) {
    if (v !== undefined && k !== "xmlns") elem.setAttribute(k, String(v));
  }
  for (const child of node.children) elem.appendChild(build(child, doc));
  return elem;
}

/** Render a layout to a live <svg> element. */
export function renderToElement(layout: Layout, opts: RenderOptions = {}, doc: Document = globalThis.document): SVGSVGElement {
  if (!doc) throw new Error("renderToElement needs a DOM Document; pass one explicitly outside the browser");
  return build(toSvgTree(layout, opts), doc) as SVGSVGElement;
}
