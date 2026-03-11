#+build freestanding

package main

import runtime "base:runtime"

@(export)
init :: proc "c" () {
	app_init()
}

@(export)
frame :: proc "c" () {
	app_frame()
}

@(export)
cleanup :: proc "c" () {
	app_cleanup()
}

@(export)
event :: proc "c" (event_ptr: u32) {
	context = runtime.default_context()
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
