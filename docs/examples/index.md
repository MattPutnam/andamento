---
outline: [2, 3]
---

# Examples

Every picture here is drawn by the code under it, run when the site is built. The code uses
`createLayout` from `@andamento/core` and `renderToString` from `@andamento/svg`, but the
same options work in every renderer. `photos`, `scenePixels` and `sceneImage` are made-up
pictures from [`shared.ts`](#shared-material).

## Decorative

### Terrazzo

<Figure name="showcase-terrazzo" />

::: details Code
<<< @/examples/showcase.ts#terrazzo
:::

### Tumbling blocks

<Figure name="showcase-blocks" />

::: details Code
<<< @/examples/showcase.ts#blocks
:::

### An Escher-style tessellation

<Figure name="showcase-escher" />

::: details Code
<<< @/examples/showcase.ts#escher
:::

### A random Mondrian

<Figure name="showcase-painting" />

::: details Code
<<< @/examples/showcase.ts#painting
:::

### The hat monotile

The 2023 "einstein": one shape that tiles the plane but never repeats. About one hat in seven is
mirrored; here they're red.

<Figure name="showcase-hats" />

::: details Code
<<< @/examples/showcase.ts#hats
:::

### Spectres

<Figure name="showcase-spectres" />

::: details Code
<<< @/examples/showcase.ts#spectres
:::

### A Penrose star

<Figure name="showcase-penroseStar" />

::: details Code
<<< @/examples/showcase.ts#penroseStar
:::

### Mermaid scales

<Figure name="showcase-scales" />

::: details Code
<<< @/examples/showcase.ts#scales
:::

## Floors and walls

### A bathroom floor

<Figure name="showcase-bathroom" />

::: details Code
<<< @/examples/showcase.ts#bathroom
:::

### Octagons and squares

<Figure name="showcase-floor" />

::: details Code
<<< @/examples/showcase.ts#floor
:::

### A wall with a door and a window, an arch, a round patio

<Figures :items="[
  { name: 'regions-wall' },
  { name: 'regions-arch' },
  { name: 'regions-round' },
]" />

::: details Code
<<< @/examples/regions.ts
:::

## Mosaics

### Rows flowing round the sun

<Figure name="flow-mosaic" />

::: details Code
<<< @/examples/flow.ts#mosaic
:::

### Stones sized by the picture's detail

<Figure name="density-picture" />

::: details Code
<<< @/examples/density.ts
:::

### From a box of twelve colors

<Figure name="styling-mosaic-palette" />

::: details Code
<<< @/examples/styling.ts#mosaic
:::

### A jigsaw

<Figure name="styling-backdrop" />

::: details Code
<<< @/examples/styling.ts#backdrop
:::

## Photo walls

### A featured flower

<Figure name="hero" />

::: details Code
<<< @/examples/hero.ts
:::

### Important photos

<Figures :items="[
  { name: 'featured-weights', caption: 'Every fifth photo spans 4 tiles' },
  { name: 'featured-hero', caption: 'The first spans 9' },
]" />

::: details Code
<<< @/examples/featured.ts
:::

### Every photo whole

<Figure name="fitting-contain" />

::: details Code
<<< @/examples/fitting.ts#contain
:::

## Shared material

The made-up photos and the sunset scene used above:

::: details shared.ts
<<< @/examples/shared.ts
:::
