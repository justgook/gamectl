#+build !freestanding
#+build !js
#+build !orca

package main

import runtime "base:runtime"
import game2 ".."
import "core:os"
import sapp "../sokol/app"
import sg "../sokol/gfx"
import sglue "../sokol/glue"
import slog "../sokol/log"

native_asset_candidates :: []string {
	"../../example/the_atlas.qoi",
	"example/the_atlas.qoi",
	"the_atlas.qoi",
}

native_asset_read_all :: proc(path: string) -> ([]u8, bool) {
	if path != game2.ATLAS_ASSET_PATH {
		return nil, false
	}
	for candidate in native_asset_candidates {
		if data, ok := os.read_entire_file(candidate, context.allocator); ok {
			return data, true
		}
	}
	return nil, false
}

native_swapchain :: proc() -> sg.Swapchain {
	return sglue.swapchain()
}

native_map_action :: proc(key: sapp.Keycode) -> (u32, bool) {
	#partial switch key {
	case .A, .LEFT:
		return game2.ACTION_LEFT, true
	case .D, .RIGHT:
		return game2.ACTION_RIGHT, true
	case .W, .UP:
		return game2.ACTION_UP, true
	case .S, .DOWN:
		return game2.ACTION_DOWN, true
	case .J:
		return game2.ACTION_1, true
	case .K:
		return game2.ACTION_2, true
	case:
		return 0, false
	}
}

native_init :: proc "c" () {
	context = runtime.default_context()
	sg.setup({environment = sglue.environment(), logger = {func = slog.func}})
	game2.core_init(native_asset_read_all)
	game2.core_handle_resize(i32(sapp.height()))
	game2.core_handle_framebuffer_resize(i32(sapp.width()), i32(sapp.height()))
}

native_frame :: proc "c" () {
	context = runtime.default_context()
	game2.core_frame(native_swapchain)
}

native_cleanup :: proc "c" () {
	context = runtime.default_context()
	game2.core_cleanup()
	sg.shutdown()
}

native_event :: proc "c" (e: ^sapp.Event) {
	context = runtime.default_context()
	#partial switch e.type {
	case .MOUSE_MOVE, .MOUSE_DOWN, .MOUSE_UP:
		game2.core_handle_mouse_move(e.mouse_y)
	case .RESIZED:
		game2.core_handle_resize(i32(e.window_height))
		game2.core_handle_framebuffer_resize(i32(e.framebuffer_width), i32(e.framebuffer_height))
	case .KEY_DOWN:
		if action, ok := native_map_action(e.key_code); ok {
			game2.core_handle_action_down(action)
		}
	case .KEY_UP:
		if action, ok := native_map_action(e.key_code); ok {
			game2.core_handle_action_up(action)
		}
	case:
	}
}

main :: proc() {
	app_desc := sapp.Desc{
		width = 960,
		height = 640,
		sample_count = 1,
		window_title = "Game2",
		icon = {sokol_default = true},
		logger = {func = slog.func},
	}
	app_desc.init_cb = native_init
	app_desc.frame_cb = native_frame
	app_desc.cleanup_cb = native_cleanup
	app_desc.event_cb = native_event
	sapp.run(app_desc)
}
