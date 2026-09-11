-- ON CONFLICT (source_ref) needs a plain unique index; the partial one stays but is not used for it.
create unique index if not exists tasks_source_ref_key on public.tasks (source_ref);
