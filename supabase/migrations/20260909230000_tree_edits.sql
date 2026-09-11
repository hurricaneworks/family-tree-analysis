-- Decisions the family makes about the tree inside the app: merge two records (app-side only until
-- done on Ancestry) or declare a flagged pair not to be duplicates. Append-only with an undo mark,
-- so the log is complete. Server (service role) only.
create table if not exists public.tree_edits (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('merge', 'not-duplicate')),
  keep_id     text not null,
  drop_id     text not null,
  note        text not null default '',
  created_by  text,
  created_at  timestamptz not null default now(),
  applied_at  timestamptz,   -- merges: when it was done on Ancestry
  undone_at   timestamptz,
  undone_by   text
);
create index if not exists tree_edits_active on public.tree_edits (kind) where undone_at is null;
alter table public.tree_edits enable row level security;
grant all on public.tree_edits to service_role;
revoke all on public.tree_edits from anon, authenticated;
