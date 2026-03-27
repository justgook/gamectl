/* ==========================================================================
 * stb_tilemap_editor Headless WASM API - Minimal
 *
 * Exports only action functions. All state accessed via memory pointers.
 * Host provides memory import. No names passed - work with indexes only.
 *
 * Build: zig build-exe main.c -target wasm32-freestanding -fno-entry
 *        -rdynamic -O ReleaseFast -femit-bin=stb_tilemap_editor.wasm
 * ==========================================================================
 */

#include <stddef.h>
#include <stdint.h>

/* ==========================================================================
 * 1. FREESTANDING LIBC STUBS (internal use only)
 * ========================================================================== */

static uint8_t heap_storage[16 * 1024 * 1024] __attribute__((aligned(16)));
static uint32_t heap_offset = 0;

static void *malloc_internal(size_t size) {
  uint32_t aligned = (heap_offset + 15) & ~15u;
  if (aligned + size > sizeof(heap_storage))
    return (void *)0;
  void *ptr = &heap_storage[aligned];
  heap_offset = aligned + (uint32_t)size;
  return ptr;
}

static void free_internal(void *ptr) { (void)ptr; }

static void *memset(void *dest, int c, size_t n) {
  uint8_t *d = (uint8_t *)dest;
  for (size_t i = 0; i < n; i++)
    d[i] = (uint8_t)c;
  return dest;
}

static void *memcpy(void *dest, const void *src, size_t n) {
  uint8_t *d = (uint8_t *)dest;
  const uint8_t *s = (const uint8_t *)src;
  for (size_t i = 0; i < n; i++)
    d[i] = s[i];
  return dest;
}

static size_t strlen(const char *s) {
  size_t len = 0;
  while (s[len])
    len++;
  return len;
}

#define STBTE_ASSERT(x) ((void)0)
#define assert(x) ((void)0)

/* ==========================================================================
 * 2. STB TILEMAP EDITOR CONFIGURATION
 * ========================================================================== */

// Disable properties and links
#define STBTE_MAX_PROPERTIES 0
#undef STBTE_ALLOW_LINK

// Reduced sizes for smaller WASM - adjust as needed
#ifndef STBTE_MAX_TILEMAP_X
#define STBTE_MAX_TILEMAP_X 256
#endif

#ifndef STBTE_MAX_TILEMAP_Y
#define STBTE_MAX_TILEMAP_Y 256
#endif

#ifndef STBTE_MAX_LAYERS
#define STBTE_MAX_LAYERS 8
#endif

#ifndef STBTE_MAX_CATEGORIES
#define STBTE_MAX_CATEGORIES 16
#endif

#ifndef STBTE_UNDO_BUFFER_BYTES
#define STBTE_UNDO_BUFFER_BYTES (1 << 18) // 256KB
#endif

#ifndef STBTE_MAX_COPY
#define STBTE_MAX_COPY 4096
#endif

#ifdef _WIN32
#undef _WIN32
#endif

// Redirect malloc/free to our internal versions
#define malloc malloc_internal
#define free free_internal

#define STB_TILEMAP_EDITOR_IMPLEMENTATION
#include "stb_tilemap_editor.h"

/* ==========================================================================
 * 3. EXPORTED API - ACTION FUNCTIONS ONLY
 * ========================================================================== */

// Tool constants (exposed to JS frontend)
#define STBTE_TOOL_SELECT 0
#define STBTE_TOOL_BRUSH 1
#define STBTE_TOOL_ERASE 2
#define STBTE_TOOL_EYEDROPPER 3
#define STBTE_TOOL_PASTE 4

#define STBTE__tool_paste STBTE__num_tool

#define STBTE_STATUS_OK 1
#define STBTE_STATUS_ERR 0

#define STBTE_CHUNK_EXPORT_VERSION 1u

typedef struct stbte_chunk_export_header {
  uint32_t version;
  uint32_t map_width;
  uint32_t map_height;
  uint32_t layer_count;
  uint32_t chunk_size;
  uint32_t chunk_count;
  uint32_t chunk_data_ptr;
} stbte_chunk_export_header;

typedef struct stbte_logical_store {
  uint32_t map_width;
  uint32_t map_height;
  uint32_t layer_count;
  uint32_t capacity_bytes;
  uint32_t has_selection;
  uint32_t select_x0;
  uint32_t select_y0;
  uint32_t select_x1;
  uint32_t select_y1;
  uint32_t clipboard_width;
  uint32_t clipboard_height;
  uint32_t clipboard_capacity_bytes;
  uint32_t has_clipboard;
  uint32_t undo_origin_x;
  uint32_t undo_origin_y;
  uint32_t undo_width;
  uint32_t undo_height;
  uint32_t undo_capacity_bytes;
  uint32_t has_undo;
  uint32_t redo_origin_x;
  uint32_t redo_origin_y;
  uint32_t redo_width;
  uint32_t redo_height;
  uint32_t redo_capacity_bytes;
  uint32_t has_redo;
  uint16_t *data;
  uint16_t *clipboard_data;
  uint16_t *undo_data;
  uint16_t *redo_data;
} stbte_logical_store;

static uint64_t stbte_logical_clipboard_required_bytes(uint32_t width,
                                                       uint32_t height,
                                                       uint32_t layer_count) {
  return (uint64_t)width * (uint64_t)height * (uint64_t)layer_count *
         (uint64_t)sizeof(uint16_t);
}

static int stbte_logical_ensure_clipboard_capacity(stbte_logical_store *store,
                                                   uint32_t width,
                                                   uint32_t height) {
  uint64_t required;
  uint16_t *next_data;

  if (store == NULL || width == 0 || height == 0 || store->layer_count == 0)
    return STBTE_STATUS_ERR;

  required =
      stbte_logical_clipboard_required_bytes(width, height, store->layer_count);
  if (required == 0 || required > 0xffffffffu)
    return STBTE_STATUS_ERR;
  if (store->clipboard_data != NULL &&
      store->clipboard_capacity_bytes >= required)
    return STBTE_STATUS_OK;

  next_data = (uint16_t *)malloc_internal((size_t)required);
  if (next_data == NULL)
    return STBTE_STATUS_ERR;
  store->clipboard_data = next_data;
  store->clipboard_capacity_bytes = (uint32_t)required;
  return STBTE_STATUS_OK;
}

static int stbte_logical_ensure_region_capacity(uint16_t **buffer,
                                                uint32_t *capacity_bytes,
                                                uint32_t width, uint32_t height,
                                                uint32_t layer_count) {
  uint64_t required;
  uint16_t *next_data;

  if (buffer == NULL || capacity_bytes == NULL || width == 0 || height == 0 ||
      layer_count == 0)
    return STBTE_STATUS_ERR;

  required = stbte_logical_clipboard_required_bytes(width, height, layer_count);
  if (required == 0 || required > 0xffffffffu)
    return STBTE_STATUS_ERR;
  if (*buffer != NULL && *capacity_bytes >= required)
    return STBTE_STATUS_OK;

  next_data = (uint16_t *)malloc_internal((size_t)required);
  if (next_data == NULL)
    return STBTE_STATUS_ERR;
  *buffer = next_data;
  *capacity_bytes = (uint32_t)required;
  return STBTE_STATUS_OK;
}

static void stbte_logical_clamp_selection(stbte_logical_store *store) {
  uint32_t max_x;
  uint32_t max_y;

  if (store == NULL || !store->has_selection)
    return;
  if (store->map_width == 0 || store->map_height == 0) {
    store->has_selection = 0;
    return;
  }

  max_x = store->map_width - 1;
  max_y = store->map_height - 1;
  if (store->select_x0 > max_x)
    store->select_x0 = max_x;
  if (store->select_x1 > max_x)
    store->select_x1 = max_x;
  if (store->select_y0 > max_y)
    store->select_y0 = max_y;
  if (store->select_y1 > max_y)
    store->select_y1 = max_y;
  if (store->select_x0 > store->select_x1) {
    uint32_t swap = store->select_x0;
    store->select_x0 = store->select_x1;
    store->select_x1 = swap;
  }
  if (store->select_y0 > store->select_y1) {
    uint32_t swap = store->select_y0;
    store->select_y0 = store->select_y1;
    store->select_y1 = swap;
  }
}

static void stbte_logical_clear_clipboard(stbte_logical_store *store) {
  if (store == NULL)
    return;
  store->clipboard_width = 0;
  store->clipboard_height = 0;
  store->has_clipboard = 0;
}

static void stbte_logical_clear_history(stbte_logical_store *store) {
  if (store == NULL)
    return;
  store->undo_origin_x = 0;
  store->undo_origin_y = 0;
  store->undo_width = 0;
  store->undo_height = 0;
  store->has_undo = 0;
  store->redo_origin_x = 0;
  store->redo_origin_y = 0;
  store->redo_width = 0;
  store->redo_height = 0;
  store->has_redo = 0;
}

static void stbte_logical_clear_redo(stbte_logical_store *store) {
  if (store == NULL)
    return;
  store->redo_origin_x = 0;
  store->redo_origin_y = 0;
  store->redo_width = 0;
  store->redo_height = 0;
  store->has_redo = 0;
}

static int stbte_logical_copy_region_from_store(stbte_logical_store *store,
                                                uint32_t origin_x,
                                                uint32_t origin_y,
                                                uint32_t width, uint32_t height,
                                                uint16_t *dst) {
  uint32_t layer;
  uint32_t y;
  uint32_t x;
  uint64_t layer_stride;
  uint64_t region_stride;

  if (store == NULL || store->data == NULL || dst == NULL || width == 0 ||
      height == 0)
    return STBTE_STATUS_ERR;

  layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  region_stride = (uint64_t)width * (uint64_t)height;
  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *src_layer = store->data + (layer * layer_stride);
    uint16_t *dst_layer = dst + (layer * region_stride);
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        dst_layer[(y * width) + x] =
            src_layer[((uint64_t)(origin_y + y) * store->map_width) + origin_x +
                      x];
      }
    }
  }
  return STBTE_STATUS_OK;
}

static int stbte_logical_copy_region_to_store(stbte_logical_store *store,
                                              uint32_t origin_x,
                                              uint32_t origin_y, uint32_t width,
                                              uint32_t height,
                                              const uint16_t *src) {
  uint32_t layer;
  uint32_t y;
  uint32_t x;
  uint64_t layer_stride;
  uint64_t region_stride;

  if (store == NULL || store->data == NULL || src == NULL || width == 0 ||
      height == 0)
    return STBTE_STATUS_ERR;

  layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  region_stride = (uint64_t)width * (uint64_t)height;
  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *dst_layer = store->data + (layer * layer_stride);
    const uint16_t *src_layer = src + (layer * region_stride);
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        dst_layer[((uint64_t)(origin_y + y) * store->map_width) + origin_x +
                  x] = src_layer[(y * width) + x];
      }
    }
  }
  return STBTE_STATUS_OK;
}

static int stbte_logical_record_undo_state(stbte_logical_store *store,
                                           uint32_t origin_x, uint32_t origin_y,
                                           uint32_t width, uint32_t height) {
  if (store == NULL || width == 0 || height == 0)
    return STBTE_STATUS_ERR;
  if (!stbte_logical_ensure_region_capacity(&store->undo_data,
                                            &store->undo_capacity_bytes, width,
                                            height, store->layer_count))
    return STBTE_STATUS_ERR;
  if (!stbte_logical_copy_region_from_store(store, origin_x, origin_y, width,
                                            height, store->undo_data))
    return STBTE_STATUS_ERR;
  store->undo_origin_x = origin_x;
  store->undo_origin_y = origin_y;
  store->undo_width = width;
  store->undo_height = height;
  store->has_undo = 1;
  store->has_redo = 0;
  return STBTE_STATUS_OK;
}

static int stbte_logical_capture_redo_state(stbte_logical_store *store,
                                            uint32_t origin_x,
                                            uint32_t origin_y, uint32_t width,
                                            uint32_t height) {
  if (store == NULL || width == 0 || height == 0)
    return STBTE_STATUS_ERR;
  if (!stbte_logical_ensure_region_capacity(&store->redo_data,
                                            &store->redo_capacity_bytes, width,
                                            height, store->layer_count))
    return STBTE_STATUS_ERR;
  if (!stbte_logical_copy_region_from_store(store, origin_x, origin_y, width,
                                            height, store->redo_data))
    return STBTE_STATUS_ERR;
  store->redo_origin_x = origin_x;
  store->redo_origin_y = origin_y;
  store->redo_width = width;
  store->redo_height = height;
  store->has_redo = 1;
  return STBTE_STATUS_OK;
}

static uint64_t stbte_logical_store_required_bytes(uint32_t map_width,
                                                   uint32_t map_height,
                                                   uint32_t layer_count) {
  return (uint64_t)map_width * (uint64_t)map_height * (uint64_t)layer_count *
         (uint64_t)sizeof(uint16_t);
}

static uint32_t stbte_chunk_count_for_map(uint32_t map_width,
                                          uint32_t map_height,
                                          uint32_t chunk_size) {
  uint32_t chunk_cols;
  uint32_t chunk_rows;

  if (map_width == 0 || map_height == 0 || chunk_size == 0)
    return 0;

  chunk_cols = (map_width + chunk_size - 1) / chunk_size;
  chunk_rows = (map_height + chunk_size - 1) / chunk_size;
  return chunk_cols * chunk_rows;
}

static uint16_t *stbte_logical_layer_base(stbte_logical_store *store,
                                          uint32_t layer) {
  uint64_t layer_stride;
  if (store == NULL || store->data == NULL || layer >= store->layer_count)
    return (uint16_t *)0;
  layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  return store->data + (layer * layer_stride);
}

static int stbte_logical_reallocate(stbte_logical_store *store,
                                    uint32_t map_width, uint32_t map_height,
                                    uint32_t layer_count, int inserted_layer,
                                    int deleted_layer, int moved_from,
                                    int moved_to) {
  uint64_t required;
  uint64_t old_layer_stride;
  uint64_t new_layer_stride;
  uint16_t *next_data;
  uint32_t old_layer;

  if (store == NULL || map_width == 0 || map_height == 0 || layer_count == 0)
    return STBTE_STATUS_ERR;

  required =
      stbte_logical_store_required_bytes(map_width, map_height, layer_count);
  if (required == 0 || required > 0xffffffffu)
    return STBTE_STATUS_ERR;

  next_data = (uint16_t *)malloc_internal((size_t)required);
  if (next_data == NULL)
    return STBTE_STATUS_ERR;
  memset(next_data, 0, (size_t)required);

  old_layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  new_layer_stride = (uint64_t)map_width * (uint64_t)map_height;

  for (old_layer = 0; old_layer < store->layer_count; ++old_layer) {
    uint32_t new_layer = old_layer;
    uint32_t copy_width;
    uint32_t copy_height;
    uint32_t y;

    if (inserted_layer >= 0) {
      if ((int)old_layer >= inserted_layer)
        new_layer = old_layer + 1;
    }
    if (deleted_layer >= 0) {
      if ((int)old_layer == deleted_layer)
        continue;
      if ((int)old_layer > deleted_layer)
        new_layer = old_layer - 1;
    }
    if (moved_from >= 0 && moved_to >= 0) {
      if ((int)old_layer == moved_from) {
        new_layer = (uint32_t)moved_to;
      } else if (moved_from < moved_to && (int)old_layer > moved_from &&
                 (int)old_layer <= moved_to) {
        new_layer = old_layer - 1;
      } else if (moved_to < moved_from && (int)old_layer >= moved_to &&
                 (int)old_layer < moved_from) {
        new_layer = old_layer + 1;
      }
    }

    if (new_layer >= layer_count)
      continue;

    copy_width = store->map_width < map_width ? store->map_width : map_width;
    copy_height =
        store->map_height < map_height ? store->map_height : map_height;
    for (y = 0; y < copy_height; ++y) {
      memcpy(next_data + ((uint64_t)new_layer * new_layer_stride) +
                 ((uint64_t)y * map_width),
             store->data + ((uint64_t)old_layer * old_layer_stride) +
                 ((uint64_t)y * store->map_width),
             (size_t)(copy_width * sizeof(uint16_t)));
    }
  }

  store->map_width = map_width;
  store->map_height = map_height;
  store->layer_count = layer_count;
  store->capacity_bytes = (uint32_t)required;
  if (store->has_selection)
    stbte_logical_clamp_selection(store);
  if (store->layer_count != layer_count || inserted_layer >= 0 ||
      deleted_layer >= 0 || moved_from >= 0 || moved_to >= 0)
    stbte_logical_clear_clipboard(store);
  stbte_logical_clear_history(store);
  store->data = next_data;
  return STBTE_STATUS_OK;
}

static uint32_t stbte_chunk_export_header_size_impl(void) {
  return (uint32_t)sizeof(stbte_chunk_export_header);
}

static uint32_t stbte_chunk_export_bytes_per_chunk_impl(stbte_tilemap *tm,
                                                        uint32_t chunk_size) {
  uint64_t tiles_per_layer;
  uint64_t total;

  if (tm == NULL || chunk_size == 0)
    return 0;

  tiles_per_layer = (uint64_t)chunk_size * (uint64_t)chunk_size;
  total =
      tiles_per_layer * (uint64_t)tm->num_layers * (uint64_t)sizeof(uint16_t);
  if (total > 0xffffffffu)
    return 0;
  return (uint32_t)total;
}

static uint32_t stbte_chunk_export_required_bytes_impl(stbte_tilemap *tm,
                                                       uint32_t chunk_count,
                                                       uint32_t chunk_size) {
  uint64_t per_chunk;
  uint64_t total;

  per_chunk = stbte_chunk_export_bytes_per_chunk_impl(tm, chunk_size);
  if (per_chunk == 0)
    return 0;

  total = (uint64_t)stbte_chunk_export_header_size_impl() +
          ((uint64_t)chunk_count * per_chunk);
  if (total > 0xffffffffu)
    return 0;
  return (uint32_t)total;
}

static void stbte_reset_structural_state(stbte_tilemap *tm) {
  int next_active_layer;

  if (tm->num_layers <= 0) {
    tm->cur_layer = -1;
    tm->solo_layer = -1;
  } else {
    next_active_layer = tm->num_layers - 1;
    if (tm->cur_layer >= tm->num_layers)
      tm->cur_layer = next_active_layer;
    if (tm->solo_layer >= tm->num_layers)
      tm->solo_layer = -1;
  }

  stbte__ui.has_selection = 0;
  stbte__ui.select_x0 = 0;
  stbte__ui.select_y0 = 0;
  stbte__ui.select_x1 = 0;
  stbte__ui.select_y1 = 0;
  stbte__ui.has_copy = 0;
  stbte__ui.copy_width = 0;
  stbte__ui.copy_height = 0;
  stbte__ui.copy_has_props = 0;
  stbte__ui.copy_src = (stbte_tilemap *)0;
  stbte__ui.copy_src_x = 0;
  stbte__ui.copy_src_y = 0;

  tm->undo_len = 0;
  tm->redo_len = 0;
  tm->undo_pos = 0;
  tm->undo_available_valid = 0;
  stbte__recompute_undo_available(tm);
}

static unsigned int stbte_insert_layer_bit(unsigned int mask, int index) {
  unsigned int lower_mask;
  unsigned int lower_bits;
  unsigned int upper_bits;

  if (index <= 0)
    return mask << 1;

  lower_mask = (1u << index) - 1u;
  lower_bits = mask & lower_mask;
  upper_bits = mask & ~lower_mask;
  return lower_bits | (upper_bits << 1);
}

static unsigned int stbte_delete_layer_bit(unsigned int mask, int index) {
  unsigned int lower_mask;
  unsigned int lower_bits;
  unsigned int upper_bits;

  if (index <= 0) {
    return mask >> 1;
  }

  lower_mask = (1u << index) - 1u;
  lower_bits = mask & lower_mask;
  upper_bits = (mask >> 1) & ~lower_mask;
  return lower_bits | upper_bits;
}

static unsigned int stbte_move_layer_bit(unsigned int mask, int from_index,
                                         int to_index) {
  unsigned int bit;
  unsigned int lower_bits;
  unsigned int middle_bits;
  unsigned int upper_bits;
  unsigned int middle_mask;

  if (from_index == to_index)
    return mask;

  bit = (mask >> from_index) & 1u;
  if (from_index < to_index) {
    lower_bits = from_index > 0 ? mask & ((1u << from_index) - 1u) : 0u;
    middle_mask = (1u << (to_index - from_index)) - 1u;
    middle_bits = (mask >> (from_index + 1)) & middle_mask;
    upper_bits = mask & ~((1u << (to_index + 1)) - 1u);
    return lower_bits | (middle_bits << from_index) | (bit << to_index) |
           upper_bits;
  }

  lower_bits = to_index > 0 ? mask & ((1u << to_index) - 1u) : 0u;
  middle_mask = (1u << (from_index - to_index)) - 1u;
  middle_bits = (mask >> to_index) & middle_mask;
  upper_bits = mask & ~((1u << (from_index + 1)) - 1u);
  return lower_bits | (bit << to_index) | (middle_bits << (to_index + 1)) |
         upper_bits;
}

static void stbte_rewrite_tile_layermasks(
    stbte_tilemap *tm, unsigned int (*rewrite)(unsigned int, int), int index) {
  int i;
  for (i = 0; i < tm->num_tiles; ++i)
    tm->tiles[i].layermask = rewrite(tm->tiles[i].layermask, index);
  tm->tileinfo_dirty = 1;
}

static unsigned int stbte_move_layer_bit_wrapper(unsigned int mask,
                                                 int packed) {
  int from_index = packed >> 8;
  int to_index = packed & 0xff;
  return stbte_move_layer_bit(mask, from_index, to_index);
}

static short stbte_blank_value_for_layer(stbte_tilemap *tm, int layer) {
  return layer == 0 ? tm->background_tile : STBTE__NO_TILE;
}

static void stbte_clear_cell_after_resize(stbte_tilemap *tm, int x, int y) {
  int layer;
  int prop;

  for (layer = 0; layer < STBTE_MAX_LAYERS; ++layer)
    tm->data[y][x][layer] = stbte_blank_value_for_layer(tm, layer);

  for (prop = 0; prop < STBTE_MAX_PROPERTIES; ++prop)
    tm->props[y][x][prop] = 0;
}

static int stbte_remap_deleted_layer_index(int index, int deleted_layer,
                                           int next_num_layers) {
  if (index < 0)
    return index;
  if (index == deleted_layer)
    return deleted_layer < next_num_layers ? deleted_layer
                                           : next_num_layers - 1;
  if (index > deleted_layer)
    return index - 1;
  return index;
}

static int stbte_remap_moved_layer_index(int index, int from_index,
                                         int to_index) {
  if (index < 0)
    return index;
  if (index == from_index)
    return to_index;
  if (from_index < to_index && index > from_index && index <= to_index)
    return index - 1;
  if (to_index < from_index && index >= to_index && index < from_index)
    return index + 1;
  return index;
}

static void stbte_swap_layers(stbte_tilemap *tm, int layer_a, int layer_b) {
  int x, y;
  short tmp;
  stbte__layer layer_info;

  if (layer_a == layer_b)
    return;

  for (y = 0; y < tm->max_y; ++y) {
    for (x = 0; x < tm->max_x; ++x) {
      tmp = tm->data[y][x][layer_a];
      tm->data[y][x][layer_a] = tm->data[y][x][layer_b];
      tm->data[y][x][layer_b] = tmp;
    }
  }

  layer_info = tm->layerinfo[layer_a];
  tm->layerinfo[layer_a] = tm->layerinfo[layer_b];
  tm->layerinfo[layer_b] = layer_info;
}

/* ==========================================================================
 * LIFECYCLE
 * ========================================================================== */

__attribute__((export_name("stbte_create"))) stbte_tilemap *
stbte_create(int map_x, int map_y, int layers, int spacing_x, int spacing_y,
             int max_tiles) {
  if (!stbte__ui.initted) {
    stbte__init_gui();
  }
  return stbte_create_map(map_x, map_y, layers, spacing_x, spacing_y,
                          max_tiles);
}

__attribute__((export_name("stbte_destroy"))) void
stbte_destroy(stbte_tilemap *tm) {
  (void)tm;
}

__attribute__((export_name("stbte_clear"))) void
stbte_clear(stbte_tilemap *tm) {
  stbte_clear_map(tm);
  // Reset undo state — clearing is not undoable
  tm->undo_len = 0;
  tm->redo_len = 0;
  tm->undo_pos = 0;
  tm->undo_available_valid = 0;
  stbte__recompute_undo_available(tm);
}

__attribute__((export_name("stbte_set_dimensions"))) void
stbte_set_dims(stbte_tilemap *tm, int max_x, int max_y) {
  stbte_set_dimensions(tm, max_x, max_y);
}

__attribute__((export_name("stbte_resize_map"))) int
stbte_resize_map(stbte_tilemap *tm, int max_x, int max_y) {
  int old_max_x;
  int old_max_y;
  int x;
  int y;

  if (tm == NULL)
    return STBTE_STATUS_ERR;
  if (max_x < 1 || max_y < 1 || max_x > STBTE_MAX_TILEMAP_X ||
      max_y > STBTE_MAX_TILEMAP_Y)
    return STBTE_STATUS_ERR;

  old_max_x = tm->max_x;
  old_max_y = tm->max_y;
  if (old_max_x == max_x && old_max_y == max_y)
    return STBTE_STATUS_OK;

  for (y = 0; y < STBTE_MAX_TILEMAP_Y; ++y) {
    for (x = 0; x < STBTE_MAX_TILEMAP_X; ++x) {
      if (x < max_x && y < max_y && x < old_max_x && y < old_max_y)
        continue;
      stbte_clear_cell_after_resize(tm, x, y);
    }
  }

  tm->max_x = max_x;
  tm->max_y = max_y;
  stbte_reset_structural_state(tm);
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_insert_layer"))) int
stbte_insert_layer(stbte_tilemap *tm, int index) {
  int x;
  int y;
  int layer;

  if (tm == NULL)
    return STBTE_STATUS_ERR;
  if (tm->num_layers >= STBTE_MAX_LAYERS)
    return STBTE_STATUS_ERR;
  if (index < 0 || index > tm->num_layers)
    return STBTE_STATUS_ERR;

  for (y = 0; y < tm->max_y; ++y) {
    for (x = 0; x < tm->max_x; ++x) {
      for (layer = tm->num_layers; layer > index; --layer)
        tm->data[y][x][layer] = tm->data[y][x][layer - 1];
      tm->data[y][x][index] = stbte_blank_value_for_layer(tm, index);
    }
  }

  for (layer = tm->num_layers; layer > index; --layer)
    tm->layerinfo[layer] = tm->layerinfo[layer - 1];
  tm->layerinfo[index].hidden = 0;
  tm->layerinfo[index].locked = STBTE__unlocked;

  tm->num_layers += 1;
  if (tm->cur_layer >= index)
    tm->cur_layer += 1;
  if (tm->solo_layer >= index)
    tm->solo_layer += 1;

  stbte_rewrite_tile_layermasks(tm, stbte_insert_layer_bit, index);
  stbte_reset_structural_state(tm);
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_delete_layer"))) int
stbte_delete_layer(stbte_tilemap *tm, int index) {
  int x;
  int y;
  int layer;
  int next_num_layers;

  if (tm == NULL)
    return STBTE_STATUS_ERR;
  if (tm->num_layers <= 1)
    return STBTE_STATUS_ERR;
  if (index < 0 || index >= tm->num_layers)
    return STBTE_STATUS_ERR;

  next_num_layers = tm->num_layers - 1;

  for (y = 0; y < tm->max_y; ++y) {
    for (x = 0; x < tm->max_x; ++x) {
      for (layer = index; layer < next_num_layers; ++layer)
        tm->data[y][x][layer] = tm->data[y][x][layer + 1];
      tm->data[y][x][next_num_layers] =
          stbte_blank_value_for_layer(tm, next_num_layers);
    }
  }

  for (layer = index; layer < next_num_layers; ++layer)
    tm->layerinfo[layer] = tm->layerinfo[layer + 1];
  tm->layerinfo[next_num_layers].hidden = 0;
  tm->layerinfo[next_num_layers].locked = STBTE__unlocked;

  tm->cur_layer =
      stbte_remap_deleted_layer_index(tm->cur_layer, index, next_num_layers);
  tm->solo_layer =
      stbte_remap_deleted_layer_index(tm->solo_layer, index, next_num_layers);
  tm->num_layers = next_num_layers;

  stbte_rewrite_tile_layermasks(tm, stbte_delete_layer_bit, index);
  stbte_reset_structural_state(tm);
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_move_layer"))) int
stbte_move_layer(stbte_tilemap *tm, int from_index, int to_index) {
  int step;

  if (tm == NULL)
    return STBTE_STATUS_ERR;
  if (from_index < 0 || from_index >= tm->num_layers)
    return STBTE_STATUS_ERR;
  if (to_index < 0 || to_index >= tm->num_layers)
    return STBTE_STATUS_ERR;
  if (from_index == to_index)
    return STBTE_STATUS_OK;

  if (from_index < to_index) {
    for (step = from_index; step < to_index; ++step)
      stbte_swap_layers(tm, step, step + 1);
  } else {
    for (step = from_index; step > to_index; --step)
      stbte_swap_layers(tm, step, step - 1);
  }

  tm->cur_layer =
      stbte_remap_moved_layer_index(tm->cur_layer, from_index, to_index);
  tm->solo_layer =
      stbte_remap_moved_layer_index(tm->solo_layer, from_index, to_index);

  stbte_rewrite_tile_layermasks(tm, stbte_move_layer_bit_wrapper,
                                (from_index << 8) | to_index);
  stbte_reset_structural_state(tm);
  return STBTE_STATUS_OK;
}

/* ==========================================================================
 * TOOL MANAGEMENT
 * ========================================================================== */

__attribute__((export_name("stbte_set_tool"))) void
stbte_set_current_tool(stbte_tilemap *tm, int tool) {
  if (tool != STBTE_TOOL_SELECT) {
    (void)tm;
    stbte__ui.has_selection = 0;
  }

  (void)tm;
  switch (tool) {
  case STBTE_TOOL_SELECT:
    stbte__ui.tool = STBTE__tool_select;
    break;
  case STBTE_TOOL_BRUSH:
    stbte__ui.tool = STBTE__tool_brush;
    break;
  case STBTE_TOOL_ERASE:
    stbte__ui.tool = STBTE__tool_erase;
    break;
  case STBTE_TOOL_EYEDROPPER:
    stbte__ui.tool = STBTE__tool_eyedrop;
    break;
  case STBTE_TOOL_PASTE:
    stbte__ui.tool = STBTE__tool_paste;
    break;
  }
}

/* ==========================================================================
 * ACTIVE TILE (BRUSH)
 * ========================================================================== */

__attribute__((export_name("stbte_set_active_tile"))) void
stbte_set_brush_tile(stbte_tilemap *tm, int tile_index) {
  int i;
  int target_id;

  if (tm == NULL)
    return;

  if (tile_index <= 0) {
    tm->cur_tile = -1;
    return;
  }

  target_id = tile_index - 1;
  for (i = 0; i < tm->num_tiles; ++i) {
    if (tm->tiles[i].id == target_id) {
      tm->cur_tile = i;
      return;
    }
  }
}

__attribute__((export_name("stbte_get_active_tile_id"))) int
stbte_get_active_tile_id(stbte_tilemap *tm) {
  if (tm == NULL)
    return 0;
  if (tm->cur_tile < 0 || tm->cur_tile >= tm->num_tiles)
    return 0;
  return tm->tiles[tm->cur_tile].id + 1;
}

/* ==========================================================================
 * LAYER MANAGEMENT
 * ========================================================================== */

__attribute__((export_name("stbte_set_layer_hidden"))) void
stbte_set_layer_hide(stbte_tilemap *tm, int layer, int hidden) {
  if (layer >= 0 && layer < tm->num_layers) {
    tm->layerinfo[layer].hidden = hidden ? 1 : 0;
  }
}

__attribute__((export_name("stbte_set_layer_locked"))) void
stbte_set_layer_lock(stbte_tilemap *tm, int layer, int locked) {
  if (layer >= 0 && layer < tm->num_layers) {
    tm->layerinfo[layer].locked = locked ? 1 : 0;
  }
}

__attribute__((export_name("stbte_set_active_layer"))) void
stbte_set_cur_layer(stbte_tilemap *tm, int layer) {
  if (layer >= -1 && layer < tm->num_layers)
    tm->cur_layer = layer;
}

__attribute__((export_name("stbte_set_solo_layer"))) void
stbte_set_sololayer(stbte_tilemap *tm, int layer) {
  if (layer >= -1 && layer < tm->num_layers)
    tm->solo_layer = layer;
}

/* ==========================================================================
 * TILE DEFINITIONS
 * ========================================================================== */

// Pre-allocated category string table (avoids leaking 32 bytes per define_tile
// call)

__attribute__((export_name("stbte_define_tile"))) void
stbte_add_tile(stbte_tilemap *tm, unsigned short id, unsigned int layermask,
               int category_index) {
  unsigned short internal_id;

  if (id == 0)
    return;

  if (category_index < 0 || category_index >= STBTE_MAX_CATEGORIES)
    return;
  internal_id = (unsigned short)(id - 1);
  stbte_define_tile(tm, internal_id, layermask, category_index);
}

/* ==========================================================================
 * CATEGORY
 * ========================================================================== */

__attribute__((export_name("stbte_set_active_category"))) void
stbte_set_cur_category(stbte_tilemap *tm, int category) {
  // Ensure tile info is computed (computes categories from tile definitions)
  stbte__prepare_tileinfo(tm);
  stbte__choose_category(tm, category);
}

/* ==========================================================================
 * SELECTION
 * ========================================================================== */

__attribute__((export_name("stbte_set_selection"))) void
stbte_set_sel(stbte_tilemap *tm, int x0, int y0, int x1, int y1) {
  (void)tm;
  stbte__ui.has_selection = 1;
  stbte__ui.select_x0 = (x0 < x1 ? x0 : x1);
  stbte__ui.select_x1 = (x0 < x1 ? x1 : x0);
  stbte__ui.select_y0 = (y0 < y1 ? y0 : y1);
  stbte__ui.select_y1 = (y0 < y1 ? y1 : y0);
}

__attribute__((export_name("stbte_clear_selection"))) void
stbte_clear_sel(stbte_tilemap *tm) {
  (void)tm;
  stbte__ui.has_selection = 0;
}

/* ==========================================================================
 * CLIPBOARD
 * ========================================================================== */

__attribute__((export_name("stbte_copy"))) void
stbte_copy_selection(stbte_tilemap *tm) {
  stbte__copy_cut(tm, 0);
}

__attribute__((export_name("stbte_cut"))) void
stbte_cut_selection(stbte_tilemap *tm) {
  stbte__copy_cut(tm, 1);
  stbte__ui.has_selection = 0;
  stbte__recompute_undo_available(tm);
}

__attribute__((export_name("stbte_paste"))) void
stbte_paste_clipboard(stbte_tilemap *tm, int x, int y) {
  stbte__paste(tm, x, y);
  stbte__recompute_undo_available(tm);
}

/* ==========================================================================
 * UNDO/REDO
 * ========================================================================== */

__attribute__((export_name("stbte_undo"))) void
stbte_do_undo(stbte_tilemap *tm) {
  stbte__undo(tm);
  stbte__recompute_undo_available(tm);
}

__attribute__((export_name("stbte_redo"))) void
stbte_do_redo(stbte_tilemap *tm) {
  stbte__redo(tm);
  stbte__recompute_undo_available(tm);
}

/* ==========================================================================
 * TILE INTERACTION
 * ========================================================================== */

__attribute__((export_name("stbte_apply"))) void
stbte_apply(stbte_tilemap *tm, int x0, int y0, int x1, int y1) {
  // Clamp to map bounds
  if (x0 < 0)
    x0 = 0;
  if (x0 >= tm->max_x)
    x0 = tm->max_x - 1;
  if (y0 < 0)
    y0 = 0;
  if (y0 >= tm->max_y)
    y0 = tm->max_y - 1;
  if (x1 < 0)
    x1 = 0;
  if (x1 >= tm->max_x)
    x1 = tm->max_x - 1;
  if (y1 < 0)
    y1 = 0;
  if (y1 >= tm->max_y)
    y1 = tm->max_y - 1;

  switch (stbte__ui.tool) {
  case STBTE__tool_brush:
    stbte__fillrect(tm, x0, y0, x1, y1, 1);
    break;

  case STBTE__tool_erase:
    stbte__fillrect(tm, x0, y0, x1, y1, 0);
    break;

  case STBTE__tool_select:
    stbte__select_rect(tm, x0, y0, x1, y1);
    break;

  case STBTE__tool_eyedrop:
    stbte__eyedrop(tm, x0, y0);
    break;

  case STBTE__tool_paste:
    stbte__paste(tm, x0, y0);
    break;
  }

  stbte__recompute_undo_available(tm);
}

/* ==========================================================================
 * MAP DATA
 * ========================================================================== */

__attribute__((export_name("stbte_set_tile"))) void
stbte_set_tile_data(stbte_tilemap *tm, int x, int y, int layer, short tile_id) {
  if (x < 0 || x >= tm->max_x || y < 0 || y >= tm->max_y)
    return;
  if (layer < 0 || layer >= tm->num_layers)
    return;
  tm->data[y][x][layer] = tile_id;
}

__attribute__((export_name("stbte_set_background_tile"))) void
stbte_set_bg_tile(stbte_tilemap *tm, short tile_id) {
  stbte_set_background_tile(tm, tile_id);
}

/* ==========================================================================
 * GETTER FUNCTIONS
 * ========================================================================== */

__attribute__((export_name("stbte_get_tool"))) int
stbte_get_current_tool(void) {
  switch (stbte__ui.tool) {
  case STBTE__tool_select:
    return STBTE_TOOL_SELECT;
  case STBTE__tool_brush:
    return STBTE_TOOL_BRUSH;
  case STBTE__tool_erase:
    return STBTE_TOOL_ERASE;
  case STBTE__tool_eyedrop:
    return STBTE_TOOL_EYEDROPPER;
  case STBTE__tool_paste:
    return STBTE_TOOL_PASTE;
  default:
    return -1;
  }
}

__attribute__((export_name("stbte_get_tile_id"))) int
stbte_get_tile_at(stbte_tilemap *tm, int x, int y, int layer) {
  short tile_id;

  if (x < 0 || x >= tm->max_x || y < 0 || y >= tm->max_y)
    return 0;
  if (layer < 0 || layer >= tm->num_layers)
    return 0;
  tile_id = tm->data[y][x][layer];
  return tile_id < 0 ? 0 : tile_id + 1;
}

/* ==========================================================================
 * LOGICAL TILE STORAGE
 * ========================================================================== */

__attribute__((export_name("stbte_logical_create"))) stbte_logical_store *
stbte_logical_create(uint32_t map_width, uint32_t map_height,
                     uint32_t layer_count) {
  stbte_logical_store *store;
  uint64_t required;

  if (map_width == 0 || map_height == 0 || layer_count == 0)
    return (stbte_logical_store *)0;

  required =
      stbte_logical_store_required_bytes(map_width, map_height, layer_count);
  if (required == 0 || required > 0xffffffffu)
    return (stbte_logical_store *)0;

  store = (stbte_logical_store *)malloc_internal(sizeof(stbte_logical_store));
  if (store == NULL)
    return (stbte_logical_store *)0;

  store->data = (uint16_t *)malloc_internal((size_t)required);
  if (store->data == NULL)
    return (stbte_logical_store *)0;

  store->map_width = map_width;
  store->map_height = map_height;
  store->layer_count = layer_count;
  store->capacity_bytes = (uint32_t)required;
  store->has_selection = 0;
  store->select_x0 = 0;
  store->select_y0 = 0;
  store->select_x1 = 0;
  store->select_y1 = 0;
  store->clipboard_width = 0;
  store->clipboard_height = 0;
  store->clipboard_capacity_bytes = 0;
  store->has_clipboard = 0;
  store->undo_origin_x = 0;
  store->undo_origin_y = 0;
  store->undo_width = 0;
  store->undo_height = 0;
  store->undo_capacity_bytes = 0;
  store->has_undo = 0;
  store->redo_origin_x = 0;
  store->redo_origin_y = 0;
  store->redo_width = 0;
  store->redo_height = 0;
  store->redo_capacity_bytes = 0;
  store->has_redo = 0;
  memset(store->data, 0, (size_t)required);
  store->clipboard_data = (uint16_t *)0;
  store->undo_data = (uint16_t *)0;
  store->redo_data = (uint16_t *)0;
  return store;
}

__attribute__((export_name("stbte_logical_destroy"))) void
stbte_logical_destroy(stbte_logical_store *store) {
  (void)store;
}

__attribute__((export_name("stbte_logical_resize"))) int
stbte_logical_resize(stbte_logical_store *store, uint32_t map_width,
                     uint32_t map_height, uint32_t layer_count) {
  if (store == NULL || map_width == 0 || map_height == 0 || layer_count == 0)
    return STBTE_STATUS_ERR;
  if (store->map_width == map_width && store->map_height == map_height &&
      store->layer_count == layer_count)
    return STBTE_STATUS_OK;
  return stbte_logical_reallocate(store, map_width, map_height, layer_count, -1,
                                  -1, -1, -1);
}

__attribute__((export_name("stbte_logical_insert_layer"))) int
stbte_logical_insert_layer(stbte_logical_store *store, uint32_t index) {
  if (store == NULL || index > store->layer_count)
    return STBTE_STATUS_ERR;
  return stbte_logical_reallocate(store, store->map_width, store->map_height,
                                  store->layer_count + 1, (int)index, -1, -1,
                                  -1);
}

__attribute__((export_name("stbte_logical_delete_layer"))) int
stbte_logical_delete_layer(stbte_logical_store *store, uint32_t index) {
  if (store == NULL || store->layer_count <= 1 || index >= store->layer_count)
    return STBTE_STATUS_ERR;
  return stbte_logical_reallocate(store, store->map_width, store->map_height,
                                  store->layer_count - 1, -1, (int)index, -1,
                                  -1);
}

__attribute__((export_name("stbte_logical_move_layer"))) int
stbte_logical_move_layer(stbte_logical_store *store, uint32_t from_index,
                         uint32_t to_index) {
  if (store == NULL || from_index >= store->layer_count ||
      to_index >= store->layer_count)
    return STBTE_STATUS_ERR;
  if (from_index == to_index)
    return STBTE_STATUS_OK;
  return stbte_logical_reallocate(store, store->map_width, store->map_height,
                                  store->layer_count, -1, -1, (int)from_index,
                                  (int)to_index);
}

__attribute__((export_name("stbte_logical_data_ptr"))) uint32_t
stbte_logical_data_ptr(stbte_logical_store *store) {
  if (store == NULL || store->data == NULL)
    return 0;
  return (uint32_t)(uintptr_t)store->data;
}

__attribute__((export_name("stbte_logical_data_capacity_bytes"))) uint32_t
stbte_logical_data_capacity_bytes(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->capacity_bytes;
}

__attribute__((export_name("stbte_logical_set_all"))) int
stbte_logical_set_all(stbte_logical_store *store, uint32_t src_ptr,
                      uint32_t src_bytes) {
  if (store == NULL || store->data == NULL)
    return STBTE_STATUS_ERR;
  if (src_bytes < store->capacity_bytes)
    return STBTE_STATUS_ERR;
  memcpy(store->data, (const void *)(uintptr_t)src_ptr, store->capacity_bytes);
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_set_selection"))) int
stbte_logical_set_selection(stbte_logical_store *store, uint32_t x0,
                            uint32_t y0, uint32_t x1, uint32_t y1) {
  uint32_t min_x;
  uint32_t min_y;
  uint32_t max_x;
  uint32_t max_y;

  if (store == NULL || store->map_width == 0 || store->map_height == 0)
    return STBTE_STATUS_ERR;

  min_x = x0 < x1 ? x0 : x1;
  max_x = x0 < x1 ? x1 : x0;
  min_y = y0 < y1 ? y0 : y1;
  max_y = y0 < y1 ? y1 : y0;

  if (min_x >= store->map_width)
    min_x = store->map_width - 1;
  if (max_x >= store->map_width)
    max_x = store->map_width - 1;
  if (min_y >= store->map_height)
    min_y = store->map_height - 1;
  if (max_y >= store->map_height)
    max_y = store->map_height - 1;

  store->has_selection = 1;
  store->select_x0 = min_x;
  store->select_y0 = min_y;
  store->select_x1 = max_x;
  store->select_y1 = max_y;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_clear_selection"))) void
stbte_logical_clear_selection(stbte_logical_store *store) {
  if (store == NULL)
    return;
  store->has_selection = 0;
  store->select_x0 = 0;
  store->select_y0 = 0;
  store->select_x1 = 0;
  store->select_y1 = 0;
}

__attribute__((export_name("stbte_logical_has_selection"))) uint32_t
stbte_logical_has_selection(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->has_selection;
}

__attribute__((export_name("stbte_logical_selection_x0"))) uint32_t
stbte_logical_selection_x0(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->select_x0;
}

__attribute__((export_name("stbte_logical_selection_y0"))) uint32_t
stbte_logical_selection_y0(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->select_y0;
}

__attribute__((export_name("stbte_logical_selection_x1"))) uint32_t
stbte_logical_selection_x1(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->select_x1;
}

__attribute__((export_name("stbte_logical_selection_y1"))) uint32_t
stbte_logical_selection_y1(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->select_y1;
}

__attribute__((export_name("stbte_logical_copy_selection"))) int
stbte_logical_copy_selection(stbte_logical_store *store) {
  uint32_t width;
  uint32_t height;
  uint32_t layer;
  uint32_t y;
  uint32_t x;
  uint64_t layer_stride;
  uint64_t clip_stride;

  if (store == NULL || store->data == NULL || !store->has_selection)
    return STBTE_STATUS_ERR;

  stbte_logical_clamp_selection(store);
  width = store->select_x1 - store->select_x0 + 1;
  height = store->select_y1 - store->select_y0 + 1;
  if (!stbte_logical_ensure_clipboard_capacity(store, width, height))
    return STBTE_STATUS_ERR;

  layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  clip_stride = (uint64_t)width * (uint64_t)height;
  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *src_layer = store->data + (layer * layer_stride);
    uint16_t *dst_layer = store->clipboard_data + (layer * clip_stride);
    for (y = 0; y < height; ++y) {
      for (x = 0; x < width; ++x) {
        dst_layer[(y * width) + x] =
            src_layer[((uint64_t)(store->select_y0 + y) * store->map_width) +
                      store->select_x0 + x];
      }
    }
  }

  store->clipboard_width = width;
  store->clipboard_height = height;
  store->has_clipboard = 1;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_cut_selection"))) int
stbte_logical_cut_selection(stbte_logical_store *store) {
  uint32_t layer;
  uint32_t y;
  uint32_t x;
  uint64_t layer_stride;

  if (!stbte_logical_copy_selection(store))
    return STBTE_STATUS_ERR;
  if (!stbte_logical_record_undo_state(store, store->select_x0,
                                       store->select_y0,
                                       store->select_x1 - store->select_x0 + 1,
                                       store->select_y1 - store->select_y0 + 1))
    return STBTE_STATUS_ERR;

  layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *dst_layer = store->data + (layer * layer_stride);
    for (y = store->select_y0; y <= store->select_y1; ++y) {
      for (x = store->select_x0; x <= store->select_x1; ++x)
        dst_layer[((uint64_t)y * store->map_width) + x] = 0;
    }
  }

  store->has_selection = 0;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_has_clipboard"))) uint32_t
stbte_logical_has_clipboard(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->has_clipboard;
}

__attribute__((export_name("stbte_logical_has_undo"))) uint32_t
stbte_logical_has_undo(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->has_undo;
}

__attribute__((export_name("stbte_logical_has_redo"))) uint32_t
stbte_logical_has_redo(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->has_redo;
}

__attribute__((export_name("stbte_logical_clear_redo"))) void
stbte_logical_clear_redo_export(stbte_logical_store *store) {
  stbte_logical_clear_redo(store);
}

__attribute__((export_name("stbte_logical_clear_clipboard"))) void
stbte_logical_clear_clipboard_export(stbte_logical_store *store) {
  stbte_logical_clear_clipboard(store);
}

__attribute__((export_name("stbte_logical_clipboard_width"))) uint32_t
stbte_logical_clipboard_width(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->clipboard_width;
}

__attribute__((export_name("stbte_logical_clipboard_height"))) uint32_t
stbte_logical_clipboard_height(stbte_logical_store *store) {
  if (store == NULL)
    return 0;
  return store->clipboard_height;
}

__attribute__((export_name("stbte_logical_clipboard_data_ptr"))) uint32_t
stbte_logical_clipboard_data_ptr(stbte_logical_store *store) {
  if (store == NULL || store->clipboard_data == NULL)
    return 0;
  return (uint32_t)(uintptr_t)store->clipboard_data;
}

__attribute__((export_name("stbte_logical_set_clipboard"))) int
stbte_logical_set_clipboard(stbte_logical_store *store, uint32_t src_ptr,
                            uint32_t src_bytes, uint32_t width,
                            uint32_t height) {
  uint64_t required;

  if (store == NULL || width == 0 || height == 0 || store->layer_count == 0)
    return STBTE_STATUS_ERR;
  if (!stbte_logical_ensure_clipboard_capacity(store, width, height))
    return STBTE_STATUS_ERR;

  required =
      stbte_logical_clipboard_required_bytes(width, height, store->layer_count);
  if (src_bytes < required)
    return STBTE_STATUS_ERR;

  memcpy(store->clipboard_data, (const void *)(uintptr_t)src_ptr,
         (size_t)required);
  store->clipboard_width = width;
  store->clipboard_height = height;
  store->has_clipboard = 1;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_record_undo_region"))) int
stbte_logical_record_undo_region(stbte_logical_store *store, uint32_t x0,
                                 uint32_t y0, uint32_t x1, uint32_t y1) {
  uint32_t min_x;
  uint32_t min_y;
  uint32_t max_x;
  uint32_t max_y;

  if (store == NULL || store->data == NULL || store->map_width == 0 ||
      store->map_height == 0)
    return STBTE_STATUS_ERR;

  min_x = x0 < x1 ? x0 : x1;
  max_x = x0 < x1 ? x1 : x0;
  min_y = y0 < y1 ? y0 : y1;
  max_y = y0 < y1 ? y1 : y0;
  if (min_x >= store->map_width)
    min_x = store->map_width - 1;
  if (max_x >= store->map_width)
    max_x = store->map_width - 1;
  if (min_y >= store->map_height)
    min_y = store->map_height - 1;
  if (max_y >= store->map_height)
    max_y = store->map_height - 1;

  return stbte_logical_record_undo_state(store, min_x, min_y, max_x - min_x + 1,
                                         max_y - min_y + 1);
}

__attribute__((export_name("stbte_logical_paste"))) int
stbte_logical_paste(stbte_logical_store *store, uint32_t origin_x,
                    uint32_t origin_y) {
  uint32_t layer;
  uint32_t y;
  uint32_t x;
  uint64_t layer_stride;
  uint64_t clip_stride;

  if (store == NULL || store->data == NULL || !store->has_clipboard)
    return STBTE_STATUS_ERR;
  if (origin_x >= store->map_width || origin_y >= store->map_height)
    return STBTE_STATUS_ERR;

  {
    uint32_t width = store->clipboard_width;
    uint32_t height = store->clipboard_height;
    if (origin_x + width > store->map_width)
      width = store->map_width - origin_x;
    if (origin_y + height > store->map_height)
      height = store->map_height - origin_y;
    if (!stbte_logical_record_undo_state(store, origin_x, origin_y, width,
                                         height))
      return STBTE_STATUS_ERR;
  }

  layer_stride = (uint64_t)store->map_width * (uint64_t)store->map_height;
  clip_stride =
      (uint64_t)store->clipboard_width * (uint64_t)store->clipboard_height;
  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *dst_layer = store->data + (layer * layer_stride);
    uint16_t *src_layer = store->clipboard_data + (layer * clip_stride);
    for (y = 0; y < store->clipboard_height; ++y) {
      uint32_t target_y = origin_y + y;
      if (target_y >= store->map_height)
        break;
      for (x = 0; x < store->clipboard_width; ++x) {
        uint32_t target_x = origin_x + x;
        if (target_x >= store->map_width)
          break;
        dst_layer[((uint64_t)target_y * store->map_width) + target_x] =
            src_layer[(y * store->clipboard_width) + x];
      }
    }
  }

  store->has_selection = 0;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_clear_all"))) int
stbte_logical_clear_all(stbte_logical_store *store) {
  if (store == NULL || store->data == NULL)
    return STBTE_STATUS_ERR;
  if (!stbte_logical_record_undo_state(store, 0, 0, store->map_width,
                                       store->map_height))
    return STBTE_STATUS_ERR;
  memset(store->data, 0, (size_t)store->capacity_bytes);
  store->has_selection = 0;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_undo"))) int
stbte_logical_undo(stbte_logical_store *store) {
  if (store == NULL || !store->has_undo || store->undo_data == NULL)
    return STBTE_STATUS_ERR;
  if (!stbte_logical_capture_redo_state(store, store->undo_origin_x,
                                        store->undo_origin_y, store->undo_width,
                                        store->undo_height))
    return STBTE_STATUS_ERR;
  if (!stbte_logical_copy_region_to_store(
          store, store->undo_origin_x, store->undo_origin_y, store->undo_width,
          store->undo_height, store->undo_data))
    return STBTE_STATUS_ERR;
  store->has_undo = 0;
  store->has_selection = 0;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_redo"))) int
stbte_logical_redo(stbte_logical_store *store) {
  if (store == NULL || !store->has_redo || store->redo_data == NULL)
    return STBTE_STATUS_ERR;
  if (!stbte_logical_record_undo_state(store, store->redo_origin_x,
                                       store->redo_origin_y, store->redo_width,
                                       store->redo_height))
    return STBTE_STATUS_ERR;
  if (!stbte_logical_copy_region_to_store(
          store, store->redo_origin_x, store->redo_origin_y, store->redo_width,
          store->redo_height, store->redo_data))
    return STBTE_STATUS_ERR;
  store->has_redo = 0;
  store->has_selection = 0;
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_load_chunk_into_tilemap"))) int
stbte_logical_load_chunk_into_tilemap(stbte_logical_store *store,
                                      stbte_tilemap *tm, uint32_t chunk_size,
                                      uint32_t chunk_x, uint32_t chunk_y) {
  uint32_t chunk_origin_x;
  uint32_t chunk_origin_y;
  uint32_t chunk_width;
  uint32_t chunk_height;
  uint32_t layer;
  uint32_t y;
  uint32_t x;

  if (store == NULL || tm == NULL || chunk_size == 0)
    return STBTE_STATUS_ERR;
  if (store->layer_count != (uint32_t)tm->num_layers)
    return STBTE_STATUS_ERR;

  chunk_origin_x = chunk_x * chunk_size;
  chunk_origin_y = chunk_y * chunk_size;
  if (chunk_origin_x >= store->map_width || chunk_origin_y >= store->map_height)
    return STBTE_STATUS_ERR;

  chunk_width = store->map_width - chunk_origin_x;
  if (chunk_width > chunk_size)
    chunk_width = chunk_size;
  chunk_height = store->map_height - chunk_origin_y;
  if (chunk_height > chunk_size)
    chunk_height = chunk_size;

  if (!stbte_resize_map(tm, (int)chunk_width, (int)chunk_height))
    return STBTE_STATUS_ERR;
  stbte_clear(tm);
  stbte__ui.has_selection = 0;

  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *src_layer = stbte_logical_layer_base(store, layer);
    for (y = 0; y < chunk_height; ++y) {
      uint16_t *row = src_layer +
                      ((uint64_t)(chunk_origin_y + y) * store->map_width) +
                      chunk_origin_x;
      for (x = 0; x < chunk_width; ++x) {
        uint16_t encoded = row[x];
        tm->data[y][x][layer] =
            encoded == 0 ? STBTE__NO_TILE : (short)(encoded - 1);
      }
    }
  }

  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_write_chunk_from_tilemap"))) int
stbte_logical_write_chunk_from_tilemap(stbte_logical_store *store,
                                       stbte_tilemap *tm, uint32_t chunk_size,
                                       uint32_t chunk_x, uint32_t chunk_y) {
  uint32_t chunk_origin_x;
  uint32_t chunk_origin_y;
  uint32_t chunk_width;
  uint32_t chunk_height;
  uint32_t layer;
  uint32_t y;
  uint32_t x;

  if (store == NULL || tm == NULL || chunk_size == 0)
    return STBTE_STATUS_ERR;
  if (store->layer_count != (uint32_t)tm->num_layers)
    return STBTE_STATUS_ERR;

  chunk_origin_x = chunk_x * chunk_size;
  chunk_origin_y = chunk_y * chunk_size;
  if (chunk_origin_x >= store->map_width || chunk_origin_y >= store->map_height)
    return STBTE_STATUS_ERR;

  chunk_width = store->map_width - chunk_origin_x;
  if (chunk_width > chunk_size)
    chunk_width = chunk_size;
  chunk_height = store->map_height - chunk_origin_y;
  if (chunk_height > chunk_size)
    chunk_height = chunk_size;
  if (tm->max_x < (int)chunk_width || tm->max_y < (int)chunk_height)
    return STBTE_STATUS_ERR;

  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *dst_layer = stbte_logical_layer_base(store, layer);
    for (y = 0; y < chunk_height; ++y) {
      uint16_t *row = dst_layer +
                      ((uint64_t)(chunk_origin_y + y) * store->map_width) +
                      chunk_origin_x;
      for (x = 0; x < chunk_width; ++x) {
        short tile_id = tm->data[y][x][layer];
        row[x] = tile_id < 0 ? 0 : (uint16_t)(tile_id + 1);
      }
    }
  }

  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_export_write_header"))) int
stbte_logical_export_write_header(stbte_logical_store *store, uint32_t dst_ptr,
                                  uint32_t dst_capacity, uint32_t chunk_size) {
  stbte_chunk_export_header header;
  uint32_t chunk_count;
  uint64_t per_chunk;
  uint64_t total_needed;

  if (store == NULL || chunk_size == 0)
    return STBTE_STATUS_ERR;

  chunk_count = stbte_chunk_count_for_map(store->map_width, store->map_height,
                                          chunk_size);
  per_chunk = (uint64_t)chunk_size * (uint64_t)chunk_size *
              (uint64_t)store->layer_count * (uint64_t)sizeof(uint16_t);
  total_needed = (uint64_t)stbte_chunk_export_header_size_impl() +
                 ((uint64_t)chunk_count * per_chunk);
  if (total_needed > dst_capacity)
    return STBTE_STATUS_ERR;

  header.version = STBTE_CHUNK_EXPORT_VERSION;
  header.map_width = store->map_width;
  header.map_height = store->map_height;
  header.layer_count = store->layer_count;
  header.chunk_size = chunk_size;
  header.chunk_count = chunk_count;
  header.chunk_data_ptr = dst_ptr + stbte_chunk_export_header_size_impl();
  memcpy((void *)(uintptr_t)dst_ptr, &header, sizeof(header));
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_logical_export_write_chunk"))) int
stbte_logical_export_write_chunk(stbte_logical_store *store, uint32_t dst_ptr,
                                 uint32_t dst_capacity, uint32_t chunk_size,
                                 uint32_t chunk_index) {
  stbte_chunk_export_header *header;
  uint64_t per_chunk;
  uint64_t offset_bytes;
  uint64_t total_needed;
  uint16_t *out;
  uint32_t chunk_cols;
  uint32_t chunk_x;
  uint32_t chunk_y;
  uint32_t origin_x;
  uint32_t origin_y;
  uint32_t chunk_width;
  uint32_t chunk_height;
  uint32_t layer;
  uint32_t y;
  uint32_t x;

  if (store == NULL || chunk_size == 0)
    return STBTE_STATUS_ERR;

  header = (stbte_chunk_export_header *)(uintptr_t)dst_ptr;
  if (header->version != STBTE_CHUNK_EXPORT_VERSION ||
      chunk_index >= header->chunk_count)
    return STBTE_STATUS_ERR;

  per_chunk = (uint64_t)chunk_size * (uint64_t)chunk_size *
              (uint64_t)store->layer_count * (uint64_t)sizeof(uint16_t);
  offset_bytes = stbte_chunk_export_header_size_impl() +
                 ((uint64_t)chunk_index * per_chunk);
  total_needed = offset_bytes + per_chunk;
  if (total_needed > dst_capacity)
    return STBTE_STATUS_ERR;

  chunk_cols = (store->map_width + chunk_size - 1) / chunk_size;
  chunk_x = chunk_index % chunk_cols;
  chunk_y = chunk_index / chunk_cols;
  origin_x = chunk_x * chunk_size;
  origin_y = chunk_y * chunk_size;
  if (origin_x >= store->map_width || origin_y >= store->map_height)
    return STBTE_STATUS_ERR;
  chunk_width = store->map_width - origin_x;
  if (chunk_width > chunk_size)
    chunk_width = chunk_size;
  chunk_height = store->map_height - origin_y;
  if (chunk_height > chunk_size)
    chunk_height = chunk_size;

  out = (uint16_t *)((uint8_t *)(uintptr_t)dst_ptr + offset_bytes);
  for (layer = 0; layer < store->layer_count; ++layer) {
    uint16_t *src_layer = stbte_logical_layer_base(store, layer);
    for (y = 0; y < chunk_size; ++y) {
      for (x = 0; x < chunk_size; ++x) {
        uint16_t encoded = 0;
        if (x < chunk_width && y < chunk_height) {
          encoded = src_layer[((uint64_t)(origin_y + y) * store->map_width) +
                              origin_x + x];
        }
        *out++ = encoded;
      }
    }
  }
  return STBTE_STATUS_OK;
}

/* ==========================================================================
 * CHUNK EXPORT
 * ========================================================================== */

__attribute__((export_name("stbte_chunk_export_version"))) uint32_t
stbte_chunk_export_version(void) {
  return STBTE_CHUNK_EXPORT_VERSION;
}

__attribute__((export_name("stbte_chunk_export_header_size"))) uint32_t
stbte_chunk_export_header_size(void) {
  return stbte_chunk_export_header_size_impl();
}

__attribute__((export_name("stbte_chunk_export_bytes_per_chunk"))) uint32_t
stbte_chunk_export_bytes_per_chunk(stbte_tilemap *tm, uint32_t chunk_size) {
  return stbte_chunk_export_bytes_per_chunk_impl(tm, chunk_size);
}

__attribute__((export_name("stbte_chunk_export_required_bytes"))) uint32_t
stbte_chunk_export_required_bytes(stbte_tilemap *tm, uint32_t map_width,
                                  uint32_t map_height, uint32_t chunk_size,
                                  uint32_t chunk_count) {
  (void)map_width;
  (void)map_height;
  return stbte_chunk_export_required_bytes_impl(tm, chunk_count, chunk_size);
}

__attribute__((export_name("stbte_chunk_export_write_header"))) int
stbte_chunk_export_write_header(stbte_tilemap *tm, uint32_t dst_ptr,
                                uint32_t dst_capacity, uint32_t map_width,
                                uint32_t map_height, uint32_t chunk_size,
                                uint32_t chunk_count) {
  stbte_chunk_export_header header;
  uint32_t required;

  if (tm == NULL)
    return STBTE_STATUS_ERR;

  required =
      stbte_chunk_export_required_bytes_impl(tm, chunk_count, chunk_size);
  if (required == 0 || dst_capacity < required)
    return STBTE_STATUS_ERR;

  header.version = STBTE_CHUNK_EXPORT_VERSION;
  header.map_width = map_width;
  header.map_height = map_height;
  header.layer_count = (uint32_t)tm->num_layers;
  header.chunk_size = chunk_size;
  header.chunk_count = chunk_count;
  header.chunk_data_ptr = dst_ptr + stbte_chunk_export_header_size_impl();
  memcpy((void *)(uintptr_t)dst_ptr, &header, sizeof(header));
  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_chunk_export_write_current_chunk"))) int
stbte_chunk_export_write_current_chunk(stbte_tilemap *tm, uint32_t dst_ptr,
                                       uint32_t dst_capacity,
                                       uint32_t chunk_size,
                                       uint32_t chunk_index) {
  stbte_chunk_export_header *header;
  uint32_t per_chunk_bytes;
  uint32_t header_size;
  uint32_t offset_bytes;
  uint32_t total_needed;
  uint16_t *out;
  uint32_t layer;
  uint32_t y;
  uint32_t x;

  if (tm == NULL || chunk_size == 0)
    return STBTE_STATUS_ERR;

  per_chunk_bytes = stbte_chunk_export_bytes_per_chunk_impl(tm, chunk_size);
  header_size = stbte_chunk_export_header_size_impl();
  if (per_chunk_bytes == 0)
    return STBTE_STATUS_ERR;

  header = (stbte_chunk_export_header *)(uintptr_t)dst_ptr;
  if (header->version != STBTE_CHUNK_EXPORT_VERSION ||
      chunk_index >= header->chunk_count)
    return STBTE_STATUS_ERR;

  offset_bytes = header_size + (chunk_index * per_chunk_bytes);
  total_needed = offset_bytes + per_chunk_bytes;
  if (dst_capacity < total_needed)
    return STBTE_STATUS_ERR;

  out = (uint16_t *)((uint8_t *)(uintptr_t)dst_ptr + offset_bytes);
  for (layer = 0; layer < (uint32_t)tm->num_layers; ++layer) {
    for (y = 0; y < chunk_size; ++y) {
      for (x = 0; x < chunk_size; ++x) {
        uint16_t encoded = 0;
        if ((int)x < tm->max_x && (int)y < tm->max_y) {
          short tile_id = tm->data[y][x][layer];
          if (tile_id >= 0)
            encoded = (uint16_t)(tile_id + 1);
        }
        *out++ = encoded;
      }
    }
  }

  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_chunk_import_payload"))) int
stbte_chunk_import_payload(stbte_tilemap *tm, uint32_t src_ptr,
                           uint32_t src_capacity, uint32_t chunk_size,
                           uint32_t chunk_width, uint32_t chunk_height) {
  const uint16_t *src;
  uint32_t required;
  uint32_t layer;
  uint32_t y;
  uint32_t x;

  if (tm == NULL || chunk_size == 0)
    return STBTE_STATUS_ERR;
  if (chunk_width == 0 || chunk_height == 0 || chunk_width > chunk_size ||
      chunk_height > chunk_size)
    return STBTE_STATUS_ERR;
  if (chunk_width > STBTE_MAX_TILEMAP_X || chunk_height > STBTE_MAX_TILEMAP_Y)
    return STBTE_STATUS_ERR;

  required = stbte_chunk_export_bytes_per_chunk_impl(tm, chunk_size);
  if (required == 0 || src_capacity < required)
    return STBTE_STATUS_ERR;

  src = (const uint16_t *)(uintptr_t)src_ptr;
  if (!stbte_resize_map(tm, (int)chunk_width, (int)chunk_height))
    return STBTE_STATUS_ERR;
  stbte_clear(tm);

  for (layer = 0; layer < (uint32_t)tm->num_layers; ++layer) {
    for (y = 0; y < chunk_size; ++y) {
      for (x = 0; x < chunk_size; ++x) {
        uint16_t encoded = *src++;
        if (x >= chunk_width || y >= chunk_height)
          continue;
        tm->data[y][x][layer] =
            encoded == 0 ? STBTE__NO_TILE : (short)(encoded - 1);
      }
    }
  }

  return STBTE_STATUS_OK;
}

__attribute__((export_name("stbte_chunk_import_from_flat_payload"))) int
stbte_chunk_import_from_flat_payload(stbte_tilemap *tm, uint32_t src_ptr,
                                     uint32_t src_capacity, uint32_t map_width,
                                     uint32_t map_height, uint32_t chunk_size,
                                     uint32_t chunk_x, uint32_t chunk_y) {
  const uint16_t *src;
  uint64_t layer_stride;
  uint64_t required;
  uint32_t chunk_origin_x;
  uint32_t chunk_origin_y;
  uint32_t chunk_width;
  uint32_t chunk_height;
  uint32_t layer;
  uint32_t y;
  uint32_t x;

  if (tm == NULL || map_width == 0 || map_height == 0 || chunk_size == 0)
    return STBTE_STATUS_ERR;

  layer_stride = (uint64_t)map_width * (uint64_t)map_height;
  required =
      layer_stride * (uint64_t)tm->num_layers * (uint64_t)sizeof(uint16_t);
  if (required == 0 || required > (uint64_t)src_capacity)
    return STBTE_STATUS_ERR;

  chunk_origin_x = chunk_x * chunk_size;
  chunk_origin_y = chunk_y * chunk_size;
  if (chunk_origin_x >= map_width || chunk_origin_y >= map_height)
    return STBTE_STATUS_ERR;

  chunk_width = map_width - chunk_origin_x;
  if (chunk_width > chunk_size)
    chunk_width = chunk_size;
  chunk_height = map_height - chunk_origin_y;
  if (chunk_height > chunk_size)
    chunk_height = chunk_size;

  if (!stbte_resize_map(tm, (int)chunk_width, (int)chunk_height))
    return STBTE_STATUS_ERR;
  stbte_clear(tm);

  src = (const uint16_t *)(uintptr_t)src_ptr;
  for (layer = 0; layer < (uint32_t)tm->num_layers; ++layer) {
    const uint16_t *layer_base = src + (layer * layer_stride);
    for (y = 0; y < chunk_height; ++y) {
      const uint16_t *row =
          layer_base + ((chunk_origin_y + y) * map_width) + chunk_origin_x;
      for (x = 0; x < chunk_width; ++x) {
        uint16_t encoded = row[x];
        tm->data[y][x][layer] =
            encoded == 0 ? STBTE__NO_TILE : (short)(encoded - 1);
      }
    }
  }

  return STBTE_STATUS_OK;
}

/* ==========================================================================
 * 4. MEMORY LAYOUT EXPORT - Struct offsets for JS direct access
 * ========================================================================== */

// stbte_tilemap offsets
__attribute__((export_name("stbte_offset_tilemap_max_x"))) int
stbte_offset_tm_max_x(void) {
  return offsetof(stbte_tilemap, max_x);
}

__attribute__((export_name("stbte_offset_tilemap_max_y"))) int
stbte_offset_tm_max_y(void) {
  return offsetof(stbte_tilemap, max_y);
}

__attribute__((export_name("stbte_offset_tilemap_num_layers"))) int
stbte_offset_tm_num_layers(void) {
  return offsetof(stbte_tilemap, num_layers);
}

__attribute__((export_name("stbte_offset_tilemap_num_tiles"))) int
stbte_offset_tm_num_tiles(void) {
  return offsetof(stbte_tilemap, num_tiles);
}

__attribute__((export_name("stbte_offset_tilemap_cur_tile"))) int
stbte_offset_tm_cur_tile(void) {
  return offsetof(stbte_tilemap, cur_tile);
}

__attribute__((export_name("stbte_offset_tilemap_cur_layer"))) int
stbte_offset_tm_cur_layer(void) {
  return offsetof(stbte_tilemap, cur_layer);
}

__attribute__((export_name("stbte_offset_tilemap_solo_layer"))) int
stbte_offset_tm_solo_layer(void) {
  return offsetof(stbte_tilemap, solo_layer);
}

__attribute__((export_name("stbte_offset_tilemap_cur_category"))) int
stbte_offset_tm_cur_category(void) {
  return offsetof(stbte_tilemap, cur_category);
}

__attribute__((export_name("stbte_offset_tilemap_background_tile"))) int
stbte_offset_tm_bg_tile(void) {
  return offsetof(stbte_tilemap, background_tile);
}

__attribute__((export_name("stbte_offset_tilemap_num_categories"))) int
stbte_offset_tm_num_categories(void) {
  return offsetof(stbte_tilemap, num_categories);
}

__attribute__((export_name("stbte_offset_tilemap_data"))) int
stbte_offset_tm_data(void) {
  return offsetof(stbte_tilemap, data);
}

__attribute__((export_name("stbte_offset_tilemap_tiles"))) int
stbte_offset_tm_tiles(void) {
  return offsetof(stbte_tilemap, tiles);
}

__attribute__((export_name("stbte_offset_tilemap_layerinfo"))) int
stbte_offset_tm_layerinfo(void) {
  return offsetof(stbte_tilemap, layerinfo);
}

// stbte__layer offsets
__attribute__((export_name("stbte_offset_layer_hidden"))) int
stbte_offset_layer_hidden(void) {
  return offsetof(stbte__layer, hidden);
}

__attribute__((export_name("stbte_offset_layer_locked"))) int
stbte_offset_layer_locked(void) {
  return offsetof(stbte__layer, locked);
}

// stbte__tileinfo offsets
__attribute__((export_name("stbte_offset_tileinfo_id"))) int
stbte_offset_tileinfo_id(void) {
  return offsetof(stbte__tileinfo, id);
}

__attribute__((export_name("stbte_offset_tileinfo_layermask"))) int
stbte_offset_tileinfo_layermask(void) {
  return offsetof(stbte__tileinfo, layermask);
}

__attribute__((export_name("stbte_offset_tileinfo_category_id"))) int
stbte_offset_tileinfo_category_id(void) {
  return offsetof(stbte__tileinfo, category_id);
}

// stbte__ui_t base address (static global — need absolute ptr for JS)
__attribute__((export_name("stbte_ui_ptr"))) int stbte_get_ui_ptr(void) {
  return (int)(uintptr_t)&stbte__ui;
}

// stbte__ui_t offsets
__attribute__((export_name("stbte_offset_ui_tool"))) int
stbte_offset_ui_tool(void) {
  return offsetof(stbte__ui_t, tool);
}

__attribute__((export_name("stbte_offset_ui_has_selection"))) int
stbte_offset_ui_has_selection(void) {
  return offsetof(stbte__ui_t, has_selection);
}

__attribute__((export_name("stbte_offset_ui_select_x0"))) int
stbte_offset_ui_select_x0(void) {
  return offsetof(stbte__ui_t, select_x0);
}

__attribute__((export_name("stbte_offset_ui_select_y0"))) int
stbte_offset_ui_select_y0(void) {
  return offsetof(stbte__ui_t, select_y0);
}

__attribute__((export_name("stbte_offset_ui_select_x1"))) int
stbte_offset_ui_select_x1(void) {
  return offsetof(stbte__ui_t, select_x1);
}

__attribute__((export_name("stbte_offset_ui_select_y1"))) int
stbte_offset_ui_select_y1(void) {
  return offsetof(stbte__ui_t, select_y1);
}

__attribute__((export_name("stbte_offset_ui_has_copy"))) int
stbte_offset_ui_has_copy(void) {
  return offsetof(stbte__ui_t, has_copy);
}

__attribute__((export_name("stbte_offset_ui_copy_width"))) int
stbte_offset_ui_copy_width(void) {
  return offsetof(stbte__ui_t, copy_width);
}

__attribute__((export_name("stbte_offset_ui_copy_height"))) int
stbte_offset_ui_copy_height(void) {
  return offsetof(stbte__ui_t, copy_height);
}

__attribute__((export_name("stbte_offset_ui_copybuffer"))) int
stbte_offset_ui_copybuffer(void) {
  return offsetof(stbte__ui_t, copybuffer);
}

// stbte_tilemap - undo/redo availability (in tilemap, not UI)
__attribute__((export_name("stbte_offset_tilemap_undo_available"))) int
stbte_offset_tm_undo_avail(void) {
  return offsetof(stbte_tilemap, undo_available);
}

__attribute__((export_name("stbte_offset_tilemap_redo_available"))) int
stbte_offset_tm_redo_avail(void) {
  return offsetof(stbte_tilemap, redo_available);
}

// Struct sizes
__attribute__((export_name("stbte_sizeof_tilemap"))) int stbte_sizeof_tm(void) {
  return sizeof(stbte_tilemap);
}

__attribute__((export_name("stbte_sizeof_layer"))) int
stbte_sizeof_layer(void) {
  return sizeof(stbte__layer);
}

__attribute__((export_name("stbte_sizeof_tileinfo"))) int
stbte_sizeof_tileinfo(void) {
  return sizeof(stbte__tileinfo);
}

__attribute__((export_name("stbte_sizeof_ui"))) int stbte_sizeof_ui(void) {
  return sizeof(stbte__ui_t);
}

// Constants
__attribute__((export_name("stbte_max_map_x"))) int stbte_get_max_map_x(void) {
  return STBTE_MAX_TILEMAP_X;
}

__attribute__((export_name("stbte_max_map_y"))) int stbte_get_max_map_y(void) {
  return STBTE_MAX_TILEMAP_Y;
}

__attribute__((export_name("stbte_max_layers"))) int
stbte_get_max_layers(void) {
  return STBTE_MAX_LAYERS;
}

__attribute__((export_name("stbte_max_copy"))) int stbte_get_max_copy(void) {
  return STBTE_MAX_COPY;
}

__attribute__((export_name("stbte_max_categories"))) int
stbte_get_max_categories(void) {
  return STBTE_MAX_CATEGORIES;
}
