#+build !freestanding
#+build !js
#+build !orca
#+test

package director

import "core:testing"

@(test)
test_query_supports_nested_matchers_compare_links_and_not :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	event := Trigger {
		kind   = .Entity,
		entity = E_TORCH,
	}

	matches: [dynamic]Entity_Id
	query(&state, 2, event, &matches)
	testing.expectf(t, len(matches) == 1 && matches[0] == E_GOBLIN, "nested matcher did not match goblin: %v", matches)
	clear(&matches)

	query(&state, 5, event, &matches)
	testing.expectf(t, len(matches) == 1 && matches[0] == E_PLAYER, "stat compare did not match player: %v", matches)
	clear(&matches)

	query(&state, 6, event, &matches)
	testing.expectf(t, len(matches) == 1 && matches[0] == E_KEY, "link compare did not match key: %v", matches)
	clear(&matches)

	query(&state, 7, event, &matches)
	testing.expectf(t, len(matches) == 1 && matches[0] == E_TORCH, "not query should filter suspect key: %v", matches)
	delete(matches)
}

@(test)
test_entity_set_stat_updates_and_adds_runtime_stats :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	entity_set_stat(&state, E_PLAYER, W_strength, 8)
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_strength) == 8, "existing stat was not updated")

	entity_set_stat(&state, E_PLAYER, W_world_entity, 100)
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_world_entity) == 100, "runtime stat was not added")

	entity_remove_stat(&state, E_PLAYER, W_world_entity)
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_world_entity) == 0, "runtime stat was not removed")
}

@(test)
test_signal_rule_applies_changes :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Signal, signal = W_start})
	testing.expectf(t, result.matched && result.rule == R_intro, "intro result = %v", result)
	testing.expectf(t, entity_has_tag(&state, E_CAVE, W_explored), "intro should add explored tag")
}

@(test)
test_specific_rule_weight_beats_generic_rule_and_uses_trigger_target :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Entity, entity = E_TORCH})
	testing.expectf(t, result.matched && result.rule == R_take_item, "take result = %v", result)
	target, ok := entity_link(&state, E_TORCH, W_location)
	testing.expectf(t, ok && target == E_PLAYER, "torch location should become player")
}

@(test)
test_update_all_applies_to_query_matches :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Signal, signal = W_blinded})
	testing.expectf(t, result.matched && result.rule == R_mark_items, "mark items result = %v", result)
	torch_holder, torch_ok := entity_link(&state, E_TORCH, W_held_by)
	key_holder, key_ok := entity_link(&state, E_KEY, W_held_by)
	testing.expectf(t, torch_ok && torch_holder == E_PLAYER, "torch holder = %v %v", torch_ok, torch_holder)
	testing.expectf(t, key_ok && key_holder == E_PLAYER, "key holder = %v %v", key_ok, key_holder)
}

@(test)
test_conditioned_trigger_can_unlock_cave :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Entity, entity = E_PLAYER})
	testing.expectf(t, result.matched && result.rule == R_unlock, "unlock result = %v", result)
	testing.expectf(t, !entity_has_tag(&state, E_CAVE, W_locked), "unlock should remove locked tag")
}
