#include "pdk.h"

#define LAYOUT_EXPORT(name)
#define init_screen layout_core_init_screen
#define resize_screen layout_core_resize_screen
#define move_handle layout_core_move_handle
#define move_corner layout_core_move_corner
#define try_corner layout_core_try_corner
#define set_area_content layout_core_set_area_content
#define set_handle_content layout_core_set_handle_content
#define get_info_ptr layout_core_get_info_ptr
#include "core.c"
#undef LAYOUT_EXPORT
#undef init_screen
#undef resize_screen
#undef move_handle
#undef move_corner
#undef try_corner
#undef set_area_content
#undef set_handle_content
#undef get_info_ptr

static int is_space(uint8_t c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r';
}

static uint32_t parse_i32_list(const uint8_t *input, uint32_t input_len, layout_i32 *out, uint32_t max_out) {
  uint32_t count = 0;
  uint32_t i = 0;

  while (i < input_len && count < max_out) {
    while (i < input_len && (is_space(input[i]) || input[i] == ',')) i++;
    if (i >= input_len) break;

    int sign = 1;
    if (input[i] == '-') {
      sign = -1;
      i++;
    }

    layout_i32 value = 0;
    int has_digit = 0;
    while (i < input_len && input[i] >= '0' && input[i] <= '9') {
      value = (layout_i32)(value * 10 + (input[i] - '0'));
      i++;
      has_digit = 1;
    }

    if (!has_digit) break;
    out[count++] = sign < 0 ? -value : value;

    while (i < input_len && is_space(input[i])) i++;
    if (i < input_len && input[i] == ',') i++;
  }

  return count;
}

static uint32_t i32_to_str(layout_i32 value, char *buffer) {
  uint32_t pos = 0;
  uint32_t start = 0;
  unsigned int magnitude;

  if (value < 0) {
    buffer[pos++] = '-';
    magnitude = (unsigned int)(-value);
    start = pos;
  } else {
    magnitude = (unsigned int)value;
  }

  if (magnitude == 0) {
    buffer[pos++] = '0';
    buffer[pos] = '\0';
    return pos;
  }

  while (magnitude > 0) {
    buffer[pos++] = (char)('0' + (magnitude % 10));
    magnitude /= 10;
  }

  for (uint32_t a = start, b = pos - 1; a < b; a++, b--) {
    char tmp = buffer[a];
    buffer[a] = buffer[b];
    buffer[b] = tmp;
  }

  buffer[pos] = '\0';
  return pos;
}

static void output_i32(layout_i32 value) {
  char buffer[32];
  uint32_t len = i32_to_str(value, buffer);
  pdk_output((const uint8_t *)buffer, len);
}

__attribute__((export_name("init_screen"))) uint32_t pdk_init_screen(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[4] = {0};
  if (parse_i32_list(input, input_len, args, 4) != 4) {
    const char msg[] = "expected: w,h,handle_size,min_panel_size";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_init_screen(args[0], args[1], args[2], args[3]);
}

__attribute__((export_name("resize_screen"))) uint32_t pdk_resize_screen(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[3] = {0};
  if (parse_i32_list(input, input_len, args, 3) != 3) {
    const char msg[] = "expected: w,h,handle_size";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_resize_screen(args[0], args[1], args[2]);
}

__attribute__((export_name("move_handle"))) uint32_t pdk_move_handle(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[3] = {0};
  if (parse_i32_list(input, input_len, args, 3) != 3) {
    const char msg[] = "expected: handle_index,x,y";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_move_handle(args[0], args[1], args[2]);
}

__attribute__((export_name("move_corner"))) uint32_t pdk_move_corner(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[4] = {0};
  if (parse_i32_list(input, input_len, args, 4) != 4) {
    const char msg[] = "expected: area_index,corner_index,x,y";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_move_corner(args[0], args[1], args[2], args[3]);
}

__attribute__((export_name("try_corner"))) uint32_t pdk_try_corner(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[4] = {0};
  if (parse_i32_list(input, input_len, args, 4) != 4) {
    const char msg[] = "expected: area_index,corner_index,x,y";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_try_corner(args[0], args[1], args[2], args[3]);
}

__attribute__((export_name("set_area_content"))) uint32_t pdk_set_area_content(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[2] = {0};
  if (parse_i32_list(input, input_len, args, 2) != 2) {
    const char msg[] = "expected: area_index,content_id";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_set_area_content(args[0], args[1]);
}

__attribute__((export_name("set_handle_content"))) uint32_t pdk_set_handle_content(void) {
  uint32_t input_len = 0;
  const uint8_t *input = pdk_input(&input_len);
  layout_i32 args[2] = {0};
  if (parse_i32_list(input, input_len, args, 2) != 2) {
    const char msg[] = "expected: handle_index,content_id";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_INVALID_ARG;
  }
  return (uint32_t)layout_core_set_handle_content(args[0], args[1]);
}

__attribute__((export_name("get_info_ptr"))) uint32_t pdk_get_info_ptr(void) {
  output_i32(layout_core_get_info_ptr());
  return 0;
}

__attribute__((export_name("snapshot"))) uint32_t pdk_snapshot(void) {
  layout_i32 ptr = layout_core_get_info_ptr();
  if (ptr <= 0) {
    const char msg[] = "layout not initialized";
    pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
    return LAYOUT_ERR_NOT_INITIALIZED;
  }
  pdk_output((const uint8_t *)(uintptr_t)ptr, (uint32_t)sizeof(LayoutInfo));
  return 0;
}

__attribute__((export_name("get_info_size"))) uint32_t pdk_get_info_size(void) {
  output_i32((layout_i32)sizeof(LayoutInfo));
  return 0;
}

__attribute__((export_name("info"))) uint32_t info(void) {
  const char msg[] = "layout2 plugin: PDK singleton wrapper around layout geometry engine";
  pdk_output((const uint8_t *)msg, sizeof(msg) - 1);
  return 0;
}
