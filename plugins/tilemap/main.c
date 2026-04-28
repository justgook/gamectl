#include "pdk.h"

#define TILEMAP_TOOL_SELECT 0
#define TILEMAP_TOOL_BRUSH 1
#define TILEMAP_TOOL_ERASE 2
#define TILEMAP_TOOL_EYEDROPPER 3
#define TILEMAP_TOOL_PASTE 4
#define TILEMAP_TOOL_FILL 5

#define TILEMAP_STATUS_OK 0
#define TILEMAP_STATUS_ERR 1

#define MAX_LAYERS 8
#define MAX_PATH 256

static int g_initialized = 0;
static int g_handle = 1;
static int g_width = 32;
static int g_height = 24;
static int g_layers = 3;
static int g_spacing_x = 16;
static int g_spacing_y = 16;
static int g_max_tiles = 1024;
static int g_tool = TILEMAP_TOOL_BRUSH;
static int g_active_tile = 1;
static int g_active_layer = 0;
static int g_solo_layer = -1;
static int g_dirty = 0;
static int g_has_selection = 0;
static int g_has_clipboard = 0;
static int g_can_undo = 0;
static int g_can_redo = 0;
static int g_selection_x0 = 0;
static int g_selection_y0 = 0;
static int g_selection_x1 = 0;
static int g_selection_y1 = 0;
static int g_layer_hidden[MAX_LAYERS];
static int g_layer_locked[MAX_LAYERS];
static char g_path[MAX_PATH] = "maps/mock.tilemap.json";

static int streq(const char *a, const char *b) {
  while (*a && *b) {
    if (*a != *b) return 0;
    a++;
    b++;
  }
  return *a == '\0' && *b == '\0';
}

static int is_space(char c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r';
}

static void init_state(void) {
  if (g_initialized) return;
  for (int i = 0; i < MAX_LAYERS; i++) {
    g_layer_hidden[i] = 0;
    g_layer_locked[i] = 0;
  }
  g_initialized = 1;
}

static const char *json_find_key(const char *json, const char *key) {
  const char *p = json;
  while (*p) {
    const char *a = p;
    const char *b = key;
    while (*a && *b && *a == *b) {
      a++;
      b++;
    }
    if (*b == '\0') {
      while (is_space(*a)) a++;
      if (*a != ':') return 0;
      a++;
      while (is_space(*a)) a++;
      return a;
    }
    p++;
  }
  return 0;
}

static int parse_i32_at(const char *p, int fallback) {
  int sign = 1;
  int value = 0;
  int has_digit = 0;
  if (!p) return fallback;
  if (*p == '-') {
    sign = -1;
    p++;
  }
  while (*p >= '0' && *p <= '9') {
    value = value * 10 + (*p - '0');
    has_digit = 1;
    p++;
  }
  return has_digit ? value * sign : fallback;
}

static int parse_i32(const char *json, const char *key, int fallback) {
  return parse_i32_at(json_find_key(json, key), fallback);
}

static int parse_bool(const char *json, const char *key, int fallback) {
  const char *p = json_find_key(json, key);
  if (!p) return fallback;
  if (p[0] == 't' && p[1] == 'r' && p[2] == 'u' && p[3] == 'e') return 1;
  if (p[0] == 'f' && p[1] == 'a' && p[2] == 'l' && p[3] == 's' && p[4] == 'e') return 0;
  return parse_i32_at(p, fallback) ? 1 : 0;
}

static void copy_json_string(char *dst, int cap, const char *src) {
  int len = 0;
  if (!dst || cap <= 0) return;
  dst[0] = '\0';
  if (!src || *src != '"') return;
  src++;
  while (*src && *src != '"' && len + 1 < cap) {
    if (*src == '\\' && src[1]) src++;
    dst[len++] = *src++;
  }
  dst[len] = '\0';
}

static void parse_path(const char *json) {
  const char *p = json_find_key(json, "\"path\"");
  if (p) copy_json_string(g_path, MAX_PATH, p);
  p = json_find_key(json, "\"name\"");
  if (p) copy_json_string(g_path, MAX_PATH, p);
}

static void clamp_state(void) {
  if (g_width < 1) g_width = 1;
  if (g_height < 1) g_height = 1;
  if (g_layers < 1) g_layers = 1;
  if (g_layers > MAX_LAYERS) g_layers = MAX_LAYERS;
  if (g_active_layer < -1) g_active_layer = -1;
  if (g_active_layer >= g_layers) g_active_layer = g_layers - 1;
  if (g_solo_layer < -1) g_solo_layer = -1;
  if (g_solo_layer >= g_layers) g_solo_layer = -1;
}

static uint32_t append_char(char *out, uint32_t pos, uint32_t cap, char c) {
  if (pos + 1 < cap) out[pos] = c;
  return pos + 1;
}

static uint32_t append_str(char *out, uint32_t pos, uint32_t cap, const char *s) {
  while (*s) {
    if (pos + 1 < cap) out[pos] = *s;
    pos++;
    s++;
  }
  return pos;
}

static uint32_t append_i32(char *out, uint32_t pos, uint32_t cap, int value) {
  char tmp[16];
  int idx = 0;
  unsigned int magnitude;
  if (value < 0) {
    pos = append_char(out, pos, cap, '-');
    magnitude = (unsigned int)(-value);
  } else {
    magnitude = (unsigned int)value;
  }
  if (magnitude == 0) return append_char(out, pos, cap, '0');
  while (magnitude > 0 && idx < 16) {
    tmp[idx++] = (char)('0' + (magnitude % 10));
    magnitude /= 10;
  }
  while (idx > 0) pos = append_char(out, pos, cap, tmp[--idx]);
  return pos;
}

static uint32_t append_bool(char *out, uint32_t pos, uint32_t cap, int value) {
  return append_str(out, pos, cap, value ? "true" : "false");
}

static uint32_t append_json_string(char *out, uint32_t pos, uint32_t cap, const char *s) {
  pos = append_char(out, pos, cap, '"');
  while (*s) {
    if (*s == '"' || *s == '\\') pos = append_char(out, pos, cap, '\\');
    pos = append_char(out, pos, cap, *s);
    s++;
  }
  return append_char(out, pos, cap, '"');
}

static void output_bytes(const char *text, uint32_t len) {
  pdk_output((const uint8_t *)text, len);
}

static void output_cstr(const char *text) {
  output_bytes(text, pdk_strlen(text));
}

static void output_ok(void) {
  output_cstr("{\"ok\":true}");
}

static void output_create_result(void) {
  char out[768];
  uint32_t pos = 0;
  clamp_state();
  pos = append_str(out, pos, sizeof(out), "{\"handle\":");
  pos = append_i32(out, pos, sizeof(out), g_handle);
  pos = append_str(out, pos, sizeof(out), ",\"memory\":{");
  pos = append_str(out, pos, sizeof(out), "\"format\":\"mock-stbte-y-x-layer-i16\",");
  pos = append_str(out, pos, sizeof(out), "\"dataPtr\":0,\"dataBytes\":0,");
  pos = append_str(out, pos, sizeof(out), "\"width\":");
  pos = append_i32(out, pos, sizeof(out), g_width);
  pos = append_str(out, pos, sizeof(out), ",\"height\":");
  pos = append_i32(out, pos, sizeof(out), g_height);
  pos = append_str(out, pos, sizeof(out), ",\"layers\":");
  pos = append_i32(out, pos, sizeof(out), g_layers);
  pos = append_str(out, pos, sizeof(out), ",\"spacingX\":");
  pos = append_i32(out, pos, sizeof(out), g_spacing_x);
  pos = append_str(out, pos, sizeof(out), ",\"spacingY\":");
  pos = append_i32(out, pos, sizeof(out), g_spacing_y);
  pos = append_str(out, pos, sizeof(out), "}}");
  output_bytes(out, pos);
}

static void output_snapshot(void) {
  char out[4096];
  uint32_t pos = 0;
  clamp_state();
  pos = append_str(out, pos, sizeof(out), "{\"handle\":");
  pos = append_i32(out, pos, sizeof(out), g_handle);
  pos = append_str(out, pos, sizeof(out), ",\"path\":");
  pos = append_json_string(out, pos, sizeof(out), g_path);
  pos = append_str(out, pos, sizeof(out), ",\"dirty\":");
  pos = append_bool(out, pos, sizeof(out), g_dirty);
  pos = append_str(out, pos, sizeof(out), ",\"width\":");
  pos = append_i32(out, pos, sizeof(out), g_width);
  pos = append_str(out, pos, sizeof(out), ",\"height\":");
  pos = append_i32(out, pos, sizeof(out), g_height);
  pos = append_str(out, pos, sizeof(out), ",\"layers\":[");
  for (int i = 0; i < g_layers; i++) {
    if (i) pos = append_char(out, pos, sizeof(out), ',');
    pos = append_str(out, pos, sizeof(out), "{\"index\":");
    pos = append_i32(out, pos, sizeof(out), i);
    pos = append_str(out, pos, sizeof(out), ",\"name\":\"Layer ");
    pos = append_i32(out, pos, sizeof(out), i);
    pos = append_str(out, pos, sizeof(out), "\",\"hidden\":");
    pos = append_bool(out, pos, sizeof(out), g_layer_hidden[i]);
    pos = append_str(out, pos, sizeof(out), ",\"locked\":");
    pos = append_bool(out, pos, sizeof(out), g_layer_locked[i]);
    pos = append_char(out, pos, sizeof(out), '}');
  }
  pos = append_str(out, pos, sizeof(out), "],\"activeLayer\":");
  pos = append_i32(out, pos, sizeof(out), g_active_layer);
  pos = append_str(out, pos, sizeof(out), ",\"soloLayer\":");
  pos = append_i32(out, pos, sizeof(out), g_solo_layer);
  pos = append_str(out, pos, sizeof(out), ",\"tool\":");
  pos = append_i32(out, pos, sizeof(out), g_tool);
  pos = append_str(out, pos, sizeof(out), ",\"activeTile\":");
  pos = append_i32(out, pos, sizeof(out), g_active_tile);
  pos = append_str(out, pos, sizeof(out), ",\"hasSelection\":");
  pos = append_bool(out, pos, sizeof(out), g_has_selection);
  pos = append_str(out, pos, sizeof(out), ",\"selection\":{");
  pos = append_str(out, pos, sizeof(out), "\"x0\":"); pos = append_i32(out, pos, sizeof(out), g_selection_x0);
  pos = append_str(out, pos, sizeof(out), ",\"y0\":"); pos = append_i32(out, pos, sizeof(out), g_selection_y0);
  pos = append_str(out, pos, sizeof(out), ",\"x1\":"); pos = append_i32(out, pos, sizeof(out), g_selection_x1);
  pos = append_str(out, pos, sizeof(out), ",\"y1\":"); pos = append_i32(out, pos, sizeof(out), g_selection_y1);
  pos = append_str(out, pos, sizeof(out), "},\"hasClipboard\":");
  pos = append_bool(out, pos, sizeof(out), g_has_clipboard);
  pos = append_str(out, pos, sizeof(out), ",\"canUndo\":");
  pos = append_bool(out, pos, sizeof(out), g_can_undo);
  pos = append_str(out, pos, sizeof(out), ",\"canRedo\":");
  pos = append_bool(out, pos, sizeof(out), g_can_redo);
  pos = append_str(out, pos, sizeof(out), ",\"memory\":{");
  pos = append_str(out, pos, sizeof(out), "\"format\":\"mock-stbte-y-x-layer-i16\",\"dataPtr\":0,\"dataBytes\":0,");
  pos = append_str(out, pos, sizeof(out), "\"width\":"); pos = append_i32(out, pos, sizeof(out), g_width);
  pos = append_str(out, pos, sizeof(out), ",\"height\":"); pos = append_i32(out, pos, sizeof(out), g_height);
  pos = append_str(out, pos, sizeof(out), ",\"layers\":"); pos = append_i32(out, pos, sizeof(out), g_layers);
  pos = append_str(out, pos, sizeof(out), ",\"spacingX\":"); pos = append_i32(out, pos, sizeof(out), g_spacing_x);
  pos = append_str(out, pos, sizeof(out), ",\"spacingY\":"); pos = append_i32(out, pos, sizeof(out), g_spacing_y);
  pos = append_str(out, pos, sizeof(out), "}}");
  output_bytes(out, pos);
}

static void read_input_json(char *json, uint32_t cap) {
  uint32_t len = 0;
  const uint8_t *input = pdk_input(&len);
  uint32_t copy_len = len < cap - 1 ? len : cap - 1;
  if (copy_len && input) pdk_memcpy(json, input, copy_len);
  json[copy_len] = '\0';
}

static int require_handle(const char *json) {
  int handle = parse_i32(json, "\"handle\"", g_handle);
  return handle == g_handle;
}

__attribute__((export_name("create"))) uint32_t tilemap_create(void) {
  char json[1024];
  init_state();
  read_input_json(json, sizeof(json));
  g_width = parse_i32(json, "\"width\"", g_width);
  g_height = parse_i32(json, "\"height\"", g_height);
  g_layers = parse_i32(json, "\"layers\"", g_layers);
  g_spacing_x = parse_i32(json, "\"spacingX\"", g_spacing_x);
  g_spacing_y = parse_i32(json, "\"spacingY\"", g_spacing_y);
  g_max_tiles = parse_i32(json, "\"maxTiles\"", g_max_tiles);
  parse_path(json);
  g_dirty = 0;
  output_create_result();
  return TILEMAP_STATUS_OK;
}

__attribute__((export_name("open"))) uint32_t tilemap_open(void) {
  char json[1024];
  init_state();
  read_input_json(json, sizeof(json));
  parse_path(json);
  output_create_result();
  return TILEMAP_STATUS_OK;
}

__attribute__((export_name("destroy"))) uint32_t tilemap_destroy(void) { output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("close"))) uint32_t tilemap_close(void) { return tilemap_destroy(); }
__attribute__((export_name("save"))) uint32_t tilemap_save(void) { g_dirty = 0; output_ok(); return TILEMAP_STATUS_OK; }

__attribute__((export_name("snapshot"))) uint32_t tilemap_snapshot(void) { init_state(); output_snapshot(); return TILEMAP_STATUS_OK; }

__attribute__((export_name("clear"))) uint32_t tilemap_clear(void) { init_state(); g_dirty = 1; g_can_undo = 0; g_can_redo = 0; output_ok(); return TILEMAP_STATUS_OK; }

__attribute__((export_name("set_dimensions"))) uint32_t tilemap_set_dimensions(void) {
  char json[512]; init_state(); read_input_json(json, sizeof(json)); if (!require_handle(json)) return TILEMAP_STATUS_ERR;
  g_width = parse_i32(json, "\"width\"", g_width); g_height = parse_i32(json, "\"height\"", g_height); clamp_state(); g_dirty = 1; output_ok(); return TILEMAP_STATUS_OK;
}

__attribute__((export_name("resize_map"))) uint32_t tilemap_resize_map(void) { return tilemap_set_dimensions(); }

__attribute__((export_name("insert_layer"))) uint32_t tilemap_insert_layer(void) {
  char json[512]; init_state(); read_input_json(json, sizeof(json)); if (!require_handle(json)) return TILEMAP_STATUS_ERR;
  int index = parse_i32(json, "\"index\"", g_layers); if (index < 0 || index > g_layers || g_layers >= MAX_LAYERS) return TILEMAP_STATUS_ERR;
  for (int i = g_layers; i > index; i--) { g_layer_hidden[i] = g_layer_hidden[i - 1]; g_layer_locked[i] = g_layer_locked[i - 1]; }
  g_layer_hidden[index] = 0; g_layer_locked[index] = 0; g_layers++; g_active_layer = index; g_dirty = 1; output_ok(); return TILEMAP_STATUS_OK;
}

__attribute__((export_name("delete_layer"))) uint32_t tilemap_delete_layer(void) {
  char json[512]; init_state(); read_input_json(json, sizeof(json)); if (!require_handle(json)) return TILEMAP_STATUS_ERR;
  int index = parse_i32(json, "\"index\"", -1); if (index < 0 || index >= g_layers || g_layers <= 1) return TILEMAP_STATUS_ERR;
  for (int i = index; i + 1 < g_layers; i++) { g_layer_hidden[i] = g_layer_hidden[i + 1]; g_layer_locked[i] = g_layer_locked[i + 1]; }
  g_layers--; clamp_state(); g_dirty = 1; output_ok(); return TILEMAP_STATUS_OK;
}

__attribute__((export_name("move_layer"))) uint32_t tilemap_move_layer(void) {
  char json[512]; init_state(); read_input_json(json, sizeof(json)); if (!require_handle(json)) return TILEMAP_STATUS_ERR;
  int from = parse_i32(json, "\"from\"", -1); int to = parse_i32(json, "\"to\"", -1);
  if (from < 0 || from >= g_layers || to < 0 || to >= g_layers) return TILEMAP_STATUS_ERR;
  int h = g_layer_hidden[from]; int l = g_layer_locked[from];
  if (from < to) for (int i = from; i < to; i++) { g_layer_hidden[i] = g_layer_hidden[i + 1]; g_layer_locked[i] = g_layer_locked[i + 1]; }
  else for (int i = from; i > to; i--) { g_layer_hidden[i] = g_layer_hidden[i - 1]; g_layer_locked[i] = g_layer_locked[i - 1]; }
  g_layer_hidden[to] = h; g_layer_locked[to] = l; g_active_layer = to; g_dirty = 1; output_ok(); return TILEMAP_STATUS_OK;
}

__attribute__((export_name("set_tool"))) uint32_t tilemap_set_tool(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); g_tool = parse_i32(json, "\"tool\"", g_tool); if (g_tool != TILEMAP_TOOL_SELECT) g_has_selection = 0; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("get_tool"))) uint32_t tilemap_get_tool(void) { char out[32]; uint32_t pos = 0; pos = append_str(out,pos,sizeof(out),"{\"tool\":"); pos = append_i32(out,pos,sizeof(out),g_tool); pos = append_char(out,pos,sizeof(out),'}'); output_bytes(out,pos); return TILEMAP_STATUS_OK; }
__attribute__((export_name("set_active_tile"))) uint32_t tilemap_set_active_tile(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); g_active_tile = parse_i32(json, "\"tile\"", g_active_tile); output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("get_active_tile_id"))) uint32_t tilemap_get_active_tile_id(void) { char out[32]; uint32_t pos = 0; pos = append_str(out,pos,sizeof(out),"{\"tile\":"); pos = append_i32(out,pos,sizeof(out),g_active_tile); pos = append_char(out,pos,sizeof(out),'}'); output_bytes(out,pos); return TILEMAP_STATUS_OK; }

__attribute__((export_name("set_layer_hidden"))) uint32_t tilemap_set_layer_hidden(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); int layer = parse_i32(json, "\"layer\"", -1); if (layer < 0 || layer >= g_layers) return TILEMAP_STATUS_ERR; g_layer_hidden[layer] = parse_bool(json, "\"hidden\"", g_layer_hidden[layer]); output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("set_layer_locked"))) uint32_t tilemap_set_layer_locked(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); int layer = parse_i32(json, "\"layer\"", -1); if (layer < 0 || layer >= g_layers) return TILEMAP_STATUS_ERR; g_layer_locked[layer] = parse_bool(json, "\"locked\"", g_layer_locked[layer]); output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("set_active_layer"))) uint32_t tilemap_set_active_layer(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); g_active_layer = parse_i32(json, "\"layer\"", g_active_layer); clamp_state(); output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("set_solo_layer"))) uint32_t tilemap_set_solo_layer(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); g_solo_layer = parse_i32(json, "\"layer\"", g_solo_layer); clamp_state(); output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("define_tile"))) uint32_t tilemap_define_tile(void) { output_ok(); return TILEMAP_STATUS_OK; }

__attribute__((export_name("set_selection"))) uint32_t tilemap_set_selection(void) { char json[512]; init_state(); read_input_json(json, sizeof(json)); g_has_selection = 1; g_selection_x0 = parse_i32(json,"\"x0\"",0); g_selection_y0 = parse_i32(json,"\"y0\"",0); g_selection_x1 = parse_i32(json,"\"x1\"",0); g_selection_y1 = parse_i32(json,"\"y1\"",0); output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("clear_selection"))) uint32_t tilemap_clear_selection(void) { g_has_selection = 0; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("copy"))) uint32_t tilemap_copy(void) { if (g_has_selection) g_has_clipboard = 1; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("cut"))) uint32_t tilemap_cut(void) { if (g_has_selection) { g_has_clipboard = 1; g_has_selection = 0; g_dirty = 1; g_can_undo = 1; } output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("paste"))) uint32_t tilemap_paste(void) { if (g_has_clipboard) { g_dirty = 1; g_can_undo = 1; } output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("undo"))) uint32_t tilemap_undo(void) { g_can_undo = 0; g_can_redo = 1; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("redo"))) uint32_t tilemap_redo(void) { g_can_undo = 1; g_can_redo = 0; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("apply"))) uint32_t tilemap_apply(void) { g_dirty = 1; g_can_undo = 1; if (g_tool == TILEMAP_TOOL_SELECT) g_has_selection = 1; if (g_tool == TILEMAP_TOOL_EYEDROPPER) g_active_tile = 7; if (g_tool == TILEMAP_TOOL_PASTE && g_has_clipboard) g_can_undo = 1; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("set_tile"))) uint32_t tilemap_set_tile(void) { g_dirty = 1; g_can_undo = 1; output_ok(); return TILEMAP_STATUS_OK; }
__attribute__((export_name("get_tile_id"))) uint32_t tilemap_get_tile_id(void) { char out[32]; uint32_t pos = 0; pos = append_str(out,pos,sizeof(out),"{\"tile\":"); pos = append_i32(out,pos,sizeof(out),g_active_tile); pos = append_char(out,pos,sizeof(out),'}'); output_bytes(out,pos); return TILEMAP_STATUS_OK; }
__attribute__((export_name("set_background_tile"))) uint32_t tilemap_set_background_tile(void) { output_ok(); return TILEMAP_STATUS_OK; }

__attribute__((export_name("info"))) uint32_t tilemap_info(void) { output_cstr("tilemap mock plugin: stbte-like handle API bootstrap"); return TILEMAP_STATUS_OK; }
