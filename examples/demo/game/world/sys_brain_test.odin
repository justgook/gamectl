#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "../director"
import "core:testing"
import "grid"
import "logic"
import "shape"

BRAIN_TEST_ENEMY :: director.Entity_Id(0)
BRAIN_TEST_PATROLLING :: director.Entity_Id(1)
BRAIN_TEST_CHASING :: director.Entity_Id(2)
BRAIN_TEST_PLAYER :: director.Entity_Id(3)
BRAIN_TEST_BEHAVIOR :: director.Word_Id(0)
BRAIN_TEST_TARGET :: director.Word_Id(1)

brain_test_enemy_links := [?]director.Link{{key = BRAIN_TEST_BEHAVIOR, target = BRAIN_TEST_PATROLLING}}
brain_test_entities := [?]director.Entity_Def {
	{id = BRAIN_TEST_ENEMY, links = brain_test_enemy_links[:]},
	{id = BRAIN_TEST_PATROLLING},
	{id = BRAIN_TEST_CHASING},
	{id = BRAIN_TEST_PLAYER},
}
brain_test_director_data := director.Director_Data {
	entities = brain_test_entities[:],
}

@(private = "file")
brain_test_world :: proc(input: Input, pos: Position, segment: shape.Segment) -> ^World {
	w := new(World)
	w.director = director.init(brain_test_director_data)
	w.director_config = {
		player     = BRAIN_TEST_PLAYER,
		behavior   = BRAIN_TEST_BEHAVIOR,
		target     = BRAIN_TEST_TARGET,
		patrolling = BRAIN_TEST_PATROLLING,
		chasing    = BRAIN_TEST_CHASING,
	}
	w.grid = grid.create_grid(-32 * UNIT, -32 * UNIT, 32 * UNIT, 32 * UNIT, 4 * UNIT)
	append(&w.segments, segment)
	grid.add_segment(&w.grid, &w.segments[0])

	entity := logic.Entity(1)
	logic.add_component(&w.brain, entity, Brain(1))
	logic.add_component(&w.director_entity, entity, Director_Entity{id = BRAIN_TEST_ENEMY})
	logic.add_component(&w.position, entity, pos)
	logic.add_component(&w.input, entity, input)
	logic.add_component(&w.collider, entity, shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT})
	logic.add_component(&w.platformer, entity, Platformer{on_ground = true, facing = 1})
	return w
}

@(private = "file")
brain_test_world_destroy :: proc(w: ^World) {
	director.destroy(&w.director)
	grid.destroy_grid(&w.grid)
	delete(w.segments)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.director_entity)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.collider)
	logic.destroy_storage(&w.platformer)
	free(w)
}

@(private = "file")
brain_test_ground_probe :: proc(w: ^World, direction: int) -> Platformer_Ground_Ahead_Result {
	pos, has_pos := logic.get_component(&w.position, 1)
	assert(has_pos)
	collider, has_collider := logic.get_component(&w.collider, 1)
	assert(has_collider)
	platformer, has_platformer := logic.get_component(&w.platformer, 1)
	assert(has_platformer)
	return platformer_probe_ground_ahead(&w.grid, pos, collider, platformer, 2 * UNIT, direction)
}

@(test)
test_brain_reverses_from_east_to_west_at_wall :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.East}, {}, {5 * UNIT, -UNIT, 5 * UNIT, UNIT})
	defer brain_test_world_destroy(w)

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.West}, "east-facing brain input = %v", input)
}

@(test)
test_brain_reverses_from_west_to_east_at_wall :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.West}, {}, {-5 * UNIT, -UNIT, -5 * UNIT, UNIT})
	defer brain_test_world_destroy(w)

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.East}, "west-facing brain input = %v", input)
}

@(test)
test_brain_reverses_before_right_ledge :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.East}, {0, 12 * UNIT}, {-16 * UNIT, 0, 7 * UNIT, 0})
	defer brain_test_world_destroy(w)

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.West}, "right-ledge brain input = %v", input)
}

@(test)
test_brain_reverses_before_left_ledge :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.West}, {0, 12 * UNIT}, {-7 * UNIT, 0, 16 * UNIT, 0})
	defer brain_test_world_destroy(w)

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.East}, "left-ledge brain input = %v", input)
}

@(private = "file")
brain_test_start_chasing :: proc(w: ^World, player_pos: Position) {
	w.player1_id = 2
	logic.add_component(&w.position, w.player1_id, player_pos)
	director.entity_set_link(&w.director, BRAIN_TEST_ENEMY, BRAIN_TEST_BEHAVIOR, BRAIN_TEST_CHASING)
	director.entity_set_link(&w.director, BRAIN_TEST_ENEMY, BRAIN_TEST_TARGET, BRAIN_TEST_PLAYER)
}

@(test)
test_brain_chase_moves_toward_player_and_ignores_patrol_collision :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.West}, {}, {5 * UNIT, -UNIT, 5 * UNIT, UNIT})
	defer brain_test_world_destroy(w)
	brain_test_start_chasing(w, Position{10 * UNIT, 0})

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.East}, "right chase input = %v", input)

	player_pos, has_player_pos := logic.get_component(&w.position, w.player1_id)
	assert(has_player_pos)
	player_pos.x = -10 * UNIT
	sys_brain(w)
	testing.expectf(t, input^ == Input{.West}, "left chase input = %v", input)
}

@(test)
test_brain_resumes_patrol_after_chase_stops_at_matching_x :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.East}, {}, {-16 * UNIT, 16 * UNIT, 16 * UNIT, 16 * UNIT})
	defer brain_test_world_destroy(w)
	brain_test_start_chasing(w, Position{})

	// Matching X stops horizontal chase movement.
	sys_brain(w)
	input, has_input := logic.get_component(&w.input, 1)
	assert(has_input)
	testing.expectf(t, input^ == Input{}, "stopped chase input = %v", input)

	// Losing sight returns to patrol with no horizontal input left by chase.
	director.entity_set_link(&w.director, BRAIN_TEST_ENEMY, BRAIN_TEST_BEHAVIOR, BRAIN_TEST_PATROLLING)
	director.entity_remove_link(&w.director, BRAIN_TEST_ENEMY, BRAIN_TEST_TARGET)
	platformer, has_platformer := logic.get_component(&w.platformer, 1)
	assert(has_platformer)
	platformer.on_ground = false
	sys_brain(w)
	testing.expectf(t, input^ == Input{.East}, "resumed patrol input = %v", input)
}

@(test)
test_ground_ahead_probe_finds_continuous_ground :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.East}, {0, 12 * UNIT}, {-16 * UNIT, 0, 16 * UNIT, 0})
	defer brain_test_world_destroy(w)

	east := brain_test_ground_probe(w, 1)
	west := brain_test_ground_probe(w, -1)
	testing.expectf(t, east.found && east.segment == &w.segments[0], "east ground probe = %v", east)
	testing.expectf(t, west.found && west.segment == &w.segments[0], "west ground probe = %v", west)
}

@(test)
test_ground_ahead_probe_finds_walkable_slope :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.East}, {0, 16 * UNIT}, {-16 * UNIT, 0, 16 * UNIT, 8 * UNIT})
	defer brain_test_world_destroy(w)

	result := brain_test_ground_probe(w, 1)
	testing.expectf(t, result.found, "slope ground probe = %v", result)
	testing.expectf(t, result.delta_y == 2 * UNIT, "slope probe delta = %v", result.delta_y)
	testing.expectf(t, result.normal.y > 0, "slope probe normal = %v", result.normal)
}
