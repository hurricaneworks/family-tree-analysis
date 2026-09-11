-- Messages: comments anyone allowlisted leaves on any page, with replies from the app's
-- Claude, from an assistant routine, or from the owner. A thread is the root message plus replies.
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid,                            -- null on a root message; set to the root id on replies
  page         text not null,                   -- path the comment was made on, e.g. /person/I100000000001
  person_id    text,                            -- when the page is about a person
  media_id     text,                            -- when the page is about a picture
  role         text not null check (role in ('family', 'claude', 'routine', 'owner')),
  author       text,                            -- email of the writer (family/owner) or the agent name
  body         text not null,
  -- root-level fields
  kind         text check (kind in ('question', 'correction', 'idea', 'problem', 'other')),
  status       text not null default 'open' check (status in ('open', 'answered', 'needs-work', 'needs-reply', 'done')),
  correction   text,                            -- one-line summary when the message asks for a change on Ancestry
  correction_done_at timestamptz,
  created_at   timestamptz not null default now(),
  routine_seen_at timestamptz
);
create index if not exists messages_thread on public.messages (thread_id, created_at);
create index if not exists messages_status on public.messages (status) where thread_id is null;
alter table public.messages enable row level security;
grant all on public.messages to service_role;
revoke all on public.messages from anon, authenticated;
