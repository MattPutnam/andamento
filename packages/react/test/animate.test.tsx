// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { grid, hexagonal, type LayoutOptions } from "@andamento/core";
import { TileLayout } from "@andamento/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const region = { x: 0, y: 0, width: 300, height: 200 };
const gridOptions: LayoutOptions = { region, tiling: grid({ width: 100 }) };
let root: Root | undefined;
let host: HTMLDivElement | undefined;

const render = (options: LayoutOptions, items: string[], animate: boolean | { duration: number } = { duration: 300 }) =>
  act(() => {
    root!.render(
      <TileLayout options={options} animate={animate}>
        {items.map((k) => (
          <b key={k}>{k}</b>
        ))}
      </TileLayout>,
    );
  });
const tiles = () => [...host!.querySelectorAll<HTMLDivElement>("[data-andamento]>[data-cell-id]")];
const tileOf = (text: string) => tiles().find((t) => t.textContent === text && !t.hasAttribute("data-exiting"))!;
const points = (t: HTMLElement) => t.style.clipPath.split(",").length;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.useRealTimers();
});

function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
}

describe("animate", () => {
  it("transitions each tile's box and shape, with morphable clip paths", () => {
    mount();
    render(gridOptions, ["a", "b"]);
    const a = tileOf("a");
    expect(a.style.transition).toContain("left 300ms");
    expect(a.style.transition).toContain("clip-path 300ms");
    expect(points(a)).toBe(72);
    // Nothing animates in on first render.
    expect(tiles().some((t) => t.hasAttribute("data-entering"))).toBe(false);
    expect(host!.querySelector("style")!.textContent).toContain("prefers-reduced-motion");
  });

  it("keeps a child's element as it moves to another tiling", () => {
    mount();
    render(gridOptions, ["a", "b"]);
    const before = tileOf("a");
    const clip = before.style.clipPath;
    render({ region, tiling: hexagonal({ size: 40 }) }, ["a", "b"]);
    const after = tileOf("a");
    expect(after).toBe(before); // same DOM node: CSS transitions from the old place and shape
    expect(points(after)).toBe(72);
    expect(after.style.clipPath).not.toBe(clip); // a square becoming a hexagon
  });

  it("fades new tiles in and removed tiles out", () => {
    vi.useFakeTimers();
    mount();
    render(gridOptions, ["a", "b"]);
    render(gridOptions, ["a", "c"]);
    expect(tileOf("c").hasAttribute("data-entering")).toBe(true);
    expect(tileOf("a").hasAttribute("data-entering")).toBe(false);
    const gone = tiles().find((t) => t.textContent === "b")!;
    expect(gone.hasAttribute("data-exiting")).toBe(true);
    expect(gone.getAttribute("aria-hidden")).toBe("true");
    // It fades out through the style sheet's [data-exiting] rule.
    expect(gone.parentElement!.querySelector("style")!.textContent).toMatch(/\[data-exiting\]\{animation:andamento-exit 300ms [^}]*pointer-events:none/);
    act(() => vi.advanceTimersByTime(299));
    expect(tiles().some((t) => t.textContent === "b")).toBe(true);
    act(() => vi.advanceTimersByTime(2));
    expect(tiles().some((t) => t.textContent === "b")).toBe(false);
    // The entering mark stays (removing it would cut the animation short).
    render(gridOptions, ["a", "c"]);
    expect(tileOf("c").hasAttribute("data-entering")).toBe(true);
  });

  it("brings a leaving child straight back", () => {
    vi.useFakeTimers();
    mount();
    render(gridOptions, ["a", "b"]);
    render(gridOptions, ["a"]);
    render(gridOptions, ["a", "b"]);
    const bs = tiles().filter((t) => t.textContent === "b");
    expect(bs).toHaveLength(1);
    expect(bs[0]!.hasAttribute("data-exiting")).toBe(false);
  });

  it("changes nothing when off", () => {
    mount();
    render(gridOptions, ["a"], false);
    expect(tileOf("a").style.transition).toBe("");
    expect(points(tileOf("a"))).toBe(4);
  });
});
