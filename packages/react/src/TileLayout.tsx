import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  backdropCss,
  cellCss,
  cellInDirection,
  cellsInRect,
  contentSlots,
  matchSlots,
  regionCss,
  safeAreaCss,
  screenToLayout,
  type Cell,
  type ContentCells,
  type ContentPlacement,
  type Layout,
  type LayoutOptions,
  type Rect,
} from "@andamento/core";
import { cellPath, defaultBevel, neutralPalette, reliefPaths, resolveFills, shadowOffset, type FillSource, type ReliefOptions } from "@andamento/svg";
import { useResolvedLayout, type FitProp } from "./useTileLayout";

/** What a per-cell prop function is told about the cell besides its geometry. */
export interface CellState {
  /** The cell has no content (no child, or `renderCell` returned nothing). */
  empty: boolean;
  /**
   * Position among the cells that hold content, in reading order (the child index), or
   * -1. With `renderCell`, every cell allowed by `contentCells` is numbered.
   */
  slot: number;
}

type PerCell<T> = T | ((cell: Cell, state: CellState) => T);
const resolve = <T,>(v: PerCell<T> | undefined, cell: Cell, state: CellState): T | undefined =>
  typeof v === "function" ? (v as (c: Cell, s: CellState) => T)(cell, state) : v;

const isEmpty = (n: ReactNode) => n == null || n === false || n === true || n === "";

export interface TileLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Layout options; or pass a precomputed `layout` instead. */
  options?: LayoutOptions;
  layout?: Layout;
  /**
   * Any React content. Each top-level child fills one tile, in reading order
   * (top-to-bottom, left-to-right), and is clipped to the tile's shape.
   * Extra children beyond the number of tiles are not rendered.
   */
  children?: ReactNode;
  /**
   * Alternative to `children`: compute each tile's content from its cell. Takes precedence.
   * `slot` numbers the cells allowed by `contentCells` in reading order (-1 for the rest).
   */
  renderCell?: (cell: Cell, state: { slot: number }) => ReactNode;
  /**
   * Which tiles may hold children: "all" (default), "whole" (only tiles not cut by the
   * region outline), or a test per cell. The others are left empty.
   */
  contentCells?: ContentCells;
  /**
   * Where children go when there are fewer than tiles: "reading" (default; the first
   * tiles in reading order), "center" (the middle of the region) or "spread" (evenly
   * over it). Children always run in reading order across the tiles chosen.
   */
  placement?: ContentPlacement;
  /**
   * Width / height of each child, in order. When given, each child goes in a tile of
   * similar shape, so `object-fit: cover` crops as little as possible (landscape photos in
   * wide tiles, portraits in tall ones); see `matchSlots`. Featured tiles still take the
   * first children. Missing entries count as square. Ignored with `renderCell`.
   */
  aspects?: readonly number[];
  /**
   * Keep content out of the tiles' clipped corners: each tile's content goes in a box at
   * the tile's safe area (see `safeArea`), the largest rectangle that fits inside its shape,
   * instead of filling the tile's bounding box. Useful for text in triangles or hexagons.
   * With `aspects`, each child's box has the child's shape, so it shows whole and uncropped.
   * The box has `data-safe-area`; style its contents to fill it. Tiles show `fill` around
   * their content.
   */
  safeArea?: boolean;
  /** With `aspects`: "shape" also picks which tiles hold children by their shape, ignoring `placement`. */
  choose?: "placement" | "shape";
  /**
   * Color of empty tiles: a color, a palette (neighbouring tiles get different entries),
   * or a function per cell. Defaults to `neutralPalette`; use "transparent" for none.
   */
  fill?: FillSource;
  /**
   * Size the tiles to the children: scales the pattern so there are about as many tiles
   * (counted by `contentCells`) as children. `true`/"atLeast" makes sure every child gets
   * a tile; "nearest" gets as close as possible. Ignored with `layout` or `renderCell`.
   */
  fit?: FitProp;
  /**
   * One picture across all the tiles: rendered in every tile, sized and positioned to the
   * whole layout, so each tile shows its own piece. Use an element that fills its box,
   * e.g. `<img src=… style={coverStyle} />`. It sits behind the tile's content, and empty
   * tiles show it instead of `fill`. (Each tile gets its own copy, so a video would play
   * out of sync; images are loaded once.)
   */
  backdrop?: ReactNode;
  /**
   * Raised tiles: a bevel round each tile, lit from one side and drawn over its content,
   * and optionally a soft shadow each tile casts into the grout (set `shadow`). `true` for
   * the defaults. With `gap` as the grout width and `background` as its color or texture,
   * it looks like a tiled surface. See `ReliefOptions`.
   */
  relief?: boolean | ReliefOptions;
  /**
   * Keyboard navigation: tiles with content become focusable as one tab stop (roving
   * tabindex). Arrow keys move to the nearest tile in that direction, whatever the tiling;
   * Home and End go to the first and last. The focused tile shows `focusRing`.
   */
  navigable?: boolean;
  /**
   * Called when a tile with content is activated: clicked, or Enter or Space while it has
   * focus (with `navigable`).
   */
  onCellActivate?: (cell: Cell, state: CellState) => void;
  /** Accessible name for each tile (its `aria-label`), e.g. a photo's description. */
  cellLabel?: PerCell<string | undefined>;
  /**
   * Color of the focus outline drawn inside the focused tile's shape (a CSS outline would be
   * clipped away), with a white inner line so it shows on any content. `false` for none,
   * if you style `[data-cell-id]:focus-visible` yourself. Defaults to "#1a56db".
   */
  focusRing?: string | false;
  /**
   * Animate changes: when the layout changes (a resize, another tiling, a new gap) or the
   * children do, tiles glide and morph into their new places and shapes, a child keeping
   * its tile as it moves; new tiles fade in and removed ones fade out. Pure CSS
   * transitions, skipped when the user prefers reduced motion. `true` for 400 ms, or
   * `{ duration, easing }`.
   */
  animate?: boolean | { duration?: number; easing?: string };
  /**
   * Mount only the tiles in view (plus `overscan` pixels round it, default 300), for
   * layouts with thousands of tiles. Tiles mount and unmount as the page or any scrolling
   * container scrolls, or the layout resizes. Keyboard navigation still reaches every
   * tile (the focused one stays mounted and is scrolled to), and list items carry
   * `aria-setsize` and `aria-posinset`. With `renderCell`, every cell `contentCells`
   * allows counts as having content. On the server no tiles are rendered.
   */
  virtualize?: boolean | { overscan?: number };
  /** Content for empty tiles. */
  fallback?: PerCell<ReactNode>;
  /** Class name for each tile wrapper (fixed or per cell). */
  cellClassName?: PerCell<string>;
  /** Extra style for each tile wrapper (fixed or per cell), e.g. a background color. */
  cellStyle?: PerCell<CSSProperties>;
  /** Color painted across the whole region, visible through the gaps. */
  background?: string;
}

/**
 * Renders a tiling as HTML: one absolutely positioned, `clip-path`-ed element per tile,
 * holding whatever you put in it (images, video, text, components). Everything is sized
 * in percentages, so the layout scales with the container's width.
 *
 * Each tile wrapper has `data-cell-id` and `data-index`, plus `data-empty` (no content)
 * and `data-boundary` (cut by the region outline) for styling.
 *
 * Clipping also applies to pointer events, so hover and clicks follow the tile shapes.
 */
export function TileLayout(props: TileLayoutProps) {
  const {
    options,
    layout: given,
    children,
    renderCell,
    contentCells,
    placement,
    aspects,
    choose,
    safeArea,
    fill = neutralPalette,
    fit,
    backdrop,
    relief: reliefProp,
    navigable,
    onCellActivate,
    cellLabel,
    focusRing = "#1a56db",
    animate,
    virtualize,
    fallback,
    cellClassName,
    cellStyle,
    background,
    style,
    role,
    onKeyDown,
    ...rest
  } = props;
  const uid = "andamento" + useId().replace(/:/g, "");
  const items = renderCell ? [] : Children.toArray(children);
  const layout = useResolvedLayout("TileLayout", options, given, { fit: !renderCell && fit, count: items.length, cells: contentCells });
  const { bounds } = layout;
  const count = renderCell ? Infinity : items.length;
  const slots = useMemo(
    () =>
      aspects && !renderCell
        ? matchSlots(layout, Array.from({ length: count }, (_, i) => aspects[i] ?? 1), { cells: contentCells, placement, choose })
        : contentSlots(layout, count, { cells: contentCells, placement }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, count, contentCells, placement, aspects?.join(","), choose, !renderCell],
  );
  const fills = useMemo(() => resolveFills(layout, fill), [layout, fill]);
  const relief = reliefProp === true ? {} : reliefProp || undefined;
  const reliefKey = relief ? JSON.stringify(relief) : "";
  // Bevels are worked out per tile as it's first drawn (and kept), not for every tile up front.
  const bevelCache = useMemo(() => new Map<number, ReturnType<typeof reliefPaths>>(), [layout, reliefKey]);
  const bevelWidth = useMemo(() => (relief ? (relief.bevel ?? defaultBevel(layout)) : 0), [layout, reliefKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const bevelFor = (i: number) => {
    if (!relief || bevelWidth <= 0) return undefined;
    let b = bevelCache.get(i);
    if (!b) bevelCache.set(i, (b = reliefPaths(layout, layout.cells[i]!, relief, bevelWidth)));
    return b;
  };
  const cast = relief && shadowOffset(relief);

  // Key by child where possible, so a child keeps its state (video position, inputs,
  // animations) when the layout changes underneath it.
  const keyOf = (i: number): Key => {
    const slot = slots[i]!;
    if (!renderCell && slot >= 0) {
      const child = items[slot];
      return isValidElement(child) && child.key != null ? `child:${child.key}` : `child:${slot}`;
    }
    return `cell:${layout.cells[i]!.id}`;
  };
  // What a tile holds.
  const makeEntry = (i: number) => {
    const cell = layout.cells[i]!;
    const slot = slots[i]!;
    let content: ReactNode = null;
    if (renderCell) content = renderCell(cell, { slot });
    else if (slot >= 0) content = items[slot];
    const empty = isEmpty(content);
    const state: CellState = { empty, slot: empty && !renderCell ? -1 : slot };
    if (empty) content = resolve(fallback, cell, state);
    return { i, cell, content, key: keyOf(i), empty, state };
  };

  // Virtualisation: the part of the layout in view, in layout units (null until measured).
  const virtual = !!virtualize;
  const overscan = Math.max(0, (typeof virtualize === "object" ? virtualize.overscan : undefined) ?? 300);
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Rect | null>(null);
  // Without virtualisation, every tile's entry is worked out before rendering, so navigation
  // knows which have content. With it, only the tiles in view are; whether others have
  // content is judged without rendering them.
  const allEntries = virtual ? undefined : layout.cells.map((_, i) => makeEntry(i));
  const hasContent = (i: number) =>
    allEntries ? !allEntries[i]!.empty : renderCell ? slots[i]! >= 0 : slots[i]! >= 0 && !isEmpty(items[slots[i]!]);

  // Animation: transitions on each tile's box and clip path (resampled to a fixed number of
  // points so shapes can morph), and enter / exit animations for tiles that come and go.
  const anim = animate
    ? {
        duration: (typeof animate === "object" ? animate.duration : undefined) ?? 400,
        easing: (typeof animate === "object" ? animate.easing : undefined) ?? "cubic-bezier(0.2, 0.8, 0.2, 1)",
      }
    : undefined;
  const timing = anim ? `${anim.duration}ms ${anim.easing}` : "";
  const boxTransition = anim ? ["left", "top", "width", "height"].map((p) => `${p} ${timing}`).join(", ") : undefined;
  const tileTransition = anim ? `${boxTransition}, clip-path ${timing}, background-color ${timing}` : undefined;
  const mounted = useRef(false);
  const lastKeys = useRef(new Set<Key>());
  const entering = useRef(new Set<Key>());
  const lastTiles = useRef(new Map<Key, ReactElement>());
  const [exiting, setExiting] = useState(() => new Map<Key, ReactElement>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Roving tabindex: one tile is the tab stop; arrow keys move it.
  const focusable = new Set(navigable ? layout.cells.filter((c) => hasContent(c.index)).map((c) => c.id) : []);
  const [activeId, setActiveId] = useState<string>();
  const firstFocusable = layout.cells.find((c) => focusable.has(c.id))?.id;
  const active = activeId !== undefined && focusable.has(activeId) ? activeId : firstFocusable;
  const tiles = useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = useRef<string>();
  const list = (role ?? "list") === "list";

  // The tiles to render: all of them, or those in view plus the tab stop (so Tab finds it).
  let entries: ReturnType<typeof makeEntry>[];
  if (allEntries) entries = allEntries;
  else {
    const shown = new Set(view && view.width >= 0 ? cellsInRect(layout, view).map((c) => c.index) : []);
    const activeCell = active !== undefined ? layout.cells.find((c) => c.id === active) : undefined;
    if (activeCell) shown.add(activeCell.index);
    entries = [...shown].sort((a, b) => a - b).map(makeEntry);
  }
  // List positions, as screen readers can't count tiles that aren't there.
  const positions = useMemo(() => {
    if (!virtual) return undefined;
    const pos = new Map<number, number>();
    for (const c of layout.cells) if (hasContent(c.index)) pos.set(c.index, pos.size + 1);
    return pos;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtual, layout, slots, items.length, !renderCell]);

  // Animation bookkeeping uses every tile's key, so tiles scrolling in and out of view
  // don't count as coming and going.
  const allKeys = anim ? new Set(layout.cells.map((_, i) => keyOf(i))) : undefined;
  for (const e of entries) if (anim && mounted.current && !lastKeys.current.has(e.key)) entering.current.add(e.key);

  const moveTo = (cell: Cell | undefined) => {
    if (!cell) return false;
    setActiveId(cell.id);
    const el = tiles.current.get(cell.id);
    // A tile out of view isn't mounted yet: focus it once it is.
    if (el) el.focus();
    else pendingFocus.current = cell.id;
    return true;
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !navigable || e.altKey || e.ctrlKey || e.metaKey) return;
    // Only when a tile itself has focus, not an input or button inside it.
    const entry = entries.find((x) => tiles.current.get(x.cell.id) === e.target);
    if (!entry || !focusable.has(entry.cell.id)) return;
    const accept = (c: Cell) => focusable.has(c.id);
    const ordered = layout.cells.filter(accept).map((cell) => ({ cell }));
    let handled = false;
    switch (e.key) {
      case "ArrowUp": handled = moveTo(cellInDirection(layout, entry.cell, "up", accept)); break;
      case "ArrowDown": handled = moveTo(cellInDirection(layout, entry.cell, "down", accept)); break;
      case "ArrowLeft": handled = moveTo(cellInDirection(layout, entry.cell, "left", accept)); break;
      case "ArrowRight": handled = moveTo(cellInDirection(layout, entry.cell, "right", accept)); break;
      case "Home": handled = moveTo(ordered[0]?.cell); break;
      case "End": handled = moveTo(ordered[ordered.length - 1]?.cell); break;
      case "Enter":
      case " ":
        if (onCellActivate) {
          onCellActivate(entry.cell, entry.state);
          handled = true;
        }
        break;
    }
    // Arrow keys at the edge are still ours: don't scroll the page.
    if (handled || e.key.startsWith("Arrow")) e.preventDefault();
  };

  const rendered = entries.map(({ i, cell, content, key, empty, state }) => {
        const slot = slots[i]!;
        const bevel = bevelFor(i);
        const css = cellCss(cell, layout, 4, anim ? { points: MORPH_POINTS } : {});
        // Tiles with nothing in them are decoration: hidden from assistive technology.
        const silent = empty && isEmpty(content);
        const canFocus = focusable.has(cell.id);
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) tiles.current.set(cell.id, el);
              else tiles.current.delete(cell.id);
            }}
            role={silent ? undefined : list ? "listitem" : undefined}
            aria-hidden={silent ? true : undefined}
            aria-label={silent ? undefined : resolve(cellLabel, cell, state)}
            aria-setsize={positions && list && !silent ? positions.size : undefined}
            aria-posinset={positions && list && !silent ? positions.get(i) : undefined}
            tabIndex={canFocus ? (cell.id === active ? 0 : -1) : undefined}
            onFocus={canFocus ? (e) => e.target === e.currentTarget && setActiveId(cell.id) : undefined}
            onClick={onCellActivate && !empty ? () => onCellActivate(cell, state) : undefined}
            className={resolve(cellClassName, cell, state)}
            data-cell-id={cell.id}
            data-index={cell.index}
            data-empty={empty ? "" : undefined}
            data-boundary={cell.boundary ? "" : undefined}
            data-entering={entering.current.has(key) ? "" : undefined}
            style={{
              position: "absolute",
              boxSizing: "border-box",
              overflow: "hidden",
              ...css,
              ...(tileTransition ? { transition: tileTransition } : undefined),
              // With safeArea, content no longer covers its tile, so every tile shows its fill.
              ...((empty || safeArea) && backdrop == null ? { background: fills[i] } : undefined),
              ...(onCellActivate && !empty ? { cursor: "pointer" } : undefined),
              ...resolve(cellStyle, cell, state),
            }}
          >
            {backdrop != null && (
              // z-index -1 puts it behind the content but inside the tile: the tile's
              // clip-path makes it a stacking context.
              <div aria-hidden style={{ position: "absolute", zIndex: -1, pointerEvents: "none", ...backdropCss(cell, layout), transition: boxTransition }}>
                {backdrop}
              </div>
            )}
            {safeArea && content != null && !isEmpty(content) ? (
              <div
                data-safe-area=""
                style={{
                  position: "absolute",
                  boxSizing: "border-box",
                  ...safeAreaCss(cell, layout, { aspect: !renderCell && !empty && aspects ? (aspects[slot] ?? 1) : undefined }),
                  transition: boxTransition,
                }}
              >
                {content}
              </div>
            ) : (
              content
            )}
            {bevel && bevel.length > 0 && (
              // Over the content; the tile's box is its bounding box, so map that to the viewBox.
              // When animating, the bevel is for the new shape, so it fades in as the tile arrives.
              <svg
                key={anim ? css.clipPath : undefined}
                aria-hidden
                data-bevel=""
                data-late={anim ? "" : undefined}
                viewBox={`${cell.bbox.x} ${cell.bbox.y} ${cell.bbox.width} ${cell.bbox.height}`}
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              >
                {bevel.map((p, k) => (
                  <path key={k} d={p.d} fill={p.fill} fillOpacity={p.opacity} />
                ))}
              </svg>
            )}
            {canFocus && focusRing !== false && (
              // The tile's outline, stroked across its edge; the clip keeps the inner half.
              <svg
                aria-hidden
                data-focus-ring=""
                viewBox={`${cell.bbox.x} ${cell.bbox.y} ${cell.bbox.width} ${cell.bbox.height}`}
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              >
                <path d={cellPath(layout, cell)} fill="none" stroke="#fff" strokeWidth={8} vectorEffect="non-scaling-stroke" />
                <path d={cellPath(layout, cell)} fill="none" stroke={focusRing} strokeWidth={4} vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        );
      });

  // After each commit: tiles that just went away stay a moment to fade out.
  useIsomorphicLayoutEffect(() => {
    const current = new Map<Key, ReactElement>(rendered.map((el) => [el.key!, el]));
    const present = allKeys ?? current;
    if (anim && mounted.current) {
      const gone = [...lastTiles.current].filter(([k]) => !present.has(k));
      if (gone.length) {
        setExiting((prev) => new Map([...prev, ...gone]));
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          setExiting((prev) => {
            const next = new Map(prev);
            for (const [k, el] of gone) if (next.get(k) === el) next.delete(k);
            return next;
          });
        }, anim.duration);
        timers.current.add(timer);
      }
    }
    for (const k of entering.current) if (!present.has(k)) entering.current.delete(k);
    lastKeys.current = new Set(present.keys());
    lastTiles.current = current;
    mounted.current = true;
    if (pendingFocus.current) {
      const el = tiles.current.get(pendingFocus.current);
      if (el) {
        pendingFocus.current = undefined;
        el.focus();
      }
    }
  });

  // Virtualisation: measure what's in view, again on scroll (of the page or any container)
  // and resize, at most once a frame. The visible part is widened by the overscan and
  // snapped outwards to a coarse grid, so small scrolls don't re-render.
  useIsomorphicLayoutEffect(() => {
    if (!virtual) return;
    const el = container.current;
    if (!el) return;
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f: () => void) => setTimeout(f, 16) as unknown as number;
    const cancel = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (h: number) => clearTimeout(h);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const seen = visibleClientRect(el, box);
      const scale = Math.min(box.width / (bounds.width || 1), box.height / (bounds.height || 1));
      if (!seen || !(scale > 0)) {
        setView((v) => (v && v.width < 0 ? v : { x: 0, y: 0, width: -1, height: -1 }));
        return;
      }
      const a = screenToLayout(layout, box, seen.left - overscan, seen.top - overscan);
      const b = screenToLayout(layout, box, seen.right + overscan, seen.bottom + overscan);
      const q = Math.max(overscan / 2, 50) / scale;
      const x0 = Math.floor(a.x / q) * q, y0 = Math.floor(a.y / q) * q;
      const next = { x: x0, y: y0, width: Math.ceil(b.x / q) * q - x0, height: Math.ceil(b.y / q) * q - y0 };
      setView((v) => (v && v.x === next.x && v.y === next.y && v.width === next.width && v.height === next.height ? v : next));
    };
    const schedule = () => {
      if (!frame) frame = raf(measure);
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
  }, [virtual, layout, overscan]);
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);
  const leaving = anim
    ? [...exiting].filter(([k]) => !lastKeys.current.has(k) && !rendered.some((el) => el.key === k))
    : [];

  return (
    <div
      data-andamento=""
      ref={container}
      role={role ?? "list"}
      {...rest}
      onKeyDown={handleKeyDown}
      style={{ position: "relative", width: "100%", aspectRatio: `${bounds.width} / ${bounds.height}`, ...style }}
    >
      {navigable && focusRing !== false && <style>{FOCUS_CSS}</style>}
      {anim && <style>{animationCss(anim.duration, anim.easing)}</style>}
      {background && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, background, clipPath: regionCss(layout), transition: anim ? `clip-path ${timing}` : undefined }}
        />
      )}
      {cast && (
        <svg
          aria-hidden
          data-andamento-shadow=""
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", clipPath: regionCss(layout) }}
        >
          <filter id={`${uid}-shadow`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={cast.blur} />
          </filter>
          <path
            d={entries.map((e) => cellPath(layout, e.cell)).join("")}
            fillRule="evenodd"
            transform={`translate(${cast.dx} ${cast.dy})`}
            fill="#000"
            fillOpacity={cast.opacity}
            filter={`url(#${uid}-shadow)`}
          />
        </svg>
      )}
      {rendered}
      {leaving.map(([k, el]) =>
        cloneElement(el as ReactElement<Record<string, unknown>>, {
          key: k,
          ref: null,
          role: undefined,
          tabIndex: undefined,
          onClick: undefined,
          onFocus: undefined,
          "aria-hidden": true,
          "data-entering": undefined,
          "data-exiting": "",
          style: {
            ...((el.props as { style?: CSSProperties }).style ?? {}),
            pointerEvents: "none",
            animation: `andamento-exit ${timing} forwards`,
          },
        }),
      )}
    </div>
  );
}

/**
 * The part of `el` (whose box is `box`) visible on screen: within the window and every
 * ancestor that clips its overflow. Undefined when none of it is.
 */
function visibleClientRect(el: Element, box: DOMRect) {
  let left = Math.max(box.left, 0);
  let top = Math.max(box.top, 0);
  let right = Math.min(box.right, window.innerWidth || document.documentElement.clientWidth);
  let bottom = Math.min(box.bottom, window.innerHeight || document.documentElement.clientHeight);
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
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

/** Clip paths get this many points when animating, so any two tile shapes can morph. */
const MORPH_POINTS = 72;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const animationCss = (duration: number, easing: string) =>
  "@keyframes andamento-enter{from{opacity:0;transform:scale(.85)}}" +
  "@keyframes andamento-exit{to{opacity:0;transform:scale(.85)}}" +
  "@keyframes andamento-late{0%,70%{opacity:0}to{opacity:1}}" +
  `[data-andamento]>[data-entering]{animation:andamento-enter ${duration}ms ${easing} backwards}` +
  `[data-andamento]>[data-cell-id]>[data-late]{animation:andamento-late ${duration}ms linear backwards}` +
  "@media (prefers-reduced-motion:reduce){[data-andamento]>[data-cell-id],[data-andamento]>[data-cell-id] *{transition:none!important;animation:none!important}" +
  "[data-andamento]>[data-exiting]{display:none}}";

// The ring shows only on keyboard focus; a CSS outline would be clipped away anyway.
const FOCUS_CSS =
  "[data-andamento]>[data-cell-id]:focus{outline:none}" +
  "[data-andamento]>[data-cell-id]>[data-focus-ring]{display:none}" +
  "[data-andamento]>[data-cell-id]:focus-visible>[data-focus-ring]{display:block}";

/** Style that makes an <img> or <video> cover its tile, like `object-fit: cover`. */
export const coverStyle: CSSProperties = { display: "block", width: "100%", height: "100%", objectFit: "cover" };
