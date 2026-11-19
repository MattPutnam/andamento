# Tile size by density

`sizeAt` varies the tile size across the region. It's a function giving the size wanted at
each point, as a factor of the tiling's own size: 1 as given, 0.5 half as big, 2 twice as big.
Use it for small tiles round a focal point, along the edges, or wherever a picture has
detail.

<Figures :items="[
  { name: 'density-radial', caption: 'radialSize: small round a point' },
  { name: 'density-edges', caption: 'edgeSize: small along the edges' },
  { name: 'density-picture', caption: 'imageSize: small where the picture is dark' },
]" />

<<< @/examples/density.ts

## How the size changes

- **Voronoi and Delaunay:** the size changes smoothly. Sites are scattered more densely where
  tiles should be small, then evened out by density-weighted relaxation.
- **Every other tiling:** tiles are generated at the largest size wanted. Where tiles should be
  under about half that size, groups of them are replaced by the same tiling at half the scale,
  then again, down to the smallest size. A grid from the same origin nests exactly, like a
  quadtree. Other tilings are cut where a finer area meets a coarser one, and cut slivers are
  merged into a neighbour, so there are no crumbs or gaps.

## Size fields

Three helpers make size fields, each easing smoothly between its two sizes:

| Helper | |
|---|---|
| `radialSize({ center, radius, inner, outer })` | `inner` (default 0.25) at `center`, growing to `outer` (default 1) at `radius`. |
| `edgeSize(region, { distance, edge, middle, holes })` | `edge` (default 0.25) along the outline and round `holes`, growing to `middle` (default 1) at `distance` in. `region` is a polygon. |
| `imageSize(pixels, box, { dark, light, invert })` | `dark` where the picture is dark and `light` where it's light (swapped with `invert`). The picture covers `box` like `object-fit: cover`. |

`pixels` is RGBA data, `{ width, height, data }`, like a canvas `ImageData`. In a browser,
`await loadImagePixels(url)` reads an image's pixels.

You can write your own field too: any `(point) => number`.

Everything else works on the result as usual: gaps, holes, features, content placement and hit
testing. `maxTiles` still caps the count.
