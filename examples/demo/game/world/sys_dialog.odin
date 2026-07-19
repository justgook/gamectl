package world

import "../director"
import "../host"

sys_dialog :: proc(w: ^World) {
	assert(w.input_mode == .Dialog)

	answer_index := -1
	if .Action1 in w.dialog_pressed {
		answer_index = 0
	} else if .Action2 in w.dialog_pressed {
		answer_index = 1
	} else if .Action3 in w.dialog_pressed {
		answer_index = 2
	} else if .Action4 in w.dialog_pressed {
		answer_index = 3
	}

	if answer_index < 0 {
		return
	}
	w.dialog_pressed = {}

	answer, exists := director.entity_link(&w.director, w.active_dialog, w.director_config.answer_links[answer_index])
	if !exists {
		return
	}

	host.info("sys_dialog", "answer selected", answer_index + 1, answer)
	result := director.trigger(&w.director, director.Trigger{kind = .Entity, entity = answer})
	assert(result.matched)
	apply_director_changes(w, result.changes)
}

// sys_dialog_state reconciles the game input mode with Director's PLAYER.dialog
// link. Director is the sole authority for opening, changing, and closing dialogs.
sys_dialog_state :: proc(w: ^World) {
	dialog, exists := director.entity_link(&w.director, w.director_config.player, w.director_config.dialog)
	if !exists {
		if w.input_mode == .Dialog {
			exit_dialog_mode(w)
		}
		return
	}

	assert(director.entity_has_tag(&w.director, dialog, w.director_config.dialog))
	assert(director.entity_stat(&w.director, dialog, w.director_config.text_id) > 0)

	if w.input_mode == .Gameplay {
		enter_dialog_mode(w, dialog)
		return
	}

	if w.active_dialog != dialog {
		change_dialog_mode(w, dialog)
	}
}
