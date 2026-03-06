#include "../asset_io.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

__attribute__((import_module("env"), import_name("game_asset_size"))) int
js_game_asset_size(uint32_t path_ptr, uint32_t path_len);

__attribute__((import_module("env"), import_name("game_asset_read"))) int
js_game_asset_read(uint32_t path_ptr, uint32_t path_len, uint32_t dst_ptr,
                   uint32_t dst_cap);

int game_asset_read_all(const char *path, uint8_t **out_data, size_t *out_len) {
  size_t path_len;
  int size;
  uint8_t *buf;
  int bytes_read;

  if (!path || !out_data || !out_len) {
    return 0;
  }

  *out_data = NULL;
  *out_len = 0;

  path_len = strlen(path);
  size = js_game_asset_size((uint32_t)(uintptr_t)path, (uint32_t)path_len);
  if (size < 0) {
    return 0;
  }

  if (size == 0) {
    return 1;
  }

  buf = (uint8_t *)malloc((size_t)size);
  if (!buf) {
    return 0;
  }

  bytes_read = js_game_asset_read((uint32_t)(uintptr_t)path, (uint32_t)path_len,
                                  (uint32_t)(uintptr_t)buf, (uint32_t)size);
  if (bytes_read != size) {
    free(buf);
    return 0;
  }

  *out_data = buf;
  *out_len = (size_t)size;
  return 1;
}

void game_asset_free(void *data) {
  if (data) {
    free(data);
  }
}
