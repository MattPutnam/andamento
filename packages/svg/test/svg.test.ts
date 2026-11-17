// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createLayout, grid } from "@andamento/core";
import { polygonToPath, renderToElement, renderToString } from "@andamento/svg";

const layout = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }), gap: 10 });

describe("svg renderer", () => {
  it("formats paths compactly", () => {
    expect(polygonToPath([{ x: 0, y: 0 }, { x: 12.5, y: 0 }, { x: 12.5, y: -0.0001 }])).toBe("M0 0L12.5 0L12.5 0Z");
  });

  it("rounds corners with arcs", () => {
    expect(polygonToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], 3, 2)).toBe(
      "M0 2A2 2 0 0 1 2 0L8 0A2 2 0 0 1 10 2L10 8A2 2 0 0 1 8 10L2 10A2 2 0 0 1 0 8Z",
    );
    const rounded = createLayout({ region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }), cornerRadius: 5 });
    expect(renderToString(rounded).match(/A5 5 /g)).toHaveLength(24);
  });

  it("renders a cell group per cell with a viewBox", () => {
    const s = renderToString(layout, { background: "#fff", title: "Wall <1>" });
    expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"')).toBe(true);
    expect(s.match(/class="andamento-cell"/g)).toHaveLength(6);
    expect(s).toContain("<title>Wall &lt;1&gt;</title>");
    expect(s).toContain('class="andamento-region"');
  });

  it("clips photos to cells, in reading order", () => {
    const s = renderToString(layout, { images: ["a.jpg", "b.jpg"], idPrefix: "w" });
    expect(s.match(/<image /g)).toHaveLength(2);
    expect(s).toContain('href="a.jpg"');
    expect(s).toContain('clip-path="url(#w-clip-0)"');
    expect(s).toContain('preserveAspectRatio="xMidYMid slice"');
    const repeated = renderToString(layout, { images: ["a.jpg", "b.jpg"], repeatImages: true });
    expect(repeated.match(/<image /g)).toHaveLength(6);
  });

  it("escapes attribute values", () => {
    const s = renderToString(layout, { images: ['x.jpg?a=1&b="2"'] });
    expect(s).toContain('href="x.jpg?a=1&amp;b=&quot;2&quot;"');
  });

  it("builds DOM elements", () => {
    const svg = renderToElement(layout, { images: ["a.jpg"], stroke: "#000" });
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.querySelectorAll("g.andamento-cell")).toHaveLength(6);
    expect(svg.querySelector("image")?.getAttribute("href")).toBe("a.jpg");
  });
});

describe("svg backdrop", () => {
  it("draws one image clipped to every cell, after the background", async () => {
    const { createLayout, grid } = await import("@andamento/core");
    const { renderToString } = await import("@andamento/svg");
    const layout = createLayout({ region: { x: 10, y: 20, width: 300, height: 200 }, tiling: grid({ width: 100 }), gap: 4 });
    const svg = renderToString(layout, { backdrop: "big.jpg", background: "#eee", idPrefix: "t" });
    expect(svg).toContain('<image class="andamento-backdrop" href="big.jpg" x="10" y="20" width="300" height="200" preserveAspectRatio="xMidYMid slice" clip-path="url(#t-backdrop)"/>');
    expect(svg.match(/<clipPath id="t-backdrop">/g)).toHaveLength(1);
    expect(svg.indexOf("andamento-region")).toBeLessThan(svg.indexOf("andamento-backdrop"));
    expect(svg).not.toMatch(/<path d="[^"]*" fill="#[0-9a-f]+"\/>/);
    expect(renderToString(layout, { idPrefix: "t" })).toMatch(/<path d="[^"]*" fill="#[0-9a-f]+"\/>/);
  });
});
