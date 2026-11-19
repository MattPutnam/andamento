import { cellShape, coverRect, roundCorners, safeArea, type Cell, type Layout, type Polygon, type Rect } from "@andamento/core";
import { resolveCellStyles, type RenderOptions } from "./index";
import { defaultBevel, reliefLayers, shadowOffset, type ReliefOptions } from "./relief";

/**
 * The parts of a 2D canvas context the renderer uses. A browser `CanvasRenderingContext2D`
 * or `OffscreenCanvasRenderingContext2D` fits, and so do Node canvases such as
 * `@napi-rs/canvas` or `skia-canvas`.
 */
export interface CanvasContextLike {
  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number, counterclockwise?: boolean): void;
  closePath(): void;
  fill(fillRule?: "nonzero" | "evenodd"): void;
  clip(fillRule?: "nonzero" | "evenodd"): void;
  stroke(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: never, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineJoin: unknown;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

/** A loaded image: an HTMLImageElement, ImageBitmap, canvas, or a Node canvas image. */
export type CanvasImage = { width: number; height: number };

export interface CanvasRenderOptions
  extends Pick<
    RenderOptions,
    "images" | "repeatImages" | "contentCells" | "placement" | "imageAspects" | "choose" | "imageFit" | "containWithin" | "imageFocus" | "fill" | "stroke" | "strokeWidth" | "background"
  > {
  /** Raised tiles, as for SVG. */
  relief?: boolean | ReliefOptions;
  /** One image across all the cells (a URL), as for SVG. */
  backdrop?: string;
  /**
   * Loaded images by URL (see `loadImages`). Images not in it are skipped and their cells
   * show `fill`. `renderToCanvas` and `renderToPng` load them for you.
   */
  loaded?: ReadonlyMap<string, CanvasImage>;
}

/**
 * Draw a layout on a canvas context, scaled to fit `width` by `height` device pixels (the
 * canvas size by default) and centerd, like SVG's default `preserveAspectRatio`. It draws
 * what the SVG renderer does: background, cast shadows, fills, images, bevels and strokes.
 * Synchronous: pass loaded images in `loaded`.
 */
export function drawLayout(
  ctx: CanvasContextLike,
  layout: Layout,
  options: CanvasRenderOptions & { width?: number; height?: number } = {},
): void {
  const canvas = (ctx as { canvas?: { width: number; height: number } }).canvas;
  const width = options.width ?? canvas?.width ?? layout.bounds.width;
  const height = options.height ?? canvas?.height ?? layout.bounds.height;
  const b = layout.bounds;
  const scale = Math.min(width / (b.width || 1), height / (b.height || 1)) || 1;
  const ox = (width - b.width * scale) / 2 - b.x * scale;
  const oy = (height - b.height * scale) / 2 - b.y * scale;
  const toLayout = () => ctx.setTransform(scale, 0, 0, scale, ox, oy);
  const styles = resolveCellStyles(layout, options);
  const loaded = options.loaded ?? new Map<string, CanvasImage>();
  const radius = layout.cornerRadius;
  const cellLoops = (c: Cell) => { const s = cellShape(c); return [s.outline, ...s.holes]; };

  ctx.save();
  toLayout();
  ctx.lineJoin = "round";

  if (options.background) {
    ctx.beginPath();
    for (const p of [layout.region, ...layout.holes]) tracePolygon(ctx, p, 0);
    ctx.fillStyle = options.background;
    ctx.fill("evenodd");
  }

  if (layout.view) {
    // A window layout: tiles are drawn whole and cut to the view.
    ctx.beginPath();
    for (const v of layout.view) for (const p of [v.outer, ...v.holes]) tracePolygon(ctx, p, 0);
    ctx.clip("evenodd");
  }

  const relief = options.relief === true ? {} : options.relief || undefined;
  const cast = relief && shadowOffset(relief);
  if (cast) {
    // Shadows only: draw the shapes far off to the side and offset their shadow back, so
    // only the blurred shadow lands, kept within the region.
    ctx.save();
    ctx.beginPath();
    for (const p of [layout.region, ...layout.holes]) tracePolygon(ctx, p, 0);
    ctx.clip("evenodd");
    const away = (b.width + b.height) * 4;
    ctx.setTransform(scale, 0, 0, scale, ox - away * scale, oy);
    ctx.shadowColor = `rgba(0,0,0,${cast.opacity})`;
    // A canvas shadow blur is about twice the Gaussian standard deviation; shadow settings
    // are in device pixels, unaffected by the transform.
    ctx.shadowBlur = cast.blur * scale * 2;
    ctx.shadowOffsetX = (away + cast.dx) * scale;
    ctx.shadowOffsetY = cast.dy * scale;
    ctx.beginPath();
    for (const c of layout.cells) for (const p of cellLoops(c)) tracePolygon(ctx, p, radius);
    ctx.fillStyle = "#000";
    ctx.fill("evenodd");
    ctx.restore();
  }

  const backdrop = options.backdrop ? loaded.get(options.backdrop) : undefined;
  if (backdrop) {
    ctx.save();
    ctx.beginPath();
    for (const c of layout.cells) for (const p of cellLoops(c)) tracePolygon(ctx, p, radius);
    ctx.clip("evenodd");
    drawCover(ctx, backdrop, b);
    ctx.restore();
  }

  const bevel = relief ? (relief.bevel ?? defaultBevel(layout)) : 0;
  layout.cells.forEach((cell, i) => {
    const style = styles[i]!;
    ctx.beginPath();
    for (const p of cellLoops(cell)) tracePolygon(ctx, p, radius);
    if (!backdrop) {
      ctx.fillStyle = style.fill;
      ctx.fill("evenodd");
    }
    const img = style.image ? loaded.get(style.image) : undefined;
    if (img) {
      ctx.save();
      ctx.clip("evenodd");
      if (options.imageFit === "contain") {
        const aspect = options.imageAspects && style.slot >= 0 ? options.imageAspects[style.slot % options.imageAspects.length] : undefined;
        drawContain(ctx, img, safeArea(cell, layout, { aspect, within: options.containWithin }));
      } else {
        const focus = style.slot >= 0 ? (Array.isArray(options.images) ? options.imageFocus?.[style.slot % options.images.length] : undefined) : undefined;
        if (focus && img.width && img.height) {
          const r = coverRect(cell, layout, { aspect: img.width / img.height, focus });
          ctx.drawImage(img as never, 0, 0, img.width, img.height, r.x, r.y, r.width, r.height);
        } else drawCover(ctx, img, cellShape(cell).bbox);
      }
      ctx.restore();
    }
    if (relief && bevel > 0) {
      for (const layer of reliefLayers(layout, cell, relief, bevel)) {
        ctx.beginPath();
        for (const poly of layer.polygons) tracePolygon(ctx, poly, 0);
        ctx.globalAlpha = layer.opacity;
        ctx.fillStyle = layer.fill;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (options.stroke) {
      ctx.beginPath();
      for (const p of cellLoops(cell)) tracePolygon(ctx, p, radius);
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.strokeWidth ?? 1;
      ctx.stroke();
    }
  });
  ctx.restore();
}

/** Add a polygon (with rounded corners) to the current path, as a closed subpath. */
export function tracePolygon(ctx: Pick<CanvasContextLike, "moveTo" | "lineTo" | "arc" | "closePath">, poly: Polygon, radius: number): void {
  if (poly.length < 3) return;
  if (radius <= 0) {
    ctx.moveTo(poly[0]!.x, poly[0]!.y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i]!.x, poly[i]!.y);
    ctx.closePath();
    return;
  }
  roundCorners(poly, radius).forEach((c, i) => {
    if (i === 0) ctx.moveTo(c.start.x, c.start.y);
    else ctx.lineTo(c.start.x, c.start.y);
    if (c.radius > 0) {
      const a0 = Math.atan2(c.start.y - c.center.y, c.start.x - c.center.x);
      // y points down, so increasing angles turn clockwise on screen: a positive sweep.
      ctx.arc(c.center.x, c.center.y, c.radius, a0, a0 + c.sweep, c.sweep < 0);
    }
  });
  ctx.closePath();
}

/** Draw `img` covering `box`, cropped to its shape and centerd (CSS `object-fit: cover`). */
function drawCover(ctx: CanvasContextLike, img: CanvasImage, box: Rect) {
  if (!img.width || !img.height || !box.width || !box.height) return;
  const s = Math.max(box.width / img.width, box.height / img.height);
  const sw = box.width / s, sh = box.height / s;
  ctx.drawImage(img as never, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, box.x, box.y, box.width, box.height);
}

/** Draw `img` whole inside `box`, centerd (CSS `object-fit: contain`). */
function drawContain(ctx: CanvasContextLike, img: CanvasImage, box: Rect) {
  if (!img.width || !img.height || !box.width || !box.height) return;
  const s = Math.min(box.width / img.width, box.height / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img as never, 0, 0, img.width, img.height, box.x + (box.width - w) / 2, box.y + (box.height - h) / 2, w, h);
}

/** The image URLs a layout would draw with these options (cell images and the backdrop). */
export function imagesUsed(layout: Layout, options: CanvasRenderOptions = {}): string[] {
  const urls = new Set<string>();
  for (const s of resolveCellStyles(layout, options)) if (s.image) urls.add(s.image);
  if (options.backdrop) urls.add(options.backdrop);
  return [...urls];
}

/**
 * Load images for drawing (in the browser, with `crossOrigin = "anonymous"` so the canvas
 * can still be exported; the server must allow it). Images that fail are left out. Pass
 * your own `load` elsewhere, e.g. `loadImage` from a Node canvas package.
 */
export async function loadImages(
  urls: readonly string[],
  load: (url: string) => Promise<CanvasImage> = browserImage,
): Promise<Map<string, CanvasImage>> {
  const out = new Map<string, CanvasImage>();
  await Promise.all(
    urls.map(async (url) => {
      try {
        out.set(url, await load(url));
      } catch {
        // Missing or blocked: the cell shows its fill.
      }
    }),
  );
  return out;
}

function browserImage(url: string): Promise<CanvasImage> {
  const Img = (globalThis as { Image?: new () => HTMLImageLike }).Image;
  if (!Img) return Promise.reject(new Error("No Image constructor: pass a load function"));
  return new Promise((resolve, reject) => {
    const img = new Img();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

interface HTMLImageLike extends CanvasImage {
  crossOrigin: string | null;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

/** A canvas that can be drawn on and exported (browser or offscreen canvas, or your own). */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): unknown;
}

export interface RasterOptions extends CanvasRenderOptions {
  /** Output width in CSS pixels; the height follows the layout's shape. Defaults to the layout's width. */
  width?: number;
  /** Device pixels per CSS pixel, for sharp output on high-density screens. Defaults to 1. */
  pixelRatio?: number;
  /** Load an image (see `loadImages`). */
  loadImage?: (url: string) => Promise<CanvasImage>;
}

/**
 * Draw a layout onto `canvas`, sizing it to the layout (`width` × `pixelRatio`) and loading
 * its images first. Resolves to the canvas.
 */
export async function renderToCanvas<C extends CanvasLike>(layout: Layout, canvas: C, options: RasterOptions = {}): Promise<C> {
  const { w, h } = rasterSize(layout, options);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasContextLike | null;
  if (!ctx) throw new Error("Could not get a 2D context from the canvas");
  const loaded = options.loaded ?? (await loadImages(imagesUsed(layout, options), options.loadImage));
  ctx.clearRect(0, 0, w, h);
  drawLayout(ctx, layout, { ...options, loaded, width: w, height: h });
  return canvas;
}

/** Pixel size of the raster for a layout: `width` (default the layout's) times `pixelRatio`. */
export function rasterSize(layout: Layout, options: Pick<RasterOptions, "width" | "pixelRatio"> = {}): { w: number; h: number } {
  const b = layout.bounds;
  const cssWidth = options.width ?? b.width;
  const ratio = options.pixelRatio ?? 1;
  return { w: Math.max(1, Math.round(cssWidth * ratio)), h: Math.max(1, Math.round(((cssWidth * b.height) / (b.width || 1)) * ratio)) };
}

/**
 * Render a layout to a PNG (or JPEG / WebP with `type`) image, in the browser or a worker.
 * Images must load (and, from other sites, allow cross-origin use) or their cells show
 * their fill. Elsewhere, use `drawLayout` with your own canvas.
 */
export async function renderToPng(
  layout: Layout,
  options: RasterOptions & { type?: string; quality?: number; createCanvas?: (w: number, h: number) => CanvasLike } = {},
): Promise<Blob> {
  const { w, h } = rasterSize(layout, options);
  const canvas = options.createCanvas ? options.createCanvas(w, h) : makeCanvas(w, h);
  await renderToCanvas(layout, canvas, options);
  const type = options.type ?? "image/png";
  const c = canvas as CanvasLike & {
    convertToBlob?: (o: { type: string; quality?: number }) => Promise<Blob>;
    toBlob?: (cb: (b: Blob | null) => void, type: string, quality?: number) => void;
  };
  if (c.convertToBlob) return c.convertToBlob({ type, quality: options.quality });
  if (c.toBlob) {
    return new Promise((resolve, reject) =>
      c.toBlob!((blob) => (blob ? resolve(blob) : reject(new Error("The canvas could not be exported"))), type, options.quality),
    );
  }
  throw new Error("This canvas can't export images: use drawLayout and your canvas's own export");
}

function makeCanvas(w: number, h: number): CanvasLike {
  const g = globalThis as { OffscreenCanvas?: new (w: number, h: number) => CanvasLike; document?: { createElement(t: "canvas"): CanvasLike } };
  if (g.OffscreenCanvas) return new g.OffscreenCanvas(w, h);
  if (g.document) {
    const c = g.document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  throw new Error("No canvas available: pass createCanvas, or use drawLayout with your own");
}
