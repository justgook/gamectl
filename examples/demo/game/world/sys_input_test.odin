#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../director"
import "core:testing"
import "logic"

D_PLAYER :: director.Entity_Id(0)
D_ROOT :: director.Entity_Id(1)
D_JOB_ANSWER :: director.Entity_Id(2)
D_JOB_RESULT :: director.Entity_Id(3)
D_LEAVE_ANSWER :: director.Entity_Id(4)

D_HP :: director.Word_Id(0)
D_DIALOG :: director.Word_Id(1)
D_TEXT_ID :: director.Word_Id(2)
D_ANSWER_1 :: director.Word_Id(3)
D_ANSWER_2 :: director.Word_Id(4)
D_ANSWER_3 :: director.Word_Id(5)
D_ANSWER_4 :: director.Word_Id(6)

D_RULE_JOB :: director.Rule_Id(0)
D_RULE_LEAVE :: director.Rule_Id(1)

dialog_test_player_stats := [?]director.Stat{{key = D_HP, value = 100}}
dialog_test_player_links := [?]director.Link{{key = D_DIALOG, target = D_ROOT}}
dialog_test_root_tags := [?]director.Word_Id{D_DIALOG}
dialog_test_root_stats := [?]director.Stat{{key = D_TEXT_ID, value = 1}}
dialog_test_root_links := [?]director.Link {
	{key = D_ANSWER_1, target = D_JOB_ANSWER},
	{key = D_ANSWER_4, target = D_LEAVE_ANSWER},
}
dialog_test_result_tags := [?]director.Word_Id{D_DIALOG}
dialog_test_result_stats := [?]director.Stat{{key = D_TEXT_ID, value = 2}}
dialog_test_result_links := [?]director.Link{{key = D_ANSWER_1, target = D_LEAVE_ANSWER}}
dialog_test_job_answer_stats := [?]director.Stat{{key = D_TEXT_ID, value = 10}}
dialog_test_leave_answer_stats := [?]director.Stat{{key = D_TEXT_ID, value = 13}}
dialog_test_entities := [?]director.Entity_Def {
	{id = D_PLAYER, stats = dialog_test_player_stats[:], links = dialog_test_player_links[:]},
	{
		id = D_ROOT,
		tags = dialog_test_root_tags[:],
		stats = dialog_test_root_stats[:],
		links = dialog_test_root_links[:],
	},
	{id = D_JOB_ANSWER, stats = dialog_test_job_answer_stats[:]},
	{
		id = D_JOB_RESULT,
		tags = dialog_test_result_tags[:],
		stats = dialog_test_result_stats[:],
		links = dialog_test_result_links[:],
	},
	{id = D_LEAVE_ANSWER, stats = dialog_test_leave_answer_stats[:]},
}
dialog_test_matchers := [?]director.Matcher {
	{selector = {kind = .Entity, entity = D_JOB_ANSWER}},
	{selector = {kind = .Entity, entity = D_LEAVE_ANSWER}},
}
dialog_test_changes := [?]director.Change {
	{
		target = {kind = .Entity, entity = D_PLAYER},
		kind = .Set_Link,
		key = D_DIALOG,
		link_target = {kind = .Entity, entity = D_JOB_RESULT},
	},
	{target = {kind = .Entity, entity = D_PLAYER}, kind = .Dec_Stat, key = D_HP, int_value = 10},
	{target = {kind = .Entity, entity = D_PLAYER}, kind = .Remove_Link, key = D_DIALOG},
}
dialog_test_rules := [?]director.Rule {
	{id = D_RULE_JOB, trigger = {kind = .Entity_Matcher, matcher_index = 0}, changes = {offset = 0, count = 2}},
	{id = D_RULE_LEAVE, trigger = {kind = .Entity_Matcher, matcher_index = 1}, changes = {offset = 2, count = 1}},
}
dialog_test_data := director.Director_Data {
	entities = dialog_test_entities[:],
	rules    = dialog_test_rules[:],
	matchers = dialog_test_matchers[:],
	changes  = dialog_test_changes[:],
}

@(private = "file")
dialog_test_world :: proc() -> ^World {
	w := new(World)
	w.player1 = new(Input)
	w.director = director.init(dialog_test_data)
	w.director_config = {
		player       = D_PLAYER,
		dialog       = D_DIALOG,
		text_id      = D_TEXT_ID,
		answer_links = {D_ANSWER_1, D_ANSWER_2, D_ANSWER_3, D_ANSWER_4},
	}
	return w
}

@(private = "file")
dialog_test_world_destroy :: proc(w: ^World) {
	director.destroy(&w.director)
	logic.destroy_storage(&w.position)
	free(w.player1)
	free(w)
}

@(test)
test_dialog_mode_requires_release_before_held_action_can_select :: proc(t: ^testing.T) {
	w := dialog_test_world()
	defer dialog_test_world_destroy(w)

	input_action_down(w, .Action4)
	testing.expect(t, .Action4 in w.player1^)

	sys_dialog_state(w)
	testing.expect(t, w.input_mode == .Dialog)
	testing.expect(t, w.player1^ == {})

	// Repeated key-down while physically held must not become a dialog press.
	input_action_down(w, .Action4)
	sys_dialog(w)
	sys_dialog_state(w)
	testing.expect(t, w.input_mode == .Dialog)

	input_action_up(w, .Action4)
	input_action_down(w, .Action4)
	sys_dialog(w)
	sys_dialog_state(w)
	testing.expect(t, w.input_mode == .Gameplay)
	testing.expect(t, w.player1^ == {})
}

@(test)
test_answer_rule_changes_dialog_and_director_stats :: proc(t: ^testing.T) {
	w := dialog_test_world()
	defer dialog_test_world_destroy(w)
	sys_dialog_state(w)

	input_action_down(w, .Action1)
	sys_dialog(w)
	sys_dialog_state(w)

	testing.expect(t, w.input_mode == .Dialog)
	testing.expect(t, w.active_dialog == D_JOB_RESULT)
	testing.expect(t, director.entity_stat(&w.director, D_PLAYER, D_HP) == 90)

	input_action_up(w, .Action1)
	input_action_down(w, .Action1)
	sys_dialog(w)
	sys_dialog_state(w)
	testing.expect(t, w.input_mode == .Gameplay)
}

@(test)
test_missing_answer_link_does_nothing :: proc(t: ^testing.T) {
	w := dialog_test_world()
	defer dialog_test_world_destroy(w)
	sys_dialog_state(w)

	input_action_down(w, .Action2)
	sys_dialog(w)
	sys_dialog_state(w)

	testing.expect(t, w.input_mode == .Dialog)
	testing.expect(t, w.active_dialog == D_ROOT)
}

@(test)
test_dialog_ui_flattens_known_answer_nodes_once :: proc(t: ^testing.T) {
	w := dialog_test_world()
	defer dialog_test_world_destroy(w)
	w.player1_id = 100
	logic.add_component(&w.position, w.player1_id, Position{})

	ui_fonts_storage[3] = {
		uv         = {0, 0, 1, 1},
		glyph_size = {8, 8},
		columns    = 16,
		rows       = 16,
	}

	sys_dialog_state(w)
	answers := dialog_answers(w)
	testing.expect(t, raw_data(answers.children) == rawptr(&ui_dialog_answers_storage[0]))
	sys_ui(w)

	testing.expect(t, w.text_glyph.count > 0)
	testing.expect(t, w.text_glyph.count < TEXT_GLYPH_RENDER_MAX)
}
