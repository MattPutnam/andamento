import { defineComponent, h, type PropType, type VNode } from "vue";
import type { ContentCells, ContentPlacement, Layout, LayoutOptions } from "@andamento/core";
import { type FitProp } from "@andamento/dom";
import { layoutResolver } from "@andamento/dom/internal";
import { toSvgTree, type FillSource, type ImageSource, type ReliefOptions, type SvgNode } from "@andamento/svg";

const toVNode = (n: SvgNode | string, key?: number): VNode | string =>
  typeof n === "string" ? n : h(n.tag, key === undefined ? n.attrs : { key, ...n.attrs }, n.children.map((c, i) => toVNode(c, i)));

let uid = 0;

/**
 * A tiling as a single <svg>: colored cells, optionally with images clipped to each cell.
 * Use it for pure SVG (export, print, embedding in other SVG); use `<TileLayout>` for
 * arbitrary content. Takes the options of `renderToString` from @andamento/svg as props.
 */
export const SvgTileLayout = defineComponent({
  name: "SvgTileLayout",
  props: {
    options: Object as PropType<LayoutOptions>,
    layout: Object as PropType<Layout>,
    images: [Array, Function] as PropType<ImageSource>,
    repeatImages: Boolean,
    contentCells: [String, Function] as PropType<ContentCells>,
    placement: String as PropType<ContentPlacement>,
    imageAspects: Array as PropType<readonly number[]>,
    choose: String as PropType<"placement" | "shape">,
    imageFit: String as PropType<"cover" | "contain">,
    containWithin: String as PropType<"tile" | "visible">,
    imageWeights: Array as PropType<readonly number[]>,
    imageFocus: Array as PropType<readonly ({ x: number; y: number } | undefined)[]>,
    /** Size the tiles to the `images` array: `true`/"atLeast" or "nearest". */
    fit: { type: [Boolean, String] as PropType<FitProp>, default: false },
    fill: [String, Array, Function] as PropType<FillSource>,
    stroke: String,
    strokeWidth: Number,
    background: String,
    backdrop: String,
    relief: { type: [Boolean, Object] as PropType<boolean | ReliefOptions>, default: false },
    title: String,
    imageAlts: Array as PropType<readonly string[]>,
    precision: Number,
  },
  setup(props) {
    const idPrefix = `andamento-vue-svg${++uid}`;
    const resolveLayout = layoutResolver("<SvgTileLayout>");
    return () => {
      const fitTo = Array.isArray(props.images) && !props.repeatImages ? props.images.length : 0;
      const layout = resolveLayout(props.options, props.layout, {
        fit: props.fit,
        count: fitTo,
        cells: props.contentCells,
        weights: Array.isArray(props.images) ? props.imageWeights : undefined,
        placement: props.placement,
      });
      const { options: _o, layout: _l, fit: _f, ...render } = props;
      const tree = toSvgTree(layout, { ...render, relief: props.relief || undefined, idPrefix });
      return toVNode(tree);
    };
  },
});
