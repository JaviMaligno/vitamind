# AI Overview citation — Phase 1a: entity graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site a machine-readable identity — a stable `Organization`, a stable `Person`, and every page attributing authorship to them — because that is the minimum configuration measurably present on the small competitor Google already cites.

**Architecture:** One new pure module (`lib/schema.ts`) builds a JSON-LD `@graph` from stable `@id`s. The root layout stops hand-rolling its JSON-LD and emits that graph instead. A new `/about` page gives the `Person` node something a human can verify, and both nav surfaces link to it. No page content or rendering model changes — that is phase 2.

**Tech Stack:** Next.js App Router (Next 16), next-intl (6 locales, `as-needed` prefix), TypeScript, Vitest + jsdom, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-08-09-ai-overview-citation-design.md`

---

## Deviation from the spec, decided during planning

The spec says `dateModified` is "included because it is nearly free". **It is not included here, and phase 2 adds it.** There is no honest value available at this layer: the site has no build timestamp exposed (only `VERCEL_GIT_COMMIT_SHA`), and a `dateModified` on a global node would be either invented or the deploy time of unrelated code. The spec's own evidence says alpenglow is cited without it. Phase 2 introduces ISR, where pages have a real modification date that means something, and that is where it belongs.

## File Structure

| File | Responsibility |
|---|---|
| `lib/schema.ts` (create) | Pure builders for the JSON-LD graph. No React, no env reads beyond `SITE_URL`. |
| `lib/__tests__/schema.test.ts` (create) | Unit tests for the builders. |
| `app/[locale]/layout.tsx` (modify, lines 101–117) | Replace the inline `WebApplication` object with `siteGraph(...)`. |
| `app/[locale]/about/page.tsx` (create) | Server component, the human-verifiable page behind the `Person` node. |
| `messages/{es,en,fr,de,ru,lt}.json` (modify) | New `about` namespace. |
| `messages/__tests__/key-parity.test.ts` (create) | Every locale has the same key set as `es`. |
| `components/SiteNav.tsx` (modify, ~line 56) | Add `/about` to the secondary nav array. |
| `components/SiteFooter.tsx` (modify, ~line 39) | Add `/about` to the app links array. |

---

### Task 1: The schema module

**Files:**
- Create: `lib/schema.ts`
- Test: `lib/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ORGANIZATION_ID, PERSON_ID, siteGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

const nodeOfType = (graph: ReturnType<typeof siteGraph>, type: string) =>
  graph["@graph"].find((n) => n["@type"] === type);

describe("siteGraph", () => {
  it("emits Organization, Person and WebApplication in one graph", () => {
    const g = siteGraph({ locale: "es", description: "desc" });
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"].map((n) => n["@type"])).toEqual(
      expect.arrayContaining(["Organization", "Person", "WebApplication"]),
    );
  });

  it("gives the entity nodes stable @ids anchored to the canonical host", () => {
    const g = siteGraph({ locale: "es", description: "desc" });
    expect(nodeOfType(g, "Organization")!["@id"]).toBe(`${SITE_URL}/#organization`);
    expect(nodeOfType(g, "Person")!["@id"]).toBe(`${SITE_URL}/#author`);
    expect(ORGANIZATION_ID).toBe(`${SITE_URL}/#organization`);
    expect(PERSON_ID).toBe(`${SITE_URL}/#author`);
  });

  it("attributes the application to the Person and publishes it under the Organization", () => {
    const app = nodeOfType(siteGraph({ locale: "es", description: "desc" }), "WebApplication")!;
    expect(app.author).toEqual({ "@id": PERSON_ID });
    expect(app.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });

  it("points the Person at the about page and their other profiles", () => {
    const person = nodeOfType(siteGraph({ locale: "es", description: "desc" }), "Person")!;
    expect(person.url).toBe(`${SITE_URL}/about`);
    // Cast: graph nodes are Record<string, unknown>, and `toContain` needs an
    // array type to typecheck.
    expect(person.sameAs as string[]).toContain("https://javieraguilar.ai");
  });

  it("carries the locale and description it was given", () => {
    const app = nodeOfType(siteGraph({ locale: "fr", description: "la desc" }), "WebApplication")!;
    expect(app.inLanguage).toBe("fr");
    expect(app.description).toBe("la desc");
  });

  it("omits reviewedBy while no reviewer exists", () => {
    const app = nodeOfType(siteGraph({ locale: "es", description: "d" }), "WebApplication")!;
    expect(app.reviewedBy).toBeUndefined();
    expect(JSON.stringify(siteGraph({ locale: "es", description: "d" }))).not.toContain("reviewedBy");
  });

  it("emits reviewedBy once a reviewer is supplied", () => {
    const g = siteGraph({
      locale: "es",
      description: "d",
      reviewer: { name: "Dra. Ejemplo", jobTitle: "Dermatóloga", url: "https://example.org/dra" },
    });
    const app = nodeOfType(g, "WebApplication")!;
    expect(app.reviewedBy).toEqual({
      "@type": "Person",
      name: "Dra. Ejemplo",
      jobTitle: "Dermatóloga",
      url: "https://example.org/dra",
    });
  });

  it("emits a reviewer without a url, since not every clinician has a public profile", () => {
    const g = siteGraph({
      locale: "es",
      description: "d",
      reviewer: { name: "Dr. Ejemplo", jobTitle: "Endocrino" },
    });
    const app = nodeOfType(g, "WebApplication")!;
    expect(app.reviewedBy).toEqual({ "@type": "Person", name: "Dr. Ejemplo", jobTitle: "Endocrino" });
    expect(JSON.stringify(app.reviewedBy)).not.toContain("url");
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run lib/__tests__/schema.test.ts --maxWorkers=2`

Expected: FAIL — `Failed to resolve import "@/lib/schema"`.

- [ ] **Step 3: Write the module**

Create `lib/schema.ts`:

```ts
import { SITE_URL } from "@/lib/site";

/**
 * The site's JSON-LD identity graph.
 *
 * Search Console's Search Appearance report read "Sin datos" on 2026-08-09: the
 * FAQPage markup the site already served earned no enhanced appearance at all.
 * Markup without an entity behind it is an assertion nothing can verify. The
 * small competitor Google does cite for the same queries (alpenglowapp.com)
 * serves exactly this and little else: an Organization, a Person, and an
 * `author` edge between them, all on stable `@id`s.
 *
 * Stable `@id`s are the point. They are what lets separate pages refer to the
 * same entity instead of each re-declaring an anonymous one.
 */

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const PERSON_ID = `${SITE_URL}/#author`;

const AUTHOR_NAME = "Javier Aguilar";
const AUTHOR_PROFILES = ["https://javieraguilar.ai", "https://github.com/JaviMaligno"];

/** A healthcare professional who has reviewed the medical copy. */
export interface Reviewer {
  name: string;
  jobTitle: string;
  url?: string;
}

/**
 * Set this when a clinician actually reviews the content — and not before.
 * Claiming review that did not happen is the one failure mode worse than
 * having no reviewer at all.
 */
export const MEDICAL_REVIEWER: Reviewer | null = null;

export interface SiteGraphInput {
  locale: string;
  description: string;
  /** Defaults to the module constant; injectable so the absent case is testable. */
  reviewer?: Reviewer | null;
}

// The graph is data, not a typed schema.org model: a loose node type keeps the
// builders readable without pulling in a dependency for one file.
type Node = Record<string, unknown> & { "@type": string };

export function siteGraph({
  locale,
  description,
  reviewer = MEDICAL_REVIEWER,
}: SiteGraphInput): { "@context": string; "@graph": Node[] } {
  const organization: Node = {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Vitamina D Explorer",
    url: SITE_URL,
    founder: { "@id": PERSON_ID },
  };

  const person: Node = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: AUTHOR_NAME,
    url: `${SITE_URL}/about`,
    sameAs: AUTHOR_PROFILES,
  };

  const application: Node = {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#webapp`,
    name: "Vitamina D Explorer",
    url: SITE_URL,
    description,
    applicationCategory: "HealthApplication",
    operatingSystem: "Any",
    inLanguage: locale,
    author: { "@id": PERSON_ID },
    publisher: { "@id": ORGANIZATION_ID },
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    featureList:
      "Real-time UV synthesis windows, Personalized skin type calculator, 5-day forecast, Global heatmap, Push notifications, Multi-language support",
    ...(reviewer ? { reviewedBy: reviewerNode(reviewer) } : {}),
  };

  return { "@context": "https://schema.org", "@graph": [organization, person, application] };
}

function reviewerNode(reviewer: Reviewer): Node {
  return {
    "@type": "Person",
    name: reviewer.name,
    jobTitle: reviewer.jobTitle,
    ...(reviewer.url ? { url: reviewer.url } : {}),
  };
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run lib/__tests__/schema.test.ts --maxWorkers=2`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts lib/__tests__/schema.test.ts
git commit -m "feat(schema): a site identity graph with stable @ids"
```

---

### Task 2: Serve the graph from the root layout

**Files:**
- Modify: `app/[locale]/layout.tsx` (the `<script type="application/ld+json">` block, lines 101–117)

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/layout-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The layout is an async server component, so it is asserted at the source
 * level: what matters is that it delegates to the schema module instead of
 * hand-rolling a second, drifting copy of the same JSON-LD.
 */
describe("root layout JSON-LD", () => {
  const source = readFileSync(join(process.cwd(), "app/[locale]/layout.tsx"), "utf8");

  it("builds its JSON-LD from the schema module", () => {
    expect(source).toContain("siteGraph");
    expect(source).toMatch(/from "@\/lib\/schema"/);
  });

  it("no longer hand-rolls a WebApplication object inline", () => {
    expect(source).not.toContain('"@type": "WebApplication"');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run app/__tests__/layout-schema.test.ts --maxWorkers=2`

Expected: FAIL — both assertions fail; the inline `"@type": "WebApplication"` is still there.

- [ ] **Step 3: Edit the layout**

In `app/[locale]/layout.tsx`, add to the imports:

```ts
import { siteGraph } from "@/lib/schema";
```

Then replace the whole `<script type="application/ld+json">…</script>` block with:

```tsx
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              siteGraph({ locale, description: DESCRIPTIONS[locale] ?? DESCRIPTIONS.en }),
            ),
          }}
        />
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run app/__tests__/layout-schema.test.ts --maxWorkers=2`

Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: no output (success). If `DESCRIPTIONS` is reported as unused, it is still used — it is passed into `siteGraph`.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/layout.tsx" app/__tests__/layout-schema.test.ts
git commit -m "feat(schema): serve the identity graph from the root layout"
```

---

### Task 3: The about page and its copy

**Files:**
- Create: `app/[locale]/about/page.tsx`
- Modify: `messages/es.json`, `messages/en.json`, `messages/fr.json`, `messages/de.json`, `messages/ru.json`, `messages/lt.json`
- Create: `messages/__tests__/key-parity.test.ts`

- [ ] **Step 1: Write the failing parity test**

Create `messages/__tests__/key-parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import es from "@/messages/es.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import ru from "@/messages/ru.json";
import lt from "@/messages/lt.json";

/**
 * A missing key does not fail the build — next-intl renders the key name, so a
 * half-translated namespace ships silently and only shows up as gibberish on a
 * page nobody happened to open in Lithuanian.
 */
const flatten = (obj: unknown, prefix = ""): string[] =>
  typeof obj === "object" && obj !== null && !Array.isArray(obj)
    ? Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      )
    : [prefix];

const LOCALES = { en, fr, de, ru, lt } as const;

describe("message key parity", () => {
  const base = flatten(es).sort();

  it.each(Object.keys(LOCALES))("%s has exactly the keys es has", (locale) => {
    const other = flatten(LOCALES[locale as keyof typeof LOCALES]).sort();
    expect(other.filter((k) => !base.includes(k))).toEqual([]);
    expect(base.filter((k) => !other.includes(k))).toEqual([]);
  });

  it("es defines the about namespace", () => {
    expect(base).toContain("about.metaTitle");
    expect(base).toContain("about.heading");
    expect(base).toContain("about.body");
    expect(base).toContain("about.whyHeading");
    expect(base).toContain("about.whyBody");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run messages/__tests__/key-parity.test.ts --maxWorkers=2`

Expected: FAIL on the `about` namespace assertions. The parity assertions may pass already — that is fine, they are the guard for step 3.

- [ ] **Step 3: Add the `about` namespace to `messages/es.json`**

Add this top-level key (keep the file's existing key ordering style):

```json
  "about": {
    "metaTitle": "Quién está detrás de Vitamina D Explorer",
    "metaDescription": "Quién construye Vitamina D Explorer, por qué existe y cómo se calculan sus datos solares y de síntesis de vitamina D.",
    "heading": "Quién está detrás",
    "body": "Vitamina D Explorer lo construye y mantiene Javier Aguilar. No hay una empresa detrás ni un equipo de contenidos: hay una persona que decidió que la pregunta «¿cuánto sol necesito hoy?» merecía una respuesta calculada y no una regla general.",
    "whyHeading": "Por qué existe",
    "whyBody": "La respuesta habitual —«diez o quince minutos al día»— es la misma en Oslo en diciembre que en Nairobi en junio, y en uno de esos dos sitios es imposible. La síntesis de vitamina D depende de la elevación solar, del ozono, del fototipo y de la superficie de piel expuesta. Todo eso se puede calcular, y eso es lo que hace esta herramienta.",
    "contactHeading": "Contacto y código",
    "contactBody": "El modelo, sus fuentes y sus límites están publicados. Si encuentras un error en un cálculo, quiero saberlo."
  }
```

- [ ] **Step 4: Add the same namespace to `messages/en.json`**

```json
  "about": {
    "metaTitle": "Who is behind Vitamina D Explorer",
    "metaDescription": "Who builds Vitamina D Explorer, why it exists, and how its sun and vitamin D synthesis figures are calculated.",
    "heading": "Who is behind this",
    "body": "Vitamina D Explorer is built and maintained by Javier Aguilar. There is no company behind it and no content team: there is one person who decided the question \"how much sun do I need today?\" deserved a calculated answer rather than a rule of thumb.",
    "whyHeading": "Why it exists",
    "whyBody": "The usual answer — \"ten or fifteen minutes a day\" — is the same in Oslo in December as in Nairobi in June, and in one of those places it is impossible. Vitamin D synthesis depends on solar elevation, ozone, phototype and the area of skin exposed. All of that can be computed, and that is what this tool does.",
    "contactHeading": "Contact and code",
    "contactBody": "The model, its sources and its limits are published. If you find an error in a calculation, I want to hear about it."
  }
```

- [ ] **Step 5: Translate the same eight keys into `fr`, `de`, `ru` and `lt`**

Same key names, same structure, translated from the Spanish above. The eight are `metaTitle`, `metaDescription`, `heading`, `body`, `whyHeading`, `whyBody`, `contactHeading`, `contactBody`. Acceptance criteria, because "translate it" is otherwise unverifiable:

- All eight keys present in each locale — the parity test in step 6 enforces this.
- Register plain and factual. This page exists as a trust signal; marketing tone works against it.
- The product name "Vitamina D Explorer" and the personal name "Javier Aguilar" stay untranslated.
- `whyBody` keeps both city examples (Oslo in December, Nairobi in June) and the four named factors (solar elevation, ozone, phototype, exposed skin area). They carry the argument; a translation that drops one is wrong even if it reads well.
- No medical claim is added that the Spanish does not make — `messages/__tests__/health-claims.test.ts` guards this and must stay green.

- [ ] **Step 6: Run the parity test and watch it pass**

Run: `npx vitest run messages/__tests__/key-parity.test.ts --maxWorkers=2`

Expected: PASS, 6 tests (5 locales + the about-namespace assertion).

- [ ] **Step 7: Create the page**

Create `app/[locale]/about/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { buildAlternates } from "@/i18n/metadata";
import A from "@/components/ui/A";

/**
 * The page the schema `Person` node points at. A `Person` with no page behind
 * it is an assertion with nothing to verify, which is the state the site was
 * in before phase 1a.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  const alternates = buildAlternates(locale, "/about");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates,
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: alternates.canonical },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <main className="mx-auto max-w-[720px] px-4 py-6 sm:py-10">
      <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-text-primary">
        {t("heading")}
      </h1>
      <p className="mt-4 text-body sm:text-heading text-text-secondary leading-relaxed">{t("body")}</p>

      <h2 className="mt-10 font-display text-2xl sm:text-3xl font-bold">{t("whyHeading")}</h2>
      <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("whyBody")}</p>

      <h2 className="mt-10 font-display text-2xl sm:text-3xl font-bold">{t("contactHeading")}</h2>
      <p className="mt-3 text-body text-text-secondary leading-relaxed">{t("contactBody")}</p>
      <p className="mt-4 text-body">
        <A href="https://javieraguilar.ai" target="_blank" rel="noopener">
          javieraguilar.ai
        </A>
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Verify the page renders in every locale**

Run: `npm run build`

Expected: the build output lists `/about` and `/[locale]/about` among the prerendered routes, with no missing-message warnings.

- [ ] **Step 9: Commit**

```bash
git add "app/[locale]/about/page.tsx" messages/ messages/__tests__/key-parity.test.ts
git commit -m "feat(about): the page the Person node points at, in six locales"
```

---

### Task 4: Link it from both navigation surfaces

**Files:**
- Modify: `components/SiteNav.tsx` (the `secondary` array, ~line 56)
- Modify: `components/SiteFooter.tsx` (the app links array, ~line 39)
- Modify: `messages/es.json` + the other five (one new key)

- [ ] **Step 1: Add the label key to all six locales**

Under the existing `footer` namespace in each `messages/*.json`, add `"about"`:

- es: `"about": "Quién está detrás"`
- en: `"about": "About"`
- fr: `"about": "À propos"`
- de: `"about": "Über uns"`
- ru: `"about": "О проекте"`
- lt: `"about": "Apie"`

- [ ] **Step 2: Run the parity test**

Run: `npx vitest run messages/__tests__/key-parity.test.ts --maxWorkers=2`

Expected: PASS. If it fails, a locale is missing `footer.about` — add it.

- [ ] **Step 3: Add the link to the footer**

In `components/SiteFooter.tsx`, in the app links array that currently ends with
`{ href: "/partners", label: t("footer.partners") }`, append:

```tsx
    { href: "/about", label: t("footer.about") },
```

- [ ] **Step 4: Add the link to the nav**

In `components/SiteNav.tsx`, the `secondary` array becomes:

```tsx
  const secondary = [
    { href: "/connect", label: t("nav.connect") },
    { href: "/partners", label: t("footer.partners") },
    { href: "/about", label: t("footer.about") },
  ];
```

Note on the desktop bar: this is the third inline link at `lg`, alongside the cities link, the theme toggle, the locale switcher and the sign-in button. Check at 1024 px that the logo does not wrap — the July UI audit recorded exactly that regression. If it wraps, keep `/about` in the mobile sheet and the footer only, and say so in the commit message.

- [ ] **Step 5: Verify both surfaces at two widths**

Run: `npm run dev`

Check `http://localhost:3000/` at 1280 px and at 390 px:
- 1280 px: "Quién está detrás" appears in the top bar and the logo does not wrap.
- 390 px: it appears inside the menu sheet, and the tap target is at least 44 px tall.
- The footer lists it under "Aplicación" at both widths.

- [ ] **Step 6: Commit**

```bash
git add components/SiteNav.tsx components/SiteFooter.tsx messages/
git commit -m "feat(nav): surface the about page in the header and footer"
```

---

### Task 5: Verify the graph in served HTML

**Files:**
- Create: `tests/e2e/schema-graph.spec.mjs`

This is the assertion that matters. Every test above checks a module or a source file; none of them proves the graph reaches the HTML a crawler receives.

- [ ] **Step 1: Write the check**

Create `tests/e2e/schema-graph.spec.mjs`:

```js
/**
 * Asserts the identity graph is in the HTML a crawler gets — not in a module,
 * not after hydration. Run against a running server:
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/schema-graph.spec.mjs
 *
 * Standalone script, not a @playwright/test spec, matching tests/e2e/.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const PAGES = ["/", "/about", "/en/about", "/vitamina-d/madrid", "/amanecer/madrid/agosto"];

let failures = 0;
const fail = (msg) => { console.error(`FAIL ${msg}`); failures++; };

for (const path of PAGES) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) { fail(`${path} -> HTTP ${res.status}`); continue; }
  const html = await res.text();

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean);

  const graph = blocks.find((b) => Array.isArray(b["@graph"]));
  if (!graph) { fail(`${path} has no @graph block`); continue; }

  const types = graph["@graph"].map((n) => n["@type"]);
  for (const t of ["Organization", "Person", "WebApplication"]) {
    if (!types.includes(t)) fail(`${path} graph is missing ${t}`);
  }

  const person = graph["@graph"].find((n) => n["@type"] === "Person");
  const app = graph["@graph"].find((n) => n["@type"] === "WebApplication");
  if (!person?.["@id"]?.endsWith("/#author")) fail(`${path} Person has no stable @id`);
  if (app?.author?.["@id"] !== person?.["@id"]) fail(`${path} author does not resolve to the Person`);
  if (JSON.stringify(graph).includes("reviewedBy")) fail(`${path} claims a reviewer that does not exist`);

  console.log(`ok   ${path}`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it against a production build**

The dev server is not the artefact crawlers see, so build first. The build takes over two
minutes; run it and wait for it to finish before starting the server.

```bash
npm run build
```

In a second shell, start the server and wait until it answers rather than sleeping a fixed
amount:

```bash
npm start
```

```bash
until curl -sf -o /dev/null http://localhost:3000/; do sleep 1; done
BASE_URL=http://localhost:3000 node tests/e2e/schema-graph.spec.mjs
```

Expected: `ok` for all five paths, then `ALL PASS`. Stop the server when done.

- [ ] **Step 3: Run the whole suite**

Run: `npx vitest run --maxWorkers=2`

Expected: all files pass. Baseline before this plan was 59 passed, 1 skipped, 722 tests; this plan adds three test files.

- [ ] **Step 4: Lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: no output from either.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/schema-graph.spec.mjs
git commit -m "test(schema): assert the identity graph reaches served HTML"
```

---

## Done when

- `npx vitest run --maxWorkers=2` passes, with the three new test files included.
- `node tests/e2e/schema-graph.spec.mjs` reports ALL PASS against a production build.
- `/about` resolves in all six locales with correct hreflang alternates.
- The about link is reachable from the header and the footer at 1280 px and 390 px, with no logo wrap.
- `reviewedBy` appears nowhere in served HTML.

## Explicitly not in this plan

- `/methodology` and the bibliography — phase 1b.
- The prose passage, ISR and the vitamin D wedge — phase 2.
- `dateModified` — phase 2, for the reason recorded at the top.
- Any change to page content, rendering model or city coverage.

---

## Deviation, recorded after implementation (2026-08-10)

**`/about` is not in the desktop header, contrary to Task 4's acceptance criteria.** The task
allowed this fallback if the link broke the logo at 1024px, and it does: measured in a real
viewport, the logo wordmark's `scrollWidth` is 150px against a `clientWidth` of 142px with the
link present, and removing it in the live DOM restores it. The broken band is 1024–1039px.

So the reachability criteria are, as shipped:
- **Below `lg`**: in the navigation drawer.
- **All widths**: in the footer.
- **Desktop header**: deliberately absent.

Note the failure mode has changed since the July UI audit recorded it: the header gained a
`truncate` class, so the logo now ellipsises rather than wrapping. Same regression class,
quieter symptom — which is why it needed measuring rather than eyeballing.

Phase 1b adds `/methodology` to the drawer for the same reason: it would have been a fourth
inline link.
