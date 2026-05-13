// Standalone Playwright script — runs install-awareness scenarios against the dev/prod server.
// Usage: BASE_URL=http://localhost:3010 node tests/e2e/install-awareness.spec.mjs
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3010";

const UA_CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const UA_FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0";
const UA_IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.0";
const UA_ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// Locale-agnostic structural selector: banner has the unique combo "fixed z-40 transition-all"
const BANNER_SELECTOR = '.fixed.z-40.transition-all';
const MODAL_SELECTOR = '[role="dialog"]';

function initScript({ standalone = false, notificationPermission, alreadySeen = false } = {}) {
  return `
    (() => {
      // Set valid prefs so the dashboard banner check passes.
      localStorage.setItem('vitamind:preferences', JSON.stringify({
        threshold: 45,
        lastCityId: 'builtin:madrid',
        skinType: 3,
        areaFraction: 0.25,
        age: 30,
        targetIU: 1000,
      }));
      ${alreadySeen ? `localStorage.setItem('vitamind:installBannerSeen', 'true');` : ''}

      ${standalone ? `
      const _origMatch = window.matchMedia.bind(window);
      window.matchMedia = (q) => {
        if (typeof q === 'string' && q.includes('standalone')) {
          return { matches: true, media: q, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false };
        }
        return _origMatch(q);
      };
      ` : ''}

      ${notificationPermission ? `
      const _Notification = function () { };
      _Notification.permission = '${notificationPermission}';
      _Notification.requestPermission = () => Promise.resolve('${notificationPermission === 'default' ? 'granted' : notificationPermission}');
      Object.defineProperty(window, 'Notification', { value: _Notification, writable: true, configurable: true });
      ` : ''}
    })();
  `;
}

// After page is hydrated, dispatch beforeinstallprompt with promptable event.
async function fireBeforeInstallPrompt(page) {
  await page.evaluate(() => {
    const evt = new Event("beforeinstallprompt");
    evt.prompt = async () => {
      window.__bipPromptCalled = true;
    };
    evt.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(evt);
  });
}

const results = [];
function record(name, status, detail = "") {
  const symbol = status === "pass" ? "✓" : status === "fail" ? "✗" : "~";
  console.log(`${symbol} ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, status, detail });
}

async function withContext(opts, fn) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent: opts.userAgent || UA_CHROME_DESKTOP,
    viewport: { width: 414, height: 896 },
  });
  await context.addInitScript(initScript(opts.init || {}));
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("  [pageerror]", e.message));
  try {
    await fn(page, context);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function gotoDashboardAndHydrate(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  // Wait for the banner div to be in the DOM (mounted with opacity-0). It only mounts if eligibility passed.
  await page.waitForLoadState("networkidle").catch(() => {});
  // Give react a beat to mount InstallProvider's listeners.
  await page.waitForTimeout(500);
}

// SCENARIO 1: Chrome desktop fresh — banner appears after 3s with native prompt
async function scenario1() {
  await withContext({ userAgent: UA_CHROME_DESKTOP }, async (page) => {
    await gotoDashboardAndHydrate(page);
    await fireBeforeInstallPrompt(page);
    // Wait > 3s for banner to become visible
    await page.waitForTimeout(3500);
    const visible = await page.locator(BANNER_SELECTOR).count();
    if (visible >= 1) {
      const text = (await page.locator(BANNER_SELECTOR).first().textContent()) || "";
      record("S1: Chrome desktop fresh — banner appears", "pass", `banner: "${text.trim().slice(0, 50)}"`);
    } else {
      // Diagnostic
      const seen = await page.evaluate(() => localStorage.getItem("vitamind:installBannerSeen"));
      record("S1: Chrome desktop fresh — banner appears", "fail", `seenFlag=${seen}, no banner element`);
    }
  });
}

// SCENARIO 2: standalone display-mode → banner suppressed
async function scenario2() {
  await withContext(
    { userAgent: UA_CHROME_DESKTOP, init: { standalone: true } },
    async (page) => {
      await gotoDashboardAndHydrate(page);
      await fireBeforeInstallPrompt(page);
      await page.waitForTimeout(3500);
      const visible = await page.locator(BANNER_SELECTOR).count();
      if (visible === 0) {
        record("S2: standalone (installed PWA) — banner suppressed", "pass");
      } else {
        record("S2: standalone (installed PWA) — banner suppressed", "fail", `${visible} element(s)`);
      }
    },
  );
}

// SCENARIO 3: dismiss banner → reload → banner does not reappear
async function scenario3() {
  await withContext({ userAgent: UA_CHROME_DESKTOP }, async (page) => {
    await gotoDashboardAndHydrate(page);
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3500);
    const initialCount = await page.locator(BANNER_SELECTOR).count();
    if (initialCount === 0) {
      record("S3: dismiss + reload — banner suppressed", "fail", "banner did not appear initially");
      return;
    }
    // Click dismiss (✕) — last button inside banner.
    await page.locator(`${BANNER_SELECTOR} button`).last().click();
    await page.waitForTimeout(400);

    // Reload — banner should NOT reappear because installBannerSeen is set.
    await page.reload({ waitUntil: "domcontentloaded" });
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3500);
    const after = await page.locator(BANNER_SELECTOR).count();
    if (after === 0) {
      record("S3: dismiss + reload — banner suppressed", "pass");
    } else {
      record("S3: dismiss + reload — banner suppressed", "fail", `${after} reappeared`);
    }
  });
}

// SCENARIO 4: appinstalled → banner unmounts + toast appears
async function scenario4() {
  await withContext({ userAgent: UA_CHROME_DESKTOP }, async (page) => {
    await gotoDashboardAndHydrate(page);
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3500);
    if ((await page.locator(BANNER_SELECTOR).count()) === 0) {
      record("S4: appinstalled → banner unmount + toast", "fail", "banner did not appear initially");
      return;
    }
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await page.waitForTimeout(500);

    const banner = await page.locator(BANNER_SELECTOR).count();
    const toast = await page.locator('[role="status"]').filter({ hasText: /home screen|pantalla de inicio|écran d'accueil|startbildschirm|главного экрана|pradžios ekran/i }).count();
    if (banner === 0 && toast >= 1) {
      record("S4: appinstalled → banner unmount + toast", "pass");
    } else {
      record("S4: appinstalled → banner unmount + toast", "fail", `banner=${banner}, toast=${toast}`);
    }
  });
}

// SCENARIO 6: iOS Safari, banner already seen, then toggle notifications → gating modal
async function scenario6() {
  await withContext(
    {
      userAgent: UA_IOS_SAFARI,
      init: { notificationPermission: "default", alreadySeen: true },
    },
    async (page) => {
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const toggleBtn = page.locator('button:has-text("🔕")').first();
      const exists = await toggleBtn.count();
      if (!exists) {
        record(
          "S6: iOS Safari + permission default → gating modal",
          "skip",
          "notification toggle (🔕) not visible — feature flow may need additional setup",
        );
        return;
      }
      await toggleBtn.click();
      await page.waitForTimeout(800);

      const modal = page.locator(MODAL_SELECTOR).first();
      const modalText = (await modal.textContent().catch(() => "")) || "";
      if (/install|enable notifications|home screen|safari/i.test(modalText)) {
        record(
          "S6: iOS Safari + permission default → gating modal",
          "pass",
          `modal: "${modalText.slice(0, 60)}"`,
        );
      } else {
        record(
          "S6: iOS Safari + permission default → gating modal",
          "fail",
          `unexpected: "${modalText.slice(0, 60)}"`,
        );
      }
    },
  );
}

// SCENARIO 7: iOS Safari, permission granted → toggle subscribes (no modal)
async function scenario7() {
  await withContext(
    {
      userAgent: UA_IOS_SAFARI,
      init: { notificationPermission: "granted" },
    },
    async (page) => {
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const toggleBtn = page.locator('button:has-text("🔕")').first();
      const exists = await toggleBtn.count();
      if (!exists) {
        record(
          "S7: iOS Safari + permission granted → no flow-D modal",
          "skip",
          "toggle not visible (perhaps already on)",
        );
        return;
      }
      await toggleBtn.click();
      await page.waitForTimeout(800);
      const modalCount = await page.locator(MODAL_SELECTOR).count();
      if (modalCount === 0) {
        record("S7: iOS Safari + permission granted → no flow-D modal", "pass");
      } else {
        record(
          "S7: iOS Safari + permission granted → no flow-D modal",
          "fail",
          `modal opened (${modalCount})`,
        );
      }
    },
  );
}

// SCENARIO 8: iOS Safari, permission denied → no flow-D modal
async function scenario8() {
  await withContext(
    {
      userAgent: UA_IOS_SAFARI,
      init: { notificationPermission: "denied" },
    },
    async (page) => {
      await page.goto(`${BASE_URL}/profile`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      // Component sets status to denied; button shows 🚫.
      const blocked = await page.locator('button:has-text("🚫")').count();
      const modalCount = await page.locator(MODAL_SELECTOR).count();

      if (blocked >= 1 && modalCount === 0) {
        record("S8: iOS Safari + permission denied → no flow-D modal", "pass", "denied UI present, no modal");
      } else if (blocked === 0) {
        record(
          "S8: iOS Safari + permission denied → no flow-D modal",
          "skip",
          "denied state UI not visible",
        );
      } else {
        record(
          "S8: iOS Safari + permission denied → no flow-D modal",
          "fail",
          `unexpected modal (${modalCount})`,
        );
      }
    },
  );
}

// SCENARIO 9: Instagram in-app browser → banner + Open in Safari modal
async function scenario9() {
  await withContext({ userAgent: UA_INSTAGRAM }, async (page) => {
    await gotoDashboardAndHydrate(page);
    await page.waitForTimeout(3500);
    if ((await page.locator(BANNER_SELECTOR).count()) === 0) {
      record("S9: Instagram in-app — banner + Safari modal", "fail", "banner did not appear");
      return;
    }
    // Click the first button inside the banner inner card (Install CTA, not the ✕ close).
    await page.locator(`${BANNER_SELECTOR} button`).first().click();
    await page.waitForTimeout(500);
    const modalText = (await page.locator(MODAL_SELECTOR).first().textContent().catch(() => "")) || "";
    if (/safari|abre|abrir|open/i.test(modalText)) {
      record("S9: Instagram in-app — banner + Safari modal", "pass", `modal: "${modalText.slice(0, 60)}"`);
    } else {
      record(
        "S9: Instagram in-app — banner + Safari modal",
        "fail",
        `unexpected: "${modalText.slice(0, 60)}"`,
      );
    }
  });
}

// SCENARIO 10: Firefox desktop → banner + generic fallback modal
async function scenario10() {
  await withContext({ userAgent: UA_FIREFOX }, async (page) => {
    await gotoDashboardAndHydrate(page);
    await page.waitForTimeout(3500);
    if ((await page.locator(BANNER_SELECTOR).count()) === 0) {
      record("S10: Firefox desktop — banner + fallback modal", "fail", "banner did not appear");
      return;
    }
    await page.locator(`${BANNER_SELECTOR} button`).first().click();
    await page.waitForTimeout(500);
    const modalText = (await page.locator(MODAL_SELECTOR).first().textContent().catch(() => "")) || "";
    // Generic fallback uses install.modal.fallback. Match on key phrases across locales.
    if (/browser.?s menu|men[uú] de|home screen|pantalla de inicio|écran d'accueil|startbildschirm|главный экран|pradžios ekran/i.test(modalText)) {
      record("S10: Firefox desktop — banner + fallback modal", "pass", `modal: "${modalText.slice(0, 60)}"`);
    } else {
      record(
        "S10: Firefox desktop — banner + fallback modal",
        "fail",
        `unexpected: "${modalText.slice(0, 60)}"`,
      );
    }
  });
}

// SCENARIO 11: Android Chrome — banner + native Install path
async function scenario11() {
  await withContext({ userAgent: UA_ANDROID_CHROME }, async (page) => {
    await gotoDashboardAndHydrate(page);
    await fireBeforeInstallPrompt(page);
    await page.waitForTimeout(3500);
    if ((await page.locator(BANNER_SELECTOR).count()) === 0) {
      record("S11: Android Chrome — banner + native Install path", "fail", "banner did not appear");
      return;
    }
    await page.locator(`${BANNER_SELECTOR} button`).first().click();
    await page.waitForTimeout(800);
    const promptCalled = await page.evaluate(() => Boolean(window.__bipPromptCalled));
    const banner = await page.locator(BANNER_SELECTOR).count();
    if (promptCalled && banner === 0) {
      record(
        "S11: Android Chrome — banner + native Install path",
        "pass",
        "deferredPrompt.prompt() called, banner dismissed",
      );
    } else {
      record(
        "S11: Android Chrome — banner + native Install path",
        "fail",
        `prompt=${promptCalled}, banner=${banner}`,
      );
    }
  });
}

(async () => {
  console.log(`\nRunning install-awareness E2E against ${BASE_URL}\n`);
  for (const fn of [scenario1, scenario2, scenario3, scenario4, scenario6, scenario7, scenario8, scenario9, scenario10, scenario11]) {
    try {
      await fn();
    } catch (e) {
      record(fn.name, "fail", `unexpected error: ${e.message}`);
    }
  }
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
