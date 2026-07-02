package main

import "char_data"
import "core:c"
import "decoder2"
import "host"
import sg "sokol/gfx"
import qoi "third_party/qoi"
import "world"
import "world/grid"
import "world/logic"

GAME_ASSET_PATH :: "data.rspk"
ATLAS_RGBA_CAPACITY :: 4 * 1024 * 1024
LUT_RGBA_CAPACITY :: 512 * 512 * 4


State :: struct {
	world: world.World,
}

state: State
atlas_pixels: [ATLAS_RGBA_CAPACITY]u8
lut_pixels: [LUT_RGBA_CAPACITY]u8

app_init :: proc() {
	host.setup_graphics()
	host.info("app", "init")

	assert(load_bullet_assets("bullet.rspk", &state.world))
	assert(load_game_assets(GAME_ASSET_PATH, &state.world))
	assert(load_char_data("char.rspk", &state.world))


	world.init(&state.world)
}

app_frame :: proc() {
	world.frame(&state.world, host.frame_duration())
}


app_event :: proc(event: host.Event) {
	#partial switch event.kind {
	// case .Mouse_Move:
	// 	core_handle_mouse_move(event.mouse_y)
	case .Resized:
		// state.world.cam.viewport = {f32(event.framebuffer_width), f32(event.framebuffer_height)}
		// state.world.viewport = {f32(event.framebuffer_width), f32(event.framebuffer_height)}
		world.display_resize(
			&state.world.display_pipe.params,
			f32(event.framebuffer_width),
			f32(event.framebuffer_height),
		)
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
	host.shutdown_graphics()
}

// core_handle_mouse_move :: proc(mouse_y: f32) {
// 	state.mouse_y = mouse_y
// }

@(private = "file")
load_bullet_assets :: proc(filepath: string, w: ^world.World) -> bool {
	asset_data := host.asset_read_all(filepath) or_return
	game_data := decoder2.open_respack(asset_data) or_return
	w.bullet_patterns = decoder2.read_slot_0_bullet_patterns(game_data) or_return
	host.info("bullet decoder", "success", true)

	return true
}


load_char_data :: proc(filepath: string, w: ^world.World) -> bool {
	asset_data := host.asset_read_all(filepath) or_return
	game_data := char_data.open_respack(asset_data) or_return

	atlas_bytes := char_data.read_slot_1_atlas(game_data) or_return
	w.atlas = create_image(atlas_bytes, atlas_pixels[:]) or_return
	w.uv = char_data.read_slot_0_u_vs(game_data) or_return
	w.animation_atlas = char_data.read_slot_2_world_animation_atlas(game_data) or_return

	host.info("char_data decoder", "success", true, "w.animation_atlas", w.animation_atlas)

	return true
}

@(private = "file")
load_game_assets :: proc(filepath: string, w: ^world.World) -> bool {
	host.info("assets", "loading", decoder2.Speed_Type.Absolute)


	asset_data := host.asset_read_all(filepath) or_return
	// defer delete(asset_data) - implement it as host.file_close - so we can use delete version in native and web based

	game_data := open_respack(asset_data) or_return

	the_pos := read_slot_0_positions(game_data) or_return
	logic.load_storage(&w.position, the_pos.components, the_pos.entity_ids)
	delete(the_pos.entity_ids)
	delete(the_pos.components)

	atlas_bytes := read_slot_1_atlas(game_data) or_return
	the_lut := read_slot_3_lut(game_data) or_return

	the_tilemaps := read_slot_4_tilemaps(game_data) or_return
	logic.load_storage(&w.tilemap, the_tilemaps.components, the_tilemaps.entity_ids)
	delete(the_tilemaps.entity_ids)
	delete(the_tilemaps.components)

	UNIT := world.UNIT
	the_segments := read_slot_5_segments(game_data) or_return
	defer delete(the_segments)

	for s in the_segments {
		append(&w.segments, [4]int{int(s.x), int(s.y), int(s.z), int(s.w)} * UNIT)
	}
	host.info("SSEEGGMENTS", "segments", w.segments[:])

	w.grid = grid.create_grid(-10024 * UNIT, -10024 * UNIT, 10024 * UNIT, 10024 * UNIT, 16 * UNIT)
	for &segment in w.segments {
		grid.add_segment(&w.grid, &segment)
	}


	w.lut = create_image(the_lut, lut_pixels[:]) or_return
	w.atlas = create_image(atlas_bytes, atlas_pixels[:]) or_return
	w.uv = read_slot_2_sprites(game_data) or_return


	host.info("assets", "game loaded", w.position)

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
