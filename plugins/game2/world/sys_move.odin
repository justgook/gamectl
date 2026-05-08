package world
import "logic"

sys_move :: proc(w: ^World) {
	view := logic.view(&w.input, &w.velocity)
	for _, input, vel in logic.each(&view) {
		vel.x = (i32(.East in input) - i32(.West in input)) * 100
		vel.y = (i32(.North in input) - i32(.South in input)) * 100
	}
}
