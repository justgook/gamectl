#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../data_bullet"
import "../director"
import "core:testing"
import "logic"

SPAWN_COIN :: director.Entity_Id(0)
SPAWN_COIN_PREFAB :: director.Entity_Id(1)
SPAWN_ENEMY :: director.Entity_Id(2)
SPAWN_ENEMY_PREFAB :: director.Entity_Id(3)

SPAWN_PREFAB :: director.Word_Id(0)
SPAWN_PREFAB_ID :: director.Word_Id(1)
SPAWN_X :: director.Word_Id(2)
SPAWN_Y :: director.Word_Id(3)
SPAWN_WORLD_ENTITY :: director.Word_Id(4)
SPAWN_TAG :: director.Word_Id(5)
SPAWN_SIGNAL :: director.Word_Id(6)

spawn_coin_links := [?]director.Link{{key = SPAWN_PREFAB, target = SPAWN_COIN_PREFAB}}
spawn_coin_stats := [?]director.Stat{{key = SPAWN_X, value = 10}, {key = SPAWN_Y, value = 20}}
spawn_coin_prefab_stats := [?]director.Stat{{key = SPAWN_PREFAB_ID, value = i32(Prefab_Id.Coin)}}
spawn_enemy_links := [?]director.Link{{key = SPAWN_PREFAB, target = SPAWN_ENEMY_PREFAB}}
spawn_enemy_stats := [?]director.Stat{{key = SPAWN_X, value = 30}, {key = SPAWN_Y, value = 40}}
spawn_enemy_prefab_stats := [?]director.Stat{{key = SPAWN_PREFAB_ID, value = i32(Prefab_Id.Enemy)}}
spawn_entities := [?]director.Entity_Def {
	{id = SPAWN_COIN, stats = spawn_coin_stats[:], links = spawn_coin_links[:]},
	{id = SPAWN_COIN_PREFAB, stats = spawn_coin_prefab_stats[:]},
	{id = SPAWN_ENEMY, stats = spawn_enemy_stats[:], links = spawn_enemy_links[:]},
	{id = SPAWN_ENEMY_PREFAB, stats = spawn_enemy_prefab_stats[:]},
}
spawn_changes := [?]director.Change{{target = {kind = .Entity, entity = SPAWN_COIN}, kind = .Add_Tag, key = SPAWN_TAG}}
spawn_rules := [?]director.Rule {
	{id = 0, trigger = {kind = .Signal, signal = SPAWN_SIGNAL}, changes = {offset = 0, count = 1}},
}
spawn_data := director.Director_Data {
	entities = spawn_entities[:],
	rules    = spawn_rules[:],
	changes  = spawn_changes[:],
}
spawn_test_bullet_actions := [?]data_bullet.Action{nil}
spawn_test_bullet_patterns := [?]data_bullet.Bullet_Pattern{{actions = spawn_test_bullet_actions[:]}}

@(private = "file")
spawn_test_world :: proc(data: director.Director_Data) -> ^World {
	w := new(World)
	w.director = director.init(data)
	w.director_config = {
		spawn_x      = SPAWN_X,
		spawn_y      = SPAWN_Y,
		world_entity = SPAWN_WORLD_ENTITY,
		spawn        = SPAWN_TAG,
		prefab       = SPAWN_PREFAB,
		prefab_id    = SPAWN_PREFAB_ID,
	}
	w.uv = make([]UV, 13)
	w.animation_atlas.defs = make([]AnimDef, 46)
	w.bullet_patterns = spawn_test_bullet_patterns[:]
	// Entity 0 is the Director world-entity stat's "no projection" sentinel.
	w.next_entity_id = 1
	return w
}

@(private = "file")
spawn_test_world_destroy :: proc(w: ^World) {
	director.destroy(&w.director)
	delete(w.free_entity_ids)
	delete(w.free_entity_ids_lookup)
	delete(w.uv)
	delete(w.animation_atlas.defs)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	logic.destroy_storage(&w.sprite)
	logic.destroy_storage(&w.animation)
	logic.destroy_storage(&w.platformer_anim)
	logic.destroy_storage(&w.collider)
	logic.destroy_storage(&w.enemy_hurt)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.enemy_vision)
	logic.destroy_storage(&w.enemy_attack_area)
	bullet_destroy_state_storage(&w.bullet)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.target)
	logic.destroy_storage(&w.platformer)
	logic.destroy_storage(&w.director_entity)
	logic.destroy_storage(&w.director_trigger_aabb)
	free(w)
}

@(test)
test_director_spawn_dispatches_coin_prefab :: proc(t: ^testing.T) {
	w := spawn_test_world(spawn_data)
	defer spawn_test_world_destroy(w)

	result := director.trigger(&w.director, director.Trigger{kind = .Signal, signal = SPAWN_SIGNAL})
	testing.expect(t, result.matched)
	apply_director_changes(w, result.changes)

	world_entity := logic.Entity(director.entity_stat(&w.director, SPAWN_COIN, SPAWN_WORLD_ENTITY))
	testing.expect(t, world_entity > 0)
	pos, has_pos := logic.get_component(&w.position, world_entity)
	testing.expectf(t, has_pos && pos^ == Position{10, 20}, "coin position = %v", pos)
	testing.expect(t, logic.has_component(&w.sprite, world_entity))
	testing.expect(t, logic.has_component(&w.animation, world_entity))
	testing.expect(t, logic.has_component(&w.director_trigger_aabb, world_entity))
	testing.expect(t, !logic.has_component(&w.collider, world_entity))
}

@(test)
test_director_spawn_dispatches_enemy_prefab :: proc(t: ^testing.T) {
	w := spawn_test_world(spawn_data)
	defer spawn_test_world_destroy(w)

	apply_director_changes(w, []director.Applied_Change{{kind = .Tag_Added, entity = SPAWN_ENEMY, key = SPAWN_TAG}})

	world_entity := logic.Entity(director.entity_stat(&w.director, SPAWN_ENEMY, SPAWN_WORLD_ENTITY))
	testing.expect(t, world_entity > 0)
	pos, has_pos := logic.get_component(&w.position, world_entity)
	testing.expectf(t, has_pos && pos^ == Position{30, 40}, "enemy position = %v", pos)
	director_entity, has_director_entity := logic.get_component(&w.director_entity, world_entity)
	testing.expectf(
		t,
		has_director_entity && director_entity.id == SPAWN_ENEMY,
		"enemy Director mapping = %v",
		director_entity,
	)
	testing.expect(t, logic.has_component(&w.sprite, world_entity))
	animation, has_animation := logic.get_component(&w.animation, world_entity)
	testing.expectf(
		t,
		has_animation && animation.def == &w.animation_atlas.defs[15],
		"enemy animation = %v",
		animation,
	)
	platformer_anim, has_platformer_anim := logic.get_component(&w.platformer_anim, world_entity)
	testing.expectf(
		t,
		has_platformer_anim &&
		platformer_anim.set[.Idle].def == &w.animation_atlas.defs[15] &&
		platformer_anim.set[.Run].def == &w.animation_atlas.defs[16] &&
		platformer_anim.set[.Swim_Jump].def == &w.animation_atlas.defs[29],
		"enemy platformer animation = %v",
		platformer_anim,
	)
	testing.expect(t, logic.has_component(&w.collider, world_entity))
	testing.expect(t, logic.has_component(&w.enemy_hurt, world_entity))
	brain, has_brain := logic.get_component(&w.brain, world_entity)
	testing.expectf(t, has_brain && brain^ == 1, "enemy brain = %v", brain)
	vision, has_vision := logic.get_component(&w.enemy_vision, world_entity)
	testing.expectf(
		t,
		has_vision && vision.sector.radius == 96 * UNIT && !vision.player_inside,
		"enemy vision = %v",
		vision,
	)
	attack_area, has_attack_area := logic.get_component(&w.enemy_attack_area, world_entity)
	testing.expectf(
		t,
		has_attack_area && attack_area.circle.radius == 16 * UNIT && !attack_area.player_inside,
		"enemy attack area = %v",
		attack_area,
	)
	weapon, has_weapon := logic.get_component(&w.bullet, world_entity)
	testing.expectf(
		t,
		has_weapon && weapon.damage_source == SPAWN_ENEMY && weapon.side == .Enemy,
		"enemy weapon = %v",
		weapon,
	)
	testing.expect(t, logic.has_component(&w.velocity, world_entity))
	input, has_input := logic.get_component(&w.input, world_entity)
	testing.expectf(t, has_input && input^ == Input{.East}, "enemy input = %v", input)
	target, has_target := logic.get_component(&w.target, world_entity)
	testing.expectf(
		t,
		has_target && target.x == pos.x + TARGET_DISTANCE && target.y == pos.y,
		"enemy target = %v",
		target,
	)
	platformer, has_platformer := logic.get_component(&w.platformer, world_entity)
	testing.expectf(t, has_platformer && platformer.facing == 1, "enemy platformer = %v", platformer)
	testing.expect(t, !logic.has_component(&w.director_trigger_aabb, world_entity))
}

@(test)
test_director_spawn_tag_removal_deletes_world_projection :: proc(t: ^testing.T) {
	w := spawn_test_world(spawn_data)
	defer spawn_test_world_destroy(w)

	result := director.trigger(&w.director, director.Trigger{kind = .Signal, signal = SPAWN_SIGNAL})
	testing.expect(t, result.matched)
	apply_director_changes(w, result.changes)
	world_entity := logic.Entity(director.entity_stat(&w.director, SPAWN_COIN, SPAWN_WORLD_ENTITY))
	testing.expect(t, world_entity > 0)

	apply_director_changes(w, []director.Applied_Change{{kind = .Tag_Removed, entity = SPAWN_COIN, key = SPAWN_TAG}})
	testing.expect(t, director.entity_stat(&w.director, SPAWN_COIN, SPAWN_WORLD_ENTITY) == 0)
	testing.expect(t, !logic.has_component(&w.position, world_entity))
	testing.expect(t, !logic.has_component(&w.director_entity, world_entity))
}

@(test)
test_director_spawn_requires_prefab_link :: proc(t: ^testing.T) {
	entities := [?]director.Entity_Def{{id = 0}}
	w := spawn_test_world(director.Director_Data{entities = entities[:]})
	defer spawn_test_world_destroy(w)

	_, err := director_resolve_prefab(w, 0)
	testing.expectf(t, err == .Missing_Link, "missing prefab link error = %v", err)
}

@(test)
test_director_spawn_rejects_unknown_prefab_id :: proc(t: ^testing.T) {
	instance_links := [?]director.Link{{key = SPAWN_PREFAB, target = 1}}
	prefab_stats := [?]director.Stat{{key = SPAWN_PREFAB_ID, value = 999}}
	entities := [?]director.Entity_Def{{id = 0, links = instance_links[:]}, {id = 1, stats = prefab_stats[:]}}
	w := spawn_test_world(director.Director_Data{entities = entities[:]})
	defer spawn_test_world_destroy(w)

	_, err := director_resolve_prefab(w, 0)
	testing.expectf(t, err == .Unknown_Id, "unknown prefab id error = %v", err)
}
