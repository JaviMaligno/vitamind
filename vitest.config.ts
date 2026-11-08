import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**"],
    // Node 26 turns its own Web Storage on by default. Without
    // --localstorage-file its global `localStorage` is undefined, and because
    // it is already defined on globalThis, jsdom's working one is not copied
    // over it: every storage test failed with "Cannot read properties of
    // undefined (reading 'clear')". Off in the test workers only — the app
    // reads storage solely behind `typeof window` guards, so nothing at
    // runtime depends on it. The flag is accepted on Node 22 and 24 as well.
    execArgv: ["--no-experimental-webstorage"],
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
