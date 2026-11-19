import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Point straight at library sources so edits hot-reload without a build step.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@andamento/core": src("core/src/index.ts"),
      "@andamento/svg": src("svg/src/index.ts"),
      "@andamento/dom": src("dom/src/index.ts"),
      "@andamento/react": src("react/src/index.tsx"),
      "@andamento/vue": src("vue/src/index.ts"),
    },
  },
  // Vue's bundler build reads these flags.
  define: { __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
  server: { port: 5173 },
});
