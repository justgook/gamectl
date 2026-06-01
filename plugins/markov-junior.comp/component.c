#include "markov_junior_plugin.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

extern uint32_t mj_core_run(const uint8_t *model_ptr, uintptr_t model_len,
                            const uint8_t *initial_ptr, uintptr_t initial_len,
                            uint32_t width, uint32_t height, uint32_t depth,
                            uint64_t seed, uint32_t max_steps);
extern const uint8_t *mj_core_output_ptr(void);
extern uintptr_t mj_core_output_len(void);

struct exports_gams_markov_junior_markov_junior_session_t {
  uint8_t *model;
  size_t model_len;
  uint8_t *initial;
  size_t initial_len;
  uint32_t width;
  uint32_t height;
  uint32_t depth;
  uint64_t seed;
  uint32_t steps_run;
  bool dismissed;
};

static uint32_t read_u32(const uint8_t *p) {
  return ((uint32_t)p[0]) | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) |
         ((uint32_t)p[3] << 24);
}

static void set_error(markov_junior_plugin_string_t *err) {
  uintptr_t len = mj_core_output_len();
  const uint8_t *ptr = mj_core_output_ptr();
  markov_junior_plugin_string_dup_n(err, (const char *)ptr, (size_t)len);
}

static bool copy_list(markov_junior_plugin_list_u8_t *src, uint8_t **ptr, size_t *len, markov_junior_plugin_string_t *err) {
  *ptr = NULL;
  *len = src->len;
  if (src->len == 0) return true;
  *ptr = malloc(src->len);
  if (!*ptr) {
    markov_junior_plugin_string_dup(err, "out of memory copying session input");
    return false;
  }
  memcpy(*ptr, src->ptr, src->len);
  return true;
}

static bool parse_model_values(const uint8_t *model, size_t model_len, const uint8_t **values, uint32_t *values_len) {
  if (model_len < 12 || model[0] != 'M' || model[1] != 'J' || model[2] != 'I' || model[3] != 'R') return false;
  uint32_t version = read_u32(model + 4);
  if (version != 1) return false;
  *values_len = read_u32(model + 8);
  if (*values_len == 0 || 12u + *values_len > model_len) return false;
  *values = model + 12;
  return true;
}

static bool initial_grid_result(exports_gams_markov_junior_markov_junior_session_t *session,
                                exports_gams_markov_junior_markov_junior_grid_t *ret,
                                markov_junior_plugin_string_t *err) {
  const uint8_t *values = NULL;
  uint32_t values_len = 0;
  if (!parse_model_values(session->model, session->model_len, &values, &values_len)) {
    markov_junior_plugin_string_dup(err, "invalid model-ir values");
    return false;
  }
  uint64_t cell_count_u64 = (uint64_t)session->width * (uint64_t)session->height * (uint64_t)session->depth;
  if (cell_count_u64 > session->initial_len || cell_count_u64 > SIZE_MAX) {
    markov_junior_plugin_string_dup(err, "initial-cells shorter than configured grid");
    return false;
  }
  size_t cell_count = (size_t)cell_count_u64;
  ret->width = session->width;
  ret->height = session->height;
  ret->depth = session->depth;
  ret->steps_run = 0;
  ret->changed = false;
  ret->done = false;
  markov_junior_plugin_string_dup_n(&ret->values, (const char *)values, values_len);
  ret->cells.len = cell_count;
  ret->cells.ptr = NULL;
  if (cell_count > 0) {
    ret->cells.ptr = malloc(cell_count);
    if (!ret->cells.ptr) {
      markov_junior_plugin_string_dup(err, "out of memory copying cells");
      return false;
    }
    memcpy(ret->cells.ptr, session->initial, cell_count);
  }
  return true;
}

static bool parse_grid_result(exports_gams_markov_junior_markov_junior_grid_t *ret, markov_junior_plugin_string_t *err) {
  uintptr_t len = mj_core_output_len();
  const uint8_t *ptr = mj_core_output_ptr();
  if (len < 32 || ptr[0] != 'M' || ptr[1] != 'J' || ptr[2] != 'R' || ptr[3] != 'O') {
    markov_junior_plugin_string_dup(err, "markov core returned invalid result");
    return false;
  }

  size_t pos = 4;
  ret->width = read_u32(ptr + pos); pos += 4;
  ret->height = read_u32(ptr + pos); pos += 4;
  ret->depth = read_u32(ptr + pos); pos += 4;
  ret->steps_run = read_u32(ptr + pos); pos += 4;
  ret->changed = read_u32(ptr + pos) != 0; pos += 4;
  ret->done = read_u32(ptr + pos) != 0; pos += 4;

  uint32_t values_len = read_u32(ptr + pos); pos += 4;
  if (pos + values_len + 4 > len) {
    markov_junior_plugin_string_dup(err, "markov core result truncated before values");
    return false;
  }
  markov_junior_plugin_string_dup_n(&ret->values, (const char *)(ptr + pos), values_len);
  pos += values_len;

  uint32_t cells_len = read_u32(ptr + pos); pos += 4;
  if (pos + cells_len > len) {
    markov_junior_plugin_string_dup(err, "markov core result truncated before cells");
    return false;
  }
  ret->cells.len = cells_len;
  ret->cells.ptr = NULL;
  if (cells_len > 0) {
    ret->cells.ptr = malloc(cells_len);
    if (!ret->cells.ptr) {
      markov_junior_plugin_string_dup(err, "out of memory copying cells");
      return false;
    }
    memcpy(ret->cells.ptr, ptr + pos, cells_len);
  }
  return true;
}

bool exports_gams_markov_junior_markov_junior_run(
    markov_junior_plugin_list_u8_t *model_ir,
    markov_junior_plugin_list_u8_t *initial_cells,
    exports_gams_markov_junior_markov_junior_run_config_t *config,
    exports_gams_markov_junior_markov_junior_grid_t *ret,
    markov_junior_plugin_string_t *err) {
  uint32_t status = mj_core_run(model_ir->ptr, (uintptr_t)model_ir->len,
                                initial_cells->ptr, (uintptr_t)initial_cells->len,
                                config->width, config->height, config->depth,
                                config->seed, config->max_steps);
  if (status != 0) {
    set_error(err);
    return false;
  }

  return parse_grid_result(ret, err);
}

bool exports_gams_markov_junior_markov_junior_create(
    markov_junior_plugin_list_u8_t *model_ir,
    markov_junior_plugin_list_u8_t *initial_cells,
    exports_gams_markov_junior_markov_junior_create_config_t *config,
    exports_gams_markov_junior_markov_junior_session_state_t *ret,
    markov_junior_plugin_string_t *err) {
  exports_gams_markov_junior_markov_junior_session_t *session = calloc(1, sizeof(*session));
  if (!session) {
    markov_junior_plugin_string_dup(err, "out of memory creating session");
    return false;
  }
  if (!copy_list(model_ir, &session->model, &session->model_len, err) ||
      !copy_list(initial_cells, &session->initial, &session->initial_len, err)) {
    exports_gams_markov_junior_markov_junior_session_destructor(session);
    return false;
  }
  session->width = config->width;
  session->height = config->height;
  session->depth = config->depth;
  session->seed = config->seed;
  session->steps_run = 0;

  if (!initial_grid_result(session, &ret->grid, err)) {
    exports_gams_markov_junior_markov_junior_session_destructor(session);
    return false;
  }
  ret->handle = exports_gams_markov_junior_markov_junior_session_new(session);
  if (ret->handle.__handle == 0) {
    exports_gams_markov_junior_markov_junior_grid_free(&ret->grid);
    exports_gams_markov_junior_markov_junior_session_destructor(session);
    markov_junior_plugin_string_dup(err, "failed to create session resource");
    return false;
  }
  return true;
}

bool exports_gams_markov_junior_markov_junior_step(
    exports_gams_markov_junior_markov_junior_borrow_session_t handle,
    uint32_t steps,
    exports_gams_markov_junior_markov_junior_grid_t *ret,
    markov_junior_plugin_string_t *err) {
  if (!handle || handle->dismissed) {
    markov_junior_plugin_string_dup(err, "markov session is dismissed");
    return false;
  }
  uint32_t target_steps = handle->steps_run + steps;
  if (target_steps < handle->steps_run) target_steps = UINT32_MAX;
  uint32_t status = mj_core_run(handle->model, handle->model_len,
                                handle->initial, handle->initial_len,
                                handle->width, handle->height, handle->depth,
                                handle->seed, target_steps);
  if (status != 0) {
    set_error(err);
    return false;
  }
  if (!parse_grid_result(ret, err)) return false;
  ret->changed = ret->steps_run > handle->steps_run;
  handle->steps_run = ret->steps_run;
  return true;
}

bool exports_gams_markov_junior_markov_junior_dismiss(
    exports_gams_markov_junior_markov_junior_borrow_session_t handle,
    markov_junior_plugin_string_t *err) {
  (void)err;
  if (!handle) return true;
  handle->dismissed = true;
  return true;
}

void exports_gams_markov_junior_markov_junior_session_destructor(
    exports_gams_markov_junior_markov_junior_session_t *rep) {
  if (!rep) return;
  free(rep->model);
  free(rep->initial);
  free(rep);
}
