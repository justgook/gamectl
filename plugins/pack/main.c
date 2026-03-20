#include "pack.h"
#include "pdk.h"

#include <stddef.h>

#define JSMN_STATIC
#include "jsmn.h"

static void pack_sort(void *base, size_t num, size_t size,
                      int (*cmp)(const void *, const void *));

#define STBRP_SORT pack_sort
#define STBRP_ASSERT(x) ((void)0)
#define STB_RECT_PACK_IMPLEMENTATION
#include "stb_rect_pack.h"

enum {
  PACK_RESPONSE_BASE_CAP = 160,
  PACK_RESPONSE_RECT_CAP = 160
};

typedef struct {
  const char *json;
  pdk_u32 len;
  jsmntok_t *tokens;
  int count;
} pack_json_doc_t;

typedef struct {
  pdk_u32 id;
  pdk_u32 width;
  pdk_u32 height;
  pdk_u32 padded_width;
  pdk_u32 padded_height;
  pdk_u32 x;
  pdk_u32 y;
  int packed;
} pack_rect_t;

typedef struct {
  pdk_u32 width;
  pdk_u32 height;
  pdk_u32 padding;
  int auto_size;
  pdk_u32 rect_count;
  pack_rect_t *rects;
} pack_request_t;

static int pack_memcmp(const void *a, const void *b, pdk_u32 len) {
  const pdk_u8 *lhs = (const pdk_u8 *)a;
  const pdk_u8 *rhs = (const pdk_u8 *)b;
  pdk_u32 i;
  for (i = 0; i < len; i++) {
    if (lhs[i] != rhs[i]) {
      return (int)lhs[i] - (int)rhs[i];
    }
  }
  return 0;
}

static pdk_u32 pack_u32_to_str(pdk_u32 value, char *buffer) {
  pdk_u32 len = 0;
  pdk_u32 i;
  pdk_u32 temp;

  if (value == 0) {
    buffer[0] = '0';
    return 1;
  }

  temp = value;
  while (temp > 0) {
    temp /= 10;
    len++;
  }

  for (i = len; i > 0; i--) {
    buffer[i - 1] = (char)('0' + (value % 10));
    value /= 10;
  }

  return len;
}

static pdk_u32 pack_append_raw(char *buf, pdk_u32 pos, pdk_u32 cap,
                               const char *text) {
  pdk_u32 len = pdk_strlen(text);
  if (pos >= cap) {
    return pos;
  }
  if (len > cap - pos) {
    len = cap - pos;
  }
  pdk_memcpy(buf + pos, text, len);
  return pos + len;
}

static pdk_u32 pack_append_u32(char *buf, pdk_u32 pos, pdk_u32 cap,
                               pdk_u32 value) {
  char digits[16];
  pdk_u32 len = pack_u32_to_str(value, digits);
  if (pos >= cap) {
    return pos;
  }
  if (len > cap - pos) {
    len = cap - pos;
  }
  pdk_memcpy(buf + pos, digits, len);
  return pos + len;
}

static pdk_u32 pack_append_bool(char *buf, pdk_u32 pos, pdk_u32 cap,
                                int value) {
  return pack_append_raw(buf, pos, cap, value ? "true" : "false");
}

static void pack_write_response(const char *json, pdk_u32 len) {
  pdk_output((const pdk_u8 *)json, len);
}

static pdk_u32 pack_respond_error(const char *code, const char *message) {
  char buf[PACK_RESPONSE_BASE_CAP];
  pdk_u32 pos = 0;

  pos = pack_append_raw(buf, pos, sizeof(buf), "{\"");
  pos = pack_append_raw(buf, pos, sizeof(buf), PACK_FIELD_API);
  pos = pack_append_raw(buf, pos, sizeof(buf), "\":\"");
  pos = pack_append_raw(buf, pos, sizeof(buf), PACK_API_VERSION);
  pos = pack_append_raw(buf, pos, sizeof(buf), "\",\"");
  pos = pack_append_raw(buf, pos, sizeof(buf), PACK_FIELD_CODE);
  pos = pack_append_raw(buf, pos, sizeof(buf), "\":\"");
  pos = pack_append_raw(buf, pos, sizeof(buf), code);
  pos = pack_append_raw(buf, pos, sizeof(buf), "\",\"");
  pos = pack_append_raw(buf, pos, sizeof(buf), PACK_FIELD_MESSAGE);
  pos = pack_append_raw(buf, pos, sizeof(buf), "\":\"");
  pos = pack_append_raw(buf, pos, sizeof(buf), message);
  pos = pack_append_raw(buf, pos, sizeof(buf), "\"}");

  pack_write_response(buf, pos);
  return 1;
}

static int pack_json_token_next(const jsmntok_t *tokens, int count, int index) {
  int i;
  int next = index + 1;

  if (index < 0 || index >= count) {
    return count;
  }

  if (tokens[index].type == JSMN_OBJECT) {
    for (i = 0; i < tokens[index].size * 2; i++) {
      next = pack_json_token_next(tokens, count, next);
    }
    return next;
  }

  if (tokens[index].type == JSMN_ARRAY) {
    for (i = 0; i < tokens[index].size; i++) {
      next = pack_json_token_next(tokens, count, next);
    }
    return next;
  }

  return next;
}

static int pack_json_token_eq(const pack_json_doc_t *doc, int token_index,
                              const char *text) {
  jsmntok_t token;
  pdk_u32 len;

  if (token_index < 0 || token_index >= doc->count) {
    return 0;
  }

  token = doc->tokens[token_index];
  if (token.type != JSMN_STRING) {
    return 0;
  }

  len = (pdk_u32)(token.end - token.start);
  return len == pdk_strlen(text) &&
         pack_memcmp(doc->json + token.start, text, len) == 0;
}

static int pack_json_find_value_in_object(const pack_json_doc_t *doc,
                                          int object_index,
                                          const char *key) {
  int i;
  int end;

  if (object_index < 0 || object_index >= doc->count) {
    return -1;
  }
  if (doc->tokens[object_index].type != JSMN_OBJECT) {
    return -1;
  }

  i = object_index + 1;
  end = pack_json_token_next(doc->tokens, doc->count, object_index);
  while (i < end) {
    int value_index;
    if (i + 1 >= end) {
      return -1;
    }
    value_index = i + 1;
    if (pack_json_token_eq(doc, i, key)) {
      return value_index;
    }
    i = pack_json_token_next(doc->tokens, doc->count, value_index);
  }

  return -1;
}

static int pack_json_token_get_u32(const pack_json_doc_t *doc, int token_index,
                                   pdk_u32 *out_value) {
  jsmntok_t token;
  pdk_u32 value = 0;
  int i;

  if (token_index < 0 || token_index >= doc->count) {
    return 0;
  }

  token = doc->tokens[token_index];
  if (token.type != JSMN_PRIMITIVE || token.start >= token.end) {
    return 0;
  }

  for (i = token.start; i < token.end; i++) {
    char ch = doc->json[i];
    if (ch < '0' || ch > '9') {
      return 0;
    }
    if (value > 429496729u || (value == 429496729u && (pdk_u32)(ch - '0') > 5u)) {
      return 0;
    }
    value = (value * 10u) + (pdk_u32)(ch - '0');
  }

  *out_value = value;
  return 1;
}

static int pack_json_get_u32_in_object(const pack_json_doc_t *doc,
                                       int object_index, const char *key,
                                       pdk_u32 *out_value) {
  int value_index = pack_json_find_value_in_object(doc, object_index, key);
  if (value_index < 0) {
    return 0;
  }
  return pack_json_token_get_u32(doc, value_index, out_value);
}

static int pack_json_token_get_bool(const pack_json_doc_t *doc, int token_index,
                                    int *out_value) {
  jsmntok_t token;
  pdk_u32 len;

  if (token_index < 0 || token_index >= doc->count) {
    return 0;
  }

  token = doc->tokens[token_index];
  if (token.type != JSMN_PRIMITIVE || token.start >= token.end) {
    return 0;
  }

  len = (pdk_u32)(token.end - token.start);
  if (len == 4 && pack_memcmp(doc->json + token.start, "true", 4) == 0) {
    *out_value = 1;
    return 1;
  }
  if (len == 5 && pack_memcmp(doc->json + token.start, "false", 5) == 0) {
    *out_value = 0;
    return 1;
  }
  return 0;
}

static int pack_json_get_bool_in_object(const pack_json_doc_t *doc,
                                        int object_index, const char *key,
                                        int *out_value) {
  int value_index = pack_json_find_value_in_object(doc, object_index, key);
  if (value_index < 0) {
    return 0;
  }
  return pack_json_token_get_bool(doc, value_index, out_value) ? 1 : -1;
}

static int pack_json_parse(pack_json_doc_t *doc, const char *json,
                           pdk_u32 json_len) {
  jsmn_parser parser;
  int token_count;

  doc->json = json;
  doc->len = json_len;
  doc->tokens = NULL;
  doc->count = 0;

  jsmn_init(&parser);
  token_count = jsmn_parse(&parser, json, json_len, NULL, 0);
  if (token_count < 1) {
    return 0;
  }

  doc->tokens = (jsmntok_t *)pdk_alloc((pdk_u64)((pdk_u32)token_count *
                                                 (pdk_u32)sizeof(jsmntok_t)));
  if (doc->tokens == NULL) {
    return -1;
  }

  jsmn_init(&parser);
  doc->count = jsmn_parse(&parser, json, json_len, doc->tokens,
                          (unsigned int)token_count);
  if (doc->count < 1 || doc->tokens[0].type != JSMN_OBJECT) {
    pdk_free((pdk_u32)(size_t)doc->tokens);
    doc->tokens = NULL;
    doc->count = 0;
    return 0;
  }

  return 1;
}

static void pack_json_free(pack_json_doc_t *doc) {
  if (doc->tokens != NULL) {
    pdk_free((pdk_u32)(size_t)doc->tokens);
    doc->tokens = NULL;
  }
  doc->count = 0;
}

static void pack_request_free(pack_request_t *request) {
  if (request->rects != NULL) {
    pdk_free((pdk_u32)(size_t)request->rects);
    request->rects = NULL;
  }
  request->rect_count = 0;
}

static int pack_parse_request(const pack_json_doc_t *doc,
                              pack_request_t *request) {
  int rects_index;
  int token_index;
  pdk_u32 i;

  request->width = 0;
  request->height = 0;
  request->padding = 0;
  request->auto_size = 0;
  request->rect_count = 0;
  request->rects = NULL;

  if (!pack_json_get_u32_in_object(doc, 0, PACK_FIELD_WIDTH, &request->width) ||
      !pack_json_get_u32_in_object(doc, 0, PACK_FIELD_HEIGHT,
                                   &request->height)) {
    return 0;
  }
  if (!pack_json_get_u32_in_object(doc, 0, PACK_FIELD_PADDING,
                                   &request->padding)) {
    request->padding = 0;
  }
  i = pack_json_get_bool_in_object(doc, 0, PACK_FIELD_AUTO_SIZE,
                                   &request->auto_size);
  if (i < 0) {
    return 0;
  }
  if (i == 0) {
    request->auto_size = 0;
  }

  if (request->width == 0 || request->height == 0) {
    return -2;
  }
  if (request->width > (pdk_u32)STBRP__MAXVAL ||
      request->height > (pdk_u32)STBRP__MAXVAL) {
    return -2;
  }

  rects_index = pack_json_find_value_in_object(doc, 0, PACK_FIELD_RECTS);
  if (rects_index < 0 || doc->tokens[rects_index].type != JSMN_ARRAY) {
    return 0;
  }

  request->rect_count = (pdk_u32)doc->tokens[rects_index].size;
  if (request->rect_count == 0) {
    return 1;
  }

  request->rects = (pack_rect_t *)pdk_alloc((pdk_u64)(request->rect_count *
                                                      (pdk_u32)sizeof(pack_rect_t)));
  if (request->rects == NULL) {
    return -1;
  }

  token_index = rects_index + 1;
  for (i = 0; i < request->rect_count; i++) {
    pack_rect_t *rect = &request->rects[i];
    pdk_u32 value;

    rect->id = i;
    rect->width = 0;
    rect->height = 0;
    rect->padded_width = 0;
    rect->padded_height = 0;
    rect->x = 0;
    rect->y = 0;
    rect->packed = 0;

    if (token_index >= doc->count || doc->tokens[token_index].type != JSMN_OBJECT) {
      return 0;
    }

    if (pack_json_get_u32_in_object(doc, token_index, PACK_FIELD_ID, &value)) {
      rect->id = value;
    }
    if (!pack_json_get_u32_in_object(doc, token_index, PACK_FIELD_WIDTH,
                                     &rect->width) ||
        !pack_json_get_u32_in_object(doc, token_index, PACK_FIELD_HEIGHT,
                                     &rect->height)) {
      return 0;
    }
    if (rect->width == 0 || rect->height == 0) {
      return -2;
    }
    if (rect->width > (pdk_u32)STBRP__MAXVAL ||
        rect->height > (pdk_u32)STBRP__MAXVAL) {
      return -2;
    }
    if (rect->width > 0xffffffffu - request->padding ||
        rect->height > 0xffffffffu - request->padding) {
      return -2;
    }

    rect->padded_width = rect->width + request->padding;
    rect->padded_height = rect->height + request->padding;
    if (rect->padded_width > (pdk_u32)STBRP__MAXVAL ||
        rect->padded_height > (pdk_u32)STBRP__MAXVAL) {
      return -2;
    }

    token_index = pack_json_token_next(doc->tokens, doc->count, token_index);
  }

  return 1;
}

static int pack_run_pack(pack_request_t *request, int *out_packed_all,
                         pdk_u32 *out_packed_count) {
  stbrp_context context;
  stbrp_rect *rects;
  stbrp_node *nodes;
  pdk_u32 i;
  int all_packed;

  *out_packed_all = 1;
  *out_packed_count = 0;

  if (request->rect_count == 0) {
    return 1;
  }

  rects = (stbrp_rect *)pdk_alloc((pdk_u64)(request->rect_count *
                                            (pdk_u32)sizeof(stbrp_rect)));
  if (rects == NULL) {
    return 0;
  }

  nodes = (stbrp_node *)pdk_alloc((pdk_u64)(request->width *
                                            (pdk_u32)sizeof(stbrp_node)));
  if (nodes == NULL) {
    pdk_free((pdk_u32)(size_t)rects);
    return 0;
  }

  for (i = 0; i < request->rect_count; i++) {
    rects[i].id = (int)i;
    rects[i].w = (stbrp_coord)request->rects[i].padded_width;
    rects[i].h = (stbrp_coord)request->rects[i].padded_height;
    rects[i].x = 0;
    rects[i].y = 0;
    rects[i].was_packed = 0;
  }

  stbrp_init_target(&context, (int)request->width, (int)request->height, nodes,
                    (int)request->width);
  all_packed = stbrp_pack_rects(&context, rects, (int)request->rect_count);

  for (i = 0; i < request->rect_count; i++) {
    request->rects[i].packed = rects[i].was_packed != 0;
    if (request->rects[i].packed) {
      request->rects[i].x = (pdk_u32)rects[i].x;
      request->rects[i].y = (pdk_u32)rects[i].y;
      (*out_packed_count)++;
    }
  }

  *out_packed_all = all_packed != 0;
  pdk_free((pdk_u32)(size_t)nodes);
  pdk_free((pdk_u32)(size_t)rects);
  return 1;
}

static pdk_u32 pack_max_u32(pdk_u32 a, pdk_u32 b) {
  return a > b ? a : b;
}

static int pack_next_power_of_two(pdk_u32 value, pdk_u32 *out_value) {
  pdk_u32 result = 1;

  if (value == 0) {
    *out_value = 1;
    return 1;
  }

  while (result < value) {
    if (result > 0x80000000u) {
      return 0;
    }
    result <<= 1u;
  }

  *out_value = result;
  return 1;
}

static int pack_run_pack_auto_size(pack_request_t *request, int *out_packed_all,
                                   pdk_u32 *out_packed_count) {
  pdk_u32 original_width = request->width;
  pdk_u32 original_height = request->height;
  pdk_u32 candidate;
  pdk_u32 min_side;
  pdk_u32 i;

  min_side = pack_max_u32(request->width, request->height);
  for (i = 0; i < request->rect_count; i++) {
    min_side = pack_max_u32(min_side, request->rects[i].padded_width);
    min_side = pack_max_u32(min_side, request->rects[i].padded_height);
  }

  if (!pack_next_power_of_two(min_side, &candidate)) {
    return -1;
  }
  if (candidate > (pdk_u32)STBRP__MAXVAL) {
    return -1;
  }

  for (;;) {
    int packed_all = 0;
    pdk_u32 packed_count = 0;

    request->width = candidate;
    request->height = candidate;
    if (!pack_run_pack(request, &packed_all, &packed_count)) {
      request->width = original_width;
      request->height = original_height;
      return 0;
    }
    if (packed_all) {
      *out_packed_all = 1;
      *out_packed_count = packed_count;
      return 1;
    }

    if (candidate >= (pdk_u32)STBRP__MAXVAL) {
      request->width = original_width;
      request->height = original_height;
      return -1;
    }
    if (candidate > ((pdk_u32)STBRP__MAXVAL / 2u)) {
      request->width = original_width;
      request->height = original_height;
      return -1;
    }
    candidate <<= 1u;
  }
}

static pdk_u32 pack_respond_success(const pack_request_t *request,
                                    int packed_all,
                                    pdk_u32 packed_count) {
  char *buf;
  pdk_u32 cap;
  pdk_u32 pos = 0;
  pdk_u32 failed_count = request->rect_count - packed_count;
  pdk_u32 i;

  if (request->rect_count >
      (0xffffffffu - PACK_RESPONSE_BASE_CAP) / PACK_RESPONSE_RECT_CAP) {
    return pack_respond_error(PACK_ERR_OUT_OF_MEMORY,
                              "response payload is too large");
  }

  cap = PACK_RESPONSE_BASE_CAP + request->rect_count * PACK_RESPONSE_RECT_CAP;
  buf = (char *)pdk_alloc(cap);
  if (buf == NULL) {
    return pack_respond_error(PACK_ERR_OUT_OF_MEMORY,
                              "failed to allocate response buffer");
  }

  pos = pack_append_raw(buf, pos, cap, "{\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_API);
  pos = pack_append_raw(buf, pos, cap, "\":\"");
  pos = pack_append_raw(buf, pos, cap, PACK_API_VERSION);
  pos = pack_append_raw(buf, pos, cap, "\",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_WIDTH);
  pos = pack_append_raw(buf, pos, cap, "\":");
  pos = pack_append_u32(buf, pos, cap, request->width);
  pos = pack_append_raw(buf, pos, cap, ",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_HEIGHT);
  pos = pack_append_raw(buf, pos, cap, "\":");
  pos = pack_append_u32(buf, pos, cap, request->height);
  pos = pack_append_raw(buf, pos, cap, ",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_PADDING);
  pos = pack_append_raw(buf, pos, cap, "\":");
  pos = pack_append_u32(buf, pos, cap, request->padding);
  pos = pack_append_raw(buf, pos, cap, ",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_PACKED_ALL);
  pos = pack_append_raw(buf, pos, cap, "\":");
  pos = pack_append_bool(buf, pos, cap, packed_all);
  pos = pack_append_raw(buf, pos, cap, ",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_PACKED_COUNT);
  pos = pack_append_raw(buf, pos, cap, "\":");
  pos = pack_append_u32(buf, pos, cap, packed_count);
  pos = pack_append_raw(buf, pos, cap, ",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_FAILED_COUNT);
  pos = pack_append_raw(buf, pos, cap, "\":");
  pos = pack_append_u32(buf, pos, cap, failed_count);
  pos = pack_append_raw(buf, pos, cap, ",\"");
  pos = pack_append_raw(buf, pos, cap, PACK_FIELD_RECTS);
  pos = pack_append_raw(buf, pos, cap, "\":[");

  for (i = 0; i < request->rect_count; i++) {
    const pack_rect_t *rect = &request->rects[i];
    if (i > 0) {
      pos = pack_append_raw(buf, pos, cap, ",");
    }

    pos = pack_append_raw(buf, pos, cap, "{\"");
    pos = pack_append_raw(buf, pos, cap, PACK_FIELD_ID);
    pos = pack_append_raw(buf, pos, cap, "\":");
    pos = pack_append_u32(buf, pos, cap, rect->id);
    if (rect->packed) {
      pos = pack_append_raw(buf, pos, cap, ",\"");
      pos = pack_append_raw(buf, pos, cap, PACK_FIELD_X);
      pos = pack_append_raw(buf, pos, cap, "\":");
      pos = pack_append_u32(buf, pos, cap, rect->x);
      pos = pack_append_raw(buf, pos, cap, ",\"");
      pos = pack_append_raw(buf, pos, cap, PACK_FIELD_Y);
      pos = pack_append_raw(buf, pos, cap, "\":");
      pos = pack_append_u32(buf, pos, cap, rect->y);
    }
    pos = pack_append_raw(buf, pos, cap, ",\"");
    pos = pack_append_raw(buf, pos, cap, PACK_FIELD_WIDTH);
    pos = pack_append_raw(buf, pos, cap, "\":");
    pos = pack_append_u32(buf, pos, cap, rect->width);
    pos = pack_append_raw(buf, pos, cap, ",\"");
    pos = pack_append_raw(buf, pos, cap, PACK_FIELD_HEIGHT);
    pos = pack_append_raw(buf, pos, cap, "\":");
    pos = pack_append_u32(buf, pos, cap, rect->height);
    pos = pack_append_raw(buf, pos, cap, ",\"");
    pos = pack_append_raw(buf, pos, cap, PACK_FIELD_PACKED);
    pos = pack_append_raw(buf, pos, cap, "\":");
    pos = pack_append_bool(buf, pos, cap, rect->packed);
    pos = pack_append_raw(buf, pos, cap, "}");
  }

  pos = pack_append_raw(buf, pos, cap, "]}");
  pack_write_response(buf, pos);
  pdk_free((pdk_u32)(size_t)buf);
  return 0;
}

static pdk_u32 pack_handle_pack(void) {
  pack_json_doc_t doc;
  pack_request_t request;
  pdk_u32 input_len = 0;
  const pdk_u8 *input = pdk_input(&input_len);
  int parse_result;
  int packed_all;
  pdk_u32 packed_count;
  pdk_u32 rc;

  if (input == NULL || input_len == 0) {
    return pack_respond_error(PACK_ERR_BAD_INPUT, "request body is required");
  }

  request.rects = NULL;
  request.rect_count = 0;

  parse_result = pack_json_parse(&doc, (const char *)input, input_len);
  if (parse_result < 0) {
    return pack_respond_error(PACK_ERR_OUT_OF_MEMORY,
                              "failed to allocate json tokens");
  }
  if (parse_result == 0) {
    return pack_respond_error(PACK_ERR_BAD_INPUT, "invalid json object");
  }

  parse_result = pack_parse_request(&doc, &request);
  if (parse_result < 0) {
    pack_request_free(&request);
    pack_json_free(&doc);
    if (parse_result == -1) {
      return pack_respond_error(PACK_ERR_OUT_OF_MEMORY,
                                "failed to allocate request buffers");
    }
    return pack_respond_error(PACK_ERR_OUT_OF_RANGE,
                              "width, height, padding, or rect size is out of range");
  }
  if (parse_result == 0) {
    pack_request_free(&request);
    pack_json_free(&doc);
    return pack_respond_error(PACK_ERR_BAD_INPUT,
                              "request must include width, height, and rects with width and height");
  }

  if (request.auto_size) {
    parse_result = pack_run_pack_auto_size(&request, &packed_all, &packed_count);
    if (parse_result < 0) {
      pack_request_free(&request);
      pack_json_free(&doc);
      return pack_respond_error(PACK_ERR_OUT_OF_RANGE,
                                "autoSize could not fit all rectangles within supported atlas bounds");
    }
    if (parse_result == 0) {
      pack_request_free(&request);
      pack_json_free(&doc);
      return pack_respond_error(PACK_ERR_OUT_OF_MEMORY,
                                "failed to allocate packer buffers");
    }
  } else if (!pack_run_pack(&request, &packed_all, &packed_count)) {
    pack_request_free(&request);
    pack_json_free(&doc);
    return pack_respond_error(PACK_ERR_OUT_OF_MEMORY,
                              "failed to allocate packer buffers");
  }

  rc = pack_respond_success(&request, packed_all, packed_count);
  pack_request_free(&request);
  pack_json_free(&doc);
  return rc;
}

static void pack_sort(void *base, size_t num, size_t size,
                      int (*cmp)(const void *, const void *)) {
  stbrp_rect *rects = (stbrp_rect *)base;
  size_t i;
  size_t j;

  (void)size;

  for (i = 1; i < num; i++) {
    stbrp_rect key = rects[i];
    j = i;
    while (j > 0 && cmp(&rects[j - 1], &key) > 0) {
      rects[j] = rects[j - 1];
      j--;
    }
    rects[j] = key;
  }
}

__attribute__((export_name("pack"))) pdk_u32 pack_export(void) {
  return pack_handle_pack();
}
