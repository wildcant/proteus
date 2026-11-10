#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/sync-secrets.sh <worker-name>"
  exit 1
fi

WORKER_NAME="$1"

# dotenvx reads the production key from .env.keys. Without it every value stays encrypted, and the
# Worker would receive the ciphertext as its secrets.
if ! grep -q '^DOTENV_PRIVATE_KEY=' .env.keys 2>/dev/null; then
  echo "Error: .env.keys has no DOTENV_PRIVATE_KEY. Run 'pnpm run pull-keys' first."
  exit 1
fi

SECRETS_JSON=$(dotenvx get -f .env --format json \
  | jq 'with_entries(select(.key | startswith("DOTENV_") | not))')

echo "Setting $(echo "$SECRETS_JSON" | jq 'length') secrets..."
echo "$SECRETS_JSON" | wrangler secret bulk --name "$WORKER_NAME"

echo "Done."
