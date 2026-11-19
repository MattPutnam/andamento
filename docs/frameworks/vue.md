# Vue

```bash
npm install @andamento/core @andamento/vue
```

```vue
<script setup lang="ts">
import { TileLayout, coverStyle } from "@andamento/vue";
import { hexagonal } from "@andamento/core";

const options = { region: { x: 0, y: 0, width: 240, height: 150 }, tiling: hexagonal({ size: 26 }), gap: 2 };
</script>

<template>
  <TileLayout :options="options" background="#f4f1ea" navigable animate @cell-activate="(cell, s) => open(s.slot)">
    <img v-for="p in photos" :key="p.src" :src="p.src" :alt="p.alt" :style="coverStyle" />
    <template #fallback="{ cell }">…</template>
    <template #backdrop><img src="wall.jpg" alt="" :style="coverStyle" /></template>
  </TileLayout>
</template>
```

The live demos in this manual are this component.

- **Children:** each top-level node of the default slot fills one tile. `v-for` children count
  one each, and `v-if`-ed-out ones are skipped. Give them `:key`s so each keeps its element and
  state as the layout changes.
- **Per-tile slot:** `#cell="{ cell, slot }"` fills every tile instead, like React's
  `renderCell`.
- **Other slots:** `#fallback="{ cell }"` for empty tiles, and `#backdrop` for one picture
  across all the tiles.
- **Props:** React's, in Vue's spelling:
  - `options` or `layout`, `fit`, `contentCells`, `placement`, `aspects`, `choose`,
    `safe-area`, `focal-points`, `weights`
  - `fill`, `relief`, `background`, `navigable`, `cell-label`, `focus-ring`
  - `animate`, `virtualize`, `cell-class`, `cell-style`

  Other attributes and listeners (`class`, `aria-label`, `@pointermove`) go on the layout
  element.
- **Event:** `@cell-activate="(cell, { slot }) => …"`.
- **`<SvgTileLayout>`:** takes the options of `renderToString` as props (`images`, `fill`,
  `stroke`, `relief`, `backdrop`, `title`, `image-alts`, `image-weights`, `fit`, …).
- **Composables:** `useTileLayout(options)` and `useFitCount(options, count)` take a ref,
  getter or object and return a computed layout, worked out again only when the options change
  by value.
- **Server rendering:** works with `vue/server-renderer`. Tiles render in place, sized in
  percentages, with nothing to measure. This site is built that way.
