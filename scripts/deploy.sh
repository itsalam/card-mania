#!/usr/bin/env bash
# scripts/deploy.sh — deploy database migrations + edge functions to a hosted
# Supabase environment (see supabase/environments.json; only `staging` exists).
#
# Usage:
#   scripts/deploy.sh staging [options]
#
# Options:
#   --dry-run            Run preflight and print the plan; change nothing.
#   --functions a,b      Deploy only these functions.
#   --all-functions      Deploy every local function.
#                        (default: functions changed since the last deploy tag;
#                        all of them if there's no tag yet or _shared/ or the
#                        import map changed)
#   --skip-db            Don't push migrations.
#   --skip-functions     Don't deploy functions.
#   --skip-tests         Don't run pgTAP / Deno tests before deploying.
#   --skip-types         Don't regenerate DB types afterwards.
#   --no-tag             Don't record the deploy as a git tag.
#   --allow-dirty        Allow uncommitted changes.
#   --allow-unpushed     Allow deploying a commit that isn't on origin.
#   --yes                Skip the confirmation prompt.
#
# Order: preflight -> confirm -> migrations -> functions -> types -> tag.
# Migrations go first: they're additive, so already-deployed functions keep
# working against the new schema, while new function code may need it.
#
# The DB password is read from SUPABASE_DB_PASSWORD if set, otherwise the
# Supabase CLI prompts for it. Never passes --prune: the hosted project has
# functions with no local source (e.g. card-search, ebay-oauth-callback).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { red "✗ $*" >&2; exit 1; }
usage() { sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# ── args ────────────────────────────────────────────────────────────────────

ENV_NAME="${1:-}"
[ -z "$ENV_NAME" ] && usage 1
[ "$ENV_NAME" = "-h" ] || [ "$ENV_NAME" = "--help" ] && usage 0
shift

DRY_RUN=0 SKIP_DB=0 SKIP_FUNCTIONS=0 SKIP_TESTS=0 SKIP_TYPES=0 NO_TAG=0
ALLOW_DIRTY=0 ALLOW_UNPUSHED=0 YES=0 ALL_FUNCTIONS=0 FUNCTIONS_ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --functions) FUNCTIONS_ARG="${2:-}"; shift ;;
    --all-functions) ALL_FUNCTIONS=1 ;;
    --skip-db) SKIP_DB=1 ;;
    --skip-functions) SKIP_FUNCTIONS=1 ;;
    --skip-tests) SKIP_TESTS=1 ;;
    --skip-types) SKIP_TYPES=1 ;;
    --no-tag) NO_TAG=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --allow-unpushed) ALLOW_UNPUSHED=1 ;;
    --yes) YES=1 ;;
    -h | --help) usage 0 ;;
    *) die "Unknown option: $1" ;;
  esac
  shift
done

PROJECT_REF="$(node -p "(require('./supabase/environments.json')['$ENV_NAME'] || {}).projectRef || ''")"
[ -n "$PROJECT_REF" ] || die "Unknown environment '$ENV_NAME' (see supabase/environments.json)"
TAG_PREFIX="deploy-$ENV_NAME-"

bold "Deploying to $ENV_NAME ($PROJECT_REF)"
[ "$DRY_RUN" = 1 ] && yellow "Dry run — nothing will be changed."
echo

# ── preflight: tooling + auth ───────────────────────────────────────────────

command -v supabase >/dev/null || die "Supabase CLI not found"
supabase projects list 2>/dev/null | grep -q "$PROJECT_REF" ||
  die "Supabase CLI can't see project $PROJECT_REF — run 'supabase login'"
green "✓ Supabase CLI authenticated"

LINKED_REF="$(cat supabase/.temp/project-ref 2>/dev/null || true)"
if [ "$LINKED_REF" != "$PROJECT_REF" ]; then
  yellow "Linked project is '${LINKED_REF:-none}', linking to $PROJECT_REF…"
  supabase link --project-ref "$PROJECT_REF"
fi
green "✓ Linked to $PROJECT_REF"

# ── preflight: git ──────────────────────────────────────────────────────────

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHA="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  [ "$ALLOW_DIRTY" = 1 ] || die "Working tree has uncommitted changes (use --allow-dirty to override)"
  yellow "! Deploying with uncommitted changes"
fi
git fetch -q origin
if ! git branch -r --contains HEAD 2>/dev/null | grep -q .; then
  [ "$ALLOW_UNPUSHED" = 1 ] || die "HEAD ($SHA) isn't on any origin branch — push it first (or --allow-unpushed)"
  yellow "! HEAD ($SHA) isn't pushed"
fi
green "✓ Git: $BRANCH @ $SHA"
[ "$BRANCH" != "main" ] && yellow "! Deploying a non-main branch ($BRANCH)"

# ── preflight: tests ────────────────────────────────────────────────────────

if [ "$SKIP_TESTS" = 0 ]; then
  if supabase status >/dev/null 2>&1; then
    supabase test db >/dev/null 2>&1 || die "pgTAP tests failed — run 'supabase test db' for details"
    green "✓ pgTAP tests pass"
  else
    yellow "! Local Supabase isn't running — skipping pgTAP tests"
  fi
  DENO_TESTS="$(find supabase/functions -name '*.test.ts' -not -path '*/node_modules/*' | sort)"
  if [ -n "$DENO_TESTS" ]; then
    command -v deno >/dev/null || die "deno not found (needed for function tests; or --skip-tests)"
    # shellcheck disable=SC2086
    deno test --no-lock $DENO_TESTS >/dev/null 2>&1 || die "Deno tests failed — run 'deno test $DENO_TESTS'"
    green "✓ Deno tests pass"
  fi
fi

# ── plan: migrations ────────────────────────────────────────────────────────

if [ "$SKIP_DB" = 0 ]; then
  echo
  bold "Pending migrations:"
  # Not piped: the CLI may prompt for the DB password without a newline.
  supabase db push --dry-run || die "Migration dry-run failed"
fi

# ── plan: functions ─────────────────────────────────────────────────────────

ALL_LOCAL_FUNCTIONS="$(find supabase/functions -mindepth 2 -maxdepth 2 -name index.ts |
  sed -E 's#supabase/functions/([^/]+)/index.ts#\1#' | grep -v '^_' | sort)"
LAST_TAG="$(git tag -l "${TAG_PREFIX}*" --sort=-creatordate | head -1)"
FUNCTIONS=""
FUNCTIONS_REASON=""
if [ "$SKIP_FUNCTIONS" = 0 ]; then
  if [ -n "$FUNCTIONS_ARG" ]; then
    FUNCTIONS="$(echo "$FUNCTIONS_ARG" | tr ',' '\n' | sort -u)"
    FUNCTIONS_REASON="--functions"
    for f in $FUNCTIONS; do
      echo "$ALL_LOCAL_FUNCTIONS" | grep -qx "$f" || die "No local function named '$f'"
    done
  elif [ "$ALL_FUNCTIONS" = 1 ] || [ -z "$LAST_TAG" ]; then
    FUNCTIONS="$ALL_LOCAL_FUNCTIONS"
    FUNCTIONS_REASON="$([ -z "$LAST_TAG" ] && echo "no previous $ENV_NAME deploy tag" || echo "--all-functions")"
  else
    CHANGED="$(git diff --name-only "$LAST_TAG" HEAD -- supabase/functions)"
    if echo "$CHANGED" | grep -qE '^supabase/functions/(_shared/|import_map\.json|deno\.json)'; then
      FUNCTIONS="$ALL_LOCAL_FUNCTIONS"
      FUNCTIONS_REASON="shared code changed since $LAST_TAG"
    else
      FUNCTIONS="$(echo "$CHANGED" | sed -nE 's#^supabase/functions/([^/]+)/.*#\1#p' | sort -u |
        grep -xF -f <(echo "$ALL_LOCAL_FUNCTIONS") || true)"
      FUNCTIONS_REASON="changed since $LAST_TAG"
    fi
  fi
  echo
  bold "Functions to deploy ($FUNCTIONS_REASON):"
  if [ -n "$FUNCTIONS" ]; then echo "$FUNCTIONS" | sed 's/^/  /'; else echo "  (none)"; fi

  # Secrets the functions read without a fallback, missing on the project.
  # Best-effort: a bare Deno.env.get() isn't always required.
  if [ -n "$FUNCTIONS" ]; then
    FILES="$(for f in $FUNCTIONS; do echo "supabase/functions/$f"; done) supabase/functions/_shared"
    # shellcheck disable=SC2086
    NEEDED="$(grep -rhoE "Deno\.env\.get\('[A-Z0-9_]+'\)[[:space:]]*(\?\?)?" $FILES 2>/dev/null |
      grep -v '??' | sed -E "s/.*'([A-Z0-9_]+)'.*/\1/" | grep -v '^SUPABASE_' | sort -u)"
    SET="$(supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null | awk -F'|' 'NR>2 {gsub(/ /,"",$1); print $1}')"
    MISSING="$(comm -23 <(echo "$NEEDED") <(echo "$SET" | sort -u) | grep . || true)"
    if [ -n "$MISSING" ]; then
      yellow "! Env vars read without a fallback that aren't set as $ENV_NAME secrets (check they're optional):"
      echo "$MISSING" | sed 's/^/    /'
    else
      green "✓ All env vars read without a fallback are set as secrets"
    fi
  fi
fi

# ── confirm ─────────────────────────────────────────────────────────────────

if [ "$DRY_RUN" = 1 ]; then
  echo
  green "Dry run complete."
  exit 0
fi
if [ "$YES" = 0 ]; then
  echo
  printf 'Type "%s" to deploy %s @ %s: ' "$ENV_NAME" "$BRANCH" "$SHA"
  read -r answer
  [ "$answer" = "$ENV_NAME" ] || die "Aborted"
fi

# ── deploy ──────────────────────────────────────────────────────────────────

if [ "$SKIP_DB" = 0 ]; then
  echo
  bold "Pushing migrations…"
  supabase db push
  green "✓ Migrations applied"
fi

if [ "$SKIP_FUNCTIONS" = 0 ] && [ -n "$FUNCTIONS" ]; then
  echo
  bold "Deploying functions…"
  # One at a time: this CLI's deploy takes a single function name, and a
  # failure should stop the deploy with the remaining functions untouched.
  for f in $FUNCTIONS; do
    echo "  → $f"
    supabase functions deploy "$f" --project-ref "$PROJECT_REF" ||
      die "Deploying $f failed (functions before it in the list were deployed)"
  done
  green "✓ Functions deployed"
fi

if [ "$SKIP_TYPES" = 0 ] && [ "$SKIP_DB" = 0 ]; then
  echo
  bold "Regenerating DB types…"
  npm run -s db:types
  npx prettier --write --log-level warn lib/store/supabase.d.ts supabase/functions/_shared/supabase.ts
  if [ -n "$(git status --porcelain lib/store/supabase.d.ts supabase/functions/_shared/supabase.ts)" ]; then
    yellow "! Generated types changed — review and commit:"
    git status --short lib/store/supabase.d.ts supabase/functions/_shared/supabase.ts | sed 's/^/    /'
  fi
fi

if [ "$NO_TAG" = 0 ]; then
  TAG="${TAG_PREFIX}$(date -u +%Y%m%d-%H%M%S)"
  git tag -a "$TAG" -m "Deployed $BRANCH @ $SHA to $ENV_NAME ($PROJECT_REF)" HEAD
  git push -q origin "$TAG"
  green "✓ Tagged $TAG"
fi

echo
green "Deployed $BRANCH @ $SHA to $ENV_NAME."
cat <<EOF

Verify (Dashboard → SQL Editor, https://supabase.com/dashboard/project/$PROJECT_REF/sql):
  select jobname, schedule, active from cron.job order by jobname;
  select name from vault.decrypted_secrets where name in ('project_url', 'edge_token');
  select * from enrichment_backlog;   -- after the next cron tick
Function logs: https://supabase.com/dashboard/project/$PROJECT_REF/functions
EOF
