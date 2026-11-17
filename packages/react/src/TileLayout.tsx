import {
  Children,
  isValidElement,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactNode,
} from "react";
import {
  cellCss,
  contentSlots,
  cssPolygon,
  type Cell,
  type ContentCells,
  type ContentPlacement,
  type Layout,
  type LayoutOptions,
} from "@andamento/core";
import { neutralPalette, resolveFills, type FillSource } from "@andamento/svg";
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
    fill = neutralPalette,
    fit,
    fallback,
    cellClassName,
    cellStyle,
    background,
    style,
    ...rest
  } = props;
  const items = renderCell ? [] : Children.toArray(children);
  const layout = useResolvedLayout("TileLayout", options, given, { fit: !renderCell && fit, count: items.length, cells: contentCells });
  const { bounds } = layout;
  const count = renderCell ? Infinity : items.length;
  const slots = useMemo(
    () => contentSlots(layout, count, { cells: contentCells, placement }),
    [layout, count, contentCells, placement],
  );
  const fills = useMemo(() => resolveFills(layout, fill), [layout, fill]);

  return (
    <div
      data-andamento=""
      {...rest}
      style={{ position: "relative", width: "100%", aspectRatio: `${bounds.width} / ${bounds.height}`, ...style }}
    >
      {background && (
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, background, clipPath: cssPolygon(layout.region, bounds) }}
        />
      )}
      {layout.cells.map((cell, i) => {
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

        const css = cellCss(cell, layout);
        return (
          <div
            key={key}
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
              ...(empty ? { background: fills[i] } : undefined),
              ...resolve(cellStyle, cell, state),
            }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

/** Style that makes an <img> or <video> cover its tile, like `object-fit: cover`. */
export const coverStyle: CSSProperties = { display: "block", width: "100%", height: "100%", objectFit: "cover" };
