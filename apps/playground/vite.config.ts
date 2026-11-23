import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const src = (p: string) => fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

// Point straight at library sources so edits hot-reload without a build step.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      ...["core", "svg", "dom"].map((p) => ({ find: `@andamento/${p}/internal`, replacement: src(`${p}/src/internal.ts`) })),
      ...["core", "svg", "dom", "vue"].map((p) => ({ find: new RegExp(`^@andamento/${p}$`), replacement: src(`${p}/src/index.ts`) })),
      { find: /^@andamento\/react$/, replacement: src("react/src/index.tsx") },
    ],
  },
  // Vue's bundler build reads these flags.
  define: { __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
  server: { port: 5173 },
});
