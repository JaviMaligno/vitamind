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
export const MIN_UVI_ELEVATION: number            // ≈19.1° — elevation where clear-sky UVI hits 3
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
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
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
    expect(localizedCitySlug("ru", "moscu")).toBe("moskva");
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
    expect(alt.languages["x-default"]).toBe(`${SITE_URL}/vitamina-d/londres`);
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

/** ASCII slug of the localized name; falls back to the base slug if empty. */
export function localizedCitySlug(locale: string, base: string): string {
  return slugify(localizedCityName(locale, base)) || base;
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

  it("flips the impossible band in the southern hemisphere (Sydney -33.87)", () => {
    const p = cityYearProfile(-33.87);
    expect(p.possibleMonths).toContain(1);  // January = southern summer
    expect(p.impossibleMonths).toContain(6); // June = southern winter
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
Expected: PASS (7 tests).

If the Reykjavik/Sydney assertions fail, do NOT weaken the test — investigate `vitDHrs`'s threshold semantics and report findings; the physics assertions are the point of this task.

- [ ] **Step 5: Commit**

```bash
git add lib/city-content.ts "lib/__tests__/city-content.test.ts"
git commit -m "feat(city-pages): build-time year profile and seasonal windows per city

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `cityPage` message namespace (6 locales)

**Files:**
- Modify: `messages/es.json`, `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/ru.json`, `messages/lt.json`

No test (pure copy). Verification: `npm run build` and the page renders in Task 6.

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
  "supplementBody": "En los meses sin síntesis solar, la vía es suplementar con vitamina D3, acompañada de K2 y magnesio para su correcta absorción y uso.",
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
  "impossibleRange": "From {startMonth} to {endMonth} it isn't possible: you need to supplement.",
  "yearHeading": "Year-round profile in {city}",
  "yearCaption": "Daily hours with enough sun to synthesize vitamin D across the year.",
  "seasonHeading": "Seasonal windows",
  "seasonWindow": "{month}: between {start} and {end}, about {minutes} min for 1000 IU.",
  "seasonImpossible": "{month}: synthesis isn't possible.",
  "seasonNote": "Estimated for Fitzpatrick type III skin, arms and face exposed, clear sky.",
  "supplementHeading": "When to supplement in {city}",
  "supplementBody": "During the months without solar synthesis, the way forward is supplementing with vitamin D3, alongside K2 and magnesium for proper absorption and use.",
  "ctaLabel": "Calculate my window in {city}",
  "faqHeading": "Frequently asked questions about vitamin D in {city}",
  "faqWinterQ": "Can I get vitamin D from the sun in winter in {city}?",
  "faqMinutesQ": "How many minutes of sun do I need in {city}?",
  "faqMinutesA": "In summer, about {minutes} minutes with arms and face exposed is enough for 1000 IU (type III skin, clear sky)."
}
```

`messages/fr.json`:

```json
"cityPage": {
  "title": "Vitamine D du soleil à {city}",
  "metaDescription": "Quand pouvez-vous synthétiser la vitamine D au soleil à {city} : mois possibles, fenêtres saisonnières et quand se supplémenter.",
  "verdictRange": "À {city}, vous pouvez synthétiser la vitamine D de {startMonth} à {endMonth}.",
  "verdictAllYear": "À {city}, vous pouvez synthétiser la vitamine D toute l'année.",
  "verdictNever": "À {city}, le soleil n'atteint jamais la hauteur nécessaire pour synthétiser la vitamine D.",
  "impossibleRange": "De {startMonth} à {endMonth}, ce n'est pas possible : vous devez vous supplémenter.",
  "yearHeading": "Profil annuel à {city}",
  "yearCaption": "Heures quotidiennes avec un soleil suffisant pour synthétiser la vitamine D au fil de l'année.",
  "seasonHeading": "Fenêtres saisonnières",
  "seasonWindow": "{month} : entre {start} et {end}, environ {minutes} min pour 1000 UI.",
  "seasonImpossible": "{month} : la synthèse n'est pas possible.",
  "seasonNote": "Estimation pour une peau de type III, bras et visage exposés, ciel dégagé.",
  "supplementHeading": "Quand se supplémenter à {city}",
  "supplementBody": "Pendant les mois sans synthèse solaire, la solution est la supplémentation en vitamine D3, accompagnée de K2 et de magnésium pour une bonne absorption et utilisation.",
  "ctaLabel": "Calculer ma fenêtre à {city}",
  "faqHeading": "Questions fréquentes sur la vitamine D à {city}",
  "faqWinterQ": "Puis-je obtenir de la vitamine D du soleil en hiver à {city} ?",
  "faqMinutesQ": "Combien de minutes de soleil me faut-il à {city} ?",
  "faqMinutesA": "En été, environ {minutes} minutes avec les bras et le visage exposés suffisent pour 1000 UI (peau de type III, ciel dégagé)."
}
```

`messages/de.json`:

```json
"cityPage": {
  "title": "Vitamin D durch Sonne in {city}",
  "metaDescription": "Wann Sie in {city} Vitamin D durch die Sonne bilden können: mögliche Monate, saisonale Zeitfenster und wann supplementiert werden sollte.",
  "verdictRange": "In {city} können Sie von {startMonth} bis {endMonth} Vitamin D bilden.",
  "verdictAllYear": "In {city} können Sie das ganze Jahr über Vitamin D bilden.",
  "verdictNever": "In {city} erreicht die Sonne nie die nötige Höhe, um Vitamin D zu bilden.",
  "impossibleRange": "Von {startMonth} bis {endMonth} ist es nicht möglich: Sie müssen supplementieren.",
  "yearHeading": "Jahresprofil in {city}",
  "yearCaption": "Tägliche Stunden mit ausreichender Sonne zur Vitamin-D-Bildung im Jahresverlauf.",
  "seasonHeading": "Saisonale Zeitfenster",
  "seasonWindow": "{month}: zwischen {start} und {end}, etwa {minutes} Min. für 1000 IE.",
  "seasonImpossible": "{month}: Die Bildung ist nicht möglich.",
  "seasonNote": "Geschätzt für Hauttyp III, Arme und Gesicht unbedeckt, klarer Himmel.",
  "supplementHeading": "Wann in {city} supplementieren",
  "supplementBody": "In den Monaten ohne Sonnensynthese ist die Supplementierung mit Vitamin D3 der Weg, zusammen mit K2 und Magnesium für die richtige Aufnahme und Verwertung.",
  "ctaLabel": "Mein Zeitfenster in {city} berechnen",
  "faqHeading": "Häufige Fragen zu Vitamin D in {city}",
  "faqWinterQ": "Kann ich im Winter in {city} Vitamin D durch die Sonne bekommen?",
  "faqMinutesQ": "Wie viele Minuten Sonne brauche ich in {city}?",
  "faqMinutesA": "Im Sommer reichen etwa {minutes} Minuten mit unbedeckten Armen und Gesicht für 1000 IE (Hauttyp III, klarer Himmel)."
}
```

`messages/ru.json`:

```json
"cityPage": {
  "title": "Витамин D от солнца в городе {city}",
  "metaDescription": "Когда в городе {city} можно получить витамин D от солнца: возможные месяцы, сезонные окна и когда принимать добавки.",
  "verdictRange": "В городе {city} витамин D можно синтезировать с {startMonth} по {endMonth}.",
  "verdictAllYear": "В городе {city} витамин D можно синтезировать круглый год.",
  "verdictNever": "В городе {city} солнце никогда не поднимается достаточно высоко для синтеза витамина D.",
  "impossibleRange": "С {startMonth} по {endMonth} это невозможно: нужны добавки.",
  "yearHeading": "Годовой профиль в городе {city}",
  "yearCaption": "Ежедневные часы с достаточным солнцем для синтеза витамина D в течение года.",
  "seasonHeading": "Сезонные окна",
  "seasonWindow": "{month}: с {start} до {end}, около {minutes} мин для 1000 МЕ.",
  "seasonImpossible": "{month}: синтез невозможен.",
  "seasonNote": "Оценка для III типа кожи, открытые руки и лицо, ясное небо.",
  "supplementHeading": "Когда принимать добавки в городе {city}",
  "supplementBody": "В месяцы без солнечного синтеза выход — приём витамина D3 вместе с K2 и магнием для правильного усвоения.",
  "ctaLabel": "Рассчитать моё окно в городе {city}",
  "faqHeading": "Частые вопросы о витамине D в городе {city}",
  "faqWinterQ": "Можно ли получить витамин D от солнца зимой в городе {city}?",
  "faqMinutesQ": "Сколько минут солнца нужно в городе {city}?",
  "faqMinutesA": "Летом около {minutes} минут с открытыми руками и лицом достаточно для 1000 МЕ (III тип кожи, ясное небо)."
}
```

`messages/lt.json`:

```json
"cityPage": {
  "title": "Vitaminas D iš saulės mieste {city}",
  "metaDescription": "Kada mieste {city} galite gaminti vitaminą D saulėje: galimi mėnesiai, sezoniniai langai ir kada vartoti papildus.",
  "verdictRange": "Mieste {city} vitaminą D galite gaminti nuo {startMonth} iki {endMonth}.",
  "verdictAllYear": "Mieste {city} vitaminą D galite gaminti ištisus metus.",
  "verdictNever": "Mieste {city} saulė niekada nepakyla pakankamai aukštai vitaminui D gaminti.",
  "impossibleRange": "Nuo {startMonth} iki {endMonth} tai neįmanoma: reikia papildų.",
  "yearHeading": "Metinis profilis mieste {city}",
  "yearCaption": "Kasdienės valandos su pakankama saule vitaminui D gaminti per metus.",
  "seasonHeading": "Sezoniniai langai",
  "seasonWindow": "{month}: nuo {start} iki {end}, apie {minutes} min 1000 TV.",
  "seasonImpossible": "{month}: sintezė neįmanoma.",
  "seasonNote": "Įvertinta III tipo odai, atidengtos rankos ir veidas, giedras dangus.",
  "supplementHeading": "Kada vartoti papildus mieste {city}",
  "supplementBody": "Mėnesiais be saulės sintezės kelias yra vitamino D3 papildai kartu su K2 ir magniu, kad būtų tinkamai pasisavinta.",
  "ctaLabel": "Apskaičiuoti mano langą mieste {city}",
  "faqHeading": "Dažni klausimai apie vitaminą D mieste {city}",
  "faqWinterQ": "Ar galiu gauti vitamino D iš saulės žiemą mieste {city}?",
  "faqMinutesQ": "Kiek saulės minučių man reikia mieste {city}?",
  "faqMinutesA": "Vasarą apie {minutes} minutes su atidengtomis rankomis ir veidu pakanka 1000 TV (III tipo oda, giedras dangus)."
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

### Task 5: `components/CityYearStrip.tsx` — static SVG year profile

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

### Task 6: The city page (SSG + metadata + FAQ schema)

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

function monthName(locale: string, monthIndex: number): string {
  // monthIndex is 0-11; day 15 avoids timezone edge cases.
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, monthIndex, 15));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const city = resolveCity(p);
  if (!city) return {};

  const base = baseSlug(city.id);
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  const name = localizedCityName(p.locale, base);

  return {
    title: t("title", { city: name }),
    description: t("metaDescription", { city: name }),
    alternates: buildCityAlternates(p.locale, base),
    openGraph: {
      title: t("title", { city: name }),
      description: t("metaDescription", { city: name }),
      url: buildCityAlternates(p.locale, base).canonical,
      type: "article",
    },
  };
}

export default async function CityPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const city = resolveCity(p);
  if (!city) notFound();
  setRequestLocale(p.locale);

  const base = baseSlug(city.id);
  const t = await getTranslations({ locale: p.locale, namespace: "cityPage" });
  const name = localizedCityName(p.locale, base);

  const profile = cityYearProfile(city.lat);
  const windows = citySeasonalWindows(city.lat, city.lon, city.tz);
  const monthLabels = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(p.locale, { month: "narrow" }).format(new Date(2026, m, 15)),
  );

  // Circular band: southern-hemisphere cities wrap around January.
  const possibleBand = contiguousMonthRange(profile.possibleMonths);
  const impossibleBand = contiguousMonthRange(profile.impossibleMonths);

  const verdict = profile.allYear
    ? t("verdictAllYear", { city: name })
    : profile.neverPossible
      ? t("verdictNever", { city: name })
      : t("verdictRange", {
          city: name,
          startMonth: monthName(p.locale, possibleBand!.start - 1),
          endMonth: monthName(p.locale, possibleBand!.end - 1),
        });

  const summerWindow = windows.find((w) => w.possible && w.minutesNeeded !== null);

  const faq = [
    {
      "@type": "Question",
      name: t("faqWinterQ", { city: name }),
      acceptedAnswer: { "@type": "Answer", text: verdict },
    },
    ...(summerWindow
      ? [{
          "@type": "Question",
          name: t("faqMinutesQ", { city: name }),
          acceptedAnswer: {
            "@type": "Answer",
            text: t("faqMinutesA", { minutes: Math.round(summerWindow.minutesNeeded!) }),
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

      <h1 className="text-2xl font-bold">{t("title", { city: name })}</h1>
      <p className="mt-2 text-base">{verdict}</p>
      {!profile.allYear && !profile.neverPossible && impossibleBand && (
        <p className="mt-1 text-sm opacity-80">
          {t("impossibleRange", {
            city: name,
            startMonth: monthName(p.locale, impossibleBand.start - 1),
            endMonth: monthName(p.locale, impossibleBand.end - 1),
          })}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("yearHeading", { city: name })}</h2>
        <div className="mt-3">
          <CityYearStrip hoursByDay={profile.hoursByDay} monthLabels={monthLabels} caption={t("yearCaption")} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("seasonHeading")}</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {windows.map((w) => (
            <li key={w.doy}>
              {w.possible
                ? t("seasonWindow", {
                    month: monthName(p.locale, w.monthIndex),
                    start: fmtTime(w.windowStart!),
                    end: fmtTime(w.windowEnd!),
                    minutes: Math.round(w.minutesNeeded!),
                  })
                : t("seasonImpossible", { month: monthName(p.locale, w.monthIndex) })}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-60">{t("seasonNote")}</p>
      </section>

      {!profile.allYear && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("supplementHeading", { city: name })}</h2>
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
          {t("ctaLabel", { city: name })}
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{t("faqHeading", { city: name })}</h2>
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

### Task 7: Sitemap — add the 438 city URLs

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

### Task 8: Smoke checks + deploy to dev

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

### Task 9: Content review, deploy to prod, merge

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

- **Spec coverage:** 73 cities × 6 locales (Task 2 `cityStaticParams`, asserted at 438); localized URLs + prefixes (Task 2 `CITY_PREFIX`, `localizedCitySlug`); Cyrillic transliteration + fallback (Task 1, Task 2 `|| base`); build-time computed content (Task 3); year SVG (Task 5); the 6 content blocks — verdict, year profile, seasonal windows, supplement, CTA, FAQ (Task 6); `cityPage` namespace ×6 (Task 4); `Intl` month names, not the hardcoded Spanish arrays (Task 6 `monthName`/`monthLabels`); canonical + hreflang + x-default (Task 2 `buildCityAlternates`, used in Task 6 metadata and Task 7 sitemap); sitemap +438 (Task 7); prefix validation → `notFound()` (Task 6 `resolveCity`); slug uniqueness test (Task 2); smoke + dev→prod + content review (Tasks 8–9). All spec sections mapped.
- **Placeholder scan:** every code step ships full file contents or an exact, unambiguous edit. No "TBD"/"handle edge cases".
- **Type consistency:** `baseSlug(cityId)`, `localizedCitySlug(locale, base)`, `cityIdFromSlug(locale, slug)`, `cityUrl(locale, base)`, `buildCityAlternates(locale, base)`, `cityStaticParams()`, `cityYearProfile(lat)`, `citySeasonalWindows(lat, lon, tz)`, `contiguousMonthRange(months)`, `slugify(name)` are used identically across tasks and tests. `SeasonWindow.monthIndex` is 0-11 and consumed by `monthName(locale, monthIndex)`; `CityYearProfile.possibleMonths`/`impossibleMonths` are 1-12 and converted with `- 1` at the call site.
- **Bug caught in review:** naming the month band with `possibleMonths[0]`/`[last]` breaks for southern-hemisphere cities, whose possible months wrap around January (`[1,2,3,4,10,11,12]` would render "January–December"). Fixed by `contiguousMonthRange`, which walks the band circularly; the wrap case is pinned by a test.
