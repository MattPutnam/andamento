import { useId, useMemo, type ReactNode, type SVGProps } from "react";
import type { Cell, ContentCells, ContentPlacement, Layout, LayoutOptions } from "@andamento/core";
import { cellPath, polygonToPath, resolveCellStyles, type FillSource, type ImageSource } from "@andamento/svg";
import { useResolvedLayout, type FitProp } from "./useTileLayout";

export interface SvgCellRenderContext {
  /** `d` attribute of the cell outline. */
  path: string;
  /** Id of a <clipPath> with the cell's shape, already in the SVG. */
  clipPathId: string;
  /** Ready-made `clipPath` prop value: `url(#…)`. */
  clipPath: string;
  /** The fill/image the default renderer would have used. */
  fill: string;
  image?: string;
  /** Which item of `images` the cell shows (-1 if none or if `images` is a function). */
  slot: number;
}

export interface SvgTileLayoutProps extends Omit<SVGProps<SVGSVGElement>, "children" | "fill" | "stroke" | "strokeWidth"> {
  /** Layout options; or pass a precomputed `layout` instead. */
  options?: LayoutOptions;
  layout?: Layout;
  images?: ImageSource;
  repeatImages?: boolean;
  /** Which cells may hold an image from the `images` array: "all" (default), "whole" or a test. */
  contentCells?: ContentCells;
  /** Where images go when there are fewer than cells: "reading" (default), "center" or "spread". */
  placement?: ContentPlacement;
  /**
   * Size the tiles to the `images` array (counted by `contentCells`): `true`/"atLeast" or
   * "nearest". Ignored with `layout`, `repeatImages` or an `images` function.
   */
  fit?: FitProp;
  /** Cell color under (or instead of) images. Defaults to `defaultPalette`. */
  fill?: FillSource;
  stroke?: string;
  strokeWidth?: number;
  /** Color painted across the whole region, behind the cells. */
  background?: string;
  /** Replace the default cell rendering with SVG content. Rendered inside a <g> per cell. */
  renderCell?: (cell: Cell, ctx: SvgCellRenderContext) => ReactNode;
  /** Accessible title. */
  title?: string;
}

/**
 * Renders a tiling as a single <svg>: colored cells, optionally with images clipped
 * to each cell. Use this when you need pure SVG (export, print, embedding in other SVG);
 * use <TileLayout> to put arbitrary HTML/React content in the tiles.
 */
export function SvgTileLayout(props: SvgTileLayoutProps) {
  const {
    options,
    layout: given,
    images,
    repeatImages,
    contentCells,
    placement,
    fit,
    fill,
    stroke,
    strokeWidth = 1,
    background,
    renderCell,
    title,
    ...svgProps
  } = props;
  const fitTo = Array.isArray(images) && !repeatImages ? images.length : 0;
  const layout = useResolvedLayout("SvgTileLayout", options, given, { fit, count: fitTo, cells: contentCells });
  const prefix = "andamento" + useId().replace(/:/g, "");
  const styles = useMemo(
    () => resolveCellStyles(layout, { images, repeatImages, fill, contentCells, placement }),
    [layout, images, repeatImages, fill, contentCells, placement],
  );
  const { x, y, width, height } = layout.bounds;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${x} ${y} ${width} ${height}`} role={title ? "img" : undefined} {...svgProps}>
      {title && <title>{title}</title>}
      {background && <path className="andamento-region" d={polygonToPath(layout.region)} fill={background} />}
      {layout.cells.map((cell, i) => {
        const d = cellPath(layout, cell);
        const clipPathId = `${prefix}-clip-${cell.index}`;
        const style = styles[i]!;
        const ctx: SvgCellRenderContext = { path: d, clipPathId, clipPath: `url(#${clipPathId})`, ...style };
        return (
          <g
            key={cell.id}
            className="andamento-cell"
            data-cell-id={cell.id}
            data-index={cell.index}
            data-empty={style.image ? undefined : ""}
            data-boundary={cell.boundary ? "" : undefined}
          >
            <clipPath id={clipPathId}>
              <path d={d} />
            </clipPath>
            {renderCell ? renderCell(cell, ctx) : <DefaultCell cell={cell} ctx={ctx} />}
            {stroke && <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />}
          </g>
        );
      })}
    </svg>
  );
}

function DefaultCell({ cell, ctx }: { cell: Cell; ctx: SvgCellRenderContext }) {
  return (
    <>
      <path d={ctx.path} fill={ctx.fill} />
      {ctx.image && <SvgCellImage cell={cell} href={ctx.image} clipPath={ctx.clipPath} />}
    </>
  );
}

export interface SvgCellImageProps extends Omit<SVGProps<SVGImageElement>, "href" | "x" | "y" | "width" | "height"> {
  cell: Cell;
  href: string;
  /** Pass `ctx.clipPath` from `renderCell`. */
  clipPath: string;
}

/** An SVG <image> that covers the cell (like CSS `object-fit: cover`), clipped to its shape. */
export function SvgCellImage({ cell, href, clipPath, ...rest }: SvgCellImageProps) {
  return (
    <image
      href={href}
      x={cell.bbox.x}
      y={cell.bbox.y}
      width={cell.bbox.width}
      height={cell.bbox.height}
      preserveAspectRatio="xMidYMid slice"
      clipPath={clipPath}
      {...rest}
    />
  );
}
