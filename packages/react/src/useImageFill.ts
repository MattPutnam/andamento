import { useEffect, useMemo, useState } from "react";
import { imageFill, loadImagePixels, type CellFill, type ImageFillOptions, type Pixels } from "@andamento/core";

/**
 * Load an image and color tiles from it (see `imageFill`): returns a fill to pass as
 * `fill`, or `undefined` while the image loads (or if it fails), so the default fill shows
 * meanwhile. `maxSize` caps the size the image is read at (default 256 px on the long side).
 */
export function useImageFill(src: string | undefined, options: ImageFillOptions & { maxSize?: number } = {}): CellFill | undefined {
  const { fit, palette, fallback, samples, maxSize = 256 } = options;
  const [pixels, setPixels] = useState<{ src: string; pixels: Pixels }>();
  useEffect(() => {
    if (!src) return;
    let live = true;
    loadImagePixels(src, maxSize).then(
      (p) => live && setPixels({ src, pixels: p }),
      (e) => console.warn(`useImageFill: ${(e as Error).message}`),
    );
    return () => {
      live = false;
    };
  }, [src, maxSize]);
  const paletteKey = palette?.join(",");
  return useMemo(
    () => (pixels && pixels.src === src ? imageFill(pixels.pixels, { fit, palette, fallback, samples }) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pixels, src, fit, paletteKey, fallback, samples],
  );
}
