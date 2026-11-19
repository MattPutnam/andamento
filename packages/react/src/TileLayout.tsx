import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type CSSProperties,
  type HTMLAttributes,
  type Key,
  type ReactElement,
  type ReactNode,
} from "react";
import { cellsInRect, type Cell, type ContentCells, type ContentPlacement, type Focus, type Layout, type LayoutOptions, type Rect } from "@andamento/core";
import {
  backdropStyle,
  backgroundStyle,
  containerStyle,
  coverStyle as sharedCoverStyle,
  frameBuilder,
  keyAction,
  overlayStyle,
  resolvePerCell as resolve,
  ringStrokes,
  safeBoxStyle,
  sameRect,
  shadowShape,
  tileSheet,
  tileStyle,
  tileViewBox,
  viewRect,
  watchView,
  type CellState,
  type SafeAreaProp,
  type PerCell,
} from "@andamento/dom";
import type { FillSource, ReliefOptions } from "@andamento/svg";
import { useResolvedLayout, type FitProp } from "./useTileLayout";

export type { CellState };

const isEmpty = (n: ReactNode) => n == null || n === false || n === true || n === "";
const css = (s: object) => s as CSSProperties;

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
   * Width / height of each child, in order. When given, each child goes in a tile of
   * similar shape, so `object-fit: cover` crops as little as possible (landscape photos in
   * wide tiles, portraits in tall ones); see `matchSlots`. Featured tiles still take the
   * first children. Missing entries count as square. Ignored with `renderCell`.
   */
  aspects?: readonly number[];
  /**
   * Keep content out of the tiles' clipped corners: each tile's content goes in a box at
   * the tile's safe area (see `safeArea`), the largest rectangle that fits inside its shape,
   * instead of filling the tile's bounding box. Useful for text in triangles or hexagons.
   * With `aspects`, each child's box has the child's shape, so it shows whole and uncropped.
   * The box has `data-safe-area`; style its contents to fill it. Tiles show `fill` around
   * their content. For tiles an `edges: "window"` layout cuts, `true` or "tile" fits the
   * whole tile (content near the edge is partly hidden, like the tile) and "visible" the
   * part that shows.
   */
  safeArea?: SafeAreaProp;
  /** With `aspects`: "shape" also picks which tiles hold children by their shape, ignoring `placement`. */
  choose?: "placement" | "shape";
  /**
   * Focal point of each child (fractions of its width and height; see `estimateFocus`): what
   * a photo keeps in view as its tile crops it. Each tile sets `--andamento-object-position`,
   * which `coverStyle` uses as `object-position`; exact when the photo's shape is known (`aspects`, or the focus's `aspect`).
   */
  focalPoints?: readonly (Focus | undefined)[];
  /**
   * How many tiles each child spans (1 for an ordinary child; rounded): heavier childs get a
   * featured tile of that many merged tiles, where they fall in reading order (see
   * `weightedLayout`). With `fit`, the tiles are sized to fit everything. Needs `options`.
   */
  weights?: readonly number[];
  /**
   * Color of empty tiles: a color, a palette (neighboring tiles get different entries),
   * or a function per cell. Defaults to `neutralPalette`; use "transparent" for none.
   */
  fill?: FillSource;
  /**
   * Size the tiles to the children: scales the pattern so there are about as many tiles
   * (counted by `contentCells`) as children. `true`/"atLeast" makes sure every child gets
   * a tile; "nearest" gets as close as possible. Ignored with `layout` or `renderCell`.
   */
  fit?: FitProp;
  /**
   * One picture across all the tiles: rendered in every tile, sized and positioned to the
   * whole layout, so each tile shows its own piece. Use an element that fills its box,
   * e.g. `<img src=… style={coverStyle} />`. It sits behind the tile's content, and empty
   * tiles show it instead of `fill`. (Each tile gets its own copy, so a video would play
   * out of sync; images are loaded once.)
   */
  backdrop?: ReactNode;
  /**
   * Raised tiles: a bevel round each tile, lit from one side and drawn over its content,
   * and optionally a soft shadow each tile casts into the grout (set `shadow`). `true` for
   * the defaults. With `gap` as the grout width and `background` as its color or texture,
   * it looks like a tiled surface. See `ReliefOptions`.
   */
  relief?: boolean | ReliefOptions;
  /**
   * Keyboard navigation: tiles with content become focusable as one tab stop (roving
   * tabindex). Arrow keys move to the nearest tile in that direction, whatever the tiling;
   * Home and End go to the first and last. The focused tile shows `focusRing`.
   */
  navigable?: boolean;
  /**
   * Called when a tile with content is activated: clicked, or Enter or Space while it has
   * focus (with `navigable`).
   */
  onCellActivate?: (cell: Cell, state: CellState) => void;
  /** Accessible name for each tile (its `aria-label`), e.g. a photo's description. */
  cellLabel?: PerCell<string | undefined>;
  /**
   * Color of the focus outline drawn inside the focused tile's shape (a CSS outline would be
   * clipped away), with a white inner line so it shows on any content. `false` for none,
   * if you style `[data-cell-id]:focus-visible` yourself. Defaults to "#1a56db".
   */
  focusRing?: string | false;
  /**
   * Animate changes: when the layout changes (a resize, another tiling, a new gap) or the
   * children do, tiles glide and morph into their new places and shapes, a child keeping
   * its tile as it moves; new tiles fade in and removed ones fade out. Pure CSS
   * transitions, skipped when the user prefers reduced motion. `true` for 400 ms, or
   * `{ duration, easing }`.
   */
  animate?: boolean | { duration?: number; easing?: string };
  /**
   * Mount only the tiles in view (plus `overscan` pixels round it, default 300), for
   * layouts with thousands of tiles. Tiles mount and unmount as the page or any scrolling
   * container scrolls, or the layout resizes. Keyboard navigation still reaches every
   * tile (the focused one stays mounted and is scrolled to), and list items carry
   * `aria-setsize` and `aria-posinset`. With `renderCell`, every cell `contentCells`
   * allows counts as having content. On the server no tiles are rendered.
   */
  virtualize?: boolean | { overscan?: number };
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
    aspects,
    choose,
    focalPoints,
    weights,
    safeArea,
    fill,
    fit,
    backdrop,
    relief,
    navigable,
    onCellActivate,
    cellLabel,
    focusRing = "#1a56db",
    animate,
    virtualize,
    fallback,
    cellClassName,
    cellStyle,
    background,
    style,
    role,
    onKeyDown,
    ...rest
  } = props;
  const uid = "andamento" + useId().replace(/:/g, "");
  const items = renderCell ? [] : Children.toArray(children);
  const layout = useResolvedLayout("TileLayout", options, given, {
    fit: !renderCell && fit,
    count: items.length,
    cells: contentCells,
    weights: renderCell ? undefined : weights,
    placement,
  });
  const { bounds } = layout;
  // Slots, fills and bevels, reused from the last render where nothing they depend on changed.
  const buildFrame = useRef<ReturnType<typeof frameBuilder>>();
  buildFrame.current ??= frameBuilder();
  const frame = buildFrame.current(layout, {
    count: renderCell ? Infinity : items.length,
    aspects: renderCell ? undefined : aspects,
    contentCells,
    placement,
    choose,
    fill,
    relief,
    animate,
  });
  const { slots, anim } = frame;

  // Key by child where possible, so a child keeps its state (video position, inputs,
  // animations) when the layout changes underneath it.
  const keyOf = (i: number): Key => {
    const slot = slots[i]!;
    if (!renderCell && slot >= 0) {
      const child = items[slot];
      return isValidElement(child) && child.key != null ? `child:${child.key}` : `child:${slot}`;
    }
    return `cell:${layout.cells[i]!.id}`;
  };
  // What a tile holds.
  const makeEntry = (i: number) => {
    const cell = layout.cells[i]!;
    const slot = slots[i]!;
    let content: ReactNode = null;
    if (renderCell) content = renderCell(cell, { slot });
    else if (slot >= 0) content = items[slot];
    const empty = isEmpty(content);
    const state: CellState = { empty, slot: empty && !renderCell ? -1 : slot };
    if (empty) content = resolve(fallback, cell, state);
    return { i, cell, content, key: keyOf(i), empty, state };
  };

  // Virtualization: the part of the layout in view, in layout units (null until measured).
  const virtual = !!virtualize;
  const overscan = Math.max(0, (typeof virtualize === "object" ? virtualize.overscan : undefined) ?? 300);
  const container = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Rect | null>(null);
  // Without virtualization, every tile's entry is worked out before rendering, so navigation
  // knows which have content. With it, only the tiles in view are; whether others have
  // content is judged without rendering them.
  const allEntries = virtual ? undefined : layout.cells.map((_, i) => makeEntry(i));
  const hasContent = (i: number) =>
    allEntries ? !allEntries[i]!.empty : renderCell ? slots[i]! >= 0 : slots[i]! >= 0 && !isEmpty(items[slots[i]!]);

  // Animation: enter / exit animations for tiles that come and go (the tiles' own
  // transitions are in their style).
  const mounted = useRef(false);
  const lastKeys = useRef(new Set<Key>());
  const entering = useRef(new Set<Key>());
  const lastTiles = useRef(new Map<Key, ReactElement>());
  const [exiting, setExiting] = useState(() => new Map<Key, ReactElement>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // Roving tabindex: one tile is the tab stop; arrow keys move it.
  const focusable = new Set(navigable ? layout.cells.filter((c) => hasContent(c.index)).map((c) => c.id) : []);
  const [activeId, setActiveId] = useState<string>();
  const firstFocusable = layout.cells.find((c) => focusable.has(c.id))?.id;
  const active = activeId !== undefined && focusable.has(activeId) ? activeId : firstFocusable;
  const tiles = useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = useRef<string>();
  const list = (role ?? "list") === "list";

  // The tiles to render: all of them, or those in view plus the tab stop (so Tab finds it).
  let entries: ReturnType<typeof makeEntry>[];
  if (allEntries) entries = allEntries;
  else {
    const shown = new Set(view && view.width >= 0 ? cellsInRect(layout, view).map((c) => c.index) : []);
    const activeCell = active !== undefined ? layout.cells.find((c) => c.id === active) : undefined;
    if (activeCell) shown.add(activeCell.index);
    entries = [...shown].sort((a, b) => a - b).map(makeEntry);
  }
  // List positions, as screen readers can't count tiles that aren't there.
  let positions: Map<number, number> | undefined;
  if (virtual) {
    positions = new Map();
    for (const c of layout.cells) if (hasContent(c.index)) positions.set(c.index, positions.size + 1);
  }

  // Animation bookkeeping uses every tile's key, so tiles scrolling in and out of view
  // don't count as coming and going.
  const allKeys = anim ? new Set(layout.cells.map((_, i) => keyOf(i))) : undefined;
  for (const e of entries) if (anim && mounted.current && !lastKeys.current.has(e.key)) entering.current.add(e.key);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !navigable || e.altKey || e.ctrlKey || e.metaKey) return;
    // Only when a tile itself has focus, not an input or button inside it.
    const entry = entries.find((x) => tiles.current.get(x.cell.id) === e.target);
    if (!entry || !focusable.has(entry.cell.id)) return;
    const action = keyAction(layout, entry.cell, e.key, (c: Cell) => focusable.has(c.id), !!onCellActivate);
    if (!action) return;
    // Arrow keys at the edge are still ours: don't scroll the page.
    e.preventDefault();
    if ("activate" in action) onCellActivate!(entry.cell, entry.state);
    else if ("move" in action) {
      setActiveId(action.move.id);
      const el = tiles.current.get(action.move.id);
      // A tile out of view isn't mounted yet: focus it once it is.
      if (el) el.focus();
      else pendingFocus.current = action.move.id;
    }
  };

  const rendered = entries.map(({ i, cell, content, key, empty, state }) => {
    const slot = slots[i]!;
    const bevel = frame.bevel(i);
    const tile = tileStyle(frame, cell, {
      empty,
      safeArea,
      backdrop: backdrop != null,
      clickable: !!onCellActivate && !empty,
      focus: !renderCell && slot >= 0 ? focalPoints?.[slot] : undefined,
      aspect: !renderCell && slot >= 0 ? aspects?.[slot] : undefined,
    });
    // Tiles with nothing in them are decoration: hidden from assistive technology.
    const silent = empty && isEmpty(content);
    const canFocus = focusable.has(cell.id);
    const viewBox = tileViewBox(cell);
    return (
      <div
        key={key}
        ref={(el) => {
          if (el) tiles.current.set(cell.id, el);
          else tiles.current.delete(cell.id);
        }}
        role={silent ? undefined : list ? "listitem" : undefined}
        aria-hidden={silent ? true : undefined}
        aria-label={silent ? undefined : resolve(cellLabel, cell, state)}
        aria-setsize={positions && list && !silent ? positions.size : undefined}
        aria-posinset={positions && list && !silent ? positions.get(i) : undefined}
        tabIndex={canFocus ? (cell.id === active ? 0 : -1) : undefined}
        onFocus={canFocus ? (e) => e.target === e.currentTarget && setActiveId(cell.id) : undefined}
        onClick={onCellActivate && !empty ? () => onCellActivate(cell, state) : undefined}
        className={resolve(cellClassName, cell, state)}
        data-cell-id={cell.id}
        data-index={cell.index}
        data-empty={empty ? "" : undefined}
        data-boundary={cell.boundary ? "" : undefined}
        data-entering={entering.current.has(key) ? "" : undefined}
        style={{ ...css(tile), ...resolve(cellStyle, cell, state) }}
      >
        {backdrop != null && (
          // z-index -1 puts it behind the content but inside the tile: the tile's
          // clip-path makes it a stacking context.
          <div aria-hidden style={css(backdropStyle(frame, cell))}>
            {backdrop}
          </div>
        )}
        {safeArea && content != null && !isEmpty(content) ? (
          <div data-safe-area="" style={css(safeBoxStyle(frame, cell, !renderCell && !empty && aspects ? (aspects[slot] ?? 1) : undefined, safeArea))}>
            {content}
          </div>
        ) : (
          content
        )}
        {bevel && bevel.length > 0 && (
          // Over the content; the tile's box is its bounding box, so map that to the viewBox.
          // When animating, the bevel is for the new shape, so it fades in as the tile arrives.
          <svg
            key={anim ? String(tile.clipPath) : undefined}
            aria-hidden
            data-bevel=""
            data-late={anim ? "" : undefined}
            viewBox={viewBox}
            preserveAspectRatio="none"
            style={css(overlayStyle)}
          >
            {bevel.map((p, k) => (
              <path key={k} d={p.d} fill={p.fill} fillOpacity={p.opacity} />
            ))}
          </svg>
        )}
        {canFocus && focusRing !== false && (
          // The tile's outline, stroked across its edge; the clip keeps the inner half.
          <svg aria-hidden data-focus-ring="" viewBox={viewBox} preserveAspectRatio="none" style={css(overlayStyle)}>
            {ringStrokes(frame, cell, focusRing).map((p, k) => (
              <path key={k} d={p.d} fill="none" stroke={p.stroke} strokeWidth={p.width} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        )}
      </div>
    );
  });

  // After each commit: tiles that just went away stay a moment to fade out.
  useIsomorphicLayoutEffect(() => {
    const current = new Map<Key, ReactElement>(rendered.map((el) => [el.key!, el]));
    const present = allKeys ?? current;
    if (anim && mounted.current) {
      const gone = [...lastTiles.current].filter(([k]) => !present.has(k));
      if (gone.length) {
        setExiting((prev) => new Map([...prev, ...gone]));
        const timer = setTimeout(() => {
          timers.current.delete(timer);
          setExiting((prev) => {
            const next = new Map(prev);
            for (const [k, el] of gone) if (next.get(k) === el) next.delete(k);
            return next;
          });
        }, anim.duration);
        timers.current.add(timer);
      }
    }
    for (const k of entering.current) if (!present.has(k)) entering.current.delete(k);
    lastKeys.current = new Set(present.keys());
    lastTiles.current = current;
    mounted.current = true;
    if (pendingFocus.current) {
      const el = tiles.current.get(pendingFocus.current);
      if (el) {
        pendingFocus.current = undefined;
        el.focus();
      }
    }
  });

  // Virtualization: measure what's in view, again on scroll (of the page or any container)
  // and resize, at most once a frame.
  useIsomorphicLayoutEffect(() => {
    if (!virtual) return;
    const el = container.current;
    if (!el) return;
    return watchView(el, () => {
      const next = viewRect(el, layout, overscan);
      setView((v) => (sameRect(v ?? undefined, next) ? v : next));
    });
  }, [virtual, layout, overscan]);
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);
  const leaving = anim
    ? [...exiting].filter(([k]) => !lastKeys.current.has(k) && !rendered.some((el) => el.key === k))
    : [];

  const sheet = tileSheet({ focusRing: !!navigable && focusRing !== false, anim });
  const shadow = shadowShape(frame, entries.map((e) => e.cell));
  return (
    <div
      data-andamento=""
      ref={container}
      role={role ?? "list"}
      {...rest}
      onKeyDown={handleKeyDown}
      style={{ ...css(containerStyle(layout)), ...style }}
    >
      {sheet && <style>{sheet}</style>}
      {background && <div aria-hidden style={css(backgroundStyle(frame, background))} />}
      {shadow && (
        <svg aria-hidden data-andamento-shadow="" viewBox={shadow.viewBox} preserveAspectRatio="none" style={css(shadow.style)}>
          <filter id={`${uid}-shadow`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={shadow.blur} />
          </filter>
          <path d={shadow.d} fillRule="evenodd" transform={shadow.transform} fill="#000" fillOpacity={shadow.opacity} filter={`url(#${uid}-shadow)`} />
        </svg>
      )}
      {rendered}
      {leaving.map(([k, el]) =>
        // Fades out through the [data-exiting] rule in the style sheet.
        cloneElement(el as ReactElement<Record<string, unknown>>, {
          key: k,
          ref: null,
          role: undefined,
          tabIndex: undefined,
          onClick: undefined,
          onFocus: undefined,
          "aria-hidden": true,
          "data-entering": undefined,
          "data-exiting": "",
        }),
      )}
    </div>
  );
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Style that makes an <img> or <video> cover its tile, like `object-fit: cover`. */
export const coverStyle: CSSProperties = css(sharedCoverStyle);
