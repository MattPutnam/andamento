import { createLayout, herringbone } from "@andamento/core";
import { renderToString } from "@andamento/svg";

export default function quickstart() {
  const layout = createLayout({
    region: { x: 0, y: 0, width: 240, height: 150 },
    tiling: herringbone({ length: 60, width: 20 }),
    gap: 2,
    margin: 4,
    cornerRadius: 2,
  });
  return renderToString(layout, {
    fill: ["#e9c46a", "#f4a261", "#e76f51", "#2a9d8f"],
    background: "#264653",
  });
}
