import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/internal.ts"],
  // One copy of shared module state (caches) whichever entry loads it, in CommonJS too.
  splitting: true,
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
