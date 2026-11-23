import {
  Comment,
  Fragment,
  Text,
  TransitionGroup,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  shallowRef,
  watch,
  type PropType,
  type VNode,
  type VNodeChild,
} from "vue";
import { cellsInRect, type Cell, type ContentCells, type ContentPlacement, type Focus, type Layout, type LayoutOptions, type Rect } from "@andamento/core";
import {
  type CellState,
  type SafeAreaProp,
  type FitProp,
  type PerCell,
  type StyleMap,
} from "@andamento/dom";
import {
  backdropStyle,
  backgroundStyle,
  containerStyle,
  frameBuilder,
  keyAction,
  layoutResolver,
  overlayStyle,
  resolvePerCell,
  ringStrokes,
  safeBoxStyle,
  sameRect,
  shadowShape,
  tileSheet,
  tileStyle,
  tileViewBox,
  viewRect,
  watchView,
} from "@andamento/dom/internal";
import type { FillSource, ReliefOptions } from "@andamento/svg";

/** Top-level children of a slot, with fragments (`v-for`) opened and comments (`v-if`) dropped. */
function flatten(nodes: VNodeChild[] | undefined, out: VNode[] = []): VNode[] {
  for (const n of nodes ?? []) {
    if (n == null || typeof n === "boolean") continue;
    if (Array.isArray(n)) flatten(n, out);
    else if (typeof n === "object") {
      if (n.type === Comment) continue;
      if (n.type === Fragment) flatten(n.children as VNodeChild[], out);
      else if (n.type === Text && !String(n.children).trim()) continue;
      else out.push(n);
    } else if (String(n).trim()) out.push(h(Text, String(n)));
  }
  return out;
}

const isEmpty = (nodes: VNode[] | undefined) => !nodes || nodes.length === 0;

let uid = 0;

/**
 * A tiling as HTML: one absolutely positioned, `clip-path`-ed element per tile, holding
 * whatever you put in it. Each top-level child of the default slot fills one tile, in
 * reading order (`v-for` children count one each). Or use the `cell` slot, given
 * `{ cell, slot }`, to fill every tile. Sized in percentages, so it scales with its width.
 *
 * Slots: default (the items), `cell` (instead of items), `fallback` (empty tiles, given
 * `{ cell, state }`) and `backdrop` (one picture across all the tiles). Emits
 * `cell-activate` with `(cell, state)`. Props match the React `<TileLayout>`.
 */
export const TileLayout = defineComponent({
  name: "TileLayout",
  props: {
    /** Layout options; or pass a precomputed `layout` instead. */
    options: Object as PropType<LayoutOptions>,
    layout: Object as PropType<Layout>,
    /** Which tiles may hold items: "all" (default), "whole" or a test per cell. */
    contentCells: [String, Function] as PropType<ContentCells>,
    /** Where items go when there are fewer than tiles: "reading" (default), "center" or "spread". */
    placement: String as PropType<ContentPlacement>,
    /** Width / height of each item, to put items in tiles of similar shape. */
    aspects: Array as PropType<readonly number[]>,
    /**
     * Focal point of each child (fractions of its width and height; see `estimateFocus`): what
     * a photo keeps in view as its tile crops it. Each tile sets `--andamento-object-position`,
     * which `coverStyle` uses as `object-position`; exact when the photo's shape is known (`aspects`, or the focus's `aspect`).
     */
    /**
     * How many tiles each item spans (1 for an ordinary item): heavier items get featured
     * tiles where they fall in reading order (see `weightedLayout`). Needs `options`.
     */
    weights: Array as PropType<readonly number[]>,
    focalPoints: Array as PropType<readonly (Focus | undefined)[]>,
    /** With `aspects`: "shape" also picks which tiles hold items by their shape. */
    choose: String as PropType<"placement" | "shape">,
    /**
     * Put each tile's content in the tile's safe area (see `safeArea`). For tiles an
     * `edges: "window"` layout cuts, `true` or "tile" fits the whole tile, "visible" the part that shows.
     */
    safeArea: { type: [Boolean, String] as PropType<SafeAreaProp>, default: false },
    /** Color of empty tiles: a color, a palette or a function per cell. Defaults to `neutralPalette`. */
    fill: [String, Array, Function] as PropType<FillSource>,
    /** Size the tiles to the items: `true`/"atLeast" or "nearest". */
    fit: { type: [Boolean, String] as PropType<FitProp>, default: false },
    /** Raised tiles: a lit bevel and optional shadow. `true` for the defaults. */
    relief: { type: [Boolean, Object] as PropType<boolean | ReliefOptions>, default: false },
    /** Arrow-key navigation over the tiles with content, as one tab stop. */
    navigable: Boolean,
    /** Accessible name for each tile. */
    cellLabel: [String, Function] as PropType<PerCell<string | undefined>>,
    /** Focus ring color, or `false` for none. */
    focusRing: { type: [String, Boolean] as PropType<string | false>, default: "#1a56db" },
    /** Animate layout and content changes. `true` for 400 ms, or `{ duration, easing }`. */
    animate: { type: [Boolean, Object] as PropType<boolean | { duration?: number; easing?: string }>, default: false },
    /** Only mount the tiles in view (plus `overscan` pixels, default 300). */
    virtualize: { type: [Boolean, Object] as PropType<boolean | { overscan?: number }>, default: false },
    /** Class for each tile element. */
    cellClass: [String, Array, Object, Function] as PropType<PerCell<unknown>>,
    /** Extra style for each tile element. */
    cellStyle: [Object, Function] as PropType<PerCell<StyleMap | undefined>>,
    /** Color painted across the whole region, visible through the gaps. */
    background: String,
    role: { type: String, default: "list" },
    /** Called when a tile with content is clicked, or Enter / Space pressed on it. Bind with `@cell-activate`. */
    onCellActivate: Function as PropType<(cell: Cell, state: CellState) => void>,
  },
  setup(props, { slots, expose }) {
    const id = `andamento-vue${++uid}`;
    const resolveLayout = layoutResolver("<TileLayout>");
    const buildFrame = frameBuilder();
    const container = ref<HTMLDivElement>();
    const view = shallowRef<Rect>();
    const activeId = ref<string>();
    const tiles = new Map<string, HTMLElement>();
    let pendingFocus: string | undefined;
    let layout: Layout | undefined;
    let lastKeys = new Set<string>();
    let presentKeys = new Set<string>();
    let mounted = false;
    let duration = 0;
    let stop: (() => void) | undefined;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    // What the keyboard handler needs from the last render.
    let current: { focusable: Set<string>; state: Map<string, CellState> } = { focusable: new Set(), state: new Map() };

    const overscan = () => Math.max(0, (typeof props.virtualize === "object" ? props.virtualize.overscan : undefined) ?? 300);
    const measure = () => {
      if (!container.value || !layout) return;
      const next = viewRect(container.value, layout, overscan());
      if (!sameRect(next, view.value)) view.value = next;
    };
    const syncWatch = () => {
      if (props.virtualize && container.value && !stop) stop = watchView(container.value, measure);
      else if (!props.virtualize && stop) {
        stop();
        stop = undefined;
        view.value = undefined;
      }
    };
    let measuredLayout: Layout | undefined;
    const afterRender = () => {
      lastKeys = presentKeys;
      mounted = true;
      syncWatch();
      if (stop && measuredLayout !== layout) measure();
      measuredLayout = layout;
      if (pendingFocus) {
        const el = tiles.get(pendingFocus);
        if (el?.isConnected) {
          pendingFocus = undefined;
          el.focus();
        }
      }
    };
    onMounted(afterRender);
    onUpdated(afterRender);
    watch(() => props.virtualize, syncWatch);
    onBeforeUnmount(() => {
      stop?.();
      timers.forEach(clearTimeout);
    });

    const moveTo = (cell: Cell) => {
      activeId.value = cell.id;
      const el = tiles.get(cell.id);
      if (el?.isConnected && !el.hasAttribute("data-exiting")) el.focus();
      else pendingFocus = cell.id;
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !props.navigable || e.altKey || e.ctrlKey || e.metaKey || !layout) return;
      const el = e.target as HTMLElement;
      const cellId = el.getAttribute?.("data-cell-id");
      // Only when a tile itself has focus, not an input or button inside it.
      if (!cellId || tiles.get(cellId) !== el || !current.focusable.has(cellId)) return;
      const cell = layout.cells.find((c) => c.id === cellId)!;
      const action = keyAction(layout, cell, e.key, (c) => current.focusable.has(c.id), !!props.onCellActivate);
      if (!action) return;
      e.preventDefault();
      if ("activate" in action) props.onCellActivate!(cell, current.state.get(cellId)!);
      else if ("move" in action) moveTo(action.move);
    };

    expose({
      /** The layout being shown. */
      get layout() {
        return layout;
      },
    });

    return () => {
      const items = slots.cell ? [] : flatten(slots.default?.());
      const L = resolveLayout(props.options, props.layout, {
        fit: !slots.cell && props.fit,
        count: items.length,
        cells: props.contentCells,
        weights: slots.cell ? undefined : props.weights,
        placement: props.placement,
      });
      layout = L;
      const frame = buildFrame(L, {
        count: slots.cell ? Infinity : items.length,
        aspects: slots.cell ? undefined : props.aspects,
        contentCells: props.contentCells,
        placement: props.placement,
        choose: props.choose,
        fill: props.fill,
        relief: props.relief,
        animate: props.animate,
      });
      const { slots: slotOf } = frame;
      const virtual = !!props.virtualize;
      const list = props.role === "list";
      const hasBackdrop = !!slots.backdrop;

      const keyOf = (i: number) => {
        const slot = slotOf[i]!;
        if (!slots.cell && slot >= 0) {
          const k = items[slot]?.key;
          return k != null ? `child:${String(k)}` : `child:${slot}`;
        }
        return `cell:${L.cells[i]!.id}`;
      };
      // What each tile holds, worked out once per render. Without virtualization every tile's
      // is worked out first, so only tiles with content take focus; with it, only those in
      // view are, and a tile counts as having content when it has a slot.
      const contents = new Map<number, VNode[] | undefined>();
      const contentOf = (i: number) => {
        if (!contents.has(i)) {
          const slot = slotOf[i]!;
          contents.set(i, slots.cell ? flatten(slots.cell({ cell: L.cells[i]!, slot })) : slot >= 0 ? [items[slot]!] : undefined);
        }
        return contents.get(i);
      };
      const hasContent = (i: number) => slotOf[i]! >= 0 && (virtual || !isEmpty(contentOf(i)));
      const focusable = new Set(props.navigable ? L.cells.filter((c) => hasContent(c.index)).map((c) => c.id) : []);
      const first = L.cells.find((c) => focusable.has(c.id))?.id;
      const active = activeId.value !== undefined && focusable.has(activeId.value) ? activeId.value : first;

      let shown: number[];
      if (!virtual) shown = L.cells.map((_, i) => i);
      else {
        const s = new Set(view.value && view.value.width >= 0 ? cellsInRect(L, view.value).map((c) => c.index) : []);
        const a = active !== undefined ? L.cells.find((c) => c.id === active) : undefined;
        if (a) s.add(a.index);
        shown = [...s].sort((a, b) => a - b);
      }
      let positions: Map<number, number> | undefined;
      if (virtual) {
        positions = new Map();
        for (const c of L.cells) if (hasContent(c.index)) positions.set(c.index, positions.size + 1);
      }
      presentKeys = new Set(L.cells.map((_, i) => keyOf(i)));
      duration = frame.anim?.duration ?? 0;
      const state = new Map<string, CellState>();
      const focusRing = props.focusRing;

      const rendered = shown.map((i) => {
        const cell = L.cells[i]!;
        const slot = slotOf[i]!;
        let content = contentOf(i);
        const empty = isEmpty(content);
        const st: CellState = { empty, slot: empty && !slots.cell ? -1 : slot };
        state.set(cell.id, st);
        if (empty && slots.fallback) content = flatten(slots.fallback({ cell, state: st }));
        const silent = empty && isEmpty(content);
        const canFocus = focusable.has(cell.id);
        const key = keyOf(i);
        const style = tileStyle(frame, cell, {
          empty,
          safeArea: props.safeArea,
          backdrop: hasBackdrop,
          clickable: !!props.onCellActivate && !empty,
          focus: !slots.cell && slot >= 0 ? props.focalPoints?.[slot] : undefined,
          aspect: !slots.cell && slot >= 0 ? props.aspects?.[slot] : undefined,
        });
        const bevel = frame.bevel(i);
        const viewBox = tileViewBox(cell);
        const children: VNodeChild[] = [];
        if (hasBackdrop) children.push(h("div", { "aria-hidden": "true", style: backdropStyle(frame, cell) }, slots.backdrop!()));
        if (props.safeArea && !isEmpty(content)) {
          const aspect = !slots.cell && !empty && props.aspects ? (props.aspects[slot] ?? 1) : undefined;
          children.push(h("div", { "data-safe-area": "", style: safeBoxStyle(frame, cell, aspect, props.safeArea) }, content));
        } else if (content) children.push(...content);
        if (bevel?.length)
          children.push(
            h(
              "svg",
              {
                // Re-made for a new shape when animating, so it fades in as the tile arrives.
                key: frame.anim ? String(style.clipPath) : "bevel",
                "aria-hidden": "true",
                "data-bevel": "",
                "data-late": frame.anim ? "" : undefined,
                viewBox,
                preserveAspectRatio: "none",
                style: overlayStyle,
              },
              bevel.map((p, k) => h("path", { key: k, d: p.d, fill: p.fill, "fill-opacity": p.opacity })),
            ),
          );
        if (canFocus && focusRing !== false)
          children.push(
            h(
              "svg",
              { key: "ring", "aria-hidden": "true", "data-focus-ring": "", viewBox, preserveAspectRatio: "none", style: overlayStyle },
              ringStrokes(frame, cell, focusRing).map((p, k) =>
                h("path", { key: k, d: p.d, fill: "none", stroke: p.stroke, "stroke-width": p.width, "vector-effect": "non-scaling-stroke" }),
              ),
            ),
          );
        return h(
          "div",
          {
            key,
            ref: (el: unknown) => {
              if (el) tiles.set(cell.id, el as HTMLElement);
              else if (!tiles.get(cell.id)?.isConnected) tiles.delete(cell.id);
            },
            role: silent ? undefined : list ? "listitem" : undefined,
            "aria-hidden": silent ? "true" : undefined,
            "aria-label": silent ? undefined : resolvePerCell(props.cellLabel, cell, st),
            "aria-setsize": positions && list && !silent ? positions.size : undefined,
            "aria-posinset": positions && list && !silent ? positions.get(i) : undefined,
            tabindex: canFocus ? (cell.id === active ? 0 : -1) : undefined,
            onFocus: canFocus ? (e: FocusEvent) => e.target === e.currentTarget && (activeId.value = cell.id) : undefined,
            onClick: props.onCellActivate && !empty ? () => props.onCellActivate!(cell, st) : undefined,
            class: resolvePerCell(props.cellClass, cell, st),
            "data-cell-id": cell.id,
            "data-index": cell.index,
            "data-key": key,
            "data-empty": empty ? "" : undefined,
            "data-boundary": cell.boundary ? "" : undefined,
            style: { ...style, ...resolvePerCell(props.cellStyle, cell, st) },
          },
          children,
        );
      });
      current = { focusable, state };

      const shadow = shadowShape(frame, shown.map((i) => L.cells[i]!));
      const css = tileSheet({ focusRing: props.navigable && focusRing !== false, anim: frame.anim });
      // Animated: tiles that go fade out, and new ones fade in (not those just scrolling
      // into or out of view, nor on first render).
      const tileNodes = frame.anim
        ? h(
            TransitionGroup,
            {
              css: false,
              onEnter: (el: Element, done: () => void) => {
                const k = el.getAttribute("data-key");
                if (mounted && k && !lastKeys.has(k)) el.setAttribute("data-entering", "");
                done();
              },
              onLeave: (el: Element, done: () => void) => {
                const k = el.getAttribute("data-key");
                if (k && presentKeys.has(k)) return done();
                for (const a of ["role", "tabindex", "aria-label", "data-entering"]) el.removeAttribute(a);
                el.setAttribute("aria-hidden", "true");
                el.setAttribute("data-exiting", "");
                const timer = setTimeout(() => {
                  timers.delete(timer);
                  done();
                }, duration);
                timers.add(timer);
              },
            },
            () => rendered,
          )
        : rendered;

      return h(
        "div",
        {
          ref: container,
          "data-andamento": "",
          role: props.role,
          onKeydown,
          style: containerStyle(L),
        },
        [
          css ? h("style", { key: "css" }, css) : null,
          props.background ? h("div", { key: "bg", "aria-hidden": "true", style: backgroundStyle(frame, props.background) }) : null,
          shadow
            ? h("svg", { key: "shadow", "aria-hidden": "true", "data-andamento-shadow": "", viewBox: shadow.viewBox, preserveAspectRatio: "none", style: shadow.style }, [
                h("filter", { id: `${id}-shadow`, x: "-10%", y: "-10%", width: "120%", height: "120%" }, [h("feGaussianBlur", { stdDeviation: shadow.blur })]),
                h("path", { d: shadow.d, "fill-rule": "evenodd", transform: shadow.transform, fill: "#000", "fill-opacity": shadow.opacity, filter: `url(#${id}-shadow)` }),
              ])
            : null,
          tileNodes,
        ],
      );
    };
  },
});
