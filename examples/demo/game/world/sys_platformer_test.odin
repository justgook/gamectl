package world

import "core:testing"
import "grid"
import "logic"
import "shape"

@(test)
test_platformer_walks_left_uphill_without_falling :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 256 * UNIT, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(1)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	start_x := 220 * UNIT
	start_ground_y, _ := test_segment_y_at_x(&w.segments[0], start_x)
	start_y := start_ground_y - test_capsule_bottom(&collider)

	logic.add_component(&w.position, player, Position{i32(start_x), i32(start_y)})
	logic.add_component(&w.velocity, player, Velocity{})
	logic.add_component(&w.input, player, Input{.West})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{on_ground = true, ground_normal = {1, 1}, facing = -1})

	previous_x := start_x
	for frame := 0; frame < 70; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := logic.get_component(&w.velocity, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)

		touching_ground := test_capsule_has_ground_support(w.segments[:], pos, &collider, PLATFORMER_DEFAULT_CONFIG.slope.snap_up)

		testing.expectf(t, platformer.on_ground, "frame %d: player left ground", frame)
		testing.expectf(t, touching_ground, "frame %d: player has no ground support pos=%v vel=%v", frame, pos^, vel^)
		testing.expectf(t, int(pos.x) < previous_x, "frame %d: player did not move left", frame)

		previous_x = int(pos.x)
	}
}

@(test)
test_platformer_walks_from_flat_onto_uphill_without_falling :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 0, 32 * UNIT, 0}, [4]int{32 * UNIT, 0, 256 * UNIT, 224 * UNIT})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(1)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	start_x := 16 * UNIT
	start_ground_y := 0
	start_y := start_ground_y - test_capsule_bottom(&collider)

	logic.add_component(&w.position, player, Position{i32(start_x), i32(start_y)})
	logic.add_component(&w.velocity, player, Velocity{})
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{on_ground = true, ground_normal = {0, 1}, facing = 1})

	previous_x := start_x
	for frame := 0; frame < 80; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := logic.get_component(&w.velocity, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)

		touching_ground := test_capsule_has_ground_support(w.segments[:], pos, &collider, PLATFORMER_DEFAULT_CONFIG.slope.snap_up)

		testing.expectf(t, platformer.on_ground, "frame %d: player left ground", frame)
		testing.expectf(t, touching_ground, "frame %d: player has no ground support pos=%v vel=%v", frame, pos^, vel^)
		testing.expectf(t, int(pos.x) > previous_x, "frame %d: player did not move right", frame)

		previous_x = int(pos.x)
	}
}

@(test)
test_platformer_walks_uphill_without_falling :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 0, 128 * UNIT, 128 * UNIT})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(1)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	start_x := 8 * UNIT
	start_ground_y := start_x
	start_y := start_ground_y - test_capsule_bottom(&collider)

	logic.add_component(&w.position, player, Position{i32(start_x), i32(start_y)})
	logic.add_component(&w.velocity, player, Velocity{})
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{on_ground = true, ground_normal = {-1, 1}, facing = 1})

	previous_x := start_x
	for frame := 0; frame < 40; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := logic.get_component(&w.velocity, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)

		bottom := int(pos.y) + test_capsule_bottom(&collider)
		ground_y, on_slope := test_ground_y_at_x(w.segments[:], int(pos.x) + collider.x)

		testing.expectf(t, platformer.on_ground, "frame %d: player left ground", frame)
		testing.expectf(t, on_slope, "frame %d: player left slope x range", frame)
		testing.expectf(t, bottom == ground_y, "frame %d: bottom=%d ground=%d pos=%v vel=%v", frame, bottom, ground_y, pos^, vel^)
		testing.expectf(t, int(pos.x) > previous_x, "frame %d: player did not move uphill", frame)

		previous_x = int(pos.x)
	}
}

@(private = "file")
platformer_test_world_with_segments :: proc(segments: ..[4]int) -> ^World {
	w := new(World)
	w.grid = grid.create_grid(-16 * UNIT, -16 * UNIT, 256 * UNIT, 256 * UNIT, 16 * UNIT)
	for segment in segments {
		append(&w.segments, segment)
	}
	for &segment in w.segments {
		grid.add_segment(&w.grid, &segment)
	}
	return w
}

@(private = "file")
platformer_test_world_destroy :: proc(w: ^World) {
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.collider)
	logic.destroy_storage(&w.platformer)
	grid.destroy_grid(&w.grid)
	delete(w.segments)
	free(w)
}

@(private = "file")
test_capsule_bottom :: proc(capsule: ^shape.Capsule) -> int {
	return capsule.y - capsule.height / 2 - capsule.radius
}

@(private = "file")
test_capsule_has_ground_support :: proc(segments: [][4]int, pos: ^Position, collider: ^shape.Capsule, tolerance: int) -> bool {
	bottom := int(pos.y) + test_capsule_bottom(collider)
	offsets := [3]int{0, collider.radius, -collider.radius}
	for offset in offsets {
		ground_y, ok := test_ground_y_at_x(segments, int(pos.x) + collider.x + offset)
		if ok && abs(ground_y - bottom) <= tolerance {
			return true
		}
	}
	return false
}

@(private = "file")
test_ground_y_at_x :: proc(segments: [][4]int, x: int) -> (int, bool) {
	best_y := 0
	found := false
	for &segment in segments {
		y, ok := test_segment_y_at_x(&segment, x)
		if !ok {
			continue
		}
		if !found || y > best_y {
			best_y = y
			found = true
		}
	}
	return best_y, found
}

@(private = "file")
test_segment_y_at_x :: proc(segment: ^[4]int, x: int) -> (int, bool) {
	min_x := min(segment.x, segment.z)
	max_x := max(segment.x, segment.z)
	if x < min_x || x > max_x {
		return 0, false
	}
	if segment.x == segment.z {
		return 0, false
	}
	return segment.y + (x - segment.x) * (segment.w - segment.y) / (segment.z - segment.x), true
}
