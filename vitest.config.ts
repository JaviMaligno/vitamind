import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**"],
    server: {
      deps: {
        // Inline next-intl so Vite's resolver (which probes extensions) handles
        // its internal bare `next/navigation` import. Next 16 ships no `exports`
        // map, so Node's native ESM loader can't resolve it and the test crashes
        // at import time otherwise.
        inline: ["next-intl"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
