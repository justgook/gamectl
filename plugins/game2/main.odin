package main

import "core:c"
import "host"
import sg "sokol/gfx"
import qoi "third_party/qoi"
import "world"
import "world/logic"

ACTION_LEFT :: u32(1)
ACTION_RIGHT :: u32(2)
ACTION_UP :: u32(3)
ACTION_DOWN :: u32(4)
ACTION_1 :: u32(5)
ACTION_2 :: u32(6)
GAME_ASSET_PATH :: "/game/data.rspk"
ATLAS_RGBA_CAPACITY :: 4 * 1024 * 1024
LUT_RGBA_CAPACITY :: 512 * 512 * 4
// GAME_RESOLUTION :: [2]int{320, 180}
GAME_RESOLUTION :: [2]c.int{640, 360}

State :: struct {
	world:          world.World,
	game_offscreen: sg.Image,
	game_pass:      sg.Pass_Action,
	delme:          sg.Attachments,
	display_pass:   sg.Pass_Action,
}

state: State
atlas_pixels: [ATLAS_RGBA_CAPACITY]u8
lut_pixels: [LUT_RGBA_CAPACITY]u8
init_stage: u32

app_init :: proc() {
	host.setup_graphics()
	host.info("app", "init")
	state.game_offscreen = sg.make_image(
		{usage = {color_attachment = true}, width = GAME_RESOLUTION[0], height = GAME_RESOLUTION[1]},
	)
	init_stage = 1
	state.game_pass = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.08, 0.09, 0.12, 1.0}}},
		depth = {load_action = .CLEAR, clear_value = 1.0},
	}
	state.delme.colors[0] = sg.make_view({color_attachment = {image = state.game_offscreen}})


	load_ok := load_game_assets(GAME_ASSET_PATH, &state.world)
	assert(load_ok)

	wh := [2]f32{host.widthf(), host.heightf()}
	world.init(&state.world, wh)

}

app_frame :: proc() {

	wh := [2]f32{host.widthf(), host.heightf()}
	sg.begin_pass({action = state.game_pass, swapchain = host.swapchain()})
	world.frame(&state.world, wh, host.frame_duration())
	sg.end_pass()
	sg.commit()
}


app_event :: proc(event: host.Event) {
	#partial switch event.kind {
	// case .Mouse_Move:
	// 	core_handle_mouse_move(event.mouse_y)
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
	if state.game_offscreen.id != 0 {
		sg.destroy_image(state.game_offscreen)
		state.game_offscreen = {}
	}
	host.shutdown_graphics()
}

// core_handle_mouse_move :: proc(mouse_y: f32) {
// 	state.mouse_y = mouse_y
// }


@(private = "file")
load_game_assets :: proc(filepath: string, w: ^world.World) -> bool {
	host.info("assets", "loading")

	asset_data := host.asset_read_all(filepath) or_return
	game_data := open_respack(asset_data) or_return

	the_pos := read_slot_0_positions(game_data) or_return
	logic.load_storage(&w.position, the_pos.components, the_pos.entity_ids)

	atlas_bytes := read_slot_1_atlas(game_data) or_return
	w.uv = read_slot_2_sprites(game_data) or_return
	the_lut := read_slot_3_lut(game_data) or_return
	the_tilemaps := read_slot_4_tilemaps(game_data) or_return
	logic.load_storage(&w.tilemap, the_tilemaps.components, the_tilemaps.entity_ids)


	w.lut = create_image(the_lut, lut_pixels[:]) or_return
	w.atlas = create_image(atlas_bytes, atlas_pixels[:]) or_return

	host.info("assets", "game loaded", w.position, w.atlas)

	return true
}

@(private = "file")
create_image :: proc(data: []u8, pixels: []u8) -> (img: sg.Image, ok: bool) {
	img_w, img_h, img_pixels := qoi.decode_to_buffer(data, pixels) or_return
	desc := sg.Image_Desc {
		width        = i32(img_w),
		height       = i32(img_h),
		pixel_format = .RGBA8,
	}

	desc.data.mip_levels[0] = {
		ptr  = raw_data(img_pixels),
		size = c.size_t(img_w * img_h * 4),
	}

	return sg.make_image(desc), true
}
