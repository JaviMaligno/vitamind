-- Anon needs SELECT for upsert to work (conflict detection)
create policy "Anyone can read subscriptions"
  on push_subscriptions for select using (true);
