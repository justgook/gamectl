#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  script/combine-animation-folders-to-aseprite.sh INPUT_DIR [OUTPUT.aseprite]

Combines animation frame folders into one Aseprite document. Each immediate
animation folder must have a matching "_normal" folder:

  INPUT_DIR/Idle/metadata.json
  INPUT_DIR/Idle/keyframe_0000.png
  INPUT_DIR/Idle_normal/keyframe_0000.png

Animations are appended in alphabetical order. The output contains a visible
"normal" bottom layer, a visible "color" top layer, and one forward tag per
animation. Frame order and duration come from each color folder's metadata.json.

Examples:
  script/combine-animation-folders-to-aseprite.sh examples/demo/tmp/anim/c11
  script/combine-animation-folders-to-aseprite.sh examples/demo/tmp/anim/c11 tmp/c11.aseprite

Environment:
  ASEPRITE=/path/to/aseprite   Override Aseprite executable.
USAGE
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 2
fi

input_dir=${1%/}
output=${2:-"${input_dir}.aseprite"}

[[ -d "$input_dir" ]] || { echo "input directory not found: $input_dir" >&2; exit 1; }
[[ "$input_dir" != *$'\t'* && "$input_dir" != *$'\n'* ]] || { echo "input path cannot contain tabs or newlines" >&2; exit 2; }
[[ "$output" != *$'\t'* && "$output" != *$'\n'* ]] || { echo "output path cannot contain tabs or newlines" >&2; exit 2; }

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
lua_script="$script_dir/combine-animation-folders-to-aseprite.lua"
[[ -f "$lua_script" ]] || { echo "Lua script not found: $lua_script" >&2; exit 1; }

manifest=$(mktemp)
trap 'rm -f "$manifest"' EXIT

found=0
while IFS= read -r -d '' color_dir; do
  name=$(basename "$color_dir")
  [[ "$name" == *_normal ]] && continue
  [[ "$name" != *$'\t'* && "$name" != *$'\n'* ]] || { echo "animation folder name cannot contain tabs or newlines: $name" >&2; exit 1; }

  found=1
  normal_dir="${color_dir}_normal"
  metadata="$color_dir/metadata.json"
  [[ -d "$normal_dir" ]] || { echo "missing normal folder for animation $name: $normal_dir" >&2; exit 1; }
  [[ -f "$metadata" ]] || { echo "missing color metadata for animation $name: $metadata" >&2; exit 1; }
  printf '%s\t%s\t%s\t%s\n' "$name" "$color_dir" "$normal_dir" "$metadata" >> "$manifest"
done < <(LC_ALL=C find "$input_dir" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -print0 | LC_ALL=C sort -z)

[[ $found -eq 1 ]] || { echo "no animation folders found in $input_dir" >&2; exit 1; }

while IFS= read -r -d '' normal_dir; do
  name=$(basename "$normal_dir")
  [[ "$name" == *_normal ]] || continue
  color_name=${name%_normal}
  [[ -n "$color_name" && -d "$input_dir/$color_name" ]] || { echo "orphan normal folder: $normal_dir" >&2; exit 1; }
done < <(LC_ALL=C find "$input_dir" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -print0 | LC_ALL=C sort -z)

mkdir -p "$(dirname "$output")"
"$aseprite_bin" \
  --batch \
  --script-param "manifest=$manifest" \
  --script-param "output=$output" \
  --script "$lua_script"
