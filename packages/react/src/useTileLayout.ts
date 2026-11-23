import { useMemo, useRef } from "react";
import { createLayout, fitCount, type ContentCells, type FitOptions, type Layout, type LayoutOptions } from "@andamento/core";
import { type FitProp } from "@andamento/dom";
import { layoutResolver, optionsKey, type LayoutNeeds } from "@andamento/dom/internal";

/**
 * Compute a layout, recomputing only when the options change.
 * Inline object literals are fine: options are compared by value (a function in them,
 * such as `sizeAt`, by identity).
 */
export function useTileLayout(options: LayoutOptions): Layout {
  const key = optionsKey(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createLayout(options), [key]);
}

/**
 * Compute a layout whose tiles are sized to give about `count` usable cells (see
 * `fitCount` in @andamento/core). Options are compared by value; a `cells` function by
 * identity.
 */
export function useFitCount(options: LayoutOptions, count: number, fit: FitOptions = {}): Layout {
  const key = optionsKey(options);
  const { cells, mode } = fit;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fitCount(options, count, { cells, mode }).layout, [key, count, cells, mode]);
}

export type { FitProp };

/**
 * Use `layout` if given, otherwise compute one from `options` (compared by value), fitted to
 * `count` items when `fit` is set.
 */
export function useResolvedLayout(
  component: string,
  options?: LayoutOptions,
  layout?: Layout,
  fit?: LayoutNeeds,
): Layout {
  const resolver = useRef<ReturnType<typeof layoutResolver>>();
  resolver.current ??= layoutResolver(`<${component}>`);
  return resolver.current(options, layout, fit);
}
