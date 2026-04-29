import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.PROBE_URL || "https://vitamind-dev.vercel.app";
const outDir = "scripts/.probe-out";
mkdirSync(outDir, { recursive: true });

async function probe(path, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // mobile size
    locale: "es-ES",
  });
  const page = await ctx.newPage();

  const consoleMsgs = [];
  page.on("console", (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));

  const url = `${BASE}${path}`;
  console.log(`\n=== ${label}: ${url} ===`);
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  console.log(`  HTTP ${resp.status()} → ${page.url()}`);

  // Wait a bit for client hydration & redirects
  await page.waitForTimeout(1500);
  console.log(`  Final URL: ${page.url()}`);

  // Extract visible city / hero text
  const cityCandidates = await page
    .locator('[data-city], h1, h2, h3, [class*="city"], [class*="hero"]')
    .allInnerTexts()
    .catch(() => []);
  const visibleText = await page.locator("body").innerText().catch(() => "");

  // Check localStorage (should be empty for first-visit)
  const ls = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });

  console.log(`  localStorage keys: ${Object.keys(ls).join(", ") || "(empty)"}`);
  if (Object.keys(ls).length) console.log(`  localStorage: ${JSON.stringify(ls).slice(0, 300)}`);

  // Look for "Londres" anywhere in visible text
  const londresMatches = visibleText.match(/londres|london/gi) ?? [];
  console.log(`  "Londres"/"London" mentions in visible text: ${londresMatches.length}`);

  // First 400 chars of visible text
  console.log(`  First visible text (truncated):\n${visibleText.slice(0, 600).replace(/\n+/g, " | ")}`);

  // Cityname dom search
  const cityNameElement = await page
    .locator('text=/Londres|London|Madrid/i')
    .first()
    .innerText()
    .catch(() => null);
  if (cityNameElement) console.log(`  matched element text: ${cityNameElement}`);

  // Screenshot
  const shot = `${outDir}/${label}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`  screenshot: ${shot}`);

  await browser.close();
  return { finalUrl: page.url(), londresCount: londresMatches.length, ls };
}

const results = {
  root: await probe("/", "01-root-firstvisit"),
  dashboard: await probe("/dashboard", "02-dashboard-direct"),
  explore: await probe("/explore", "03-explore-direct"),
  learn: await probe("/learn", "04-learn-direct"),
};

console.log("\n=== summary ===");
for (const [k, v] of Object.entries(results)) {
  console.log(`${k.padEnd(12)} → ${v.finalUrl}  (Londres mentions: ${v.londresCount})`);
}
