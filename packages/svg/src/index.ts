/**
 * Renders a layout to an SVG string or element, to a canvas, or to a PNG.
 *
 * @module @andamento/svg
 */
import { cellShape, contentSlots, coverRect, type Focus, matchSlots, safeArea, paletteFill, type CellFill, roundCorners, type Cell, type ContentCells, type ContentPlacement, type Layout, type Polygon } from "@andamento/core";

import { defaultBevel, reliefPaths, shadowOffset, type ReliefOptions } from "./relief";
export { defaultBevel, reliefLayers, reliefPaths, shadowOffset } from "./relief";
export type { ReliefLayer, ReliefOptions, ReliefPath } from "./relief";

export const defaultPalette = ["#e9d8a6", "#94d2bd", "#ee9b00", "#0a9396", "#ca6702", "#bb3e03", "#ae2012", "#005f73"];

/** Soft neutrals for tiles without content: visible as tiles, but quiet next to photos. */
export const neutralPalette = ["#e7e5e4", "#d6d3d1", "#f5f5f4", "#dedad6", "#ecebe9"];

export type ImageSource = readonly string[] | ((cell: Cell) => string | undefined);
/** A color, a palette (neighboring cells get different entries), or a color per cell. */
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
   * Width / height of each image in `images`. When given, each image goes in a cell of
   * similar shape, to crop as little as possible (see `matchSlots`). Ignored with `repeatImages`.
   */
  imageAspects?: readonly number[];
  /**
   * How each image fills its cell: "cover" (default) fills the cell's bounding box and is
   * cropped to the cell's shape; "contain" shows the whole image inside the cell's safe area
   * (see `safeArea`), uncropped. Give `imageAspects` so the safe area has each image's shape.
   */
  imageFit?: "cover" | "contain";
  /**
   * With `imageFit: "contain"`, for cells an `edges: "window"` layout cuts: fit the image in
   * the whole tile ("tile", the default; partly hidden like the tile) or in the part that
   * shows ("visible"). See `SafeAreaOptions.within`.
   */
  containWithin?: "tile" | "visible";
  /**
   * Focal point of each image in `images` (by position; fractions of its width and height,
   * see `estimateFocus`): what to keep in view when "cover" crops it. It goes as near the
   * middle of what shows of its cell as covering the cell allows (see `coverRect`). Needs
   * each image's shape, from `imageAspects` or the focus's `aspect` (the canvas renderers
   * measure the images themselves).
   */
  imageFocus?: readonly (Focus | undefined)[];
  /** With `imageAspects`: "shape" also picks which cells get images by their shape. */
  choose?: "placement" | "shape";
  /**
   * Cell color when there is no image: a color, a palette (neighboring cells get
   * different entries), or a function. Defaults to `defaultPalette`.
   */
  fill?: FillSource;
  /**
   * Raised tiles: a lit bevel round each tile, and optionally a shadow cast into the grout.
   * `true` for the defaults. See `ReliefOptions`.
   */
  relief?: boolean | ReliefOptions;
  /** Outline drawn on top of each cell. */
  stroke?: string;
  strokeWidth?: number;
  /** Color painted over the whole region. Omit for transparent. */
  background?: string;
  /**
   * One image across all the cells (a URL): drawn once over the layout bounds (cropped to
   * cover them) and clipped to the cells, so each cell shows its piece. Cells' `fill` isn't
   * drawn; per-cell `images` still go on top.
   */
  backdrop?: string;
  /** Prefix for generated element ids; set it when several layouts share a page. */
  idPrefix?: string;
  /** Decimal places for coordinates. Defaults to 3. */
  precision?: number;
  /** Width/height attributes of the <svg>; it always gets a viewBox. */
  width?: string | number;
  height?: string | number;
  /** Accessible title. */
  title?: string;
  /**
   * Text alternative for each image in `images` (by position). Cells showing an image with
   * one become labeled images to assistive technology, and the SVG a group of them; the
   * other cells are hidden as decoration.
   */
  imageAlts?: readonly string[];
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
 * `d` attribute for a cell's outline, including the layout's corner rounding and any holes
 * (as extra subpaths; draw with `fill-rule="evenodd"`). For a window cell this is the
 * whole tile (see `cellShape`); clip it to `viewPath`.
 */
export function cellPath(layout: Layout, cell: Cell, precision = 3): string {
  const s = cellShape(cell);
  return [s.outline, ...s.holes].map((p) => polygonToPath(p, precision, layout.cornerRadius)).join("");
}

/**
 * `d` attribute for the area tiles show in (draw or clip with `evenodd`): `layout.view` in
 * a window layout, else the region with its holes.
 */
export function viewPath(layout: Layout, precision = 3): string {
  if (!layout.view) return regionPath(layout, precision);
  return layout.view.flatMap((v) => [v.outer, ...v.holes]).map((p) => polygonToPath(p, precision)).join("");
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
 * Fill color per cell (by `cell.index`): a color, a palette (neighboring cells get
 * different entries), or a function.
 */
export function resolveFills(layout: Layout, fill: FillSource): string[] {
  if (typeof fill === "string") return layout.cells.map(() => fill);
  const f = typeof fill === "function" ? fill : paletteFill(fill.length ? fill : defaultPalette);
  return layout.cells.map((c) => f(c, layout));
}

type StyleOptions = Pick<RenderOptions, "images" | "repeatImages" | "fill" | "contentCells" | "placement" | "imageAspects" | "choose">;

/** Resolve the fill color and image for every cell (shared by the SVG and React renderers). */
export function resolveCellStyles(layout: Layout, opts: StyleOptions = {}): CellStyle[] {
  const fills = resolveFills(layout, opts.fill ?? defaultPalette);
  const images = opts.images;
  let slots: number[] = layout.cells.map(() => -1);
  if (Array.isArray(images) && images.length > 0) {
    const count = opts.repeatImages ? Infinity : images.length;
    const content = { cells: opts.contentCells, placement: opts.placement, choose: opts.choose };
    slots =
      opts.imageAspects && !opts.repeatImages
        ? matchSlots(layout, images.map((_, i) => opts.imageAspects![i] ?? 1), content)
        : contentSlots(layout, count, content);
  }
  return layout.cells.map((c, i) => {
    const slot = slots[i]!;
    let image: string | undefined;
    if (typeof images === "function") image = images(c);
    else if (images && slot >= 0) image = images[slot % images.length];
    return { fill: fills[i]!, image, slot };
  });
}

/** Minimal element tree, serializable to a string or built into DOM nodes. */
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

  // In a window layout, everything from here on is drawn whole and cut to the view.
  const start = children.length;
  if (opts.backdrop) {
    const clipId = `${prefix}-backdrop`;
    const shapes = layout.cells.map((cell) => el("path", { d: cellPath(layout, cell, precision), "clip-rule": "evenodd" }));
    children.push(el("clipPath", { id: clipId }, shapes));
    children.push(
      el("image", {
        class: "andamento-backdrop",
        href: opts.backdrop,
        x: r(x),
        y: r(y),
        width: r(width),
        height: r(height),
        preserveAspectRatio: "xMidYMid slice",
        "clip-path": `url(#${clipId})`,
      }),
    );
  }

  const relief: ReliefOptions | undefined = opts.relief === true ? {} : opts.relief || undefined;
  const bevel = relief ? (relief.bevel ?? defaultBevel(layout)) : 0;
  const cast = relief && shadowOffset(relief);
  if (cast) {
    // Every tile's shape, moved away from the light and blurred, kept within the region.
    const regionId = `${prefix}-region`;
    const blurId = `${prefix}-shadow`;
    children.push(el("clipPath", { id: regionId }, [el("path", { d: regionPath(layout, precision), "clip-rule": "evenodd" })]));
    children.push(el("filter", { id: blurId, x: "-10%", y: "-10%", width: "120%", height: "120%" }, [el("feGaussianBlur", { stdDeviation: r(cast.blur) })]));
    children.push(
      el("g", { class: "andamento-shadow", "clip-path": `url(#${regionId})` }, [
        el("path", {
          d: layout.cells.map((c) => cellPath(layout, c, precision)).join(""),
          "fill-rule": "evenodd",
          transform: `translate(${r(cast.dx)} ${r(cast.dy)})`,
          fill: "#000",
          "fill-opacity": cast.opacity,
          filter: `url(#${blurId})`,
        }),
      ]),
    );
  }

  layout.cells.forEach((cell, i) => {
    const d = cellPath(layout, cell, precision);
    const style = styles[i]!;
    const holed = !!cell.holes?.length;
    const parts: SvgNode[] = opts.backdrop ? [] : [el("path", { d, fill: style.fill, "fill-rule": holed ? "evenodd" : undefined })];
    if (style.image) {
      const clipId = `${prefix}-clip-${cell.index}`;
      parts.unshift(el("clipPath", { id: clipId }, [el("path", { d, "clip-rule": holed ? "evenodd" : undefined })]));
      const contain = opts.imageFit === "contain";
      const aspect = contain && opts.imageAspects && style.slot >= 0 ? opts.imageAspects[style.slot % opts.imageAspects.length] : undefined;
      const focus = !contain && style.slot >= 0 ? (Array.isArray(opts.images) ? opts.imageFocus?.[style.slot % opts.images.length] : undefined) : undefined;
      const shape = focus ? (opts.imageAspects?.[style.slot % opts.imageAspects.length] ?? focus.aspect) : undefined;
      const box = contain
        ? safeArea(cell, layout, { aspect, within: opts.containWithin })
        : focus && shape
          ? coverRect(cell, layout, { aspect: shape, focus })
          : cellShape(cell).bbox;
      parts.push(
        el("image", {
          href: style.image,
          x: r(box.x),
          y: r(box.y),
          width: r(box.width),
          height: r(box.height),
          preserveAspectRatio: contain ? "xMidYMid meet" : "xMidYMid slice",
          "clip-path": `url(#${clipId})`,
        }),
      );
    }
    if (relief && bevel > 0) {
      for (const p of reliefPaths(layout, cell, relief, bevel, precision)) {
        parts.push(el("path", { class: "andamento-bevel", d: p.d, fill: p.fill, "fill-opacity": p.opacity }));
      }
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
          ...cellA11y(style, opts.imageAlts),
        },
        parts,
      ),
    );
  });
  if (layout.view) {
    const viewId = `${prefix}-view`;
    const body = children.splice(start);
    children.push(el("clipPath", { id: viewId }, [el("path", { d: viewPath(layout, precision), "clip-rule": "evenodd" })]));
    children.push(el("g", { class: "andamento-view", "clip-path": `url(#${viewId})` }, body));
  }

  return el(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `${r(x)} ${r(y)} ${r(width)} ${r(height)}`,
      width: opts.width,
      height: opts.height,
      role: opts.imageAlts?.length ? "group" : opts.title ? "img" : undefined,
    },
    children,
  );
}

/** With `imageAlts`: a cell showing a described image is an image; the rest is decoration. */
export function cellA11y(style: CellStyle, alts: readonly string[] | undefined): { role?: "img"; "aria-label"?: string; "aria-hidden"?: "true" } {
  if (!alts?.length) return {};
  const alt = style.image && style.slot >= 0 ? alts[style.slot % alts.length] : undefined;
  return alt ? { role: "img", "aria-label": alt } : { "aria-hidden": "true" };
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

export { drawLayout, imagesUsed, loadImages, rasterSize, renderToCanvas, renderToPng, tracePolygon } from "./canvas";
export type { CanvasContextLike, CanvasImage, CanvasLike, CanvasRenderOptions, RasterOptions } from "./canvas";
