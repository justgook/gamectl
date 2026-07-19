#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../director"
import "core:testing"
import "logic"

VISION_PLAYER :: director.Entity_Id(0)
VISION_ENEMY :: director.Entity_Id(1)
VISION_PATROLLING :: director.Entity_Id(2)
VISION_CHASING :: director.Entity_Id(3)
VISION_ENEMY_TAG :: director.Word_Id(0)
VISION_ENTER :: director.Word_Id(1)
VISION_EXIT :: director.Word_Id(2)
VISION_ALERTED :: director.Word_Id(3)
VISION_BEHAVIOR :: director.Word_Id(4)
VISION_TARGET :: director.Word_Id(5)

vision_player_matcher :: director.Matcher {
	selector = {kind = .Entity, entity = VISION_PLAYER},
}
vision_queries := [?]director.Query {
	{kind = .Has_Tag, key = VISION_ENEMY_TAG},
	{kind = .Has_Link, key = VISION_ENTER, link_value = {kind = .Specific_Matcher, matcher_index = 0}},
	{kind = .Has_Tag, key = VISION_ENEMY_TAG},
	{kind = .Has_Link, key = VISION_EXIT, link_value = {kind = .Specific_Matcher, matcher_index = 0}},
}
vision_matchers := [?]director.Matcher {
	vision_player_matcher,
	{selector = {kind = .Any}, queries = {offset = 0, count = 2}},
	{selector = {kind = .Any}, queries = {offset = 2, count = 2}},
}
vision_changes := [?]director.Change {
	{target = {kind = .Trigger}, kind = .Add_Tag, key = VISION_ALERTED},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = VISION_TARGET,
		link_target = {kind = .Entity, entity = VISION_PLAYER},
	},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = VISION_BEHAVIOR,
		link_target = {kind = .Entity, entity = VISION_CHASING},
	},
	{target = {kind = .Trigger}, kind = .Remove_Tag, key = VISION_ALERTED},
	{target = {kind = .Trigger}, kind = .Remove_Link, key = VISION_TARGET},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = VISION_BEHAVIOR,
		link_target = {kind = .Entity, entity = VISION_PATROLLING},
	},
}
vision_rules := [?]director.Rule {
	{id = 0, trigger = {kind = .Entity_Matcher, matcher_index = 1}, changes = {offset = 0, count = 3}},
	{id = 1, trigger = {kind = .Entity_Matcher, matcher_index = 2}, changes = {offset = 3, count = 3}},
}
vision_enemy_tags := [?]director.Word_Id{VISION_ENEMY_TAG}
vision_enemy_links := [?]director.Link{{key = VISION_BEHAVIOR, target = VISION_PATROLLING}}
vision_entities := [?]director.Entity_Def {
	{id = VISION_PLAYER},
	{id = VISION_ENEMY, tags = vision_enemy_tags[:], links = vision_enemy_links[:]},
	{id = VISION_PATROLLING},
	{id = VISION_CHASING},
}
vision_data := director.Director_Data {
	entities = vision_entities[:],
	rules    = vision_rules[:],
	matchers = vision_matchers[:],
	queries  = vision_queries[:],
	changes  = vision_changes[:],
}

@(private = "file")
vision_test_world :: proc(player_pos: Position) -> ^World {
	w := new(World)
	w.director = director.init(vision_data)
	w.director_config = {
		player       = VISION_PLAYER,
		vision_enter = VISION_ENTER,
		vision_exit  = VISION_EXIT,
		behavior     = VISION_BEHAVIOR,
		target       = VISION_TARGET,
		patrolling   = VISION_PATROLLING,
		chasing      = VISION_CHASING,
	}
	w.player1_id = 10
	logic.add_component(&w.position, w.player1_id, player_pos)
	logic.add_component(&w.position, 11, Position{})
	logic.add_component(&w.enemy_vision, 11, Enemy_Vision{radius = 10 * UNIT})
	logic.add_component(&w.director_entity, 11, Director_Entity{id = VISION_ENEMY})
	return w
}

@(private = "file")
vision_test_world_destroy :: proc(w: ^World) {
	director.destroy(&w.director)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.enemy_vision)
	logic.destroy_storage(&w.director_entity)
	free(w)
}

@(test)
test_enemy_vision_emits_enter_and_exit_transitions :: proc(t: ^testing.T) {
	w := vision_test_world(Position{20 * UNIT, 0})
	defer vision_test_world_destroy(w)

	sys_enemy_vision(w)
	testing.expect(t, !director.entity_has_tag(&w.director, VISION_ENEMY, VISION_ALERTED))

	player_pos, has_player_pos := logic.get_component(&w.position, w.player1_id)
	assert(has_player_pos)
	player_pos^ = {5 * UNIT, 0}
	sys_enemy_vision(w)

	vision, has_vision := logic.get_component(&w.enemy_vision, 11)
	testing.expectf(t, has_vision && vision.player_inside, "vision after enter = %v", vision)
	testing.expect(t, director.entity_has_tag(&w.director, VISION_ENEMY, VISION_ALERTED))
	behavior, has_behavior := director.entity_link(&w.director, VISION_ENEMY, VISION_BEHAVIOR)
	testing.expectf(t, has_behavior && behavior == VISION_CHASING, "enter behavior = %v", behavior)
	target, has_target := director.entity_link(&w.director, VISION_ENEMY, VISION_TARGET)
	testing.expectf(t, has_target && target == VISION_PLAYER, "vision target = %v", target)
	_, has_enter := director.entity_link(&w.director, VISION_ENEMY, VISION_ENTER)
	testing.expect(t, !has_enter)

	// Remaining inside does not emit another enter event.
	director.entity_remove_tag(&w.director, VISION_ENEMY, VISION_ALERTED)
	sys_enemy_vision(w)
	testing.expect(t, !director.entity_has_tag(&w.director, VISION_ENEMY, VISION_ALERTED))
	director.entity_add_tag(&w.director, VISION_ENEMY, VISION_ALERTED)

	player_pos^ = {20 * UNIT, 0}
	sys_enemy_vision(w)

	testing.expectf(t, !vision.player_inside, "vision after exit = %v", vision)
	testing.expect(t, !director.entity_has_tag(&w.director, VISION_ENEMY, VISION_ALERTED))
	behavior, has_behavior = director.entity_link(&w.director, VISION_ENEMY, VISION_BEHAVIOR)
	testing.expectf(t, has_behavior && behavior == VISION_PATROLLING, "exit behavior = %v", behavior)
	_, has_target = director.entity_link(&w.director, VISION_ENEMY, VISION_TARGET)
	testing.expect(t, !has_target)
	_, has_exit := director.entity_link(&w.director, VISION_ENEMY, VISION_EXIT)
	testing.expect(t, !has_exit)
}
