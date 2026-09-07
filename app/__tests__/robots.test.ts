import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * `app/robots.ts` reads `IS_PRODUCTION_DEPLOY`, which `lib/site.ts` computes from
 * process.env at module load, so each case needs a fresh import with the
 * environment already in place.
 */
async function loadRobots(env: Record<string, string | undefined>) {
  vi.resetModules();
  const saved = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const mod = await import("@/app/robots");
  process.env = saved;
  return mod.default();
}

const PRODUCTION = {
  VERCEL_ENV: "production",
  VERCEL_PROJECT_PRODUCTION_URL: "getvitamind.app",
};

afterEach(() => {
  vi.resetModules();
});

/**
 * THE MEASUREMENT BEHIND THIS RULE (Search Console, 90 days to 2026-09-05).
 *
 * 270k crawl requests, of which 240k -- 89% of the crawl and 1.2 GB of the
 * 1.86 GB downloaded -- were URLs like `/ru/vitamin-d/nairobi?_rsc=1xx2a`.
 * They are the App Router's prefetch URLs: Googlebot runs the page's JS, the
 * `<Link>` prefetches fire, and it then crawls each one as a page of its own.
 *
 * And it gets the worst of both: Googlebot does not send the `RSC` header, so
 * the server answers with the FULL HTML (203 KB for `/vitamina-d/madrid`)
 * instead of the 107 KB flight payload. Copies of pages it already has.
 *
 * HTML was 6% of the crawl. Redirects -- the 2,765 cross-locale ones in the
 * index report -- were 1%, which is why they are not what this rule targets.
 */
describe("robots.txt on the production deploy", () => {
  it("keeps the site crawlable and still points at the sitemap", async () => {
    const robots = await loadRobots(PRODUCTION);
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(robots.sitemap).toBe("https://getvitamind.app/sitemap.xml");
  });

  it("disallows the RSC prefetch URLs, in both query positions", async () => {
    const robots = await loadRobots(PRODUCTION);
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    const disallow = [rule.disallow ?? []].flat();
    // `?_rsc=` is the usual shape; `&_rsc=` is what a page that already carries a
    // query string produces.
    expect(disallow).toContain("/*?_rsc=");
    expect(disallow).toContain("/*&_rsc=");
  });

  it("blocks nothing else, so no real page can fall behind the rule", async () => {
    const robots = await loadRobots(PRODUCTION);
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    const disallow = [rule.disallow ?? []].flat();
    expect(disallow.every((p) => p.includes("_rsc="))).toBe(true);
  });
});

describe("robots.txt off production", () => {
  it("still blocks everything on preview and on the dev project", async () => {
    for (const env of [
      { VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "getvitamind.app" },
      { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "getvitamind-dev.vercel.app" },
    ]) {
      const robots = await loadRobots(env);
      const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
      expect(rule.disallow).toBe("/");
      expect(rule.allow).toBeUndefined();
    }
  });
});
