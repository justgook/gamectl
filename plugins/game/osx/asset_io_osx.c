#include "../asset_io.h"

#include <stdio.h>
#include <stdlib.h>

int game_asset_read_all(const char *path, uint8_t **out_data, size_t *out_len) {
  FILE *f;
  long file_size;
  uint8_t *buf;
  size_t bytes_read;

  if (!path || !out_data || !out_len) {
    return 0;
  }

  *out_data = NULL;
  *out_len = 0;

  f = fopen(path, "rb");
  if (!f) {
    return 0;
  }

  if (fseek(f, 0, SEEK_END) != 0) {
    fclose(f);
    return 0;
  }

  file_size = ftell(f);
  if (file_size < 0) {
    fclose(f);
    return 0;
  }

  if (fseek(f, 0, SEEK_SET) != 0) {
    fclose(f);
    return 0;
  }

  if (file_size == 0) {
    fclose(f);
    return 1;
  }

  buf = (uint8_t *)malloc((size_t)file_size);
  if (!buf) {
    fclose(f);
    return 0;
  }

  bytes_read = fread(buf, 1, (size_t)file_size, f);
  fclose(f);

  if (bytes_read != (size_t)file_size) {
    free(buf);
    return 0;
  }

  *out_data = buf;
  *out_len = bytes_read;
  return 1;
}

void game_asset_free(void *data) {
  if (data) {
    free(data);
  }
}
