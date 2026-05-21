#include "pack_plugin.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>

static void pack_sort(void *base, size_t num, size_t size,
                      int (*cmp)(const void *, const void *));

#define STBRP_SORT pack_sort
#define STBRP_ASSERT(x) ((void)0)
#define STB_RECT_PACK_IMPLEMENTATION
#include "stb_rect_pack.h"

typedef exports_gams_pack_pack_pack_error_t Error;
typedef exports_gams_pack_pack_pack_request_t Request;
typedef exports_gams_pack_pack_pack_response_t Response;
typedef exports_gams_pack_pack_rect_input_t RectInput;
typedef exports_gams_pack_pack_rect_output_t RectOutput;

typedef struct {
  uint32_t id;
  uint32_t width;
  uint32_t height;
  uint32_t padded_width;
  uint32_t padded_height;
  uint32_t x;
  uint32_t y;
  bool packed;
} WorkRect;

typedef struct {
  uint32_t width;
  uint32_t height;
  uint32_t padding;
  bool auto_size;
  size_t rect_count;
  WorkRect *rects;
} WorkRequest;

static void set_error(Error *err,
                      exports_gams_pack_pack_pack_error_code_t code,
                      const char *message) {
  err->code = code;
  pack_plugin_string_dup(&err->message, message);
}

static uint32_t max_u32(uint32_t a, uint32_t b) { return a > b ? a : b; }

static bool next_power_of_two(uint32_t value, uint32_t *out_value) {
  uint32_t result = 1;
  if (value == 0) {
    *out_value = 1;
    return true;
  }
  while (result < value) {
    if (result > 0x80000000u) {
      return false;
    }
    result <<= 1u;
  }
  *out_value = result;
  return true;
}

static bool validate_and_clone_request(Request *request, WorkRequest *work,
                                       Error *err) {
  memset(work, 0, sizeof(*work));
  work->width = request->width;
  work->height = request->height;
  work->padding = request->padding;
  work->auto_size = request->auto_size;
  work->rect_count = request->rects.len;

  if (work->width == 0 || work->height == 0) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_INVALID_ARG,
              "width and height must be positive");
    return false;
  }
  if (work->width > (uint32_t)STBRP__MAXVAL ||
      work->height > (uint32_t)STBRP__MAXVAL) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
              "width or height exceeds supported atlas bounds");
    return false;
  }

  if (work->rect_count == 0) {
    return true;
  }
  if (work->rect_count > (size_t)UINT32_MAX || work->rect_count > (size_t)INT_MAX) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
              "too many rectangles");
    return false;
  }
  if (work->rect_count > SIZE_MAX / sizeof(WorkRect)) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "too many rectangles");
    return false;
  }

  work->rects = calloc(work->rect_count, sizeof(WorkRect));
  if (!work->rects) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "failed to allocate request buffers");
    return false;
  }

  for (size_t i = 0; i < work->rect_count; i++) {
    RectInput *src = &request->rects.ptr[i];
    WorkRect *dst = &work->rects[i];
    dst->id = src->id.is_some ? src->id.val : (uint32_t)i;
    dst->width = src->width;
    dst->height = src->height;

    if (dst->width == 0 || dst->height == 0) {
      set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_INVALID_ARG,
                "rectangle width and height must be positive");
      return false;
    }
    if (dst->width > (uint32_t)STBRP__MAXVAL ||
        dst->height > (uint32_t)STBRP__MAXVAL) {
      set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
                "rectangle size exceeds supported atlas bounds");
      return false;
    }
    if (dst->width > UINT32_MAX - work->padding ||
        dst->height > UINT32_MAX - work->padding) {
      set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
                "padding overflows rectangle size");
      return false;
    }

    dst->padded_width = dst->width + work->padding;
    dst->padded_height = dst->height + work->padding;
    if (dst->padded_width > (uint32_t)STBRP__MAXVAL ||
        dst->padded_height > (uint32_t)STBRP__MAXVAL) {
      set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
                "padded rectangle size exceeds supported atlas bounds");
      return false;
    }
  }

  return true;
}

static bool run_pack(WorkRequest *request, bool *out_packed_all,
                     uint32_t *out_packed_count, Error *err) {
  stbrp_context context;
  stbrp_rect *rects;
  stbrp_node *nodes;

  *out_packed_all = true;
  *out_packed_count = 0;

  if (request->rect_count == 0) {
    return true;
  }
  if (request->rect_count > SIZE_MAX / sizeof(stbrp_rect) ||
      request->width > SIZE_MAX / sizeof(stbrp_node)) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "packer buffers are too large");
    return false;
  }

  rects = calloc(request->rect_count, sizeof(stbrp_rect));
  if (!rects) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "failed to allocate packer rectangles");
    return false;
  }

  nodes = calloc(request->width, sizeof(stbrp_node));
  if (!nodes) {
    free(rects);
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "failed to allocate packer nodes");
    return false;
  }

  for (size_t i = 0; i < request->rect_count; i++) {
    rects[i].id = (int)i;
    rects[i].w = (stbrp_coord)request->rects[i].padded_width;
    rects[i].h = (stbrp_coord)request->rects[i].padded_height;
    rects[i].x = 0;
    rects[i].y = 0;
    rects[i].was_packed = 0;
  }

  stbrp_init_target(&context, (int)request->width, (int)request->height, nodes,
                    (int)request->width);
  *out_packed_all = stbrp_pack_rects(&context, rects,
                                     (int)request->rect_count) != 0;

  for (size_t i = 0; i < request->rect_count; i++) {
    size_t index = (size_t)rects[i].id;
    if (index >= request->rect_count) {
      continue;
    }
    request->rects[index].packed = rects[i].was_packed != 0;
    if (request->rects[index].packed) {
      request->rects[index].x = (uint32_t)rects[i].x;
      request->rects[index].y = (uint32_t)rects[i].y;
      (*out_packed_count)++;
    }
  }

  free(nodes);
  free(rects);
  return true;
}

static bool run_pack_auto_size(WorkRequest *request, bool *out_packed_all,
                               uint32_t *out_packed_count, Error *err) {
  uint32_t original_width = request->width;
  uint32_t original_height = request->height;
  uint32_t candidate;
  uint32_t min_side = max_u32(request->width, request->height);

  for (size_t i = 0; i < request->rect_count; i++) {
    min_side = max_u32(min_side, request->rects[i].padded_width);
    min_side = max_u32(min_side, request->rects[i].padded_height);
  }

  if (!next_power_of_two(min_side, &candidate) ||
      candidate > (uint32_t)STBRP__MAXVAL) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
              "auto-size minimum exceeds supported atlas bounds");
    return false;
  }

  for (;;) {
    bool packed_all = false;
    uint32_t packed_count = 0;

    request->width = candidate;
    request->height = candidate;
    for (size_t i = 0; i < request->rect_count; i++) {
      request->rects[i].x = 0;
      request->rects[i].y = 0;
      request->rects[i].packed = false;
    }

    if (!run_pack(request, &packed_all, &packed_count, err)) {
      request->width = original_width;
      request->height = original_height;
      return false;
    }
    if (packed_all) {
      *out_packed_all = true;
      *out_packed_count = packed_count;
      return true;
    }

    if (candidate >= (uint32_t)STBRP__MAXVAL ||
        candidate > ((uint32_t)STBRP__MAXVAL / 2u)) {
      request->width = original_width;
      request->height = original_height;
      set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_RANGE,
                "auto-size could not fit all rectangles within supported atlas bounds");
      return false;
    }
    candidate <<= 1u;
  }
}

static bool build_response(WorkRequest *request, bool packed_all,
                           uint32_t packed_count, Response *ret,
                           Error *err) {
  memset(ret, 0, sizeof(*ret));
  ret->width = request->width;
  ret->height = request->height;
  ret->padding = request->padding;
  ret->packed_all = packed_all;
  ret->packed_count = packed_count;
  ret->failed_count = (uint32_t)(request->rect_count - packed_count);

  if (request->rect_count == 0) {
    return true;
  }
  if (request->rect_count > SIZE_MAX / sizeof(RectOutput)) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "response payload is too large");
    return false;
  }

  ret->rects.ptr = calloc(request->rect_count, sizeof(RectOutput));
  if (!ret->rects.ptr) {
    set_error(err, EXPORTS_GAMS_PACK_PACK_PACK_ERROR_CODE_OUT_OF_MEMORY,
              "failed to allocate response buffer");
    return false;
  }
  ret->rects.len = request->rect_count;

  for (size_t i = 0; i < request->rect_count; i++) {
    WorkRect *src = &request->rects[i];
    RectOutput *dst = &ret->rects.ptr[i];
    dst->id = src->id;
    dst->width = src->width;
    dst->height = src->height;
    dst->packed = src->packed;
    if (src->packed) {
      dst->x.is_some = true;
      dst->x.val = src->x;
      dst->y.is_some = true;
      dst->y.val = src->y;
    }
  }

  return true;
}

bool exports_gams_pack_pack_pack(Request *request, Response *ret, Error *err) {
  WorkRequest work;
  bool packed_all = true;
  uint32_t packed_count = 0;
  bool ok;

  memset(ret, 0, sizeof(*ret));
  memset(err, 0, sizeof(*err));

  if (!validate_and_clone_request(request, &work, err)) {
    free(work.rects);
    return false;
  }

  if (work.auto_size) {
    ok = run_pack_auto_size(&work, &packed_all, &packed_count, err);
  } else {
    ok = run_pack(&work, &packed_all, &packed_count, err);
  }

  if (!ok) {
    free(work.rects);
    return false;
  }

  ok = build_response(&work, packed_all, packed_count, ret, err);
  free(work.rects);
  return ok;
}

static void pack_sort(void *base, size_t num, size_t size,
                      int (*cmp)(const void *, const void *)) {
  stbrp_rect *rects = (stbrp_rect *)base;
  size_t i;
  size_t j;

  (void)size;

  for (i = 1; i < num; i++) {
    stbrp_rect key = rects[i];
    j = i;
    while (j > 0 && cmp(&rects[j - 1], &key) > 0) {
      rects[j] = rects[j - 1];
      j--;
    }
    rects[j] = key;
  }
}
