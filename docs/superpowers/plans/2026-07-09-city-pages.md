# Per-City SEO Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statically generate 438 per-city landing pages (73 builtin cities × 6 locales) with localized URLs and real build-time-computed vitamin-D data, to capture long-tail search.

**Architecture:** Pure helper modules (`city-slug`, `city-routes`, `city-content`) feed a static server component at `app/[locale]/[cityPrefix]/[city]/page.tsx` with `generateStaticParams`. All content is computed at build time from the existing pure functions (`vitDHrs`, `getCurve`, `computeExposureFromCurve`) — no network. Copy comes from a new `cityPage` ICU namespace; city names reuse the existing `cities.<slug>` keys.

**Tech Stack:** Next 16 (App Router, async `params`), next-intl 4.8 (`as-needed` prefix, default `es`), React 19, Vitest 4.

**Baseline:** branch `feat/city-pages`. Spec: `docs/superpowers/specs/2026-07-09-city-pages-design.md`.

## Conventions

- Single test file: `npx vitest run <path>`. All tests: `npm test`. Build: `npm run build`.
- The `middleware`→`proxy` deprecation warning during build is expected/OK.
- Commit after every task, foreground, ending with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- `@/*` maps to the project root.

## Existing API you will use (verbatim signatures — do not re-derive)

```ts
// lib/solar.ts
export function vitDHrs(lat: number, doy: number, thr: number): number   // 0 when synthesis impossible
export function getCurve(lat: number, lon: number, doy: number, tz: number, timezone?: string): SolarPoint[]
export function dateFromDoy(doy: number): Date

// lib/vitd.ts
export const MIN_UVI_ELEVATION: number            // 20.14° — elevation where clear-sky UVI hits 3
                                                  // (the "~19.1 degrees" comment in vitd.ts is stale; see follow-ups)
export type SkinType = 1 | 2 | 3 | 4 | 5 | 6;
export interface ExposureResult {
  bestHour: number; bestUVI: number; minutesNeeded: number; maxIU: number;
  targetCapped: boolean; windowStart: number; windowEnd: number;
  hourlyMinutes: { hour: number; uvi: number; minutes: number | null }[];
}
export function computeExposureFromCurve(
  curve: SolarPoint[], skinType: SkinType, areaFraction: number,
  targetIU?: number, age?: number | null,
): ExposureResult | null

// lib/cities.ts
export const BUILTIN_CITIES: City[]  // 73 entries; City = {id:"builtin:<slug>", name, lat, lon, tz, timezone, flag, source}

// i18n/routing.ts       export const routing            // locales ["es","en","fr","de","ru","lt"], defaultLocale "es"
// i18n/navigation.ts    export function getPathname({href, locale}): string
// lib/site.ts           export const SITE_URL: string
```

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/city-slug.ts` | `slugify(name)` — lowercase, Cyrillic transliteration, diacritic strip, ASCII slug | Create |
| `lib/city-routes.ts` | per-locale path prefix, localized slug, reverse lookup, static params, `buildCityAlternates` | Create |
| `lib/city-content.ts` | `cityYearProfile(lat)`, `citySeasonalWindows(lat,lon,tz)` — pure build-time content | Create |
| `lib/city-copy.ts` | Per-locale grammar: article contraction, elision, genitive months, capitalization, chart labels | Create |
| `components/CityYearStrip.tsx` | Static SVG year strip (server component) | Create |
| `messages/{es,en,fr,de,ru,lt}.json` | New `cityPage` ICU namespace | Modify |
| `app/[locale]/[cityPrefix]/[city]/page.tsx` | SSG page: params, metadata, content, FAQ schema | Create |
| `app/sitemap.ts` | +438 city URLs with hreflang | Modify |
| `scripts/smoke-i18n.sh` | Add city-page smoke checks | Modify |

---

### Task 1: `lib/city-slug.ts` — ASCII slugify with transliteration

**Files:**
- Create: `lib/city-slug.ts`
- Test: `lib/__tests__/city-slug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/city-slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/city-slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("London")).toBe("london");
    expect(slugify("Nueva York")).toBe("nueva-york");
    expect(slugify("New York")).toBe("new-york");
  });

  it("strips Latin diacritics", () => {
    expect(slugify("Zürich")).toBe("zurich");
    expect(slugify("Malaga")).toBe("malaga");
    expect(slugify("Šiauliai")).toBe("siauliai");
    expect(slugify("Londonas")).toBe("londonas");
  });

  it("transliterates Cyrillic", () => {
    expect(slugify("Лондон")).toBe("london");
    expect(slugify("Москва")).toBe("moskva");
    expect(slugify("Нью-Йорк")).toBe("nyu-york");
  });

  it("collapses separators and trims", () => {
    expect(slugify("  Ciudad  de   Mexico ")).toBe("ciudad-de-mexico");
    expect(slugify("São Paulo")).toBe("sao-paulo");
  });

  it("returns empty string when nothing slugifiable remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/city-slug.test.ts`
Expected: FAIL — cannot resolve `@/lib/city-slug`.

- [ ] **Step 3: Create `lib/city-slug.ts`**

```ts
// Lowercase Cyrillic → Latin. Applied after toLowerCase(), so only lowercase keys.
// `й` → "y" per BGN/PCGN, so "Нью-Йорк" → "nyu-york" (not "nyu-iork").
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * Turns a city name (in any of the 6 supported locales) into a stable ASCII URL
 * slug: lowercase → Cyrillic transliteration → strip Latin diacritics → collapse
 * non-alphanumerics into single hyphens. Deterministic: same name always yields
 * the same slug, so URLs stay stable across builds.
 */
export function slugify(name: string): string {
  const lower = name.toLowerCase();
  const translit = Array.from(lower)
    .map((ch) => (ch in CYRILLIC ? CYRILLIC[ch] : ch))
    .join("");
  const noDiacritics = translit.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return noDiacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/city-slug.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/city-slug.ts "lib/__tests__/city-slug.test.ts"
git commit -m "feat(city-pages): add ASCII slugify with Cyrillic transliteration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `lib/city-routes.ts` — localized routes and alternates

**Files:**
- Create: `lib/city-routes.ts`
- Test: `lib/__tests__/city-routes.test.ts`

Note: `messages/*.json` are imported directly (they are static JSON; `resolveJsonModule` is on via Next's tsconfig).

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/city-routes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CITY_PREFIX, baseSlug, localizedCitySlug, cityIdFromSlug,
  cityPathname, cityUrl, buildCityAlternates, cityStaticParams,
} from "@/lib/city-routes";
import { BUILTIN_CITIES } from "@/lib/cities";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

describe("city-routes", () => {
  it("strips the builtin: prefix", () => {
    expect(baseSlug("builtin:nueva-york")).toBe("nueva-york");
  });

  it("localizes the city slug per locale", () => {
    expect(localizedCitySlug("es", "londres")).toBe("londres");
    expect(localizedCitySlug("en", "londres")).toBe("london");
    expect(localizedCitySlug("lt", "londres")).toBe("londonas");
  });

  // ru names are Cyrillic renderings of names that are usually Latin already.
  // Transliterating them back would yield khelsinki / tsyurikh / parizh.
  it("uses the real Latin (en) name for ru slugs, never a back-transliteration", () => {
    expect(localizedCitySlug("ru", "helsinki")).toBe("helsinki");
    expect(localizedCitySlug("ru", "zurich")).toBe("zurich");
    expect(localizedCitySlug("ru", "paris")).toBe("paris");
    expect(localizedCitySlug("ru", "ciudad-de-mexico")).toBe("mexico-city");
    expect(localizedCitySlug("ru", "moscu")).toBe("moscow");
  });

  it("round-trips slug → cityId for every city in every locale", () => {
    for (const locale of routing.locales) {
      for (const city of BUILTIN_CITIES) {
        const base = baseSlug(city.id);
        const slug = localizedCitySlug(locale, base);
        expect(cityIdFromSlug(locale, slug)).toBe(city.id);
      }
    }
  });

  it("produces unique slugs within each locale", () => {
    for (const locale of routing.locales) {
      const slugs = BUILTIN_CITIES.map((c) => localizedCitySlug(locale, baseSlug(c.id)));
      expect(new Set(slugs).size).toBe(BUILTIN_CITIES.length);
    }
  });

  it("builds the localized pathname and absolute url", () => {
    expect(cityPathname("es", "madrid")).toBe("/vitamina-d/madrid");
    expect(cityPathname("en", "londres")).toBe("/vitamin-d/london");
    expect(cityUrl("es", "madrid")).toBe(`${SITE_URL}/vitamina-d/madrid`);
    expect(cityUrl("en", "londres")).toBe(`${SITE_URL}/en/vitamin-d/london`);
  });

  it("builds self-referencing canonical + 6 alternates + x-default (es)", () => {
    const alt = buildCityAlternates("en", "londres");
    expect(alt.canonical).toBe(`${SITE_URL}/en/vitamin-d/london`);
    expect(alt.languages.es).toBe(`${SITE_URL}/vitamina-d/londres`);
    expect(alt.languages.fr).toBe(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(alt.languages.ru).toBe(`${SITE_URL}/ru/vitamin-d/london`);
    expect(alt.languages.lt).toBe(`${SITE_URL}/lt/vitaminas-d/londonas`);
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/vitamina-d/londres`);
  });

  it("keeps every locale's URL for a city distinct", () => {
    for (const city of BUILTIN_CITIES) {
      const base = baseSlug(city.id);
      const urls = routing.locales.map((l) => cityUrl(l, base));
      expect(new Set(urls).size).toBe(routing.locales.length);
    }
  });

  it("emits 438 static params (73 cities × 6 locales)", () => {
    const params = cityStaticParams();
    expect(params).toHaveLength(BUILTIN_CITIES.length * routing.locales.length);
    expect(params).toContainEqual({ locale: "en", cityPrefix: "vitamin-d", city: "london" });
  });

  it("returns null for an unknown slug", () => {
    expect(cityIdFromSlug("en", "atlantis")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/city-routes.test.ts`
Expected: FAIL — cannot resolve `@/lib/city-routes`.

- [ ] **Step 3: Create `lib/city-routes.ts`**

```ts
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { BUILTIN_CITIES } from "./cities";
import { slugify } from "./city-slug";
import { SITE_URL } from "./site";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

type Locale = (typeof routing.locales)[number];

const CITY_NAMES: Record<string, Record<string, string>> = {
  es: (es as { cities: Record<string, string> }).cities,
  en: (en as { cities: Record<string, string> }).cities,
  fr: (fr as { cities: Record<string, string> }).cities,
  de: (de as { cities: Record<string, string> }).cities,
  ru: (ru as { cities: Record<string, string> }).cities,
  lt: (lt as { cities: Record<string, string> }).cities,
};

/** Path prefix per locale — ASCII, keyword-bearing. */
export const CITY_PREFIX: Record<string, string> = {
  es: "vitamina-d",
  en: "vitamin-d",
  fr: "vitamine-d",
  de: "vitamin-d",
  ru: "vitamin-d",
  lt: "vitaminas-d",
};

/** "builtin:nueva-york" → "nueva-york" */
export function baseSlug(cityId: string): string {
  return cityId.replace(/^builtin:/, "");
}

/** The city's display name in `locale`, falling back to the base slug. */
export function localizedCityName(locale: string, base: string): string {
  return CITY_NAMES[locale]?.[base] ?? base;
}

/**
 * Locales whose names are written in a non-Latin script borrow another locale's
 * name for the URL slug. `ru` city names are Cyrillic renderings of names that
 * are already Latin ("Helsinki" → "Хельсинки"); transliterating them back would
 * double-transliterate into "khelsinki" / "tsyurikh" / "parizh". Only `Москва`
 * is Cyrillic-native, and "moscow" is a perfectly good slug for it.
 */
const LATIN_SLUG_LOCALE: Record<string, string> = { ru: "en" };

/**
 * ASCII slug of the city's name in `locale`. For non-Latin-script locales this
 * is the name borrowed from `LATIN_SLUG_LOCALE`. Falls back to transliterating
 * the locale's own name (which is what makes `slugify`'s Cyrillic map reachable
 * for a future city that has no `en` name), and finally to the base slug.
 */
export function localizedCitySlug(locale: string, base: string): string {
  const latinSource = LATIN_SLUG_LOCALE[locale] ?? locale;
  return (
    slugify(localizedCityName(latinSource, base)) ||
    slugify(localizedCityName(locale, base)) ||
    base
  );
}

// Reverse index, built once: locale → localized slug → cityId.
const SLUG_TO_ID: Record<string, Record<string, string>> = (() => {
  const index: Record<string, Record<string, string>> = {};
  for (const locale of routing.locales) {
    index[locale] = {};
    for (const city of BUILTIN_CITIES) {
      index[locale][localizedCitySlug(locale, baseSlug(city.id))] = city.id;
    }
  }
  return index;
})();

export function cityIdFromSlug(locale: string, slug: string): string | null {
  return SLUG_TO_ID[locale]?.[slug] ?? null;
}

/** Locale-local path (no locale prefix): "/vitamin-d/london" */
export function cityPathname(locale: string, base: string): string {
  return `/${CITY_PREFIX[locale]}/${localizedCitySlug(locale, base)}`;
}

/** Absolute URL including the locale prefix (es is prefix-free). */
export function cityUrl(locale: string, base: string): string {
  return `${SITE_URL}${getPathname({ href: cityPathname(locale, base), locale: locale as Locale })}`;
}

/**
 * Canonical (self-referencing) + hreflang alternates for a city, mirroring the
 * shape of `buildLanguageAlternates` in i18n/metadata.ts but with localized slugs.
 * x-default points at the default-locale (es) version of the same city.
 */
export function buildCityAlternates(
  locale: string,
  base: string,
): { canonical: string; languages: Record<string, string> } {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = cityUrl(l, base);
  languages["x-default"] = cityUrl(routing.defaultLocale, base);
  return { canonical: cityUrl(locale, base), languages };
}

/** All 438 (locale, cityPrefix, city) combinations for generateStaticParams. */
export function cityStaticParams(): { locale: string; cityPrefix: string; city: string }[] {
  return routing.locales.flatMap((locale) =>
    BUILTIN_CITIES.map((c) => ({
      locale,
      cityPrefix: CITY_PREFIX[locale],
      city: localizedCitySlug(locale, baseSlug(c.id)),
    })),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/city-routes.test.ts`
Expected: PASS (8 tests).

If the uniqueness test fails (two cities collide on a slug in some locale), STOP and report — the spec's fallback rule needs a disambiguation suffix, which is a design change.

- [ ] **Step 5: Commit**

```bash
git add lib/city-routes.ts "lib/__tests__/city-routes.test.ts"
git commit -m "feat(city-pages): localized city routes, slugs and hreflang alternates

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `lib/city-content.ts` — build-time computed content

**Files:**
- Create: `lib/city-content.ts`
- Test: `lib/__tests__/city-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/city-content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  cityYearProfile, citySeasonalWindows, contiguousMonthRange, REPRESENTATIVE_DOYS,
} from "@/lib/city-content";

describe("cityYearProfile", () => {
  it("marks high-latitude winter months impossible (Reykjavik 64.15N)", () => {
    const p = cityYearProfile(64.15);
    expect(p.allYear).toBe(false);
    expect(p.impossibleMonths).toContain(12); // December
    expect(p.impossibleMonths).toContain(1);  // January
    expect(p.possibleMonths).toContain(6);    // June
  });

  it("is possible year-round near the equator (Singapore 1.35N)", () => {
    const p = cityYearProfile(1.35);
    expect(p.allYear).toBe(true);
    expect(p.impossibleMonths).toEqual([]);
    expect(p.possibleMonths).toHaveLength(12);
  });

  // Sydney (-33.87) does NOT have a vitamin-D winter: on the June solstice its
  // noon sun still reaches ~32.7°, well over the ~20.1° threshold, leaving 5.6
  // viable hours. This matches reality (UV index >= 3 year-round in Sydney).
  // The threshold latitude is |lat| > 90 - 23.44 - MIN_UVI_ELEVATION = 46.4°,
  // and NO builtin city — northern or southern — lies beyond it in the south
  // (the most southerly is Melbourne at -37.81). So the southern flip must be
  // asserted at a latitude far enough south, not at a builtin city.
  it("has no impossible months in Sydney (-33.87)", () => {
    expect(cityYearProfile(-33.87).allYear).toBe(true);
  });

  it("flips the impossible band into the southern winter far enough south (-54.8)", () => {
    const p = cityYearProfile(-54.8);
    expect(p.allYear).toBe(false);
    expect(p.possibleMonths).toContain(1);   // January = southern summer
    expect(p.impossibleMonths).toEqual([5, 6, 7]); // May-July = southern winter
    // The possible band wraps across January: August → April.
    expect(contiguousMonthRange(p.possibleMonths)).toEqual({ start: 8, end: 4 });
  });

  it("returns 365 daily hour values", () => {
    expect(cityYearProfile(40.42).hoursByDay).toHaveLength(365);
  });
});

describe("contiguousMonthRange", () => {
  it("returns the band for a northern-hemisphere run", () => {
    expect(contiguousMonthRange([4, 5, 6, 7, 8, 9])).toEqual({ start: 4, end: 9 });
  });

  it("wraps across the year boundary (southern hemisphere)", () => {
    expect(contiguousMonthRange([1, 2, 3, 4, 10, 11, 12])).toEqual({ start: 10, end: 4 });
  });

  it("returns null for all-year and for empty", () => {
    expect(contiguousMonthRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBeNull();
    expect(contiguousMonthRange([])).toBeNull();
  });
});

describe("citySeasonalWindows", () => {
  it("returns one entry per representative day", () => {
    const w = citySeasonalWindows(40.42, -3.7, 1); // Madrid
    expect(w).toHaveLength(REPRESENTATIVE_DOYS.length);
    expect(w.map((x) => x.doy)).toEqual(REPRESENTATIVE_DOYS);
  });

  it("marks the June solstice possible and gives a window in Madrid", () => {
    const june = citySeasonalWindows(40.42, -3.7, 1).find((x) => x.doy === 172)!;
    expect(june.possible).toBe(true);
    expect(june.windowStart).not.toBeNull();
    expect(june.windowEnd).not.toBeNull();
    expect(june.minutesNeeded).toBeGreaterThan(0);
  });

  it("marks the December solstice impossible in Reykjavik", () => {
    const dec = citySeasonalWindows(64.15, -21.94, 0).find((x) => x.doy === 355)!;
    expect(dec.possible).toBe(false);
    expect(dec.windowStart).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/city-content.test.ts`
Expected: FAIL — cannot resolve `@/lib/city-content`.

- [ ] **Step 3: Create `lib/city-content.ts`**

```ts
import { vitDHrs, getCurve, dateFromDoy } from "./solar";
import { MIN_UVI_ELEVATION, computeExposureFromCurve, type SkinType } from "./vitd";

// Defaults used for the public page copy (Fitzpatrick III, arms+face, 1000 IU).
const DEFAULT_SKIN: SkinType = 3;
const DEFAULT_AREA = 0.25;
const DEFAULT_TARGET_IU = 1000;

/** March equinox, June solstice, September equinox, December solstice. */
export const REPRESENTATIVE_DOYS = [80, 172, 264, 355];

export interface CityYearProfile {
  /** vitDHrs for doy 1..365 at this latitude. */
  hoursByDay: number[];
  /** 1-12, months where synthesis is possible on most days. */
  possibleMonths: number[];
  /** 1-12, the complement of possibleMonths. */
  impossibleMonths: number[];
  allYear: boolean;
  neverPossible: boolean;
}

/**
 * Year-round synthesis profile for a latitude. A month counts as "possible" when
 * synthesis is achievable on at least half of its days — that keeps shoulder
 * months (a handful of viable days) out of the headline claim.
 */
export function cityYearProfile(lat: number): CityYearProfile {
  const hoursByDay = Array.from({ length: 365 }, (_, i) => vitDHrs(lat, i + 1, MIN_UVI_ELEVATION));

  const daysPerMonth = Array.from({ length: 12 }, () => 0);
  const possibleDaysPerMonth = Array.from({ length: 12 }, () => 0);
  for (let doy = 1; doy <= 365; doy++) {
    const monthIndex = dateFromDoy(doy).getMonth(); // 0-11
    daysPerMonth[monthIndex] += 1;
    if (hoursByDay[doy - 1] > 0) possibleDaysPerMonth[monthIndex] += 1;
  }

  const possibleMonths: number[] = [];
  const impossibleMonths: number[] = [];
  for (let m = 0; m < 12; m++) {
    if (possibleDaysPerMonth[m] * 2 >= daysPerMonth[m]) possibleMonths.push(m + 1);
    else impossibleMonths.push(m + 1);
  }

  return {
    hoursByDay,
    possibleMonths,
    impossibleMonths,
    allYear: impossibleMonths.length === 0,
    neverPossible: possibleMonths.length === 0,
  };
}

/**
 * Given a set of 1-12 month numbers, returns the contiguous band as {start, end},
 * wrapping across the year boundary — southern-hemisphere cities have their
 * possible months split around January (e.g. [1,2,3,4,10,11,12] → Oct–Apr).
 * Returns null when the set is empty or covers all 12 months (no band to name).
 */
export function contiguousMonthRange(months: number[]): { start: number; end: number } | null {
  if (months.length === 0 || months.length === 12) return null;
  const set = new Set(months);
  const prev = (m: number) => (m === 1 ? 12 : m - 1);
  const next = (m: number) => (m === 12 ? 1 : m + 1);

  const start = months.find((m) => !set.has(prev(m)));
  if (start === undefined) return null;

  let end = start;
  while (set.has(next(end)) && next(end) !== start) end = next(end);
  return { start, end };
}

export interface SeasonWindow {
  doy: number;
  /** 0-11, for Intl month formatting by the caller. */
  monthIndex: number;
  possible: boolean;
  windowStart: number | null;
  windowEnd: number | null;
  minutesNeeded: number | null;
}

/** Sun windows on the four representative days, using the page's default profile. */
export function citySeasonalWindows(lat: number, lon: number, tz: number): SeasonWindow[] {
  return REPRESENTATIVE_DOYS.map((doy) => {
    const curve = getCurve(lat, lon, doy, tz);
    const exposure = computeExposureFromCurve(curve, DEFAULT_SKIN, DEFAULT_AREA, DEFAULT_TARGET_IU);
    const monthIndex = dateFromDoy(doy).getMonth();

    if (!exposure || exposure.windowStart < 0 || exposure.windowEnd < 0) {
      return { doy, monthIndex, possible: false, windowStart: null, windowEnd: null, minutesNeeded: null };
    }
    return {
      doy,
      monthIndex,
      possible: true,
      windowStart: exposure.windowStart,
      windowEnd: exposure.windowEnd,
      minutesNeeded: exposure.minutesNeeded,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/city-content.test.ts`
Expected: PASS (11 tests).

If a physics assertion fails, do NOT weaken the test — investigate `vitDHrs`'s
threshold semantics and report findings. (This already happened once: the original
plan asserted an impossible June in Sydney. The code was right and the plan was
wrong — Sydney is above the 46.4° cutoff — so the *test* was corrected, after
verifying the model against reality. That is the process working, not a licence to
edit assertions until they pass.)

- [ ] **Step 5: Commit**

```bash
git add lib/city-content.ts "lib/__tests__/city-content.test.ts"
git commit -m "feat(city-pages): build-time year profile and seasonal windows per city

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `lib/city-copy.ts` — per-locale grammar helpers

**Why this task exists.** Six native-level copy reviews (one per locale) found that
interpolating a raw city name and a raw `Intl` month into these templates produces
broken grammar in four of the six languages:

| Locale | Naive render | Correct |
|---|---|---|
| fr | `à Le Caire` | `au Caire` |
| fr | `de avril` | `d'avril` |
| ru | `с январь по июнь` | `с января по июнь` |
| lt | `nuo sausis iki birželis` | `nuo sausio iki birželio` |
| es/fr/ru/lt | `enero: entre las…` | `Enero: entre las…` |

So the page must pass **already-inflected values** into ICU, not raw ones. ICU
cannot elide, contract, or change case. This module owns that grammar.

Key facts, all verified by running `Intl`:
- `Intl.DateTimeFormat(locale, {month:"long"})` → nominative (`"enero"`, `"январь"`, `"sausis"`, `"January"`).
- Adding `day:"numeric"` exposes the genitive: ru `"15 января"` → `января`; lt `"sausio 15 d."` → `sausio`.
- ru: `с` governs genitive but `по` governs accusative, and months are masculine
  inanimate, so accusative == nominative. **Only `startMonth` becomes genitive.**
- lt: `nuo … iki …` governs genitive on **both** months.
- fr: only `Le Caire` and `Le Cap` carry a French article. `Las Palmas` and
  `Los Angeles` carry a *Spanish* article that must NOT be contracted (`à Las Palmas`
  is correct). Contract on the French article only.
- fr elision: `avril`, `août`, `octobre` need `d'`; the other nine take `de `.
- lt `{month:"narrow"}` and `{month:"short"}` both return `"01".."12"`, not letters.

**Files:**
- Create: `lib/city-copy.ts`
- Test: `lib/__tests__/city-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/city-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  capFirst, monthName, monthGenitive, frAtCity, frFromMonth,
  monthLabels, cityLabels, verdictMonths,
} from "@/lib/city-copy";

describe("capFirst", () => {
  it("uppercases only the first character", () => {
    expect(capFirst("enero")).toBe("Enero");
    expect(capFirst("январь")).toBe("Январь");
    expect(capFirst("sausis")).toBe("Sausis");
    expect(capFirst("")).toBe("");
  });
});

describe("monthName", () => {
  it("returns the nominative long month", () => {
    expect(monthName("es", 0)).toBe("enero");
    expect(monthName("en", 0)).toBe("January");
    expect(monthName("ru", 0)).toBe("январь");
    expect(monthName("lt", 0)).toBe("sausis");
  });
});

describe("monthGenitive", () => {
  it("returns the genitive for ru (strips the day)", () => {
    expect(monthGenitive("ru", 0)).toBe("января");
    expect(monthGenitive("ru", 5)).toBe("июня");
    expect(monthGenitive("ru", 11)).toBe("декабря");
  });

  it("returns the genitive for lt (strips the day and the 'd.' marker)", () => {
    expect(monthGenitive("lt", 0)).toBe("sausio");
    expect(monthGenitive("lt", 5)).toBe("birželio");
    expect(monthGenitive("lt", 11)).toBe("gruodžio");
  });

  it("falls back to the nominative for locales without a genitive form", () => {
    expect(monthGenitive("es", 0)).toBe("enero");
    expect(monthGenitive("en", 0)).toBe("January");
    expect(monthGenitive("de", 0)).toBe("Januar");
    expect(monthGenitive("fr", 0)).toBe("janvier");
  });

  it("never leaves digits or stray punctuation behind", () => {
    for (const locale of ["ru", "lt"]) {
      for (let m = 0; m < 12; m++) {
        const g = monthGenitive(locale, m);
        expect(g).not.toMatch(/[0-9.]/);
        expect(g).toBe(g.trim());
        expect(g.length).toBeGreaterThan(2);
      }
    }
  });
});

describe("frAtCity", () => {
  it("contracts the French definite article", () => {
    expect(frAtCity("Le Caire")).toBe("au Caire");
    expect(frAtCity("Le Cap")).toBe("au Cap");
  });

  it("leaves Spanish articles alone", () => {
    expect(frAtCity("Las Palmas")).toBe("à Las Palmas");
    expect(frAtCity("Los Angeles")).toBe("à Los Angeles");
  });

  it("handles the plain case and the other French articles", () => {
    expect(frAtCity("Londres")).toBe("à Londres");
    expect(frAtCity("Les Sables")).toBe("aux Sables");
    expect(frAtCity("La Havane")).toBe("à la Havane");
    expect(frAtCity("L'Aquila")).toBe("à l'Aquila");
  });
});

describe("frFromMonth", () => {
  it("elides before a vowel-initial month", () => {
    expect(frFromMonth("avril")).toBe("d'avril");
    expect(frFromMonth("août")).toBe("d'août");
    expect(frFromMonth("octobre")).toBe("d'octobre");
  });

  it("does not elide otherwise", () => {
    expect(frFromMonth("mars")).toBe("de mars");
    expect(frFromMonth("septembre")).toBe("de septembre");
  });
});

describe("monthLabels", () => {
  it("returns 12 labels", () => {
    for (const l of ["es", "en", "fr", "de", "ru", "lt"]) {
      expect(monthLabels(l)).toHaveLength(12);
    }
  });

  it("uses letters for lt instead of Intl's numeric labels", () => {
    const lt = monthLabels("lt");
    expect(lt[0]).toBe("saus.");
    expect(lt[5]).toBe("birž.");
    expect(lt.every((l) => !/^\d+$/.test(l))).toBe(true);
  });

  it("uses Intl narrow labels elsewhere", () => {
    expect(monthLabels("en")[0]).toBe("J");
  });
});

describe("cityLabels", () => {
  it("exposes the French contracted forms for fr", () => {
    expect(cityLabels("fr", "Le Caire")).toEqual({
      city: "Le Caire", atCity: "au Caire", atCityCap: "Au Caire",
    });
    expect(cityLabels("fr", "Londres").atCityCap).toBe("À Londres");
  });

  it("falls back to the plain name for non-fr locales", () => {
    expect(cityLabels("es", "Madrid")).toEqual({
      city: "Madrid", atCity: "Madrid", atCityCap: "Madrid",
    });
  });
});

describe("verdictMonths", () => {
  it("ru: genitive start, nominative end (по governs the accusative)", () => {
    expect(verdictMonths("ru", 0, 5)).toMatchObject({
      startMonth: "января", endMonth: "июнь",
    });
  });

  it("lt: genitive on both months", () => {
    expect(verdictMonths("lt", 0, 5)).toMatchObject({
      startMonth: "sausio", endMonth: "birželio",
    });
  });

  it("fr: supplies the elided de/d' forms", () => {
    expect(verdictMonths("fr", 3, 8)).toMatchObject({
      fromMonth: "d'avril", fromMonthCap: "D'avril", endMonth: "septembre",
    });
    expect(verdictMonths("fr", 2, 8).fromMonth).toBe("de mars");
  });

  it("es/en/de: plain nominative on both", () => {
    expect(verdictMonths("es", 0, 5)).toMatchObject({ startMonth: "enero", endMonth: "junio" });
    expect(verdictMonths("en", 0, 5)).toMatchObject({ startMonth: "January", endMonth: "June" });
    expect(verdictMonths("de", 0, 5)).toMatchObject({ startMonth: "Januar", endMonth: "Juni" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/__tests__/city-copy.test.ts`
Expected: FAIL — cannot resolve `@/lib/city-copy`.

- [ ] **Step 3: Create `lib/city-copy.ts`**

```ts
/**
 * Per-locale grammar for the city pages.
 *
 * ICU cannot elide, contract or change case, so every value handed to a
 * `cityPage` message must already be in the form its template needs. Each helper
 * here owns one such transformation. All are pure and run at build time.
 */

/** A fixed reference year keeps month formatting deterministic across builds. */
const REF_YEAR = 2026;
const REF_DAY = 15;

const refDate = (monthIndex: number) => new Date(REF_YEAR, monthIndex, REF_DAY);

export function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nominative long month name, e.g. "enero" / "January" / "январь" / "sausis". */
export function monthName(locale: string, monthIndex: number): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(refDate(monthIndex));
}

/** Locales whose month names must be declined in "from X to Y" constructions. */
const GENITIVE_LOCALES = new Set(["ru", "lt"]);

/**
 * Genitive month name for ru/lt, obtained by formatting with a day — which puts
 * the month into its genitive form ("15 января", "sausio 15 d.") — and stripping
 * the day back out. Other locales have no genitive, so the nominative is returned.
 */
export function monthGenitive(locale: string, monthIndex: number): string {
  if (!GENITIVE_LOCALES.has(locale)) return monthName(locale, monthIndex);
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" })
    .format(refDate(monthIndex))
    .replace(/[0-9]/g, "")
    .replace(/\s*d\.\s*$/, "") // lt appends a "d." day marker
    .replace(/[.,]/g, "")
    .trim();
}

/**
 * French: put the city into "à <city>", contracting the definite article.
 * Only the FRENCH article contracts — "Las Palmas" and "Los Angeles" carry a
 * Spanish article and stay literal ("à Las Palmas").
 */
export function frAtCity(name: string): string {
  if (name.startsWith("Le ")) return `au ${name.slice(3)}`;
  if (name.startsWith("Les ")) return `aux ${name.slice(4)}`;
  if (name.startsWith("La ")) return `à la ${name.slice(3)}`;
  if (name.startsWith("L'")) return `à l'${name.slice(2)}`;
  return `à ${name}`;
}

/** French elision: "de mars" but "d'avril" / "d'août" / "d'octobre". */
export function frFromMonth(month: string): string {
  return /^[aeiouâàéèêîôûh]/i.test(month) ? `d'${month}` : `de ${month}`;
}

/**
 * Lithuanian has no alphabetic month abbreviations in CLDR — both `narrow` and
 * `short` return "01".."12" — so the chart would show numbers where every other
 * locale shows letters. These are the standard lt abbreviations.
 */
const LT_MONTH_LABELS = [
  "saus.", "vas.", "kov.", "bal.", "geg.", "birž.",
  "liep.", "rugp.", "rugs.", "spal.", "lapkr.", "gruod.",
];

/** Twelve short month labels for the year-profile chart. */
export function monthLabels(locale: string): string[] {
  if (locale === "lt") return [...LT_MONTH_LABELS];
  const fmt = new Intl.DateTimeFormat(locale, { month: "narrow" });
  return Array.from({ length: 12 }, (_, m) => fmt.format(refDate(m)));
}

export interface CityLabels {
  city: string;
  /** French "à <city>" with the article contracted; the plain name elsewhere. */
  atCity: string;
  /** Sentence-initial form of `atCity`. */
  atCityCap: string;
}

export function cityLabels(locale: string, name: string): CityLabels {
  if (locale !== "fr") return { city: name, atCity: name, atCityCap: name };
  const atCity = frAtCity(name);
  return { city: name, atCity, atCityCap: capFirst(atCity) };
}

export interface VerdictMonths {
  /** The month after "from"/"de"/"с"/"nuo", already declined where required. */
  startMonth: string;
  /** The month after "to"/"a"/"по"/"iki", already declined where required. */
  endMonth: string;
  /** French only: "d'avril" / "de mars" — the preposition is part of the value. */
  fromMonth: string;
  /** Sentence-initial form of `fromMonth`. */
  fromMonthCap: string;
}

/**
 * The month values for the verdict sentences.
 *
 * - ru: `с` governs the genitive, but `по` governs the accusative — and months
 *   are masculine inanimate, so accusative == nominative. Only the start declines.
 * - lt: `nuo … iki …` governs the genitive on both.
 * - fr: `de` elides to `d'` before a vowel, so the preposition ships with the value.
 */
export function verdictMonths(locale: string, startIndex: number, endIndex: number): VerdictMonths {
  const startMonth =
    locale === "ru" || locale === "lt" ? monthGenitive(locale, startIndex) : monthName(locale, startIndex);
  const endMonth = locale === "lt" ? monthGenitive(locale, endIndex) : monthName(locale, endIndex);
  const fromMonth = frFromMonth(monthName(locale, startIndex));
  return { startMonth, endMonth, fromMonth, fromMonthCap: capFirst(fromMonth) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/__tests__/city-copy.test.ts`
Expected: PASS.

If a genitive assertion fails, do NOT weaken the test — the ICU/CLDR data is the
authority here and the strip logic is what must adapt.

- [ ] **Step 5: Commit**

```bash
git add lib/city-copy.ts "lib/__tests__/city-copy.test.ts"
git commit -m "feat(city-pages): per-locale grammar helpers for city copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `cityPage` message namespace (6 locales)

**Files:**
- Modify: `messages/es.json`, `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/ru.json`, `messages/lt.json`

No test (pure copy). Verification: `npm run build` and the page renders in Task 7.

**Placeholder contract** (produced by `lib/city-copy.ts`, consumed here):
- `{city}` — the city's nominative name.
- `{atCity}` / `{atCityCap}` — fr only: `"au Caire"` / `"Au Caire"`.
- `{startMonth}` / `{endMonth}` — already declined per locale.
- `{fromMonth}` / `{fromMonthCap}` — fr only: `"d'avril"` / `"D'avril"`.
- `{month}` — **capitalized** nominative; used only line-initially.
- `{start}` / `{end}` — 24-hour times, e.g. `"07:32"`. The whole app is 24h
  (`lib/vitd.ts` pins `hour12: false`); do not introduce a second time format.
- `{minutes}` — a **number** (not a pre-formatted string), so ICU plural can select on it.

Each locale uses only the placeholders it needs; passing a superset is safe in ICU.

- [ ] **Step 1: Add the `cityPage` namespace to each locale file**

Insert this top-level key into `messages/es.json` (alongside `cities`, `learn`, …):

```json
"cityPage": {
  "title": "Vitamina D del sol en {city}",
  "metaDescription": "Cuándo puedes sintetizar vitamina D con el sol en {city}: meses posibles, ventanas por estación y cuándo suplementar.",
  "verdictRange": "En {city} puedes sintetizar vitamina D de {startMonth} a {endMonth}.",
  "verdictAllYear": "En {city} puedes sintetizar vitamina D durante todo el año.",
  "verdictNever": "En {city} el sol nunca alcanza la altura necesaria para sintetizar vitamina D.",
  "impossibleRange": "De {startMonth} a {endMonth} no es posible: necesitas suplementar.",
  "yearHeading": "Perfil anual en {city}",
  "yearCaption": "Horas diarias con sol suficiente para sintetizar vitamina D a lo largo del año.",
  "seasonHeading": "Ventanas por estación",
  "seasonWindow": "{month}: entre las {start} y las {end}, unos {minutes} min para 1000 UI.",
  "seasonImpossible": "{month}: la síntesis no es posible.",
  "seasonNote": "Estimado para piel tipo III, brazos y cara expuestos, cielo despejado.",
  "supplementHeading": "Cuándo suplementar en {city}",
  "supplementBody": "En los meses sin síntesis solar, una opción es suplementar con vitamina D3, que suele combinarse con K2 y magnesio.",
  "ctaLabel": "Calcular mi ventana en {city}",
  "faqHeading": "Preguntas frecuentes sobre la vitamina D en {city}",
  "faqWinterQ": "¿Puedo obtener vitamina D del sol en invierno en {city}?",
  "faqMinutesQ": "¿Cuántos minutos de sol necesito en {city}?",
  "faqMinutesA": "En verano, unos {minutes} minutos con brazos y cara al sol bastan para 1000 UI (piel tipo III, cielo despejado)."
}
```

`messages/en.json`:

```json
"cityPage": {
  "title": "Vitamin D from the sun in {city}",
  "metaDescription": "When you can synthesize vitamin D from the sun in {city}: possible months, seasonal windows, and when to supplement.",
  "verdictRange": "In {city} you can synthesize vitamin D from {startMonth} to {endMonth}.",
  "verdictAllYear": "In {city} you can synthesize vitamin D all year round.",
  "verdictNever": "In {city} the sun never gets high enough to synthesize vitamin D.",
  "impossibleRange": "From {startMonth} to {endMonth} synthesis isn't possible — this is when a supplement can help.",
  "yearHeading": "Year-round profile in {city}",
  "yearCaption": "Daily hours with enough sun to synthesize vitamin D across the year.",
  "seasonHeading": "Seasonal windows",
  "seasonWindow": "{month}: between {start} and {end}, about {minutes} min for 1000 IU.",
  "seasonImpossible": "{month}: synthesis isn't possible.",
  "seasonNote": "Estimated for Fitzpatrick type III skin, arms and face exposed, clear sky.",
  "supplementHeading": "When to supplement in {city}",
  "supplementBody": "During the months without solar synthesis, a common approach is a vitamin D3 supplement, often paired with K2 and magnesium, which support its absorption and use.",
  "ctaLabel": "Calculate my window in {city}",
  "faqHeading": "Frequently asked questions about vitamin D in {city}",
  "faqWinterQ": "Can I get vitamin D from the sun in winter in {city}?",
  "faqMinutesQ": "How many minutes of sun do I need in {city}?",
  "faqMinutesA": "In summer, about {minutes} minutes with arms and face exposed is enough for 1000 IU (Fitzpatrick type III skin, clear sky)."
}
```

`messages/fr.json`:

Note the `\u202f` escapes: French requires a narrow no-break space before `:` and `?`.
Write them as JSON `\u202f` escapes, not literal characters.

```json
"cityPage": {
  "title": "Vitamine D du soleil {atCity}",
  "metaDescription": "Quand pouvez-vous synthétiser la vitamine D au soleil {atCity}\u202f: mois possibles, fenêtres saisonnières et quand se supplémenter.",
  "verdictRange": "{atCityCap}, vous pouvez synthétiser la vitamine D {fromMonth} à {endMonth}.",
  "verdictAllYear": "{atCityCap}, vous pouvez synthétiser la vitamine D toute l'année.",
  "verdictNever": "{atCityCap}, le soleil n'atteint jamais la hauteur nécessaire pour synthétiser la vitamine D.",
  "impossibleRange": "{fromMonthCap} à {endMonth}, ce n'est pas possible\u202f: la supplémentation prend le relais.",
  "yearHeading": "Profil annuel {atCity}",
  "yearCaption": "Nombre d'heures par jour où le soleil est assez haut pour synthétiser la vitamine D, au fil de l'année.",
  "seasonHeading": "Fenêtres saisonnières",
  "seasonWindow": "{month}\u202f: entre {start} et {end}, environ {minutes} min pour 1 000 UI.",
  "seasonImpossible": "{month}\u202f: la synthèse n'est pas possible.",
  "seasonNote": "Estimation pour une peau de type III, visage et bras exposés, ciel dégagé.",
  "supplementHeading": "Quand se supplémenter {atCity}",
  "supplementBody": "Pendant les mois sans synthèse solaire, beaucoup se tournent vers la supplémentation en vitamine D3, souvent associée à la vitamine K2 et au magnésium, qui participent à son absorption et à son utilisation.",
  "ctaLabel": "Calculer ma fenêtre {atCity}",
  "faqHeading": "Questions fréquentes sur la vitamine D {atCity}",
  "faqWinterQ": "Puis-je obtenir de la vitamine D du soleil en hiver {atCity}\u202f?",
  "faqMinutesQ": "Combien de minutes de soleil me faut-il {atCity}\u202f?",
  "faqMinutesA": "En été, environ {minutes} minutes avec le visage et les bras exposés suffisent pour 1 000 UI (peau de type III, ciel dégagé)."
}
```

`messages/de.json`:

The rest of the German app addresses the user as `du` (`hero`, `skin`, `auth`,
`notifications`, `dashboard`, `learn`); only the B2B `partners` namespace uses `Sie`.
These pages are consumer-facing and link to `/learn`, so they use `du`.

```json
"cityPage": {
  "title": "Vitamin D durch Sonne in {city}",
  "metaDescription": "Wann du in {city} Vitamin D durch die Sonne bilden kannst: mögliche Monate, saisonale Zeitfenster und wann du supplementieren solltest.",
  "verdictRange": "In {city} kannst du von {startMonth} bis {endMonth} Vitamin D bilden.",
  "verdictAllYear": "In {city} kannst du das ganze Jahr über Vitamin D bilden.",
  "verdictNever": "In {city} erreicht die Sonne nie die nötige Höhe, um Vitamin D zu bilden.",
  "impossibleRange": "Von {startMonth} bis {endMonth} ist keine Bildung möglich – in diesen Monaten solltest du supplementieren.",
  "yearHeading": "Jahresprofil in {city}",
  "yearCaption": "Tägliche Stunden mit ausreichender Sonne zur Vitamin-D-Bildung im Jahresverlauf.",
  "seasonHeading": "Saisonale Zeitfenster",
  "seasonWindow": "{month}: zwischen {start} und {end}, etwa {minutes} Min. für 1000 IE.",
  "seasonImpossible": "{month}: Die Bildung ist nicht möglich.",
  "seasonNote": "Geschätzt für Hauttyp III, Arme und Gesicht unbedeckt, klarer Himmel.",
  "supplementHeading": "Wann du in {city} supplementieren solltest",
  "supplementBody": "In den Monaten ohne ausreichende Sonne kann Vitamin D3 helfen, deinen Spiegel zu halten – zusammen mit K2 und Magnesium für Aufnahme und Verwertung.",
  "ctaLabel": "Mein Zeitfenster in {city} berechnen",
  "faqHeading": "Häufige Fragen zu Vitamin D in {city}",
  "faqWinterQ": "Kann ich im Winter in {city} Vitamin D durch die Sonne bekommen?",
  "faqMinutesQ": "Wie viele Minuten Sonne brauche ich in {city}?",
  "faqMinutesA": "Im Sommer reichen etwa {minutes} Minuten mit unbedeckten Armen und Gesicht für 1000 IE (Hauttyp III, klarer Himmel)."
}
```

`messages/ru.json`:

`{minutes}` deliberately carries **no** ICU plural here: both occurrences sit under
«около», which governs the genitive plural, so «около 22 минут» is already correct
for every value. Wrapping it in `{minutes, plural, …}` would select on the number
and render «около 22 минуты», which is wrong. Do not "fix" this.

```json
"cityPage": {
  "title": "Витамин D от солнца — {city}",
  "metaDescription": "{city}: когда можно получить витамин D от солнца — в какие месяцы это возможно, время синтеза по сезонам и когда принимать добавки.",
  "verdictRange": "{city}: витамин D можно синтезировать с {startMonth} по {endMonth}.",
  "verdictAllYear": "{city}: витамин D можно синтезировать круглый год.",
  "verdictNever": "{city}: солнце никогда не поднимается достаточно высоко для синтеза витамина D.",
  "impossibleRange": "С {startMonth} по {endMonth} синтез невозможен — нужны добавки.",
  "yearHeading": "Годовой профиль — {city}",
  "yearCaption": "Сколько часов в день солнце стоит достаточно высоко для синтеза витамина D — по месяцам года.",
  "seasonHeading": "Солнечные окна по сезонам",
  "seasonWindow": "{month}: с {start} до {end}, около {minutes} мин для 1000 МЕ.",
  "seasonImpossible": "{month}: синтез невозможен.",
  "seasonNote": "Оценка для III типа кожи по Фицпатрику: открытые руки и лицо, ясное небо.",
  "supplementHeading": "Когда принимать добавки — {city}",
  "supplementBody": "В месяцы без солнечного синтеза можно рассмотреть приём витамина D3 вместе с K2 и магнием для лучшего усвоения.",
  "ctaLabel": "Рассчитать моё окно — {city}",
  "faqHeading": "Частые вопросы о витамине D — {city}",
  "faqWinterQ": "{city}: можно ли зимой получить витамин D от солнца?",
  "faqMinutesQ": "{city}: сколько минут на солнце нужно?",
  "faqMinutesA": "Летом около {minutes} минут с открытыми руками и лицом достаточно для 1000 МЕ (III тип кожи, ясное небо)."
}
```

`messages/lt.json`:

Unlike ru, `{minutes}` here **does** need an ICU plural: «apie» governs the
accusative, so the noun inflects with the count (1 → `minutę`, 5 → `minutes`,
18 → `minučių`, 21 → `minutę`). Lithuania's CLDR categories are `one/few/many/other`;
integers never select `many`, but it is included for completeness.

```json
"cityPage": {
  "title": "Vitaminas D iš saulės: {city}",
  "metaDescription": "{city}: kada saulėje galite pasigaminti vitamino D — tinkami mėnesiai, paros saulės langai ir kada verta rinktis papildus (D3, K2, magnis).",
  "verdictRange": "{city}: vitamino D iš saulės galite pasigaminti nuo {startMonth} iki {endMonth}.",
  "verdictAllYear": "{city}: vitamino D iš saulės galite pasigaminti ištisus metus.",
  "verdictNever": "{city}: saulė niekada nepakyla pakankamai aukštai, kad odoje susidarytų vitaminas D.",
  "impossibleRange": "Nuo {startMonth} iki {endMonth} sintezė neįmanoma – reikia papildų.",
  "yearHeading": "Metinis profilis: {city}",
  "yearCaption": "Valandos per dieną, kai saulės pakanka vitaminui D gaminti — ištisus metus.",
  "seasonHeading": "Sezoniniai saulės langai",
  "seasonWindow": "{month}: {start}–{end} · ~{minutes} min. 1000 TV.",
  "seasonImpossible": "{month}: sintezė negalima.",
  "seasonNote": "Įvertinta III tipo odai (atidengtos rankos ir veidas, giedras dangus).",
  "supplementHeading": "Kada vartoti papildus: {city}",
  "supplementBody": "Mėnesiais be saulės sintezės vitamino D galima gauti iš D3 papildų; K2 ir magnis padeda organizmui jį pasisavinti.",
  "ctaLabel": "Apskaičiuoti savo saulės langą",
  "faqHeading": "Dažni klausimai apie vitaminą D: {city}",
  "faqWinterQ": "{city} – ar žiemą galima gauti vitamino D iš saulės?",
  "faqMinutesQ": "{city} – kiek saulės minučių man reikia per dieną?",
  "faqMinutesA": "Vasarą apie {minutes, plural, one {# minutę} few {# minutes} many {# minutės} other {# minučių}} su atidengtomis rankomis ir veidu pakanka 1000 TV (III tipo oda, giedras dangus)."
}
```

- [ ] **Step 2: Verify the JSON parses and the build still passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat(city-pages): add cityPage ICU namespace in 6 locales

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `components/CityYearStrip.tsx` — static SVG year profile

**Files:**
- Create: `components/CityYearStrip.tsx`

Server component (NO `"use client"`), so the SVG lands in the static HTML and is indexable.

- [ ] **Step 1: Create `components/CityYearStrip.tsx`**

```tsx
/**
 * Static SVG strip of a city's year: one column per day, colored by the hours of
 * viable vitamin-D sun that day. Server-rendered (no "use client") so the markup
 * ships in the static HTML. Color ramp matches GlobalHeatmap.
 */
export default function CityYearStrip({
  hoursByDay,
  monthLabels,
  caption,
}: {
  hoursByDay: number[];
  monthLabels: string[];
  caption: string;
}) {
  const width = 365;
  const height = 48;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={caption}
        preserveAspectRatio="none"
      >
        {hoursByDay.map((hrs, i) => {
          const t = Math.min(hrs / 10, 1);
          const fill = `hsl(${45 - t * 25}, ${80 + t * 20}%, ${15 + t * 50}%)`;
          return <rect key={i} x={i} y={0} width={1} height={height} fill={fill} />;
        })}
      </svg>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${monthLabels.length}, 1fr)`,
          fontSize: 10,
          opacity: 0.7,
          marginTop: 4,
        }}
      >
        {monthLabels.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <figcaption style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{caption}</figcaption>
    </figure>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: PASS (component unused so far — that's fine).

- [ ] **Step 3: Commit**

```bash
git add components/CityYearStrip.tsx
git commit -m "feat(city-pages): static SVG year-profile strip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The city page (SSG + metadata + FAQ schema)

**Files:**
- Create: `app/[locale]/[cityPrefix]/[city]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CityYearStrip from "@/components/CityYearStrip";
import { BUILTIN_CITIES } from "@/lib/cities";
import { cityYearProfile, citySeasonalWindows, contiguousMonthRange } from "@/lib/city-content";
import {
  CITY_PREFIX, baseSlug, cityIdFromSlug, localizedCityName,
  buildCityAlternates, cityStaticParams,
} from "@/lib/city-routes";
import { capFirst, cityLabels, monthLabels, monthName, verdictMonths } from "@/lib/city-copy";
import { fmtTime } from "@/lib/solar";

export function generateStaticParams() {
  return cityStaticParams();
}

type Params = { locale: string; cityPrefix: string; city: string };

/** Resolves (locale, prefix, slug) → the City, or null when the route is bogus. */
function resolveCity({ locale, cityPrefix, city }: Params) {
  if (cityPrefix !== CITY_PREFIX[locale]) return null;
  const cityId = cityIdFromSlug(locale, city);
  if (!cityId) return null;
  return BUILTIN_CITIES.find((c) => c.id === cityId) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const city = resolveCity(p);
  if (!city) return {};

  const base = baseSlug(city.id);
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  const labels = cityLabels(p.locale, localizedCityName(p.locale, base));
  const alternates = buildCityAlternates(p.locale, base);

  const title = t("title", labels);
  const description = t("metaDescription", labels);

  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical, type: "article" },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const city = resolveCity(p);
  if (!city) notFound();
  setRequestLocale(p.locale);

  const base = baseSlug(city.id);
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });

  // Every value a cityPage template may reference. Each locale uses the subset it
  // needs — ICU ignores extras but throws on a missing one, so pass the superset.
  const labels = cityLabels(p.locale, localizedCityName(p.locale, base));

  const profile = cityYearProfile(city.lat);
  const windows = citySeasonalWindows(city.lat, city.lon, city.tz);
  const labelsForChart = monthLabels(p.locale);

  // Circular band: southern-hemisphere cities wrap around January.
  const possibleBand = contiguousMonthRange(profile.possibleMonths);
  const impossibleBand = contiguousMonthRange(profile.impossibleMonths);

  const verdict = profile.allYear
    ? t("verdictAllYear", labels)
    : profile.neverPossible
      ? t("verdictNever", labels)
      : t("verdictRange", {
          ...labels,
          ...verdictMonths(p.locale, possibleBand!.start - 1, possibleBand!.end - 1),
        });

  const summerWindow = windows.find((w) => w.possible && w.minutesNeeded !== null);

  const faq = [
    {
      "@type": "Question",
      name: t("faqWinterQ", labels),
      acceptedAnswer: { "@type": "Answer", text: verdict },
    },
    ...(summerWindow
      ? [{
          "@type": "Question",
          name: t("faqMinutesQ", labels),
          acceptedAnswer: {
            "@type": "Answer",
            // A number, not a string: lt selects an ICU plural form on it.
            text: t("faqMinutesA", { ...labels, minutes: Math.round(summerWindow.minutesNeeded!) }),
          },
        }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-[960px] px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq }),
        }}
      />

      <h1 className="text-2xl font-bold">{t("title", labels)}</h1>
      <p className="mt-2 text-base">{verdict}</p>
      {!profile.allYear && !profile.neverPossible && impossibleBand && (
        <p className="mt-1 text-sm opacity-80">
          {t("impossibleRange", {
            ...labels,
            ...verdictMonths(p.locale, impossibleBand.start - 1, impossibleBand.end - 1),
          })}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("yearHeading", labels)}</h2>
        <div className="mt-3">
          <CityYearStrip hoursByDay={profile.hoursByDay} monthLabels={labelsForChart} caption={t("yearCaption")} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("seasonHeading")}</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {windows.map((w) => (
            // These lines start with the month, so it must be capitalized —
            // es/fr/ru/lt all yield a lowercase nominative from Intl.
            <li key={w.doy}>
              {w.possible
                ? t("seasonWindow", {
                    month: capFirst(monthName(p.locale, w.monthIndex)),
                    start: fmtTime(w.windowStart!),
                    end: fmtTime(w.windowEnd!),
                    minutes: Math.round(w.minutesNeeded!),
                  })
                : t("seasonImpossible", { month: capFirst(monthName(p.locale, w.monthIndex)) })}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-60">{t("seasonNote")}</p>
      </section>

      {!profile.allYear && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("supplementHeading", labels)}</h2>
          <p className="mt-2 text-sm">
            <Link href="/learn#supplement" className="underline decoration-dotted">
              {t("supplementBody")}
            </Link>
          </p>
        </section>
      )}

      <section className="mt-8">
        <Link
          href="/dashboard"
          className="inline-block rounded bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-400"
        >
          {t("ctaLabel", labels)}
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("faqHeading", labels)}</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {faq.map((q) => (
            <div key={q.name}>
              <dt className="font-medium">{q.name}</dt>
              <dd className="opacity-80">{q.acceptedAnswer.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify the build generates the city pages**

Run: `npm run build`
Expected: PASS, and the route list shows `/[locale]/[cityPrefix]/[city]` as SSG with a large page count (~438 extra). If the build reports a params/type error on `params` being a Promise, fix per Next 16 (always `await params`) — do not change the route shape.

- [ ] **Step 3: Spot-check one page locally**

Run: `npm run dev`, then open `http://localhost:3000/vitamina-d/madrid` and `http://localhost:3000/en/vitamin-d/london`.
Expected: H1, verdict, SVG strip, seasonal list, FAQ. `http://localhost:3000/en/vitamina-d/london` (wrong prefix for locale) must 404.

- [ ] **Step 4: Commit**

```bash
git add "app/[locale]/[cityPrefix]"
git commit -m "feat(city-pages): static per-city page with FAQ schema and hreflang

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Sitemap — add the 438 city URLs

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `app/__tests__/sitemap.test.ts`

- [ ] **Step 1: Add the failing tests**

Append inside the existing `describe("sitemap", ...)` block in `app/__tests__/sitemap.test.ts`:

```ts
  it("includes 438 city URLs on top of the 36 static ones", () => {
    expect(entries).toHaveLength(36 + 438);
  });

  it("emits localized city URLs with hreflang", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/vitamina-d/madrid`);
    expect(urls).toContain(`${SITE_URL}/en/vitamin-d/london`);
    const london = entries.find((e) => e.url === `${SITE_URL}/en/vitamin-d/london`);
    expect(london?.alternates?.languages?.fr).toBe(`${SITE_URL}/fr/vitamine-d/londres`);
    expect(london?.alternates?.languages?.["x-default"]).toBe(`${SITE_URL}/vitamina-d/londres`);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/__tests__/sitemap.test.ts`
Expected: FAIL — 36 entries, no city URLs.

- [ ] **Step 3: Extend `app/sitemap.ts`**

Add these imports at the top:

```ts
import { BUILTIN_CITIES } from "@/lib/cities";
import { baseSlug, cityUrl, buildCityAlternates } from "@/lib/city-routes";
```

Then change the default export to append the city entries:

```ts
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries = PAGES.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => ({
      url: `${SITE_URL}${getPathname({ href: path, locale })}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: buildLanguageAlternates(path) },
    })),
  );

  const cityEntries = BUILTIN_CITIES.flatMap((city) => {
    const base = baseSlug(city.id);
    return routing.locales.map((locale) => ({
      url: cityUrl(locale, base),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: buildCityAlternates(locale, base).languages },
    }));
  });

  return [...staticEntries, ...cityEntries];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/__tests__/sitemap.test.ts`
Expected: PASS. Then `npm test` → all pass, and `npm run build` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts "app/__tests__/sitemap.test.ts"
git commit -m "feat(city-pages): sitemap includes 438 localized city URLs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Smoke checks + deploy to dev

**Files:**
- Modify: `scripts/smoke-i18n.sh`

- [ ] **Step 1: Add city checks to the smoke script**

Append before the final `exit $fail`:

```bash
# --- city pages ---
check_lang "/vitamina-d/madrid" es
check_lang "/en/vitamin-d/london" en
check_lang "/fr/vitamine-d/londres" fr

# wrong prefix for the locale must 404
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/en/vitamina-d/london")
if [ "$code" = "404" ]; then echo "OK  wrong-prefix 404"; else echo "FAIL wrong-prefix -> $code (want 404)"; fail=1; fi

# FAQ schema + canonical on a city page
if curl -s "$BASE/en/vitamin-d/london" | grep -q '"@type":"FAQPage"'; then echo "OK  city FAQPage schema"; else echo "FAIL city FAQPage schema missing"; fail=1; fi
if curl -s "$BASE/en/vitamin-d/london" | grep -qi 'hreflang="fr"'; then echo "OK  city hreflang"; else echo "FAIL city hreflang missing"; fail=1; fi
```

- [ ] **Step 2: Full local verification**

Run: `npm test && npm run build`
Expected: all tests pass; build passes. Note the build now emits ~470 static pages — confirm build time is acceptable and report it.

- [ ] **Step 3: Deploy to dev**

```bash
npx vercel link --project vitamind-dev --yes
npx vercel --prod --yes
npx vercel link --project vitamind --yes
```

- [ ] **Step 4: Smoke test against dev**

Run: `BASE=https://vitamind-dev.vercel.app bash scripts/smoke-i18n.sh`
Expected: all `OK`, exit 0.

- [ ] **Step 5: Spot-check content across locales**

Open on dev: `/vitamina-d/reikiavik` (should show impossible winter months), `/en/vitamin-d/singapore` (all year), `/es/.../sidney` → note Sydney's impossible band is the northern summer. Confirm month names are in the page's language (not Spanish) — that's the `Intl` requirement.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke-i18n.sh
git commit -m "test(city-pages): smoke checks for localized city pages

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Content review, deploy to prod, merge

- [ ] **Step 1: User reviews the copy**

Ask the user to review the `cityPage` copy in all 6 locales on dev (tone, correctness, especially the supplement wording). Apply any edits they request to `messages/*.json` and re-deploy dev.

- [ ] **Step 2: Get explicit confirmation to deploy to production**

Production deploys need the user to explicitly name the prod target. Do not deploy on an ambiguous "ok".

- [ ] **Step 3: Deploy to prod**

```bash
npx vercel --prod --yes   # link already points to vitamind (prod)
```

- [ ] **Step 4: Smoke test against prod**

Run: `BASE=https://getvitamind.app bash scripts/smoke-i18n.sh`
Expected: all `OK`, exit 0.

- [ ] **Step 5: Resubmit the sitemap in Google Search Console** (optional — `robots.txt` already declares it, so Google re-crawls on its own; manual resubmit only speeds it up).

- [ ] **Step 6: Merge**

```bash
git checkout master
git merge --no-ff feat/city-pages
npm test   # verify on the merged result
```

---

## Self-Review

- **Spec coverage:** 73 cities × 6 locales (Task 2 `cityStaticParams`, asserted at 438); localized URLs + prefixes (Task 2 `CITY_PREFIX`, `localizedCitySlug`); non-Latin-locale slugs use the real Latin name, with transliteration and base slug as fallbacks (Task 1, Task 2 `LATIN_SLUG_LOCALE` + `||` chain); build-time computed content (Task 3); per-locale grammar — article contraction, elision, genitive months, capitalization (Task 4); `cityPage` namespace ×6 (Task 5); year SVG (Task 6); the 6 content blocks — verdict, year profile, seasonal windows, supplement, CTA, FAQ (Task 7); `Intl` month names, not the hardcoded Spanish arrays (Task 4 `monthName`/`monthLabels`); canonical + hreflang + x-default (Task 2 `buildCityAlternates`, used in Task 7 metadata and Task 8 sitemap); sitemap +438 (Task 8); prefix validation → `notFound()` (Task 7 `resolveCity`); slug uniqueness test (Task 2); smoke + dev→prod + content review (Tasks 9–10). All spec sections mapped.
- **Bug class caught by native copy review (six locales, one agent each):** interpolating raw `{city}` / `{month}` into ICU produced `à Le Caire`, `de avril`, `с январь по июнь`, `nuo sausis iki birželis`, and lowercase line-initial months in four locales. ICU cannot elide, contract, or change case, so Task 4 pre-inflects every value. Two reviewer recommendations were rejected: 12-hour clocks for `en` (the app pins `hour12: false` everywhere), and ICU plurals for `ru` `{minutes}` (which sits under «около», already governing the genitive plural — ICU would have *introduced* a bug).
- **Placeholder scan:** every code step ships full file contents or an exact, unambiguous edit. No "TBD"/"handle edge cases".
- **Type consistency:** `baseSlug(cityId)`, `localizedCitySlug(locale, base)`, `cityIdFromSlug(locale, slug)`, `cityUrl(locale, base)`, `buildCityAlternates(locale, base)`, `cityStaticParams()`, `cityYearProfile(lat)`, `citySeasonalWindows(lat, lon, tz)`, `contiguousMonthRange(months)`, `slugify(name)` are used identically across tasks and tests. `SeasonWindow.monthIndex` is 0-11 and consumed by `monthName(locale, monthIndex)`; `CityYearProfile.possibleMonths`/`impossibleMonths` are 1-12 and converted with `- 1` at the call site.
- **Bug caught in review:** naming the month band with `possibleMonths[0]`/`[last]` breaks for southern-hemisphere cities, whose possible months wrap around January (`[1,2,3,4,10,11,12]` would render "January–December"). Fixed by `contiguousMonthRange`, which walks the band circularly; the wrap case is pinned by a test.
