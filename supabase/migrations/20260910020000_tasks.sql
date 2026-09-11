-- My list: the one ordered to-do list of things to do on Ancestry.
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  detail       text not null default '',
  kind         text not null check (kind in ('gap', 'paper', 'merge', 'correction', 'note', 'own', 'message')),
  person_id    text,
  media_id     text,
  source_ref   text,                     -- e.g. gap:line-stops:I123, merge:<edit id>, note:<media id>; stops duplicates
  ancestry_url text,
  rank         double precision not null default 50000,   -- lower = more important; moved by hand
  created_by   text,
  created_at   timestamptz not null default now(),
  done_at      timestamptz,
  done_by      text
);
create unique index if not exists tasks_source on public.tasks (source_ref) where source_ref is not null;
create index if not exists tasks_open on public.tasks (rank) where done_at is null;
alter table public.tasks enable row level security;
grant all on public.tasks to service_role;
revoke all on public.tasks from anon, authenticated;
