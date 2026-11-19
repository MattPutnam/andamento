# @andamento/vue

Vue 3 components for [Andamento](https://mattputnam.github.io/andamento/) tiling layouts. Split a region into hexagons,
herringbone, Penrose rhombs, hats, jigsaw pieces and more, and put any content in the tiles,
clipped to their shapes. Includes photo matching, focal points, featured tiles, keyboard
navigation, animated transitions, virtualization and server-side rendering.

**[Manual](https://mattputnam.github.io/andamento/) · [Vue](https://mattputnam.github.io/andamento/frameworks/vue) · [Examples](https://mattputnam.github.io/andamento/examples/) · [API](https://mattputnam.github.io/andamento/reference/) · [Playground](https://mattputnam.github.io/andamento/playground/)**

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
  <TileLayout :options="options" navigable animate aria-label="Photos">
    <img v-for="p in photos" :key="p.src" :src="p.src" :alt="p.alt" :style="coverStyle" />
  </TileLayout>
</template>
```

MIT licensed.
