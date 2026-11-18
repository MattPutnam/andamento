// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { grid, type LayoutOptions } from "@andamento/core";
import { TileLayout, type TileLayoutProps } from "@andamento/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 10 columns x 100 rows of 100-unit cells, shown 1000 px wide: one unit per pixel.
const options: LayoutOptions = { region: { x: 0, y: 0, width: 1000, height: 10000 }, tiling: grid({ width: 100 }) };
let scrollY = 0;
let root: Root | undefined;
let host: HTMLDivElement | undefined;
const realRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  scrollY = 0;
  Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.hasAttribute("data-andamento")) {
      const top = -scrollY;
      return { left: 0, top, width: 1000, height: 10000, right: 1000, bottom: top + 10000, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    }
    return realRect.call(this);
  };
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  HTMLElement.prototype.getBoundingClientRect = realRect;
});

const frame = () => act(() => new Promise<void>((r) => setTimeout(r, 40)));
async function mount(props: Partial<TileLayoutProps>, count = 1000) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <TileLayout options={options} virtualize={{ overscan: 100 }} {...props}>
        {props.renderCell ? undefined : Array.from({ length: count }, (_, i) => <span key={i}>{i}</span>)}
      </TileLayout>,
    );
  });
  await frame();
}
const mountedIndices = () => [...host!.querySelectorAll<HTMLElement>("[data-andamento]>[data-cell-id]")].map((t) => Number(t.dataset.index));
async function scrollTo(y: number) {
  scrollY = y;
  window.dispatchEvent(new Event("scroll"));
  await frame();
}

describe("virtualize", () => {
  it("mounts only the tiles in view, with list positions", async () => {
    await mount({});
    const shown = mountedIndices();
    // 800 px of view plus 100 px overscan below, snapped out to 50 px: rows 0-9.
    expect(shown.length).toBeGreaterThanOrEqual(90);
    expect(shown.length).toBeLessThanOrEqual(110);
    expect(shown).toContain(0);
    expect(shown).not.toContain(999);
    const first = host!.querySelector("[data-andamento]>[data-cell-id]")!;
    expect(first.getAttribute("aria-setsize")).toBe("1000");
    expect(first.getAttribute("aria-posinset")).toBe("1");
  });

  it("follows scrolling", async () => {
    await mount({});
    await scrollTo(5000);
    const shown = mountedIndices();
    expect(shown).not.toContain(0);
    expect(shown).toContain(500);
    expect(Math.min(...shown)).toBeGreaterThanOrEqual(480);
    expect(Math.max(...shown)).toBeLessThan(600);
    // Scrolled right out of view: nothing.
    await scrollTo(20000);
    expect(mountedIndices()).toEqual([]);
  });

  it("only calls renderCell for tiles in view", async () => {
    const seen = new Set<number>();
    await mount({ renderCell: (cell) => (seen.add(cell.index), <i>{cell.index}</i>) });
    expect(seen.size).toBeLessThan(150);
    expect(seen.has(999)).toBe(false);
  });

  it("keeps the tab stop mounted and reaches tiles out of view by keyboard", async () => {
    await mount({ navigable: true });
    await scrollTo(5000);
    expect(mountedIndices()).toContain(0); // the tab stop
    const first = host!.querySelector<HTMLElement>('[data-index="0"]')!;
    act(() => first.focus());
    act(() => {
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    });
    await frame();
    const last = host!.querySelector<HTMLElement>('[data-index="999"]');
    expect(last).not.toBeNull();
    expect(document.activeElement).toBe(last);
    expect(last!.tabIndex).toBe(0);
  });

  it("doesn't animate tiles scrolling in and out", async () => {
    await mount({ animate: { duration: 300 } });
    await scrollTo(3000);
    await scrollTo(0);
    expect(host!.querySelectorAll("[data-entering], [data-exiting]")).toHaveLength(0);
  });

  it("draws cast shadows for the mounted tiles only", async () => {
    await mount({ relief: { shadow: 2 } });
    const d = host!.querySelector("[data-andamento-shadow] path")!.getAttribute("d")!;
    expect(d.match(/M/g)!.length).toBe(mountedIndices().length);
  });
});
