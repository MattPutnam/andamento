import {
  Children,
  isValidElement,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactNode,
} from "react";
import {
  backdropCss,
  cellCss,
  cellInDirection,
  contentSlots,
  matchSlots,
  regionCss,
  safeAreaCss,
  type Cell,
  type ContentCells,
  type ContentPlacement,
  type Layout,
  type LayoutOptions,
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
  const bevels = useMemo(() => {
    if (!relief) return undefined;
    const bevel = relief.bevel ?? defaultBevel(layout);
    return bevel > 0 ? layout.cells.map((c) => reliefPaths(layout, c, relief, bevel)) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, reliefKey]);
  const cast = relief && shadowOffset(relief);

  // What each tile holds, worked out before rendering so navigation knows which have content.
  const entries = layout.cells.map((cell, i) => {
    const slot = slots[i]!;
    let content: ReactNode = null;
    // Key by child where possible, so a child keeps its state (video position,
    // inputs, animations) when the layout changes underneath it.
    let key: Key = `cell:${cell.id}`;
    if (renderCell) content = renderCell(cell, { slot });
    else if (slot >= 0) {
      const child = items[slot];
      content = child;
      key = isValidElement(child) && child.key != null ? `child:${child.key}` : `child:${slot}`;
    }
    const empty = isEmpty(content);
    const state: CellState = { empty, slot: empty && !renderCell ? -1 : slot };
    if (empty) content = resolve(fallback, cell, state);
    return { cell, content, key, empty, state };
  });

  // Roving tabindex: one tile is the tab stop; arrow keys move it.
  const focusable = new Set(navigable ? entries.filter((e) => !e.empty).map((e) => e.cell.id) : []);
  const [activeId, setActiveId] = useState<string>();
  const firstFocusable = entries.find((e) => focusable.has(e.cell.id))?.cell.id;
  const active = activeId !== undefined && focusable.has(activeId) ? activeId : firstFocusable;
  const tiles = useRef(new Map<string, HTMLDivElement>());
  const list = (role ?? "list") === "list";

  const moveTo = (cell: Cell | undefined) => {
    if (!cell) return false;
    setActiveId(cell.id);
    tiles.current.get(cell.id)?.focus();
    return true;
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !navigable || e.altKey || e.ctrlKey || e.metaKey) return;
    // Only when a tile itself has focus, not an input or button inside it.
    const entry = entries.find((x) => tiles.current.get(x.cell.id) === e.target);
    if (!entry || !focusable.has(entry.cell.id)) return;
    const accept = (c: Cell) => focusable.has(c.id);
    const ordered = entries.filter((x) => accept(x.cell));
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

  return (
    <div
      data-andamento=""
      role={role ?? "list"}
      {...rest}
      onKeyDown={handleKeyDown}
      style={{ position: "relative", width: "100%", aspectRatio: `${bounds.width} / ${bounds.height}`, ...style }}
    >
      {navigable && focusRing !== false && <style>{FOCUS_CSS}</style>}
      {background && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, background, clipPath: regionCss(layout) }}
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
            d={layout.cells.map((c) => cellPath(layout, c)).join("")}
            fillRule="evenodd"
            transform={`translate(${cast.dx} ${cast.dy})`}
            fill="#000"
            fillOpacity={cast.opacity}
            filter={`url(#${uid}-shadow)`}
          />
        </svg>
      )}
      {entries.map(({ cell, content, key, empty, state }, i) => {
        const slot = slots[i]!;
        const css = cellCss(cell, layout);
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
            tabIndex={canFocus ? (cell.id === active ? 0 : -1) : undefined}
            onFocus={canFocus ? (e) => e.target === e.currentTarget && setActiveId(cell.id) : undefined}
            onClick={onCellActivate && !empty ? () => onCellActivate(cell, state) : undefined}
            className={resolve(cellClassName, cell, state)}
            data-cell-id={cell.id}
            data-index={cell.index}
            data-empty={empty ? "" : undefined}
            data-boundary={cell.boundary ? "" : undefined}
            style={{
              position: "absolute",
              boxSizing: "border-box",
              overflow: "hidden",
              ...css,
              // With safeArea, content no longer covers its tile, so every tile shows its fill.
              ...((empty || safeArea) && backdrop == null ? { background: fills[i] } : undefined),
              ...(onCellActivate && !empty ? { cursor: "pointer" } : undefined),
              ...resolve(cellStyle, cell, state),
            }}
          >
            {backdrop != null && (
              // z-index -1 puts it behind the content but inside the tile: the tile's
              // clip-path makes it a stacking context.
              <div aria-hidden style={{ position: "absolute", zIndex: -1, pointerEvents: "none", ...backdropCss(cell, layout) }}>
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
                }}
              >
                {content}
              </div>
            ) : (
              content
            )}
            {bevels && bevels[i]!.length > 0 && (
              // Over the content; the tile's box is its bounding box, so map that to the viewBox.
              <svg
                aria-hidden
                data-bevel=""
                viewBox={`${cell.bbox.x} ${cell.bbox.y} ${cell.bbox.width} ${cell.bbox.height}`}
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              >
                {bevels[i]!.map((p, k) => (
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
      })}
    </div>
  );
}

// The ring shows only on keyboard focus; a CSS outline would be clipped away anyway.
const FOCUS_CSS =
  "[data-andamento]>[data-cell-id]:focus{outline:none}" +
  "[data-andamento]>[data-cell-id]>[data-focus-ring]{display:none}" +
  "[data-andamento]>[data-cell-id]:focus-visible>[data-focus-ring]{display:block}";

/** Style that makes an <img> or <video> cover its tile, like `object-fit: cover`. */
export const coverStyle: CSSProperties = { display: "block", width: "100%", height: "100%", objectFit: "cover" };
