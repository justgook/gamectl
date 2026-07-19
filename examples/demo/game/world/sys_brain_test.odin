#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "core:testing"
import "grid"
import "logic"
import "shape"

@(private = "file")
brain_test_world :: proc(input: Input, pos: Position, segment: [4]int) -> ^World {
	w := new(World)
	w.grid = grid.create_grid(-32 * UNIT, -32 * UNIT, 32 * UNIT, 32 * UNIT, 4 * UNIT)
	append(&w.segments, segment)
	grid.add_segment(&w.grid, &w.segments[0])

	entity := logic.Entity(1)
	logic.add_component(&w.brain, entity, Brain(1))
	logic.add_component(&w.position, entity, pos)
	logic.add_component(&w.input, entity, input)
	logic.add_component(&w.collider, entity, shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT})
	logic.add_component(&w.platformer, entity, Platformer{on_ground = true})
	return w
}

@(private = "file")
brain_test_world_destroy :: proc(w: ^World) {
	grid.destroy_grid(&w.grid)
	delete(w.segments)
	logic.destroy_storage(&w.brain)
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
