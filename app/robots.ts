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
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_DEPLOY) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
