# Keyboard and accessibility

## Structure

The HTML layout is a list (`role="list"`, unless you pass another `role`), and each tile with
content is a list item, in reading order. Tiles with nothing in them are hidden from assistive
technology as decoration. `cellLabel(cell, { slot })` gives tiles an accessible name.

```tsx
<TileLayout options={options} navigable aria-label="Holiday photos"
  cellLabel={(cell, { slot }) => photos[slot]?.alt}
  onCellActivate={(cell, { slot }) => openPhoto(slot)}>
  {photos.map((p) => <img key={p.src} src={p.src} alt="" style={coverStyle} />)}
</TileLayout>
```

## Keyboard navigation

With `navigable`, the tiles with content form one tab stop (a roving tabindex).

| Key | |
|---|---|
| Arrow keys | Move to the nearest tile in that direction, in any tiling: hexagons, herringbone or aperiodic hats. |
| Home, End | The first and last tile. |
| Enter, Space | Activate the tile (`onCellActivate`; a click does too). |

Keys pressed in a tile's own inputs or buttons are left alone.

The focused tile gets a ring drawn inside its shape, because a CSS outline would be clipped
away with the tile. Set the ring's color with `focusRing`, or pass `false` and style
`[data-cell-id]:focus-visible` yourself.

In core, `cellInDirection(layout, cell, "left", accept?)` is the same navigation, for your own
renderer.

Try it in the demo: click a tile, then use the arrow keys.

<ClientOnly>
  <LiveDemo />
</ClientOnly>

## SVG

`imageAlts` (on `<SvgTileLayout>` or `renderToString`) gives each image a text alternative.
Those cells become labeled images, the SVG a group of them, and the rest is hidden as
decoration. `title` gives the whole SVG an accessible name.

## Motion

[Animated transitions](/guide/animation) are switched off for users who prefer reduced motion.
