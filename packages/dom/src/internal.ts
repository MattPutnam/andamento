/**
 * The pieces the React, Vue and web component bindings share: tile styles, bevel and focus
 * ring paths, what a key does, what's in view. Not part of the public API: they may change
 * or go in any release, without notice. Read `packages/vue/src/TileLayout.ts` for a whole
 * binding built from them.
 *
 * @module @andamento/dom/internal
 */
export {
  backdropStyle,
  backgroundStyle,
  containerStyle,
  focusStyle,
  frameBuilder,
  keyAction,
  layoutResolver,
  MORPH_POINTS,
  NOTHING_IN_VIEW,
  optionsKey,
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
} from "./model";
export type { Frame, FrameOptions, LayoutNeeds } from "./model";
