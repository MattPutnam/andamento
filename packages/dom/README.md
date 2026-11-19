# @andamento/dom

[Andamento](https://mattputnam.github.io/andamento/) tiling layouts without a framework. Use the `<andamento-layout>` web
component in plain HTML, Angular, Svelte, Solid or Lit, or mount a layout into any element
with `mountTileLayout()`. Any content goes in the tiles, clipped to their shapes, with
keyboard navigation, animated transitions and virtualization.

**[Manual](https://mattputnam.github.io/andamento/) · [Web component](https://mattputnam.github.io/andamento/frameworks/web-component) · [Plain DOM](https://mattputnam.github.io/andamento/frameworks/dom) · [API](https://mattputnam.github.io/andamento/reference/)**

```bash
npm install @andamento/core @andamento/dom
```

```html
<script type="module">
  import { defineTileLayoutElement } from "@andamento/dom";
  defineTileLayoutElement();
</script>

<andamento-layout
  options='{"region":{"x":0,"y":0,"width":240,"height":150},"tiling":{"type":"hexagonal","size":26},"gap":2}'
  navigable animate label="Photos">
  <img src="beach.jpg" alt="Beach" />
  <img src="hills.jpg" alt="Hills" />
</andamento-layout>
```

MIT licensed.
