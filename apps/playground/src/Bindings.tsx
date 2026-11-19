import { createElement, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { createApp, h, shallowRef, type App } from "vue";
import type { Cell, ContentCells, ContentPlacement, Layout } from "@andamento/core";
import { coverStyle, defineTileLayoutElement, type AndamentoLayoutElement, type CellState, type FillSource, type ReliefOptions } from "@andamento/dom";
import { TileLayout as VueTileLayout } from "@andamento/vue";

defineTileLayoutElement();

/** What the playground shows in the tiles, in a form any framework can render. */
export type PreviewItem = { kind: "photo"; src: string; aspect?: number } | { kind: "card"; n: number; word: string; color?: string };

/** The settings the playground passes to every binding. */
export interface PreviewProps {
  layout: Layout;
  items: PreviewItem[];
  background?: string;
  relief?: ReliefOptions;
  animate: boolean;
  virtualize: boolean;
  fill: FillSource;
  contentCells: ContentCells;
  placement: ContentPlacement;
  aspects?: number[];
  safeArea: boolean;
  choose: "placement" | "shape";
  backdrop?: string;
  cellLabel: (cell: Cell, state: CellState) => string | undefined;
  cellStyle?: (cell: Cell, state: CellState) => Record<string, string | undefined>;
  onActivate: (cell: Cell, state: CellState) => void;
  label: string;
  className: string;
  style: CSSProperties;
}

const cssText = (s: CSSProperties) =>
  Object.entries(s)
    .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
    .join(";");

/** The layout rendered by the Vue component, in a Vue app of its own. */
export function VuePreview(props: PreviewProps) {
  const el = useRef<HTMLDivElement>(null);
  const state = useRef(shallowRef(props));
  useLayoutEffect(() => {
    state.current.value = props;
  });
  useEffect(() => {
    const p = state.current;
    const app: App = createApp({
      render: () => {
        const s = p.value;
        return h(
          VueTileLayout,
          {
            layout: s.layout,
            background: s.background,
            relief: s.relief ?? false,
            navigable: true,
            animate: s.animate,
            virtualize: s.virtualize,
            fill: s.fill,
            contentCells: s.contentCells,
            placement: s.placement,
            aspects: s.aspects,
            safeArea: s.safeArea,
            choose: s.choose,
            cellLabel: s.cellLabel,
            cellStyle: s.cellStyle,
            cellClass: "tile",
            onCellActivate: s.onActivate,
            "aria-label": s.label,
            class: s.className,
            style: cssText(s.style),
          },
          {
            default: () =>
              s.items.map((it, i) =>
                it.kind === "photo"
                  ? h("img", { key: i, src: it.src, alt: "", class: "photo", style: coverStyle })
                  : h("div", { key: i, class: "card", style: { background: it.color } }, [h("strong", String(it.n)), h("span", it.word)]),
              ),
            ...(s.backdrop ? { backdrop: () => h("img", { src: s.backdrop, alt: "", style: coverStyle }) } : {}),
          },
        );
      },
    });
    app.mount(el.current!);
    return () => app.unmount();
  }, []);
  return <div ref={el} style={{ display: "contents" }} />;
}

/** The layout rendered by `<andamento-layout>`, with React managing its children. */
export function ElementPreview(props: PreviewProps) {
  const ref = useRef<AndamentoLayoutElement>(null);
  useLayoutEffect(() => {
    const e = ref.current!;
    e.layout = props.layout;
    e.background = props.background;
    e.relief = props.relief;
    e.animated = props.animate;
    e.virtualize = props.virtualize;
    e.fill = props.fill;
    e.contentCells = props.contentCells;
    e.placement = props.placement;
    e.aspects = props.aspects;
    e.safeArea = props.safeArea;
    e.choose = props.choose;
    e.cellLabel = props.cellLabel;
    e.cellStyle = props.cellStyle;
  });
  const onActivate = useRef(props.onActivate);
  onActivate.current = props.onActivate;
  useEffect(() => {
    const e = ref.current!;
    const on = (ev: CustomEvent) => onActivate.current(ev.detail.cell, { empty: false, slot: ev.detail.slot });
    e.addEventListener("cellactivate", on);
    return () => e.removeEventListener("cellactivate", on);
  }, []);
  return createElement(
    "andamento-layout",
    { ref, navigable: "", label: props.label, class: props.className, style: props.style },
    props.backdrop ? <img key="backdrop" slot="backdrop" src={props.backdrop} alt="" /> : null,
    props.items.map((it, i) =>
      it.kind === "photo" ? (
        <img key={i} src={it.src} alt="" className="photo" style={coverStyle as CSSProperties} />
      ) : (
        <div key={i} className="card" style={{ background: it.color }}>
          <strong>{it.n}</strong>
          <span>{it.word}</span>
        </div>
      ),
    ),
  );
}
