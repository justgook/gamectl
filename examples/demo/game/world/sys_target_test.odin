#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "core:testing"
import "logic"

@(private = "file")
target_test_world :: proc(input: Input) -> (^World, logic.Entity) {
	w := new(World)
	entity := logic.Entity(1)
	position := Position{100 * UNIT, 50 * UNIT}
	logic.add_component(&w.input, entity, input)
	logic.add_component(&w.position, entity, position)
	logic.add_component(&w.target, entity, target_component(position, 1))
	return w, entity
}

@(private = "file")
target_test_world_destroy :: proc(w: ^World) {
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.target)
	free(w)
}

@(test)
test_target_system_maps_second_stick_to_eight_directions :: proc(t: ^testing.T) {
	cases := [?]struct {
		input:    Input,
		expected: [2]i32,
	} {
		{Input{.TargetNorth}, {0, TARGET_DISTANCE}},
		{Input{.TargetNorth, .TargetEast}, {TARGET_DIAGONAL_OFFSET, TARGET_DIAGONAL_OFFSET}},
		{Input{.TargetEast}, {TARGET_DISTANCE, 0}},
		{Input{.TargetSouth, .TargetEast}, {TARGET_DIAGONAL_OFFSET, -TARGET_DIAGONAL_OFFSET}},
		{Input{.TargetSouth}, {0, -TARGET_DISTANCE}},
		{Input{.TargetSouth, .TargetWest}, {-TARGET_DIAGONAL_OFFSET, -TARGET_DIAGONAL_OFFSET}},
		{Input{.TargetWest}, {-TARGET_DISTANCE, 0}},
		{Input{.TargetNorth, .TargetWest}, {-TARGET_DIAGONAL_OFFSET, TARGET_DIAGONAL_OFFSET}},
	}

	for test_case in cases {
		w, entity := target_test_world(test_case.input)
		sys_target(w)
		target, has_target := logic.get_component(&w.target, entity)
		position, has_position := logic.get_component(&w.position, entity)
		testing.expect(t, has_target && has_position)
		testing.expectf(
			t,
			[2]i32{target.x - position.x, target.y - position.y} == test_case.expected,
			"target offset for %v = {%d, %d}",
			test_case.input,
			target.x - position.x,
			target.y - position.y,
		)
		target_test_world_destroy(w)
	}
}

@(test)
test_target_system_retains_direction_and_follows_actor_after_stick_release :: proc(t: ^testing.T) {
	w, entity := target_test_world(Input{.TargetNorth, .TargetWest})
	defer target_test_world_destroy(w)

	sys_target(w)
	input, has_input := logic.get_component(&w.input, entity)
	position, has_position := logic.get_component(&w.position, entity)
	assert(has_input && has_position)
	input^ = {}
	position.x += 12 * UNIT
	position.y -= 3 * UNIT
	sys_target(w)

	target, has_target := logic.get_component(&w.target, entity)
	testing.expect(t, has_target)
	testing.expect(t, target.direction == [2]i32{-1, 1})
	testing.expect(t, target.x == position.x - TARGET_DIAGONAL_OFFSET)
	testing.expect(t, target.y == position.y + TARGET_DIAGONAL_OFFSET)
}

@(test)
test_bullet_aim_direction_uses_world_target_point :: proc(t: ^testing.T) {
	position := Position{}
	testing.expect(t, bullet_aim_direction(&position, &Target{x = 0, y = TARGET_DISTANCE}) == 0)
	testing.expect(t, bullet_aim_direction(&position, &Target{x = TARGET_DISTANCE, y = 0}) == 90)
	testing.expect(t, bullet_aim_direction(&position, &Target{x = 0, y = -TARGET_DISTANCE}) == 180)
	testing.expect(t, bullet_aim_direction(&position, &Target{x = -TARGET_DISTANCE, y = 0}) == -90)
}
