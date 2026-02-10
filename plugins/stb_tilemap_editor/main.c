#include "pdk.h"
// Simple utility functions for number parsing and formatting
static uint32_t parse_uint32(const uint8_t *str, uint32_t len) {
  uint32_t result = 0;
  for (uint32_t i = 0; i < len; i++) {
    if (str[i] >= '0' && str[i] <= '9') {
      result = result * 10 + (str[i] - '0');
    } else {
      break;
    }
  }
  return result;
}

static uint32_t uint32_to_str(uint32_t value, char *buffer) {
  if (value == 0) {
    buffer[0] = '0';
    return 1;
  }

  uint32_t len = 0;
  uint32_t temp = value;
  while (temp > 0) {
    temp /= 10;
    len++;
  }

  for (uint32_t i = len; i > 0; i--) {
    buffer[i - 1] = '0' + (value % 10);
    value /= 10;
  }

  return len;
}

// Simple function to find a value after a key in input like "a=5,b=3"
static uint32_t find_value_after_key(const uint8_t *input, uint32_t input_len,
                                     char key) {
  for (uint32_t i = 0; i < input_len - 2; i++) {
    if (input[i] == key && input[i + 1] == '=') {
      uint32_t start = i + 2;
      uint32_t end = start;
      while (end < input_len && input[end] >= '0' && input[end] <= '9') {
        end++;
      }
      return parse_uint32(input + start, end - start);
    }
  }
  return 0;
}
__attribute__((export_name("add"))) uint32_t add_numbers(void) {
  uint32_t input_len;
  const uint8_t *input = pdk_input(&input_len);

  // Parse input
  uint32_t a = find_value_after_key(input, input_len, 'a');
  uint32_t b = find_value_after_key(input, input_len, 'b');

  // Calculate result
  uint32_t result = a + b;

  // Format output
  char output_buffer[32];
  uint32_t output_len = uint32_to_str(result, output_buffer);

  pdk_output((const uint8_t *)output_buffer, output_len);
  return 0;
}
