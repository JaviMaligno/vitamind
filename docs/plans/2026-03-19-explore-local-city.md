# Explore Local City Search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a CitySearch bar to the Explore page that uses a local city state, so users can explore any city without affecting their Dashboard city.

**Architecture:** `ExplorePage` gets local `exploreCity` state. All solar calculations use `exploreCity` values when set, falling back to global `app.lat/lon` otherwise. Global context is never modified. No DB or localStorage changes.

**Tech Stack:** React useState, existing `CitySearch` component, existing `City` type, existing `GpsButton` component.

---

### Task 1: Add local city state and derived coordinates in ExplorePage

**Files:**
- Modify: `app/explore/page.tsx`

**Context:** Currently `ExplorePage` reads `app.lat`, `app.lon`, `app.tz`, `app.cityName`, `app.cityFlag` directly from global context for all calculations. We add a local override layer.

**Step 1: Add exploreCity state and derived locals**

In `app/explore/page.tsx`, after the existing state declarations (around line 18, after `const { animating, toggleAnim } = useAnimation(setDoy);`), add:

```tsx
const [exploreCity, setExploreCity] = useState<City | null>(null);

// Local overrides — fall back to global when no local city selected
const lat = exploreCity?.lat ?? app.lat;
const lon = exploreCity?.lon ?? app.lon;
const tz = exploreCity?.tz ?? app.tz;
const cityName = exploreCity?.name ?? app.cityName;
const cityFlag = exploreCity?.flag ?? app.cityFlag;
```

**Step 2: Replace all uses of `app.lat`, `app.lon`, `app.tz`, `app.cityName`, `app.cityFlag` in the page with the local variables**

Search for every occurrence in the file and replace:
- `app.lat` → `lat`
- `app.lon` → `lon`
- `app.tz` → `tz`
- `app.cityName` → `cityName`
- `app.cityFlag` → `cityFlag`

Important: keep `app.selectCity`, `app.toggleFav`, `app.favorites`, `app.allCities`, `app.skinType`, `app.areaFraction`, `app.age`, `app.threshold`, `app.gps`, `app.hasLocation` unchanged — these still come from global context.

Also replace in `useWeather`, `getCurve`, etc. calls — anywhere the local variables should be used instead of global.

**Step 3: Build**

```bash
cd C:/Users/Usuario/GitHub/VitaminD/vitamind && npm run build 2>&1 | tail -20
```
Expected: clean build.

**Step 4: Commit**

```bash
git add app/explore/page.tsx
git commit -m "feat: add local city state to Explore page

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add CitySearch bar + reset button to Explore page

**Files:**
- Modify: `app/explore/page.tsx`

**Context:** We add a CitySearch row visible when `app.hasLocation` is true (initial onboarding screen already has its own search inside HeroZone). This row sits between HeroZone and VisualizationZone. It also shows a "× back to my city" button when `exploreCity` is set.

**Step 1: Add CitySearch import if not already present**

`CitySearch` is already used in HeroZone props but not directly in ExplorePage. Add import:
```tsx
import CitySearch from "@/components/CitySearch";
```

**Step 2: Add search row in the JSX**

In the return statement, between `</HeroZone>` (the closing tag after the HeroZone block) and `<VisualizationZone ...>`, add:

```tsx
{/* Explore city search — local only, does not affect Dashboard */}
{app.hasLocation && (
  <div className="mx-auto max-w-[960px] px-4 flex items-center gap-2">
    <div className="flex-1">
      <CitySearch
        onSelect={(city) => setExploreCity(city)}
        onAddFav={app.toggleFav}
        favorites={app.favorites}
        allCities={app.allCities}
      />
    </div>
    {exploreCity && (
      <button
        onClick={() => setExploreCity(null)}
        className="px-3 py-2 rounded-lg bg-surface-card text-text-muted text-xs hover:bg-surface-elevated hover:text-text-secondary transition-colors whitespace-nowrap"
      >
        × {app.cityName}
      </button>
    )}
    <GpsButton />
  </div>
)}
```

Note: `GpsButton` calls `app.gps.enableGps()` which updates the global city — that's acceptable for GPS. The user specifically said focus on manual search.

Also add `GpsButton` import if not already imported:
```tsx
import GpsButton from "@/components/GpsButton";
```

**Step 3: Also pass local cityName/cityFlag to HeroZone**

HeroZone already receives `cityName={app.cityName}` and `cityFlag={app.cityFlag}`. Update these props to use the local variables:
```tsx
cityName={cityName}
cityFlag={cityFlag}
```

And similarly `lat`, `lon`, `tz` props if HeroZone receives them (check the HeroZone props being passed and replace `app.lat` → `lat`, `app.lon` → `lon`, `app.tz` → `tz`).

**Step 4: Build**

```bash
cd C:/Users/Usuario/GitHub/VitaminD/vitamind && npm run build 2>&1 | tail -20
```
Expected: clean build.

**Step 5: Commit**

```bash
git add app/explore/page.tsx
git commit -m "feat: add city search bar to Explore with local-only city state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Final build, deploy, manual verification

**Step 1: Full production build**

```bash
cd C:/Users/Usuario/GitHub/VitaminD/vitamind && npm run build
```
Expected: all 11 routes build cleanly.

**Step 2: Push and deploy**

```bash
gh auth switch --user JaviMaligno
git push origin master
cd C:/Users/Usuario/GitHub/VitaminD/vitamind && npx vercel --prod
```

**Step 3: Manual verification checklist**

- [ ] Explore page shows CitySearch bar when a city is already selected
- [ ] Searching "Tokyo" in Explore changes the solar chart — Dashboard still shows original city
- [ ] "× [original city name]" reset button appears after selecting a local city
- [ ] Clicking reset → solar chart goes back to global city
- [ ] Initial onboarding screen (`!hasLocation`) still works unchanged
- [ ] GPS button still works (updates global city)
- [ ] Navigating away from Explore and back resets local city (state is ephemeral)
