import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { gradientFill, grid, herringbone, hexagonal, protoTileFill } from "@andamento/core";
import { SvgCellImage, SvgTileLayout, TileLayout, coverStyle, neutralPalette } from "@andamento/react";

// 3 x 2 grid of 100-unit cells, 10-unit gap.
const options = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }), gap: 10 };

const cells = (html: string) => html.match(/data-cell-id=/g)?.length ?? 0;

describe("<TileLayout> (HTML, arbitrary children)", () => {
  it("puts each child in a clipped tile, in reading order", () => {
    const html = renderToStaticMarkup(
      <TileLayout options={options}>
        <p>first</p>
        <button>second</button>
        {false}
        {null}
        <img src="third.jpg" style={coverStyle} alt="" />
      </TileLayout>,
    );
    expect(cells(html)).toBe(6);
    expect(html).toContain("aspect-ratio:300 / 200");
    // Tile 0: inset by 5 on each side of [0,100] → left 5/300, width 90/300.
    const first = html.match(/data-index="0"[^>]*style="[^"]*left:1\.6667%;top:2\.5%;width:30%;height:45%;clip-path:polygon\(([^)]*)\)/);
    expect(first).not.toBeNull();
    expect(first![1]!.split(", ").sort()).toEqual(["0% 0%", "0% 100%", "100% 0%", "100% 100%"]);
    // false/null are skipped, so the <img> lands in the third tile.
    const order = ["first", "second", "third.jpg"].map((s) => html.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html.match(/data-empty=""/g)).toHaveLength(3);
  });

  it("clips non-rectangular tiles with a polygon", () => {
    const html = renderToStaticMarkup(
      <TileLayout options={{ ...options, tiling: hexagonal({ size: 50 }) }}>
        <span>hex</span>
      </TileLayout>,
    );
    const counts = [...html.matchAll(/clip-path:polygon\(([^)]*)\)/g)].map((m) => m[1]!.split(",").length);
    expect(counts).toContain(6); // interior tiles are full hexagons
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(3); // edge tiles are cut
  });

  it("drops extra children and fills empty tiles from fallback", () => {
    const kids = Array.from({ length: 10 }, (_, i) => <i key={i}>c{i}</i>);
    const html = renderToStaticMarkup(<TileLayout options={options}>{kids}</TileLayout>);
    expect(html).toContain("c5");
    expect(html).not.toContain("c6");

    const withFallback = renderToStaticMarkup(
      <TileLayout options={options} fallback={(cell) => <em>empty {cell.index}</em>}>
        <b>only</b>
      </TileLayout>,
    );
    expect(withFallback).toContain("<em>empty 5</em>");
    expect(withFallback).not.toContain("<em>empty 0</em>");
  });

  it("supports renderCell, per-cell styles and a background", () => {
    const html = renderToStaticMarkup(
      <TileLayout
        options={options}
        renderCell={(cell) => <span>#{cell.index}</span>}
        cellClassName={(cell) => (cell.index % 2 ? "odd" : "even")}
        cellStyle={{ background: "teal" }}
        background="#eee"
        className="mine"
        style={{ maxWidth: 600 }}
      >
        <span>ignored</span>
      </TileLayout>,
    );
    expect(html).toContain("<span>#5</span>");
    expect(html).not.toContain("ignored");
    expect(html).toContain('class="odd"');
    expect(html).toContain("background:teal");
    expect(html).toContain("background:#eee");
    expect(html).toContain('class="mine"');
    expect(html).toContain("max-width:600px");
  });
});

describe("<TileLayout> empty tiles and content placement", () => {
  // 3 x 2 grid of 100-unit cells in a 250-wide region: the right column is cut.
  const cut = { region: { x: 0, y: 0, width: 250, height: 200 }, tiling: grid({ width: 100 }) };
  const tile = (html: string, index: number) => html.match(new RegExp(`<div[^>]*data-index="${index}"[^>]*>(.*?)</div>`))!;

  it("colors empty tiles with a neutral palette by default", () => {
    const html = renderToStaticMarkup(
      <TileLayout options={options}>
        <b>one</b>
      </TileLayout>,
    );
    const backgrounds = [...html.matchAll(/data-empty=""[^>]*background:([^;"]+)/g)].map((m) => m[1]);
    expect(backgrounds).toHaveLength(5);
    expect(backgrounds.every((b) => neutralPalette.includes(b!))).toBe(true);
    // Neighbours differ.
    expect(backgrounds[0]).not.toBe(backgrounds[1]); // tiles 1 and 2
    // The filled tile gets no fill.
    expect(tile(html, 0)[0]).not.toContain("background");
  });

  it("accepts a color, a function, or transparent", () => {
    const red = renderToStaticMarkup(<TileLayout options={options} fill="red" />);
    expect(red.match(/background:red/g)).toHaveLength(6);
    const fn = renderToStaticMarkup(<TileLayout options={options} fill={(c) => (c.index ? "blue" : "green")} />);
    expect(fn.match(/background:blue/g)).toHaveLength(5);
    const none = renderToStaticMarkup(<TileLayout options={options} fill="transparent" />);
    expect(none.match(/background:transparent/g)).toHaveLength(6);
  });

  it("marks cut tiles and keeps children out of them with contentCells: whole", () => {
    const html = renderToStaticMarkup(
      <TileLayout options={cut} contentCells="whole">
        <b>a</b>
        <b>b</b>
        <b>c</b>
        <b>d</b>
      </TileLayout>,
    );
    expect(html.match(/data-boundary=""/g)).toHaveLength(2);
    expect(tile(html, 0)[1]).toBe("<b>a</b>");
    expect(tile(html, 1)[1]).toBe("<b>b</b>");
    expect(tile(html, 2)[0]).toContain("data-boundary");
    expect(tile(html, 2)[0]).toContain("data-empty");
    expect(tile(html, 3)[1]).toBe("<b>c</b>");
    expect(tile(html, 4)[1]).toBe("<b>d</b>");
    expect(tile(html, 5)[1]).toBe("");
  });

  it("places children with placement and tells per-cell props the state", () => {
    const big = { region: { x: 0, y: 0, width: 500, height: 500 }, tiling: grid({ width: 100 }) };
    const html = renderToStaticMarkup(
      <TileLayout
        options={big}
        placement="center"
        cellClassName={(_, s) => (s.empty ? "empty" : `slot-${s.slot}`)}
        fallback={(_, s) => (s.empty ? <i>-</i> : null)}
      >
        <b>middle</b>
      </TileLayout>,
    );
    expect(tile(html, 12)[0]).toContain('class="slot-0"');
    expect(tile(html, 12)[1]).toBe("<b>middle</b>");
    expect(html.match(/class="empty"/g)).toHaveLength(24);
    expect(html.match(/<i>-<\/i>/g)).toHaveLength(24);
  });

  it("numbers allowed cells for renderCell and treats null as empty", () => {
    const html = renderToStaticMarkup(
      <TileLayout options={cut} contentCells="whole" renderCell={(_, { slot }) => (slot >= 0 && slot < 3 ? <b>{slot}</b> : null)} fill="gray" />,
    );
    expect(tile(html, 0)[1]).toBe("<b>0</b>");
    expect(tile(html, 3)[1]).toBe("<b>2</b>");
    expect(html.match(/data-empty=""/g)).toHaveLength(3);
    expect(html.match(/background:gray/g)).toHaveLength(3);
  });

  it("moves the same child to a different tile with placement", () => {
    const one = <b key="k">k</b>;
    const reading = renderToStaticMarkup(<TileLayout options={options}>{[one]}</TileLayout>);
    const centered = renderToStaticMarkup(<TileLayout options={options} placement="center">{[one]}</TileLayout>);
    expect(tile(reading, 0)[1]).toBe("<b>k</b>");
    expect(tile(centered, 0)[1]).toBe("");
    expect(centered.match(/<b>k<\/b>/g)).toHaveLength(1);
  });
});

describe("fill helpers and fit", () => {
  it("accepts core fill helpers", () => {
    const html = renderToStaticMarkup(<TileLayout options={options} fill={gradientFill(["#000000", "#ffffff"])} />);
    const colors = [...html.matchAll(/background:(#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(colors).toHaveLength(6);
    expect(colors[0]).toBe(colors[3]); // same column
    expect(colors[0]).not.toBe(colors[2]);
    const svg = renderToStaticMarkup(<SvgTileLayout options={options} fill={protoTileFill(["#123456"])} />);
    expect(svg.match(/fill="#123456"/g)).toHaveLength(6);
  });

  it("sizes tiles to the children with fit", () => {
    const big = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: hexagonal({ size: 5 }) };
    const kids = Array.from({ length: 9 }, (_, i) => <i key={i}>k{i}</i>);
    const html = renderToStaticMarkup(
      <TileLayout options={big} fit contentCells="whole">
        {kids}
      </TileLayout>,
    );
    const whole = html.match(/<div[^>]*data-cell-id[^>]*>/g)!.filter((d) => !d.includes("data-boundary"));
    expect(whole.length).toBeGreaterThanOrEqual(9);
    expect(whole.length).toBeLessThan(14);
    expect(html).toContain("k8");
    const svg = renderToStaticMarkup(<SvgTileLayout options={big} fit images={["a", "b", "c"]} />);
    expect(svg.match(/class="andamento-cell"/g)!.length).toBeLessThan(8);
  });
});

describe("backdrop: one picture across all tiles", () => {
  it("puts a copy in every tile, sized to the layout and offset to line up", () => {
    const html = renderToStaticMarkup(
      <TileLayout options={options} backdrop={<img src="wide.jpg" alt="" style={coverStyle} />}>
        <b>first</b>
      </TileLayout>,
    );
    expect(html.match(/src="wide.jpg"/g)).toHaveLength(6);
    // Tile 1 spans x 105–195 of 300 (gap 10): the backdrop box starts 105/90 tile-widths to the left.
    const tile1 = html.match(/<div[^>]*data-index="1"[^>]*>(.*?)<\/div><\/div>/)![1]!;
    expect(tile1).toContain("left:-116.6667%;top:-5.5556%;width:333.3333%;height:222.2222%");
    expect(tile1).toContain("z-index:-1");
    // Empty tiles show the backdrop, not the fill; content still renders.
    expect(html).not.toMatch(/data-empty=""[^>]*background:/);
    expect(html).toContain("<b>first</b>");
  });

  it("draws one clipped image in SVG instead of cell fills", () => {
    const html = renderToStaticMarkup(<SvgTileLayout options={options} backdrop="wide.jpg" images={["a.jpg"]} />);
    expect(html.match(/<image[^>]*href="wide.jpg"/g)).toHaveLength(1);
    expect(html).toMatch(/<clipPath id="[^"]*-backdrop">(<path [^>]*><\/path>){6}<\/clipPath>/);
    expect(html).not.toMatch(/<path d="[^"]*" fill=/);
    expect(html).toContain('href="a.jpg"'); // per-cell images still on top
  });
});

describe("matching children to tile shapes", () => {
  it("puts each child in a tile of similar shape", () => {
    // Herringbone: wide and tall bricks.
    const bricks = { region: { x: 0, y: 0, width: 400, height: 300 }, tiling: herringbone({ length: 80, width: 40 }), edges: "inside" as const };
    const html = renderToStaticMarkup(
      <TileLayout options={bricks} aspects={[0.5, 2, 0.5, 2]} choose="shape">
        <i>tall0</i>
        <i>wide1</i>
        <i>tall2</i>
        <i>wide3</i>
      </TileLayout>,
    );
    const placed = [...html.matchAll(/<div data-cell-id[^>]*width:([\d.]+)%;height:([\d.]+)%[^>]*><i>(\w+)<\/i>/g)];
    expect(placed).toHaveLength(4);
    for (const m of placed) {
      const w = Number(m[1]) * 4, h = Number(m[2]) * 3; // back to region units
      expect(m[3]!.startsWith("wide")).toBe(w > h);
    }
    expect(html.match(/<i>/g)).toHaveLength(4);
  });

  it("matches images in SVG with imageAspects", () => {
    const bricks = { region: { x: 0, y: 0, width: 400, height: 300 }, tiling: herringbone({ length: 80, width: 40 }), edges: "inside" as const };
    const html = renderToStaticMarkup(<SvgTileLayout options={bricks} images={["w.jpg", "t.jpg"]} imageAspects={[2, 0.5]} choose="shape" />);
    for (const m of html.matchAll(/<image href="(\w)\.jpg" x="[^"]*" y="[^"]*" width="([\d.]+)" height="([\d.]+)"/g)) {
      expect(m[1] === "w").toBe(Number(m[2]) > Number(m[3]));
    }
    expect(html.match(/<image /g)).toHaveLength(2);
  });
});

describe("<SvgTileLayout>", () => {
  it("renders cells with images", () => {
    const html = renderToStaticMarkup(<SvgTileLayout options={options} images={["a.jpg"]} title="Layout" />);
    expect(html).toContain('viewBox="0 0 300 200"');
    expect(html.match(/class="andamento-cell"/g)).toHaveLength(6);
    expect(html.match(/<image /g)).toHaveLength(1);
    expect(html).toContain("<title>Layout</title>");
  });

  it("supports custom SVG cell rendering", () => {
    const html = renderToStaticMarkup(
      <SvgTileLayout
        options={{ ...options, tiling: hexagonal({ size: 50 }) }}
        renderCell={(cell, ctx) => <SvgCellImage cell={cell} href={`p${cell.index}.jpg`} clipPath={ctx.clipPath} opacity={0.5} />}
      />,
    );
    expect(html).toContain('href="p0.jpg"');
    expect(html).toContain('opacity="0.5"');
    expect(html).not.toMatch(/<path d="[^"]*" fill=/);
  });

  it("places images with contentCells and placement, and marks empty and cut cells", () => {
    const cut = { region: { x: 0, y: 0, width: 250, height: 200 }, tiling: grid({ width: 100 }) };
    const html = renderToStaticMarkup(<SvgTileLayout options={cut} images={["a.jpg", "b.jpg", "c.jpg"]} contentCells="whole" />);
    const groups = [...html.matchAll(/<g class="andamento-cell"([^>]*)>(.*?)<\/g>/g)];
    expect(groups.map((g) => g[2]!.match(/href="(\w)\.jpg"/)?.[1] ?? "-")).toEqual(["a", "b", "-", "c", "-", "-"]);
    expect(groups.filter((g) => g[1]!.includes("data-boundary")).map((g) => g[1]!.match(/data-index="(\d)"/)![1])).toEqual(["2", "5"]);
    expect(groups.filter((g) => g[1]!.includes("data-empty"))).toHaveLength(3);
  });
});
