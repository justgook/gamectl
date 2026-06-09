package bullet

Command :: enum {
	Spawn,
	Vanish,
	ChangeDirection,
	ChangeSpeed,
	Accel,
}

tick :: proc() -> []Command {

}

//
// Particle :: struct {
// 	lifetime:  int,
// 	on_create: proc(w: ^World, particle_id: int, emitter_id: int),
// 	on_update: proc(w: ^World, entity: int, data: rawptr),
// }
//
// Emitter :: struct {
// 	max_particles:     int,
// 	current_particles: int,
// 	template:          Particle,
// 	spawn_pattern:     proc(frame: int) -> int, // Returns particles to spawn this frame
// 	current_frame:     int,
// }
//
// //TODO change this system to Lifetime on_update callback.
// sys_particles :: proc(w: ^World) {
// 	emitter_view := logic.view(&w.emitter)
// 	for emitter_id, emitter in logic.each(&emitter_view) {
// 		emmiter_update(w, emitter_id, emitter)
// 	}
// }
// @(private = "file")
// emmiter_update :: proc(w: ^World, entity: int, emitter: ^Emitter) {
// 	emitter.current_frame += 1
// 	remaining := emitter.max_particles - emitter.current_particles
//
// 	spawn_count := emitter.spawn_pattern(emitter.current_frame)
// 	to_spawn := min(remaining, spawn_count)
// 	emitter.current_particles += to_spawn
//
// 	for i := 0; i < to_spawn; i += 1 {
// 		spawn_particle(w, entity, emitter)
// 	}
// }
//
// spawn_particle :: proc(w: ^World, entity: int, emitter: ^Emitter) {
// 	if emitter.template.on_create == nil {return}
// 	particle := create_entity(w)
// 	emitter.template.on_create(w, particle, entity)
//
// 	lifetime := Timer {
// 		frames           = emitter.template.lifetime,
// 		data             = &emitter.current_particles,
// 		disable_autofree = true,
// 		on_complete      = on_complete,
// 	}
//
// 	logic.add_component(&w.timer, particle, lifetime)
// }
//
//
// @(private = "file")
// on_complete :: proc(w: ^World, entity: int, data: rawptr) {
// 	if data == nil {return}
// 	count := cast(^int)data
// 	count^ -= 1
// }
