#+build !freestanding
#+build !js
#+build !orca

package game2

import runtime "base:runtime"
import sapp "sokol/app"
import sg "sokol/gfx"
import sglue "sokol/glue"
import slog "sokol/log"

native_asset_read_all :: proc(path: string) -> ([]u8, bool) {
	_ = path
	return nil, false
}

native_swapchain :: proc() -> sg.Swapchain {
	return sglue.swapchain()
}

native_app_desc :: proc() -> sapp.Desc {
	return {
		width = 640,
		height = 480,
		sample_count = 1,
		window_title = "Game2",
		icon = {sokol_default = true},
		logger = {func = slog.func},
	}
}

native_init :: proc "c" () {
	context = runtime.default_context()
	sg.setup({environment = sglue.environment(), logger = {func = slog.func}})
	core_init(native_asset_read_all)
	core_handle_resize(i32(sapp.height()))
}

native_frame :: proc "c" () {
	context = runtime.default_context()
	core_frame(native_swapchain)
}

native_cleanup :: proc "c" () {
	context = runtime.default_context()
	sg.shutdown()
}

native_event :: proc "c" (e: ^sapp.Event) {
	context = runtime.default_context()
	#partial switch e.type {
	case .MOUSE_MOVE, .MOUSE_DOWN, .MOUSE_UP:
		core_handle_mouse_move(e.mouse_y)
	case .RESIZED:
		core_handle_resize(i32(e.window_height))
	case:
	}
}
