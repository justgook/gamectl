package world

import "logic"

Velocity :: [2]i32

sys_velocity :: proc(w: ^World) {
	view := logic.view(&w.position, &w.velocity)
	for _, pos, vel in logic.each(&view) {
		pos.x += vel.x
		pos.y += vel.y
	}
}
