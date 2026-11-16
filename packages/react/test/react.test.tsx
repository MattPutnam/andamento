import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { grid, hexagonal } from "@andamento/core";
import { CellImage, TileLayout } from "@andamento/react";

const options = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }), gap: 10 };

describe("<TileLayout>", () => {
  it("renders cells with photos", () => {
    const html = renderToStaticMarkup(<TileLayout options={options} images={["a.jpg"]} title="Wall" />);
    expect(html).toContain('viewBox="0 0 300 200"');
    expect(html.match(/class="andamento-cell"/g)).toHaveLength(6);
    expect(html.match(/<image /g)).toHaveLength(1);
    expect(html).toContain("<title>Wall</title>");
  });

  it("supports custom cell rendering", () => {
    const html = renderToStaticMarkup(
      <TileLayout
        options={{ ...options, tiling: hexagonal({ size: 50 }) }}
        renderCell={(cell, ctx) => <CellImage cell={cell} href={`p${cell.index}.jpg`} clipPath={ctx.clipPath} opacity={0.5} />}
      />,
    );
    expect(html).toContain('href="p0.jpg"');
    expect(html).toContain('opacity="0.5"');
    expect(html).not.toMatch(/<path d="[^"]*" fill=/);
  });
});
