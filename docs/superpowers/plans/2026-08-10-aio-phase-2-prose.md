# AI Overview citation — Phase 2: extractable prose, freshness and the wedge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put on each treated sunrise page a self-contained paragraph of prose that states, in sentences, what the page's table only implies — including the one datum nobody else computes: whether vitamin D synthesis is possible there that month, and for how long.

**Architecture:** A pure module turns the month's already-computed solar and exposure data into a paragraph whose *shape* depends on the real solar regime, not on a template slot. Pages switch to daily ISR so the served HTML carries a current date. Both changes apply to 20 of the 40 cities; the other 20 are the control group.

**Tech Stack:** Next.js App Router (ISR), next-intl (6 locales), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-09-ai-overview-citation-design.md` (phase 2)
**Assignment:** `data/aio-tracking/phase2-assignment.json` — treated vs control, fixed 2026-08-10.

---

## Read this before writing any code

Three findings from phases 1a and 1b, each of which cost real work:

1. **Verify the shape of the data before writing anything that depends on it.** Phase 1b's plan asserted "18 references under `learn.block4`"; there were 80 across four blocks, and following the plan verbatim would have published wrong citations under 20 questions. The extraction script and the assertion were written from the same wrong assumption, so they agreed with each other.
2. **Never copy a factual claim from elsewhere on the site.** The methodology page shipped a 45°/50° threshold copied from the footer. The code has used UVI ≥ 3 since July, with the required elevation varying ~29°–42°. Both were wrong; the footer had been wrong in production for a month. **Any number this plan puts into prose must come from the code that computes it, at render time — not from a constant, not from other copy.**
3. **A test that greps source passes when the feature is silently broken.** Assert behaviour: given inputs, what does the function return.

## File Structure

| File | Responsibility |
|---|---|
| `lib/sun-prose.ts` (create) | Pure. Month data in, structured paragraph parts out. No i18n, no React. |
| `lib/__tests__/sun-prose.test.ts` (create) | The three regimes, the boundaries, and the numbers matching their sources. |
| `lib/phase2-cities.ts` (create) | Reads the assignment; answers `isTreated(citySlug)`. |
| `app/[locale]/[cityPrefix]/[city]/[month]/page.tsx` (modify) | Render the paragraph when treated; add `revalidate`. |
| `messages/{es,en,fr,de,ru,lt}.json` (modify) | `sunrisePage.prose*` keys. |
| `tests/e2e/prose-passage.spec.mjs` (create) | The paragraph reaches served HTML, and control pages do not have it. |

---

### Task 1: The treated-city predicate

**Files:**
- Create: `lib/phase2-cities.ts`
- Test: `lib/__tests__/phase2-cities.test.ts`

Small and first, because every later task depends on knowing which side a city is on, and because getting it wrong silently contaminates the experiment.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { isTreated, TREATED, CONTROL } from "@/lib/phase2-cities";
import { SUNRISE_CITIES } from "@/lib/sun-routes";

describe("phase 2 city assignment", () => {
  it("splits the sunrise cities in half", () => {
    expect(TREATED).toHaveLength(20);
    expect(CONTROL).toHaveLength(20);
  });

  it("covers every sunrise city exactly once", () => {
    const both = [...TREATED, ...CONTROL].sort();
    expect(new Set(both).size).toBe(both.length);
    expect(both).toEqual([...SUNRISE_CITIES].sort());
  });

  it("answers for known members of each group", () => {
    expect(isTreated("madrid")).toBe(true);
    expect(isTreated("valencia")).toBe(false);
  });

  it("treats an unknown city as control, so a typo cannot silently enrol it", () => {
    expect(isTreated("atlantis")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/__tests__/phase2-cities.test.ts --maxWorkers=2`
Expected: FAIL — cannot resolve `@/lib/phase2-cities`.

- [ ] **Step 3: Write the module**

```ts
import assignment from "@/data/aio-tracking/phase2-assignment.json";

/**
 * Phase 2 ships to half the sunrise cities so its effect can be attributed
 * rather than guessed at. The assignment was fixed on 2026-08-10 and recorded
 * before shipping; see the JSON for the rule and the read-out.
 *
 * Reading it from the data file rather than restating it here means the
 * experiment has one definition, and the file that documents it is the file
 * that drives it.
 */
export const TREATED: readonly string[] = assignment.treated;
export const CONTROL: readonly string[] = assignment.control;

const TREATED_SET = new Set(TREATED);

/** Unknown cities are control: an accident must not enrol a page in the test. */
export function isTreated(citySlug: string): boolean {
  return TREATED_SET.has(citySlug);
}
```

If `resolveJsonModule` is not enabled in `tsconfig.json`, enable it rather than duplicating the lists.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run lib/__tests__/phase2-cities.test.ts --maxWorkers=2`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/phase2-cities.ts lib/__tests__/phase2-cities.test.ts
git commit -m "feat(phase2): the treated/control split, read from its own record"
```

---

### Task 2: The prose module

**Files:**
- Create: `lib/sun-prose.ts`
- Test: `lib/__tests__/sun-prose.test.ts`

**Design constraint that decides this module:** it returns *structured parts*, not a sentence. The sentence is assembled by next-intl from translated templates; the module supplies the facts. Building strings here would put Spanish in `lib/`, and building them in the page would put arithmetic in the view.

The three regimes are not a stylistic choice — they are three different true statements:

| Regime | When | What the paragraph must say |
|---|---|---|
| `synthesis` | some day that month reaches UVI ≥ 3 | the window, and minutes needed at the best hour |
| `none` | no day that month reaches UVI ≥ 3 | that synthesis is impossible that month, at any hour |
| `polar` | sun never rises, or never sets | that, before anything about vitamin D |

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sunProse } from "@/lib/sun-prose";
import { BUILTIN_CITIES } from "@/lib/cities";

const city = (slug: string) => {
  const c = BUILTIN_CITIES.find((x) => x.id === `builtin:${slug}`);
  if (!c) throw new Error(`fixture city missing: ${slug}`);
  return c;
};

describe("sunProse regimes", () => {
  it("reports a synthesis window for Madrid in August", () => {
    const p = sunProse(city("madrid"), 7);
    expect(p.regime).toBe("synthesis");
    expect(p.vitD).not.toBeNull();
    expect(p.vitD!.windowStart).toBeLessThan(p.vitD!.windowEnd);
    expect(p.vitD!.minutesNeeded).toBeGreaterThan(0);
  });

  it("reports no synthesis for Madrid in December", () => {
    // Webb, Kline & Holick (1988): mid-latitude winter has no vitamin D window.
    expect(sunProse(city("madrid"), 11).regime).toBe("none");
    expect(sunProse(city("madrid"), 11).vitD).toBeNull();
  });

  it("reports polar day for Reykjavik in June", () => {
    const p = sunProse(city("reikiavik"), 5);
    expect(p.regime).toBe("polar");
  });
});

describe("sunProse figures agree with the page's own sources", () => {
  it("first and last day match dailySunTimes for that month", async () => {
    const { dailySunTimes } = await import("@/lib/sun-times");
    const c = city("madrid");
    const days = dailySunTimes(c.lat, c.lon, 7, c.timezone, c.tz);
    const p = sunProse(c, 7);
    expect(p.firstSunrise).toBeCloseTo(days[0].sunrise!, 5);
    expect(p.lastSunset).toBeCloseTo(days[days.length - 1].sunset!, 5);
    expect(p.days).toBe(days.length);
  });

  it("states the latitude it was given, not a rounded constant", () => {
    expect(sunProse(city("madrid"), 7).lat).toBeCloseTo(city("madrid").lat, 4);
  });

  it("day-length change is last minus first, signed", () => {
    const p = sunProse(city("madrid"), 7);
    expect(p.dayLengthDeltaMin).toBeLessThan(0); // August shortens in the north
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/__tests__/sun-prose.test.ts --maxWorkers=2`
Expected: FAIL — cannot resolve `@/lib/sun-prose`.

- [ ] **Step 3: Write the module**

```ts
import type { BuiltinCity } from "@/lib/cities";
import { dailySunTimes, getSunTimes } from "@/lib/sun-times";
import { getCurve, doyFromMonthDay, dateFromDoy } from "@/lib/solar";
import { computeExposureFromCurve } from "@/lib/vitd";
import { ozoneDU } from "@/lib/uv-model";

/**
 * The facts a sunrise page's paragraph states, computed from the same functions
 * the page's table uses.
 *
 * Structured parts rather than a sentence: the wording is translated, the facts
 * are not. And every number here is derived at render time from the model — none
 * is a constant and none is copied from other copy on the site, which is exactly
 * how the footer came to claim a 45° threshold the code abandoned in July.
 */
export type Regime = "synthesis" | "none" | "polar";

export interface SunProse {
  regime: Regime;
  lat: number;
  days: number;
  firstSunrise: number | null;
  firstSunset: number | null;
  lastSunrise: number | null;
  lastSunset: number | null;
  midDayLengthMin: number | null;
  dayLengthDeltaMin: number;
  peakElevationDeg: number;
  vitD: { windowStart: number; windowEnd: number; minutesNeeded: number; bestUVI: number } | null;
}

/** Mid-range assumptions, stated so the page can state them too. */
const SKIN_TYPE = 3;
const EXPOSED_FRACTION = 0.25;
const TARGET_IU = 1000;

export function sunProse(city: BuiltinCity, monthIndex: number): SunProse {
  const days = dailySunTimes(city.lat, city.lon, monthIndex, city.timezone, city.tz);
  const first = days[0];
  const last = days[days.length - 1];

  const len = (d: { sunrise: number | null; sunset: number | null }) =>
    d.sunrise !== null && d.sunset !== null ? (d.sunset - d.sunrise) * 60 : null;

  const doy15 = doyFromMonthDay(monthIndex, 15);
  const mid = getSunTimes(city.lat, city.lon, dateFromDoy(doy15), city.timezone, city.tz);
  const curve = getCurve(city.lat, city.lon, doy15, city.tz, city.timezone);
  const exposure = computeExposureFromCurve(curve, SKIN_TYPE, EXPOSED_FRACTION, TARGET_IU, null, {
    ozoneDu: ozoneDU(city.lat, city.lon, doy15),
    elevationM: city.elevation ?? 0,
  });

  const polar = days.some((d) => d.sunrise === null || d.sunset === null);
  const hasWindow = exposure !== null && exposure.windowEnd > exposure.windowStart;

  const firstLen = len(first);
  const lastLen = len(last);

  return {
    regime: polar ? "polar" : hasWindow ? "synthesis" : "none",
    lat: city.lat,
    days: days.length,
    firstSunrise: first.sunrise,
    firstSunset: first.sunset,
    lastSunrise: last.sunrise,
    lastSunset: last.sunset,
    midDayLengthMin: len(mid),
    dayLengthDeltaMin: firstLen !== null && lastLen !== null ? Math.round(lastLen - firstLen) : 0,
    peakElevationDeg: Math.max(...curve.map((p) => p.elevation)),
    vitD: hasWindow
      ? {
          windowStart: exposure!.windowStart,
          windowEnd: exposure!.windowEnd,
          minutesNeeded: Math.round(exposure!.minutesNeeded),
          bestUVI: Number(exposure!.bestUVI.toFixed(1)),
        }
      : null,
  };
}
```

If `BuiltinCity` is not the exported name in `lib/cities.ts`, use whatever that file exports — check first rather than inventing a type.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run lib/__tests__/sun-prose.test.ts --maxWorkers=2`
Expected: PASS, 6 tests. If the Reykjavik case is not `polar`, check whether `dailySunTimes` returns null or a sentinel for a sun that never sets — fix the module to match the data, and say so.

- [ ] **Step 5: Commit**

```bash
git add lib/sun-prose.ts lib/__tests__/sun-prose.test.ts
git commit -m "feat(prose): the facts a sunrise paragraph states, from the model"
```

---

### Task 3: The copy, in six locales

**Files:** `messages/{es,en,fr,de,ru,lt}.json`

Three templates, one per regime, under `sunrisePage`. They must read as prose — this is the passage meant to be extractable, so no bullet fragments and no telegraphic style.

- [ ] **Step 1: Add the Spanish**

```json
    "proseSynthesis": "En {city} ({lat}° de latitud), {month} de {year} tiene {days} días de sol que empieza a las {firstSunrise} y termina a las {firstSunset} el día 1, y a las {lastSunrise} y {lastSunset} el día {days}. A mitad de mes el día dura {dayLength} y el sol llega a {peak}° sobre el horizonte. La síntesis de vitamina D es posible entre las {windowStart} y las {windowEnd}, cuando el índice UV supera 3: en el mejor momento del día bastan unos {minutes} minutos con piel de fototipo medio y una cuarta parte del cuerpo expuesta para unas 1000 UI.",
    "proseNone": "En {city} ({lat}° de latitud), {month} de {year} tiene {days} días de sol que empieza a las {firstSunrise} y termina a las {firstSunset} el día 1, y a las {lastSunrise} y {lastSunset} el día {days}. A mitad de mes el día dura {dayLength} y el sol no pasa de {peak}° sobre el horizonte. A esa altura la atmósfera absorbe casi toda la radiación UVB, así que en {month} no hay síntesis de vitamina D en {city} a ninguna hora del día, por mucho tiempo que se pase al sol.",
    "prosePolar": "En {city} ({lat}° de latitud) el sol no sigue un ciclo normal de día y noche durante {month}: hay días en los que no llega a salir o no llega a ponerse. Por eso esta página no da una hora única de amanecer y atardecer para todo el mes, sino el detalle día a día."
```

- [ ] **Step 2: Translate into en, fr, de, ru, lt**

Acceptance criteria, all load-bearing:

- Every placeholder appears in every translation, spelled identically. A missing `{minutes}` renders a sentence that promises a number and does not give it.
- `proseNone` keeps the causal chain: low sun → atmosphere absorbs UVB → no synthesis *at any hour*. That claim is the most citable sentence on the site and the one no clinic publishes with a computation behind it. A translation that softens it to "synthesis is harder in winter" has thrown it away.
- `proseSynthesis` keeps the stated assumptions (mid phototype, a quarter of the body, ~1000 IU). Minutes without assumptions is a medical claim we cannot support.
- Never translate the city or month placeholders themselves.
- `messages/__tests__/health-claims.test.ts` must stay green.

- [ ] **Step 3: Key parity**

Run: `npx vitest run messages/__tests__/key-parity.test.ts --maxWorkers=2`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "feat(prose): three regimes of copy, in six locales"
```

---

### Task 4: Render it, on treated cities only

**Files:** `app/[locale]/[cityPrefix]/[city]/[month]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/prose-gating.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTreated } from "@/lib/phase2-cities";

describe("prose passage gating", () => {
  const source = readFileSync(
    join(process.cwd(), "app/[locale]/[cityPrefix]/[city]/[month]/page.tsx"),
    "utf8",
  );

  it("asks the assignment before rendering the passage", () => {
    expect(source).toMatch(/from "@\/lib\/phase2-cities"/);
    expect(source).toMatch(/isTreated\(/);
  });

  it("renders the passage from the prose module", () => {
    expect(source).toMatch(/from "@\/lib\/sun-prose"/);
  });

  it("revalidates daily rather than being frozen at build time", () => {
    expect(source).toMatch(/export const revalidate = 86400/);
  });

  it("keeps the split honest: the treated list is exactly the one on record", () => {
    expect(isTreated("madrid")).toBe(true);
    expect(isTreated("valencia")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/__tests__/prose-gating.test.ts --maxWorkers=2`
Expected: FAIL on the first three.

- [ ] **Step 3: Add ISR and the passage**

At the top of the page module, beside `generateStaticParams`:

```ts
/**
 * Daily ISR. The tables are astronomy and do not change, but the served HTML
 * carrying a current date is the difference between a page that reads as this
 * year's and one that reads as an archive — the freshness gap measured against
 * alpenglow, whose pages say "Aug 8".
 */
export const revalidate = 86400;
```

Inside the component, after `monthData(...)` is destructured, and rendering directly under the intro paragraph:

```tsx
  const prose = isTreated(base) ? sunProse(city, monthIndex) : null;
```

```tsx
      {prose && (
        <p className="mt-4 text-body text-text-secondary leading-relaxed">
          {t(
            prose.regime === "synthesis" ? "proseSynthesis"
            : prose.regime === "none" ? "proseNone"
            : "prosePolar",
            {
              city: cityName,
              month,
              year: new Date().getUTCFullYear(),
              lat: prose.lat.toFixed(1),
              days: prose.days,
              firstSunrise: t2(prose.firstSunrise),
              firstSunset: t2(prose.firstSunset),
              lastSunrise: t2(prose.lastSunrise),
              lastSunset: t2(prose.lastSunset),
              dayLength: prose.midDayLengthMin !== null ? fmtDayLength(prose.midDayLengthMin) : "—",
              peak: Math.round(prose.peakElevationDeg),
              windowStart: prose.vitD ? t2(prose.vitD.windowStart) : "",
              windowEnd: prose.vitD ? t2(prose.vitD.windowEnd) : "",
              minutes: prose.vitD ? prose.vitD.minutesNeeded : 0,
            },
          )}
        </p>
      )}
```

with `import { sunProse } from "@/lib/sun-prose";` and `import { isTreated } from "@/lib/phase2-cities";`.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run app/__tests__/prose-gating.test.ts --maxWorkers=2`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: clean typecheck; build succeeds. The month route should now report as ISR rather than fully static — note in the commit which it says.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/[cityPrefix]/[city]/[month]/page.tsx" app/__tests__/prose-gating.test.ts
git commit -m "feat(prose): render the passage on treated cities, with daily ISR"
```

---

### Task 5: Verify in served HTML, both sides

**Files:** Create `tests/e2e/prose-passage.spec.mjs`

The assertion that matters, and the one that protects the experiment: the passage must be in the treated pages' HTML **and absent from the control's**. A leak into the control group destroys the comparison silently.

- [ ] **Step 1: Write the check**

```js
/**
 * Phase 2 ships to half the sunrise cities. This checks both halves: the passage
 * present where it should be, absent where it should not. A leak into the
 * control group does not break any page — it just quietly makes the experiment
 * unable to answer anything.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/prose-passage.spec.mjs
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Treated and control, in Spanish (no prefix) and English.
const TREATED = ["/amanecer/madrid/agosto", "/en/sunrise/madrid/august", "/amanecer/roma/diciembre"];
const CONTROL = ["/amanecer/valencia/agosto", "/en/sunrise/valencia/august", "/amanecer/lisboa/diciembre"];

// A phrase from the passage that cannot appear in the table or the intro.
const MARKERS = ["de latitud", "° de latitud", "latitude"];

let failures = 0;
const fail = (m) => { console.error(`FAIL ${m}`); failures++; };

const hasPassage = (html) => MARKERS.some((m) => html.includes(m));

for (const path of TREATED) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) { fail(`${path} -> HTTP ${res.status}`); continue; }
  const html = await res.text();
  if (!hasPassage(html)) fail(`${path} is treated but has no passage`);
  else console.log(`ok   treated  ${path}`);
}

for (const path of CONTROL) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) { fail(`${path} -> HTTP ${res.status}`); continue; }
  const html = await res.text();
  if (hasPassage(html)) fail(`${path} is control but HAS the passage — the experiment is contaminated`);
  else console.log(`ok   control  ${path}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
```

Check the marker actually distinguishes: if the intro already says "latitud", pick a phrase that only the passage has, and say which you used.

- [ ] **Step 2: Run against a production build**

```bash
npm run build
```

In a second shell: `npm start`

```bash
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
BASE_URL=http://localhost:3000 node tests/e2e/prose-passage.spec.mjs
BASE_URL=http://localhost:3000 node tests/e2e/schema-graph.spec.mjs
```

Expected: ALL PASS from both.

- [ ] **Step 3: Read one passage end to end, in two languages**

```bash
curl -s http://localhost:3000/amanecer/madrid/agosto | sed 's/<[^>]*>/ /g' | grep -o 'En Madrid.\{0,400\}'
curl -s http://localhost:3000/amanecer/madrid/diciembre | sed 's/<[^>]*>/ /g' | grep -o 'En Madrid.\{0,400\}'
```

Read them. Do the numbers agree with the table on the same page? Does the December one say synthesis is impossible? A passage that reads well and states a wrong figure is worse than no passage — this step is a human check, not a grep.

- [ ] **Step 4: Full suite, lint, typecheck**

```bash
npx vitest run --maxWorkers=2
npm run lint
npm run typecheck
```

Expected: all green. Baseline before this plan: 66 files / 770 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/prose-passage.spec.mjs
git commit -m "test(prose): passage present on treated pages, absent on control"
```

---

## Done when

- Treated sunrise pages carry the paragraph in served HTML, in all six locales; control pages do not.
- The three regimes render on real cities: Madrid in August (synthesis), Madrid in December (none), Reykjavik in June (polar).
- The month route revalidates daily.
- Every figure in a passage matches the table on the same page.
- Full suite, lint, typecheck green.

## Explicitly not in this plan

- The "today" block for the current month. It is a separate change with its own edge case (a December page visited in August), and bundling it would make the experiment measure two things at once.
- Shipping to the control group. That happens when the read-out says so, per the assignment record.
- Any change to the tables, the FAQ, the schema, or city coverage.
