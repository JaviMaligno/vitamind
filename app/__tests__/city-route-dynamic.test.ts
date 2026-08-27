import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { CITY_PREFIX, cityPathname, cityStaticParams } from "@/lib/city-routes";
import { CITY_SLUGS } from "@/lib/city-slugs";
import { SUN_PREFIX } from "@/lib/sun-routes";

/**
 * THE TWO FAMILIES AND THE WALL BETWEEN THEM.
 *
 * The 438 curated city pages are prerendered and cached forever. The on-demand
 * layer serves ~235,000 more from the `cities` table, computed from their own
 * lat/lon, IANA zone and elevation. Both want to answer at `/{prefix}/{slug}`,
 * and one route file cannot host both. Measured 2026-08-26 against Next 16.1.6
 * (the plan's Paso 4), on a real `next start`, six segment-config variants:
 *
 *   - `notFound()` for a param that `generateStaticParams` did not list IS
 *     written to the full route cache: `x-nextjs-prerender: 1`,
 *     `Cache-Control: s-maxage=31536000`, 11 files and 19,613 bytes on disk per
 *     junk URL, HIT on the second request.
 *   - `await connection()` before the `notFound()` returns HTTP 500
 *     (`DYNAMIC_SERVER_USAGE`), not a 404. It is not an escape hatch.
 *   - Dropping `revalidate`, or setting `dynamicParams = false`, changes
 *     nothing: the 404 is cached either way.
 *   - `export const dynamic = "force-dynamic"` is the ONLY thing that stops the
 *     write (`private, no-cache, no-store`, zero files) — and it is per FILE, so
 *     in the curated file it would take all 438 pages out of the prerender.
 *
 * Hence the split, and hence this test file. The public URL does not change:
 * `proxy.ts` recognises an on-demand slug and REWRITES it to a separate internal
 * route that carries `force-dynamic`. The curated file never sees one, so its
 * 438 prerenders and its `revalidate = false` (the saving won on 2026-08-22)
 * survive untouched. The wall is safe to lean on because the two namespaces are
 * disjoint by construction and measured: of the 194 distinct builtin slugs,
 * ZERO end in two letters after a hyphen, and every on-demand slug does.
 *
 * Most asserts read source rather than render, in the style of
 * app/__tests__/sun-hub-split.test.ts and app/__tests__/prose-gating.test.ts:
 * what has to be nailed down here is segment config, indexing policy and which
 * file imports what — properties of the tree, not of a rendered DOM.
 */

const ROOT = process.cwd();
const APP = join(ROOT, "app");
const CURATED = join(APP, "[locale]", "[cityPrefix]", "[city]", "page.tsx");
const PROXY = join(ROOT, "proxy.ts");

const curated = readFileSync(CURATED, "utf8");
const proxySource = readFileSync(PROXY, "utf8");

/** Every `page.tsx` under app/, as absolute paths. */
function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...pageFiles(full));
    } else if (entry.name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

/**
 * The on-demand route is found by what it DOES, not by where it sits: the one
 * page that resolves a city through `resolveDynamicCity`. Paso 32 is free to
 * pick the folder; it is not free to have two of these, or none.
 */
function onDemandPages(): string[] {
  return pageFiles(APP).filter(
    (f) => f !== CURATED && /resolveDynamicCity|lib\/city-dynamic"/.test(readFileSync(f, "utf8")),
  );
}

function onDemandPage(): string {
  const found = onDemandPages();
  if (found.length !== 1) {
    throw new Error(
      `expected exactly ONE page.tsx under app/ to import resolveDynamicCity, found ${found.length}` +
        `${found.length ? `: ${found.map((f) => relative(ROOT, f)).join(", ")}` : ""}. ` +
        `Paso 32 must add the internal on-demand route that proxy.ts rewrites to.`,
    );
  }
  return found[0];
}

/**
 * The on-demand page plus every first-party module under app/ or components/ it
 * reaches, concatenated. A shared body component is a legitimate way to write
 * Paso 32, so an assert about the rendered page must not depend on the code
 * sitting in the route file itself. lib/ is deliberately EXCLUDED: pulling in
 * lib/city-routes.ts would make `toContain("indexPathname")` pass on the
 * definition of the helper rather than on a call to it.
 */
function bundle(entry: string, seen = new Set<string>()): string {
  if (seen.has(entry) || !existsSync(entry)) return "";
  seen.add(entry);
  const src = readFileSync(entry, "utf8");
  let out = src;
  for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
    const spec = m[1];
    const base = spec.startsWith("@/")
      ? join(ROOT, spec.slice(2))
      : spec.startsWith(".")
        ? resolve(dirname(entry), spec)
        : null;
    if (!base) continue;
    const rel = relative(ROOT, base).replace(/\\/g, "/");
    if (!/^(app|components)\//.test(rel)) continue;
    for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
      if (existsSync(base + ext)) {
        out += `\n${bundle(base + ext, seen)}`;
        break;
      }
    }
  }
  return out;
}

/** The `namespace: "..."` values a source asks next-intl for. */
function namespaces(source: string): string[] {
  return [...new Set([...source.matchAll(/namespace:\s*"([^"]+)"/g)].map((m) => m[1]))].sort();
}

// --- The proxy-side split. Pure function, tested directly, exactly like -------
// --- i18n/cross-locale-redirect.ts: proxy.ts stays a thin composition. --------

type Rewrite = (pathname: string) => string | null;
let rewrite: Rewrite | null = null;

/**
 * Loaded through `import.meta.glob` rather than a bare `import`, because a
 * static specifier for a module that does not exist yet fails the whole file at
 * transform time — every other assert here would report as "no tests" instead of
 * telling Paso 32 what to build. The glob simply omits a missing file.
 */
type Loader = () => Promise<{ onDemandCityRewrite?: Rewrite }>;
const i18nModules = (
  import.meta as unknown as { glob: (pattern: string) => Record<string, Loader> }
).glob("../../i18n/*.ts");

beforeAll(async () => {
  const key = Object.keys(i18nModules).find((k) => k.endsWith("/on-demand-city-rewrite.ts"));
  if (!key) return;
  rewrite = (await i18nModules[key]()).onDemandCityRewrite ?? null;
});

/** Throws with the contract spelled out rather than a bare "undefined is not a function". */
function rw(pathname: string): string | null {
  if (!rewrite) {
    throw new Error(
      "i18n/on-demand-city-rewrite.ts is missing. Paso 32 must export " +
        "`onDemandCityRewrite(pathname: string): string | null` from it: the internal path " +
        "to rewrite an on-demand city URL to, or null to leave the request alone.",
    );
  }
  return rewrite(pathname);
}

function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/** Every curated city URL actually served, all 438 of them. */
function curatedUrls(): string[] {
  const urls: string[] = [];
  for (const base of Object.keys(CITY_SLUGS)) {
    for (const locale of routing.locales) {
      urls.push(getPathname({ href: cityPathname(locale, base), locale }));
    }
  }
  return urls;
}

describe("the curated route file stays exactly what it is today", () => {
  /**
   * The 438 are a pure function of (lat, lon, elevation, tz, DOY_REFERENCE_YEAR)
   * and nothing on their render path reads a clock, so there is nothing to
   * regenerate. This line is the saving that moving the hubs out bought.
   */
  it("keeps revalidate = false", () => {
    expect(curated).toMatch(/export const revalidate = false/);
  });

  /**
   * THE WHOLE REASON FOR THE SPLIT. `force-dynamic` here would rebuild this file
   * as `f (Dynamic)` and stop prerendering all 438 — measured, Paso 4.
   */
  it("never goes force-dynamic", () => {
    expect(curated).not.toMatch(/export const dynamic\s*=/);
  });

  /** Not exported anywhere in the repo, so it is already true — leave it that way. */
  it("does not export dynamicParams", () => {
    expect(curated).not.toMatch(/export const dynamicParams/);
  });

  it("still prerenders the 438 curated params and nothing else", () => {
    expect(curated).toContain("generateStaticParams");
    expect(curated).toContain("cityStaticParams");
    expect(cityStaticParams()).toHaveLength(438);
  });

  /**
   * D-15 applies to the on-demand family ONLY. A stray `robots` here would
   * deindex 438 pages that between them carry every organic click the site gets.
   */
  it("is never marked noindex, and keeps its hreflang set", () => {
    expect(curated).not.toMatch(/index:\s*false/);
    expect(curated).toContain("buildCityAlternates");
  });

  /** Aviso 2: content-revision mirrors this exact set out of this exact file. */
  it("reads only the cityPage and sunTimes namespaces", () => {
    expect(namespaces(curated)).toEqual(["cityPage", "sunTimes"]);
  });

  /**
   * THE SPLIT, SEEN FROM THE STATIC SIDE. A Supabase round trip reachable from
   * this file would run during `next build` for all 438 and, worse, would be
   * baked into HTML cached forever.
   */
  it("cannot resolve an on-demand city — that code never enters this file", () => {
    expect(curated).not.toContain("resolveDynamicCity");
    expect(curated).not.toContain("city-dynamic");
  });

  /**
   * The header used to be the whole truth about where city pages live. It is not
   * any more, and a reader who lands here has no other way to learn that a
   * second route file answers the same URL shape.
   */
  it("its header points at the on-demand sibling and at where the split is decided", () => {
    expect(curated.slice(0, curated.indexOf("export function generateStaticParams"))).toMatch(
      /proxy|on-demand|on demand/i,
    );
  });
});

describe("the on-demand route file", () => {
  it("exists, exactly once, and is not the curated one", () => {
    expect(onDemandPages().map((f) => relative(ROOT, f))).toHaveLength(1);
    expect(onDemandPage()).not.toBe(CURATED);
  });

  /**
   * The single measured defence against unbounded ISR writes from outside. The
   * syntactic prefilter saves the database round trip, NOT the cache write: its
   * reject branch also ends in `notFound()`, and that is what gets cached. The
   * write quota closed the last 30-day window at 181% (362,730 of 200,000).
   */
  it("is force-dynamic, so a miss writes nothing to the full route cache", () => {
    expect(readFileSync(onDemandPage(), "utf8")).toMatch(
      /export const dynamic\s*=\s*["']force-dynamic["']/,
    );
  });

  it("is never prerendered", () => {
    expect(readFileSync(onDemandPage(), "utf8")).not.toContain("generateStaticParams");
  });

  /**
   * D-15: 1.38M thin URLs must not ask for a place in the index. `follow` so the
   * outbound links to the index and to the curated cities keep passing.
   */
  it("marks itself noindex, follow", () => {
    const source = readFileSync(onDemandPage(), "utf8");
    expect(source).toMatch(/index:\s*false/);
    expect(source).toMatch(/follow:\s*true/);
  });

  /**
   * Cross-links leave the on-demand layer and never re-enter it: to curated
   * pages by coordinate proximity, and to the index. A dynamic-to-dynamic mesh
   * would be a crawlable path into 1.38M URLs — the fourth lock of D-15.
   */
  it("cross-links only to curated pages and to the index", () => {
    const source = bundle(onDemandPage());
    expect(source).toContain("nearbyCitiesTo");
    expect(source).toContain("indexPathname");
    // Curated cross-links, by their own helper. `dynamicCityPathname` is NOT
    // forbidden here: the alias `id-2519240` has to 301 to the canonical slug,
    // and that is a redirect, not a crawlable link into the on-demand layer.
    expect(source).toMatch(/[^a-zA-Z]cityPathname\(/);
  });

  /**
   * `cityPage.dynamicProvenance` is an assertion about lib/: it tells the reader
   * this page was computed from the city's coordinates, its time zone AND its
   * elevation. `cityYearProfile(lat, lon, elevationM)` takes elevation as its
   * third argument and feeds `synthesisThresholdElevation`; drop it and the
   * sentence becomes a false claim printed on the page.
   */
  it("prints where its numbers come from, and honours that claim", () => {
    const source = bundle(onDemandPage());
    expect(source).toContain("dynamicProvenance");
    expect(source).toContain("dynamicNameLatin");
    expect(source).toContain("elevation");
    expect(source).toMatch(/cityYearProfile\([^)]*,[^)]*,[^)]*\)/);
  });

  /** Aviso 2 again: no third namespace on the on-demand render path either. */
  it("reads no namespace outside cityPage and sunTimes", () => {
    for (const ns of namespaces(bundle(onDemandPage()))) {
      expect(["cityPage", "sunTimes"]).toContain(ns);
    }
  });

  /**
   * app/__tests__/sun-hub-split.test.ts asserts that the directories under
   * app/[locale] owning a `[city]/page.tsx` are EXACTLY the six sun prefixes
   * plus `[cityPrefix]`. Putting the on-demand route at
   * `app/[locale]/<anything>/[city]/page.tsx` turns that suite red, and it is
   * load-bearing for 240 live hub URLs. Fail here instead, where the reason is
   * written down.
   */
  it("does not sit where it would break the sunrise hub tripwire", () => {
    const rel = relative(APP, dirname(onDemandPage())).replace(/\\/g, "/");
    expect(rel, "move it deeper: this shape collides with sun-hub-split").not.toMatch(
      /^\[locale\]\/[^/]+\/\[city\]$/,
    );
  });
});

describe("proxy.ts routes an on-demand slug to the on-demand file", () => {
  it("composes the rewrite helper and actually rewrites", () => {
    expect(proxySource).toContain("onDemandCityRewrite");
    expect(proxySource).toContain("NextResponse.rewrite");
  });

  /**
   * ORDER IS LOAD-BEARING. A cross-locale 404 like `/de/vitaminas-d/fyniksas`
   * has to keep its 301 to the German page; rewriting it first would serve it
   * in place and silently retire 118 redirects Search Console still crawls.
   */
  it("keeps the two 301 helpers ahead of the rewrite", () => {
    expect(proxySource.indexOf("legacyLocaleRedirect")).toBeLessThan(
      proxySource.indexOf("onDemandCityRewrite"),
    );
    expect(proxySource.indexOf("crossLocaleRedirect")).toBeLessThan(
      proxySource.indexOf("onDemandCityRewrite"),
    );
  });

  /** Everything that is not an on-demand city still falls through to next-intl. */
  it("still ends by handing the request to the intl middleware", () => {
    expect(proxySource).toMatch(/return intlMiddleware\(request\)/);
  });

  /**
   * The matcher must keep skipping /api, _next, _vercel and files with an
   * extension. Asserted on the exclusion list rather than the whole pattern so
   * the test is not a puzzle about how many backslashes survive into source.
   */
  it("does not widen the matcher", () => {
    expect(proxySource).toContain("(?!api|_next|_vercel");
    expect(proxySource).toContain("matcher");
  });
});

describe("the rewrite decides the split, and gets it right in both directions", () => {
  it.each([
    ["/vitamina-d/toledo-es", "es", "toledo-es"],
    ["/en/vitamin-d/toledo-es", "en", "toledo-es"],
    ["/fr/vitamine-d/toledo-es", "fr", "toledo-es"],
    ["/de/vitamin-d/toledo-es", "de", "toledo-es"],
    ["/ru/vitamin-d/toledo-es", "ru", "toledo-es"],
    ["/lt/vitaminas-d/toledo-es", "lt", "toledo-es"],
    // The tiebroken form: 11.9% of the table needs it, nearly one city in eight.
    ["/vitamina-d/springfield-us-4951788", "es", "springfield-us-4951788"],
  ])("sends %s to the on-demand file", (from, locale, slug) => {
    const to = rw(from);
    expect(to, `${from} must be rewritten, not left to the static file`).not.toBeNull();
    expect(to).not.toBe(from);
    // The locale is spelled out even for es, whose public URL carries no prefix:
    // the rewrite bypasses next-intl, so nothing downstream can infer it.
    expect(segments(to!)[0]).toBe(locale);
    expect(segments(to!).at(-1)).toBe(slug);
  });

  /**
   * THE ALIAS HAS TO REWRITE TOO. `id-2519240` does NOT match
   * `isDynamicCitySlug` — the regex demands a two-letter country segment at the
   * end — yet `resolveDynamicCity` accepts it, and it is the form the search
   * chip emits when all it holds is a geoname id. Route it by the prefilter
   * alone and every chip click lands on the static file and caches a 404.
   */
  it.each([
    ["/vitamina-d/id-2519240", "es"],
    ["/lt/vitaminas-d/id-2519240", "lt"],
  ])("sends the id alias %s to the on-demand file", (from, locale) => {
    const to = rw(from);
    expect(to, "the id alias is on-demand traffic, not garbage").not.toBeNull();
    expect(segments(to!)[0]).toBe(locale);
    expect(segments(to!).at(-1)).toBe("id-2519240");
  });

  /**
   * THE OTHER DIRECTION, on all 438 URLs really served. A curated page taken
   * over by the rewrite would lose its prerender, its indexability and its
   * hreflang — the pages that carry essentially all the organic traffic.
   */
  it("never touches a curated city URL", () => {
    const urls = curatedUrls();
    expect(urls).toHaveLength(438);
    for (const url of urls) expect(rw(url), url).toBeNull();
  });

  /**
   * The prefix check the curated file has always done is still load-bearing:
   * `/en/vitamina-d/...` must 404, not serve English content at a Spanish URL.
   * Rewriting it would publish every on-demand page at 3 URLs per locale.
   */
  it("requires the prefix to be the one that locale uses", () => {
    expect(rw("/en/vitamina-d/toledo-es")).toBeNull();
    expect(rw("/lt/vitamin-d/toledo-es")).toBeNull();
    // No locale segment means the default locale, whose prefix is `vitamina-d`.
    expect(rw("/vitamin-d/toledo-es")).toBeNull();
  });

  it.each([
    "/",
    "/es",
    "/dashboard",
    "/explore",
    "/vitamina-d",
    "/en/vitamin-d",
    "/api/cities",
    "/vitamina-d/toledo-es/extra",
    `/${SUN_PREFIX.es}/toledo-es`,
    `/${SUN_PREFIX.es}/madrid`,
  ])("leaves %s alone", (path) => {
    expect(rw(path)).toBeNull();
  });

  /**
   * NO REWRITE LOOP. Middleware runs again on the rewritten path in some
   * configurations; the target must not look like an on-demand city URL itself.
   */
  it("does not rewrite its own output", () => {
    const to = rw("/vitamina-d/toledo-es")!;
    expect(rw(to)).toBeNull();
  });

  /**
   * A rewrite to a path no route file answers is a 404 that looks like a bug in
   * the database. Segment count and every literal segment must line up with the
   * folder the on-demand page actually sits in.
   */
  it("targets the folder the on-demand page actually sits in", () => {
    const dir = relative(APP, dirname(onDemandPage()))
      .replace(/\\/g, "/")
      .split("/")
      .filter((s) => s.length > 0 && !/^\(.*\)$/.test(s));
    const target = segments(rw("/vitamina-d/toledo-es")!);
    expect(target, `rewrite target must have one segment per folder in app/${dir.join("/")}`)
      .toHaveLength(dir.length);
    dir.forEach((folder, i) => {
      if (!folder.startsWith("[")) expect(target[i], `segment ${i}`).toBe(folder);
    });
  });

  /** Sanity: the prefixes this test builds URLs from are the real ones. */
  it("is written against the real prefix table", () => {
    expect(CITY_PREFIX.es).toBe("vitamina-d");
    expect(CITY_PREFIX.lt).toBe("vitaminas-d");
  });

  /**
   * JUNK THAT LOOKS LIKE NOTHING STILL GOES ON-DEMAND, and this is the assert
   * that keeps it that way.
   *
   * The rewrite used to stop unless the slug looked dynamic or was an id alias.
   * Measured in production on 2026-08-26: `/vitamina-d/zzzzzz` matches neither,
   * so it fell through to the curated file and came back `x-vercel-cache: HIT`
   * on the second request — a 404 written to the cache, against a quota that
   * closed its last window at 181%. Only junk that happened to look dynamic was
   * protected, which is the wrong half.
   *
   * Nothing pinned that behaviour before, in either direction, so re-adding the
   * prefilter would have reopened the hole silently. It will now go red.
   *
   * Supabase is not exposed by this: `resolveDynamicCity` applies the same
   * prefilter itself, so an unresolvable shape returns null without a round trip.
   */
  it.each(["zzzzzz", "noexiste", "madrid2", "a", "1234"])(
    "rewrites %s, which can never resolve, rather than letting the curated file cache its 404",
    (slug) => {
      const from = `/${CITY_PREFIX.es}/${slug}`;
      const to = rw(from);
      expect(to, `${from} must be rewritten, not left to the static file`).not.toBeNull();
      expect(to).not.toBe(from);
      expect(segments(to!)[0]).toBe("es");
      expect(segments(to!).at(-1)).toBe(slug);
    },
  );

  /** The curated wall is now the only thing holding, so assert it directly. */
  it("still refuses to touch a curated slug", () => {
    expect(rw(`/${CITY_PREFIX.es}/madrid`)).toBeNull();
    expect(rw(`/en/${CITY_PREFIX.en}/london`)).toBeNull();
  });
});
