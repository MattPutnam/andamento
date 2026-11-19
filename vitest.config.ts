import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.${pkg === "react" ? "tsx" : "ts"}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@andamento/core": src("core"),
      "@andamento/svg": src("svg"),
      "@andamento/dom": src("dom"),
      "@andamento/react": src("react"),
      "@andamento/vue": src("vue"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
  },
});
