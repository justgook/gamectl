#+build !freestanding
#+build !js
#+build !orca

package host

import debug "../debug"
import sapp "../sokol/app"
import sg "../sokol/gfx"
import sglue "../sokol/glue"
import runtime "base:runtime"
import "core:fmt"
import "core:os"
import "core:strings"

GAME_ASSET_PREFIX :: "/game/"

asset_name_from_path :: proc(path: string) -> (string, bool) {
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

asset_read_all :: proc(path: string) -> ([]u8, bool) {
	name, ok := asset_name_from_path(path)
	if !ok {
		assert(false, fmt.tprintf("native asset read rejected invalid path: %s", path))
		return nil, false
	}
	candidates := [4]string {
		fmt.tprintf("../../cmd/browser/assets/game/%s", name),
		fmt.tprintf("../../example/%s", name),
		fmt.tprintf("example/%s", name),
		name,
	}
	for candidate in candidates {
		if data, err := os.read_entire_file(candidate, context.allocator); err == nil {
			return data, true
		}
	}
	assert(
		false,
		fmt.tprintf(
			"native asset not found: %s (tried: %s, %s, %s, %s)",
			path,
			candidates[0],
			candidates[1],
			candidates[2],
			candidates[3],
		),
	)
	return nil, false
}

swapchain :: proc() -> sg.Swapchain {
	return sglue.swapchain()
}

frame_duration :: proc() -> f64 {
	return sapp.frame_duration()
}

widthf :: proc() -> f32 {
	return sapp.widthf()
}

heightf :: proc() -> f32 {
	return sapp.heightf()
}

setup_graphics :: proc() {
	context = runtime.default_context()
	logger := transmute(sg.Logger)debug.logger()
	sg.setup({environment = sglue.environment(), logger = logger})
}

shutdown_graphics :: proc() {
	context = runtime.default_context()
	sg.shutdown()
}

initial_event :: proc() -> Event {
	return Event {
		kind = .Resized,
		window_height = i32(sapp.height()),
		framebuffer_width = i32(sapp.width()),
		framebuffer_height = i32(sapp.height()),
	}
}

map_action :: proc(key: sapp.Keycode) -> (u32, bool) {
	#partial switch key {
	case .A, .LEFT:
		return 1, true
	case .D, .RIGHT:
		return 2, true
	case .W, .UP:
		return 3, true
	case .S, .DOWN:
		return 4, true
	case .J:
		return 5, true
	case .K:
		return 6, true
	case:
		return 0, false
	}
}

translate_event :: proc(e: ^sapp.Event) -> (Event, bool) {
	#partial switch e.type {
	case .MOUSE_MOVE, .MOUSE_DOWN, .MOUSE_UP:
		return Event{kind = .Mouse_Move, mouse_y = e.mouse_y}, true
	case .RESIZED:
		return Event {
				kind = .Resized,
				window_height = i32(e.window_height),
				framebuffer_width = i32(e.framebuffer_width),
				framebuffer_height = i32(e.framebuffer_height),
			},
			true
	case .KEY_DOWN:
		if action, ok := map_action(e.key_code); ok {
			return Event{kind = .Action_Down, action_code = action}, true
		}
	case .KEY_UP:
		if action, ok := map_action(e.key_code); ok {
			return Event{kind = .Action_Up, action_code = action}, true
		}
	case:
	}
	return {}, false
}

run :: proc(callbacks: Callbacks, event_cb: proc "c" (e: ^sapp.Event)) {
	logger := transmute(sapp.Logger)debug.logger()
	app_desc := sapp.Desc {
		width = 960,
		height = 640,
		sample_count = 1,
		window_title = "Game2",
		icon = {sokol_default = true},
		logger = logger,
	}
	app_desc.init_cb = callbacks.init
	app_desc.frame_cb = callbacks.frame
	app_desc.cleanup_cb = callbacks.cleanup
	app_desc.event_cb = event_cb
	sapp.run(app_desc)
}
