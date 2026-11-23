import { useId, useMemo, type ReactNode, type SVGProps } from "react";
import { cellShape, coverRect, safeArea, type Cell, type Focus, type ContentCells, type ContentPlacement, type Layout, type LayoutOptions, type Rect } from "@andamento/core";
import { cellA11y, cellPath, defaultBevel, regionPath, viewPath, reliefPaths, resolveCellStyles, shadowOffset, type FillSource, type ImageSource, type ReliefOptions } from "@andamento/svg";
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
  /** Width / height of each image, to put images in cells of similar shape (see `matchSlots`). */
  imageAspects?: readonly number[];
  /** With `imageAspects`: "shape" also picks which cells get images by their shape. */
  choose?: "placement" | "shape";
  /**
   * "cover" (default) fills each cell's bounding box, cropped to its shape; "contain" shows
   * each image whole inside the cell's safe area (see `safeArea`), at its `imageAspects` shape.
   */
  imageFit?: "cover" | "contain";
  /**
   * With `imageFit: "contain"`, for cells an `edges: "window"` layout cuts: fit the image in
   * the whole tile ("tile", the default) or in the part that shows ("visible").
   */
  containWithin?: "tile" | "visible";
  /**
   * Focal point of each image (by position; fractions of its width and height, see
   * `estimateFocus`), kept in view when "cover" crops it (see `coverRect`). Needs each image's
   * shape, from `imageAspects` or the focus's `aspect`.
   */
  imageFocus?: readonly (Focus | undefined)[];
  /**
   * How many tiles each image in `images` spans (1 for most): heavier images get featured
   * tiles where they fall in reading order (see `weightedLayout`). Needs `options`.
   */
  imageWeights?: readonly number[];
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
  /**
   * One image across all the cells (a URL), cropped to cover the layout and clipped to the
   * cells. The default cell rendering then skips `fill`; per-cell `images` go on top.
   */
  backdrop?: string;
  /**
   * Raised tiles: a lit bevel over each cell, and optionally a shadow cast into the grout.
   * `true` for the defaults. See `ReliefOptions`. Drawn over `renderCell` content too.
   */
  relief?: boolean | ReliefOptions;
  /** Replace the default cell rendering with SVG content. Rendered inside a <g> per cell. */
  renderCell?: (cell: Cell, ctx: SvgCellRenderContext) => ReactNode;
  /** Accessible title. */
  title?: string;
  /** Text alternative per image in `images`: those cells become labeled images; the rest decoration. */
  imageAlts?: readonly string[];
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
    imageAspects,
    choose,
    imageFit,
    containWithin,
    imageFocus,
    imageWeights,
    fit,
    fill,
    stroke,
    strokeWidth = 1,
    background,
    backdrop,
    relief: reliefProp,
    renderCell,
    title,
    imageAlts,
    ...svgProps
  } = props;
  const fitTo = Array.isArray(images) && !repeatImages ? images.length : 0;
  const layout = useResolvedLayout("SvgTileLayout", options, given, {
    fit,
    count: fitTo,
    cells: contentCells,
    weights: Array.isArray(images) ? imageWeights : undefined,
    placement,
  });
  const prefix = "andamento" + useId().replace(/:/g, "");
  const styles = useMemo(
    () => resolveCellStyles(layout, { images, repeatImages, fill, contentCells, placement, imageAspects, choose }),
    [layout, images, repeatImages, fill, contentCells, placement, imageAspects, choose],
  );
  const { x, y, width, height } = layout.bounds;
  const relief = reliefProp === true ? {} : reliefProp || undefined;
  const reliefKey = relief ? JSON.stringify(relief) : "";
  const bevels = useMemo(() => {
    if (!relief) return undefined;
    const bevel = relief.bevel ?? defaultBevel(layout);
    return bevel > 0 ? layout.cells.map((c) => reliefPaths(layout, c, relief, bevel)) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, reliefKey]);
  const cast = relief && shadowOffset(relief);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${x} ${y} ${width} ${height}`} role={imageAlts?.length ? "group" : title ? "img" : undefined} {...svgProps}>
      {title && <title>{title}</title>}
      {background && <path className="andamento-region" d={regionPath(layout)} fill={background} fillRule="evenodd" />}
      {layout.view && (
        <clipPath id={`${prefix}-view`}>
          <path d={viewPath(layout)} clipRule="evenodd" />
        </clipPath>
      )}
      <g className={layout.view ? "andamento-view" : undefined} clipPath={layout.view ? `url(#${prefix}-view)` : undefined}>
      {backdrop && (
        <>
          <clipPath id={`${prefix}-backdrop`}>
            {layout.cells.map((cell) => (
              <path key={cell.id} d={cellPath(layout, cell)} clipRule="evenodd" />
            ))}
          </clipPath>
          <image
            className="andamento-backdrop"
            href={backdrop}
            x={x}
            y={y}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${prefix}-backdrop)`}
          />
        </>
      )}
      {cast && (
        <g className="andamento-shadow" clipPath={`url(#${prefix}-region)`}>
          <clipPath id={`${prefix}-region`}>
            <path d={regionPath(layout)} clipRule="evenodd" />
          </clipPath>
          <filter id={`${prefix}-shadow`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={cast.blur} />
          </filter>
          <path
            d={layout.cells.map((c) => cellPath(layout, c)).join("")}
            fillRule="evenodd"
            transform={`translate(${cast.dx} ${cast.dy})`}
            fill="#000"
            fillOpacity={cast.opacity}
            filter={`url(#${prefix}-shadow)`}
          />
        </g>
      )}
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
            {...cellA11y(style, imageAlts)}
          >
            <clipPath id={clipPathId}>
              <path d={d} clipRule="evenodd" />
            </clipPath>
            {renderCell ? renderCell(cell, ctx) : <DefaultCell
                cell={cell}
                ctx={ctx}
                noFill={!!backdrop}
                box={
                  imageFit === "contain" && style.image
                    ? safeArea(cell, layout, { aspect: imageAspects && style.slot >= 0 ? imageAspects[style.slot] : undefined, within: containWithin })
                    : undefined
                }
                cover={(() => {
                  const focus = imageFit !== "contain" && style.image && style.slot >= 0 ? imageFocus?.[style.slot] : undefined;
                  const aspect = focus ? (imageAspects?.[style.slot] ?? focus.aspect) : undefined;
                  return focus && aspect ? coverRect(cell, layout, { aspect, focus }) : undefined;
                })()}
              />}
            {bevels?.[i]!.map((p, k) => <path key={k} className="andamento-bevel" d={p.d} fill={p.fill} fillOpacity={p.opacity} />)}
            {stroke && <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} />}
          </g>
        );
      })}
      </g>
    </svg>
  );
}

function DefaultCell({ cell, ctx, noFill, box, cover }: { cell: Cell; ctx: SvgCellRenderContext; noFill: boolean; box?: Rect; cover?: Rect }) {
  return (
    <>
      {!noFill && <path d={ctx.path} fill={ctx.fill} fillRule="evenodd" />}
      {ctx.image && <SvgCellImage cell={cell} href={ctx.image} clipPath={ctx.clipPath} box={box} cover={cover} />}
    </>
  );
}

export interface SvgCellImageProps extends Omit<SVGProps<SVGImageElement>, "href" | "x" | "y" | "width" | "height"> {
  cell: Cell;
  href: string;
  /** Pass `ctx.clipPath` from `renderCell`. */
  clipPath: string;
  /**
   * Draw the image whole inside this box (e.g. `safeArea(cell, layout)`) instead of
   * covering the cell.
   */
  box?: Rect;
  /** Cover this rectangle instead of the cell's box (e.g. `coverRect(cell, layout, { aspect, focus })`). */
  cover?: Rect;
}

/**
 * An SVG <image> that covers the cell (like CSS `object-fit: cover`), clipped to its shape;
 * or, with `box`, shown whole inside the box (like `object-fit: contain`).
 */
export function SvgCellImage({ cell, href, clipPath, box, cover, ...rest }: SvgCellImageProps) {
  const b = box ?? cover ?? cellShape(cell).bbox;
  return (
    <image
      href={href}
      x={b.x}
      y={b.y}
      width={b.width}
      height={b.height}
      preserveAspectRatio={box ? "xMidYMid meet" : "xMidYMid slice"}
      clipPath={clipPath}
      {...rest}
    />
  );
}
