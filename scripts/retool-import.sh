#!/usr/bin/env bash
# Copy a manual Retool export into retool/apps/<name>/ and check it for secrets.
#
#   scripts/retool-import.sh <export.zip | export.json | exported-dir> [app-name]
#
# app-name defaults to "admin-console". The target directory is replaced wholesale (git keeps
# the history), so files Retool dropped from the app disappear here too. Nothing in the export
# is executed — it's copied, then grepped. See retool/README.md.
set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }

[ $# -ge 1 ] || die "usage: scripts/retool-import.sh <export.zip|export.json|dir> [app-name]"
src=$1
name=${2:-admin-console}
[[ $name =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "app name must be lowercase letters, digits and dashes"
[ -e "$src" ] || die "no such file: $src"

root=$(git rev-parse --show-toplevel)
dest="$root/retool/apps/$name"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

case "$src" in
  *.zip)
    unzip -q "$src" -d "$stage/unzipped"
    # A zip with one top-level folder → use its contents.
    shopt -s nullglob dotglob
    entries=("$stage/unzipped"/*)
    if [ ${#entries[@]} -eq 1 ] && [ -d "${entries[0]}" ]; then mv "${entries[0]}" "$stage/app"; else mv "$stage/unzipped" "$stage/app"; fi
    ;;
  *.json)
    mkdir -p "$stage/app"
    # Pretty-print so diffs between exports are readable. Still valid JSON for re-import.
    python3 -c 'import json,sys; json.dump(json.load(open(sys.argv[1])), open(sys.argv[2],"w"), indent=2, ensure_ascii=False); open(sys.argv[2],"a").write("\n")' \
      "$src" "$stage/app/app.json" || die "not valid JSON: $src"
    ;;
  *)
    [ -d "$src" ] || die "expected a .zip, a .json or a directory"
    mkdir -p "$stage/app" && cp -R "$src"/. "$stage/app"/
    ;;
esac

# Build output and dependencies never belong in the repo.
find "$stage/app" \( -name node_modules -o -name dist -o -name .DS_Store -o -name '.env*' \) -prune -exec rm -rf {} +

# ── Secret check ────────────────────────────────────────────────────────────────────────────
# Retool apps should hold no credentials: the resource keeps the anon key, and admins sign in
# with their own Supabase session. Anything below means something leaked into the app itself.
fail=0
check() {
  local label=$1 pattern=$2 hits
  hits=$(grep -rEnI "$pattern" "$stage/app" 2>/dev/null | sed "s|$stage/app/||" | cut -c1-160 || true)
  if [ -n "$hits" ]; then echo "✗ $label:"; echo "$hits" | head -5; fail=1; fi
}
check "Supabase secret key"   'sb_secret_[A-Za-z0-9_-]{10,}'
check "service_role reference" 'service_role'
check "Postgres connection string" 'postgres(ql)?://[^[:space:]"]*:[^[:space:]"]*@'
check "private key"           '-----BEGIN [A-Z ]*PRIVATE KEY-----'
check "hard-coded bearer token" 'Bearer ey[A-Za-z0-9_-]{20,}\.'
# Legacy JWT keys: flag any whose payload says service_role (anon JWTs are fine).
while IFS= read -r jwt; do
  payload=$(printf '%s' "$jwt" | cut -d. -f2 | tr '_-' '/+')
  while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
  if printf '%s' "$payload" | base64 -d 2>/dev/null | grep -q '"role":"service_role"'; then
    echo "✗ service_role JWT found"; fail=1
  fi
done < <(grep -rhoEI 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+' "$stage/app" 2>/dev/null | sort -u || true)

if [ $fail -ne 0 ]; then
  echo
  die "export looks like it contains credentials — nothing was copied. Remove them in Retool and export again."
fi

rm -rf "$dest"
mkdir -p "$(dirname "$dest")"
mv "$stage/app" "$dest"

echo "✓ imported into retool/apps/$name ($(find "$dest" -type f | wc -l | tr -d ' ') files), no secrets found"
echo
git -C "$root" status --short -- "retool/apps/$name" | head -20
echo
echo "Review with: git diff -- retool/apps/$name   then commit."
