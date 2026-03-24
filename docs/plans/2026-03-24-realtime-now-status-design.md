# Real-Time "Now" Status for HeroZone

**Date:** 2026-03-24
**Goal:** Replace the day-level "synthesis possible" boolean with a real-time status that tells the user if NOW is a good moment, and if not, when the next window is.

---

## 1. New `NowStatus` Interface (`lib/types.ts`)

```ts
interface NowStatus {
  state: "good_now" | "upcoming" | "window_closed" | "no_synthesis";
  currentUVI: number;          // Linearly interpolated UVI for current minute
  effectiveUVI: number;        // After cloud cover penalty
  intensity: "optimal" | "moderate" | null; // >5 vs 3-5 vs irrelevant
  minutesNeeded: number | null; // Minutes for target IU right now
  window: { start: number; end: number } | null; // Today's synthesis window
  bestHour: number | null;
  bestMinutes: number | null;   // Minutes needed at best hour
  minutesUntilWindow: number | null; // Countdown to next window
  windowClosesIn: number | null;     // If inside window, minutes remaining
}
```

## 2. `getCurrentStatus()` Function (`lib/vitd.ts`)

### Inputs
- `weather: WeatherData | null` (hourly UVI + cloud_cover from Open-Meteo)
- `curve: SolarPoint[]` (fallback if no weather)
- `skinType, areaFraction, age, targetIU` (user profile)
- `now: Date` (current device time)

### UVI Interpolation
Open-Meteo provides UVI per whole hour. Linear interpolation between hour boundaries for current minute:
```
uviNow = uviHour + (uviNextHour - uviHour) * (minutes / 60)
```

### Cloud Cover Penalty on UVI
If `cloud_cover` is available from the API, apply penalty factor to effective UVI:

| Cloud Cover | Factor |
|---|---|
| 0–20% | 1.0 |
| 20–50% | 0.7 |
| 50–80% | 0.4 |
| 80–100% | 0.15 |

This can shift a theoretical UVI 4 down to effective 2.8, changing state from "good" to "upcoming".

### State Resolution
1. Compute `effectiveUVI` for current time
2. If `effectiveUVI >= 3` → `"good_now"` (intensity: >5 = "optimal", 3-5 = "moderate")
3. Else scan remaining hours for any with effective UVI >= 3:
   - Found → `"upcoming"` with `minutesUntilWindow`
   - Not found but window existed earlier → `"window_closed"`
   - Not found at all → `"no_synthesis"`

## 3. HeroZone States & Messages

### `good_now` + `optimal` (UVI > 5)
- Dot: green
- Label: "SYNTHESIS OPTIMAL"
- Message: enthusiastic — "Get out now! Excellent conditions"
- Details below: current UVI, minutes needed, window closes in X

### `good_now` + `moderate` (UVI 3–5)
- Dot: amber
- Label: "SYNTHESIS POSSIBLE"
- Message: positive — "Good time to get sun exposure"
- Details below: current UVI, minutes needed, window closes in X

### `upcoming`
- Dot: white/gray
- Label: "NOT YET"
- Message: "Better in Xh Ymin (at HH:00)"
- Details below: current UVI, expected window, best hour + minutes needed

### `window_closed`
- Dot: white/gray
- Label: "WINDOW CLOSED"
- Message: "Today's window ended at HH:00"
- Details below: tomorrow's expected window, supplement advice link

### `no_synthesis`
- Dot: red
- Label: "NO SYNTHESIS TODAY"
- Message: "Sun doesn't reach enough intensity today"
- Details below: peak elevation, supplement advice link

### Cloud nuance
If theoretical UVI >= 3 but clouds drop effective UVI < 3:
"Cloudy now — effective UVI 2.1. May improve at HH:00"

## 4. Timer & Re-fetch (`page.tsx`)

### New state
```ts
const [now, setNow] = useState<Date>(new Date());
```

### 60-second timer
`useEffect` with `setInterval(60_000)` updates `now`. This triggers `useMemo(getCurrentStatus)` recalculation — countdown updates, state may change.

### Hourly API re-fetch
Separate `useEffect` compares `now.getHours()` with last fetched hour. On hour change, re-calls `/api/weather` for updated UVI and cloud data.

### Date guard
If selected date !== today, disable the "now" timer and fall back to current day-level behavior (summary for that date).

## 5. Data Flow

```
now (every 60s) ──┐
                   ├──► useMemo(getCurrentStatus) ──► NowStatus ──► HeroZone
weather (every 1h) ┘
curve (solar.ts) ──┘
skinType, area, age, targetIU ─────────────────────────────────► (same inputs)
```

`VitDEstimate` (hourly breakdown) remains unchanged below. `DailyCurve` (D3 chart) unchanged.

## 6. HeroZone Props Change

Remove: `canSynthesize: boolean`, `peakElevation: number`
Add: `nowStatus: NowStatus`
Keep: city, date, GPS, favorites — all unchanged.

## 7. New Q&A: Direct Sun Exposure (`app/learn/page.tsx` + all `messages/*.json`)

Add as `block1.q6` in Learn page:

**Q:** "Do I need direct sunlight on my skin?"

**A:** Covers:
- Yes, direct sun on bare skin is required for vitamin D synthesis
- UVB does not penetrate clothing (even thin fabrics block most UVB)
- Shade: diffuse UVB under trees/awnings is minimal — insufficient for meaningful synthesis
- Sunscreen: SPF 30+ reduces synthesis ~95%. Practical advice: first 10-20 min without (depending on skin type), then apply
- Important nuance: for other benefits (nitric oxide, circadian rhythm, serotonin) direct sun is NOT required — being outdoors on a bright day already helps. But for vitamin D, bare skin exposure is necessary.

Add entry `{ qKey: "block1.q6.q", aKey: "block1.q6.a" }` to BLOCKS array in `learn/page.tsx`.

## 8. Files Affected

| Change | Files |
|---|---|
| `NowStatus` interface | `lib/types.ts` |
| `getCurrentStatus()` + cloud factor | `lib/vitd.ts` |
| 60s timer + hourly re-fetch + nowStatus | `app/page.tsx` |
| 5-state dynamic HeroZone | `components/HeroZone.tsx` |
| New Q&A entry in BLOCKS | `app/learn/page.tsx` |
| Q&A translations (6 languages) | `messages/{es,en,fr,de,lt,ru}.json` |

## 9. What Does NOT Change

- `VitDEstimate` component (hourly breakdown below hero)
- `DailyCurve` D3 visualization
- `/api/weather/route.ts` (already returns cloud_cover)
- Existing `computeExposure` / `computeExposureFromCurve` functions (kept, new function added alongside)
- PWA service worker, push notifications, Supabase sync
