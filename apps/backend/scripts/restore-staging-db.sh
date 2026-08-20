#!/usr/bin/env bash
set -euo pipefail

# Restore the staging database: drop all schemas, re-migrate, seed providers, seed dev data.
# Usage: npm run --workspace=backend db:restore:staging

REPO_ROOT="$(cd "$(dirname "$0")/../../../" && pwd)"
BACKEND_DIR="$REPO_ROOT/apps/backend"

export NODE_OPTIONS="--dns-result-order=ipv4first"

echo "==> Decrypting DIRECT_DATABASE_URL from .env..."
DATABASE_URL=$(npx dotenvx get DIRECT_DATABASE_URL -f "$REPO_ROOT/.env")

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
MIGRATING=true npx dotenvx run -f "$REPO_ROOT/.env" -- npm run --workspace=backend db:migrate

echo "==> Seeding providers..."
MIGRATING=true npx dotenvx run -f "$REPO_ROOT/.env" -- npx -w backend tsx scripts/seed-providers.ts

echo "==> Seeding dev data..."
MIGRATING=true npx dotenvx run -f "$REPO_ROOT/.env" -- npx -w backend tsx scripts/seed-dev.ts

echo "==> Done! Staging database restored."
