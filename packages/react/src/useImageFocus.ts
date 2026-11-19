import { useEffect, useState } from "react";
import { estimateFocus, loadImagePixels, type Focus } from "@andamento/core";

/**
 * Guess each image's focal point (see `estimateFocus`) by loading it, for the `focus` and
 * `imageFocus` props. Returns `undefined` until every image has been looked at; images that
 * fail to load (or that the browser won't let a canvas read) get the middle.
 */
export function useImageFocus(srcs: readonly string[] | undefined): Focus[] | undefined {
  const key = srcs?.join("\n");
  const [result, setResult] = useState<{ key: string; focus: Focus[] }>();
  useEffect(() => {
    if (!srcs || key === undefined || typeof document === "undefined") return;
    let live = true;
    Promise.all(
      srcs.map((src) =>
        loadImagePixels(src, 128)
          .then(estimateFocus)
          .catch(() => ({ x: 0.5, y: 0.5 })),
      ),
    ).then((focus) => live && setResult({ key, focus }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result && result.key === key ? result.focus : undefined;
}
