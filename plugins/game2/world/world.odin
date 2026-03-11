package world

import "../host"
import "camera"
import "grid"
import "logic"

World :: struct {
	next_entity_id:   int,
	sim_frame_length: f64,
	accumulator:      f64,
	grid:             grid.Grid,
	cam:              camera.Camera,
	position:         logic.Component_Storage(Position),
	velocity:         logic.Component_Storage(Velocity),
	sprite:           logic.Component_Storage(Sprite), // make it real from render
	brain:            logic.Component_Storage(Brain),
	input:            logic.Component_Storage(Input),
	timer:            logic.Component_Storage(Timer),
}

frame :: proc(w: ^World, dt: f64) {
	w.accumulator += dt //
	for (w.accumulator >= w.sim_frame_length) {
		w.accumulator -= w.sim_frame_length
		sys_velocity(w)
		sys_brain(w)
	}

	sys_camera(w)
}


init :: proc(w: ^World) {
	w.sim_frame_length = 1.0 / 60.0
	w.cam = camera.camera_init({host.widthf() / 2, host.heightf() / 2}, 1.0)

	// fmt.println("WORLD init")
}

entity_delete :: proc(w: ^World, entity_id: int) {
	logic.delete_component(&w.position, entity_id)
	logic.delete_component(&w.velocity, entity_id)
	logic.delete_component(&w.sprite, entity_id)
	logic.delete_component(&w.brain, entity_id)
	logic.delete_component(&w.input, entity_id)
	logic.delete_component(&w.timer, entity_id)
}

cleanup :: proc(w: ^World) {
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	logic.destroy_storage(&w.sprite)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.timer)
}
