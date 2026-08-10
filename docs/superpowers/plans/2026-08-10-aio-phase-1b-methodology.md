# AI Overview citation — Phase 1b: methodology and bibliography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish how every number on the site is computed, with its bibliography, its limits and its correction history — the trust signal that separates a source from a page generator, and the one the health territory gates on.

**Architecture:** The 18 scientific references already exist in `messages/*.json`, byte-identical across all six locales because they are citations, not prose. They move to a single non-translated module, `/learn` starts reading them from there, and the new `/methodology` page consumes the same list. No new bibliography is written; it is relocated and made visible.

**Tech Stack:** Next.js App Router, next-intl (6 locales), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-09-ai-overview-citation-design.md` (phase 1b)

---

## What this is worth, stated plainly

Phase 1a shipped the demonstrated minimum: alpenglow is cited for sun-timing queries with an entity graph and nothing else. **Phase 1b has weaker evidence behind it.** It is the bet for the vitamin D territory, where the cited sources are dermatologists and clinics, and where our measured baseline is 4 queries with an AI Overview and zero citations. It is worth doing because it is cheap, because it is the only lever left that does not depend on third parties, and because it is what makes the `reviewedBy` slot meaningful the day a clinician exists. It is not worth doing because we are confident it works.

## Findings this plan acts on

- The 18 references live under `learn.block4.q*.sources` in all six message files and are **identical in every one** (verified 2026-08-10). Duplicated six times for no reason.
- `learn/page.tsx:58-65` reads them with a `try/catch` because `q7` and `q9` have no `sources`. That is why the build logs `MISSING_MESSAGE: learn.block4.q7.sources` in every locale. **Nothing is broken** — the catch handles it — but the noise disappears for free once the source of truth moves out of the message files.
- The model changelog has real material: `docs/superpowers/specs/2026-07-09-uv-model-fix.md` records that the old estimator overstated UV by 3–4× at low sun and consequently claimed Boston, New York, Madrid, Chicago and Toronto synthesised vitamin D twelve months a year, contradicting Webb, Kline & Holick (1988). Fixed on 2026-07-09 with Madronich 2007 + van Heuklon ozone.

## File Structure

| File | Responsibility |
|---|---|
| `lib/references.ts` (create) | The 18 citations, keyed by stable id. Not translated — they are bibliography. |
| `lib/__tests__/references.test.ts` (create) | Shape, uniqueness, and that every id used by a page exists. |
| `app/[locale]/learn/page.tsx` (modify, lines 56–66) | Read references from the module, drop the try/catch. |
| `messages/{es,en,fr,de,ru,lt}.json` (modify) | Remove the six duplicated `sources` arrays; add the `methodology` namespace. |
| `app/[locale]/methodology/page.tsx` (create) | The page. |
| `app/sitemap.ts` (modify) | Add `/methodology`. |
| `components/SiteNav.tsx`, `components/SiteFooter.tsx` (modify) | Link it. |
| `lib/schema.ts` (modify) | `citation` edges for pages that use the model. |

---

### Task 1: The references module

**Files:**
- Create: `lib/references.ts`
- Test: `lib/__tests__/references.test.ts`

- [ ] **Step 1: Extract the current data**

Run this to dump what is in `es.json` today — the module must contain exactly these, unchanged:

```bash
node -e "const m=require('./messages/es.json');const out=[];for(const [k,v] of Object.entries(m.learn.block4)){if(v&&v.sources)v.sources.forEach(s=>out.push({q:k,...s}))};console.log(JSON.stringify(out,null,1))"
```

Expected: 18 entries, each `{q, label, url}`. Keep this output; steps 3 and 5 both need it.

- [ ] **Step 2: Write the failing test**

Create `lib/__tests__/references.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { REFERENCES, referencesFor, type ReferenceId } from "@/lib/references";
import es from "@/messages/es.json";

describe("REFERENCES", () => {
  it("holds every citation that used to live in the message files", () => {
    expect(Object.keys(REFERENCES)).toHaveLength(18);
  });

  it("gives each one a label and a resolvable-looking url", () => {
    for (const [id, ref] of Object.entries(REFERENCES)) {
      expect(ref.label, id).toMatch(/\(\d{4}\)/); // "Holick MF (1982) — ..."
      expect(ref.url, id).toMatch(/^https:\/\//);
    }
  });

  it("has no duplicate urls, so the same paper is not cited under two ids", () => {
    const urls = Object.values(REFERENCES).map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("returns the citations for a learn question in order", () => {
    const got = referencesFor("q1");
    expect(got.length).toBeGreaterThan(0);
    expect(got[0]).toHaveProperty("label");
    expect(got[0]).toHaveProperty("url");
  });

  it("returns an empty list for a question that has no citations", () => {
    // q7 (golden hour) and q9 (midnight sun) are astronomy, not claims needing a paper.
    expect(referencesFor("q7")).toEqual([]);
    expect(referencesFor("q9")).toEqual([]);
  });

  /**
   * The migration guard: while the message files still carry `sources`, the module
   * must agree with them exactly. Delete this test in task 2, when the arrays go.
   */
  it("matches what es.json still says, label for label", () => {
    const fromMessages: { label: string; url: string }[] = [];
    for (const v of Object.values(es.learn.block4 as Record<string, { sources?: { label: string; url: string }[] }>)) {
      if (v?.sources) fromMessages.push(...v.sources);
    }
    const fromModule = Object.values(REFERENCES).map((r) => ({ label: r.label, url: r.url }));
    expect(fromModule).toEqual(expect.arrayContaining(fromMessages));
    expect(fromMessages).toHaveLength(fromModule.length);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run lib/__tests__/references.test.ts --maxWorkers=2`

Expected: FAIL — `Failed to resolve import "@/lib/references"`.

- [ ] **Step 4: Write the module**

Create `lib/references.ts` with this shape, filling `REFERENCES` from the step 1 dump — every label and url copied verbatim, ids derived from first author and year (`holick1982`, `lindqvist2016`, …), and `BY_QUESTION` mapping each `q1`…`q9` to the ids that question cited:

```ts
/**
 * The site's bibliography, in one place and in one language.
 *
 * These lived in `messages/*.json` under `learn.block4.q*.sources`, duplicated
 * across all six locales and byte-identical in every one — because a citation is
 * not prose. Author, year, journal and volume do not translate, so they had no
 * business in a translation file, and keeping six copies meant six chances to
 * drift.
 */

export interface Reference {
  label: string;
  url: string;
}

export const REFERENCES = {
  // … 18 entries, verbatim from the step 1 dump
} as const satisfies Record<string, Reference>;

export type ReferenceId = keyof typeof REFERENCES;

/** Which citations back each learn question. Questions absent here need none. */
const BY_QUESTION: Record<string, readonly ReferenceId[]> = {
  // … from the step 1 dump's `q` field
};

export function referencesFor(question: string): Reference[] {
  return (BY_QUESTION[question] ?? []).map((id) => REFERENCES[id]);
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run lib/__tests__/references.test.ts --maxWorkers=2`

Expected: PASS, 6 tests. If the last one fails, the module and the message files disagree — fix the module, not the test.

- [ ] **Step 6: Commit**

```bash
git add lib/references.ts lib/__tests__/references.test.ts
git commit -m "feat(references): the bibliography in one place, not six"
```

---

### Task 2: `/learn` reads the module, message files lose their copies

**Files:**
- Modify: `app/[locale]/learn/page.tsx` (lines 56–66)
- Modify: `messages/{es,en,fr,de,ru,lt}.json`
- Modify: `lib/__tests__/references.test.ts` (drop the migration guard)

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/learn-references.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

describe("learn page bibliography", () => {
  const source = readFileSync(join(process.cwd(), "app/[locale]/learn/page.tsx"), "utf8");

  it("reads citations from the module, not from translations", () => {
    expect(source).toMatch(/from "@\/lib\/references"/);
    expect(source).not.toContain("sources");
  });

  it.each([["es", es], ["en", en], ["fr", fr], ["de", de], ["ru", ru], ["lt", lt]] as const)(
    "%s carries no citation arrays any more",
    (_locale, messages) => {
      const block = messages.learn.block4 as Record<string, unknown>;
      for (const v of Object.values(block)) {
        if (v && typeof v === "object") expect(v).not.toHaveProperty("sources");
      }
    },
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run app/__tests__/learn-references.test.ts --maxWorkers=2`

Expected: FAIL on all seven — the page still reads `t.raw(...)` and every locale still has `sources`.

- [ ] **Step 3: Rewrite the page's resolution block**

In `app/[locale]/learn/page.tsx`, add to the imports:

```ts
import { referencesFor } from "@/lib/references";
```

Replace lines 56–66 (the `block.questions.map(...)` body with its try/catch) with:

```tsx
    items: block.questions.map((q) => {
      // "block4.q3.q" → "q3". Citations are keyed by question, not by locale.
      const question = q.qKey.split(".")[1];
      const sources = referencesFor(question);
      return { q: t(q.qKey), a: t(q.aKey), sources: sources.length ? sources : undefined };
    }),
```

- [ ] **Step 4: Strip `sources` from all six message files**

```bash
node -e "
for (const l of ['es','en','fr','de','ru','lt']) {
  const p = './messages/' + l + '.json';
  const m = JSON.parse(require('fs').readFileSync(p, 'utf8'));
  for (const v of Object.values(m.learn.block4)) { if (v && typeof v === 'object') delete v.sources; }
  require('fs').writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
  console.log(l, 'done');
}
"
```

Then check the diff is only deletions of `sources`: `git diff --stat messages/`

- [ ] **Step 5: Delete the migration guard**

In `lib/__tests__/references.test.ts`, remove the final test (`matches what es.json still says`) and its `import es from "@/messages/es.json"`. It existed to make the move safe and is now asserting against data that no longer exists.

- [ ] **Step 6: Run both files and watch them pass**

Run: `npx vitest run app/__tests__/learn-references.test.ts lib/__tests__/references.test.ts messages/__tests__/key-parity.test.ts --maxWorkers=2`

Expected: PASS. Key parity still holds because `sources` was removed from every locale equally.

- [ ] **Step 7: Verify the page still renders its citations**

```bash
npm run build
```

Expected: build succeeds, and the `MISSING_MESSAGE: learn.block4.q7.sources` lines are **gone** from the log — nothing asks the message files for citations any more.

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/learn/page.tsx" messages/ lib/__tests__/references.test.ts app/__tests__/learn-references.test.ts
git commit -m "refactor(learn): read citations from the module, drop six copies"
```

---

### Task 3: The methodology page

**Files:**
- Create: `app/[locale]/methodology/page.tsx`
- Modify: `messages/{es,en,fr,de,ru,lt}.json` (new `methodology` namespace)

- [ ] **Step 1: Add the namespace to `messages/es.json`**

```json
  "methodology": {
    "metaTitle": "Cómo se calculan estos datos solares y de vitamina D",
    "metaDescription": "El modelo completo: geometría solar, índice UV de cielo despejado (Madronich, ozono de van Heuklon), síntesis por fototipo, sus umbrales, sus límites y sus correcciones.",
    "heading": "Cómo se calcula todo esto",
    "intro": "Ninguna cifra de este sitio es una estimación a ojo. Todas salen de un modelo publicado, y aquí está cuál, con lo que sabe y lo que no.",
    "sunHeading": "Geometría solar",
    "sunBody": "La posición del sol se calcula con las ecuaciones estándar de declinación y ángulo horario: para una latitud, una longitud y un día del año, la elevación solar en cada instante. De ahí salen el amanecer, el atardecer, el crepúsculo civil y la duración del día. Es astronomía, no estadística: no depende del tiempo que haga.",
    "uvHeading": "Índice UV con cielo despejado",
    "uvBody": "El UV se estima con el modelo de Madronich (2007), corregido por el ozono estacional según van Heuklon. El ozono importa porque es justo lo que absorbe la radiación UVB cuando el sol está bajo, que es el régimen que decide si existe un invierno sin vitamina D. Todos los valores son de cielo despejado: las nubes solo pueden reducirlos.",
    "vitdHeading": "Síntesis de vitamina D",
    "vitdBody": "A partir del UV se calcula la dosis eritemática mínima según el fototipo de Fitzpatrick, ajustada por edad y por la superficie de piel expuesta. El resultado son los minutos necesarios para una dosis objetivo. Es una estimación poblacional, no un diagnóstico.",
    "thresholdHeading": "Los dos umbrales",
    "thresholdBody": "La síntesis requiere que el sol supere cierta elevación. Los estudios in vitro la sitúan en torno a 45°; sobre la piel real, los datos de campo son más conservadores y apuntan a 50°. El sitio usa 45° como umbral optimista y 50° como conservador, y dice cuál está usando en cada caso en lugar de elegir uno y callarlo.",
    "limitsHeading": "Lo que este modelo no sabe",
    "limitsBody": "No sabe si hay nubes en el momento en que miras. No tiene en cuenta la sombra de edificios ni montañas, ni la reflexión de la nieve o el agua, que puede aumentar la exposición de forma notable. Trata la piel como una superficie plana orientada al cielo. Y describe a una persona promedio de cada fototipo, no a ti: la medicación, el embarazo, la edad avanzada y varias enfermedades cambian la síntesis. No sustituye a un análisis de sangre ni al consejo de un profesional sanitario.",
    "changelogHeading": "Correcciones del modelo",
    "changelogBody": "Un modelo que nunca ha cambiado es un modelo que nadie ha revisado. Estas son sus correcciones.",
    "changelog1Date": "9 de julio de 2026",
    "changelog1Body": "El estimador anterior de UV sobreestimaba entre 3 y 4 veces con el sol bajo, porque ignoraba el ozono. La consecuencia era grave y publicada: el sitio afirmaba que en Boston, Nueva York, Madrid, Chicago y Toronto se sintetiza vitamina D los doce meses del año, contradiciendo a Webb, Kline y Holick (1988). Se sustituyó por Madronich con ozono de van Heuklon, y 51 de las 73 ciudades dejaron de figurar como «todo el año».",
    "referencesHeading": "Referencias",
    "reviewHeading": "Revisión",
    "reviewPending": "El contenido médico de este sitio todavía no ha sido revisado por un profesional sanitario. Cuando lo sea, aparecerá aquí su nombre y su colegiación."
  }
```

- [ ] **Step 2: Translate the namespace into `en`, `fr`, `de`, `ru`, `lt`**

Same keys, translated from the Spanish. Acceptance criteria:

- All 20 keys in each locale — the key-parity test enforces it.
- `changelog1Body` keeps all five city names, the "3 to 4 times" figure, the Webb/Kline/Holick (1988) attribution and the 51-of-73 number. It is the passage that demonstrates the site corrects itself; a translation that softens it into "the model was improved" has removed the entire point.
- `limitsBody` keeps every named limitation. Understating limits on a health page is the failure mode that matters here.
- `thresholdBody` keeps both figures (45° and 50°) and which is which.
- Do not translate "Madronich", "van Heuklon", "Fitzpatrick", "Webb", "Kline", "Holick".
- No medical claim beyond the Spanish; `messages/__tests__/health-claims.test.ts` must stay green.

- [ ] **Step 3: Run key parity and watch it pass**

Run: `npx vitest run messages/__tests__/key-parity.test.ts --maxWorkers=2`

Expected: PASS. A failure names the locale and key that is missing.

- [ ] **Step 4: Create the page**

Create `app/[locale]/methodology/page.tsx`, following `app/[locale]/about/page.tsx` for structure and `app/[locale]/connect/page.tsx` for metadata:

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/i18n/metadata";
import { REFERENCES } from "@/lib/references";
import A from "@/components/ui/A";
import Card from "@/components/ui/Card";

/**
 * How every number on the site is produced, with its bibliography, its limits
 * and its correction history. The limits and the changelog are the load-bearing
 * parts: anyone can publish a formula, and a model that has never been wrong in
 * public is a model nobody has checked.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "methodology" });
  const alternates = buildAlternates(locale, "/methodology");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates,
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: alternates.canonical },
  };
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl sm:text-3xl font-bold">{heading}</h2>
      <p className="mt-3 text-body text-text-secondary leading-relaxed">{body}</p>
    </section>
  );
}

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "methodology" });

  return (
    <main className="mx-auto max-w-[760px] px-4 py-6 sm:py-10">
      <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
        {t("heading")}
      </h1>
      <p className="mt-4 text-body sm:text-heading text-text-secondary leading-relaxed">{t("intro")}</p>

      <Section heading={t("sunHeading")} body={t("sunBody")} />
      <Section heading={t("uvHeading")} body={t("uvBody")} />
      <Section heading={t("vitdHeading")} body={t("vitdBody")} />
      <Section heading={t("thresholdHeading")} body={t("thresholdBody")} />
      <Section heading={t("limitsHeading")} body={t("limitsBody")} />

      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("changelogHeading")}</h2>
        <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("changelogBody")}</p>
        <Card variant="glass" className="mt-4 !p-5 sm:!p-6">
          <p className="text-caption font-semibold uppercase tracking-wider text-text-muted">
            {t("changelog1Date")}
          </p>
          <p className="mt-2 text-body text-text-secondary leading-relaxed">{t("changelog1Body")}</p>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("referencesHeading")}</h2>
        <ul className="mt-4 space-y-3">
          {Object.entries(REFERENCES).map(([id, ref]) => (
            <li key={id} className="text-caption sm:text-body text-text-secondary leading-relaxed">
              <A href={ref.url} target="_blank" rel="noopener">
                {ref.label}
              </A>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("reviewHeading")}</h2>
        <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("reviewPending")}</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Build and check all six render**

Run: `npm run build`

Expected: `/[locale]/methodology` appears among the prerendered routes for all six locales, with no missing-message warnings.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/methodology/page.tsx" messages/
git commit -m "feat(methodology): publish the model, its limits and its corrections"
```

---

### Task 4: Sitemap, navigation, and the citation edge

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `components/SiteNav.tsx`, `components/SiteFooter.tsx`, `messages/*.json`
- Modify: `lib/schema.ts`, `lib/__tests__/schema.test.ts`

- [ ] **Step 1: Run the sitemap test and watch it fail**

Run: `npx vitest run app/__tests__/sitemap.test.ts --maxWorkers=2`

Expected: FAIL on `lists every indexable static route that exists on disk`, naming `/methodology`. This is the guard added in phase 1a doing its job.

- [ ] **Step 2: Add the route to the sitemap**

In `app/sitemap.ts`, after the `/about` entry:

```ts
  { path: "/methodology", changeFrequency: "monthly" as const, priority: 0.6 },
```

Update the count in `app/__tests__/sitemap.test.ts`: `48 + 438 + ...` becomes `54 + 438 + ...`, and its comment from "8 pages ×6" to "9 pages ×6".

- [ ] **Step 3: Run it and watch it pass**

Run: `npx vitest run app/__tests__/sitemap.test.ts --maxWorkers=2`

Expected: PASS, 10 tests.

- [ ] **Step 4: Add the nav label to all six locales**

Under the `footer` namespace, beside `about`:

- es: `"methodology": "Cómo se calcula"`
- en: `"methodology": "Methodology"`
- fr: `"methodology": "Méthodologie"`
- de: `"methodology": "Methodik"`
- ru: `"methodology": "Методика"`
- lt: `"methodology": "Metodika"`

- [ ] **Step 5: Link it from the drawer and the footer**

In `components/SiteFooter.tsx`, append to the app links array:

```tsx
    { href: "/methodology", label: t("footer.methodology") },
```

In `components/SiteNav.tsx`, add to the `drawerOnly` array (NOT to `secondary`): phase 1a measured that a third inline link truncates the logo at 1024px, and this would be a fourth.

```tsx
    { href: "/methodology", label: t("footer.methodology") },
```

- [ ] **Step 6: Add the citation edge to the schema**

**Scope decision, deviating from the spec.** The spec said to put `citation` on "the pages that use the model", which is all 3360 of them. Eighteen `ScholarlyArticle` nodes repeated on every city and month page would add real weight to pages whose whole purpose is being crawled cheaply, and would say the same thing 3360 times. So `citation` goes on `/methodology` only, and the data pages link to it in prose instead (task 4b). One authoritative statement of the bibliography, referenced from everywhere, is the same principle as the `@id`s in phase 1a.

In `lib/schema.ts`:

```ts
import { REFERENCES } from "@/lib/references";

/**
 * `citation` edges for the methodology page — the one place that states the
 * bibliography. Data pages link to it rather than repeating eighteen nodes each,
 * which on 3360 pages would be weight without information.
 */
export function modelCitations(): { citation: { "@type": string; name: string; url: string }[] } {
  return {
    citation: Object.values(REFERENCES).map((r) => ({
      "@type": "ScholarlyArticle",
      name: r.label,
      url: r.url,
    })),
  };
}
```

Then emit it on the methodology page. In `app/[locale]/methodology/page.tsx`, inside the `<main>`:

```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            name: t("metaTitle"),
            description: t("metaDescription"),
            ...authorship(),
            ...modelCitations(),
          }),
        }}
      />
```

importing `authorship` and `modelCitations` from `@/lib/schema`. `TechArticle` rather than `WebPage`: it documents how a system works, which is what that type is for. The `jsonld-authorship` test from phase 1a will require this page's block to be attributed — it is, via `authorship()`.

Add to `lib/__tests__/schema.test.ts`:

```ts
describe("modelCitations", () => {
  it("emits one ScholarlyArticle per reference", () => {
    const { citation } = modelCitations();
    expect(citation).toHaveLength(Object.keys(REFERENCES).length);
    expect(citation[0]["@type"]).toBe("ScholarlyArticle");
  });

  it("carries the url of each paper", () => {
    for (const c of modelCitations().citation) expect(c.url).toMatch(/^https:\/\//);
  });
});
```

Import `modelCitations` and `REFERENCES` at the top of that test file.

- [ ] **Step 7: Link the data pages to it (task 4b)**

The spec's requirement that authority not live on an island: every page that states a figure
should say where the figure comes from. Add a link with text that says what is there.

Add the label to all six locales under the `city` namespace used by those pages — check the
namespace each page already uses with `getTranslations` before adding the key:

- es: `"howCalculated": "Cómo se calculan estas horas"`
- en: `"howCalculated": "How these times are calculated"`
- fr: `"howCalculated": "Comment ces horaires sont calculés"`
- de: `"howCalculated": "Wie diese Zeiten berechnet werden"`
- ru: `"howCalculated": "Как рассчитаны эти данные"`
- lt: `"howCalculated": "Kaip apskaičiuoti šie laikai"`

Then, in `app/[locale]/[cityPrefix]/[city]/page.tsx` and
`app/[locale]/[cityPrefix]/[city]/[month]/page.tsx`, add near the existing footer nav of each:

```tsx
      <p className="mt-6 text-caption text-text-muted">
        <A href="/methodology">{t("howCalculated")}</A>
      </p>
```

Use the localized `Link` from `@/i18n/navigation` if `A` does not already wrap it in those
files — match whatever the neighbouring links in that file do.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run lib/__tests__/schema.test.ts app/__tests__/sitemap.test.ts messages/__tests__/key-parity.test.ts --maxWorkers=2`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/sitemap.ts app/__tests__/sitemap.test.ts components/ messages/ lib/schema.ts lib/__tests__/schema.test.ts
git commit -m "feat(methodology): list it, link it, and cite the papers in JSON-LD"
```

---

### Task 5: Full verification

**Files:**
- Modify: `tests/e2e/schema-graph.spec.mjs`

- [ ] **Step 1: Add the new page to the served-HTML check**

In `tests/e2e/schema-graph.spec.mjs`, extend `PAGES`:

```js
const PAGES = ["/", "/about", "/methodology", "/en/about", "/en/methodology", "/vitamina-d/madrid", "/amanecer/madrid/agosto"];
```

- [ ] **Step 2: Build and run it**

```bash
npm run build
```

In a second shell:

```bash
npm start
```

```bash
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
BASE_URL=http://localhost:3000 node tests/e2e/schema-graph.spec.mjs
```

Expected: `ok` for all seven paths, then `ALL PASS`. Stop the server when done.

- [ ] **Step 3: Confirm the references reach the HTML**

```bash
curl -s http://localhost:3000/methodology | grep -c "pubmed.ncbi.nlm.nih.gov"
```

Expected: at least 18 — the bibliography is in the served markup, not built client-side.

- [ ] **Step 4: Full suite, lint, typecheck**

```bash
npx vitest run --maxWorkers=2
npm run lint
npm run typecheck
```

Expected: all pass. The phase 1a baseline was 64 files / 754 tests; this plan adds two test files and removes none.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/schema-graph.spec.mjs
git commit -m "test(methodology): assert the page and its bibliography ship in HTML"
```

---

## Done when

- `/methodology` resolves in all six locales with correct alternates, and is in the sitemap.
- The 18 references render on it, from `lib/references.ts`, and appear in the served HTML.
- No `sources` array remains in any message file, and the build no longer logs `MISSING_MESSAGE: learn.block4.q*.sources`.
- `/learn` still shows its citations, unchanged from the reader's point of view.
- `reviewedBy` still appears nowhere; the page says in words that no clinician has reviewed it.
- Full suite, lint and typecheck green.

## Explicitly not in this plan

- The prose passage, ISR and the vitamin D wedge — phase 2.
- Finding an actual medical reviewer. The page states the absence honestly; filling it is not a code task.
- Any change to `/learn`'s copy, layout or question set — only where it reads citations from.
- Rewriting the model. This documents what the code already does; if writing it up reveals a discrepancy, that is a finding to report, not to fix here.

---

## Correction, recorded after implementation (2026-08-10)

**This plan's central premise was wrong, and following it verbatim would have shipped
incorrect citations.** It states "the 18 references live under `learn.block4.q*.sources`".
They do not: the citations are spread across `learn.block1` to `block4` — **80 citation
slots over 27 questions, resolving to 51 unique papers**.

Two consequences, both caught during implementation:

- The Task 1 step 1 extraction command only walks `m.learn.block4`, so it would have built a
  module holding a quarter of the bibliography, and the Task 2 step 4 strip script would have
  left three blocks' `sources` untouched.
- Worse, the Task 2 step 3 code derives the lookup key with `q.qKey.split(".")[1]`, which
  discards the block. `block1.q1`, `block2.q1` and `block3.q1` would all have resolved to
  `block4.q1`'s citations — **wrong citations under 20 questions**, rendered as fact on a
  health page.

What shipped instead: 51 references, `BY_QUESTION` keyed by the full `block1.q1` form, and
the page passing `qKey.replace(/\.q$/, "")`. The counts in Task 1's tests are 51 and the
slot total is 80.

**The lesson for the next plan:** the extraction script and the assertion that depends on it
were written from the same wrong assumption, so they agreed with each other and neither
caught it. Verify the shape of the data before writing the migration that moves it —
`git grep` for the key across the whole file, not just the subtree the symptom pointed at.
