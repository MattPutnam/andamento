// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { grid, hexagonal } from "@andamento/core";
import { mountTileLayout, type TileLayoutConfig, type TileLayoutHandle } from "@andamento/dom";

// 3 x 2 grid: reading order 0 1 2 / 3 4 5.
const options = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }) };
let handle: TileLayoutHandle | undefined;
let host: HTMLDivElement;

const items = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const s = document.createElement("span");
    s.textContent = `item ${i}`;
    return s;
  });

function mount(config: Partial<TileLayoutConfig> = {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  handle = mountTileLayout(host, { options, ...config });
  return handle;
}
const tiles = () => [...host.querySelectorAll<HTMLDivElement>("[data-andamento] > [data-cell-id]")];
const press = (el: Element, key: string) => {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  host?.remove();
  vi.useRealTimers();
});

describe("mountTileLayout", () => {
  it("puts each item in a clipped tile, in reading order", () => {
    const nodes = items(6);
    mount({ items: nodes });
    const el = host.querySelector<HTMLElement>("[data-andamento]")!;
    expect(el.getAttribute("role")).toBe("list");
    expect(el.style.getPropertyValue("aspect-ratio")).toBe("300 / 200");
    const t = tiles();
    expect(t).toHaveLength(6);
    expect(t.map((x) => x.textContent)).toEqual(nodes.map((n) => n.textContent));
    expect(t[0]!.firstChild).toBe(nodes[0]);
    expect(t[0]!.style.getPropertyValue("position")).toBe("absolute");
    expect(t[0]!.style.getPropertyValue("clip-path")).toMatch(/^polygon\(/);
    expect(t[0]!.getAttribute("role")).toBe("listitem");
  });

  it("fills empty tiles and hides them from assistive technology", () => {
    mount({ items: items(2), fill: "#123456" });
    const t = tiles();
    expect(t[1]!.hasAttribute("data-empty")).toBe(false);
    expect(t[2]!.hasAttribute("data-empty")).toBe(true);
    expect(t[2]!.getAttribute("aria-hidden")).toBe("true");
    expect(t[2]!.style.getPropertyValue("background")).toContain("rgb(18, 52, 86)");
  });

  it("keeps an item's node as the layout changes", () => {
    const nodes = items(3);
    mount({ items: nodes });
    const before = nodes[1]!.parentElement;
    handle!.update({ options: { ...options, tiling: hexagonal({ size: 40 }) } });
    expect(nodes[1]!.isConnected).toBe(true);
    // Same tile element, moved and reshaped.
    expect(nodes[1]!.parentElement).toBe(before);
    expect(handle!.layout.cells.length).toBeGreaterThan(6);
  });

  it("follows items when they're reordered", () => {
    const nodes = items(3);
    mount({ items: nodes });
    const tileOf = (n: Node) => n.parentElement!;
    const t0 = tileOf(nodes[0]!);
    handle!.update({ items: [nodes[2]!, nodes[1]!, nodes[0]!] });
    expect(tileOf(nodes[0]!)).toBe(t0);
    expect(t0.getAttribute("data-index")).toBe("2");
    expect(tiles()[0]!.firstChild).toBe(nodes[2]);
  });

  it("renders text items and renderCell content", () => {
    mount({ items: ["a", "b"] });
    expect(tiles().slice(0, 2).map((t) => t.textContent)).toEqual(["a", "b"]);
    handle!.update({ renderCell: (cell) => `cell ${cell.index}` });
    expect(tiles().map((t) => t.textContent)).toEqual(["cell 0", "cell 1", "cell 2", "cell 3", "cell 4", "cell 5"]);
  });

  it("puts content in a safe-area box", () => {
    mount({ items: items(1), safeArea: true });
    const box = tiles()[0]!.querySelector<HTMLElement>("[data-safe-area]")!;
    expect(box.textContent).toBe("item 0");
    expect(box.style.getPropertyValue("left")).toMatch(/%$/);
  });

  it("copies the backdrop into every tile, behind the content", () => {
    const img = document.createElement("img");
    img.src = "pic.jpg";
    mount({ items: items(1), backdrop: img });
    for (const t of tiles()) {
      const b = t.firstElementChild as HTMLElement;
      expect(b.getAttribute("aria-hidden")).toBe("true");
      expect(b.querySelector("img")!.getAttribute("src")).toBe("pic.jpg");
      expect(b.style.getPropertyValue("z-index")).toBe("-1");
      expect(t.style.getPropertyValue("background")).toBe("");
    }
  });

  it("draws relief, a background and a shadow", () => {
    mount({ items: items(6), relief: { shadow: true }, background: "#222" });
    expect(tiles()[0]!.querySelector("[data-bevel] path")).not.toBeNull();
    expect(host.querySelector("[data-andamento-shadow] path")!.getAttribute("d")).toMatch(/^M/);
    const bg = host.querySelector<HTMLElement>("[data-andamento] > div[aria-hidden]")!;
    expect(bg.style.getPropertyValue("clip-path")).toMatch(/^polygon/);
  });

  it("adds per-cell classes, styles and attributes", () => {
    mount({
      items: items(6),
      cellClass: (c) => `t${c.index}`,
      cellStyle: (c) => ({ "--n": c.index, color: "red" }),
      cellAttributes: { part: "tile" },
      cellLabel: (_c, s) => `Item ${s.slot + 1}`,
    });
    const t = tiles()[4]!;
    expect(t.className).toBe("t4");
    expect(t.style.getPropertyValue("--n")).toBe("4");
    expect(t.style.getPropertyValue("color")).toBe("red");
    expect(t.getAttribute("part")).toBe("tile");
    expect(t.getAttribute("aria-label")).toBe("Item 5");
  });

  it("calls onCellActivate on click, for tiles with content", () => {
    const on = vi.fn();
    const nodes = items(2);
    mount({ items: nodes, onCellActivate: on });
    nodes[1]!.click();
    tiles()[4]!.click();
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0]![0].index).toBe(1);
    expect(on.mock.calls[0]![1]).toEqual({ empty: false, slot: 1 });
  });

  it("moves focus with the arrow keys, as one tab stop", () => {
    const on = vi.fn();
    mount({ items: items(6), navigable: true, onCellActivate: on });
    const t = tiles();
    expect(t.map((x) => x.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    t[0]!.focus();
    expect(press(t[0]!, "ArrowRight").defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(t[1]);
    press(t[1]!, "ArrowDown");
    expect(document.activeElement).toBe(t[4]);
    expect(t.map((x) => x.tabIndex)).toEqual([-1, -1, -1, -1, 0, -1]);
    press(t[4]!, "End");
    expect(document.activeElement).toBe(t[5]);
    expect(press(t[5]!, "ArrowRight").defaultPrevented).toBe(true);
    press(t[5]!, "Enter");
    expect(on).toHaveBeenCalledWith(expect.objectContaining({ index: 5 }), { empty: false, slot: 5 });
    expect(t[5]!.querySelector("[data-focus-ring]")).not.toBeNull();
    // Keys inside a tile's content aren't ours.
    const inner = t[5]!.firstChild as HTMLElement;
    expect(press(inner, "ArrowLeft").defaultPrevented).toBe(false);
  });

  it("skips empty tiles when navigating", () => {
    mount({ items: [items(1)[0]!, null, items(1)[0]!], navigable: true });
    const t = tiles();
    t[0]!.focus();
    press(t[0]!, "ArrowRight");
    expect(document.activeElement).toBe(t[2]);
    expect(t[1]!.hasAttribute("tabindex")).toBe(false);
  });

  it("fades removed tiles out and new ones in when animating", () => {
    vi.useFakeTimers();
    const nodes = items(6);
    mount({ items: nodes, animate: { duration: 100 } });
    expect(tiles().some((t) => t.hasAttribute("data-entering"))).toBe(false);
    expect(tiles()[0]!.style.getPropertyValue("transition")).toContain("clip-path");
    // Six items into a 2 x 1 grid: four tiles go.
    handle!.update({ options: { ...options, tiling: grid({ width: 150, height: 200 }) }, items: nodes.slice(0, 2) });
    const exiting = host.querySelectorAll("[data-exiting]");
    expect(exiting).toHaveLength(4);
    expect(exiting[0]!.getAttribute("aria-hidden")).toBe("true");
    vi.advanceTimersByTime(150);
    expect(host.querySelectorAll("[data-exiting]")).toHaveLength(0);
    handle!.update({ items: nodes.slice(0, 1).concat(items(1)) });
    expect(tiles()[1]!.hasAttribute("data-entering")).toBe(true);
  });

  it("sizes tiles to the items with fit", () => {
    mount({ items: items(24), fit: true });
    expect(handle!.layout.cells.length).toBeGreaterThanOrEqual(24);
  });

  it("only mounts tiles in view with virtualize", async () => {
    const big = { region: { x: 0, y: 0, width: 1000, height: 10000 }, tiling: grid({ width: 100 }) };
    host = document.createElement("div");
    document.body.appendChild(host);
    const rect = (el: Element) =>
      el.hasAttribute("data-andamento") ? ({ left: 0, top: 0, right: 1000, bottom: 10000, width: 1000, height: 10000 } as DOMRect) : ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect);
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return rect(this);
    });
    Object.assign(window, { innerWidth: 1000, innerHeight: 800 });
    handle = mountTileLayout(host, { options: big, items: Array.from({ length: 1000 }, (_, i) => `n${i}`), virtualize: { overscan: 0 }, navigable: true });
    const count = tiles().length;
    expect(count).toBeGreaterThan(50);
    expect(count).toBeLessThan(200);
    expect(tiles()[0]!.getAttribute("aria-setsize")).toBe("1000");
    // End focuses the last tile, mounting it.
    const t = tiles()[0]!;
    t.focus();
    press(t, "End");
    expect((document.activeElement as HTMLElement).getAttribute("data-index")).toBe("999");
    spy.mockRestore();
  });

  it("takes items out again on destroy", () => {
    const nodes = items(2);
    mount({ items: nodes });
    handle!.destroy();
    handle = undefined;
    expect(host.children).toHaveLength(0);
    expect(nodes[0]!.parentNode).toBeNull();
  });

  it("places window tiles whole and fits content to the tile or what shows", () => {
    const windowed = { region: { x: 0, y: 0, width: 250, height: 200 }, tiling: grid({ width: 100 }), edges: "window" as const };
    mount({ options: windowed, items: items(3), safeArea: true });
    const t = tiles()[2]!;
    expect(t.style.getPropertyValue("width")).toBe("40%");
    expect(t.querySelector<HTMLElement>("[data-safe-area]")!.style.getPropertyValue("width")).toBe("100%");
    handle!.update({ safeArea: "visible" });
    expect(tiles()[2]!.querySelector<HTMLElement>("[data-safe-area]")!.style.getPropertyValue("width")).toBe("50%");
  });

  it("keeps each item's focal point in view", () => {
    // Tall 50 x 200 tiles, wide photos.
    const tall = { region: { x: 0, y: 0, width: 100, height: 200 }, tiling: grid({ width: 50, height: 200 }) };
    mount({ options: tall, items: items(2), aspects: [2, 2], focalPoints: [{ x: 0.3, y: 0.5 }, undefined] });
    const t = tiles();
    expect(t[0]!.style.getPropertyValue("--andamento-object-position")).toBe("27.143% 50%");
    expect(t[1]!.style.getPropertyValue("--andamento-object-position")).toBe("");
    // Without the photo's shape, the focus as it is.
    handle!.update({ aspects: undefined });
    expect(tiles()[0]!.style.getPropertyValue("--andamento-object-position")).toBe("30% 50%");
  });
});
