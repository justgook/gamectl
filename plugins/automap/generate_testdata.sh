#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$REPO_ROOT/build/automap-fixtures}"
REQUEST_FILE="$BUILD_DIR/request.json"
STATUS_FILE="$BUILD_DIR/status.json"
TILED_BIN="/Applications/Tiled.app/Contents/MacOS/Tiled"

if [[ ! -x "$TILED_BIN" ]]; then
  printf 'Tiled executable not found at %s\n' "$TILED_BIN" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
rm -f "$REQUEST_FILE" "$STATUS_FILE"

cases=()
if [[ $# -eq 0 ]]; then
  cases=("rules" "new_rules")
else
  cases=("$@")
fi

json='{"cases":['
for i in "${!cases[@]}"; do
  if [[ "$i" -gt 0 ]]; then
    json+=','
  fi
  json+="\"${cases[$i]}\""
done
json+=']}\n'
printf '%b' "$json" > "$REQUEST_FILE"

"$TILED_BIN" --new-instance >/dev/null 2>&1 &

printf 'Waiting for Tiled to regenerate automap fixtures...\n'
for _ in $(seq 1 240); do
  if [[ -f "$STATUS_FILE" ]]; then
    if grep -q '"ok": true' "$STATUS_FILE"; then
      printf 'Automap fixtures regenerated successfully.\n'
      exit 0
    fi
    printf 'Automap fixture generation failed:\n' >&2
    sed 's/^/  /' "$STATUS_FILE" >&2
    exit 1
  fi
  sleep 1
done

printf 'Timed out waiting for Tiled fixture generation.\n' >&2
printf 'Check Tiled and %s for details.\n' "$BUILD_DIR" >&2
exit 1
