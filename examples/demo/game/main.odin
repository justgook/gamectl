package main

import "core:c"
import "data_anim"
import "data_bullet"
import "data_director"
import "data_level"
import "data_ui"
import "director"
import "host"
import sg "sokol/gfx"
import qoi "third_party/qoi"
import "world"
import "world/grid"
import "world/logic"
import "world/shape"

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

	w := &state.world
	// TODO: delete those debug segments
	UNIT := world.UNIT
	append(&w.segments, shape.make_segment(32 * UNIT, 16 * UNIT, 128 * UNIT, 16 * UNIT))
	append(&w.segments, shape.make_segment(128 * UNIT, 16 * UNIT, 256 * UNIT, 64 * UNIT))
	append(&w.segments, shape.make_segment(256 * UNIT, -16 * UNIT, 256 * UNIT, 128 * UNIT))
	// MOCK SEGMENTS END

	ok := load_data_bullet("bullet.rspk", &state.world)
	assert(ok)
	ok = load_data_anim("anim.rspk", &state.world)
	assert(ok)
	ok = load_data_ui("ui.rspk", &state.world)
	assert(ok)
	ok = load_data_level("level.rspk", &state.world)
	assert(ok)
	ok = load_data_director("director.rspk", &state.world)
	assert(ok)

	world.init(&state.world)
}

app_frame :: proc() {
	world.frame(&state.world, host.frame_duration())
	world.mouse_button_finish_frame(&state.world)
}


app_event :: proc(event: host.Event) {
	#partial switch event.kind {
	// case .Mouse_Move:
	// 	core_handle_mouse_move(event.mouse_y)
	case .Resized:
		// Original scaled display is disabled while the render canvases are inspected.
		// world.display_resize(
		// 	&state.world.display_pipe.params,
		// 	f32(event.framebuffer_width),
		// 	f32(event.framebuffer_height),
		// )
		world.display_debug_resize(
			state.world.display_debug_pipe,
			f32(event.framebuffer_width),
			f32(event.framebuffer_height),
		)

		// Used by window_to_game
		world.window_width = f32(event.framebuffer_width)
		world.window_height = f32(event.framebuffer_height)


	case .Action_Down:
		assert(event.action_code >= 1 && event.action_code <= 8)
		world.input_action_down(&state.world, world.InputSet(event.action_code - 1))
	case .Action_Up:
		assert(event.action_code >= 1 && event.action_code <= 8)
		world.input_action_up(&state.world, world.InputSet(event.action_code - 1))
	case .Mouse_Move:
		state.world.mouse.x = event.mouse_x
		state.world.mouse.y = event.mouse_y
	case .Mouse_Down:
		state.world.mouse.x = event.mouse_x
		state.world.mouse.y = event.mouse_y
		world.mouse_button_down(&state.world)
	case .Mouse_Up:
		state.world.mouse.x = event.mouse_x
		state.world.mouse.y = event.mouse_y
		world.mouse_button_up(&state.world)
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
load_data_director :: proc(filepath: string, w: ^world.World) -> bool {
	file_data := host.asset_read_all(filepath) or_return
	game_data := data_director.open_respack(file_data) or_return

	director_data := data_director.read_slot_0_director_director_data(game_data) or_return
	w.director_config = data_director.read_slot_2_world_director_config(game_data) or_return
	assert(u64(w.director_config.player) < u64(len(director_data.entities)))
	w.director = director.init(director_data)
	for director_entity, index in w.director_entity.components {
		assert(u64(director_entity.id) < u64(len(director_data.entities)))
		world_entity := w.director_entity.entity_ids[index]
		director.entity_set_stat(&w.director, director_entity.id, w.director_config.world_entity, i32(world_entity))
	}

	segment_trigger_defs := data_director.read_slot_1_segment_trigger_defs(game_data) or_return
	defer delete(segment_trigger_defs)
	assert(w.segment_triggers == nil)
	w.segment_triggers = make(map[^shape.Segment]world.Segment_Trigger)
	for def in segment_trigger_defs {
		assert(def.segment >= 0)
		assert(int(def.segment) < len(w.segments))
		segment := &w.segments[int(def.segment)]
		w.segment_triggers[segment] = world.Segment_Trigger {
			once            = def.once,
			director_signal = def.director_signal,
		}
	}

	// host.info("load_data_director", "director", director_data, "segment triggers", len(segment_trigger_defs))

	return true
}

@(private = "file")
load_data_level :: proc(filepath: string, w: ^world.World) -> bool {
	file_data := host.asset_read_all(filepath) or_return
	game_data := data_level.open_respack(file_data) or_return

	w.next_entity_id = data_level.read_slot_6_next_entity_id(game_data) or_return

	UNIT := world.UNIT
	the_segments := data_level.read_slot_1_segments(game_data) or_return
	defer delete(the_segments)

	for s in the_segments {
		append(&w.segments, shape.Segment{s.x, s.y, s.z, s.w} * UNIT)
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

	positions := data_level.read_slot_3_positions(game_data) or_return
	assert(len(positions.components) == len(positions.entity_ids))
	// assert(len(positions.entity_ids) == int(next_entity_id))
	for entity_id, index in positions.entity_ids {
		assert(entity_id == u32(index))
	}
	for &position in positions.components {
		position.xy *= world.UNIT
	}
	logic.load_storage(&w.position, positions.components, positions.entity_ids)

	director_trigger_aabbs := data_level.read_slot_4_director_trigger_aabbs(game_data) or_return
	assert(len(director_trigger_aabbs.components) == len(director_trigger_aabbs.entity_ids))
	for &trigger in director_trigger_aabbs.components {
		trigger.bounds.xyzw *= world.UNIT
	}
	logic.load_storage(&w.director_trigger_aabb, director_trigger_aabbs.components, director_trigger_aabbs.entity_ids)

	director_entities := data_level.read_slot_5_director_entities(game_data) or_return
	assert(len(director_entities.components) == len(director_entities.entity_ids))
	logic.load_storage(&w.director_entity, director_entities.components, director_entities.entity_ids)

	brains := data_level.read_slot_7_brains(game_data) or_return
	assert(len(brains.components) == len(brains.entity_ids))
	logic.load_storage(&w.brain, brains.components, brains.entity_ids)

	inputs := data_level.read_slot_8_inputs(game_data) or_return
	assert(len(inputs.components) == len(inputs.entity_ids))
	for input, index in inputs.components {
		logic.add_component(&w.input, inputs.entity_ids[index], transmute(world.Input)input)
	}

	velocities := data_level.read_slot_9_velocities(game_data) or_return
	assert(len(velocities.components) == len(velocities.entity_ids))
	for &velocity in velocities.components {
		velocity.xy *= world.UNIT
	}
	logic.load_storage(&w.velocity, velocities.components, velocities.entity_ids)

	colliders := data_level.read_slot_10_colliders(game_data) or_return
	assert(len(colliders.components) == len(colliders.entity_ids))
	for &collider in colliders.components {
		collider.x *= world.UNIT
		collider.y *= world.UNIT
		collider.radius *= world.UNIT
		collider.height *= world.UNIT
	}
	logic.load_storage(&w.collider, colliders.components, colliders.entity_ids)

	player_hurts := data_level.read_slot_11_player_hurts(game_data) or_return
	assert(len(player_hurts.components) == len(player_hurts.entity_ids))
	for &player_hurt in player_hurts.components {
		player_hurt.x *= world.UNIT
		player_hurt.y *= world.UNIT
		player_hurt.radius *= world.UNIT
		player_hurt.height *= world.UNIT
	}
	logic.load_storage(&w.player_hurt, player_hurts.components, player_hurts.entity_ids)

	platformers := data_level.read_slot_12_platformers(game_data) or_return
	assert(len(platformers.components) == len(platformers.entity_ids))
	logic.load_storage(&w.platformer, platformers.components, platformers.entity_ids)

	sprites := data_level.read_slot_13_sprites(game_data) or_return
	assert(len(sprites.components) == len(sprites.entity_ids))
	logic.load_storage(&w.sprite, sprites.components, sprites.entity_ids)

	platformer_anim_refs := data_level.read_slot_14_platformer_anim_refs(game_data) or_return
	defer delete(platformer_anim_refs.entity_ids)
	defer delete(platformer_anim_refs.components)
	assert(len(platformer_anim_refs.components) == len(platformer_anim_refs.entity_ids))
	for ref, index in platformer_anim_refs.components {
		entity_id := platformer_anim_refs.entity_ids[index]
		base_id := int(ref.atlas_base_id)
		logic.add_component(
			&w.platformer_anim,
			entity_id,
			world.platformer_anim_create_char_from_atlas(&w.animation_atlas, base_id),
		)
		logic.add_component(&w.animation, entity_id, world.animation_create(&w.animation_atlas.defs[base_id]))
	}

	bullet_refs := data_level.read_slot_15_bullet_refs(game_data) or_return
	defer delete(bullet_refs.entity_ids)
	defer delete(bullet_refs.components)
	assert(len(bullet_refs.components) == len(bullet_refs.entity_ids))
	for ref, index in bullet_refs.components {
		entity_id := bullet_refs.entity_ids[index]
		director_entity, has_director_entity := logic.get_component(&w.director_entity, entity_id)
		assert(has_director_entity)
		pattern_id := int(ref.pattern_id)
		assert(pattern_id < len(w.bullet_patterns))
		logic.add_component(
			&w.bullet,
			entity_id,
			world.bullet_component(&w.bullet_patterns[pattern_id], director_entity.id, ref.side),
		)
	}

	// tilemaps := data_level.read_slot_16_tilemaps(game_data) or_return
	tilemaps := data_level.read_slot_16_tilemaps(game_data) or_return
	assert(len(tilemaps.components) == len(tilemaps.entity_ids))
	logic.load_storage(&w.tilemap, tilemaps.components, tilemaps.entity_ids)


	host.info("load_assets_data", "success", true, "w.tilemap", (tilemaps.components))

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
