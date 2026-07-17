#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "core:testing"
import "grid"
import "logic"

@(private = "file")
brain_test_world :: proc(input: Input, wall_x: int) -> ^World {
	w := new(World)
	w.grid = grid.create_grid(-16 * UNIT, -16 * UNIT, 16 * UNIT, 16 * UNIT, 4 * UNIT)
	append(&w.segments, [4]int{wall_x, -UNIT, wall_x, UNIT})
	grid.add_segment(&w.grid, &w.segments[0])

	entity := logic.Entity(1)
	logic.add_component(&w.brain, entity, Brain(1))
	logic.add_component(&w.position, entity, Position{})
	logic.add_component(&w.input, entity, input)
	return w
}

@(private = "file")
brain_test_world_destroy :: proc(w: ^World) {
	grid.destroy_grid(&w.grid)
	delete(w.segments)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.input)
	free(w)
}

@(test)
test_brain_reverses_from_east_to_west_at_wall :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.East}, 5 * UNIT)
	defer brain_test_world_destroy(w)

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.West}, "east-facing brain input = %v", input)
}

@(test)
test_brain_reverses_from_west_to_east_at_wall :: proc(t: ^testing.T) {
	w := brain_test_world(Input{.West}, -5 * UNIT)
	defer brain_test_world_destroy(w)

	sys_brain(w)

	input, ok := logic.get_component(&w.input, 1)
	testing.expectf(t, ok && input^ == Input{.East}, "west-facing brain input = %v", input)
}
