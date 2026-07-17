#!/usr/bin/env bash
# Dumps a consolidated OSS-safe schema baseline from the connected Supabase
# database, filtering out enterprise-only tables and functions listed in
# docs/oss/ee-db-manifest.json.
#
# Requires: pg_dump (v15+), jq, and a DATABASE_URL pointing at the source DB
# (typically the production Supabase instance). This is a READ-ONLY operation
# on the source DB; no changes are applied anywhere.
#
# Usage:
#   DATABASE_URL="postgres://..." ./scripts/dump-open-schema.sh \
#     > docs/oss/schema-baseline.sql
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is required" >&2
  exit 1
fi

MANIFEST="${MANIFEST:-docs/oss/ee-db-manifest.json}"
if [[ ! -f "$MANIFEST" ]]; then
  echo "error: manifest not found at $MANIFEST" >&2
  exit 1
fi

# Build a list of --exclude-table=public.<name> flags for pg_dump.
EXCLUDES=()
while IFS= read -r t; do
  EXCLUDES+=("--exclude-table=public.${t}")
done < <(jq -r '.tables[]' "$MANIFEST")

# pg_dump can't exclude functions directly, so we dump schema-only then filter
# the SQL text to snip out EE function CREATEs. Best-effort; review the diff.
FUNCS=$(jq -r '.functions[]' "$MANIFEST" | paste -sd'|' -)

pg_dump \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  "${EXCLUDES[@]}" \
  "$DATABASE_URL" \
| awk -v funcs="$FUNCS" '
  BEGIN {
    split(funcs, arr, "|");
    for (i in arr) fn[arr[i]] = 1;
    skip = 0;
  }
  /^CREATE OR REPLACE FUNCTION public\.[a-zA-Z0-9_]+/ {
    match($0, /public\.([a-zA-Z0-9_]+)/, m);
    if (m[1] in fn) { skip = 1; next; }
  }
  skip && /^\$function\$;?$/ { skip = 0; next; }
  skip { next; }
  { print }
'
