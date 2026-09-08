#+test

package station

import "core:testing"
import director "../director"

E_PLAYER :: director.Entity_Id(0)
E_SWITCH :: director.Entity_Id(1)
E_KEY :: director.Entity_Id(2)
E_EXIT :: director.Entity_Id(3)
W_POWERED :: director.Word_Id(0)
W_KEY :: director.Word_Id(1)
W_LOCKED :: director.Word_Id(2)

fixture_exit_tags := [?]director.Word_Id{W_LOCKED}
fixture_entities := [?]director.Entity_Def {
	{id = E_PLAYER}, {id = E_SWITCH}, {id = E_KEY},
	{id = E_EXIT, tags = fixture_exit_tags[:]},
}
fixture_queries := [?]director.Query {
	{kind = .Has_Tag, key = W_POWERED},
	{kind = .Has_Tag, key = W_KEY},
}
fixture_matchers := [?]director.Matcher {
	{selector = {kind = .Entity, entity = E_SWITCH}},
	{selector = {kind = .Entity, entity = E_KEY}},
	{selector = {kind = .Entity, entity = E_EXIT}},
	{selector = {kind = .Entity, entity = E_PLAYER}, queries = {offset = 0, count = 1}},
	{selector = {kind = .Entity, entity = E_PLAYER}, queries = {offset = 1, count = 1}},
}
fixture_changes := [?]director.Change {
	{target = {kind = .Entity, entity = E_PLAYER}, kind = .Add_Tag, key = W_POWERED},
	{target = {kind = .Entity, entity = E_PLAYER}, kind = .Add_Tag, key = W_KEY},
	{target = {kind = .Entity, entity = E_KEY}, kind = .Remove_Entity},
	{target = {kind = .Entity, entity = E_EXIT}, kind = .Remove_Tag, key = W_LOCKED},
}
power_rules := [?]director.Rule {
	{id = 0, trigger = {kind = .Entity_Matcher, matcher_index = 0}, changes = {offset = 0, count = 1}},
	{id = 1, trigger = {kind = .Entity_Matcher, matcher_index = 1}, changes = {offset = 1, count = 2}},
	{id = 2, trigger = {kind = .Entity_Matcher, matcher_index = 2}, conditions = {offset = 3, count = 1}, changes = {offset = 3, count = 1}},
}
key_rules := [?]director.Rule {
	{id = 0, trigger = {kind = .Entity_Matcher, matcher_index = 0}, changes = {offset = 0, count = 1}},
	{id = 1, trigger = {kind = .Entity_Matcher, matcher_index = 1}, changes = {offset = 1, count = 2}},
	{id = 2, trigger = {kind = .Entity_Matcher, matcher_index = 2}, conditions = {offset = 4, count = 1}, changes = {offset = 3, count = 1}},
}
fixture_bindings := [?]Binding {
	{.Entity, "PLAYER", 0}, {.Entity, "POWER_SWITCH", 1}, {.Entity, "ACCESS_KEY", 2}, {.Entity, "EXIT", 3},
	{.Word, "powered", 0}, {.Word, "carrying_key", 1}, {.Word, "locked", 2},
}

fixture_data :: proc(key_variant: bool) -> director.Director_Data {
	rules := power_rules[:]
	if key_variant {rules = key_rules[:]}
	return {
		entities = fixture_entities[:], rules = rules, matchers = fixture_matchers[:],
		queries = fixture_queries[:], changes = fixture_changes[:],
	}
}

attempt :: proc(state: ^State, position: Vec2) {
	state.player = position
	interact(state)
}

@(test)
test_rule_matrix_uses_director_prerequisite :: proc(t: ^testing.T) {
	variants := [?]bool{false, true}
	for key_variant in variants {
		for scenario in 0 ..< 4 {
			state := init(fixture_data(key_variant), fixture_bindings[:])
			if scenario & 1 != 0 {attempt(&state, SWITCH_POS)}
			if scenario & 2 != 0 {attempt(&state, KEY_POS)}
			attempt(&state, EXIT_POS)
			expected_open := scenario & (key_variant ? 2 : 1) != 0
			testing.expectf(
				t, is_locked(&state) != expected_open,
				"variant key=%v scenario=%d locked=%v", key_variant, scenario, is_locked(&state),
			)
			destroy(&state)
		}
	}
}

@(test)
test_rejected_exit_can_retry_and_restart_restores_state :: proc(t: ^testing.T) {
	state := init(fixture_data(false), fixture_bindings[:])
	defer destroy(&state)
	attempt(&state, EXIT_POS)
	testing.expect(t, is_locked(&state))
	testing.expect(t, state.message == .Exit_Locked)
	attempt(&state, SWITCH_POS)
	attempt(&state, EXIT_POS)
	testing.expect(t, !is_locked(&state))

	attempt(&state, KEY_POS)
	attempt(&state, KEY_POS)
	testing.expect(t, has_key(&state))
	restart(&state)
	testing.expect(t, is_locked(&state))
	testing.expect(t, !has_power(&state) && !has_key(&state))
	testing.expect(t, state.player == PLAYER_START)
}

@(test)
test_open_exit_reaches_completion :: proc(t: ^testing.T) {
	state := init(fixture_data(false), fixture_bindings[:])
	defer destroy(&state)
	attempt(&state, SWITCH_POS)
	attempt(&state, EXIT_POS)
	state.player = {1.0, 0}
	step(&state, 1.0 / 60.0)
	testing.expect(t, state.completed)
	testing.expect(t, state.message == .Complete)
}
