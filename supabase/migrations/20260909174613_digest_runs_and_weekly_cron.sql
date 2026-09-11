-- Weekly "this week in the family" digest: dedupe table + pg_cron trigger.

-- one row per week the digest was (or is being) sent; the route claims the row before sending
create table if not exists public.digest_runs (
  week_start date primary key,
  claimed_at timestamptz not null default now(),
  sent_at    timestamptz,
  recipients text[] not null default '{}',
  email_id   text
);
alter table public.digest_runs enable row level security;
-- no policies: only the server (service role via the secret key) touches this table
grant all on public.digest_runs to service_role;
revoke all on public.digest_runs from anon, authenticated;

-- scheduler + outbound http from the database
create extension if not exists pg_cron;
create extension if not exists pg_net;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Monday 07:00 UTC (08:00 BST in summer). The shared secret is read from Vault at run time
-- (cron.job.command is plaintext); if the secret is missing nothing is posted.
select cron.unschedule('weekly-family-digest') where exists (select 1 from cron.job where jobname = 'weekly-family-digest');
select cron.schedule(
  'weekly-family-digest',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://example.invalid/api/digest',  -- set to your own site before applying
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret.decrypted_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from vault.decrypted_secrets as secret
  where secret.name = 'digest_secret';
  $$
);
