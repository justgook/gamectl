#ifndef GAME_ASSET_IO_H
#define GAME_ASSET_IO_H

#include <stddef.h>
#include <stdint.h>

int game_asset_read_all(const char *path, uint8_t **out_data, size_t *out_len);
void game_asset_free(void *data);

#endif
