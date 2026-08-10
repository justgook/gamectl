package world

import "../data_bullet"
import "../director"
import "../host"
import sg "../sokol/gfx"
import "bullet"
import "core:math/linalg"
import "grid"
import "logic"
import "shape"

GAME_RESOLUTION_WIDTH :: 640
GAME_RESOLUTION_HEIGHT :: 360
OFFSCREEN_SAMPLE_COUNT :: 1
Director_Entity_Id :: director.Entity_Id

Mouse_Button_State :: struct {
	down:      bool,
	up:        bool,
	just_down: bool,
	just_up:   bool,
}

World :: struct {
	frame_count:            u64,
	next_entity_id:         logic.Entity,
	free_entity_ids:        [dynamic]logic.Entity,
	free_entity_ids_lookup: map[logic.Entity]bool,
	sim_frame_length:       f64,
	accumulator:            f64,
	ui_atlas:               sg.Image,
	level_atlas:            sg.Image,
	atlas:                  sg.Image,
	lut:                    sg.Image,
	cam:                    Camera,
	player1_id:             logic.Entity,
	player1:                ^Input,
	// TODO MAKE SIMPLER: combine to single field (maybe) after all is done so all become just simple render
	light_pipe:             ^Light_Pipe,
	light:                  logic.Component_Storage_Fixed(Light, LIGHT_RENDER_MAX),
	light_shadow:           logic.Component_Storage_Fixed(Light_Shadow_Caster, LIGHT_SHADOW_RENDER_MAX),
	// MAKE SIMPLER end
	sprite_pipe:            ^Sprite_Pipe,
	tilemap_pipe:           ^Tilemap_Pipe,
	nine_patch_pipe:        ^Nine_Patch_Pipe,
	text_pipe:              ^Text_Pipe,
	uv:                     []UV,
	position:               logic.Component_Storage(Position),
	velocity:               logic.Component_Storage(Velocity),
	sprite:                 logic.Component_Storage_Fixed(Sprite, SPRITE_RENDER_MAX),
	tilemap:                logic.Component_Storage_Fixed(Tilemap, MAX_TILEMAPS),
	nine_patch:             logic.Component_Storage_Fixed(Nine_Patch, NINE_PATCH_RENDER_MAX),
	text_glyph:             logic.Component_Storage_Fixed(Text_Glyph, TEXT_GLYPH_RENDER_MAX),
	brain:                  logic.Component_Storage(Brain),
	enemy_vision:           logic.Component_Storage(Enemy_Vision),
	enemy_attack_area:      logic.Component_Storage(Enemy_Attack_Area),
	input:                  logic.Component_Storage(Input),
	timer:                  logic.Component_Storage(Timer),
	// animations
	animation_atlas:        Animation_Atlas,
	animation:              logic.Component_Storage(Animation),
	platformer_anim:        logic.Component_Storage(Platformer_Anim),
	// NEW rendering
	offscreen_pass:         sg.Pass,
	display_pass_action:    sg.Pass_Action,
	display_pipe:           ^Display_Pipe,
	// Platformer Physics
	platformer:             logic.Component_Storage(Platformer),
	grid:                   grid.Grid,
	segments:               [dynamic]shape.Segment,
	collider:               logic.Component_Storage(shape.Capsule),
	on_hit:                 logic.Component_Storage(proc(_: ^World, src, target: int)),
	on_hurt:                logic.Component_Storage(proc(_: ^World, src, target: int)),
	enemy_hurt:             logic.Component_Storage(shape.Capsule),
	enemy_hit:              logic.Component_Storage(shape.Circle),
	player_hurt:            logic.Component_Storage(shape.Capsule),
	player_hit:             logic.Component_Storage(shape.Circle),
	// Bullet patterns
	bullet_patterns:        data_bullet.Bullet_Patterns,
	bullet:                 logic.Component_Storage(Bullet),
	// Director
	// TODO : simplify and combine
	director_config:        Director_Config,
	director:               director.State,
	segment_triggers:       map[^shape.Segment]Segment_Trigger,
	platformer_zones:       []Platformer_Zone,
	director_entity:        logic.Component_Storage(Director_Entity),
	director_trigger_aabb:  logic.Component_Storage(Director_Trigger_Aabb),
	input_mode:             Input_Mode,
	physical_input:         Input,
	dialog_pressed:         Input,
	active_dialog:          Director_Entity_Id,
	// UI
	ui_sprite:              struct {
		using pipe: ^Sprite_Pipe,
		using comp: logic.Component_Storage_Fixed(Sprite, SPRITE_RENDER_MAX),
	},
	mouse:                  [2]f32,
	mouse_btn:              Mouse_Button_State,
}

frame :: proc(w: ^World, dt: f64) {
	w.accumulator += dt
	for (w.accumulator >= w.sim_frame_length) {
		w.frame_count += 1
		w.accumulator -= w.sim_frame_length
		switch w.input_mode {
		case .Gameplay:
			sys_brain(w)
			sys_weapon(w)
			sys_bullet(w)
			sys_platformer(w)
			sys_velocity(w)
			sys_enemy_vision(w)
			sys_enemy_attack_area(w)
			sys_trigger(w)
			sys_bullet_collision(w)
		case .Dialog:
			sys_dialog(w)
		}
		sys_dialog_state(w)
	}

	if w.input_mode == .Gameplay {
		sys_camera(w, dt)
		sys_platformer_anim(w)
		sys_animation(w, dt)
	}
	// UI and rendering continue while gameplay simulation is frozen.
	sys_ui(w)


	// RENDER START HERE
	virtual_half_w: f32 = GAME_RESOLUTION_WIDTH * 0.5
	virtual_half_h: f32 = GAME_RESOLUTION_HEIGHT * 0.5
	virtual_screen_ortho :=
		linalg.matrix_ortho3d_f32(-virtual_half_w, virtual_half_w, -virtual_half_h, virtual_half_h, -1, 1) *
		linalg.matrix4_translate_f32({-virtual_half_w, -virtual_half_h, 0})
	sg.begin_pass(w.offscreen_pass)
	sys_tilemap(w, &w.cam.ortho)
	sys_sprite(w, &w.cam.ortho)
	sg.end_pass()

	// Keep world color, but give the light/shadow depth ladder an isolated,
	// freshly-cleared depth buffer.
	lighting_pass := w.offscreen_pass
	lighting_pass.action.colors[0] = {
		load_action = .LOAD,
	}
	lighting_pass.action.depth = {
		load_action = .CLEAR,
		clear_value = 1.0,
	}
	sg.begin_pass(lighting_pass)
	sys_light(w, &w.cam.ortho)
	sg.end_pass()

	// Clear the lighting depths before rendering screen-space overlays.
	overlay_pass := lighting_pass
	sg.begin_pass(overlay_pass)

	// UI
	sprites_draw(w.ui_sprite.pipe, w.ui_sprite.count, &w.ui_sprite.components, &virtual_screen_ortho)
	sys_nine_patch(w, &virtual_screen_ortho)
	sys_text(w, &virtual_screen_ortho)
	sys_debug_collision(w, &w.cam.ortho)
	sg.end_pass()

	// RENDER THE CANVAS ON SCREEN
	sg.begin_pass({action = w.display_pass_action, swapchain = host.swapchain()})
	sys_display(w)
	// sys_nine_patch(w, &screen_ortho)
	sg.end_pass()

	sg.commit()
}


init :: proc(w: ^World) {
	// TODO: move outside to display init
	color_img := sg.make_image(
	{
		usage = {color_attachment = true},
		width = GAME_RESOLUTION_WIDTH,
		height = GAME_RESOLUTION_HEIGHT,
		// pixel_format = .RGBA8,
		sample_count = OFFSCREEN_SAMPLE_COUNT,
	},
	)

	depth_img := sg.make_image(
		{
			usage = {depth_stencil_attachment = true},
			width = GAME_RESOLUTION_WIDTH,
			height = GAME_RESOLUTION_HEIGHT,
			sample_count = 1,
			pixel_format = .DEPTH_STENCIL,
		},
	)

	w.offscreen_pass = {
		action = {colors = {0 = {load_action = .CLEAR, clear_value = {0, 0, 0, 1.0}}}},
		attachments = {
			colors = {0 = sg.make_view({color_attachment = {image = color_img}})},
			depth_stencil = sg.make_view({depth_stencil_attachment = {image = depth_img}}),
		},
	}
	w.display_pass_action = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.08, 0.09, 0.12, 1.0}}},
		depth = {load_action = .CLEAR, clear_value = 1.0},
	}

	w.display_pipe = display_init(color_img)


	w.free_entity_ids_lookup = make(map[logic.Entity]bool)
	w.sim_frame_length = 1.0 / 60.0
	w.mouse_btn.up = true
	w.cam = camera_init({GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT}, {200, 100}, 1.0)
	w.sprite_pipe = sprites_init(w.atlas)
	w.tilemap_pipe = tilemap_init(w.level_atlas, w.lut)
	w.nine_patch_pipe = nine_patch_init(w.ui_atlas)
	w.text_pipe = text_init(w.ui_atlas)
	w.light_pipe = light_init()

	// UI
	w.ui_sprite.pipe = sprites_init(w.ui_atlas)
	// w.grid = grid.create_grid(-256 * UNIT, -128 * UNIT, 1024 * UNIT, 512 * UNIT, 16 * UNIT)
	for &segment in w.segments {
		grid.add_segment(&w.grid, &segment)
	}
	// append(
	// 	&w.platformer_zones,
	// 	Platformer_Zone {
	// 		id = "demo.ladder.start",
	// 		kind = .Ladder,
	// 		bounds = {192 * UNIT, 0, 208 * UNIT, 128 * UNIT},
	// 	},
	// )
	// TODO: delete MOCK DATA

	// w.tilemap.components[0].parallax = {0.5, 0.5}
	// w.tilemap.components[0].repeat.xy = 1
	// entity_delete(w, w.tilemap.entity_ids[1])
	// host.info("TILEMAP", "data", w.tilemap.components[0])

	// player := create_entity(w)
	player := logic.Entity(1)
	host.info("PLAYER", "ID", player)
	w.player1_id = player
	player_director_entity, has_player_director_entity := logic.get_component(&w.director_entity, player)
	assert(has_player_director_entity)
	assert(player_director_entity.id == w.director_config.player)
	camera_track(&w.cam, player)
	player_input, has_player_input := logic.get_component(&w.input, player)
	assert(has_player_input)
	w.player1 = player_input

	mock_light(w)

}

create_entity :: proc(w: ^World) -> logic.Entity {
	if w.free_entity_ids_lookup == nil {
		w.free_entity_ids_lookup = make(map[logic.Entity]bool)
	}

	if len(w.free_entity_ids) > 0 {
		id := w.free_entity_ids[len(w.free_entity_ids) - 1]
		_ = pop(&w.free_entity_ids)
		assert(id in w.free_entity_ids_lookup)
		delete_key(&w.free_entity_ids_lookup, id)
		return id
	}

	id := w.next_entity_id
	w.next_entity_id += 1

	return id
}

entity_delete :: proc(w: ^World, entity_id: logic.Entity) {
	if w.free_entity_ids_lookup == nil {
		w.free_entity_ids_lookup = make(map[logic.Entity]bool)
	}
	assert(!(entity_id in w.free_entity_ids_lookup))

	bullet_delete_component(&w.bullet, entity_id)

	logic.delete_component(&w.position, entity_id)
	logic.delete_component(&w.velocity, entity_id)
	logic.delete_component(&w.sprite, entity_id)
	logic.delete_component(&w.tilemap, entity_id)
	logic.delete_component(&w.nine_patch, entity_id)
	logic.delete_component(&w.brain, entity_id)
	logic.delete_component(&w.enemy_vision, entity_id)
	logic.delete_component(&w.enemy_attack_area, entity_id)
	logic.delete_component(&w.input, entity_id)
	logic.delete_component(&w.platformer, entity_id)
	logic.delete_component(&w.timer, entity_id)
	logic.delete_component(&w.animation, entity_id)
	logic.delete_component(&w.platformer_anim, entity_id)
	if director_entity, ok := logic.get_component(&w.director_entity, entity_id); ok {
		director.entity_remove_stat(&w.director, director_entity.id, w.director_config.world_entity)
	}
	logic.delete_component(&w.director_entity, entity_id)
	logic.delete_component(&w.director_trigger_aabb, entity_id)
	logic.delete_component(&w.collider, entity_id)
	logic.delete_component(&w.on_hit, entity_id)
	logic.delete_component(&w.on_hurt, entity_id)
	logic.delete_component(&w.enemy_hurt, entity_id)
	logic.delete_component(&w.enemy_hit, entity_id)
	logic.delete_component(&w.player_hurt, entity_id)
	logic.delete_component(&w.player_hit, entity_id)

	w.free_entity_ids_lookup[entity_id] = true
	append(&w.free_entity_ids, entity_id)
}

cleanup :: proc(w: ^World) {
	light_cleanup(w.light_pipe)
	// sg.destroy_image(w.offscreen_image)
	// w.offscreen_image = {}
	display_cleanup(w.display_pipe)

	delete(w.free_entity_ids)
	delete(w.free_entity_ids_lookup)
	delete(w.uv)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	sprites_cleanup(w.sprite_pipe)
	logic.destroy_storage(&w.sprite)
	tilemap_cleanup(w.tilemap_pipe)
	logic.destroy_storage(&w.tilemap)
	nine_patch_cleanup(w.nine_patch_pipe)
	logic.destroy_storage(&w.nine_patch)
	text_cleanup(w.text_pipe)
	logic.destroy_storage(&w.text_glyph)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.enemy_vision)
	logic.destroy_storage(&w.enemy_attack_area)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.platformer)
	logic.destroy_storage(&w.timer)
	logic.destroy_storage(&w.animation)
	logic.destroy_storage(&w.platformer_anim)
	grid.destroy_grid(&w.grid)
	delete(w.segment_triggers)
	delete(w.platformer_zones)
	delete(w.segments)
	logic.destroy_storage(&w.director_entity)
	logic.destroy_storage(&w.director_trigger_aabb)
	logic.destroy_storage(&w.collider)
	logic.destroy_storage(&w.on_hit)
	logic.destroy_storage(&w.on_hurt)
	logic.destroy_storage(&w.enemy_hurt)
	logic.destroy_storage(&w.enemy_hit)
	logic.destroy_storage(&w.player_hurt)
	logic.destroy_storage(&w.player_hit)
	director.destroy(&w.director)
	bullet_destroy_state_storage(&w.bullet)
	bullet.destroy_patterns(&w.bullet_patterns)
}
