import type { Rect, Vec } from "./geometry";
import type { Cell, Layout } from "./layout";
import type { Pixels } from "./fills";
import { safeArea } from "./safe";
import { cellShape } from "./shape";

/**
 * A point in an image to keep in view, as fractions of its width and height ({ x: 0, y: 0 }
 * is the top left), and optionally the image's shape, so renderers can place it exactly
 * without being told the image's aspect elsewhere.
 */
export interface Focus {
  x: number;
  y: number;
  /** The image's width / height. */
  aspect?: number;
}

export interface CoverOptions {
  /** The image's width / height (defaults to `focus.aspect`, else square). */
  aspect?: number;
  /** What to keep in view. Defaults to the middle, { x: 0.5, y: 0.5 }. */
  focus?: Focus;
  /**
   * Where the focus should land: the middle of the part of the cell that shows ("visible",
   * the default), or of the whole tile ("tile"), for a cell an `edges: "window"` layout cuts.
   * Either way it's the middle of the cell's safe area, so it's well inside the shape.
   */
  within?: "tile" | "visible";
}

/**
 * Where to draw an image (in layout units) so it covers a cell's box, like CSS
 * `object-fit: cover`, with its focal point as near as it can get to the middle of what
 * shows of the cell. A cut tile, a triangle or a tall thin tile then shows a photo's
 * subject rather than whatever was in the middle of the photo. Clip the image to the cell
 * as usual.
 */
export function coverRect(cell: Cell, layout: Pick<Layout, "cornerRadius" | "view">, options: CoverOptions): Rect {
  const box = cellShape(cell).bbox;
  const given = options.aspect ?? options.focus?.aspect;
  const aspect = given !== undefined && given > 0 && Number.isFinite(given) ? given : 1;
  const scale = Math.max(box.width / aspect, box.height);
  const width = scale * aspect, height = scale;
  const f = options.focus ?? { x: 0.5, y: 0.5 };
  const t = focusTarget(cell, layout, options.within);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp(t.x - clamp(f.x, 0, 1) * width, box.x + box.width - width, box.x),
    y: clamp(t.y - clamp(f.y, 0, 1) * height, box.y + box.height - height, box.y),
    width,
    height,
  };
}

/**
 * CSS `object-position` for an image filling a cell's element with `object-fit: cover`
 * (as `coverStyle` does), placing it as `coverRect` does.
 */
export function objectPosition(cell: Cell, layout: Pick<Layout, "cornerRadius" | "view">, options: CoverOptions): string {
  const box = cellShape(cell).bbox;
  const r = coverRect(cell, layout, options);
  const pos = (spare: number, offset: number) => (spare > 1e-9 * (r.width + r.height) ? Number(((offset / spare) * 100).toFixed(3)) : 50);
  return `${pos(r.width - box.width, box.x - r.x)}% ${pos(r.height - box.height, box.y - r.y)}%`;
}

/** The middle of the cell's safe area: where a focal point should land. */
function focusTarget(cell: Cell, layout: Pick<Layout, "cornerRadius" | "view">, within: "tile" | "visible" = "visible"): Vec {
  const s = safeArea(cell, layout, { within });
  return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
}

/**
 * A guess at what a photo is of: the most eye-catching spot, where colour and brightness
 * stand out most from their surroundings, with a slight preference for the middle. Good
 * for a subject against a plainer background (a face, a flower, a sun); for busy pictures
 * give the focus yourself. Pass small pixels (`loadImagePixels` gives at most 256 a side).
 * The result includes the image's `aspect`.
 */
export function estimateFocus(pixels: Pixels): Focus {
  const { width, height, data } = pixels;
  if (!(width > 0) || !(height > 0)) return { x: 0.5, y: 0.5 };
  const aspect = width / height;
  // Work at most 64 pixels a side.
  const step = Math.max(1, Math.ceil(Math.max(width, height) / 64));
  const w = Math.ceil(width / step), h = Math.ceil(height / step);
  const L = new Float64Array(w * h), A = new Float64Array(w * h), B = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y * step; yy < Math.min(height, (y + 1) * step); yy++) {
        for (let xx = x * step; xx < Math.min(width, (x + 1) * step); xx++) {
          const k = (yy * width + xx) * 4;
          const alpha = (data[k + 3] ?? 255) / 255;
          // Transparent pixels count as white.
          r += (data[k]! * alpha + 255 * (1 - alpha)); g += (data[k + 1]! * alpha + 255 * (1 - alpha)); b += (data[k + 2]! * alpha + 255 * (1 - alpha)); n++;
        }
      }
      r /= n * 255; g /= n * 255; b /= n * 255;
      // A rough opponent colour space: brightness and two colour axes.
      const i = y * w + x;
      L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      A[i] = r - g;
      B[i] = (r + g) / 2 - b;
    }
  }
  // How much each spot differs from its surroundings (centre minus surround), at two scales.
  const size = Math.max(w, h);
  const near = Math.max(1, Math.round(size / 32)), far = Math.max(2, Math.round(size / 6));
  const blur = (src: Float64Array, r: number) => boxBlur(boxBlur(src, w, h, r), w, h, r);
  const sal = new Float64Array(w * h);
  for (const [chan, weight] of [[L, 1], [A, 1.5], [B, 1.5]] as const) {
    const c = blur(chan, near), s = blur(chan, far);
    for (let i = 0; i < sal.length; i++) sal[i]! += weight * Math.abs(c[i]! - s[i]!);
  }
  // Favour a blob over a thin line: smooth, then pick the peak, leaning a little to the middle.
  const smooth = blur(sal, Math.max(1, Math.round(size / 16)));
  let best = -1, bx = w / 2, by = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5) / w - 0.5, (y + 0.5) / h - 0.5);
      const v = smooth[y * w + x]! * (1 - 0.4 * d);
      if (v > best) { best = v; bx = x + 0.5; by = y + 0.5; }
    }
  }
  return best > 1e-6 ? { x: Math.min(1, (bx * step) / width), y: Math.min(1, (by * step) / height), aspect } : { x: 0.5, y: 0.5, aspect };
}

/** Box blur of radius `r`, along rows then columns, with edges extended. */
function boxBlur(src: Float64Array, w: number, h: number, r: number): Float64Array {
  const tmp = new Float64Array(src.length), out = new Float64Array(src.length);
  const pass = (from: Float64Array, to: Float64Array, len: number, lines: number, at: (line: number, k: number) => number) => {
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += from[at(line, Math.min(len - 1, Math.max(0, k)))]!;
      for (let k = 0; k < len; k++) {
        to[at(line, k)] = sum / (2 * r + 1);
        sum += from[at(line, Math.min(len - 1, k + r + 1))]! - from[at(line, Math.max(0, k - r))]!;
      }
    }
  };
  pass(src, tmp, w, h, (y, x) => y * w + x);
  pass(tmp, out, h, w, (x, y) => y * w + x);
  return out;
}
