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
      "@andamento/react": src("react/src/index.tsx"),
    },
  },
  server: { port: 5173 },
});
