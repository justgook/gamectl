PLUGIN_ZIG_WASM_TARGET := wasm32-wasi
PLUGIN_ZIG_C_COMPILER := cc
PLUGIN_ZIG_MCPU := lime1

NG_BUILD_DIR := $(PLUGIN_DIR)/ng3/build
NG_LUA_MODERN_A := $(NG_BUILD_DIR)/lua54-wasi-modern.a
NG_LUA_MODERN_O := $(NG_BUILD_DIR)/lua54-wasi-modern.o

NG_LUA_DIR := $(PLUGIN_DIR)/ng3/vendor/lua

PLUGIN_C_SOURCES := \
  $(PLUGIN_DIR)/ng3/main.c \
  $(PLUGIN_DIR)/ng3/shim/wasm_setjmp_shim.c \
  $(NG_LUA_MODERN_O)

PLUGIN_CFLAGS := \
  -O2 \
  -Dl_signalT=int \
  -I$(NG_LUA_DIR)

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
  -Wl,--export=__sql_init \
  -Wl,--export=ng_handle_create \
  -Wl,--export=ng_handle_close \
  -Wl,--export=ng_get_info_size \
  -Wl,--export=ng_graph_open \
  -Wl,--export=ng_graph_save \
  -Wl,--export=ng_graph_list \
  -Wl,--export=ng_graph_delete \
  -Wl,--export=ng_run \
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
  -Wl,--export=ng_run_cancel \
  -Wl,--export=ng_exec_clear \
  -Wl,--export=ng_exec_clear_all \
	-Wl,--export=ng_get_last_error \
	-Wl,--export=ng_get_io_ptr \
	-Wl,--export=ng_get_io_len \
	-Wl,--export=ng_io_clear \
	-Wl,--export=ng_get_node_exec_state \
	-Wl,--export=run

PLUGIN_EXTRA_DEPS := \
  $(PLUGIN_DIR)/ng3/scripts/build-lua-modern.sh \
  $(PLUGIN_DIR)/ng3/ng.h \
  $(PLUGIN_DIR)/ng3/shim/wasm_setjmp_shim.c \
  $(NG_LUA_MODERN_O) \
  $(NG_LUA_MODERN_A) \
  $(wildcard $(PLUGIN_DIR)/ng3/shim/*.h) \
  $(wildcard $(NG_LUA_DIR)/*.h)
