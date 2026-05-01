import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.PROBE_URL || "https://vitamind-dev.vercel.app";
const outDir = "scripts/.probe-out";
mkdirSync(outDir, { recursive: true });

async function probe(label, opts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "es-ES",
  });
  const page = await ctx.newPage();

  // Pre-seed localStorage if requested. Must navigate to the origin first.
  if (opts.preseed) {
    await page.goto(`${BASE}/__not_a_page__`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.evaluate((seed) => {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, opts.preseed);
  }

  const url = `${BASE}${opts.path}`;
  console.log(`\n=== ${label}: ${url} ===`);
  if (opts.preseed) console.log(`  preseed:`, JSON.stringify(opts.preseed).slice(0, 200));

  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  console.log(`  HTTP ${resp.status()} → ${page.url()}`);
  await page.waitForTimeout(1500);
  console.log(`  Final URL: ${page.url()}`);

  const visibleText = await page.locator("body").innerText().catch(() => "");
  const ls = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });

  const londresMatches = visibleText.match(/londres|london/gi) ?? [];
  console.log(`  localStorage keys: ${Object.keys(ls).join(", ") || "(empty)"}`);
  console.log(`  "Londres"/"London" mentions: ${londresMatches.length}`);
  console.log(`  First visible:\n  ${visibleText.slice(0, 500).replace(/\n+/g, " | ")}`);

  await page.screenshot({ path: `${outDir}/${label}.png`, fullPage: true });
  await browser.close();
  return { finalUrl: page.url(), londresCount: londresMatches.length, ls };
}

const SEEDED_LONDRES = JSON.stringify({
  threshold: 45,
  lastCityId: "builtin:londres",
  skinType: 3,
  areaFraction: 0.25,
  targetIU: 1000,
});

const results = {
  cleanRoot: await probe("01-clean-root", { path: "/", preseed: null }),
  cleanDashboard: await probe("02-clean-dashboard", { path: "/dashboard", preseed: null }),
  // With lastCityId in localStorage (any source — manual pick, legacy default, profile sync),
  // we restore. The user can always change city or clear storage.
  seededDashboard: await probe("03-seeded-londres-dashboard", {
    path: "/dashboard",
    preseed: { "vitamind:preferences": SEEDED_LONDRES },
  }),
  seededExplore: await probe("04-seeded-londres-explore", {
    path: "/explore",
    preseed: { "vitamind:preferences": SEEDED_LONDRES },
  }),
};

console.log("\n=== summary ===");
for (const [k, v] of Object.entries(results)) {
  console.log(`${k.padEnd(20)} → ${v.finalUrl}  Londres: ${v.londresCount}`);
}
