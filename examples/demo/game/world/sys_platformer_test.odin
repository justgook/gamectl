#+build !freestanding
#+build !js
#+build !orca

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
	logic.add_component(&w.input, player, Input{.West})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, ground_normal = {1, 1}, facing = -1})

	previous_x := start_x
	for frame := 0; frame < 70; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := test_platformer_velocity(w, player)
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
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, ground_normal = {0, 1}, facing = 1})

	previous_x := start_x
	for frame := 0; frame < 80; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := test_platformer_velocity(w, player)
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
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, ground_normal = {-1, 1}, facing = 1})

	previous_x := start_x
	for frame := 0; frame < 40; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := test_platformer_velocity(w, player)
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


@(test)
test_platformer_does_not_stand_on_ceiling_underside :: proc(t: ^testing.T) {
	// Ceiling/underside segments are right-to-left so their left normal points down.
	w := platformer_test_world_with_segments([4]int{64 * UNIT, 0, 0, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(20)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{32 * UNIT, 14 * UNIT})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -4 * UNIT}})

	sys_platformer(w)

	platformer, has_platformer := logic.get_component(&w.platformer, player)
	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_platformer)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)

	bottom := int(pos.y) + test_capsule_bottom(&collider)
	bottom_above_ceiling := bottom >= 0
	testing.expectf(t, !platformer.on_ground, "ceiling underside must not become ground pos=%v vel=%v", pos^, vel^)
	testing.expectf(t, !bottom_above_ceiling, "player should keep falling through underside, bottom=%d pos=%v vel=%v", bottom, pos^, vel^)
}

@(test)
test_platformer_does_not_stand_on_floor_endpoint_without_support :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 0, 64 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(22)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{70 * UNIT, 14 * UNIT})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -4 * UNIT}})

	sys_platformer(w)

	platformer, has_platformer := logic.get_component(&w.platformer, player)
	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_platformer)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)

	bottom := int(pos.y) + test_capsule_bottom(&collider)
	testing.expectf(t, !platformer.on_ground, "floor endpoint without support must not become ground pos=%v vel=%v", pos^, vel^)
	testing.expectf(t, bottom < 0, "player should slide/fall past unsupported endpoint, bottom=%d pos=%v vel=%v", bottom, pos^, vel^)
}

@(test)
test_platformer_corner_sweep_blocks_aabb_corner_escape :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(
		[4]int{64 * UNIT, 64 * UNIT, 64 * UNIT, 128 * UNIT},
		[4]int{64 * UNIT, 64 * UNIT, 0, 64 * UNIT},
	)
	defer platformer_test_world_destroy(w)

	player := logic.Entity(21)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{52 * UNIT, 52 * UNIT + 1})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{20 * UNIT, 20 * UNIT}})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)

	right := int(pos.x) + collider.radius
	top := int(pos.y) + collider.height / 2 + collider.radius
	inside_corner_void := right > 64 * UNIT && top > 64 * UNIT

	testing.expectf(t, !inside_corner_void, "corner sweep let player escape through corner pos=%v vel=%v right=%d top=%d", pos^, vel^, right, top)
}

@(test)
test_platformer_wall_slide_clamps_fall_speed :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(2)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -4 * UNIT}, on_wall = true, wall_normal = {-1, 0}, facing = 1})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_vel)
	testing.expectf(t, vel.y == -PLATFORMER_DEFAULT_CONFIG.wall.max_slide_speed, "wall slide vel=%v", vel^)
}

@(test)
test_platformer_wall_jump_pushes_away_from_wall :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(3)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -UNIT}, on_wall = true, wall_normal = {-1, 0}, facing = 1})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, vel.x < 0, "wall jump should push left, vel=%v", vel^)
	testing.expectf(t, vel.y > 0, "wall jump should push upward, vel=%v", vel^)
	testing.expectf(t, platformer.wall_jumps == 1, "wall jumps=%d", platformer.wall_jumps)
}


@(test)
test_platformer_air_jump_uses_configured_jump_count :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(4)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -UNIT}})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, vel.y > 0, "air jump should push upward, vel=%v", vel^)
	testing.expectf(t, platformer.air_jumps == 1, "air jumps=%d", platformer.air_jumps)

	logic.add_component(&w.input, player, Input{})
	sys_platformer(w)
	logic.add_component(&w.input, player, Input{.Action1})
	sys_platformer(w)

	vel, _ = test_platformer_velocity(w, player)
	platformer, _ = logic.get_component(&w.platformer, player)
	testing.expectf(t, platformer.air_jumps == 1, "default max air jumps should block second air jump, jumps=%d", platformer.air_jumps)
}

@(test)
test_platformer_air_jump_disabled_by_config :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(5)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	config := PLATFORMER_DEFAULT_CONFIG
	config.air_jump.enabled = false

	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -UNIT}, config = config})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, vel.y < 0, "disabled air jump should keep falling, vel=%v", vel^)
	testing.expectf(t, platformer.air_jumps == 0, "air jumps=%d", platformer.air_jumps)
}


@(test)
test_platformer_ground_dash_uses_action2_and_direction :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(6)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, facing = 1})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, vel.x == PLATFORMER_DEFAULT_CONFIG.dash.ground.speed, "dash vel=%v", vel^)
	testing.expectf(t, vel.y == 0, "dash vel=%v", vel^)
	testing.expectf(t, platformer.dash_frames == PLATFORMER_DEFAULT_CONFIG.dash.ground.frames - 1, "dash frames=%d", platformer.dash_frames)
}

@(test)
test_platformer_dash_delay_blocks_immediate_second_dash :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(7)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	config := PLATFORMER_DEFAULT_CONFIG
	config.dash.ground.frames = 1
	config.dash.ground.count = 0
	config.dash.delay_frames = 4
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, config = config, on_ground = true, facing = 1})

	sys_platformer(w)
	logic.add_component(&w.input, player, Input{})
	sys_platformer(w)
	logic.add_component(&w.input, player, Input{.East, .Action2})
	sys_platformer(w)

	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_platformer)
	testing.expectf(t, platformer.dash_frames == 0, "dash delay should block second dash, frames=%d", platformer.dash_frames)
}

@(test)
test_platformer_air_dash_resets_on_ground :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(8)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, air_jumps = 1, dash_air_used = 1, on_ground = true})

	sys_platformer(w)

	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_platformer)
	testing.expectf(t, platformer.dash_air_used == 0, "air dashes should reset on ground, used=%d", platformer.dash_air_used)
}

@(test)
test_platformer_consumes_external_velocity_with_collision :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments([4]int{80 * UNIT, 0, 80 * UNIT, 128 * UNIT})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(9)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.velocity, player, Velocity{32 * UNIT, 0})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	external, has_external := logic.get_component(&w.velocity, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_platformer)
	testing.expect(t, has_external)
	if !has_pos || !has_platformer || !has_external {
		return
	}

	testing.expectf(t, pos.x == 74 * UNIT, "external velocity should collide with wall, pos=%v", pos^)
	testing.expectf(t, platformer.velocity.x == 0, "platformer velocity should be collision-resolved, vel=%v", platformer.velocity)
	testing.expectf(t, external^ == {}, "external velocity should be consumed, external=%v", external^)
}

@(test)
test_entity_pool_reuses_deleted_entity_id :: proc(t: ^testing.T) {
	w := new(World)
	defer entity_pool_test_destroy(w)

	first := create_entity(w)
	second := create_entity(w)

	testing.expectf(t, first == ENTITY_ID_START, "first entity id = %v", first)
	testing.expectf(t, second == ENTITY_ID_START + 1, "second entity id = %v", second)

	entity_delete(w, first)
	reused := create_entity(w)
	next := create_entity(w)

	testing.expectf(t, reused == first, "deleted entity id was not reused: got %v want %v", reused, first)
	testing.expectf(t, next == ENTITY_ID_START + 2, "next fresh entity id = %v", next)
}

@(test)
test_entity_pool_reuses_deleted_entity_ids_lifo :: proc(t: ^testing.T) {
	w := new(World)
	defer entity_pool_test_destroy(w)

	first := create_entity(w)
	second := create_entity(w)
	third := create_entity(w)

	entity_delete(w, first)
	entity_delete(w, second)

	reused_second := create_entity(w)
	reused_first := create_entity(w)
	fresh := create_entity(w)

	testing.expectf(t, reused_second == second, "first reused id = %v want %v", reused_second, second)
	testing.expectf(t, reused_first == first, "second reused id = %v want %v", reused_first, first)
	testing.expectf(t, fresh == third + 1, "fresh id = %v want %v", fresh, third + 1)
}

@(private = "file")
test_platformer_velocity :: proc(w: ^World, entity: logic.Entity) -> (^Velocity, bool) {
	platformer, ok := logic.get_component(&w.platformer, entity)
	if !ok {
		return nil, false
	}
	return &platformer.velocity, true
}

@(private = "file")
entity_pool_test_destroy :: proc(w: ^World) {
	delete(w.free_entity_ids)
	delete(w.free_entity_ids_lookup)
	free(w)
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
