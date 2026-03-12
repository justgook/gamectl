package host

import sg "../sokol/gfx"
import "base:runtime"

default_context :: proc() -> runtime.Context {
	return default_context_host()
}
Event_Kind :: enum u32 {
	None,
	Mouse_Move,
	Resized,
	Action_Down,
	Action_Up,
}

Event :: struct {
	kind:               Event_Kind,
	mouse_y:            f32,
	action_code:        u32,
	window_height:      i32,
	framebuffer_width:  i32,
	framebuffer_height: i32,
}

setup_graphics :: proc() {setup_graphics_host()}

asset_read_all :: proc(path: string) -> ([]u8, bool) {
	return asset_read_all_host(path)
}
widthf :: proc() -> f32 {
	return widthf_host()
}
heightf :: proc() -> f32 {return heightf_host()}
swapchain :: proc() -> sg.Swapchain {
	return swapchain_host()
}

frame_duration :: proc() -> f64 {
	return frame_duration_host()

}
shutdown_graphics :: proc() {
	shutdown_graphics_host()
}

Level :: enum u32 {
	Debug,
	Info,
	Warning,
	Error,
}

Logger :: struct {
	func:      proc "c" (
		tag: cstring,
		log_level: u32,
		log_item: u32,
		message: cstring,
		line_nr: u32,
		filename: cstring,
		user_data: rawptr,
	),
	user_data: rawptr,
}

DEBUG_LOG :: #config(DEBUG_LOG, ODIN_DEBUG)
logger :: proc() -> Logger {
	return logger_host()
}

info :: proc(tag, message: string) {
	write(.Info, tag, message)
}

warn :: proc(tag, message: string) {
	write(.Warning, tag, message)
}

error :: proc(tag, message: string) {
	write(.Error, tag, message)
}

debug :: proc(tag, message: string) {
	when DEBUG_LOG {
		write(.Debug, tag, message)
	}
}
