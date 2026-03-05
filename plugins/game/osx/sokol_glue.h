#if defined(SOKOL_IMPL) && !defined(SOKOL_GLUE_IMPL)
#define SOKOL_GLUE_IMPL
#endif
#ifndef SOKOL_GLUE_INCLUDED
#define SOKOL_GLUE_INCLUDED

#if defined(SOKOL_API_DECL) && !defined(SOKOL_GLUE_API_DECL)
#define SOKOL_GLUE_API_DECL SOKOL_API_DECL
#endif
#ifndef SOKOL_GLUE_API_DECL
#if defined(_WIN32) && defined(SOKOL_DLL) && defined(SOKOL_GLUE_IMPL)
#define SOKOL_GLUE_API_DECL __declspec(dllexport)
#elif defined(_WIN32) && defined(SOKOL_DLL)
#define SOKOL_GLUE_API_DECL __declspec(dllimport)
#else
#define SOKOL_GLUE_API_DECL extern
#endif
#endif

#ifndef SOKOL_GFX_INCLUDED
#error "Please include sokol_gfx.h before sokol_glue.h"
#endif

#ifdef __cplusplus
extern "C" {
#endif

SOKOL_GLUE_API_DECL sg_environment sglue_environment(void);
SOKOL_GLUE_API_DECL sg_swapchain sglue_swapchain(void);

#ifdef __cplusplus
}
#endif
#endif

#ifdef SOKOL_GLUE_IMPL
#define SOKOL_GLUE_IMPL_INCLUDED (1)
#include <string.h>

#ifndef SOKOL_APP_INCLUDED
#error "Please include sokol_app.h before the sokol_glue.h implementation"
#endif

#ifndef SOKOL_API_IMPL
#define SOKOL_API_IMPL
#endif

#ifndef _SOKOL_PRIVATE
#if defined(__GNUC__) || defined(__clang__)
#define _SOKOL_PRIVATE __attribute__((unused)) static
#else
#define _SOKOL_PRIVATE static
#endif
#endif

#ifndef SOKOL_ASSERT
#include <assert.h>
#define SOKOL_ASSERT(c) assert(c)
#endif
#ifndef SOKOL_UNREACHABLE
#define SOKOL_UNREACHABLE SOKOL_ASSERT(false)
#endif

_SOKOL_PRIVATE sg_pixel_format _sglue_to_sgpixelformat(sapp_pixel_format fmt) {
  switch (fmt) {
  case SAPP_PIXELFORMAT_NONE:
    return SG_PIXELFORMAT_NONE;
  case SAPP_PIXELFORMAT_RGBA8:
    return SG_PIXELFORMAT_RGBA8;
  case SAPP_PIXELFORMAT_SRGB8A8:
    return SG_PIXELFORMAT_SRGB8A8;
  case SAPP_PIXELFORMAT_BGRA8:
    return SG_PIXELFORMAT_BGRA8;
  case SAPP_PIXELFORMAT_DEPTH_STENCIL:
    return SG_PIXELFORMAT_DEPTH_STENCIL;
  case SAPP_PIXELFORMAT_DEPTH:
    return SG_PIXELFORMAT_DEPTH;
  case SAPP_PIXELFORMAT_SBGRA8:
  default:
    SOKOL_UNREACHABLE;
    return SG_PIXELFORMAT_NONE;
  }
}

SOKOL_API_IMPL sg_environment sglue_environment(void) {
  sg_environment res;
  memset(&res, 0, sizeof(res));
  const sapp_environment env = sapp_get_environment();
  res.defaults.color_format = _sglue_to_sgpixelformat(env.defaults.color_format);
  res.defaults.depth_format = _sglue_to_sgpixelformat(env.defaults.depth_format);
  res.defaults.sample_count = env.defaults.sample_count;
  res.metal.device = env.metal.device;
  res.d3d11.device = env.d3d11.device;
  res.d3d11.device_context = env.d3d11.device_context;
  res.wgpu.device = env.wgpu.device;
  res.vulkan.instance = env.vulkan.instance;
  res.vulkan.physical_device = env.vulkan.physical_device;
  res.vulkan.device = env.vulkan.device;
  res.vulkan.queue = env.vulkan.queue;
  res.vulkan.queue_family_index = env.vulkan.queue_family_index;
  return res;
}

SOKOL_API_IMPL sg_swapchain sglue_swapchain(void) {
  sg_swapchain res;
  memset(&res, 0, sizeof(res));
  const sapp_swapchain sc = sapp_get_swapchain();
  res.width = sc.width;
  res.height = sc.height;
  res.sample_count = sc.sample_count;
  res.color_format = _sglue_to_sgpixelformat(sc.color_format);
  res.depth_format = _sglue_to_sgpixelformat(sc.depth_format);
  res.metal.current_drawable = sc.metal.current_drawable;
  res.metal.depth_stencil_texture = sc.metal.depth_stencil_texture;
  res.metal.msaa_color_texture = sc.metal.msaa_color_texture;
  res.d3d11.render_view = sc.d3d11.render_view;
  res.d3d11.resolve_view = sc.d3d11.resolve_view;
  res.d3d11.depth_stencil_view = sc.d3d11.depth_stencil_view;
  res.wgpu.render_view = sc.wgpu.render_view;
  res.wgpu.resolve_view = sc.wgpu.resolve_view;
  res.wgpu.depth_stencil_view = sc.wgpu.depth_stencil_view;
  res.vulkan.render_image = sc.vulkan.render_image;
  res.vulkan.render_view = sc.vulkan.render_view;
  res.vulkan.resolve_image = sc.vulkan.resolve_image;
  res.vulkan.resolve_view = sc.vulkan.resolve_view;
  res.vulkan.depth_stencil_image = sc.vulkan.depth_stencil_image;
  res.vulkan.depth_stencil_view = sc.vulkan.depth_stencil_view;
  res.vulkan.render_finished_semaphore = sc.vulkan.render_finished_semaphore;
  res.vulkan.present_complete_semaphore = sc.vulkan.present_complete_semaphore;
  res.gl.framebuffer = sc.gl.framebuffer;
  return res;
}

#endif
