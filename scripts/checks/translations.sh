#!/usr/bin/env bash
# Every workspace with a lingui.config.ts owns one catalog, and three mistakes leave it wrong while
# every other gate stays green. Each is asked of the committed files, and each one's writes are put
# back before the next, so the three answers are independent and the tree ends as it started:
#
#   - a message marked with `i18n.t('…')` but never extracted — `lingui extract --clean`, then fail
#     if any catalog moved. `--clean` makes a reworded sentence's old id count as drift too. This is
#     the only row that sees it: `compile --strict` passes a message that no catalog contains;
#   - a compiled catalog older than its `.po` — `lingui compile`, then fail if a compiled file that
#     is committed changed. Compiled files the workspace does not commit (the store loads `.po`
#     through Vite) are not compared, only removed again;
#   - a message extracted but never translated — `--strict` fails the compile on a blank `msgstr`.
#
# A workspace is found by its config file rather than listed here, so a new catalog is gated the
# day it is added. Only its `locales` directories are snapshotted: that is where every config in
# this repo writes, and a catalog path elsewhere would be missed rather than corrupted.
#
# Writes in place, so it must not run alongside anything that reads the catalogs — verify.sh runs it
# alone, before the parallel batch. Prints one line per finding and exits 1 if there was any.

set -uo pipefail

cd "$(dirname "$0")/../.."

drift=""
locales_dirs() { find "$1" -path '*/node_modules' -prune -o -type d -name locales -print; }
# Delete before restoring, as verify.sh's regenerate_check does, so a file the tool added is not left
# behind.
restore_locales() {
  local snapshot=$1
  shift
  rm -rf "$@"
  tar cf - -C "$snapshot" . | tar xf -
}

while IFS= read -r config; do
  dir="$(dirname "$config")"
  dirs="$(locales_dirs "$dir")"
  snapshot="$(mktemp -d)"
  # shellcheck disable=SC2086 # one path per line, none with spaces
  [ -n "$dirs" ] && tar cf - $dirs | (cd "$snapshot" && tar xf -)

  if ! output="$(pnpm --silent --filter "./$dir" exec lingui extract --clean 2>&1)"; then
    drift="${drift}${dir}: \`lingui extract\` failed"$'\n'"${output}"$'\n'
  else
    dirs="$(locales_dirs "$dir")"
    # shellcheck disable=SC2086
    for file in $(cd "$snapshot" && find . -type f -name '*.po') $(find $dirs -type f -name '*.po'); do
      file="${file#./}"
      if ! cmp -s "$snapshot/$file" "$file"; then
        drift="${drift}${dir}: a marked message is not in its catalog — run \`pnpm --filter ./${dir} exec lingui extract --clean\` and commit the result"$'\n'
        break
      fi
    done
  fi
  # shellcheck disable=SC2086
  restore_locales "$snapshot" $dirs
  dirs="$(locales_dirs "$dir")"

  if ! output="$(pnpm --silent --filter "./$dir" exec lingui compile --typescript --strict 2>&1)"; then
    drift="${drift}${dir}: \`lingui compile --strict\` failed — translate every blank msgstr"$'\n'"${output}"$'\n'
  else
    for file in $(cd "$snapshot" && find . -type f ! -name '*.po'); do
      file="${file#./}"
      if ! cmp -s "$snapshot/$file" "$file"; then
        drift="${drift}${dir}: ${file} is stale — run \`pnpm --filter ./${dir} exec lingui compile --typescript\` and commit the result"$'\n'
      fi
    done
  fi
  # shellcheck disable=SC2086
  restore_locales "$snapshot" $dirs
  rm -rf "$snapshot"
done < <(find apps packages -path '*/node_modules' -prune -o -name lingui.config.ts -print)

[ -z "$drift" ] && exit 0
printf '%s' "$drift"
exit 1
