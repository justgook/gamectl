#+build freestanding

package main

import runtime "base:runtime"
import "host"

EVENT_OFFSET_MOUSE_X :: 32
EVENT_OFFSET_MOUSE_Y :: 36
EVENT_OFFSET_ACTION_CODE :: 40
EVENT_OFFSET_WINDOW_WIDTH :: 256
EVENT_OFFSET_WINDOW_HEIGHT :: 260
EVENT_OFFSET_FRAMEBUFFER_WIDTH :: 264
EVENT_OFFSET_FRAMEBUFFER_HEIGHT :: 268

Host_Event :: struct {
	frame_count:        u64,
	kind:               u32,
	reserved0:          [16]u8,
	mouse_button:       i32,
	mouse_x:            f32,
	mouse_y:            f32,
	action_code:        u32,
	reserved1:          [212]u8,
	window_width:       i32,
	window_height:      i32,
	framebuffer_width:  i32,
	framebuffer_height: i32,
}

event_buffer: Host_Event

host_event_from_buffer :: proc(event_ptr: u32) -> host.Event {
	if event_ptr == 0 {
		return {}
	}
	input := cast(^Host_Event)uintptr(event_ptr)
	event := host.Event {
		mouse_y            = input.mouse_y,
		action_code        = input.action_code,
		window_height      = input.window_height,
		framebuffer_width  = input.framebuffer_width,
		framebuffer_height = input.framebuffer_height,
	}
	switch input.kind {
	case 4, 5, 7:
		event.kind = .Mouse_Move
	case 14:
		event.kind = .Resized
	case 100:
		event.kind = .Action_Down
	case 101:
		event.kind = .Action_Up
	case:
		event.kind = .None
	}

	return event
}

@(export)
init :: proc "c" () {
	context = host.default_context()
	app_init()
}

@(export)
frame :: proc "c" () {
	context = host.default_context()
	host.reset_frame_temp_allocator()
	app_frame()
}

@(export)
cleanup :: proc "c" () {
	context = host.default_context()
	app_cleanup()
}

@(export)
event :: proc "c" (event_ptr: u32) {
	context = host.default_context()
	app_event(host_event_from_buffer(event_ptr))
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
event_offset_action_code :: proc "c" () -> u32 {
	return EVENT_OFFSET_ACTION_CODE
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
