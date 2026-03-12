package main

import "core:c"
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

State :: struct {
	world:            world.World,
	atlas:            sg.Image,
	lut:              sg.Image,
	sprite_renderer:  sprite.Renderer,
	tilemap_renderer: tilemap.Renderer,
	pass_action:      sg.Pass_Action,
	mouse_y:          f32,
}

state: State
atlas_pixels: [ATLAS_RGBA_CAPACITY]u8
lut_pixels: [LUT_RGBA_CAPACITY]u8
init_stage: u32

app_init :: proc() {
	host.setup_graphics()
	host.info("app", "init")
	init_stage = 1
	state.pass_action = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.08, 0.09, 0.12, 1.0}}},
		depth = {load_action = .CLEAR, clear_value = 1.0},
	}
	host.info("app", "2")

	asset_data, ok := host.asset_read_all(ATLAS_ASSET_PATH)
	init_stage = 2
	host.info("app", "3")

	if ok {
		img_w, img_h, img_pixels, img_ok := qoi.decode_to_buffer(asset_data, atlas_pixels[:])
		init_stage = 3
		if img_ok {
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

	host.info("app", "4")
	lut_asset_data, lut_ok := host.asset_read_all(LUT_ASSET_PATH)
	if lut_ok {
		lut_w, lut_h, lut_img_pixels, lut_img_ok := qoi.decode_to_buffer(
			lut_asset_data,
			lut_pixels[:],
		)
		if lut_img_ok {
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


	// THE REAL STUFF
	state.world.atlas = state.atlas
	world.init(&state.world)
}

app_frame :: proc() {
	pass := sg.Pass {
		action    = state.pass_action,
		swapchain = host.swapchain(),
	}

	sg.begin_pass(pass)
	world.frame(&state.world, host.frame_duration())
	sg.end_pass()
	sg.commit()
}


app_event :: proc(event: host.Event) {
	#partial switch event.kind {
	case .Mouse_Move:
		core_handle_mouse_move(event.mouse_y)
	case .Resized:
		state.world.cam.viewport = {f32(event.framebuffer_width), f32(event.framebuffer_height)}
	case .Action_Down:
		state.world.player1^ += {world.InputSet(event.action_code - 1)}
	case .Action_Up:
		state.world.player1^ -= {world.InputSet(event.action_code - 1)}
	case:
	}
}


app_cleanup :: proc() {
	world.cleanup(&state.world)
	host.info("app", "cleanup")

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
