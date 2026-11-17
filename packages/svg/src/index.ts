import { contentSlots, paletteFill, type CellFill, roundCorners, type Cell, type ContentCells, type ContentPlacement, type Layout, type Polygon } from "@andamento/core";

export const defaultPalette = ["#e9d8a6", "#94d2bd", "#ee9b00", "#0a9396", "#ca6702", "#bb3e03", "#ae2012", "#005f73"];

/** Soft neutrals for tiles without content: visible as tiles, but quiet next to photos. */
export const neutralPalette = ["#e7e5e4", "#d6d3d1", "#f5f5f4", "#dedad6", "#ecebe9"];

export type ImageSource = readonly string[] | ((cell: Cell) => string | undefined);
/** A color, a palette (neighbouring cells get different entries), or a color per cell. */
export type FillSource = string | readonly string[] | CellFill;

export interface RenderOptions {
  /** Images: an array assigned in reading order, or a function per cell. */
  images?: ImageSource;
  /** Reuse the images array from the start when there are more cells than images. */
  repeatImages?: boolean;
  /** Which cells may hold an image from the `images` array (default "all"). */
  contentCells?: ContentCells;
  /** Where the images go when there are fewer than cells (default "reading"). */
  placement?: ContentPlacement;
  /**
   * Cell color when there is no image: a color, a palette (neighbouring cells get
   * different entries), or a function. Defaults to `defaultPalette`.
   */
  fill?: FillSource;
  /** Outline drawn on top of each cell. */
  stroke?: string;
  strokeWidth?: number;
  /** Color painted over the whole region. Omit for transparent. */
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

const formatter = (precision: number) => (n: number) => {
  const s = n.toFixed(precision);
  // Trim trailing zeros: "12.500" -> "12.5", "3.000" -> "3", "-0" -> "0".
  const t = s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  return t === "-0" ? "0" : t;
};

/** `d` attribute for a polygon. With `radius`, corners are rounded with circular arcs. */
export function polygonToPath(p: Polygon, precision = 3, radius = 0): string {
  if (p.length === 0) return "";
  const f = formatter(precision);
  if (radius <= 0) return "M" + p.map((v) => `${f(v.x)} ${f(v.y)}`).join("L") + "Z";
  const parts: string[] = [];
  for (const c of roundCorners(p, radius)) {
    parts.push(`${parts.length ? "L" : "M"}${f(c.start.x)} ${f(c.start.y)}`);
    if (c.radius > 0) {
      const r = f(c.radius);
      parts.push(`A${r} ${r} 0 0 ${c.sweep > 0 ? 1 : 0} ${f(c.end.x)} ${f(c.end.y)}`);
    }
  }
  return parts.join("") + "Z";
}

/**
 * `d` attribute for a cell's visible outline, including the layout's corner rounding and
 * any holes (as extra subpaths; draw with `fill-rule="evenodd"`).
 */
export function cellPath(layout: Layout, cell: Cell, precision = 3): string {
  return [cell.polygon, ...(cell.holes ?? [])].map((p) => polygonToPath(p, precision, layout.cornerRadius)).join("");
}

/** `d` attribute for the region with its holes (draw with `fill-rule="evenodd"`). */
export function regionPath(layout: Layout, precision = 3): string {
  return [layout.region, ...layout.holes].map((p) => polygonToPath(p, precision)).join("");
}

export interface CellStyle {
  fill: string;
  image?: string;
  /** Which item of `images` the cell shows (-1 if none or if `images` is a function). */
  slot: number;
}

/**
 * Fill color per cell (by `cell.index`): a color, a palette (neighbouring cells get
 * different entries), or a function.
 */
export function resolveFills(layout: Layout, fill: FillSource): string[] {
  if (typeof fill === "string") return layout.cells.map(() => fill);
  const f = typeof fill === "function" ? fill : paletteFill(fill.length ? fill : defaultPalette);
  return layout.cells.map((c) => f(c, layout));
}

type StyleOptions = Pick<RenderOptions, "images" | "repeatImages" | "fill" | "contentCells" | "placement">;

/** Resolve the fill color and image for every cell (shared by the SVG and React renderers). */
export function resolveCellStyles(layout: Layout, opts: StyleOptions = {}): CellStyle[] {
  const fills = resolveFills(layout, opts.fill ?? defaultPalette);
  const images = opts.images;
  let slots: number[] = layout.cells.map(() => -1);
  if (Array.isArray(images) && images.length > 0) {
    const count = opts.repeatImages ? Infinity : images.length;
    slots = contentSlots(layout, count, { cells: opts.contentCells, placement: opts.placement });
  }
  return layout.cells.map((c, i) => {
    const slot = slots[i]!;
    let image: string | undefined;
    if (typeof images === "function") image = images(c);
    else if (images && slot >= 0) image = images[slot % images.length];
    return { fill: fills[i]!, image, slot };
  });
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
    children.push(el("path", { d: regionPath(layout, precision), fill: opts.background, "fill-rule": "evenodd", class: "andamento-region" }));
  }

  layout.cells.forEach((cell, i) => {
    const d = cellPath(layout, cell, precision);
    const style = styles[i]!;
    const holed = !!cell.holes?.length;
    const parts: SvgNode[] = [el("path", { d, fill: style.fill, "fill-rule": holed ? "evenodd" : undefined })];
    if (style.image) {
      const clipId = `${prefix}-clip-${cell.index}`;
      parts.unshift(el("clipPath", { id: clipId }, [el("path", { d, "clip-rule": holed ? "evenodd" : undefined })]));
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
    children.push(
      el(
        "g",
        {
          class: "andamento-cell",
          "data-cell-id": cell.id,
          "data-index": cell.index,
          "data-empty": style.image ? undefined : "",
          "data-boundary": cell.boundary ? "" : undefined,
        },
        parts,
      ),
    );
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
