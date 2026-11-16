import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { grid, hexagonal } from "@andamento/core";
import { SvgCellImage, SvgTileLayout, TileLayout, coverStyle } from "@andamento/react";

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
});
