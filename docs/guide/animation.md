# Animated transitions

```tsx
<TileLayout options={options} animate>{children}</TileLayout>
<TileLayout options={options} animate={{ duration: 600, easing: "ease-in-out" }}>…</TileLayout>
```

With `animate`, tiles move smoothly when the layout or the children change: resizing the
region, switching tilings, changing the gap or corner radius, and adding, removing or
reordering children.

- **Moving and reshaping:** a child keeps its tile element (give children keys), and the
  tile glides to its new place while its shape morphs, a square into a hexagon say.
- **Coming and going:** new tiles fade in, and removed ones stay a moment to fade out.
- **Colours:** empty-tile fills cross-fade.
- **Bevels:** a `relief` bevel fades in for the new shape as the tile arrives.

Switch patterns here to see it:

<ClientOnly>
  <LiveDemo />
</ClientOnly>

## How it works

It's all CSS transitions, with no animation loop in JavaScript.

- **Same point counts:** every tile's `clip-path` is given the same number of points, which is
  what lets CSS morph between any two shapes. See `morphPolygon`, and
  `cellCss(…, { points })` in core.
- **Corners:** each corner gets a fixed number of points (one per 10° it turns), whether it's
  sharp or rounded, so changing `cornerRadius` only grows or shrinks the corners.
- **Many-cornered shapes:** shapes with many corners, like a merged featured tile, get more
  points, in steps of 24. They stay smooth, but they switch shape without morphing when their
  content moves to an ordinary tile.
- **No morphing:** cells with holes, and window cells the region cuts in two, switch shape
  without morphing.

Animation is off for users who prefer reduced motion. The static SVG output doesn't animate.
