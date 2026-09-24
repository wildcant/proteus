#!/usr/bin/env bash
# The one Lingui watcher of a dev session: backend recompiles `locales/*.ts`, store re-extracts its
# `.po`. Its own process rather than part of each app's dev script, because four backend processes
# share one compiled catalog and it must have exactly one writer.
#
# Teardown is the reason this is a script rather than `pnpm --parallel`: pnpm does not forward
# SIGTERM, so terminating it leaves both `lingui --watch` processes running. `set -m` gives each
# watcher a process group of its own, and the trap signals the whole group — pnpm, lingui and the
# subcommand lingui spawns — on INT, TERM, HUP, or either watcher exiting.

set -uo pipefail
set -m

cd "$(dirname "$0")/.."

pgids=()

stop() {
  trap - INT TERM HUP EXIT
  for pgid in ${pgids[@]+"${pgids[@]}"}; do
    kill -TERM -- "-$pgid" 2>/dev/null
  done
  wait
}
trap stop INT TERM HUP EXIT

pnpm --silent --filter backend run i18n:watch &
pgids+=($!)
pnpm --silent --filter store run i18n:watch &
pgids+=($!)

# Either watcher dying ends the session, so a pane that looks alive is never watching half the
# catalogs. A poll rather than `wait -n`, which the bash macOS ships (3.2) does not have.
while kill -0 "${pgids[0]}" 2>/dev/null && kill -0 "${pgids[1]}" 2>/dev/null; do
  sleep 1
done
