#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
NG_DIR="$ROOT/plugins/ng3"
LUA_DIR="$NG_DIR/vendor/lua"
OBJ_DIR="$NG_DIR/build/lua-modern"
LIB_A="$NG_DIR/build/lua54-wasi-modern.a"
LIB_O="$NG_DIR/build/lua54-wasi-modern.o"

mkdir -p "$OBJ_DIR"

sources=(
  lapi.c
  lauxlib.c
  lbaselib.c
  lcode.c
  lcorolib.c
  lctype.c
  ldblib.c
  ldebug.c
  ldo.c
  ldump.c
  lfunc.c
  lgc.c
  llex.c
  lmathlib.c
  lmem.c
  lobject.c
  lopcodes.c
  lparser.c
  lstate.c
  lstring.c
  lstrlib.c
  ltable.c
  ltablib.c
  ltm.c
  lundump.c
  lutf8lib.c
  lvm.c
  lzio.c
)

for src in "${sources[@]}"; do
  obj="$OBJ_DIR/${src%.c}.o"
  zig cc -target wasm32-wasi \
    -O2 -Dl_signalT=int -I"$LUA_DIR" \
    -mexception-handling \
    -mmultivalue \
    -mreference-types \
    -mllvm -wasm-enable-sjlj \
    -mllvm -wasm-use-legacy-eh=false \
    -c "$LUA_DIR/$src" -o "$obj"
done

rm -f "$LIB_A" "$LIB_O"
zig ar rcs "$LIB_A" "$OBJ_DIR"/*.o
wasm-ld -r -o "$LIB_O" "$OBJ_DIR"/*.o

printf 'built %s\n' "$LIB_A"
printf 'built %s\n' "$LIB_O"
