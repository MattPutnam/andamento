// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, createSSRApp, defineComponent, h, nextTick, ref, type App } from "vue";
import { renderToString } from "vue/server-renderer";
import { grid, hexagonal } from "@andamento/core";
import { SvgTileLayout, TileLayout, useTileLayout } from "@andamento/vue";

// 3 x 2 grid: reading order 0 1 2 / 3 4 5.
const options = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }) };
let app: App | undefined;
let host: HTMLDivElement;

function mount(render: () => ReturnType<typeof h>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp(defineComponent({ render }));
  app.mount(host);
}
const tiles = () => [...host.querySelectorAll<HTMLDivElement>("[data-andamento] > [data-cell-id]")];
const press = (el: Element, key: string) => {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};
const items = (n: number) => Array.from({ length: n }, (_, i) => h("span", { key: i }, `item ${i}`));

afterEach(() => {
  app?.unmount();
  app = undefined;
  host?.remove();
  vi.useRealTimers();
});

describe("Vue <TileLayout>", () => {
  it("puts each child in a clipped tile, in reading order", () => {
    mount(() => h(TileLayout, { options, "aria-label": "Things" }, () => items(4)));
    const root = host.querySelector<HTMLElement>("[data-andamento]")!;
    expect(root.getAttribute("role")).toBe("list");
    expect(root.getAttribute("aria-label")).toBe("Things");
    expect(root.style.getPropertyValue("aspect-ratio")).toBe("300 / 200");
    const t = tiles();
    expect(t).toHaveLength(6);
    expect(t.map((x) => x.textContent)).toEqual(["item 0", "item 1", "item 2", "item 3", "", ""]);
    expect(t[0]!.style.getPropertyValue("clip-path")).toMatch(/^polygon\(/);
    expect(t[4]!.hasAttribute("data-empty")).toBe(true);
    expect(t[4]!.getAttribute("aria-hidden")).toBe("true");
  });

  it("counts v-for children one each and skips v-if comments", () => {
    // What a template's `<b v-if="false"/><i v-for=…/>` compiles to.
    mount(() => h(TileLayout, { options }, () => [null, h("b", "x"), [h("i", { key: "a" }, "a"), h("i", { key: "b" }, "b")]]));
    expect(tiles().map((t) => t.textContent).slice(0, 4)).toEqual(["x", "a", "b", ""]);
  });

  it("renders the cell slot in every tile, and fallback in empty ones", () => {
    mount(() => h(TileLayout, { options }, { cell: ({ cell, slot }: { cell: { index: number }; slot: number }) => `${cell.index}/${slot}` }));
    expect(tiles().map((t) => t.textContent)).toEqual(["0/0", "1/1", "2/2", "3/3", "4/4", "5/5"]);
    app!.unmount();
    mount(() => h(TileLayout, { options }, { default: () => items(1), fallback: ({ cell }: { cell: { index: number } }) => `empty ${cell.index}` }));
    expect(tiles()[1]!.textContent).toBe("empty 1");
  });

  it("keeps a child's element as the layout changes", async () => {
    const tiling = ref(grid({ width: 100 }));
    mount(() => h(TileLayout, { options: { ...options, tiling: tiling.value } }, () => items(3)));
    const span = tiles()[1]!.firstElementChild!;
    tiling.value = hexagonal({ size: 40 });
    await nextTick();
    expect(span.isConnected).toBe(true);
    expect(tiles().length).toBeGreaterThan(6);
  });

  it("emits cell-activate and moves focus with the arrow keys", async () => {
    const on = vi.fn();
    mount(() => h(TileLayout, { options, navigable: true, onCellActivate: on }, () => items(6)));
    let t = tiles();
    expect(t.map((x) => x.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    t[0]!.focus();
    expect(press(t[0]!, "ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(t[1]);
    await nextTick();
    t = tiles();
    expect(t.map((x) => x.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1]);
    press(t[1]!, "ArrowDown");
    expect(document.activeElement).toBe(t[4]);
    press(t[4]!, "Enter");
    expect(on).toHaveBeenCalledWith(expect.objectContaining({ index: 4 }), { empty: false, slot: 4 });
    t[2]!.click();
    expect(on).toHaveBeenLastCalledWith(expect.objectContaining({ index: 2 }), { empty: false, slot: 2 });
    expect(t[0]!.style.getPropertyValue("cursor")).toBe("pointer");
    expect(host.querySelector("style")!.textContent).toContain("focus-visible");
  });

  it("draws relief, background, backdrop and safe areas", () => {
    mount(() =>
      h(
        TileLayout,
        { options, relief: { shadow: true }, background: "#222", safeArea: true },
        { default: () => items(1), backdrop: () => h("img", { src: "pic.jpg" }) },
      ),
    );
    const t = tiles();
    expect(t[0]!.querySelector("[data-bevel] path")).not.toBeNull();
    expect(t[0]!.querySelector("[data-safe-area]")!.textContent).toBe("item 0");
    expect(t.every((x) => x.querySelector("img")?.getAttribute("src") === "pic.jpg")).toBe(true);
    expect(host.querySelector("[data-andamento-shadow] path")!.getAttribute("d")).toMatch(/^M/);
  });

  it("fades removed tiles out when animating", async () => {
    vi.useFakeTimers();
    const n = ref(6);
    mount(() => h(TileLayout, { options: { ...options, tiling: n.value === 6 ? grid({ width: 100 }) : grid({ width: 150, height: 200 }) }, animate: { duration: 100 } }, () => items(n.value)));
    expect(tiles()[0]!.style.getPropertyValue("transition")).toContain("clip-path");
    n.value = 2;
    await nextTick();
    expect(host.querySelectorAll("[data-exiting]")).toHaveLength(4);
    vi.advanceTimersByTime(150);
    await nextTick();
    expect(host.querySelectorAll("[data-exiting]")).toHaveLength(0);
    expect(tiles()).toHaveLength(2);
  });

  it("only mounts the tiles in view with virtualize", async () => {
    const big = { region: { x: 0, y: 0, width: 1000, height: 10000 }, tiling: grid({ width: 100 }) };
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return (this.hasAttribute("data-andamento") ? { left: 0, top: 0, right: 1000, bottom: 10000, width: 1000, height: 10000 } : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }) as DOMRect;
    });
    Object.assign(window, { innerWidth: 1000, innerHeight: 800 });
    mount(() => h(TileLayout, { options: big, virtualize: { overscan: 0 } }, { cell: ({ slot }: { slot: number }) => `n${slot}` }));
    await nextTick();
    const count = tiles().length;
    expect(count).toBeGreaterThan(50);
    expect(count).toBeLessThan(200);
    expect(tiles()[0]!.getAttribute("aria-setsize")).toBe("1000");
    spy.mockRestore();
  });

  it("renders on the server", async () => {
    const html = await renderToString(createSSRApp(defineComponent({ render: () => h(TileLayout, { options }, () => items(2)) })));
    expect(html).toContain("data-andamento");
    expect(html).toContain("clip-path:polygon(");
    expect(html).toContain("<span>item 1</span>");
  });
});

describe("Vue <SvgTileLayout>", () => {
  it("renders the same SVG as renderToString", async () => {
    mount(() => h(SvgTileLayout, { options, images: ["a.jpg"], stroke: "#000", title: "Grid" }));
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 200");
    expect(svg.querySelectorAll(".andamento-cell")).toHaveLength(6);
    expect(svg.querySelector("image")!.getAttribute("href")).toBe("a.jpg");
    expect(svg.querySelector("title")!.textContent).toBe("Grid");
  });

  it("sizes the tiles to the images with fit", () => {
    mount(() => h(SvgTileLayout, { options, images: Array.from({ length: 20 }, (_, i) => `${i}.jpg`), fit: true }));
    expect(host.querySelectorAll(".andamento-cell").length).toBeGreaterThanOrEqual(20);
  });
});

describe("useTileLayout", () => {
  it("recomputes only when the options change by value", async () => {
    const width = ref(100);
    let layout!: ReturnType<typeof useTileLayout>;
    mount(() => h("div"));
    app!.runWithContext(() => {
      layout = useTileLayout(() => ({ ...options, tiling: grid({ width: width.value }) }));
    });
    const first = layout.value;
    expect(first.cells).toHaveLength(6);
    width.value = 100;
    expect(layout.value).toBe(first);
    width.value = 150;
    expect(layout.value.cells.length).toBe(4);
  });
});

describe("TileLayout navigation with a cell slot", () => {
  it("doesn't make tiles the slot leaves empty focusable", () => {
    mount(() => h(TileLayout, { options, navigable: true }, { cell: ({ cell }: { cell: { index: number } }) => (cell.index % 2 ? [] : [h("span", `t${cell.index}`)]) }));
    const focusable = tiles().filter((t) => t.hasAttribute("tabindex")).map((t) => t.dataset.index);
    expect(focusable).toEqual(["0", "2", "4"]);
  });
});
