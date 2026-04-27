package world

import "../host"
import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"
import "grid"
import "logic"

// GAME_RESOLUTION :: [2]int{320, 180}
GAME_RESOLUTION :: [2]c.int{640, 360}

World :: struct {
	next_entity_id:   logic.Entity,
	sim_frame_length: f64,
	accumulator:      f64,
	offscreen:        sg.Image,
	atlas:            sg.Image,
	lut:              sg.Image,
	grid:             grid.Grid,
	cam:              Camera,
	player1:          ^Input,
	sprite_pipe:      ^Sprite_Pipe,
	tilemap_pipe:     ^Tilemap_Pipe,
	nine_patch_pipe:  ^Nine_Patch_Pipe,
	uv:               []UV,
	position:         logic.Component_Storage(Position),
	velocity:         logic.Component_Storage(Velocity),
	sprite:           logic.Component_Storage_Fixed(Sprite, SPRITE_RENDER_MAX),
	tilemap:          logic.Component_Storage_Fixed(Tilemap, MAX_TILEMAPS),
	nine_patch:       logic.Component_Storage_Fixed(Nine_Patch, NINE_PATCH_RENDER_MAX),
	brain:            logic.Component_Storage(Brain),
	input:            logic.Component_Storage(Input),
	timer:            logic.Component_Storage(Timer),
	// animations
	animation_atlas:  Animation_Atlas,
	animation:        logic.Component_Storage(Animation),
}

frame :: proc(pass: sg.Pass, w: ^World, wh: [2]f32, dt: f64) {
	w.accumulator += dt
	for (w.accumulator >= w.sim_frame_length) {
		w.accumulator -= w.sim_frame_length
		sys_brain(w)
		sys_move(w)
		sys_velocity(w)
	}

	sys_camera(w, dt)
	sys_animation(w, dt)


	// RENDER START HERE
	sg.begin_pass(pass)
	sys_tilemap(w, &w.cam.ortho)
	sys_sprite(w, &w.cam.ortho)
	half_w := wh[0] * 0.5
	half_h := wh[1] * 0.5
	screen_ortho :=
		linalg.matrix_ortho3d_f32(-half_w, half_w, -half_h, half_h, -1, 1) *
		linalg.matrix4_translate_f32({-half_w, -half_h, 0})
	sys_nine_patch(w, &screen_ortho)
	sg.end_pass()
	sg.commit()
}


init :: proc(w: ^World, wh: [2]f32) {
	w.offscreen = sg.make_image(
		{usage = {color_attachment = true}, width = GAME_RESOLUTION[0], height = GAME_RESOLUTION[1]},
	)

	w.next_entity_id = 100
	w.sim_frame_length = 1.0 / 60.0
	w.cam = camera_init(wh, wh / 2, 1.0)
	w.sprite_pipe = sprites_init(w.atlas)
	w.tilemap_pipe = tilemap_init(w.atlas, w.lut)
	w.nine_patch_pipe = nine_patch_init(w.atlas)
	// THE FIRST MOCK DATA

	player := create_entity(w)
	logic.add_component(&w.brain, player, Brain{})
	logic.add_component(&w.input, player, Input{})
	w.player1, _ = logic.get_component(&w.input, player)
	logic.add_component(&w.velocity, player, Velocity{})
	// logic.add_component(&w.position, player, Position{150 * UNIT, 128 * UNIT})
	logic.add_component(&w.position, player, Position{})
	logic.add_component(&w.sprite, player, Sprite{pos = {00, 00}, opacity = 1, uv = w.uv[968], size = {128, 128}})

	ui := create_entity(w)
	logic.add_component(
		&w.nine_patch,
		ui,
		Nine_Patch{bounds = {20, 20, 420, 120}, slices = {6, 7, 11, 10}, size = {16, 16}, uv = w.uv[418]},
	)

	// logic.add_component(&w.position, background, Position{0 * UNIT, 0 * UNIT})
	// // logic.add_component(
	// // 	&w.sprite,
	// // 	background,
	// // 	Sprite{opacity = 1, uv = {0, 0, 1, 1}, size = {256, 256}},
	// // )
	// logic.add_component(
	// 	&w.tilemap,
	// 	background,
	// 	Tilemap{tile_size = {16, 16}, tileset_uv = {0, 0, 1, 1}, lut_uv = {0, 0, 1, 1}},
	// )
	//
	host.info("world", "init", w.tilemap.components[0])
}

create_entity :: proc(w: ^World) -> logic.Entity {
	id := w.next_entity_id
	w.next_entity_id += 1

	return id
}

entity_delete :: proc(w: ^World, entity_id: logic.Entity) {
	logic.delete_component(&w.position, entity_id)
	logic.delete_component(&w.velocity, entity_id)
	logic.delete_component(&w.sprite, entity_id)
	logic.delete_component(&w.tilemap, entity_id)
	logic.delete_component(&w.nine_patch, entity_id)
	logic.delete_component(&w.brain, entity_id)
	logic.delete_component(&w.input, entity_id)
	logic.delete_component(&w.timer, entity_id)
}

cleanup :: proc(w: ^World) {
	if w.offscreen.id != 0 {
		sg.destroy_image(w.offscreen)
		w.offscreen = {}
	}
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	sprites_cleanup(w.sprite_pipe)
	logic.destroy_storage(&w.sprite)
	tilemap_cleanup(w.tilemap_pipe)
	logic.destroy_storage(&w.tilemap)
	nine_patch_cleanup(w.nine_patch_pipe)
	logic.destroy_storage(&w.nine_patch)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.timer)
}
