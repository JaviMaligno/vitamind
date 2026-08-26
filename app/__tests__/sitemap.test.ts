import { describe, it, expect, afterEach, vi } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";
import { SUNRISE_CITIES } from "@/lib/sun-routes";
import { CITY_SLUGS } from "@/lib/city-slugs";
import { SUN_MONTH_REVISION, CITY_PAGE_REVISION } from "@/lib/content-revision";

describe("sitemap", () => {
  const entries = sitemap();

  it("emits the static, city, sunrise-hub and sunrise-month URLs", () => {
    // 9 pages ×6 + 73 cities ×6 + every sunrise city ×(1 hub + 12 months) ×6.
    //
    // The sunrise term is derived from SUNRISE_CITIES rather than hardcoded, so adding
    // a wave does not require editing this number. What it still pins is the shape —
    // a hub plus twelve months in six locales for each configured city — which is what
    // would break if a locale, a month or the hub were ever dropped from the generator.
    expect(entries).toHaveLength(54 + 438 + SUNRISE_CITIES.length * 13 * 6);
  });

  it("emits the city hub at the sunrise prefix, in every locale", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/amanecer/madrid`);
    expect(urls).toContain(`${SITE_URL}/en/sunrise/london`);
    expect(urls).toContain(`${SITE_URL}/de/sonnenaufgang/wien`);
    // The hub is the freshest page in the tree — it is about today, not a month.
    const madrid = entries.find((e) => e.url === `${SITE_URL}/amanecer/madrid`);
    expect(madrid?.changeFrequency).toBe("daily");
    expect(madrid?.alternates?.languages?.["x-default"]).toBe(`${SITE_URL}/amanecer/madrid`);
  });

  it("covers every configured sunrise city in every locale", () => {
    // Guards the gap the count alone cannot see: the right total with the wrong cities.
    const urls = entries.map((e) => e.url).join("\n");
    for (const base of SUNRISE_CITIES) {
      expect(urls, `no sunrise URLs for ${base}`).toContain(`/${CITY_SLUGS[base].en}/`);
    }
  });

  it("uses no prefix for es and /xx for other locales", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/learn`);      // es
    expect(urls).toContain(`${SITE_URL}/en/learn`);   // en
    expect(urls).toContain(`${SITE_URL}/`);           // es home
    expect(urls).toContain(`${SITE_URL}/fr`);         // fr home
  });

  it("has no legacy ?locale= URLs", () => {
    expect(entries.every((e) => !e.url.includes("?locale="))).toBe(true);
  });

  it("attaches language alternates to every entry", () => {
    for (const e of entries) {
      expect(Object.keys(e.alternates?.languages ?? {})).toContain("en");
    }
  });

  it("x-default points at the es (prefix-free) version of the same path", () => {
    const learnEs = entries.find((e) => e.url === `${SITE_URL}/learn`);
    expect(learnEs?.alternates?.languages?.["x-default"]).toBe(`${SITE_URL}/learn`);
  });

  it("emits the localized city URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/vitamina-d/madrid`);
    expect(urls).toContain(`${SITE_URL}/en/vitamin-d/london`);
    expect(urls).toContain(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(urls).toContain(`${SITE_URL}/lt/vitaminas-d/londonas`);
    // ru borrows the real Latin name; it is not a back-transliteration.
    expect(urls).toContain(`${SITE_URL}/ru/vitamin-d/london`);
  });

  it("gives each city entry six hreflang alternates plus x-default", () => {
    const london = entries.find((e) => e.url === `${SITE_URL}/en/vitamin-d/london`);
    expect(london?.alternates?.languages?.es).toBe(`${SITE_URL}/vitamina-d/londres`);
    expect(london?.alternates?.languages?.fr).toBe(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(london?.alternates?.languages?.["x-default"]).toBe(`${SITE_URL}/vitamina-d/londres`);
    expect(Object.keys(london?.alternates?.languages ?? {})).toHaveLength(7); // 6 + x-default
  });

  it("has no duplicate URLs", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  /**
   * The sitemap's static list is hand-maintained, so adding a route and forgetting
   * this file is silent: the page ships, ranks nowhere, and never reaches IndexNow.
   * That is exactly how /about was born missing. Rather than pin the one route,
   * derive the expectation from the filesystem so the next one fails loudly here.
   */
  it("lists every indexable static route that exists on disk", () => {
    const dir = join(process.cwd(), "app", "[locale]");
    const onDisk = readdirSync(dir, { withFileTypes: true })
      // Dynamic segments ([cityPrefix]) expand into the city and sunrise entries
      // the tests above already cover; only fixed paths belong in the static list.
      .filter((e) => e.isDirectory() && !e.name.startsWith("["))
      .filter((e) => existsSync(join(dir, e.name, "page.tsx")))
      .map((e) => `/${e.name}`);

    // Deliberately absent, each for a reason that is not "we forgot":
    const NOT_INDEXABLE = [
      "/oauth-consent", // reached only mid-OAuth flow, with query params
      "/offline", // service-worker fallback, meaningless as a landing page
      "/reset-password", // reached only from a tokenized email link
    ];

    const expected = onDisk.filter((p) => !NOT_INDEXABLE.includes(p));
    const missing = expected.filter(
      (p) => !entries.some((e) => e.url === `${SITE_URL}${p}`),
    );
    expect(missing).toEqual([]);
  });

  /**
   * THE LOCK THAT FAILS SILENTLY IF IT IS NOT PINNED (R-5).
   *
   * `/{cityPrefix}/{slug}` now also serves any city in the `cities` table —
   * 230,407 rows, which is 1,382,442 URLs across six locales. The sitemap is a
   * crawl REQUEST, and this project's binding meter is (URLs crawled) × (bytes
   * served). Listing a `noindex` family that cannot rank by design would be pure
   * cost against it.
   *
   * Worse, `lib/indexnow.ts` builds its submission list by importing this very
   * function, so a URL that leaks in here ends up PUSHED to Bing — which that
   * module's own header calls the abusable move.
   *
   * Both asserts were shown to fail before they were kept: adding a single
   * `/vitamina-d/toledo-es` entry to `app/sitemap.ts` turned the first red, and
   * `/vitamina-d/id-2510409` the second.
   */
  it("never lists a qualified (on-demand) city URL", () => {
    const qualified = entries.filter((e) =>
      /\/[a-z0-9-]+-[a-z]{2}(-\d+)?$/.test(new URL(e.url).pathname),
    );
    expect(qualified.map((e) => e.url)).toEqual([]);
  });

  it("never lists an id-alias URL", () => {
    expect(entries.filter((e) => /\/id-\d+$/.test(e.url)).map((e) => e.url)).toEqual([]);
  });
});

/**
 * THE LASTMOD POLICY, pinned per family.
 *
 * `lastmod` is what the five engines schedule crawls from, and this project's
 * binding meter is (URLs crawled) × (bytes served). The old sitemap opened with
 * `new Date()` and stamped it on all 3612 entries, so every deploy — including
 * ones that touched no page at all — announced the whole site as changed. These
 * tests exist so that regression cannot come back quietly: what they assert is
 * not a format but a NUMBER, the count of URLs a deploy re-dates.
 *
 * The clock is faked far in the future, and deliberately so: the declared
 * revisions in lib/content-revision.ts can never be a future date (their own
 * guard asserts `date <= today`), so a render day of 2030 cannot collide with
 * one of them and the two sets stay distinguishable however the revisions move.
 */
describe("sitemap lastmod policy", () => {
  const RENDER_DAY = "2030-03-04";
  const LATER_DAY = "2030-03-05";

  const at = (day: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${day}T12:34:56.000Z`));
    return sitemap();
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  const monthCount = SUNRISE_CITIES.length * 12 * 6;
  const hubCount = SUNRISE_CITIES.length * 6;

  it("re-dates 294 URLs on a deploy, not 3612", () => {
    const built = at(RENDER_DAY);
    const moving = built.filter((e) => e.lastModified === RENDER_DAY);

    // 54 app pages + the 240 today hubs. Everything else — 3318 URLs — carries a
    // date that a deploy cannot move.
    expect(moving).toHaveLength(54 + hubCount);
    expect(built.length - moving.length).toBe(438 + monthCount);
  });

  it("gives each family the date that family's content actually has", () => {
    const built = at(RENDER_DAY);
    const find = (url: string) => built.find((e) => e.url === url);

    // App page: its content is the app, so a deploy is its change event.
    expect(find(`${SITE_URL}/learn`)?.lastModified).toBe(RENDER_DAY);
    // Hub: its subject is today (see lib/sun-today.ts), never a frozen revision.
    expect(find(`${SITE_URL}/amanecer/madrid`)?.lastModified).toBe(RENDER_DAY);
    // City page: four representative days of the reference year.
    expect(find(`${SITE_URL}/vitamina-d/madrid`)?.lastModified).toBe(CITY_PAGE_REVISION.date);
    // Month page: a pure function of (city, month, DOY_REFERENCE_YEAR).
    expect(find(`${SITE_URL}/amanecer/madrid/agosto`)?.lastModified).toBe(SUN_MONTH_REVISION.date);
    expect(find(`${SITE_URL}/en/sunrise/oslo/august`)?.lastModified).toBe(SUN_MONTH_REVISION.date);
  });

  it("moves the hubs and only the hubs when the clock moves", () => {
    const first = at(RENDER_DAY);
    vi.useRealTimers();
    const second = at(LATER_DAY);

    const changed = first
      .map((e, i) => ({ url: e.url, before: e.lastModified, after: second[i].lastModified }))
      .filter((row) => row.before !== row.after);

    // The 54 app pages plus the 240 hubs, and nothing from the two frozen
    // families: a day passing (or a deploy happening) is not a content change
    // for a page whose figures are a function of the calendar, not of the clock.
    expect(changed).toHaveLength(54 + hubCount);
    expect(changed.some((row) => row.url.includes("/agosto"))).toBe(false);
    expect(changed.some((row) => row.url === `${SITE_URL}/vitamina-d/madrid`)).toBe(false);
  });

  /**
   * Date-only, not an instant. The old value was `2026-08-21T23:40:09.563Z`
   * repeated 3612 times — millisecond precision about when a page's content
   * changed, which nobody has. `YYYY-MM-DD` is valid per sitemaps.org, and
   * `MetadataRoute.Sitemap` passes a string through verbatim.
   */
  it("emits every lastmod as a plain date", () => {
    for (const e of at(RENDER_DAY)) {
      expect(typeof e.lastModified, e.url).toBe("string");
      expect(e.lastModified as string, e.url).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
