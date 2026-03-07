#include "main.h"
#include "pdk.h"

#include <stddef.h>

#define JSMN_STATIC
#include "jsmn.h"

static void image_memzero(void *ptr, size_t len) {
  size_t i;
  unsigned char *dst = (unsigned char *)ptr;
  for (i = 0; i < len; i++) {
    dst[i] = 0;
  }
}

static void *image_memset_value(void *ptr, int value, size_t len) {
  size_t i;
  unsigned char *dst = (unsigned char *)ptr;
  for (i = 0; i < len; i++) {
    dst[i] = (unsigned char)value;
  }
  return ptr;
}

static int image_memcmp(const void *a, const void *b, size_t len) {
  size_t i;
  const unsigned char *lhs = (const unsigned char *)a;
  const unsigned char *rhs = (const unsigned char *)b;
  for (i = 0; i < len; i++) {
    if (lhs[i] != rhs[i]) {
      return (int)lhs[i] - (int)rhs[i];
    }
  }
  return 0;
}

static void *image_memmove(void *dest, const void *src, size_t len) {
  size_t i;
  unsigned char *d = (unsigned char *)dest;
  const unsigned char *s = (const unsigned char *)src;
  if (d == s || len == 0) {
    return dest;
  }
  if (d < s) {
    for (i = 0; i < len; i++) {
      d[i] = s[i];
    }
  } else {
    for (i = len; i > 0; i--) {
      d[i - 1] = s[i - 1];
    }
  }
  return dest;
}

static void *image_malloc(size_t size) {
  return (void *)(size == 0 ? 0 : pdk_alloc((pdk_u64)size));
}

static void image_free(void *ptr) {
  if (ptr != NULL) {
    pdk_free((pdk_u32)(size_t)ptr);
  }
}

static void *image_realloc_sized(void *ptr, size_t old_size, size_t new_size) {
  pdk_u8 *new_ptr;
  size_t copy_size;
  if (ptr == NULL) {
    return image_malloc(new_size);
  }
  if (new_size == 0) {
    image_free(ptr);
    return NULL;
  }
  new_ptr = (pdk_u8 *)image_malloc(new_size);
  if (new_ptr == NULL) {
    return NULL;
  }
  copy_size = old_size < new_size ? old_size : new_size;
  pdk_memcpy(new_ptr, ptr, (pdk_u32)copy_size);
  image_free(ptr);
  return new_ptr;
}

static float image_floorf(float x) {
  int i = (int)x;
  if ((float)i > x) {
    i -= 1;
  }
  return (float)i;
}

static float image_ceilf(float x) {
  int i = (int)x;
  if ((float)i < x) {
    i += 1;
  }
  return (float)i;
}

#define STBI_ASSERT(x) ((void)0)
#define STBI_NO_STDIO
#define STBI_ONLY_PNG
#define STBI_NO_LINEAR
#define STBI_MALLOC(sz) image_malloc(sz)
#define STBI_REALLOC_SIZED(p, oldsz, newsz) image_realloc_sized((p), (oldsz), (newsz))
#define STBI_FREE(p) image_free(p)
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

#define QOI_NO_STDIO
#define QOI_MALLOC(sz) image_malloc(sz)
#define QOI_FREE(p) image_free(p)
#define QOI_ZEROARR(a) image_memzero((a), sizeof(a))
#define QOI_IMPLEMENTATION
#include "qoi.h"

#define STBIR_ASSERT(x) ((void)0)
#define STBIR_MALLOC(size, user_data) ((void)(user_data), image_malloc(size))
#define STBIR_FREE(ptr, user_data) ((void)(user_data), image_free(ptr))
#define STBIR_CEILF(x) image_ceilf((float)(x))
#define STBIR_FLOORF(x) image_floorf((float)(x))
#define STB_IMAGE_RESIZE_IMPLEMENTATION
#include "stb_image_resize2.h"

#define STBIW_ASSERT(x) ((void)0)
#define STBI_WRITE_NO_STDIO
#define STBIW_MALLOC(sz) image_malloc(sz)
#define STBIW_REALLOC_SIZED(p, oldsz, newsz) image_realloc_sized((p), (oldsz), (newsz))
#define STBIW_FREE(p) image_free(p)
#define STBIW_MEMMOVE(d, s, n) image_memmove((d), (s), (n))
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

#define IMAGE_MAX_HANDLES 256
#define IMAGE_MAX_JSON_TOKENS 128
#define IMAGE_MAX_PATH_LEN 1024
#define IMAGE_RESPONSE_CAP 512

enum image_source_format {
  IMAGE_SOURCE_UNKNOWN = 0,
  IMAGE_SOURCE_PNG = 1,
  IMAGE_SOURCE_QOI = 2,
};

typedef struct {
  int in_use;
  pdk_u32 id;
  int width;
  int height;
  int source_format;
  pdk_u8 *pixels;
} image_handle_t;

typedef struct {
  const char *json;
  pdk_u32 len;
  jsmntok_t tokens[IMAGE_MAX_JSON_TOKENS];
  int count;
} image_json_doc_t;

typedef struct {
  pdk_u8 *bytes;
  pdk_u32 len;
} image_blob_t;

typedef struct {
  pdk_u8 *bytes;
  pdk_u32 len;
  pdk_u32 cap;
} image_buffer_t;

static image_handle_t g_handles[IMAGE_MAX_HANDLES];
static pdk_u32 g_next_handle_id = 1;

static pdk_u32 image_uint_to_str(pdk_u32 value, char *buffer) {
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

static pdk_u32 image_append_raw(char *buf, pdk_u32 pos, pdk_u32 cap,
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

static pdk_u32 image_append_u32(char *buf, pdk_u32 pos, pdk_u32 cap,
                                pdk_u32 value) {
  char digits[16];
  pdk_u32 len = image_uint_to_str(value, digits);
  if (pos >= cap) {
    return pos;
  }
  if (len > cap - pos) {
    len = cap - pos;
  }
  pdk_memcpy(buf + pos, digits, len);
  return pos + len;
}

static pdk_u32 image_append_bool(char *buf, pdk_u32 pos, pdk_u32 cap, int value) {
  return image_append_raw(buf, pos, cap, value ? "true" : "false");
}

static void image_write_response(const char *json, pdk_u32 len) {
  pdk_output((const pdk_u8 *)json, len);
}

static pdk_u32 image_respond_error(const char *code, const char *message) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":false,\"api\":\"image/v1\",\"code\":\"");
  pos = image_append_raw(buf, pos, sizeof(buf), code);
  pos = image_append_raw(buf, pos, sizeof(buf), "\",\"message\":\"");
  pos = image_append_raw(buf, pos, sizeof(buf), message);
  pos = image_append_raw(buf, pos, sizeof(buf), "\"}");

  image_write_response(buf, pos);
  return 1;
}

static pdk_u32 image_respond_handle_meta(pdk_u32 handle, pdk_u32 width,
                                         pdk_u32 height,
                                         const char *source_format) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":true,\"api\":\"image/v1\",\"handle\":");
  pos = image_append_u32(buf, pos, sizeof(buf), handle);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"width\":");
  pos = image_append_u32(buf, pos, sizeof(buf), width);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"height\":");
  pos = image_append_u32(buf, pos, sizeof(buf), height);
  pos = image_append_raw(buf, pos, sizeof(buf),
                         ",\"pixelFormat\":\"rgba8\"");
  if (source_format != NULL) {
    pos = image_append_raw(buf, pos, sizeof(buf), ",\"sourceFormat\":\"");
    pos = image_append_raw(buf, pos, sizeof(buf), source_format);
    pos = image_append_raw(buf, pos, sizeof(buf), "\"");
  }
  pos = image_append_raw(buf, pos, sizeof(buf), "}");

  image_write_response(buf, pos);
  return 0;
}

static pdk_u32 image_respond_info(pdk_u32 width, pdk_u32 height,
                                  const char *source_format) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":true,\"api\":\"image/v1\",\"width\":");
  pos = image_append_u32(buf, pos, sizeof(buf), width);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"height\":");
  pos = image_append_u32(buf, pos, sizeof(buf), height);
  pos = image_append_raw(buf, pos, sizeof(buf),
                         ",\"pixelFormat\":\"rgba8\"");
  if (source_format != NULL) {
    pos = image_append_raw(buf, pos, sizeof(buf), ",\"sourceFormat\":\"");
    pos = image_append_raw(buf, pos, sizeof(buf), source_format);
    pos = image_append_raw(buf, pos, sizeof(buf), "\"");
  }
  pos = image_append_raw(buf, pos, sizeof(buf), "}");

  image_write_response(buf, pos);
  return 0;
}

static pdk_u32 image_respond_closed(pdk_u32 closed) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":true,\"api\":\"image/v1\",\"closed\":");
  pos = image_append_u32(buf, pos, sizeof(buf), closed);
  pos = image_append_raw(buf, pos, sizeof(buf), "}");

  image_write_response(buf, pos);
  return 0;
}

static pdk_u32 image_respond_create_meta(pdk_u32 handle, pdk_u32 width,
                                         pdk_u32 height) {
  return image_respond_handle_meta(handle, width, height, NULL);
}

static pdk_u32 image_respond_crop_meta(pdk_u32 handle, pdk_u32 width,
                                       pdk_u32 height, int flip_x,
                                       int flip_y) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":true,\"api\":\"image/v1\",\"handle\":");
  pos = image_append_u32(buf, pos, sizeof(buf), handle);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"width\":");
  pos = image_append_u32(buf, pos, sizeof(buf), width);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"height\":");
  pos = image_append_u32(buf, pos, sizeof(buf), height);
  pos = image_append_raw(buf, pos, sizeof(buf),
                         ",\"pixelFormat\":\"rgba8\",\"flipX\":");
  pos = image_append_bool(buf, pos, sizeof(buf), flip_x);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"flipY\":");
  pos = image_append_bool(buf, pos, sizeof(buf), flip_y);
  pos = image_append_raw(buf, pos, sizeof(buf), "}");

  image_write_response(buf, pos);
  return 0;
}

static pdk_u32 image_respond_transform_meta(pdk_u32 handle, pdk_u32 width,
                                            pdk_u32 height, pdk_u32 flip) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":true,\"api\":\"image/v1\",\"handle\":");
  pos = image_append_u32(buf, pos, sizeof(buf), handle);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"width\":");
  pos = image_append_u32(buf, pos, sizeof(buf), width);
  pos = image_append_raw(buf, pos, sizeof(buf), ",\"height\":");
  pos = image_append_u32(buf, pos, sizeof(buf), height);
  pos = image_append_raw(buf, pos, sizeof(buf),
                         ",\"pixelFormat\":\"rgba8\",\"flip\":");
  pos = image_append_u32(buf, pos, sizeof(buf), flip);
  pos = image_append_raw(buf, pos, sizeof(buf), "}");

  image_write_response(buf, pos);
  return 0;
}

static pdk_u32 image_respond_pixels(pdk_u32 width, pdk_u32 height,
                                    pdk_u32 byte_length,
                                    const char *data_base64) {
  char *buf;
  pdk_u32 data_len = (pdk_u32)pdk_strlen(data_base64);
  pdk_u32 cap;
  pdk_u32 pos = 0;

  if (data_len > 0xffffffffu - IMAGE_RESPONSE_CAP - 1u) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "response payload is too large");
  }
  cap = IMAGE_RESPONSE_CAP + data_len + 1u;

  buf = (char *)image_malloc(cap);
  if (buf == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate response buffer");
  }

  pos = image_append_raw(buf, pos, cap,
                         "{\"ok\":true,\"api\":\"image/v1\",\"width\":");
  pos = image_append_u32(buf, pos, cap, width);
  pos = image_append_raw(buf, pos, cap, ",\"height\":");
  pos = image_append_u32(buf, pos, cap, height);
  pos = image_append_raw(buf, pos, cap,
                         ",\"pixelFormat\":\"rgba8\",\"byteLength\":");
  pos = image_append_u32(buf, pos, cap, byte_length);
  pos = image_append_raw(buf, pos, cap,
                         ",\"encoding\":\"base64\",\"data\":\"");
  pos = image_append_raw(buf, pos, cap, data_base64);
  pos = image_append_raw(buf, pos, cap, "\"}");

  image_write_response(buf, pos);
  image_free(buf);
  return 0;
}

static pdk_u32 image_respond_encoded(const char *path, const char *format,
                                     pdk_u32 bytes_written) {
  char buf[IMAGE_RESPONSE_CAP];
  pdk_u32 pos = 0;

  pos = image_append_raw(buf, pos, sizeof(buf),
                         "{\"ok\":true,\"api\":\"image/v1\",\"path\":\"");
  pos = image_append_raw(buf, pos, sizeof(buf), path);
  pos = image_append_raw(buf, pos, sizeof(buf), "\",\"format\":\"");
  pos = image_append_raw(buf, pos, sizeof(buf), format);
  pos = image_append_raw(buf, pos, sizeof(buf), "\",\"bytesWritten\":");
  pos = image_append_u32(buf, pos, sizeof(buf), bytes_written);
  pos = image_append_raw(buf, pos, sizeof(buf), "}");

  image_write_response(buf, pos);
  return 0;
}

static const char *image_source_format_name(int source_format) {
  if (source_format == IMAGE_SOURCE_PNG) {
    return "png";
  }
  if (source_format == IMAGE_SOURCE_QOI) {
    return "qoi";
  }
  return NULL;
}

static int image_is_qoi_bytes(const pdk_u8 *bytes, pdk_u32 len) {
  static const char magic[] = {'q', 'o', 'i', 'f'};
  return len >= 4 && image_memcmp(bytes, magic, 4) == 0;
}

static int image_is_png_bytes(const pdk_u8 *bytes, pdk_u32 len) {
  static const pdk_u8 sig[8] = {0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};
  return len >= 8 && image_memcmp(bytes, sig, 8) == 0;
}

static int image_qoi_info(const pdk_u8 *bytes, pdk_u32 len, int *out_width,
                          int *out_height) {
  if (!image_is_qoi_bytes(bytes, len) || len < 14) {
    return 0;
  }

  *out_width = (int)(((pdk_u32)bytes[4] << 24) | ((pdk_u32)bytes[5] << 16) |
                     ((pdk_u32)bytes[6] << 8) | (pdk_u32)bytes[7]);
  *out_height = (int)(((pdk_u32)bytes[8] << 24) | ((pdk_u32)bytes[9] << 16) |
                      ((pdk_u32)bytes[10] << 8) | (pdk_u32)bytes[11]);
  return *out_width > 0 && *out_height > 0;
}

static int image_json_token_next(const jsmntok_t *tokens, int count, int index) {
  int i;
  int next = index + 1;

  if (index < 0 || index >= count) {
    return count;
  }

  if (tokens[index].type == JSMN_OBJECT) {
    for (i = 0; i < tokens[index].size * 2; i++) {
      next = image_json_token_next(tokens, count, next);
    }
    return next;
  }

  if (tokens[index].type == JSMN_ARRAY) {
    for (i = 0; i < tokens[index].size; i++) {
      next = image_json_token_next(tokens, count, next);
    }
    return next;
  }

  return next;
}

static int image_json_token_eq(const image_json_doc_t *doc, int token_index,
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
         image_memcmp(doc->json + token.start, text, len) == 0;
}

static int image_json_find_value(const image_json_doc_t *doc, const char *key) {
  int i;

  if (doc->count <= 0 || doc->tokens[0].type != JSMN_OBJECT) {
    return -1;
  }

  i = 1;
  while (i < doc->count) {
    int value_index;

    if (i + 1 >= doc->count) {
      return -1;
    }

    value_index = i + 1;
    if (image_json_token_eq(doc, i, key)) {
      return value_index;
    }

    i = image_json_token_next(doc->tokens, doc->count, value_index);
  }

  return -1;
}

static int image_json_parse(image_json_doc_t *doc, const char *json,
                            pdk_u32 json_len) {
  jsmn_parser parser;

  doc->json = json;
  doc->len = json_len;
  jsmn_init(&parser);
  doc->count = jsmn_parse(&parser, json, json_len, doc->tokens,
                          IMAGE_MAX_JSON_TOKENS);
  return doc->count >= 1 && doc->tokens[0].type == JSMN_OBJECT;
}

static int image_json_get_u32(const image_json_doc_t *doc, const char *key,
                              pdk_u32 *out_value) {
  int value_index = image_json_find_value(doc, key);
  jsmntok_t token;
  pdk_u32 value = 0;
  int i;

  if (value_index < 0) {
    return 0;
  }

  token = doc->tokens[value_index];
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

static int image_json_get_i32(const image_json_doc_t *doc, const char *key,
                              int *out_value) {
  int value_index = image_json_find_value(doc, key);
  jsmntok_t token;
  pdk_u32 value = 0;
  int sign = 1;
  int i;

  if (value_index < 0) {
    return 0;
  }

  token = doc->tokens[value_index];
  if (token.type != JSMN_PRIMITIVE || token.start >= token.end) {
    return 0;
  }

  i = token.start;
  if (doc->json[i] == '-') {
    sign = -1;
    i++;
  }
  if (i >= token.end) {
    return 0;
  }

  for (; i < token.end; i++) {
    char ch = doc->json[i];
    if (ch < '0' || ch > '9') {
      return 0;
    }
    if (value > 214748364u ||
        (value == 214748364u && (pdk_u32)(ch - '0') > (sign < 0 ? 8u : 7u))) {
      return 0;
    }
    value = (value * 10u) + (pdk_u32)(ch - '0');
  }

  if (sign < 0) {
    *out_value = value == 2147483648u ? (-2147483647 - 1) : -(int)value;
  } else {
    *out_value = (int)value;
  }
  return 1;
}

static int image_json_get_string(const image_json_doc_t *doc, const char *key,
                                 char *out, pdk_u32 out_cap) {
  int value_index = image_json_find_value(doc, key);
  jsmntok_t token;
  pdk_u32 len;

  if (value_index < 0 || out_cap == 0) {
    return 0;
  }

  token = doc->tokens[value_index];
  if (token.type != JSMN_STRING || token.start < 0 || token.end < token.start) {
    return 0;
  }

  len = (pdk_u32)(token.end - token.start);
  if (len + 1 > out_cap) {
    return 0;
  }

  pdk_memcpy(out, doc->json + token.start, len);
  out[len] = '\0';
  return 1;
}

static int image_json_get_string_ref(const image_json_doc_t *doc, const char *key,
                                     const char **out_ptr, pdk_u32 *out_len) {
  int value_index = image_json_find_value(doc, key);
  jsmntok_t token;

  if (value_index < 0) {
    return 0;
  }

  token = doc->tokens[value_index];
  if (token.type != JSMN_STRING || token.start < 0 || token.end < token.start) {
    return 0;
  }

  *out_ptr = doc->json + token.start;
  *out_len = (pdk_u32)(token.end - token.start);
  return 1;
}

static int image_json_get_string_optional(const image_json_doc_t *doc,
                                          const char *key, char *out,
                                          pdk_u32 out_cap) {
  int value_index = image_json_find_value(doc, key);
  if (value_index < 0) {
    return -1;
  }
  return image_json_get_string(doc, key, out, out_cap) ? 1 : 0;
}

static int image_json_get_fill_rgba(const image_json_doc_t *doc, pdk_u8 out_rgba[4]) {
  int value_index = image_json_find_value(doc, "fill");
  int i;
  int token_index;

  if (value_index < 0) {
    out_rgba[0] = 0;
    out_rgba[1] = 0;
    out_rgba[2] = 0;
    out_rgba[3] = 0;
    return 1;
  }

  if (doc->tokens[value_index].type != JSMN_ARRAY ||
      doc->tokens[value_index].size != 4) {
    return 0;
  }

  token_index = value_index + 1;
  for (i = 0; i < 4; i++) {
    jsmntok_t token = doc->tokens[token_index + i];
    pdk_u32 value = 0;
    int j;

    if (token.type != JSMN_PRIMITIVE || token.start >= token.end) {
      return 0;
    }

    for (j = token.start; j < token.end; j++) {
      char ch = doc->json[j];
      if (ch < '0' || ch > '9') {
        return 0;
      }
      value = (value * 10u) + (pdk_u32)(ch - '0');
      if (value > 255u) {
        return 0;
      }
    }

    out_rgba[i] = (pdk_u8)value;
  }

  return 1;
}

static image_handle_t *image_find_handle(pdk_u32 handle_id) {
  pdk_u32 i;
  for (i = 0; i < IMAGE_MAX_HANDLES; i++) {
    if (g_handles[i].in_use && g_handles[i].id == handle_id) {
      return &g_handles[i];
    }
  }
  return NULL;
}

static image_handle_t *image_alloc_handle(void) {
  pdk_u32 i;
  for (i = 0; i < IMAGE_MAX_HANDLES; i++) {
    if (!g_handles[i].in_use) {
      image_memzero(&g_handles[i], sizeof(g_handles[i]));
      g_handles[i].in_use = 1;
      g_handles[i].id = g_next_handle_id++;
      if (g_next_handle_id == 0) {
        g_next_handle_id = 1;
      }
      return &g_handles[i];
    }
  }
  return NULL;
}

static image_handle_t *image_create_handle_from_pixels(pdk_u8 *pixels, int width,
                                                       int height,
                                                       int source_format) {
  image_handle_t *handle = image_alloc_handle();
  if (handle == NULL) {
    return NULL;
  }
  handle->pixels = pixels;
  handle->width = width;
  handle->height = height;
  handle->source_format = source_format;
  return handle;
}

static int image_validate_dimensions(int width, int height,
                                     pdk_u32 *out_total_bytes) {
  pdk_u64 pixel_count;
  pdk_u64 total_bytes;

  if (width <= 0 || height <= 0) {
    return 0;
  }

  pixel_count = (pdk_u64)(pdk_u32)width * (pdk_u64)(pdk_u32)height;
  total_bytes = pixel_count * 4u;

  if (pixel_count == 0 || pixel_count > 0x3fffffffu || total_bytes > 0xffffffffu) {
    return 0;
  }

  if (out_total_bytes != NULL) {
    *out_total_bytes = (pdk_u32)total_bytes;
  }

  return 1;
}

static void image_release_handle(image_handle_t *handle) {
  if (handle == NULL) {
    return;
  }
  if (handle->pixels != NULL) {
    image_free(handle->pixels);
  }
  image_memzero(handle, sizeof(*handle));
}

static pdk_u32 image_close_all_handles(void) {
  pdk_u32 closed = 0;
  pdk_u32 i;
  for (i = 0; i < IMAGE_MAX_HANDLES; i++) {
    if (g_handles[i].in_use) {
      image_release_handle(&g_handles[i]);
      closed++;
    }
  }
  return closed;
}

static void image_buffer_init(image_buffer_t *buffer) {
  buffer->bytes = NULL;
  buffer->len = 0;
  buffer->cap = 0;
}

static void image_buffer_free(image_buffer_t *buffer) {
  if (buffer->bytes != NULL) {
    image_free(buffer->bytes);
  }
  buffer->bytes = NULL;
  buffer->len = 0;
  buffer->cap = 0;
}

static int image_buffer_reserve(image_buffer_t *buffer, pdk_u32 need) {
  pdk_u8 *next;
  pdk_u32 new_cap;
  if (need <= buffer->cap) {
    return 1;
  }
  new_cap = buffer->cap == 0 ? 256u : buffer->cap;
  while (new_cap < need) {
    if (new_cap > 0x7fffffffu) {
      return 0;
    }
    new_cap *= 2u;
  }
  next = (pdk_u8 *)image_realloc_sized(buffer->bytes, buffer->cap, new_cap);
  if (next == NULL) {
    return 0;
  }
  buffer->bytes = next;
  buffer->cap = new_cap;
  return 1;
}

static int image_buffer_append(image_buffer_t *buffer, const void *data,
                               pdk_u32 len) {
  if (!image_buffer_reserve(buffer, buffer->len + len)) {
    return 0;
  }
  pdk_memcpy(buffer->bytes + buffer->len, data, len);
  buffer->len += len;
  return 1;
}

static void image_stbi_write_func(void *context, void *data, int size) {
  image_buffer_t *buffer = (image_buffer_t *)context;
  if (buffer == NULL || size <= 0) {
    return;
  }
  if (!image_buffer_append(buffer, data, (pdk_u32)size)) {
    buffer->len = 0xffffffffu;
  }
}

static int image_fs_write(const char *path, const pdk_u8 *data, pdk_u32 len) {
  static const char module_name[] = "fs";
  static const char function_name[] = "write";
  pdk_call_result_t result;
  pdk_u32 path_len = pdk_strlen(path);
  pdk_u8 *payload = (pdk_u8 *)image_malloc(path_len + 1u + len);
  if (payload == NULL) {
    return 0;
  }
  pdk_memcpy(payload, path, path_len);
  payload[path_len] = 0;
  if (len > 0) {
    pdk_memcpy(payload + path_len + 1u, data, len);
  }
  result = pdk_call(module_name, 2, function_name, 5, payload,
                    path_len + 1u + len);
  image_free(payload);
  return result.error == 0 && result.return_code == 0;
}

static int image_base64_decoded_length(const char *src, pdk_u32 src_len,
                                       pdk_u32 *out_len);

static int image_base64_encode(const pdk_u8 *src, pdk_u32 src_len,
                               char **out_text, pdk_u32 *out_len) {
  static const char table[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  pdk_u32 i = 0;
  pdk_u32 j = 0;
  pdk_u32 enc_len;
  char *out;
  if (src_len > 0xbfffffffu) {
    return 0;
  }
  enc_len = ((src_len + 2u) / 3u) * 4u;
  out = (char *)image_malloc(enc_len + 1u);
  if (out == NULL) {
    return 0;
  }

  while (i < src_len) {
    pdk_u32 remain = src_len - i;
    pdk_u32 octet_a = src[i++];
    pdk_u32 octet_b = remain > 1u ? src[i++] : 0u;
    pdk_u32 octet_c = remain > 2u ? src[i++] : 0u;
    pdk_u32 triple = (octet_a << 16) | (octet_b << 8) | octet_c;

    out[j++] = table[(triple >> 18) & 0x3f];
    out[j++] = table[(triple >> 12) & 0x3f];
    out[j++] = remain > 1u ? table[(triple >> 6) & 0x3f] : '=';
    out[j++] = remain > 2u ? table[triple & 0x3f] : '=';
  }

  out[enc_len] = '\0';
  *out_text = out;
  *out_len = enc_len;
  return 1;
}

static int image_base64_value(char ch) {
  if (ch >= 'A' && ch <= 'Z') {
    return ch - 'A';
  }
  if (ch >= 'a' && ch <= 'z') {
    return ch - 'a' + 26;
  }
  if (ch >= '0' && ch <= '9') {
    return ch - '0' + 52;
  }
  if (ch == '+') {
    return 62;
  }
  if (ch == '/') {
    return 63;
  }
  return -1;
}

static int image_base64_decode(const char *src, pdk_u32 src_len,
                               pdk_u8 **out_bytes, pdk_u32 *out_len) {
  pdk_u32 i = 0;
  pdk_u32 j = 0;
  pdk_u32 decoded_len;
  pdk_u8 *out;

  if (!image_base64_decoded_length(src, src_len, &decoded_len)) {
    return 0;
  }
  out = (pdk_u8 *)image_malloc(decoded_len == 0 ? 1u : decoded_len);
  if (out == NULL) {
    return 0;
  }

  while (i < src_len) {
    int a = image_base64_value(src[i++]);
    int b = image_base64_value(src[i++]);
    int c = src[i] == '=' ? -2 : image_base64_value(src[i]);
    i++;
    int d = src[i] == '=' ? -2 : image_base64_value(src[i]);
    i++;
    pdk_u32 triple;

    if (a < 0 || b < 0 || c == -1 || d == -1) {
      image_free(out);
      return 0;
    }
    if ((c == -2 && d != -2) || (c == -2 && i != src_len) ||
        (d == -2 && i != src_len && src[i - 2] != '=')) {
      image_free(out);
      return 0;
    }

    triple = ((pdk_u32)a << 18) | ((pdk_u32)b << 12) |
             ((pdk_u32)(c < 0 ? 0 : c) << 6) | (pdk_u32)(d < 0 ? 0 : d);

    if (j < decoded_len) {
      out[j++] = (pdk_u8)((triple >> 16) & 0xffu);
    }
    if (c != -2 && j < decoded_len) {
      out[j++] = (pdk_u8)((triple >> 8) & 0xffu);
    }
    if (d != -2 && j < decoded_len) {
      out[j++] = (pdk_u8)(triple & 0xffu);
    }
  }

  *out_bytes = out;
  *out_len = decoded_len;
  return 1;
}

static int image_base64_decoded_length(const char *src, pdk_u32 src_len,
                                       pdk_u32 *out_len) {
  pdk_u32 padding = 0;
  if (src_len == 0 || (src_len % 4u) != 0) {
    return 0;
  }
  if (src[src_len - 1u] == '=') {
    padding++;
  }
  if (src[src_len - 2u] == '=') {
    padding++;
  }
  *out_len = (src_len / 4u) * 3u - padding;
  return 1;
}

static void image_blend_source_over(pdk_u8 *dst_px, const pdk_u8 *src_px) {
  pdk_u32 sa = src_px[3];
  pdk_u32 da = dst_px[3];
  pdk_u32 inv_sa = 255u - sa;
  pdk_u32 out_a = sa + ((da * inv_sa + 127u) / 255u);
  pdk_u32 c;

  if (out_a == 0) {
    dst_px[0] = 0;
    dst_px[1] = 0;
    dst_px[2] = 0;
    dst_px[3] = 0;
    return;
  }

  for (c = 0; c < 3u; c++) {
    pdk_u32 src_p = (pdk_u32)src_px[c] * sa;
    pdk_u32 dst_p = ((pdk_u32)dst_px[c] * da * inv_sa + 127u) / 255u;
    dst_px[c] = (pdk_u8)((src_p + dst_p + (out_a / 2u)) / out_a);
  }
  dst_px[3] = (pdk_u8)out_a;
}

static int image_fs_read(const char *path, image_blob_t *out_blob) {
  static const char module_name[] = "fs";
  static const char function_name[] = "read";
  pdk_call_result_t result;

  out_blob->bytes = NULL;
  out_blob->len = 0;

  result = pdk_call(module_name, 2, function_name, 4, (const pdk_u8 *)path,
                    pdk_strlen(path));
  if (result.error != 0 || result.return_code != 0) {
    return 0;
  }

  if (result.output_len == 0) {
    out_blob->bytes = NULL;
    out_blob->len = 0;
    return 1;
  }

  out_blob->bytes = (pdk_u8 *)image_malloc(result.output_len);
  if (out_blob->bytes == NULL) {
    return 0;
  }

  pdk_memcpy(out_blob->bytes, result.output, result.output_len);
  out_blob->len = result.output_len;
  return 1;
}

static void image_blob_free(image_blob_t *blob) {
  if (blob->bytes != NULL) {
    image_free(blob->bytes);
    blob->bytes = NULL;
  }
  blob->len = 0;
}

static int image_parse_resize_filter(const char *name, stbir_filter *out_filter) {
  if (name == NULL || name[0] == '\0') {
    *out_filter = STBIR_FILTER_TRIANGLE;
    return 1;
  }
  if (image_memcmp(name, "nearest", 7) == 0 && name[7] == '\0') {
    *out_filter = STBIR_FILTER_POINT_SAMPLE;
    return 1;
  }
  if (image_memcmp(name, "triangle", 8) == 0 && name[8] == '\0') {
    *out_filter = STBIR_FILTER_TRIANGLE;
    return 1;
  }
  if (image_memcmp(name, "catmullrom", 10) == 0 && name[10] == '\0') {
    *out_filter = STBIR_FILTER_CATMULLROM;
    return 1;
  }
  return 0;
}

static int image_parse_encode_format(const char *name, int *out_format) {
  if (name == NULL || name[0] == '\0') {
    *out_format = IMAGE_SOURCE_QOI;
    return 1;
  }
  if (image_memcmp(name, "qoi", 3) == 0 && name[3] == '\0') {
    *out_format = IMAGE_SOURCE_QOI;
    return 1;
  }
  if (image_memcmp(name, "png", 3) == 0 && name[3] == '\0') {
    *out_format = IMAGE_SOURCE_PNG;
    return 1;
  }
  return 0;
}

static int image_copy_region_rgba(pdk_u8 *dst, pdk_u32 dst_width,
                                  pdk_u32 dst_height, const image_handle_t *src,
                                  pdk_u32 x0, pdk_u32 y0, pdk_u32 x1,
                                  pdk_u32 y1) {
  pdk_u32 out_x;
  pdk_u32 out_y;
  int flip_x = x1 < x0;
  int flip_y = y1 < y0;

  (void)dst_height;

  for (out_y = 0; out_y < dst_height; out_y++) {
    pdk_u32 src_y = flip_y ? (y0 - 1u - out_y) : (y0 + out_y);
    for (out_x = 0; out_x < dst_width; out_x++) {
      pdk_u32 src_x = flip_x ? (x0 - 1u - out_x) : (x0 + out_x);
      pdk_u32 src_index = ((src_y * (pdk_u32)src->width) + src_x) * 4u;
      pdk_u32 dst_index = ((out_y * dst_width) + out_x) * 4u;
      pdk_memcpy(dst + dst_index, src->pixels + src_index, 4u);
    }
  }

  return 1;
}

static void image_apply_transform_rgba(pdk_u8 *dst, const image_handle_t *src,
                                       pdk_u32 flip) {
  pdk_u32 src_w = (pdk_u32)src->width;
  pdk_u32 src_h = (pdk_u32)src->height;
  pdk_u32 out_w = (flip & 4u) ? src_h : src_w;
  pdk_u32 out_h = (flip & 4u) ? src_w : src_h;
  pdk_u32 sx;
  pdk_u32 sy;

  for (sy = 0; sy < src_h; sy++) {
    for (sx = 0; sx < src_w; sx++) {
      pdk_u32 dx = sx;
      pdk_u32 dy = sy;
      pdk_u32 src_index;
      pdk_u32 dst_index;

      if ((flip & 4u) != 0) {
        dx = sy;
        dy = sx;
      }
      if ((flip & 1u) != 0) {
        dx = out_w - 1u - dx;
      }
      if ((flip & 2u) != 0) {
        dy = out_h - 1u - dy;
      }

      src_index = ((sy * src_w) + sx) * 4u;
      dst_index = ((dy * out_w) + dx) * 4u;
      pdk_memcpy(dst + dst_index, src->pixels + src_index, 4u);
    }
  }
}

static pdk_u8 *image_decode_blob(const image_blob_t *blob, int *out_width,
                                 int *out_height, int *out_source_format) {
  if (image_is_qoi_bytes(blob->bytes, blob->len)) {
    qoi_desc desc;
    void *pixels = qoi_decode(blob->bytes, (int)blob->len, &desc, 4);
    if (pixels == NULL) {
      return NULL;
    }
    *out_width = (int)desc.width;
    *out_height = (int)desc.height;
    *out_source_format = IMAGE_SOURCE_QOI;
    return (pdk_u8 *)pixels;
  }

  if (image_is_png_bytes(blob->bytes, blob->len)) {
    int width = 0;
    int height = 0;
    int channels = 0;
    stbi_uc *pixels = stbi_load_from_memory(blob->bytes, (int)blob->len, &width,
                                            &height, &channels, 4);
    if (pixels == NULL) {
      return NULL;
    }
    *out_width = width;
    *out_height = height;
    *out_source_format = IMAGE_SOURCE_PNG;
    return (pdk_u8 *)pixels;
  }

  return NULL;
}

static int image_info_from_blob(const image_blob_t *blob, int *out_width,
                                int *out_height, int *out_source_format) {
  if (image_qoi_info(blob->bytes, blob->len, out_width, out_height)) {
    *out_source_format = IMAGE_SOURCE_QOI;
    return 1;
  }

  if (image_is_png_bytes(blob->bytes, blob->len)) {
    int channels = 0;
    if (!stbi_info_from_memory(blob->bytes, (int)blob->len, out_width,
                               out_height, &channels)) {
      return 0;
    }
    *out_source_format = IMAGE_SOURCE_PNG;
    return 1;
  }

  return 0;
}

static pdk_u32 image_require_json(image_json_doc_t *doc) {
  pdk_u32 input_len = 0;
  const pdk_u8 *input = pdk_input(&input_len);

  if (input == NULL || input_len == 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "request body is required");
  }

  if (!image_json_parse(doc, (const char *)input, input_len)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "invalid json object");
  }

  return 0;
}

static pdk_u32 image_handle_open(void) {
  image_json_doc_t doc;
  char path[IMAGE_MAX_PATH_LEN];
  image_blob_t blob;
  image_handle_t *handle;
  int width = 0;
  int height = 0;
  int source_format = IMAGE_SOURCE_UNKNOWN;
  pdk_u8 *pixels;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_string(&doc, "path", path, sizeof(path))) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "path is required");
  }

  if (!image_fs_read(path, &blob)) {
    return image_respond_error(IMAGE_ERR_IO_FAILED, "failed to read image file");
  }

  pixels = image_decode_blob(&blob, &width, &height, &source_format);
  image_blob_free(&blob);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_DECODE_FAILED,
                               "failed to decode supported image");
  }

  if (!image_validate_dimensions(width, height, NULL)) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "decoded image size is invalid");
  }

  handle = image_alloc_handle();
  if (handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  handle->pixels = pixels;
  handle->width = width;
  handle->height = height;
  handle->source_format = source_format;

  return image_respond_handle_meta(handle->id, (pdk_u32)width, (pdk_u32)height,
                                   image_source_format_name(source_format));
}

static pdk_u32 image_handle_info(void) {
  image_json_doc_t doc;
  pdk_u32 src = 0;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (image_json_get_u32(&doc, "src", &src)) {
    image_handle_t *handle = image_find_handle(src);
    if (handle == NULL) {
      return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                                 "image handle was not found");
    }
    return image_respond_info((pdk_u32)handle->width, (pdk_u32)handle->height,
                              image_source_format_name(handle->source_format));
  }

  {
    char path[IMAGE_MAX_PATH_LEN];
    image_blob_t blob;
    int width = 0;
    int height = 0;
    int source_format = IMAGE_SOURCE_UNKNOWN;

    if (!image_json_get_string(&doc, "path", path, sizeof(path))) {
      return image_respond_error(IMAGE_ERR_BAD_INPUT,
                                 "src or path is required");
    }

    if (!image_fs_read(path, &blob)) {
      return image_respond_error(IMAGE_ERR_IO_FAILED,
                                 "failed to read image file");
    }

    if (!image_info_from_blob(&blob, &width, &height, &source_format)) {
      image_blob_free(&blob);
      return image_respond_error(IMAGE_ERR_UNSUPPORTED_FORMAT,
                                 "unsupported image format");
    }

    if (!image_validate_dimensions(width, height, NULL)) {
      image_blob_free(&blob);
      return image_respond_error(IMAGE_ERR_BAD_INPUT,
                                 "decoded image size is invalid");
    }

    image_blob_free(&blob);
    return image_respond_info((pdk_u32)width, (pdk_u32)height,
                              image_source_format_name(source_format));
  }
}

static pdk_u32 image_handle_close(void) {
  image_json_doc_t doc;
  pdk_u32 src = 0;
  image_handle_t *handle;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "src is required");
  }

  handle = image_find_handle(src);
  if (handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  image_release_handle(handle);
  return image_respond_closed(1);
}

static pdk_u32 image_handle_close_all_export(void) {
  return image_respond_closed(image_close_all_handles());
}

static pdk_u32 image_handle_create(void) {
  image_json_doc_t doc;
  pdk_u32 width = 0;
  pdk_u32 height = 0;
  pdk_u8 fill[4];
  pdk_u8 *pixels;
  image_handle_t *handle;
  pdk_u32 total_bytes;
  pdk_u32 i;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "width", &width) ||
      !image_json_get_u32(&doc, "height", &height)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "width and height are required");
  }

  if (width == 0 || height == 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "width and height must be positive");
  }

  if (!image_json_get_fill_rgba(&doc, fill)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "fill must be [r,g,b,a]");
  }

  if (!image_validate_dimensions((int)width, (int)height, &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "image size is too large");
  }

  pixels = (pdk_u8 *)image_malloc(total_bytes);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate image pixels");
  }

  for (i = 0; i < total_bytes / 4u; i++) {
    pdk_u32 base = i * 4u;
    pixels[base + 0] = fill[0];
    pixels[base + 1] = fill[1];
    pixels[base + 2] = fill[2];
    pixels[base + 3] = fill[3];
  }

  handle = image_alloc_handle();
  if (handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  handle->pixels = pixels;
  handle->width = (int)width;
  handle->height = (int)height;
  handle->source_format = IMAGE_SOURCE_UNKNOWN;

  return image_respond_create_meta(handle->id, width, height);
}

static pdk_u32 image_handle_clone(void) {
  image_json_doc_t doc;
  pdk_u32 src = 0;
  image_handle_t *src_handle;
  image_handle_t *dst_handle;
  pdk_u32 total_bytes;
  pdk_u8 *pixels;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "src is required");
  }

  src_handle = image_find_handle(src);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  if (!image_validate_dimensions(src_handle->width, src_handle->height,
                                 &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "source image size is invalid");
  }

  pixels = (pdk_u8 *)image_malloc(total_bytes);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate image pixels");
  }
  pdk_memcpy(pixels, src_handle->pixels, total_bytes);

  dst_handle = image_alloc_handle();
  if (dst_handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  dst_handle->pixels = pixels;
  dst_handle->width = src_handle->width;
  dst_handle->height = src_handle->height;
  dst_handle->source_format = src_handle->source_format;

  return image_respond_handle_meta(dst_handle->id, (pdk_u32)dst_handle->width,
                                   (pdk_u32)dst_handle->height, NULL);
}

static pdk_u32 image_handle_transform(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  pdk_u32 flip = 0;
  image_handle_t *src_handle;
  image_handle_t *dst_handle;
  pdk_u32 out_width;
  pdk_u32 out_height;
  pdk_u32 total_bytes;
  pdk_u8 *pixels;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id) ||
      !image_json_get_u32(&doc, "flip", &flip)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "src and flip are required");
  }
  if (flip > 7u) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "flip must be 0..7");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  out_width = (flip & 4u) ? (pdk_u32)src_handle->height : (pdk_u32)src_handle->width;
  out_height = (flip & 4u) ? (pdk_u32)src_handle->width : (pdk_u32)src_handle->height;
  if (!image_validate_dimensions((int)out_width, (int)out_height, &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "transform size is invalid");
  }

  pixels = (pdk_u8 *)image_malloc(total_bytes);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate image pixels");
  }

  image_apply_transform_rgba(pixels, src_handle, flip);

  dst_handle = image_create_handle_from_pixels(pixels, (int)out_width,
                                               (int)out_height,
                                               src_handle->source_format);
  if (dst_handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  return image_respond_transform_meta(dst_handle->id, out_width, out_height,
                                      flip);
}

static pdk_u32 image_handle_crop(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  pdk_u32 x0 = 0;
  pdk_u32 y0 = 0;
  pdk_u32 x1 = 0;
  pdk_u32 y1 = 0;
  pdk_u32 out_width;
  pdk_u32 out_height;
  pdk_u32 total_bytes;
  pdk_u8 *pixels;
  image_handle_t *src_handle;
  image_handle_t *dst_handle;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id) ||
      !image_json_get_u32(&doc, "x0", &x0) ||
      !image_json_get_u32(&doc, "y0", &y0) ||
      !image_json_get_u32(&doc, "x1", &x1) ||
      !image_json_get_u32(&doc, "y1", &y1)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "src, x0, y0, x1, y1 are required");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  if (x0 > (pdk_u32)src_handle->width || x1 > (pdk_u32)src_handle->width ||
      y0 > (pdk_u32)src_handle->height || y1 > (pdk_u32)src_handle->height) {
    return image_respond_error(IMAGE_ERR_OUT_OF_BOUNDS,
                               "crop edges must be within source bounds");
  }

  out_width = x0 >= x1 ? (x0 - x1) : (x1 - x0);
  out_height = y0 >= y1 ? (y0 - y1) : (y1 - y0);
  if (out_width == 0 || out_height == 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "crop width and height must be non-zero");
  }

  if (!image_validate_dimensions((int)out_width, (int)out_height, &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "crop size is too large");
  }

  pixels = (pdk_u8 *)image_malloc(total_bytes);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate image pixels");
  }

  image_copy_region_rgba(pixels, out_width, out_height, src_handle, x0, y0, x1,
                         y1);

  dst_handle = image_create_handle_from_pixels(pixels, (int)out_width,
                                               (int)out_height,
                                               src_handle->source_format);
  if (dst_handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  return image_respond_crop_meta(dst_handle->id, out_width, out_height,
                                 x1 < x0, y1 < y0);
}

static pdk_u32 image_handle_resize(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  pdk_u32 width = 0;
  pdk_u32 height = 0;
  pdk_u32 total_bytes;
  char filter_name[32];
  int filter_state;
  stbir_filter filter;
  pdk_u8 *pixels;
  void *resize_result;
  image_handle_t *src_handle;
  image_handle_t *dst_handle;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id) ||
      !image_json_get_u32(&doc, "width", &width) ||
      !image_json_get_u32(&doc, "height", &height)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "src, width and height are required");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  filter_state = image_json_get_string_optional(&doc, "filter", filter_name,
                                                sizeof(filter_name));
  if (filter_state == 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "filter must be a string");
  }
  if (!image_parse_resize_filter(filter_state > 0 ? filter_name : NULL,
                                 &filter)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "filter must be nearest, triangle, or catmullrom");
  }

  if (!image_validate_dimensions((int)width, (int)height, &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "resize size is too large");
  }

  pixels = (pdk_u8 *)image_malloc(total_bytes);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate image pixels");
  }

  resize_result = stbir_resize(src_handle->pixels, src_handle->width,
                               src_handle->height, 0, pixels, (int)width,
                               (int)height, 0, STBIR_RGBA, STBIR_TYPE_UINT8,
                               STBIR_EDGE_CLAMP, filter);
  if (resize_result == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_INTERNAL_ERROR,
                               "resize operation failed");
  }

  dst_handle = image_create_handle_from_pixels(pixels, (int)width, (int)height,
                                               src_handle->source_format);
  if (dst_handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  return image_respond_handle_meta(dst_handle->id, width, height, NULL);
}

static pdk_u32 image_handle_read_pixels(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  image_handle_t *src_handle;
  pdk_u32 total_bytes;
  char *data_base64;
  pdk_u32 data_len;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "src is required");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  if (!image_validate_dimensions(src_handle->width, src_handle->height,
                                 &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "source image size is invalid");
  }

  if (!image_base64_encode(src_handle->pixels, total_bytes, &data_base64,
                           &data_len)) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to encode pixel data");
  }

  parse_rc = image_respond_pixels((pdk_u32)src_handle->width,
                                  (pdk_u32)src_handle->height, total_bytes,
                                  data_base64);
  image_free(data_base64);
  (void)data_len;
  return parse_rc;
}

static pdk_u32 image_handle_read_pixels_bin(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  image_handle_t *src_handle;
  pdk_u32 total_bytes;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "src is required");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  if (!image_validate_dimensions(src_handle->width, src_handle->height,
                                 &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "source image size is invalid");
  }

  image_write_response((const char *)src_handle->pixels, total_bytes);
  return 0;
}

static pdk_u32 image_handle_encode(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  image_handle_t *src_handle;
  char path[IMAGE_MAX_PATH_LEN];
  char format_name[16];
  int format_state;
  int format = IMAGE_SOURCE_QOI;
  image_buffer_t buffer;
  pdk_u8 *encoded = NULL;
  pdk_u32 encoded_len = 0;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id) ||
      !image_json_get_string(&doc, "path", path, sizeof(path))) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "src and path are required");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  format_state = image_json_get_string_optional(&doc, "format", format_name,
                                                sizeof(format_name));
  if (format_state == 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "format must be a string");
  }
  if (!image_parse_encode_format(format_state > 0 ? format_name : NULL, &format)) {
    return image_respond_error(IMAGE_ERR_UNSUPPORTED_FORMAT,
                               "format must be png or qoi");
  }

  if (format == IMAGE_SOURCE_QOI) {
    qoi_desc desc;
    int out_len = 0;
    desc.width = (unsigned int)src_handle->width;
    desc.height = (unsigned int)src_handle->height;
    desc.channels = 4;
    desc.colorspace = QOI_SRGB;
    encoded = (pdk_u8 *)qoi_encode(src_handle->pixels, &desc, &out_len);
    if (encoded == NULL || out_len <= 0) {
      return image_respond_error(IMAGE_ERR_ENCODE_FAILED,
                                 "failed to encode qoi image");
    }
    encoded_len = (pdk_u32)out_len;
  } else {
    image_buffer_init(&buffer);
    if (!stbi_write_png_to_func(image_stbi_write_func, &buffer, src_handle->width,
                                src_handle->height, 4, src_handle->pixels,
                                src_handle->width * 4)) {
      image_buffer_free(&buffer);
      return image_respond_error(IMAGE_ERR_ENCODE_FAILED,
                                 "failed to encode png image");
    }
    if (buffer.len == 0xffffffffu || buffer.bytes == NULL || buffer.len == 0) {
      image_buffer_free(&buffer);
      return image_respond_error(IMAGE_ERR_ENCODE_FAILED,
                                 "failed to encode png image");
    }
    encoded = buffer.bytes;
    encoded_len = buffer.len;
  }

  if (!image_fs_write(path, encoded, encoded_len)) {
    if (format == IMAGE_SOURCE_PNG) {
      image_buffer_free(&buffer);
    } else {
      image_free(encoded);
    }
    return image_respond_error(IMAGE_ERR_IO_FAILED,
                               "failed to write encoded image");
  }

  if (format == IMAGE_SOURCE_PNG) {
    image_buffer_free(&buffer);
  } else {
    image_free(encoded);
  }

  return image_respond_encoded(path, format == IMAGE_SOURCE_PNG ? "png" : "qoi",
                               encoded_len);
}

static pdk_u32 image_handle_blit(void) {
  image_json_doc_t doc;
  pdk_u32 dst_id = 0;
  pdk_u32 src_id = 0;
  int x = 0;
  int y = 0;
  image_handle_t *dst_handle;
  image_handle_t *src_handle;
  pdk_u8 *pixels;
  pdk_u32 total_bytes;
  pdk_u32 row;
  image_handle_t *result_handle;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "dst", &dst_id) ||
      !image_json_get_u32(&doc, "src", &src_id) ||
      !image_json_get_i32(&doc, "x", &x) ||
      !image_json_get_i32(&doc, "y", &y)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "dst, src, x and y are required");
  }

  dst_handle = image_find_handle(dst_id);
  src_handle = image_find_handle(src_id);
  if (dst_handle == NULL || src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  if (!image_validate_dimensions(dst_handle->width, dst_handle->height,
                                 &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "destination image size is invalid");
  }

  pixels = (pdk_u8 *)image_malloc(total_bytes);
  if (pixels == NULL) {
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "failed to allocate image pixels");
  }
  pdk_memcpy(pixels, dst_handle->pixels, total_bytes);

  for (row = 0; row < (pdk_u32)src_handle->height; row++) {
    int dst_y = y + (int)row;
    pdk_u32 col;
    if (dst_y < 0 || dst_y >= dst_handle->height) {
      continue;
    }
    for (col = 0; col < (pdk_u32)src_handle->width; col++) {
      int dst_x = x + (int)col;
      pdk_u32 src_index;
      pdk_u32 dst_index;
      if (dst_x < 0 || dst_x >= dst_handle->width) {
        continue;
      }
      src_index = ((row * (pdk_u32)src_handle->width) + col) * 4u;
      dst_index = (((pdk_u32)dst_y * (pdk_u32)dst_handle->width) +
                   (pdk_u32)dst_x) * 4u;
      image_blend_source_over(pixels + dst_index, src_handle->pixels + src_index);
    }
  }

  result_handle = image_create_handle_from_pixels(pixels, dst_handle->width,
                                                  dst_handle->height,
                                                  dst_handle->source_format);
  if (result_handle == NULL) {
    image_free(pixels);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  return image_respond_handle_meta(result_handle->id,
                                   (pdk_u32)result_handle->width,
                                   (pdk_u32)result_handle->height, NULL);
}

static pdk_u32 image_handle_write_pixels(void) {
  image_json_doc_t doc;
  pdk_u32 src_id = 0;
  pdk_u32 width = 0;
  pdk_u32 height = 0;
  pdk_u32 total_bytes;
  image_handle_t *src_handle;
  const char *pixel_format_ptr;
  const char *encoding_ptr;
  const char *data_ptr;
  pdk_u32 pixel_format_len;
  pdk_u32 encoding_len;
  pdk_u32 data_len;
  pdk_u8 *decoded;
  pdk_u32 expected_decoded_len;
  pdk_u32 decoded_len;
  image_handle_t *result_handle;
  pdk_u32 parse_rc;

  parse_rc = image_require_json(&doc);
  if (parse_rc != 0) {
    return parse_rc;
  }

  if (!image_json_get_u32(&doc, "src", &src_id) ||
      !image_json_get_u32(&doc, "width", &width) ||
      !image_json_get_u32(&doc, "height", &height)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "src, width and height are required");
  }

  src_handle = image_find_handle(src_id);
  if (src_handle == NULL) {
    return image_respond_error(IMAGE_ERR_INVALID_HANDLE,
                               "image handle was not found");
  }

  if (!image_json_get_string_ref(&doc, "pixelFormat", &pixel_format_ptr,
                                 &pixel_format_len) ||
      pixel_format_len != 5u ||
      image_memcmp(pixel_format_ptr, "rgba8", 5u) != 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "pixelFormat must be rgba8");
  }

  if (!image_json_get_string_ref(&doc, "encoding", &encoding_ptr,
                                 &encoding_len) ||
      encoding_len != 6u || image_memcmp(encoding_ptr, "base64", 6u) != 0) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "encoding must be base64");
  }

  if (!image_json_get_string_ref(&doc, "data", &data_ptr, &data_len)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "data is required");
  }

  if (!image_validate_dimensions((int)width, (int)height, &total_bytes)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT, "image size is too large");
  }

  if (!image_base64_decoded_length(data_ptr, data_len, &expected_decoded_len) ||
      expected_decoded_len != total_bytes) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "decoded pixel byte length does not match dimensions");
  }

  if (!image_base64_decode(data_ptr, data_len, &decoded, &decoded_len)) {
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "data must be valid base64");
  }

  if (decoded_len != total_bytes) {
    image_free(decoded);
    return image_respond_error(IMAGE_ERR_BAD_INPUT,
                               "decoded pixel byte length does not match dimensions");
  }

  result_handle = image_create_handle_from_pixels(decoded, (int)width,
                                                  (int)height,
                                                  IMAGE_SOURCE_UNKNOWN);
  if (result_handle == NULL) {
    image_free(decoded);
    return image_respond_error(IMAGE_ERR_OUT_OF_MEMORY,
                               "no image handle slots available");
  }

  return image_respond_handle_meta(result_handle->id, width, height, NULL);
}

static pdk_u32 image_stub_not_implemented(void) {
  return image_respond_error(IMAGE_ERR_NOT_IMPLEMENTED,
                             "image/v1 export is not implemented yet");
}

__attribute__((export_name("open"))) pdk_u32 image_open(void) {
  return image_handle_open();
}

__attribute__((export_name("create"))) pdk_u32 image_create(void) {
  return image_handle_create();
}

__attribute__((export_name("info"))) pdk_u32 image_info(void) {
  return image_handle_info();
}

__attribute__((export_name("clone"))) pdk_u32 image_clone(void) {
  return image_handle_clone();
}

__attribute__((export_name("transform"))) pdk_u32 image_transform(void) {
  return image_handle_transform();
}

__attribute__((export_name("crop"))) pdk_u32 image_crop(void) {
  return image_handle_crop();
}

__attribute__((export_name("resize"))) pdk_u32 image_resize(void) {
  return image_handle_resize();
}

__attribute__((export_name("blit"))) pdk_u32 image_blit(void) {
  return image_handle_blit();
}

__attribute__((export_name("read_pixels"))) pdk_u32 image_read_pixels(void) {
  return image_handle_read_pixels();
}

__attribute__((export_name("read_pixels_bin"))) pdk_u32 image_read_pixels_bin(void) {
  return image_handle_read_pixels_bin();
}

__attribute__((export_name("write_pixels"))) pdk_u32 image_write_pixels(void) {
  return image_handle_write_pixels();
}

__attribute__((export_name("encode"))) pdk_u32 image_encode(void) {
  return image_handle_encode();
}

__attribute__((export_name("close"))) pdk_u32 image_close(void) {
  return image_handle_close();
}

__attribute__((export_name("close_all"))) pdk_u32 image_close_all(void) {
  return image_handle_close_all_export();
}

__attribute__((export_name("mock"))) pdk_u32 mock(void) { return 0; }
