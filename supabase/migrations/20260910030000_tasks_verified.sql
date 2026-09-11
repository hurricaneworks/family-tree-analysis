-- After each fresh export, done tasks are re-tested: verified if the export agrees, reopened with a note if not.
alter table public.tasks add column if not exists verified_at timestamptz;
alter table public.tasks add column if not exists verified_export text;   -- the export date it was checked against
alter table public.tasks add column if not exists reopened_note text;
