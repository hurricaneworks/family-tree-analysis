-- 1. A per-person ceiling on the endpoints that cost money (Claude calls).
create table if not exists public.spend (
  who        text not null,
  hour       timestamptz not null,          -- the hour the calls fall in
  kind       text not null,                 -- ask | reply | world
  calls      integer not null default 0,
  primary key (who, hour, kind)
);
alter table public.spend enable row level security;
grant all on public.spend to service_role;
revoke all on public.spend from anon, authenticated;

-- Count one call and return the new total for this person, hour and kind, in a single statement.
create or replace function public.note_spend(p_who text, p_kind text)
returns integer
language sql
security definer
set search_path to pg_catalog, public
as $$
  insert into public.spend (who, hour, kind, calls)
  values (p_who, date_trunc('hour', now()), p_kind, 1)
  on conflict (who, hour, kind) do update set calls = public.spend.calls + 1
  returning calls;
$$;
revoke all on function public.note_spend(text, text) from public, anon, authenticated;
grant execute on function public.note_spend(text, text) to service_role;

-- 2. Stop new tables being exposed by default. Nothing existing relies on these grants: every table
--    in public is reached only through the secret key, and none has a grant to anon or authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 3. The RLS event-trigger helper does not need to be callable over the API.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
