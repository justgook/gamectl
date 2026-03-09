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

static void stbte_rewrite_tile_layermasks(stbte_tilemap *tm,
                                          unsigned int (*rewrite)(unsigned int,
                                                                  int),
                                          int index) {
  int i;
  for (i = 0; i < tm->num_tiles; ++i)
    tm->tiles[i].layermask = rewrite(tm->tiles[i].layermask, index);
  tm->tileinfo_dirty = 1;
}

static unsigned int stbte_move_layer_bit_wrapper(unsigned int mask, int packed) {
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
    return deleted_layer < next_num_layers ? deleted_layer : next_num_layers - 1;
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

  tm->cur_layer = stbte_remap_moved_layer_index(tm->cur_layer, from_index,
                                                 to_index);
  tm->solo_layer = stbte_remap_moved_layer_index(tm->solo_layer, from_index,
                                                 to_index);

  stbte_rewrite_tile_layermasks(
      tm, stbte_move_layer_bit_wrapper, (from_index << 8) | to_index);
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
  if (tile_index >= 0 && tile_index < tm->num_tiles) {
    tm->cur_tile = tile_index;
  }
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

  if (category_index < 0 || category_index >= STBTE_MAX_CATEGORIES)
    return;
  stbte_define_tile(tm, id, layermask, category_index);
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
  if (x < 0 || x >= tm->max_x || y < 0 || y >= tm->max_y)
    return -1;
  if (layer < 0 || layer >= tm->num_layers)
    return -1;
  return tm->data[y][x][layer];
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
