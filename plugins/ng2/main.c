#include "ng.h"
#include "pdk.h"

#include <stdint.h>

typedef struct {
  ng2_u32 in_use;
  ng2_u32 generation;
  Ng2Info info;
} Ng2GraphSlot;

typedef struct {
  ng2_u32 in_use;
  ng2_u32 handle;
  ng2_u32 graph_slot;
  ng2_u32 reserved;
} Ng2Handle;

static Ng2Handle g_handles[NG2_MAX_HANDLES];
static Ng2GraphSlot g_graph_slots[NG2_MAX_GRAPH_SLOTS];
static ng2_u32 g_next_handle = 1;

static void ng2_zero(void *ptr, ng2_u32 len) {
  unsigned char *p = (unsigned char *)ptr;
  for (ng2_u32 i = 0; i < len; i++) p[i] = 0;
}

static ng2_i32 parse_u32_input(const uint8_t *input, uint32_t len, ng2_u32 *out) {
  ng2_u32 value = 0;
  uint32_t digits = 0;
  if (len == 0) return 1;
  for (uint32_t i = 0; i < len; i++) {
    uint8_t c = input[i];
    if (c == 0) break;
    if (c < '0' || c > '9') return 1;
    value = value * 10u + (ng2_u32)(c - '0');
    digits += 1;
  }
  if (digits == 0) return 1;
  *out = value;
  return 0;
}

static ng2_i32 ng2_str_eq(const char *a, const char *b) {
  ng2_u32 i = 0;
  while (a[i] != '\0' && b[i] != '\0') {
    if (a[i] != b[i]) return 0;
    i += 1;
  }
  return a[i] == '\0' && b[i] == '\0';
}

static ng2_i32 json_find_key(const uint8_t *input, uint32_t len, const char *key,
                             uint32_t *key_pos_out) {
  uint32_t key_len = pdk_strlen(key);
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

static ng2_i32 json_find_value_start(const uint8_t *input, uint32_t len,
                                     uint32_t key_pos, uint32_t *value_pos_out) {
  uint32_t i = key_pos;
  while (i < len && input[i] != ':') i += 1u;
  if (i >= len) return 0;
  i += 1u;
  while (i < len && (input[i] == ' ' || input[i] == '\n' || input[i] == '\r' || input[i] == '\t')) i += 1u;
  if (i >= len) return 0;
  *value_pos_out = i;
  return 1;
}

static ng2_i32 json_extract_string(const uint8_t *input, uint32_t len, const char *key,
                                   char *out, uint32_t out_cap) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  uint32_t out_len = 0;
  if (!json_find_key(input, len, key, &key_pos)) return 0;
  if (!json_find_value_start(input, len, key_pos, &value_pos)) return 0;
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

static ng2_i32 json_extract_u32(const uint8_t *input, uint32_t len, const char *key,
                                ng2_u32 *out) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  ng2_u32 value = 0;
  uint32_t digits = 0;
  if (!json_find_key(input, len, key, &key_pos)) return 0;
  if (!json_find_value_start(input, len, key_pos, &value_pos)) return 0;
  while (value_pos < len && input[value_pos] >= '0' && input[value_pos] <= '9') {
    value = value * 10u + (ng2_u32)(input[value_pos] - '0');
    digits += 1u;
    value_pos += 1u;
  }
  if (digits == 0) return 0;
  *out = value;
  return 1;
}

static ng2_i32 json_extract_object_raw(const uint8_t *input, uint32_t len, const char *key,
                                       char *out, uint32_t out_cap) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  uint32_t depth = 0;
  uint32_t out_len = 0;
  ng2_i32 in_string = 0;
  ng2_i32 escaped = 0;
  if (!json_find_key(input, len, key, &key_pos)) return 0;
  if (!json_find_value_start(input, len, key_pos, &value_pos)) return 0;
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

static void output_text(const char *text) {
  pdk_output((const uint8_t *)text, pdk_strlen(text));
}

static void output_u32(ng2_u32 value) {
  char buffer[32];
  uint32_t len = 0;
  if (value == 0) {
    buffer[len++] = '0';
    pdk_output((const uint8_t *)buffer, len);
    return;
  }
  while (value > 0) {
    buffer[len++] = (char)('0' + (value % 10u));
    value /= 10u;
  }
  for (uint32_t i = 0; i < len / 2; i++) {
    char t = buffer[i];
    buffer[i] = buffer[len - 1 - i];
    buffer[len - 1 - i] = t;
  }
  pdk_output((const uint8_t *)buffer, len);
}

static ng2_u32 output_not_implemented(const char *method) {
  output_text(method);
  return NG2_ERR_NOT_IMPLEMENTED;
}

static ng2_u32 sql_exec_str(const char *sql) {
  pdk_call_result_t result = pdk_call_plugin_str("sql", "exec", (const uint8_t *)sql,
                                                 pdk_strlen(sql));
  if (result.error != 0) {
    output_text("sql exec bridge failed");
    return NG2_ERR_NOT_IMPLEMENTED;
  }
  if (result.return_code != 0) {
    if (result.output != 0 && result.output_len > 0) {
      pdk_output(result.output, result.output_len);
    } else {
      output_text("sql exec failed");
    }
    return NG2_ERR_NOT_IMPLEMENTED;
  }
  return NG2_OK;
}

static Ng2Handle *find_handle(ng2_u32 handle) {
  for (ng2_u32 i = 0; i < NG2_MAX_HANDLES; i++) {
    if (g_handles[i].in_use && g_handles[i].handle == handle) return &g_handles[i];
  }
  return 0;
}

static void reset_graph_slot(ng2_u32 slot_index) {
  Ng2GraphSlot *slot = &g_graph_slots[slot_index];
  ng2_u32 generation = slot->generation + 1;
  ng2_zero(slot, (ng2_u32)sizeof(Ng2GraphSlot));
  slot->in_use = 1;
  slot->generation = generation;
  slot->info.initialized = 1;
  slot->info.generation = generation;
}

static void release_graph_slot(ng2_u32 slot_index) {
  ng2_zero(&g_graph_slots[slot_index], (ng2_u32)sizeof(Ng2GraphSlot));
}

static ng2_i32 alloc_graph_slot(void) {
  for (ng2_u32 i = 0; i < NG2_MAX_GRAPH_SLOTS; i++) {
    if (g_graph_slots[i].in_use) continue;
    reset_graph_slot(i);
    return (ng2_i32)i;
  }
  return -1;
}

static Ng2Handle *alloc_handle(void) {
  ng2_i32 graph_slot = alloc_graph_slot();
  if (graph_slot < 0) return 0;
  for (ng2_u32 i = 0; i < NG2_MAX_HANDLES; i++) {
    if (g_handles[i].in_use) continue;
    ng2_zero(&g_handles[i], (ng2_u32)sizeof(Ng2Handle));
    g_handles[i].in_use = 1;
    g_handles[i].handle = g_next_handle++;
    g_handles[i].graph_slot = (ng2_u32)graph_slot;
    return &g_handles[i];
  }
  release_graph_slot((ng2_u32)graph_slot);
  return 0;
}

static ng2_u32 close_handle_id_silent(ng2_u32 handle_id) {
  Ng2Handle *handle = find_handle(handle_id);
  if (!handle) return NG2_ERR_INVALID_HANDLE;
  ng2_u32 graph_slot = handle->graph_slot;
  ng2_zero(handle, (ng2_u32)sizeof(Ng2Handle));
  release_graph_slot(graph_slot);
  return NG2_OK;
}

static ng2_u32 close_handle_id(ng2_u32 handle_id) {
  ng2_u32 rc = close_handle_id_silent(handle_id);
  if (rc != NG2_OK) return rc;
  output_u32(handle_id);
  return NG2_OK;
}

static Ng2Node *set_node(Ng2Info *info, ng2_u32 slot, ng2_u32 id, ng2_u32 kind,
                         ng2_u32 exec_state, ng2_u32 input_count, ng2_u32 output_count) {
  Ng2Node *node = &info->nodes[slot];
  ng2_zero(node, (ng2_u32)sizeof(Ng2Node));
  node->id = id;
  node->kind = kind;
  node->exec_state = exec_state;
  node->generation = info->generation;
  node->input_count = input_count;
  node->output_count = output_count;
  return node;
}

static void set_input(Ng2Node *node, ng2_u32 index, ng2_u32 input_id, ng2_u32 src_node_id,
                      ng2_u32 src_output_id) {
  node->inputs[index].id = input_id;
  node->inputs[index].src_node_id = src_node_id;
  node->inputs[index].src_output_id = src_output_id;
}

static void set_output(Ng2Node *node, ng2_u32 index, ng2_u32 output_id) {
  node->outputs[index].id = output_id;
}

static void load_sample_graph(Ng2Handle *handle) {
  Ng2GraphSlot *slot = &g_graph_slots[handle->graph_slot];
  Ng2Info *info = &slot->info;
  reset_graph_slot(handle->graph_slot);
  info = &slot->info;
  info->node_count = 6;

  Ng2Node *n1 = set_node(info, 0, 1, NG2_NODE_VALUE, NG2_EXEC_SUCCESS, 0, 2);
  set_output(n1, 0, 1);
  set_output(n1, 1, 2);

  Ng2Node *n2 = set_node(info, 1, 2, NG2_NODE_VALUE, NG2_EXEC_SUCCESS, 0, 1);
  set_output(n2, 0, 1);

  Ng2Node *n3 = set_node(info, 2, 3, NG2_NODE_CODE, NG2_EXEC_SUCCESS, 2, 2);
  set_input(n3, 0, 1, 1, 1);
  set_input(n3, 1, 2, 2, 1);
  set_output(n3, 0, 1);
  set_output(n3, 1, 2);

  Ng2Node *n4 = set_node(info, 3, 4, NG2_NODE_CALL, NG2_EXEC_STALE, 2, 1);
  set_input(n4, 0, 1, 1, 2);
  set_input(n4, 1, 2, 3, 2);
  set_output(n4, 0, 1);

  Ng2Node *n5 = set_node(info, 4, 5, NG2_NODE_CODE, NG2_EXEC_ERROR, 2, 1);
  set_input(n5, 0, 1, 3, 1);
  set_input(n5, 1, 2, 4, 1);
  set_output(n5, 0, 1);

  Ng2Node *n6 = set_node(info, 5, 6, NG2_NODE_GOAL, NG2_EXEC_NEVER, 2, 0);
  set_input(n6, 0, 1, 5, 1);
  set_input(n6, 1, 2, 3, 2);
}

static ng2_u32 run_request_internal(ng2_i32 close_after) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 goal_id = 0;
  ng2_i32 has_handle = json_extract_u32(input, input_len, "handle", &handle_id);
  ng2_i32 has_goal = json_extract_u32(input, input_len, "goal", &goal_id);
  ng2_i32 temp_handle = 0;
  char graph_name[128] = {0};
  char inputs_json[2048] = {0};
  Ng2Handle *handle = 0;
  char out[4096];
  uint32_t pos = 0;

  if (!json_extract_object_raw(input, input_len, "inputs", inputs_json, (uint32_t)sizeof(inputs_json))) {
    inputs_json[0] = '{';
    inputs_json[1] = '}';
    inputs_json[2] = '\0';
  }

  if (has_handle) {
    handle = find_handle(handle_id);
    if (!handle) return NG2_ERR_INVALID_HANDLE;
  } else {
    if (!json_extract_string(input, input_len, "graph", graph_name, (uint32_t)sizeof(graph_name))) {
      output_text("expected handle or graph");
      return NG2_ERR_INVALID_ARG;
    }
    handle = alloc_handle();
    if (!handle) return NG2_ERR_CAPACITY;
    handle_id = handle->handle;
    temp_handle = 1;
    if (ng2_str_eq(graph_name, "default") || ng2_str_eq(graph_name, "sample")) {
      load_sample_graph(handle);
    } else {
      output_text("graph loading not implemented yet");
      if (temp_handle) close_handle_id_silent(handle_id);
      return NG2_ERR_NOT_IMPLEMENTED;
    }
  }

  if (!has_goal) goal_id = 0;
  if (graph_name[0] == '\0') {
    if (!json_extract_string(input, input_len, "graph", graph_name, (uint32_t)sizeof(graph_name))) {
      const char default_name[] = "<handle>";
      for (uint32_t i = 0; i < sizeof(default_name); i++) graph_name[i] = default_name[i];
    }
  }

#define APPEND_LIT(s) do { const char lit[] = s; for (uint32_t i = 0; i < sizeof(lit) - 1u; i++) out[pos++] = lit[i]; } while (0)
#define APPEND_BUF(buf, buf_len) do { for (uint32_t i = 0; i < (buf_len); i++) out[pos++] = (buf)[i]; } while (0)
#define APPEND_CSTR(buf) do { uint32_t n = pdk_strlen(buf); APPEND_BUF(buf, n); } while (0)

  APPEND_LIT("{\"success\":true,\"handle\":");
  {
    char num[32];
    uint32_t n = 0;
    ng2_u32 value = handle_id;
    if (value == 0) num[n++] = '0';
    while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; }
    for (uint32_t i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; }
    APPEND_BUF(num, n);
  }
  APPEND_LIT(",\"graph\":\"");
  APPEND_CSTR(graph_name);
  APPEND_LIT("\",\"goalCount\":1,\"goals\":[{\"goalNodeId\":6,\"payload\":{\"id\":6,\"requestedGoal\":");
  {
    char num[32];
    uint32_t n = 0;
    ng2_u32 value = goal_id;
    if (value == 0) num[n++] = '0';
    while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; }
    for (uint32_t i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; }
    APPEND_BUF(num, n);
  }
  APPEND_LIT(",\"inputs\":");
  APPEND_CSTR(inputs_json);
  APPEND_LIT(",\"result\":\"sample-goal\"}}]}");
  out[pos] = '\0';
  pdk_output((const uint8_t *)out, pos);

#undef APPEND_LIT
#undef APPEND_BUF
#undef APPEND_CSTR

  if (close_after || temp_handle) {
    ng2_u32 rc = close_handle_id_silent(handle_id);
    if (rc != NG2_OK) return rc;
  }
  return NG2_OK;
}

uint32_t __sql_init(void) {
  static const char create_sql[] =
      "CREATE TABLE IF NOT EXISTS ng2_graph_storage ("
      "name TEXT PRIMARY KEY,"
      "data TEXT NOT NULL,"
      "node_count INTEGER NOT NULL,"
      "updated_at TEXT DEFAULT (datetime('now'))"
      ")";
  static const char seed_sql[] =
      "INSERT OR IGNORE INTO ng2_graph_storage (name, data, node_count) VALUES ("
      "'default',"
      "'{\"nodes\":[{\"id\":1,\"kind\":4,\"execState\":1,\"inputCount\":0,\"outputCount\":2,\"inputs\":[],\"outputs\":[{\"outputId\":1},{\"outputId\":2}]},{\"id\":2,\"kind\":4,\"execState\":1,\"inputCount\":0,\"outputCount\":1,\"inputs\":[],\"outputs\":[{\"outputId\":1}]},{\"id\":3,\"kind\":2,\"execState\":1,\"inputCount\":2,\"outputCount\":2,\"inputs\":[{\"inputId\":1,\"srcNodeId\":1,\"srcOutputId\":1},{\"inputId\":2,\"srcNodeId\":2,\"srcOutputId\":1}],\"outputs\":[{\"outputId\":1},{\"outputId\":2}]},{\"id\":4,\"kind\":3,\"execState\":3,\"inputCount\":2,\"outputCount\":1,\"inputs\":[{\"inputId\":1,\"srcNodeId\":1,\"srcOutputId\":2},{\"inputId\":2,\"srcNodeId\":3,\"srcOutputId\":2}],\"outputs\":[{\"outputId\":1}]},{\"id\":5,\"kind\":2,\"execState\":2,\"inputCount\":2,\"outputCount\":1,\"inputs\":[{\"inputId\":1,\"srcNodeId\":3,\"srcOutputId\":1},{\"inputId\":2,\"srcNodeId\":4,\"srcOutputId\":1}],\"outputs\":[{\"outputId\":1}]},{\"id\":6,\"kind\":1,\"execState\":0,\"inputCount\":2,\"outputCount\":0,\"inputs\":[{\"inputId\":1,\"srcNodeId\":5,\"srcOutputId\":1},{\"inputId\":2,\"srcNodeId\":3,\"srcOutputId\":2}],\"outputs\":[]}],\"edges\":[{\"from\":1,\"fromOutputId\":1,\"to\":3,\"toInputId\":1,\"execState\":1},{\"from\":2,\"fromOutputId\":1,\"to\":3,\"toInputId\":2,\"execState\":1},{\"from\":1,\"fromOutputId\":2,\"to\":4,\"toInputId\":1,\"execState\":1},{\"from\":3,\"fromOutputId\":2,\"to\":4,\"toInputId\":2,\"execState\":3},{\"from\":3,\"fromOutputId\":1,\"to\":5,\"toInputId\":1,\"execState\":1},{\"from\":4,\"fromOutputId\":1,\"to\":5,\"toInputId\":2,\"execState\":3},{\"from\":5,\"fromOutputId\":1,\"to\":6,\"toInputId\":1,\"execState\":2},{\"from\":3,\"fromOutputId\":2,\"to\":6,\"toInputId\":2,\"execState\":1}]}',"
      "6"
      ")";
  ng2_u32 rc = sql_exec_str(create_sql);
  if (rc != NG2_OK) return rc;
  rc = sql_exec_str(seed_sql);
  if (rc != NG2_OK) return rc;
  output_text("OK");
  return NG2_OK;
}

uint32_t ng_handle_create(void) {
  Ng2Handle *handle = alloc_handle();
  if (!handle) return NG2_ERR_CAPACITY;
  output_u32(handle->handle);
  return NG2_OK;
}

uint32_t ng_handle_close(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  if (parse_u32_input(input, input_len, &handle_id) != 0) return NG2_ERR_INVALID_ARG;
  return close_handle_id(handle_id);
}

uint32_t ng_handle_close_all(void) {
  for (ng2_u32 i = 0; i < NG2_MAX_HANDLES; i++) {
    if (!g_handles[i].in_use) continue;
    close_handle_id(g_handles[i].handle);
  }
  output_text("ok");
  return NG2_OK;
}

uint32_t ng_handle_reset(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  if (parse_u32_input(input, input_len, &handle_id) != 0) return NG2_ERR_INVALID_ARG;
  Ng2Handle *handle = find_handle(handle_id);
  if (!handle) return NG2_ERR_INVALID_HANDLE;
  reset_graph_slot(handle->graph_slot);
  output_u32(handle_id);
  return NG2_OK;
}

uint32_t ng_graph_open(void) { return output_not_implemented("ng_graph_open"); }
uint32_t ng_graph_open_id(void) { return output_not_implemented("ng_graph_open_id"); }
uint32_t ng_graph_save(void) { return output_not_implemented("ng_graph_save"); }
uint32_t ng_graph_list(void) { return output_not_implemented("ng_graph_list"); }
uint32_t ng_graph_delete(void) { return output_not_implemented("ng_graph_delete"); }

uint32_t ng_template_save(void) { return output_not_implemented("ng_template_save"); }
uint32_t ng_template_list(void) { return output_not_implemented("ng_template_list"); }
uint32_t ng_template_delete(void) { return output_not_implemented("ng_template_delete"); }

uint32_t ng_node_create(void) { return output_not_implemented("ng_node_create"); }
uint32_t ng_node_replace(void) { return output_not_implemented("ng_node_replace"); }
uint32_t ng_node_delete(void) { return output_not_implemented("ng_node_delete"); }
uint32_t ng_input_add(void) { return output_not_implemented("ng_input_add"); }
uint32_t ng_output_add(void) { return output_not_implemented("ng_output_add"); }
uint32_t ng_input_connect(void) { return output_not_implemented("ng_input_connect"); }
uint32_t ng_input_disconnect(void) { return output_not_implemented("ng_input_disconnect"); }
uint32_t ng_node_set_arg(void) { return output_not_implemented("ng_node_set_arg"); }

uint32_t ng_run_start(void) { return output_not_implemented("ng_run_start"); }
uint32_t ng_run_cancel(void) { return output_not_implemented("ng_run_cancel"); }
uint32_t ng_run_all_goals(void) { return output_not_implemented("ng_run_all_goals"); }
uint32_t ng_run_goal(void) { return output_not_implemented("ng_run_goal"); }
uint32_t ng_run(void) { return run_request_internal(0); }
uint32_t ng_run_and_close(void) { return run_request_internal(1); }
uint32_t ng_exec_clear(void) { return output_not_implemented("ng_exec_clear"); }
uint32_t ng_exec_clear_all(void) { return output_not_implemented("ng_exec_clear_all"); }

uint32_t ng_get_info_ptr(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  if (parse_u32_input(input, input_len, &handle_id) != 0) return NG2_ERR_INVALID_ARG;
  Ng2Handle *handle = find_handle(handle_id);
  if (!handle) return NG2_ERR_INVALID_HANDLE;
  output_u32((ng2_u32)(uintptr_t)&g_graph_slots[handle->graph_slot].info);
  return NG2_OK;
}

uint32_t ng_get_info_size(void) {
  output_u32((ng2_u32)sizeof(Ng2Info));
  return NG2_OK;
}

uint32_t ng_debug_load_sample(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  if (parse_u32_input(input, input_len, &handle_id) != 0) return NG2_ERR_INVALID_ARG;
  Ng2Handle *handle = find_handle(handle_id);
  if (!handle) return NG2_ERR_INVALID_HANDLE;
  load_sample_graph(handle);
  output_u32(handle_id);
  return NG2_OK;
}
