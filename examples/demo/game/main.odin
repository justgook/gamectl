package main

import "core:c"
import "data_anim"
import "data_bullet"
import "data_level"
import "data_ui"
import "host"
import sg "sokol/gfx"
import qoi "third_party/qoi"
import "world"
import "world/grid"
import "world/logic"

State :: struct {
	world: world.World,
}

state: State

lut_pixels: [1024 * 1024 * 4]u8
ui_atlas_pixels: [1024 * 1024 * 4]u8
level_atlas_pixels: [1024 * 1024 * 4]u8
atlas_pixels: [1024 * 1024 * 4]u8

app_init :: proc() {
	host.setup_graphics()
	host.info("app", "init")

	assert(load_data_bullet("bullet.rspk", &state.world))
	assert(load_data_anim("anim.rspk", &state.world))
	assert(load_data_ui("ui.rspk", &state.world))
	assert(load_data_level("level.rspk", &state.world))


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
load_data_level :: proc(filepath: string, w: ^world.World) -> bool {
	file_data := host.asset_read_all(filepath) or_return
	game_data := data_level.open_respack(file_data) or_return

	UNIT := world.UNIT
	the_segments := data_level.read_slot_1_segments(game_data) or_return
	defer delete(the_segments)

	clear(&w.segments)
	for s in the_segments {
		append(&w.segments, [4]int{int(s.x), int(s.y), int(s.z), int(s.w)} * UNIT)
	}

	grid.destroy_grid(&w.grid)
	w.grid = grid.create_grid(-10024 * UNIT, -10024 * UNIT, 10024 * UNIT, 10024 * UNIT, 16 * UNIT)
	for &segment in w.segments {
		grid.add_segment(&w.grid, &segment)
	}

	w.platformer_zones = data_level.read_slot_2_platformer_zones(game_data) or_return
	for &l in w.platformer_zones {
		l.bounds.xyzw *= world.UNIT
	}

	atlas_bytes := data_level.read_slot_0_atlas(game_data) or_return
	w.level_atlas = create_image(atlas_bytes, level_atlas_pixels[:]) or_return
	w.lut = w.level_atlas

	pos := data_level.read_slot_3_positions(game_data) or_return
	logic.load_storage(&w.position, pos.components, pos.entity_ids)
	for &pos in &w.position.components {
		pos.xy *= world.UNIT
	}


	// host.info("load_assets_data", "success", true, "w.platformer_zones", w.platformer_zones)

	return true
}

@(private = "file")
load_data_bullet :: proc(filepath: string, w: ^world.World) -> bool {
	asset_data := host.asset_read_all(filepath) or_return
	game_data := data_bullet.open_respack(asset_data) or_return
	w.bullet_patterns = data_bullet.read_slot_0_bullet_patterns(game_data) or_return

	return true
}

@(private = "file")
load_data_anim :: proc(filepath: string, w: ^world.World) -> bool {
	file_data := host.asset_read_all(filepath) or_return
	game_data := data_anim.open_respack(file_data) or_return

	atlas_bytes := data_anim.read_slot_1_atlas(game_data) or_return
	w.atlas = create_image(atlas_bytes, atlas_pixels[:]) or_return
	w.uv = data_anim.read_slot_0_u_vs(game_data) or_return

	w.animation_atlas = data_anim.read_slot_2_world_animation_atlas(game_data) or_return
	for &frame in w.animation_atlas.frames {
		frame.offset.y = 14
		frame.offset.x = 10
	}


	return true
}

@(private = "file")
load_data_ui :: proc(filepath: string, w: ^world.World) -> bool {
	asset_data := host.asset_read_all(filepath) or_return
	// defer delete(asset_data) - implement it as host.file_close - so we can use delete version in native and web based
	game_data := data_ui.open_respack(asset_data) or_return
	atlas_bytes := data_ui.read_slot_0_atlas(game_data) or_return
	w.ui_atlas = create_image(atlas_bytes, ui_atlas_pixels[:]) or_return

	world.ui_nines_storage = data_ui.read_slot_1_nines(game_data) or_return
	for &nine in world.ui_nines_storage {
		nine.slices.yw = nine.size.yy - nine.slices.wy // weird flip fix
	}
	world.ui_fonts_storage = data_ui.read_slot_2_fonts(game_data) or_return

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
