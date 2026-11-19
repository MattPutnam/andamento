---
layout: home

hero:
  name: Andamento
  text: Tiling layouts for any content
  tagline: Split a region into hexagons, herringbone, Penrose rhombs, hats, jigsaw pieces, flowing mosaic rows and more, then put photos, cards, video or anything else in each tile.
  image:
    src: /examples/hero.svg
    alt: A wall of photos in rounded hexagons, with a large featured hexagon in the middle
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: See the examples
      link: /examples/
    - theme: alt
      text: Open the playground
      link: https://mattputnam.github.io/andamento/playground/
      target: _self

features:
  - title: 29 patterns and counting
    details: Bricks, parquet, regular and semi-regular polygons, Cairo pentagons, fish scales, jigsaws, Penrose, the hat and spectre monotiles, all 81 isohedral types, random stone and Mondrian patterns, and mosaic flow.
    link: /guide/patterns
    linkText: Browse the patterns
  - title: Any content, any framework
    details: React and Vue components, a web component for Angular, Svelte, Solid or plain HTML, a framework-free mount function, and SVG, canvas and PNG output, all from one pure TypeScript core.
    link: /guide/getting-started
    linkText: Pick a renderer
  - title: Made for photos
    details: Matching photos to tile shapes, safe areas that never crop, focal points, featured tiles and weights for important items, and sizing the tiles to the number of items.
    link: /guide/photos
    linkText: Fitting photos
  - title: Any region
    details: L-shaped walls, arches, circles, doors and windows cut out as holes; tiles clipped, kept whole, or seen through the region as a window.
    link: /guide/regions
    linkText: Regions and holes
  - title: Mosaics
    details: Color each tile from a picture, snap to a box of real tile colors, size the tiles by the picture's detail, and lay tesserae in rows that flow round the subject.
    link: /guide/styling#mosaics
    linkText: Make a mosaic
  - title: Usable
    details: Keyboard navigation in any tiling, screen-reader structure, animated transitions that morph shapes, virtualization for thousands of tiles, and hit testing on the real shapes.
    link: /guide/accessibility
    linkText: Interaction
---

<div class="home-demo">

## Try it

This is the Vue `<TileLayout>` running live: switch the pattern and watch the photos move to their new tiles. Click a tile, then use the arrow keys.

<ClientOnly>
  <LiveDemo />
</ClientOnly>

## A few things it can do

<Figures :columns="4" :items="[
  { name: 'flow-mosaic', caption: 'Mosaic rows flowing round the sun, colored from a picture' },
  { name: 'showcase-hats', caption: 'The hat monotile, mirrored hats picked out' },
  { name: 'featured-weights', caption: 'Important photos spanning four tiles' },
  { name: 'styling-backdrop', caption: 'One picture across a jigsaw' },
  { name: 'showcase-painting', caption: 'A random Mondrian' },
  { name: 'density-picture', caption: 'Stones sized by the picture\'s detail' },
  { name: 'showcase-escher', caption: 'An Escher-style tessellation' },
  { name: 'regions-wall', caption: 'A wall with a door and a window' },
]" />

[More examples →](/examples/)

</div>

<style>
.home-demo {
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px 48px;
}
.home-demo h2 {
  margin: 48px 0 8px;
  font-size: 24px;
  font-weight: 600;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 32px;
}
@media (min-width: 640px) {
  .home-demo { padding: 0 48px 64px; }
}
</style>
