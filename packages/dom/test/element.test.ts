// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { grid } from "@andamento/core";
import { defineTileLayoutElement, type AndamentoLayoutElement, type CellActivateDetail } from "@andamento/dom";

defineTileLayoutElement();
const options = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100 }) };
const tick = () => new Promise((r) => setTimeout(r, 0));
let el: AndamentoLayoutElement;

async function make(html: string, setup?: (el: AndamentoLayoutElement) => void) {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  el = wrap.firstElementChild as AndamentoLayoutElement;
  setup?.(el);
  document.body.appendChild(el);
  await tick();
  return el;
}
const tiles = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>("[data-andamento] > [data-cell-id]")];
/** The child shown in a tile: the one assigned to the tile's slot. */
const shownIn = (tile: Element) => (tile.querySelector("slot") as HTMLSlotElement | null)?.assignedElements()[0];

afterEach(() => el?.remove());

describe("<andamento-layout>", () => {
  it("shows each child in a tile, from JSON options", async () => {
    await make(`<andamento-layout options='${JSON.stringify(options)}' label="Photos"><b>one</b><b>two</b><b>three</b></andamento-layout>`);
    const t = tiles();
    expect(t).toHaveLength(6);
    expect(shownIn(t[0]!)!.textContent).toBe("one");
    expect(shownIn(t[2]!)!.textContent).toBe("three");
    expect(shownIn(t[3]!)).toBeUndefined();
    // Children stay where they are, in the light DOM.
    expect(el.children).toHaveLength(3);
    expect(el.shadowRoot!.querySelector("[data-andamento]")!.getAttribute("aria-label")).toBe("Photos");
    expect(t[0]!.getAttribute("part")).toBe("tile");
    expect(t[3]!.getAttribute("part")).toBe("tile empty");
  });

  it("takes options and other settings as properties", async () => {
    await make(`<andamento-layout><i>a</i></andamento-layout>`, (e) => {
      e.options = options;
      e.fill = "#00ff00";
    });
    expect(tiles()).toHaveLength(6);
    expect(tiles()[1]!.style.getPropertyValue("background")).toContain("rgb(0, 255, 0)");
    el.options = { ...options, tiling: grid({ width: 150, height: 200 }) };
    await tick();
    expect(tiles()).toHaveLength(2);
    expect(el.layout!.cells).toHaveLength(2);
  });

  it("re-renders when children change", async () => {
    await make(`<andamento-layout options='${JSON.stringify(options)}'><i>a</i></andamento-layout>`);
    const first = tiles()[0]!;
    const b = document.createElement("i");
    b.textContent = "b";
    el.prepend(b);
    await tick();
    expect(shownIn(tiles()[0]!)).toBe(b);
    // "a" kept its tile element, now the second tile.
    expect(tiles()[1]).toBe(first);
    expect(shownIn(first)!.textContent).toBe("a");
  });

  it("uses children's data-aspect to pick tiles by shape", async () => {
    const bricks = { region: { x: 0, y: 0, width: 300, height: 200 }, tiling: grid({ width: 100, height: 50 }) };
    await make(`<andamento-layout options='${JSON.stringify(bricks)}' choose="shape"><i data-aspect="2">wide</i></andamento-layout>`);
    expect(tiles().some((t) => shownIn(t)?.textContent === "wide")).toBe(true);
  });

  it("copies a backdrop child into every tile", async () => {
    await make(`<andamento-layout options='${JSON.stringify(options)}'><img slot="backdrop" src="pic.jpg"><i>a</i></andamento-layout>`);
    const t = tiles();
    expect(t).toHaveLength(6);
    for (const tile of t) expect(tile.querySelector("img")!.style.getPropertyValue("object-fit")).toBe("cover");
    expect(shownIn(t[0]!)!.textContent).toBe("a");
  });

  it("reads boolean attributes and fires cellactivate", async () => {
    await make(`<andamento-layout options='${JSON.stringify(options)}' navigable relief><i>a</i><i>b</i></andamento-layout>`);
    const on = vi.fn((e: CustomEvent<CellActivateDetail>) => e.detail);
    el.addEventListener("cellactivate", on);
    const t = tiles();
    expect(t[0]!.tabIndex).toBe(0);
    expect(t[0]!.querySelector("[data-bevel]")).not.toBeNull();
    t[0]!.focus();
    t[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    expect(el.shadowRoot!.activeElement).toBe(t[1]);
    t[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(on).toHaveBeenCalledTimes(1);
    const detail = on.mock.results[0]!.value;
    expect(detail.slot).toBe(1);
    expect(detail.item).toBe(el.children[1]);
    // A click on a child (in the light DOM) activates its tile.
    (el.children[0] as HTMLElement).click();
    expect(on).toHaveBeenCalledTimes(2);
    expect(on.mock.results[1]!.value.slot).toBe(0);
    el.removeAttribute("navigable");
    await tick();
    expect(tiles()[0]!.hasAttribute("tabindex")).toBe(false);
  });

  it("can be registered under another name, and more than once", () => {
    const a = defineTileLayoutElement("my-tiles");
    expect(defineTileLayoutElement("my-tiles")).toBe(a);
    expect(customElements.get("my-tiles")).toBe(a);
  });

  it("cleans up when removed and renders again when put back", async () => {
    await make(`<andamento-layout options='${JSON.stringify(options)}'><i>a</i></andamento-layout>`);
    el.remove();
    expect(el.shadowRoot!.querySelector("[data-andamento]")).toBeNull();
    document.body.appendChild(el);
    await tick();
    expect(tiles()).toHaveLength(6);
  });
});
