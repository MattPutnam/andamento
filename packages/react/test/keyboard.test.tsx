// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { grid, type Cell } from "@andamento/core";
import { TileLayout, type TileLayoutProps } from "@andamento/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 3 x 2 grid: reading order 0 1 2 / 3 4 5.
const options = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }) };
let root: Root | undefined;
let host: HTMLDivElement | undefined;

function mount(props: Partial<TileLayoutProps>, count = 6) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <TileLayout options={options} navigable {...props}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i}>item {i}</span>
        ))}
      </TileLayout>,
    );
  });
  return [...host.querySelectorAll<HTMLDivElement>("[data-cell-id]")];
}

const press = (el: Element, key: string) => {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(e);
  });
  return e;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("keyboard navigation", () => {
  it("is one tab stop, moved by the arrow keys", () => {
    const tiles = mount({});
    expect(tiles.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    act(() => tiles[0]!.focus());
    press(tiles[0]!, "ArrowRight");
    expect(document.activeElement).toBe(tiles[1]);
    expect(tiles.map((t) => t.tabIndex)).toEqual([-1, 0, -1, -1, -1, -1]);
    press(tiles[1]!, "ArrowDown");
    expect(document.activeElement).toBe(tiles[4]);
    press(tiles[4]!, "End");
    expect(document.activeElement).toBe(tiles[5]);
    press(tiles[5]!, "Home");
    expect(document.activeElement).toBe(tiles[0]);
    // At the edge: focus stays, but the page doesn't scroll.
    const e = press(tiles[0]!, "ArrowLeft");
    expect(document.activeElement).toBe(tiles[0]);
    expect(e.defaultPrevented).toBe(true);
  });

  it("skips empty tiles, which are hidden from assistive technology", () => {
    const tiles = mount({ placement: "spread" }, 2);
    const full = tiles.filter((t) => !t.hasAttribute("data-empty"));
    const empty = tiles.filter((t) => t.hasAttribute("data-empty"));
    expect(full).toHaveLength(2);
    for (const t of empty) {
      expect(t.getAttribute("aria-hidden")).toBe("true");
      expect(t.hasAttribute("tabindex")).toBe(false);
      expect(t.querySelector("[data-focus-ring]")).toBeNull();
    }
    for (const t of full) expect(t.getAttribute("role")).toBe("listitem");
    act(() => full[0]!.focus());
    press(full[0]!, "End");
    expect(document.activeElement).toBe(full[1]);
  });

  it("activates tiles with Enter, Space and clicks", () => {
    const onCellActivate = vi.fn<(cell: Cell, state: { slot: number }) => void>();
    const tiles = mount({ onCellActivate }, 3);
    act(() => tiles[1]!.focus());
    press(tiles[1]!, "Enter");
    press(tiles[1]!, " ");
    act(() => tiles[2]!.click());
    expect(onCellActivate.mock.calls.map(([c, s]) => [c.index, s.slot])).toEqual([[1, 1], [1, 1], [2, 2]]);
    // Empty tiles do nothing.
    act(() => tiles[4]!.click());
    expect(onCellActivate).toHaveBeenCalledTimes(3);
  });

  it("leaves keys alone inside a tile's own controls", () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <TileLayout options={options} navigable>
          <input aria-label="name" />
          <span>b</span>
        </TileLayout>,
      );
    });
    const input = host.querySelector("input")!;
    act(() => input.focus());
    const e = press(input, "ArrowRight");
    expect(e.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it("labels tiles and lets you replace the focus ring", () => {
    let tiles = mount({ cellLabel: (_c, s) => `Photo ${s.slot + 1}` }, 2);
    expect(tiles[0]!.getAttribute("aria-label")).toBe("Photo 1");
    expect(host!.querySelector("[data-andamento]")!.getAttribute("role")).toBe("list");
    expect(tiles[0]!.querySelectorAll("[data-focus-ring] path")[1]!.getAttribute("stroke")).toBe("#1a56db");
    act(() => root!.unmount());
    host!.remove();
    tiles = mount({ focusRing: false, role: "group" }, 2);
    expect(host!.querySelector("[data-focus-ring]")).toBeNull();
    expect(tiles[0]!.hasAttribute("role")).toBe(false);
  });

  it("without navigable, tiles aren't focusable", () => {
    const tiles = mount({ navigable: false });
    expect(tiles.every((t) => !t.hasAttribute("tabindex"))).toBe(true);
    expect(host!.querySelector("style")).toBeNull();
  });
});
