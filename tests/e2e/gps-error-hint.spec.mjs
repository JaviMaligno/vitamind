// Standalone Playwright script — verifies the GPS error pill behaviour on the
// REAL app (Profile page) with geolocation permission denied:
//
//   A. localStorage vitamind:useGps=true + permission denied → the silent
//      auto-request on mount must NOT surface the error pill (the reported
//      bug: an unsolicited, clipped pill on every page load).
//   B. Tapping the GPS button → the pill appears, fully inside the viewport
//      (it used to run off the left edge on Profile, where the button sits
//      near the left screen edge).
//   C. The pill's × button dismisses it.
//
// Needs a running server (production build or dev):
//
//   npm run build && npx next start -p 3111 &
//   BASE_URL=http://127.0.0.1:3111 node tests/e2e/gps-error-hint.spec.mjs
//
// Auto-detects the preinstalled Chromium under /opt/pw-browsers; override with
// CHROME_PATH=/path/to/chrome if needed. Headless Chromium leaves an
// ungranted geolocation request pending forever (neither callback fires), so
// navigator.geolocation is stubbed to fail with PERMISSION_DENIED — the exact
// browser state of the reported bug.

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
const GPS_BUTTON_LABEL = "Usar mi ubicación";
const DENIED_TEXT = "Permiso de ubicación denegado";
const CLOSE_LABEL = "Cerrar";

const results = [];
function record(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok });
}

async function run() {
  console.log(`\ngps-error-hint E2E against ${BASE_URL}\n`);

  const chromePath = resolveChrome();
  const browser = await chromium.launch(chromePath ? { executablePath: chromePath } : {});
  // Mobile-ish viewport: reproduces the screenshot layout where the GPS button
  // wraps to the left edge on Profile and a right-anchored pill would clip.
  // locale es-ES keeps the middleware on the default (unprefixed) es routes,
  // matching the hardcoded es strings below.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "es-ES",
  });

  const page = await ctx.newPage();
  // The bug's precondition: GPS was enabled in a previous session (so the hook
  // auto-requests on mount — and the denied result used to show the pill), and
  // the browser permission is denied.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vitamind:useGps", "true");
    } catch {}
    const deny = (_onSuccess, onError) => {
      if (onError) {
        setTimeout(
          () =>
            onError({
              code: 1,
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
              message: "User denied Geolocation",
            }),
          50,
        );
      }
      return 1;
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition: deny, getCurrentPosition: deny, clearWatch: () => {} },
    });
  });

  await page.goto(`${BASE_URL}/profile`, { waitUntil: "load" });
  const gpsButton = page.getByRole("button", { name: GPS_BUTTON_LABEL });
  await gpsButton.waitFor({ timeout: 15000 });

  // ---- A: silent auto-request must not surface the pill --------------------
  // The denial is immediate (Playwright auto-denies); give the app a moment to
  // settle so a regression would have rendered the pill by now.
  await page.waitForTimeout(2500);
  const pill = page.getByText(DENIED_TEXT);
  const unsolicited = await pill.count();
  record(
    "A: auto-request on load (permission denied) shows no error pill",
    unsolicited === 0,
    `pill count=${unsolicited}`,
  );

  // ---- B: user tap → pill appears, fully inside the viewport ---------------
  await gpsButton.click();
  let visible = false;
  try {
    await pill.waitFor({ timeout: 10000 });
    visible = true;
  } catch {}
  record("B1: tapping the GPS button shows the error pill", visible);

  if (visible) {
    const box = await pill.boundingBox();
    const vw = page.viewportSize().width;
    const inViewport = !!box && box.x >= 0 && box.x + box.width <= vw;
    record(
      "B2: the pill is fully inside the viewport (not clipped)",
      inViewport,
      box ? `x=${Math.round(box.x)} right=${Math.round(box.x + box.width)} vw=${vw}` : "no box",
    );
  } else {
    record("B2: the pill is fully inside the viewport (not clipped)", false, "pill never appeared");
  }

  // ---- C: the × dismisses the pill -----------------------------------------
  if (visible) {
    await page
      .locator(`span:has-text("${DENIED_TEXT}")`)
      .getByRole("button", { name: CLOSE_LABEL })
      .click();
    let dismissed = false;
    try {
      await pill.waitFor({ state: "detached", timeout: 5000 });
      dismissed = true;
    } catch {}
    record("C: the × button dismisses the pill", dismissed);
  } else {
    record("C: the × button dismisses the pill", false, "pill never appeared");
  }

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error("unexpected error:", e);
  process.exit(1);
});
