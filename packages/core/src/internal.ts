/**
 * Helpers shared between the @andamento packages that aren't part of the public API: they
 * may change or go in any release, without notice. For writing your own renderer or
 * framework binding, use them at your own risk.
 *
 * @module @andamento/core/internal
 */
export { add, sub, scale, dot, cross, length, signedArea, ensurePositive, rectsOverlap, transform, isConvex, clipHalfPlane, cleanPolygon, clipConvex, insetConvex, containsPolygon, sharesEdge, convexHull } from "./geometry";
export { clipPolygonToConvex, insetPolygonPieces, outsetPolygon, pointInPolygon, splitSelfIntersections } from "./offset";
export { partition, shapeArea, shapeCentroid } from "./overlay";
export { generateMondrian, generatePeriodic, generateTiles } from "./tilings";
export type { GenerateContext, RawTile } from "./tilings";
export { HAT, hatSupertile, placedBounds } from "./hat";
export type { HatLabel } from "./hat";
export { SPECTRE, spectreSupertile } from "./spectre";
export type { SpectreLabel } from "./spectre";
export { isohedralPrototile } from "./isohedral";
export { mulberry32 } from "./random";
export { cssPolygon, resamplePolygon } from "./css";
