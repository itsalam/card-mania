# CardHedger: our self-imposed rate limits

CardHedger's API spec (`api-1.json`) documents **no** rate limits, quotas, or 429 behaviour —
only a 422 validation error. Until they give us numbers, this is the budget we hold ourselves
to. Every CardHedger caller in `supabase/functions/` is listed here; anything new that calls
CardHedger must add itself to this table and fit inside the totals.

## Enforcement (ITS-113)

Every request goes through **one chokepoint**, `cardhedgeClient` / `createCardHedgeClient` in
`supabase/functions/_shared/cardhedge.ts`. Nothing else may fetch `CARDHEDGE_API_BASE`
(`grep -rn "/v1/cards/\|CARDHEDGE_API_BASE" supabase/functions` should only find that file). Per
request it:

1. takes one unit from the **global daily budget** (`public.consume_cardhedger_budget`, UTC
   days). Denied → `BudgetExhaustedError`, and CardHedger isn't called.
2. calls through `fetchWithBackoff` (retries below). Retries don't cost extra budget.
3. writes one row to **`public.cardhedger_calls`** (caller, endpoint, status, duration, retries,
   rate_limited, budget_denied, error). Best-effort; live paths don't wait for it.

If the budget check itself errors (DB trouble), the call is allowed: per-run caps and backoff
still apply.

**Block claims.** To save a round trip per call, units can be claimed several at a time and
spent locally:

- `createCardHedgeClient(caller, supabase, { claimBlock: n })` claims `n` units per budget check.
  The scheduled jobs use 10. A refused block falls back to a single unit, so the last few units
  of a budget are still usable.
- `client.reserve(class, n)` claims a known number up front. `fetch-card-history` reserves one
  `prices` unit per grade. If the budget can't cover all `n`, each call claims its own unit.
- `client.release()` hands unspent units back (`public.release_cardhedger_budget`) to the UTC
  day they were claimed on. Call it before the client goes out of scope; units not released
  stay counted as used until midnight UTC.
- Concurrent calls in one client share a block. Only a refused single unit counts in
  `cardhedger_usage.denied`.

| Endpoint class | Endpoints                              | Daily limit | Scheduled share |
| -------------- | -------------------------------------- | ----------- | --------------- |
| `search`       | `card-search`                          | 5,000       | 80 % (4,000)    |
| `match`        | `card-match` (AI)                      | 375         | 80 % (300)      |
| `prices`       | `all-prices-by-card`, `prices-by-card` | 2,500       | 80 % (2,000)    |
| `other`        | `top-movers`                           | 500         | 80 % (400)      |

The limits live in `public.cardhedger_budget` — change them without a deploy from the admin
console (Pipelines → CardHedger → Edit limit) or SQL:

```sql
update public.cardhedger_budget set daily_limit = 3000 where endpoint_class = 'search';
```

When the budget says no:

- **Scheduled jobs** (`tracked-price-refresh`, `card-enrichment-backfill`) stop, hand every
  remaining lease back, and end the run as **`budget_exhausted`** — just like `rate_limited`.
  Nothing is counted against the cards. They can only ever use the scheduled share, so live
  traffic always has the rest.
- **Live paths** never error: `price-charting` search serves the cache / DB blend without
  CardHedger, top-movers returns an empty list, `fetch-card` keeps the stored prices, and
  `fetch-card-history` keeps whatever grades it already fetched (or answers
  `{ skipped: 'budget_exhausted' }`).

`fetch-card-history` runs at most 3 grade calls at a time (it used to fire every grade at once).

### Alerts

`admin.send_ops_alerts()` runs hourly (`ops-alerts`, `:53`) and sends a `system` notification
(type `ops_alert`) to every owner and ops member — each alert at most once per UTC day — when:

- a refresh or enrichment run ended `rate_limited` or `budget_exhausted`;
- a class passed 80 % of today's limit;
- a cron → function call got a 401 (usually a stale Vault `edge_token`).

Sent alerts are in `admin.ops_alerts` and on the console's CardHedger tab.

Auth for every call: `X-API-Key: $CARDHEDGE_API_KEY` against `$CARDHEDGE_API_BASE`
(staging secrets; local runs read `supabase/functions/.env.local`).

## Budget

| Limit                                   | Value                  | Why                                                                                                                               |
| --------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled calls / day (all jobs)        | **≤ 4,000**            | Room for live traffic on top; revisit once CardHedger confirms a quota.                                                           |
| AI `card-match` calls / day (scheduled) | **≤ 300**              | Slow and likely the most expensive endpoint; results are persisted, so each card needs it at most once.                           |
| Burst (any one job)                     | **≤ ~4 req/s**         | Jobs throttle between cards (250–300 ms) and run sequentially, never in parallel fan-out.                                         |
| Retries per call                        | **3** (429 / 5xx only) | `fetchWithBackoff`: exponential 0.5 s → 8 s with jitter, honours `Retry-After` (capped at 8 s). Other 4xx are never retried.      |
| On sustained 429                        | **stop the run**       | `tracked-price-refresh` releases every remaining lease and records the run as `rate_limited`; the next scheduled run tries again. |

## Callers

### Scheduled (bounded by schedule × batch size)

| Caller                     | Schedule            | Per run                                                                                              | Endpoints                                                                                                                                           | Max / day                                                                       |
| -------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tracked-price-refresh`    | `:07, :37` (48/day) | `PRICE_REFRESH_BATCH_SIZE` = 25 cards; `PRICE_REFRESH_MAX_RESOLVES` = 5 AI matches; 90 s time budget | `all-prices-by-card` ×1 per card; `card-search` ×1 per card **without** a stored CardHedger id; `card-match` only when search has no exact id match | 1,200 all-prices + ≤1,200 search (falls to ~0 once ids are stored) + ≤240 match |
| `card-enrichment-backfill` | `*/15` (96/day)     | `ENRICHMENT_BATCH_SIZE` = 15 cards, `ENRICHMENT_CARDHEDGE_LIMIT` = 5 results                         | `card-search` ×1 per card                                                                                                                           | 1,440 search                                                                    |
| **Scheduled total**        |                     |                                                                                                      |                                                                                                                                                     | **≤ 3,840 + ≤ 240 match**                                                       |

Steady state is much lower: a tracked card is refreshed at most once per
`PRICE_REFRESH_STALE_HOURS` (24 h), an `unresolved` card at most once a week, and the
enrichment backfill stops calling once its backlog is drained (`enrichment_backlog.unenriched = 0`).

### Live (bounded by user traffic + caching)

| Caller                      | Trigger                                                                                 | Endpoints                                                                       | Caching / bound                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `price-charting` (search)   | A user search                                                                           | `card-search` ×1                                                                | Per-query `provider_search_cache`, `CARDHEDGE_CACHE_TTL` = 300 s |
| `price-charting` (no query) | Browse with an empty search                                                             | `top-movers` ×1                                                                 | Same cache                                                       |
| `fetch-card` refresh        | Card detail opened with prices older than `PRICE_STALE_HOURS` (24 h)                    | `card-search` ×1 (limit 20)                                                     | At most once per card per 24 h                                   |
| `fetch-card-history`        | First detail view of a card with no history (via `fetch-card` populate / `price-fetch`) | `card-match` ×1 if no stored id; `prices-by-card` ×1 **per grade**, in parallel | Once per card — history is then served from `card_price_history` |
| `vendor-health`             | Manual only                                                                             | `card-search` ×1 (page size 3)                                                  | —                                                                |

`fetch-card-history` is the one live path that fans out (one call per grade the card has,
typically 5–15 at once). If CardHedger starts rate limiting, that's the first place to
serialize or cap.

## Knobs

All are edge-function env vars (`supabase secrets set …`); defaults are in code.

| Env var                        | Default | Effect                                |
| ------------------------------ | ------- | ------------------------------------- |
| `PRICE_REFRESH_BATCH_SIZE`     | 25      | Cards per refresh run                 |
| `PRICE_REFRESH_MAX_RESOLVES`   | 5       | AI `card-match` calls per refresh run |
| `PRICE_REFRESH_THROTTLE_MS`    | 300     | Pause between cards                   |
| `PRICE_REFRESH_STALE_HOURS`    | 24      | How often a tracked card is re-priced |
| `PRICE_REFRESH_TIME_BUDGET_MS` | 90000   | Stop claiming new cards after this    |
| `ENRICHMENT_BATCH_SIZE`        | 15      | Cards per enrichment run              |
| `ENRICHMENT_THROTTLE_MS`       | 250     | Pause between cards                   |
| `ENRICHMENT_CARDHEDGE_LIMIT`   | 5       | Search results requested per card     |
| `CARDHEDGE_CACHE_TTL`          | 300     | Live search cache, seconds            |
| `PRICE_STALE_HOURS`            | 24      | `fetch-card` refresh threshold        |

To back off fast: lower `PRICE_REFRESH_BATCH_SIZE` / `ENRICHMENT_BATCH_SIZE` (takes effect on
the next run, no deploy needed), or pause a job with
`select cron.unschedule('tracked-price-refresh');` and re-create it from
`supabase/migrations/20261025000003_tracked_price_refresh_cron.sql` later.

## Watching usage

```sql
-- every caller today vs. its class budget: calls, denials, 429s, errors, retries, p95 latency
select * from cardhedger_usage_today order by calls desc;
-- 30-day trend per class (for quota conversations with CardHedger)
select * from cardhedger_usage_daily order by day desc, endpoint_class;
-- recent failures
select called_at, caller, endpoint, status, retries, rate_limited, budget_denied, error
  from cardhedger_calls
 where rate_limited or budget_denied or error is not null
 order by called_at desc limit 50;

-- refresh job: throughput, unresolved backlog, last run status (look for 'rate_limited')
select * from price_refresh_backlog;
select started_at, status, claimed, refreshed, unchanged, unresolved, failed, resolves_used
  from price_refresh_runs order by started_at desc limit 20;

-- enrichment backfill
select * from enrichment_backlog;
```

`cardhedger_calls` keeps 30 days and `cardhedger_usage` 90 days (`cardhedger-ledger-prune`,
daily at 04:35 UTC).

## When CardHedger gives us real numbers

Set `cardhedger_budget` just under their limits, update the tables above, and keep the
per-run caps below the scheduled share. If they offer the `price-updates` change feed
with a subscription filter, it can replace per-card polling in `tracked-price-refresh`
(see the spec: `/v1/cards/price-updates`, `/v1/cards/subscribe-price-updates`).
