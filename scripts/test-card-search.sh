#!/usr/bin/env bash
# scripts/test-card-search.sh
#
# Smoke tests for the card-search edge function.
# Covers the verification checklist from the multi-provider search overhaul.
#
# Usage:
#   # Against local Supabase (default):
#   ./scripts/test-card-search.sh
#
#   # Against remote:
#   SUPA_URL=https://YOUR_PROJECT.supabase.co ANON_KEY=eyJ... ./scripts/test-card-search.sh
#
#   # With eBay credentials set in your local Supabase env:
#   ./scripts/test-card-search.sh --ebay
#
# Prerequisites: curl, jq

set -euo pipefail

SUPA_URL="${SUPA_URL:-http://127.0.0.1:54321}"
ANON_KEY="${ANON_KEY:-}"
FN_URL="${SUPA_URL}/functions/v1/card-search"
PASS=0
FAIL=0

# ── helpers ────────────────────────────────────────────────────────────────────

green() { printf '\033[32m✔ %s\033[0m\n' "$*"; }
red()   { printf '\033[31m✘ %s\033[0m\n' "$*"; }

check() {
  local label="$1"
  local expr="$2"   # jq boolean expression
  local json="$3"

  if echo "$json" | jq -e "$expr" > /dev/null 2>&1; then
    green "$label"
    (( PASS++ )) || true
  else
    red "$label"
    echo "  Response: $(echo "$json" | jq -c '.' 2>/dev/null || echo "$json")"
    (( FAIL++ )) || true
  fi
}

call() {
  local url="$1"
  local headers=(-H "Content-Type: application/json")
  if [[ -n "$ANON_KEY" ]]; then
    headers+=(-H "apikey: $ANON_KEY")
  fi
  curl -s "${headers[@]}" "$url"
}

echo ""
echo "=== card-search smoke tests ==="
echo "  Target: $FN_URL"
echo ""

# ── 1. Basic search returns results ───────────────────────────────────────────

echo "--- 1. Basic search"
R=$(call "${FN_URL}?q=topps+baseball+2023&limit=5")
check "Returns non-empty results array"        '.results | length > 0'          "$R"
check "Each result has id, score, card fields" '.results[0] | has("id","score","card")' "$R"
check "query_hash present"                     'has("query_hash")'              "$R"

# ── 2. Grade prices (PSA10 mapping) ───────────────────────────────────────────

echo ""
echo "--- 2. Grade prices"
R=$(call "${FN_URL}?q=2023+topps+chrome+mike+trout+psa+10&limit=3")
check "At least one result"                    '.results | length > 0'          "$R"
# grades_prices key exists on vendor results (may be empty {} for local-only results)
check "card.grades_prices field present"       '.results[0].card | has("grades_prices")' "$R"

# ── 3. Sport / genre filter forwarded ─────────────────────────────────────────

echo ""
echo "--- 3. Sport filter"
R_BASEBALL=$(call "${FN_URL}?q=1952+rookie&sport=baseball&limit=5")
R_NO_FILTER=$(call "${FN_URL}?q=1952+rookie&limit=5")
check "Baseball-filtered search returns results" '.results | length > 0' "$R_BASEBALL"
check "Unfiltered search also returns results"   '.results | length > 0' "$R_NO_FILTER"

# ── 4. Pagination — second page offset ────────────────────────────────────────

echo ""
echo "--- 4. Pagination"
R_P1=$(call "${FN_URL}?q=bowman+chrome&limit=20")
R_P2=$(call "${FN_URL}?q=bowman+chrome&limit=20&cursor=20")
check "Page 1 returns up to 20 results"  '.results | length <= 20'             "$R_P1"
check "Page 2 returns a results array"   '.results | type == "array"'          "$R_P2"
# Pages should not share the same first ID (only meaningful if both have results)
P1_FIRST=$(echo "$R_P1" | jq -r '.results[0].id // empty')
P2_FIRST=$(echo "$R_P2" | jq -r '.results[0].id // empty')
if [[ -n "$P1_FIRST" && -n "$P2_FIRST" && "$P1_FIRST" != "$P2_FIRST" ]]; then
  green "Page 2 first result differs from page 1 first result"
  (( PASS++ )) || true
else
  red "Page 2 first result differs from page 1 first result (skipped — one page empty)"
  (( FAIL++ )) || true
fi

# ── 5. Source field present on results ────────────────────────────────────────

echo ""
echo "--- 5. Source attribution"
R=$(call "${FN_URL}?q=topps+chrome+2023&limit=10")
check "At least one result has source=vendor"  '[.results[] | select(.source=="vendor")] | length > 0' "$R"

# ── 6. Image hints attached ───────────────────────────────────────────────────

echo ""
echo "--- 6. Image hints"
R=$(call "${FN_URL}?q=topps+2023&limit=5")
check "card.image.url present on first result" \
      '.results[0].card.image.url | type == "string"' "$R"
check "card.image.query_hash present"          \
      '.results[0].card.image | has("query_hash")' "$R"

# ── 7. eBay results (optional — only when --ebay flag passed) ─────────────────

if [[ "${1:-}" == "--ebay" ]]; then
  echo ""
  echo "--- 7. eBay results"
  R=$(call "${FN_URL}?q=2023+topps+hobby+baseball&limit=10")
  check "At least one result with reason.provider=ebay" \
        '[.results[] | select(.reason.provider=="ebay")] | length > 0' "$R"
fi

# ── 8. Suggestions fallback ───────────────────────────────────────────────────

echo ""
echo "--- 8. Suggestions endpoint (commit_images param accepted)"
R=$(call "${FN_URL}?q=baseball+cards+2025+topps&limit=8&commit_images=true")
check "Suggestions call succeeds"       '.results | type == "array"' "$R"
check "Suggestions query_hash present"  'has("query_hash")'          "$R"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "==================================="
echo "  Passed: $PASS  |  Failed: $FAIL"
echo "==================================="
echo ""

[[ $FAIL -eq 0 ]]
