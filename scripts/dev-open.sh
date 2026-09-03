#!/usr/bin/env bash
# Opens the three dev URLs in the default browser, once each server actually answers.
#
# The waiting is the whole point. `dev` starts four servers concurrently and Vite needs a few
# seconds to bind, so opening the URLs when the task fires lands on connection-refused pages that
# do not recover on their own — the browser keeps the failed load until someone reloads by hand.
# Polling until the port answers costs nothing and removes that entirely.
#
# Nothing in here is allowed to fail the `dev` task. A browser tab is a convenience, and a server
# that never came up is already reported by its own pane; failing here would only add a second,
# less informative error on top of the real one.

set -uo pipefail

# Temporal's UI is 8088 on the host and 8080 inside the container — the host port is the one to open.
readonly TARGETS=(
  "store|http://localhost:3001"
  "admin|http://localhost:3002"
  "temporal-ui|http://localhost:8088"
)

# Vite is the slow one, and a cold TanStack Router route generation can push it past 20s on a first
# run after `npm install`. Sixty one-second attempts is far more headroom than that needs and still
# bounded, so a genuinely dead server gives up rather than hanging the task forever.
readonly ATTEMPTS="${DEV_OPEN_ATTEMPTS:-60}"

open_when_ready() {
  local name="$1" url="$2"

  for ((i = 0; i < ATTEMPTS; i++)); do
    if curl --silent --fail --output /dev/null --max-time 2 "$url"; then
      open "$url"
      return 0
    fi
    sleep 1
  done

  echo "[dev-open] $name never answered at $url after ${ATTEMPTS}s — check its pane" >&2
}

# Sequential, so the tabs land in a predictable left-to-right order rather than in whatever order
# the servers happen to finish booting. It costs no wall-clock: all four panes started together, so
# by the time the slowest URL answers the others have long since been ready and their checks return
# on the first attempt.
for target in "${TARGETS[@]}"; do
  open_when_ready "${target%%|*}" "${target#*|}"
done
