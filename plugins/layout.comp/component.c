#include "layout_plugin.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define AXIS_VERTICAL EXPORTS_GAMS_LAYOUT_LAYOUT_AXIS_VERTICAL
#define AXIS_HORIZONTAL EXPORTS_GAMS_LAYOUT_LAYOUT_AXIS_HORIZONTAL
#define LAYOUT_OK (-1)

typedef exports_gams_layout_layout_area_t Area;
typedef exports_gams_layout_layout_handle_t Handle;
typedef exports_gams_layout_layout_layout_document_t Doc;
typedef exports_gams_layout_layout_layout_response_t Response;
typedef exports_gams_layout_layout_layout_error_t Error;
typedef exports_gams_layout_layout_rect_t Rect;
typedef exports_gams_layout_layout_preview_t Preview;
typedef exports_gams_layout_layout_layout_config_t Config;

typedef struct {
  Doc doc;
} Work;

static int32_t abs_i32(int32_t v) { return v < 0 ? -v : v; }

static int32_t scale_i32(int32_t v, int32_t num, int32_t den) {
  return (int32_t)(((int64_t)v * num) / den);
}

static bool str_eq(layout_plugin_string_t *a, layout_plugin_string_t *b) {
  return a->len == b->len && memcmp(a->ptr, b->ptr, a->len) == 0;
}

static bool str_empty(layout_plugin_string_t *s) { return s->len == 0; }

static void set_error(Error *err,
                      exports_gams_layout_layout_layout_error_code_t code,
                      const char *message) {
  err->code = code;
  layout_plugin_string_dup(&err->message, message);
}

static void free_doc(Doc *doc) {
  exports_gams_layout_layout_layout_document_free(doc);
}

static bool clone_string(layout_plugin_string_t *dst,
                         layout_plugin_string_t *src) {
  layout_plugin_string_dup_n(dst, (const char *)src->ptr, src->len);
  return true;
}

static bool clone_doc(Doc *dst, Doc *src, Error *err) {
  memset(dst, 0, sizeof(*dst));
  dst->screen_w = src->screen_w;
  dst->screen_h = src->screen_h;
  dst->config = src->config;
  dst->generation = src->generation;
  dst->preview = src->preview;

  if (src->areas.len > 0) {
    dst->areas.ptr = calloc(src->areas.len, sizeof(Area));
    if (!dst->areas.ptr) {
      set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
                "out-of-memory");
      return false;
    }
    dst->areas.len = src->areas.len;
    for (size_t i = 0; i < src->areas.len; i++) {
      dst->areas.ptr[i].bounds = src->areas.ptr[i].bounds;
      clone_string(&dst->areas.ptr[i].content_id,
                   &src->areas.ptr[i].content_id);
    }
  }

  if (src->handles.len > 0) {
    dst->handles.ptr = calloc(src->handles.len, sizeof(Handle));
    if (!dst->handles.ptr) {
      free_doc(dst);
      set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
                "out-of-memory");
      return false;
    }
    dst->handles.len = src->handles.len;
    for (size_t i = 0; i < src->handles.len; i++) {
      dst->handles.ptr[i].bounds = src->handles.ptr[i].bounds;
      clone_string(&dst->handles.ptr[i].content_id,
                   &src->handles.ptr[i].content_id);
      dst->handles.ptr[i].axis = src->handles.ptr[i].axis;
      dst->handles.ptr[i].column_x0 = src->handles.ptr[i].column_x0;
      dst->handles.ptr[i].column_x1 = src->handles.ptr[i].column_x1;
      dst->handles.ptr[i].row_y0 = src->handles.ptr[i].row_y0;
      dst->handles.ptr[i].row_y1 = src->handles.ptr[i].row_y1;
    }
  }
  return true;
}

static bool valid_config(Config *cfg) {
  return cfg->max_areas > 0 && cfg->max_handles > 0 &&
         cfg->min_panel_size > 0 && cfg->handle_half_size > 0;
}

static bool validate_doc(Doc *doc, Error *err) {
  if (doc->screen_w <= 0 || doc->screen_h <= 0 || !valid_config(&doc->config)) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "invalid layout document");
    return false;
  }
  if (doc->areas.len == 0 || doc->areas.len > doc->config.max_areas ||
      doc->handles.len > doc->config.max_handles) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_CAPACITY,
              "layout document exceeds configured capacity");
    return false;
  }
  for (size_t i = 0; i < doc->areas.len; i++) {
    if (str_empty(&doc->areas.ptr[i].content_id)) {
      set_error(err,
                EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MISSING_CONTENT_ID,
                "area content-id is empty");
      return false;
    }
    for (size_t j = i + 1; j < doc->areas.len; j++) {
      if (str_eq(&doc->areas.ptr[i].content_id,
                 &doc->areas.ptr[j].content_id)) {
        set_error(
            err,
            EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_DUPLICATE_CONTENT_ID,
            "duplicate area content-id");
        return false;
      }
    }
    for (size_t j = 0; j < doc->handles.len; j++) {
      if (str_eq(&doc->areas.ptr[i].content_id,
                 &doc->handles.ptr[j].content_id)) {
        set_error(
            err,
            EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_DUPLICATE_CONTENT_ID,
            "area and handle content-id collide");
        return false;
      }
    }
  }
  for (size_t i = 0; i < doc->handles.len; i++) {
    if (str_empty(&doc->handles.ptr[i].content_id)) {
      set_error(err,
                EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MISSING_CONTENT_ID,
                "handle content-id is empty");
      return false;
    }
    if (doc->handles.ptr[i].axis != AXIS_VERTICAL &&
        doc->handles.ptr[i].axis != AXIS_HORIZONTAL) {
      set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
                "invalid handle axis");
      return false;
    }
    for (size_t j = i + 1; j < doc->handles.len; j++) {
      if (str_eq(&doc->handles.ptr[i].content_id,
                 &doc->handles.ptr[j].content_id)) {
        set_error(
            err,
            EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_DUPLICATE_CONTENT_ID,
            "duplicate handle content-id");
        return false;
      }
    }
  }
  return true;
}

static int32_t find_area(Doc *doc, layout_plugin_string_t *id) {
  for (size_t i = 0; i < doc->areas.len; i++) {
    if (str_eq(&doc->areas.ptr[i].content_id, id))
      return (int32_t)i;
  }
  return -1;
}

static int32_t find_handle(Doc *doc, layout_plugin_string_t *id) {
  for (size_t i = 0; i < doc->handles.len; i++) {
    if (str_eq(&doc->handles.ptr[i].content_id, id))
      return (int32_t)i;
  }
  return -1;
}

static bool id_exists(Doc *doc, layout_plugin_string_t *id) {
  return find_area(doc, id) >= 0 || find_handle(doc, id) >= 0;
}

static bool id_exists_lit(Doc *doc, const char *id) {
  layout_plugin_string_t tmp;
  layout_plugin_string_set(&tmp, id);
  return id_exists(doc, &tmp);
}

static void set_preview(Doc *doc, bool valid, int32_t x0, int32_t y0,
                        int32_t x1, int32_t y1) {
  doc->preview.is_some = true;
  doc->preview.val.valid = valid;
  doc->preview.val.bounds.x0 = x0;
  doc->preview.val.bounds.y0 = y0;
  doc->preview.val.bounds.x1 = x1;
  doc->preview.val.bounds.y1 = y1;
}

static void set_preview_from_area(Doc *doc, int32_t area_index) {
  if (area_index < 0 || (size_t)area_index >= doc->areas.len)
    return;
  Rect r = doc->areas.ptr[area_index].bounds;
  set_preview(doc, true, r.x0, r.y0, r.x1, r.y1);
}

static void finish(Response *ret, Doc *doc,
                   exports_gams_layout_layout_action_t action) {
  ret->document = *doc;
  ret->info.action = action;
  ret->info.generation = doc->generation;
  memset(doc, 0, sizeof(*doc));
}

static void bump(Doc *doc) { doc->generation += 1; }

static void recompute_handle_rect_scoped(Doc *doc, size_t idx) {
  Handle *hnd = &doc->handles.ptr[idx];
  int32_t hs = doc->config.handle_half_size;

  if (hnd->axis == AXIS_VERTICAL) {
    int32_t bx = (hnd->bounds.x0 + hnd->bounds.x1) / 2;
    int32_t row_y0 = hnd->row_y0;
    int32_t row_y1 = hnd->row_y1;
    if (row_y0 > row_y1) {
      int32_t t = row_y0;
      row_y0 = row_y1;
      row_y1 = t;
    }
    if (row_y0 < 0)
      row_y0 = 0;
    if (row_y1 > doc->screen_h)
      row_y1 = doc->screen_h;

    int32_t span_y0 = row_y1;
    int32_t span_y1 = row_y0;
    bool matched = false;
    for (size_t i = 0; i < doc->areas.len; i++) {
      Area *a = &doc->areas.ptr[i];
      if (a->bounds.y0 < row_y0 || a->bounds.y1 > row_y1)
        continue;
      if (a->bounds.x0 == bx || a->bounds.x1 == bx) {
        matched = true;
        if (a->bounds.y0 < span_y0)
          span_y0 = a->bounds.y0;
        if (a->bounds.y1 > span_y1)
          span_y1 = a->bounds.y1;
      }
    }
    if (!matched || span_y0 > span_y1) {
      span_y0 = row_y0;
      span_y1 = row_y1;
    }
    hnd->bounds.x0 = bx - hs;
    hnd->bounds.x1 = bx + hs;
    hnd->bounds.y0 = span_y0;
    hnd->bounds.y1 = span_y1;
  } else {
    int32_t col_x0 = hnd->column_x0;
    int32_t col_x1 = hnd->column_x1;
    if (col_x0 > col_x1) {
      int32_t t = col_x0;
      col_x0 = col_x1;
      col_x1 = t;
    }
    if (col_x0 < 0)
      col_x0 = 0;
    if (col_x1 > doc->screen_w)
      col_x1 = doc->screen_w;
    int32_t by = (hnd->bounds.y0 + hnd->bounds.y1) / 2;

    int32_t span_x0 = col_x1;
    int32_t span_x1 = col_x0;
    bool matched = false;
    for (size_t i = 0; i < doc->areas.len; i++) {
      Area *a = &doc->areas.ptr[i];
      if (a->bounds.x0 >= col_x0 && a->bounds.x1 <= col_x1 &&
          (a->bounds.y0 == by || a->bounds.y1 == by)) {
        matched = true;
        if (a->bounds.x0 < span_x0)
          span_x0 = a->bounds.x0;
        if (a->bounds.x1 > span_x1)
          span_x1 = a->bounds.x1;
      }
    }
    if (!matched || span_x0 > span_x1) {
      span_x0 = col_x0;
      span_x1 = col_x1;
    }
    hnd->bounds.y0 = by - hs;
    hnd->bounds.y1 = by + hs;
    hnd->bounds.x0 = span_x0;
    hnd->bounds.x1 = span_x1;
  }
}

static bool point_in_area(Doc *doc, size_t ai, int32_t px, int32_t py) {
  Rect *a = &doc->areas.ptr[ai].bounds;
  return px >= a->x0 && px < a->x1 && py >= a->y0 && py < a->y1;
}

static void remove_area(Doc *doc, size_t dead) {
  exports_gams_layout_layout_area_free(&doc->areas.ptr[dead]);
  for (size_t i = dead; i + 1 < doc->areas.len; i++)
    doc->areas.ptr[i] = doc->areas.ptr[i + 1];
  doc->areas.len--;
  if (doc->areas.len == 0) {
    free(doc->areas.ptr);
    doc->areas.ptr = NULL;
  } else {
    Area *next = realloc(doc->areas.ptr, doc->areas.len * sizeof(Area));
    if (next)
      doc->areas.ptr = next;
  }
}

static void remove_handle(Doc *doc, size_t dead) {
  exports_gams_layout_layout_handle_free(&doc->handles.ptr[dead]);
  for (size_t i = dead; i + 1 < doc->handles.len; i++)
    doc->handles.ptr[i] = doc->handles.ptr[i + 1];
  doc->handles.len--;
  if (doc->handles.len == 0) {
    free(doc->handles.ptr);
    doc->handles.ptr = NULL;
  } else {
    Handle *next = realloc(doc->handles.ptr, doc->handles.len * sizeof(Handle));
    if (next)
      doc->handles.ptr = next;
  }
}

static int32_t find_simple_merge_handle(Doc *doc, uint8_t axis,
                                        int32_t boundary_val) {
  for (size_t i = 0; i < doc->handles.len; i++) {
    if (doc->handles.ptr[i].axis != axis)
      continue;
    if (axis == AXIS_VERTICAL) {
      int32_t bx =
          (doc->handles.ptr[i].bounds.x0 + doc->handles.ptr[i].bounds.x1) / 2;
      if (bx == boundary_val)
        return (int32_t)i;
    } else {
      int32_t by =
          (doc->handles.ptr[i].bounds.y0 + doc->handles.ptr[i].bounds.y1) / 2;
      if (by == boundary_val)
        return (int32_t)i;
    }
  }
  return -1;
}

static int32_t simple_merge_preview(Doc *doc, size_t src_idx, size_t tgt_idx,
                                    Rect *out) {
  Rect src = doc->areas.ptr[src_idx].bounds;
  Rect tgt = doc->areas.ptr[tgt_idx].bounds;
  int32_t axis = -1, boundary = -1;
  size_t left = 0, right = 0, top = 0, bot = 0;

  if (src.x1 == tgt.x0 && src.y0 == tgt.y0 && src.y1 == tgt.y1) {
    axis = AXIS_VERTICAL;
    boundary = src.x1;
    left = src_idx;
    right = tgt_idx;
  } else if (tgt.x1 == src.x0 && tgt.y0 == src.y0 && tgt.y1 == src.y1) {
    axis = AXIS_VERTICAL;
    boundary = tgt.x1;
    left = tgt_idx;
    right = src_idx;
  } else if (src.y1 == tgt.y0 && src.x0 == tgt.x0 && src.x1 == tgt.x1) {
    axis = AXIS_HORIZONTAL;
    boundary = src.y1;
    top = src_idx;
    bot = tgt_idx;
  } else if (tgt.y1 == src.y0 && tgt.x0 == src.x0 && tgt.x1 == src.x1) {
    axis = AXIS_HORIZONTAL;
    boundary = tgt.y1;
    top = tgt_idx;
    bot = src_idx;
  } else {
    return EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_NOT_IMPLEMENTED;
  }

  int32_t h = find_simple_merge_handle(doc, (uint8_t)axis, boundary);
  if (h < 0)
    return EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_NOT_IMPLEMENTED;

  if (axis == AXIS_VERTICAL) {
    int32_t y0 = doc->areas.ptr[left].bounds.y0;
    int32_t y1 = doc->areas.ptr[left].bounds.y1;
    if (doc->handles.ptr[h].bounds.y0 != y0 ||
        doc->handles.ptr[h].bounds.y1 != y1) {
      return EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_NOT_IMPLEMENTED;
    }
    out->x0 = doc->areas.ptr[left].bounds.x0;
    out->y0 = y0;
    out->x1 = doc->areas.ptr[right].bounds.x1;
    out->y1 = y1;
  } else {
    int32_t x0 = doc->areas.ptr[top].bounds.x0;
    int32_t x1 = doc->areas.ptr[top].bounds.x1;
    if (doc->handles.ptr[h].bounds.x0 != x0 ||
        doc->handles.ptr[h].bounds.x1 != x1) {
      return EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_NOT_IMPLEMENTED;
    }
    out->x0 = x0;
    out->y0 = doc->areas.ptr[top].bounds.y0;
    out->x1 = x1;
    out->y1 = doc->areas.ptr[bot].bounds.y1;
  }
  return LAYOUT_OK;
}

static int32_t simple_merge(Doc *doc, size_t src_idx, size_t tgt_idx) {
  Rect merged;
  int32_t preview = simple_merge_preview(doc, src_idx, tgt_idx, &merged);
  if (preview != LAYOUT_OK)
    return preview;

  Rect src = doc->areas.ptr[src_idx].bounds;
  Rect tgt = doc->areas.ptr[tgt_idx].bounds;
  uint8_t axis;
  int32_t boundary;
  if ((src.x1 == tgt.x0 && src.y0 == tgt.y0 && src.y1 == tgt.y1) ||
      (tgt.x1 == src.x0 && tgt.y0 == src.y0 && tgt.y1 == src.y1)) {
    axis = AXIS_VERTICAL;
    boundary = src.x1 == tgt.x0 ? src.x1 : tgt.x1;
  } else {
    axis = AXIS_HORIZONTAL;
    boundary = src.y1 == tgt.y0 ? src.y1 : tgt.y1;
  }
  int32_t h = find_simple_merge_handle(doc, axis, boundary);
  if (h < 0)
    return EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_NOT_IMPLEMENTED;

  doc->areas.ptr[src_idx].bounds = merged;
  remove_area(doc, tgt_idx);
  remove_handle(doc, (size_t)h);
  for (size_t i = 0; i < doc->handles.len; i++)
    recompute_handle_rect_scoped(doc, i);
  return LAYOUT_OK;
}

static bool generated_unique_id(Doc *doc, layout_plugin_string_t *base,
                                const char *kind, layout_plugin_string_t *out) {
  size_t extra = strlen(kind);
  size_t cap = base->len + extra + 32;
  char *buf = malloc(cap);
  if (!buf)
    return false;
  memcpy(buf, base->ptr, base->len);
  memcpy(buf + base->len, kind, extra);
  size_t len = base->len + extra;
  buf[len] = '\0';
  if (!id_exists_lit(doc, buf)) {
    layout_plugin_string_dup_n(out, buf, len);
    free(buf);
    return true;
  }
  for (uint32_t n = 1; n < 1000000; n++) {
    int written =
        snprintf(buf + base->len + extra, cap - base->len - extra, "_%u", n);
    if (written < 0) {
      free(buf);
      return false;
    }
    len = base->len + extra + (size_t)written;
    if (!id_exists_lit(doc, buf)) {
      layout_plugin_string_dup_n(out, buf, len);
      free(buf);
      return true;
    }
  }
  free(buf);
  return false;
}

static bool choose_new_id(Doc *doc, layout_plugin_option_string_t *requested,
                          layout_plugin_string_t *base, const char *kind,
                          layout_plugin_string_t *out, Error *err) {
  memset(out, 0, sizeof(*out));
  if (requested->is_some) {
    if (str_empty(&requested->val)) {
      set_error(err,
                EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MISSING_CONTENT_ID,
                "new content-id is empty");
      return false;
    }
    if (id_exists(doc, &requested->val)) {
      set_error(
          err,
          EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_DUPLICATE_CONTENT_ID,
          "new content-id already exists");
      return false;
    }
    clone_string(out, &requested->val);
    return true;
  }
  if (!generated_unique_id(doc, base, kind, out)) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "failed to generate unique content-id");
    return false;
  }
  return true;
}

bool exports_gams_layout_layout_init_screen(
    exports_gams_layout_layout_init_screen_request_t *request, Response *ret,
    Error *err) {
  memset(ret, 0, sizeof(*ret));
  if (request->w <= 0 || request->h <= 0 || !valid_config(&request->config) ||
      str_empty(&request->root_content_id)) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "expected positive screen/config values and root-content-id");
    return false;
  }
  if (request->config.max_areas < 1) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_CAPACITY,
              "max-areas must be at least 1");
    return false;
  }

  Doc doc;
  memset(&doc, 0, sizeof(doc));
  doc.screen_w = request->w;
  doc.screen_h = request->h;
  doc.config = request->config;
  doc.generation = 1;
  doc.areas.ptr = calloc(1, sizeof(Area));
  if (!doc.areas.ptr) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "out-of-memory");
    return false;
  }
  doc.areas.len = 1;
  doc.areas.ptr[0].bounds.x0 = 0;
  doc.areas.ptr[0].bounds.y0 = 0;
  doc.areas.ptr[0].bounds.x1 = request->w;
  doc.areas.ptr[0].bounds.y1 = request->h;
  clone_string(&doc.areas.ptr[0].content_id, &request->root_content_id);
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_INIT_SCREEN);
  return true;
}

bool exports_gams_layout_layout_resize_screen(
    exports_gams_layout_layout_resize_screen_request_t *request, Response *ret,
    Error *err) {
  memset(ret, 0, sizeof(*ret));
  Doc doc;
  if (!clone_doc(&doc, &request->document, err))
    return false;
  if (!validate_doc(&doc, err)) {
    free_doc(&doc);
    return false;
  }
  if (request->w <= 0 || request->h <= 0 || request->handle_half_size <= 0) {
    free_doc(&doc);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "expected positive width, height and handle-half-size");
    return false;
  }

  int32_t old_w = doc.screen_w;
  int32_t old_h = doc.screen_h;
  for (size_t i = 0; i < doc.areas.len; i++) {
    Rect *a = &doc.areas.ptr[i].bounds;
    a->x0 = scale_i32(a->x0, request->w, old_w);
    a->y0 = scale_i32(a->y0, request->h, old_h);
    a->x1 = scale_i32(a->x1, request->w, old_w);
    a->y1 = scale_i32(a->y1, request->h, old_h);
  }
  for (size_t i = 0; i < doc.handles.len; i++) {
    Handle *h = &doc.handles.ptr[i];
    if (h->axis == AXIS_VERTICAL) {
      int32_t old_bx = (h->bounds.x0 + h->bounds.x1) / 2;
      int32_t new_bx = scale_i32(old_bx, request->w, old_w);
      h->bounds.x0 = new_bx;
      h->bounds.x1 = new_bx;
      h->bounds.y0 = scale_i32(h->bounds.y0, request->h, old_h);
      h->bounds.y1 = scale_i32(h->bounds.y1, request->h, old_h);
      h->row_y0 = scale_i32(h->row_y0, request->h, old_h);
      h->row_y1 = scale_i32(h->row_y1, request->h, old_h);
    } else {
      int32_t old_by = (h->bounds.y0 + h->bounds.y1) / 2;
      int32_t new_by = scale_i32(old_by, request->h, old_h);
      h->bounds.y0 = new_by;
      h->bounds.y1 = new_by;
      h->bounds.x0 = scale_i32(h->bounds.x0, request->w, old_w);
      h->bounds.x1 = scale_i32(h->bounds.x1, request->w, old_w);
      h->column_x0 = scale_i32(h->column_x0, request->w, old_w);
      h->column_x1 = scale_i32(h->column_x1, request->w, old_w);
    }
  }
  doc.screen_w = request->w;
  doc.screen_h = request->h;
  doc.config.handle_half_size = request->handle_half_size;
  for (size_t i = 0; i < doc.handles.len; i++)
    recompute_handle_rect_scoped(&doc, i);
  bump(&doc);
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_RESIZE_SCREEN);
  return true;
}

bool exports_gams_layout_layout_move_handle(
    exports_gams_layout_layout_move_handle_request_t *request, Response *ret,
    Error *err) {
  memset(ret, 0, sizeof(*ret));
  Doc doc;
  if (!clone_doc(&doc, &request->document, err))
    return false;
  if (!validate_doc(&doc, err)) {
    free_doc(&doc);
    return false;
  }
  int32_t hi = find_handle(&doc, &request->handle_content_id);
  if (hi < 0) {
    free_doc(&doc);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_HANDLE,
              "unknown handle-content-id");
    return false;
  }
  if (request->x < 0 || request->x > doc.screen_w || request->y < 0 ||
      request->y > doc.screen_h) {
    free_doc(&doc);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_OUT_OF_BOUNDS,
              "point outside screen");
    return false;
  }

  Handle *hnd = &doc.handles.ptr[hi];
  int32_t min = doc.config.min_panel_size;
  if (hnd->axis == AXIS_VERTICAL) {
    int32_t old_bx = (hnd->bounds.x0 + hnd->bounds.x1) / 2;
    int32_t row_y0 = hnd->row_y0, row_y1 = hnd->row_y1;
    if (row_y0 > row_y1) {
      int32_t t = row_y0;
      row_y0 = row_y1;
      row_y1 = t;
    }
    if (row_y0 < 0)
      row_y0 = 0;
    if (row_y1 > doc.screen_h)
      row_y1 = doc.screen_h;
    int32_t x = request->x;
    int32_t clamp_lo = 0, clamp_hi = doc.screen_w;
    for (size_t i = 0; i < doc.areas.len; i++) {
      Rect *a = &doc.areas.ptr[i].bounds;
      if (a->y0 < row_y0 || a->y1 > row_y1)
        continue;
      if (a->x1 == old_bx && a->x0 + min > clamp_lo)
        clamp_lo = a->x0 + min;
      if (a->x0 == old_bx && a->x1 - min < clamp_hi)
        clamp_hi = a->x1 - min;
    }
    if (x < clamp_lo)
      x = clamp_lo;
    if (x > clamp_hi)
      x = clamp_hi;
    for (size_t i = 0; i < doc.areas.len; i++) {
      Rect *a = &doc.areas.ptr[i].bounds;
      if (a->y0 < row_y0 || a->y1 > row_y1)
        continue;
      if (a->x1 == old_bx)
        a->x1 = x;
      if (a->x0 == old_bx)
        a->x0 = x;
    }
    for (size_t i = 0; i < doc.handles.len; i++) {
      Handle *h = &doc.handles.ptr[i];
      if (h->axis != AXIS_HORIZONTAL)
        continue;
      int32_t by = (h->bounds.y0 + h->bounds.y1) / 2;
      if (by < row_y0 || by > row_y1)
        continue;
      if (h->column_x0 == old_bx)
        h->column_x0 = x;
      if (h->column_x1 == old_bx)
        h->column_x1 = x;
    }
    hnd->bounds.x0 = x - doc.config.handle_half_size;
    hnd->bounds.x1 = x + doc.config.handle_half_size;
  } else {
    int32_t old_by = (hnd->bounds.y0 + hnd->bounds.y1) / 2;
    int32_t col_x0 = hnd->column_x0, col_x1 = hnd->column_x1;
    if (col_x0 > col_x1) {
      int32_t t = col_x0;
      col_x0 = col_x1;
      col_x1 = t;
    }
    if (col_x0 < 0)
      col_x0 = 0;
    if (col_x1 > doc.screen_w)
      col_x1 = doc.screen_w;
    int32_t y = request->y;
    int32_t clamp_lo = 0, clamp_hi = doc.screen_h;
    for (size_t i = 0; i < doc.areas.len; i++) {
      Rect *a = &doc.areas.ptr[i].bounds;
      if (a->x0 < col_x0 || a->x1 > col_x1)
        continue;
      if (a->y1 == old_by && a->y0 + min > clamp_lo)
        clamp_lo = a->y0 + min;
      if (a->y0 == old_by && a->y1 - min < clamp_hi)
        clamp_hi = a->y1 - min;
    }
    if (y < clamp_lo)
      y = clamp_lo;
    if (y > clamp_hi)
      y = clamp_hi;
    for (size_t i = 0; i < doc.areas.len; i++) {
      Rect *a = &doc.areas.ptr[i].bounds;
      if (a->x0 < col_x0 || a->x1 > col_x1)
        continue;
      if (a->y1 == old_by)
        a->y1 = y;
      if (a->y0 == old_by)
        a->y0 = y;
    }
    for (size_t i = 0; i < doc.handles.len; i++) {
      Handle *h = &doc.handles.ptr[i];
      if (h->axis != AXIS_VERTICAL)
        continue;
      int32_t bx = (h->bounds.x0 + h->bounds.x1) / 2;
      if (bx < col_x0 || bx > col_x1)
        continue;
      if (h->row_y0 == old_by)
        h->row_y0 = y;
      if (h->row_y1 == old_by)
        h->row_y1 = y;
    }
    hnd->bounds.y0 = y - doc.config.handle_half_size;
    hnd->bounds.y1 = y + doc.config.handle_half_size;
  }

  for (size_t i = 0; i < doc.handles.len; i++)
    recompute_handle_rect_scoped(&doc, i);
  bump(&doc);
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_MOVE_HANDLE);
  return true;
}

static bool do_corner(Doc *doc, layout_plugin_string_t *area_id,
                      uint32_t corner_index, int32_t x, int32_t y,
                      layout_plugin_option_string_t *new_area_id,
                      layout_plugin_option_string_t *new_handle_id, bool mutate,
                      Error *err) {
  int32_t ai = find_area(doc, area_id);
  if (ai < 0) {
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_AREA,
              "unknown area-content-id");
    return false;
  }
  if (corner_index > 3) {
    if (!mutate)
      set_preview_from_area(doc, ai);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_CORNER,
              "corner-index must be 0..3");
    return false;
  }
  if (x < 0 || x >= doc->screen_w || y < 0 || y >= doc->screen_h) {
    if (!mutate)
      set_preview_from_area(doc, ai);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_OUT_OF_BOUNDS,
              "point outside screen");
    return false;
  }

  if (!point_in_area(doc, (size_t)ai, x, y)) {
    int32_t tgt = -1;
    for (size_t i = 0; i < doc->areas.len; i++) {
      if ((int32_t)i == ai)
        continue;
      if (point_in_area(doc, i, x, y)) {
        tgt = (int32_t)i;
        break;
      }
    }
    if (tgt < 0) {
      if (!mutate)
        set_preview_from_area(doc, ai);
      set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_OUT_OF_BOUNDS,
                "target point is not inside any area");
      return false;
    }
    Rect preview;
    int32_t m =
        mutate ? simple_merge(doc, (size_t)ai, (size_t)tgt)
               : simple_merge_preview(doc, (size_t)ai, (size_t)tgt, &preview);
    if (m == LAYOUT_OK) {
      if (!mutate)
        set_preview(doc, true, preview.x0, preview.y0, preview.x1, preview.y1);
      return true;
    }
    if (!mutate)
      set_preview_from_area(doc, ai);
    set_error(err, (exports_gams_layout_layout_layout_error_code_t)m,
              "areas are not simply mergeable");
    return false;
  }

  if (doc->areas.len >= doc->config.max_areas ||
      doc->handles.len >= doc->config.max_handles) {
    if (!mutate)
      set_preview_from_area(doc, ai);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_CAPACITY,
              "layout capacity reached");
    return false;
  }

  Rect src = doc->areas.ptr[ai].bounds;
  int32_t cx, cy;
  switch (corner_index) {
  case 0:
    cx = src.x0;
    cy = src.y0;
    break;
  case 1:
    cx = src.x1;
    cy = src.y0;
    break;
  case 2:
    cx = src.x1;
    cy = src.y1;
    break;
  default:
    cx = src.x0;
    cy = src.y1;
    break;
  }
  int32_t axis =
      abs_i32(y - cy) > abs_i32(x - cx) ? AXIS_HORIZONTAL : AXIS_VERTICAL;
  int32_t min = doc->config.min_panel_size;

  if (!mutate) {
    if (axis == AXIS_VERTICAL) {
      int32_t split_x = x;
      if (split_x - src.x0 < min)
        split_x = src.x0 + min;
      if (src.x1 - split_x < min)
        split_x = src.x1 - min;
      if (split_x <= src.x0 || split_x >= src.x1) {
        set_preview_from_area(doc, ai);
        set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MIN_SIZE,
                  "split violates min-panel-size");
        return false;
      }
      if (corner_index == 0 || corner_index == 3)
        set_preview(doc, true, src.x0, src.y0, split_x, src.y1);
      else
        set_preview(doc, true, split_x, src.y0, src.x1, src.y1);
    } else {
      int32_t split_y = y;
      if (split_y - src.y0 < min)
        split_y = src.y0 + min;
      if (src.y1 - split_y < min)
        split_y = src.y1 - min;
      if (split_y <= src.y0 || split_y >= src.y1) {
        set_preview_from_area(doc, ai);
        set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MIN_SIZE,
                  "split violates min-panel-size");
        return false;
      }
      if (corner_index == 0 || corner_index == 1)
        set_preview(doc, true, src.x0, src.y0, src.x1, split_y);
      else
        set_preview(doc, true, src.x0, split_y, src.x1, src.y1);
    }
    return true;
  }

  layout_plugin_string_t area_new_id, handle_new_id;
  if (!choose_new_id(doc, new_area_id, &doc->areas.ptr[ai].content_id, "_1",
                     &area_new_id, err))
    return false;
  if (!choose_new_id(doc, new_handle_id, &doc->areas.ptr[ai].content_id,
                     "_handle", &handle_new_id, err)) {
    layout_plugin_string_free(&area_new_id);
    return false;
  }

  Area *next_areas =
      realloc(doc->areas.ptr, (doc->areas.len + 1) * sizeof(Area));
  if (!next_areas) {
    layout_plugin_string_free(&area_new_id);
    layout_plugin_string_free(&handle_new_id);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "out-of-memory");
    return false;
  }
  doc->areas.ptr = next_areas;
  Handle *next_handles =
      realloc(doc->handles.ptr, (doc->handles.len + 1) * sizeof(Handle));
  if (!next_handles) {
    layout_plugin_string_free(&area_new_id);
    layout_plugin_string_free(&handle_new_id);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_ARG,
              "out-of-memory");
    return false;
  }
  doc->handles.ptr = next_handles;

  size_t new_idx = doc->areas.len;
  size_t hnd_idx = doc->handles.len;
  memset(&doc->areas.ptr[new_idx], 0, sizeof(Area));
  memset(&doc->handles.ptr[hnd_idx], 0, sizeof(Handle));
  doc->areas.ptr[new_idx].content_id = area_new_id;
  doc->handles.ptr[hnd_idx].content_id = handle_new_id;

  int32_t hs = doc->config.handle_half_size;
  if (axis == AXIS_VERTICAL) {
    int32_t split_x = x;
    if (split_x - src.x0 < min)
      split_x = src.x0 + min;
    if (src.x1 - split_x < min)
      split_x = src.x1 - min;
    if (split_x <= src.x0 || split_x >= src.x1) {
      set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MIN_SIZE,
                "split violates min-panel-size");
      return false;
    }
    doc->areas.ptr[ai].bounds.x1 = split_x;
    doc->areas.ptr[new_idx].bounds = (Rect){split_x, src.y0, src.x1, src.y1};
    doc->handles.ptr[hnd_idx].bounds =
        (Rect){split_x - hs, src.y0, split_x + hs, src.y1};
    doc->handles.ptr[hnd_idx].axis = AXIS_VERTICAL;
    doc->handles.ptr[hnd_idx].column_x0 = split_x;
    doc->handles.ptr[hnd_idx].column_x1 = split_x;
    doc->handles.ptr[hnd_idx].row_y0 = src.y0;
    doc->handles.ptr[hnd_idx].row_y1 = src.y1;
  } else {
    int32_t split_y = y;
    if (split_y - src.y0 < min)
      split_y = src.y0 + min;
    if (src.y1 - split_y < min)
      split_y = src.y1 - min;
    if (split_y <= src.y0 || split_y >= src.y1) {
      set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MIN_SIZE,
                "split violates min-panel-size");
      return false;
    }
    doc->areas.ptr[ai].bounds.y1 = split_y;
    doc->areas.ptr[new_idx].bounds = (Rect){src.x0, split_y, src.x1, src.y1};
    doc->handles.ptr[hnd_idx].bounds =
        (Rect){src.x0, split_y - hs, src.x1, split_y + hs};
    doc->handles.ptr[hnd_idx].axis = AXIS_HORIZONTAL;
    doc->handles.ptr[hnd_idx].column_x0 = src.x0;
    doc->handles.ptr[hnd_idx].column_x1 = src.x1;
    doc->handles.ptr[hnd_idx].row_y0 = split_y;
    doc->handles.ptr[hnd_idx].row_y1 = split_y;
  }
  doc->areas.len++;
  doc->handles.len++;
  recompute_handle_rect_scoped(doc, hnd_idx);
  return true;
}

bool exports_gams_layout_layout_move_corner(
    exports_gams_layout_layout_move_corner_request_t *request, Response *ret,
    Error *err) {
  memset(ret, 0, sizeof(*ret));
  Doc doc;
  if (!clone_doc(&doc, &request->document, err))
    return false;
  if (!validate_doc(&doc, err)) {
    free_doc(&doc);
    return false;
  }
  if (!do_corner(&doc, &request->area_content_id, request->corner_index,
                 request->x, request->y, &request->new_area_content_id,
                 &request->new_handle_content_id, true, err)) {
    free_doc(&doc);
    return false;
  }
  bump(&doc);
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_MOVE_CORNER);
  return true;
}

bool exports_gams_layout_layout_try_corner(
    exports_gams_layout_layout_try_corner_request_t *request, Response *ret,
    Error *err) {
  memset(ret, 0, sizeof(*ret));
  Doc doc;
  if (!clone_doc(&doc, &request->document, err))
    return false;
  if (!validate_doc(&doc, err)) {
    free_doc(&doc);
    return false;
  }
  layout_plugin_option_string_t none = {0};
  bool ok = do_corner(&doc, &request->area_content_id, request->corner_index,
                      request->x, request->y, &none, &none, false, err);
  if (!ok) {
    free_doc(&doc);
    return false;
  }
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_TRY_CORNER);
  return true;
}

bool exports_gams_layout_layout_rename_area_content(
    exports_gams_layout_layout_rename_area_content_request_t *request,
    Response *ret, Error *err) {
  memset(ret, 0, sizeof(*ret));
  Doc doc;
  if (!clone_doc(&doc, &request->document, err))
    return false;
  if (!validate_doc(&doc, err)) {
    free_doc(&doc);
    return false;
  }
  int32_t ai = find_area(&doc, &request->area_content_id);
  if (ai < 0) {
    free_doc(&doc);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_AREA,
              "unknown area-content-id");
    return false;
  }
  if (str_empty(&request->new_content_id)) {
    free_doc(&doc);
    set_error(err,
              EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MISSING_CONTENT_ID,
              "new content-id is empty");
    return false;
  }
  if (!str_eq(&request->area_content_id, &request->new_content_id) &&
      id_exists(&doc, &request->new_content_id)) {
    free_doc(&doc);
    set_error(err,
              EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_DUPLICATE_CONTENT_ID,
              "new content-id already exists");
    return false;
  }
  layout_plugin_string_free(&doc.areas.ptr[ai].content_id);
  clone_string(&doc.areas.ptr[ai].content_id, &request->new_content_id);
  bump(&doc);
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_RENAME_AREA_CONTENT);
  return true;
}

bool exports_gams_layout_layout_rename_handle_content(
    exports_gams_layout_layout_rename_handle_content_request_t *request,
    Response *ret, Error *err) {
  memset(ret, 0, sizeof(*ret));
  Doc doc;
  if (!clone_doc(&doc, &request->document, err))
    return false;
  if (!validate_doc(&doc, err)) {
    free_doc(&doc);
    return false;
  }
  int32_t hi = find_handle(&doc, &request->handle_content_id);
  if (hi < 0) {
    free_doc(&doc);
    set_error(err, EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_INVALID_HANDLE,
              "unknown handle-content-id");
    return false;
  }
  if (str_empty(&request->new_content_id)) {
    free_doc(&doc);
    set_error(err,
              EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_MISSING_CONTENT_ID,
              "new content-id is empty");
    return false;
  }
  if (!str_eq(&request->handle_content_id, &request->new_content_id) &&
      id_exists(&doc, &request->new_content_id)) {
    free_doc(&doc);
    set_error(err,
              EXPORTS_GAMS_LAYOUT_LAYOUT_LAYOUT_ERROR_CODE_DUPLICATE_CONTENT_ID,
              "new content-id already exists");
    return false;
  }
  layout_plugin_string_free(&doc.handles.ptr[hi].content_id);
  clone_string(&doc.handles.ptr[hi].content_id, &request->new_content_id);
  bump(&doc);
  finish(ret, &doc, EXPORTS_GAMS_LAYOUT_LAYOUT_ACTION_RENAME_HANDLE_CONTENT);
  return true;
}
