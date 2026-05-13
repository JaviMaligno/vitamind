# PWA Install Awareness — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface PWA installation in two places — a one-time auto-banner on the dashboard and a contextual gate when users enable push notifications — without interrupting the first experience or pestering returners. Spec: `docs/plans/2026-04-27-pwa-install-awareness-design.md`.

**Architecture:** A single `InstallProvider` context mounted in `AppShell` registers `beforeinstallprompt` and `appinstalled` listeners for the whole session. Pure utilities in `lib/install.ts` cover platform detection, standalone detection, and localStorage flags. Two consumers — `InstallBanner` on the dashboard and a modified `NotificationToggle` — open a single shared `InstallInstructionsModal` via the context. The new platform values are `'native' | 'ios-manual' | 'manual' | 'unsupported'`, plus an independent `isInAppBrowser` boolean for webview cases.

**Tech Stack:** React, Next.js App Router, next-intl, Tailwind CSS v4, Vitest (jsdom env), existing service worker / Web Push pipeline (untouched).

---

### Task 1: `lib/install.ts` — `isStandalone()` with TDD

**Files:**
- Create: `vitamind/lib/__tests__/install.test.ts`
- Create: `vitamind/lib/install.ts`

- [ ] **Step 1: Write the failing test**

Create `vitamind/lib/__tests__/install.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isStandalone } from "../install";

describe("isStandalone", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false in a non-standalone browser", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(isStandalone()).toBe(false);
  });

  it("returns true when display-mode is standalone", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(isStandalone()).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS)", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    Object.defineProperty(globalThis.navigator, "standalone", {
      value: true,
      configurable: true,
    });
    expect(isStandalone()).toBe(true);
    Object.defineProperty(globalThis.navigator, "standalone", {
      value: undefined,
      configurable: true,
    });
  });

  it("returns false when window is undefined (SSR)", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error simulating SSR
    delete globalThis.window;
    expect(isStandalone()).toBe(false);
    globalThis.window = origWindow;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: FAIL with "Cannot find module '../install'" or similar.

- [ ] **Step 3: Stub `lib/install.ts`**

Create `vitamind/lib/install.ts`:

```ts
export type InstallPlatform = "native" | "ios-manual" | "manual" | "unsupported";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari pre-PWA spec
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vitamind/lib/install.ts vitamind/lib/__tests__/install.test.ts
git commit -m "feat: add isStandalone() helper with display-mode + navigator.standalone checks"
```

---

### Task 2: `lib/install.ts` — `isInAppBrowser()` with TDD

**Files:**
- Modify: `vitamind/lib/__tests__/install.test.ts`
- Modify: `vitamind/lib/install.ts`

- [ ] **Step 1: Add failing tests**

Append to `vitamind/lib/__tests__/install.test.ts`:

```ts
import { isInAppBrowser } from "../install";

describe("isInAppBrowser", () => {
  function setUA(ua: string) {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  }

  it("returns true for Instagram webview", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.0.0");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns true for Facebook webview (FBAN)", () => {
    setUA("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0.0.0.0]");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns true for TikTok webview", () => {
    setUA("Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 musical_ly_29.0.0 trill_2023");
    expect(isInAppBrowser()).toBe(true);
  });

  it("returns false for plain iOS Safari", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(isInAppBrowser()).toBe(false);
  });

  it("returns false for desktop Chrome", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    expect(isInAppBrowser()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: 5 new tests FAIL with "isInAppBrowser is not exported".

- [ ] **Step 3: Implement `isInAppBrowser`**

Append to `vitamind/lib/install.ts`:

```ts
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /Instagram/i.test(ua) ||
    /FBAN|FBAV/i.test(ua) ||
    /musical_ly|TikTok/i.test(ua)
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vitamind/lib/install.ts vitamind/lib/__tests__/install.test.ts
git commit -m "feat: add isInAppBrowser() UA detection for IG/FB/TikTok webviews"
```

---

### Task 3: `lib/install.ts` — `detectPlatform()` with TDD

**Files:**
- Modify: `vitamind/lib/__tests__/install.test.ts`
- Modify: `vitamind/lib/install.ts`

- [ ] **Step 1: Add failing tests**

Append to `vitamind/lib/__tests__/install.test.ts`:

```ts
import { detectPlatform } from "../install";

describe("detectPlatform", () => {
  function setUA(ua: string) {
    Object.defineProperty(globalThis.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  }

  it("returns 'native' when deferredPrompt is provided", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0");
    expect(detectPlatform({} as Event)).toBe("native");
  });

  it("returns 'ios-manual' for iOS Safari without deferredPrompt", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(detectPlatform(null)).toBe("ios-manual");
  });

  it("returns 'manual' for Firefox desktop without deferredPrompt", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0");
    expect(detectPlatform(null)).toBe("manual");
  });

  it("returns 'manual' for Safari macOS without deferredPrompt", () => {
    setUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15");
    expect(detectPlatform(null)).toBe("manual");
  });

  it("returns 'unsupported' when iOS UA is inside an in-app browser", () => {
    setUA("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Instagram 320.0.0.0.0");
    expect(detectPlatform(null)).toBe("unsupported");
  });

  it("returns 'unsupported' for unknown UAs without deferredPrompt", () => {
    setUA("Mozilla/5.0 SomeRandomBrowser/1.0");
    expect(detectPlatform(null)).toBe("unsupported");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: 6 new tests FAIL with "detectPlatform is not exported".

- [ ] **Step 3: Implement `detectPlatform`**

Append to `vitamind/lib/install.ts`:

```ts
export function detectPlatform(deferredPrompt: Event | null): InstallPlatform {
  if (deferredPrompt) return "native";
  if (typeof navigator === "undefined") return "unsupported";

  const ua = navigator.userAgent || "";

  if (isInAppBrowser()) return "unsupported";

  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS/.test(ua);

  if (isIOS && isSafari) return "ios-manual";

  const isFirefox = /Firefox/.test(ua) && !/Seamonkey/.test(ua);
  const isMacSafari = /Macintosh/.test(ua) && isSafari;

  if (isFirefox || isMacSafari) return "manual";

  return "unsupported";
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: All 15 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vitamind/lib/install.ts vitamind/lib/__tests__/install.test.ts
git commit -m "feat: add detectPlatform() with native/ios-manual/manual/unsupported values"
```

---

### Task 4: `lib/install.ts` — localStorage flag accessors with TDD

**Files:**
- Modify: `vitamind/lib/__tests__/install.test.ts`
- Modify: `vitamind/lib/install.ts`

- [ ] **Step 1: Add failing tests**

Append to `vitamind/lib/__tests__/install.test.ts`:

```ts
import { getInstallBannerSeen, setInstallBannerSeen } from "../install";

describe("installBannerSeen flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns false when flag is not set", () => {
    expect(getInstallBannerSeen()).toBe(false);
  });

  it("returns true after setInstallBannerSeen()", () => {
    setInstallBannerSeen();
    expect(getInstallBannerSeen()).toBe(true);
  });

  it("survives JSON-incompatible legacy values without throwing", () => {
    localStorage.setItem("vitamind:installBannerSeen", "not-json");
    expect(() => getInstallBannerSeen()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Implement the accessors**

Append to `vitamind/lib/install.ts`:

```ts
const SEEN_KEY = "vitamind:installBannerSeen";

export function getInstallBannerSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setInstallBannerSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_KEY, "true");
  } catch { /* storage full — silently ignore */ }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd vitamind && npx vitest run lib/__tests__/install.test.ts
```

Expected: All 18 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vitamind/lib/install.ts vitamind/lib/__tests__/install.test.ts
git commit -m "feat: add installBannerSeen localStorage accessors"
```

---

### Task 5: i18n keys in all 6 locales

**Files:**
- Modify: `vitamind/messages/en.json`
- Modify: `vitamind/messages/es.json`
- Modify: `vitamind/messages/fr.json`
- Modify: `vitamind/messages/de.json`
- Modify: `vitamind/messages/ru.json`
- Modify: `vitamind/messages/lt.json`

**Context:** Each locale file is a JSON object with top-level namespaces (`app`, `hero`, `notifications`, etc.). Add a new `install` namespace at the end of each file (before the closing `}`).

- [ ] **Step 1: Add `install` namespace to `en.json`**

Open `vitamind/messages/en.json`. Add this block as a new top-level key (insert before the closing `}`):

```json
"install": {
  "banner": {
    "title": "Add to home screen for instant access",
    "cta": "Install"
  },
  "modal": {
    "title": "Add VitaminD to your Home Screen",
    "subtitle": "Two taps and you're done.",
    "step1": "Tap the Share button in Safari's bottom bar",
    "step2": "Scroll down and tap Add to Home Screen",
    "foot": "VitaminD will appear on your home screen, no app store needed.",
    "iosBlock": "Install VitaminD first to enable notifications.",
    "iosBlockSub": "iOS only delivers daily notifications when the app is on your home screen.",
    "fallback": "Use your browser's menu to add VitaminD to your home screen.",
    "inAppBrowser": "Open in Safari first",
    "copyUrl": "Copy link",
    "linkCopied": "Link copied",
    "close": "Close"
  },
  "installed": {
    "toast": "Installed! Open VitaminD from your home screen ☀️"
  },
  "tip": {
    "android": "Tip: install VitaminD for more reliable notifications"
  }
}
```

- [ ] **Step 2: Add `install` namespace to `es.json`**

```json
"install": {
  "banner": {
    "title": "Añade VitaminD a tu pantalla de inicio para acceso instantáneo",
    "cta": "Instalar"
  },
  "modal": {
    "title": "Añade VitaminD a tu pantalla de inicio",
    "subtitle": "Dos toques y listo.",
    "step1": "Pulsa el botón Compartir en la barra inferior de Safari",
    "step2": "Desplázate y pulsa Añadir a pantalla de inicio",
    "foot": "VitaminD aparecerá en tu pantalla de inicio, sin necesidad de App Store.",
    "iosBlock": "Instala VitaminD primero para activar notificaciones.",
    "iosBlockSub": "iOS solo envía notificaciones diarias cuando la app está en tu pantalla de inicio.",
    "fallback": "Usa el menú de tu navegador para añadir VitaminD a tu pantalla de inicio.",
    "inAppBrowser": "Abre primero en Safari",
    "copyUrl": "Copiar enlace",
    "linkCopied": "Enlace copiado",
    "close": "Cerrar"
  },
  "installed": {
    "toast": "¡Instalada! Abre VitaminD desde tu pantalla de inicio ☀️"
  },
  "tip": {
    "android": "Tip: instala VitaminD para notificaciones más fiables"
  }
}
```

- [ ] **Step 3: Add `install` namespace to `fr.json`**

```json
"install": {
  "banner": {
    "title": "Ajoutez à l'écran d'accueil pour un accès instantané",
    "cta": "Installer"
  },
  "modal": {
    "title": "Ajouter VitaminD à votre écran d'accueil",
    "subtitle": "Deux pressions et c'est fait.",
    "step1": "Appuyez sur le bouton Partager dans la barre inférieure de Safari",
    "step2": "Faites défiler et appuyez sur Sur l'écran d'accueil",
    "foot": "VitaminD apparaîtra sur votre écran d'accueil, sans App Store.",
    "iosBlock": "Installez d'abord VitaminD pour activer les notifications.",
    "iosBlockSub": "iOS n'envoie les notifications quotidiennes que lorsque l'app est sur votre écran d'accueil.",
    "fallback": "Utilisez le menu de votre navigateur pour ajouter VitaminD à votre écran d'accueil.",
    "inAppBrowser": "Ouvrir d'abord dans Safari",
    "copyUrl": "Copier le lien",
    "linkCopied": "Lien copié",
    "close": "Fermer"
  },
  "installed": {
    "toast": "Installée ! Ouvrez VitaminD depuis votre écran d'accueil ☀️"
  },
  "tip": {
    "android": "Astuce : installez VitaminD pour des notifications plus fiables"
  }
}
```

- [ ] **Step 4: Add `install` namespace to `de.json`**

```json
"install": {
  "banner": {
    "title": "Zum Startbildschirm hinzufügen für sofortigen Zugriff",
    "cta": "Installieren"
  },
  "modal": {
    "title": "VitaminD zu deinem Startbildschirm hinzufügen",
    "subtitle": "Zwei Tippen und fertig.",
    "step1": "Tippe auf den Teilen-Button in Safaris unterer Leiste",
    "step2": "Scrolle nach unten und tippe auf Zum Home-Bildschirm",
    "foot": "VitaminD erscheint auf deinem Startbildschirm – ohne App Store.",
    "iosBlock": "Installiere VitaminD zuerst, um Benachrichtigungen zu aktivieren.",
    "iosBlockSub": "iOS sendet tägliche Benachrichtigungen nur, wenn die App auf deinem Startbildschirm ist.",
    "fallback": "Verwende das Menü deines Browsers, um VitaminD zu deinem Startbildschirm hinzuzufügen.",
    "inAppBrowser": "Zuerst in Safari öffnen",
    "copyUrl": "Link kopieren",
    "linkCopied": "Link kopiert",
    "close": "Schließen"
  },
  "installed": {
    "toast": "Installiert! Öffne VitaminD von deinem Startbildschirm ☀️"
  },
  "tip": {
    "android": "Tipp: Installiere VitaminD für zuverlässigere Benachrichtigungen"
  }
}
```

- [ ] **Step 5: Add `install` namespace to `ru.json`**

```json
"install": {
  "banner": {
    "title": "Добавьте на главный экран для быстрого доступа",
    "cta": "Установить"
  },
  "modal": {
    "title": "Добавить VitaminD на главный экран",
    "subtitle": "Два касания — и всё.",
    "step1": "Нажмите кнопку «Поделиться» в нижней панели Safari",
    "step2": "Прокрутите вниз и нажмите «На экран Домой»",
    "foot": "VitaminD появится на главном экране, без App Store.",
    "iosBlock": "Сначала установите VitaminD, чтобы включить уведомления.",
    "iosBlockSub": "iOS отправляет ежедневные уведомления только когда приложение установлено на главный экран.",
    "fallback": "Используйте меню браузера, чтобы добавить VitaminD на главный экран.",
    "inAppBrowser": "Сначала откройте в Safari",
    "copyUrl": "Скопировать ссылку",
    "linkCopied": "Ссылка скопирована",
    "close": "Закрыть"
  },
  "installed": {
    "toast": "Установлено! Откройте VitaminD с главного экрана ☀️"
  },
  "tip": {
    "android": "Совет: установите VitaminD для надёжных уведомлений"
  }
}
```

- [ ] **Step 6: Add `install` namespace to `lt.json`**

```json
"install": {
  "banner": {
    "title": "Pridėkite prie pradžios ekrano greitam priėjimui",
    "cta": "Įdiegti"
  },
  "modal": {
    "title": "Pridėti VitaminD prie pradžios ekrano",
    "subtitle": "Du paspaudimai ir baigta.",
    "step1": "Bakstelėkite Bendrinti Safari apatinėje juostoje",
    "step2": "Slinkite žemyn ir bakstelėkite Pridėti prie pradžios ekrano",
    "foot": "VitaminD atsiras pradžios ekrane be App Store.",
    "iosBlock": "Pirmiausia įdiekite VitaminD, kad įjungtumėte pranešimus.",
    "iosBlockSub": "iOS siunčia kasdienius pranešimus tik kai programa yra pradžios ekrane.",
    "fallback": "Naudokite naršyklės meniu, kad pridėtumėte VitaminD prie pradžios ekrano.",
    "inAppBrowser": "Pirmiausia atidarykite Safari",
    "copyUrl": "Kopijuoti nuorodą",
    "linkCopied": "Nuoroda nukopijuota",
    "close": "Uždaryti"
  },
  "installed": {
    "toast": "Įdiegta! Atidarykite VitaminD iš pradžios ekrano ☀️"
  },
  "tip": {
    "android": "Patarimas: įdiekite VitaminD patikimesniems pranešimams"
  }
}
```

- [ ] **Step 7: Verify all 6 files parse as valid JSON**

```bash
cd vitamind && for f in messages/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK" || echo "$f FAILED"; done
```

Expected: 6 lines all "OK".

- [ ] **Step 8: Commit**

```bash
git add vitamind/messages/*.json
git commit -m "feat: add install namespace i18n keys for banner, modal, toast, tip (6 locales)"
```

---

### Task 6: `InstallInstructionsModal` component

**Files:**
- Create: `vitamind/components/InstallInstructionsModal.tsx`

**Context:** Modal opens imperatively with a `mode` parameter. Variant selection priority: `isInAppBrowser` → "Open in Safari first"; iOS Safari → polished iOS variant per mode; `manual` platform → generic fallback. Closes on Escape or backdrop click.

- [ ] **Step 1: Create the component**

Create `vitamind/components/InstallInstructionsModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { InstallPlatform } from "@/lib/install";

export type InstallModalMode = "banner" | "gating";

interface Props {
  open: boolean;
  mode: InstallModalMode;
  platform: InstallPlatform;
  isInAppBrowser: boolean;
  onClose: () => void;
}

export default function InstallInstructionsModal({ open, mode, platform, isInAppBrowser, onClose }: Props) {
  const t = useTranslations("install.modal");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const variant: "in-app" | "ios" | "fallback" =
    isInAppBrowser ? "in-app"
    : platform === "ios-manual" ? "ios"
    : "fallback";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — leave silent */ }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl bg-surface-elevated text-text-primary shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="relative px-6 pt-6 pb-3 text-center">
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-card hover:bg-surface-input flex items-center justify-center text-text-muted"
          >
            ✕
          </button>
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-white font-extrabold text-2xl font-[Playfair_Display,serif]">
            D
          </div>
          {variant === "in-app" && (
            <>
              <h3 className="text-lg font-bold mb-1">{t("inAppBrowser")}</h3>
              <p className="text-sm text-text-muted">{t("fallback")}</p>
            </>
          )}
          {variant === "ios" && (
            <>
              <h3 className="text-lg font-bold mb-1">
                {mode === "gating" ? t("iosBlock") : t("title")}
              </h3>
              <p className="text-sm text-text-muted">
                {mode === "gating" ? t("iosBlockSub") : t("subtitle")}
              </p>
            </>
          )}
          {variant === "fallback" && (
            <>
              <h3 className="text-lg font-bold mb-1">{t("title")}</h3>
              <p className="text-sm text-text-muted">{t("fallback")}</p>
            </>
          )}
        </div>

        {variant === "ios" && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-3 py-3 border-b border-border-subtle text-sm">
              <div className="w-6 h-6 rounded-full bg-text-primary text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">1</div>
              <div className="flex-1">{t("step1")}</div>
              <div className="px-2 py-1 rounded-md bg-surface-card border border-border-subtle text-blue-400 text-base">⬆︎</div>
            </div>
            <div className="flex items-center gap-3 py-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-text-primary text-amber-400 flex items-center justify-center font-bold text-xs flex-shrink-0">2</div>
              <div className="flex-1">{t("step2")}</div>
              <div className="px-2 py-1 rounded-md bg-surface-card border border-border-subtle text-base">⊞</div>
            </div>
          </div>
        )}

        {variant === "in-app" && (
          <div className="px-6 pb-4">
            <button
              onClick={handleCopyUrl}
              className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-text-primary font-semibold text-sm transition-colors"
            >
              {copied ? t("linkCopied") : t("copyUrl")}
            </button>
          </div>
        )}

        {variant === "ios" && (
          <div className="bg-surface-card px-6 py-3 text-center text-xs text-text-faint border-t border-border-subtle">
            {t("foot")}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to check for TypeScript errors**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors related to `InstallInstructionsModal`.

- [ ] **Step 3: Commit**

```bash
git add vitamind/components/InstallInstructionsModal.tsx
git commit -m "feat: add InstallInstructionsModal with iOS/in-app/fallback variants"
```

---

### Task 7: `InstallProvider` context

**Files:**
- Create: `vitamind/context/InstallProvider.tsx`

**Context:** Single source of truth. Registers `beforeinstallprompt` and `appinstalled` listeners on mount, holds `deferredPrompt`, exposes `openModal(mode)`, renders the modal as a child, fires the post-install toast.

- [ ] **Step 1: Create the provider**

Create `vitamind/context/InstallProvider.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  detectPlatform,
  isInAppBrowser as detectInAppBrowser,
  isStandalone as detectStandalone,
  setInstallBannerSeen,
  type InstallPlatform,
} from "@/lib/install";
import InstallInstructionsModal, { type InstallModalMode } from "@/components/InstallInstructionsModal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallContextValue {
  platform: InstallPlatform;
  isInstalled: boolean;
  isInAppBrowser: boolean;
  trigger: () => Promise<"accepted" | "dismissed" | "manual">;
  openModal: (mode: InstallModalMode) => void;
}

const InstallContext = createContext<InstallContextValue | null>(null);

export function useInstallContext(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error("useInstallContext must be used inside InstallProvider");
  return ctx;
}

export default function InstallProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("install");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [modalMode, setModalMode] = useState<InstallModalMode | null>(null);
  const installedToastShown = useRef(false);

  // Detect static state on mount
  useEffect(() => {
    setIsInstalled(detectStandalone());
    setInApp(detectInAppBrowser());
  }, []);

  // beforeinstallprompt listener
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // appinstalled listener
  useEffect(() => {
    const onInstalled = () => {
      setInstallBannerSeen();
      setDeferredPrompt(null);
      setIsInstalled(true);
      if (!installedToastShown.current) {
        installedToastShown.current = true;
        // Lightweight toast: fixed bottom, auto-dismiss after 4s
        const toast = document.createElement("div");
        toast.textContent = t("installed.toast");
        toast.className = "fixed left-1/2 -translate-x-1/2 bottom-24 z-[110] px-4 py-2.5 rounded-xl bg-amber-400 text-text-primary font-semibold text-sm shadow-2xl";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [t]);

  const platform = useMemo<InstallPlatform>(
    () => detectPlatform(deferredPrompt),
    [deferredPrompt],
  );

  const openModal = useCallback((mode: InstallModalMode) => {
    setInstallBannerSeen();
    setModalMode(mode);
  }, []);

  const closeModal = useCallback(() => setModalMode(null), []);

  const trigger = useCallback(async (): Promise<"accepted" | "dismissed" | "manual"> => {
    if (inApp) {
      openModal("banner");
      return "manual";
    }
    if (platform === "native" && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        return outcome;
      } catch {
        setDeferredPrompt(null);
        return "dismissed";
      }
    }
    if (platform === "ios-manual" || platform === "manual") {
      openModal("banner");
      return "manual";
    }
    return "manual";
  }, [inApp, platform, deferredPrompt, openModal]);

  const value: InstallContextValue = useMemo(
    () => ({ platform, isInstalled, isInAppBrowser: inApp, trigger, openModal }),
    [platform, isInstalled, inApp, trigger, openModal],
  );

  return (
    <InstallContext.Provider value={value}>
      {children}
      <InstallInstructionsModal
        open={modalMode !== null}
        mode={modalMode ?? "banner"}
        platform={platform}
        isInAppBrowser={inApp}
        onClose={closeModal}
      />
    </InstallContext.Provider>
  );
}
```

- [ ] **Step 2: Build to check for TypeScript errors**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors related to `InstallProvider`.

- [ ] **Step 3: Commit**

```bash
git add vitamind/context/InstallProvider.tsx
git commit -m "feat: add InstallProvider with beforeinstallprompt + appinstalled listeners"
```

---

### Task 8: `useInstallPrompt` hook

**Files:**
- Create: `vitamind/hooks/useInstallPrompt.ts`

**Context:** Thin re-export of the context value. Lives in `hooks/` for discoverability and to match the project's hook convention.

- [ ] **Step 1: Create the hook**

Create `vitamind/hooks/useInstallPrompt.ts`:

```ts
"use client";

import { useInstallContext } from "@/context/InstallProvider";

export function useInstallPrompt() {
  return useInstallContext();
}
```

- [ ] **Step 2: Build**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add vitamind/hooks/useInstallPrompt.ts
git commit -m "feat: add useInstallPrompt() hook (thin context re-export)"
```

---

### Task 9: `InstallBanner` component

**Files:**
- Create: `vitamind/components/InstallBanner.tsx`

**Context:** Bottom strip pinned above `BottomTabBar`. Decides on mount whether to render. Sets `installBannerSeen=true` *before* the 3-second show delay so we never auto-show twice.

- [ ] **Step 1: Create the component**

Create `vitamind/components/InstallBanner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { getInstallBannerSeen, isStandalone, setInstallBannerSeen } from "@/lib/install";
import { loadPreferences } from "@/lib/storage";

export default function InstallBanner() {
  const t = useTranslations("install.banner");
  const { platform, isInAppBrowser, isInstalled, trigger } = useInstallPrompt();
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isInstalled || isStandalone()) return;
    if (getInstallBannerSeen()) return;

    const prefs = loadPreferences();
    if (!prefs.lastCityId || !prefs.skinType) return;

    const eligible =
      isInAppBrowser ||
      platform === "native" ||
      platform === "ios-manual" ||
      platform === "manual";
    if (!eligible) return;

    setInstallBannerSeen();
    setShouldRender(true);

    const showTimer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(showTimer);
  }, [platform, isInAppBrowser, isInstalled]);

  if (!shouldRender) return null;

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => setShouldRender(false), 250);
  };

  const handleInstall = async () => {
    await trigger();
    dismiss();
  };

  return (
    <div
      className={`fixed left-2 right-2 z-40 transition-all duration-250 ${
        visible && !closing
          ? "bottom-[68px] opacity-100 translate-y-0"
          : "bottom-[40px] opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="mx-auto max-w-[960px] rounded-xl bg-text-primary text-bg-page-from shadow-2xl flex items-center gap-3 px-3 py-2.5">
        <span className="text-lg" aria-hidden>📲</span>
        <span className="flex-1 text-xs leading-tight">{t("title")}</span>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-md bg-amber-400 text-text-primary font-bold text-xs hover:bg-amber-300 transition-colors"
        >
          {t("cta")}
        </button>
        <button
          onClick={dismiss}
          aria-label="Close"
          className="text-text-muted hover:text-text-primary px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors related to `InstallBanner`.

- [ ] **Step 3: Commit**

```bash
git add vitamind/components/InstallBanner.tsx
git commit -m "feat: add InstallBanner bottom strip with 3s delay and dismiss"
```

---

### Task 10: Mount `InstallProvider` in `AppShell`

**Files:**
- Modify: `vitamind/components/AppShell.tsx`

**Context:** `AppShell` already wraps `ThemeProvider` and `AppProvider`. Add `InstallProvider` as the innermost wrapper so it has access to next-intl translations (already provided by parent).

- [ ] **Step 1: Add the import**

In `vitamind/components/AppShell.tsx`, add after the existing context imports (around line 4):

```tsx
import InstallProvider from "@/context/InstallProvider";
```

- [ ] **Step 2: Wrap children with `InstallProvider`**

Replace this block (around lines 36-48):

```tsx
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppProvider>
        <div className="min-h-screen bg-gradient-to-br from-bg-page-from via-bg-page-via via-60% to-bg-page-to text-text-primary font-[DM_Sans,sans-serif] pb-20">
          <TopBar />
          {children}
          <BottomTabBar />
        </div>
      </AppProvider>
    </ThemeProvider>
  );
}
```

With:

```tsx
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppProvider>
        <InstallProvider>
          <div className="min-h-screen bg-gradient-to-br from-bg-page-from via-bg-page-via via-60% to-bg-page-to text-text-primary font-[DM_Sans,sans-serif] pb-20">
            <TopBar />
            {children}
            <BottomTabBar />
          </div>
        </InstallProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: Build**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add vitamind/components/AppShell.tsx
git commit -m "feat: mount InstallProvider in AppShell so listeners run app-wide"
```

---

### Task 11: Mount `InstallBanner` in dashboard

**Files:**
- Modify: `vitamind/app/dashboard/page.tsx`

- [ ] **Step 1: Add the import**

Add to the existing imports near the top of `vitamind/app/dashboard/page.tsx`:

```tsx
import InstallBanner from "@/components/InstallBanner";
```

- [ ] **Step 2: Render the banner inside the dashboard layout**

Inside the existing return statement, add `<InstallBanner />` as a sibling of the other dashboard sections. Find this closing `</div>` (around line 128, the outermost dashboard wrapper):

```tsx
      <Link
        href="/learn"
        className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-card px-4 py-3 hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-[12px] font-medium text-text-secondary">{tc("learnMore")}</span>
        </div>
        <span className="text-text-faint text-[11px]">→</span>
      </Link>
    </div>
  );
}
```

Replace with:

```tsx
      <Link
        href="/learn"
        className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-card px-4 py-3 hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📖</span>
          <span className="text-[12px] font-medium text-text-secondary">{tc("learnMore")}</span>
        </div>
        <span className="text-text-faint text-[11px]">→</span>
      </Link>
      <InstallBanner />
    </div>
  );
}
```

The banner is positioned `fixed`, so its location in the DOM doesn't affect rendering — placing it inside the dashboard root keeps it scoped to this route.

- [ ] **Step 3: Build**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add vitamind/app/dashboard/page.tsx
git commit -m "feat: render InstallBanner on dashboard route"
```

---

### Task 12: Modify `NotificationToggle` for flow D gating

**Files:**
- Modify: `vitamind/components/NotificationToggle.tsx`

**Context:** Add gating before `Notification.requestPermission()` and a tip toast post-success on Android. Flow D fires only when permission is `default` and the user is not standalone.

- [ ] **Step 1: Add imports**

Replace the existing import block at the top of `vitamind/components/NotificationToggle.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
```

with:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { isStandalone, setInstallBannerSeen } from "@/lib/install";
```

- [ ] **Step 2: Use the hook inside the component**

Find the line `const t = useTranslations("notifications");` (around line 29). Add immediately after it:

```tsx
  const tInstall = useTranslations("install");
  const { platform, isInAppBrowser, openModal, trigger } = useInstallPrompt();
```

- [ ] **Step 3: Add a small helper for the Android tip toast**

Add this helper inside the component body, right after the line that introduces the hook:

```tsx
  const showAndroidTipToast = useCallback(() => {
    setInstallBannerSeen();
    const toast = document.createElement("div");
    toast.className = "fixed left-1/2 -translate-x-1/2 bottom-24 z-[110] px-4 py-3 rounded-xl bg-text-primary text-bg-page-from font-medium text-sm shadow-2xl flex items-center gap-3";
    const text = document.createElement("span");
    text.textContent = tInstall("tip.android");
    text.className = "flex-1";
    const cta = document.createElement("button");
    cta.textContent = tInstall("banner.cta");
    cta.className = "px-3 py-1 rounded-md bg-amber-400 text-text-primary font-bold text-xs";
    cta.onclick = async () => { toast.remove(); await trigger(); };
    toast.append(text, cta);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
  }, [tInstall, trigger]);
```

- [ ] **Step 4: Replace the `toggle` callback with the gated version**

Replace the entire `const toggle = useCallback(...)` block (current lines 64-108) with:

```tsx
  const toggle = useCallback(async () => {
    if (status === "on") {
      // Unsubscribe — unchanged path, no flow D
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
      return;
    }

    // Subscribe path — flow D gating
    const permission = Notification.permission;

    // Flow D fires only when permission is still 'default' AND user is not already standalone.
    if (permission === "default" && !isStandalone()) {
      if (isInAppBrowser) {
        openModal("gating");
        return;
      }
      if (platform === "ios-manual") {
        openModal("gating");
        return;
      }
      // 'native' | 'manual' | 'unsupported': continue to permission flow.
    }

    const granted = permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (granted !== "granted") {
      setStatus("denied");
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error("VAPID key not configured");
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        lat, lon, tz, timezone, skinType, areaFraction, cityName,
      }),
    });
    setStatus("on");

    // Post-success: Android tip toast (only when native install API is available and not standalone)
    if (platform === "native" && !isStandalone()) {
      showAndroidTipToast();
    }
  }, [status, lat, lon, tz, timezone, skinType, areaFraction, cityName, platform, isInAppBrowser, openModal, showAndroidTipToast]);
```

- [ ] **Step 5: Build and run all tests**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

```bash
cd vitamind && npx vitest run
```

Expected: all tests PASS (solar smoke + 18 install tests).

- [ ] **Step 6: Commit**

```bash
git add vitamind/components/NotificationToggle.tsx
git commit -m "feat: gate notifications toggle on iOS/in-app + add Android install tip toast"
```

---

### Task 13: Final build, lint, manual verification

**Files:** none modified.

- [ ] **Step 1: Full production build**

```bash
cd vitamind && npm run build
```

Expected: build succeeds with no errors and no warnings related to install components.

- [ ] **Step 2: Lint**

```bash
cd vitamind && npm run lint
```

Expected: no new errors. Pre-existing warnings are acceptable.

- [ ] **Step 3: Run all tests**

```bash
cd vitamind && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Local dev server + smoke check**

```bash
cd vitamind && npm run dev
```

Open http://localhost:3000 in a regular Chrome window with no prior install. Complete the city + skin setup, land on `/dashboard`, wait 3s — the install banner should slide up. Click ✕ to dismiss, reload the page, the banner should not reappear.

- [ ] **Step 5: Manual verification checklist**

Run through each scenario, marking off as it passes. Capture results in the PR description.

- [ ] **Chrome desktop, fresh** — banner appears 3s after dashboard mount, Install opens native dialog, accept → banner closes, post-install toast appears.
- [ ] **Chrome desktop, reload installed PWA** — banner does not appear.
- [ ] **Chrome desktop, dismiss banner without installing, reload** — banner does not reappear.
- [ ] **Chrome desktop, install via browser address-bar icon while on `/profile`** — `appinstalled` fires (post-install toast appears), future `/dashboard` visits skip the banner.
- [ ] **iPhone Safari, real device** — finish setup → banner appears → tap Install → modal with two iOS steps → manually add to home screen → reopen from home screen → banner does not appear.
- [ ] **iPhone Safari, banner dismissed, then toggle notifications** — gating modal opens with iOS-blocking copy. Toggle does not flip on.
- [ ] **iPhone Safari with `Notification.permission` already `granted`** — toggle behaves normally (subscribe/unsubscribe), modal does not open.
- [ ] **iPhone Safari with `Notification.permission` already `denied`** — existing denied UI shows, no install modal.
- [ ] **In-app browser** (open the URL from inside Instagram DM) — banner appears. Tap Install → modal shows "Open in Safari first" + Copy link CTA. Toggling notifications opens the same modal.
- [ ] **Firefox desktop** — banner appears (`platform === 'manual'`). Install button opens generic fallback modal. Notifications toggle works (Firefox handles permission), no tip toast.
- [ ] **Android Chrome, not installed** — toggle notifications → permission flow runs → on success, tip toast appears with Install CTA → tap CTA → native install dialog. The tip toast also marks `installBannerSeen=true` even if the CTA isn't tapped (verify via DevTools localStorage).

- [ ] **Step 6: Push and deploy**

```bash
gh auth status   # confirm JaviMaligno is the active account
git push origin master
cd vitamind && npx vercel --prod
```

- [ ] **Step 7: Smoke-test production**

Open https://vitamind-six.vercel.app in an incognito Chrome window. Complete setup, confirm banner appears on dashboard, install. Repeat on iPhone Safari.

---

## Out of scope for this plan

These items are explicitly deferred (per spec):

- Polished modal variants for Safari macOS / Firefox / Edge (use generic fallback for v1).
- Install-rate analytics events.
- Re-prompt cadence for dismissed banners (spec choice C: once and done).
- "Update iOS to receive notifications" toast for iOS < 16.4.
- Multi-step onboarding tutorial.
