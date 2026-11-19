/**
 * Renders the manual's example pictures: every function exported from docs/examples/*.ts
 * that takes no arguments is called, and what it returns is written to docs/public/examples:
 * an SVG string as `<file>.svg` (`<file>-<export>.svg` for named exports), or an object of
 * SVG strings as `<file>-<key>.svg`. The manual shows the same files as code, so every
 * picture comes with the code that drew it.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "examples");
const out = join(root, "public", "examples");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let count = 0;
const written = new Set<string>();
const write = (name: string, svg: string) => {
  if (written.has(name)) throw new Error(`Two examples are both named ${name}`);
  written.add(name);
  writeFileSync(join(out, `${name}.svg`), svg);
  count++;
};

const started = performance.now();
for (const file of readdirSync(src).filter((f) => f.endsWith(".ts")).sort()) {
  const mod = (await import(join(src, file))) as Record<string, unknown>;
  const base = basename(file, ".ts");
  for (const [key, value] of Object.entries(mod)) {
    if (typeof value !== "function" || value.length > 0 || /^[A-Z]/.test(key)) continue;
    const result = (value as () => unknown)();
    const name = key === "default" ? base : `${base}-${key}`;
    if (typeof result === "string" && result.startsWith("<svg")) write(name, result);
    else if (result && typeof result === "object") {
      for (const [k, svg] of Object.entries(result)) if (typeof svg === "string" && svg.startsWith("<svg")) write(`${base}-${k}`, svg);
    }
  }
}
console.log(`Wrote ${count} example pictures in ${Math.round(performance.now() - started)} ms`);
