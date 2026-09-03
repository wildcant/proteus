#!/usr/bin/env bash
# Ensures http-schemas uses dateToIso instead of z.string().datetime() or z.iso.datetime() directly.
# The dateToIso pipeline in common.ts is the single source of truth for datetime serialization.

set -euo pipefail

# Self-locating, so the check behaves the same from the workspace, the repo root, or
# `npm run --workspace=...`. Violations still print repo-relative paths: `src/foo.ts` alone
# would not say which workspace it is in.
WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$WORKSPACE/../.." && pwd)"

# Colors
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

SEARCH_DIR="$WORKSPACE/src"

# The one file that defines dateToIso itself
ALLOWED_FILES=(
  "packages/http-schemas/src/common.ts"
)

violations=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  rel="${file#"$REPO_ROOT/"}"

  skip=false
  for allowed in "${ALLOWED_FILES[@]}"; do
    if [[ "$rel" == "$allowed" ]]; then
      skip=true
      break
    fi
  done
  $skip && continue

  while IFS=: read -r lineno line; do
    if [[ $violations -eq 0 ]]; then
      echo ""
      echo -e "${RED}${BOLD}check-datetime-schema${RESET} ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
      echo ""
      echo -e "  ${RED}✖${RESET} Do not use ${YELLOW}.datetime()${RESET} directly in http-schemas."
      echo -e "    Import ${CYAN}dateToIso${RESET} from ${CYAN}common.ts${RESET} instead."
      echo ""
    fi
    highlighted=$(echo "$line" | sed \
      -e "s/\.datetime/$(printf "${RED}${BOLD}").datetime$(printf "${RESET}")/g")
    echo -e "  ${DIM}${rel}:${lineno}${RESET}"
    echo -e "    ${highlighted}"
    echo ""
    violations=$((violations + 1))
  done < <(grep -n '\.datetime(' "$file")
done < <(grep -rl '\.datetime(' \
  "$SEARCH_DIR" \
  --include='*.ts' 2>/dev/null || true)

if [[ $violations -gt 0 ]]; then
  echo -e "  Found ${RED}${violations}${RESET} violation(s)."
  echo ""
  exit 1
fi

echo -e "${GREEN}✔${RESET} No direct .datetime() usage in http-schemas — dateToIso is used consistently."
