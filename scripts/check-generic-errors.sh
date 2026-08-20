#!/usr/bin/env bash
# Ensures backend code throws AppError instead of generic Error.
# Infrastructure and test files are excluded — they may legitimately use generic Error.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Colors
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

SEARCH_DIR="$REPO_ROOT/apps/backend/src"

# Files/directories that may legitimately throw generic Error
EXCLUDED_PATTERNS=(
  "__tests__/"
  "env.ts"
  "core/config/"
  "core/db/"
  "core/utils/abstract-"
  "/loaders/"
)

violations=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  rel="${file#"$REPO_ROOT/"}"

  skip=false
  for pattern in "${EXCLUDED_PATTERNS[@]}"; do
    if [[ "$rel" == *"$pattern"* ]]; then
      skip=true
      break
    fi
  done
  $skip && continue

  while IFS=: read -r lineno line; do
    if [[ $violations -eq 0 ]]; then
      echo ""
      echo -e "${RED}${BOLD}check-generic-errors${RESET} ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
      echo ""
      echo -e "  ${RED}✖${RESET} Do not throw generic ${YELLOW}Error${RESET} in backend code."
      echo -e "    Use ${CYAN}AppError${RESET} from ${CYAN}core/errors/app-error.ts${RESET} instead."
      echo ""
    fi
    highlighted=$(echo "$line" | sed \
      -e "s/throw new Error/$(printf "${RED}${BOLD}")throw new Error$(printf "${RESET}")/g")
    echo -e "  ${DIM}${rel}:${lineno}${RESET}"
    echo -e "    ${highlighted}"
    echo ""
    violations=$((violations + 1))
  done < <(grep -n 'throw new Error(' "$file")
done < <(grep -rl 'throw new Error(' \
  "$SEARCH_DIR" \
  --include='*.ts' --include='*.tsx' 2>/dev/null || true)

if [[ $violations -gt 0 ]]; then
  echo -e "  Found ${RED}${violations}${RESET} violation(s)."
  echo ""
  exit 1
fi

echo -e "${GREEN}✔${RESET} No generic Error throws in backend code."
