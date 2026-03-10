package main

import "core:c"
import sprite "render/sprite"
import tilemap "render/tilemap"
import sg "sokol/gfx"
import qoi "third_party/qoi"
import "world"

EVENT_TYPE_MOUSE_DOWN :: 4
EVENT_TYPE_MOUSE_UP :: 5
EVENT_TYPE_MOUSE_SCROLL :: 6
EVENT_TYPE_MOUSE_MOVE :: 7
EVENT_TYPE_RESIZED :: 14
EVENT_TYPE_ACTION_DOWN :: 100
EVENT_TYPE_ACTION_UP :: 101

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

EVENT_OFFSET_FRAME_COUNT :: 0
EVENT_OFFSET_TYPE :: 8
EVENT_OFFSET_MOUSE_BUTTON :: 28
EVENT_OFFSET_MOUSE_X :: 32
EVENT_OFFSET_MOUSE_Y :: 36
EVENT_OFFSET_ACTION_CODE :: 40
EVENT_OFFSET_WINDOW_WIDTH :: 256
EVENT_OFFSET_WINDOW_HEIGHT :: 260
EVENT_OFFSET_FRAMEBUFFER_WIDTH :: 264
EVENT_OFFSET_FRAMEBUFFER_HEIGHT :: 268
ASSET_SCRATCH_CAPACITY :: 2 * 1024 * 1024

State :: struct {
	//new stuff
	world:              world.World,
	//old stuff
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

core_init :: proc(asset_reader: proc(path: string) -> ([]u8, bool)) {
	world.init(&state.world)
	init_stage = 1
	state.pass_action = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.08, 0.09, 0.12, 1.0}}},
	}

	asset_data, ok := asset_reader(ATLAS_ASSET_PATH)
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

	lut_asset_data, lut_ok := asset_reader(LUT_ASSET_PATH)
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
	state.window_height = 480
	state.framebuffer_width = 640
	state.framebuffer_height = 480
	for i in 0 ..< len(state.actions_down) {
		state.actions_down[i] = false
	}
	init_stage = 6
}

core_frame :: proc(swapchain_reader: proc() -> sg.Swapchain) {
	world.frame(&state.world)
	pass := sg.Pass {
		action    = state.pass_action,
		swapchain = swapchain_reader(),
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
	tilemap.reset(&state.tilemap_renderer)
	sprite.reset(&state.sprite_renderer)
	if state.atlas.id != 0 {
		tilemap.push(
			&state.tilemap_renderer,
			{0, 0},
			[2]f32{64, 64},
			[4]f32{0, 0, 1, 1},
			[4]f32{0, 0, 1, 1},
		)
		tilemap.draw(&state.tilemap_renderer, state.framebuffer_width, state.framebuffer_height)

		base_x := f32(state.framebuffer_width) * 0.5 - 260.0 + move_x * 96.0
		base_y := f32(state.framebuffer_height) * 0.5 - 120.0 + bob + move_y * 96.0
		size := [2]f32{160, 160}
		if state.actions_down[int(ACTION_1)] {
			size[0] *= action_boost
			size[1] *= action_boost
		}
		atlas_w := int(state.atlas_width)
		atlas_h := int(state.atlas_height)
		sprite.push(
			&state.sprite_renderer,
			{base_x, base_y},
			size,
			sprite.uv_from_pixels(0, 0, 64, 64, atlas_w, atlas_h),
		)
		sprite.push(
			&state.sprite_renderer,
			{base_x + 180, base_y + 12},
			size,
			sprite.uv_from_pixels(128, 0, 64, 64, atlas_w, atlas_h),
		)
		sprite.push(
			&state.sprite_renderer,
			{base_x + 360, base_y - 8},
			size,
			sprite.uv_from_pixels(320, 320, 64, 64, atlas_w, atlas_h),
		)
		if state.actions_down[int(ACTION_2)] {
			sprite.push(
				&state.sprite_renderer,
				{base_x + 220, base_y - 140},
				[2]f32{96, 96},
				sprite.uv_from_pixels(256, 64, 64, 64, atlas_w, atlas_h),
			)
		}
		sprite.draw(&state.sprite_renderer, state.framebuffer_width, state.framebuffer_height)
	}
	sg.end_pass()
	sg.commit()
}

core_cleanup :: proc() {
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
		core_handle_framebuffer_resize(input.framebuffer_width, input.framebuffer_height)
	case EVENT_TYPE_ACTION_DOWN:
		core_handle_action_down(input.action_code)
	case EVENT_TYPE_ACTION_UP:
		core_handle_action_up(input.action_code)
	case:
	}
}
