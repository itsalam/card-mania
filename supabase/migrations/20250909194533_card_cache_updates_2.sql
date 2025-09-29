-- Change the command (note dollar-quoting for multi-line SQL)
select cron.alter_job(
  (select jobid from cron.job where jobname = 'invoke-image-commit-from-query'),
  null,  -- keep schedule as-is
  $$select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name='project_url')
             || '/functions/v1/image-commit-from-query',
      headers := jsonb_build_object(
        'content-type','application/json',
        'authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='edge_token'),
        'apikey',        (select decrypted_secret from vault.decrypted_secrets where name='edge_token'),
        'x-internal',    '1'
      ),
      body := jsonb_build_object('sample', (select decrypted_secret from vault.decrypted_secrets where name='image_commit_sample'))::jsonb
    )$$
);