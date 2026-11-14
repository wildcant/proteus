#!/usr/bin/env bash
set -euo pipefail

# Creates a store's production resources on Cloudflare and fills in the `.env` values that come
# from them. Safe to rerun: each step skips what already exists.
#
#   ./scripts/create-cloudflare-resources.sh <store>
#
# <store> is the prefix every resource name shares (`proteus` for this repository). Run it after
# `wrangler login` and after the Supabase URLs are in `.env`: the Hyperdrive config is created from
# DIRECT_DATABASE_URL. Secrets are read from `.env` and written back with dotenvx, never printed.
#
# The R2 API token for the S3 keys has no CLI, so it stays a dashboard step (docs/deployment.md).

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/create-cloudflare-resources.sh <store>"
  exit 1
fi

STORE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
PATH="$ROOT/node_modules/.bin:$PATH"

# Wrangler reads a `wrangler.jsonc` from the working directory, and `pages project create` with one
# present tries to deploy that Worker instead. An empty directory keeps every command to its own job.
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

env_value() { dotenvx get "$1" -f "$ENV_FILE" 2>/dev/null || true; }
# Only when the value changes: dotenvx re-encrypts on every set, so a rerun would rewrite `.env`.
set_env() {
  if [ "$(env_value "$1")" = "$2" ]; then return; fi
  dotenvx set "$1" "$2" -f "$ENV_FILE" >/dev/null && echo "  set $1"
}

ACCOUNT_ID=$(wrangler whoami --json | jq -r '.accounts[0].id')
echo "Account $ACCOUNT_ID"

echo "Queues"
for queue in "$STORE-events-dlq" "$STORE-events"; do
  if wrangler queues list 2>/dev/null | grep -qw -- "$queue"; then
    echo "  $queue exists"
  else
    wrangler queues create "$queue" >/dev/null && echo "  created $queue"
  fi
done

echo "Assets bucket"
ASSETS="$STORE-assets"
if wrangler r2 bucket list 2>/dev/null | grep -qE "^name:\s+$ASSETS$"; then
  echo "  $ASSETS exists"
else
  wrangler r2 bucket create "$ASSETS" >/dev/null && echo "  created $ASSETS"
fi
wrangler r2 bucket dev-url enable "$ASSETS" -y >/dev/null
PUBLIC_URL=$(wrangler r2 bucket dev-url get "$ASSETS" | grep -oE 'https://pub-[a-z0-9]+\.r2\.dev')
# The admin uploads straight to the bucket through presigned URLs.
printf '{"rules":[{"allowed":{"origins":["https://%s-admin.pages.dev"],"methods":["GET","PUT"],"headers":["*"]},"maxAgeSeconds":3600}]}' \
  "$STORE" >cors.json
wrangler r2 bucket cors set "$ASSETS" --file cors.json -y >/dev/null
echo "  public at $PUBLIC_URL, admin uploads allowed"
set_env S3_BUCKET "$ASSETS"
set_env S3_REGION auto
set_env S3_ENDPOINT "https://$ACCOUNT_ID.r2.cloudflarestorage.com"
set_env S3_FILE_URL "$PUBLIC_URL"
set_env VITE_IMAGE_ORIGIN "$PUBLIC_URL"
set_env VITE_MEDIA_ORIGIN "$PUBLIC_URL"
set_env FILE_PROVIDER s3

echo "Admin Pages project"
ADMIN="$STORE-admin"
if wrangler pages project list --json 2>/dev/null | jq -e --arg name "$ADMIN" 'any(.[]; .["Project Name"] == $name)' >/dev/null; then
  echo "  $ADMIN exists"
else
  # `--force` makes a classic Pages project, which is what `wrangler pages deploy` in the admin's
  # `deploy` script publishes to.
  wrangler pages project create "$ADMIN" --production-branch main --force >/dev/null && echo "  created $ADMIN"
fi

echo "Hyperdrive"
HYPERDRIVE="$STORE-db"
HYPERDRIVE_ID=$(wrangler hyperdrive list 2>/dev/null | awk -F'│' -v name="$HYPERDRIVE" '{ gsub(/ /, "", $2); gsub(/ /, "", $3) } $3 == name { print $2 }')
if [ -n "$HYPERDRIVE_ID" ]; then
  echo "  $HYPERDRIVE exists"
else
  DIRECT_URL=$(env_value DIRECT_DATABASE_URL)
  if [ -z "$DIRECT_URL" ]; then
    echo "  skipped: DIRECT_DATABASE_URL is not in .env yet"
  else
    # Direct connection with caching off: Hyperdrive pools on its own, and a cached read would serve a
    # shopper a stale stock count.
    HYPERDRIVE_ID=$(wrangler hyperdrive create "$HYPERDRIVE" --connection-string="$DIRECT_URL" --caching-disabled 2>&1 |
      grep -oE '"id": "[0-9a-f]{32}"' | grep -oE '[0-9a-f]{32}')
    echo "  created $HYPERDRIVE"
  fi
fi
if [ -n "$HYPERDRIVE_ID" ]; then
  sed -i.bak -E "/\"binding\": \"HYPERDRIVE\"/,/\"id\"/ s/\"id\": \"[0-9a-f]{32}\"/\"id\": \"$HYPERDRIVE_ID\"/" \
    "$ROOT/apps/backend/wrangler.jsonc"
  rm -f "$ROOT/apps/backend/wrangler.jsonc.bak"
  echo "  apps/backend/wrangler.jsonc points at $HYPERDRIVE_ID"
fi

echo "Secrets"
if [ -n "$(env_value JWT_SECRET)" ]; then
  echo "  JWT_SECRET exists"
else
  set_env JWT_SECRET "$(openssl rand -base64 48)"
fi

echo "Dotenv key buckets"
for bucket in dotenv-keys dotenv-admin; do
  if wrangler r2 bucket list 2>/dev/null | grep -qE "^name:\s+$bucket$"; then
    echo "  $bucket exists"
  else
    wrangler r2 bucket create "$bucket" >/dev/null && echo "  created $bucket"
  fi
done
echo "  run 'pnpm run push-keys' to upload .env.keys"
