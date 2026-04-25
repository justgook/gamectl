#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "jsmn.h"
#include "pdk.h"
#include "vendor/lua/lauxlib.h"
#include "vendor/lua/lualib.h"

#define LUA_JSON_RECURSION_LIMIT 128

typedef struct {
  const char *json;
  jsmntok_t *tokens;
  int count;
} JsonDoc;

typedef struct {
  char *buf;
  size_t len;
  size_t cap;
} StrBuf;

static void sb_init(StrBuf *sb) {
  sb->buf = NULL;
  sb->len = 0;
  sb->cap = 0;
}

static void sb_free(StrBuf *sb) {
  if (sb->buf != NULL) {
    free(sb->buf);
    sb->buf = NULL;
  }
  sb->len = 0;
  sb->cap = 0;
}

static int sb_reserve(StrBuf *sb, size_t add_len) {
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

static int sb_append_len(StrBuf *sb, const char *src, size_t len) {
  if (len == 0) {
    return 1;
  }
  if (!sb_reserve(sb, len)) {
    return 0;
  }
  memcpy(sb->buf + sb->len, src, len);
  sb->len += len;
  sb->buf[sb->len] = '\0';
  return 1;
}

static int sb_append_c(StrBuf *sb, char c) {
  if (!sb_reserve(sb, 1u)) {
    return 0;
  }
  sb->buf[sb->len++] = c;
  sb->buf[sb->len] = '\0';
  return 1;
}

static int str_ends_with(const char *s, const char *suffix) {
  size_t s_len = strlen(s);
  size_t suffix_len = strlen(suffix);
  if (suffix_len > s_len) {
    return 0;
  }
  return memcmp(s + (s_len - suffix_len), suffix, suffix_len) == 0;
}

static char *dup_with_optional_lua_suffix(const char *name, int add_lua_suffix) {
  size_t len = strlen(name);
  size_t extra = add_lua_suffix ? 4u : 0u;
  char *result = (char *)malloc(len + extra + 1u);
  if (result == NULL) {
    return NULL;
  }
  memcpy(result, name, len);
  if (add_lua_suffix) {
    memcpy(result + len, ".lua", 4u);
    len += 4u;
  }
  result[len] = '\0';
  return result;
}

static char *dup_dots_to_slashes(const char *name, int add_lua_suffix) {
  size_t len = strlen(name);
  size_t extra = add_lua_suffix ? 4u : 0u;
  char *result = (char *)malloc(len + extra + 1u);
  size_t i;
  if (result == NULL) {
    return NULL;
  }
  for (i = 0; i < len; i++) {
    result[i] = name[i] == '.' ? '/' : name[i];
  }
  if (add_lua_suffix) {
    memcpy(result + len, ".lua", 4u);
    len += 4u;
  }
  result[len] = '\0';
  return result;
}

static int str_equals(const char *a, const char *b) { return strcmp(a, b) == 0; }

static void output_text(const char *text, size_t len) {
  pdk_output((const uint8_t *)text, (uint32_t)len);
}

static uint32_t respond_ok(const char *text) {
  output_text(text, strlen(text));
  return 0;
}

static uint32_t respond_error_text(const char *text) {
  output_text(text, strlen(text));
  return 1;
}

static uint32_t respond_lua_error(lua_State *L) {
  size_t len = 0;
  const char *msg = lua_tolstring(L, -1, &len);
  if (msg == NULL) {
    return respond_error_text("lua error");
  }
  output_text(msg, len);
  return 1;
}

static int json_encode_value(lua_State *L, int idx, StrBuf *out,
                             const void **seen, int seen_count, int depth);

static int json_hex_val(char c) {
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

static int json_parse_u16(const char *s, unsigned *out_cp) {
  int i;
  unsigned cp = 0;
  for (i = 0; i < 4; i++) {
    int h = json_hex_val(s[i]);
    if (h < 0) {
      return 0;
    }
    cp = (cp << 4) | (unsigned)h;
  }
  *out_cp = cp;
  return 1;
}

static int lua_add_utf8(luaL_Buffer *b, unsigned cp) {
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

static int lua_push_json_string_unescaped(lua_State *L, const char *s,
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
      if (i + 4 > len || !json_parse_u16(s + i, &cp)) {
        return luaL_error(L, "json.decode: invalid unicode escape");
      }
      i += 4;
      if (cp >= 0xD800u && cp <= 0xDBFFu) {
        unsigned cp2 = 0;
        if (i + 6 <= len && s[i] == '\\' && s[i + 1] == 'u' &&
            json_parse_u16(s + i + 2, &cp2) && cp2 >= 0xDC00u &&
            cp2 <= 0xDFFFu) {
          cp = 0x10000u + ((cp - 0xD800u) << 10) + (cp2 - 0xDC00u);
          i += 6;
        }
      }
      if (!lua_add_utf8(&b, cp)) {
        return luaL_error(L, "json.decode: invalid unicode codepoint");
      }
    } else {
      return luaL_error(L, "json.decode: unsupported escape sequence");
    }
  }
  luaL_pushresult(&b);
  return 1;
}

static int json_decode_value(lua_State *L, const JsonDoc *doc, int tok_idx,
                             int depth, int *next_idx) {
  jsmntok_t tok;
  int i;
  int cur;
  if (depth > LUA_JSON_RECURSION_LIMIT) {
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
      lua_push_json_string_unescaped(L, doc->json + key_tok.start,
                                     (size_t)(key_tok.end - key_tok.start));
      json_decode_value(L, doc, cur, depth + 1, &cur);
      lua_settable(L, -3);
    }
    *next_idx = cur;
    return 1;
  }

  if (tok.type == JSMN_ARRAY) {
    lua_createtable(L, tok.size, 0);
    cur = tok_idx + 1;
    for (i = 0; i < tok.size; i++) {
      json_decode_value(L, doc, cur, depth + 1, &cur);
      lua_seti(L, -2, (lua_Integer)i + 1);
    }
    *next_idx = cur;
    return 1;
  }

  if (tok.type == JSMN_STRING) {
    if (tok.start < 0 || tok.end < tok.start) {
      return luaL_error(L, "json.decode: invalid string token");
    }
    lua_push_json_string_unescaped(L, doc->json + tok.start,
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
  JsonDoc doc;
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

  json_decode_value(L, &doc, 0, 0, &next_idx);
  if (next_idx != doc.count) {
    free(doc.tokens);
    return luaL_error(L, "json.decode: trailing tokens detected");
  }

  free(doc.tokens);
  return 1;
}

static int json_encode_string(StrBuf *out, const char *s, size_t len) {
  static const char hex[] = "0123456789abcdef";
  size_t i;
  if (!sb_append_c(out, '"')) {
    return 0;
  }
  for (i = 0; i < len; i++) {
    unsigned char c = (unsigned char)s[i];
    if (c == '"') {
      if (!sb_append_len(out, "\\\"", 2u)) return 0;
    } else if (c == '\\') {
      if (!sb_append_len(out, "\\\\", 2u)) return 0;
    } else if (c == '\b') {
      if (!sb_append_len(out, "\\b", 2u)) return 0;
    } else if (c == '\f') {
      if (!sb_append_len(out, "\\f", 2u)) return 0;
    } else if (c == '\n') {
      if (!sb_append_len(out, "\\n", 2u)) return 0;
    } else if (c == '\r') {
      if (!sb_append_len(out, "\\r", 2u)) return 0;
    } else if (c == '\t') {
      if (!sb_append_len(out, "\\t", 2u)) return 0;
    } else if (c < 0x20u) {
      char esc[6];
      esc[0] = '\\';
      esc[1] = 'u';
      esc[2] = '0';
      esc[3] = '0';
      esc[4] = hex[(c >> 4) & 0x0Fu];
      esc[5] = hex[c & 0x0Fu];
      if (!sb_append_len(out, esc, sizeof(esc))) return 0;
    } else {
      if (!sb_append_c(out, (char)c)) return 0;
    }
  }
  return sb_append_c(out, '"');
}

static int json_table_shape(lua_State *L, int idx, lua_Integer *out_max,
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

static int json_encode_table(lua_State *L, int idx, StrBuf *out,
                             const void **seen, int seen_count, int depth) {
  const void *ptr;
  lua_Integer max_idx = 0;
  int is_array = 0;
  int i;
  idx = lua_absindex(L, idx);

  if (depth > LUA_JSON_RECURSION_LIMIT) {
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
  if (seen_count + 1 >= LUA_JSON_RECURSION_LIMIT) {
    luaL_error(L, "json.encode: nesting too deep");
    return 0;
  }
  seen[seen_count] = ptr;
  seen_count += 1;

  json_table_shape(L, idx, &max_idx, &is_array);
  if (is_array) {
    lua_Integer k;
    if (!sb_append_c(out, '[')) return 0;
    for (k = 1; k <= max_idx; k++) {
      if (k > 1 && !sb_append_c(out, ',')) return 0;
      lua_geti(L, idx, k);
      if (!json_encode_value(L, -1, out, seen, seen_count, depth + 1)) {
        lua_pop(L, 1);
        return 0;
      }
      lua_pop(L, 1);
    }
    return sb_append_c(out, ']');
  }

  if (!sb_append_c(out, '{')) return 0;
  i = 0;
  lua_pushnil(L);
  while (lua_next(L, idx) != 0) {
    size_t key_len = 0;
    const char *key = lua_tolstring(L, -2, &key_len);
    if (key == NULL) {
      lua_pop(L, 2);
      luaL_error(L, "json.encode: object keys must be strings");
      return 0;
    }
    if (i++ > 0 && !sb_append_c(out, ',')) {
      lua_pop(L, 1);
      return 0;
    }
    if (!json_encode_string(out, key, key_len) || !sb_append_c(out, ':')) {
      lua_pop(L, 1);
      return 0;
    }
    if (!json_encode_value(L, -1, out, seen, seen_count, depth + 1)) {
      lua_pop(L, 1);
      return 0;
    }
    lua_pop(L, 1);
  }
  return sb_append_c(out, '}');
}

static int json_encode_value(lua_State *L, int idx, StrBuf *out,
                             const void **seen, int seen_count, int depth) {
  int t = lua_type(L, idx);
  if (t == LUA_TNIL) {
    return sb_append_len(out, "null", 4u);
  }
  if (t == LUA_TBOOLEAN) {
    return lua_toboolean(L, idx) ? sb_append_len(out, "true", 4u)
                                 : sb_append_len(out, "false", 5u);
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
    return sb_append_len(out, num, (size_t)n);
  }
  if (t == LUA_TSTRING) {
    size_t len = 0;
    const char *s = lua_tolstring(L, idx, &len);
    return json_encode_string(out, s, len);
  }
  if (t == LUA_TTABLE) {
    return json_encode_table(L, idx, out, seen, seen_count, depth);
  }
  luaL_error(L, "json.encode: unsupported lua type: %s", lua_typename(L, t));
  return 0;
}

static int lua_json_encode(lua_State *L) {
  StrBuf out;
  const void *seen[LUA_JSON_RECURSION_LIMIT];
  sb_init(&out);
  if (!json_encode_value(L, 1, &out, seen, 0, 0)) {
    sb_free(&out);
    return luaL_error(L, "json.encode: out of memory");
  }
  lua_pushlstring(L, out.buf != NULL ? out.buf : "", out.len);
  sb_free(&out);
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
  StrBuf field;
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
  sb_init(&field);

#define LUA_CSV_FLUSH_FIELD()                                                  \
  do {                                                                         \
    lua_pushlstring(L, field.buf != NULL ? field.buf : "", field.len);         \
    lua_seti(L, row_idx, (lua_Integer)(++field_count));                        \
    field.len = 0;                                                             \
    if (field.buf != NULL) {                                                   \
      field.buf[0] = '\0';                                                     \
    }                                                                          \
  } while (0)

#define LUA_CSV_FLUSH_ROW()                                                    \
  do {                                                                         \
    if (field.len > 0 || field_count > 0) {                                     \
      LUA_CSV_FLUSH_FIELD();                                                   \
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
          if (!sb_append_c(&field, '"')) {
            sb_free(&field);
            return luaL_error(L, "csv.parse: out of memory");
          }
          i += 2;
          continue;
        }
        in_quotes = 0;
        i += 1;
        continue;
      }
      if (!sb_append_c(&field, c)) {
        sb_free(&field);
        return luaL_error(L, "csv.parse: out of memory");
      }
      i += 1;
      continue;
    }

    if (c == '"') {
      in_quotes = 1;
    } else if (c == ',') {
      LUA_CSV_FLUSH_FIELD();
    } else if (c == '\n' || c == '\r') {
      LUA_CSV_FLUSH_ROW();
      if (c == '\r' && next == '\n') {
        i += 1;
      }
    } else {
      if (!sb_append_c(&field, c)) {
        sb_free(&field);
        return luaL_error(L, "csv.parse: out of memory");
      }
    }
    i += 1;
  }

  LUA_CSV_FLUSH_ROW();
  sb_free(&field);
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

#undef LUA_CSV_FLUSH_FIELD
#undef LUA_CSV_FLUSH_ROW

static int lua_host_call(lua_State *L) {
  size_t module_len = 0;
  size_t function_len = 0;
  size_t input_len = 0;
  const char *module = luaL_checklstring(L, 1, &module_len);
  const char *function = luaL_checklstring(L, 2, &function_len);
  const char *input = NULL;
  pdk_call_result_t result;

  if (lua_gettop(L) >= 3 && !lua_isnil(L, 3)) {
    input = luaL_checklstring(L, 3, &input_len);
  }

  result = pdk_call(module, (uint32_t)module_len, function, (uint32_t)function_len,
                    (const uint8_t *)input, (uint32_t)input_len);
  if (result.error != 0) {
    return luaL_error(L, "host.call transport failed");
  }
  if (result.return_code != 0) {
    lua_pushlstring(L,
                    (const char *)(result.output != NULL ? result.output : (const uint8_t *)""),
                    (size_t)result.output_len);
    return lua_error(L);
  }

  lua_pushlstring(L,
                  (const char *)(result.output != NULL ? result.output : (const uint8_t *)""),
                  (size_t)result.output_len);
  return 1;
}

static int try_fs_read_candidate(const char *candidate, const uint8_t **out_data,
                                 uint32_t *out_len) {
  pdk_call_result_t result = pdk_call_str("fs", "read", (const uint8_t *)candidate,
                                          (uint32_t)strlen(candidate));
  if (result.error != 0) {
    return -1;
  }
  if (result.return_code != 0) {
    return 0;
  }
  *out_data = result.output;
  *out_len = result.output_len;
  return 1;
}

static int lua_require_fs_searcher(lua_State *L) {
  const char *module_name = luaL_checkstring(L, 1);
  const uint8_t *file_data = NULL;
  uint32_t file_len = 0;
  StrBuf err;
  char *candidates[4] = {0};
  int candidate_count = 0;
  int has_dot = strchr(module_name, '.') != NULL;
  int has_lua_suffix = str_ends_with(module_name, ".lua");
  int i;

  sb_init(&err);

  candidates[candidate_count++] = dup_with_optional_lua_suffix(module_name, 0);
  if (!has_lua_suffix) {
    candidates[candidate_count++] = dup_with_optional_lua_suffix(module_name, 1);
  }
  if (has_dot) {
    candidates[candidate_count++] = dup_dots_to_slashes(module_name, 0);
    if (!has_lua_suffix) {
      candidates[candidate_count++] = dup_dots_to_slashes(module_name, 1);
    }
  }

  for (i = 0; i < candidate_count; i++) {
    int duplicate = 0;
    int read_status;
    int j;
    if (candidates[i] == NULL) {
      sb_free(&err);
      for (j = 0; j < candidate_count; j++) {
        free(candidates[j]);
      }
      return luaL_error(L, "require searcher: out of memory");
    }
    for (j = 0; j < i; j++) {
      if (candidates[j] != NULL && str_equals(candidates[j], candidates[i])) {
        duplicate = 1;
        break;
      }
    }
    if (duplicate) {
      continue;
    }

    read_status = try_fs_read_candidate(candidates[i], &file_data, &file_len);
    if (read_status < 0) {
      sb_free(&err);
      for (j = 0; j < candidate_count; j++) {
        free(candidates[j]);
      }
      return luaL_error(L, "require searcher: fs.read transport failed");
    }
    if (read_status > 0) {
      int load_status = luaL_loadbufferx(L, (const char *)file_data, (size_t)file_len,
                                         candidates[i], "t");
      char *resolved = candidates[i];
      for (j = 0; j < candidate_count; j++) {
        if (j != i) {
          free(candidates[j]);
        }
      }
      if (load_status != LUA_OK) {
        free(resolved);
        sb_free(&err);
        return lua_error(L);
      }
      lua_pushstring(L, resolved);
      free(resolved);
      sb_free(&err);
      return 2;
    }

    if (!sb_append_len(&err, "\n\tno file '", 11u) ||
        !sb_append_len(&err, candidates[i], strlen(candidates[i])) ||
        !sb_append_c(&err, '\'')) {
      sb_free(&err);
      for (j = 0; j < candidate_count; j++) {
        free(candidates[j]);
      }
      return luaL_error(L, "require searcher: out of memory");
    }
  }

  for (i = 0; i < candidate_count; i++) {
    free(candidates[i]);
  }

  lua_pushlstring(L, err.buf != NULL ? err.buf : "\n\tno file", err.len);
  sb_free(&err);
  return 1;
}

static void register_json_lib(lua_State *L) {
  lua_newtable(L);
  lua_pushcfunction(L, lua_json_decode);
  lua_setfield(L, -2, "decode");
  lua_pushcfunction(L, lua_json_encode);
  lua_setfield(L, -2, "encode");
  lua_setglobal(L, "json");
}

static void register_csv_lib(lua_State *L) {
  lua_newtable(L);
  lua_pushcfunction(L, lua_csv_parse);
  lua_setfield(L, -2, "parse");
  lua_setglobal(L, "csv");
}

static void register_host_lib(lua_State *L) {
  lua_newtable(L);
  lua_pushcfunction(L, lua_host_call);
  lua_setfield(L, -2, "call");
  lua_pushcfunction(L, lua_host_call);
  lua_setfield(L, -2, "awaitCall");
  lua_setglobal(L, "host");
}

static void configure_package_searchers(lua_State *L) {
  lua_getglobal(L, "package");
  if (!lua_istable(L, -1)) {
    lua_pop(L, 1);
    luaL_error(L, "package table missing");
    return;
  }

  lua_getfield(L, -1, "searchers");
  if (!lua_istable(L, -1)) {
    lua_pop(L, 2);
    luaL_error(L, "package.searchers missing");
    return;
  }

  lua_newtable(L);
  lua_geti(L, -2, 1);
  lua_seti(L, -2, 1);
  lua_pushcfunction(L, lua_require_fs_searcher);
  lua_seti(L, -2, 2);
  lua_setfield(L, -3, "searchers");
  lua_pushliteral(L, "");
  lua_setfield(L, -2, "path");
  lua_pushliteral(L, "");
  lua_setfield(L, -2, "cpath");
  lua_pop(L, 2);
}

static void open_lua_libs(lua_State *L) {
  luaL_requiref(L, "_G", luaopen_base, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_COLIBNAME, luaopen_coroutine, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_TABLIBNAME, luaopen_table, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_STRLIBNAME, luaopen_string, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_MATHLIBNAME, luaopen_math, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_UTF8LIBNAME, luaopen_utf8, 1);
  lua_pop(L, 1);
  luaL_requiref(L, LUA_LOADLIBNAME, luaopen_package, 1);
  lua_pop(L, 1);
  register_json_lib(L);
  register_csv_lib(L);
  register_host_lib(L);
  configure_package_searchers(L);
}

static int run_script(lua_State *L, const uint8_t *code, uint32_t code_len) {
  int status = luaL_loadbufferx(L, (const char *)code, (size_t)code_len, "=(input)", "t");
  if (status != LUA_OK) {
    return status;
  }
  status = lua_pcall(L, 0, 0, 0);
  if (status != LUA_OK) {
    return status;
  }

  lua_getglobal(L, "main");
  if (lua_isnil(L, -1)) {
    lua_pop(L, 1);
    return LUA_OK;
  }
  if (!lua_isfunction(L, -1)) {
    lua_pop(L, 1);
    lua_pushliteral(L, "global 'main' exists but is not a function");
    return LUA_ERRRUN;
  }
  return lua_pcall(L, 0, 0, 0);
}

static int encode_global_output(lua_State *L) {
  int status;
  lua_getglobal(L, "json");
  if (!lua_istable(L, -1)) {
    lua_pop(L, 1);
    lua_pushliteral(L, "global 'json' missing");
    return LUA_ERRRUN;
  }
  lua_getfield(L, -1, "encode");
  lua_remove(L, -2);
  if (!lua_isfunction(L, -1)) {
    lua_pop(L, 1);
    lua_pushliteral(L, "global 'json.encode' missing");
    return LUA_ERRRUN;
  }
  lua_getglobal(L, "output");
  status = lua_pcall(L, 1, 1, 0);
  return status;
}

int main(void) { return 0; }

__attribute__((export_name("alloc"))) uint32_t lua_plugin_alloc(uint32_t size) {
  void *ptr = malloc(size > 0 ? (size_t)size : 1u);
  return (uint32_t)ptr;
}

__attribute__((export_name("free"))) void lua_plugin_free(uint32_t ptr) {
  if (ptr != 0) {
    free((void *)ptr);
  }
}

__attribute__((export_name("init"))) uint32_t init(void) {
  return respond_ok("ok");
}

__attribute__((export_name("run"))) uint32_t run(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  lua_State *L;
  int status;
  uint32_t rc;

  if (input_len == 0) {
    return respond_error_text("lua.run input empty");
  }

  L = luaL_newstate();
  if (L == NULL) {
    return respond_error_text("failed to create lua state");
  }

  open_lua_libs(L);

  status = run_script(L, input, input_len);
  if (status != LUA_OK) {
    rc = respond_lua_error(L);
    lua_close(L);
    return rc;
  }

  status = encode_global_output(L);
  if (status != LUA_OK) {
    rc = respond_lua_error(L);
    lua_close(L);
    return rc;
  }

  {
    size_t output_len = 0;
    const char *output = lua_tolstring(L, -1, &output_len);
    output_text(output != NULL ? output : "null", output != NULL ? output_len : 4u);
  }

  lua_close(L);
  return 0;
}
