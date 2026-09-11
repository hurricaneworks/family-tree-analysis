-- "To add to Ancestry" list: a note is ticked off once the reader has copied it into Ancestry by hand.
alter table public.media_notes add column if not exists applied_at timestamptz;
