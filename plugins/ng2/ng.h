#ifndef NG2_H
#define NG2_H

#if defined(_MSC_VER)
typedef signed __int32 ng2_i32;
typedef unsigned __int32 ng2_u32;
#else
typedef __INT32_TYPE__ ng2_i32;
typedef __UINT32_TYPE__ ng2_u32;
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define NG2_MAX_HANDLES 16
#define NG2_MAX_GRAPH_SLOTS 8
#define NG2_MAX_NODES 128
#define NG2_MAX_INPUTS 32
#define NG2_MAX_OUTPUTS 32
#define NG2_MAX_ARGS 32
#define NG2_IO_BUFFER_CAP (256 * 1024)

enum ng2_error_code {
  NG2_OK = 0,
  NG2_ERR_INVALID_ARG = 1,
  NG2_ERR_INVALID_HANDLE = 2,
  NG2_ERR_CAPACITY = 3,
  NG2_ERR_NOT_IMPLEMENTED = 4,
};

enum ng2_node_kind {
  NG2_NODE_GOAL = 1,
  NG2_NODE_CODE = 2,
  NG2_NODE_CALL = 3,
  NG2_NODE_VALUE = 4,
};

enum ng2_exec_state {
  NG2_EXEC_NEVER = 0,
  NG2_EXEC_SUCCESS = 1,
  NG2_EXEC_ERROR = 2,
  NG2_EXEC_STALE = 3,
};

typedef struct {
  ng2_u32 id;
  ng2_u32 src_node_id;
  ng2_u32 src_output_id;
} Ng2InputPort;

typedef struct {
  ng2_u32 id;
} Ng2OutputPort;

typedef struct {
  ng2_u32 type;
  ng2_i32 a;
  ng2_i32 b;
} Ng2ValueSlot;

typedef struct {
  ng2_u32 id;
  ng2_u32 kind;
  ng2_u32 exec_state;
  ng2_i32 last_error;
  ng2_u32 generation;
  ng2_u32 input_count;
  ng2_u32 output_count;
  ng2_u32 arg_count;
  Ng2InputPort inputs[NG2_MAX_INPUTS];
  Ng2OutputPort outputs[NG2_MAX_OUTPUTS];
  Ng2ValueSlot args[NG2_MAX_ARGS];
} Ng2Node;

typedef struct {
  ng2_i32 initialized;
  ng2_i32 last_error;
  ng2_u32 generation;
  ng2_u32 node_count;
  ng2_i32 is_running;
  ng2_u32 active_goal_count;
  ng2_i32 io_len;
  Ng2Node nodes[NG2_MAX_NODES];
  char io_buf[NG2_IO_BUFFER_CAP];
  ng2_u32 run_status;
  ng2_u32 waiting_request_id;
  ng2_u32 waiting_node_id;
} Ng2Info;

ng2_u32 ng_handle_create(void);
ng2_u32 ng_handle_close(void);
ng2_u32 ng_handle_close_all(void);
ng2_u32 ng_handle_reset(void);

ng2_u32 ng_graph_open(void);
ng2_u32 ng_graph_open_id(void);
ng2_u32 ng_graph_save(void);
ng2_u32 ng_graph_list(void);
ng2_u32 ng_graph_delete(void);

ng2_u32 ng_template_save(void);
ng2_u32 ng_template_list(void);
ng2_u32 ng_template_delete(void);

ng2_u32 ng_node_create(void);
ng2_u32 ng_node_replace(void);
ng2_u32 ng_node_delete(void);
ng2_u32 ng_input_add(void);
ng2_u32 ng_output_add(void);
ng2_u32 ng_input_connect(void);
ng2_u32 ng_input_disconnect(void);
ng2_u32 ng_node_set_arg(void);

ng2_u32 ng_run_start(void);
ng2_u32 ng_run_cancel(void);
ng2_u32 ng_run_all_goals(void);
ng2_u32 ng_run_goal(void);
ng2_u32 ng_run(void);
ng2_u32 ng_run_and_close(void);
ng2_u32 ng_exec_clear(void);
ng2_u32 ng_exec_clear_all(void);

ng2_u32 ng_get_info_ptr(void);
ng2_u32 ng_get_info_size(void);

ng2_u32 ng_debug_load_sample(void);

#ifdef __cplusplus
}
#endif

#endif
