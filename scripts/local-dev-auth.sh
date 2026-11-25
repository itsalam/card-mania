#!/usr/bin/env bash
# Local development only: every local sign-in uses 111111 (passwords and OTP codes).
# See supabase/local/dev-auth.sql. Re-run after `supabase db reset` or loading new data.
#
# Usage: scripts/local-dev-auth.sh
#
# Always targets the local stack (127.0.0.1:54322); there is no flag to point it anywhere else.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# supabase_admin: the auth tables belong to supabase_auth_admin, so only the local superuser can
# add the trigger. Local credentials only.
DB_URL="postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres"

psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/local/dev-auth.sql"
echo "Local sign-ins now use 111111 (cardmania_demo@demo.com keeps 123456)."
