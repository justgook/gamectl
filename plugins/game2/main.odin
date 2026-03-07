package game2

import "core:c"
import sg "sokol/gfx"

EVENT_TYPE_MOUSE_DOWN :: 4
EVENT_TYPE_MOUSE_UP :: 5
EVENT_TYPE_MOUSE_SCROLL :: 6
EVENT_TYPE_MOUSE_MOVE :: 7
EVENT_TYPE_RESIZED :: 14

EVENT_OFFSET_FRAME_COUNT :: 0
EVENT_OFFSET_TYPE :: 8
EVENT_OFFSET_MOUSE_BUTTON :: 28
EVENT_OFFSET_MOUSE_X :: 32
EVENT_OFFSET_MOUSE_Y :: 36
EVENT_OFFSET_WINDOW_WIDTH :: 256
EVENT_OFFSET_WINDOW_HEIGHT :: 260
EVENT_OFFSET_FRAMEBUFFER_WIDTH :: 264
EVENT_OFFSET_FRAMEBUFFER_HEIGHT :: 268
ASSET_SCRATCH_CAPACITY :: 2 * 1024 * 1024

State :: struct {
	pip: sg.Pipeline,
	bind: sg.Bindings,
	pass_action: sg.Pass_Action,
	mouse_y: f32,
	window_height: i32,
}

Host_Event :: struct {
	frame_count: u64,
	kind: u32,
	reserved0: [16]u8,
	mouse_button: i32,
	mouse_x: f32,
	mouse_y: f32,
	reserved1: [216]u8,
	window_width: i32,
	window_height: i32,
	framebuffer_width: i32,
	framebuffer_height: i32,
}

state: State
event_buffer: Host_Event

range_from_slice :: proc(data: []$T) -> sg.Range {
	ptr: rawptr = nil
	if len(data) > 0 {
		ptr = cast(rawptr)&data[0]
	}
	return sg.Range{ptr = ptr, size = c.size_t(len(data) * size_of(T))}
}

range_from_value :: proc(value: ^$T) -> sg.Range {
	return sg.Range{ptr = cast(rawptr)value, size = c.size_t(size_of(T))}
}

core_init :: proc(asset_reader: proc(path: string) -> ([]u8, bool)) {
	vertices := [21]f32 {
		0.0, 0.5, 0.5, 1.0, 0.0, 0.0, 1.0,
		0.5, -0.5, 0.5, 0.0, 1.0, 0.0, 1.0,
		-0.5, -0.5, 0.5, 0.0, 0.0, 1.0, 1.0,
	}

	buffer_desc := sg.Buffer_Desc{data = range_from_slice(vertices[:])}
	state.bind.vertex_buffers[0] = sg.make_buffer(buffer_desc)

	shader_desc := triangle_shader_desc(sg.query_backend())
	pipeline_desc := sg.Pipeline_Desc{shader = sg.make_shader(shader_desc)}
	pipeline_desc.layout.attrs[ATTR_triangle_position].format = .FLOAT3
	pipeline_desc.layout.attrs[ATTR_triangle_color0].format = .FLOAT4
	state.pip = sg.make_pipeline(pipeline_desc)

	state.pass_action = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.0, 0.0, 0.0, 1.0}}},
	}

	asset_data, ok := asset_reader("/game/clear-color.rgb")
	if ok && len(asset_data) >= 3 {
		state.pass_action.colors[0].clear_value.r = f32(asset_data[0]) / 255.0
		state.pass_action.colors[0].clear_value.g = f32(asset_data[1]) / 255.0
		state.pass_action.colors[0].clear_value.b = f32(asset_data[2]) / 255.0
	}

	state.mouse_y = 0.0
	state.window_height = 480
}

core_frame :: proc(swapchain_reader: proc() -> sg.Swapchain) {
	window_height := state.window_height
	if window_height <= 0 {
		window_height = 1
	}

	normalized_y := 1.0 - (state.mouse_y / f32(window_height))
	angle := normalized_y * 2.0 * 3.14159
	vs_params := Vs_Params{angle = angle}
	pass := sg.Pass{action = state.pass_action, swapchain = swapchain_reader()}

	sg.begin_pass(pass)
	sg.apply_pipeline(state.pip)
	sg.apply_bindings(state.bind)
	sg.apply_uniforms(UB_vs_params, range_from_value(&vs_params))
	sg.draw(0, 3, 1)
	sg.end_pass()
	sg.commit()
}

core_handle_mouse_move :: proc(mouse_y: f32) {
	state.mouse_y = mouse_y
}

core_handle_resize :: proc(window_height: i32) {
	if window_height > 0 {
		state.window_height = window_height
	}
}

core_handle_host_event :: proc(event_ptr: u32) {
	if event_ptr == 0 {
		return
	}
	input := cast(^Host_Event)uintptr(event_ptr)
	switch input.kind {
	case EVENT_TYPE_MOUSE_DOWN, EVENT_TYPE_MOUSE_UP, EVENT_TYPE_MOUSE_MOVE:
		core_handle_mouse_move(input.mouse_y)
	case EVENT_TYPE_RESIZED:
		core_handle_resize(input.window_height)
	case:
	}
}
