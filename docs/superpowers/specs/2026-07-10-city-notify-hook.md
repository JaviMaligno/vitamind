# Spec: push-notification hook on the city pages

**Date:** 2026-07-10
**Branch:** `feat/city-notify` (off `master`)
**Goal:** Convert an anonymous SEO visitor on a city page into a returning push subscriber, using the notification system that already exists.

## Why

We shipped 438 city SEO landing pages. Their only call to action is "Calculate my
window", which opens `/dashboard` — an anonymous tool. Nothing on the page gives a
reason to come back. Meanwhile the product's strongest retention feature is fully
built and invisible on exactly these pages: a daily cron (`/api/push/notify`, 08:00)
that pushes **only on days synthesis is actually possible** for a subscriber's
location, with the window and minutes. It already uses the corrected ozone model.

So the highest-leverage code we can write is to surface that hook on the city pages,
with the city pre-filled: one tap turns a passive visitor into a subscriber who gets
a genuinely useful daily-ish alert. Acquisition engine (city pages) meets retention
hook (push) — both already built.

## What exists (reused as-is)

- `components/NotificationToggle.tsx` — a client component taking
  `{ lat, lon, tz, timezone, skinType, areaFraction, cityName }`. It owns the entire
  subscribe/unsubscribe flow, permission handling, and the PWA install-gating ("flow
  D") for iOS/in-app browsers. Currently used on `/profile`.
- `/api/push/subscribe` — stores the browser subscription with those fields. **No
  account required** — a subscription is a browser endpoint + location, not a user.
- `/api/push/notify` cron — sends only when `computeExposureFromCurve` returns a
  result and peak UV ≥ 3. Honest "we'll tell you when you can" semantics.
- Providers: `[locale]/layout.tsx` wraps children in `NextIntlClientProvider`, and
  `AppShell` wraps them in `InstallProvider`. City pages inherit both, so
  `NotificationToggle` (which uses `useTranslations` and `useInstallPrompt`) works
  there without change.

## Scope

**In:**
1. `NotificationToggle`: add two OPTIONAL props, `labelOff?: string` and
   `labelOn?: string`. When present, they replace the generic button text
   (`🔕 {notify}` / `🔔 {on}`) with city-framed copy passed from the server page.
   When absent, behaviour is byte-identical to today — `/profile` is untouched.
2. `messages/*.json` `cityPage` namespace (6 locales): add `notifyLead` (a short
   line naming the city) and `notifyOff` / `notifyOn` (the button labels). The city
   is interpolated with the SAME safe nominative-label pattern the verdict lines use
   (`{city}:`), so ru/lt declension and fr contraction are never triggered.
3. `app/[locale]/[cityPrefix]/[city]/page.tsx`: render `NotificationToggle`
   pre-filled with the city's `lat, lon, tz, timezone`, `skinType = 3`,
   `areaFraction = 0.25` (the same defaults `city-content` uses), and
   `cityName = localizedCityName(...)`. Resolve the city-framed labels server-side
   with `getTranslations` and pass them as `labelOff`/`labelOn`. Place it as the
   primary action near the verdict; keep "Calculate my window" as a secondary link.

**Out:**
- Any change to the subscribe API, the cron, or the notification payload.
- Account/registration. The push subscription is the conversion; forcing auth is
  more friction for no added value here.
- New iOS behaviour. The install-gating already in `NotificationToggle` handles it;
  we inherit it. The iOS "install first" limitation is Apple's and is out of scope.
- Newsletter, Instagram, giveaways — not code, not ours.

## Copy (safe pattern)

`{city}` is the nominative name. It only ever appears as a leading label followed by
`:` or a dash — never after a preposition — so no locale needs a declined or
contracted form (the same rule the shipped verdict lines follow).

English, illustrative:
- `notifyLead`: "{city}: get told the days you can make vitamin D."
- `notifyOff`: "🔔 Notify me"
- `notifyOn`: "🔔 You're subscribed"

The button label itself carries no `{city}` (it is short and universal); the lead
line carries the city. ru/lt/fr wording of the lead is checked by a native reviewer
before merge, reusing the colon-label construction already validated for this file.

## Verification

- `NotificationToggle`: a test that the optional labels override the button text when
  present, and that omitting them preserves the current `notifications`-namespace
  text. (Component test with the intl provider mocked, mirroring
  `LanguageSelector.test.tsx`.)
- `messages`: the six `cityPage` blocks keep an identical key set (the existing
  structural test) and every `notify*` string compiles under `intl-messageformat`
  with `{ city }` supplied.
- The city page renders the toggle with the right props (lat/lon/tz from the City;
  skin 3 / area 0.25) — asserted by reading the built HTML for the subscribe button
  and the city-framed lead, as the smoke script already does for other blocks.
- `npm run build` green; the page count stays 438.

## Honest limitations to record

- **iOS web push needs the PWA installed** (Apple). The gating modal handles it, but
  iOS conversion is "install → subscribe", a bigger ask than the one-tap Android/
  desktop flow. Not a bug; a platform cap.
- A subscription is per-browser, not per-person: the same user on two devices is two
  subscriptions. Fine for this goal (engagement), noted for any future dedupe.
