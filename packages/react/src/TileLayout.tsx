import {
  Children,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactNode,
} from "react";
import { cellCss, cssPolygon, type Cell, type Layout, type LayoutOptions } from "@andamento/core";
import { useResolvedLayout } from "./useTileLayout";

type PerCell<T> = T | ((cell: Cell) => T);
const resolve = <T,>(v: PerCell<T> | undefined, cell: Cell): T | undefined =>
  typeof v === "function" ? (v as (c: Cell) => T)(cell) : v;

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
  /** Alternative to `children`: compute each tile's content from its cell. Takes precedence. */
  renderCell?: (cell: Cell) => ReactNode;
  /** Content for tiles that have no child. */
  fallback?: PerCell<ReactNode>;
  /** Class name for each tile wrapper (fixed or per cell). */
  cellClassName?: PerCell<string>;
  /** Extra style for each tile wrapper (fixed or per cell), e.g. a background colour. */
  cellStyle?: PerCell<CSSProperties>;
  /** Colour painted across the whole region, visible through the gaps. */
  background?: string;
}

/**
 * Renders a tiling as HTML: one absolutely positioned, `clip-path`-ed element per tile,
 * holding whatever you put in it (images, video, text, components). Everything is sized
 * in percentages, so the layout scales with the container's width.
 *
 * Clipping also applies to pointer events, so hover and clicks follow the tile shapes.
 */
export function TileLayout(props: TileLayoutProps) {
  const {
    options,
    layout: given,
    children,
    renderCell,
    fallback,
    cellClassName,
    cellStyle,
    background,
    style,
    ...rest
  } = props;
  const layout = useResolvedLayout("TileLayout", options, given);
  const { bounds } = layout;
  const items = renderCell ? [] : Children.toArray(children);

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
        const child = items[i];
        let content: ReactNode;
        // Key by child where possible, so a child keeps its state (video position,
        // inputs, animations) when the layout changes underneath it.
        let key: Key = `cell:${cell.id}`;
        if (renderCell) content = renderCell(cell);
        else if (i < items.length) {
          content = child;
          if (isValidElement(child) && child.key != null) key = `child:${child.key}`;
          else key = `child:${i}`;
        } else content = resolve(fallback, cell);

        const css = cellCss(cell, layout);
        return (
          <div
            key={key}
            className={resolve(cellClassName, cell)}
            data-cell-id={cell.id}
            data-index={cell.index}
            data-empty={content == null || content === false ? "" : undefined}
            style={{ position: "absolute", boxSizing: "border-box", overflow: "hidden", ...css, ...resolve(cellStyle, cell) }}
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
