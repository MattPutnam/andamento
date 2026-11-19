# Hit testing

Each tile's own DOM events already follow its shape, because `clip-path` clips pointer events
too. Hit testing also works where there are no tile elements: in the gaps, over an `<svg>` or
a canvas, or with plain layout geometry.

```tsx
const layout = useTileLayout(options);
<TileLayout layout={layout}
  onPointerMove={(e) => setHovered(cellFromPointer(layout, e, { tolerance: 4 })?.id)}>
  {children}
</TileLayout>
```

| Function | |
|---|---|
| `cellAt(layout, point, { tolerance })` | The cell whose visible shape (gap, rounded corners and holes included) contains a point in layout units. With `tolerance`, a point that close to a tile also counts, e.g. in the grout or for touch. |
| `nearestCell(layout, point, maxDistance?)` | The containing cell, or else the one whose edge is closest. |
| `cellsInRect(layout, rect, { contain })` | Cells meeting a rectangle, or wholly inside it with `contain`. For marquee selection, or what's in view. Rectangles dragged up or left work too. |
| `screenToLayout(layout, box, clientX, clientY)` | Converts a screen point using the element's `getBoundingClientRect()`, letterboxed like SVG's default `preserveAspectRatio`. |
| `cellFromPointer(layout, event, options)` | Both steps for an event handler (React, Vue and `@andamento/dom`). |

A spatial index is built once per layout, so lookups stay fast on layouts with tens of
thousands of cells. In a window layout, hit testing only finds the part of a tile that shows.
