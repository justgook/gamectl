#include "aseprite_plugin.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <limits.h>

#define STBI_ASSERT(x) ((void)0)
#define STBI_NO_STDIO
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

typedef exports_gams_aseprite_aseprite_document_t document_t;
typedef exports_gams_aseprite_aseprite_rgba8_t rgba_t;

typedef struct byte_list_t { uint8_t *ptr; size_t len; } byte_list_t;
typedef struct string_t { char *ptr; size_t len; } string_t;

typedef struct palette_color_t { rgba_t color; string_t name; bool has_name; } palette_color_t;
typedef struct palette_t { bool present; uint32_t size, first, last; palette_color_t *colors; } palette_t;

typedef struct layer_t { uint16_t flags, type, child_level, blend_mode; uint8_t opacity; uint32_t tileset_index; bool has_tileset_index; string_t name; } layer_t;
typedef struct cel_t { uint16_t layer_index; int16_t x, y, z_index; uint8_t opacity; uint16_t cel_type, w, h, link; byte_list_t data; uint16_t bits_per_tile; uint32_t mask_tile_id, mask_x_flip, mask_y_flip, mask_rotation; } cel_t;
typedef struct frame_t { uint32_t bytes_in_frame, chunks; uint16_t duration_ms; cel_t *cels; size_t cel_count, cel_cap; } frame_t;
typedef struct tag_t { uint16_t from, to, repeat; uint8_t direction; rgba_t color; string_t name; } tag_t;
typedef struct slice_key_t { uint32_t frame, width, height; int32_t x, y; bool has_patch, has_pivot; exports_gams_aseprite_aseprite_rect_t patch; exports_gams_aseprite_aseprite_point_t pivot; } slice_key_t;
typedef struct slice_t { string_t name; slice_key_t *keys; size_t key_count; } slice_t;
typedef struct tileset_t { uint32_t id, flags, tile_count; uint16_t tile_width, tile_height; uint32_t external_file_id, external_tileset_id; bool has_external; byte_list_t data; string_t name; } tileset_t;

struct exports_gams_aseprite_aseprite_document_t {
  uint32_t file_size, num_frames, width, height;
  uint16_t color_depth, num_colors;
  uint8_t palette_index, pixel_ratio_width, pixel_ratio_height;
  string_t name;
  palette_t palette;
  layer_t *layers; size_t layer_count, layer_cap;
  frame_t *frames; size_t frame_count, frame_cap;
  tag_t *tags; size_t tag_count, tag_cap;
  slice_t *slices; size_t slice_count, slice_cap;
  tileset_t *tilesets; size_t tileset_count, tileset_cap;
};

typedef struct reader_t { const uint8_t *ptr; size_t len, offset; char error[160]; } reader_t;

static void set_error(aseprite_plugin_string_t *err, const char *message) { aseprite_plugin_string_dup(err, message); }
static bool fail(reader_t *r, const char *message) { if (!r->error[0]) { strncpy(r->error, message, sizeof(r->error)-1); r->error[sizeof(r->error)-1] = 0; } return false; }
static bool ensure(reader_t *r, size_t n) { return r->offset <= r->len && n <= r->len - r->offset ? true : fail(r, "unexpected end of Aseprite file"); }
static bool read_u8(reader_t *r, uint8_t *v) { if (!ensure(r,1)) return false; *v = r->ptr[r->offset++]; return true; }
static bool read_u16(reader_t *r, uint16_t *v) { if (!ensure(r,2)) return false; *v = (uint16_t)(r->ptr[r->offset] | (r->ptr[r->offset+1] << 8)); r->offset += 2; return true; }
static bool read_i16(reader_t *r, int16_t *v) { uint16_t u; if (!read_u16(r,&u)) return false; *v = (int16_t)u; return true; }
static bool read_u32(reader_t *r, uint32_t *v) { if (!ensure(r,4)) return false; *v = (uint32_t)r->ptr[r->offset] | ((uint32_t)r->ptr[r->offset+1]<<8) | ((uint32_t)r->ptr[r->offset+2]<<16) | ((uint32_t)r->ptr[r->offset+3]<<24); r->offset += 4; return true; }
static bool read_i32(reader_t *r, int32_t *v) { uint32_t u; if (!read_u32(r,&u)) return false; *v = (int32_t)u; return true; }
static bool skip(reader_t *r, size_t n) { if (!ensure(r,n)) return false; r->offset += n; return true; }

static bool copy_bytes(reader_t *r, size_t n, byte_list_t *out) {
  out->ptr = NULL; out->len = 0;
  if (!ensure(r, n)) return false;
  if (n == 0) return true;
  out->ptr = malloc(n); if (!out->ptr) return fail(r, "out of memory");
  memcpy(out->ptr, r->ptr + r->offset, n); out->len = n; r->offset += n; return true;
}

static bool read_string(reader_t *r, string_t *out) {
  uint16_t len; if (!read_u16(r, &len)) return false; if (!ensure(r, len)) return false;
  out->ptr = malloc((size_t)len + 1); if (!out->ptr) return fail(r, "out of memory");
  memcpy(out->ptr, r->ptr + r->offset, len); out->ptr[len] = 0; out->len = len; r->offset += len; return true;
}

static string_t dup_string_bytes(const uint8_t *ptr, size_t len) { string_t s = {0}; s.ptr = malloc(len + 1); if (s.ptr) { memcpy(s.ptr, ptr, len); s.ptr[len] = 0; s.len = len; } return s; }
static void return_string(aseprite_plugin_string_t *out, const string_t *s) { out->ptr = NULL; out->len = 0; if (s->len) aseprite_plugin_string_set(out, s->ptr); else aseprite_plugin_string_set(out, ""); }

#define PUSH(doc, arr, count, cap, value) do { \
  if ((doc)->count == (doc)->cap) { size_t nc = (doc)->cap ? (doc)->cap * 2u : 8u; void *np = realloc((doc)->arr, nc * sizeof(*(doc)->arr)); if (!np) return false; (doc)->arr = np; (doc)->cap = nc; } \
  (doc)->arr[(doc)->count++] = (value); \
} while (0)

static bool frame_push_cel(frame_t *f, cel_t cel) { if (f->cel_count == f->cel_cap) { size_t nc = f->cel_cap ? f->cel_cap * 2u : 8u; cel_t *np = realloc(f->cels, nc * sizeof(*np)); if (!np) return false; f->cels = np; f->cel_cap = nc; } f->cels[f->cel_count++] = cel; return true; }

static byte_list_t inflate_zlib(const uint8_t *bytes, size_t len, reader_t *r) {
  byte_list_t out = {0};
  if (len > (size_t)INT32_MAX) { fail(r, "compressed Aseprite chunk too large"); return out; }
  int out_len = 0;
  char *decoded = stbi_zlib_decode_malloc((const char *)bytes, (int)len, &out_len);
  if (!decoded || out_len < 0) { fail(r, "failed to inflate Aseprite compressed chunk"); return out; }
  out.ptr = (uint8_t *)decoded; out.len = (size_t)out_len; return out;
}

static exports_gams_aseprite_aseprite_color_depth_t color_depth_enum(uint16_t depth) {
  if (depth == 8) return EXPORTS_GAMS_ASEPRITE_ASEPRITE_COLOR_DEPTH_INDEXED8;
  if (depth == 16) return EXPORTS_GAMS_ASEPRITE_ASEPRITE_COLOR_DEPTH_GRAYSCALE16;
  return EXPORTS_GAMS_ASEPRITE_ASEPRITE_COLOR_DEPTH_RGBA32;
}
static exports_gams_aseprite_aseprite_cel_type_t cel_type_enum(uint16_t type) { return type == 1 ? EXPORTS_GAMS_ASEPRITE_ASEPRITE_CEL_TYPE_LINKED : type == 2 ? EXPORTS_GAMS_ASEPRITE_ASEPRITE_CEL_TYPE_COMPRESSED : type == 3 ? EXPORTS_GAMS_ASEPRITE_ASEPRITE_CEL_TYPE_TILEMAP : EXPORTS_GAMS_ASEPRITE_ASEPRITE_CEL_TYPE_RAW; }

static bool parse_layer(document_t *doc, reader_t *r) {
  layer_t l; memset(&l, 0, sizeof(l));
  if (!read_u16(r,&l.flags) || !read_u16(r,&l.type) || !read_u16(r,&l.child_level) || !skip(r,4) || !read_u16(r,&l.blend_mode) || !read_u8(r,&l.opacity) || !skip(r,3) || !read_string(r,&l.name)) return false;
  if (l.type == 2) { if (!read_u32(r,&l.tileset_index)) return false; l.has_tileset_index = true; }
  PUSH(doc, layers, layer_count, layer_cap, l); return true;
}

static bool parse_tags(document_t *doc, reader_t *r) {
  uint16_t n; if (!read_u16(r,&n) || !skip(r,8)) return false;
  for (uint16_t i=0;i<n;i++) { tag_t t; memset(&t,0,sizeof(t)); uint8_t dir, rr, gg, bb; if (!read_u16(r,&t.from)||!read_u16(r,&t.to)||!read_u8(r,&dir)||!read_u16(r,&t.repeat)||!skip(r,6)||!read_u8(r,&rr)||!read_u8(r,&gg)||!read_u8(r,&bb)||!skip(r,1)||!read_string(r,&t.name)) return false; t.direction=dir; t.color=(rgba_t){rr,gg,bb,255}; PUSH(doc,tags,tag_count,tag_cap,t); }
  return true;
}

static bool parse_palette(document_t *doc, reader_t *r) {
  palette_t *p = &doc->palette; p->present = true;
  if (!read_u32(r,&p->size)||!read_u32(r,&p->first)||!read_u32(r,&p->last)||!skip(r,8)) return false;
  p->colors = calloc(p->size ? p->size : 1, sizeof(*p->colors)); if (!p->colors) return fail(r,"out of memory");
  for (uint32_t i=p->first;i<=p->last && i<p->size;i++) { uint16_t flag; if (!read_u16(r,&flag)) return false; palette_color_t *c=&p->colors[i]; if (!read_u8(r,&c->color.r)||!read_u8(r,&c->color.g)||!read_u8(r,&c->color.b)||!read_u8(r,&c->color.a)) return false; if (flag & 1) { if (!read_string(r,&c->name)) return false; c->has_name = true; } }
  return true;
}

static bool parse_slice(document_t *doc, reader_t *r) {
  uint32_t n, flags; slice_t s; memset(&s,0,sizeof(s));
  if (!read_u32(r,&n)||!read_u32(r,&flags)||!skip(r,4)||!read_string(r,&s.name)) return false;
  s.keys = calloc(n ? n : 1, sizeof(*s.keys)); if (!s.keys) return fail(r,"out of memory"); s.key_count = n;
  for (uint32_t i=0;i<n;i++) { slice_key_t *k=&s.keys[i]; if (!read_u32(r,&k->frame)||!read_i32(r,&k->x)||!read_i32(r,&k->y)||!read_u32(r,&k->width)||!read_u32(r,&k->height)) return false; if (flags&1) { k->has_patch=true; if (!read_i32(r,&k->patch.x)||!read_i32(r,&k->patch.y)||!read_u32(r,&k->patch.width)||!read_u32(r,&k->patch.height)) return false; } if (flags&2) { k->has_pivot=true; if (!read_i32(r,&k->pivot.x)||!read_i32(r,&k->pivot.y)) return false; } }
  PUSH(doc,slices,slice_count,slice_cap,s); return true;
}

static bool parse_tileset(document_t *doc, reader_t *r) {
  tileset_t ts; memset(&ts,0,sizeof(ts));
  if (!read_u32(r,&ts.id)||!read_u32(r,&ts.flags)||!read_u32(r,&ts.tile_count)||!read_u16(r,&ts.tile_width)||!read_u16(r,&ts.tile_height)||!skip(r,16)||!read_string(r,&ts.name)) return false;
  if (ts.flags&1) { ts.has_external=true; if (!read_u32(r,&ts.external_file_id)||!read_u32(r,&ts.external_tileset_id)) return false; }
  if (ts.flags&2) { uint32_t len; byte_list_t comp; if (!read_u32(r,&len)||!copy_bytes(r,len,&comp)) return false; ts.data = inflate_zlib(comp.ptr, comp.len, r); free(comp.ptr); if (r->error[0]) return false; }
  PUSH(doc,tilesets,tileset_count,tileset_cap,ts); return true;
}

static bool parse_color_profile(reader_t *r) { uint16_t type; uint32_t len; if (!read_u16(r,&type)||!skip(r,2)||!skip(r,4)||!skip(r,8)) return false; if (type==2) { if(!read_u32(r,&len)||!skip(r,len)) return false; } return true; }

static bool parse_cel(frame_t *frame, reader_t *r, uint32_t chunk_size) {
  cel_t c; memset(&c,0,sizeof(c));
  if (!read_u16(r,&c.layer_index)||!read_i16(r,&c.x)||!read_i16(r,&c.y)||!read_u8(r,&c.opacity)||!read_u16(r,&c.cel_type)||!read_i16(r,&c.z_index)||!skip(r,5)) return false;
  if (c.cel_type == 1) { if (!read_u16(r,&c.link)) return false; return frame_push_cel(frame,c) ? true : fail(r,"out of memory"); }
  if (!read_u16(r,&c.w)||!read_u16(r,&c.h)) return false;
  if (c.cel_type == 0 || c.cel_type == 2) { byte_list_t comp; if (chunk_size < 26 || !copy_bytes(r, chunk_size - 26, &comp)) return false; if (c.cel_type == 2) { c.data = inflate_zlib(comp.ptr, comp.len, r); free(comp.ptr); if (r->error[0]) return false; } else c.data = comp; }
  else if (c.cel_type == 3) { byte_list_t comp; if (chunk_size < 54) return fail(r,"invalid Aseprite tilemap cel chunk"); if (!read_u16(r,&c.bits_per_tile)||!read_u32(r,&c.mask_tile_id)||!read_u32(r,&c.mask_x_flip)||!read_u32(r,&c.mask_y_flip)||!read_u32(r,&c.mask_rotation)||!skip(r,10)||!copy_bytes(r, chunk_size - 54, &comp)) return false; c.data = inflate_zlib(comp.ptr, comp.len, r); free(comp.ptr); if (r->error[0]) return false; }
  else return fail(r,"unsupported Aseprite cel type");
  return frame_push_cel(frame,c) ? true : fail(r,"out of memory");
}

static bool parse_frame(document_t *doc, reader_t *r) {
  frame_t f; memset(&f,0,sizeof(f)); uint16_t magic, old_chunks; uint32_t new_chunks;
  if (!read_u32(r,&f.bytes_in_frame)||!read_u16(r,&magic)) return false; if (magic != 0xf1fa) return fail(r,"invalid Aseprite frame magic");
  if (!read_u16(r,&old_chunks)||!read_u16(r,&f.duration_ms)||!skip(r,2)||!read_u32(r,&new_chunks)) return false; f.chunks = new_chunks ? new_chunks : old_chunks;
  for (uint32_t i=0;i<f.chunks;i++) { uint32_t chunk_size; uint16_t type; size_t start = r->offset; if (!read_u32(r,&chunk_size)||!read_u16(r,&type)) return false;
    bool ok = true; if (type==0x2004) ok=parse_layer(doc,r); else if (type==0x2005) ok=parse_cel(&f,r,chunk_size); else if (type==0x2007) ok=parse_color_profile(r); else if (type==0x2018) ok=parse_tags(doc,r); else if (type==0x2019) ok=parse_palette(doc,r); else if (type==0x2022) ok=parse_slice(doc,r); else if (type==0x2023) ok=parse_tileset(doc,r);
    if (!ok) return false; size_t end = start + chunk_size; if (r->offset > end) return fail(r,"Aseprite chunk over-read"); r->offset = end; }
  PUSH(doc,frames,frame_count,frame_cap,f); return true;
}

static bool resolve_links(document_t *doc, reader_t *r) {
  for (size_t fi=0; fi<doc->frame_count; fi++) for (size_t ci=0; ci<doc->frames[fi].cel_count; ci++) { cel_t *c=&doc->frames[fi].cels[ci]; if (c->cel_type != 1) continue; if (c->link >= doc->frame_count) return fail(r,"linked Aseprite cel references missing frame"); frame_t *lf=&doc->frames[c->link]; cel_t *src=NULL; for (size_t si=0; si<lf->cel_count; si++) if (lf->cels[si].layer_index == c->layer_index) { src=&lf->cels[si]; break; } if (!src) return fail(r,"linked Aseprite cel references missing layer"); c->w=src->w; c->h=src->h; c->data=src->data; c->bits_per_tile=src->bits_per_tile; c->mask_tile_id=src->mask_tile_id; c->mask_x_flip=src->mask_x_flip; c->mask_y_flip=src->mask_y_flip; c->mask_rotation=src->mask_rotation; }
  return true;
}

static document_t *parse_document(const uint8_t *bytes, size_t len, const uint8_t *name, size_t name_len, char *err, size_t err_len) {
  reader_t r = { bytes, len, 0, {0} }; document_t *doc = calloc(1,sizeof(*doc)); if (!doc) { strncpy(err,"out of memory",err_len-1); return NULL; } doc->name = dup_string_bytes(name,name_len);
  uint16_t magic; if (!read_u32(&r,&doc->file_size)||!read_u16(&r,&magic)) goto bad; if (magic != 0xa5e0) { fail(&r,"invalid Aseprite file magic"); goto bad; }
  uint16_t nf,w,h,depth; if (!read_u16(&r,&nf)||!read_u16(&r,&w)||!read_u16(&r,&h)||!read_u16(&r,&depth)||!skip(&r,14)||!read_u8(&r,&doc->palette_index)||!skip(&r,3)||!read_u16(&r,&doc->num_colors)||!read_u8(&r,&doc->pixel_ratio_width)||!read_u8(&r,&doc->pixel_ratio_height)||!skip(&r,92)) goto bad;
  doc->num_frames=nf; doc->width=w; doc->height=h; doc->color_depth=depth; if (!(depth==8 || depth==16 || depth==32)) { fail(&r,"unsupported Aseprite color depth"); goto bad; }
  for (uint32_t i=0;i<doc->num_frames;i++) if (!parse_frame(doc,&r)) goto bad; if (!resolve_links(doc,&r)) goto bad; return doc;
bad: strncpy(err, r.error[0] ? r.error : "failed to parse Aseprite file", err_len-1); exports_gams_aseprite_aseprite_document_destructor(doc); return NULL;
}

static bool get_cel(document_t *doc, uint32_t frame_index, uint32_t cel_index, frame_t **frame, cel_t **cel, aseprite_plugin_string_t *err) { if (frame_index >= doc->frame_count) { set_error(err,"Aseprite frame index out of range"); return false; } *frame=&doc->frames[frame_index]; if (cel_index >= (*frame)->cel_count) { set_error(err,"Aseprite cel index out of range"); return false; } *cel=&(*frame)->cels[cel_index]; return true; }

static bool cel_to_rgba(document_t *doc, cel_t *cel, uint8_t **out, size_t *out_len, const char **err) {
  if (cel->cel_type == 3) { *err="tilemap cels cannot be converted directly to RGBA"; return false; }
  size_t pixels = (size_t)cel->w * cel->h; if (pixels > SIZE_MAX/4) { *err="Aseprite cel too large"; return false; }
  uint8_t *rgba = calloc(pixels ? pixels*4 : 1, 1); if (!rgba) { *err="out of memory"; return false; }
  if (doc->color_depth == 32) { if (cel->data.len < pixels*4) { free(rgba); *err="Aseprite RGBA cel data too short"; return false; } memcpy(rgba, cel->data.ptr, pixels*4); }
  else if (doc->color_depth == 16) { if (cel->data.len < pixels*2) { free(rgba); *err="Aseprite grayscale cel data too short"; return false; } for (size_t i=0;i<pixels;i++) { uint8_t g=cel->data.ptr[i*2]; rgba[i*4]=g; rgba[i*4+1]=g; rgba[i*4+2]=g; rgba[i*4+3]=cel->data.ptr[i*2+1]; } }
  else { if (!doc->palette.present) { free(rgba); *err="indexed Aseprite file has no palette"; return false; } if (cel->data.len < pixels) { free(rgba); *err="Aseprite indexed cel data too short"; return false; } for (size_t i=0;i<pixels;i++) { uint8_t pi=cel->data.ptr[i]; if (pi >= doc->palette.size) { free(rgba); *err="Aseprite palette index out of range"; return false; } palette_color_t *c=&doc->palette.colors[pi]; rgba[i*4]=c->color.r; rgba[i*4+1]=c->color.g; rgba[i*4+2]=c->color.b; rgba[i*4+3]=(pi==doc->palette_index)?0:c->color.a; } }
  *out=rgba; *out_len=pixels*4; return true;
}

static void blend(uint8_t *dst, uint8_t r, uint8_t g, uint8_t b, double a) { double sa=a/255.0; if(sa<=0)return; double da=dst[3]/255.0; double oa=sa+da*(1-sa); if(oa<=0)return; dst[0]=(uint8_t)((r*sa+dst[0]*da*(1-sa))/oa+0.5); dst[1]=(uint8_t)((g*sa+dst[1]*da*(1-sa))/oa+0.5); dst[2]=(uint8_t)((b*sa+dst[2]*da*(1-sa))/oa+0.5); dst[3]=(uint8_t)(oa*255+0.5); }

typedef struct render_order_t { cel_t *cel; int32_t order; int16_t z; } render_order_t;
static int compare_render_order(const void *a, const void *b) { const render_order_t *aa=(const render_order_t *)a; const render_order_t *bb=(const render_order_t *)b; if(aa->order < bb->order) return -1; if(aa->order > bb->order) return 1; if(aa->z < bb->z) return -1; if(aa->z > bb->z) return 1; return 0; }

bool exports_gams_aseprite_aseprite_parse_bytes(aseprite_plugin_string_t *name, aseprite_plugin_list_u8_t *data, exports_gams_aseprite_aseprite_own_document_t *ret, aseprite_plugin_string_t *err) { char msg[160]={0}; document_t *doc=parse_document(data->ptr,data->len,name->ptr,name->len,msg,sizeof(msg)); if(!doc){set_error(err,msg);return false;} *ret=exports_gams_aseprite_aseprite_document_new(doc); return true; }

// WASI filesystem helpers copied in shape from image.comp.
static bool string_eq_bytes(const uint8_t *ptr, size_t len, const char *literal) { size_t ll=strlen(literal); return len==ll && memcmp(ptr,literal,len)==0; }
static bool resolve_wasi_path(aseprite_plugin_string_t *path, wasi_filesystem_preopens_list_tuple2_own_descriptor_string_t *preopens, wasi_filesystem_types_borrow_descriptor_t *ret_base, aseprite_plugin_string_t *ret_relative, aseprite_plugin_string_t *err) { wasi_filesystem_preopens_get_directories(preopens); if(preopens->len==0){set_error(err,"no wasi filesystem preopens");return false;} size_t index=0; bool abs=path->len>0&&path->ptr[0]=='/'; for(size_t i=0;i<preopens->len;i++){aseprite_plugin_string_t *guest=&preopens->ptr[i].f1; if((!abs&&string_eq_bytes(guest->ptr,guest->len,"."))||(abs&&string_eq_bytes(guest->ptr,guest->len,"/"))){index=i;break;}} size_t off=abs?1u:0u; if(path->len<=off){wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(preopens);set_error(err,"invalid Aseprite path");return false;} *ret_base=wasi_filesystem_types_borrow_descriptor(preopens->ptr[index].f0); ret_relative->ptr=path->ptr+off; ret_relative->len=path->len-off; return true; }
static bool append_bytes(aseprite_plugin_list_u8_t *buffer, aseprite_plugin_list_u8_t *chunk) { if(chunk->len==0)return true; uint8_t *next=realloc(buffer->ptr,buffer->len+chunk->len); if(!next)return false; memcpy(next+buffer->len,chunk->ptr,chunk->len); buffer->ptr=next; buffer->len+=chunk->len; return true; }
static bool read_all_bytes(aseprite_plugin_string_t *path, aseprite_plugin_list_u8_t *ret, aseprite_plugin_string_t *err) { ret->ptr=NULL; ret->len=0; wasi_filesystem_preopens_list_tuple2_own_descriptor_string_t preopens; wasi_filesystem_types_borrow_descriptor_t base; aseprite_plugin_string_t rel; if(!resolve_wasi_path(path,&preopens,&base,&rel,err))return false; wasi_filesystem_types_own_descriptor_t file; wasi_filesystem_types_error_code_t code=0; if(!wasi_filesystem_types_method_descriptor_open_at(base,0,&rel,0,WASI_FILESYSTEM_TYPES_DESCRIPTOR_FLAGS_READ,&file,&code)){wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);set_error(err,"failed to open Aseprite file");return false;} wasi_filesystem_types_borrow_descriptor_t b=wasi_filesystem_types_borrow_descriptor(file); uint64_t offset=0; bool eof=false; while(!eof){ aseprite_plugin_tuple2_list_u8_bool_t chunk; code=0; if(!wasi_filesystem_types_method_descriptor_read(b,65536u,offset,&chunk,&code)){wasi_filesystem_types_descriptor_drop_own(file);wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);free(ret->ptr);set_error(err,"failed to read Aseprite file");return false;} if(!append_bytes(ret,&chunk.f0)){aseprite_plugin_list_u8_free(&chunk.f0);wasi_filesystem_types_descriptor_drop_own(file);wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens);free(ret->ptr);set_error(err,"out of memory");return false;} offset+=chunk.f0.len; eof=chunk.f1; aseprite_plugin_list_u8_free(&chunk.f0);} wasi_filesystem_types_descriptor_drop_own(file); wasi_filesystem_preopens_list_tuple2_own_descriptor_string_free(&preopens); return true; }

bool exports_gams_aseprite_aseprite_open(aseprite_plugin_string_t *path, exports_gams_aseprite_aseprite_own_document_t *ret, aseprite_plugin_string_t *err) { aseprite_plugin_list_u8_t bytes; if(!read_all_bytes(path,&bytes,err))return false; char msg[160]={0}; document_t *doc=parse_document(bytes.ptr,bytes.len,path->ptr,path->len,msg,sizeof(msg)); aseprite_plugin_list_u8_free(&bytes); if(!doc){set_error(err,msg);return false;} *ret=exports_gams_aseprite_aseprite_document_new(doc); return true; }

bool exports_gams_aseprite_aseprite_info(document_t *doc, exports_gams_aseprite_aseprite_document_info_t *ret, aseprite_plugin_string_t *err) { (void)err; *ret=(exports_gams_aseprite_aseprite_document_info_t){doc->file_size,doc->num_frames,doc->width,doc->height,color_depth_enum(doc->color_depth),doc->palette_index,doc->num_colors,doc->pixel_ratio_width,doc->pixel_ratio_height,{0}}; return_string(&ret->name,&doc->name); return true; }

bool exports_gams_aseprite_aseprite_layers(document_t *doc, exports_gams_aseprite_aseprite_list_layer_info_t *ret, aseprite_plugin_string_t *err) { (void)err; ret->len=doc->layer_count; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr)return false; for(size_t i=0;i<doc->layer_count;i++){layer_t*l=&doc->layers[i]; ret->ptr[i].index=i; ret->ptr[i].layer_flags=(uint8_t)l->flags; ret->ptr[i].layer_type=l->type; ret->ptr[i].child_level=l->child_level; ret->ptr[i].blend_mode=l->blend_mode; ret->ptr[i].opacity=l->opacity; ret->ptr[i].tileset_index.is_some=l->has_tileset_index; ret->ptr[i].tileset_index.val=l->tileset_index; return_string(&ret->ptr[i].name,&l->name);} return true; }

bool exports_gams_aseprite_aseprite_frames(document_t *doc, exports_gams_aseprite_aseprite_list_frame_info_t *ret, aseprite_plugin_string_t *err) { (void)err; ret->len=doc->frame_count; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr)return false; for(size_t i=0;i<doc->frame_count;i++) ret->ptr[i]=(exports_gams_aseprite_aseprite_frame_info_t){i,doc->frames[i].bytes_in_frame,doc->frames[i].duration_ms,doc->frames[i].chunks,doc->frames[i].cel_count}; return true; }

bool exports_gams_aseprite_aseprite_cels(document_t *doc, uint32_t frame_index, exports_gams_aseprite_aseprite_list_cel_info_t *ret, aseprite_plugin_string_t *err) { if(frame_index>=doc->frame_count){set_error(err,"Aseprite frame index out of range");return false;} frame_t*f=&doc->frames[frame_index]; ret->len=f->cel_count; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr){set_error(err,"out of memory");return false;} for(size_t i=0;i<f->cel_count;i++){cel_t*c=&f->cels[i]; ret->ptr[i]=(exports_gams_aseprite_aseprite_cel_info_t){frame_index,i,c->layer_index,c->x,c->y,c->opacity,cel_type_enum(c->cel_type),c->z_index,c->w,c->h,{c->cel_type==1,c->link}};} return true; }

bool exports_gams_aseprite_aseprite_tags(document_t *doc, exports_gams_aseprite_aseprite_list_tag_info_t *ret, aseprite_plugin_string_t *err) { (void)err; ret->len=doc->tag_count; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr)return false; for(size_t i=0;i<doc->tag_count;i++){tag_t*t=&doc->tags[i]; ret->ptr[i]=(exports_gams_aseprite_aseprite_tag_info_t){t->from,t->to,t->direction,t->repeat,t->color,{0}}; return_string(&ret->ptr[i].name,&t->name);} return true; }

bool exports_gams_aseprite_aseprite_get_palette_info(document_t *doc, exports_gams_aseprite_aseprite_option_palette_info_t *ret, aseprite_plugin_string_t *err) { (void)err; ret->is_some=doc->palette.present; if(ret->is_some) ret->val=(exports_gams_aseprite_aseprite_palette_info_t){doc->palette.size,doc->palette.first,doc->palette.last,{doc->color_depth==8,doc->palette_index}}; return true; }

bool exports_gams_aseprite_aseprite_palette_colors(document_t *doc, exports_gams_aseprite_aseprite_list_palette_color_t *ret, aseprite_plugin_string_t *err) { if(!doc->palette.present){ret->ptr=NULL;ret->len=0;return true;} ret->len=doc->palette.size; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr){set_error(err,"out of memory");return false;} for(size_t i=0;i<ret->len;i++){palette_color_t*c=&doc->palette.colors[i]; ret->ptr[i].index=i; ret->ptr[i].color=c->color; ret->ptr[i].name.is_some=c->has_name; if(c->has_name) return_string(&ret->ptr[i].name.val,&c->name);} return true; }

bool exports_gams_aseprite_aseprite_slices(document_t *doc, exports_gams_aseprite_aseprite_list_slice_info_t *ret, aseprite_plugin_string_t *err) { ret->len=doc->slice_count; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr){set_error(err,"out of memory");return false;} for(size_t i=0;i<doc->slice_count;i++){slice_t*s=&doc->slices[i]; return_string(&ret->ptr[i].name,&s->name); ret->ptr[i].keys.len=s->key_count; ret->ptr[i].keys.ptr=calloc(s->key_count?s->key_count:1,sizeof(*ret->ptr[i].keys.ptr)); if(!ret->ptr[i].keys.ptr){set_error(err,"out of memory");return false;} for(size_t k=0;k<s->key_count;k++){slice_key_t*sk=&s->keys[k]; ret->ptr[i].keys.ptr[k]=(exports_gams_aseprite_aseprite_slice_key_t){sk->frame,sk->x,sk->y,sk->width,sk->height,{sk->has_patch,sk->patch},{sk->has_pivot,sk->pivot}};}} return true; }

bool exports_gams_aseprite_aseprite_tilesets(document_t *doc, exports_gams_aseprite_aseprite_list_tileset_info_t *ret, aseprite_plugin_string_t *err) { (void)err; ret->len=doc->tileset_count; ret->ptr=calloc(ret->len?ret->len:1,sizeof(*ret->ptr)); if(!ret->ptr)return false; for(size_t i=0;i<doc->tileset_count;i++){tileset_t*t=&doc->tilesets[i]; ret->ptr[i]=(exports_gams_aseprite_aseprite_tileset_info_t){t->id,t->flags,t->tile_count,t->tile_width,t->tile_height,{t->has_external,t->external_file_id},{t->has_external,t->external_tileset_id},t->data.len,{0}}; return_string(&ret->ptr[i].name,&t->name);} return true; }

bool exports_gams_aseprite_aseprite_cel_data(document_t *doc, uint32_t frame_index, uint32_t cel_index, aseprite_plugin_list_u8_t *ret, aseprite_plugin_string_t *err) { frame_t*f; cel_t*c; if(!get_cel(doc,frame_index,cel_index,&f,&c,err))return false; (void)f; ret->len=c->data.len; ret->ptr=malloc(ret->len?ret->len:1); if(!ret->ptr){set_error(err,"out of memory");return false;} memcpy(ret->ptr,c->data.ptr,ret->len); return true; }

bool exports_gams_aseprite_aseprite_cel_pixels(document_t *doc, uint32_t frame_index, uint32_t cel_index, exports_gams_aseprite_aseprite_pixels_t *ret, aseprite_plugin_string_t *err) { frame_t*f; cel_t*c; if(!get_cel(doc,frame_index,cel_index,&f,&c,err))return false; (void)f; const char *msg=NULL; uint8_t *rgba=NULL; size_t len=0; if(!cel_to_rgba(doc,c,&rgba,&len,&msg)){set_error(err,msg);return false;} ret->width=c->w; ret->height=c->h; ret->data.ptr=rgba; ret->data.len=len; return true; }

bool exports_gams_aseprite_aseprite_render_frame(document_t *doc, uint32_t frame_index, exports_gams_aseprite_aseprite_pixels_t *ret, aseprite_plugin_string_t *err) { if(frame_index>=doc->frame_count){set_error(err,"Aseprite frame index out of range");return false;} size_t len=(size_t)doc->width*doc->height*4; uint8_t*out=calloc(len?len:1,1); if(!out){set_error(err,"out of memory");return false;} frame_t*f=&doc->frames[frame_index]; render_order_t *order=calloc(f->cel_count?f->cel_count:1,sizeof(*order)); if(!order){free(out);set_error(err,"out of memory");return false;} for(size_t ci=0;ci<f->cel_count;ci++){cel_t*c=&f->cels[ci]; order[ci].cel=c; order[ci].order=(int32_t)c->layer_index+(int32_t)c->z_index; order[ci].z=c->z_index;} qsort(order,f->cel_count,sizeof(*order),compare_render_order); for(size_t oi=0;oi<f->cel_count;oi++){cel_t*c=order[oi].cel; if(c->cel_type==3){free(order);free(out);set_error(err,"Aseprite tilemap frame rendering is not implemented");return false;} if(c->layer_index>=doc->layer_count){free(order);free(out);set_error(err,"Aseprite cel references missing layer");return false;} layer_t*l=&doc->layers[c->layer_index]; if(!(l->flags&1))continue; const char*msg=NULL; uint8_t*rgba=NULL; size_t rlen=0; if(!cel_to_rgba(doc,c,&rgba,&rlen,&msg)){free(order);free(out);set_error(err,msg);return false;} double opacity=((double)c->opacity/255.0)*((double)l->opacity/255.0); for(uint32_t y=0;y<c->h;y++){int32_t ty=c->y+(int32_t)y; if(ty<0||ty>=(int32_t)doc->height)continue; for(uint32_t x=0;x<c->w;x++){int32_t tx=c->x+(int32_t)x; if(tx<0||tx>=(int32_t)doc->width)continue; size_t s=((size_t)y*c->w+x)*4; blend(out+(((size_t)ty*doc->width+tx)*4),rgba[s],rgba[s+1],rgba[s+2],rgba[s+3]*opacity);}} free(rgba);} free(order); ret->width=doc->width; ret->height=doc->height; ret->data.ptr=out; ret->data.len=len; return true; }

bool exports_gams_aseprite_aseprite_to_json(document_t *doc, aseprite_plugin_string_t *ret, aseprite_plugin_string_t *err) { (void)err; char buf[512]; int n=snprintf(buf,sizeof(buf),"{\"fileSize\":%u,\"numFrames\":%u,\"width\":%u,\"height\":%u,\"colorDepth\":%u,\"numColors\":%u,\"layers\":%zu,\"tags\":%zu,\"slices\":%zu,\"tilesets\":%zu}",doc->file_size,doc->num_frames,doc->width,doc->height,doc->color_depth,doc->num_colors,doc->layer_count,doc->tag_count,doc->slice_count,doc->tileset_count); if(n<0){set_error(err,"failed to format Aseprite JSON");return false;} aseprite_plugin_string_set(ret,buf); return true; }

void exports_gams_aseprite_aseprite_document_destructor(document_t *doc) { if(!doc)return; free(doc->name.ptr); for(size_t i=0;i<doc->layer_count;i++)free(doc->layers[i].name.ptr); free(doc->layers); for(size_t i=0;i<doc->frame_count;i++){for(size_t c=0;c<doc->frames[i].cel_count;c++) if(doc->frames[i].cels[c].cel_type!=1) free(doc->frames[i].cels[c].data.ptr); free(doc->frames[i].cels);} free(doc->frames); for(size_t i=0;i<doc->tag_count;i++)free(doc->tags[i].name.ptr); free(doc->tags); if(doc->palette.colors){for(size_t i=0;i<doc->palette.size;i++)free(doc->palette.colors[i].name.ptr); free(doc->palette.colors);} for(size_t i=0;i<doc->slice_count;i++){free(doc->slices[i].name.ptr); free(doc->slices[i].keys);} free(doc->slices); for(size_t i=0;i<doc->tileset_count;i++){free(doc->tilesets[i].name.ptr); free(doc->tilesets[i].data.ptr);} free(doc->tilesets); free(doc); }
