#include "respack_plugin.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

extern uint32_t respack_core_init(const uint8_t *ptr, uintptr_t len);
extern uint32_t respack_core_write(uint32_t slot, const uint8_t *ptr, uintptr_t len);
extern uint32_t respack_core_dump(void);
extern uint32_t respack_core_generate_odin(void);
extern const uint8_t *respack_core_output_ptr(void);
extern uintptr_t respack_core_output_len(void);

static void set_string_from_core(respack_plugin_string_t *ret) {
  uintptr_t len = respack_core_output_len();
  const uint8_t *ptr = respack_core_output_ptr();
  respack_plugin_string_dup_n(ret, (const char *)ptr, (size_t)len);
}

static void set_list_from_core(respack_plugin_list_u8_t *ret) {
  uintptr_t len = respack_core_output_len();
  const uint8_t *ptr = respack_core_output_ptr();
  ret->len = (size_t)len;
  if (len == 0) {
    ret->ptr = NULL;
    return;
  }
  ret->ptr = (uint8_t *)malloc((size_t)len);
  memcpy(ret->ptr, ptr, (size_t)len);
}

bool exports_gams_respack_respack_init(respack_plugin_list_u8_t *schema, respack_plugin_string_t *ret, respack_plugin_string_t *err) {
  uint32_t status = respack_core_init(schema->ptr, (uintptr_t)schema->len);
  if (status != 0) {
    set_string_from_core(err);
    return false;
  }
  set_string_from_core(ret);
  return true;
}

bool exports_gams_respack_respack_write(uint32_t slot, respack_plugin_list_u8_t *payload, respack_plugin_string_t *ret, respack_plugin_string_t *err) {
  uint32_t status = respack_core_write(slot, payload->ptr, (uintptr_t)payload->len);
  if (status != 0) {
    set_string_from_core(err);
    return false;
  }
  set_string_from_core(ret);
  return true;
}

bool exports_gams_respack_respack_dump(respack_plugin_list_u8_t *ret, respack_plugin_string_t *err) {
  uint32_t status = respack_core_dump();
  if (status != 0) {
    set_string_from_core(err);
    return false;
  }
  set_list_from_core(ret);
  return true;
}

bool exports_gams_respack_respack_generate_odin(respack_plugin_string_t *ret, respack_plugin_string_t *err) {
  uint32_t status = respack_core_generate_odin();
  if (status != 0) {
    set_string_from_core(err);
    return false;
  }
  set_string_from_core(ret);
  return true;
}
