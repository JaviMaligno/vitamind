# History Supabase Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync the 90-day vitamin D history to Supabase for authenticated users so it persists across devices.

**Architecture:** Add a `history` JSONB column to the existing `profiles` table. Follow the same pattern as the rest of the profile: localStorage as offline cache, Supabase as source of truth when authenticated. No new tables, no new API routes.

**Tech Stack:** Supabase (PostgreSQL + JS client), Next.js App Router, TypeScript

---

### Task 1: Add `history` column to Supabase

**Files:**
- Modify: `docs/supabase-schema.sql` (documentation only)

**Step 1: Run this SQL in the Supabase dashboard SQL editor**

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '[]'::jsonb;
```

**Step 2: Verify in Supabase Table Editor**

Open the `profiles` table — should show a `history` column of type `jsonb` with default `[]`.

**Step 3: Update schema docs**

Add to the `profiles` table in `docs/supabase-schema.sql`:
```sql
history             jsonb NOT NULL DEFAULT '[]',   -- DayRecord[] max 90 items
```

**Step 4: Commit**

```bash
git add docs/supabase-schema.sql
git commit -m "docs: add history column to profiles schema"
```

---

### Task 2: Add `history` to `UserProfile` type

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add field to interface**

In `lib/types.ts`, add to `UserProfile`:
```typescript
export interface UserProfile {
  id: string;
  email: string;
  skinType: 1 | 2 | 3 | 4 | 5 | 6;
  areaFraction: number;
  age: number | null;
  threshold: number;
  favorites: string[];
  customLocations: City[];
  lastCityId: string | null;
  history: DayRecord[];          // ← add this
}
```

**Step 2: Build to catch type errors**

```bash
cd vitamind && npm run build
```
Expected: may fail if `loadProfile` / `saveProfile` don't handle `history` yet — that's fine, fix in next task.

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add history field to UserProfile type"
```

---

### Task 3: Update `lib/profile.ts` to sync history

**Files:**
- Modify: `lib/profile.ts`

**Step 1: Read the current file**

Read `lib/profile.ts` to understand the current load/save/update pattern.

**Step 2: Update `loadProfile`**

In the Supabase fetch, map the `history` column:
```typescript
history: (data.history as DayRecord[]) ?? [],
```

In the localStorage fallback, add:
```typescript
history: loadHistory(),
```

**Step 3: Update `saveProfile`**

Add `history` to the upsert object sent to Supabase:
```typescript
history: profile.history,
```

Also save to localStorage:
```typescript
saveHistory(profile.history);
```

**Step 4: Update `updateProfile`**

`updateProfile` does a partial update — no change needed unless `history` is explicitly passed. It already uses `Partial<UserProfile>` so it will work automatically. Just make sure the Supabase update maps snake_case if needed:
```typescript
// history maps directly (same name), no snake_case conversion needed
```

**Step 5: Build**

```bash
npm run build
```
Expected: clean build.

**Step 6: Commit**

```bash
git add lib/profile.ts
git commit -m "feat: sync history to Supabase in loadProfile/saveProfile"
```

---

### Task 4: Sync history writes from AppProvider

**Files:**
- Modify: `context/AppProvider.tsx` (or wherever `upsertDayRecord` / `toggleDayOverride` are called)

**Step 1: Read AppProvider to find where history is mutated**

Search for `upsertDayRecord` and `toggleDayOverride` calls.

**Step 2: After each history mutation, sync to Supabase if authenticated**

The pattern — after any call that mutates localStorage history:
```typescript
// After upsertDayRecord(...) or toggleDayOverride(...)
if (user) {
  const updatedHistory = loadHistory();
  updateProfile({ history: updatedHistory });
}
```

Where `user` is the current Supabase auth user and `updateProfile` comes from `lib/profile.ts`.

**Step 3: On auth login, load history from Supabase and merge into localStorage**

In the `onAuthStateChange` handler (or wherever profile is loaded after login):
```typescript
const profile = await loadProfile();
if (profile) {
  // Merge: Supabase history wins for dates that exist in both
  const localHistory = loadHistory();
  const supabaseHistory = profile.history;
  const merged = mergeHistory(localHistory, supabaseHistory);
  saveHistory(merged);
  setHistory(merged);
}
```

Add a simple merge helper in `lib/storage.ts`:
```typescript
export function mergeHistory(local: DayRecord[], remote: DayRecord[]): DayRecord[] {
  const map = new Map<string, DayRecord>();
  // local first, then remote overwrites (remote is source of truth)
  for (const r of local) map.set(r.date, r);
  for (const r of remote) map.set(r.date, r);
  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-90);
}
```

**Step 4: Build**

```bash
npm run build
```

**Step 5: Deploy and test manually**

```bash
npx vercel --prod
```

Test flow:
1. Login → check history loads from Supabase
2. Toggle a day override → check Supabase `profiles.history` updates (Supabase Table Editor)
3. Clear localStorage → reload → history should restore from Supabase

**Step 6: Commit**

```bash
git add context/AppProvider.tsx lib/storage.ts
git commit -m "feat: sync history writes to Supabase and merge on login"
```

---

## Done ✓

History now persists across devices for authenticated users. localStorage remains as offline cache. No new tables or API routes added.
