#!/usr/bin/env bash
set -euo pipefail

# Restore the staging database: drop all schemas, re-migrate, seed providers, seed dev data.
# Usage: pnpm --filter backend run db:restore:staging
#
# Seeding runs with FILE_PROVIDER=s3 so the product photos are uploaded to the bucket in .env
# rather than copied to a local `static/` directory staging cannot serve.

REPO_ROOT="$(cd "$(dirname "$0")/../../../" && pwd)"
BACKEND_DIR="$REPO_ROOT/apps/backend"

# Every command below resolves a binary or a module from the backend's own node_modules, and under
# pnpm that is the only place they exist — `dotenvx` and `tsx` come from its .bin, and the inline
# `require('pg')` from its dependencies. The `pnpm --filter backend run` entry point already puts
# us here; this makes the script say so rather than depend on it.
cd "$BACKEND_DIR"

export NODE_OPTIONS="--dns-result-order=ipv4first"

echo "==> Decrypting DIRECT_DATABASE_URL from .env..."
DATABASE_URL=$(dotenvx get DIRECT_DATABASE_URL -f "$REPO_ROOT/.env")

echo "==> Dropping public and drizzle schemas..."
node -e "
const pg = require('pg');
const client = new pg.Client('$DATABASE_URL');
client.connect().then(async () => {
  await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO postgres');
  await client.query('GRANT ALL ON SCHEMA public TO public');
  console.log('Schemas reset complete');
  await client.end();
}).catch(e => { console.error(e); process.exit(1); });
"

echo "==> Running migrations..."
MIGRATING=true dotenvx run -f "$REPO_ROOT/.env" -- pnpm run db:migrate

echo "==> Seeding providers..."
MIGRATING=true dotenvx run -f "$REPO_ROOT/.env" -- tsx scripts/seed-providers.ts

echo "==> Seeding dev data (uploading seed images to $(dotenvx get S3_BUCKET -f "$REPO_ROOT/.env"))..."
MIGRATING=true FILE_PROVIDER=s3 dotenvx run -f "$REPO_ROOT/.env" -- tsx scripts/seed-dev.ts

echo "==> Done! Staging database restored."
