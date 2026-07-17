// Standalone Playwright script — exercises the REAL generated public/sw.js
// update lifecycle in Chromium, no Next server needed.
//
//   node tests/e2e/sw-update.spec.mjs
//
// It auto-detects the preinstalled Chromium under /opt/pw-browsers; override
// with CHROME_PATH=/path/to/chrome if needed.
//
// It serves the real service worker over http://127.0.0.1 (a secure context
// for SW purposes) and drives the exact flow UpdateNotice.tsx relies on. The
// driver reloads the page after swapping the served sw.js — precisely what
// happens in production when a user re-opens the app after a new deploy:
//   A1. first install → SW controls the page, NO "update available"
//   A2. new deploy (byte-different sw.js) → new SW parks in 'waiting',
//       "update available" is advertised while the old SW still controls
//   A3. posting {type:'SKIP_WAITING'} (what the Reload button does) →
//       new SW activates → controllerchange fires (the page-reload trigger)
//   A4. the activated SW owns the new-version cache; the old cache is purged
//   B1. re-open with identical sw.js bytes → NO false "update available"

import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Playwright's bundled browser build may differ from the one preinstalled in
// this environment. Prefer an explicit CHROME_PATH, else find the preinstalled
// Chromium under /opt/pw-browsers, else let Playwright resolve its own.
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = readdirSync(base).find((d) => d.startsWith("chromium-"));
    if (dir) {
      const exe = join(base, dir, "chrome-linux", "chrome");
      if (existsSync(exe)) return exe;
    }
  } catch {}
  return undefined;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

const REAL_SW = readFileSync(join(root, "public", "sw.js"), "utf8");
const CACHE_LINE = REAL_SW.match(/const CACHE_NAME = "([^"]+)";/);
if (!CACHE_LINE) {
  console.error("✗ could not find CACHE_NAME in public/sw.js — run scripts/build-sw.mjs first");
  process.exit(1);
}
const V1_CACHE = CACHE_LINE[1];
const V2_CACHE = `${V1_CACHE}-next`;
const SW_V1 = REAL_SW;
// A genuine byte change to the real SW — exactly what a new deploy produces.
const SW_V2 = REAL_SW.replace(V1_CACHE, V2_CACHE);

// Mutable: the bytes currently served at /sw.js.
let currentSw = SW_V1;

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>sw-test</title></head>
<body>
<script>
window.__updateAvailable = false;
window.__controllerChanged = false;
window.__waiting = null;
navigator.serviceWorker.addEventListener('controllerchange', () => { window.__controllerChanged = true; });
navigator.serviceWorker.register('/sw.js').then((reg) => {
  window.__reg = reg;
  // A SW already waiting from a previous visit (with something controlling us).
  if (reg.waiting && navigator.serviceWorker.controller) {
    window.__updateAvailable = true;
    window.__waiting = reg.waiting;
  }
  reg.addEventListener('updatefound', () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) {
        window.__updateAvailable = true;
        window.__waiting = reg.waiting || nw;
      }
    });
  });
});
window.__checkForUpdate = () => { try { window.__reg.update().catch(() => {}); } catch (e) {} };
</script>
</body></html>`;

const server = createServer((req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url === "/sw.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    res.end(currentSw);
    return;
  }
  // Serve 200 HTML for every other path so the real SW's install-time
  // cache.addAll(PRECACHE_URLS) (/,/dashboard,/explore,/learn,/offline) resolves.
  res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
  res.end(PAGE_HTML);
});

const results = [];
function record(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok });
}

const poll = (page, expr, timeout = 10000) =>
  page.waitForFunction(expr, null, { timeout, polling: 100 });

// Wait until the registration's active worker is fully activated & controlling.
async function waitControlled(page) {
  await poll(
    page,
    "() => navigator.serviceWorker.controller && window.__reg && window.__reg.active && window.__reg.active.state === 'activated'",
  );
}

async function run() {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const BASE = `http://127.0.0.1:${port}`;
  console.log(`\nsw-update E2E against ${BASE}`);
  console.log(`  v1 CACHE_NAME=${V1_CACHE}`);
  console.log(`  v2 CACHE_NAME=${V2_CACHE}\n`);

  const chromePath = resolveChrome();
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});

  // ---- Scenario A: install → new deploy → SKIP_WAITING → controllerchange ---
  {
    currentSw = SW_V1;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "load" });

    try {
      await waitControlled(page);
      record("A1a: first install activates & controls the page", true);
    } catch {
      record("A1a: first install activates & controls the page", false, "never controlled");
    }
    const falsePositive = await page.evaluate(() => window.__updateAvailable);
    record("A1b: no false 'update available' on first install", falsePositive === false,
      `updateAvailable=${falsePositive}`);

    // A new deploy ships byte-different sw.js. The app tab stays open (one
    // controlled client), so the browser's update check parks the new SW in
    // 'waiting' — it must NOT auto-activate while the old SW controls us.
    currentSw = SW_V2;
    try {
      // Retry the update check until the new SW is parked in 'waiting'.
      await page.waitForFunction(
        () => {
          window.__checkForUpdate();
          return window.__updateAvailable === true && !!window.__reg.waiting && !!navigator.serviceWorker.controller;
        },
        null,
        { timeout: 15000, polling: 300 },
      );
      record("A2: new deploy → update advertised, old SW still controls", true);
    } catch {
      const s = await page.evaluate(() => ({
        upd: window.__updateAvailable,
        waiting: window.__reg?.waiting?.state ?? null,
        controller: !!navigator.serviceWorker.controller,
      }));
      record("A2: new deploy → update advertised, old SW still controls", false, JSON.stringify(s));
    }

    // The Reload button's action: tell the waiting SW to take over. Read the
    // waiting worker and post in a single evaluate to avoid cross-eval races.
    const posted = await page.evaluate(() => {
      const w = window.__reg.waiting || window.__waiting;
      window.__controllerChanged = false;
      if (!w) return { ok: false, regWaiting: window.__reg.waiting?.state ?? null, saved: window.__waiting?.state ?? null };
      w.postMessage({ type: "SKIP_WAITING" });
      return { ok: true, state: w.state };
    });
    if (!posted.ok) console.log("   [A3 diag]", JSON.stringify(posted));
    try {
      if (!posted.ok) throw new Error("no waiting worker to skip");
      await poll(page, "() => window.__controllerChanged === true");
      record("A3: SKIP_WAITING → new SW activates → controllerchange fires", true);
    } catch {
      record("A3: SKIP_WAITING → new SW activates → controllerchange fires", false, "no controllerchange");
    }

    // controllerchange is what UpdateNotice.tsx turns into location.reload();
    // after it, the new-version cache must be the live one and v1 purged.
    try {
      await poll(page, `() => caches.keys().then(ks => ks.includes('${V2_CACHE}') && !ks.includes('${V1_CACHE}'))`);
      record("A4: activated SW owns new cache, old cache purged", true);
    } catch {
      const ks = await page.evaluate(() => caches.keys());
      record("A4: activated SW owns new cache, old cache purged", false, JSON.stringify(ks));
    }

    await ctx.close();
  }

  // ---- Scenario B: identical bytes on re-open → NO false update ------------
  {
    currentSw = SW_V1;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "load" });
    await waitControlled(page).catch(() => {});

    // Re-open with the SAME sw.js (no deploy happened).
    currentSw = SW_V1;
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2000);
    const advertised = await page.evaluate(() => window.__updateAvailable);
    record("B1: re-open with identical sw.js → no update advertised", advertised === false,
      `updateAvailable=${advertised}`);

    await ctx.close();
  }

  await browser.close();
  await new Promise((r) => server.close(r));

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("unexpected error:", e);
  process.exit(1);
});
