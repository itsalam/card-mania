select cron.schedule(
  'cleanup-anon-users',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/cleanup-anon-users',
    headers := jsonb_build_object(
      'content-type',  'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'edge_token'),
      'x-internal',   '1'
    )
  ) as request_id;
  $$
);
