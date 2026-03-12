package main

import "core:c"
import "debug"
import "host"
import sprite "render/sprite"
import tilemap "render/tilemap"
import sg "sokol/gfx"
import qoi "third_party/qoi"
import "world"

ACTION_LEFT :: u32(1)
ACTION_RIGHT :: u32(2)
ACTION_UP :: u32(3)
ACTION_DOWN :: u32(4)
ACTION_1 :: u32(5)
ACTION_2 :: u32(6)
ATLAS_ASSET_PATH :: "/game/the_atlas.qoi"
LUT_ASSET_PATH :: "/game/lut.qoi"
ATLAS_RGBA_CAPACITY :: 4 * 1024 * 1024
LUT_RGBA_CAPACITY :: 512 * 512 * 4

EVENT_OFFSET_MOUSE_X :: 32
EVENT_OFFSET_MOUSE_Y :: 36
EVENT_OFFSET_ACTION_CODE :: 40
EVENT_OFFSET_WINDOW_WIDTH :: 256
EVENT_OFFSET_WINDOW_HEIGHT :: 260
EVENT_OFFSET_FRAMEBUFFER_WIDTH :: 264
EVENT_OFFSET_FRAMEBUFFER_HEIGHT :: 268
State :: struct {
	world:              world.World,
	atlas:              sg.Image,
	lut:                sg.Image,
	sprite_renderer:    sprite.Renderer,
	tilemap_renderer:   tilemap.Renderer,
	pass_action:        sg.Pass_Action,
	mouse_y:            f32,
	window_height:      i32,
	framebuffer_width:  i32,
	framebuffer_height: i32,
	atlas_width:        i32,
	atlas_height:       i32,
	atlas_loaded:       bool,
	lut_width:          i32,
	lut_height:         i32,
	lut_loaded:         bool,
	actions_down:       [7]bool,
}


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

state: State
event_buffer: Host_Event
atlas_pixels: [ATLAS_RGBA_CAPACITY]u8
lut_pixels: [LUT_RGBA_CAPACITY]u8
init_stage: u32

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

app_init :: proc() {
	host.setup_graphics()
	debug.info("app", "init")
	init_stage = 1
	state.pass_action = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.08, 0.09, 0.12, 1.0}}},
	}

	asset_data, ok := host.asset_read_all(ATLAS_ASSET_PATH)
	init_stage = 2
	if ok {
		img_w, img_h, img_pixels, img_ok := qoi.decode_to_buffer(asset_data, atlas_pixels[:])
		init_stage = 3
		if img_ok {
			state.atlas_loaded = true
			state.atlas_width = i32(img_w)
			state.atlas_height = i32(img_h)
			desc := sg.Image_Desc {
				width        = i32(img_w),
				height       = i32(img_h),
				pixel_format = .RGBA8,
			}
			desc.data.mip_levels[0] = {
				ptr  = raw_data(img_pixels),
				size = c.size_t(img_w * img_h * 4),
			}
			state.atlas = sg.make_image(desc)
			init_stage = 4
			state.sprite_renderer = sprite.init(state.atlas)
			init_stage = 5
		}
	}

	lut_asset_data, lut_ok := host.asset_read_all(LUT_ASSET_PATH)
	if lut_ok {
		lut_w, lut_h, lut_img_pixels, lut_img_ok := qoi.decode_to_buffer(
			lut_asset_data,
			lut_pixels[:],
		)
		if lut_img_ok {
			state.lut_loaded = true
			state.lut_width = i32(lut_w)
			state.lut_height = i32(lut_h)
			lut_desc := sg.Image_Desc {
				width        = i32(lut_w),
				height       = i32(lut_h),
				pixel_format = .RGBA8,
			}
			lut_desc.data.mip_levels[0] = {
				ptr  = raw_data(lut_img_pixels),
				size = c.size_t(lut_w * lut_h * 4),
			}
			state.lut = sg.make_image(lut_desc)
		}
	}

	if state.atlas.id != 0 {
		lut_tex := state.lut
		lut_w := state.lut_width
		lut_h := state.lut_height
		if lut_tex.id == 0 {
			lut_tex = state.atlas
			lut_w = state.atlas_width
			lut_h = state.atlas_height
		}
		state.tilemap_renderer = tilemap.init(
			state.atlas,
			lut_tex,
			state.atlas_width,
			state.atlas_height,
			lut_w,
			lut_h,
		)
	}

	state.mouse_y = 0.0
	state.window_height = max(1, i32(host.heightf()))
	state.framebuffer_width = max(1, i32(host.widthf()))
	state.framebuffer_height = max(1, i32(host.heightf()))
	for i in 0 ..< len(state.actions_down) {
		state.actions_down[i] = false
	}
	init_stage = 6
	// THE REAL STUFF
	state.world.atlas = state.atlas
	world.init(&state.world)
}

app_frame :: proc() {
	pass := sg.Pass {
		action    = state.pass_action,
		swapchain = host.swapchain(),
	}

	window_height := state.window_height
	if window_height <= 0 {
		window_height = 1
	}
	normalized_y := 1.0 - (state.mouse_y / f32(window_height))
	bob := (normalized_y - 0.5) * 80.0
	move_x: f32 = 0
	move_y: f32 = 0
	if state.actions_down[int(ACTION_LEFT)] {
		move_x -= 1
	}
	if state.actions_down[int(ACTION_RIGHT)] {
		move_x += 1
	}
	if state.actions_down[int(ACTION_UP)] {
		move_y -= 1
	}
	if state.actions_down[int(ACTION_DOWN)] {
		move_y += 1
	}
	action_boost := f32(1.0)
	if state.actions_down[int(ACTION_1)] {
		action_boost += 0.25
	}
	if state.actions_down[int(ACTION_2)] {
		action_boost += 0.25
	}

	sg.begin_pass(pass)
	world.frame(&state.world, host.frame_duration())
	sg.end_pass()
	sg.commit()
}

app_cleanup :: proc() {
	world.cleanup(&state.world)
	debug.info("app", "cleanup")

	tilemap.shutdown(&state.tilemap_renderer)
	sprite.shutdown(&state.sprite_renderer)
	if state.lut.id != 0 {
		sg.destroy_image(state.lut)
		state.lut = {}
	}
	if state.atlas.id != 0 {
		sg.destroy_image(state.atlas)
		state.atlas = {}
	}
	host.shutdown_graphics()
}

core_handle_mouse_move :: proc(mouse_y: f32) {
	state.mouse_y = mouse_y
}

core_handle_resize :: proc(window_height: i32) {
	if window_height > 0 {
		state.window_height = window_height
	}
}

core_handle_framebuffer_resize :: proc(width, height: i32) {
	if width > 0 {
		state.framebuffer_width = width
	}
	if height > 0 {
		state.framebuffer_height = height
	}
}

core_handle_action_down :: proc(action_code: u32) {
	if int(action_code) >= len(state.actions_down) {
		return
	}
	state.actions_down[int(action_code)] = true
}

core_handle_action_up :: proc(action_code: u32) {
	if int(action_code) >= len(state.actions_down) {
		return
	}
	state.actions_down[int(action_code)] = false
}

app_event :: proc(event: host.Event) {
	#partial switch event.kind {
	case .Mouse_Move:
		core_handle_mouse_move(event.mouse_y)
	case .Resized:
		core_handle_resize(event.window_height)
		core_handle_framebuffer_resize(event.framebuffer_width, event.framebuffer_height)
	case .Action_Down:
		core_handle_action_down(event.action_code)
	case .Action_Up:
		core_handle_action_up(event.action_code)
	case:
	}
}

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
