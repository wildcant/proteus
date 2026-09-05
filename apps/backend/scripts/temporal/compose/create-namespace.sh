#!/bin/sh
#
# Vendored from temporalio/samples-server:
# https://github.com/temporalio/samples-server/blob/main/compose/scripts/create-namespace.sh
#
# Runs once, in `temporalio/admin-tools`, after the server's port opens — waits for the cluster to
# report healthy, then describes-or-creates the `default` namespace. `temporalio/server` does not
# register it; a clean boot has only `temporal-system`, and every client here connects to `default`.
#
# LOCAL DEVIATION — one character, do not lose it on a re-sync:
#   upstream reads `MAX_ATTdMPTS` (lowercase `d`) in the namespace-retry branch below. Under this
#   script's own `set -eu` an unset variable is a fatal error, so exhausting the retries kills the
#   script with "MAX_ATTdMPTS: parameter not set" instead of the message it meant to print. Fixed to
#   MAX_ATTEMPTS here. Re-syncing from upstream reintroduces it unless this is reapplied.
set -eu

NAMESPACE=${DEFAULT_NAMESPACE:-default}
TEMPORAL_ADDRESS=${TEMPORAL_ADDRESS:-temporal:7233}
MAX_ATTEMPTS=${TEMPORAL_HEALTH_CHECK_MAX_ATTEMPTS:-30}
SLEEP_SECONDS=${TEMPORAL_HEALTH_CHECK_SLEEP_SECONDS:-5}

echo "Waiting for Temporal server port to be available..."
SERVER_HOST=$(echo "$TEMPORAL_ADDRESS" | cut -d: -f1)
SERVER_PORT=$(echo "$TEMPORAL_ADDRESS" | cut -d: -f2)
attempt=1
while ! nc -z -w 10 "$SERVER_HOST" "$SERVER_PORT"; do
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Temporal server port did not become available after $MAX_ATTEMPTS attempts"
    exit 1
  fi

  echo "Temporal server port not ready yet, waiting... (attempt $attempt/$MAX_ATTEMPTS)"
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done
echo 'Temporal server port is available'

echo 'Waiting for Temporal server to be healthy...'
attempt=1

while :; do
  if temporal operator cluster health --address "$TEMPORAL_ADDRESS"; then
    break
  fi

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Server did not become healthy after $MAX_ATTEMPTS attempts"
    exit 1
  fi

  echo "Server not ready yet, waiting... (attempt $attempt/$MAX_ATTEMPTS)"
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done

echo "Server is healthy, creating namespace '$NAMESPACE'..."

attempt=1
while :; do
  if temporal operator namespace describe -n "$NAMESPACE" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
    echo "Namespace '$NAMESPACE' already exists"
    break
  fi

  if temporal operator namespace create -n "$NAMESPACE" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
    echo "Namespace '$NAMESPACE' created"
    break
  fi

  # Local fix: upstream has `MAX_ATTdMPTS` here. See the header.
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "Failed to create namespace '$NAMESPACE' after $MAX_ATTEMPTS attempts"
    exit 1
  fi

  echo "Namespace operation not ready yet, waiting... (attempt $attempt/$MAX_ATTEMPTS)"
  attempt=$((attempt + 1))
  sleep "$SLEEP_SECONDS"
done
