# Plain DOM

No framework: mount a layout into any element.

```ts
import { mountTileLayout } from "@andamento/dom";

const layout = mountTileLayout(document.querySelector("#wall")!, {
  options,
  items: photos.map((src) => Object.assign(new Image(), { src, alt: "" })),
  navigable: true,
  onCellActivate: (cell, { slot }) => open(slot),
});
layout.update({ options: { ...options, gap: 4 } }); // items keep their elements
layout.destroy();
```

- **`items`:** nodes (moved into their tiles and kept there as the layout changes) or strings.
- **`renderCell(cell, { slot })`:** returns a node per tile instead.
- **Other options:** those of the React component, with `cellClass`, `cellStyle` and
  `cellAttributes` per tile, and `label`, `role` and `className` for the layout element.

The handle:

| | |
|---|---|
| `element` | The layout element (with `data-andamento`). |
| `layout` | The layout being shown. |
| `update(changes)` | Change some options; the rest stay. |
| `refresh()` | Re-render, e.g. after changing items in place. |
| `tileElement(cellId)` | The element for a tile. |
| `destroy()` | Remove everything and stop listening. |
