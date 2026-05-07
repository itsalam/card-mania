-- postgres_changes column-filter subscriptions require REPLICA IDENTITY FULL
-- so the Supabase realtime server can match non-PK filter columns from the WAL.
ALTER TABLE public.transaction_messages REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
