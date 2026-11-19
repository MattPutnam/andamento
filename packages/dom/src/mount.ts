import { cellsInRect, type Cell, type ContentCells, type ContentPlacement, type Focus, type Layout, type LayoutOptions, type Rect } from "@andamento/core";
import type { FillSource, ReliefOptions } from "@andamento/svg";
import {
  backdropStyle,
  backgroundStyle,
  containerStyle,
  frameBuilder,
  keyAction,
  layoutResolver,
  overlayStyle,
  resolvePerCell,
  ringStrokes,
  safeBoxStyle,
  sameRect,
  shadowShape,
  tileSheet,
  tileStyle,
  tileViewBox,
  viewRect,
  watchView,
  type CellState,
  type FitProp,
  type PerCell,
  type SafeAreaProp,
  type StyleMap,
} from "./model";

/** What can go in a tile: a DOM node, text, or nothing. */
export type TileContent = Node | string | null | undefined;

export interface TileLayoutConfig {
  /** Layout options; or pass a precomputed `layout` instead. */
  options?: LayoutOptions;
  layout?: Layout;
  /**
   * The content: each item fills one tile, in reading order, clipped to the tile's shape.
   * Nodes are moved into their tiles (and kept there as the layout changes), so pass the
   * same node again to keep its state.
   */
  items?: readonly TileContent[];
  /**
   * Alternative to `items`: each tile's content from its cell, worked out on every render.
   * Return the same node again to keep it. `slot` numbers the cells allowed by `contentCells`.
   */
  renderCell?: (cell: Cell, state: { slot: number }) => TileContent;
  /** Which tiles may hold content: "all" (default), "whole" (not cut by the outline) or a test. */
  contentCells?: ContentCells;
  /** Where items go when there are fewer than tiles: "reading" (default), "center" or "spread". */
  placement?: ContentPlacement;
  /** Width / height of each item, to put items in tiles of similar shape (see `matchSlots`). */
  aspects?: readonly number[];
  /** With `aspects`: "shape" also picks which tiles hold items by their shape. */
  choose?: "placement" | "shape";
  /**
   * Focal point of each item (fractions of its width and height; see `estimateFocus`): what
   * a photo keeps in view as its tile crops it. Each tile sets `--andamento-object-position`,
   * which `coverStyle` uses; exact when the photo's shape is known (`aspects`, or the focus's `aspect`).
   */
  focalPoints?: readonly (Focus | undefined)[];
  /**
   * Put each tile's content in the tile's safe area, not its bounding box (see `safeArea`).
   * For tiles an `edges: "window"` layout cuts, `true` or "tile" fits the whole tile and
   * "visible" the part that shows.
   */
  safeArea?: SafeAreaProp;
  /** Color of empty tiles: a color, a palette or a function per cell. Defaults to `neutralPalette`. */
  fill?: FillSource;
  /** Size the tiles to the items: `true`/"atLeast" or "nearest". Ignored with `layout` or `renderCell`. */
  fit?: FitProp;
  /**
   * One picture across all the tiles: a node copied into every tile (or a function making
   * a fresh one per tile), sized to the whole layout so each tile shows its piece.
   */
  backdrop?: Node | (() => Node);
  /** Raised tiles: a lit bevel and optional shadow. `true` for the defaults. */
  relief?: boolean | ReliefOptions;
  /** Arrow-key navigation over the tiles with content, as one tab stop. */
  navigable?: boolean;
  /** Called when a tile with content is clicked, or Enter / Space pressed on it (with `navigable`). */
  onCellActivate?: (cell: Cell, state: CellState) => void;
  /** Accessible name for each tile. */
  cellLabel?: PerCell<string | undefined>;
  /** Focus ring color, or `false` for none. Defaults to "#1a56db". */
  focusRing?: string | false;
  /** Animate layout and content changes. `true` for 400 ms, or `{ duration, easing }`. */
  animate?: boolean | { duration?: number; easing?: string };
  /** Only put tiles in view (plus `overscan` pixels, default 300) in the DOM. */
  virtualize?: boolean | { overscan?: number };
  /** Content for empty tiles. */
  fallback?: PerCell<TileContent>;
  /** Class for each tile element. */
  cellClass?: PerCell<string | undefined>;
  /** Extra style for each tile element: camelCase or custom (`--x`) properties. */
  cellStyle?: PerCell<StyleMap | undefined>;
  /** Extra attributes for each tile element (`part`, `title`, …). */
  cellAttributes?: PerCell<Record<string, string | undefined> | undefined>;
  /** Color painted across the whole region, visible through the gaps. */
  background?: string;
  /** Role of the layout element: "list" (default; tiles with content are list items) or another. */
  role?: string;
  /** Accessible name of the layout (its `aria-label`). */
  label?: string;
  /** Class for the layout element. */
  className?: string;
}

export interface TileLayoutHandle {
  /** The layout element (with `data-andamento`), inside the element mounted into. */
  readonly element: HTMLDivElement;
  /** The layout being shown. */
  readonly layout: Layout;
  /** Change some options (others stay as they are; pass `undefined` to clear one) and re-render. */
  update(changes: Partial<TileLayoutConfig>): void;
  /** Render again, e.g. after changing what `renderCell` returns. */
  refresh(): void;
  /** The element of the tile showing a cell, if it's in the DOM. */
  tileElement(cellId: string): HTMLElement | undefined;
  /** Remove the layout (items are taken out of their tiles) and stop listening. */
  destroy(): void;
}

const SVG = "http://www.w3.org/2000/svg";
const kebab = (k: string) => (k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
const isEmpty = (c: TileContent) => c == null || c === "";

const styleMemo = new WeakMap<Element, StyleMap>();
/** Set style properties, removing those set last time and not now. */
function applyStyle(el: HTMLElement | SVGElement, next: StyleMap) {
  const prev = styleMemo.get(el) ?? {};
  for (const k of Object.keys(prev)) if (next[k] === undefined && prev[k] !== undefined) el.style.removeProperty(kebab(k));
  for (const [k, v] of Object.entries(next)) if (v !== undefined && prev[k] !== v) el.style.setProperty(kebab(k), String(v));
  styleMemo.set(el, next);
}

function attr(el: Element, name: string, value: string | number | boolean | undefined | null) {
  if (value === undefined || value === null || value === false) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else {
    const v = value === true ? "" : String(value);
    if (el.getAttribute(name) !== v) el.setAttribute(name, v);
  }
}

/** Make `parent`'s children exactly `nodes`, in order, moving as few as possible. */
function setChildren(parent: Node, nodes: readonly Node[]) {
  let at: ChildNode | null = parent.firstChild;
  for (const n of nodes) {
    if (n === at) at = at.nextSibling;
    else parent.insertBefore(n, at);
  }
  while (at) {
    const next: ChildNode | null = at.nextSibling;
    parent.removeChild(at);
    at = next;
  }
}

function svg(tag: string, attrs: Record<string, string | number | undefined>, children: Element[] = []) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v));
  for (const c of children) el.appendChild(c);
  return el;
}

interface Tile {
  key: string;
  el: HTMLDivElement;
  cell: Cell;
  state: CellState;
  empty: boolean;
  text?: Text;
  backdrop?: { source: TileConfigBackdrop; node: Node };
  safe?: HTMLDivElement;
  bevel?: { key: string; node: SVGSVGElement };
  ring?: { key: string; node: SVGSVGElement };
  /** Fading out (animated removal). */
  leaving?: boolean;
}
type TileConfigBackdrop = NonNullable<TileLayoutConfig["backdrop"]>;

const nodeIds = new WeakMap<Node, number>();
let nextNodeId = 1;
const nodeId = (n: Node) => {
  let id = nodeIds.get(n);
  if (!id) nodeIds.set(n, (id = nextNodeId++));
  return id;
};

let uidCount = 0;

/**
 * Render a tiling into `target` (an element or a shadow root), without a framework: one
 * absolutely positioned, clipped element per tile, holding the items you give it. Sized in
 * percentages, so it scales with `target`'s width. Returns a handle to update or remove it.
 *
 * Tiles have `data-cell-id`, `data-index`, `data-empty` and `data-boundary`, as with the
 * React and Vue components.
 */
export function mountTileLayout(target: Element | ShadowRoot, initial: TileLayoutConfig): TileLayoutHandle {
  let config: TileLayoutConfig = { ...initial };
  const uid = `andamento-dom${++uidCount}`;
  const resolveLayout = layoutResolver("mountTileLayout");
  const buildFrame = frameBuilder();
  const container = document.createElement("div");
  container.setAttribute("data-andamento", "");
  target.appendChild(container);

  const sheet = document.createElement("style");
  const backgroundEl = document.createElement("div");
  backgroundEl.setAttribute("aria-hidden", "true");
  const blur = svg("feGaussianBlur", {});
  const shadowPath = svg("path", { "fill-rule": "evenodd", fill: "#000", filter: `url(#${uid}-shadow)` });
  const shadowEl = svg("svg", { "aria-hidden": "true", "data-andamento-shadow": "", preserveAspectRatio: "none" }, [
    svg("filter", { id: `${uid}-shadow`, x: "-10%", y: "-10%", width: "120%", height: "120%" }, [blur]),
    shadowPath,
  ]) as SVGSVGElement;

  let layout!: Layout;
  let tiles = new Map<string, Tile>();
  const leaving = new Set<Tile>();
  const byElement = new WeakMap<Element, Tile>();
  let lastKeys = new Set<string>();
  let mounted = false;
  let activeId: string | undefined;
  let pendingFocus: string | undefined;
  let focusable = new Set<string>();
  let view: Rect | undefined;
  let stopWatching: (() => void) | undefined;
  let watchedLayout: Layout | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;

  function render() {
    if (destroyed) return;
    const c = config;
    const items = c.renderCell ? [] : (c.items ?? []);
    layout = resolveLayout(c.options, c.layout, { fit: !c.renderCell && c.fit, count: items.length, cells: c.contentCells });
    const frame = buildFrame(layout, {
      count: c.renderCell ? Infinity : items.length,
      aspects: c.renderCell ? undefined : c.aspects,
      contentCells: c.contentCells,
      placement: c.placement,
      choose: c.choose,
      fill: c.fill,
      relief: c.relief,
      animate: c.animate,
    });
    const { slots } = frame;
    const focusRing = c.focusRing === undefined ? "#1a56db" : c.focusRing;
    const list = (c.role ?? "list") === "list";
    const virtual = !!c.virtualize;

    // A tile keeps its element while it shows the same item, so items keep their state.
    const keyOf = (i: number) => {
      const slot = slots[i]!;
      if (!c.renderCell && slot >= 0) {
        const item = items[slot];
        return item && typeof item === "object" ? `n${nodeId(item)}` : `i${slot}`;
      }
      return `c${layout.cells[i]!.id}`;
    };
    const hasContent = (i: number) => (c.renderCell ? slots[i]! >= 0 : slots[i]! >= 0 && !isEmpty(items[slots[i]!]));

    focusable = new Set(c.navigable ? layout.cells.filter((cell) => hasContent(cell.index)).map((cell) => cell.id) : []);
    const firstFocusable = layout.cells.find((cell) => focusable.has(cell.id))?.id;
    const active = activeId !== undefined && focusable.has(activeId) ? activeId : firstFocusable;

    // The tiles to show: all, or those in view plus the tab stop.
    let shown: number[];
    if (!virtual) shown = layout.cells.map((_, i) => i);
    else {
      const s = new Set(view && view.width >= 0 ? cellsInRect(layout, view).map((cell) => cell.index) : []);
      const a = active !== undefined ? layout.cells.find((cell) => cell.id === active) : undefined;
      if (a) s.add(a.index);
      shown = [...s].sort((x, y) => x - y);
    }
    let positions: Map<number, number> | undefined;
    if (virtual) {
      positions = new Map();
      for (const cell of layout.cells) if (hasContent(cell.index)) positions.set(cell.index, positions.size + 1);
    }
    const allKeys = frame.anim || virtual ? new Set(layout.cells.map((_, i) => keyOf(i))) : undefined;

    const next = new Map<string, Tile>();
    for (const i of shown) {
      const cell = layout.cells[i]!;
      const slot = slots[i]!;
      const key = keyOf(i);
      let content: TileContent = c.renderCell ? c.renderCell(cell, { slot }) : slot >= 0 ? items[slot] : undefined;
      const empty = isEmpty(content);
      const state: CellState = { empty, slot: empty && !c.renderCell ? -1 : slot };
      if (empty) content = resolvePerCell(c.fallback, cell, state);
      const silent = empty && isEmpty(content);

      let tile = tiles.get(key);
      if (!tile || tile.leaving) {
        const el = document.createElement("div");
        tile = { key, el, cell, state, empty };
        if (frame.anim && mounted && !lastKeys.has(key)) el.setAttribute("data-entering", "");
      }
      tiles.delete(key);
      next.set(key, tile);
      Object.assign(tile, { cell, state, empty });
      const el = tile.el;
      byElement.set(el, tile);

      const canFocus = focusable.has(cell.id);
      attr(el, "role", silent ? undefined : list ? "listitem" : undefined);
      attr(el, "aria-hidden", silent ? "true" : undefined);
      attr(el, "aria-label", silent ? undefined : resolvePerCell(c.cellLabel, cell, state));
      attr(el, "aria-setsize", positions && list && !silent ? positions.size : undefined);
      attr(el, "aria-posinset", positions && list && !silent ? positions.get(i) : undefined);
      attr(el, "tabindex", canFocus ? (cell.id === active ? 0 : -1) : undefined);
      attr(el, "class", resolvePerCell(c.cellClass, cell, state) || undefined);
      attr(el, "data-cell-id", cell.id);
      attr(el, "data-index", cell.index);
      attr(el, "data-empty", empty);
      attr(el, "data-boundary", !!cell.boundary);
      for (const [k, v] of Object.entries(resolvePerCell(c.cellAttributes, cell, state) ?? {})) attr(el, k, v);
      applyStyle(el, {
        ...tileStyle(frame, cell, {
          empty,
          safeArea: c.safeArea,
          backdrop: c.backdrop != null,
          clickable: !!c.onCellActivate && !empty,
          focus: slot >= 0 ? c.focalPoints?.[slot] : undefined,
          aspect: slot >= 0 ? c.aspects?.[slot] : undefined,
        }),
        ...resolvePerCell(c.cellStyle, cell, state),
      });

      // Children: backdrop, content (in its safe area box), bevel, focus ring.
      const kids: Node[] = [];
      if (c.backdrop != null) {
        if (!tile.backdrop || tile.backdrop.source !== c.backdrop) {
          const node = typeof c.backdrop === "function" ? c.backdrop() : c.backdrop.cloneNode(true);
          const wrap = document.createElement("div");
          wrap.setAttribute("aria-hidden", "true");
          wrap.appendChild(node);
          tile.backdrop = { source: c.backdrop, node: wrap };
        }
        applyStyle(tile.backdrop.node as HTMLElement, backdropStyle(frame, cell));
        kids.push(tile.backdrop.node);
      } else tile.backdrop = undefined;
      let node: Node | undefined;
      if (typeof content === "string") {
        if (!tile.text) tile.text = document.createTextNode(content);
        else if (tile.text.data !== content) tile.text.data = content;
        node = tile.text;
      } else if (content) node = content;
      if (node && c.safeArea) {
        if (!tile.safe) {
          tile.safe = document.createElement("div");
          tile.safe.setAttribute("data-safe-area", "");
        }
        const aspect = !c.renderCell && !empty && c.aspects ? (c.aspects[slot] ?? 1) : undefined;
        applyStyle(tile.safe, safeBoxStyle(frame, cell, aspect, c.safeArea));
        setChildren(tile.safe, [node]);
        kids.push(tile.safe);
      } else if (node) kids.push(node);
      const bevel = frame.bevel(i);
      if (bevel && bevel.length) {
        const clip = frame.anim ? String(el.style.getPropertyValue("clip-path")) : "";
        const bk = tileViewBox(cell) + clip + bevel.map((p) => p.d + p.fill + p.opacity).join();
        if (tile.bevel?.key !== bk) {
          const s = svg(
            "svg",
            { "aria-hidden": "true", "data-bevel": "", "data-late": frame.anim ? "" : undefined, viewBox: tileViewBox(cell), preserveAspectRatio: "none" },
            bevel.map((p) => svg("path", { d: p.d, fill: p.fill, "fill-opacity": p.opacity })),
          ) as SVGSVGElement;
          applyStyle(s, overlayStyle);
          tile.bevel = { key: bk, node: s };
        }
        kids.push(tile.bevel.node);
      } else tile.bevel = undefined;
      if (canFocus && focusRing !== false) {
        const strokes = ringStrokes(frame, cell, focusRing);
        const rk = tileViewBox(cell) + strokes[0]!.d + focusRing;
        if (tile.ring?.key !== rk) {
          const s = svg(
            "svg",
            { "aria-hidden": "true", "data-focus-ring": "", viewBox: tileViewBox(cell), preserveAspectRatio: "none" },
            strokes.map((p) => svg("path", { d: p.d, fill: "none", stroke: p.stroke, "stroke-width": p.width, "vector-effect": "non-scaling-stroke" })),
          ) as SVGSVGElement;
          applyStyle(s, overlayStyle);
          tile.ring = { key: rk, node: s };
        }
        kids.push(tile.ring.node);
      } else tile.ring = undefined;
      setChildren(el, kids);
    }

    // Tiles no longer shown: gone for good (fade out when animating), or just out of view.
    const present = allKeys ?? new Set(next.keys());
    for (const tile of tiles.values()) {
      if (frame.anim && mounted && !present.has(tile.key)) startLeaving(tile, frame.anim.duration);
    }
    tiles = next;

    // The layout element and its children.
    attr(container, "role", c.role ?? "list");
    attr(container, "aria-label", c.label);
    attr(container, "class", c.className);
    applyStyle(container, containerStyle(layout));
    const css = tileSheet({ focusRing: !!c.navigable && focusRing !== false, anim: frame.anim });
    if (sheet.textContent !== css) sheet.textContent = css;
    const top: Node[] = [];
    if (css) top.push(sheet);
    if (c.background) {
      applyStyle(backgroundEl, backgroundStyle(frame, c.background));
      top.push(backgroundEl);
    }
    const shadow = shadowShape(frame, shown.map((i) => layout.cells[i]!));
    if (shadow) {
      attr(shadowEl, "viewBox", shadow.viewBox);
      applyStyle(shadowEl, shadow.style);
      attr(blur, "stdDeviation", shadow.blur);
      attr(shadowPath, "d", shadow.d);
      attr(shadowPath, "transform", shadow.transform);
      attr(shadowPath, "fill-opacity", shadow.opacity);
      top.push(shadowEl);
    }
    setChildren(container, [...top, ...[...tiles.values()].map((t) => t.el), ...[...leaving].map((t) => t.el)]);

    lastKeys = present;
    mounted = true;
    if (pendingFocus) {
      const t = [...tiles.values()].find((x) => x.cell.id === pendingFocus);
      if (t) {
        pendingFocus = undefined;
        t.el.focus();
      }
    }

    // Virtualisation: measure what's in view, and again whenever it may change.
    if (virtual && !stopWatching) stopWatching = watchView(container, measure);
    else if (!virtual && stopWatching) {
      stopWatching();
      stopWatching = undefined;
      view = undefined;
    } else if (virtual && watchedLayout !== layout) queueMicrotask(measure);
    watchedLayout = layout;
  }

  function measure() {
    if (destroyed || !config.virtualize) return;
    const overscan = Math.max(0, (typeof config.virtualize === "object" ? config.virtualize.overscan : undefined) ?? 300);
    const next = viewRect(container, layout, overscan);
    if (!sameRect(next, view)) {
      view = next;
      render();
    }
  }

  function startLeaving(tile: Tile, duration: number) {
    tile.leaving = true;
    const el = tile.el;
    for (const a of ["role", "tabindex", "aria-label", "aria-setsize", "aria-posinset", "data-entering"]) el.removeAttribute(a);
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-exiting", "");
    leaving.add(tile);
    const timer = setTimeout(() => {
      timers.delete(timer);
      leaving.delete(tile);
      el.remove();
    }, duration);
    timers.add(timer);
  }

  // Events, on the layout element: which tile they're for (across shadow roots too).
  const tileOf = (e: Event): Tile | undefined => {
    for (const n of e.composedPath()) {
      if (n === container) return undefined;
      if (n instanceof Element && n.parentNode === container) {
        const t = byElement.get(n);
        return t && !t.leaving ? t : undefined;
      }
    }
    return undefined;
  };
  const setActive = (id: string) => {
    if (id === activeId) return;
    activeId = id;
    for (const t of tiles.values()) if (focusable.has(t.cell.id)) attr(t.el, "tabindex", t.cell.id === id ? 0 : -1);
  };
  const onClick = (e: MouseEvent) => {
    const t = tileOf(e);
    if (t && !t.empty && config.onCellActivate) config.onCellActivate(t.cell, t.state);
  };
  const onFocusIn = (e: FocusEvent) => {
    const t = tileOf(e);
    if (t && e.target === t.el && focusable.has(t.cell.id)) setActive(t.cell.id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || !config.navigable || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = tileOf(e);
    // Only when a tile itself has focus, not an input or button inside it.
    if (!t || e.target !== t.el || !focusable.has(t.cell.id)) return;
    const action = keyAction(layout, t.cell, e.key, (cell) => focusable.has(cell.id), !!config.onCellActivate);
    if (!action) return;
    e.preventDefault();
    if ("activate" in action) config.onCellActivate!(t.cell, t.state);
    else if ("move" in action) {
      const to = action.move;
      setActive(to.id);
      const shownTile = [...tiles.values()].find((x) => x.cell.id === to.id);
      if (shownTile) shownTile.el.focus();
      else {
        // Out of view (virtualised): render it, then focus it.
        pendingFocus = to.id;
        render();
      }
    }
  };
  container.addEventListener("click", onClick);
  container.addEventListener("focusin", onFocusIn);
  container.addEventListener("keydown", onKeyDown);

  render();

  return {
    element: container,
    get layout() {
      return layout;
    },
    update(changes) {
      config = { ...config, ...changes };
      render();
    },
    refresh: render,
    tileElement(cellId) {
      for (const t of tiles.values()) if (t.cell.id === cellId) return t.el;
      return undefined;
    },
    destroy() {
      destroyed = true;
      stopWatching?.();
      timers.forEach(clearTimeout);
      container.removeEventListener("click", onClick);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("keydown", onKeyDown);
      // Take items out of their tiles, so they can be used elsewhere.
      for (const t of [...tiles.values(), ...leaving]) {
        if (t.safe) setChildren(t.safe, []);
        setChildren(t.el, []);
      }
      container.remove();
    },
  };
}

