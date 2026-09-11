-- Questions asked on the Ask page and the answers given, kept so they can be read again.
create table if not exists public.asks (
  id          uuid primary key default gen_random_uuid(),
  author      text,
  question    text not null,
  answer      text not null default '',
  people      text[] not null default '{}',   -- person ids linked in the answer
  created_at  timestamptz not null default now()
);
create index if not exists asks_created on public.asks (created_at desc);
alter table public.asks enable row level security;
grant all on public.asks to service_role;
revoke all on public.asks from anon, authenticated;
