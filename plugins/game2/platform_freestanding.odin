#+build freestanding

package game2

import runtime "base:runtime"
import "core:c"
import sg "sokol/gfx"

foreign import env "env"

@(default_calling_convention = "c")
foreign env {
	js_canvas_width :: proc() -> c.int ---
	js_canvas_height :: proc() -> c.int ---
	js_webgl_framebuffer :: proc() -> u32 ---
	game_asset_size :: proc(path_ptr: u32, path_len: u32) -> i32 ---
	game_asset_read :: proc(path_ptr: u32, path_len: u32, dst_ptr: u32, dst_cap: u32) -> i32 ---
}

asset_scratch: [ASSET_SCRATCH_CAPACITY]u8

wasm_asset_read_all :: proc(path: string) -> ([]u8, bool) {
	path_bytes := transmute([]u8)path
	path_ptr: u32 = 0
	if len(path_bytes) > 0 {
		path_ptr = u32(uintptr(&path_bytes[0]))
	}

	size := game_asset_size(path_ptr, u32(len(path_bytes)))
	if size < 0 {
		return nil, false
	}
	if size == 0 {
		return []u8{}, true
	}
	if size > ASSET_SCRATCH_CAPACITY {
		return nil, false
	}

	buf := asset_scratch[:size]
	bytes_read := game_asset_read(path_ptr, u32(len(path_bytes)), u32(uintptr(&buf[0])), u32(len(buf)))
	if bytes_read != size {
		return nil, false
	}
	return buf, true
}

wasm_swapchain :: proc() -> sg.Swapchain {
	sc: sg.Swapchain
	sc.width = js_canvas_width()
	sc.height = js_canvas_height()
	sc.sample_count = 1
	sc.color_format = .RGBA8
	sc.depth_format = .DEPTH_STENCIL
	sc.gl.framebuffer = js_webgl_framebuffer()
	return sc
}

@(export)
init :: proc "c" () {
	context = runtime.default_context()
	desc: sg.Desc
	sg.setup(desc)
	core_init(wasm_asset_read_all)
}

@(export)
frame :: proc "c" () {
	context = runtime.default_context()
	core_frame(wasm_swapchain)
}

@(export)
cleanup :: proc "c" () {
	context = runtime.default_context()
	core_cleanup()
	sg.shutdown()
}

@(export)
event :: proc "c" (event_ptr: u32) {
	context = runtime.default_context()
	core_handle_host_event(event_ptr)
}

@(export)
get_event_buffer :: proc "c" () -> u32 {
	return u32(uintptr(&event_buffer))
}

@(export)
event_offset_mouse_x :: proc "c" () -> u32 {
	return EVENT_OFFSET_MOUSE_X
}

@(export)
event_offset_mouse_y :: proc "c" () -> u32 {
	return EVENT_OFFSET_MOUSE_Y
}

@(export)
event_offset_window_width :: proc "c" () -> u32 {
	return EVENT_OFFSET_WINDOW_WIDTH
}

@(export)
event_offset_window_height :: proc "c" () -> u32 {
	return EVENT_OFFSET_WINDOW_HEIGHT
}

@(export)
event_offset_framebuffer_width :: proc "c" () -> u32 {
	return EVENT_OFFSET_FRAMEBUFFER_WIDTH
}

@(export)
event_offset_framebuffer_height :: proc "c" () -> u32 {
	return EVENT_OFFSET_FRAMEBUFFER_HEIGHT
}

@(export)
debug_atlas_loaded :: proc "c" () -> u32 {
	return 1 if state.atlas_loaded else 0
}

@(export)
debug_atlas_id :: proc "c" () -> u32 {
	return state.atlas.id
}

@(export)
debug_init_stage :: proc "c" () -> u32 {
	return init_stage
}
