package world

Input_Mode :: enum {
	Gameplay,
	Dialog,
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

enter_dialog_mode :: proc(w: ^World, text_id: i32) {
	assert(w.input_mode == .Gameplay)
	assert(text_id > 0)
	clear_routed_input(w)
	w.active_dialog_text_id = text_id
	w.input_mode = .Dialog
}

exit_dialog_mode :: proc(w: ^World) {
	assert(w.input_mode == .Dialog)
	clear_routed_input(w)
	w.active_dialog_text_id = 0
	w.input_mode = .Gameplay
}

@(private = "file")
clear_routed_input :: proc(w: ^World) {
	assert(w.player1 != nil)
	w.player1^ = {}
	w.dialog_pressed = {}
}
