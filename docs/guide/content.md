# Placing content

The HTML components put each top-level child in a tile, in reading order: top to bottom, then
left to right. `null` and `false` children are skipped, and children beyond the number of tiles
aren't rendered. The SVG renderers do the same with their `images` array.

## Fewer items than tiles

`placement` decides where the items go when there are fewer of them than tiles. They always run
in reading order across the tiles chosen.

<Figures :items="[
  { name: 'content-reading', caption: '&quot;reading&quot; (default): packed from the top left' },
  { name: 'content-center', caption: '&quot;center&quot;: clustered in the middle' },
  { name: 'content-spread', caption: '&quot;spread&quot;: spaced out evenly' },
]" />

```tsx
<TileLayout options={options} placement="center" fill={["#eee", "#ddd", "#e6e2dc"]}>
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

Empty tiles are drawn in `fill`: a color, a palette (neighboring tiles get different
entries), or a function of the cell. The default for the HTML components is `neutralPalette`,
soft grays that keep the pattern visible. Use `fill="transparent"` to hide empty tiles, or
`fallback` to render something in them.

## Keeping content out of cut tiles

`contentCells` decides which tiles may hold content:

- `"all"` (default): every tile.
- `"whole"`: only tiles the region's edge doesn't cut, so content is never cropped by the edge.
- `(cell) => boolean`: your own test.

<Figures :items="[
  { name: 'content-all', caption: 'contentCells: &quot;all&quot;' },
  { name: 'content-whole', caption: 'contentCells: &quot;whole&quot;' },
]" />

<<< @/examples/content.ts

## Sizing tiles to the content

`fit` scales the pattern so there are about as many tiles as children (counted by
`contentCells`):

- **`true` or `"atLeast"`:** the largest tiles that still give every child a tile.
- **`"nearest"`:** as close as possible to the number of children.

```tsx
<TileLayout options={options} fit contentCells="whole">
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

`fit` is ignored with `layout` or `renderCell`. `<SvgTileLayout fit>` fits to the `images`
array.

Under the hood this is `fitCount(options, count, { cells, mode })` in core, which returns
`{ options, layout, tileScale, count }`.

- **Every pattern:** it works for all of them because it sets `tileScale`, which scales the
  whole pattern, rather than a pattern-specific size setting.
- **Steps:** the tile count changes in steps, so the result can land slightly above `count`,
  typically by a few percent, more for herringbone-like patterns and with whole tiles only.
- **Hook:** React and Vue also have `useFitCount(options, count, fit)`.

## Per-tile rendering

Instead of children, `renderCell(cell, { slot })` renders each tile from its cell. `slot` is
the index of the item the tile would hold, or -1. Vue uses a `#cell="{ cell, slot }"` slot,
and `mountTileLayout` takes a `renderCell` that returns a node.

Per-tile styling props get the same context as a second argument, `{ empty, slot }`:
`fallback`, `cellClassName` and `cellStyle`. Tile elements also carry `data-empty` and
`data-boundary` attributes, for plain CSS:

```css
[data-andamento] [data-empty] { opacity: 0.5 }
```

## In core

`contentSlots(layout, count, { cells, placement })` returns the item index for each cell, or
-1, taking featured cells and weights into account. `matchSlots(layout, aspects, options)` does
the same while matching shapes (see [Fitting photos](/guide/photos)).
