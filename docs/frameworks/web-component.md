# Web component

`<andamento-layout>` works in plain HTML and in any framework: Angular, Svelte, Solid, Lit.

```bash
npm install @andamento/core @andamento/dom
```

```html
<script type="module">
  import { defineTileLayoutElement } from "@andamento/dom";
  defineTileLayoutElement(); // registers <andamento-layout>
</script>

<andamento-layout
  options='{"region":{"x":0,"y":0,"width":240,"height":150},"tiling":{"type":"hexagonal","size":26},"gap":2}'
  background="#f4f1ea" navigable animate relief label="Photos"
>
  <img src="a.jpg" alt="Beach" data-aspect="1.5" />
  <img src="b.jpg" alt="Hills" data-aspect="0.75" data-weight="4" />
  <img slot="backdrop" src="wall.jpg" alt="" />
</andamento-layout>
```

## Children

- **In the light DOM:** each child element fills one tile, in reading order. Children stay
  where you put them and are shown in their tiles through slots. So a framework that renders
  them (`{#each}` in Svelte, `@for` in Angular, `<For>` in Solid) keeps managing them, and page
  styles still apply.
- **Changes:** adding, removing or reordering children re-renders the layout.
- **Per-child data:**
  - `data-aspect` (width / height) puts a child in a tile of its shape.
  - `data-focus="0.3 0.25"` gives its focal point.
  - `data-weight="4"` makes it span 4 tiles.
- **Backdrop:** a `slot="backdrop"` child is copied into every tile as one picture across them
  all.

## Settings

As attributes:

| Attribute | |
|---|---|
| `options` | Layout options as JSON. |
| `navigable`, `animate`, `relief`, `virtualize` | On when present. |
| `safe-area` | On, or `"visible"`. |
| `fit` | On, or `"nearest"`. |
| `placement`, `content-cells`, `choose` | As in the components. |
| `background`, `fill` | A color, or a JSON palette for `fill`. |
| `focus-ring` | Ring color. |
| `label` | The layout's accessible name. |

Or set them as properties, including the ones that can't be attributes: `options` and
`layout` objects, `fill` and `cellLabel` functions, `relief` options, `animated` (because
`animate` is taken by the Web Animations API), `aspects`, `focalPoints`, `weights`,
`cellStyle`, `fallback`.

## Events and styling

- Activating a tile (a click, or Enter or Space with `navigable`) fires `cellactivate`, with
  `{ cell, slot, item }` in `detail`. `item` is the child element.
- Tiles live in the element's shadow root. Style them with `::part(tile)`, `::part(empty)` and
  `::part(boundary)`, and the layout itself with `::part(layout)`.

## In frameworks

```svelte
<andamento-layout options={JSON.stringify(options)} navigable on:cellactivate={(e) => open(e.detail.slot)}>
  {#each photos as p (p.src)}<img src={p.src} alt={p.alt} style="width:100%;height:100%;object-fit:cover" />{/each}
</andamento-layout>
```

In Angular, add `CUSTOM_ELEMENTS_SCHEMA` to the component, bind properties with
`[options]="options"`, and bind events with `(cellactivate)="open($event.detail)"`.
