#include "pdk.h"

static int streq(const char *a, const char *b) {
  while (*a && *b) {
    if (*a != *b) return 0;
    a++;
    b++;
  }
  return *a == '\0' && *b == '\0';
}

static char *find_json_string_value(const char *json, const char *key) {
  const char *p = json;
  const char *k = key;
  while (*p) {
    const char *start = p;
    const char *needle = k;
    while (*start && *needle && *start == *needle) {
      start++;
      needle++;
    }
    if (*needle == '\0') {
      const char *colon = start;
      while (*colon == ' ' || *colon == '\t' || *colon == '\n' || *colon == '\r') colon++;
      if (*colon != ':') return NULL;
      colon++;
      while (*colon == ' ' || *colon == '\t' || *colon == '\n' || *colon == '\r') colon++;
      if (*colon != '"') return NULL;
      return (char *)(colon + 1);
    }
    p++;
  }
  return NULL;
}

static uint32_t copy_json_string(char *dst, uint32_t cap, const char *src) {
  uint32_t len = 0;
  if (!dst || cap == 0 || !src) return 0;
  while (*src && *src != '"' && len + 1 < cap) {
    if (*src == '\\' && src[1] != '\0') {
      src++;
    }
    dst[len++] = *src++;
  }
  dst[len] = '\0';
  return len;
}

__attribute__((export_name("call"))) uint32_t echo_call(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  if (!input || input_len == 0) {
    const char error_msg[] = "Missing input";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  char json[2048];
  uint32_t copy_len = input_len < sizeof(json) - 1 ? input_len : (uint32_t)(sizeof(json) - 1);
  pdk_memcpy(json, input, copy_len);
  json[copy_len] = '\0';

  char *plugin_src = find_json_string_value(json, "\"plugin\"");
  char *method_src = find_json_string_value(json, "\"method\"");
  char *payload_src = find_json_string_value(json, "\"input\"");
  if (!plugin_src || !method_src) {
    const char error_msg[] = "Expected JSON with plugin and method";
    pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    return 1;
  }

  char plugin[256];
  char method[128];
  char payload[1024];
  copy_json_string(plugin, sizeof(plugin), plugin_src);
  copy_json_string(method, sizeof(method), method_src);
  if (payload_src) copy_json_string(payload, sizeof(payload), payload_src);
  else payload[0] = '\0';

  pdk_call_result_t result = pdk_call_plugin_str(plugin, method,
                                                 (const uint8_t *)payload,
                                                 pdk_strlen(payload));

  if (result.error != 0 || result.return_code != 0) {
    if (result.output && result.output_len > 0) {
      pdk_output(result.output, result.output_len);
    } else {
      const char error_msg[] = "Echo call failed";
      pdk_output((const uint8_t *)error_msg, sizeof(error_msg) - 1);
    }
    return 1;
  }

  if (result.output && result.output_len > 0) {
    pdk_output(result.output, result.output_len);
  }
  return 0;
}

__attribute__((export_name("info"))) uint32_t info(void) {
  const char message[] = "echo plugin: forwards runtime/plugin calls for bridge testing";
  pdk_output((const uint8_t *)message, sizeof(message) - 1);
  return 0;
}
