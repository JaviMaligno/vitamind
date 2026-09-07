import type { MetadataRoute } from "next";
import { SITE_URL, IS_PRODUCTION_DEPLOY } from "@/lib/site";

/**
 * WHY THE ON-DEMAND CITY PAGES ARE NOT DISALLOWED HERE, even though they are
 * `noindex` and number over a million.
 *
 * There is no path to disallow. They share `/{cityPrefix}/` with the 438 curated
 * pages that this site does want crawled, so any prefix rule would take those
 * down with them, and the two are told apart by the SHAPE of the last segment,
 * which robots.txt cannot express.
 *
 * And a disallow would be the wrong instrument even if it could. `Disallow` stops
 * a crawler fetching the page, which stops it reading the `noindex` on the page —
 * so a URL reached from a link can still end up indexed, title-only, with the
 * directive that would have prevented it sitting unread behind the block. The
 * per-page `robots` meta is what keeps them out, and the sitemap never asks for
 * them: see the header of `app/sitemap.ts`.
 */
/**
 * WHY THE `_rsc` PREFETCH URLS ARE DISALLOWED.
 *
 * Search Console's crawl stats for the 90 days to 2026-09-05: 270k requests, of
 * which 240k -- 89% of the crawl and 1.2 GB of the 1.86 GB downloaded -- went to
 * URLs like `/ru/vitamin-d/nairobi?_rsc=1xx2a`. HTML was 6%. Those are the App
 * Router's prefetch URLs: Googlebot runs the page's JS, the `<Link>` prefetches
 * fire, and it then crawls each one as if it were a page.
 *
 * It gets the worst of both ends. Googlebot does not send the `RSC` request
 * header, so the server does not answer with the 107 KB flight payload but with
 * the FULL HTML -- 203 KB for `/vitamina-d/madrid` -- of a page it already has.
 *
 * Unlike the on-demand city pages above, a `Disallow` IS the right instrument
 * here: these URLs are not governed by a `noindex` that a block would hide, but
 * by a `canonical` pointing at the clean URL, which is already what keeps them
 * out of the index. And robots.txt binds crawlers only -- a real visitor's
 * prefetch is unaffected.
 *
 * Redirects, for the record, were 1% of the crawl. The 2,765 cross-locale ones
 * in the index report are not worth a rule.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_DEPLOY) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/*?_rsc=", "/*&_rsc="] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
