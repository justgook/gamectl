#+build freestanding

package host

import "core:c"
import "core:fmt"
import runtime "base:runtime"
import debug "../debug"
import sg "../sokol/gfx"

foreign import env "env"

@(default_calling_convention = "c")
foreign env {
	js_canvas_width :: proc() -> c.int ---
	js_canvas_height :: proc() -> c.int ---
	js_webgl_framebuffer :: proc() -> u32 ---
	game_asset_size :: proc(path_ptr: u32, path_len: u32) -> i32 ---
	game_asset_read :: proc(path_ptr: u32, path_len: u32, dst_ptr: u32, dst_cap: u32) -> i32 ---
}

ASSET_SCRATCH_CAPACITY :: 2 * 1024 * 1024

asset_scratch: [ASSET_SCRATCH_CAPACITY]u8

asset_read_all :: proc(path: string) -> ([]u8, bool) {
	path_bytes := transmute([]u8)path
	path_ptr: u32 = 0
	if len(path_bytes) > 0 {
		path_ptr = u32(uintptr(&path_bytes[0]))
	}

	size := game_asset_size(path_ptr, u32(len(path_bytes)))
	if size < 0 {
		assert(false, fmt.tprintf("wasm asset not found: %s", path))
		return nil, false
	}
	if size == 0 {
		return []u8{}, true
	}
	if size > ASSET_SCRATCH_CAPACITY {
		assert(
			false,
			fmt.tprintf(
				"wasm asset too large for scratch buffer: %s (%d > %d)",
				path,
				size,
				ASSET_SCRATCH_CAPACITY,
			),
		)
		return nil, false
	}

	buf := asset_scratch[:size]
	bytes_read := game_asset_read(
		path_ptr,
		u32(len(path_bytes)),
		u32(uintptr(&buf[0])),
		u32(len(buf)),
	)
	if bytes_read != size {
		assert(
			false,
			fmt.tprintf(
				"wasm asset read failed: %s (expected %d bytes, got %d)",
				path,
				size,
				bytes_read,
			),
		)
		return nil, false
	}
	return buf, true
}

swapchain :: proc() -> sg.Swapchain {
	sc: sg.Swapchain
	sc.width = js_canvas_width()
	sc.height = js_canvas_height()
	sc.sample_count = 1
	sc.color_format = .RGBA8
	sc.depth_format = .DEPTH_STENCIL
	sc.gl.framebuffer = js_webgl_framebuffer()
	return sc
}

frame_duration :: proc() -> f64 {
	return 1.0 / 60.0
}

widthf :: proc() -> f32 {
	return f32(js_canvas_width())
}

heightf :: proc() -> f32 {
	return f32(js_canvas_height())
}

setup_graphics :: proc() {
	context = runtime.default_context()
	logger := transmute(sg.Logger)debug.logger()
	desc := sg.Desc {logger = logger}
	sg.setup(desc)
}

shutdown_graphics :: proc() {
	context = runtime.default_context()
	sg.shutdown()
}
