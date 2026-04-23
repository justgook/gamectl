PLUGIN_ZIG_WASM_TARGET := wasm32-wasi
PLUGIN_ZIG_C_COMPILER := cc
PLUGIN_ZIG_MCPU := lime1

LUA_BUILD_DIR := $(PLUGIN_DIR)/lua/build
LUA_MODERN_A := $(LUA_BUILD_DIR)/lua54-wasi-modern.a
LUA_MODERN_O := $(LUA_BUILD_DIR)/lua54-wasi-modern.o
LUA_DIR := $(PLUGIN_DIR)/lua/vendor/lua

PLUGIN_C_SOURCES := \
  $(PLUGIN_DIR)/lua/main.c \
  $(LUA_MODERN_O)

PLUGIN_CFLAGS := \
  -O2 \
  -Dl_signalT=int \
  -I$(LUA_DIR) \
  -I$(PLUGIN_DIR)/sql/vendor

PLUGIN_ZIG_EXTRA_FLAGS := \
  -mexception-handling \
  -mmultivalue \
  -mreference-types \
  -mllvm -wasm-enable-sjlj \
  -mllvm -wasm-use-legacy-eh=false

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
  $(LUA_MODERN_O) \
  $(LUA_MODERN_A) \
  $(wildcard $(LUA_DIR)/*.h)

$(LUA_MODERN_A) $(LUA_MODERN_O): $(PLUGIN_DIR)/lua/scripts/build-lua-modern.sh $(wildcard $(LUA_DIR)/*.c) $(wildcard $(LUA_DIR)/*.h)
	$(Q)bash ./plugins/lua/scripts/build-lua-modern.sh
