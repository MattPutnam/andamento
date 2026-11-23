import { contentSlots, matchSlots, paletteFill, type CellFill, type Layout } from "@andamento/core";
import type { RenderOptions } from "./index";

export const defaultPalette = ["#e9d8a6", "#94d2bd", "#ee9b00", "#0a9396", "#ca6702", "#bb3e03", "#ae2012", "#005f73"];

/** A color, a palette (neighboring cells get different entries), or a color per cell. */
export type FillSource = string | readonly string[] | CellFill;

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
    if (typeof images === "function") return { fill: fills[i]!, image: images(c), slot: -1 };
    // With repeatImages, slots run past the images: the image shown is the slot wrapped round.
    const slot = images && images.length > 0 && slots[i]! >= 0 ? slots[i]! % images.length : -1;
    return { fill: fills[i]!, image: slot >= 0 ? images![slot] : undefined, slot };
  });
}

/** With `imageAlts`: a cell showing a described image is an image; the rest is decoration. */
export function cellA11y(style: CellStyle, alts: readonly string[] | undefined): { role?: "img"; "aria-label"?: string; "aria-hidden"?: "true" } {
  if (!alts?.length) return {};
  const alt = style.image && style.slot >= 0 ? alts[style.slot] : undefined;
  return alt ? { role: "img", "aria-label": alt } : { "aria-hidden": "true" };
}
