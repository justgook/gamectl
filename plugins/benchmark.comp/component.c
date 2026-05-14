#include "benchmark_plugin.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static void copy_string(benchmark_plugin_string_t *ret, const benchmark_plugin_string_t *value) {
  benchmark_plugin_string_dup_n(ret, (const char *)value->ptr, value->len);
}

static void set_string(benchmark_plugin_string_t *ret, const char *value) {
  benchmark_plugin_string_dup(ret, value);
}

static void set_error(benchmark_plugin_string_t *err, const char *message) {
  set_string(err, message);
}

static void set_error_code(benchmark_plugin_string_t *err, const char *prefix,
                           wasi_filesystem_types_error_code_t code) {
  char buffer[128];
  snprintf(buffer, sizeof(buffer), "%s: wasi error code %u", prefix, (unsigned)code);
  set_string(err, buffer);
}

static const char *trim_leading_slash(const benchmark_plugin_string_t *path, size_t *len) {
  const char *ptr = (const char *)path->ptr;
  *len = path->len;
  while (*len > 0 && *ptr == '/') {
    ptr++;
    (*len)--;
  }
  return ptr;
}

bool exports_gams_benchmark_benchmark_echo_bool(bool value) { return value; }
int8_t exports_gams_benchmark_benchmark_echo_s8(int8_t value) { return value; }
uint8_t exports_gams_benchmark_benchmark_echo_u8(uint8_t value) { return value; }
int16_t exports_gams_benchmark_benchmark_echo_s16(int16_t value) { return value; }
uint16_t exports_gams_benchmark_benchmark_echo_u16(uint16_t value) { return value; }
int32_t exports_gams_benchmark_benchmark_echo_s32(int32_t value) { return value; }
uint32_t exports_gams_benchmark_benchmark_echo_u32(uint32_t value) { return value; }
int64_t exports_gams_benchmark_benchmark_echo_s64(int64_t value) { return value; }
uint64_t exports_gams_benchmark_benchmark_echo_u64(uint64_t value) { return value; }
float exports_gams_benchmark_benchmark_echo_f32(float value) { return value; }
double exports_gams_benchmark_benchmark_echo_f64(double value) { return value; }
uint32_t exports_gams_benchmark_benchmark_echo_char(uint32_t value) { return value; }
exports_gams_benchmark_benchmark_sample_enum_t exports_gams_benchmark_benchmark_echo_enum(exports_gams_benchmark_benchmark_sample_enum_t value) { return value; }
exports_gams_benchmark_benchmark_sample_flags_t exports_gams_benchmark_benchmark_echo_flags(exports_gams_benchmark_benchmark_sample_flags_t value) { return value; }

void exports_gams_benchmark_benchmark_echo_string(benchmark_plugin_string_t *value,
                                                  benchmark_plugin_string_t *ret) {
  copy_string(ret, value);
}

void exports_gams_benchmark_benchmark_echo_list_u8(benchmark_plugin_list_u8_t *value,
                                                   benchmark_plugin_list_u8_t *ret) {
  ret->len = value->len;
  ret->ptr = NULL;
  if (value->len > 0) {
    ret->ptr = malloc(value->len);
    memcpy(ret->ptr, value->ptr, value->len);
  }
}

void exports_gams_benchmark_benchmark_echo_list_string(benchmark_plugin_list_string_t *value,
                                                       benchmark_plugin_list_string_t *ret) {
  ret->len = value->len;
  ret->ptr = NULL;
  if (value->len == 0) return;
  ret->ptr = calloc(value->len, sizeof(benchmark_plugin_string_t));
  for (size_t i = 0; i < value->len; i++) {
    copy_string(&ret->ptr[i], &value->ptr[i]);
  }
}

void exports_gams_benchmark_benchmark_echo_record(exports_gams_benchmark_benchmark_sample_record_t *value,
                                                  exports_gams_benchmark_benchmark_sample_record_t *ret) {
  copy_string(&ret->name, &value->name);
  ret->count = value->count;
  ret->enabled = value->enabled;
}

void exports_gams_benchmark_benchmark_echo_tuple(benchmark_plugin_tuple3_string_u32_bool_t *value,
                                                 benchmark_plugin_tuple3_string_u32_bool_t *ret) {
  copy_string(&ret->f0, &value->f0);
  ret->f1 = value->f1;
  ret->f2 = value->f2;
}

bool exports_gams_benchmark_benchmark_echo_option(benchmark_plugin_string_t *maybe_value,
                                                  benchmark_plugin_string_t *ret) {
  if (maybe_value == NULL) return false;
  copy_string(ret, maybe_value);
  return true;
}

bool exports_gams_benchmark_benchmark_echo_result(exports_gams_benchmark_benchmark_result_u32_string_t *value,
                                                  uint32_t *ret,
                                                  benchmark_plugin_string_t *err) {
  if (value->is_err) {
    copy_string(err, &value->val.err);
    return false;
  }
  *ret = value->val.ok;
  return true;
}

void exports_gams_benchmark_benchmark_echo_variant(exports_gams_benchmark_benchmark_sample_variant_t *value,
                                                   exports_gams_benchmark_benchmark_sample_variant_t *ret) {
  ret->tag = value->tag;
  switch (value->tag) {
  case EXPORTS_GAMS_BENCHMARK_BENCHMARK_SAMPLE_VARIANT_TEXT:
    copy_string(&ret->val.text, &value->val.text);
    break;
  case EXPORTS_GAMS_BENCHMARK_BENCHMARK_SAMPLE_VARIANT_NUMBER:
    ret->val.number = value->val.number;
    break;
  case EXPORTS_GAMS_BENCHMARK_BENCHMARK_SAMPLE_VARIANT_NONE:
  default:
    break;
  }
}

bool exports_gams_benchmark_benchmark_call_runtime_view(benchmark_plugin_string_t *target,
                                                        benchmark_plugin_string_t *args,
                                                        benchmark_plugin_string_t *ret,
                                                        benchmark_plugin_string_t *err) {
  return gams_runtime_runtime_call(target, args, ret, err);
}

bool exports_gams_benchmark_benchmark_check_wasi_filesystem(benchmark_plugin_string_t *path,
                                                            exports_gams_benchmark_benchmark_fs_report_t *ret,
                                                            benchmark_plugin_string_t *err) {
  memset(ret, 0, sizeof(*ret));

  wasi_filesystem_preopens_list_tuple2_own_descriptor_string_t preopens;
  wasi_filesystem_preopens_get_directories(&preopens);
  ret->preopen_count = (uint32_t)preopens.len;
  if (preopens.len == 0) {
    set_error(err, "no wasi filesystem preopens");
    return false;
  }
  copy_string(&ret->first_preopen, &preopens.ptr[0].f1);

  wasi_filesystem_types_borrow_descriptor_t root =
      wasi_filesystem_types_borrow_descriptor(preopens.ptr[0].f0);

  size_t relative_len = 0;
  const char *relative_ptr = trim_leading_slash(path, &relative_len);
  benchmark_plugin_string_t relative = {
      .ptr = (uint8_t *)relative_ptr,
      .len = relative_len,
  };

  wasi_filesystem_types_error_code_t code = 0;
  wasi_filesystem_types_descriptor_stat_t stat;
  bool dir_is_preopen = relative_len == 0;
  if (dir_is_preopen) {
    memset(&stat, 0, sizeof(stat));
    stat.type = WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_DIRECTORY;
  } else if (!wasi_filesystem_types_method_descriptor_stat_at(root, 0, &relative, &stat, &code)) {
    wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);
    set_error_code(err, "stat-at failed", code);
    return false;
  }

  wasi_filesystem_types_own_descriptor_t dir;
  if (dir_is_preopen) {
    dir = preopens.ptr[0].f0;
  } else {
    if (stat.type != WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_DIRECTORY) {
      ret->entry_count = 0;
      ret->first_entry.is_some = false;
      wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);
      return true;
    }
    if (!wasi_filesystem_types_method_descriptor_open_at(
            root, 0, &relative, WASI_FILESYSTEM_TYPES_OPEN_FLAGS_DIRECTORY,
            WASI_FILESYSTEM_TYPES_DESCRIPTOR_FLAGS_READ, &dir, &code)) {
      wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);
      set_error_code(err, "open-at directory failed", code);
      return false;
    }
  }

  wasi_filesystem_types_borrow_descriptor_t borrowed_dir =
      wasi_filesystem_types_borrow_descriptor(dir);
  wasi_filesystem_types_own_directory_entry_stream_t stream;
  if (!wasi_filesystem_types_method_descriptor_read_directory(borrowed_dir, &stream, &code)) {
    if (!dir_is_preopen) wasi_filesystem_types_descriptor_drop_own(dir);
    wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);
    set_error_code(err, "read-directory failed", code);
    return false;
  }

  wasi_filesystem_types_borrow_directory_entry_stream_t borrowed_stream =
      wasi_filesystem_types_borrow_directory_entry_stream(stream);
  for (;;) {
    wasi_filesystem_types_option_directory_entry_t entry;
    if (!wasi_filesystem_types_method_directory_entry_stream_read_directory_entry(
            borrowed_stream, &entry, &code)) {
      wasi_filesystem_types_directory_entry_stream_drop_own(stream);
      if (!dir_is_preopen) wasi_filesystem_types_descriptor_drop_own(dir);
      wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);
      set_error_code(err, "read-directory-entry failed", code);
      return false;
    }
    if (!entry.is_some) break;
    if (ret->entry_count == 0) {
      ret->first_entry.is_some = true;
      copy_string(&ret->first_entry.val, &entry.val.name);
    }
    ret->entry_count++;
    wasi_filesystem_types_directory_entry_free(&entry.val);
  }

  wasi_filesystem_types_directory_entry_stream_drop_own(stream);
  if (!dir_is_preopen) wasi_filesystem_types_descriptor_drop_own(dir);
  wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);
  return true;
}
