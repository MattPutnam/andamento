# Virtualisation

```tsx
<TileLayout options={{ region: { x: 0, y: 0, width: 2000, height: 40000 }, tiling }} virtualize>
  {thousandsOfPhotos}
</TileLayout>
```

With `virtualize`, only the tiles in view are mounted, so layouts with thousands of tiles stay
quick.

- **In view:** within the window and any scrolling container, plus `overscan` pixels round it
  (<code v-pre>virtualize={{ overscan: 600 }}</code>; default 300).
- **Updates:** tiles mount and unmount as you scroll or the layout resizes, checked at most
  once a frame. The view is measured in coarse steps, so small scrolls don't re-render.
- **Finding tiles:** hit testing's spatial index finds the tiles in view.

Everything else keeps working:

- **Keyboard:** navigation reaches every tile. The tab stop stays mounted, and moving to a tile
  out of view mounts it, focuses it and scrolls to it.
- **Screen readers:** list items carry `aria-setsize` and `aria-posinset`, because assistive
  technology can't count tiles that aren't there.
- **Animation:** tiles scrolling in and out don't play the enter and exit animations.
- **Relief:** bevels are worked out for each tile as it's first shown, and shadows are cast
  for the tiles mounted.

Two limits:

- **`renderCell`:** it's only called for tiles in view, so every cell `contentCells` allows
  counts as having content.
- **Server rendering:** it renders the sized container without tiles, which appear once the
  page measures the view.

The [playground](https://mattputnam.github.io/andamento/playground/){target="_self"} has a "Long scrolling wall" option
with tens of thousands of tiles.
