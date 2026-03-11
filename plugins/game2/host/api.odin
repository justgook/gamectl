package host

import sg "../sokol/gfx"

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

Callbacks :: struct {
	init:    proc "c" (),
	frame:   proc "c" (),
	cleanup: proc "c" (),
	event:   proc "c" (event: Event),
}

Swapchain_Reader :: proc() -> sg.Swapchain
