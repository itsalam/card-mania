# Search scoring formula

`public.search_cards_blended` (the RPC behind card search) blends several
signals into one `score` per card and ranks results by it. The weights and
thresholds that control the blend live in `public.search_config`, a
singleton table (always exactly one row, `id = 1`) so they can be tuned at
runtime without redeploying the function.

There's currently no admin UI for editing this (see ITS-57 — deliberately
not built as a client-app screen; if/when admin tooling exists it'll be a
separate system with its own tables, not tied to `user_profile`). Until
then, changes go through SQL directly — see [How to change it
today](#how-to-change-it-today).

## The formula

```
score = weight_fts   · s_fts
      + weight_trgm  · s_trgm
      + weight_vector· s_vector
      + weight_pop   · s_pop
```

- **`s_fts`** — full-text rank. `ts_rank_cd(c.search_vector, plainto_tsquery('simple', q))`. Rewards matches against the card's indexed `search_vector` (name + set, tsvector).
- **`s_trgm`** — trigram similarity. `greatest(similarity(c.name, q), similarity(c.set_name, q))`. Catches typos and partial matches that full-text search misses.
- **`s_vector`** — currently hardcoded to `0.0`. Reserved for semantic/embedding search, which hasn't been implemented yet — this is not a bug, `weight_vector` is a no-op until a real embedding signal is wired in.
- **`s_pop`** — popularity, itself a blended sub-formula (see below).

### `s_pop` — popularity sub-formula

```
s_pop = least(1.0,
    ( pop_wishlist_weight · log(1 + wishlist_cnt)
    + pop_sale_weight     · log(1 + sale_cnt) )
  / pop_log_divisor
)
```

- `wishlist_cnt` — distinct wishlists containing the card (`collection_items` joined to `collections` where `is_wishlist = true`).
- `sale_cnt` — completed transactions that included the card.
- The log dampens outliers so one viral card doesn't dominate; `pop_log_divisor` sets how many "events" it takes to saturate at `1.0`.

Worked scale at the default `pop_log_divisor = 3.0`:

| Events | `s_pop` |
| ------ | ------- |
| 0      | 0.00    |
| 1      | 0.23    |
| 5      | 0.60    |
| 20     | ~1.00   |

(Reproduced from the comment in `20260630000000_s_pop_wishlist_signal.sql` — the wishlist/sale split defaults to 70/30 via `pop_wishlist_weight` / `pop_sale_weight`.)

## Config reference

All columns on `search_config` (`id = 1`) that affect scoring:

| Column | Default | What it does | Tuning note |
| --- | --- | --- | --- |
| `weight_fts` | 0.6 | Top-level weight on the full-text signal | Raise to favor exact/near-exact name or set matches |
| `weight_trgm` | 0.3 | Top-level weight on the trigram-similarity signal | Raise to be more forgiving of typos/partial queries |
| `weight_vector` | 0.1 | Top-level weight on the (currently unused) semantic signal | No effect until `s_vector` is wired to a real embedding — leave alone until then |
| `weight_pop` | 0.05 | Top-level weight on popularity | Raise to surface popular cards higher even on weaker text matches |
| `pop_wishlist_weight` | 0.7 | Share of `s_pop` driven by wishlist count | Raise to weight "people want this" over "people bought this" |
| `pop_sale_weight` | 0.3 | Share of `s_pop` driven by completed-sale count | Raise to weight actual transaction volume over wishlist interest |
| `pop_log_divisor` | 3.0 | Normalization cap for `s_pop` (see scale table above) | Raise to require more wishlist/sale events before `s_pop` saturates at 1.0; lower to make popularity swing the score faster |
| `trgm_word_similarity_threshold` | 0.2 | Minimum `word_similarity` for a trigram match to count in downstream fuzzy-search helper queries | Raise to cut noisy fuzzy matches; lower to be more permissive |
| `min_score` | 0.0 | Results with `score` at or below this are excluded entirely | Raise to cut low-relevance results from the result set rather than just ranking them low |
| `snippet_max_words` | 20 | Max words in the `ts_headline` result snippet | Cosmetic — affects snippet length only, not ranking |
| `snippet_min_words` | 5 | Min words in the result snippet | Cosmetic — affects snippet length only, not ranking |
| `snippet_max_fragments` | 1 | Max highlighted fragments in the snippet | Cosmetic — affects snippet length only, not ranking |

This table is written to double as source copy for admin UI tooltips, per ITS-58's original intent, whenever that UI gets built.

`search_config` also has `prefetch_enabled` / `prefetch_threshold_ms` (adaptive search prefetch, updated hourly by the `search-warmup` cron based on p75 render latency) and curated-suggestion-rotation columns added in `20260408000002_suggestion_rotation.sql`. Neither affects scoring — out of scope for this doc.

## Tuning guidance

The four top-level weights (`weight_fts`, `weight_trgm`, `weight_vector`, `weight_pop`) are conventionally kept summing to ~1.0, per the comment in the base migration. This isn't enforced by the schema — if they don't sum to 1.0, `score` just shifts scale uniformly and relative ordering between results is unaffected. It's a readability convention (so `score` stays roughly interpretable as "0 to 1"), not a hard constraint.

## How to change it today

There's no admin UI yet, so tuning is a direct SQL update against the singleton row. `search_config`'s RLS policy (`20260327000000_search_config.sql`) only allows writes from `service_role` — run this via the Supabase SQL editor or a service-role-authenticated connection:

```sql
update public.search_config
set weight_pop = 0.1
where id = 1;
```

Reads are open to everyone (`search_config_read` policy), so the current values can always be checked with:

```sql
select * from public.search_config where id = 1;
```

## Where the formula lives

The authoritative scoring logic is the SQL body of `public.search_cards_blended`. Current version: `supabase/migrations/20260723000000_restore_search_cards_blended_pop_signal.sql`. History, in order:

1. `20260327000000_search_config.sql` — introduced `search_config` and the base four-weight blend.
2. `20260329900000_search_improvements.sql` — Phase 1 (FTS/trgm indexing).
3. `20260630000000_s_pop_wishlist_signal.sql` — wired `s_pop` to real wishlist + sale counts (ITS-56).
4. `20260711000000_its77_search_filters_storefront.sql` — added `p_genre` / `p_sets` / `p_min_price` / `p_max_price` / `p_sealed` filter params, but branched off a pre-popularity copy of the function and silently reverted `s_pop` to `0.0`.
5. `20260723000000_restore_search_cards_blended_pop_signal.sql` — restored the wishlist/sale `s_pop` wiring on top of the filter-params signature. This is the current version.
