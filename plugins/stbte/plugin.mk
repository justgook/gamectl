PLUGIN_ZIG_WASM_TARGET := wasm32-freestanding
PLUGIN_ZIG_MCPU := generic+atomics+bulk_memory
PLUGIN_ZIG_OPT := ReleaseSmall
PLUGIN_ZIG_EXTRA_FLAGS := -fstrip --import-memory --shared-memory --initial-memory=25165824 --max-memory=33554432
