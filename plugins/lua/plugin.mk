PLUGIN_ZIG_WASM_TARGET := wasm32-wasi
PLUGIN_ZIG_C_COMPILER := cc
PLUGIN_ZIG_MCPU := lime1

LUA_BUILD_DIR := $(PLUGIN_DIR)/lua/build
LUA_MODERN_A := $(LUA_BUILD_DIR)/lua54-wasi-modern.a
LUA_MODERN_O := $(LUA_BUILD_DIR)/lua54-wasi-modern.o
LUA_MAIN_O := $(LUA_BUILD_DIR)/main.o
LUA_WASM_SETJMP_SHIM_O := $(LUA_BUILD_DIR)/wasm_setjmp_shim.o
LUA_PLUGIN_ALL_O := $(LUA_BUILD_DIR)/lua_plugin_all.o
LUA_DIR := $(PLUGIN_DIR)/lua/vendor/lua

PLUGIN_C_SOURCES := \
  $(LUA_PLUGIN_ALL_O)

PLUGIN_CFLAGS := \
  -O2 \
  -Dl_signalT=int \
  -I$(LUA_DIR) \
  -I$(PLUGIN_DIR)/sql/vendor

PLUGIN_ZIG_EXTRA_FLAGS :=

PLUGIN_LDFLAGS := \
  -Wl,--no-entry \
  -Wl,--export-memory \
  -Wl,--export-table \
  -Wl,--export=__heap_base \
  -Wl,--export=init \
  -Wl,--export=run

PLUGIN_EXTRA_DEPS := \
  $(PLUGIN_DIR)/lua/scripts/build-lua-modern.sh \
  $(PLUGIN_DIR)/lua/main.c \
  $(PLUGIN_DIR)/lua/shim/wasm_setjmp_shim.c \
  $(wildcard $(PLUGIN_DIR)/lua/shim/*.h) \
  $(LUA_MAIN_O) \
  $(LUA_WASM_SETJMP_SHIM_O) \
  $(LUA_PLUGIN_ALL_O) \
  $(LUA_MODERN_O) \
  $(LUA_MODERN_A) \
  $(wildcard $(LUA_DIR)/*.h)

$(LUA_BUILD_DIR):
	$(Q)mkdir -p $@

$(LUA_MAIN_O): $(PLUGIN_DIR)/lua/main.c $(PLUGIN_DIR)/lua/jsmn.h $(wildcard $(LUA_DIR)/*.h) | $(LUA_BUILD_DIR)
	$(Q)zig cc -target wasm32-wasi -O2 -Dl_signalT=int -I$(LUA_DIR) -I$(PLUGIN_DIR)/sql/vendor -c $< -o $@

$(LUA_WASM_SETJMP_SHIM_O): $(PLUGIN_DIR)/lua/shim/wasm_setjmp_shim.c | $(LUA_BUILD_DIR)
	$(Q)zig cc -target wasm32-wasi -O2 -c $< -o $@

$(LUA_PLUGIN_ALL_O): $(LUA_MAIN_O) $(LUA_WASM_SETJMP_SHIM_O) $(LUA_MODERN_O) | $(LUA_BUILD_DIR)
	$(Q)wasm-ld -r -o $@ $(LUA_MAIN_O) $(LUA_WASM_SETJMP_SHIM_O) $(LUA_MODERN_O)

$(LUA_MODERN_A) $(LUA_MODERN_O): $(PLUGIN_DIR)/lua/scripts/build-lua-modern.sh $(wildcard $(LUA_DIR)/*.c) $(wildcard $(LUA_DIR)/*.h) | $(LUA_BUILD_DIR)
	$(Q)bash ./plugins/lua/scripts/build-lua-modern.sh
