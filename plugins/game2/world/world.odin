package world

import "../host"
import sg "../sokol/gfx"
import "grid"
import "logic"


World :: struct {
	next_entity_id:   int,
	sim_frame_length: f64,
	accumulator:      f64,
	atlas:            sg.Image,
	lut:              sg.Image,
	grid:             grid.Grid,
	cam:              Camera,
	player1:          ^Input,
	sprite_pipe:      ^Sprite_Pipe,
	tilemap_pipe:     ^Tilemap_Pipe,
	uv:               []UV,
	position:         logic.Component_Storage(Position),
	velocity:         logic.Component_Storage(Velocity),
	sprite:           logic.Component_Storage_Fixed(Sprite, SPRITE_RENDER_MAX),
	tilemap:          logic.Component_Storage_Fixed(Tilemap, MAX_TILEMAPS),
	brain:            logic.Component_Storage(Brain),
	input:            logic.Component_Storage(Input),
	timer:            logic.Component_Storage(Timer),
	// animations
	animation_atlas:  Animation_Atlas,
	animation:        logic.Component_Storage(Animation),
}

frame :: proc(w: ^World, dt: f64) {
	w.accumulator += dt
	for (w.accumulator >= w.sim_frame_length) {
		w.accumulator -= w.sim_frame_length
		sys_brain(w)
		sys_move(w)
		sys_velocity(w)
	}

	sys_camera(w, dt)
	sys_animation(w, dt)
	sys_tilemap(w, &w.cam.ortho)
	sys_sprite(w, &w.cam.ortho)
}


init :: proc(w: ^World) {
	w.sim_frame_length = 1.0 / 60.0
	w.cam = camera_init(
		{host.widthf(), host.heightf()},
		{host.widthf() / 2, host.heightf() / 2},
		1.0,
	)
	w.sprite_pipe = sprites_init(w.atlas)
	w.tilemap_pipe = tilemap_init(w.atlas, w.lut)
	// THE FIRST MOCK DATA

	player := create_entity(w)
	logic.add_component(&w.brain, player, Brain{})
	logic.add_component(&w.input, player, Input{})
	w.player1, _ = logic.get_component(&w.input, player)
	logic.add_component(&w.velocity, player, Velocity{})
	logic.add_component(&w.position, player, Position{150 * UNIT, 128 * UNIT})
	logic.add_component(
		&w.sprite,
		player,
		Sprite{pos = {00, 00}, opacity = 1, uv = w.uv[40], size = {128, 128}},
	)

	background := create_entity(w)
	logic.add_component(&w.position, background, Position{0 * UNIT, 128 * UNIT})
	// logic.add_component(
	// 	&w.sprite,
	// 	background,
	// 	Sprite{opacity = 1, uv = {0, 0, 1, 1}, size = {256, 256}},
	// )
	logic.add_component(
		&w.tilemap,
		background,
		Tilemap{tile_size = {16, 16}, tileset_uv = {0, 0, 1, 1}, lut_uv = {0, 0, 1, 1}},
	)

}

create_entity :: proc(w: ^World) -> int {
	id := w.next_entity_id
	w.next_entity_id += 1

	return id
}

entity_delete :: proc(w: ^World, entity_id: int) {
	logic.delete_component(&w.position, entity_id)
	logic.delete_component(&w.velocity, entity_id)
	logic.delete_component(&w.sprite, entity_id)
	logic.delete_component(&w.tilemap, entity_id)
	logic.delete_component(&w.brain, entity_id)
	logic.delete_component(&w.input, entity_id)
	logic.delete_component(&w.timer, entity_id)
}

cleanup :: proc(w: ^World) {
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	sprites_cleanup(w.sprite_pipe)
	logic.destroy_storage(&w.sprite)
	tilemap_cleanup(w.tilemap_pipe)
	logic.destroy_storage(&w.tilemap)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.timer)
}
