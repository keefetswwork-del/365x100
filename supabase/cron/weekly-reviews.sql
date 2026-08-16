-- Run after creating project_url and cron_secret in Supabase Vault.
select cron.unschedule(jobid)
from cron.job
where jobname = 'send-weekly-reviews';

select cron.schedule(
  'send-weekly-reviews',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-weekly-reviews',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
