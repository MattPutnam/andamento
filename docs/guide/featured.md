# Featured tiles and weights

## Featured tiles

A feature merges several neighboring tiles into one bigger cell, for a hero image or a
highlighted item.

<Figure name="featured-features" caption="features: [{ tiles: 7 }, { tiles: 3, at: { x: 50, y: 40 } }]" />

<<< @/examples/featured.ts#features

How the tiles are chosen:

- **Starting point:** the group grows from a tile near `at`, which defaults to the middle of
  the region.
- **Growth:** it adds whichever neighbor keeps it most compact, so 4 grid tiles make a 2 × 2
  square and 7 hexagons a flower.
- **Trying several starts:** it tries growing from several of the free tiles nearest `at` and
  keeps the most compact group, close to `at`, avoiding tiles the region's edge cuts. A tile the
  margin only trims counts as whole.
- **No sharing:** features never share tiles. A later feature grows among the tiles still
  free, and gets fewer tiles if it runs out of room.
- **Choosing the tiles yourself:** pass `ids` instead. Tile ids are stable, so read them from
  a layout without features.

Merging happens before the gap and edge handling, so a featured cell has the same gap all
round and is cut, rounded and given neighbors like any other. Featured cells have `featured`
(their position in `features`) and `merged` (the ids of the tiles inside them).

**Content:** featured cells take content first, so the first child goes in the first feature,
and so on; the rest follow `placement` as usual. A feature can name its item instead:
`{ tiles: 4, item: 6 }` holds the seventh item.

| `Feature` field | |
|---|---|
| `tiles` | How many tiles to merge. Defaults to 4. |
| `at` | Where the group starts, in region units. Defaults to the region's middle. |
| `ids` | Exact tile ids to merge instead (overrides `tiles` and `at`). |
| `item` | Which content item goes in this cell. |

## Important items

When some items matter more than others, give each a **weight**: the number of tiles it spans.

<Figures :items="[
  { name: 'featured-weights', caption: 'Every fifth photo has weight 4' },
  { name: 'featured-hero', caption: 'The first photo has weight 9' },
]" />

<<< @/examples/featured.ts#weights

- **Featured tiles from weights:** every item over 1 (weights are rounded) gets a featured
  tile that many tiles big.
- **Where they go:** each feature is centerd on the tiles its item would have filled, one by
  one, in reading order, so heavy items stay among their neighbors.
- **Order:** bigger features are placed first, so they get room.
- **With `fit`:** the tiles are sized so everything fits, counting each item as its weight.

In the components it's one prop:

```tsx
<TileLayout options={options} weights={[1, 4, 1, 1, 1, 9]} fit>
  {photos.map((src) => <img key={src} src={src} alt="" style={coverStyle} />)}
</TileLayout>
```

- **React, Vue, `mountTileLayout`:** `weights`.
- **`<andamento-layout>`:** `data-weight="4"` on children, or a `weights` property.
- **`<SvgTileLayout>` (React and Vue):** `imageWeights`.
- **Needs `options`:** all of these need `options`, not a ready-made `layout`, since the
  layout depends on the weights.

In core, `weightedLayout(options, weights, { fit, cells, placement })` returns
`{ options, layout, features }`, and `weightedFeatures(layout, weights)` returns just the
features for a layout made without them. `contentSlots` and `matchSlots` then put each item in
its own featured cell.

When heavy items crowd together, a later feature may find no free block nearby and take an L
or T shape instead. Bigger tiles or fewer heavy items keep them square.
