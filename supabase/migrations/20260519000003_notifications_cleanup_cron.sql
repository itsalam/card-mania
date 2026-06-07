select cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * *',  -- daily at 02:00 UTC
  $$
    delete from public.notifications
    where created_at < now() - interval '90 days'
      and priority != 'urgent';
  $$
);
