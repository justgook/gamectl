PLUGIN_ZIG_WASM_TARGET := wasm32-wasi
PLUGIN_ZIG_C_COMPILER := cc
PLUGIN_ZIG_MCPU := lime1

NG_BUILD_DIR := $(PLUGIN_DIR)/ng/build
NG_LUA_MODERN_A := $(NG_BUILD_DIR)/lua54-wasi-modern.a
NG_LUA_MODERN_O := $(NG_BUILD_DIR)/lua54-wasi-modern.o

NG_LUA_DIR := $(PLUGIN_DIR)/ng/vendor/lua
NG_LUA_SRCS := \
  $(NG_LUA_DIR)/lapi.c \
  $(NG_LUA_DIR)/lcode.c \
  $(NG_LUA_DIR)/lctype.c \
  $(NG_LUA_DIR)/ldebug.c \
  $(NG_LUA_DIR)/ldo.c \
  $(NG_LUA_DIR)/ldump.c \
  $(NG_LUA_DIR)/lfunc.c \
  $(NG_LUA_DIR)/lgc.c \
  $(NG_LUA_DIR)/llex.c \
  $(NG_LUA_DIR)/lmem.c \
  $(NG_LUA_DIR)/lobject.c \
  $(NG_LUA_DIR)/lopcodes.c \
  $(NG_LUA_DIR)/lparser.c \
  $(NG_LUA_DIR)/lstate.c \
  $(NG_LUA_DIR)/lstring.c \
  $(NG_LUA_DIR)/ltable.c \
  $(NG_LUA_DIR)/ltm.c \
  $(NG_LUA_DIR)/lundump.c \
  $(NG_LUA_DIR)/lvm.c \
  $(NG_LUA_DIR)/lzio.c \
  $(NG_LUA_DIR)/lauxlib.c \
  $(NG_LUA_DIR)/lbaselib.c \
  $(NG_LUA_DIR)/lmathlib.c \
  $(NG_LUA_DIR)/lstrlib.c \
  $(NG_LUA_DIR)/ltablib.c \
  $(NG_LUA_DIR)/lutf8lib.c

PLUGIN_C_SOURCES := \
  $(PLUGIN_DIR)/ng/main.c \
  $(NG_LUA_SRCS)

PLUGIN_CFLAGS := \
  -O2 \
  -Dl_signalT=int \
  -DNG_LUA_NO_UNWIND \
  -I$(NG_LUA_DIR)

PLUGIN_LDFLAGS := \
  -Wl,--no-entry \
  -Wl,--export-memory \
  -Wl,--export-table \
  -Wl,--export=ng_init \
  -Wl,--export=ng_get_info_ptr \
  -Wl,--export=ng_clear_graph \
  -Wl,--export=ng_node_create \
  -Wl,--export=ng_node_replace \
  -Wl,--export=ng_node_delete \
  -Wl,--export=ng_input_add \
  -Wl,--export=ng_input_remove \
  -Wl,--export=ng_output_add \
  -Wl,--export=ng_output_remove \
  -Wl,--export=ng_input_connect \
  -Wl,--export=ng_input_disconnect \
  -Wl,--export=ng_node_set_arg \
  -Wl,--export=ng_run_all_goals \
  -Wl,--export=ng_run_goal \
  -Wl,--export=ng_run_start \
  -Wl,--export=ng_run_response \
  -Wl,--export=ng_run_cancel \
  -Wl,--export=ng_exec_clear \
  -Wl,--export=ng_exec_clear_all \
	-Wl,--export=ng_get_last_error \
	-Wl,--export=ng_get_io_ptr \
	-Wl,--export=ng_get_io_len \
	-Wl,--export=ng_get_node_exec_state \
	-Wl,--export=run

PLUGIN_EXTRA_DEPS := \
  $(PLUGIN_DIR)/ng/scripts/build-lua-modern.sh \
  $(PLUGIN_DIR)/ng/ng.h \
  $(NG_LUA_SRCS) \
  $(wildcard $(PLUGIN_DIR)/ng/shim/*.h) \
  $(wildcard $(NG_LUA_DIR)/*.h)
