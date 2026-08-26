/**
 * What the BROWSER gets from messages/{locale}.json — and nothing more.
 *
 * `app/[locale]/layout.tsx` used to hand the whole parsed messages file to
 * <NextIntlClientProvider>. next-intl serialises that object into the RSC
 * payload of every single page, so all 34 namespaces travelled with every
 * response whether or not a client component could ever read them.
 *
 * The saving, measured on PRODUCTION-BUILD artifacts against the bytes the live
 * site was serving before this change:
 *
 *   route                      live prod    built now      delta        pct
 *   /amanecer/madrid/agosto      192,292      147,147     -45,145    -23.5%
 *   /en/sunrise/oslo/august      185,842      144,563     -41,279    -22.2%
 *   /amanecer/madrid             139,761       94,550     -45,211    -32.4%
 *   /vitamina-d/madrid           246,516      201,371     -45,145    -18.3%
 *                                                            mean    -24.1%
 *
 * The ABSOLUTE figures are the ones to reason with: the blob is a near-fixed
 * ~45 KB per response whatever the page, so the percentage only says how big the
 * rest of that particular page is. Attribution was checked rather than assumed —
 * the seven dropped namespaces serialise to 44,079 bytes in es and 40,280 in en,
 * which is the delta.
 *
 * (An earlier version of this table reported -37 to -41 KB from a DEV server.
 * Those numbers were a floor: dev HTML carries bytes production does not. They
 * are replaced here rather than kept alongside, because two tables invite
 * quoting the smaller one.)
 *
 * (An earlier estimate put this at 36% of a month page's HTML and 51% of its
 * .rsc. The measurement above does not reproduce that, so it is not repeated
 * here. If you need the .rsc number, measure it; do not inherit it.)
 *
 * Vercel bills ISR reads as crawled URLs × served bytes and the read meter sits
 * at ~95% of the Hobby allowance, so the seven namespaces that only ever render
 * on the server are pure waste on the one limit that is actually binding.
 *
 * Server components do NOT read from this provider. `useTranslations` /
 * `getTranslations` inside a Server Component resolve against the request-scoped
 * config in `i18n/request.ts`, which still loads the FULL file. So a namespace
 * omitted here keeps working server-side; it just stops being shipped.
 *
 * ── Why a hand-written list instead of deriving the set at build time ─────────
 * Deriving it would mean parsing the client module graph inside the server
 * bundle, which is neither cheap nor available at runtime. The rejected
 * alternative was to keep passing everything and instead shrink the message
 * files, which does not help: the namespaces are all genuinely used, just not
 * all in the browser. So the list is explicit and a test derives the real set
 * from the source and fails if this one does not cover it — see
 * `i18n/__tests__/client-messages.test.ts`. Adding a client component that
 * reaches for a new namespace makes that test fail with the namespace name in
 * the message; add it here and move on.
 *
 * ── Why getting this wrong is worse than it looks ─────────────────────────────
 * next-intl does NOT throw on a missing message. The default `onError` is a
 * `console.error` and the default `getMessageFallback` joins namespace and key,
 * so a miss RENDERS THE LITERAL KEY PATH — the string `sunrisePage.vitdCta` —
 * into HTML that Google indexes, with a 200 status. There is no custom
 * `onError` in this repo. That is why the guard test checks every key a client
 * component can ask for against the picked subset, in all six locales, rather
 * than trusting this list to be complete.
 */

/**
 * Top-level namespaces reachable from a "use client" module.
 *
 * Derived by walking the client module graph (see the guard test) — NOT by
 * eyeballing the components. Four of these are reachable only through a
 * ROOT-SCOPED `useTranslations()` with dotted keys, which is exactly the shape a
 * per-component read of the source misses:
 *   - `app`    → components/AppShell.tsx, components/SiteFooter.tsx
 *   - `footer` → components/SiteFooter.tsx, components/SiteNav.tsx
 *   - `explore`, `legend` → app/[locale]/explore/page.tsx
 *
 * The seven deliberately absent namespaces are server-render-only:
 * about, compass, connect, learn, methodology, notFoundPage, sunrisePage.
 * `notFoundPage` qualifies because `app/[locale]/not-found.tsx` has no
 * "use client" directive — it calls `useTranslations` as a Server Component.
 */
export const CLIENT_NAMESPACES = [
  "app",
  "auth",
  "cities",
  "cityPage",
  "common",
  "config",
  "dashboard",
  "errorPage",
  "estimate",
  "explore",
  "footer",
  "hero",
  "install",
  "legend",
  "nav",
  "notifications",
  "oauth",
  "offline",
  "partners",
  "search",
  "skin",
  "sunTimes",
  "sunToday",
  "tabs",
  "theme",
  "update",
  "viz",
] as const;

export type ClientNamespace = (typeof CLIENT_NAMESPACES)[number];

type MessageTree = Record<string, unknown>;

/**
 * The single definition of "what the client gets". The layout and every test
 * that mounts <NextIntlClientProvider> must go through this function, so a test
 * can never pass on a message the browser will not actually have.
 *
 * Missing namespaces are skipped rather than throwing: a locale file that has
 * not been given a namespace yet is a key-parity problem, and
 * `messages/__tests__/key-parity.test.ts` is what reports it. Throwing here
 * would turn it into a blank page in one locale instead.
 */
export function pickClientMessages<T extends MessageTree>(messages: T): MessageTree {
  const picked: MessageTree = {};
  for (const namespace of CLIENT_NAMESPACES) {
    if (namespace in messages) picked[namespace] = messages[namespace];
  }
  return picked;
}
