import {
  backdropCss,
  cellCss,
  cellShape,
  cellInDirection,
  navigationLane,
  noteMove,
  contentSlots,
  createLayout,
  objectPosition,
  fitCount,
  matchSlots,
  regionCss,
  safeAreaCss,
  screenToLayout,
  viewCss,
  type Cell,
  type ContentCells,
  type ContentPlacement,
  type Focus,
  type Layout,
  type LayoutOptions,
  type Rect,
  weightedLayout,
} from "@andamento/core";
import { cellPath, defaultBevel, neutralPalette, reliefPaths, resolveFills, shadowOffset, type FillSource, type ReliefOptions, type ReliefPath } from "@andamento/svg";

/**
 * The parts of an HTML tile layout that don't depend on a framework: what each tile's
 * element looks like, what keys do, what's in view. `mountTileLayout`, the
 * `<andamento-layout>` element and the Vue components all render from these.
 */

/** How a layout's `fit` option sizes its tiles. */
export type FitProp = boolean | "atLeast" | "nearest";

/** What a per-cell option function is told about the cell besides its geometry. */
export interface CellState {
  /** The cell has no content. */
  empty: boolean;
  /** Position among the cells that hold content, in reading order (the item index), or -1. */
  slot: number;
}

/**
 * Put each tile's content in its safe area: `true` or "tile" fits the whole tile (for a tile
 * an `edges: "window"` layout cuts, content near the edge is then partly hidden like the
 * tile), "visible" fits the part that shows. See `SafeAreaOptions.within`.
 */
export type SafeAreaProp = boolean | "tile" | "visible";

/** A value, or a function giving it per cell. */
export type PerCell<T> = T | ((cell: Cell, state: CellState) => T);

export const resolvePerCell = <T>(v: PerCell<T> | undefined, cell: Cell, state: CellState): T | undefined =>
  typeof v === "function" ? (v as (c: Cell, s: CellState) => T)(cell, state) : v;

/** Style as property → value, camelCase (`clipPath`) or custom (`--x`). */
export type StyleMap = Record<string, string | number | undefined>;

/** Clip paths get this many points when animating, so any two tile shapes can morph. */
export const MORPH_POINTS = 72;

const PLACEHOLDER: LayoutOptions = { region: { x: 0, y: 0, width: 1, height: 1 }, tiling: { type: "grid", width: 1 } };

/** What a layout's items need from it: how many there are, and how they're sized and placed. */
export interface LayoutNeeds {
  fit?: FitProp;
  count: number;
  cells?: ContentCells;
  /** Tiles each item spans (see `weightedLayout`); heavier items get featured tiles. */
  weights?: readonly number[];
  placement?: ContentPlacement;
}

/**
 * A layout from options, worked out again only when they change (compared by value; a
 * `cells` function by identity). Returns `layout` itself when given.
 */
export function layoutResolver(component: string) {
  let lastKey: string | undefined, lastCells: ContentCells | undefined, last: Layout | undefined;
  return (options: LayoutOptions | undefined, layout: Layout | undefined, fit?: LayoutNeeds): Layout => {
    if (layout) return layout;
    if (!options) throw new Error(`${component} needs either \`options\` or \`layout\``);
    const fitting = !!fit?.fit && fit.count >= 1 && Number.isFinite(fit.count);
    const mode = fit?.fit === "nearest" ? "nearest" : "atLeast";
    // One weight per item, 1 for any not given; only items that are there count.
    const count = fit && Number.isFinite(fit.count) ? fit.count : 0;
    const weights = fit?.weights?.some((w) => w > 1) && count > 0 ? Array.from({ length: count }, (_, i) => fit.weights![i] ?? 1) : undefined;
    const cells = fitting || weights ? fit!.cells : undefined;
    const key = JSON.stringify([options, fitting && fit!.count, mode, weights, weights && fit!.placement]);
    if (last && key === lastKey && cells === lastCells) return last;
    last = weights
      ? weightedLayout(options, weights, { fit: fitting && mode, cells, placement: fit!.placement }).layout
      : fitting
        ? fitCount(options, fit!.count, { cells, mode }).layout
        : createLayout(options ?? PLACEHOLDER);
    lastKey = key;
    lastCells = cells;
    return last;
  };
}

export interface FrameOptions {
  /** How many items there are to place (Infinity when every allowed cell gets content). */
  count: number;
  aspects?: readonly number[];
  contentCells?: ContentCells;
  placement?: ContentPlacement;
  choose?: "placement" | "shape";
  fill?: FillSource;
  relief?: boolean | ReliefOptions;
  animate?: boolean | { duration?: number; easing?: string };
}

/** Everything about a layout's tiles shared between them. */
export interface Frame {
  layout: Layout;
  /** Item index per cell, or -1. */
  slots: number[];
  /** Empty-tile color per cell. */
  fills: string[];
  /** Bevel paths for a cell (worked out on first use), or undefined without relief. */
  bevel(index: number): ReliefPath[] | undefined;
  shadow?: { dx: number; dy: number; blur: number; opacity: number };
  anim?: { duration: number; easing: string };
  /** `left, top, width, height` transitions, when animating. */
  boxTransition?: string;
  tileTransition?: string;
}

/** Builds frames, reusing the slots, fills and bevels of the last one where nothing they depend on changed. */
export function frameBuilder() {
  let slotKey = "", slotLayout: Layout | undefined, slotCells: ContentCells | undefined, slots: number[] = [];
  let fillLayout: Layout | undefined, fillSource: FillSource | undefined, fills: string[] = [];
  let bevelKey = "", bevelLayout: Layout | undefined, bevels = new Map<number, ReliefPath[]>();
  return (layout: Layout, o: FrameOptions): Frame => {
    const key = JSON.stringify([o.count === Infinity ? -1 : o.count, o.aspects, o.placement, o.choose, typeof o.contentCells === "function" ? 0 : o.contentCells]);
    if (layout !== slotLayout || key !== slotKey || o.contentCells !== slotCells) {
      slots = o.aspects && o.count !== Infinity
        ? matchSlots(layout, Array.from({ length: o.count }, (_, i) => o.aspects![i] ?? 1), { cells: o.contentCells, placement: o.placement, choose: o.choose })
        : contentSlots(layout, o.count, { cells: o.contentCells, placement: o.placement });
      slotLayout = layout;
      slotKey = key;
      slotCells = o.contentCells;
    }
    const fill = o.fill ?? neutralPalette;
    if (layout !== fillLayout || fill !== fillSource) {
      fills = resolveFills(layout, fill);
      fillLayout = layout;
      fillSource = fill;
    }
    const relief = o.relief === true ? {} : o.relief || undefined;
    const rk = relief ? JSON.stringify(relief) : "";
    if (layout !== bevelLayout || rk !== bevelKey) {
      bevels = new Map();
      bevelLayout = layout;
      bevelKey = rk;
    }
    const width = relief ? (relief.bevel ?? defaultBevel(layout)) : 0;
    const cache = bevels;
    const anim = o.animate
      ? {
          duration: (typeof o.animate === "object" ? o.animate.duration : undefined) ?? 400,
          easing: (typeof o.animate === "object" ? o.animate.easing : undefined) ?? "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }
      : undefined;
    const timing = anim ? `${anim.duration}ms ${anim.easing}` : "";
    const boxTransition = anim ? ["left", "top", "width", "height"].map((p) => `${p} ${timing}`).join(", ") : undefined;
    return {
      layout,
      slots,
      fills,
      bevel(i) {
        if (!relief || width <= 0) return undefined;
        let b = cache.get(i);
        if (!b) cache.set(i, (b = reliefPaths(layout, layout.cells[i]!, relief, width)));
        return b;
      },
      shadow: relief ? shadowOffset(relief) : undefined,
      anim,
      boxTransition,
      tileTransition: anim ? `${boxTransition}, clip-path ${timing}, background-color ${timing}` : undefined,
    };
  };
}

/** Style of the element holding the layout. */
export const containerStyle = (layout: Layout): StyleMap => ({
  position: "relative",
  width: "100%",
  aspectRatio: `${layout.bounds.width} / ${layout.bounds.height}`,
});

/** Style of the element painting `background` across the region (seen through the gaps). */
export const backgroundStyle = (frame: Frame, background: string): StyleMap => ({
  position: "absolute",
  inset: "0",
  background,
  clipPath: regionCss(frame.layout),
  transition: frame.anim ? `clip-path ${frame.anim.duration}ms ${frame.anim.easing}` : undefined,
});

/**
 * A tile's element: placed over its cell's bounding box and clipped to its shape. Empty
 * tiles (and every tile with `safeArea`) show their fill unless there's a backdrop.
 */
export function tileStyle(
  frame: Frame,
  cell: Cell,
  o: { empty: boolean; safeArea?: SafeAreaProp; backdrop?: boolean; clickable?: boolean; focus?: Focus; aspect?: number },
): StyleMap {
  return {
    ...(o.focus && !o.empty ? focusStyle(frame, cell, o.focus, o.aspect) : {}),
    position: "absolute",
    boxSizing: "border-box",
    overflow: "hidden",
    ...cellCss(cell, frame.layout, 4, frame.anim ? { points: MORPH_POINTS } : {}),
    transition: frame.tileTransition,
    background: (o.empty || o.safeArea) && !o.backdrop ? frame.fills[cell.index] : undefined,
    cursor: o.clickable ? "pointer" : undefined,
  };
}

/**
 * The `--andamento-object-position` a tile sets for its content's focal point, which
 * `coverStyle` uses as its `object-position`. Exact with the image's `aspect` (given, or the focus's own; see
 * `objectPosition`); without, the focus as a percentage, which CSS keeps at the same place
 * in the tile's box rather than in the middle of what shows.
 */
export function focusStyle(frame: Frame, cell: Cell, focus: Focus, aspect?: number): StyleMap {
  const shape = aspect ?? focus.aspect;
  const pos = shape && shape > 0 ? objectPosition(cell, frame.layout, { aspect: shape, focus }) : `${focus.x * 100}% ${focus.y * 100}%`;
  return { "--andamento-object-position": pos };
}

/** A backdrop copy inside a tile: behind its content, covering the whole layout. */
export const backdropStyle = (frame: Frame, cell: Cell): StyleMap => ({
  position: "absolute",
  zIndex: -1,
  pointerEvents: "none",
  ...backdropCss(cell, frame.layout),
  transition: frame.boxTransition,
});

/** The box holding a tile's content with `safeArea`. */
export const safeBoxStyle = (frame: Frame, cell: Cell, aspect?: number, safe?: SafeAreaProp): StyleMap => ({
  position: "absolute",
  boxSizing: "border-box",
  ...safeAreaCss(cell, frame.layout, { aspect, within: safe === "visible" ? "visible" : "tile" }),
  transition: frame.boxTransition,
});

/** Style of an <svg> drawn over a tile (bevel, focus ring), with `viewBox` set to `tileViewBox`. */
export const overlayStyle: StyleMap = { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" };

export const tileViewBox = (cell: Cell) => {
  const b = cellShape(cell).bbox;
  return `${b.x} ${b.y} ${b.width} ${b.height}`;
};

/** The focus ring's two strokes: white under the color, so it shows on any content. */
export const ringStrokes = (frame: Frame, cell: Cell, color: string) => {
  const d = cellPath(frame.layout, cell);
  return [
    { d, stroke: "#fff", width: 8 },
    { d, stroke: color, width: 4 },
  ];
};

/** The shadow tiles cast into the grout (with relief's `shadow`), for an <svg> over the region. */
export function shadowShape(frame: Frame, cells: readonly Cell[]) {
  const s = frame.shadow;
  if (!s) return undefined;
  const { bounds } = frame.layout;
  return {
    viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
    style: { ...overlayStyle, clipPath: viewCss(frame.layout) } as StyleMap,
    blur: s.blur,
    d: cells.map((c) => cellPath(frame.layout, c)).join(""),
    transform: `translate(${s.dx} ${s.dy})`,
    opacity: s.opacity,
  };
}

/**
 * What a key does on a focused tile: move focus to another tile, activate it, or just stop
 * the page scrolling (arrows at the edge). Undefined for keys that aren't ours.
 */
export function keyAction(
  layout: Layout,
  from: Cell,
  key: string,
  accept: (cell: Cell) => boolean,
  canActivate: boolean,
): { move: Cell } | { activate: true } | { prevent: true } | undefined {
  const dirs: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  let to: Cell | undefined;
  const dir = dirs[key];
  if (dir) {
    const lane = navigationLane(layout, from, dir);
    to = cellInDirection(layout, from, dir, { accept, lane });
    if (to) noteMove(layout, to, dir, lane);
  }
  else if (key === "Home") to = layout.cells.find(accept);
  else if (key === "End") to = [...layout.cells].reverse().find(accept);
  else if ((key === "Enter" || key === " ") && canActivate) return { activate: true };
  if (to) return { move: to };
  return key.startsWith("Arrow") ? { prevent: true } : undefined;
}

/** Style sheet text for focus rings and animation (empty when neither is on). */
export function tileSheet(o: { focusRing: boolean; anim?: { duration: number; easing: string } }): string {
  let css = "";
  // The ring shows only on keyboard focus; a CSS outline would be clipped away anyway.
  if (o.focusRing)
    css +=
      "[data-andamento]>[data-cell-id]:focus{outline:none}" +
      "[data-andamento]>[data-cell-id]>[data-focus-ring]{display:none}" +
      "[data-andamento]>[data-cell-id]:focus-visible>[data-focus-ring]{display:block}";
  if (o.anim) {
    const { duration, easing } = o.anim;
    css +=
      "@keyframes andamento-enter{from{opacity:0;transform:scale(.85)}}" +
      "@keyframes andamento-exit{to{opacity:0;transform:scale(.85)}}" +
      "@keyframes andamento-late{0%,70%{opacity:0}to{opacity:1}}" +
      `[data-andamento]>[data-entering]{animation:andamento-enter ${duration}ms ${easing} backwards}` +
      `[data-andamento]>[data-exiting]{animation:andamento-exit ${duration}ms ${easing} forwards;pointer-events:none}` +
      `[data-andamento]>[data-cell-id]>[data-late]{animation:andamento-late ${duration}ms linear backwards}` +
      "@media (prefers-reduced-motion:reduce){[data-andamento]>[data-cell-id],[data-andamento]>[data-cell-id] *{transition:none!important;animation:none!important}" +
      "[data-andamento]>[data-exiting]{display:none}}";
  }
  return css;
}

/** "Nothing in view": `view` before the layout has been measured, or when it's off screen. */
export const NOTHING_IN_VIEW: Rect = { x: 0, y: 0, width: -1, height: -1 };

/**
 * The part of the layout in view (in layout units), widened by `overscan` pixels and
 * snapped outwards to a coarse grid so small scrolls give the same rectangle.
 */
export function viewRect(el: Element, layout: Layout, overscan: number): Rect {
  const box = el.getBoundingClientRect();
  const seen = visibleClientRect(el, box);
  const { bounds } = layout;
  const scale = Math.min(box.width / (bounds.width || 1), box.height / (bounds.height || 1));
  if (!seen || !(scale > 0)) return NOTHING_IN_VIEW;
  const a = screenToLayout(layout, box, seen.left - overscan, seen.top - overscan);
  const b = screenToLayout(layout, box, seen.right + overscan, seen.bottom + overscan);
  const q = Math.max(overscan / 2, 50) / scale;
  const x0 = Math.floor(a.x / q) * q, y0 = Math.floor(a.y / q) * q;
  return { x: x0, y: y0, width: Math.ceil(b.x / q) * q - x0, height: Math.ceil(b.y / q) * q - y0 };
}

export const sameRect = (a: Rect | undefined, b: Rect | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Call `measure` now and again (at most once a frame) whenever the page or any scrolling
 * container scrolls, the window resizes or `el` does. Returns a function that stops it.
 */
export function watchView(el: Element, measure: () => void): () => void {
  const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f: () => void) => setTimeout(f, 16) as unknown as number;
  const cancel = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (h: number) => clearTimeout(h);
  let frame = 0;
  const run = () => {
    frame = 0;
    measure();
  };
  const schedule = () => {
    if (!frame) frame = raf(run);
  };
  measure();
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule);
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : undefined;
  observer?.observe(el);
  return () => {
    if (frame) cancel(frame);
    window.removeEventListener("scroll", schedule, { capture: true });
    window.removeEventListener("resize", schedule);
    observer?.disconnect();
  };
}

/**
 * The part of `el` (whose box is `box`) visible on screen: within the window and every
 * ancestor that clips its overflow (across shadow roots too). Undefined when none of it is.
 */
function visibleClientRect(el: Element, box: DOMRect) {
  let left = Math.max(box.left, 0);
  let top = Math.max(box.top, 0);
  let right = Math.min(box.right, window.innerWidth || document.documentElement.clientWidth);
  let bottom = Math.min(box.bottom, window.innerHeight || document.documentElement.clientHeight);
  const parent = (n: Element): Element | null => n.parentElement ?? ((n.parentNode as ShadowRoot | null)?.host ?? null);
  for (let p = parent(el); p && p !== document.body && p !== document.documentElement; p = parent(p)) {
    const s = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(`${s.overflow} ${s.overflowX} ${s.overflowY}`)) {
      const r = p.getBoundingClientRect();
      left = Math.max(left, r.left);
      top = Math.max(top, r.top);
      right = Math.min(right, r.right);
      bottom = Math.min(bottom, r.bottom);
    }
  }
  return right > left && bottom > top ? { left, top, right, bottom } : undefined;
}

/** Style that makes an <img> or <video> cover its tile, like `object-fit: cover`. */
export const coverStyle: StyleMap = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
  // Set by the tile from the item's focal point (see `focalPoints`); centerd otherwise.
  objectPosition: "var(--andamento-object-position, 50% 50%)",
};
