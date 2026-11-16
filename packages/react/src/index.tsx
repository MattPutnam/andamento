import { useId, useMemo, type ReactNode, type SVGProps } from "react";
import { createLayout, type Cell, type Layout, type LayoutOptions } from "@andamento/core";
import { polygonToPath, resolveCellStyles, type FillSource, type ImageSource } from "@andamento/svg";

/**
 * Compute a layout, recomputing only when the (serialisable) options change.
 * Inline object literals are fine: options are compared by value.
 */
export function useTileLayout(options: LayoutOptions): Layout {
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createLayout(options), [key]);
}

export interface CellRenderContext {
  /** `d` attribute of the cell outline. */
  path: string;
  /** Id of a <clipPath> with the cell's shape, already in the SVG. */
  clipPathId: string;
  /** Ready-made `clipPath` prop value: `url(#…)`. */
  clipPath: string;
  /** The fill/photo the default renderer would have used. */
  fill: string;
  image?: string;
}

export interface TileLayoutProps extends Omit<SVGProps<SVGSVGElement>, "children" | "fill" | "stroke" | "strokeWidth"> {
  /** Layout options; or pass a precomputed `layout` instead. */
  options?: LayoutOptions;
  layout?: Layout;
  images?: ImageSource;
  repeatImages?: boolean;
  fill?: FillSource;
  stroke?: string;
  strokeWidth?: number;
  /** Wall colour, painted behind the cells. */
  background?: string;
  /** Replace the default cell rendering. Rendered inside a <g> per cell. */
  renderCell?: (cell: Cell, ctx: CellRenderContext) => ReactNode;
  /** Accessible title. */
  title?: string;
}

export function TileLayout(props: TileLayoutProps) {
  const {
    options,
    layout: given,
    images,
    repeatImages,
    fill,
    stroke,
    strokeWidth = 1,
    background,
    renderCell,
    title,
    ...svgProps
  } = props;
  if (!options && !given) throw new Error("<TileLayout> needs either `options` or `layout`");
  // Hooks must run unconditionally; an empty-ish placeholder is never rendered when `layout` is given.
  const computed = useTileLayout(options ?? PLACEHOLDER);
  const layout = given ?? computed;
  const prefix = "andamento" + useId().replace(/:/g, "");
  const styles = useMemo(() => resolveCellStyles(layout, { images, repeatImages, fill }), [layout, images, repeatImages, fill]);
  const { x, y, width, height } = layout.bounds;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${x} ${y} ${width} ${height}`} role={title ? "img" : undefined} {...svgProps}>
      {title && <title>{title}</title>}
      {background && <path className="andamento-wall" d={polygonToPath(layout.region)} fill={background} />}
      {layout.cells.map((cell, i) => {
        const d = polygonToPath(cell.polygon);
        const clipPathId = `${prefix}-clip-${cell.index}`;
        const style = styles[i]!;
        const ctx: CellRenderContext = { path: d, clipPathId, clipPath: `url(#${clipPathId})`, ...style };
        return (
          <g key={cell.id} className="andamento-cell" data-cell-id={cell.id} data-index={cell.index}>
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

const PLACEHOLDER: LayoutOptions = {
  region: { x: 0, y: 0, width: 1, height: 1 },
  tiling: { type: "grid", width: 1 },
};

function DefaultCell({ cell, ctx }: { cell: Cell; ctx: CellRenderContext }) {
  return (
    <>
      <path d={ctx.path} fill={ctx.fill} />
      {ctx.image && <CellImage cell={cell} href={ctx.image} clipPath={ctx.clipPath} />}
    </>
  );
}

export interface CellImageProps extends Omit<SVGProps<SVGImageElement>, "href" | "x" | "y" | "width" | "height"> {
  cell: Cell;
  href: string;
  /** Pass `ctx.clipPath` from `renderCell`. */
  clipPath: string;
}

/** A photo that covers the cell (like CSS `object-fit: cover`), clipped to its shape. */
export function CellImage({ cell, href, clipPath, ...rest }: CellImageProps) {
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

export type { Cell, Layout, LayoutOptions } from "@andamento/core";
