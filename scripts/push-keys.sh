#!/usr/bin/env bash
set -euo pipefail

# The counterpart of pull-keys.sh: uploads .env.keys to the same two R2 objects, the local and test
# keys to one and the production key to the other, so access to it can be granted separately. Keep
# the object paths in step with pull-keys.sh.

if ! grep -q '^DOTENV_PRIVATE_KEY=' .env.keys 2>/dev/null; then
  echo "Error: .env.keys has no DOTENV_PRIVATE_KEY to upload."
  exit 1
fi

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT
chmod 700 "$TEMP_DIR"

grep -v '^DOTENV_PRIVATE_KEY=' .env.keys >"$TEMP_DIR/development"
grep '^DOTENV_PRIVATE_KEY=' .env.keys >"$TEMP_DIR/production"

wrangler r2 object put dotenv-keys/.env.keys --file="$TEMP_DIR/development" --remote
wrangler r2 object put dotenv-admin/.env.keys.production --file="$TEMP_DIR/production" --remote

echo "Uploaded $(grep -c '^DOTENV_PRIVATE_KEY' .env.keys) keys"
