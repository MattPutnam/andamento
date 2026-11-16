import { useMemo } from "react";
import { createLayout, type Layout, type LayoutOptions } from "@andamento/core";

/**
 * Compute a layout, recomputing only when the (serialisable) options change.
 * Inline object literals are fine: options are compared by value.
 */
export function useTileLayout(options: LayoutOptions): Layout {
  const key = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createLayout(options), [key]);
}

/** Use `layout` if given, otherwise compute one from `options`. Hooks stay unconditional. */
export function useResolvedLayout(component: string, options?: LayoutOptions, layout?: Layout): Layout {
  if (!options && !layout) throw new Error(`<${component}> needs either \`options\` or \`layout\``);
  const computed = useTileLayout(options ?? PLACEHOLDER);
  return layout ?? computed;
}

const PLACEHOLDER: LayoutOptions = {
  region: { x: 0, y: 0, width: 1, height: 1 },
  tiling: { type: "grid", width: 1 },
};
