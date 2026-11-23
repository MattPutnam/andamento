import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string, entry = "index") => fileURLToPath(new URL(`./packages/${pkg}/src/${entry}.${pkg === "react" ? "tsx" : "ts"}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      ...["core", "svg", "dom"].map((p) => ({ find: `@andamento/${p}/internal`, replacement: src(p, "internal") })),
      ...["core", "svg", "dom", "react", "vue"].map((p) => ({ find: new RegExp(`^@andamento/${p}$`), replacement: src(p) })),
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
  },
});
