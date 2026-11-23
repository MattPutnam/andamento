/**
 * Pure TypeScript, no DOM: tiling patterns, `createLayout`, content placement, fills, hit testing, keyboard navigation and CSS helpers.
 *
 * @module @andamento/core
 */
export * from "./geometry";
export { clipPolygonToConvex, insetPolygon, insetPolygonPieces, outsetPolygon, pointInPolygon, splitSelfIntersections } from "./offset";
export { overlay, partition, shapeArea, shapeCentroid } from "./overlay";
export type { Shape } from "./overlay";
export * from "./tilings";
export { delaunayTriangles, voronoiCells } from "./procedural";
export { generateSubstitution, penroseKitesAndDarts, penroseRhombs } from "./substitution";
export { HAT, hatSupertile, placedBounds } from "./hat";
export type { HatLabel } from "./hat";
export { SPECTRE, spectreSupertile } from "./spectre";
export { isohedralInfo, isohedralPrototile, isohedralTypes } from "./isohedral";
export type { EdgeKind, IsohedralInfo } from "./isohedral";
export type { SpectreLabel } from "./spectre";
export type { Piece, SubstitutionRule } from "./substitution";
export { roundCorners, roundedPolygon } from "./rounding";
export type { RoundedCorner } from "./rounding";
export { createLayout, colorCells } from "./layout";
export type { Cell, EdgeMode, Feature, Layout, LayoutOptions } from "./layout";
export { mulberry32 } from "./random";
export { backdropCss, boundsAspectRatio, cellCss, cssPolygon, cssShapes, morphPolygon, regionCss, resamplePolygon, safeAreaCss, viewCss } from "./css";
export { cellShape, visibleShapes } from "./shape";
export type { CellShape } from "./shape";
export { safeArea } from "./safe";
export { bevelFacets, lightVector } from "./relief";
export { cellInDirection, navigationLane, noteMove } from "./navigation";
export { edgeSize, imageSize, radialSize } from "./density";
export type { SizeField } from "./density";
export { cellAt, cellsInRect, nearestCell, screenToLayout } from "./hit";
export type { HitOptions, ScreenBox } from "./hit";
export type { Direction, DirectionOptions } from "./navigation";
export type { BevelFacet, BevelOptions } from "./relief";
export type { SafeAreaOptions } from "./safe";
export type { CellCss, CellCssOptions } from "./css";
export { contentSlots, matchSlots } from "./content";
export type { ContentCells, ContentOptions, ContentPlacement, MatchOptions } from "./content";
export { gradientFill, imageFill, loadImagePixels, paletteFill, protoTileFill, randomFill } from "./fills";
export type { CellFill, GradientOptions, ImageFillOptions, Pixels } from "./fills";
export { fitCount } from "./fit";
export type { FitOptions, FitResult } from "./fit";
export { coverRect, estimateFocus, objectPosition } from "./focus";
export type { CoverOptions, Focus } from "./focus";
export { tileSpans, weightedFeatures, weightedLayout } from "./weights";
export type { WeightedLayoutOptions, WeightedLayoutResult, WeightOptions } from "./weights";
