/**
 * Pure TypeScript, no DOM: tiling patterns, `createLayout`, content placement, fills, hit testing, keyboard navigation and CSS helpers.
 *
 * @module @andamento/core
 */
// Helpers the packages share but that aren't part of the public API are in "./internal"
// (`@andamento/core/internal`), which may change in any release.
export { area, bbox, centroid, rectPolygon, vec } from "./geometry";
export type { Polygon, Rect, Vec } from "./geometry";
export { insetPolygon } from "./offset";
export { overlay } from "./overlay";
export type { Shape } from "./overlay";
export { delaunayTriangles, voronoiCells } from "./procedural";
export { ashlar, basketweave, cairo, checkPeriodic, chevron, delaunay, fishScale, flemishBond, flow, grid, hat, herringbone, hexagonal, hopscotch, isohedral, jigsaw, mondrian, octagonSquare, penrose, periodic, periodicDefinition, pinwheel, rhombille, rhombitrihexagonal, runningBond, spectre, tiles, triangular, trihexagonal, voronoi } from "./tilings";
export type { AshlarSpec, BasketweaveSpec, CairoSpec, ChevronSpec, DelaunaySpec, FishScaleSpec, FlemishBondSpec, FlowSpec, GridSpec, HatSpec, HerringboneSpec, HexagonalSpec, HopscotchSpec, IsohedralSpec, JigsawSpec, MondrianSpec, OctagonSquareSpec, PenroseSpec, PeriodicCheck, PeriodicDefinition, PeriodicSpec, PinwheelSpec, ProceduralSpec, RhombilleSpec, RhombitrihexagonalSpec, RunningBondSpec, SpectreSpec, TilesSpec, TilingSpec, TilingType, TriangularSpec, TrihexagonalSpec, VoronoiSpec } from "./tilings";
export { generateSubstitution, penroseKitesAndDarts, penroseRhombs } from "./substitution";
export { isohedralInfo, isohedralTypes } from "./isohedral";
export type { EdgeKind, IsohedralInfo } from "./isohedral";
export type { Piece, SubstitutionRule } from "./substitution";
export { roundCorners, roundedPolygon } from "./rounding";
export type { RoundedCorner } from "./rounding";
export { createLayout, colorCells } from "./layout";
export type { Cell, EdgeMode, Feature, Layout, LayoutOptions } from "./layout";
export { backdropCss, boundsAspectRatio, cellCss, cssShapes, morphPolygon, regionCss, safeAreaCss, viewCss } from "./css";
export { cellShape, visibleShapes } from "./shape";
export type { CellShape } from "./shape";
export { safeArea } from "./safe";
export { bevelFacets, lightVector } from "./relief";
export { cellInDirection } from "./navigation";
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
