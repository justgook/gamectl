#+build freestanding
#+private
package host

import sg "../sokol/gfx"
import runtime "base:runtime"
import "core:c"
import "core:fmt"
import "core:strings"

foreign import env "env"

LOG_MESSAGE_CAPACITY :: 1024

@(private)
log_message_buf: [LOG_MESSAGE_CAPACITY]u8

@(default_calling_convention = "c")
foreign env {
	js_log :: proc(level: u32, tag_ptr: u32, tag_len: u32, message_ptr: u32, message_len: u32) ---
}

default_context_host :: proc() -> runtime.Context {
	ctx := runtime.default_context()
	ctx.allocator = runtime.default_wasm_allocator()

	return ctx
}

logger_host :: proc() -> Logger {
	return Logger{func = sokol_logger_proc}
}

write :: proc(
	level: Level,
	tag, message: string,
	args: ..any,
	location: runtime.Source_Code_Location = #caller_location,
) {
	formatted_message := format_message(message, ..args)
	tag_ptr, tag_len := string_ptr_and_len(tag)
	message_ptr, message_len := string_ptr_and_len(formatted_message)
	js_log(u32(level), tag_ptr, tag_len, message_ptr, message_len)
}

format_message :: proc(message: string, args: ..any) -> string {
	if len(args) == 0 {
		return message
	}
	if strings.contains(message, "%") {
		return fmt.bprintf(log_message_buf[:], message, ..args)
	}
	builder := strings.builder_from_bytes(log_message_buf[:])
	strings.write_string(&builder, message)
	for arg in args {
		strings.write_byte(&builder, ' ')
		fmt.sbprint(&builder, arg)
	}
	return strings.to_string(builder)
}

string_ptr_and_len :: proc(value: string) -> (u32, u32) {
	bytes := transmute([]u8)value
	if len(bytes) == 0 {
		return 0, 0
	}

	return u32(uintptr(&bytes[0])), u32(len(bytes))
}

cstring_or_empty :: proc(value: cstring) -> string {
	if value == nil {
		return ""
	}
	return string(value)
}

sokol_logger_proc :: proc "c" (
	tag: cstring,
	log_level: u32,
	log_item: u32,
	message: cstring,
	line_nr: u32,
	filename: cstring,
	_: rawptr,
) {
	context = default_context_host()

	tag_text := cstring_or_empty(tag)
	message_text := cstring_or_empty(message)
	write(sokol_level(log_level), tag_text, fmt.tprintf("(%d) %s", log_item, message_text))
	if log_level == 0 {
		assert(
			false,
			fmt.tprintf(
				"sokol panic at %s:%d: %s",
				cstring_or_empty(filename),
				line_nr,
				message_text,
			),
		)
	}
}

sokol_level :: proc(log_level: u32) -> Level {
	switch log_level {
	case 1:
		return .Error
	case 2:
		return .Warning
	case:
		return .Info
	}
}

/// LOGGER END

@(default_calling_convention = "c")
foreign env {
	js_canvas_width :: proc() -> c.int ---
	js_canvas_height :: proc() -> c.int ---
	js_webgl_framebuffer :: proc() -> u32 ---
	js_frame_duration :: proc() -> f64 ---
	game_asset_size :: proc(path_ptr: u32, path_len: u32) -> i32 ---
	game_asset_read :: proc(path_ptr: u32, path_len: u32, dst_ptr: u32, dst_cap: u32) -> i32 ---
}

ASSET_SCRATCH_CAPACITY :: 2 * 1024 * 1024

@(private)
asset_scratch: [ASSET_SCRATCH_CAPACITY]u8

@(private)
asset_read_all_host :: proc(path: string) -> ([]u8, bool) {
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

swapchain_host :: proc() -> sg.Swapchain {
	sc: sg.Swapchain
	sc.width = js_canvas_width()
	sc.height = js_canvas_height()
	sc.sample_count = 1
	sc.color_format = .RGBA8
	sc.depth_format = .DEPTH_STENCIL
	sc.gl.framebuffer = js_webgl_framebuffer()
	return sc
}

frame_duration_host :: proc() -> f64 {
	return js_frame_duration()
}

widthf_host :: proc() -> f32 {
	return f32(js_canvas_width())
}

heightf_host :: proc() -> f32 {
	return f32(js_canvas_height())
}

setup_graphics_host :: proc() {
	logger := transmute(sg.Logger)logger_host()
	desc := sg.Desc {
		logger = logger,
	}
	sg.setup(desc)
}

shutdown_graphics_host :: proc() {
	sg.shutdown()
}
