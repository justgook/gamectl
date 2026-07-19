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
test_entity_tag_mutation_updates_runtime_tags :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	entity_add_tag(&state, E_PLAYER, W_explored)
	testing.expect(t, entity_has_tag(&state, E_PLAYER, W_explored))

	// Adding an existing tag is idempotent.
	entity_add_tag(&state, E_PLAYER, W_explored)
	entity_remove_tag(&state, E_PLAYER, W_explored)
	testing.expect(t, !entity_has_tag(&state, E_PLAYER, W_explored))

	// Removing an absent tag is a no-op.
	entity_remove_tag(&state, E_PLAYER, W_explored)
}

@(test)
test_entity_link_mutation_updates_runtime_links :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	entity_set_link(&state, E_PLAYER, W_held_by, E_TORCH)
	target, ok := entity_link(&state, E_PLAYER, W_held_by)
	testing.expectf(t, ok && target == E_TORCH, "runtime link = %v %v", ok, target)

	entity_set_link(&state, E_PLAYER, W_held_by, E_KEY)
	target, ok = entity_link(&state, E_PLAYER, W_held_by)
	testing.expectf(t, ok && target == E_KEY, "updated runtime link = %v %v", ok, target)

	entity_remove_link(&state, E_PLAYER, W_held_by)
	_, ok = entity_link(&state, E_PLAYER, W_held_by)
	testing.expect(t, !ok)

	// Removing an absent link is a no-op.
	entity_remove_link(&state, E_PLAYER, W_held_by)
}

@(test)
test_signal_rule_applies_changes :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Signal, signal = W_start})
	testing.expectf(t, result.matched && result.rule == R_intro, "intro result = %v", result)
	testing.expectf(t, entity_has_tag(&state, E_CAVE, W_explored), "intro should add explored tag")
	testing.expectf(
		t,
		len(result.changes) == 1 &&
		result.changes[0] == Applied_Change{kind = .Tag_Added, entity = E_CAVE, key = W_explored},
		"intro changes = %v",
		result.changes,
	)

	result = trigger(&state, Trigger{kind = .Signal, signal = W_start})
	testing.expectf(t, result.matched && len(result.changes) == 0, "idempotent intro changes = %v", result.changes)
}

@(test)
test_stat_change_reports_resolved_before_and_after_values :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Signal, signal = W_adjust})
	testing.expectf(t, result.matched && result.rule == R_adjust, "adjust result = %v", result)
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_strength) == 3, "adjusted strength")
	testing.expectf(
		t,
		len(result.changes) == 1 &&
		result.changes[0] ==
			Applied_Change{kind = .Stat_Set, entity = E_PLAYER, key = W_strength, stat_before = 5, stat_after = 3},
		"adjust changes = %v",
		result.changes,
	)
}

@(test)
test_rule_can_remove_link :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	_, had_location := entity_link(&state, E_PLAYER, W_location)
	testing.expect(t, had_location)

	result := trigger(&state, Trigger{kind = .Signal, signal = W_close})
	testing.expectf(t, result.matched && result.rule == R_close, "close result = %v", result)
	_, has_location := entity_link(&state, E_PLAYER, W_location)
	testing.expect(t, !has_location)
	testing.expectf(
		t,
		len(result.changes) == 1 &&
		result.changes[0] ==
			Applied_Change{kind = .Link_Removed, entity = E_PLAYER, key = W_location, link_before = E_CAVE},
		"close changes = %v",
		result.changes,
	)
}

@(test)
test_remove_property_removes_tags_stats_and_links_and_absent_is_noop :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	testing.expect(t, entity_has_tag(&state, E_CAVE, W_locked))
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_strength) == 5, "player strength fixture missing")
	_, had_location := entity_link(&state, E_PLAYER, W_location)
	testing.expect(t, had_location)

	result := trigger(&state, Trigger{kind = .Signal, signal = W_cleanup})
	testing.expectf(t, result.matched && result.rule == R_cleanup, "cleanup result = %v", result)
	testing.expect(t, !entity_has_tag(&state, E_CAVE, W_locked))
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_strength) == 0, "cleanup should remove strength stat")
	_, has_location := entity_link(&state, E_PLAYER, W_location)
	testing.expect(t, !has_location)
	testing.expectf(t, len(result.changes) == 3, "cleanup changes = %v", result.changes)
	testing.expectf(
		t,
		result.changes[0] == Applied_Change{kind = .Tag_Removed, entity = E_CAVE, key = W_locked},
		"cleanup tag change = %v",
		result.changes[0],
	)
	testing.expectf(
		t,
		result.changes[1] ==
		Applied_Change{kind = .Stat_Removed, entity = E_PLAYER, key = W_strength, stat_before = 5},
		"cleanup stat change = %v",
		result.changes[1],
	)
	testing.expectf(
		t,
		result.changes[2] ==
		Applied_Change{kind = .Link_Removed, entity = E_PLAYER, key = W_location, link_before = E_CAVE},
		"cleanup link change = %v",
		result.changes[2],
	)

	// Applying the same changes again exercises removal of absent properties.
	result = trigger(&state, Trigger{kind = .Signal, signal = W_cleanup})
	testing.expectf(t, result.matched && result.rule == R_cleanup, "repeated cleanup result = %v", result)
	testing.expectf(t, len(result.changes) == 0, "absent property changes = %v", result.changes)
	testing.expect(t, !entity_has_tag(&state, E_CAVE, W_locked))
	testing.expectf(t, entity_stat(&state, E_PLAYER, W_strength) == 0, "absent stat removal should be a no-op")
	_, has_location = entity_link(&state, E_PLAYER, W_location)
	testing.expect(t, !has_location)
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
	testing.expectf(t, len(result.changes) == 2, "wildcard changes = %v", result.changes)
	testing.expectf(
		t,
		result.changes[0].kind == .Link_Set &&
		result.changes[0].entity == E_TORCH &&
		result.changes[0].key == W_held_by &&
		result.changes[0].link_after == E_PLAYER,
		"torch wildcard change = %v",
		result.changes[0],
	)
	testing.expectf(
		t,
		result.changes[1].kind == .Link_Set &&
		result.changes[1].entity == E_KEY &&
		result.changes[1].key == W_held_by &&
		result.changes[1].link_after == E_PLAYER,
		"key wildcard change = %v",
		result.changes[1],
	)
}

@(test)
test_conditioned_trigger_can_unlock_cave :: proc(t: ^testing.T) {
	state := init(test_data)
	defer destroy(&state)

	result := trigger(&state, Trigger{kind = .Entity, entity = E_PLAYER})
	testing.expectf(t, result.matched && result.rule == R_unlock, "unlock result = %v", result)
	testing.expectf(t, !entity_has_tag(&state, E_CAVE, W_locked), "unlock should remove locked tag")
}
