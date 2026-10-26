# CardHedger: our self-imposed rate limits

CardHedger's API spec (`api-1.json`) documents **no** rate limits, quotas, or 429 behaviour —
only a 422 validation error. Until they give us numbers, this is the budget we hold ourselves
to. Every CardHedger caller in `supabase/functions/` is listed here; anything new that calls
CardHedger must add itself to this table and fit inside the totals.

Today these limits are enforced per job (batch sizes, AI-match caps, backoff), not globally,
and only the scheduled jobs are ledgered. A single enforced daily budget and a per-call usage
ledger covering live paths too are tracked in
[ITS-113](https://linear.app/itsalam/issue/ITS-113/cardhedger-rate-limiting-enforce-a-global-budget-and-add-usage).

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
-- refresh job: throughput, unresolved backlog, last run status (look for 'rate_limited')
select * from price_refresh_backlog;
select started_at, status, claimed, refreshed, unchanged, unresolved, failed, resolves_used
  from price_refresh_runs order by started_at desc limit 20;

-- approximate scheduled CardHedger calls in the last 24h
select
  (select coalesce(sum(claimed), 0) from price_refresh_runs where started_at > now() - interval '24 hours') as refresh_all_prices,
  (select coalesce(sum(resolves_used), 0) from price_refresh_runs where started_at > now() - interval '24 hours') as refresh_card_match,
  (select count(*) from card_enrichment_attempts
    where vendor = 'cardhedge' and created_at > now() - interval '24 hours') as enrichment_search;

-- enrichment backfill
select * from enrichment_backlog;
```

Live-path calls aren't ledgered; check the function logs (`price_refresh.*`, `backfill.*`
events are single-line JSON) or CardHedger's own dashboard if they provide one.

## When CardHedger gives us real numbers

Replace the **Budget** table with their limits, keep our caps below them with headroom for
live traffic, and adjust the defaults above. If they offer the `price-updates` change feed
with a subscription filter, it can replace per-card polling in `tracked-price-refresh`
(see the spec: `/v1/cards/price-updates`, `/v1/cards/subscribe-price-updates`).
