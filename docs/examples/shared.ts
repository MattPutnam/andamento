/**
 * Shared material for the manual's examples: placeholder photos and a painted scene, both
 * made in code so the examples need no image files.
 */
import type { Layout, Pixels } from "@andamento/core";
import { regionPath } from "@andamento/svg";

/** `count` placeholder photos (soft landscapes as SVG data URIs), every third one portrait. */
export function photos(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const hue = (i * 47 + 20) % 360;
    const [w, h] = i % 3 === 1 ? [300, 400] : [400, 300];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 74%)"/><stop offset="1" stop-color="#fff8ee"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#s)"/>
<circle cx="${w * (0.3 + ((i * 13) % 40) / 100)}" cy="${h * 0.33}" r="${h * 0.1}" fill="hsl(${(hue + 180) % 360} 85% 86%)"/>
<path d="M0 ${h * 0.7} Q ${w * 0.3} ${h * 0.45} ${w * 0.6} ${h * 0.62} T ${w} ${h * 0.55} V ${h} H 0Z" fill="hsl(${(hue + 15) % 360} 35% 60%)"/>
<path d="M0 ${h * 0.85} Q ${w * 0.4} ${h * 0.6} ${w} ${h * 0.8} V ${h} H 0Z" fill="hsl(${(hue + 30) % 360} 40% 42%)"/>
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Width / height of each of `photos(count)`. */
export const photoAspects = (count: number) => Array.from({ length: count }, (_, i) => (i % 3 === 1 ? 0.75 : 4 / 3));

/** Where each photo's sun is: a focal point for `photos(count)`. */
export const photoFocus = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ x: 0.3 + ((i * 13) % 40) / 100, y: 0.33, aspect: i % 3 === 1 ? 0.75 : 4 / 3 }));

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** The scene's colour at (u, v), fractions of its width and height: a sunset over the sea. */
function sceneColor(u: number, v: number, aspect: number): RGB {
  const horizon = 0.62;
  const sun = { u: 0.62, v: 0.47, r: 0.13 };
  const du = (u - sun.u) * aspect, dv = v - sun.v;
  const d = Math.hypot(du, dv);
  let c: RGB;
  if (v < horizon) {
    const t = v / horizon;
    c = t < 0.55 ? mix([43, 45, 110], [196, 79, 120], t / 0.55) : mix([196, 79, 120], [252, 170, 90], (t - 0.55) / 0.45);
    c = mix(c, [255, 226, 160], 0.55 * Math.exp(-((d / 0.32) ** 2)));
    if (d < sun.r) c = mix([255, 214, 120], [255, 246, 214], 1 - d / sun.r);
  } else {
    const t = (v - horizon) / (1 - horizon);
    c = mix([214, 104, 104], [26, 42, 92], smooth(0, 1, t));
    // The sun's path on the water, broken by waves.
    const wave = Math.sin(v * 140 + Math.sin(u * 30) * 2) > 0.2 ? 1 : 0.35;
    c = mix(c, [255, 200, 130], wave * Math.exp(-((du / (0.05 + 0.12 * t)) ** 2)) * (1 - 0.6 * t));
  }
  // A headland on the left.
  const land = horizon - 0.16 * Math.exp(-(((u - 0.1) / 0.16) ** 2)) - 0.04 * Math.exp(-(((u - 0.3) / 0.08) ** 2));
  if (v > land && v < horizon + 0.03 * smooth(0.35, 0, u) && u < 0.45) c = mix([40, 32, 60], [70, 48, 80], (v - land) * 4);
  return c;
}

/** The scene as RGBA pixels (for `imageFill` and `imageSize`). */
export function scenePixels(width = 240, height = 160): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = sceneColor((x + 0.5) / width, (y + 0.5) / height, width / height);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** The same scene as an SVG data URI (for `backdrop`), drawn with gradients. */
export function sceneImage(width = 600, height = 400): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2d6e"/><stop offset="0.55" stop-color="#c44f78"/><stop offset="1" stop-color="#fcaa5a"/></linearGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d66868"/><stop offset="1" stop-color="#1a2a5c"/></linearGradient>
<radialGradient id="glow" cx="372" cy="188" r="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe2a0" stop-opacity="0.8"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient>
<linearGradient id="path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc882" stop-opacity="0.9"/><stop offset="1" stop-color="#ffc882" stop-opacity="0.1"/></linearGradient>
</defs>
<rect width="600" height="248" fill="url(#sky)"/>
<rect width="600" height="248" fill="url(#glow)"/>
<circle cx="372" cy="188" r="52" fill="#fff0c8"/>
<rect y="248" width="600" height="152" fill="url(#sea)"/>
<path d="M352 248 L392 248 L470 400 L274 400 Z" fill="url(#path)"/>
<path d="M0 248 V170 Q40 150 80 160 Q130 175 170 222 Q200 236 270 248 Z" fill="#30263f"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** `svg` with the layout's region (and holes) outlined in a dashed line on top, to show where it ends. */
export function outlined(svg: string, layout: Layout, colour = "#b4532a"): string {
  const path = `<path d="${regionPath(layout)}" fill="none" stroke="${colour}" stroke-width="1.2" stroke-dasharray="4 3" fill-rule="evenodd"/>`;
  return svg.replace(/<\/svg>$/, `${path}</svg>`);
}
