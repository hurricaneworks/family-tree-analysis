-- "Their world": background for a person's page (the year, the day, a short passage), built once from
-- Wikipedia and Claude, keyed by the facts it was built from so it refreshes when the record changes.
create table if not exists public.world (
  person_id    text primary key,
  facts_key    text not null,
  data         jsonb not null,
  generated_at timestamptz not null default now()
);
alter table public.world enable row level security;
grant all on public.world to service_role;
revoke all on public.world from anon, authenticated;
