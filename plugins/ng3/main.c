#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../image/jsmn.h"
#include "./vendor/lua/lauxlib.h"
#include "./vendor/lua/lualib.h"
#include "../sql/vendor/pdk.h"
#define ng_init ng_init_raw
#define ng_get_info_ptr ng_get_info_ptr_raw
#define ng_clear_graph ng_clear_graph_raw
#define ng_node_create ng_node_create_raw
#define ng_node_replace ng_node_replace_raw
#define ng_node_delete ng_node_delete_raw
#define ng_input_add ng_input_add_raw
#define ng_input_remove ng_input_remove_raw
#define ng_output_add ng_output_add_raw
#define ng_output_remove ng_output_remove_raw
#define ng_input_connect ng_input_connect_raw
#define ng_input_disconnect ng_input_disconnect_raw
#define ng_node_set_arg ng_node_set_arg_raw
#define ng_run_all_goals ng_run_all_goals_raw
#define ng_run_goal ng_run_goal_raw
#define ng_run_start ng_run_start_raw
#define ng_run_cancel ng_run_cancel_raw
#define ng_exec_clear ng_exec_clear_raw
#define ng_exec_clear_all ng_exec_clear_all_raw
#define ng_get_last_error ng_get_last_error_raw
#define ng_get_io_ptr ng_get_io_ptr_raw
#define ng_get_io_len ng_get_io_len_raw
#define ng_io_clear ng_io_clear_raw
#define ng_get_node_exec_state ng_get_node_exec_state_raw
#define run run_raw
#include "ng.h"
static NgInfo g_info;
static lua_State *g_lua = NULL;
static char g_code_buf[NG_IO_BUFFER_CAP];
static char g_resp_buf[NG_IO_BUFFER_CAP];
static NgValueSlot g_output_slots[NG_MAX_NODES][NG_MAX_OUTPUTS];
static char g_value_buf[NG_IO_BUFFER_CAP];
static ng_i32 g_value_len = 0;
static char g_current_graph_name[256];

typedef struct {
  ng_i32 active;
  ng_u32 target_goal_id;
  ng_u32 next_goal_scan;
  ng_u32 pending_request_id;
  ng_u32 pending_node_id;
  ng_u32 next_request_id;
  ng_i32 has_response;
  ng_i32 response_is_error;
  ng_i32 response_len;
  ng_i32 cancelled;
  lua_State *pending_co;
  ng_i32 pending_co_ref;
} NgRunCtx;

typedef struct {
  ng_u32 id;
  ng_u32 src_node_id;
  ng_u32 src_output_id;
  char *default_value;
} NgSerializedInput;

typedef struct {
  ng_u32 id;
  char *value;
} NgSerializedOutput;

typedef struct {
  ng_u32 id;
  ng_u32 kind;
  ng_u32 graph_id;
  char *code;
  char *code_path;
  ng_u32 input_count;
  ng_u32 output_count;
  NgSerializedInput inputs[NG_MAX_INPUTS];
  NgSerializedOutput outputs[NG_MAX_OUTPUTS];
} NgSerializedNode;

typedef struct {
  NgSerializedNode nodes[NG_MAX_NODES];
  ng_u32 node_count;
} NgSerializedGraph;

typedef struct {
  ng_u32 owner_node_id;
  ng_u32 owner_import_node_id;
  ng_i32 emit_goal;
  char *inline_code;
  char *code_path;
  char *value_defaults[NG_MAX_OUTPUTS];
} NgExecNodeMeta;

typedef struct {
  NgNode nodes[NG_MAX_NODES];
  NgExecNodeMeta meta[NG_MAX_NODES];
  NgValueSlot output_slots[NG_MAX_NODES][NG_MAX_OUTPUTS];
  ng_u32 node_count;
  ng_u32 next_id;
  ng_u32 active_import_ids[NG_MAX_NODES];
  ng_u32 active_import_count;
} NgExecGraph;

typedef struct {
  ng_u32 from_node_id;
  ng_u32 from_output_id;
  ng_u32 to_node_id;
  ng_u32 to_output_id;
} NgSourceOverride;

typedef struct {
  ng_u32 original_node_id;
  ng_u32 compiled_node_id;
} NgNodeIdMap;

typedef struct {
  ng_u32 output_port_id;
  ng_u32 src_node_id;
  ng_u32 src_output_id;
} NgGoalExport;

typedef struct {
  ng_u32 graph_id;
  ng_u32 import_node_id;
} NgGraphStackEntry;

static NgRunCtx g_run;
static NgExecGraph g_exec;

typedef struct {
  char *buf;
  size_t len;
  size_t cap;
} NgStrBuf;

typedef struct {
  ng_i32 active;
  NgSerializedGraph root_graph;
  NgStrBuf goal_results;
  ng_u32 goal_count;
} NgBatchCtx;

static NgBatchCtx g_batch;

typedef struct {
  const char *json;
  jsmntok_t *tokens;
  int count;
} NgJsonDoc;

#define NG_JSON_RECURSION_LIMIT 128

static int64_t join_i64(ng_i32 a, ng_i32 b);
static double join_f64(ng_i32 a, ng_i32 b);
static NgNode *find_node_in(NgNode *nodes, ng_u32 node_id);
static ng_i32 find_node_index_in(NgNode *nodes, ng_u32 node_id);
static void
clear_node_output_slots_in(NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                           ng_i32 node_idx);
static NgValueSlot *
find_output_slot_in(NgNode *nodes,
                    NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                    ng_u32 node_id, ng_u32 output_id);
static NgValueSlot *find_output_slot(ng_u32 node_id, ng_u32 output_id);
static int ng_json_skip_token(const NgJsonDoc *doc, int tok_idx);
static int ng_json_object_get(const NgJsonDoc *doc, int obj_idx,
                              const char *key);
static ng_u32 ng_json_token_u32(const NgJsonDoc *doc, int tok_idx,
                                ng_u32 fallback);
static char *ng_strdup(const char *src);
static char *ng_json_token_dup(const NgJsonDoc *doc, int tok_idx);
static ng_i32 ng_parse_serialized_graph(const char *json, size_t len,
                                        NgSerializedGraph *out);
static void ng_free_serialized_graph(NgSerializedGraph *graph);
static ng_i32 ng_apply_serialized_graph_to_runtime(const NgSerializedGraph *graph);
static ng_i32 ng_build_exec_graph(void);
static ng_u32 ng_import_boundary_port_id(ng_u32 node_id, ng_u32 port_id);
static int lua_host_await_call_cont(lua_State *L, int status, lua_KContext ctx);
static void clear_io(void);
static void append_io(const char *s, size_t len);

typedef struct {
  ng_i32 return_code;
  const uint8_t *output;
  ng_u32 output_len;
  ng_i32 error;
} NgDirectCallResult;

static NgDirectCallResult ng_direct_call(const char *module,
                                         const char *function,
                                         const uint8_t *input,
                                         ng_u32 input_len) {
  NgDirectCallResult result;
  uint32_t call_result;
  result.return_code = 0;
  result.output = NULL;
  result.output_len = 0;
  result.error = 0;
  call_result = pdk_plugin_call((uint32_t)(uintptr_t)module, (uint32_t)strlen(module),
                                (uint32_t)(uintptr_t)function, (uint32_t)strlen(function),
                                (uint32_t)(uintptr_t)input, (uint32_t)input_len);
  if (call_result != 0) {
    result.error = (ng_i32)call_result;
    return result;
  }
  result.return_code = (ng_i32)pdk_plugin_call_return();
  result.output = (const uint8_t *)(uintptr_t)pdk_plugin_call_output_ptr();
  result.output_len = (ng_u32)pdk_plugin_call_output_len();
  return result;
}

static void ng_sb_init(NgStrBuf *sb) {
  sb->buf = NULL;
  sb->len = 0;
  sb->cap = 0;
}

static void ng_sb_free(NgStrBuf *sb) {
  if (sb->buf != NULL) {
    free(sb->buf);
    sb->buf = NULL;
  }
  sb->len = 0;
  sb->cap = 0;
}

static int ng_sb_reserve(NgStrBuf *sb, size_t add_len) {
  size_t need;
  size_t next_cap;
  char *next_buf;
  if (add_len > (size_t)-1 - sb->len - 1u) {
    return 0;
  }
  need = sb->len + add_len + 1u;
  if (need <= sb->cap) {
    return 1;
  }
  next_cap = sb->cap == 0 ? 128u : sb->cap;
  while (next_cap < need) {
    if (next_cap > ((size_t)-1 / 2u)) {
      next_cap = need;
      break;
    }
    next_cap *= 2u;
  }
  next_buf = (char *)realloc(sb->buf, next_cap);
  if (next_buf == NULL) {
    return 0;
  }
  sb->buf = next_buf;
  sb->cap = next_cap;
  return 1;
}

static int ng_sb_append_len(NgStrBuf *sb, const char *src, size_t len) {
  if (len == 0) {
    return 1;
  }
  if (!ng_sb_reserve(sb, len)) {
    return 0;
  }
  memcpy(sb->buf + sb->len, src, len);
  sb->len += len;
  sb->buf[sb->len] = '\0';
  return 1;
}

static int ng_sb_append_c(NgStrBuf *sb, char c) {
  if (!ng_sb_reserve(sb, 1u)) {
    return 0;
  }
  sb->buf[sb->len++] = c;
  sb->buf[sb->len] = '\0';
  return 1;
}

static int ng_sb_append_u32(NgStrBuf *sb, ng_u32 v) {
  char buf[16];
  int n = snprintf(buf, sizeof(buf), "%u", (unsigned)v);
  if (n <= 0 || (size_t)n >= sizeof(buf)) {
    return 0;
  }
  return ng_sb_append_len(sb, buf, (size_t)n);
}

static void ng_batch_reset(void) {
  ng_free_serialized_graph(&g_batch.root_graph);
  memset(&g_batch.root_graph, 0, sizeof(g_batch.root_graph));
  ng_sb_free(&g_batch.goal_results);
  g_batch.active = 0;
  g_batch.goal_count = 0;
}

static const NgSerializedNode *ng_batch_find_root_node(ng_u32 node_id) {
  ng_u32 i;
  for (i = 0; i < g_batch.root_graph.node_count; i++) {
    if (g_batch.root_graph.nodes[i].id == node_id) {
      return &g_batch.root_graph.nodes[i];
    }
  }
  return NULL;
}

static int ng_sql_escape_single_quotes(const char *src, size_t len,
                                       NgStrBuf *out) {
  size_t i;
  for (i = 0; i < len; i++) {
    if (src[i] == '\'') {
      if (!ng_sb_append_len(out, "''", 2u)) {
        return 0;
      }
    } else if (!ng_sb_append_c(out, src[i])) {
      return 0;
    }
  }
  return 1;
}

static int ng_csv_extract_first_data_field(const char *csv, size_t len,
                                           NgStrBuf *out) {
  size_t i = 0;
  int row = 0;
  int col = 0;
  int in_quotes = 0;
  ng_sb_free(out);
  ng_sb_init(out);
  while (i <= len) {
    char ch = i < len ? csv[i] : '\n';
    char next = (i + 1u) < len ? csv[i + 1u] : '\0';
    if (in_quotes) {
      if (ch == '"') {
        if (next == '"') {
          if (row == 1 && col == 0 && !ng_sb_append_c(out, '"')) {
            return 0;
          }
          i += 2u;
          continue;
        }
        in_quotes = 0;
      } else if (row == 1 && col == 0 && !ng_sb_append_c(out, ch)) {
        return 0;
      }
    } else {
      if (ch == '"') {
        in_quotes = 1;
      } else if (ch == ',') {
        if (row == 1 && col == 0) {
          return 1;
        }
        col += 1;
      } else if (ch == '\n' || ch == '\r') {
        if (row == 1 && col == 0) {
          return 1;
        }
        row += 1;
        col = 0;
        if (ch == '\r' && next == '\n') {
          i += 1u;
        }
      } else if (row == 1 && col == 0 && !ng_sb_append_c(out, ch)) {
        return 0;
      }
    }
    i += 1u;
  }
  return out->len > 0;
}

static ng_i32 ng_batch_query_single_field(const char *sql, size_t sql_len,
                                          NgStrBuf *out) {
  NgDirectCallResult result =
      ng_direct_call("sql", "query", (const uint8_t *)sql, (uint32_t)sql_len);
  if (result.error != 0) {
    return NG_ERR_HOST;
  }
  if (result.return_code != 0) {
    clear_io();
    if (result.output != NULL && result.output_len > 0) {
      append_io((const char *)result.output, (size_t)result.output_len);
    }
    return NG_ERR_HOST;
  }
  if (result.output == NULL || result.output_len == 0) {
    return NG_ERR_NOT_FOUND;
  }
  if (!ng_csv_extract_first_data_field((const char *)result.output,
                                       (size_t)result.output_len, out)) {
    return NG_ERR_NOT_FOUND;
  }
  return NG_OK;
}

static ng_i32 ng_batch_load_graph_by_name(const char *name,
                                          NgSerializedGraph *out) {
  NgStrBuf query;
  NgStrBuf field;
  ng_i32 err;
  size_t name_len = name != NULL ? strlen(name) : 0u;
  ng_sb_init(&query);
  ng_sb_init(&field);
  if (!ng_sb_append_len(&query,
                        "SELECT data FROM ng_graph_storage WHERE name = '",
                        sizeof("SELECT data FROM ng_graph_storage WHERE name = '") - 1u) ||
      !ng_sql_escape_single_quotes(name != NULL ? name : "", name_len,
                                   &query) ||
      !ng_sb_append_len(&query, "' LIMIT 1", 9u)) {
    ng_sb_free(&query);
    ng_sb_free(&field);
    return NG_ERR_CAPACITY;
  }
  err = ng_batch_query_single_field(query.buf != NULL ? query.buf : "",
                                    query.len, &field);
  ng_sb_free(&query);
  if (err != NG_OK) {
    ng_sb_free(&field);
    return err;
  }
  err = ng_parse_serialized_graph(field.buf != NULL ? field.buf : "", field.len,
                                  out);
  ng_sb_free(&field);
  return err;
}

static ng_i32 ng_batch_load_graph_by_id(ng_u32 graph_id, NgSerializedGraph *out) {
  char query[128];
  NgStrBuf field;
  int n = snprintf(query, sizeof(query),
                   "SELECT data FROM ng_graph_storage WHERE rowid = %u LIMIT 1",
                   (unsigned)graph_id);
  ng_i32 err;
  if (n <= 0 || (size_t)n >= sizeof(query)) {
    return NG_ERR_CAPACITY;
  }
  ng_sb_init(&field);
  err = ng_batch_query_single_field(query, (size_t)n, &field);
  if (err != NG_OK) {
    ng_sb_free(&field);
    return err;
  }
  err = ng_parse_serialized_graph(field.buf != NULL ? field.buf : "", field.len,
                                  out);
  ng_sb_free(&field);
  return err;
}

static ng_i32 ng_batch_read_file(const char *path, char *out_buf,
                                 ng_i32 out_cap, ng_i32 *out_len) {
  size_t path_len = path != NULL ? strlen(path) : 0u;
  NgDirectCallResult result;
  if (out_len != NULL) {
    *out_len = 0;
  }
  if (path == NULL || path_len == 0u || out_buf == NULL || out_cap <= 0) {
    return NG_ERR_INVALID_ARG;
  }
  result =
      ng_direct_call("fs", "read", (const uint8_t *)path, (uint32_t)path_len);
  if (result.error != 0) {
    return NG_ERR_HOST;
  }
  if (result.return_code != 0) {
    clear_io();
    if (result.output != NULL && result.output_len > 0) {
      append_io((const char *)result.output, (size_t)result.output_len);
    }
    return NG_ERR_HOST;
  }
  if ((ng_i32)result.output_len >= out_cap) {
    return NG_ERR_CAPACITY;
  }
  if (result.output_len > 0 && result.output != NULL) {
    memcpy(out_buf, result.output, (size_t)result.output_len);
  }
  out_buf[result.output_len] = '\0';
  if (out_len != NULL) {
    *out_len = (ng_i32)result.output_len;
  }
  return NG_OK;
}

static int ng_batch_append_goal_payload(const char *payload, size_t len) {
  if (!g_batch.active) {
    return 1;
  }
  if (g_batch.goal_count > 0 && !ng_sb_append_c(&g_batch.goal_results, ',')) {
    return 0;
  }
  if (!ng_sb_append_len(&g_batch.goal_results, payload, len)) {
    return 0;
  }
  g_batch.goal_count += 1u;
  return 1;
}

static void ng_goal_collection_begin(void) {
  ng_sb_free(&g_batch.goal_results);
  ng_sb_init(&g_batch.goal_results);
  g_batch.goal_count = 0;
  g_batch.active = 1;
}

static void ng_goal_collection_end(void) {
  ng_sb_free(&g_batch.goal_results);
  ng_sb_init(&g_batch.goal_results);
  g_batch.goal_count = 0;
  g_batch.active = 0;
}

static ng_i32 ng_set_cached_root_graph_json(const char *json, size_t len) {
  NgSerializedGraph parsed;
  ng_i32 err;
  memset(&parsed, 0, sizeof(parsed));
  err = ng_parse_serialized_graph(json, len, &parsed);
  if (err != NG_OK) {
    return err;
  }
  ng_free_serialized_graph(&g_batch.root_graph);
  g_batch.root_graph = parsed;
  return NG_OK;
}

static ng_i32 ng_apply_cached_root_graph_json(const char *json, size_t len) {
  ng_i32 err = ng_set_cached_root_graph_json(json, len);
  if (err != NG_OK) {
    return err;
  }
  return ng_apply_serialized_graph_to_runtime(&g_batch.root_graph);
}

static ng_i32 ng_apply_serialized_graph_to_runtime(const NgSerializedGraph *graph) {
  ng_u32 i;
  ng_i32 err;
  if (graph == NULL) {
    return NG_ERR_INVALID_ARG;
  }
  err = ng_clear_graph();
  if (err != NG_OK) {
    return err;
  }
  for (i = 0; i < graph->node_count; i++) {
    const NgSerializedNode *node = &graph->nodes[i];
    ng_u32 j;
    if (node->id == 0) {
      continue;
    }
    err = ng_node_create(node->id, node->kind);
    if (err != NG_OK) {
      return err;
    }
    for (j = 0; j < node->input_count; j++) {
      err = ng_input_add(node->id, node->inputs[j].id);
      if (err != NG_OK) {
        return err;
      }
    }
    for (j = 0; j < node->output_count; j++) {
      err = ng_output_add(node->id, node->outputs[j].id);
      if (err != NG_OK) {
        return err;
      }
    }
    if (node->kind == NG_NODE_CALL && node->graph_id != 0) {
      err = ng_node_set_arg(node->id, NG_ARG_IMPORT_GRAPH_ID, NG_VAL_I64,
                            (ng_i32)node->graph_id, 0);
      if (err != NG_OK) {
        return err;
      }
    }
  }
  for (i = 0; i < graph->node_count; i++) {
    const NgSerializedNode *node = &graph->nodes[i];
    ng_u32 j;
    for (j = 0; j < node->input_count; j++) {
      if (node->inputs[j].src_node_id == 0 || node->inputs[j].src_output_id == 0) {
        continue;
      }
      err = ng_input_connect(node->id, node->inputs[j].id,
                             node->inputs[j].src_node_id,
                             node->inputs[j].src_output_id);
      if (err != NG_OK) {
        return err;
      }
    }
  }
  return NG_OK;
}

static int ng_json_hex_val(char c) {
  if (c >= '0' && c <= '9') {
    return (int)(c - '0');
  }
  if (c >= 'a' && c <= 'f') {
    return 10 + (int)(c - 'a');
  }
  if (c >= 'A' && c <= 'F') {
    return 10 + (int)(c - 'A');
  }
  return -1;
}

static int ng_json_parse_u16(const char *s, unsigned *out_cp) {
  int i;
  unsigned cp = 0;
  for (i = 0; i < 4; i++) {
    int h = ng_json_hex_val(s[i]);
    if (h < 0) {
      return 0;
    }
    cp = (cp << 4) | (unsigned)h;
  }
  *out_cp = cp;
  return 1;
}

static int ng_sb_append_utf8(NgStrBuf *sb, unsigned cp) {
  char bytes[4];
  size_t len = 0;
  if (cp <= 0x7Fu) {
    bytes[len++] = (char)cp;
  } else if (cp <= 0x7FFu) {
    bytes[len++] = (char)(0xC0u | ((cp >> 6) & 0x1Fu));
    bytes[len++] = (char)(0x80u | (cp & 0x3Fu));
  } else if (cp <= 0xFFFFu) {
    bytes[len++] = (char)(0xE0u | ((cp >> 12) & 0x0Fu));
    bytes[len++] = (char)(0x80u | ((cp >> 6) & 0x3Fu));
    bytes[len++] = (char)(0x80u | (cp & 0x3Fu));
  } else if (cp <= 0x10FFFFu) {
    bytes[len++] = (char)(0xF0u | ((cp >> 18) & 0x07u));
    bytes[len++] = (char)(0x80u | ((cp >> 12) & 0x3Fu));
    bytes[len++] = (char)(0x80u | ((cp >> 6) & 0x3Fu));
    bytes[len++] = (char)(0x80u | (cp & 0x3Fu));
  } else {
    return 0;
  }
  return ng_sb_append_len(sb, bytes, len);
}

static char *ng_json_unescape_copy(const char *s, size_t len) {
  NgStrBuf sb;
  size_t i = 0;
  ng_sb_init(&sb);
  while (i < len) {
    char c = s[i++];
    if (c != '\\') {
      if (!ng_sb_append_c(&sb, c)) {
        ng_sb_free(&sb);
        return NULL;
      }
      continue;
    }
    if (i >= len) {
      ng_sb_free(&sb);
      return NULL;
    }
    c = s[i++];
    if (c == '"' || c == '\\' || c == '/') {
      if (!ng_sb_append_c(&sb, c)) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else if (c == 'b') {
      if (!ng_sb_append_c(&sb, '\b')) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else if (c == 'f') {
      if (!ng_sb_append_c(&sb, '\f')) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else if (c == 'n') {
      if (!ng_sb_append_c(&sb, '\n')) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else if (c == 'r') {
      if (!ng_sb_append_c(&sb, '\r')) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else if (c == 't') {
      if (!ng_sb_append_c(&sb, '\t')) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else if (c == 'u') {
      unsigned cp = 0;
      if (i + 4 > len || !ng_json_parse_u16(s + i, &cp)) {
        ng_sb_free(&sb);
        return NULL;
      }
      i += 4;
      if (cp >= 0xD800u && cp <= 0xDBFFu) {
        unsigned cp2 = 0;
        if (i + 6 <= len && s[i] == '\\' && s[i + 1] == 'u' &&
            ng_json_parse_u16(s + i + 2, &cp2) && cp2 >= 0xDC00u &&
            cp2 <= 0xDFFFu) {
          cp = 0x10000u + ((cp - 0xD800u) << 10) + (cp2 - 0xDC00u);
          i += 6;
        }
      }
      if (!ng_sb_append_utf8(&sb, cp)) {
        ng_sb_free(&sb);
        return NULL;
      }
    } else {
      ng_sb_free(&sb);
      return NULL;
    }
  }
  if (sb.buf == NULL) {
    return ng_strdup("");
  }
  return sb.buf;
}

static int ng_lua_add_utf8(luaL_Buffer *b, unsigned cp) {
  if (cp <= 0x7Fu) {
    luaL_addchar(b, (char)cp);
    return 1;
  }
  if (cp <= 0x7FFu) {
    luaL_addchar(b, (char)(0xC0u | ((cp >> 6) & 0x1Fu)));
    luaL_addchar(b, (char)(0x80u | (cp & 0x3Fu)));
    return 1;
  }
  if (cp <= 0xFFFFu) {
    luaL_addchar(b, (char)(0xE0u | ((cp >> 12) & 0x0Fu)));
    luaL_addchar(b, (char)(0x80u | ((cp >> 6) & 0x3Fu)));
    luaL_addchar(b, (char)(0x80u | (cp & 0x3Fu)));
    return 1;
  }
  if (cp <= 0x10FFFFu) {
    luaL_addchar(b, (char)(0xF0u | ((cp >> 18) & 0x07u)));
    luaL_addchar(b, (char)(0x80u | ((cp >> 12) & 0x3Fu)));
    luaL_addchar(b, (char)(0x80u | ((cp >> 6) & 0x3Fu)));
    luaL_addchar(b, (char)(0x80u | (cp & 0x3Fu)));
    return 1;
  }
  return 0;
}

static int ng_lua_push_json_string_unescaped(lua_State *L, const char *s,
                                             size_t len) {
  luaL_Buffer b;
  size_t i = 0;
  luaL_buffinit(L, &b);
  while (i < len) {
    char c = s[i++];
    if (c != '\\') {
      luaL_addchar(&b, c);
      continue;
    }
    if (i >= len) {
      return luaL_error(L, "json.decode: invalid escape sequence");
    }
    c = s[i++];
    if (c == '"' || c == '\\' || c == '/') {
      luaL_addchar(&b, c);
    } else if (c == 'b') {
      luaL_addchar(&b, '\b');
    } else if (c == 'f') {
      luaL_addchar(&b, '\f');
    } else if (c == 'n') {
      luaL_addchar(&b, '\n');
    } else if (c == 'r') {
      luaL_addchar(&b, '\r');
    } else if (c == 't') {
      luaL_addchar(&b, '\t');
    } else if (c == 'u') {
      unsigned cp = 0;
      if (i + 4 > len || !ng_json_parse_u16(s + i, &cp)) {
        return luaL_error(L, "json.decode: invalid unicode escape");
      }
      i += 4;
      if (cp >= 0xD800u && cp <= 0xDBFFu) {
        unsigned cp2 = 0;
        if (i + 6 <= len && s[i] == '\\' && s[i + 1] == 'u' &&
            ng_json_parse_u16(s + i + 2, &cp2) && cp2 >= 0xDC00u &&
            cp2 <= 0xDFFFu) {
          cp = 0x10000u + ((cp - 0xD800u) << 10) + (cp2 - 0xDC00u);
          i += 6;
        }
      }
      if (!ng_lua_add_utf8(&b, cp)) {
        return luaL_error(L, "json.decode: invalid unicode codepoint");
      }
    } else {
      return luaL_error(L, "json.decode: unsupported escape sequence");
    }
  }
  luaL_pushresult(&b);
  return 1;
}

static int ng_lua_json_decode_value(lua_State *L, const NgJsonDoc *doc,
                                    int tok_idx, int depth, int *next_idx) {
  jsmntok_t tok;
  int i;
  int cur;
  if (depth > NG_JSON_RECURSION_LIMIT) {
    return luaL_error(L, "json.decode: recursion limit exceeded");
  }
  if (tok_idx < 0 || tok_idx >= doc->count) {
    return luaL_error(L, "json.decode: token index out of range");
  }

  tok = doc->tokens[tok_idx];
  if (tok.type == JSMN_OBJECT) {
    lua_createtable(L, 0, tok.size);
    cur = tok_idx + 1;
    for (i = 0; i < tok.size; i++) {
      jsmntok_t key_tok;
      if (cur >= doc->count) {
        return luaL_error(L, "json.decode: unexpected end of object");
      }
      key_tok = doc->tokens[cur++];
      if (key_tok.type != JSMN_STRING || key_tok.start < 0 ||
          key_tok.end < key_tok.start) {
        return luaL_error(L, "json.decode: object key must be string");
      }
      ng_lua_push_json_string_unescaped(L, doc->json + key_tok.start,
                                        (size_t)(key_tok.end - key_tok.start));
      ng_lua_json_decode_value(L, doc, cur, depth + 1, &cur);
      lua_settable(L, -3);
    }
    *next_idx = cur;
    return 1;
  }

  if (tok.type == JSMN_ARRAY) {
    lua_createtable(L, tok.size, 0);
    cur = tok_idx + 1;
    for (i = 0; i < tok.size; i++) {
      ng_lua_json_decode_value(L, doc, cur, depth + 1, &cur);
      lua_seti(L, -2, (lua_Integer)i + 1);
    }
    *next_idx = cur;
    return 1;
  }

  if (tok.type == JSMN_STRING) {
    if (tok.start < 0 || tok.end < tok.start) {
      return luaL_error(L, "json.decode: invalid string token");
    }
    ng_lua_push_json_string_unescaped(L, doc->json + tok.start,
                                      (size_t)(tok.end - tok.start));
    *next_idx = tok_idx + 1;
    return 1;
  }

  if (tok.type == JSMN_PRIMITIVE) {
    size_t len;
    const char *p;
    if (tok.start < 0 || tok.end < tok.start) {
      return luaL_error(L, "json.decode: invalid primitive token");
    }
    len = (size_t)(tok.end - tok.start);
    p = doc->json + tok.start;
    if (len == 4 && memcmp(p, "true", 4u) == 0) {
      lua_pushboolean(L, 1);
    } else if (len == 5 && memcmp(p, "false", 5u) == 0) {
      lua_pushboolean(L, 0);
    } else if (len == 4 && memcmp(p, "null", 4u) == 0) {
      lua_pushnil(L);
    } else {
      char small[128];
      char *tmp = small;
      size_t parsed;
      if (len + 1u > sizeof(small)) {
        tmp = (char *)malloc(len + 1u);
        if (tmp == NULL) {
          return luaL_error(L, "json.decode: out of memory");
        }
      }
      memcpy(tmp, p, len);
      tmp[len] = '\0';
      parsed = lua_stringtonumber(L, tmp);
      if (tmp != small) {
        free(tmp);
      }
      if (parsed == 0 || parsed != len + 1u) {
        return luaL_error(L, "json.decode: invalid numeric token");
      }
    }
    *next_idx = tok_idx + 1;
    return 1;
  }

  return luaL_error(L, "json.decode: unsupported token type");
}

static int lua_json_decode(lua_State *L) {
  size_t len = 0;
  const char *json = luaL_checklstring(L, 1, &len);
  NgJsonDoc doc;
  jsmn_parser parser;
  int rc;
  int next_idx = 0;

  doc.json = json;
  doc.tokens = NULL;
  doc.count = 0;

  jsmn_init(&parser);
  rc = jsmn_parse(&parser, json, len, NULL, 0);
  if (rc <= 0) {
    return luaL_error(L, "json.decode: invalid json input");
  }
  doc.count = rc;
  doc.tokens = (jsmntok_t *)malloc((size_t)doc.count * sizeof(jsmntok_t));
  if (doc.tokens == NULL) {
    return luaL_error(L, "json.decode: out of memory");
  }

  jsmn_init(&parser);
  rc = jsmn_parse(&parser, json, len, doc.tokens, (unsigned int)doc.count);
  if (rc < 1 || doc.tokens[0].type == JSMN_UNDEFINED) {
    free(doc.tokens);
    return luaL_error(L, "json.decode: invalid json input");
  }
  doc.count = rc;

  ng_lua_json_decode_value(L, &doc, 0, 0, &next_idx);
  if (next_idx != doc.count) {
    free(doc.tokens);
    return luaL_error(L, "json.decode: trailing tokens detected");
  }

  free(doc.tokens);
  return 1;
}

static int ng_json_encode_value(lua_State *L, int idx, NgStrBuf *out,
                                const void **seen, int seen_count, int depth);

static int ng_json_encode_string(NgStrBuf *out, const char *s, size_t len) {
  static const char hex[] = "0123456789abcdef";
  size_t i;
  if (!ng_sb_append_c(out, '"')) {
    return 0;
  }
  for (i = 0; i < len; i++) {
    unsigned char c = (unsigned char)s[i];
    if (c == '"') {
      if (!ng_sb_append_len(out, "\\\"", 2u))
        return 0;
    } else if (c == '\\') {
      if (!ng_sb_append_len(out, "\\\\", 2u))
        return 0;
    } else if (c == '\b') {
      if (!ng_sb_append_len(out, "\\b", 2u))
        return 0;
    } else if (c == '\f') {
      if (!ng_sb_append_len(out, "\\f", 2u))
        return 0;
    } else if (c == '\n') {
      if (!ng_sb_append_len(out, "\\n", 2u))
        return 0;
    } else if (c == '\r') {
      if (!ng_sb_append_len(out, "\\r", 2u))
        return 0;
    } else if (c == '\t') {
      if (!ng_sb_append_len(out, "\\t", 2u))
        return 0;
    } else if (c < 0x20u) {
      char esc[6];
      esc[0] = '\\';
      esc[1] = 'u';
      esc[2] = '0';
      esc[3] = '0';
      esc[4] = hex[(c >> 4) & 0x0Fu];
      esc[5] = hex[c & 0x0Fu];
      if (!ng_sb_append_len(out, esc, sizeof(esc)))
        return 0;
    } else {
      if (!ng_sb_append_c(out, (char)c))
        return 0;
    }
  }
  return ng_sb_append_c(out, '"');
}

static int ng_json_encode_bytes(NgStrBuf *out, const char *s, size_t len) {
  static const char hex[] = "0123456789abcdef";
  size_t i;
  if (!ng_sb_append_c(out, '"')) {
    return 0;
  }
  for (i = 0; i < len; i++) {
    unsigned char c = (unsigned char)s[i];
    if (c == '"') {
      if (!ng_sb_append_len(out, "\\\"", 2u))
        return 0;
    } else if (c == '\\') {
      if (!ng_sb_append_len(out, "\\\\", 2u))
        return 0;
    } else if (c == '\b') {
      if (!ng_sb_append_len(out, "\\b", 2u))
        return 0;
    } else if (c == '\f') {
      if (!ng_sb_append_len(out, "\\f", 2u))
        return 0;
    } else if (c == '\n') {
      if (!ng_sb_append_len(out, "\\n", 2u))
        return 0;
    } else if (c == '\r') {
      if (!ng_sb_append_len(out, "\\r", 2u))
        return 0;
    } else if (c == '\t') {
      if (!ng_sb_append_len(out, "\\t", 2u))
        return 0;
    } else if (c < 0x20u || c > 0x7eu) {
      char esc[6];
      esc[0] = '\\';
      esc[1] = 'u';
      esc[2] = '0';
      esc[3] = '0';
      esc[4] = hex[(c >> 4) & 0x0Fu];
      esc[5] = hex[c & 0x0Fu];
      if (!ng_sb_append_len(out, esc, sizeof(esc)))
        return 0;
    } else {
      if (!ng_sb_append_c(out, (char)c))
        return 0;
    }
  }
  return ng_sb_append_c(out, '"');
}

static int ng_json_table_shape(lua_State *L, int idx, lua_Integer *out_max,
                               int *out_is_array) {
  lua_Integer max_idx = 0;
  lua_Integer int_count = 0;
  int has_other = 0;
  idx = lua_absindex(L, idx);
  lua_pushnil(L);
  while (lua_next(L, idx) != 0) {
    if (lua_type(L, -2) == LUA_TNUMBER && lua_isinteger(L, -2)) {
      lua_Integer k = lua_tointeger(L, -2);
      if (k >= 1) {
        int_count++;
        if (k > max_idx) {
          max_idx = k;
        }
      } else {
        has_other = 1;
      }
    } else {
      has_other = 1;
    }
    lua_pop(L, 1);
  }
  *out_max = max_idx;
  *out_is_array = (!has_other && int_count == max_idx) ? 1 : 0;
  return 1;
}

static int ng_json_encode_table(lua_State *L, int idx, NgStrBuf *out,
                                const void **seen, int seen_count, int depth) {
  const void *ptr;
  lua_Integer max_idx = 0;
  int is_array = 0;
  int i;
  idx = lua_absindex(L, idx);

  if (depth > NG_JSON_RECURSION_LIMIT) {
    luaL_error(L, "json.encode: recursion limit exceeded");
    return 0;
  }
  ptr = lua_topointer(L, idx);
  for (i = 0; i < seen_count; i++) {
    if (seen[i] == ptr) {
      luaL_error(L, "json.encode: circular table reference");
      return 0;
    }
  }
  if (seen_count + 1 >= NG_JSON_RECURSION_LIMIT) {
    luaL_error(L, "json.encode: nesting too deep");
    return 0;
  }
  seen[seen_count] = ptr;
  seen_count += 1;

  ng_json_table_shape(L, idx, &max_idx, &is_array);
  if (is_array) {
    lua_Integer k;
    if (!ng_sb_append_c(out, '['))
      return 0;
    for (k = 1; k <= max_idx; k++) {
      if (k > 1 && !ng_sb_append_c(out, ','))
        return 0;
      lua_geti(L, idx, k);
      if (!ng_json_encode_value(L, -1, out, seen, seen_count, depth + 1)) {
        lua_pop(L, 1);
        return 0;
      }
      lua_pop(L, 1);
    }
    if (!ng_sb_append_c(out, ']'))
      return 0;
    return 1;
  }

  if (!ng_sb_append_c(out, '{'))
    return 0;
  i = 0;
  lua_pushnil(L);
  while (lua_next(L, idx) != 0) {
    size_t klen = 0;
    const char *k = lua_tolstring(L, -2, &klen);
    if (k == NULL) {
      lua_pop(L, 2);
      luaL_error(L, "json.encode: object keys must be strings");
      return 0;
    }
    if (i++ > 0 && !ng_sb_append_c(out, ',')) {
      lua_pop(L, 1);
      return 0;
    }
    if (!ng_json_encode_string(out, k, klen) || !ng_sb_append_c(out, ':')) {
      lua_pop(L, 1);
      return 0;
    }
    if (!ng_json_encode_value(L, -1, out, seen, seen_count, depth + 1)) {
      lua_pop(L, 1);
      return 0;
    }
    lua_pop(L, 1);
  }
  return ng_sb_append_c(out, '}');
}

static int ng_json_encode_value(lua_State *L, int idx, NgStrBuf *out,
                                const void **seen, int seen_count, int depth) {
  int t = lua_type(L, idx);
  if (t == LUA_TNIL) {
    return ng_sb_append_len(out, "null", 4u);
  }
  if (t == LUA_TBOOLEAN) {
    return lua_toboolean(L, idx) ? ng_sb_append_len(out, "true", 4u)
                                 : ng_sb_append_len(out, "false", 5u);
  }
  if (t == LUA_TNUMBER) {
    char num[64];
    int n;
    if (lua_isinteger(L, idx)) {
      lua_Integer v = lua_tointeger(L, idx);
      n = snprintf(num, sizeof(num), "%lld", (long long)v);
    } else {
      lua_Number d = lua_tonumber(L, idx);
      if (!isfinite((double)d)) {
        luaL_error(L, "json.encode: non-finite numbers are not supported");
        return 0;
      }
      n = snprintf(num, sizeof(num), "%.17g", (double)d);
    }
    if (n <= 0 || (size_t)n >= sizeof(num)) {
      luaL_error(L, "json.encode: failed to format number");
      return 0;
    }
    return ng_sb_append_len(out, num, (size_t)n);
  }
  if (t == LUA_TSTRING) {
    size_t len = 0;
    const char *s = lua_tolstring(L, idx, &len);
    return ng_json_encode_string(out, s, len);
  }
  if (t == LUA_TTABLE) {
    return ng_json_encode_table(L, idx, out, seen, seen_count, depth);
  }
  luaL_error(L, "json.encode: unsupported lua type: %s", lua_typename(L, t));
  return 0;
}

static int lua_json_encode(lua_State *L) {
  NgStrBuf out;
  const void *seen[NG_JSON_RECURSION_LIMIT];
  ng_sb_init(&out);
  if (!ng_json_encode_value(L, 1, &out, seen, 0, 0)) {
    ng_sb_free(&out);
    return luaL_error(L, "json.encode: out of memory");
  }
  lua_pushlstring(L, out.buf != NULL ? out.buf : "", out.len);
  ng_sb_free(&out);
  return 1;
}

static int lua_csv_parse(lua_State *L) {
  size_t len = 0;
  const char *text = luaL_checklstring(L, 1, &len);
  int with_headers = 1;
  size_t i = 0;
  int row_count = 0;
  int field_count = 0;
  int in_quotes = 0;
  NgStrBuf field;
  int lines_idx;
  int row_idx;

  if (lua_gettop(L) >= 2) {
    if (lua_isboolean(L, 2)) {
      with_headers = lua_toboolean(L, 2) ? 1 : 0;
    } else if (lua_istable(L, 2)) {
      lua_getfield(L, 2, "headers");
      if (!lua_isnil(L, -1)) {
        with_headers = lua_toboolean(L, -1) ? 1 : 0;
      }
      lua_pop(L, 1);
    }
  }

  lua_newtable(L);
  lines_idx = lua_gettop(L);
  lua_newtable(L);
  row_idx = lua_gettop(L);
  ng_sb_init(&field);

#define NG_CSV_FLUSH_FIELD()                                                   \
  do {                                                                         \
    lua_pushlstring(L, field.buf != NULL ? field.buf : "", field.len);         \
    lua_seti(L, row_idx, (lua_Integer)(++field_count));                        \
    field.len = 0;                                                             \
    if (field.buf != NULL) {                                                   \
      field.buf[0] = '\0';                                                     \
    }                                                                          \
  } while (0)

#define NG_CSV_FLUSH_ROW()                                                     \
  do {                                                                         \
    if (field.len > 0 || field_count > 0) {                                    \
      NG_CSV_FLUSH_FIELD();                                                    \
      lua_pushvalue(L, row_idx);                                               \
      lua_seti(L, lines_idx, (lua_Integer)(++row_count));                      \
      lua_newtable(L);                                                         \
      lua_replace(L, row_idx);                                                 \
      field_count = 0;                                                         \
    }                                                                          \
  } while (0)

  while (i < len) {
    char c = text[i];
    char next = (i + 1 < len) ? text[i + 1] : '\0';
    if (in_quotes) {
      if (c == '"') {
        if (next == '"') {
          if (!ng_sb_append_c(&field, '"')) {
            ng_sb_free(&field);
            return luaL_error(L, "csv.parse: out of memory");
          }
          i += 2;
          continue;
        }
        in_quotes = 0;
        i += 1;
        continue;
      }
      if (!ng_sb_append_c(&field, c)) {
        ng_sb_free(&field);
        return luaL_error(L, "csv.parse: out of memory");
      }
      i += 1;
      continue;
    }

    if (c == '"') {
      in_quotes = 1;
    } else if (c == ',') {
      NG_CSV_FLUSH_FIELD();
    } else if (c == '\n' || c == '\r') {
      NG_CSV_FLUSH_ROW();
      if (c == '\r' && next == '\n') {
        i += 1;
      }
    } else {
      if (!ng_sb_append_c(&field, c)) {
        ng_sb_free(&field);
        return luaL_error(L, "csv.parse: out of memory");
      }
    }
    i += 1;
  }

  NG_CSV_FLUSH_ROW();
  ng_sb_free(&field);
  lua_pop(L, 1);

  if (!with_headers || row_count == 0) {
    return 1;
  }

  lua_newtable(L);
  {
    int out_idx = lua_gettop(L);
    lua_Integer out_row = 0;
    lua_Integer r;

    lua_geti(L, lines_idx, 1);
    if (!lua_istable(L, -1)) {
      lua_pop(L, 1);
      return 1;
    }

    for (r = 2; r <= (lua_Integer)row_count; r++) {
      lua_Integer c;
      lua_Integer header_len;
      lua_geti(L, lines_idx, r);
      if (!lua_istable(L, -1)) {
        lua_pop(L, 1);
        continue;
      }
      lua_newtable(L);
      header_len = (lua_Integer)lua_rawlen(L, -3);
      for (c = 1; c <= header_len; c++) {
        size_t klen = 0;
        const char *k;
        lua_geti(L, -3, c);
        k = lua_tolstring(L, -1, &klen);
        lua_pop(L, 1);
        if (k == NULL || klen == 0) {
          continue;
        }
        lua_geti(L, -2, c);
        if (lua_isnil(L, -1)) {
          lua_pop(L, 1);
          lua_pushliteral(L, "");
        }
        lua_setfield(L, -2, k);
      }
      lua_seti(L, out_idx, ++out_row);
      lua_pop(L, 1);
    }

    lua_pop(L, 1);
    lua_replace(L, lines_idx);
  }
  return 1;
}

#undef NG_CSV_FLUSH_FIELD
#undef NG_CSV_FLUSH_ROW

static void register_json_csv_libs(lua_State *L) {
  lua_newtable(L);
  lua_pushcfunction(L, lua_json_decode);
  lua_setfield(L, -2, "decode");
  lua_pushcfunction(L, lua_json_encode);
  lua_setfield(L, -2, "encode");
  lua_setglobal(L, "json");

  lua_newtable(L);
  lua_pushcfunction(L, lua_csv_parse);
  lua_setfield(L, -2, "parse");
  lua_setglobal(L, "csv");
}

static int ng_json_skip_token(const NgJsonDoc *doc, int tok_idx) {
  jsmntok_t tok;
  int i;
  int cur;
  if (doc == NULL || tok_idx < 0 || tok_idx >= doc->count) {
    return tok_idx;
  }
  tok = doc->tokens[tok_idx];
  cur = tok_idx + 1;
  if (tok.type == JSMN_OBJECT) {
    for (i = 0; i < tok.size; i++) {
      cur = ng_json_skip_token(doc, cur);
      cur = ng_json_skip_token(doc, cur);
    }
    return cur;
  }
  if (tok.type == JSMN_ARRAY) {
    for (i = 0; i < tok.size; i++) {
      cur = ng_json_skip_token(doc, cur);
    }
    return cur;
  }
  return cur;
}

static int ng_json_key_equals(const NgJsonDoc *doc, int tok_idx,
                              const char *key) {
  size_t len;
  jsmntok_t tok;
  if (doc == NULL || key == NULL || tok_idx < 0 || tok_idx >= doc->count) {
    return 0;
  }
  tok = doc->tokens[tok_idx];
  if (tok.type != JSMN_STRING || tok.start < 0 || tok.end < tok.start) {
    return 0;
  }
  len = strlen(key);
  if ((size_t)(tok.end - tok.start) != len) {
    return 0;
  }
  return memcmp(doc->json + tok.start, key, len) == 0;
}

static int ng_json_object_get(const NgJsonDoc *doc, int obj_idx,
                              const char *key) {
  jsmntok_t tok;
  int i;
  int cur;
  if (doc == NULL || key == NULL || obj_idx < 0 || obj_idx >= doc->count) {
    return -1;
  }
  tok = doc->tokens[obj_idx];
  if (tok.type != JSMN_OBJECT) {
    return -1;
  }
  cur = obj_idx + 1;
  for (i = 0; i < tok.size; i++) {
    int key_idx = cur;
    int val_idx = cur + 1;
    if (ng_json_key_equals(doc, key_idx, key)) {
      return val_idx;
    }
    cur = ng_json_skip_token(doc, val_idx);
  }
  return -1;
}

static ng_u32 ng_json_token_u32(const NgJsonDoc *doc, int tok_idx,
                                ng_u32 fallback) {
  char buf[32];
  jsmntok_t tok;
  size_t len;
  unsigned long value;
  if (doc == NULL || tok_idx < 0 || tok_idx >= doc->count) {
    return fallback;
  }
  tok = doc->tokens[tok_idx];
  if (tok.start < 0 || tok.end < tok.start) {
    return fallback;
  }
  len = (size_t)(tok.end - tok.start);
  if (len == 0 || len >= sizeof(buf)) {
    return fallback;
  }
  memcpy(buf, doc->json + tok.start, len);
  buf[len] = '\0';
  value = strtoul(buf, NULL, 10);
  return (ng_u32)value;
}

static char *ng_json_token_dup(const NgJsonDoc *doc, int tok_idx) {
  jsmntok_t tok;
  size_t len;
  char *copy;
  if (doc == NULL || tok_idx < 0 || tok_idx >= doc->count) {
    return NULL;
  }
  tok = doc->tokens[tok_idx];
  if (tok.type == JSMN_PRIMITIVE) {
    if ((tok.end - tok.start) == 4 &&
        memcmp(doc->json + tok.start, "null", 4u) == 0) {
      return NULL;
    }
  }
  if (tok.start < 0 || tok.end < tok.start) {
    return NULL;
  }
  len = (size_t)(tok.end - tok.start);
  if (tok.type == JSMN_STRING) {
    return ng_json_unescape_copy(doc->json + tok.start, len);
  }
  copy = (char *)malloc(len + 1u);
  if (copy == NULL) {
    return NULL;
  }
  memcpy(copy, doc->json + tok.start, len);
  copy[len] = '\0';
  return copy;
}

static char *ng_strdup(const char *src) {
  size_t len;
  char *copy;
  if (src == NULL) {
    return NULL;
  }
  len = strlen(src);
  copy = (char *)malloc(len + 1u);
  if (copy == NULL) {
    return NULL;
  }
  memcpy(copy, src, len + 1u);
  return copy;
}

static ng_u32 ng_import_boundary_port_id(ng_u32 node_id, ng_u32 port_id) {
  if (node_id == 0 || port_id == 0) {
    return 0;
  }
  return node_id * NG_IMPORT_BOUNDARY_PORT_STRIDE + port_id;
}

static void ng_free_serialized_graph(NgSerializedGraph *graph) {
  ng_u32 i;
  ng_u32 j;
  if (graph == NULL) {
    return;
  }
  for (i = 0; i < graph->node_count; i++) {
    NgSerializedNode *node = &graph->nodes[i];
    free(node->code);
    free(node->code_path);
    for (j = 0; j < node->input_count; j++) {
      free(node->inputs[j].default_value);
    }
    for (j = 0; j < node->output_count; j++) {
      free(node->outputs[j].value);
    }
  }
  memset(graph, 0, sizeof(*graph));
}

static ng_i32 ng_parse_serialized_graph(const char *json, size_t len,
                                        NgSerializedGraph *out) {
  NgJsonDoc doc;
  jsmn_parser parser;
  int rc;
  int cur;
  int i;
  if (json == NULL || out == NULL) {
    return NG_ERR_INVALID_ARG;
  }
  memset(out, 0, sizeof(*out));
  doc.json = json;
  doc.tokens = NULL;
  doc.count = 0;
  jsmn_init(&parser);
  rc = jsmn_parse(&parser, json, len, NULL, 0);
  if (rc <= 0) {
    return NG_ERR_VALIDATION;
  }
  doc.count = rc;
  doc.tokens = (jsmntok_t *)malloc((size_t)doc.count * sizeof(jsmntok_t));
  if (doc.tokens == NULL) {
    return NG_ERR_RUNTIME;
  }
  jsmn_init(&parser);
  rc = jsmn_parse(&parser, json, len, doc.tokens, (unsigned int)doc.count);
  if (rc < 1 || doc.tokens[0].type != JSMN_ARRAY) {
    free(doc.tokens);
    return NG_ERR_VALIDATION;
  }
  doc.count = rc;
  cur = 1;
  for (i = 0; i < doc.tokens[0].size && out->node_count < NG_MAX_NODES; i++) {
    int node_idx = cur;
    int field_idx;
    int j;
    NgSerializedNode *node = &out->nodes[out->node_count++];
    memset(node, 0, sizeof(*node));
    node->id =
        ng_json_token_u32(&doc, ng_json_object_get(&doc, node_idx, "id"), 0);
    node->kind =
        ng_json_token_u32(&doc, ng_json_object_get(&doc, node_idx, "kind"), 0);
    node->graph_id = ng_json_token_u32(
        &doc, ng_json_object_get(&doc, node_idx, "graphId"), 0);
    node->code =
        ng_json_token_dup(&doc, ng_json_object_get(&doc, node_idx, "code"));
    node->code_path =
        ng_json_token_dup(&doc, ng_json_object_get(&doc, node_idx, "codePath"));

    field_idx = ng_json_object_get(&doc, node_idx, "inputs");
    if (field_idx >= 0 && doc.tokens[field_idx].type == JSMN_ARRAY) {
      int item = field_idx + 1;
      for (j = 0; j < doc.tokens[field_idx].size && j < (int)NG_MAX_INPUTS;
           j++) {
        int input_idx = item;
        NgSerializedInput *input = &node->inputs[node->input_count++];
        memset(input, 0, sizeof(*input));
        input->id = ng_json_token_u32(
            &doc, ng_json_object_get(&doc, input_idx, "id"), (ng_u32)j + 1u);
        input->src_node_id = ng_json_token_u32(
            &doc, ng_json_object_get(&doc, input_idx, "srcNodeId"), 0);
        input->src_output_id = ng_json_token_u32(
            &doc, ng_json_object_get(&doc, input_idx, "srcOutputId"), 0);
        input->default_value = ng_json_token_dup(
            &doc, ng_json_object_get(&doc, input_idx, "defaultValue"));
        item = ng_json_skip_token(&doc, input_idx);
      }
    }

    field_idx = ng_json_object_get(&doc, node_idx, "outputs");
    if (field_idx >= 0 && doc.tokens[field_idx].type == JSMN_ARRAY) {
      int item = field_idx + 1;
      for (j = 0; j < doc.tokens[field_idx].size && j < (int)NG_MAX_OUTPUTS;
           j++) {
        int output_idx = item;
        NgSerializedOutput *output = &node->outputs[node->output_count++];
        memset(output, 0, sizeof(*output));
        output->id = ng_json_token_u32(
            &doc, ng_json_object_get(&doc, output_idx, "id"), (ng_u32)j + 1u);
        output->value = ng_json_token_dup(
            &doc, ng_json_object_get(&doc, output_idx, "value"));
        item = ng_json_skip_token(&doc, output_idx);
      }
    }
    cur = ng_json_skip_token(&doc, node_idx);
  }
  free(doc.tokens);
  return NG_OK;
}

static void clear_value_store(void) {
  g_value_len = 0;
  memset(g_output_slots, 0, sizeof(g_output_slots));
}

static ng_i32 value_alloc_and_copy(const char *src, ng_i32 len) {
  ng_i32 off;
  if (src == NULL || len < 0)
    return -1;
  if (len == 0)
    return 0;
  if (g_value_len + len > NG_IO_BUFFER_CAP)
    return -1;
  off = g_value_len;
  memcpy(g_value_buf + off, src, (size_t)len);
  g_value_len += len;
  return off;
}

static void set_last_error(ng_i32 err) { g_info.last_error = err; }

static void output_text(const char *text) {
  pdk_output((const uint8_t *)text, (uint32_t)strlen(text));
}

static void output_u32(ng_u32 value) {
  char buffer[32];
  uint32_t len = 0;
  if (value == 0) {
    buffer[len++] = '0';
  } else {
    while (value > 0) {
      buffer[len++] = (char)('0' + (value % 10u));
      value /= 10u;
    }
    for (uint32_t i = 0; i < len / 2u; i++) {
      char t = buffer[i];
      buffer[i] = buffer[len - 1u - i];
      buffer[len - 1u - i] = t;
    }
  }
  pdk_output((const uint8_t *)buffer, len);
}

static ng_i32 parse_u32_input_text(const uint8_t *input, uint32_t len,
                                   ng_u32 *out) {
  ng_u32 value = 0;
  uint32_t digits = 0;
  if (len == 0) {
    return NG_ERR_INVALID_ARG;
  }
  for (uint32_t i = 0; i < len; i++) {
    uint8_t c = input[i];
    if (c == 0) break;
    if (c < '0' || c > '9') return NG_ERR_INVALID_ARG;
    value = value * 10u + (ng_u32)(c - '0');
    digits += 1u;
  }
  if (digits == 0) return NG_ERR_INVALID_ARG;
  *out = value;
  return NG_OK;
}

static int json_find_key_raw(const uint8_t *input, uint32_t len, const char *key,
                             uint32_t *key_pos_out) {
  uint32_t key_len = (uint32_t)strlen(key);
  if (len < key_len + 2u) return 0;
  for (uint32_t i = 0; i + key_len + 2u <= len; i++) {
    if (input[i] != '"') continue;
    uint32_t j = 0;
    while (j < key_len && input[i + 1u + j] == (uint8_t)key[j]) j += 1u;
    if (j != key_len) continue;
    if (input[i + 1u + key_len] != '"') continue;
    *key_pos_out = i;
    return 1;
  }
  return 0;
}

static int json_find_value_start_raw(const uint8_t *input, uint32_t len,
                                     uint32_t key_pos,
                                     uint32_t *value_pos_out) {
  uint32_t i = key_pos;
  while (i < len && input[i] != ':') i += 1u;
  if (i >= len) return 0;
  i += 1u;
  while (i < len && (input[i] == ' ' || input[i] == '\n' || input[i] == '\r' ||
                     input[i] == '\t')) {
    i += 1u;
  }
  if (i >= len) return 0;
  *value_pos_out = i;
  return 1;
}

static int json_extract_u32_raw(const uint8_t *input, uint32_t len,
                                const char *key, ng_u32 *out) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  ng_u32 value = 0;
  uint32_t digits = 0;
  if (!json_find_key_raw(input, len, key, &key_pos)) return 0;
  if (!json_find_value_start_raw(input, len, key_pos, &value_pos)) return 0;
  while (value_pos < len && input[value_pos] >= '0' && input[value_pos] <= '9') {
    value = value * 10u + (ng_u32)(input[value_pos] - '0');
    digits += 1u;
    value_pos += 1u;
  }
  if (digits == 0) return 0;
  *out = value;
  return 1;
}

static int json_extract_string_raw(const uint8_t *input, uint32_t len,
                                   const char *key, char *out,
                                   uint32_t out_cap) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  uint32_t out_len = 0;
  if (!json_find_key_raw(input, len, key, &key_pos)) return 0;
  if (!json_find_value_start_raw(input, len, key_pos, &value_pos)) return 0;
  if (input[value_pos] != '"') return 0;
  value_pos += 1u;
  while (value_pos < len) {
    uint8_t c = input[value_pos++];
    if (c == '"') break;
    if (c == '\\') {
      if (value_pos >= len) return 0;
      c = input[value_pos++];
    }
    if (out_len + 1u >= out_cap) return 0;
    out[out_len++] = (char)c;
  }
  out[out_len] = '\0';
  return 1;
}

static int json_extract_object_raw_raw(const uint8_t *input, uint32_t len,
                                       const char *key, char *out,
                                       uint32_t out_cap) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  uint32_t depth = 0;
  uint32_t out_len = 0;
  int in_string = 0;
  int escaped = 0;
  if (!json_find_key_raw(input, len, key, &key_pos)) return 0;
  if (!json_find_value_start_raw(input, len, key_pos, &value_pos)) return 0;
  if (input[value_pos] != '{') return 0;
  for (uint32_t i = value_pos; i < len; i++) {
    uint8_t c = input[i];
    if (out_len + 1u >= out_cap) return 0;
    out[out_len++] = (char)c;
    if (in_string) {
      if (escaped) escaped = 0;
      else if (c == '\\') escaped = 1;
      else if (c == '"') in_string = 0;
      continue;
    }
    if (c == '"') {
      in_string = 1;
      continue;
    }
    if (c == '{') depth += 1u;
    else if (c == '}') {
      depth -= 1u;
      if (depth == 0) {
        out[out_len] = '\0';
        return 1;
      }
    }
  }
  return 0;
}

static ng_i32 ng_sql_exec_cstr(const char *sql) {
  NgDirectCallResult result =
      ng_direct_call("sql", "exec", (const uint8_t *)sql, (uint32_t)strlen(sql));
  if (result.error != 0) {
    output_text("sql exec bridge failed");
    return NG_ERR_HOST;
  }
  if (result.return_code != 0) {
    clear_io();
    if (result.output != NULL && result.output_len > 0) {
      append_io((const char *)result.output, (size_t)result.output_len);
      pdk_output(result.output, result.output_len);
    } else {
      output_text("sql exec failed");
    }
    return NG_ERR_HOST;
  }
  return NG_OK;
}

static ng_i32 ng_sql_query_cstr(const char *sql, char *out, ng_i32 out_cap) {
  NgDirectCallResult result =
      ng_direct_call("sql", "query", (const uint8_t *)sql, (uint32_t)strlen(sql));
  if (result.error != 0) {
    output_text("sql query bridge failed");
    return NG_ERR_HOST;
  }
  if (result.return_code != 0) {
    clear_io();
    if (result.output != NULL && result.output_len > 0) {
      append_io((const char *)result.output, (size_t)result.output_len);
      pdk_output(result.output, result.output_len);
    } else {
      output_text("sql query failed");
    }
    return NG_ERR_HOST;
  }
  if ((ng_i32)result.output_len >= out_cap) {
    output_text("sql query output too large");
    return NG_ERR_CAPACITY;
  }
  if (result.output_len > 0 && result.output != NULL) {
    memcpy(out, result.output, (size_t)result.output_len);
  }
  out[result.output_len] = '\0';
  return NG_OK;
}

static void notify_node_changed(ng_u32 node_id, ng_u32 change_mask) {
  (void)node_id;
  (void)change_mask;
}

static void notify_run_event(ng_u32 node_id, ng_u32 event_kind,
                             ng_i32 error_code) {
  (void)node_id;
  (void)event_kind;
  (void)error_code;
}

static int ng_json_encode_slot(const NgValueSlot *slot, NgStrBuf *out) {
  int64_t i64;
  double f64;
  char num[64];
  int n;
  if (slot == NULL || slot->type == NG_VAL_EMPTY) {
    return ng_sb_append_len(out, "null", 4u);
  }
  if (slot->type == NG_VAL_BOOL) {
    return slot->a ? ng_sb_append_len(out, "true", 4u)
                   : ng_sb_append_len(out, "false", 5u);
  }
  if (slot->type == NG_VAL_I64) {
    i64 = join_i64(slot->a, slot->b);
    n = snprintf(num, sizeof(num), "%lld", (long long)i64);
    if (n <= 0 || (size_t)n >= sizeof(num)) {
      return 0;
    }
    return ng_sb_append_len(out, num, (size_t)n);
  }
  if (slot->type == NG_VAL_F64) {
    f64 = join_f64(slot->a, slot->b);
    if (!isfinite(f64)) {
      return ng_sb_append_len(out, "null", 4u);
    }
    n = snprintf(num, sizeof(num), "%.17g", f64);
    if (n <= 0 || (size_t)n >= sizeof(num)) {
      return 0;
    }
    return ng_sb_append_len(out, num, (size_t)n);
  }
  if ((slot->type == NG_VAL_STRING_REF || slot->type == NG_VAL_BYTES_REF) &&
      slot->a >= 0 && slot->b >= 0 && slot->a + slot->b <= g_value_len) {
    if (slot->type == NG_VAL_BYTES_REF) {
      return ng_json_encode_bytes(out, g_value_buf + slot->a, (size_t)slot->b);
    }
    return ng_json_encode_string(out, g_value_buf + slot->a, (size_t)slot->b);
  }
  return ng_sb_append_len(out, "null", 4u);
}

static void emit_goal_reached(NgNode *goal_node) {
  ng_u32 i;
  NgStrBuf payload;
  int ok = 1;
  if (goal_node == NULL || goal_node->kind != NG_NODE_GOAL)
    return;
  ng_sb_init(&payload);
  ok = ok && ng_sb_append_len(&payload, "{\"id\":", 6u);
  ok = ok && ng_sb_append_u32(&payload, goal_node->id);
  ok = ok && ng_sb_append_len(&payload, ",\"inputs\":{", 11u);
  for (i = 0; ok && i < goal_node->input_count; i++) {
    NgInputPort *in = &goal_node->inputs[i];
    NgValueSlot *slot = NULL;
    if (i > 0) {
      ok = ok && ng_sb_append_c(&payload, ',');
    }
    ok = ok && ng_sb_append_c(&payload, '"');
    ok = ok && ng_sb_append_u32(&payload, in->id);
    ok = ok && ng_sb_append_len(&payload, "\":", 2u);
    if (in->src_node_id != 0) {
      slot = find_output_slot_in(g_exec.nodes, g_exec.output_slots,
                                 in->src_node_id, in->src_output_id);
    }
    ok = ok && ng_json_encode_slot(slot, &payload);
  }
  ok = ok && ng_sb_append_len(&payload, "}}", 2u);
  if (ok) {
    (void)ng_batch_append_goal_payload(payload.buf, payload.len);
  } else {
    char fallback[32];
    int len = snprintf(fallback, sizeof(fallback), "{\"id\":%u,\"inputs\":{}}",
                       (unsigned)goal_node->id);
    if (len > 0 && (size_t)len < sizeof(fallback)) {
      (void)ng_batch_append_goal_payload(fallback, (size_t)len);
    }
  }
  ng_sb_free(&payload);
}

static void set_run_status(ng_u32 status) { g_info.run_status = status; }

static void set_waiting(ng_u32 request_id, ng_u32 node_id) {
  g_info.waiting_request_id = request_id;
  g_info.waiting_node_id = node_id;
}

static void clear_waiting(void) { set_waiting(0, 0); }

static void clear_io(void) {
  g_info.io_len = 0;
  g_info.io_buf[0] = '\0';
}

static void append_io(const char *s, size_t len) {
  size_t cap_left;
  if (len == 0 || g_info.io_len >= NG_IO_BUFFER_CAP - 1)
    return;
  cap_left = (size_t)((NG_IO_BUFFER_CAP - 1) - g_info.io_len);
  if (len > cap_left)
    len = cap_left;
  memcpy(g_info.io_buf + g_info.io_len, s, len);
  g_info.io_len += (ng_i32)len;
  g_info.io_buf[g_info.io_len] = '\0';
}

static int lua_print_bridge(lua_State *L) {
  int argc = lua_gettop(L);
  int i;
  for (i = 1; i <= argc; i++) {
    size_t len = 0;
    const char *s;
    luaL_tolstring(L, i, &len);
    s = lua_tostring(L, -1);
    append_io(s, len);
    if (i < argc)
      append_io("\t", 1);
    lua_pop(L, 1);
  }
  append_io("\n", 1);
  return 0;
}

static void open_safe_libs(lua_State *L) {
  luaL_requiref(L, "_G", luaopen_base, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_TABLIBNAME, luaopen_table, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_STRLIBNAME, luaopen_string, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_MATHLIBNAME, luaopen_math, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_UTF8LIBNAME, luaopen_utf8, 1);
  lua_pop(L, 1);
  register_json_csv_libs(L);
}

static ng_i32 init_lua(void) {
  if (g_lua != NULL) {
    lua_close(g_lua);
    g_lua = NULL;
  }
  g_lua = luaL_newstate();
  if (g_lua == NULL)
    return NG_ERR_RUNTIME;
  open_safe_libs(g_lua);
  lua_pushcfunction(g_lua, lua_print_bridge);
  lua_setglobal(g_lua, "print");
  return NG_OK;
}

static NgNode *find_node(ng_u32 node_id) {
  return find_node_in(g_info.nodes, node_id);
}

static NgNode *find_node_in(NgNode *nodes, ng_u32 node_id) {
  ng_u32 i;
  for (i = 0; i < NG_MAX_NODES; i++) {
    if (nodes[i].id == node_id)
      return &nodes[i];
  }
  return NULL;
}

static ng_i32 find_node_index(ng_u32 node_id) {
  return find_node_index_in(g_info.nodes, node_id);
}

static ng_i32 find_node_index_in(NgNode *nodes, ng_u32 node_id) {
  ng_u32 i;
  for (i = 0; i < NG_MAX_NODES; i++) {
    if (nodes[i].id == node_id)
      return (ng_i32)i;
  }
  return -1;
}

static NgNode *alloc_node_slot(void) {
  ng_u32 i;
  for (i = 0; i < NG_MAX_NODES; i++) {
    if (g_info.nodes[i].id == 0)
      return &g_info.nodes[i];
  }
  return NULL;
}

static ng_i32 find_input_index(NgNode *node, ng_u32 input_id) {
  ng_u32 i;
  for (i = 0; i < node->input_count; i++) {
    if (node->inputs[i].id == input_id)
      return (ng_i32)i;
  }
  return -1;
}

static ng_i32 find_output_index(NgNode *node, ng_u32 output_id) {
  ng_u32 i;
  for (i = 0; i < node->output_count; i++) {
    if (node->outputs[i].id == output_id)
      return (ng_i32)i;
  }
  return -1;
}

static void split_i64(int64_t v, ng_i32 *a, ng_i32 *b) {
  uint64_t u = (uint64_t)v;
  *a = (ng_i32)(u & 0xffffffffu);
  *b = (ng_i32)((u >> 32) & 0xffffffffu);
}

static int64_t join_i64(ng_i32 a, ng_i32 b) {
  uint64_t u = ((uint64_t)(uint32_t)b << 32) | (uint32_t)a;
  return (int64_t)u;
}

static void split_f64(double v, ng_i32 *a, ng_i32 *b) {
  uint64_t u = 0;
  memcpy(&u, &v, sizeof(u));
  *a = (ng_i32)(u & 0xffffffffu);
  *b = (ng_i32)((u >> 32) & 0xffffffffu);
}

static double join_f64(ng_i32 a, ng_i32 b) {
  uint64_t u = ((uint64_t)(uint32_t)b << 32) | (uint32_t)a;
  double v = 0;
  memcpy(&v, &u, sizeof(v));
  return v;
}

static void clear_node_output_slots(ng_i32 node_idx) {
  clear_node_output_slots_in(g_output_slots, node_idx);
}

static void
clear_node_output_slots_in(NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                           ng_i32 node_idx) {
  if (node_idx < 0 || node_idx >= (ng_i32)NG_MAX_NODES)
    return;
  memset(slots[node_idx], 0, sizeof(slots[node_idx]));
}

static NgValueSlot *find_output_slot(ng_u32 node_id, ng_u32 output_id) {
  return find_output_slot_in(g_info.nodes, g_output_slots, node_id, output_id);
}

static NgValueSlot *
find_output_slot_in(NgNode *nodes,
                    NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                    ng_u32 node_id, ng_u32 output_id) {
  ng_i32 node_idx = find_node_index_in(nodes, node_id);
  NgNode *node;
  ng_i32 out_idx;
  if (node_idx < 0)
    return NULL;
  node = &nodes[node_idx];
  out_idx = find_output_index(node, output_id);
  if (out_idx < 0)
    return NULL;
  return &slots[node_idx][out_idx];
}

static void push_slot_to_lua(lua_State *L, const NgValueSlot *slot) {
  if (slot == NULL || slot->type == NG_VAL_EMPTY) {
    lua_pushnil(L);
    return;
  }
  if (slot->type == NG_VAL_BOOL) {
    lua_pushboolean(L, slot->a ? 1 : 0);
    return;
  }
  if (slot->type == NG_VAL_I64) {
    lua_pushinteger(L, (lua_Integer)join_i64(slot->a, slot->b));
    return;
  }
  if (slot->type == NG_VAL_F64) {
    lua_pushnumber(L, (lua_Number)join_f64(slot->a, slot->b));
    return;
  }
  if ((slot->type == NG_VAL_STRING_REF || slot->type == NG_VAL_BYTES_REF) &&
      slot->a >= 0 && slot->b >= 0 && slot->a + slot->b <= g_value_len) {
    lua_pushlstring(L, g_value_buf + slot->a, (size_t)slot->b);
    return;
  }
  lua_pushnil(L);
}

static ng_i32 read_lua_to_slot(lua_State *L, int idx, NgValueSlot *slot) {
  int t = lua_type(L, idx);
  memset(slot, 0, sizeof(*slot));
  if (t == LUA_TNIL) {
    slot->type = NG_VAL_EMPTY;
    return NG_OK;
  }
  if (t == LUA_TBOOLEAN) {
    slot->type = NG_VAL_BOOL;
    slot->a = lua_toboolean(L, idx) ? 1 : 0;
    return NG_OK;
  }
  if (t == LUA_TNUMBER) {
    if (lua_isinteger(L, idx)) {
      int64_t v = (int64_t)lua_tointeger(L, idx);
      slot->type = NG_VAL_I64;
      split_i64(v, &slot->a, &slot->b);
      return NG_OK;
    }
    slot->type = NG_VAL_F64;
    split_f64((double)lua_tonumber(L, idx), &slot->a, &slot->b);
    return NG_OK;
  }
  {
    size_t len = 0;
    const char *s = lua_tolstring(L, idx, &len);
    ng_i32 off;
    if (s == NULL)
      return NG_ERR_VALIDATION;
    off = value_alloc_and_copy(s, (ng_i32)len);
    if (off < 0)
      return NG_ERR_CAPACITY;
    slot->type = NG_VAL_STRING_REF;
    slot->a = off;
    slot->b = (ng_i32)len;
    return NG_OK;
  }
}

static void
push_node_inputs_table_from(lua_State *co, NgNode *nodes,
                            NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                            NgNode *node) {
  ng_u32 i;
  lua_newtable(co);
  for (i = 0; i < node->input_count; i++) {
    NgInputPort *in = &node->inputs[i];
    NgValueSlot *slot = NULL;
    if (in->src_node_id != 0) {
      slot =
          find_output_slot_in(nodes, slots, in->src_node_id, in->src_output_id);
    }
    push_slot_to_lua(co, slot);
    lua_seti(co, -2, (lua_Integer)in->id);
  }
}

static void push_node_inputs_table(lua_State *co, NgNode *node) {
  push_node_inputs_table_from(co, g_info.nodes, g_output_slots, node);
}

static ng_i32
capture_node_outputs_into(lua_State *co, NgNode *node, ng_i32 node_idx,
                          NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS]) {
  ng_u32 i;
  clear_node_output_slots_in(slots, node_idx);
  if (lua_gettop(co) < 1 || !lua_istable(co, -1))
    return NG_OK;
  for (i = 0; i < node->output_count; i++) {
    NgValueSlot slot;
    ng_i32 err;
    lua_geti(co, -1, (lua_Integer)node->outputs[i].id);
    err = read_lua_to_slot(co, -1, &slot);
    lua_pop(co, 1);
    if (err != NG_OK)
      return err;
    slots[node_idx][i] = slot;
  }
  return NG_OK;
}

static ng_i32 capture_node_outputs(lua_State *co, NgNode *node,
                                   ng_i32 node_idx) {
  return capture_node_outputs_into(co, node, node_idx, g_output_slots);
}

static void mark_stale_downstream(ng_u32 src_node_id) {
  ng_u32 i;
  ng_u32 j;
  for (i = 0; i < NG_MAX_NODES; i++) {
    NgNode *node = &g_info.nodes[i];
    if (node->id == 0 || node->id == src_node_id)
      continue;
    for (j = 0; j < node->input_count; j++) {
      if (node->inputs[j].src_node_id == src_node_id) {
        if (node->exec_state == NG_EXEC_SUCCESS)
          node->exec_state = NG_EXEC_STALE;
        mark_stale_downstream(node->id);
        break;
      }
    }
  }
}

static void refresh_active_goal_count(void) {
  ng_u32 i;
  g_info.active_goal_count = 0;
  for (i = 0; i < NG_MAX_NODES; i++) {
    NgNode *node = &g_info.nodes[i];
    if (node->id == 0)
      continue;
    if (node->kind != NG_NODE_GOAL)
      continue;
    g_info.active_goal_count += 1;
  }
}

static ng_u32 ng_node_import_graph_id(const NgNode *node) {
  if (node == NULL || node->arg_count <= NG_ARG_IMPORT_GRAPH_ID) {
    return 0;
  }
  if (node->args[NG_ARG_IMPORT_GRAPH_ID].type != NG_VAL_I64) {
    return 0;
  }
  return (ng_u32)join_i64(node->args[NG_ARG_IMPORT_GRAPH_ID].a,
                          node->args[NG_ARG_IMPORT_GRAPH_ID].b);
}

static void ng_exec_graph_reset(void) {
  ng_u32 i;
  ng_u32 j;
  for (i = 0; i < NG_MAX_NODES; i++) {
    free(g_exec.meta[i].inline_code);
    free(g_exec.meta[i].code_path);
    for (j = 0; j < NG_MAX_OUTPUTS; j++) {
      free(g_exec.meta[i].value_defaults[j]);
      g_exec.meta[i].value_defaults[j] = NULL;
    }
  }
  memset(&g_exec, 0, sizeof(g_exec));
}

static ng_i32 ng_exec_add_node(const NgSerializedNode *src, ng_i32 preserve_ids,
                               ng_u32 owner_import_node_id, ng_u32 *out_id) {
  ng_u32 idx;
  NgNode *node;
  NgExecNodeMeta *meta;
  if (g_exec.node_count >= NG_MAX_NODES) {
    return NG_ERR_CAPACITY;
  }
  idx = g_exec.node_count++;
  node = &g_exec.nodes[idx];
  meta = &g_exec.meta[idx];
  memset(node, 0, sizeof(*node));
  memset(meta, 0, sizeof(*meta));
  node->id = preserve_ids ? src->id : g_exec.next_id++;
  node->kind = src->kind;
  node->exec_state = NG_EXEC_NEVER;
  node->input_count = src->input_count;
  node->output_count = src->output_count;
  if (node->input_count > NG_MAX_INPUTS ||
      node->output_count > NG_MAX_OUTPUTS) {
    return NG_ERR_CAPACITY;
  }
  meta->owner_node_id =
      owner_import_node_id != 0 ? owner_import_node_id : src->id;
  meta->owner_import_node_id = owner_import_node_id;
  meta->emit_goal = owner_import_node_id == 0 && src->kind == NG_NODE_GOAL;
  if (src->code != NULL) {
    meta->inline_code = ng_strdup(src->code);
  }
  if (src->code_path != NULL) {
    meta->code_path = ng_strdup(src->code_path);
  }
  for (idx = 0; idx < src->output_count; idx++) {
    if (src->outputs[idx].value != NULL) {
      meta->value_defaults[idx] = ng_strdup(src->outputs[idx].value);
    }
    node->outputs[idx].id = src->outputs[idx].id;
  }
  for (idx = 0; idx < src->input_count; idx++) {
    node->inputs[idx].id = src->inputs[idx].id;
  }
  *out_id = node->id;
  return NG_OK;
}

static ng_i32 ng_exec_find_node_index(ng_u32 node_id) {
  return find_node_index_in(g_exec.nodes, node_id);
}

static ng_u32 ng_map_compiled_id(const NgNodeIdMap *map, ng_u32 count,
                                 ng_u32 original_id) {
  ng_u32 i;
  for (i = 0; i < count; i++) {
    if (map[i].original_node_id == original_id) {
      return map[i].compiled_node_id;
    }
  }
  return 0;
}

static int ng_find_override(const NgSourceOverride *overrides, ng_u32 count,
                            ng_u32 from_node_id, ng_u32 from_output_id,
                            ng_u32 *to_node_id, ng_u32 *to_output_id) {
  ng_u32 i;
  for (i = 0; i < count; i++) {
    if (overrides[i].from_node_id != from_node_id) {
      continue;
    }
    if (overrides[i].from_output_id != 0 &&
        overrides[i].from_output_id != from_output_id) {
      continue;
    }
    *to_node_id = overrides[i].to_node_id;
    *to_output_id = overrides[i].to_output_id;
    return 1;
  }
  return 0;
}

static void ng_exec_mark_owner_state(ng_u32 owner_node_id, ng_u32 exec_state,
                                     ng_i32 err) {
  NgNode *owner = find_node(owner_node_id);
  if (owner == NULL) {
    return;
  }
  owner->exec_state = exec_state;
  owner->last_error = err;
}

static ng_i32 ng_load_graph_by_id(ng_u32 graph_id, NgSerializedGraph *out) {
  return ng_batch_load_graph_by_id(graph_id, out);
}

static ng_i32 ng_top_level_graph_to_serialized(NgSerializedGraph *out) {
  ng_u32 i;
  if (out == NULL) {
    return NG_ERR_INVALID_ARG;
  }
  memset(out, 0, sizeof(*out));
  for (i = 0; i < NG_MAX_NODES; i++) {
    NgNode *src = &g_info.nodes[i];
    NgSerializedNode *dst;
    ng_u32 j;
    if (src->id == 0) {
      continue;
    }
    const NgSerializedNode *batch_src = ng_batch_find_root_node(src->id);
    dst = &out->nodes[out->node_count++];
    memset(dst, 0, sizeof(*dst));
    dst->id = src->id;
    dst->kind = src->kind;
    dst->graph_id = ng_node_import_graph_id(src);
    dst->input_count = src->input_count;
    dst->output_count = src->output_count;
    if (batch_src != NULL) {
      if (batch_src->code != NULL) {
        dst->code = ng_strdup(batch_src->code);
      }
      if (batch_src->code_path != NULL) {
        dst->code_path = ng_strdup(batch_src->code_path);
      }
    }
    for (j = 0; j < src->input_count; j++) {
      dst->inputs[j].id = src->inputs[j].id;
      dst->inputs[j].src_node_id = src->inputs[j].src_node_id;
      dst->inputs[j].src_output_id = src->inputs[j].src_output_id;
    }
    for (j = 0; j < src->output_count; j++) {
      dst->outputs[j].id = src->outputs[j].id;
      if (batch_src != NULL && j < batch_src->output_count &&
          batch_src->outputs[j].value != NULL) {
        dst->outputs[j].value = ng_strdup(batch_src->outputs[j].value);
      }
    }
  }
  return NG_OK;
}

static ng_i32 ng_goal_export_for_node(
    const NgSerializedNode *goal, const NgNodeIdMap *local_map,
    ng_u32 local_map_count, const NgSourceOverride *overrides,
    ng_u32 override_count, NgGoalExport *exports, ng_u32 *export_count) {
  ng_u32 i;
  ng_u32 count = export_count != NULL ? *export_count : 0;
  if (goal == NULL || exports == NULL || export_count == NULL) {
    return NG_ERR_INVALID_ARG;
  }
  for (i = 0; i < goal->input_count; i++) {
    ng_u32 from_node_id = goal->inputs[i].src_node_id;
    ng_u32 from_output_id = goal->inputs[i].src_output_id;
    ng_u32 to_node_id = 0;
    ng_u32 to_output = 0;
    if (from_node_id == 0) {
      continue;
    }
    if (ng_find_override(overrides, override_count, from_node_id,
                         from_output_id, &to_node_id, &to_output)) {
      from_node_id = to_node_id;
      from_output_id = to_output;
    } else {
      to_node_id = ng_map_compiled_id(local_map, local_map_count, from_node_id);
      if (to_node_id != 0) {
        from_node_id = to_node_id;
      }
    }
    if (from_node_id == 0 || from_output_id == 0 || count >= NG_MAX_OUTPUTS) {
      continue;
    }
    exports[count].output_port_id =
        ng_import_boundary_port_id(goal->id, goal->inputs[i].id);
    exports[count].src_node_id = from_node_id;
    exports[count].src_output_id = from_output_id;
    count += 1u;
  }
  *export_count = count;
  return NG_OK;
}

static ng_i32 ng_compile_graph_recursive(
    const NgSerializedGraph *src_graph, ng_i32 preserve_ids,
    ng_u32 owner_import_node_id, const NgSourceOverride *base_overrides,
    ng_u32 base_override_count, const NgGraphStackEntry *stack,
    ng_u32 stack_depth, NgGoalExport *goal_exports, ng_u32 *goal_export_count) {
  NgNodeIdMap local_map[NG_MAX_NODES];
  NgSourceOverride overrides[NG_MAX_NODES];
  ng_u32 local_map_count = 0;
  ng_u32 override_count = 0;
  ng_u32 i;
  if (src_graph == NULL) {
    return NG_ERR_INVALID_ARG;
  }
  if (goal_export_count != NULL) {
    *goal_export_count = 0;
  }
  for (i = 0; i < base_override_count && i < NG_MAX_NODES; i++) {
    overrides[override_count++] = base_overrides[i];
  }
  for (i = 0; i < src_graph->node_count; i++) {
    const NgSerializedNode *src = &src_graph->nodes[i];
    ng_u32 compiled_id = 0;
    ng_u32 j;
    if (src->id == 0) {
      continue;
    }
    if (owner_import_node_id != 0 && src->kind == NG_NODE_GOAL) {
      continue;
    }
    if (src->kind == NG_NODE_CALL) {
      continue;
    }
    if (ng_exec_add_node(src, preserve_ids, owner_import_node_id,
                         &compiled_id) != NG_OK) {
      return NG_ERR_CAPACITY;
    }
    local_map[local_map_count].original_node_id = src->id;
    local_map[local_map_count].compiled_node_id = compiled_id;
    local_map_count += 1;
    for (j = 0; j < src->output_count; j++) {
      g_exec.nodes[ng_exec_find_node_index(compiled_id)].outputs[j].id =
          src->outputs[j].id;
    }
  }
  for (i = 0; i < src_graph->node_count; i++) {
    const NgSerializedNode *src = &src_graph->nodes[i];
    if (src->kind != NG_NODE_CALL) {
      continue;
    }
    if (src->graph_id != 0) {
      NgSerializedGraph imported;
      NgGraphStackEntry next_stack[NG_JSON_RECURSION_LIMIT];
      NgGoalExport child_exports[NG_MAX_OUTPUTS];
      NgSourceOverride child_overrides[NG_MAX_NODES];
      ng_u32 child_export_count = 0;
      ng_u32 child_override_count = 0;
      ng_u32 k;
      for (k = 0; k < stack_depth; k++) {
        if (stack[k].graph_id == src->graph_id) {
          return NG_ERR_VALIDATION;
        }
        next_stack[k] = stack[k];
      }
      next_stack[stack_depth].graph_id = src->graph_id;
      next_stack[stack_depth].import_node_id = src->id;
      if (ng_load_graph_by_id(src->graph_id, &imported) != NG_OK) {
        return NG_ERR_HOST;
      }
      for (k = 0;
           k < imported.node_count && child_override_count < NG_MAX_NODES;
           k++) {
        ng_u32 vi;
        if (imported.nodes[k].kind != NG_NODE_VALUE) {
          continue;
        }
        for (vi = 0; vi < imported.nodes[k].output_count &&
                     child_override_count < NG_MAX_NODES;
             vi++) {
          ng_u32 wrapper_input_id = ng_import_boundary_port_id(
              imported.nodes[k].id, imported.nodes[k].outputs[vi].id);
          ng_u32 src_node_id = 0;
          ng_u32 src_output_id = 0;
          ng_u32 mapped_node_id = 0;
          ng_u32 mapped_output_id = 0;
          ng_u32 si;
          for (si = 0; si < src->input_count; si++) {
            if (src->inputs[si].id == wrapper_input_id) {
              src_node_id = src->inputs[si].src_node_id;
              src_output_id = src->inputs[si].src_output_id;
              break;
            }
          }
          if (src_node_id == 0) {
            continue;
          }
          if (ng_find_override(overrides, override_count, src_node_id,
                               src_output_id, &mapped_node_id,
                               &mapped_output_id)) {
            src_node_id = mapped_node_id;
            src_output_id = mapped_output_id;
          } else {
            mapped_node_id =
                ng_map_compiled_id(local_map, local_map_count, src_node_id);
            if (mapped_node_id != 0) {
              src_node_id = mapped_node_id;
            }
          }
          child_overrides[child_override_count].from_node_id =
              imported.nodes[k].id;
          child_overrides[child_override_count].from_output_id =
              imported.nodes[k].outputs[vi].id;
          child_overrides[child_override_count].to_node_id = src_node_id;
          child_overrides[child_override_count].to_output_id = src_output_id;
          child_override_count += 1u;
        }
      }
      if (ng_compile_graph_recursive(
              &imported, 0,
              owner_import_node_id != 0 ? owner_import_node_id : src->id,
              child_overrides, child_override_count, next_stack,
              stack_depth + 1, child_exports, &child_export_count) != NG_OK) {
        ng_free_serialized_graph(&imported);
        return NG_ERR_RUNTIME;
      }
      if (owner_import_node_id == 0 &&
          g_exec.active_import_count < NG_MAX_NODES) {
        g_exec.active_import_ids[g_exec.active_import_count++] = src->id;
      }
      for (k = 0; k < child_export_count && override_count < NG_MAX_NODES;
           k++) {
        overrides[override_count].from_node_id = src->id;
        overrides[override_count].from_output_id =
            child_exports[k].output_port_id;
        overrides[override_count].to_node_id = child_exports[k].src_node_id;
        overrides[override_count].to_output_id = child_exports[k].src_output_id;
        override_count += 1;
      }
      ng_free_serialized_graph(&imported);
    }
  }
  for (i = 0; i < src_graph->node_count; i++) {
    const NgSerializedNode *src = &src_graph->nodes[i];
    ng_u32 compiled_id =
        ng_map_compiled_id(local_map, local_map_count, src->id);
    ng_i32 exec_idx;
    ng_u32 j;
    if (compiled_id == 0) {
      continue;
    }
    exec_idx = ng_exec_find_node_index(compiled_id);
    if (exec_idx < 0) {
      continue;
    }
    for (j = 0; j < src->input_count; j++) {
      ng_u32 src_node_id = src->inputs[j].src_node_id;
      ng_u32 src_output_id = src->inputs[j].src_output_id;
      ng_u32 mapped_node_id = 0;
      ng_u32 mapped_output_id = 0;
      g_exec.nodes[exec_idx].inputs[j].id = src->inputs[j].id;
      if (src_node_id == 0) {
        continue;
      }
      if (ng_find_override(overrides, override_count, src_node_id,
                           src_output_id, &mapped_node_id, &mapped_output_id)) {
        src_node_id = mapped_node_id;
        src_output_id = mapped_output_id;
      } else {
        mapped_node_id =
            ng_map_compiled_id(local_map, local_map_count, src_node_id);
        if (mapped_node_id != 0) {
          src_node_id = mapped_node_id;
        }
      }
      g_exec.nodes[exec_idx].inputs[j].src_node_id = src_node_id;
      g_exec.nodes[exec_idx].inputs[j].src_output_id = src_output_id;
    }
  }
  if (owner_import_node_id != 0 && goal_exports != NULL &&
      goal_export_count != NULL) {
    ng_u32 out_idx = 0;
    for (i = 0; i < src_graph->node_count && out_idx < NG_MAX_OUTPUTS; i++) {
      const NgSerializedNode *src = &src_graph->nodes[i];
      if (src->kind != NG_NODE_GOAL) {
        continue;
      }
      if (ng_goal_export_for_node(src, local_map, local_map_count, overrides,
                                  override_count, goal_exports,
                                  &out_idx) != NG_OK) {
        return NG_ERR_RUNTIME;
      }
    }
    *goal_export_count = out_idx;
  }
  return NG_OK;
}

static ng_i32 ng_build_exec_graph(void) {
  NgSerializedGraph root;
  ng_i32 err;
  NgGraphStackEntry stack[1];
  ng_u32 dummy = 0;
  ng_exec_graph_reset();
  err = ng_top_level_graph_to_serialized(&root);
  if (err != NG_OK) {
    return err;
  }
  g_exec.next_id = 1;
  {
    ng_u32 i;
    for (i = 0; i < root.node_count; i++) {
      if (root.nodes[i].id >= g_exec.next_id) {
        g_exec.next_id = root.nodes[i].id + 1u;
      }
    }
  }
  stack[0].graph_id = 0;
  stack[0].import_node_id = 0;
  err =
      ng_compile_graph_recursive(&root, 1, 0, NULL, 0, stack, 0, NULL, &dummy);
  ng_free_serialized_graph(&root);
  return err;
}

static int lua_host_await_call(lua_State *L) {
  size_t service_len = 0;
  size_t method_len = 0;
  size_t payload_len = 0;
  const char *service;
  const char *method;
  const char *payload = "";
  NgDirectCallResult result;

  if (!lua_isstring(L, 1) || !lua_isstring(L, 2))
    return luaL_error(L, "host.awaitCall(moduleName, functionName, input?)");

  service = lua_tolstring(L, 1, &service_len);
  method = lua_tolstring(L, 2, &method_len);
  if (lua_gettop(L) >= 3 && lua_isstring(L, 3))
    payload = lua_tolstring(L, 3, &payload_len);
  else
    payload_len = 0;

  if (!g_run.active)
    return luaL_error(L, "awaitCall outside active run");

  if (service_len <= 0 || method_len <= 0)
    return luaL_error(L, "awaitCall requires moduleName and functionName");

  (void)service_len;
  (void)method_len;
  result = ng_direct_call(service, method, (const uint8_t *)payload,
                          (uint32_t)payload_len);
  if (result.error != 0) {
    return luaL_error(L, "host.call transport failed");
  }
  if (result.return_code != 0) {
    lua_pushlstring(L, (const char *)(result.output != NULL ? result.output : (const uint8_t *)""),
                    (size_t)result.output_len);
    return lua_error(L);
  }
  lua_pushlstring(L,
                  (const char *)(result.output != NULL ? result.output : (const uint8_t *)""),
                  (size_t)result.output_len);
  return 1;
}

static int lua_host_await_call_cont(lua_State *L, int status,
                                    lua_KContext ctx) {
  (void)status;
  (void)ctx;
  if (g_run.response_is_error) {
    lua_pushlstring(L, g_resp_buf, (size_t)g_run.response_len);
    return lua_error(L);
  }
  lua_pushlstring(L, g_resp_buf, (size_t)g_run.response_len);
  return 1;
}

static ng_i32 load_wrapped_code(lua_State *L, const char *src, size_t len) {
  int status;
  luaL_Buffer b;
  luaL_buffinit(L, &b);
  luaL_addstring(&b,
                 "return function(inputs, host)\n"
                 "local outputs = {}\n"
                 "local __node_main = function()\n");
  luaL_addlstring(&b, src, len);
  luaL_addstring(&b,
                 "\nend\n"
                 "local __node_result = __node_main()\n"
                 "if type(__node_result) == 'table' then\n"
                 "  return __node_result\n"
                 "end\n"
                 "return outputs\n"
                 "end");
  luaL_pushresult(&b);

  status = luaL_loadbufferx(L, lua_tostring(L, -1), (size_t)lua_rawlen(L, -1),
                            "node-code", "t");
  lua_remove(L, -2);
  if (status != LUA_OK)
    return NG_ERR_RUNTIME;
  status = lua_pcall(L, 0, 1, 0);
  if (status != LUA_OK)
    return NG_ERR_RUNTIME;
  if (!lua_isfunction(L, -1)) {
    lua_pop(L, 1);
    return NG_ERR_RUNTIME;
  }
  return NG_OK;
}

static ng_i32
start_code_coroutine(ng_u32 node_id, NgNode *nodes,
                     NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                     NgNode *node, ng_i32 node_idx, const char *src,
                     size_t len) {
  int status;
  int nres = 0;
  lua_State *co;
  ng_i32 err = load_wrapped_code(g_lua, src, len);
  if (err != NG_OK) {
    const char *msg = lua_tostring(g_lua, -1);
    if (msg != NULL) {
      clear_io();
      append_io(msg, strlen(msg));
    }
    lua_settop(g_lua, 0);
    return err;
  }

  co = lua_newthread(g_lua);
  g_run.pending_co_ref = luaL_ref(g_lua, LUA_REGISTRYINDEX);
  g_run.pending_co = co;
  lua_xmove(g_lua, co, 1);

  push_node_inputs_table_from(co, nodes, slots, node);
  lua_newtable(co);
  lua_pushcfunction(co, lua_host_await_call);
  lua_setfield(co, -2, "awaitCall");
  lua_pushcfunction(co, lua_host_await_call);
  lua_setfield(co, -2, "call");

  g_run.pending_node_id = node_id;
  status = lua_resume(co, NULL, 2, &nres);
  if (status == LUA_YIELD)
    return NG_ERR_HOST;
  if (status != LUA_OK) {
    const char *msg = lua_tostring(co, -1);
    if (msg != NULL) {
      clear_io();
      append_io(msg, strlen(msg));
    }
    return NG_ERR_RUNTIME;
  }
  err = capture_node_outputs_into(co, node, node_idx, slots);
  lua_settop(co, 0);
  return err;
}

static ng_i32
resume_code_coroutine(NgValueSlot slots[NG_MAX_NODES][NG_MAX_OUTPUTS],
                      NgNode *node, ng_i32 node_idx) {
  int status;
  int nres = 0;
  ng_i32 err = NG_OK;
  lua_State *co = g_run.pending_co;
  if (co == NULL)
    return NG_ERR_RUNTIME;
  status = lua_resume(co, NULL, 0, &nres);
  if (status == LUA_YIELD)
    return NG_ERR_HOST;
  if (status != LUA_OK) {
    const char *msg = lua_tostring(co, -1);
    if (msg != NULL) {
      clear_io();
      append_io(msg, strlen(msg));
    }
    return NG_ERR_RUNTIME;
  }
  err = capture_node_outputs_into(co, node, node_idx, slots);
  lua_settop(co, 0);
  return err;
}

static void clear_pending_coroutine(void) {
  if (g_lua != NULL && g_run.pending_co_ref > 0) {
    luaL_unref(g_lua, LUA_REGISTRYINDEX, g_run.pending_co_ref);
  }
  g_run.pending_co_ref = LUA_NOREF;
  g_run.pending_co = NULL;
  g_run.pending_node_id = 0;
  g_run.pending_request_id = 0;
  g_run.has_response = 0;
  g_run.response_is_error = 0;
  g_run.response_len = 0;
  clear_waiting();
}

static ng_i32 execute_node(ng_u32 node_id, ng_u8 *visit);

static ng_i32 execute_dependencies(NgNode *node, ng_u8 *visit) {
  ng_u32 i;
  for (i = 0; i < node->input_count; i++) {
    NgInputPort *in = &node->inputs[i];
    if (in->src_node_id != 0) {
      ng_i32 err = execute_node(in->src_node_id, visit);
      if (err != NG_OK)
        return err;
    }
  }
  return NG_OK;
}

static ng_i32 execute_node(ng_u32 node_id, ng_u8 *visit) {
  ng_i32 idx;
  NgNode *node;
  NgExecNodeMeta *meta;
  ng_i32 err;
  ng_i32 out_len;
  ng_u32 owner_node_id;
  int emit_events;

  idx = find_node_index_in(g_exec.nodes, node_id);
  if (idx < 0)
    return NG_ERR_NOT_FOUND;
  if (visit[idx] == 1)
    return NG_ERR_VALIDATION;
  if (visit[idx] == 2)
    return NG_OK;

  node = &g_exec.nodes[idx];
  meta = &g_exec.meta[idx];
  owner_node_id = meta->owner_node_id != 0 ? meta->owner_node_id : node->id;
  emit_events = meta->owner_import_node_id == 0;
  visit[idx] = 1;

  if (node->exec_state == NG_EXEC_SUCCESS) {
    visit[idx] = 2;
    return NG_OK;
  }

  err = execute_dependencies(node, visit);
  if (err == NG_ERR_HOST) {
    visit[idx] = 2;
    return NG_ERR_HOST;
  }
  if (err != NG_OK) {
    node->exec_state = NG_EXEC_ERROR;
    node->last_error = err;
    ng_exec_mark_owner_state(owner_node_id, NG_EXEC_ERROR, err);
    if (emit_events) {
      notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_FAILED, err);
    }
    visit[idx] = 2;
    return err;
  }

  if (emit_events) {
    notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_STARTED, NG_OK);
  }
  if (node->kind == NG_NODE_CODE) {
    if (g_run.pending_node_id == node->id && g_run.has_response) {
      err = resume_code_coroutine(g_exec.output_slots, node, idx);
      if (err == NG_ERR_HOST) {
        visit[idx] = 2;
        return NG_ERR_HOST;
      }
      clear_pending_coroutine();
    } else {
      if (meta->inline_code != NULL) {
        out_len = (ng_i32)strlen(meta->inline_code);
        if (out_len >= NG_IO_BUFFER_CAP) {
          err = NG_ERR_CAPACITY;
        } else {
          memcpy(g_code_buf, meta->inline_code, (size_t)out_len);
          g_code_buf[out_len] = '\0';
          err = NG_OK;
        }
      } else if (meta->code_path != NULL) {
        out_len = 0;
        err = ng_batch_read_file(meta->code_path, g_code_buf, NG_IO_BUFFER_CAP,
                                 &out_len);
      } else {
        out_len = 0;
        err = NG_ERR_INVALID_ARG;
      }
      if (err != NG_OK || out_len < 0) {
        node->exec_state = NG_EXEC_ERROR;
        node->last_error = NG_ERR_HOST;
        ng_exec_mark_owner_state(owner_node_id, NG_EXEC_ERROR, NG_ERR_HOST);
        if (emit_events) {
          notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_FAILED,
                           NG_ERR_HOST);
        }
        visit[idx] = 2;
        return NG_ERR_HOST;
      }
      err = start_code_coroutine(node->id, g_exec.nodes, g_exec.output_slots,
                                 node, idx, g_code_buf, (size_t)out_len);
      if (err == NG_ERR_HOST) {
        visit[idx] = 2;
        return NG_ERR_HOST;
      }
    }
    if (err != NG_OK) {
      node->exec_state = NG_EXEC_ERROR;
      node->last_error = err;
      ng_exec_mark_owner_state(owner_node_id, NG_EXEC_ERROR, err);
      if (emit_events) {
        notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_FAILED, err);
      }
      visit[idx] = 2;
      return err;
    }
  } else if (node->kind == NG_NODE_VALUE) {
    ng_u32 oi;
    clear_node_output_slots_in(g_exec.output_slots, idx);
    for (oi = 0; oi < node->output_count; oi++) {
      ng_u32 out_id = node->outputs[oi].id;
      NgValueSlot slot;
      ng_i32 off;
      const char *default_value = meta->value_defaults[oi];
      memset(&slot, 0, sizeof(slot));
      if (default_value != NULL) {
        out_len = (ng_i32)strlen(default_value);
        err = NG_OK;
        memcpy(g_code_buf, default_value, (size_t)out_len);
      } else {
        out_len = 0;
        err = NG_OK;
      }
      if (err != NG_OK || out_len < 0) {
        node->exec_state = NG_EXEC_ERROR;
        node->last_error = NG_ERR_HOST;
        ng_exec_mark_owner_state(owner_node_id, NG_EXEC_ERROR, NG_ERR_HOST);
        if (emit_events) {
          notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_FAILED,
                           NG_ERR_HOST);
        }
        visit[idx] = 2;
        return NG_ERR_HOST;
      }
      if (out_len > 0) {
        off = value_alloc_and_copy(g_code_buf, out_len);
        if (off < 0) {
          node->exec_state = NG_EXEC_ERROR;
          node->last_error = NG_ERR_CAPACITY;
          ng_exec_mark_owner_state(owner_node_id, NG_EXEC_ERROR,
                                   NG_ERR_CAPACITY);
          if (emit_events) {
            notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_FAILED,
                             NG_ERR_CAPACITY);
          }
          visit[idx] = 2;
          return NG_ERR_CAPACITY;
        }
        slot.type = NG_VAL_STRING_REF;
        slot.a = off;
        slot.b = out_len;
      } else {
        slot.type = NG_VAL_EMPTY;
      }
      g_exec.output_slots[idx][oi] = slot;
    }
  }

  if (node->kind == NG_NODE_GOAL && meta->emit_goal) {
    emit_goal_reached(node);
  }

  node->exec_state = NG_EXEC_SUCCESS;
  node->last_error = NG_OK;
  ng_exec_mark_owner_state(owner_node_id, NG_EXEC_SUCCESS, NG_OK);
  if (emit_events) {
    notify_run_event(owner_node_id, NG_RUN_EVENT_NODE_SUCCEEDED, NG_OK);
  }
  visit[idx] = 2;
  return NG_OK;
}

ng_i32 ng_init(void) {
  memset(&g_info, 0, sizeof(g_info));
  memset(&g_run, 0, sizeof(g_run));
  g_run.pending_co_ref = LUA_NOREF;
  ng_exec_graph_reset();
  clear_value_store();
  if (init_lua() != NG_OK) {
    g_info.initialized = 0;
    set_last_error(NG_ERR_RUNTIME);
    return NG_ERR_RUNTIME;
  }
  g_info.initialized = 1;
  set_run_status(NG_RUN_IDLE);
  set_last_error(NG_OK);
  return NG_OK;
}

ng_i32 ng_get_info_ptr(void) { return (ng_i32)(intptr_t)&g_info; }

ng_i32 ng_clear_graph(void) {
  ng_i32 initialized = g_info.initialized;
  memset(g_info.nodes, 0, sizeof(g_info.nodes));
  g_info.node_count = 0;
  g_info.active_goal_count = 0;
  clear_pending_coroutine();
  memset(&g_run, 0, sizeof(g_run));
  g_run.pending_co_ref = LUA_NOREF;
  ng_exec_graph_reset();
  clear_value_store();
  clear_io();
  set_run_status(NG_RUN_IDLE);
  clear_waiting();
  g_info.generation += 1;
  g_info.initialized = initialized;
  set_last_error(NG_OK);
  notify_node_changed(0, NG_CHANGE_GRAPH);
  return NG_OK;
}

ng_i32 ng_node_create(ng_u32 node_id, ng_u32 kind) {
  NgNode *node;
  if (node_id == 0)
    return NG_ERR_INVALID_ARG;
  if (find_node(node_id) != NULL)
    return NG_ERR_VALIDATION;
  node = alloc_node_slot();
  if (node == NULL)
    return NG_ERR_CAPACITY;
  memset(node, 0, sizeof(*node));
  node->id = node_id;
  node->kind = kind;
  node->exec_state = NG_EXEC_NEVER;
  g_info.node_count += 1;
  refresh_active_goal_count();
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_META | NG_CHANGE_GRAPH);
  return NG_OK;
}

ng_i32 ng_node_replace(ng_u32 node_id, ng_u32 kind) {
  NgNode *node = find_node(node_id);
  ng_i32 node_idx = find_node_index(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  memset(node, 0, sizeof(*node));
  node->id = node_id;
  node->kind = kind;
  node->exec_state = NG_EXEC_NEVER;
  clear_node_output_slots(node_idx);
  refresh_active_goal_count();
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_META | NG_CHANGE_NODE_PORTS |
                                   NG_CHANGE_NODE_ARGS |
                                   NG_CHANGE_NODE_CONNECTIONS |
                                   NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_node_delete(ng_u32 node_id) {
  ng_u32 i;
  ng_u32 j;
  ng_i32 node_idx = find_node_index(node_id);
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  memset(node, 0, sizeof(*node));
  clear_node_output_slots(node_idx);
  refresh_active_goal_count();
  if (g_info.node_count > 0)
    g_info.node_count -= 1;
  for (i = 0; i < NG_MAX_NODES; i++) {
    NgNode *n = &g_info.nodes[i];
    if (n->id == 0)
      continue;
    for (j = 0; j < n->input_count; j++) {
      if (n->inputs[j].src_node_id == node_id) {
        n->inputs[j].src_node_id = 0;
        n->inputs[j].src_output_id = 0;
        if (n->exec_state == NG_EXEC_SUCCESS)
          n->exec_state = NG_EXEC_STALE;
      }
    }
  }
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_GRAPH);
  return NG_OK;
}

ng_i32 ng_input_add(ng_u32 node_id, ng_u32 input_id) {
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  if (node->kind == NG_NODE_VALUE)
    return NG_ERR_VALIDATION;
  if (node->input_count >= NG_MAX_INPUTS)
    return NG_ERR_CAPACITY;
  if (find_input_index(node, input_id) >= 0)
    return NG_ERR_VALIDATION;
  node->inputs[node->input_count].id = input_id;
  node->inputs[node->input_count].src_node_id = 0;
  node->inputs[node->input_count].src_output_id = 0;
  node->input_count += 1;
  node->generation += 1;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_PORTS | NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_input_remove(ng_u32 node_id, ng_u32 input_id) {
  ng_i32 idx;
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  idx = find_input_index(node, input_id);
  if (idx < 0)
    return NG_ERR_NOT_FOUND;
  if ((ng_u32)idx + 1 < node->input_count) {
    memmove(&node->inputs[idx], &node->inputs[idx + 1],
            (size_t)(node->input_count - ((ng_u32)idx + 1)) *
                sizeof(NgInputPort));
  }
  node->input_count -= 1;
  node->generation += 1;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_PORTS |
                                   NG_CHANGE_NODE_CONNECTIONS |
                                   NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_output_add(ng_u32 node_id, ng_u32 output_id) {
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  if (node->kind == NG_NODE_GOAL)
    return NG_ERR_VALIDATION;
  if (node->output_count >= NG_MAX_OUTPUTS)
    return NG_ERR_CAPACITY;
  if (find_output_index(node, output_id) >= 0)
    return NG_ERR_VALIDATION;
  node->outputs[node->output_count].id = output_id;
  node->output_count += 1;
  node->generation += 1;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_PORTS | NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_output_remove(ng_u32 node_id, ng_u32 output_id) {
  ng_i32 idx;
  ng_u32 i;
  ng_u32 j;
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  idx = find_output_index(node, output_id);
  if (idx < 0)
    return NG_ERR_NOT_FOUND;
  if ((ng_u32)idx + 1 < node->output_count) {
    memmove(&node->outputs[idx], &node->outputs[idx + 1],
            (size_t)(node->output_count - ((ng_u32)idx + 1)) *
                sizeof(NgOutputPort));
  }
  node->output_count -= 1;
  for (i = 0; i < NG_MAX_NODES; i++) {
    NgNode *n = &g_info.nodes[i];
    if (n->id == 0)
      continue;
    for (j = 0; j < n->input_count; j++) {
      if (n->inputs[j].src_node_id == node_id &&
          n->inputs[j].src_output_id == output_id) {
        n->inputs[j].src_node_id = 0;
        n->inputs[j].src_output_id = 0;
        if (n->exec_state == NG_EXEC_SUCCESS)
          n->exec_state = NG_EXEC_STALE;
      }
    }
  }
  node->generation += 1;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_PORTS |
                                   NG_CHANGE_NODE_CONNECTIONS |
                                   NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_input_connect(ng_u32 node_id, ng_u32 input_id, ng_u32 src_node_id,
                        ng_u32 src_output_id) {
  ng_i32 in_idx;
  NgNode *node = find_node(node_id);
  NgNode *src = find_node(src_node_id);
  if (node == NULL || src == NULL)
    return NG_ERR_NOT_FOUND;
  in_idx = find_input_index(node, input_id);
  if (in_idx < 0)
    return NG_ERR_NOT_FOUND;
  if (find_output_index(src, src_output_id) < 0)
    return NG_ERR_NOT_FOUND;
  node->inputs[in_idx].src_node_id = src_node_id;
  node->inputs[in_idx].src_output_id = src_output_id;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  node->generation += 1;
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id,
                      NG_CHANGE_NODE_CONNECTIONS | NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_input_disconnect(ng_u32 node_id, ng_u32 input_id) {
  ng_i32 in_idx;
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  in_idx = find_input_index(node, input_id);
  if (in_idx < 0)
    return NG_ERR_NOT_FOUND;
  node->inputs[in_idx].src_node_id = 0;
  node->inputs[in_idx].src_output_id = 0;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  node->generation += 1;
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id,
                      NG_CHANGE_NODE_CONNECTIONS | NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_node_set_arg(ng_u32 node_id, ng_u32 arg_index, ng_u32 type, ng_i32 a,
                       ng_i32 b) {
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  if (arg_index >= NG_MAX_ARGS)
    return NG_ERR_INVALID_ARG;
  node->args[arg_index].type = type;
  node->args[arg_index].a = a;
  node->args[arg_index].b = b;
  if (arg_index + 1 > node->arg_count)
    node->arg_count = arg_index + 1;
  if (node->exec_state == NG_EXEC_SUCCESS)
    node->exec_state = NG_EXEC_STALE;
  mark_stale_downstream(node_id);
  node->generation += 1;
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_ARGS | NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

static ng_i32 execute_goal_with_fresh_visit(ng_u32 goal_node_id) {
  ng_u8 visit[NG_MAX_NODES];
  memset(visit, 0, sizeof(visit));
  return execute_node(goal_node_id, visit);
}

static ng_i32 continue_active_run(void) {
  ng_u32 i;
  ng_i32 err = NG_OK;
  if (!g_run.active)
    return NG_ERR_VALIDATION;
  if (g_run.cancelled) {
    set_run_status(NG_RUN_CANCELLED);
    g_run.active = 0;
    g_info.is_running = 0;
    return NG_ERR_RUNTIME;
  }

  if (g_run.target_goal_id != 0) {
    err = execute_goal_with_fresh_visit(g_run.target_goal_id);
    if (err == NG_ERR_HOST && g_run.pending_request_id != 0) {
      set_run_status(NG_RUN_WAITING);
      return NG_OK;
    }
    if (err != NG_OK) {
      set_run_status(NG_RUN_ERROR);
      g_run.active = 0;
      g_info.is_running = 0;
      notify_run_event(0, NG_RUN_EVENT_RUN_FINISHED, err);
      set_last_error(err);
      return err;
    }
    for (i = 0; i < g_exec.active_import_count; i++) {
      ng_exec_mark_owner_state(g_exec.active_import_ids[i], NG_EXEC_SUCCESS,
                               NG_OK);
    }
    set_run_status(NG_RUN_DONE);
    g_run.active = 0;
    g_info.is_running = 0;
    notify_run_event(0, NG_RUN_EVENT_RUN_FINISHED, NG_OK);
    set_last_error(NG_OK);
    return NG_OK;
  }

  for (i = g_run.next_goal_scan; i < NG_MAX_NODES; i++) {
    NgNode *node = &g_exec.nodes[i];
    if (node->id == 0 || node->kind != NG_NODE_GOAL)
      continue;
    g_run.next_goal_scan = i;
    err = execute_goal_with_fresh_visit(node->id);
    if (err == NG_ERR_HOST && g_run.pending_request_id != 0) {
      set_run_status(NG_RUN_WAITING);
      return NG_OK;
    }
    if (err != NG_OK) {
      set_run_status(NG_RUN_ERROR);
      g_run.active = 0;
      g_info.is_running = 0;
      notify_run_event(0, NG_RUN_EVENT_RUN_FINISHED, err);
      set_last_error(err);
      return err;
    }
    g_run.next_goal_scan = i + 1;
  }

  for (i = 0; i < g_exec.active_import_count; i++) {
    ng_exec_mark_owner_state(g_exec.active_import_ids[i], NG_EXEC_SUCCESS,
                             NG_OK);
  }
  set_run_status(NG_RUN_DONE);
  g_run.active = 0;
  g_info.is_running = 0;
  notify_run_event(0, NG_RUN_EVENT_RUN_FINISHED, NG_OK);
  set_last_error(NG_OK);
  return NG_OK;
}

ng_i32 ng_run_start(ng_u32 goal_node_id) {
  NgNode *goal = NULL;
  ng_u32 i;
  ng_i32 err;
  if (!g_info.initialized)
    return NG_ERR_NOT_INITIALIZED;
  if (g_run.active)
    return NG_ERR_VALIDATION;
  if (goal_node_id != 0) {
    goal = find_node(goal_node_id);
    if (goal == NULL)
      return NG_ERR_NOT_FOUND;
    if (goal->kind != NG_NODE_GOAL)
      return NG_ERR_VALIDATION;
  }

  memset(&g_run, 0, sizeof(g_run));
  g_run.active = 1;
  g_run.target_goal_id = goal_node_id;
  g_run.next_goal_scan = 0;
  g_run.next_request_id = 0;
  g_run.pending_co_ref = LUA_NOREF;
  clear_value_store();
  clear_io();
  for (i = 0; i < NG_MAX_NODES; i++) {
    if (g_info.nodes[i].id != 0) {
      g_info.nodes[i].exec_state = NG_EXEC_NEVER;
      g_info.nodes[i].last_error = NG_OK;
    }
  }
  err = ng_build_exec_graph();
  if (err != NG_OK) {
    g_run.active = 0;
    set_last_error(err);
    return err;
  }
  g_info.is_running = 1;
  set_run_status(NG_RUN_RUNNING);
  clear_waiting();
  notify_run_event(0, NG_RUN_EVENT_RUN_STARTED, NG_OK);
  return continue_active_run();
}

ng_i32 ng_run_cancel(void) {
  if (!g_run.active)
    return NG_OK;
  g_run.cancelled = 1;
  clear_pending_coroutine();
  ng_exec_graph_reset();
  g_run.active = 0;
  g_info.is_running = 0;
  set_run_status(NG_RUN_CANCELLED);
  notify_run_event(0, NG_RUN_EVENT_RUN_FINISHED, NG_ERR_RUNTIME);
  set_last_error(NG_ERR_RUNTIME);
  return NG_OK;
}

ng_i32 ng_run_goal(ng_u32 goal_node_id) {
  ng_i32 err = ng_run_start(goal_node_id);
  if (err != NG_OK)
    return err;
  if (g_info.run_status == NG_RUN_WAITING)
    return NG_OK;
  g_info.is_running = 0;
  return g_info.last_error;
}

ng_i32 ng_run_all_goals(void) {
  ng_i32 err;
  refresh_active_goal_count();
  err = ng_run_start(0);
  if (err != NG_OK)
    return err;
  if (g_info.run_status == NG_RUN_WAITING)
    return NG_OK;
  g_info.is_running = 0;
  return g_info.last_error;
}

ng_i32 ng_exec_clear(ng_u32 node_id, ng_i32 recursive_downstream) {
  ng_u32 i;
  ng_u32 j;
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return NG_ERR_NOT_FOUND;
  node->exec_state = NG_EXEC_NEVER;
  node->last_error = NG_OK;
  if (recursive_downstream) {
    for (i = 0; i < NG_MAX_NODES; i++) {
      NgNode *n = &g_info.nodes[i];
      if (n->id == 0 || n->id == node_id)
        continue;
      for (j = 0; j < n->input_count; j++) {
        if (n->inputs[j].src_node_id == node_id) {
          ng_exec_clear(n->id, 1);
          break;
        }
      }
    }
  }
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(node_id, NG_CHANGE_NODE_EXEC);
  return NG_OK;
}

ng_i32 ng_exec_clear_all(void) {
  ng_u32 i;
  clear_pending_coroutine();
  ng_exec_graph_reset();
  g_run.active = 0;
  g_info.is_running = 0;
  set_run_status(NG_RUN_IDLE);
  clear_waiting();
  for (i = 0; i < NG_MAX_NODES; i++) {
    if (g_info.nodes[i].id != 0) {
      g_info.nodes[i].exec_state = NG_EXEC_NEVER;
      g_info.nodes[i].last_error = NG_OK;
    }
  }
  clear_value_store();
  g_info.generation += 1;
  set_last_error(NG_OK);
  notify_node_changed(0, NG_CHANGE_NODE_EXEC | NG_CHANGE_GRAPH);
  return NG_OK;
}

ng_i32 ng_get_last_error(void) { return g_info.last_error; }

ng_i32 ng_get_io_ptr(void) { return (ng_i32)(intptr_t)g_info.io_buf; }

ng_i32 ng_get_io_len(void) { return g_info.io_len; }

ng_i32 ng_io_clear(void) {
  clear_io();
  return NG_OK;
}

ng_i32 ng_get_node_exec_state(ng_u32 node_id) {
  NgNode *node = find_node(node_id);
  if (node == NULL)
    return -1;
  return (ng_i32)node->exec_state;
}

ng_i32 run(void) {
  const char *input = "default";
  ng_u32 input_len = pdk_input_len();
  ng_u32 input_ptr = pdk_input_ptr();
  NgSerializedGraph root;
  NgStrBuf out;
  ng_i32 err;
  ng_u32 i = 0;
  memset(&root, 0, sizeof(root));
  ng_sb_init(&out);

  if (input_ptr != 0 && input_len > 0) {
    input = (const char *)(uintptr_t)input_ptr;
  } else {
    input_len = 7u;
  }

  if (ng_init() != NG_OK) {
    return NG_ERR_RUNTIME;
  }

  ng_batch_reset();
  clear_io();

  {
    char graph_name[256];
    size_t copy_len = (size_t)input_len;
    if (copy_len >= sizeof(graph_name)) {
      copy_len = sizeof(graph_name) - 1u;
    }
    memcpy(graph_name, input, copy_len);
    graph_name[copy_len] = '\0';

    err = ng_batch_load_graph_by_name(graph_name, &root);
    if (err == NG_OK) {
      ng_batch_reset();
      g_batch.root_graph = root;
      memset(&root, 0, sizeof(root));
      ng_goal_collection_begin();
      err = ng_apply_serialized_graph_to_runtime(&g_batch.root_graph);
    }
    if (err == NG_OK) {
      err = ng_run_all_goals();
    }

    if (!ng_sb_append_len(&out, "{\"success\":", 11u) ||
        !ng_sb_append_len(&out, err == NG_OK ? "true" : "false",
                          err == NG_OK ? 4u : 5u) ||
        !ng_sb_append_len(&out, ",\"graph\":", 9u) ||
        !ng_json_encode_string(&out, graph_name, strlen(graph_name)) ||
        !ng_sb_append_len(&out, ",\"goal_count\":", 14u) ||
        !ng_sb_append_u32(&out, g_batch.goal_count) ||
        !ng_sb_append_len(&out, ",\"goals\":[", 10u) ||
        !ng_sb_append_len(&out,
                          g_batch.goal_results.buf != NULL ? g_batch.goal_results.buf : "",
                          g_batch.goal_results.len) ||
        !ng_sb_append_c(&out, ']')) {
      ng_batch_reset();
      ng_sb_free(&out);
      return NG_ERR_CAPACITY;
    }

    if (err != NG_OK) {
      if (!ng_sb_append_len(&out, ",\"error_code\":", 14u) ||
          !ng_sb_append_u32(&out, (ng_u32)err) ||
          !ng_sb_append_len(&out, ",\"io\":", 6u) ||
          !ng_json_encode_string(&out, g_info.io_buf, (size_t)g_info.io_len)) {
        ng_batch_reset();
        ng_sb_free(&out);
        return NG_ERR_CAPACITY;
      }
    }

    if (!ng_sb_append_c(&out, '}')) {
      ng_batch_reset();
      ng_sb_free(&out);
      return NG_ERR_CAPACITY;
    }
  }

  pdk_output((const uint8_t *)(out.buf != NULL ? out.buf : ""),
             (uint32_t)out.len);
  ng_batch_reset();
  ng_sb_free(&out);
  return err;
}

#undef ng_init
#undef ng_get_info_ptr
#undef ng_clear_graph
#undef ng_node_create
#undef ng_node_replace
#undef ng_node_delete
#undef ng_input_add
#undef ng_input_remove
#undef ng_output_add
#undef ng_output_remove
#undef ng_input_connect
#undef ng_input_disconnect
#undef ng_node_set_arg
#undef ng_run_all_goals
#undef ng_run_goal
#undef ng_run_start
#undef ng_run_cancel
#undef ng_exec_clear
#undef ng_exec_clear_all
#undef ng_get_last_error
#undef ng_get_io_ptr
#undef ng_get_io_len
#undef ng_io_clear
#undef ng_get_node_exec_state
#undef run

uint32_t __sql_init(void) {
  static const char create_sql[] =
      "CREATE TABLE IF NOT EXISTS ng_graph_storage ("
      "name TEXT PRIMARY KEY,"
      "data TEXT NOT NULL,"
      "node_count INTEGER NOT NULL,"
      "updated_at TEXT DEFAULT (datetime('now'))"
      ")";
  static const char seed_sql[] =
      "INSERT OR IGNORE INTO ng_graph_storage (name, data, node_count) VALUES ("
      "'default',"
      "'{\"nodes\":[{\"id\":1,\"kind\":4,\"execState\":1,\"inputCount\":0,\"outputCount\":2,\"inputs\":[],\"outputs\":[{\"outputId\":1,\"value\":\"fallback-a\"},{\"outputId\":2,\"value\":\"fallback-b\"}]},{\"id\":2,\"kind\":4,\"execState\":1,\"inputCount\":0,\"outputCount\":1,\"inputs\":[],\"outputs\":[{\"outputId\":1,\"value\":\"seed\"}]},{\"id\":3,\"kind\":2,\"execState\":1,\"inputCount\":2,\"outputCount\":2,\"codePath\":\"/assets/ng/nodegraph2/initial-node-code.lua\",\"inputs\":[{\"inputId\":1,\"srcNodeId\":1,\"srcOutputId\":1},{\"inputId\":2,\"srcNodeId\":2,\"srcOutputId\":1}],\"outputs\":[{\"outputId\":1},{\"outputId\":2}]},{\"id\":4,\"kind\":3,\"execState\":3,\"graphId\":1,\"inputCount\":2,\"outputCount\":1,\"inputs\":[{\"inputId\":1,\"srcNodeId\":1,\"srcOutputId\":2},{\"inputId\":2,\"srcNodeId\":3,\"srcOutputId\":2}],\"outputs\":[{\"outputId\":1}]},{\"id\":5,\"kind\":2,\"execState\":2,\"inputCount\":2,\"outputCount\":1,\"codePath\":\"/assets/ng/nodegraph2/initial-node-code.lua\",\"inputs\":[{\"inputId\":1,\"srcNodeId\":3,\"srcOutputId\":1},{\"inputId\":2,\"srcNodeId\":4,\"srcOutputId\":1}],\"outputs\":[{\"outputId\":1}]},{\"id\":6,\"kind\":1,\"execState\":0,\"inputCount\":2,\"outputCount\":0,\"inputs\":[{\"inputId\":1,\"srcNodeId\":5,\"srcOutputId\":1},{\"inputId\":2,\"srcNodeId\":3,\"srcOutputId\":2}],\"outputs\":[]}],\"edges\":[{\"from\":1,\"fromOutputId\":1,\"to\":3,\"toInputId\":1,\"execState\":1},{\"from\":2,\"fromOutputId\":1,\"to\":3,\"toInputId\":2,\"execState\":1},{\"from\":1,\"fromOutputId\":2,\"to\":4,\"toInputId\":1,\"execState\":1},{\"from\":3,\"fromOutputId\":2,\"to\":4,\"toInputId\":2,\"execState\":3},{\"from\":3,\"fromOutputId\":1,\"to\":5,\"toInputId\":1,\"execState\":1},{\"from\":4,\"fromOutputId\":1,\"to\":5,\"toInputId\":2,\"execState\":3},{\"from\":5,\"fromOutputId\":1,\"to\":6,\"toInputId\":1,\"execState\":2},{\"from\":3,\"fromOutputId\":2,\"to\":6,\"toInputId\":2,\"execState\":1}]}',"
      "6"
      ")";
  ng_i32 rc = ng_sql_exec_cstr(create_sql);
  if (rc != NG_OK) return rc;
  rc = ng_sql_exec_cstr(seed_sql);
  if (rc != NG_OK) return rc;
  output_text("OK");
  return NG_OK;
}

static ng_i32 ng_open_graph_json_by_name(const char *name, char *out_json,
                                         ng_i32 out_cap) {
  NgStrBuf query;
  NgStrBuf field;
  ng_i32 err;
  size_t name_len = name != NULL ? strlen(name) : 0u;
  ng_sb_init(&query);
  ng_sb_init(&field);
  if (!ng_sb_append_len(&query,
                        "SELECT data FROM ng_graph_storage WHERE name = '",
                        sizeof("SELECT data FROM ng_graph_storage WHERE name = '") - 1u) ||
      !ng_sql_escape_single_quotes(name != NULL ? name : "", name_len, &query) ||
      !ng_sb_append_len(&query, "' LIMIT 1", 9u)) {
    ng_sb_free(&query);
    ng_sb_free(&field);
    return NG_ERR_CAPACITY;
  }
  err = ng_batch_query_single_field(query.buf != NULL ? query.buf : "", query.len, &field);
  ng_sb_free(&query);
  if (err != NG_OK) {
    ng_sb_free(&field);
    return err;
  }
  if ((ng_i32)field.len >= out_cap) {
    ng_sb_free(&field);
    return NG_ERR_CAPACITY;
  }
  memcpy(out_json, field.buf != NULL ? field.buf : "", field.len);
  out_json[field.len] = '\0';
  ng_sb_free(&field);
  return NG_OK;
}

uint32_t ng_handle_create(void) {
  output_text("1");
  return NG_OK;
}

uint32_t ng_handle_close(void) {
  ng_goal_collection_end();
  output_text("1");
  return NG_OK;
}

uint32_t ng_get_info_size(void) {
  output_u32((ng_u32)sizeof(NgInfo));
  return NG_OK;
}

uint32_t ng_get_info_ptr(void) {
  output_u32((ng_u32)(uintptr_t)&g_info);
  return NG_OK;
}

uint32_t ng_graph_open(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  char name[256] = {0};
  ng_i32 err;
  if (!json_extract_string_raw(input, input_len, "name", name, (uint32_t)sizeof(name))) {
    return NG_ERR_INVALID_ARG;
  }
  err = ng_open_graph_json_by_name(name, g_code_buf, NG_IO_BUFFER_CAP);
  if (err != NG_OK) return err;
  err = ng_init_raw();
  if (err != NG_OK) return err;
  err = ng_apply_cached_root_graph_json(g_code_buf, strlen(g_code_buf));
  if (err != NG_OK) return err;
  strncpy(g_current_graph_name, name, sizeof(g_current_graph_name) - 1u);
  g_current_graph_name[sizeof(g_current_graph_name) - 1u] = '\0';
  {
    char out[NG_IO_BUFFER_CAP];
    int n = snprintf(out, sizeof(out), "{\"handle\":1,\"name\":\"%s\",\"nodeCount\":%u,\"data\":%s}",
                     g_current_graph_name, (unsigned)g_info.node_count, g_code_buf);
    if (n <= 0 || n >= (int)sizeof(out)) return NG_ERR_CAPACITY;
    pdk_output((const uint8_t *)out, (uint32_t)n);
  }
  return NG_OK;
}

uint32_t ng_graph_save(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  char name[256] = {0};
  char escaped_name[512] = {0};
  char data_json[NG_IO_BUFFER_CAP] = {0};
  ng_u32 node_count = 0;
  ng_i32 rc;
  NgSerializedGraph parsed;
  memset(&parsed, 0, sizeof(parsed));
  if (!json_extract_string_raw(input, input_len, "name", name, (uint32_t)sizeof(name))) {
    return NG_ERR_INVALID_ARG;
  }
  if (!json_extract_object_raw_raw(input, input_len, "data", data_json, NG_IO_BUFFER_CAP)) {
    return NG_ERR_INVALID_ARG;
  }
  rc = ng_parse_serialized_graph(data_json, strlen(data_json), &parsed);
  if (rc != NG_OK) return rc;
  node_count = parsed.node_count;
  ng_free_serialized_graph(&parsed);
  ng_free_serialized_graph(&g_batch.root_graph);
  rc = ng_set_cached_root_graph_json(data_json, strlen(data_json));
  if (rc != NG_OK) return rc;
  strncpy(g_current_graph_name, name, sizeof(g_current_graph_name) - 1u);
  g_current_graph_name[sizeof(g_current_graph_name) - 1u] = '\0';
  {
    char escaped_data[NG_IO_BUFFER_CAP] = {0};
    char sql[NG_IO_BUFFER_CAP] = {0};
    rc = ng_sql_escape_single_quotes(name, strlen(name), &(NgStrBuf){0});
    (void)rc;
    if (!ng_sql_escape_single_quotes(name, strlen(name), &(NgStrBuf){0})) {
    }
    {
      NgStrBuf name_buf;
      NgStrBuf data_buf;
      ng_sb_init(&name_buf);
      ng_sb_init(&data_buf);
      if (!ng_sql_escape_single_quotes(name, strlen(name), &name_buf) ||
          !ng_sql_escape_single_quotes(data_json, strlen(data_json), &data_buf)) {
        ng_sb_free(&name_buf);
        ng_sb_free(&data_buf);
        return NG_ERR_CAPACITY;
      }
      int n = snprintf(sql, sizeof(sql),
                       "INSERT INTO ng_graph_storage (name, data, node_count, updated_at) VALUES ('%s','%s',%u,datetime('now')) ON CONFLICT(name) DO UPDATE SET data=excluded.data, node_count=excluded.node_count, updated_at=excluded.updated_at",
                       name_buf.buf != NULL ? name_buf.buf : "",
                       data_buf.buf != NULL ? data_buf.buf : "",
                       (unsigned)node_count);
      ng_sb_free(&name_buf);
      ng_sb_free(&data_buf);
      if (n <= 0 || n >= (int)sizeof(sql)) return NG_ERR_CAPACITY;
    }
    rc = ng_sql_exec_cstr(sql);
    if (rc != NG_OK) return rc;
    {
      int n = snprintf(escaped_data, sizeof(escaped_data), "{\"saved\":true,\"name\":\"%s\",\"nodeCount\":%u}",
                       g_current_graph_name, (unsigned)node_count);
      if (n <= 0 || n >= (int)sizeof(escaped_data)) return NG_ERR_CAPACITY;
      pdk_output((const uint8_t *)escaped_data, (uint32_t)n);
    }
  }
  return NG_OK;
}

uint32_t ng_graph_list(void) {
  ng_i32 rc = ng_sql_query_cstr("SELECT rowid, name, node_count, updated_at FROM ng_graph_storage ORDER BY name",
                                g_code_buf, NG_IO_BUFFER_CAP);
  if (rc != NG_OK) return rc;
  output_text(g_code_buf);
  return NG_OK;
}

uint32_t ng_graph_delete(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  char name[256] = {0};
  ng_i32 rc;
  NgStrBuf name_buf;
  NgStrBuf sql;
  if (!json_extract_string_raw(input, input_len, "name", name, (uint32_t)sizeof(name))) {
    return NG_ERR_INVALID_ARG;
  }
  ng_sb_init(&name_buf);
  ng_sb_init(&sql);
  if (!ng_sql_escape_single_quotes(name, strlen(name), &name_buf) ||
      !ng_sb_append_len(&sql, "DELETE FROM ng_graph_storage WHERE name='", sizeof("DELETE FROM ng_graph_storage WHERE name='") - 1u) ||
      !ng_sb_append_len(&sql, name_buf.buf != NULL ? name_buf.buf : "", name_buf.len) ||
      !ng_sb_append_c(&sql, '\'')) {
    ng_sb_free(&name_buf);
    ng_sb_free(&sql);
    return NG_ERR_CAPACITY;
  }
  ng_sb_free(&name_buf);
  rc = ng_sql_exec_cstr(sql.buf != NULL ? sql.buf : "");
  ng_sb_free(&sql);
  if (rc != NG_OK) return rc;
  output_text(name);
  return NG_OK;
}

static uint32_t ng_parse_handle_node_payload(uint32_t input_len, const uint8_t *input,
                                             ng_u32 *node_id) {
  ng_u32 handle_id = 0;
  if (!json_extract_u32_raw(input, input_len, "handle", &handle_id)) return NG_ERR_INVALID_ARG;
  if (handle_id != 1) return NG_ERR_INVALID_ARG;
  if (!json_extract_u32_raw(input, input_len, "nodeId", node_id)) return NG_ERR_INVALID_ARG;
  return NG_OK;
}

uint32_t ng_node_create(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 kind = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "kind", &kind)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_node_create_raw(node_id, kind);
}
uint32_t ng_node_replace(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 kind = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "kind", &kind)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_node_replace_raw(node_id, kind);
}
uint32_t ng_node_delete(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; return (uint32_t)ng_node_delete_raw(node_id);
}
uint32_t ng_input_add(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 input_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "inputId", &input_id)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_input_add_raw(node_id, input_id);
}
uint32_t ng_input_remove(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 input_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "inputId", &input_id)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_input_remove_raw(node_id, input_id);
}
uint32_t ng_output_add(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 output_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "outputId", &output_id)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_output_add_raw(node_id, output_id);
}
uint32_t ng_output_remove(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 output_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "outputId", &output_id)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_output_remove_raw(node_id, output_id);
}
uint32_t ng_input_connect(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 input_id = 0; ng_u32 src_node_id = 0; ng_u32 src_output_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "inputId", &input_id) || !json_extract_u32_raw(input, input_len, "srcNodeId", &src_node_id) || !json_extract_u32_raw(input, input_len, "srcOutputId", &src_output_id)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_input_connect_raw(node_id, input_id, src_node_id, src_output_id);
}
uint32_t ng_input_disconnect(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 input_id = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "inputId", &input_id)) return NG_ERR_INVALID_ARG; return (uint32_t)ng_input_disconnect_raw(node_id, input_id);
}
uint32_t ng_node_set_arg(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 arg_index = 0; ng_u32 type = 0; ng_u32 a = 0; ng_u32 b = 0; uint32_t rc = ng_parse_handle_node_payload(input_len, input, &node_id); if (rc != NG_OK) return rc; if (!json_extract_u32_raw(input, input_len, "argIndex", &arg_index) || !json_extract_u32_raw(input, input_len, "type", &type) || !json_extract_u32_raw(input, input_len, "a", &a)) return NG_ERR_INVALID_ARG; if (!json_extract_u32_raw(input, input_len, "b", &b)) b = 0; return (uint32_t)ng_node_set_arg_raw(node_id, arg_index, type, (ng_i32)a, (ng_i32)b);
}

uint32_t ng_run_start(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 goal = 0; if (input_len > 0 && !json_extract_u32_raw(input, input_len, "goal", &goal)) parse_u32_input_text(input, input_len, &goal); return (uint32_t)ng_run_start_raw(goal);
}
uint32_t ng_run_cancel(void) { return (uint32_t)ng_run_cancel_raw(); }
uint32_t ng_run_goal(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 goal = 0; if (input_len > 0 && !json_extract_u32_raw(input, input_len, "goal", &goal) && parse_u32_input_text(input, input_len, &goal) != NG_OK) return NG_ERR_INVALID_ARG; return (uint32_t)ng_run_goal_raw(goal);
}
uint32_t ng_run_all_goals(void) { return (uint32_t)ng_run_all_goals_raw(); }
uint32_t ng_exec_clear(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; ng_u32 recursive = 0; if (!json_extract_u32_raw(input, input_len, "nodeId", &node_id)) return NG_ERR_INVALID_ARG; if (!json_extract_u32_raw(input, input_len, "recursiveDownstream", &recursive)) recursive = 0; return (uint32_t)ng_exec_clear_raw(node_id, (ng_i32)recursive);
}
uint32_t ng_exec_clear_all(void) { return (uint32_t)ng_exec_clear_all_raw(); }
uint32_t ng_get_last_error(void) { output_u32((ng_u32)ng_get_last_error_raw()); return NG_OK; }
uint32_t ng_get_io_ptr(void) { output_u32((ng_u32)ng_get_io_ptr_raw()); return NG_OK; }
uint32_t ng_get_io_len(void) { output_u32((ng_u32)ng_get_io_len_raw()); return NG_OK; }
uint32_t ng_io_clear(void) { return (uint32_t)ng_io_clear_raw(); }
uint32_t ng_get_node_exec_state(void) {
  uint32_t input_len = 0; const uint8_t *input = pdk_input(&input_len); ng_u32 node_id = 0; if (!json_extract_u32_raw(input, input_len, "nodeId", &node_id) && parse_u32_input_text(input, input_len, &node_id) != NG_OK) return NG_ERR_INVALID_ARG; output_u32((ng_u32)ng_get_node_exec_state_raw(node_id)); return NG_OK;
}
uint32_t ng_init(void) { return (uint32_t)ng_init_raw(); }
uint32_t ng_clear_graph(void) { return (uint32_t)ng_clear_graph_raw(); }

uint32_t ng_run(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng_u32 goal = 0;
  ng_i32 err;
  NgStrBuf out;
  ng_sb_init(&out);
  if (input_len > 0 && !json_extract_u32_raw(input, input_len, "goal", &goal)) {
    goal = 0;
  }
  clear_io();
  ng_goal_collection_begin();
  err = goal == 0 ? ng_run_all_goals_raw() : ng_run_goal_raw(goal);
  if (!ng_sb_append_len(&out, "{\"success\":", 11u) ||
      !ng_sb_append_len(&out, err == NG_OK ? "true" : "false", err == NG_OK ? 4u : 5u) ||
      !ng_sb_append_len(&out, ",\"graph\":", 9u) ||
      !ng_json_encode_string(&out, g_current_graph_name[0] != '\0' ? g_current_graph_name : "default", strlen(g_current_graph_name[0] != '\0' ? g_current_graph_name : "default")) ||
      !ng_sb_append_len(&out, ",\"goal_count\":", 14u) ||
      !ng_sb_append_u32(&out, g_batch.goal_count) ||
      !ng_sb_append_len(&out, ",\"goals\":[", 10u) ||
      !ng_sb_append_len(&out, g_batch.goal_results.buf != NULL ? g_batch.goal_results.buf : "", g_batch.goal_results.len) ||
      !ng_sb_append_c(&out, ']')) {
    ng_goal_collection_end();
    ng_sb_free(&out);
    return NG_ERR_CAPACITY;
  }
  if (err != NG_OK) {
    if (!ng_sb_append_len(&out, ",\"error_code\":", 14u) ||
        !ng_sb_append_u32(&out, (ng_u32)err) ||
        !ng_sb_append_len(&out, ",\"io\":", 6u) ||
        !ng_json_encode_string(&out, g_info.io_buf, (size_t)g_info.io_len)) {
      ng_goal_collection_end();
      ng_sb_free(&out);
      return NG_ERR_CAPACITY;
    }
  }
  if (!ng_sb_append_c(&out, '}')) {
    ng_goal_collection_end();
    ng_sb_free(&out);
    return NG_ERR_CAPACITY;
  }
  pdk_output((const uint8_t *)(out.buf != NULL ? out.buf : ""), (uint32_t)out.len);
  ng_goal_collection_end();
  ng_sb_free(&out);
  return err;
}

uint32_t run(void) { return (uint32_t)run_raw(); }

int main(void) { return 0; }
