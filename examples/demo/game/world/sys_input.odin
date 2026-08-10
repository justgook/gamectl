package world

import "../director"

Input_Mode :: enum {
	Gameplay,
	Dialog,
}

mouse_button_down :: proc(w: ^World) {
	assert(w.mouse_btn.down != w.mouse_btn.up)
	if w.mouse_btn.down {
		return
	}
	w.mouse_btn.down = true
	w.mouse_btn.up = false
	w.mouse_btn.just_down = true
}

mouse_button_up :: proc(w: ^World) {
	assert(w.mouse_btn.down != w.mouse_btn.up)
	if w.mouse_btn.up {
		return
	}
	w.mouse_btn.down = false
	w.mouse_btn.up = true
	w.mouse_btn.just_up = true
}

mouse_button_finish_frame :: proc(w: ^World) {
	assert(w.mouse_btn.down != w.mouse_btn.up)
	w.mouse_btn.just_down = false
	w.mouse_btn.just_up = false
}

// physical_input tracks held controls independently from the active input mode.
// Mode transitions clear routed input while preserving this latch, so a control
// held while a dialog opens cannot select an answer until released and pressed again.
input_action_down :: proc(w: ^World, action: InputSet) {
	assert(w.player1 != nil)
	if action in w.physical_input {
		return
	}
	w.physical_input += {action}

	switch w.input_mode {
	case .Gameplay:
		w.player1^ += {action}
	case .Dialog:
		if action >= .Action1 && action <= .Action4 {
			w.dialog_pressed += {action}
		}
	}
}

input_action_up :: proc(w: ^World, action: InputSet) {
	assert(w.player1 != nil)
	w.physical_input -= {action}
	if w.input_mode == .Gameplay {
		w.player1^ -= {action}
	}
}

enter_dialog_mode :: proc(w: ^World, dialog: director.Entity_Id) {
	assert(w.input_mode == .Gameplay)
	assert(dialog != director.INVALID_ENTITY)
	clear_routed_input(w)
	w.active_dialog = dialog
	w.input_mode = .Dialog
}

change_dialog_mode :: proc(w: ^World, dialog: director.Entity_Id) {
	assert(w.input_mode == .Dialog)
	assert(dialog != director.INVALID_ENTITY)
	clear_routed_input(w)
	w.active_dialog = dialog
}

exit_dialog_mode :: proc(w: ^World) {
	assert(w.input_mode == .Dialog)
	clear_routed_input(w)
	w.active_dialog = director.INVALID_ENTITY
	w.input_mode = .Gameplay
}

@(private = "file")
clear_routed_input :: proc(w: ^World) {
	assert(w.player1 != nil)
	w.player1^ = {}
	w.dialog_pressed = {}
}
