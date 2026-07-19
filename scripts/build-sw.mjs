// Generates public/sw.js from scripts/sw.template.js by substituting
// __BUILD_VERSION__ with the current git SHA (or VERCEL_GIT_COMMIT_SHA on
// Vercel). Runs automatically via npm "predev" and "prebuild" hooks so
// every deploy ships a fresh CACHE_NAME that invalidates the previous one.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Keep in sync with resolveBuildVersion() in next.config.ts — UpdateNotice.tsx
// compares the two values to decide whether the page is stale.
function resolveVersion() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8);
  }
  try {
    return execSync("git rev-parse --short=8 HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
}

const version = resolveVersion();
const templatePath = join(root, "scripts", "sw.template.js");
const outPath = join(root, "public", "sw.js");

const template = readFileSync(templatePath, "utf8");
const generated = template.replaceAll("__BUILD_VERSION__", version);
writeFileSync(outPath, generated);

console.log(`[build-sw] public/sw.js generated with version: ${version}`);
