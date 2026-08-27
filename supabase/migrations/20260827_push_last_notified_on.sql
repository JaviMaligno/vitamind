-- The daily push moved from one cron at 08:00 UTC (which is 04:00 in New York
-- and 01:00 in Los Angeles) to one invocation per UTC hour that sends only to
-- the subscriptions whose LOCAL clock is in the morning window.
--
-- That makes a subscriber eligible on two or three runs of the same day, and
-- Vercel additionally documents that a scheduled run may be delivered more than
-- once. This column is the guard: /api/push/notify claims the subscriber's own
-- calendar day here, with a conditional update, BEFORE it pushes
-- (`claimNotification` in lib/push-store.ts), so exactly one of those runs wins.
--
-- It is a date, not a timestamp, and it holds the day as read in the
-- SUBSCRIBER's timezone — never the server's. At 23:30 UTC it is already
-- tomorrow in Madrid and still today in Los Angeles, so a UTC day would let one
-- subscriber be notified twice and another not at all.
--
-- NULL means "never notified", which is what every existing row gets: the first
-- run inside their local morning after this ships will notify them as usual. No
-- backfill is wanted — stamping today's date would silence everyone for a day.

alter table push_subscriptions
  add column if not exists last_notified_on date;

comment on column push_subscriptions.last_notified_on is
  'Subscriber-local calendar day (not UTC) on which the daily push was last claimed by /api/push/notify. NULL = never.';
