#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../director"
import "core:testing"
import "logic"
import "shape"

DAMAGE_PLAYER :: director.Entity_Id(0)
DAMAGE_ENEMY :: director.Entity_Id(1)
DAMAGE_ENEMY_TAG :: director.Word_Id(0)
DAMAGE_SPAWN :: director.Word_Id(1)
DAMAGE_SOURCE :: director.Word_Id(2)
DAMAGE_HP :: director.Word_Id(3)
DAMAGE_WORLD_ENTITY :: director.Word_Id(4)

damage_player_matcher :: director.Matcher {
	selector = {kind = .Entity, entity = DAMAGE_PLAYER},
}
damage_enemy_matcher :: director.Matcher {
	selector = {kind = .Entity, entity = DAMAGE_ENEMY},
}
damage_queries := [?]director.Query {
	{kind = .Has_Tag, key = DAMAGE_ENEMY_TAG},
	{kind = .Has_Tag, key = DAMAGE_SPAWN},
	{kind = .Has_Link, key = DAMAGE_SOURCE, link_value = {kind = .Specific_Matcher, matcher_index = 0}},
	{kind = .Has_Link, key = DAMAGE_SOURCE, link_value = {kind = .Specific_Matcher, matcher_index = 2}},
}
damage_matchers := [?]director.Matcher {
	damage_player_matcher,
	{selector = {kind = .Any}, queries = {offset = 0, count = 3}},
	damage_enemy_matcher,
	{selector = {kind = .Entity, entity = DAMAGE_PLAYER}, queries = {offset = 3, count = 1}},
}
damage_changes := [?]director.Change {
	{target = {kind = .Trigger}, kind = .Dec_Stat, key = DAMAGE_HP, int_value = 5},
	{target = {kind = .Trigger}, kind = .Remove_Property, key = DAMAGE_SPAWN},
	{target = {kind = .Trigger}, kind = .Dec_Stat, key = DAMAGE_HP, int_value = 5},
}
damage_rules := [?]director.Rule {
	{id = 0, trigger = {kind = .Entity_Matcher, matcher_index = 1}, changes = {offset = 0, count = 2}},
	{id = 1, trigger = {kind = .Entity_Matcher, matcher_index = 3}, changes = {offset = 2, count = 1}},
}
damage_player_stats := [?]director.Stat{{key = DAMAGE_HP, value = 100}}
damage_enemy_tags := [?]director.Word_Id{DAMAGE_ENEMY_TAG, DAMAGE_SPAWN}
damage_enemy_stats := [?]director.Stat{{key = DAMAGE_HP, value = 10}, {key = DAMAGE_WORLD_ENTITY, value = 11}}
damage_entities := [?]director.Entity_Def {
	{id = DAMAGE_PLAYER, stats = damage_player_stats[:]},
	{id = DAMAGE_ENEMY, tags = damage_enemy_tags[:], stats = damage_enemy_stats[:]},
}
damage_data := director.Director_Data {
	entities = damage_entities[:],
	rules    = damage_rules[:],
	matchers = damage_matchers[:],
	queries  = damage_queries[:],
	changes  = damage_changes[:],
}

@(private = "file")
damage_test_world :: proc() -> ^World {
	w := new(World)
	w.director = director.init(damage_data)
	w.director_config = {
		player        = DAMAGE_PLAYER,
		spawn         = DAMAGE_SPAWN,
		world_entity  = DAMAGE_WORLD_ENTITY,
		damage_source = DAMAGE_SOURCE,
	}

	logic.add_component(&w.position, 11, Position{})
	logic.add_component(&w.enemy_hurt, 11, shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT})
	logic.add_component(&w.director_entity, 11, Director_Entity{id = DAMAGE_ENEMY})

	logic.add_component(&w.position, 12, Position{})
	logic.add_component(&w.velocity, 12, Velocity{})
	logic.add_component(&w.player_hit, 12, shape.Circle{radius = 4 * UNIT})
	logic.add_component(&w.bullet, 12, Bullet{damage_source = DAMAGE_PLAYER, side = .Player})
	return w
}

@(private = "file")
damage_test_world_destroy :: proc(w: ^World) {
	director.destroy(&w.director)
	delete(w.free_entity_ids)
	delete(w.free_entity_ids_lookup)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	logic.destroy_storage(&w.enemy_hurt)
	logic.destroy_storage(&w.player_hurt)
	logic.destroy_storage(&w.player_hit)
	logic.destroy_storage(&w.enemy_hit)
	bullet_destroy_state_storage(&w.bullet)
	logic.destroy_storage(&w.director_entity)
	free(w)
}

@(test)
test_player_bullet_damage_applies_all_director_changes_and_consumes_bullet :: proc(t: ^testing.T) {
	w := damage_test_world()
	defer damage_test_world_destroy(w)

	sys_bullet_collision(w)

	testing.expectf(t, director.entity_stat(&w.director, DAMAGE_ENEMY, DAMAGE_HP) == 5, "enemy hp after hit")
	testing.expect(t, !director.entity_has_tag(&w.director, DAMAGE_ENEMY, DAMAGE_SPAWN))
	_, has_damage_source := director.entity_link(&w.director, DAMAGE_ENEMY, DAMAGE_SOURCE)
	testing.expect(t, !has_damage_source)
	testing.expect(t, !logic.has_component(&w.bullet, 12))
	testing.expect(t, !logic.has_component(&w.director_entity, 11))
}

@(test)
test_enemy_bullet_routes_damage_to_player :: proc(t: ^testing.T) {
	w := damage_test_world()
	defer damage_test_world_destroy(w)

	entity_delete(w, 12)
	logic.add_component(&w.position, 10, Position{})
	logic.add_component(&w.player_hurt, 10, shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT})
	logic.add_component(&w.director_entity, 10, Director_Entity{id = DAMAGE_PLAYER})
	logic.add_component(&w.position, 13, Position{})
	logic.add_component(&w.velocity, 13, Velocity{})
	logic.add_component(&w.enemy_hit, 13, shape.Circle{radius = 4 * UNIT})
	logic.add_component(&w.bullet, 13, Bullet{damage_source = DAMAGE_ENEMY, side = .Enemy})

	sys_bullet_collision(w)

	testing.expectf(t, director.entity_stat(&w.director, DAMAGE_PLAYER, DAMAGE_HP) == 95, "player hp after hit")
	_, has_damage_source := director.entity_link(&w.director, DAMAGE_PLAYER, DAMAGE_SOURCE)
	testing.expect(t, !has_damage_source)
	testing.expect(t, !logic.has_component(&w.bullet, 13))
	testing.expect(t, logic.has_component(&w.director_entity, 10))
}
