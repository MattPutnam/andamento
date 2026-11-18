import { useEffect, useState } from "react";

/**
 * Measure images' aspect ratios (width / height) by loading them, for the `aspects` and
 * `imageAspects` props. Returns `undefined` until every image has loaded or failed (failed
 * ones count as square), so content isn't reshuffled image by image as they arrive.
 */
export function useImageAspects(srcs: readonly string[] | undefined): number[] | undefined {
  const key = srcs?.join("\n");
  const [result, setResult] = useState<{ key: string; aspects: number[] }>();
  useEffect(() => {
    if (!srcs || key === undefined || typeof Image === "undefined") return;
    let live = true;
    Promise.all(
      srcs.map(
        (src) =>
          new Promise<number>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
            img.onerror = () => resolve(1);
            img.src = src;
          }),
      ),
    ).then((aspects) => live && setResult({ key, aspects }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result && result.key === key ? result.aspects : undefined;
}
