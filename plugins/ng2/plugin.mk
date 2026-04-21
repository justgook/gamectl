PLUGIN_ZIG_WASM_TARGET := wasm32-freestanding
PLUGIN_ZIG_C_COMPILER := cc
PLUGIN_ZIG_MCPU := generic+atomics+bulk_memory
PLUGIN_ZIG_EXTRA_FLAGS :=

NG_PLUGIN_NAME := ng2
NG_PLUGIN_DIR := $(PLUGIN_DIR)/$(NG_PLUGIN_NAME)

PLUGIN_C_SOURCES := \
  $(NG_PLUGIN_DIR)/main.c

PLUGIN_CFLAGS := \
  -O2 \
  -I$(NG_PLUGIN_DIR)

PLUGIN_LDFLAGS := \
  -Wl,--no-entry \
  -Wl,--import-memory \
  -Wl,--shared-memory \
  -Wl,--initial-memory=6291456 \
  -Wl,--max-memory=16777216 \
  -Wl,--export-table \
  -Wl,--export=__sql_init \
  -Wl,--export=ng_handle_create \
  -Wl,--export=ng_handle_close \
  -Wl,--export=ng_handle_close_all \
  -Wl,--export=ng_handle_reset \
  -Wl,--export=ng_graph_open \
  -Wl,--export=ng_graph_open_id \
  -Wl,--export=ng_graph_save \
  -Wl,--export=ng_graph_list \
  -Wl,--export=ng_graph_delete \
  -Wl,--export=ng_template_save \
  -Wl,--export=ng_template_list \
  -Wl,--export=ng_template_delete \
  -Wl,--export=ng_node_create \
  -Wl,--export=ng_node_replace \
  -Wl,--export=ng_node_delete \
  -Wl,--export=ng_input_add \
  -Wl,--export=ng_output_add \
  -Wl,--export=ng_input_connect \
  -Wl,--export=ng_input_disconnect \
  -Wl,--export=ng_node_set_arg \
  -Wl,--export=ng_run_start \
  -Wl,--export=ng_run_cancel \
  -Wl,--export=ng_run_all_goals \
  -Wl,--export=ng_run_goal \
  -Wl,--export=ng_run \
  -Wl,--export=ng_run_and_close \
  -Wl,--export=ng_exec_clear \
  -Wl,--export=ng_exec_clear_all \
  -Wl,--export=ng_get_info_ptr \
  -Wl,--export=ng_get_info_size \
  -Wl,--export=ng_debug_load_sample

PLUGIN_EXTRA_DEPS := \
  $(NG_PLUGIN_DIR)/main.c \
  $(NG_PLUGIN_DIR)/ng.h \
  $(NG_PLUGIN_DIR)/pdk.h
