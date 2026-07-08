-- Add target_iu column to profiles.
--
-- The app code (lib/profile.ts) writes `target_iu` on every profile upsert, but
-- the original create_profiles.sql only ever had `threshold`. Without this column
-- the upsert fails ("column profiles.target_iu does not exist") and — because the
-- error was being swallowed — every new user's profile silently failed to persist.
-- Detected 2026-07-08: only 1 profile row existed despite multiple sign-ups.
alter table profiles add column if not exists target_iu integer default 1000;
