#include "director_compiler_plugin.h"

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>

extern uint32_t director_compiler_core_compile(const uint8_t *source_ptr, uintptr_t source_len);
extern const uint8_t *director_compiler_core_output_ptr(void);
extern uintptr_t director_compiler_core_output_len(void);
extern uintptr_t director_compiler_core_diagnostic_count(void);
extern const uint8_t *director_compiler_core_diagnostic_code_ptr(uintptr_t index);
extern uintptr_t director_compiler_core_diagnostic_code_len(uintptr_t index);
extern const uint8_t *director_compiler_core_diagnostic_message_ptr(uintptr_t index);
extern uintptr_t director_compiler_core_diagnostic_message_len(uintptr_t index);
extern uint32_t director_compiler_core_diagnostic_start_byte(uintptr_t index);
extern uint32_t director_compiler_core_diagnostic_start_line(uintptr_t index);
extern uint32_t director_compiler_core_diagnostic_start_column(uintptr_t index);
extern uint32_t director_compiler_core_diagnostic_end_byte(uintptr_t index);
extern uint32_t director_compiler_core_diagnostic_end_line(uintptr_t index);
extern uint32_t director_compiler_core_diagnostic_end_column(uintptr_t index);

static void set_diagnostics(
    exports_gams_director_compiler_director_compiler_list_diagnostic_t *err) {
  uintptr_t count = director_compiler_core_diagnostic_count();
  err->len = (size_t)count;
  err->ptr = calloc((size_t)count, sizeof(*err->ptr));
  if (count > 0 && err->ptr == NULL) {
    abort();
  }

  for (uintptr_t i = 0; i < count; i += 1) {
    exports_gams_director_compiler_director_compiler_diagnostic_t *diagnostic = &err->ptr[i];
    director_compiler_plugin_string_dup_n(
        &diagnostic->code,
        (const char *)director_compiler_core_diagnostic_code_ptr(i),
        (size_t)director_compiler_core_diagnostic_code_len(i));
    director_compiler_plugin_string_dup_n(
        &diagnostic->message,
        (const char *)director_compiler_core_diagnostic_message_ptr(i),
        (size_t)director_compiler_core_diagnostic_message_len(i));
    diagnostic->span.start.byte_offset = director_compiler_core_diagnostic_start_byte(i);
    diagnostic->span.start.line = director_compiler_core_diagnostic_start_line(i);
    diagnostic->span.start.column = director_compiler_core_diagnostic_start_column(i);
    diagnostic->span.end.byte_offset = director_compiler_core_diagnostic_end_byte(i);
    diagnostic->span.end.line = director_compiler_core_diagnostic_end_line(i);
    diagnostic->span.end.column = director_compiler_core_diagnostic_end_column(i);
  }
}

bool exports_gams_director_compiler_director_compiler_compile(
    director_compiler_plugin_string_t *source,
    director_compiler_plugin_string_t *ret,
    exports_gams_director_compiler_director_compiler_list_diagnostic_t *err) {
  uint32_t status = director_compiler_core_compile(
      (const uint8_t *)source->ptr,
      (uintptr_t)source->len);
  if (status != 0) {
    set_diagnostics(err);
    return false;
  }

  director_compiler_plugin_string_dup_n(
      ret,
      (const char *)director_compiler_core_output_ptr(),
      (size_t)director_compiler_core_output_len());
  return true;
}
