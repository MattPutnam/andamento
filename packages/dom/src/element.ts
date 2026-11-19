import type { Cell, ContentCells, ContentPlacement, Layout, LayoutOptions } from "@andamento/core";
import type { FillSource, ReliefOptions } from "@andamento/svg";
import { coverStyle, type CellState, type FitProp, type PerCell, type StyleMap } from "./model";
import { mountTileLayout, type TileContent, type TileLayoutConfig, type TileLayoutHandle } from "./mount";

/** Detail of the `cellactivate` event. */
export interface CellActivateDetail {
  cell: Cell;
  /** Item index, as in `CellState`. */
  slot: number;
  /** The child element in the tile. */
  item: Element | undefined;
}

// Lets the module load where there's no DOM (server rendering); the element can't be used there.
const Base = (typeof HTMLElement === "undefined" ? class {} : HTMLElement) as typeof HTMLElement;

const BOOLEAN = ["navigable", "animate", "relief", "safe-area", "virtualize"] as const;
const ATTRIBUTES = [...BOOLEAN, "options", "fit", "placement", "content-cells", "choose", "background", "fill", "focus-ring", "label"];

const json = (v: string) => {
  try {
    return JSON.parse(v);
  } catch {
    throw new SyntaxError(`<andamento-layout>: not valid JSON: ${v}`);
  }
};

let slotCount = 0;

/**
 * `<andamento-layout>`: a tiling as a web component, for any framework or none (Angular,
 * Svelte, Solid, Lit, plain HTML). Each child element fills one tile, in reading order,
 * clipped to the tile's shape; children stay where you put them (they're shown in the
 * tiles through slots), so frameworks keep managing them.
 *
 * Set `options` (a `LayoutOptions` object, or JSON in the attribute) or `layout`. Simple
 * settings are attributes too: `navigable`, `animate`, `relief`, `safe-area`, `virtualize`,
 * `fit`, `placement`, `content-cells`, `choose`, `background`, `fill`, `focus-ring`, `label`.
 * Give children `data-aspect` (width / height) to put them in tiles of their shape. A child
 * with `slot="backdrop"` is copied into every tile as one picture across them all.
 *
 * Tiles are in the element's shadow root: style them with `::part(tile)` (also `empty`
 * and `boundary`, e.g. `andamento-layout::part(empty)`). Activating a tile fires
 * `cellactivate`, with `CellActivateDetail`.
 */
export class AndamentoLayoutElement extends Base {
  static observedAttributes = ATTRIBUTES;

  #config: TileLayoutConfig & { options?: LayoutOptions } = {};
  #props: Partial<TileLayoutConfig> = {};
  #handle?: TileLayoutHandle;
  #observer?: MutationObserver;
  #queued = false;
  #slots = new WeakMap<Element, HTMLSlotElement>();
  #items: Element[] = [];
  #backdrop?: { el: Element; make: () => Node };

  /** The same function for the same backdrop child, so tiles keep their copies. */
  #backdropFor(el: Element) {
    if (this.#backdrop?.el !== el) this.#backdrop = { el, make: () => copyBackdrop(el) };
    return this.#backdrop.make;
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host{display:block}:host([hidden]){display:none}";
    root.appendChild(style);
  }

  /** Layout options (also the `options` attribute, as JSON). */
  get options(): LayoutOptions | undefined {
    return this.#props.options;
  }
  set options(v: LayoutOptions | undefined) {
    this.#set({ options: v });
  }
  /** A precomputed layout, instead of `options`. */
  get layout(): Layout | undefined {
    return this.#handle?.layout ?? this.#props.layout;
  }
  set layout(v: Layout | undefined) {
    this.#set({ layout: v });
  }
  /** Color of empty tiles: a color, a palette or a function per cell. */
  get fill() {
    return this.#props.fill;
  }
  set fill(v: FillSource | undefined) {
    this.#set({ fill: v });
  }
  get relief() {
    return this.#props.relief;
  }
  set relief(v: boolean | ReliefOptions | undefined) {
    this.#set({ relief: v });
  }
  /** Animate changes (the `animate` attribute; `animate` itself is the Web Animations method). */
  get animated() {
    return this.#props.animate;
  }
  set animated(v: TileLayoutConfig["animate"]) {
    this.#set({ animate: v });
  }
  get virtualize() {
    return this.#props.virtualize;
  }
  set virtualize(v: TileLayoutConfig["virtualize"]) {
    this.#set({ virtualize: v });
  }
  get navigable() {
    return this.#props.navigable;
  }
  set navigable(v: boolean | undefined) {
    this.#set({ navigable: v });
  }
  get safeArea() {
    return this.#props.safeArea;
  }
  set safeArea(v: boolean | undefined) {
    this.#set({ safeArea: v });
  }
  get fit() {
    return this.#props.fit;
  }
  set fit(v: FitProp | undefined) {
    this.#set({ fit: v });
  }
  get placement() {
    return this.#props.placement;
  }
  set placement(v: ContentPlacement | undefined) {
    this.#set({ placement: v });
  }
  get contentCells() {
    return this.#props.contentCells;
  }
  set contentCells(v: ContentCells | undefined) {
    this.#set({ contentCells: v });
  }
  get choose() {
    return this.#props.choose;
  }
  set choose(v: "placement" | "shape" | undefined) {
    this.#set({ choose: v });
  }
  /** Width / height of each child; otherwise read from children's `data-aspect`. */
  get aspects() {
    return this.#props.aspects;
  }
  set aspects(v: readonly number[] | undefined) {
    this.#set({ aspects: v });
  }
  get background() {
    return this.#props.background;
  }
  set background(v: string | undefined) {
    this.#set({ background: v });
  }
  get focusRing() {
    return this.#props.focusRing;
  }
  set focusRing(v: string | false | undefined) {
    this.#set({ focusRing: v });
  }
  /** Accessible name of each tile. */
  get cellLabel() {
    return this.#props.cellLabel;
  }
  set cellLabel(v: PerCell<string | undefined> | undefined) {
    this.#set({ cellLabel: v });
  }
  /** Extra style for each tile. */
  get cellStyle() {
    return this.#props.cellStyle;
  }
  set cellStyle(v: PerCell<StyleMap | undefined> | undefined) {
    this.#set({ cellStyle: v });
  }
  /** Content for empty tiles (rendered in the shadow root). */
  get fallback() {
    return this.#props.fallback;
  }
  set fallback(v: PerCell<TileContent> | undefined) {
    this.#set({ fallback: v });
  }

  /** The tile element (in the shadow root) showing a cell, if it's rendered. */
  tileElement(cellId: string): HTMLElement | undefined {
    return this.#handle?.tileElement(cellId);
  }

  connectedCallback() {
    // Children added, removed or moved, or a child's data-aspect changing; not changes
    // deeper inside children.
    this.#observer = new MutationObserver((records) => {
      if (records.some((r) => r.target === this || r.target.parentNode === this)) this.#schedule();
    });
    this.#observer.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-aspect", "slot"] });
    this.#schedule();
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#handle?.destroy();
    this.#handle = undefined;
  }

  attributeChangedCallback() {
    this.#schedule();
  }

  #set(changes: Partial<TileLayoutConfig>) {
    this.#props = { ...this.#props, ...changes };
    this.#schedule();
  }

  /** Several changes in one go render once. */
  #schedule() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      this.#render();
    });
  }

  /** Render now rather than at the end of the current task (e.g. before measuring). */
  render() {
    this.#render();
  }

  #render() {
    if (!this.isConnected) return;
    const config = this.#configure();
    if (!config.options && !config.layout) return;
    if (this.#handle) this.#handle.update(config);
    else {
      this.#handle = mountTileLayout(this.shadowRoot!, config);
      this.#handle.element.setAttribute("part", "layout");
    }
  }

  #configure(): TileLayoutConfig {
    const a = (n: string) => this.getAttribute(n);
    const flag = (n: string) => this.hasAttribute(n) && a(n) !== "false";
    // Every setting named, so one that's been removed is cleared (updates merge).
    const fromAttrs: Partial<TileLayoutConfig> = Object.fromEntries([...ATTRIBUTE_KEYS].map((k) => [k, undefined]));
    if (a("options")) fromAttrs.options = json(a("options")!);
    for (const n of BOOLEAN) if (flag(n)) (fromAttrs as Record<string, unknown>)[n === "safe-area" ? "safeArea" : n] = true;
    if (a("fit")) fromAttrs.fit = a("fit") === "nearest" ? "nearest" : a("fit") === "false" ? false : true;
    if (a("placement")) fromAttrs.placement = a("placement") as ContentPlacement;
    if (a("content-cells")) fromAttrs.contentCells = a("content-cells") as ContentCells;
    if (a("choose")) fromAttrs.choose = a("choose") as "placement" | "shape";
    if (a("background")) fromAttrs.background = a("background")!;
    if (a("fill")) fromAttrs.fill = a("fill")!.trim().startsWith("[") ? json(a("fill")!) : a("fill")!;
    if (a("focus-ring")) fromAttrs.focusRing = a("focus-ring") === "false" ? false : a("focus-ring")!;
    if (a("label")) fromAttrs.label = a("label")!;

    // Children: each element fills a tile, through a slot of its own.
    const children = [...this.children];
    const backdrop = children.find((c) => c.getAttribute("slot") === "backdrop");
    this.#items = children.filter((c) => c !== backdrop && c.localName !== "template");
    const items = this.#items.map((child) => {
      let slot = this.#slots.get(child);
      if (!slot) {
        slot = document.createElement("slot");
        slot.name = `andamento-${++slotCount}`;
        this.#slots.set(child, slot);
      }
      if (child.getAttribute("slot") !== slot.name) child.setAttribute("slot", slot.name);
      return slot;
    });
    const aspectAttrs = this.#items.map((c) => Number(c.getAttribute("data-aspect")));
    const aspects = aspectAttrs.some((v) => v > 0) ? aspectAttrs.map((v) => (v > 0 ? v : 1)) : undefined;

    this.#config = {
      ...fromAttrs,
      aspects,
      ...overrides(this.#props),
      items,
      backdrop: backdrop ? this.#backdropFor(backdrop) : undefined,
      cellAttributes: (cell: Cell, state: CellState) => ({
        part: ["tile", state.empty && "empty", cell.boundary && "boundary"].filter(Boolean).join(" "),
      }),
      onCellActivate: (cell: Cell, state: CellState) => {
        const detail: CellActivateDetail = { cell, slot: state.slot, item: this.#items[state.slot] };
        this.dispatchEvent(new CustomEvent("cellactivate", { detail, bubbles: true, composed: true }));
      },
    };
    // Children with no tile (more than there are tiles) are simply not shown.
    return this.#config;
  }
}

/**
 * Properties that override attributes. One set back to undefined stays in as undefined only
 * if no attribute gives it (so it's cleared, as updates merge).
 */
const overrides = (props: Partial<TileLayoutConfig>): Partial<TileLayoutConfig> =>
  Object.fromEntries(Object.entries(props).filter(([k, v]) => v !== undefined || !ATTRIBUTE_KEYS.has(k)));
const ATTRIBUTE_KEYS = new Set(["options", "navigable", "animate", "relief", "safeArea", "virtualize", "fit", "placement", "contentCells", "choose", "background", "fill", "focusRing", "label", "aspects"]);

/** A copy of the backdrop child for one tile; pictures are made to cover it. */
function copyBackdrop(el: Element): Node {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.removeAttribute("slot");
  if (/^(img|video|picture|canvas)$/.test(copy.localName)) {
    for (const [k, v] of Object.entries(coverStyle)) copy.style.setProperty(k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), String(v));
  }
  return copy;
}

/**
 * Register `<andamento-layout>` (or another tag name). Safe to call more than once.
 * Returns the element class.
 */
export function defineTileLayoutElement(tagName = "andamento-layout"): typeof AndamentoLayoutElement {
  if (typeof customElements === "undefined") return AndamentoLayoutElement;
  const existing = customElements.get(tagName);
  if (existing) return existing as unknown as typeof AndamentoLayoutElement;
  // A subclass per tag name: one class can't be registered twice.
  const cls = class extends AndamentoLayoutElement {};
  customElements.define(tagName, cls as unknown as CustomElementConstructor);
  return cls;
}

declare global {
  interface HTMLElementTagNameMap {
    "andamento-layout": AndamentoLayoutElement;
  }
  interface HTMLElementEventMap {
    cellactivate: CustomEvent<CellActivateDetail>;
  }
}
