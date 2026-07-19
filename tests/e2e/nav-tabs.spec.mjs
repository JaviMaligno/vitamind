// Standalone Playwright script — verifies the 4-tab bottom navigation and the
// slimmed-down Explore page on the REAL app:
//
//   A. The bottom tab bar shows FOUR tabs (Mi día · Explorar · Guía · Perfil)
//      and tapping "Guía" navigates to /learn.
//   B. Explore (with a saved city) shows the compact lab header, NOT the old
//      status poster, and no longer embeds the FAQ card grid (the Guía tab in
//      the bottom bar is the direct entry now).
//   C. The visualization window is tinted by the live solar phase (PhaseWindow)
//      instead of the old fixed navy — its background must be one of the four
//      --window-* phase colours.
//   D. Dashboard and Profile no longer render the generic "learn more" glass
//      row (redundant with the tab); the contextual deep links remain (checked
//      via Profile's tip panel link to /learn).
//   E. Explore without a saved location shows the first-run poster prompt.
//
// Needs a running server (production build or dev):
//
//   npm run build && npx next start -p 3111 &
//   BASE_URL=http://127.0.0.1:3111 node tests/e2e/nav-tabs.spec.mjs
//
// Auto-detects the preinstalled Chromium under /opt/pw-browsers; override with
// CHROME_PATH=/path/to/chrome if needed.

import { chromium } from "@playwright/test";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  console.error("✗ BASE_URL is required, e.g. BASE_URL=http://127.0.0.1:3111");
  process.exit(1);
}

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

// es locale (default, unprefixed) copy — the strings the UI renders.
const TAB_LABELS = ["Mi día", "Explorar", "Guía", "Perfil"];
const FAQ_HEADING = "Preguntas frecuentes";
const GENERIC_LEARN_ROW = "Más sobre vitamina D y el sol";
const WHERE_ARE_YOU = "¿Dónde estás?";

const results = [];
function record(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok });
}

async function run() {
  console.log(`\nnav-tabs E2E against ${BASE_URL}\n`);

  const chromePath = resolveChrome();
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "es-ES",
  });

  // ---- A + B + C + D: with a saved city (Madrid) ----
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "vitamind:preferences",
        JSON.stringify({ threshold: 45, lastCityId: "builtin:madrid" }),
      );
    } catch {}
  });

  // A. bottom bar: four tabs, in order. (domcontentloaded, not networkidle:
  // the dashboard keeps weather/Supabase requests in flight.)
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  const nav = page.locator("nav.fixed.bottom-0");
  await nav.waitFor({ state: "visible", timeout: 15000 });
  const labels = await nav.locator("a span").allInnerTexts();
  record(
    "bottom bar shows the 4 tabs in order",
    JSON.stringify(labels) === JSON.stringify(TAB_LABELS),
    `got [${labels.join(", ")}]`,
  );

  const learnTab = nav.locator("a", { hasText: "Guía" });
  record("Guía tab links to /learn", (await learnTab.getAttribute("href")) === "/learn");
  await learnTab.click();
  await page.waitForURL("**/learn", { timeout: 15000 });
  record("tapping Guía lands on /learn", page.url().replace(/\/$/, "").endsWith("/learn"));

  // D (dashboard part). The generic always-visible learn row is gone. Wait for
  // the mounted content (the saved city's name) before asserting absence.
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByText("Madrid").first().waitFor({ timeout: 15000 });
  record(
    "dashboard has no generic learn-more row",
    (await page.getByText(GENERIC_LEARN_ROW).count()) === 0,
  );

  // D (profile part): generic row gone, contextual tip link still works.
  await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 3, name: /perfil solar/i }).waitFor({ timeout: 15000 });
  record(
    "profile has no generic learn-more row",
    (await page.locator(`a:has-text("${GENERIC_LEARN_ROW}")`).count()) === 0,
  );
  // The Info tip button next to "Perfil solar" opens the panel with a /learn link.
  await page.locator(`button[aria-label="${GENERIC_LEARN_ROW}"]`).first().click();
  const tipLink = page.locator(`a[href="/learn"]:has-text("${GENERIC_LEARN_ROW}")`);
  record("profile tip panel keeps its contextual /learn link", (await tipLink.count()) === 1);

  // B. Explore: lab header, no FAQ grid, no status poster.
  await page.goto(`${BASE_URL}/explore`, { waitUntil: "domcontentloaded" });
  const labHeader = page.getByRole("heading", { level: 1, name: "Explorar" });
  await labHeader.waitFor({ timeout: 15000 });
  record("explore shows the compact lab header", await labHeader.isVisible());
  record(
    "explore no longer embeds the FAQ card grid",
    (await page.getByText(FAQ_HEADING).count()) === 0,
  );
  record(
    "explore no longer shows the first-run poster when a city is saved",
    (await page.getByText(WHERE_ARE_YOU).count()) === 0,
  );

  // C. Phase tint: the viz window's background must be one of the four
  // phase colours (resolved from the --window-* custom properties), i.e. it
  // follows the live solar phase rather than the old fixed navy default.
  const vizWindow = page.getByTestId("viz-window");
  await vizWindow.waitFor({ timeout: 15000 });
  const tint = await vizWindow.evaluate((el) => {
    const rs = getComputedStyle(document.documentElement);
    const resolve = (v) => {
      const probe = document.createElement("div");
      probe.style.color = rs.getPropertyValue(v).trim();
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    return {
      bg: getComputedStyle(el).backgroundColor,
      phases: {
        dawn: resolve("--window-dawn"),
        day: resolve("--window-day"),
        dusk: resolve("--window-dusk"),
        night: resolve("--window-night"),
      },
    };
  });
  const matched = Object.entries(tint.phases).find(([, c]) => c === tint.bg);
  record(
    "viz window is tinted by a solar phase colour",
    Boolean(matched),
    matched ? `phase=${matched[0]} (${tint.bg})` : `bg=${tint.bg} not in ${JSON.stringify(tint.phases)}`,
  );

  await page.close();

  // ---- E: first run (no saved location) — a FRESH context, because the
  // localStorage written above persists per-origin within a context. ----
  const freshCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-ES" });
  const fresh = await freshCtx.newPage();
  await fresh.goto(`${BASE_URL}/explore`, { waitUntil: "domcontentloaded" });
  await fresh.getByRole("heading", { level: 1, name: WHERE_ARE_YOU }).waitFor({ timeout: 15000 });
  record("explore without a location shows the first-run poster", true);
  await freshCtx.close();

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((err) => {
  console.error("✗ crashed:", err);
  process.exit(1);
});
