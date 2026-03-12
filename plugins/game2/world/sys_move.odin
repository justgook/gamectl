package world
import "logic"

sys_move :: proc(w: ^World) {
	view := logic.view(&w.input, &w.velocity)
	for _, input, vel in logic.each(&view) {
		vel.x = (int(.East in input) - int(.West in input)) * 100
		vel.y = (int(.North in input) - int(.South in input)) * 100
	}
}
