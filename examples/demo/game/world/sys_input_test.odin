#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "core:testing"

@(test)
test_dialog_mode_requires_release_before_held_action_can_select :: proc(t: ^testing.T) {
	player_input: Input
	w := new(World)
	defer free(w)
	w.player1 = &player_input

	input_action_down(w, .Action1)
	testing.expect(t, .Action1 in player_input)

	enter_dialog_mode(w, 1)
	testing.expect(t, player_input == {})

	// Repeated key-down while physically held must not become a dialog press.
	input_action_down(w, .Action1)
	sys_dialog(w)
	testing.expect(t, w.input_mode == .Dialog)

	input_action_up(w, .Action1)
	input_action_down(w, .Action1)
	sys_dialog(w)
	testing.expect(t, w.input_mode == .Gameplay)
	testing.expect(t, player_input == {})
}

@(test)
test_each_action_selects_mock_answer_and_exits_dialog :: proc(t: ^testing.T) {
	actions := [4]InputSet{.Action1, .Action2, .Action3, .Action4}
	for action in actions {
		player_input: Input
		w := new(World)
		w.player1 = &player_input
		enter_dialog_mode(w, 1)

		input_action_down(w, action)
		sys_dialog(w)

		testing.expect(t, w.input_mode == .Gameplay)
		testing.expect(t, w.active_dialog_text_id == 0)
		testing.expect(t, player_input == {})
		free(w)
	}
}
