/**
 * No framework: `mountTileLayout()` and the `<andamento-layout>` web component.
 *
 * @module @andamento/dom
 */
export { mountTileLayout } from "./mount";
export type { TileContent, TileLayoutConfig, TileLayoutHandle } from "./mount";
export { AndamentoLayoutElement, defineTileLayoutElement } from "./element";
export type { CellActivateDetail } from "./element";
export { coverStyle } from "./model";
export type { CellState, FitProp, PerCell, SafeAreaProp, StyleMap } from "./model";
export { cellFromPointer } from "./pointer";
export type { PointerLike } from "./pointer";
export { defaultPalette, neutralPalette } from "@andamento/svg";
export type { FillSource, ReliefOptions } from "@andamento/svg";
