import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.${pkg === "react" ? "tsx" : "ts"}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@andamento/core": src("core"),
      "@andamento/svg": src("svg"),
      "@andamento/react": src("react"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
  },
});
