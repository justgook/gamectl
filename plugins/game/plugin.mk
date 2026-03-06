PLUGIN_C_SOURCES := \
	plugins/game/web/main.c \
	plugins/game/web/asset_io_web.c \
	plugins/game/main.c

PLUGIN_CFLAGS := \
  -I plugins/game/web/wasm-include
