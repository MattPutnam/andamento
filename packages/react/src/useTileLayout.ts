import { useMemo } from "react";
import { createLayout, fitCount, type ContentCells, type FitOptions, type Layout, type LayoutOptions } from "@andamento/core";

/**
 * Compute a layout, recomputing only when the (serialisable) options change.
 * Inline object literals are fine: options are compared by value.
 */
export function useTileLayout(options: LayoutOptions): Layout {
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createLayout(options), [key]);
}

/**
 * Compute a layout whose tiles are sized to give about `count` usable cells (see
 * `fitCount` in @andamento/core). Options are compared by value; a `cells` function by
 * identity.
 */
export function useFitCount(options: LayoutOptions, count: number, fit: FitOptions = {}): Layout {
  const key = JSON.stringify(options);
  const { cells, mode } = fit;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fitCount(options, count, { cells, mode }).layout, [key, count, cells, mode]);
}

/** How a component's `fit` prop sizes its tiles. */
export type FitProp = boolean | "atLeast" | "nearest";

/**
 * Use `layout` if given, otherwise compute one from `options`, fitted to `count` items when
 * `fit` is set. Hooks stay unconditional.
 */
export function useResolvedLayout(
  component: string,
  options?: LayoutOptions,
  layout?: Layout,
  fit?: { fit?: FitProp; count: number; cells?: ContentCells },
): Layout {
  if (!options && !layout) throw new Error(`<${component}> needs either \`options\` or \`layout\``);
  const fitting = !layout && !!options && !!fit?.fit && fit.count >= 1 && Number.isFinite(fit.count);
  const key = JSON.stringify(options ?? PLACEHOLDER);
  const mode = fit?.fit === "nearest" ? "nearest" : "atLeast";
  const count = fitting ? fit!.count : 0;
  const cells = fitting ? fit!.cells : undefined;
  const computed = useMemo(
    () => (fitting ? fitCount(options!, count, { cells, mode }).layout : createLayout(options ?? PLACEHOLDER)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, fitting, count, cells, mode],
  );
  return layout ?? computed;
}

const PLACEHOLDER: LayoutOptions = {
  region: { x: 0, y: 0, width: 1, height: 1 },
  tiling: { type: "grid", width: 1 },
};
