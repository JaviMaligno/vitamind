# Learn Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/learn` page with 4 themed Q&A blocks about vitamin D and the sun, accessible from Profile, Dashboard, HeroZone, and VitDEstimate, in all 6 app languages.

**Architecture:** Static Next.js page at `app/learn/page.tsx`. Content lives in the existing `messages/*.json` files under a new `"learn"` namespace. A reusable `LearnAccordion` component handles expand/collapse per block. English written first, then translated by parallel agents.

**Tech Stack:** Next.js 15 App Router, next-intl, Tailwind CSS v4 (semantic tokens: `bg-surface-card`, `bg-surface-elevated`, `text-text-primary`, `text-text-muted`, `text-text-faint`, `border-border-default`, `border-border-subtle`).

---

## Task 1: Add English `learn` namespace to messages/en.json

**Files:**
- Modify: `messages/en.json` — append `"learn"` object before the closing `}`

**Step 1: Open messages/en.json and append the following JSON block** (add before the final `}` closing the root object, after the `"dashboard"` block):

```json
,
  "learn": {
    "pageTitle": "Vitamin D & the Sun",
    "pageSubtitle": "Science-backed answers to common questions",
    "block1": {
      "title": "The Sun and Vitamin D",
      "subtitle": "Why solar angle, UV index, and glass all matter",
      "q1": {
        "q": "Why does only UVB produce vitamin D, not UVA?",
        "a": "Ultraviolet radiation splits into UVA (315–400 nm) and UVB (280–315 nm). Only UVB in the narrow band of 290–315 nm carries enough energy to isomerise 7-dehydrocholesterol in the skin into pre-vitamin D3. UVA rays are longer-wavelength and lower-energy — they penetrate deeper (causing tanning and skin aging) but cannot trigger the photochemical reaction that starts vitamin D synthesis. This is also why tanning beds that emit mostly UVA do not produce vitamin D."
      },
      "q2": {
        "q": "Why does solar angle matter? What happens in winter?",
        "a": "The angle of the sun above the horizon determines how much atmosphere UVB must travel through before reaching your skin. At low angles — early morning, late afternoon, or any time in winter above roughly 35° latitude — UVB is almost entirely absorbed by the ozone layer and never reaches the surface. The 'shadow rule' captures this well: if your shadow is longer than your height, UVB is too weak for vitamin D synthesis. In winter at northern latitudes, this condition persists all day for months. Below UVI 3, even prolonged exposure produces negligible amounts."
      },
      "q3": {
        "q": "Why doesn't it work through glass?",
        "a": "Standard window glass and car windshields block nearly all UVB while transmitting most UVA and visible light. This means you can get a tan sitting by a sunny window — UVA passes through — but you cannot synthesise vitamin D. Only special quartz glass, used in some medical UV devices, transmits UVB. The practical implication: that warm winter sun through your office window feels good but contributes nothing to your vitamin D levels."
      },
      "q4": {
        "q": "What does the UV index mean, and why does the app use 3 as the minimum?",
        "a": "The UV Index (UVI) is an international standard that measures the erythemally-weighted UV intensity at ground level. It runs from 0 (none) to 11+ (extreme). The app uses UVI ≥ 3 as the synthesis threshold because below that level UVB intensity is too low for meaningful vitamin D production, regardless of how long you stay outside. This threshold is consistent with the research of Holick and colleagues, and corresponds roughly to the sun being more than 30–35° above the horizon."
      },
      "q5": {
        "q": "Do clouds cancel UVB?",
        "a": "Not completely. Heavy overcast reduces UVB by 70–90%; thin or broken cloud cover by around 20–50%. Paradoxically, certain broken-cloud formations scatter UV and can briefly push ground-level UVB above clear-sky values. The app uses real UV data from Open-Meteo when available, so the minutes shown already account for current cloud conditions — no manual adjustment needed."
      }
    },
    "block2": {
      "title": "Sun vs Supplement",
      "subtitle": "How solar synthesis compares to oral vitamin D",
      "q1": {
        "q": "How much vitamin D can I produce in the sun compared to a pill?",
        "a": "A full-body exposure to 1 MED (Minimal Erythemal Dose — just before any reddening) produces around 10,000–25,000 IU of vitamin D. A standard supplement capsule contains 400–2,000 IU. A 15–20 minute midday session in summer with arms and legs exposed can easily exceed a week of typical supplementation. However, the sun has a built-in safety mechanism (photodegradation) that prevents overdose — a protection oral supplements lack."
      },
      "q2": {
        "q": "Can I overdose from the sun?",
        "a": "No. Solar synthesis is self-limiting. Once pre-vitamin D3 accumulates in the skin, continued UVB converts it into inert compounds — lumisterol and tachysterol — rather than allowing further build-up. This photodegradation ceiling means your body never produces toxic levels from sun exposure, no matter how long you stay outside. This is why the IOM Tolerable Upper Intake Level of 4,000 IU/day applies specifically to oral supplementation, not to sunlight."
      },
      "q3": {
        "q": "Is the sun better than supplementing?",
        "a": "Both have real advantages. Sun-produced D3 is bound to skin proteins and released slowly into the bloodstream, giving it a longer half-life than oral D3. Sun exposure also provides UVA-driven nitric oxide release, circadian light cues, and other benefits no pill can replicate. Oral D3, on the other hand, is controllable, dose-precise, and available year-round. The practical answer: use the sun when conditions allow, supplement when they don't — they complement each other."
      },
      "q4": {
        "q": "D3 or D2 in supplements?",
        "a": "D3 (cholecalciferol) is significantly more effective than D2 (ergocalciferol) at raising and maintaining 25-OH-D blood levels — research suggests D3 is roughly 2–3× more potent per IU. D3 is also the form your skin produces. D2, derived from plant and fungal sources, is used in vegan supplements but underperforms D3 at equivalent doses. Look for 'cholecalciferol' on the label; vegan D3 from lichen is also available."
      },
      "q5": {
        "q": "What blood levels of 25-OH-D are considered optimal?",
        "a": "Standard reference ranges for serum 25-hydroxyvitamin D: below 20 ng/mL (50 nmol/L) is deficient; 20–30 ng/mL is insufficient; 30–50 ng/mL is sufficient. The Endocrine Society considers 40–60 ng/mL optimal for non-skeletal benefits. Above 100 ng/mL (250 nmol/L) carries toxicity risk from supplementation. Most people in northern latitudes test below 20 ng/mL in winter without supplementation — a widespread but easily correctable deficiency."
      }
    },
    "block3": {
      "title": "Supplementing Well",
      "subtitle": "Cofactors, timing, food sources, and dose",
      "q1": {
        "q": "D3 or D2? How much to take?",
        "a": "Choose D3 (cholecalciferol) unless you're vegan, in which case lichen-derived vegan D3 is available. For most adults: 1,000–2,000 IU/day if you get regular sun; 2,000–4,000 IU/day if you have limited sun exposure. The Endocrine Society's upper intake limit is 4,000 IU/day for adults from supplements. Higher doses for correcting deficiency exist but should be guided by blood tests. Testing 25-OH-D before and after 3 months of supplementation is the best way to find your personal effective dose."
      },
      "q2": {
        "q": "Why is K2 recommended alongside D3?",
        "a": "Vitamin D3 increases calcium absorption from the gut. Vitamin K2 — particularly the MK-7 form — activates two key proteins: osteocalcin (directs calcium into bones) and matrix Gla protein (prevents calcium from depositing in arteries and soft tissues). Without adequate K2, the extra calcium mobilised by high-dose D3 may contribute to arterial calcification. Natural K2 sources include natto, aged hard cheeses, and egg yolks. If you supplement more than 1,000 IU/day of D3, 100–200 mcg of MK-7 is widely recommended."
      },
      "q3": {
        "q": "What role does magnesium play?",
        "a": "Magnesium is a cofactor for both enzymes that convert vitamin D to its active forms (25-OH-D and then 1,25-OH-D). Without sufficient magnesium, supplemental D3 may not convert properly, and supplementation can push magnesium levels lower, worsening any existing deficiency. An estimated 50% of Western populations are magnesium-insufficient. Good dietary sources: pumpkin seeds, dark chocolate, spinach, almonds, avocado. Magnesium glycinate or malate supplements are well tolerated if dietary intake is low."
      },
      "q4": {
        "q": "Why must vitamin D be taken with fat?",
        "a": "Vitamin D is fat-soluble. It requires dietary fat in the gut to form micelles — tiny fat-protein packages that carry the vitamin through the intestinal wall into the bloodstream. Studies show that taking D3 with a fat-containing meal increases absorption by 30–50% compared to taking it fasted. The practical rule: take it with your fattiest meal of the day. A tablespoon of olive oil, a handful of nuts, or a meal with salmon all provide sufficient fat. This applies equally to vitamins A, E, and K2."
      },
      "q5": {
        "q": "What foods naturally contain vitamin D?",
        "a": "Very few foods contain meaningful amounts: fatty fish (wild salmon 600–1,000 IU per 100 g; mackerel, sardines, herring), cod liver oil (~400 IU per teaspoon, also rich in vitamin A), egg yolks (~40 IU each, more if the hen had UV exposure), UV-exposed mushrooms (can provide 400+ IU per 100 g when dried gills-up in sunlight), and beef liver (small amounts). Fortified foods (milk, cereals, plant milks) add modest amounts depending on country. Diet alone realistically cannot reach the 1,000–4,000 IU range without supplementation."
      },
      "q6": {
        "q": "What is the best time of day to take vitamin D?",
        "a": "With your largest meal of the day — primarily for the fat absorption benefit. Morning or midday (with breakfast or lunch) is generally preferred over evening because vitamin D may mildly increase alertness and some evidence suggests evening supplementation could slightly interfere with melatonin production. That said, consistency matters far more than timing: take it at whatever point in your day you will reliably remember."
      }
    },
    "block4": {
      "title": "The Sun Beyond Vitamin D",
      "subtitle": "Nitric oxide, circadian rhythms, mood, and immunity",
      "q1": {
        "q": "What is nitric oxide and what does it have to do with the sun?",
        "a": "Nitric oxide (NO) is a signalling molecule that dilates blood vessels, lowers blood pressure, and improves circulation. The skin stores large quantities of nitrite and nitrosothiol compounds that release NO into the bloodstream within minutes of UVA exposure. This is entirely independent of vitamin D synthesis — it happens through glass, in partial shade, and even in winter when UVB is absent. Research by Richard Weller's group at the University of Edinburgh suggests that UVA-driven NO release may explain the well-documented association between sun exposure and reduced cardiovascular mortality, beyond what vitamin D alone can account for."
      },
      "q2": {
        "q": "How does sunlight affect circadian rhythms?",
        "a": "Light is the primary zeitgeber — 'time-giver' — for the human circadian clock. Morning sunlight rich in short-wavelength blue light (460–480 nm) signals the retinal ganglion cells, which in turn tell the suprachiasmatic nucleus (SCN) in the brain to suppress melatonin and trigger the cortisol awakening response. This anchors the 24-hour body clock. Insufficient morning light exposure delays sleep onset, disrupts hormone timing, and is associated with mood disorders and metabolic dysfunction. The ideal window is the first 30–60 minutes after waking, outdoors — even on overcast days, outdoor light is typically 10–50× brighter than indoor lighting."
      },
      "q3": {
        "q": "What is dawn light useful for if it doesn't produce vitamin D?",
        "a": "Dawn light has a completely different spectral profile from midday sun: it is rich in red and near-infrared wavelengths (600–1,000 nm), with little UVB and moderate blue light. This infrared light penetrates several centimetres into tissue and activates cytochrome c oxidase in mitochondria, improving ATP production and cellular energy. It also clears overnight melatonin more gently than high-intensity blue light, easing the transition to wakefulness. Red-light and near-infrared therapy devices (wavelengths 630–850 nm) replicate part of this spectrum for therapeutic use."
      },
      "q4": {
        "q": "Is there a relationship between sun and immunity beyond vitamin D?",
        "a": "Yes. UV exposure independently modulates immune function through mechanisms separate from vitamin D: it induces regulatory T cells and alters antigen-presenting cells in ways that suppress inflammatory responses. This is the basis for UV phototherapy used clinically in psoriasis, eczema, and vitiligo. Some researchers link this broader UV immunomodulation to the latitude gradient in autoimmune disease prevalence — multiple sclerosis, type 1 diabetes, and inflammatory bowel disease are all significantly more common at higher latitudes, a pattern only partially explained by vitamin D levels."
      },
      "q5": {
        "q": "Does sunlight affect mood? (serotonin and melatonin)",
        "a": "Strongly. Bright light stimulates serotonin synthesis via the raphe nuclei in the brainstem — this mechanism underpins light therapy as a first-line treatment for Seasonal Affective Disorder (SAD). Serotonin is also the precursor to melatonin: adequate daytime serotonin supports better melatonin production at night, improving sleep quality. Separately, high-lux outdoor light triggers dopamine release in the retina, which appears to slow myopia progression in children. Population studies consistently show associations between time outdoors, mood, and sleep quality that extend well beyond vitamin D status."
      }
    },
    "backToApp": "Back to the app",
    "learnMoreLink": "Learn more about vitamin D →",
    "supplementLink": "How to supplement well →"
  }
```

**Step 2: Verify JSON is valid**

```bash
cd vitamind
node -e "require('./messages/en.json'); console.log('valid')"
```
Expected: `valid`

**Step 3: Commit**

```bash
git add messages/en.json
git commit -m "feat: add learn namespace to en.json with full Q&A content"
```

---

## Task 2: Create LearnAccordion component

**Files:**
- Create: `components/LearnAccordion.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";

interface QA {
  q: string;
  a: string;
}

interface Props {
  items: QA[];
}

export default function LearnAccordion({ items }: Props) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="border border-border-subtle rounded-xl overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-surface-card hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <span className="text-[13px] font-medium text-text-primary leading-snug">{item.q}</span>
            <span className={`text-text-faint text-[11px] flex-shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
          {open === i && (
            <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-border-subtle">
              <p className="text-[12px] text-text-muted leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/LearnAccordion.tsx
git commit -m "feat: add LearnAccordion component"
```

---

## Task 3: Create /learn page

**Files:**
- Create: `app/learn/page.tsx`

**Step 1: Create the page**

```tsx
"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import LearnAccordion from "@/components/LearnAccordion";

interface Block {
  emoji: string;
  titleKey: string;
  subtitleKey: string;
  questions: { qKey: string; aKey: string }[];
}

const BLOCKS: Block[] = [
  {
    emoji: "☀️",
    titleKey: "block1.title",
    subtitleKey: "block1.subtitle",
    questions: [
      { qKey: "block1.q1.q", aKey: "block1.q1.a" },
      { qKey: "block1.q2.q", aKey: "block1.q2.a" },
      { qKey: "block1.q3.q", aKey: "block1.q3.a" },
      { qKey: "block1.q4.q", aKey: "block1.q4.a" },
      { qKey: "block1.q5.q", aKey: "block1.q5.a" },
    ],
  },
  {
    emoji: "💊",
    titleKey: "block2.title",
    subtitleKey: "block2.subtitle",
    questions: [
      { qKey: "block2.q1.q", aKey: "block2.q1.a" },
      { qKey: "block2.q2.q", aKey: "block2.q2.a" },
      { qKey: "block2.q3.q", aKey: "block2.q3.a" },
      { qKey: "block2.q4.q", aKey: "block2.q4.a" },
      { qKey: "block2.q5.q", aKey: "block2.q5.a" },
    ],
  },
  {
    emoji: "🧪",
    titleKey: "block3.title",
    subtitleKey: "block3.subtitle",
    questions: [
      { qKey: "block3.q1.q", aKey: "block3.q1.a" },
      { qKey: "block3.q2.q", aKey: "block3.q2.a" },
      { qKey: "block3.q3.q", aKey: "block3.q3.a" },
      { qKey: "block3.q4.q", aKey: "block3.q4.a" },
      { qKey: "block3.q5.q", aKey: "block3.q5.a" },
      { qKey: "block3.q6.q", aKey: "block3.q6.a" },
    ],
  },
  {
    emoji: "🌅",
    titleKey: "block4.title",
    subtitleKey: "block4.subtitle",
    questions: [
      { qKey: "block4.q1.q", aKey: "block4.q1.a" },
      { qKey: "block4.q2.q", aKey: "block4.q2.a" },
      { qKey: "block4.q3.q", aKey: "block4.q3.a" },
      { qKey: "block4.q4.q", aKey: "block4.q4.a" },
      { qKey: "block4.q5.q", aKey: "block4.q5.a" },
    ],
  },
];

export default function LearnPage() {
  const t = useTranslations("learn");

  return (
    <div className="mx-auto max-w-[960px] px-4 pb-12 space-y-8">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-text-primary">{t("pageTitle")}</h1>
        <p className="text-[12px] text-text-faint mt-1">{t("pageSubtitle")}</p>
      </div>

      {/* Blocks */}
      {BLOCKS.map((block, bi) => (
        <section key={bi} id={bi === 2 ? "supplement" : undefined}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{block.emoji}</span>
            <div>
              <h2 className="text-[13px] font-semibold text-text-primary">{t(block.titleKey)}</h2>
              <p className="text-[10px] text-text-faint">{t(block.subtitleKey)}</p>
            </div>
          </div>
          <LearnAccordion
            items={block.questions.map((q) => ({ q: t(q.qKey), a: t(q.aKey) }))}
          />
        </section>
      ))}

      {/* Footer link */}
      <div className="pt-4 border-t border-border-subtle">
        <Link href="/dashboard" className="text-[11px] text-text-muted hover:text-text-secondary transition-colors">
          ← {t("backToApp")}
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page builds**

```bash
cd vitamind
npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors, build succeeds.

**Step 3: Commit**

```bash
git add app/learn/page.tsx
git commit -m "feat: add /learn page with 4 Q&A blocks"
```

---

## Task 4: Add contextual entry points

**Files:**
- Modify: `app/profile/page.tsx` — add link at bottom
- Modify: `app/dashboard/page.tsx` — add contextual card when no synthesis
- Modify: `components/HeroZone.tsx` — convert adviceText to link
- Modify: `components/VitDEstimate.tsx` — convert supplementAdvice to link

### 4a: Profile page — link at bottom

Find the closing `</div>` of the main wrapper in `app/profile/page.tsx` and add a section before it:

```tsx
{/* Learn more */}
<section>
  <Link
    href="/learn"
    className="inline-flex items-center gap-1.5 text-[11px] text-text-faint hover:text-text-muted transition-colors"
  >
    <span>ℹ️</span>
    <span>{tc("learnMore")}</span>
  </Link>
</section>
```

Add `import Link from "next/link";` at the top.
Add translation key `"learnMore": "Learn more about vitamin D and the sun →"` to `messages/en.json` under `"common"`.

### 4b: Dashboard — no-synthesis card

In `app/dashboard/page.tsx`, the `DayRecommendation` component shows a "no window" state internally. Add a card below `DayRecommendation` that shows when `todayRecord` has no synthesis AND is not loading:

```tsx
{!loading && todayRecord && !todayRecord.sufficient && (
  <Link
    href="/learn#supplement"
    className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-card px-4 py-3 hover:bg-surface-elevated transition-colors"
  >
    <div>
      <p className="text-[12px] font-medium text-text-secondary">{t("noUvLearnTitle")}</p>
      <p className="text-[10px] text-text-faint mt-0.5">{t("noUvLearnHint")}</p>
    </div>
    <span className="text-text-faint text-[11px]">→</span>
  </Link>
)}
```

Add `import Link from "next/link";` at the top.
Add to `messages/en.json` under `"dashboard"`:
```json
"noUvLearnTitle": "No UV window today — how to supplement",
"noUvLearnHint": "D3, K2, magnesium, and food sources explained"
```

### 4c: HeroZone — inline link on adviceText

In `components/HeroZone.tsx`, find the `adviceText` rendering. Replace the static text span with a link:

```tsx
<Link href="/learn#supplement" className="underline decoration-dotted hover:text-text-secondary transition-colors">
  {t("adviceText")}
</Link>
```

Add `import Link from "next/link";` at the top.

### 4d: VitDEstimate — inline link on supplementAdvice

In `components/VitDEstimate.tsx`, find the `supplementAdvice` text. Replace:
```tsx
💊 {t("supplementAdvice")}
```
with:
```tsx
💊 <Link href="/learn#supplement" className="underline decoration-dotted hover:text-text-secondary transition-colors">{t("supplementAdvice")}</Link>
```

Add `import Link from "next/link";` at the top.

**Step: Verify build**

```bash
cd vitamind
npm run build 2>&1 | tail -20
```

**Step: Commit**

```bash
git add app/profile/page.tsx app/dashboard/page.tsx components/HeroZone.tsx components/VitDEstimate.tsx messages/en.json
git commit -m "feat: add learn page entry points from profile, dashboard, HeroZone, VitDEstimate"
```

---

## Task 5: Translate to 5 languages (PARALLEL — dispatch 5 agents simultaneously)

Each agent receives:
1. The complete English content from `messages/en.json` under `"learn"` (already written in Task 1)
2. The target language file to modify
3. Instructions to match the existing tone and style of that language file
4. The new keys added in Task 4 (`common.learnMore`, `dashboard.noUvLearnTitle`, `dashboard.noUvLearnHint`)

**Dispatch these 5 agents in parallel:**

- **Agent ES**: Translate `"learn"` namespace + Task 4 keys → `messages/es.json`. Match existing Spanish tone (informal "tú", scientific terms in Spanish).
- **Agent DE**: Translate → `messages/de.json`. Match existing German tone (formal "Sie" NOT used — check existing file; scientific precision).
- **Agent FR**: Translate → `messages/fr.json`. Match existing French tone (formal "vous" — check existing file).
- **Agent LT**: Translate → `messages/lt.json`. Match existing Lithuanian tone.
- **Agent RU**: Translate → `messages/ru.json`. Match existing Russian tone.

Each agent should:
1. Read their target messages file to match existing style
2. Add the translated `"learn"` block (same structure as English)
3. Add the 3 new Task 4 keys to `"common"` and `"dashboard"` sections
4. Validate JSON: `node -e "require('./messages/XX.json'); console.log('valid')"`
5. Commit: `git add messages/XX.json && git commit -m "feat: add learn namespace to XX.json"`

---

## Task 6: Final build verification

```bash
cd vitamind
npm run build 2>&1 | tail -30
```

Expected: clean build, no TypeScript errors, no missing translation warnings.

```bash
git log --oneline -10
```

Expected: 8+ commits from tasks 1–5.
