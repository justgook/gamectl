#+build !freestanding
#+build !js
#+build !orca

package main

import runtime "base:runtime"
import game2 ".."
import "core:fmt"
import "core:os"
import "core:strings"
import sapp "../sokol/app"
import sg "../sokol/gfx"
import sglue "../sokol/glue"
import slog "../sokol/log"

GAME_ASSET_PREFIX :: "/game/"

native_asset_name_from_path :: proc(path: string) -> (string, bool) {
	if !strings.has_prefix(path, GAME_ASSET_PREFIX) {
		return "", false
	}
	name := path[len(GAME_ASSET_PREFIX):]
	if len(name) == 0 {
		return "", false
	}
	if strings.contains(name, "..") {
		return "", false
	}
	if strings.contains(name, "/") {
		return "", false
	}
	return name, true
}

native_asset_read_all :: proc(path: string) -> ([]u8, bool) {
	name, ok := native_asset_name_from_path(path)
	if !ok {
		assert(false, fmt.tprintf("native asset read rejected invalid path: %s", path))
		return nil, false
	}
	candidates := [4]string{
		fmt.tprintf("../../cmd/browser/assets/game/%s", name),
		fmt.tprintf("../../example/%s", name),
		fmt.tprintf("example/%s", name),
		name,
	}
	for candidate in candidates {
		if data, ok := os.read_entire_file(candidate, context.allocator); ok {
			return data, true
		}
	}
	assert(false, fmt.tprintf("native asset not found: %s (tried: %s, %s, %s, %s)", path, candidates[0], candidates[1], candidates[2], candidates[3]))
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
