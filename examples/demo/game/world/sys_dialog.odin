package world

import "../host"

sys_dialog :: proc(w: ^World) {
	assert(w.input_mode == .Dialog)

	answer := 0
	if .Action1 in w.dialog_pressed {
		answer = 1
	} else if .Action2 in w.dialog_pressed {
		answer = 2
	} else if .Action3 in w.dialog_pressed {
		answer = 3
	} else if .Action4 in w.dialog_pressed {
		answer = 4
	}

	if answer == 0 {
		return
	}

	host.info("sys_dialog", "mock answer selected", answer)
	exit_dialog_mode(w)
}
