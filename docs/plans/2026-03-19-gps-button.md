# GPS Button Accessible From All Pages — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a GPS icon button next to CitySearch on Dashboard, Profile, and Explore so the user can switch to GPS at any time, including after denial.

**Architecture:** New `GpsButton` component reads GPS state directly from `useApp()` context. Placed in Dashboard and Profile next to CitySearch. In Explore, the existing HeroZone already shows a "backToMyLocation" button when `hasLocation`; we upgrade that button to show proper error/denied states using existing props. GpsButton only renders when `hasLocation === true` (initial onboarding screen is untouched).

**Tech Stack:** React, next-intl, Tailwind CSS v4, existing `useApp()` context.

---

### Task 1: Create `GpsButton` component

**Files:**
- Create: `components/GpsButton.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/context/AppProvider";

export default function GpsButton() {
  const t = useTranslations("hero");
  const app = useApp();
  const { gps, cityId, hasLocation } = app;

  if (!hasLocation) return null;

  const isActive = cityId.startsWith("gps:");
  const isDenied = gps.error === "gpsDenied";

  const iconColor = gps.loading
    ? "text-text-muted"
    : isActive
      ? "text-emerald-400"
      : isDenied
        ? "text-red-400"
        : "text-amber-400";

  const bgColor = gps.loading
    ? "bg-surface-card"
    : isActive
      ? "bg-emerald-400/10 hover:bg-emerald-400/20"
      : isDenied
        ? "bg-red-400/10 hover:bg-red-400/20"
        : "bg-surface-card hover:bg-surface-elevated";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={gps.enableGps}
        disabled={gps.loading}
        title={t("useMyLocation")}
        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${bgColor}`}
      >
        {gps.loading ? (
          <svg
            className={`w-4 h-4 animate-spin ${iconColor}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 ${iconColor}`}
          >
            <path
              fillRule="evenodd"
              d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      {gps.error && (
        <p className="text-[10px] text-red-400/70 max-w-[180px] leading-tight">
          {t(gps.error)}
          {isDenied && (
            <span className="block text-text-faint mt-0.5">{t("gpsDeniedHint")}</span>
          )}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Verify the file was saved correctly**

Open `components/GpsButton.tsx` and confirm it compiles with:
```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error"
```
Expected: no TypeScript errors related to GpsButton.

**Step 3: Commit**

```bash
git add components/GpsButton.tsx
git commit -m "feat: add GpsButton component with idle/loading/active/denied states"
```

---

### Task 2: Add GpsButton to Dashboard

**Files:**
- Modify: `app/dashboard/page.tsx` (lines 11–41)

**Context:** Dashboard has a quick-actions row at the top with `CitySearch` and a "Edit profile" link. Add `GpsButton` between them.

**Step 1: Add import**

In `app/dashboard/page.tsx`, add after the existing imports:
```tsx
import GpsButton from "@/components/GpsButton";
```

**Step 2: Add GpsButton in the quick-actions flex row**

Find this block (around line 27–42):
```tsx
<div className="flex items-center gap-2">
  <div className="flex-1">
    <CitySearch
```

Replace with:
```tsx
<div className="flex items-center gap-2">
  <div className="flex-1">
    <CitySearch
      onSelect={app.selectCity}
      onAddFav={app.toggleFav}
      favorites={app.favorites}
      allCities={app.allCities}
    />
  </div>
  <GpsButton />
  <Link
    href="/profile"
    className="px-3 py-2 rounded-lg bg-surface-card text-text-muted text-xs hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
  >
    {t("editProfile")}
  </Link>
</div>
```

Note: `GpsButton` internally returns `null` when `!hasLocation`, so no conditional needed here.

**Step 3: Build to check for errors**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error"
```

**Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add GPS button to Dashboard quick-actions row"
```

---

### Task 3: Add GpsButton to Profile

**Files:**
- Modify: `app/profile/page.tsx` (lines 6–55)

**Context:** Profile has a "Search city" section with a `flex flex-wrap gap-3 items-center` row containing `CitySearch` and lat/lon inputs.

**Step 1: Add import**

In `app/profile/page.tsx`, add after the existing imports:
```tsx
import GpsButton from "@/components/GpsButton";
```

**Step 2: Add GpsButton in the city search flex row**

Find this block (around line 25–31):
```tsx
<div className="flex flex-wrap gap-3 items-center">
  <CitySearch
    onSelect={app.selectCity}
    onAddFav={app.toggleFav}
    favorites={app.favorites}
    allCities={app.allCities}
  />
```

Replace with:
```tsx
<div className="flex flex-wrap gap-3 items-center">
  <CitySearch
    onSelect={app.selectCity}
    onAddFav={app.toggleFav}
    favorites={app.favorites}
    allCities={app.allCities}
  />
  <GpsButton />
```

**Step 3: Build to check for errors**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error"
```

**Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: add GPS button to Profile search section"
```

---

### Task 4: Upgrade "backToMyLocation" button in HeroZone (Explore)

**Files:**
- Modify: `components/HeroZone.tsx` (lines 142–150)

**Context:** Explore uses `HeroZone`, which already shows a "backToMyLocation" button when `hasLocation` but only if GPS is not already active. We improve it to show loading state and denied error hint — using existing props that are already passed from `ExplorePage`.

**Step 1: Replace the "backToMyLocation" button**

Find this block in `HeroZone.tsx` (around lines 142–150):
```tsx
{/* Quick action: return to GPS location */}
{onRequestGps && !cityName.includes("Mi ubicación") && !cityName.includes("My location") && (
  <button
    onClick={onRequestGps}
    className="mb-4 px-3 py-1.5 rounded-lg bg-surface-card text-text-muted text-xs hover:bg-surface-elevated hover:text-text-secondary transition-colors cursor-pointer"
  >
    📍 {t("backToMyLocation")}
  </button>
)}
```

Replace with:
```tsx
{/* Quick action: GPS button */}
{onRequestGps && (
  <div className="mb-4 flex flex-col items-start gap-1">
    <button
      onClick={onRequestGps}
      disabled={gpsLoading}
      title={t("useMyLocation")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        gpsError === "gpsDenied"
          ? "bg-red-400/10 text-red-400/80 hover:bg-red-400/20"
          : gpsLoading
            ? "bg-surface-card text-text-muted"
            : "bg-surface-card text-text-muted hover:bg-surface-elevated hover:text-text-secondary"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-3.5 h-3.5"
      >
        <path
          fillRule="evenodd"
          d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.145c.187-.1.443-.247.745-.439a19.697 19.697 0 002.585-2.008c1.9-1.744 3.555-4.063 3.555-6.83A7.5 7.5 0 0010 2a7.5 7.5 0 00-7.5 7.5c0 2.767 1.655 5.086 3.555 6.83a19.697 19.697 0 002.585 2.008 13.77 13.77 0 00.745.439c.126.068.217.116.281.145l.018.008.006.003zM10 12.5a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
      {gpsLoading ? t("locating") : t("useMyLocation")}
    </button>
    {gpsError && (
      <p className="text-[10px] text-red-400/70 max-w-[240px] leading-tight">
        {t(gpsError)}
        {gpsError === "gpsDenied" && (
          <span className="block text-text-faint mt-0.5">{t("gpsDeniedHint")}</span>
        )}
      </p>
    )}
  </div>
)}
```

**Step 2: Build to check for errors**

```bash
cd vitamind && npm run build 2>&1 | grep -E "error|Error"
```

**Step 3: Commit**

```bash
git add components/HeroZone.tsx
git commit -m "feat: upgrade GPS button in HeroZone with error/denied/loading states"
```

---

### Task 5: Final build, deploy, manual verification

**Step 1: Full production build**

```bash
cd vitamind && npm run build
```
Expected: Build succeeds with no errors.

**Step 2: Push and deploy**

```bash
gh auth switch --user JaviMaligno
git push origin master
cd vitamind && npx vercel --prod
```

**Step 3: Manual verification checklist**

- [ ] Dashboard: GPS icon button visible next to CitySearch (with a city selected)
- [ ] Dashboard: clicking GPS button triggers location request
- [ ] Dashboard: if GPS denied, red icon + hint message appears
- [ ] Profile: GPS icon button visible in Search City section
- [ ] Explore: "Use my location" button shows loading state, error state, denied hint
- [ ] Initial screen (no city selected): GPS button still appears in original form (HeroZone `!hasLocation`) — unchanged
- [ ] After denying GPS in browser and clicking again: hint message appears explaining how to re-enable
