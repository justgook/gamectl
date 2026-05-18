#include "respack_plugin.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

extern void respack_core_reset_blobs(void);
extern uint32_t respack_core_add_blob(const uint8_t *id_ptr, uintptr_t id_len, const uint8_t *data_ptr, uintptr_t data_len);
extern uint32_t respack_core_build(const uint8_t *schema_ptr, uintptr_t schema_len, const uint8_t *slots_ptr, uintptr_t slots_len);
extern uint32_t respack_core_generate_odin(const uint8_t *schema_ptr, uintptr_t schema_len);
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

bool exports_gams_respack_respack_generate_odin(respack_plugin_string_t *schema, respack_plugin_string_t *ret, respack_plugin_string_t *err) {
  uint32_t status = respack_core_generate_odin(schema->ptr, (uintptr_t)schema->len);
  if (status != 0) {
    set_string_from_core(err);
    return false;
  }
  set_string_from_core(ret);
  return true;
}

bool exports_gams_respack_respack_build(respack_plugin_string_t *schema, respack_plugin_string_t *slots_json, exports_gams_respack_respack_list_blob_t *blobs, respack_plugin_list_u8_t *ret, respack_plugin_string_t *err) {
  respack_core_reset_blobs();
  for (size_t i = 0; i < blobs->len; i++) {
    exports_gams_respack_respack_blob_t *blob = &blobs->ptr[i];
    uint32_t status = respack_core_add_blob(blob->id.ptr, (uintptr_t)blob->id.len, blob->data.ptr, (uintptr_t)blob->data.len);
    if (status != 0) {
      set_string_from_core(err);
      return false;
    }
  }

  uint32_t status = respack_core_build(schema->ptr, (uintptr_t)schema->len, slots_json->ptr, (uintptr_t)slots_json->len);
  if (status != 0) {
    set_string_from_core(err);
    return false;
  }
  set_list_from_core(ret);
  return true;
}
