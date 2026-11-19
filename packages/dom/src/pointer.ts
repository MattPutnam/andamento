import { cellAt, screenToLayout, type Cell, type HitOptions, type Layout } from "@andamento/core";

/** The parts of a pointer or mouse event `cellFromPointer` uses. */
export interface PointerLike {
  clientX: number;
  clientY: number;
  currentTarget: EventTarget | null;
}

/**
 * The cell under a pointer event, for handlers on the element showing the layout (a
 * `<TileLayout>`, an `<svg>` or a canvas). Unlike handlers on each tile, it can see the
 * gaps: with `tolerance`, a pointer in the grout picks the nearest tile. Pass `element`
 * when the handler is on some other element.
 */
export function cellFromPointer(layout: Layout, event: PointerLike, options: HitOptions & { element?: Element } = {}): Cell | undefined {
  const el = options.element ?? (event.currentTarget as Element | null);
  if (!el || typeof (el as Element).getBoundingClientRect !== "function") return undefined;
  const point = screenToLayout(layout, el.getBoundingClientRect(), event.clientX, event.clientY);
  return cellAt(layout, point, options);
}
