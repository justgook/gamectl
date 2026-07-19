#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../data_bullet"
import "../director"
import "core:testing"
import "logic"
import "shape"

ATTACK_PLAYER :: director.Entity_Id(0)
ATTACK_ENEMY :: director.Entity_Id(1)
ATTACK_PATROLLING :: director.Entity_Id(2)
ATTACK_CHASING :: director.Entity_Id(3)
ATTACK_ATTACKING :: director.Entity_Id(4)
ATTACK_ENEMY_TAG :: director.Word_Id(0)
ATTACK_ENTER :: director.Word_Id(1)
ATTACK_EXIT :: director.Word_Id(2)
ATTACK_RANGE :: director.Word_Id(3)
ATTACK_TARGET :: director.Word_Id(4)
ATTACK_BEHAVIOR :: director.Word_Id(5)
ATTACK_SEES :: director.Word_Id(6)
ATTACK_FIRING :: director.Word_Id(7)

attack_player_matcher :: director.Matcher {
	selector = {kind = .Entity, entity = ATTACK_PLAYER},
}
attack_queries := [?]director.Query {
	{kind = .Has_Tag, key = ATTACK_ENEMY_TAG},
	{kind = .Has_Link, key = ATTACK_ENTER, link_value = {kind = .Specific_Matcher, matcher_index = 0}},
	{kind = .Has_Tag, key = ATTACK_ENEMY_TAG},
	{kind = .Has_Link, key = ATTACK_EXIT, link_value = {kind = .Specific_Matcher, matcher_index = 0}},
}
attack_matchers := [?]director.Matcher {
	attack_player_matcher,
	{selector = {kind = .Any}, queries = {offset = 0, count = 2}},
	{selector = {kind = .Any}, queries = {offset = 2, count = 2}},
}
attack_changes := [?]director.Change {
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = ATTACK_RANGE,
		link_target = {kind = .Entity, entity = ATTACK_PLAYER},
	},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = ATTACK_TARGET,
		link_target = {kind = .Entity, entity = ATTACK_PLAYER},
	},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = ATTACK_BEHAVIOR,
		link_target = {kind = .Entity, entity = ATTACK_ATTACKING},
	},
	{target = {kind = .Trigger}, kind = .Add_Tag, key = ATTACK_FIRING},
	{target = {kind = .Trigger}, kind = .Remove_Link, key = ATTACK_RANGE},
	{target = {kind = .Trigger}, kind = .Remove_Tag, key = ATTACK_FIRING},
	{
		target = {kind = .Trigger},
		kind = .Set_Link,
		key = ATTACK_BEHAVIOR,
		link_target = {kind = .Entity, entity = ATTACK_CHASING},
	},
}
attack_rules := [?]director.Rule {
	{id = 0, trigger = {kind = .Entity_Matcher, matcher_index = 1}, changes = {offset = 0, count = 4}},
	{id = 1, trigger = {kind = .Entity_Matcher, matcher_index = 2}, changes = {offset = 4, count = 3}},
}
attack_enemy_tags := [?]director.Word_Id{ATTACK_ENEMY_TAG}
attack_enemy_links := [?]director.Link {
	{key = ATTACK_BEHAVIOR, target = ATTACK_CHASING},
	{key = ATTACK_TARGET, target = ATTACK_PLAYER},
	{key = ATTACK_SEES, target = ATTACK_PLAYER},
}
attack_entities := [?]director.Entity_Def {
	{id = ATTACK_PLAYER},
	{id = ATTACK_ENEMY, tags = attack_enemy_tags[:], links = attack_enemy_links[:]},
	{id = ATTACK_PATROLLING},
	{id = ATTACK_CHASING},
	{id = ATTACK_ATTACKING},
}
attack_data := director.Director_Data {
	entities = attack_entities[:],
	rules    = attack_rules[:],
	matchers = attack_matchers[:],
	queries  = attack_queries[:],
	changes  = attack_changes[:],
}
attack_test_bullet_actions := [?]data_bullet.Action{nil}
attack_test_bullet_pattern := data_bullet.Bullet_Pattern {
	actions = attack_test_bullet_actions[:],
}

@(private = "file")
attack_test_world :: proc() -> ^World {
	w := new(World)
	w.director = director.init(attack_data)
	w.director_config = {
		player       = ATTACK_PLAYER,
		attack_enter = ATTACK_ENTER,
		attack_exit  = ATTACK_EXIT,
		behavior     = ATTACK_BEHAVIOR,
		target       = ATTACK_TARGET,
		firing       = ATTACK_FIRING,
		patrolling   = ATTACK_PATROLLING,
		chasing      = ATTACK_CHASING,
		attacking    = ATTACK_ATTACKING,
	}
	w.player1_id = 10
	logic.add_component(&w.position, w.player1_id, Position{20 * UNIT, 0})
	logic.add_component(&w.position, 11, Position{})
	logic.add_component(&w.enemy_attack_area, 11, Enemy_Attack_Area{circle = shape.Circle{radius = 10 * UNIT}})
	logic.add_component(&w.director_entity, 11, Director_Entity{id = ATTACK_ENEMY})
	logic.add_component(&w.brain, 11, Brain(1))
	logic.add_component(&w.input, 11, Input{.East})
	logic.add_component(&w.bullet, 11, bullet_component(&attack_test_bullet_pattern))
	logic.add_component(&w.platformer, 11, Platformer{facing = 1})
	return w
}

@(private = "file")
attack_test_world_destroy :: proc(w: ^World) {
	director.destroy(&w.director)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.enemy_attack_area)
	logic.destroy_storage(&w.director_entity)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.input)
	bullet_destroy_state_storage(&w.bullet)
	logic.destroy_storage(&w.platformer)
	free(w)
}

@(test)
test_attack_area_commands_brain_to_hold_and_release_fire :: proc(t: ^testing.T) {
	w := attack_test_world()
	defer attack_test_world_destroy(w)

	sys_enemy_attack_area(w)
	player_pos, has_player_pos := logic.get_component(&w.position, w.player1_id)
	assert(has_player_pos)
	player_pos.x = 5 * UNIT
	sys_enemy_attack_area(w)

	behavior, has_behavior := director.entity_link(&w.director, ATTACK_ENEMY, ATTACK_BEHAVIOR)
	testing.expectf(t, has_behavior && behavior == ATTACK_ATTACKING, "attack behavior = %v", behavior)
	testing.expect(t, director.entity_has_tag(&w.director, ATTACK_ENEMY, ATTACK_FIRING))
	_, has_temporary_enter := director.entity_link(&w.director, ATTACK_ENEMY, ATTACK_ENTER)
	testing.expect(t, !has_temporary_enter)

	sys_brain(w)
	input, has_input := logic.get_component(&w.input, 11)
	testing.expectf(t, has_input && input^ == Input{.Action3}, "attacking input = %v", input)
	sys_weapon(w)
	weapon, has_weapon := logic.get_component(&w.bullet, 11)
	testing.expectf(t, has_weapon && !weapon.done, "firing weapon = %v", weapon)

	player_pos.x = 20 * UNIT
	sys_enemy_attack_area(w)
	behavior, has_behavior = director.entity_link(&w.director, ATTACK_ENEMY, ATTACK_BEHAVIOR)
	testing.expectf(t, has_behavior && behavior == ATTACK_CHASING, "post-attack behavior = %v", behavior)
	testing.expect(t, !director.entity_has_tag(&w.director, ATTACK_ENEMY, ATTACK_FIRING))

	sys_brain(w)
	testing.expectf(t, input^ == Input{.East}, "released firing input = %v", input)
}
