-- Notes the family adds to pictures the export could not label ("Who is this?" page).
-- Written only by the server (service role); readers see them merged into the gallery captions.
create table if not exists public.media_notes (
  media_id   text primary key,
  note       text not null default '',
  people     text[] not null default '{}',   -- person ids (I...) attached by the family
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.media_notes enable row level security;
grant all on public.media_notes to service_role;
revoke all on public.media_notes from anon, authenticated;
