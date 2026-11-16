/**
 * Offline placeholder "photos": soft gradient landscapes as SVG data URIs,
 * in a mix of landscape and portrait aspect ratios.
 */
export function placeholderPhotos(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 47) % 360;
    const portrait = i % 3 === 1;
    const [w, h] = portrait ? [300, 400] : [400, 300];
    const sky = `hsl(${hue} 55% 78%)`;
    const hill = `hsl(${(hue + 30) % 360} 40% 45%)`;
    const far = `hsl(${(hue + 15) % 360} 35% 62%)`;
    const sun = `hsl(${(hue + 180) % 360} 80% 88%)`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#s)"/>
<circle cx="${w * (0.25 + ((i * 13) % 50) / 100)}" cy="${h * 0.32}" r="${h * 0.1}" fill="${sun}"/>
<path d="M0 ${h * 0.7} Q ${w * 0.3} ${h * 0.45} ${w * 0.6} ${h * 0.62} T ${w} ${h * 0.55} V ${h} H 0Z" fill="${far}"/>
<path d="M0 ${h * 0.85} Q ${w * 0.4} ${h * 0.6} ${w} ${h * 0.8} V ${h} H 0Z" fill="${hill}"/>
<text x="${w - 16}" y="${h - 16}" text-anchor="end" font-family="system-ui,sans-serif" font-size="28" font-weight="600" fill="#fff" opacity="0.85">${i + 1}</text>
</svg>`;
    out.push(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }
  return out;
}
