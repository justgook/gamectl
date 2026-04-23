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
static char g_temp_json_a[NG2_IO_BUFFER_CAP];
static char g_temp_json_b[NG2_IO_BUFFER_CAP];

static ng2_i32 valid_node_kind(ng2_u32 kind);
static Ng2Handle *alloc_handle(void);
static ng2_u32 close_handle_id_silent(ng2_u32 handle_id);

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

static ng2_u32 fs_read_text_str(const char *path, char *out, ng2_u32 out_cap) {
  pdk_call_result_t result = pdk_call_plugin_str("fs", "read", (const uint8_t *)path,
                                                 pdk_strlen(path));
  if (result.error != 0) {
    output_text("fs read bridge failed");
    return NG2_ERR_NOT_IMPLEMENTED;
  }
  if (result.return_code != 0) {
    if (result.output != 0 && result.output_len > 0) {
      pdk_output(result.output, result.output_len);
    } else {
      output_text("fs read failed");
    }
    return NG2_ERR_NOT_IMPLEMENTED;
  }
  if (result.output_len + 1u > out_cap) {
    output_text("fs read output too large");
    return NG2_ERR_CAPACITY;
  }
  if (result.output_len > 0) {
    pdk_memcpy(out, result.output, result.output_len);
  }
  out[result.output_len] = '\0';
  return NG2_OK;
}

static ng2_u32 sql_query_str(const char *sql, char *out, ng2_u32 out_cap) {
  pdk_call_result_t result = pdk_call_plugin_str("sql", "query", (const uint8_t *)sql,
                                                 pdk_strlen(sql));
  if (result.error != 0) {
    output_text("sql query bridge failed");
    return NG2_ERR_NOT_IMPLEMENTED;
  }
  if (result.return_code != 0) {
    if (result.output != 0 && result.output_len > 0) {
      pdk_output(result.output, result.output_len);
    } else {
      output_text("sql query failed");
    }
    return NG2_ERR_NOT_IMPLEMENTED;
  }
  if (result.output_len + 1u > out_cap) {
    output_text("sql query output too large");
    return NG2_ERR_CAPACITY;
  }
  if (result.output_len > 0) {
    pdk_memcpy(out, result.output, result.output_len);
  }
  out[result.output_len] = '\0';
  return NG2_OK;
}

static ng2_u32 copy_cstr(char *dst, ng2_u32 dst_cap, const char *src) {
  ng2_u32 i = 0;
  while (i + 1u < dst_cap && src[i] != '\0') {
    dst[i] = src[i];
    i += 1u;
  }
  if (src[i] != '\0') return NG2_ERR_CAPACITY;
  dst[i] = '\0';
  return NG2_OK;
}

static ng2_u32 sql_escape_string(const char *src, char *out, ng2_u32 out_cap) {
  ng2_u32 out_len = 0;
  for (ng2_u32 i = 0; src[i] != '\0'; i++) {
    char c = src[i];
    if (c == '\'') {
      if (out_len + 2u >= out_cap) return NG2_ERR_CAPACITY;
      out[out_len++] = '\'';
      out[out_len++] = '\'';
      continue;
    }
    if (out_len + 1u >= out_cap) return NG2_ERR_CAPACITY;
    out[out_len++] = c;
  }
  out[out_len] = '\0';
  return NG2_OK;
}

static ng2_i32 csv_read_field(const char **cursor, char *out, ng2_u32 out_cap) {
  const char *p = *cursor;
  ng2_u32 out_len = 0;
  if (*p == '\0') return 0;
  if (*p == '"') {
    p += 1;
    while (*p != '\0') {
      if (*p == '"') {
        if (p[1] == '"') {
          if (out_len + 1u >= out_cap) return -1;
          out[out_len++] = '"';
          p += 2;
          continue;
        }
        p += 1;
        break;
      }
      if (out_len + 1u >= out_cap) return -1;
      out[out_len++] = *p++;
    }
  } else {
    while (*p != '\0' && *p != ',' && *p != '\n' && *p != '\r') {
      if (out_len + 1u >= out_cap) return -1;
      out[out_len++] = *p++;
    }
  }
  out[out_len] = '\0';
  if (*p == ',') p += 1;
  else {
    while (*p == '\r' || *p == '\n') p += 1;
  }
  *cursor = p;
  return 1;
}

static ng2_i32 csv_skip_header(const char **cursor) {
  const char *p = *cursor;
  while (*p != '\0' && *p != '\n') p += 1;
  if (*p == '\n') p += 1;
  *cursor = p;
  return *p != '\0';
}

static ng2_i32 find_array_range(const char *json, const char *key, const char **start_out,
                                const char **end_out) {
  uint32_t key_pos = 0;
  uint32_t value_pos = 0;
  uint32_t len = pdk_strlen(json);
  if (!json_find_key((const uint8_t *)json, len, key, &key_pos)) return 0;
  if (!json_find_value_start((const uint8_t *)json, len, key_pos, &value_pos)) return 0;
  if (json[value_pos] != '[') return 0;
  {
    const char *p = json + value_pos;
    uint32_t depth = 0;
    ng2_i32 in_string = 0;
    ng2_i32 escaped = 0;
    while (*p != '\0') {
      char c = *p;
      if (in_string) {
        if (escaped) escaped = 0;
        else if (c == '\\') escaped = 1;
        else if (c == '"') in_string = 0;
        p += 1;
        continue;
      }
      if (c == '"') {
        in_string = 1;
        p += 1;
        continue;
      }
      if (c == '[') depth += 1u;
      else if (c == ']') {
        depth -= 1u;
        if (depth == 0) {
          *start_out = json + value_pos + 1u;
          *end_out = p;
          return 1;
        }
      }
      p += 1;
    }
  }
  return 0;
}

static const char *skip_ws_and_commas(const char *p, const char *end) {
  while (p < end && (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t' || *p == ',')) p += 1;
  return p;
}

static ng2_i32 next_object_in_array(const char **cursor, const char *end,
                                    char *out, ng2_u32 out_cap) {
  const char *p = skip_ws_and_commas(*cursor, end);
  const char *start = p;
  uint32_t depth = 0;
  ng2_u32 out_len = 0;
  ng2_i32 in_string = 0;
  ng2_i32 escaped = 0;
  if (p >= end || *p != '{') {
    *cursor = p;
    return 0;
  }
  while (p < end) {
    char c = *p++;
    if (out_len + 1u >= out_cap) return -1;
    out[out_len++] = c;
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
        *cursor = p;
        return 1;
      }
    }
  }
  *cursor = start;
  return -1;
}

static void serialize_graph_json(Ng2Info *info, char *out, ng2_u32 out_cap, ng2_u32 *out_len) {
  ng2_u32 pos = 0;
#define APPEND_CHAR(ch) do { if (pos + 1u >= out_cap) return; out[pos++] = (ch); } while (0)
#define APPEND_STR(str) do { const char *s__ = (str); while (*s__ != '\0') { if (pos + 1u >= out_cap) return; out[pos++] = *s__++; } } while (0)
#define APPEND_U32(v) do { char num__[32]; ng2_u32 n__ = 0; ng2_u32 value__ = (v); if (value__ == 0) num__[n__++] = '0'; while (value__ > 0) { num__[n__++] = (char)('0' + (value__ % 10u)); value__ /= 10u; } for (ng2_u32 i__ = 0; i__ < n__ / 2u; i__++) { char t__ = num__[i__]; num__[i__] = num__[n__ - 1u - i__]; num__[n__ - 1u - i__] = t__; } for (ng2_u32 i__ = 0; i__ < n__; i__++) { if (pos + 1u >= out_cap) return; out[pos++] = num__[i__]; } } while (0)
  APPEND_STR("{\"nodes\":[");
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    Ng2Node *node = &info->nodes[i];
    if (i > 0) APPEND_CHAR(',');
    APPEND_STR("{\"id\":"); APPEND_U32(node->id);
    APPEND_STR(",\"kind\":"); APPEND_U32(node->kind);
    APPEND_STR(",\"execState\":"); APPEND_U32(node->exec_state);
    APPEND_STR(",\"inputs\":[");
    for (ng2_u32 j = 0; j < node->input_count; j++) {
      if (j > 0) APPEND_CHAR(',');
      APPEND_STR("{\"inputId\":"); APPEND_U32(node->inputs[j].id);
      APPEND_STR(",\"srcNodeId\":"); APPEND_U32(node->inputs[j].src_node_id);
      APPEND_STR(",\"srcOutputId\":"); APPEND_U32(node->inputs[j].src_output_id);
      APPEND_CHAR('}');
    }
    APPEND_STR("],\"outputs\":[");
    for (ng2_u32 j = 0; j < node->output_count; j++) {
      if (j > 0) APPEND_CHAR(',');
      APPEND_STR("{\"outputId\":"); APPEND_U32(node->outputs[j].id);
      APPEND_CHAR('}');
    }
    APPEND_STR("]}");
  }
  APPEND_STR(",\"edges\":[");
  {
    ng2_i32 first_edge = 1;
    for (ng2_u32 i = 0; i < info->node_count; i++) {
      Ng2Node *node = &info->nodes[i];
      for (ng2_u32 j = 0; j < node->input_count; j++) {
        Ng2InputPort *input = &node->inputs[j];
        if (input->src_node_id == 0) continue;
        if (!first_edge) APPEND_CHAR(',');
        first_edge = 0;
        APPEND_STR("{\"from\":"); APPEND_U32(input->src_node_id);
        APPEND_STR(",\"fromOutputId\":"); APPEND_U32(input->src_output_id);
        APPEND_STR(",\"to\":"); APPEND_U32(node->id);
        APPEND_STR(",\"toInputId\":"); APPEND_U32(input->id);
        APPEND_STR(",\"execState\":"); APPEND_U32(node->exec_state);
        APPEND_CHAR('}');
      }
    }
  }
  APPEND_STR("]}");
  out[pos] = '\0';
  if (out_len) *out_len = pos;
#undef APPEND_CHAR
#undef APPEND_STR
#undef APPEND_U32
}

static ng2_u32 store_raw_graph_json(Ng2Info *info, const char *json) {
  ng2_u32 len = pdk_strlen(json);
  if (len + 1u > NG2_IO_BUFFER_CAP) return NG2_ERR_CAPACITY;
  pdk_memcpy(info->io_buf, json, len + 1u);
  info->io_len = (ng2_i32)len;
  return NG2_OK;
}

static ng2_u32 query_graph_json_by_name(const char *name, char *raw_data_out, ng2_u32 raw_data_cap,
                                        char *resolved_name_out, ng2_u32 resolved_name_cap) {
  char escaped_name[512] = {0};
  char sql[1024] = {0};
  char csv[NG2_IO_BUFFER_CAP] = {0};
  const char *cursor = 0;
  char row_name[256] = {0};
  ng2_u32 rc = sql_escape_string(name, escaped_name, (ng2_u32)sizeof(escaped_name));
  if (rc != NG2_OK) return rc;
  {
    const char prefix[] = "SELECT name, data FROM ng2_graph_storage WHERE name='";
    const char suffix[] = "' LIMIT 1";
    ng2_u32 pos = 0;
    for (ng2_u32 i = 0; i < sizeof(prefix) - 1u; i++) sql[pos++] = prefix[i];
    for (ng2_u32 i = 0; escaped_name[i] != '\0'; i++) sql[pos++] = escaped_name[i];
    for (ng2_u32 i = 0; i < sizeof(suffix) - 1u; i++) sql[pos++] = suffix[i];
    sql[pos] = '\0';
  }
  rc = sql_query_str(sql, csv, NG2_IO_BUFFER_CAP);
  if (rc != NG2_OK) return rc;
  cursor = csv;
  if (!csv_skip_header(&cursor)) return NG2_ERR_INVALID_ARG;
  if (csv_read_field(&cursor, row_name, (ng2_u32)sizeof(row_name)) <= 0) return NG2_ERR_INVALID_ARG;
  if (csv_read_field(&cursor, raw_data_out, raw_data_cap) <= 0) return NG2_ERR_INVALID_ARG;
  if (resolved_name_out && resolved_name_cap > 0) {
    rc = copy_cstr(resolved_name_out, resolved_name_cap, row_name);
    if (rc != NG2_OK) return rc;
  }
  return NG2_OK;
}

static ng2_u32 query_graph_json_by_id(ng2_u32 graph_id, char *raw_data_out, ng2_u32 raw_data_cap,
                                      char *resolved_name_out, ng2_u32 resolved_name_cap) {
  char sql[256] = {0};
  char csv[NG2_IO_BUFFER_CAP] = {0};
  const char *cursor = 0;
  char row_name[256] = {0};
  ng2_u32 rc = 0;
  {
    const char prefix[] = "SELECT name, data FROM ng2_graph_storage WHERE rowid=";
    ng2_u32 pos = 0;
    for (ng2_u32 i = 0; i < sizeof(prefix) - 1u; i++) sql[pos++] = prefix[i];
    if (graph_id == 0) sql[pos++] = '0';
    else {
      char num[32]; ng2_u32 n = 0; ng2_u32 value = graph_id;
      while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; }
      for (ng2_u32 i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; }
      for (ng2_u32 i = 0; i < n; i++) sql[pos++] = num[i];
    }
    sql[pos++] = ' ';
    sql[pos++] = 'L'; sql[pos++] = 'I'; sql[pos++] = 'M'; sql[pos++] = 'I'; sql[pos++] = 'T'; sql[pos++] = ' '; sql[pos++] = '1';
    sql[pos] = '\0';
  }
  rc = sql_query_str(sql, csv, NG2_IO_BUFFER_CAP);
  if (rc != NG2_OK) return rc;
  cursor = csv;
  if (!csv_skip_header(&cursor)) return NG2_ERR_INVALID_ARG;
  if (csv_read_field(&cursor, row_name, (ng2_u32)sizeof(row_name)) <= 0) return NG2_ERR_INVALID_ARG;
  if (csv_read_field(&cursor, raw_data_out, raw_data_cap) <= 0) return NG2_ERR_INVALID_ARG;
  if (resolved_name_out && resolved_name_cap > 0) {
    rc = copy_cstr(resolved_name_out, resolved_name_cap, row_name);
    if (rc != NG2_OK) return rc;
  }
  return NG2_OK;
}

static ng2_u32 count_graph_nodes_in_json(const char *json, ng2_u32 *count_out) {
  const char *nodes_start = 0;
  const char *nodes_end = 0;
  const char *cursor = 0;
  char node_json[8192];
  ng2_u32 count = 0;
  if (!find_array_range(json, "nodes", &nodes_start, &nodes_end)) return NG2_ERR_INVALID_ARG;
  cursor = nodes_start;
  while (1) {
    ng2_i32 has_node = next_object_in_array(&cursor, nodes_end, node_json, (ng2_u32)sizeof(node_json));
    if (has_node < 0) return NG2_ERR_INVALID_ARG;
    if (has_node == 0) break;
    count += 1u;
  }
  *count_out = count;
  return NG2_OK;
}

static ng2_u32 load_graph_json_into_info(Ng2Info *info, const char *json) {
  const char *nodes_start = 0;
  const char *nodes_end = 0;
  const char *cursor = 0;
  char node_json[8192];
  if (!find_array_range(json, "nodes", &nodes_start, &nodes_end)) return NG2_ERR_INVALID_ARG;
  info->node_count = 0;
  cursor = nodes_start;
  while (1) {
    ng2_i32 has_node = next_object_in_array(&cursor, nodes_end, node_json, (ng2_u32)sizeof(node_json));
    if (has_node < 0) return NG2_ERR_INVALID_ARG;
    if (has_node == 0) break;
    if (info->node_count >= NG2_MAX_NODES) return NG2_ERR_CAPACITY;
    {
      Ng2Node *node = &info->nodes[info->node_count++];
      const char *inputs_start = 0;
      const char *inputs_end = 0;
      const char *outputs_start = 0;
      const char *outputs_end = 0;
      const char *port_cursor = 0;
      char port_json[1024];
      ng2_zero(node, (ng2_u32)sizeof(Ng2Node));
      if (!json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "id", &node->id)) return NG2_ERR_INVALID_ARG;
      if (!json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "kind", &node->kind)) return NG2_ERR_INVALID_ARG;
      if (!valid_node_kind(node->kind)) return NG2_ERR_INVALID_ARG;
      if (!json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "execState", &node->exec_state)) node->exec_state = NG2_EXEC_NEVER;
      if (find_array_range(node_json, "inputs", &inputs_start, &inputs_end)) {
        port_cursor = inputs_start;
        while (1) {
          ng2_i32 has_port = next_object_in_array(&port_cursor, inputs_end, port_json, (ng2_u32)sizeof(port_json));
          if (has_port < 0) return NG2_ERR_INVALID_ARG;
          if (has_port == 0) break;
          if (node->input_count >= NG2_MAX_INPUTS) return NG2_ERR_CAPACITY;
          json_extract_u32((const uint8_t *)port_json, pdk_strlen(port_json), "inputId", &node->inputs[node->input_count].id);
          json_extract_u32((const uint8_t *)port_json, pdk_strlen(port_json), "srcNodeId", &node->inputs[node->input_count].src_node_id);
          json_extract_u32((const uint8_t *)port_json, pdk_strlen(port_json), "srcOutputId", &node->inputs[node->input_count].src_output_id);
          node->input_count += 1u;
        }
      }
      if (find_array_range(node_json, "outputs", &outputs_start, &outputs_end)) {
        port_cursor = outputs_start;
        while (1) {
          ng2_i32 has_port = next_object_in_array(&port_cursor, outputs_end, port_json, (ng2_u32)sizeof(port_json));
          if (has_port < 0) return NG2_ERR_INVALID_ARG;
          if (has_port == 0) break;
          if (node->output_count >= NG2_MAX_OUTPUTS) return NG2_ERR_CAPACITY;
          json_extract_u32((const uint8_t *)port_json, pdk_strlen(port_json), "outputId", &node->outputs[node->output_count].id);
          node->output_count += 1u;
        }
      }
      node->generation = info->generation;
    }
  }
  return NG2_OK;
}

static ng2_u32 open_graph_handle_by_name(const char *name, Ng2Handle **handle_out,
                                         char *raw_data_out, ng2_u32 raw_data_cap,
                                         char *resolved_name_out, ng2_u32 resolved_name_cap) {
  Ng2Handle *handle = 0;
  ng2_u32 rc = query_graph_json_by_name(name, raw_data_out, raw_data_cap,
                                        resolved_name_out, resolved_name_cap);
  if (rc != NG2_OK) return rc;
  handle = alloc_handle();
  if (!handle) return NG2_ERR_CAPACITY;
  rc = load_graph_json_into_info(&g_graph_slots[handle->graph_slot].info, raw_data_out);
  if (rc != NG2_OK) {
    close_handle_id_silent(handle->handle);
    return rc;
  }
  rc = store_raw_graph_json(&g_graph_slots[handle->graph_slot].info, raw_data_out);
  if (rc != NG2_OK) {
    close_handle_id_silent(handle->handle);
    return rc;
  }
  *handle_out = handle;
  return NG2_OK;
}

static ng2_i32 find_node_object_by_id(const char *graph_json, ng2_u32 node_id,
                                      char *node_json_out, ng2_u32 node_json_cap) {
  const char *nodes_start = 0;
  const char *nodes_end = 0;
  const char *cursor = 0;
  char node_json[8192];
  if (!find_array_range(graph_json, "nodes", &nodes_start, &nodes_end)) return 0;
  cursor = nodes_start;
  while (1) {
    ng2_i32 has_node = next_object_in_array(&cursor, nodes_end, node_json, (ng2_u32)sizeof(node_json));
    ng2_u32 candidate_id = 0;
    if (has_node < 0) return -1;
    if (has_node == 0) return 0;
    if (!json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "id", &candidate_id)) continue;
    if (candidate_id != node_id) continue;
    if (pdk_strlen(node_json) + 1u > node_json_cap) return -1;
    pdk_memcpy(node_json_out, node_json, pdk_strlen(node_json) + 1u);
    return 1;
  }
}

static ng2_i32 find_port_object_by_key(const char *node_json, const char *array_key,
                                       const char *id_key, ng2_u32 port_id,
                                       char *port_json_out, ng2_u32 port_json_cap) {
  const char *ports_start = 0;
  const char *ports_end = 0;
  const char *cursor = 0;
  char port_json[1024];
  if (!find_array_range(node_json, array_key, &ports_start, &ports_end)) return 0;
  cursor = ports_start;
  while (1) {
    ng2_i32 has_port = next_object_in_array(&cursor, ports_end, port_json, (ng2_u32)sizeof(port_json));
    ng2_u32 candidate_id = 0;
    if (has_port < 0) return -1;
    if (has_port == 0) return 0;
    if (!json_extract_u32((const uint8_t *)port_json, pdk_strlen(port_json), id_key, &candidate_id)) continue;
    if (candidate_id != port_id) continue;
    if (pdk_strlen(port_json) + 1u > port_json_cap) return -1;
    pdk_memcpy(port_json_out, port_json, pdk_strlen(port_json) + 1u);
    return 1;
  }
}

static ng2_u32 encode_import_boundary_port_id(ng2_u32 node_id, ng2_u32 port_id) {
  return node_id * 33u + port_id;
}

static const char *skip_ws(const char *p) {
  while (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t') p += 1;
  return p;
}

static ng2_i32 parse_bracket_u32_expr(const char **cursor, ng2_u32 *value_out) {
  const char *p = *cursor;
  ng2_u32 value = 0;
  ng2_u32 digits = 0;
  p = skip_ws(p);
  if (*p != '[') return 0;
  p += 1;
  p = skip_ws(p);
  while (*p >= '0' && *p <= '9') {
    value = value * 10u + (ng2_u32)(*p - '0');
    digits += 1u;
    p += 1;
  }
  p = skip_ws(p);
  if (*p != ']') return 0;
  if (digits == 0) return 0;
  p += 1;
  *cursor = p;
  *value_out = value;
  return 1;
}

static ng2_i32 copy_quoted_string(const char **cursor, char *out, ng2_u32 out_cap) {
  const char *p = *cursor;
  char quote = *p;
  ng2_u32 out_len = 0;
  if (quote != '\'' && quote != '"') return 0;
  p += 1;
  while (*p != '\0' && *p != quote) {
    char c = *p++;
    if (c == '\\' && *p != '\0') c = *p++;
    if (out_len + 1u >= out_cap) return -1;
    out[out_len++] = c;
  }
  if (*p != quote) return -1;
  p += 1;
  out[out_len] = '\0';
  *cursor = p;
  return 1;
}

static ng2_i32 resolve_node_output_value(const char *graph_json, ng2_u32 node_id,
                                         ng2_u32 output_id, const char *parent_graph_json,
                                         const char *parent_import_node_json,
                                         ng2_u32 depth, char *value_out,
                                         ng2_u32 value_out_cap);
static ng2_i32 resolve_input_value(const char *graph_json, ng2_u32 node_id,
                                   ng2_u32 input_id, const char *parent_graph_json,
                                   const char *parent_import_node_json,
                                   ng2_u32 depth, char *value_out,
                                   ng2_u32 value_out_cap);

static ng2_i32 evaluate_code_expression(const char *expr, const char *graph_json,
                                        ng2_u32 node_id, const char *parent_graph_json,
                                        const char *parent_import_node_json,
                                        ng2_u32 depth, char *value_out,
                                        ng2_u32 value_out_cap) {
  const char *p = skip_ws(expr);
  if (p[0] == 'i' && p[1] == 'n' && p[2] == 'p' && p[3] == 'u' && p[4] == 't' && p[5] == 's') {
    ng2_u32 input_id = 0;
    p += 6;
    if (!parse_bracket_u32_expr(&p, &input_id)) return 0;
    return resolve_input_value(graph_json, node_id, input_id, parent_graph_json,
                               parent_import_node_json, depth + 1u, value_out,
                               value_out_cap);
  }
  if (*p == '\'' || *p == '"') {
    return copy_quoted_string(&p, value_out, value_out_cap);
  }
  if ((*p >= '0' && *p <= '9') || *p == '-') {
    ng2_u32 out_len = 0;
    while ((*p >= '0' && *p <= '9') || *p == '-') {
      if (out_len + 1u >= value_out_cap) return -1;
      value_out[out_len++] = *p++;
    }
    value_out[out_len] = '\0';
    return 1;
  }
  return 0;
}

static ng2_i32 evaluate_code_node_output(const char *graph_json, const char *node_json,
                                         ng2_u32 node_id, ng2_u32 output_id,
                                         const char *parent_graph_json,
                                         const char *parent_import_node_json,
                                         ng2_u32 depth, char *value_out,
                                         ng2_u32 value_out_cap) {
  char code[8192] = {0};
  char code_path[512] = {0};
  const char *cursor = 0;
  if (json_extract_string((const uint8_t *)node_json, pdk_strlen(node_json), "code", code, (uint32_t)sizeof(code)) && code[0] != '\0') {
  } else if (json_extract_string((const uint8_t *)node_json, pdk_strlen(node_json), "codePath", code_path, (uint32_t)sizeof(code_path)) && code_path[0] != '\0') {
    if (fs_read_text_str(code_path, code, (ng2_u32)sizeof(code)) != NG2_OK) return 0;
  } else {
    return 0;
  }
  cursor = code;
  while (*cursor != '\0') {
    const char *p = skip_ws(cursor);
    ng2_u32 candidate_output_id = 0;
    if (!(p[0] == 'o' && p[1] == 'u' && p[2] == 't' && p[3] == 'p' && p[4] == 'u' && p[5] == 't' && p[6] == 's')) {
      while (*cursor != '\0' && *cursor != '\n' && *cursor != ';') cursor += 1;
      if (*cursor == '\n' || *cursor == ';') cursor += 1;
      continue;
    }
    p += 7;
    if (!parse_bracket_u32_expr(&p, &candidate_output_id)) {
      while (*cursor != '\0' && *cursor != '\n' && *cursor != ';') cursor += 1;
      if (*cursor == '\n' || *cursor == ';') cursor += 1;
      continue;
    }
    p = skip_ws(p);
    if (*p != '=') {
      while (*cursor != '\0' && *cursor != '\n' && *cursor != ';') cursor += 1;
      if (*cursor == '\n' || *cursor == ';') cursor += 1;
      continue;
    }
    p += 1;
    if (candidate_output_id == output_id) {
      return evaluate_code_expression(p, graph_json, node_id, parent_graph_json,
                                      parent_import_node_json, depth + 1u,
                                      value_out, value_out_cap);
    }
    while (*cursor != '\0' && *cursor != '\n' && *cursor != ';') cursor += 1;
    if (*cursor == '\n' || *cursor == ';') cursor += 1;
  }
  return 0;
}

static ng2_i32 resolve_input_value(const char *graph_json, ng2_u32 node_id,
                                   ng2_u32 input_id, const char *parent_graph_json,
                                   const char *parent_import_node_json,
                                   ng2_u32 depth, char *value_out,
                                   ng2_u32 value_out_cap) {
  char node_json[8192];
  char input_json[1024];
  ng2_u32 src_node_id = 0;
  ng2_u32 src_output_id = 0;
  ng2_i32 found = find_node_object_by_id(graph_json, node_id, node_json, (ng2_u32)sizeof(node_json));
  if (found <= 0) return found;
  found = find_port_object_by_key(node_json, "inputs", "inputId", input_id, input_json, (ng2_u32)sizeof(input_json));
  if (found <= 0) return found;
  json_extract_u32((const uint8_t *)input_json, pdk_strlen(input_json), "srcNodeId", &src_node_id);
  json_extract_u32((const uint8_t *)input_json, pdk_strlen(input_json), "srcOutputId", &src_output_id);
  if (src_node_id == 0) return 0;
  return resolve_node_output_value(graph_json, src_node_id, src_output_id, parent_graph_json,
                                   parent_import_node_json, depth + 1u, value_out,
                                   value_out_cap);
}

static ng2_i32 resolve_import_output_value(const char *graph_json, const char *import_node_json,
                                           ng2_u32 output_id, ng2_u32 depth,
                                           char *value_out, ng2_u32 value_out_cap) {
  char graph_name[256] = {0};
  ng2_u32 graph_id = 0;
  uint32_t subgraph_ptr = 0;
  char *subgraph_json = 0;
  char subgraph_name[256] = {0};
  ng2_i32 resolved = 0;
  char node_json[8192];
  const char *nodes_start = 0;
  const char *nodes_end = 0;
  const char *cursor = 0;
  if (depth > 8u) return -1;
  json_extract_string((const uint8_t *)import_node_json, pdk_strlen(import_node_json), "graphName", graph_name, (uint32_t)sizeof(graph_name));
  json_extract_u32((const uint8_t *)import_node_json, pdk_strlen(import_node_json), "graphId", &graph_id);
  subgraph_ptr = pdk_alloc(NG2_IO_BUFFER_CAP);
  subgraph_json = (char *)(uintptr_t)subgraph_ptr;
  if (graph_name[0] != '\0') {
    if (query_graph_json_by_name(graph_name, subgraph_json, NG2_IO_BUFFER_CAP, subgraph_name, (ng2_u32)sizeof(subgraph_name)) != NG2_OK) {
      pdk_free(subgraph_ptr);
      return 0;
    }
  } else if (graph_id != 0) {
    if (query_graph_json_by_id(graph_id, subgraph_json, NG2_IO_BUFFER_CAP, subgraph_name, (ng2_u32)sizeof(subgraph_name)) != NG2_OK) {
      pdk_free(subgraph_ptr);
      return 0;
    }
  } else {
    pdk_free(subgraph_ptr);
    return 0;
  }
  if (!find_array_range(subgraph_json, "nodes", &nodes_start, &nodes_end)) {
    pdk_free(subgraph_ptr);
    return 0;
  }
  cursor = nodes_start;
  while (1) {
    ng2_i32 has_node = next_object_in_array(&cursor, nodes_end, node_json, (ng2_u32)sizeof(node_json));
    ng2_u32 kind = 0;
    ng2_u32 sub_node_id = 0;
    char input_json[1024];
    ng2_u32 sub_input_id = 0;
    ng2_u32 expected_port_id = 0;
    if (has_node <= 0) break;
    json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "id", &sub_node_id);
    json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "kind", &kind);
    if (kind != NG2_NODE_GOAL) continue;
    {
      const char *goal_inputs_start = 0;
      const char *goal_inputs_end = 0;
      if (!find_array_range(node_json, "inputs", &goal_inputs_start, &goal_inputs_end)) continue;
      {
        const char *goal_cursor = goal_inputs_start;
        while (1) {
          ng2_i32 has_input = next_object_in_array(&goal_cursor, goal_inputs_end, input_json, (ng2_u32)sizeof(input_json));
          if (has_input <= 0) break;
          json_extract_u32((const uint8_t *)input_json, pdk_strlen(input_json), "inputId", &sub_input_id);
          expected_port_id = encode_import_boundary_port_id(sub_node_id, sub_input_id);
          if (expected_port_id != output_id) continue;
          resolved = resolve_input_value(subgraph_json, sub_node_id, sub_input_id, graph_json,
                                         import_node_json, depth + 1u, value_out,
                                         value_out_cap);
          pdk_free(subgraph_ptr);
          return resolved;
        }
      }
    }
  }
  pdk_free(subgraph_ptr);
  return 0;
}

static ng2_i32 resolve_node_output_value(const char *graph_json, ng2_u32 node_id,
                                         ng2_u32 output_id, const char *parent_graph_json,
                                         const char *parent_import_node_json,
                                         ng2_u32 depth, char *value_out,
                                         ng2_u32 value_out_cap) {
  char node_json[8192];
  char output_json[1024];
  ng2_u32 kind = 0;
  if (depth > 8u) return -1;
  {
    ng2_i32 found = find_node_object_by_id(graph_json, node_id, node_json, (ng2_u32)sizeof(node_json));
    if (found <= 0) return found;
  }
  json_extract_u32((const uint8_t *)node_json, pdk_strlen(node_json), "kind", &kind);
  if (kind == NG2_NODE_VALUE) {
    ng2_i32 found = 0;
    if (parent_graph_json != 0 && parent_import_node_json != 0) {
      ng2_u32 encoded = encode_import_boundary_port_id(node_id, output_id);
      char import_input_json[1024];
      ng2_u32 src_node_id = 0;
      ng2_u32 src_output_id = 0;
      found = find_port_object_by_key(parent_import_node_json, "inputs", "inputId", encoded, import_input_json, (ng2_u32)sizeof(import_input_json));
      if (found > 0) {
        json_extract_u32((const uint8_t *)import_input_json, pdk_strlen(import_input_json), "srcNodeId", &src_node_id);
        json_extract_u32((const uint8_t *)import_input_json, pdk_strlen(import_input_json), "srcOutputId", &src_output_id);
        if (src_node_id != 0) {
          return resolve_node_output_value(parent_graph_json, src_node_id, src_output_id, 0, 0, depth + 1u, value_out, value_out_cap);
        }
      }
    }
    found = find_port_object_by_key(node_json, "outputs", "outputId", output_id, output_json, (ng2_u32)sizeof(output_json));
    if (found <= 0) return found;
    if (!json_extract_string((const uint8_t *)output_json, pdk_strlen(output_json), "value", value_out, value_out_cap)) {
      value_out[0] = '\0';
    }
    return 1;
  }
  if (kind == NG2_NODE_CALL) {
    return resolve_import_output_value(graph_json, node_json, output_id, depth + 1u, value_out, value_out_cap);
  }
  if (kind == NG2_NODE_CODE) {
    return evaluate_code_node_output(graph_json, node_json, node_id, output_id,
                                     parent_graph_json, parent_import_node_json,
                                     depth + 1u, value_out, value_out_cap);
  }
  return 0;
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

static Ng2Info *get_info_for_handle_id(ng2_u32 handle_id) {
  Ng2Handle *handle = find_handle(handle_id);
  if (!handle) return 0;
  return &g_graph_slots[handle->graph_slot].info;
}

static Ng2Node *find_node(Ng2Info *info, ng2_u32 node_id) {
  if (!info) return 0;
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    if (info->nodes[i].id == node_id) return &info->nodes[i];
  }
  return 0;
}

static void bump_generation(Ng2Info *info) {
  if (!info) return;
  info->generation += 1u;
  info->io_len = 0;
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    info->nodes[i].generation = info->generation;
  }
}

static ng2_i32 node_kind_supports_inputs(ng2_u32 kind) {
  return kind == NG2_NODE_CODE || kind == NG2_NODE_GOAL || kind == NG2_NODE_CALL;
}

static ng2_i32 node_kind_supports_outputs(ng2_u32 kind) {
  return kind == NG2_NODE_CODE || kind == NG2_NODE_VALUE || kind == NG2_NODE_CALL;
}

static ng2_i32 valid_node_kind(ng2_u32 kind) {
  return kind == NG2_NODE_GOAL || kind == NG2_NODE_CODE || kind == NG2_NODE_CALL || kind == NG2_NODE_VALUE;
}

static ng2_u32 parse_handle_and_node_id(const uint8_t *input, uint32_t input_len,
                                        ng2_u32 *handle_id_out, ng2_u32 *node_id_out,
                                        Ng2Info **info_out, Ng2Node **node_out) {
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  if (!json_extract_u32(input, input_len, "handle", &handle_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "nodeId", &node_id)) return NG2_ERR_INVALID_ARG;
  info = get_info_for_handle_id(handle_id);
  if (!info) return NG2_ERR_INVALID_HANDLE;
  node = find_node(info, node_id);
  if (!node) return NG2_ERR_INVALID_ARG;
  *handle_id_out = handle_id;
  *node_id_out = node_id;
  *info_out = info;
  *node_out = node;
  return NG2_OK;
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
  char raw_graph_json[NG2_IO_BUFFER_CAP] = {0};
  Ng2Handle *handle = 0;
  Ng2Info *info = 0;
  const char *runtime_graph_json = 0;
  ng2_u32 goal_ids[NG2_MAX_NODES] = {0};
  ng2_u32 goal_count = 0;
  ng2_u32 rc = 0;
  ng2_u32 pos = 0;

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
    rc = open_graph_handle_by_name(graph_name, &handle, raw_graph_json, NG2_IO_BUFFER_CAP, graph_name, (ng2_u32)sizeof(graph_name));
    if (rc != NG2_OK) return rc;
    handle_id = handle->handle;
    temp_handle = 1;
  }

  if (!has_goal) goal_id = 0;
  if (graph_name[0] == '\0') {
    if (!json_extract_string(input, input_len, "graph", graph_name, (uint32_t)sizeof(graph_name))) {
      const char default_name[] = "<handle>";
      for (uint32_t i = 0; i < sizeof(default_name); i++) graph_name[i] = default_name[i];
    }
  }

  info = &g_graph_slots[handle->graph_slot].info;
  if (info->io_len > 0) {
    runtime_graph_json = info->io_buf;
  } else {
    ng2_u32 serialized_len = 0;
    serialize_graph_json(info, g_temp_json_a, NG2_IO_BUFFER_CAP, &serialized_len);
    if (serialized_len == 0) {
      if (close_after || temp_handle) close_handle_id_silent(handle_id);
      return NG2_ERR_CAPACITY;
    }
    runtime_graph_json = g_temp_json_a;
  }
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    Ng2Node *node = &info->nodes[i];
    if (goal_id != 0 && node->id != goal_id) {
      node->exec_state = NG2_EXEC_NEVER;
      continue;
    }
    if (node->kind != NG2_NODE_GOAL) continue;
    goal_ids[goal_count++] = node->id;
    node->exec_state = NG2_EXEC_SUCCESS;
  }
  if (goal_id != 0 && goal_count == 0) {
    output_text("requested goal not found");
    if (close_after || temp_handle) close_handle_id_silent(handle_id);
    return NG2_ERR_INVALID_ARG;
  }
  if (goal_id == 0) {
    for (ng2_u32 i = 0; i < info->node_count; i++) {
      Ng2Node *node = &info->nodes[i];
      if (node->kind != NG2_NODE_GOAL) node->exec_state = goal_count > 0 ? NG2_EXEC_SUCCESS : NG2_EXEC_NEVER;
    }
  }
  bump_generation(info);

#define APPEND_LIT(s) do { const char lit[] = s; for (uint32_t i = 0; i < sizeof(lit) - 1u; i++) g_temp_json_b[pos++] = lit[i]; } while (0)
#define APPEND_BUF(buf, buf_len) do { for (uint32_t i = 0; i < (buf_len); i++) g_temp_json_b[pos++] = (buf)[i]; } while (0)
#define APPEND_CSTR(buf) do { uint32_t n = pdk_strlen(buf); APPEND_BUF(buf, n); } while (0)
#define APPEND_U32_RUN(v) do { char num[32]; uint32_t n = 0; ng2_u32 value = (v); if (value == 0) num[n++] = '0'; while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; } for (uint32_t i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; } APPEND_BUF(num, n); } while (0)

  APPEND_LIT("{\"success\":true,\"handle\":");
  APPEND_U32_RUN(handle_id);
  APPEND_LIT(",\"graph\":\"");
  APPEND_CSTR(graph_name);
  APPEND_LIT("\",\"goalCount\":");
  APPEND_U32_RUN(goal_count);
  APPEND_LIT(",\"goals\":[");
  for (ng2_u32 i = 0; i < goal_count; i++) {
    char goal_node_json[8192];
    const char *goal_inputs_start = 0;
    const char *goal_inputs_end = 0;
    const char *goal_cursor = 0;
    char goal_input_json[1024];
    if (i > 0) APPEND_LIT(",");
    APPEND_LIT("{\"goalNodeId\":");
    APPEND_U32_RUN(goal_ids[i]);
    APPEND_LIT(",\"payload\":{\"id\":");
    APPEND_U32_RUN(goal_ids[i]);
    APPEND_LIT(",\"requestedGoal\":");
    APPEND_U32_RUN(goal_id);
    APPEND_LIT(",\"inputs\":");
    APPEND_CSTR(inputs_json);
    APPEND_LIT(",\"goalInputs\":{");
    if (find_node_object_by_id(runtime_graph_json, goal_ids[i], goal_node_json, (ng2_u32)sizeof(goal_node_json)) > 0 &&
        find_array_range(goal_node_json, "inputs", &goal_inputs_start, &goal_inputs_end)) {
      goal_cursor = goal_inputs_start;
      {
        ng2_i32 first_goal_input = 1;
        while (1) {
          ng2_i32 has_input = next_object_in_array(&goal_cursor, goal_inputs_end, goal_input_json, (ng2_u32)sizeof(goal_input_json));
          ng2_u32 goal_input_id = 0;
          char goal_input_name[256] = {0};
          char resolved_value[2048] = {0};
          ng2_i32 resolved = 0;
          if (has_input <= 0) break;
          if (!json_extract_u32((const uint8_t *)goal_input_json, pdk_strlen(goal_input_json), "inputId", &goal_input_id)) continue;
          if (!json_extract_string((const uint8_t *)goal_input_json, pdk_strlen(goal_input_json), "name", goal_input_name, (uint32_t)sizeof(goal_input_name))) {
            goal_input_name[0] = '\0';
          }
          resolved = resolve_input_value(runtime_graph_json, goal_ids[i], goal_input_id, 0, 0, 0, resolved_value, (ng2_u32)sizeof(resolved_value));
          if (!first_goal_input) APPEND_LIT(",");
          first_goal_input = 0;
          APPEND_LIT("\"");
          if (goal_input_name[0] != '\0') APPEND_CSTR(goal_input_name);
          else APPEND_U32_RUN(goal_input_id);
          APPEND_LIT("\":");
          if (resolved > 0) {
            APPEND_LIT("\"");
            APPEND_CSTR(resolved_value);
            APPEND_LIT("\"");
          } else {
            APPEND_LIT("null");
          }
        }
      }
    }
    APPEND_LIT("},\"result\":\"goal-");
    APPEND_U32_RUN(goal_ids[i]);
    APPEND_LIT("\"}}");
  }
  APPEND_LIT("]}");
  g_temp_json_b[pos] = '\0';
  pdk_output((const uint8_t *)g_temp_json_b, pos);

#undef APPEND_LIT
#undef APPEND_BUF
#undef APPEND_CSTR
#undef APPEND_U32_RUN

  if (close_after || temp_handle) {
    rc = close_handle_id_silent(handle_id);
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

uint32_t ng_graph_open(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  char name[256] = {0};
  char row_name[256] = {0};
  Ng2Handle *handle = 0;
  ng2_u32 rc = 0;
  if (!json_extract_string(input, input_len, "name", name, (uint32_t)sizeof(name))) return NG2_ERR_INVALID_ARG;
  rc = open_graph_handle_by_name(name, &handle, g_temp_json_a, NG2_IO_BUFFER_CAP, row_name, (ng2_u32)sizeof(row_name));
  if (rc != NG2_OK) return rc;
  {
    Ng2Info *info = &g_graph_slots[handle->graph_slot].info;
    ng2_u32 pos = 0;
#define APPEND_LIT_OPEN(s) do { const char lit[] = s; for (ng2_u32 i = 0; i < sizeof(lit) - 1u; i++) g_temp_json_b[pos++] = lit[i]; } while (0)
#define APPEND_CSTR_OPEN(s) do { const char *p = (s); while (*p != '\0') g_temp_json_b[pos++] = *p++; } while (0)
#define APPEND_U32_OPEN(v) do { char num[32]; ng2_u32 n = 0; ng2_u32 value = (v); if (value == 0) num[n++] = '0'; while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; } for (ng2_u32 i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; } for (ng2_u32 i = 0; i < n; i++) g_temp_json_b[pos++] = num[i]; } while (0)
    APPEND_LIT_OPEN("{\"handle\":");
    APPEND_U32_OPEN(handle->handle);
    APPEND_LIT_OPEN(",\"name\":\"");
    APPEND_CSTR_OPEN(row_name);
    APPEND_LIT_OPEN("\",\"nodeCount\":");
    APPEND_U32_OPEN(info->node_count);
    APPEND_LIT_OPEN(",\"data\":");
    APPEND_CSTR_OPEN(g_temp_json_a);
    APPEND_LIT_OPEN("}");
    pdk_output((const uint8_t *)g_temp_json_b, pos);
#undef APPEND_LIT_OPEN
#undef APPEND_CSTR_OPEN
#undef APPEND_U32_OPEN
  }
  return NG2_OK;
}

uint32_t ng_graph_open_id(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 graph_id = 0;
  char row_name[256] = {0};
  Ng2Handle *handle = 0;
  ng2_u32 rc = 0;
  if (!json_extract_u32(input, input_len, "graphId", &graph_id)) return NG2_ERR_INVALID_ARG;
  rc = query_graph_json_by_id(graph_id, g_temp_json_a, NG2_IO_BUFFER_CAP, row_name, (ng2_u32)sizeof(row_name));
  if (rc != NG2_OK) return rc;
  handle = alloc_handle();
  if (!handle) return NG2_ERR_CAPACITY;
  rc = load_graph_json_into_info(&g_graph_slots[handle->graph_slot].info, g_temp_json_a);
  if (rc != NG2_OK) {
    close_handle_id_silent(handle->handle);
    return rc;
  }
  rc = store_raw_graph_json(&g_graph_slots[handle->graph_slot].info, g_temp_json_a);
  if (rc != NG2_OK) {
    close_handle_id_silent(handle->handle);
    return rc;
  }
  {
    Ng2Info *info = &g_graph_slots[handle->graph_slot].info;
    ng2_u32 pos = 0;
#define APPEND_LIT_OPENID(s) do { const char lit[] = s; for (ng2_u32 i = 0; i < sizeof(lit) - 1u; i++) g_temp_json_b[pos++] = lit[i]; } while (0)
#define APPEND_CSTR_OPENID(s) do { const char *p = (s); while (*p != '\0') g_temp_json_b[pos++] = *p++; } while (0)
#define APPEND_U32_OPENID(v) do { char num[32]; ng2_u32 n = 0; ng2_u32 value = (v); if (value == 0) num[n++] = '0'; while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; } for (ng2_u32 i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; } for (ng2_u32 i = 0; i < n; i++) g_temp_json_b[pos++] = num[i]; } while (0)
    APPEND_LIT_OPENID("{\"handle\":");
    APPEND_U32_OPENID(handle->handle);
    APPEND_LIT_OPENID(",\"name\":\"");
    APPEND_CSTR_OPENID(row_name);
    APPEND_LIT_OPENID("\",\"nodeCount\":");
    APPEND_U32_OPENID(info->node_count);
    APPEND_LIT_OPENID(",\"data\":");
    APPEND_CSTR_OPENID(g_temp_json_a);
    APPEND_LIT_OPENID("}");
    pdk_output((const uint8_t *)g_temp_json_b, pos);
#undef APPEND_LIT_OPENID
#undef APPEND_CSTR_OPENID
#undef APPEND_U32_OPENID
  }
  return NG2_OK;
}

uint32_t ng_graph_save(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  char name[256] = {0};
  char escaped_name[512] = {0};
  Ng2Info *info = 0;
  ng2_u32 saved_node_count = 0;
  ng2_u32 rc = 0;
  if (!json_extract_u32(input, input_len, "handle", &handle_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_string(input, input_len, "name", name, (uint32_t)sizeof(name))) return NG2_ERR_INVALID_ARG;
  info = get_info_for_handle_id(handle_id);
  if (!info) return NG2_ERR_INVALID_HANDLE;
  rc = sql_escape_string(name, escaped_name, (ng2_u32)sizeof(escaped_name));
  if (rc != NG2_OK) return rc;
  if (!json_extract_object_raw(input, input_len, "data", g_temp_json_a, NG2_IO_BUFFER_CAP)) {
    ng2_u32 serialized_len = 0;
    serialize_graph_json(info, g_temp_json_a, NG2_IO_BUFFER_CAP, &serialized_len);
    if (serialized_len == 0) return NG2_ERR_CAPACITY;
  }
  rc = count_graph_nodes_in_json(g_temp_json_a, &saved_node_count);
  if (rc != NG2_OK) return rc;
  rc = store_raw_graph_json(info, g_temp_json_a);
  if (rc != NG2_OK) return rc;
  rc = sql_escape_string(g_temp_json_a, g_temp_json_b, NG2_IO_BUFFER_CAP);
  if (rc != NG2_OK) return rc;
  {
    const char prefix[] = "INSERT INTO ng2_graph_storage (name, data, node_count, updated_at) VALUES ('";
    const char middle[] = "', '";
    const char suffix[] = "', ";
    const char suffix2[] = ", datetime('now')) ON CONFLICT(name) DO UPDATE SET data=excluded.data, node_count=excluded.node_count, updated_at=excluded.updated_at";
    ng2_u32 pos = 0;
    for (ng2_u32 i = 0; i < sizeof(prefix) - 1u; i++) g_temp_json_a[pos++] = prefix[i];
    for (ng2_u32 i = 0; escaped_name[i] != '\0'; i++) g_temp_json_a[pos++] = escaped_name[i];
    for (ng2_u32 i = 0; i < sizeof(middle) - 1u; i++) g_temp_json_a[pos++] = middle[i];
    for (ng2_u32 i = 0; g_temp_json_b[i] != '\0'; i++) g_temp_json_a[pos++] = g_temp_json_b[i];
    for (ng2_u32 i = 0; i < sizeof(suffix) - 1u; i++) g_temp_json_a[pos++] = suffix[i];
    if (saved_node_count == 0) g_temp_json_a[pos++] = '0';
    else {
      char num[32]; ng2_u32 n = 0; ng2_u32 value = saved_node_count;
      while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; }
      for (ng2_u32 i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; }
      for (ng2_u32 i = 0; i < n; i++) g_temp_json_a[pos++] = num[i];
    }
    for (ng2_u32 i = 0; i < sizeof(suffix2) - 1u; i++) g_temp_json_a[pos++] = suffix2[i];
    g_temp_json_a[pos] = '\0';
  }
  rc = sql_exec_str(g_temp_json_a);
  if (rc != NG2_OK) return rc;
  {
    char out[512];
    ng2_u32 pos = 0;
#define APPEND_LIT_SAVE(s) do { const char lit[] = s; for (ng2_u32 i = 0; i < sizeof(lit) - 1u; i++) out[pos++] = lit[i]; } while (0)
#define APPEND_CSTR_SAVE(s) do { const char *p = (s); while (*p != '\0') out[pos++] = *p++; } while (0)
#define APPEND_U32_SAVE(v) do { char num[32]; ng2_u32 n = 0; ng2_u32 value = (v); if (value == 0) num[n++] = '0'; while (value > 0) { num[n++] = (char)('0' + (value % 10u)); value /= 10u; } for (ng2_u32 i = 0; i < n / 2u; i++) { char t = num[i]; num[i] = num[n - 1u - i]; num[n - 1u - i] = t; } for (ng2_u32 i = 0; i < n; i++) out[pos++] = num[i]; } while (0)
    APPEND_LIT_SAVE("{\"saved\":true,\"name\":\"");
    APPEND_CSTR_SAVE(name);
    APPEND_LIT_SAVE("\",\"nodeCount\":");
    APPEND_U32_SAVE(saved_node_count);
    APPEND_LIT_SAVE("}");
    pdk_output((const uint8_t *)out, pos);
#undef APPEND_LIT_SAVE
#undef APPEND_CSTR_SAVE
#undef APPEND_U32_SAVE
  }
  return NG2_OK;
}

uint32_t ng_graph_list(void) {
  ng2_u32 rc = sql_query_str("SELECT rowid, name, node_count, updated_at FROM ng2_graph_storage ORDER BY name", g_temp_json_a, NG2_IO_BUFFER_CAP);
  if (rc != NG2_OK) return rc;
  output_text(g_temp_json_a);
  return NG2_OK;
}

uint32_t ng_graph_delete(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  char name[256] = {0};
  char escaped_name[512] = {0};
  char sql[1024] = {0};
  ng2_u32 rc = 0;
  if (!json_extract_string(input, input_len, "name", name, (uint32_t)sizeof(name))) return NG2_ERR_INVALID_ARG;
  rc = sql_escape_string(name, escaped_name, (ng2_u32)sizeof(escaped_name));
  if (rc != NG2_OK) return rc;
  {
    const char prefix[] = "DELETE FROM ng2_graph_storage WHERE name='";
    const char suffix[] = "'";
    ng2_u32 pos = 0;
    for (ng2_u32 i = 0; i < sizeof(prefix) - 1u; i++) sql[pos++] = prefix[i];
    for (ng2_u32 i = 0; escaped_name[i] != '\0'; i++) sql[pos++] = escaped_name[i];
    for (ng2_u32 i = 0; i < sizeof(suffix) - 1u; i++) sql[pos++] = suffix[i];
    sql[pos] = '\0';
  }
  rc = sql_exec_str(sql);
  if (rc != NG2_OK) return rc;
  output_text(name);
  return NG2_OK;
}

uint32_t ng_template_save(void) { return output_not_implemented("ng_template_save"); }
uint32_t ng_template_list(void) { return output_not_implemented("ng_template_list"); }
uint32_t ng_template_delete(void) { return output_not_implemented("ng_template_delete"); }

uint32_t ng_node_create(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 kind = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  if (!json_extract_u32(input, input_len, "handle", &handle_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "nodeId", &node_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "kind", &kind)) return NG2_ERR_INVALID_ARG;
  if (!valid_node_kind(kind)) return NG2_ERR_INVALID_ARG;
  info = get_info_for_handle_id(handle_id);
  if (!info) return NG2_ERR_INVALID_HANDLE;
  if (find_node(info, node_id)) return NG2_ERR_INVALID_ARG;
  if (info->node_count >= NG2_MAX_NODES) return NG2_ERR_CAPACITY;
  node = &info->nodes[info->node_count++];
  ng2_zero(node, (ng2_u32)sizeof(Ng2Node));
  node->id = node_id;
  node->kind = kind;
  node->exec_state = NG2_EXEC_NEVER;
  bump_generation(info);
  node->generation = info->generation;
  output_u32(node_id);
  return NG2_OK;
}

uint32_t ng_node_replace(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 kind = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  ng2_u32 rc = 0;
  if (!json_extract_u32(input, input_len, "kind", &kind)) return NG2_ERR_INVALID_ARG;
  if (!valid_node_kind(kind)) return NG2_ERR_INVALID_ARG;
  rc = parse_handle_and_node_id(input, input_len, &handle_id, &node_id, &info, &node);
  if (rc != NG2_OK) return rc;
  ng2_zero(node, (ng2_u32)sizeof(Ng2Node));
  node->id = node_id;
  node->kind = kind;
  node->exec_state = NG2_EXEC_NEVER;
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    Ng2Node *other = &info->nodes[i];
    if (other->id == node_id) continue;
    for (ng2_u32 j = 0; j < other->input_count; j++) {
      if (other->inputs[j].src_node_id != node_id) continue;
      other->inputs[j].src_node_id = 0;
      other->inputs[j].src_output_id = 0;
    }
  }
  bump_generation(info);
  node->generation = info->generation;
  output_u32(node_id);
  return NG2_OK;
}

uint32_t ng_node_delete(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  Ng2Info *info = 0;
  ng2_u32 found = 0;
  if (!json_extract_u32(input, input_len, "handle", &handle_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "nodeId", &node_id)) return NG2_ERR_INVALID_ARG;
  info = get_info_for_handle_id(handle_id);
  if (!info) return NG2_ERR_INVALID_HANDLE;
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    if (info->nodes[i].id != node_id) continue;
    found = 1;
    for (ng2_u32 j = i + 1u; j < info->node_count; j++) {
      info->nodes[j - 1u] = info->nodes[j];
    }
    info->node_count -= 1u;
    ng2_zero(&info->nodes[info->node_count], (ng2_u32)sizeof(Ng2Node));
    break;
  }
  if (!found) return NG2_ERR_INVALID_ARG;
  for (ng2_u32 i = 0; i < info->node_count; i++) {
    Ng2Node *other = &info->nodes[i];
    for (ng2_u32 j = 0; j < other->input_count; j++) {
      if (other->inputs[j].src_node_id != node_id) continue;
      other->inputs[j].src_node_id = 0;
      other->inputs[j].src_output_id = 0;
    }
  }
  bump_generation(info);
  output_u32(node_id);
  return NG2_OK;
}

uint32_t ng_input_add(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 input_id = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  ng2_u32 rc = parse_handle_and_node_id(input, input_len, &handle_id, &node_id, &info, &node);
  if (rc != NG2_OK) return rc;
  if (!json_extract_u32(input, input_len, "inputId", &input_id)) return NG2_ERR_INVALID_ARG;
  if (!node_kind_supports_inputs(node->kind)) return NG2_ERR_INVALID_ARG;
  if (node->input_count >= NG2_MAX_INPUTS) return NG2_ERR_CAPACITY;
  for (ng2_u32 i = 0; i < node->input_count; i++) {
    if (node->inputs[i].id == input_id) return NG2_ERR_INVALID_ARG;
  }
  node->inputs[node->input_count].id = input_id;
  node->inputs[node->input_count].src_node_id = 0;
  node->inputs[node->input_count].src_output_id = 0;
  node->input_count += 1u;
  bump_generation(info);
  node->generation = info->generation;
  output_u32(input_id);
  return NG2_OK;
}

uint32_t ng_output_add(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 output_id = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  ng2_u32 rc = parse_handle_and_node_id(input, input_len, &handle_id, &node_id, &info, &node);
  if (rc != NG2_OK) return rc;
  if (!json_extract_u32(input, input_len, "outputId", &output_id)) return NG2_ERR_INVALID_ARG;
  if (!node_kind_supports_outputs(node->kind)) return NG2_ERR_INVALID_ARG;
  if (node->output_count >= NG2_MAX_OUTPUTS) return NG2_ERR_CAPACITY;
  for (ng2_u32 i = 0; i < node->output_count; i++) {
    if (node->outputs[i].id == output_id) return NG2_ERR_INVALID_ARG;
  }
  node->outputs[node->output_count].id = output_id;
  node->output_count += 1u;
  bump_generation(info);
  node->generation = info->generation;
  output_u32(output_id);
  return NG2_OK;
}

uint32_t ng_input_connect(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 input_id = 0;
  ng2_u32 src_node_id = 0;
  ng2_u32 src_output_id = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  Ng2Node *src_node = 0;
  ng2_u32 rc = parse_handle_and_node_id(input, input_len, &handle_id, &node_id, &info, &node);
  if (rc != NG2_OK) return rc;
  if (!json_extract_u32(input, input_len, "inputId", &input_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "srcNodeId", &src_node_id)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "srcOutputId", &src_output_id)) return NG2_ERR_INVALID_ARG;
  if (!node_kind_supports_inputs(node->kind)) return NG2_ERR_INVALID_ARG;
  src_node = find_node(info, src_node_id);
  if (!src_node) return NG2_ERR_INVALID_ARG;
  if (!node_kind_supports_outputs(src_node->kind)) return NG2_ERR_INVALID_ARG;
  {
    Ng2InputPort *target_input = 0;
    ng2_i32 has_src_output = 0;
    for (ng2_u32 i = 0; i < node->input_count; i++) {
      if (node->inputs[i].id == input_id) {
        target_input = &node->inputs[i];
        break;
      }
    }
    if (!target_input) return NG2_ERR_INVALID_ARG;
    for (ng2_u32 i = 0; i < src_node->output_count; i++) {
      if (src_node->outputs[i].id == src_output_id) {
        has_src_output = 1;
        break;
      }
    }
    if (!has_src_output) return NG2_ERR_INVALID_ARG;
    target_input->src_node_id = src_node_id;
    target_input->src_output_id = src_output_id;
  }
  bump_generation(info);
  node->generation = info->generation;
  output_u32(input_id);
  return NG2_OK;
}

uint32_t ng_input_disconnect(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 input_id = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  ng2_u32 rc = parse_handle_and_node_id(input, input_len, &handle_id, &node_id, &info, &node);
  if (rc != NG2_OK) return rc;
  if (!json_extract_u32(input, input_len, "inputId", &input_id)) return NG2_ERR_INVALID_ARG;
  for (ng2_u32 i = 0; i < node->input_count; i++) {
    if (node->inputs[i].id != input_id) continue;
    node->inputs[i].src_node_id = 0;
    node->inputs[i].src_output_id = 0;
    bump_generation(info);
    node->generation = info->generation;
    output_u32(input_id);
    return NG2_OK;
  }
  return NG2_ERR_INVALID_ARG;
}

uint32_t ng_node_set_arg(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  ng2_u32 handle_id = 0;
  ng2_u32 node_id = 0;
  ng2_u32 arg_index = 0;
  ng2_u32 type = 0;
  ng2_u32 a_u32 = 0;
  ng2_u32 b_u32 = 0;
  Ng2Info *info = 0;
  Ng2Node *node = 0;
  ng2_u32 rc = parse_handle_and_node_id(input, input_len, &handle_id, &node_id, &info, &node);
  if (rc != NG2_OK) return rc;
  if (!json_extract_u32(input, input_len, "argIndex", &arg_index)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "type", &type)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "a", &a_u32)) return NG2_ERR_INVALID_ARG;
  if (!json_extract_u32(input, input_len, "b", &b_u32)) b_u32 = 0;
  if (arg_index >= NG2_MAX_ARGS) return NG2_ERR_CAPACITY;
  node->args[arg_index].type = type;
  node->args[arg_index].a = (ng2_i32)a_u32;
  node->args[arg_index].b = (ng2_i32)b_u32;
  if (node->arg_count <= arg_index) node->arg_count = arg_index + 1u;
  bump_generation(info);
  node->generation = info->generation;
  output_u32(arg_index);
  return NG2_OK;
}

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
