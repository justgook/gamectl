#+build !freestanding
#+build !js
#+build !orca

package main

import "host"
import sapp "sokol/app"
WINDOW_SIZE :: [2]i32{1280, 720}
WINDOW_TITLE :: "Game"


native_init :: proc "c" () {
	context = host.default_context()
	app_init()
	app_event(initial_event())
}

native_frame :: proc "c" () {
	context = host.default_context()

	app_frame()
}

native_cleanup :: proc "c" () {
	context = host.default_context()
	app_cleanup()
}

native_event :: proc "c" (e: ^sapp.Event) {
	context = host.default_context()
	if event, ok := translate_event(e); ok {
		app_event(event)
	}
}

initial_event :: proc() -> host.Event {
	return host.Event {
		kind = .Resized,
		window_height = i32(sapp.height()),
		framebuffer_width = i32(sapp.width()),
		framebuffer_height = i32(sapp.height()),
	}
}

map_action :: proc(key: sapp.Keycode) -> (u32, bool) {
	#partial switch key {
	case .W:
		return 1, true
	case .D:
		return 2, true
	case .S:
		return 3, true
	case .A:
		return 4, true
	case .J, .Z:
		return 5, true
	case .K, .X:
		return 6, true
	case .L, .C:
		return 7, true
	case .I, .V:
		return 8, true
	case .UP:
		return 9, true
	case .RIGHT:
		return 10, true
	case .DOWN:
		return 11, true
	case .LEFT:
		return 12, true
	case:
		return 0, false
	}
}

translate_event :: proc(e: ^sapp.Event) -> (host.Event, bool) {
	#partial switch e.type {
	case .MOUSE_MOVE:
		return host.Event{kind = .Mouse_Move, mouse_y = e.mouse_y, mouse_x = e.mouse_x}, true
	case .MOUSE_DOWN:
		return host.Event{kind = .Mouse_Down, mouse_y = e.mouse_y, mouse_x = e.mouse_x}, true
	case .MOUSE_UP:
		return host.Event{kind = .Mouse_Up, mouse_y = e.mouse_y, mouse_x = e.mouse_x}, true
	case .RESIZED:
		return host.Event {
				kind = .Resized,
				window_height = i32(e.window_height),
				framebuffer_width = i32(e.framebuffer_width),
				framebuffer_height = i32(e.framebuffer_height),
			},
			true
	case .KEY_DOWN:
		if action, ok := map_action(e.key_code); ok {
			return host.Event{kind = .Action_Down, action_code = action}, true
		}
	case .KEY_UP:
		if action, ok := map_action(e.key_code); ok {
			return host.Event{kind = .Action_Up, action_code = action}, true
		}
	case:
	}
	return {}, false
}

main :: proc() {
	logger := transmute(sapp.Logger)host.logger()
	app_desc := sapp.Desc {
		width = WINDOW_SIZE[0],
		height = WINDOW_SIZE[1],
		sample_count = 1,
		window_title = WINDOW_TITLE,
		icon = {sokol_default = true},
		logger = logger,
	}
	app_desc.init_cb = native_init
	app_desc.frame_cb = native_frame
	app_desc.cleanup_cb = native_cleanup
	app_desc.event_cb = native_event
	sapp.run(app_desc)
}
