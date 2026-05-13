# PWA Install Awareness — Design

## Goal

Make users aware that VitaminD can be installed as a PWA, without interrupting their first experience or pestering returning visitors. Deliver an app-like experience (home-screen icon, more reliable push notifications) while preserving the current zero-friction web entry point.

## Why this exists

- VitaminD is fully installable today (manifest + service worker + apple-web-app meta tags), but nothing in the UI signals that capability.
- iOS Web Push (16.4+) **only** works when the PWA is installed — every iOS user who tries to enable notifications without installing currently fails silently.
- A bare web entry point is great for partner demos and casual discovery; an in-product nudge is the missing piece for users who would benefit from app-like access.

## Non-goals

- Multi-step onboarding tutorial. The trigger moment is the first useful render of the dashboard, not a "welcome to VitaminD" walkthrough.
- Re-prompting users who dismissed the banner (except the contextual notifications path — see flow D below).
- A/B testing infra, install-rate analytics dashboards, or rate-limiting beyond the persistence rules below.
- Visual changes to existing components (`BottomTabBar`, `HeroZone`, `NotificationToggle` UI). The notifications toggle gains gating logic but its appearance does not change.

## Behavior summary

Two surfaces, one shared modal:

1. **Generic install banner** — shown once, on the first useful dashboard render, dismissible. Appears only the first time `installBannerSeen` is false and all eligibility checks pass.
2. **Contextual notifications gate (flow D)** — when a user with `Notification.permission === 'default'` taps the notifications toggle and is not already installed: on iOS or in-app browsers, an install modal blocks the toggle; on Android with native install API, a tip toast appears post-subscribe. Flow D ignores `installBannerSeen` (the user explicitly asked for notifications), but is suppressed entirely if permission has already been granted or denied — installing wouldn't change anything in those states.

## Architecture

Five new files. No refactor of existing code beyond a small change to `NotificationToggle.tsx`.

- **`vitamind/lib/install.ts`** — pure utilities. Platform detection, standalone detection, localStorage flag accessors.
- **`vitamind/context/InstallProvider.tsx`** — single source of truth for install state. Registers `beforeinstallprompt` and `appinstalled` listeners *once* at app boot, holds the deferred prompt event, exposes the imperative "open modal" handle, and renders the modal as a child.
- **`vitamind/hooks/useInstallPrompt.ts`** — thin hook that reads from `InstallProvider`'s context. Pure consumer; does not register listeners.
- **`vitamind/components/InstallBanner.tsx`** — the bottom strip (variant A from the brainstorming mockups). Self-decides whether to render.
- **`vitamind/components/InstallInstructionsModal.tsx`** — single-screen, two-step instructions with iOS Safari content as the primary variant; generic fallback for everything else.

### Mount points

- `InstallProvider` wraps the app inside `AppShell` (alongside `ThemeProvider` and `AppProvider`). Listeners live for the entire session regardless of which page is mounted — so we don't miss `appinstalled` if the user installs via browser menu while on `/explore` or `/profile`.
- `InstallBanner` mounted only inside `app/dashboard/page.tsx`. The dashboard is the moment the app has just delivered its core value (minutes-to-1000-IU estimate). Mounting on `/explore` or `/profile` would dilute that signal.
- `InstallInstructionsModal` rendered by `InstallProvider`, controlled imperatively. Both `InstallBanner` and `NotificationToggle` open it via the shared context — no prop drilling, no portal gymnastics.

## Detailed components

### `lib/install.ts`

```ts
export type InstallPlatform = 'native' | 'ios-manual' | 'manual' | 'unsupported';

export function isStandalone(): boolean;
export function detectPlatform(deferredPrompt: Event | null): InstallPlatform;
export function isInAppBrowser(): boolean;  // Instagram, Facebook, TikTok webviews

const KEY = 'vitamind:installBannerSeen';
export function getInstallBannerSeen(): boolean;
export function setInstallBannerSeen(): void;
```

- `isStandalone`: checks `window.matchMedia('(display-mode: standalone)')` and the iOS-specific `navigator.standalone` flag.
- `detectPlatform` (priority order):
  - `'native'` when `deferredPrompt` is non-null (any browser that fired `beforeinstallprompt` — Chrome, Edge, Brave, Samsung Internet, Opera Android).
  - `'ios-manual'` when the UA matches iOS *and* the browser is Safari proper (not an in-app browser). Triggers the polished iOS modal variant.
  - `'manual'` when the UA matches Firefox (desktop/Android) or Safari on macOS — manual install possible via browser menu, no API available. Triggers the generic fallback modal.
  - `'unsupported'` otherwise — banner suppressed unless `isInAppBrowser()` is true.
- `isInAppBrowser`: UA-sniffs Instagram, FBAN/FBAV, TikTok webviews. Used independently of `platform` to switch to the "Open in Safari first" modal copy.

### `context/InstallProvider.tsx`

Holds all install state for the session. Registers listeners exactly once at mount:

- `beforeinstallprompt` → captures the event with `event.preventDefault()`, stores it in state. If the event fires before any consumer needs it, that's fine — we hold it until requested.
- `appinstalled` → sets `installBannerSeen=true`, clears the deferred prompt, fires a toast (`install.installed.toast`), and updates the `isInstalled` state so consumers re-render.

The provider also renders `InstallInstructionsModal` as a child and exposes an imperative handle to open it.

### `hooks/useInstallPrompt.ts`

Thin consumer hook. Reads from `InstallProvider`'s context — does not register listeners itself.

```ts
export function useInstallPrompt(): {
  platform: InstallPlatform;
  isInstalled: boolean;
  isInAppBrowser: boolean;
  trigger: () => Promise<'accepted' | 'dismissed' | 'manual'>;
  openModal: (mode: 'banner' | 'gating') => void;
};
```

- `trigger()`:
  - if `isInAppBrowser` is true: open the modal in `banner` mode (which renders the "Open in Safari first" variant) and return `'manual'`.
  - if `platform === 'native'` and the deferred event is still valid: call `event.prompt()`, await `userChoice`, return its outcome.
  - if `platform === 'ios-manual'` or `'manual'`: open the modal in `banner` mode (renders the iOS-generic or generic-fallback variant respectively) and return `'manual'`.
  - if `platform === 'unsupported'`: no-op (the banner shouldn't be visible in this case anyway).
- The deferred event is consumed once by Chrome — after `prompt()` resolves it cannot be reused. The provider nulls it out and updates `platform` accordingly.
- `openModal(mode)` is exposed separately for `NotificationToggle`, which needs to open the modal in `gating` mode without going through `trigger()`'s native-prompt path.

### `components/InstallBanner.tsx`

Decision logic on every dashboard mount, in this order:

1. `isStandalone()` → return `null`.
2. `getInstallBannerSeen()` → return `null`.
3. Prefs incomplete (`!lastCityId || !skinType` from `loadPreferences()`) → return `null`.
4. None of `platform === 'native'`, `'ios-manual'`, `'manual'`, or `isInAppBrowser` → return `null`. (We need *some* viable install path to surface.)

If we pass all four: schedule a 3-second timeout from mount, then slide up.

The instant the DOM mounts, call `setInstallBannerSeen()` so the banner only ever auto-appears once per device, regardless of whether the user clicks Install, dismisses it, or simply navigates away.

Tapping the Install CTA calls `useInstallPrompt().trigger()`, which in turn:
- Opens "Open in Safari first" modal when `isInAppBrowser` (in-app users get redirected out of the webview).
- Calls native `prompt()` when `platform === 'native'`.
- Opens the iOS-generic polished modal when `platform === 'ios-manual'`.
- Opens the generic fallback modal when `platform === 'manual'` (Firefox desktop, Safari macOS).

Visual: dark bottom strip pinned just above the fixed `BottomTabBar`. Uses existing tokens (amber CTA, `text-text-primary`, etc.). Mobile-first; same component on desktop.

### `components/InstallInstructionsModal.tsx`

Single screen, two numbered steps. Opened imperatively from `InstallProvider` with a `mode` parameter (`'banner' | 'gating'`).

The modal internally picks a visual variant from the matrix `(mode, platform, isInAppBrowser)`:

| Trigger (priority order) | Visual variant | Copy used |
|---|---|---|
| `isInAppBrowser` (any mode) | "Open in Safari first" | `install.modal.inAppBrowser` + `copyUrl` CTA |
| `mode='banner'`, `platform === 'ios-manual'` | iOS, generic (polished) | `install.modal.title` + `subtitle` + `step1` + `step2` + `foot` |
| `mode='gating'`, `platform === 'ios-manual'` | iOS, gating notifications | `install.modal.iosBlock` + `iosBlockSub` + `step1` + `step2` + `foot` |
| `platform === 'manual'` (Firefox / Safari macOS) | Generic fallback | `install.modal.fallback` plain text |

Polish scope for v1: only the iOS Safari variants get pixel-perfect treatment (the brainstorming mockup). The other two share a less-illustrated fallback layout. TODO note in the file for future variants.

### Modification to `NotificationToggle.tsx`

Before calling `Notification.requestPermission()`, evaluate flow D gating in this order. Flow D **only fires when `Notification.permission === 'default'`** — if the user has already granted or denied permission, every gating branch is skipped and the toggle proceeds unchanged.

1. **Permission already decided** (`Notification.permission !== 'default'`) → proceed to existing toggle behavior. No flow D, ever. (Disable→enable cycles after granting, or any interaction after a denial, fall here.)
2. **Already standalone** (`isStandalone()` true) → proceed to permission flow unchanged. Push works natively, no install needed.
3. **In-app browser** (`isInAppBrowser` true) → open modal in `gating` mode (renders the "Open in Safari first" variant). Toggle does not flip. Return.
4. **iOS Safari, not standalone** (`platform === 'ios-manual'`) → open modal in `gating` mode (iOS-blocking copy). Toggle does not flip. Return.
5. **Native install available, not standalone** (`platform === 'native'`) → proceed to permission flow. On a *successful* subscribe, show a small toast with `install.tip.android` copy and a CTA that calls `useInstallPrompt().trigger()`. Mark `installBannerSeen=true` whether the user taps the CTA or not — the install nudge has been delivered.
6. **Anything else** (`platform === 'manual' \|\| 'unsupported'`) → proceed to permission flow unchanged. No tip toast (we cannot trigger install programmatically; the user finding the toggle on Firefox/Safari macOS is fine — push works there in-browser).

This is the only change to existing components.

## Persistence

| Key | Type | Set when |
|---|---|---|
| `vitamind:installBannerSeen` | `'true'` string | Banner mounts (auto-show), `appinstalled` fires, flow D gating modal opens (iOS / in-app browser path), or flow D Android tip toast appears. |

The flag is set whenever the user has been pitched install in *any* surface — so a user who enables push on Android first won't see the auto-banner on a later dashboard visit.

Everything else lives in React state inside `InstallProvider` and is dropped on reload: the `deferredPrompt` event, the modal-open state, the `isInstalled` flag (recomputed on mount).

## Eligibility & decision matrix

**Auto-banner** (independent of any toggle interaction):

| Condition | Banner appears? |
|---|---|
| `isStandalone()` | No |
| `installBannerSeen === true` | No |
| Prefs incomplete (`!lastCityId \|\| !skinType`) | No |
| `platform === 'unsupported'` AND not in-app browser | No (no viable install path) |
| `isInAppBrowser` (any platform), prefs OK, not seen | Yes — Install CTA opens "Open in Safari first" modal |
| `platform === 'native'`, prefs OK, not seen | Yes — Install CTA opens native browser dialog |
| `platform === 'ios-manual'`, prefs OK, not seen | Yes — Install CTA opens polished iOS modal |
| `platform === 'manual'`, prefs OK, not seen | Yes — Install CTA opens generic fallback modal |

**Flow D gating** (when user taps notifications toggle). All branches require `Notification.permission === 'default'` — otherwise toggle behaves as today regardless of platform.

| State | Toggle behavior |
|---|---|
| `permission !== 'default'` | Existing toggle behavior. No flow D. |
| `isStandalone()` | Existing toggle behavior (push works natively). |
| `isInAppBrowser` | Modal opens, "Open in Safari first" variant. Toggle does not flip. |
| `platform === 'ios-manual'`, not standalone | Modal opens, gating variant. Toggle does not flip. |
| `platform === 'native'`, not standalone | Permission flow runs. On success: tip toast with Install CTA. Sets `installBannerSeen=true`. |
| `platform === 'manual' \|\| 'unsupported'`, not standalone | Existing toggle behavior. No tip toast (no programmatic install path). |

## Copy / i18n

All strings via `next-intl`. Add a new `install` namespace to `messages/{es,en,fr,de,ru,lt}.json`:

```
install.banner.title         "Add to home screen for instant access"
install.banner.cta           "Install"
install.modal.title          "Add VitaminD to your Home Screen"
install.modal.subtitle       "Two taps and you're done."
install.modal.step1          "Tap the Share button in Safari's bottom bar"
install.modal.step2          "Scroll down and tap Add to Home Screen"
install.modal.foot           "VitaminD will appear on your home screen, no app store needed."
install.modal.iosBlock       "Install VitaminD first to enable notifications."
install.modal.iosBlockSub    "iOS only delivers daily notifications when the app is on your home screen."
install.modal.fallback       "Use your browser's menu to add VitaminD to your home screen."
install.modal.inAppBrowser   "Open in Safari first"
install.modal.copyUrl        "Copy link"
install.installed.toast      "Installed! Open VitaminD from your home screen ☀️"
install.tip.android          "Tip: install VitaminD for more reliable notifications"
```

Canonical source: EN. Translations follow the conventions already in place for the other 5 locales.

## Edge cases

| Case | Behavior |
|---|---|
| `beforeinstallprompt` fires before prefs are set | Event captured and held by `InstallProvider`. When dashboard mounts later with prefs valid, banner is ready. |
| User installs from `/explore` or `/profile` via browser menu | `InstallProvider` is mounted at `AppShell`, so `appinstalled` is caught regardless of which page is active. Banner is suppressed forever. |
| User opens VitaminD inside Instagram / Facebook / TikTok webview | `isInAppBrowser()` true. Auto-banner appears anyway (so users discover the limitation); Install CTA opens "Open in Safari first" + copy-URL modal. Toggling notifications also opens that modal instead of trying permission. |
| Firefox desktop / Safari macOS | Banner appears (we know they can install manually). Install button opens generic fallback modal. |
| iOS < 16.4 | Install path works; push silently won't. Acceptable for v1; optional future toast "Update iOS to receive notifications" if measured to matter. |
| User dismisses banner, later toggles notifications on iOS | Modal reopens in `gating` mode (flow D fires when `permission === 'default'`, regardless of `installBannerSeen`). |
| User dismisses banner, later toggles notifications on Android | No modal. Permission flow proceeds. Tip toast appears post-success. |
| User on iOS with permission already `granted` (rare: was standalone, then removed from home screen) | Toggle disables/re-enables normally. No flow D — we already had permission. |
| User on any platform with permission `denied` toggling notifications | Existing toggle behavior shows the denied state hint. No install modal — installing wouldn't help. |
| Banner already closed when `appinstalled` fires | No-op. |
| User installs via banner on Chrome desktop, banner unmounts | `appinstalled` listener triggers; toast fires; future dashboard mounts skip banner via `installBannerSeen`. |

## Verification (manual)

This project has no test setup beyond a single vitest smoke for solar math. Verification is manual; capture results in PR description.

1. **Chrome desktop, fresh** — finish setup → wait 3s on dashboard → banner appears → click Install → native dialog → accept → banner unmounts, toast fires, `installBannerSeen` flag persisted.
2. **Chrome desktop, reload installed PWA** — banner does not appear.
3. **Chrome desktop, dismiss banner without installing, reload** — banner does not reappear.
4. **Chrome desktop, install via browser menu (not our button) while on `/profile`** — `appinstalled` fires, toast appears, future visits to `/dashboard` skip banner.
5. **iPhone Safari, real device** — finish setup → banner appears → tap Install → modal with two steps → manually add to home screen → reopen from home screen → banner does not appear.
6. **iPhone Safari, banner dismissed, then toggle notifications** — gating modal opens with iOS-blocking copy. Toggle does not flip.
7. **iPhone Safari, permission already granted somehow, then toggle notifications** — toggle behaves normally, modal does not open.
8. **iPhone Safari, permission denied, then toggle notifications** — existing denied UI shows, no install modal.
9. **In-app browser** (open the URL from inside Instagram DM) — banner appears as usual. Tap Install → modal shows "Open in Safari first" + copy-URL CTA. Toggling notifications also opens the same modal.
10. **Firefox desktop / Safari macOS** — banner appears (`platform === 'manual'`), Install button opens generic fallback modal. Notifications toggle works (browsers have their own permission UI), no tip toast (no programmatic install path).
11. **Android Chrome, not installed** — toggle notifications → permission flow runs → on success, tip toast appears with Install CTA → tap CTA → native install dialog → after install, `installBannerSeen=true`. Tip toast also marks seen even if CTA not tapped.

## What does NOT change

- `BottomTabBar` — untouched.
- `HeroZone`, `VisualizationZone`, `VitDEstimate` — untouched.
- `NotificationToggle.tsx` — visual unchanged; only the click handler gains the gating branch.
- `app/layout.tsx` — service worker registration script untouched.
- `manifest.json`, `sw.js` — untouched.
- LocalStorage keys other than the new `vitamind:installBannerSeen`.
