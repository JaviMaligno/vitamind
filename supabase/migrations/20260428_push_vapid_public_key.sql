-- Add vapid_public_key column to isolate subscriptions per Vercel project
-- (prod vitamind vs dev vitamind-dev share the same push_subscriptions table).
-- Backfill existing rows with the production VAPID public key, then enforce NOT NULL.

alter table push_subscriptions
  add column if not exists vapid_public_key text;

update push_subscriptions
  set vapid_public_key = 'BM1_8pEnI1L7p26CQOnQRip2RilTOtC9Z8sU1OrPXk-5qPpnZ6J9-7dLEK61H10dbGJkfm4PXCW4RwNtvUA-D6s'
  where vapid_public_key is null;

alter table push_subscriptions
  alter column vapid_public_key set not null;

create index if not exists push_subscriptions_vapid_public_key_idx
  on push_subscriptions (vapid_public_key);
