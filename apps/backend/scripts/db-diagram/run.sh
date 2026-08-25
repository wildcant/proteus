#!/usr/bin/env bash
# Build a ChartDB diagram of the local schema, grouped into one labelled area per module.
#
#   npm run --workspace=backend db:diagram
#
# Dumps the schema with query.sql, then hands it to load.mjs, which drives ChartDB's import and
# rewrites the layout. Opens a browser window with the finished diagram; no copying or pasting.
#
# ChartDB is a static SPA with no server or API — a diagram only exists inside a browser's
# IndexedDB. So this drives a real browser, using its own Chromium profile under tmp/ rather
# than your everyday Chrome, which Playwright cannot attach to.
#
# Connects with DIRECT_DATABASE_URL from .env.local, decrypted by dotenvx (see package.json).
#
# Pass a different query if a ChartDB upgrade changes it:
#   npm run --workspace=backend db:diagram -- path/to/query.sql
#
# Note: cross-module references are plain text columns with no foreign key (see src/link-modules),
# so link tables render without relationship lines. That is accurate — there is no constraint.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$(cd "$HERE/../.." && pwd)"
TMP="$BACKEND/tmp"
QUERY="${1:-$HERE/query.sql}"
OUT="$TMP/chartdb-metadata.json"
PROFILE="$TMP/chartdb-profile"
URL="${CHARTDB_URL:-http://localhost:8088}"

if [ -z "${DIRECT_DATABASE_URL:-}" ]; then
  echo "error: DIRECT_DATABASE_URL is not set." >&2
  echo "       Run it through npm so dotenvx decrypts .env.local:" >&2
  echo "         npm run --workspace=backend db:diagram" >&2
  exit 1
fi

[ -f "$QUERY" ] || { echo "error: no such file: $QUERY (relative paths resolve from apps/backend)" >&2; exit 1; }

if ! curl -sf -o /dev/null --max-time 3 "$URL"; then
  echo "error: nothing is serving ChartDB at $URL. Start it with:" >&2
  echo "         docker run -d --name chartdb -p 8088:80 ghcr.io/chartdb/chartdb:latest" >&2
  echo "       (already created once? docker start chartdb)" >&2
  exit 1
fi

mkdir -p "$TMP"

# A viewer window from a previous run holds the profile's lock, and Chromium will not open the
# same user-data-dir twice — the next launch would just hang. Close it before regenerating.
if pgrep -f "user-data-dir=$PROFILE" > /dev/null; then
  echo "  closing the previous diagram window"
  pkill -f "user-data-dir=$PROFILE" || true
  sleep 1
fi

# Start from a clean profile every time. Clearing ChartDB's IndexedDB from inside the page cannot
# be relied on — the app holds an open connection, so deleteDatabase is blocked and silently does
# nothing, leaving the previous diagram in place. The profile is generated, so just drop it.
rm -rf "$PROFILE"

# strip credentials before echoing the target
echo "  reading schema from $(echo "$DIRECT_DATABASE_URL" | sed -E 's#//[^@]*@#//#')"
psql "$DIRECT_DATABASE_URL" -t -A -f "$QUERY" > "$OUT"

if [ ! -s "$OUT" ]; then
  echo "error: the query returned nothing — check that DIRECT_DATABASE_URL points at a migrated database." >&2
  exit 1
fi

echo "  dumped $(wc -c < "$OUT" | tr -d ' ') bytes to $OUT"
node "$HERE/load.mjs" "$OUT" "$URL" "$PROFILE"
