# GPS Button Accessible from All Pages — Design

## Goal

Show a GPS button on Dashboard, Explore, and Profile pages so the user can switch to their real GPS location at any time, even after previously denying permission or using a database city.

## Constraints

- Only show when `hasLocation === true` (initial "Where are you?" screen is untouched)
- Retry-after-denial: button always clickable; shows `gpsDeniedHint` message on denial
- Consistent style with existing quick-action buttons

## Component: `components/GpsButton.tsx`

A small reusable icon button that reads GPS state from `useApp()` context.

### Visual states

| State | Appearance |
|-------|-----------|
| Idle | Amber pin icon, `title="Usar mi ubicación"` |
| Loading | Spinning icon, disabled |
| Active (`cityId.startsWith('gps:')`) | Green pin icon |
| Error / Denied | Red pin icon, still clickable |

### Behavior

- Click → `gps.enableGps()`
- When `gps.error` is set: show small error message below button (`gps.error === 'gpsDenied'` → show `gpsDeniedHint`)
- No new state needed — reuses existing `useGeoLocation` error/loading states from context

## Integration

### Dashboard (`app/dashboard/page.tsx`)

Add `<GpsButton />` in the existing quick-actions row (between CitySearch and "Edit profile" link):

```tsx
<div className="flex items-center gap-2">
  <div className="flex-1"><CitySearch .../></div>
  <GpsButton />
  <Link href="/profile">...</Link>
</div>
```

### Explore (`app/explore/page.tsx`)

Add `<GpsButton />` next to existing CitySearch.

### Profile (`app/profile/page.tsx`)

Add `<GpsButton />` in a small "current location" row at the top of the page (no CitySearch here).

## What does NOT change

- `HeroZone.tsx` — untouched
- `useGeoLocation.ts` — untouched
- `AppProvider.tsx` — untouched
- All existing GPS flow logic — untouched
