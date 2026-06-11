package world
import "logic"

sys_weapon :: proc(w: ^World) {
	view := logic.view(&w.input, &w.bullet)
	for _, input, pew in logic.each(&view) {
		if pew.done && .Action3 in input {
			bullet_restart(pew)
		}
	}
}
