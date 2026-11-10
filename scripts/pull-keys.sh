#!/usr/bin/env bash
set -euo pipefail

# dotenvx only reads .env.keys, so the local, test and production keys all go into that one file.
# R2 keeps the production key in its own bucket, so access to it can be granted separately.

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

wrangler r2 object get dotenv-keys/.env.keys --file="$TEMP_DIR/development" --remote
wrangler r2 object get dotenv-admin/.env.keys.production --file="$TEMP_DIR/production" --remote

{
  cat "$TEMP_DIR/development"
  printf '\n'
  grep '^DOTENV_PRIVATE_KEY=' "$TEMP_DIR/production"
} > .env.keys

echo "Wrote $(grep -c '^DOTENV_PRIVATE_KEY' .env.keys) keys to .env.keys"
