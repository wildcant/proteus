#!/usr/bin/env bash
#
# Take a dirty local stack back to a working seeded one, in one command.
#
#   npm run --workspace=backend stack:reset
#
# `db:restart` is the smaller hammer and the usual one: it drops and recreates `proteus` only, so
# workflow history survives. This is the bigger one — `down -v` destroys the volume, which takes the
# `temporal` and `temporal_visibility` databases with it. `temporal-schema` recreates and migrates
# them from empty on the next boot, which is the supported way to get a clean Temporal: nothing here
# is deployed, so there is no history worth migrating forward.
#
# Reach for it when Temporal's own databases are the problem — a half-applied schema, a server that
# will not come up, or a version change like the auto-setup → server + admin-tools move.
#
# Postgres comes up alone first, ahead of the rest of the stack, because the `worker` service
# connects to `proteus` at boot and exits if the tables are not there yet. On an empty volume they
# are not: migrations are this script's third step, not Docker's. Everything else — Temporal's
# schema and the `default` namespace included — is created by the compose stack itself.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Destroying the compose stack and its volume (proteus, temporal, temporal_visibility)"
docker compose down -v

echo "==> Starting Postgres on an empty volume"
docker compose up -d --wait postgres

echo "==> Migrating proteus"
npm run db:migrate:dev

echo "==> Seeding proteus"
npm run db:seed:dev

echo "==> Starting the rest of the stack; temporal-schema rebuilds Temporal's databases from empty"
npm run db:start

echo "==> Stack reset. Temporal UI on http://localhost:8088, frontend on localhost:7233"
