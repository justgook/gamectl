#include "fs_proxy.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define READ_CHUNK_SIZE 65536u

static void set_error(fs_proxy_string_t *err, const char *message) {
  fs_proxy_string_dup(err, message);
}

static const char *error_code_name(wasi_filesystem_types_error_code_t code) {
  switch (code) {
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_ACCESS:
    return "access";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_WOULD_BLOCK:
    return "would-block";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_ALREADY:
    return "already";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_BAD_DESCRIPTOR:
    return "bad-descriptor";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_BUSY:
    return "busy";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_DEADLOCK:
    return "deadlock";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_QUOTA:
    return "quota";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_EXIST:
    return "exist";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_FILE_TOO_LARGE:
    return "file-too-large";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_ILLEGAL_BYTE_SEQUENCE:
    return "illegal-byte-sequence";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_IN_PROGRESS:
    return "in-progress";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_INTERRUPTED:
    return "interrupted";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_INVALID:
    return "invalid";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_IO:
    return "io";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_IS_DIRECTORY:
    return "is-directory";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_LOOP:
    return "loop";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_TOO_MANY_LINKS:
    return "too-many-links";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_MESSAGE_SIZE:
    return "message-size";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NAME_TOO_LONG:
    return "name-too-long";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NO_DEVICE:
    return "no-device";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NO_ENTRY:
    return "no-entry";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NO_LOCK:
    return "no-lock";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_INSUFFICIENT_MEMORY:
    return "insufficient-memory";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_INSUFFICIENT_SPACE:
    return "insufficient-space";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NOT_DIRECTORY:
    return "not-directory";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NOT_EMPTY:
    return "not-empty";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NOT_RECOVERABLE:
    return "not-recoverable";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_UNSUPPORTED:
    return "unsupported";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NO_TTY:
    return "no-tty";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NO_SUCH_DEVICE:
    return "no-such-device";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_OVERFLOW:
    return "overflow";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_NOT_PERMITTED:
    return "not-permitted";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_PIPE:
    return "pipe";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_READ_ONLY:
    return "read-only";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_INVALID_SEEK:
    return "invalid-seek";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_TEXT_FILE_BUSY:
    return "text-file-busy";
  case WASI_FILESYSTEM_TYPES_ERROR_CODE_CROSS_DEVICE:
    return "cross-device";
  default:
    return "unknown";
  }
}

static const char *descriptor_type_name(wasi_filesystem_types_descriptor_type_t type) {
  switch (type) {
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_BLOCK_DEVICE:
    return "block-device";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_CHARACTER_DEVICE:
    return "character-device";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_DIRECTORY:
    return "directory";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_FIFO:
    return "fifo";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_SYMBOLIC_LINK:
    return "symbolic-link";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_REGULAR_FILE:
    return "regular-file";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_SOCKET:
    return "socket";
  case WASI_FILESYSTEM_TYPES_DESCRIPTOR_TYPE_UNKNOWN:
  default:
    return "unknown";
  }
}

typedef struct resolved_path_t {
  wasi_filesystem_preopens_list_tuple2_own_descriptor_string_t preopens;
  size_t preopen_index;
  const char *relative_ptr;
  size_t relative_len;
} resolved_path_t;

static bool string_eq(const uint8_t *ptr, size_t len, const char *literal) {
  size_t literal_len = strlen(literal);
  return len == literal_len && memcmp(ptr, literal, len) == 0;
}

static bool preopen_matches_path(const fs_proxy_string_t *preopen_path,
                                 const fs_proxy_string_t *path,
                                 size_t *relative_offset) {
  if (string_eq(preopen_path->ptr, preopen_path->len, "/")) {
    *relative_offset = path->len > 0 && path->ptr[0] == '/' ? 1 : 0;
    return true;
  }

  if (path->len < preopen_path->len) {
    return false;
  }
  if (memcmp(path->ptr, preopen_path->ptr, preopen_path->len) != 0) {
    return false;
  }
  if (path->len == preopen_path->len) {
    *relative_offset = path->len;
    return true;
  }
  if (path->ptr[preopen_path->len] != '/') {
    return false;
  }
  *relative_offset = preopen_path->len + 1;
  return true;
}

static bool resolve_path(fs_proxy_string_t *path, resolved_path_t *resolved,
                         fs_proxy_string_t *err) {
  memset(resolved, 0, sizeof(*resolved));
  wasi_filesystem_preopens_get_directories(&resolved->preopens);

  bool found = false;
  size_t best_len = 0;
  size_t best_relative_offset = 0;

  for (size_t i = 0; i < resolved->preopens.len; i++) {
    fs_proxy_string_t *preopen_path = &resolved->preopens.ptr[i].f1;
    size_t relative_offset = 0;
    if (!preopen_matches_path(preopen_path, path, &relative_offset)) {
      continue;
    }
    if (!found || preopen_path->len > best_len) {
      found = true;
      best_len = preopen_path->len;
      best_relative_offset = relative_offset;
      resolved->preopen_index = i;
    }
  }

  if (!found) {
    wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&resolved->preopens);
    set_error(err, "path is not under a WASI preopen");
    return false;
  }

  resolved->relative_ptr = (const char *)path->ptr + best_relative_offset;
  resolved->relative_len = path->len - best_relative_offset;
  return true;
}

static void resolved_path_free(resolved_path_t *resolved) {
  wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&resolved->preopens);
  memset(resolved, 0, sizeof(*resolved));
}

static bool open_resolved_path(resolved_path_t *resolved,
                               wasi_filesystem_types_descriptor_flags_t flags,
                               wasi_filesystem_types_own_descriptor_t *ret,
                               bool *ret_is_preopen, fs_proxy_string_t *err) {
  wasi_filesystem_types_borrow_descriptor_t base = wasi_filesystem_types_borrow_descriptor(
      resolved->preopens.ptr[resolved->preopen_index].f0);

  if (resolved->relative_len == 0) {
    *ret = resolved->preopens.ptr[resolved->preopen_index].f0;
    *ret_is_preopen = true;
    return true;
  }

  fs_proxy_string_t relative = {
      .ptr = (uint8_t *)resolved->relative_ptr,
      .len = resolved->relative_len,
  };
  wasi_filesystem_types_error_code_t code = 0;
  bool ok = wasi_filesystem_types_method_descriptor_open_at(
      base, 0, &relative, 0, flags, ret, &code);
  if (!ok) {
    set_error(err, error_code_name(code));
    return false;
  }
  *ret_is_preopen = false;
  return true;
}

static bool append_bytes(fs_proxy_list_u8_t *buffer, fs_proxy_list_u8_t *chunk) {
  if (chunk->len == 0) {
    return true;
  }
  if (buffer->len > SIZE_MAX - chunk->len) {
    return false;
  }
  uint8_t *next = realloc(buffer->ptr, buffer->len + chunk->len);
  if (!next) {
    return false;
  }
  memcpy(next + buffer->len, chunk->ptr, chunk->len);
  buffer->ptr = next;
  buffer->len += chunk->len;
  return true;
}

bool exports_gams_fs_fs_read_file(fs_proxy_string_t *path, fs_proxy_list_u8_t *ret,
                                  fs_proxy_string_t *err) {
  ret->ptr = NULL;
  ret->len = 0;

  resolved_path_t resolved;
  if (!resolve_path(path, &resolved, err)) {
    return false;
  }

  wasi_filesystem_types_own_descriptor_t file;
  bool file_is_preopen = false;
  if (!open_resolved_path(&resolved, WASI_FILESYSTEM_TYPES_DESCRIPTOR_FLAGS_READ,
                          &file, &file_is_preopen, err)) {
    resolved_path_free(&resolved);
    return false;
  }

  wasi_filesystem_types_borrow_descriptor_t borrowed = wasi_filesystem_types_borrow_descriptor(file);
  uint64_t offset = 0;
  bool eof = false;

  while (!eof) {
    fs_proxy_tuple2_list_u8_bool_t chunk;
    wasi_filesystem_types_error_code_t code = 0;
    bool ok = wasi_filesystem_types_method_descriptor_read(
        borrowed, READ_CHUNK_SIZE, offset, &chunk, &code);
    if (!ok) {
      if (!file_is_preopen) {
        wasi_filesystem_types_descriptor_drop_own(file);
      }
      resolved_path_free(&resolved);
      free(ret->ptr);
      ret->ptr = NULL;
      ret->len = 0;
      set_error(err, error_code_name(code));
      return false;
    }

    if (!append_bytes(ret, &chunk.f0)) {
      fs_proxy_list_u8_free(&chunk.f0);
      if (!file_is_preopen) {
        wasi_filesystem_types_descriptor_drop_own(file);
      }
      resolved_path_free(&resolved);
      free(ret->ptr);
      ret->ptr = NULL;
      ret->len = 0;
      set_error(err, "out-of-memory");
      return false;
    }

    offset += chunk.f0.len;
    eof = chunk.f1;
    fs_proxy_list_u8_free(&chunk.f0);
  }

  if (!file_is_preopen) {
    wasi_filesystem_types_descriptor_drop_own(file);
  }
  resolved_path_free(&resolved);
  return true;
}

bool exports_gams_fs_fs_read_text(fs_proxy_string_t *path, fs_proxy_string_t *ret,
                                  fs_proxy_string_t *err) {
  fs_proxy_list_u8_t bytes;
  if (!exports_gams_fs_fs_read_file(path, &bytes, err)) {
    return false;
  }

  ret->len = bytes.len;
  ret->ptr = bytes.ptr;
  return true;
}

bool exports_gams_fs_fs_list(fs_proxy_string_t *path,
                             exports_gams_fs_fs_list_dir_entry_t *ret,
                             fs_proxy_string_t *err) {
  ret->ptr = NULL;
  ret->len = 0;

  resolved_path_t resolved;
  if (!resolve_path(path, &resolved, err)) {
    return false;
  }

  wasi_filesystem_types_own_descriptor_t directory;
  bool directory_is_preopen = false;
  if (!open_resolved_path(&resolved, WASI_FILESYSTEM_TYPES_DESCRIPTOR_FLAGS_READ,
                          &directory, &directory_is_preopen, err)) {
    resolved_path_free(&resolved);
    return false;
  }

  wasi_filesystem_types_own_directory_entry_stream_t stream;
  wasi_filesystem_types_error_code_t code = 0;
  bool ok = wasi_filesystem_types_method_descriptor_read_directory(
      wasi_filesystem_types_borrow_descriptor(directory), &stream, &code);
  if (!ok) {
    if (!directory_is_preopen) {
      wasi_filesystem_types_descriptor_drop_own(directory);
    }
    resolved_path_free(&resolved);
    set_error(err, error_code_name(code));
    return false;
  }

  while (true) {
    wasi_filesystem_types_option_directory_entry_t entry;
    code = 0;
    ok = wasi_filesystem_types_method_directory_entry_stream_read_directory_entry(
        wasi_filesystem_types_borrow_directory_entry_stream(stream), &entry, &code);
    if (!ok) {
      wasi_filesystem_types_directory_entry_stream_drop_own(stream);
      if (!directory_is_preopen) {
        wasi_filesystem_types_descriptor_drop_own(directory);
      }
      resolved_path_free(&resolved);
      exports_gams_fs_fs_list_dir_entry_free(ret);
      ret->ptr = NULL;
      ret->len = 0;
      set_error(err, error_code_name(code));
      return false;
    }

    if (!entry.is_some) {
      break;
    }

    if (ret->len == SIZE_MAX / sizeof(exports_gams_fs_fs_dir_entry_t)) {
      wasi_filesystem_types_option_directory_entry_free(&entry);
      wasi_filesystem_types_directory_entry_stream_drop_own(stream);
      if (!directory_is_preopen) {
        wasi_filesystem_types_descriptor_drop_own(directory);
      }
      resolved_path_free(&resolved);
      exports_gams_fs_fs_list_dir_entry_free(ret);
      ret->ptr = NULL;
      ret->len = 0;
      set_error(err, "out-of-memory");
      return false;
    }

    exports_gams_fs_fs_dir_entry_t *next = realloc(
        ret->ptr, (ret->len + 1) * sizeof(exports_gams_fs_fs_dir_entry_t));
    if (!next) {
      wasi_filesystem_types_option_directory_entry_free(&entry);
      wasi_filesystem_types_directory_entry_stream_drop_own(stream);
      if (!directory_is_preopen) {
        wasi_filesystem_types_descriptor_drop_own(directory);
      }
      resolved_path_free(&resolved);
      exports_gams_fs_fs_list_dir_entry_free(ret);
      ret->ptr = NULL;
      ret->len = 0;
      set_error(err, "out-of-memory");
      return false;
    }

    ret->ptr = next;
    exports_gams_fs_fs_dir_entry_t *out = &ret->ptr[ret->len];
    fs_proxy_string_dup_n(&out->name, (const char *)entry.val.name.ptr, entry.val.name.len);
    fs_proxy_string_dup(&out->type, descriptor_type_name(entry.val.type));
    ret->len += 1;

    wasi_filesystem_types_option_directory_entry_free(&entry);
  }

  wasi_filesystem_types_directory_entry_stream_drop_own(stream);
  if (!directory_is_preopen) {
    wasi_filesystem_types_descriptor_drop_own(directory);
  }
  resolved_path_free(&resolved);
  return true;
}
