package world
import "grid"
import "logic"
import "shape"


sys_bullet_collision :: proc(w: ^World) {
	// View bullets: entities with player_hit, position, velocity (but no collider)
	view := logic.view(&w.player_hit, &w.position, &w.velocity)
	do_collision(w, &view)
	view = logic.view(&w.enemy_hit, &w.position, &w.velocity)
	do_collision(w, &view)
}

@(private = "file")
do_collision :: proc(w: ^World, view: ^logic.View3(shape.Circle, Position, Velocity)) {
	bullets_to_delete: [dynamic]logic.Entity
	defer delete(bullets_to_delete)

	for entity, hit_circle, pos, vel in logic.each(view) {
		// Check if bullet path intersects any wall
		movement := [4]int{int(pos.x), int(pos.y), int(pos.x + vel.x), int(pos.y + vel.y)}

		found := grid.query_segment(&w.grid, &movement)
		defer delete(found)

		for wall in found {
			if shape.segment_segment_test(wall, &movement) {
				// Hit a wall! Spawn impact effect and mark for deletion
				// pixel_pos := to_pixelf(pos^)

				// Direction for particles (opposite of bullet travel)
				// dir: f32 = vel.x > 0 ? 3.14159 : 0.0
				// fx_hit_wall(&w.particles, pixel_pos.x, pixel_pos.y, dir)

				append(&bullets_to_delete, entity)
				break
			}
		}
	}

	// Delete bullets that hit walls
	for bullet in bullets_to_delete {
		entity_delete(w, bullet)
	}
}
