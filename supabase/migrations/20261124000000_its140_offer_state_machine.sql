-- ITS-140: offer state machine — counteroffers (ITS-142), expiry (ITS-143), binding rules
-- (ITS-141). Builds on the transition RPCs from 20261123000000 (ITS-121/122).
--
-- Spec: docs/offers/state-machine.md.
--
--                    counter_offer (seller)
--        ┌─────────┐ ───────────────────────▶ ┌────────────┐
--  ────▶ │ pending │                          │ countered  │
--        └─────────┘ ◀─────────────────────── └────────────┘
--          │  │  │     counter_offer (buyer)     │  │  │
--          │  │  └── accept_offer (seller) ──┐   │  │  └── accept_offer (buyer)
--          │  │                              ▼   ▼  │
--          │  │                           ┌──────────┐  confirm_transaction_receipt
--          │  │                           │ accepted │ ─────────────────────────▶ completed
--          │  │                           └──────────┘
--          │  └─ decline_offer (seller) / cancel_offer (buyer) ─▶ declined / cancelled
--          └──── expire_offers (pg_cron, expires_at passed) ─────▶ expired
--
-- `pending` waits on the seller, `countered` waits on the buyer. Whoever's turn it is can
-- accept or counter; either party can walk away (seller declines, buyer cancels) until the
-- offer is accepted. Accepting is binding: it creates the transaction and moves stock, and
-- there is no cancel from `accepted`.
--
-- Counters change only the total and add a note; the items stay fixed (bundles are one
-- offer, priced as a whole). Each proposal is a row in offer_revisions. Every proposal
-- (the original offer and each counter) gives the other party a fresh 72-hour window.

-- ── statuses ─────────────────────────────────────────────────────────────────

do $$
declare
  v_con text;
begin
  for v_con in
    select conname from pg_constraint
     where conrelid = 'public.offers'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.offers drop constraint %I', v_con);
  end loop;
end;
$$;

alter table public.offers
  add constraint offers_status_check
  check (status in ('pending', 'countered', 'accepted', 'declined', 'cancelled', 'expired', 'completed'));

-- ── expiry ───────────────────────────────────────────────────────────────────

-- How long the other party has to respond to a proposal. The one place to change it.
create or replace function public.offer_response_window()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '72 hours' $$;

alter table public.offers add column if not exists expires_at timestamptz;

-- Open offers get a full window from now rather than expiring the moment this ships.
update public.offers
   set expires_at = case
         when status = 'pending' then greatest(created_at, now()) + public.offer_response_window()
         else coalesce(created_at, now()) + public.offer_response_window()
       end
 where expires_at is null;

alter table public.offers
  alter column expires_at set default (now() + public.offer_response_window()),
  alter column expires_at set not null;

create index if not exists offers_open_expires_idx
  on public.offers (expires_at)
  where status in ('pending', 'countered');

-- ── revision history ─────────────────────────────────────────────────────────

create table if not exists public.offer_revisions (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers (id) on delete cascade,
  author_id    uuid not null references auth.users (id),
  author_role  text not null check (author_role in ('buyer', 'seller')),
  total_amount numeric(10,2) not null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists offer_revisions_offer_idx on public.offer_revisions (offer_id, created_at);

alter table public.offer_revisions enable row level security;

drop policy if exists "offer_revisions_select" on public.offer_revisions;
create policy "offer_revisions_select" on public.offer_revisions
  for select using (
    exists (select 1 from public.offers o
             where o.id = offer_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))
  );

revoke insert, update, delete, truncate on public.offer_revisions from anon, authenticated;
grant select on public.offer_revisions to authenticated;

-- The original offer is revision 1. A trigger rather than a change to create_offer, so the
-- revision is written however the offer row is created.
create or replace function public.trg_offers_initial_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.offer_revisions (offer_id, author_id, author_role, total_amount, note, created_at)
  values (new.id, new.buyer_id, 'buyer', new.total_amount, new.buyer_note, coalesce(new.created_at, now()));
  return new;
end;
$$;

drop trigger if exists offers_initial_revision on public.offers;
create trigger offers_initial_revision
  after insert on public.offers
  for each row execute function public.trg_offers_initial_revision();

insert into public.offer_revisions (offer_id, author_id, author_role, total_amount, note, created_at)
select o.id, o.buyer_id, 'buyer', o.total_amount, o.buyer_note, coalesce(o.created_at, now())
  from public.offers o
 where not exists (select 1 from public.offer_revisions r where r.offer_id = o.id);

-- ── helpers ──────────────────────────────────────────────────────────────────

-- Whose move it is: the seller responds to `pending`, the buyer to `countered`.
create or replace function public._offer_responder(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status when 'pending' then 'seller' when 'countered' then 'buyer' end
$$;

-- Raises unless the caller is the party whose turn it is and the offer hasn't lapsed.
-- The expirer runs every few minutes; this closes the gap in between.
create or replace function public._assert_offer_turn(p_offer public.offers, p_action text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_responder text := public._offer_responder(p_offer.status);
  v_role text := case when auth.uid() = p_offer.seller_id then 'seller' else 'buyer' end;
begin
  if v_role <> v_responder then
    raise exception 'Only the % can % this %', v_responder, p_action,
      case when p_offer.status = 'countered' then 'counteroffer' else 'offer' end
      using errcode = '42501';
  end if;
  if p_offer.expires_at <= now() then
    raise exception 'This offer has expired' using errcode = '22023';
  end if;
  return v_role;
end;
$$;

revoke all on function public._offer_responder(text) from public, anon, authenticated;
revoke all on function public._assert_offer_turn(public.offers, text) from public, anon, authenticated;

-- ── counter ──────────────────────────────────────────────────────────────────

create or replace function public.counter_offer(
  p_offer_id uuid,
  p_total_amount numeric,
  p_note text default null
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_role text;
begin
  v_offer := public._lock_offer_for_transition(p_offer_id, 'either', array['pending', 'countered'], 'counter');
  v_role := public._assert_offer_turn(v_offer, 'counter');

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'A counteroffer needs a price above zero' using errcode = '22023';
  end if;
  if round(p_total_amount, 2) = v_offer.total_amount then
    raise exception 'A counteroffer must change the price; accept the offer instead' using errcode = '22023';
  end if;

  update public.offers
     set status = case v_role when 'seller' then 'countered' else 'pending' end,
         total_amount = p_total_amount,
         expires_at = now() + public.offer_response_window()
   where id = p_offer_id
  returning * into v_offer;

  insert into public.offer_revisions (offer_id, author_id, author_role, total_amount, note)
  values (p_offer_id, auth.uid(), v_role, v_offer.total_amount, nullif(btrim(p_note), ''));

  return v_offer;
end;
$$;

-- ── accept / decline / cancel (replacing 20261123000000) ────────────────────

create or replace function public.accept_offer(p_offer_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_tx public.transactions;
  v_item_ids uuid[];
  v_competitors uuid[];
  v_short record;
begin
  v_offer := public._lock_offer_for_transition(p_offer_id, 'either', array['pending', 'countered'], 'accept');
  perform public._assert_offer_turn(v_offer, 'accept');

  select array_agg(distinct collection_item_id order by collection_item_id)
    into v_item_ids
    from public.offer_items
   where offer_id = p_offer_id;

  -- Lock the listings in a stable order so two accepts on overlapping items serialize
  -- instead of deadlocking.
  perform 1 from public.collection_items
   where id = any (v_item_ids)
   order by id
   for update;

  select r.requested, ci.quantity as available
    into v_short
    from (select collection_item_id, sum(quantity) as requested
            from public.offer_items where offer_id = p_offer_id
           group by collection_item_id) r
    left join public.collection_items ci on ci.id = r.collection_item_id
   where r.collection_item_id is null or ci.id is null or ci.quantity < r.requested
   limit 1;
  if found then
    raise exception 'Not enough stock to accept this offer (% left, % requested)',
      coalesce(v_short.available, 0), v_short.requested
      using errcode = '22023';
  end if;

  -- Find competitors before inventory moves: the decrement trigger deletes listings that
  -- hit zero, which nulls offer_items.collection_item_id (ON DELETE SET NULL).
  select coalesce(array_agg(distinct oi.offer_id), '{}')
    into v_competitors
    from public.offer_items oi
    join public.offers o on o.id = oi.offer_id
   where oi.collection_item_id = any (v_item_ids)
     and o.status in ('pending', 'countered')
     and o.id <> p_offer_id;

  update public.offers set status = 'accepted' where id = p_offer_id;

  insert into public.transactions (offer_id) values (p_offer_id)
  returning * into v_tx;

  -- Decline open competing offers (including ones mid-negotiation) that the remaining
  -- stock can no longer fill.
  update public.offers o
     set status = 'declined'
   where o.id = any (v_competitors)
     and o.status in ('pending', 'countered')
     and exists (
       select 1
         from (select collection_item_id, sum(quantity) as requested
                 from public.offer_items where offer_id = o.id
                group by collection_item_id) r
         left join public.collection_items ci on ci.id = r.collection_item_id
        where ci.id is null or ci.quantity < r.requested
     );

  return v_tx;
end;
$$;

-- Either side can walk away at any point before acceptance, whoever's turn it is.
create or replace function public.decline_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
begin
  perform public._lock_offer_for_transition(p_offer_id, 'seller', array['pending', 'countered'], 'decline');
  update public.offers set status = 'declined' where id = p_offer_id returning * into v_offer;
  return v_offer;
end;
$$;

create or replace function public.cancel_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
begin
  perform public._lock_offer_for_transition(p_offer_id, 'buyer', array['pending', 'countered'], 'cancel');
  update public.offers set status = 'cancelled' where id = p_offer_id returning * into v_offer;
  return v_offer;
end;
$$;

revoke all on function public.counter_offer(uuid, numeric, text) from public, anon;
grant execute on function public.counter_offer(uuid, numeric, text) to authenticated;

-- ── expiry job ───────────────────────────────────────────────────────────────

-- Pure SQL, so pg_cron calls it directly (no edge function, no Vault token). The
-- notifications it triggers reach push through the notifications → push_outbox trigger.
create or replace function public.expire_offers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.offers
     set status = 'expired'
   where status in ('pending', 'countered')
     and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_offers() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-offers') then
    perform cron.unschedule('expire-offers');
  end if;
end;
$$;
select cron.schedule('expire-offers', '*/5 * * * *', $$ select public.expire_offers(); $$);

-- ── notifications ────────────────────────────────────────────────────────────

create or replace function public.notify_offer_parties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fmt_amount text;
  v_note text;
begin
  -- total_amount is in cents.
  fmt_amount := '$' || to_char(new.total_amount / 100.0, 'FM999999990.00');

  if tg_op = 'INSERT' then
    insert into public.notifications
      (user_id, type, category, priority, title, body, action_url, payload)
    values (
      new.seller_id, 'offer_received', 'offer', 'high',
      'New Offer Received',
      'You received a new offer for ' || fmt_amount,
      '/offers?view=inbox',
      jsonb_build_object('offer_id', new.id, 'buyer_id', new.buyer_id, 'total_amount', new.total_amount)
    );

  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    case new.status
      -- Seller countered: the buyer's move.
      when 'countered' then
        insert into public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        values (
          new.buyer_id, 'offer_countered', 'offer', 'high',
          'Counteroffer Received',
          'The seller countered with ' || fmt_amount || '.',
          '/offers?view=my-offers',
          jsonb_build_object('offer_id', new.id, 'seller_id', new.seller_id, 'total_amount', new.total_amount)
        );

      -- Back to pending only happens when the buyer counters a counter.
      when 'pending' then
        insert into public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        values (
          new.seller_id, 'offer_countered', 'offer', 'high',
          'Counteroffer Received',
          'The buyer countered with ' || fmt_amount || '.',
          '/offers?view=inbox',
          jsonb_build_object('offer_id', new.id, 'buyer_id', new.buyer_id, 'total_amount', new.total_amount)
        );

      when 'accepted' then
        if old.status = 'countered' then
          insert into public.notifications
            (user_id, type, category, priority, title, body, action_url, payload)
          values (
            new.seller_id, 'offer_accepted', 'offer', 'high',
            'Counteroffer Accepted!',
            'The buyer accepted your counteroffer of ' || fmt_amount || '.',
            '/offers?view=inbox',
            jsonb_build_object('offer_id', new.id, 'buyer_id', new.buyer_id, 'total_amount', new.total_amount)
          );
        else
          insert into public.notifications
            (user_id, type, category, priority, title, body, action_url, payload)
          values (
            new.buyer_id, 'offer_accepted', 'offer', 'high',
            'Offer Accepted!',
            'Your offer of ' || fmt_amount || ' was accepted.',
            '/offers?view=my-offers',
            jsonb_build_object('offer_id', new.id, 'seller_id', new.seller_id, 'total_amount', new.total_amount)
          );
        end if;

      when 'declined' then
        insert into public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        values (
          new.buyer_id, 'offer_declined', 'offer', 'normal',
          'Offer Declined',
          'Your offer of ' || fmt_amount || ' was declined.',
          '/offers?view=my-offers',
          jsonb_build_object('offer_id', new.id, 'seller_id', new.seller_id, 'total_amount', new.total_amount)
        );

      when 'cancelled' then
        insert into public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        values (
          new.seller_id, 'offer_cancelled', 'offer', 'normal',
          'Offer Cancelled',
          'A buyer cancelled their offer of ' || fmt_amount || '.',
          '/offers?view=inbox',
          jsonb_build_object('offer_id', new.id, 'buyer_id', new.buyer_id, 'total_amount', new.total_amount)
        );

      -- Both sides hear about it; the body says whose response was missing.
      when 'expired' then
        v_note := case old.status
                    when 'countered' then 'the buyer didn''t respond to the counteroffer in time'
                    else 'the seller didn''t respond in time'
                  end;
        insert into public.notifications
          (user_id, type, category, priority, title, body, action_url, payload)
        values
          (new.buyer_id, 'offer_expired', 'offer', 'normal',
           'Offer Expired',
           'Your offer of ' || fmt_amount || ' expired: ' || v_note || '.',
           '/offers?view=my-offers',
           jsonb_build_object('offer_id', new.id, 'seller_id', new.seller_id, 'total_amount', new.total_amount)),
          (new.seller_id, 'offer_expired', 'offer', 'normal',
           'Offer Expired',
           'An offer of ' || fmt_amount || ' expired: ' || v_note || '.',
           '/offers?view=inbox',
           jsonb_build_object('offer_id', new.id, 'buyer_id', new.buyer_id, 'total_amount', new.total_amount));

      else
        null;
    end case;
  end if;

  return new;
end;
$$;
