-- Add locale column so daily push notifications are sent in the user's chosen
-- language. The cron endpoint (/api/push/notify) runs server-side without a
-- request locale cookie, so the locale must be persisted per subscription.
-- Existing rows are backfilled with 'es' (the app's default locale).

alter table push_subscriptions
  add column if not exists locale text;

update push_subscriptions
  set locale = 'es'
  where locale is null;

alter table push_subscriptions
  alter column locale set default 'es';
