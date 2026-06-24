#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  script/combine-spritesheets-to-aseprite.sh INPUT_DIR FRAME_WIDTH [OUTPUT.aseprite]

Options:
  --frame-height N   Crop each source frame to this height. Default: each sheet's full height.
  --duration SEC     Aseprite frame duration in seconds. Default: 0.1

Examples:
  script/combine-spritesheets-to-aseprite.sh tmp/player2/Animations 128 tmp/player2/player2.aseprite
  script/combine-spritesheets-to-aseprite.sh tmp/player2/Animations 128 --duration 0.08

Environment:
  ASEPRITE=/path/to/aseprite   Override Aseprite executable.
USAGE
}

if [[ $# -lt 2 ]]; then
  usage >&2
  exit 2
fi

input_dir=$1
frame_width=$2
shift 2

output=""
frame_height=""
duration="0.1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --frame-height)
      [[ $# -ge 2 ]] || { echo "missing value for --frame-height" >&2; exit 2; }
      frame_height=$2
      shift 2
      ;;
    --duration)
      [[ $# -ge 2 ]] || { echo "missing value for --duration" >&2; exit 2; }
      duration=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "unknown option: $1" >&2
      exit 2
      ;;
    *)
      if [[ -n "$output" ]]; then
        echo "unexpected extra argument: $1" >&2
        exit 2
      fi
      output=$1
      shift
      ;;
  esac
done

[[ -d "$input_dir" ]] || { echo "input directory not found: $input_dir" >&2; exit 1; }
[[ "$frame_width" =~ ^[0-9]+$ ]] && (( frame_width > 0 )) || { echo "FRAME_WIDTH must be a positive integer" >&2; exit 2; }
if [[ -n "$frame_height" ]]; then
  [[ "$frame_height" =~ ^[0-9]+$ ]] && (( frame_height > 0 )) || { echo "--frame-height must be a positive integer" >&2; exit 2; }
fi

if [[ -z "$output" ]]; then
  output="${input_dir%/}.aseprite"
fi
mkdir -p "$(dirname "$output")"

if [[ -n "${ASEPRITE:-}" ]]; then
  aseprite_bin=$ASEPRITE
elif command -v aseprite >/dev/null 2>&1; then
  aseprite_bin=$(command -v aseprite)
elif [[ -x /Applications/Aseprite.app/Contents/MacOS/aseprite ]]; then
  aseprite_bin=/Applications/Aseprite.app/Contents/MacOS/aseprite
else
  echo "Aseprite CLI not found. Set ASEPRITE=/path/to/aseprite." >&2
  exit 1
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
lua_script="$script_dir/combine-spritesheets-to-aseprite.lua"
[[ -f "$lua_script" ]] || { echo "Lua script not found: $lua_script" >&2; exit 1; }

manifest=$(mktemp)
trap 'rm -f "$manifest"' EXIT

found=0
while IFS= read -r -d '' file; do
  found=1
  base=$(basename "$file")
  tag=${base%.*}
  printf '%s\t%s\n' "$file" "$tag" >> "$manifest"
done < <(find "$input_dir" -maxdepth 1 -type f -iname '*.png' -print0 | sort -z)

if [[ $found -eq 0 ]]; then
  echo "no PNG files found in $input_dir" >&2
  exit 1
fi

params=(
  --batch
  --script-param "manifest=$manifest"
  --script-param "output=$output"
  --script-param "frame_width=$frame_width"
  --script-param "duration=$duration"
)
if [[ -n "$frame_height" ]]; then
  params+=(--script-param "frame_height=$frame_height")
fi
params+=(--script "$lua_script")

"$aseprite_bin" "${params[@]}"
