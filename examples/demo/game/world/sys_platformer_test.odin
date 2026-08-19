#+build !freestanding
#+build !js
#+build !orca
#+test

package world

import "core:testing"
import "grid"
import "logic"
import "shape"

@(test)
test_platformer_walks_left_uphill_without_falling :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 256 * UNIT, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(1)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	start_x := 220 * UNIT
	start_ground_y, _ := test_segment_y_at_x(&w.segments[0], start_x)
	start_y := start_ground_y - test_capsule_bottom(&collider)

	logic.add_component(&w.position, player, Position{i32(start_x), i32(start_y)})
	logic.add_component(&w.input, player, Input{.West})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ground = true, ground_normal = {1, 1}, facing = -1},
	)

	previous_x := start_x
	for frame := 0; frame < 70; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := test_platformer_velocity(w, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)

		touching_ground := test_capsule_has_ground_support(
			w.segments[:],
			pos,
			&collider,
			PLATFORMER_DEFAULT_CONFIG.slope.snap_up,
		)

		testing.expectf(t, platformer.on_ground, "frame %d: player left ground", frame)
		testing.expectf(t, touching_ground, "frame %d: player has no ground support pos=%v vel=%v", frame, pos^, vel^)
		testing.expectf(t, pos.x < previous_x, "frame %d: player did not move left", frame)

		previous_x = pos.x
	}
}

@(test)
test_platformer_walks_from_flat_onto_uphill_without_falling :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 32 * UNIT, 0}, shape.Segment{32 * UNIT, 0, 256 * UNIT, 224 * UNIT})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(1)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	start_x := 16 * UNIT
	start_ground_y := i32(0)
	start_y := start_ground_y - test_capsule_bottom(&collider)

	logic.add_component(&w.position, player, Position{i32(start_x), i32(start_y)})
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ground = true, ground_normal = {0, 1}, facing = 1},
	)

	previous_x := start_x
	for frame := 0; frame < 80; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := test_platformer_velocity(w, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)

		touching_ground := test_capsule_has_ground_support(
			w.segments[:],
			pos,
			&collider,
			PLATFORMER_DEFAULT_CONFIG.slope.snap_up,
		)

		testing.expectf(t, platformer.on_ground, "frame %d: player left ground", frame)
		testing.expectf(t, touching_ground, "frame %d: player has no ground support pos=%v vel=%v", frame, pos^, vel^)
		testing.expectf(t, pos.x > previous_x, "frame %d: player did not move right", frame)

		previous_x = pos.x
	}
}

@(test)
test_platformer_walks_uphill_without_falling :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 128 * UNIT, 128 * UNIT})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(1)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	start_x := 8 * UNIT
	start_ground_y := start_x
	start_y := start_ground_y - test_capsule_bottom(&collider)

	logic.add_component(&w.position, player, Position{i32(start_x), i32(start_y)})
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ground = true, ground_normal = {-1, 1}, facing = 1},
	)

	previous_x := start_x
	for frame := 0; frame < 40; frame += 1 {
		sys_platformer(w)

		pos, has_pos := logic.get_component(&w.position, player)
		platformer, has_platformer := logic.get_component(&w.platformer, player)
		vel, has_vel := test_platformer_velocity(w, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)

		bottom := pos.y + test_capsule_bottom(&collider)
		ground_y, on_slope := test_ground_y_at_x(w.segments[:], pos.x + collider.x)

		testing.expectf(t, platformer.on_ground, "frame %d: player left ground", frame)
		testing.expectf(t, on_slope, "frame %d: player left slope x range", frame)
		testing.expectf(
			t,
			bottom == ground_y,
			"frame %d: bottom=%d ground=%d pos=%v vel=%v",
			frame,
			bottom,
			ground_y,
			pos^,
			vel^,
		)
		testing.expectf(t, pos.x > previous_x, "frame %d: player did not move uphill", frame)

		previous_x = pos.x
	}
}


@(test)
test_platformer_does_not_stand_on_ceiling_underside :: proc(t: ^testing.T) {
	// Ceiling/underside segments are right-to-left so their left normal points down.
	w := platformer_test_world_with_segments(shape.Segment{64 * UNIT, 0, 0, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(20)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
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

	bottom := pos.y + test_capsule_bottom(&collider)
	bottom_above_ceiling := bottom >= 0
	testing.expectf(t, !platformer.on_ground, "ceiling underside must not become ground pos=%v vel=%v", pos^, vel^)
	testing.expectf(
		t,
		!bottom_above_ceiling,
		"player should keep falling through underside, bottom=%d pos=%v vel=%v",
		bottom,
		pos^,
		vel^,
	)
}

@(test)
test_platformer_does_not_stand_on_floor_endpoint_without_support :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 64 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(22)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
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

	bottom := pos.y + test_capsule_bottom(&collider)
	testing.expectf(
		t,
		!platformer.on_ground,
		"floor endpoint without support must not become ground pos=%v vel=%v",
		pos^,
		vel^,
	)
	testing.expectf(
		t,
		bottom < 0,
		"player should slide/fall past unsupported endpoint, bottom=%d pos=%v vel=%v",
		bottom,
		pos^,
		vel^,
	)
}

@(test)
test_platformer_corner_sweep_blocks_aabb_corner_escape :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(
		shape.Segment{64 * UNIT, 64 * UNIT, 64 * UNIT, 128 * UNIT},
		shape.Segment{64 * UNIT, 64 * UNIT, 0, 64 * UNIT},
	)
	defer platformer_test_world_destroy(w)

	player := logic.Entity(21)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{52 * UNIT, 52 * UNIT + 1})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{20 * UNIT, 20 * UNIT}})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)

	right := pos.x + collider.radius
	top := pos.y + collider.height / 2 + collider.radius
	inside_corner_void := right > 64 * UNIT && top > 64 * UNIT

	testing.expectf(
		t,
		!inside_corner_void,
		"corner sweep let player escape through corner pos=%v vel=%v right=%d top=%d",
		pos^,
		vel^,
		right,
		top,
	)
}

@(test)
test_platformer_wall_slide_clamps_fall_speed :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(2)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{0, -4 * UNIT}, on_wall = true, wall_normal = {-1, 0}, facing = 1},
	)

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_vel)
	testing.expectf(t, vel.y == -PLATFORMER_DEFAULT_CONFIG.wall.max_slide_speed, "wall slide vel=%v", vel^)
}

@(test)
test_platformer_horizontal_move_ignores_dangling_segment_below_floor :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(
		shape.Segment{0, 0, 256 * UNIT, 0},
		shape.Segment{64 * UNIT, -8 * UNIT, 64 * UNIT, 1},
	)
	defer platformer_test_world_destroy(w)

	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	player := logic.Entity(50)
	start_x := 52 * UNIT
	logic.add_component(&w.position, player, Position{i32(start_x), i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{32 * UNIT, 0}, on_ground = true, ground_normal = {0, 1}, facing = 1})

	pos: ^Position
	platformer: ^Platformer
	vel: ^Velocity
	for frame := 0; frame < 8; frame += 1 {
		sys_platformer(w)

		has_pos: bool
		has_platformer: bool
		has_vel: bool
		pos, has_pos = logic.get_component(&w.position, player)
		platformer, has_platformer = logic.get_component(&w.platformer, player)
		vel, has_vel = test_platformer_velocity(w, player)
		testing.expect(t, has_pos)
		testing.expect(t, has_platformer)
		testing.expect(t, has_vel)
		testing.expectf(t, vel.x > 0, "frame %d: horizontal velocity should remain positive, pos=%v vel=%v", frame, pos^, vel^)
		testing.expectf(t, !platformer.on_wall, "frame %d: dangling segment below floor should not count as wall, platformer=%v", frame, platformer^)
	}
	testing.expectf(t, pos.x > 64 * UNIT, "dangling segment below floor should not block horizontal movement past its x, pos=%v vel=%v", pos^, vel^)
}

@(test)
test_platformer_swims_past_dangling_segment_below_floor :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(
		shape.Segment{0, 0, 256 * UNIT, 0},
		shape.Segment{64 * UNIT, -8 * UNIT, 64 * UNIT, 1},
	)
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.water", kind = .Water, bounds = {0, -16 * UNIT, 256 * UNIT, 128 * UNIT}},
	)

	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	player := logic.Entity(51)
	logic.add_component(
		&w.position,
		player,
		Position{52 * UNIT, i32(-test_capsule_bottom(&collider))},
	)
	logic.add_component(&w.input, player, Input{.East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{in_water = true, facing = 1})

	for frame := 0; frame < 8; frame += 1 {
		sys_platformer(w)
	}

	pos, _ := logic.get_component(&w.position, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(
		t,
		pos.x > 64 * UNIT,
		"floor-touching swimmer should pass dangling segment endpoint, pos=%v platformer=%v",
		pos^,
		platformer^,
	)
}

@(test)
test_platformer_wall_jump_pushes_away_from_wall :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(3)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{0, -UNIT}, on_wall = true, wall_normal = {-1, 0}, facing = 1},
	)

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
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	config := PLATFORMER_DEFAULT_CONFIG
	config.air_jump.max_jumps = 1
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -UNIT}, config = config})

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
	testing.expectf(
		t,
		platformer.air_jumps == 1,
		"configured max air jumps should block second air jump, jumps=%d",
		platformer.air_jumps,
	)
}

@(test)
test_platformer_air_jump_disabled_by_config :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(5)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
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
test_platformer_ground_slide_uses_action2_and_direction :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(6)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, facing = 1})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, vel.x == PLATFORMER_DEFAULT_CONFIG.slide.speed, "slide vel=%v", vel^)
	testing.expectf(t, vel.y == 0, "slide vel=%v", vel^)
	testing.expectf(t, platformer.slide_active, "slide should be active")
	testing.expectf(
		t,
		platformer.slide_distance_remaining == PLATFORMER_DEFAULT_CONFIG.slide.distance - PLATFORMER_DEFAULT_CONFIG.slide.speed,
		"slide distance remaining=%d",
		platformer.slide_distance_remaining,
	)
}

@(test)
test_platformer_slide_travels_configured_distance_while_forward_is_held :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(67)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.distance = 25 * UNIT
	config.slide.speed = 10 * UNIT
	start_x := 64 * UNIT
	logic.add_component(&w.position, player, Position{start_x, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	for _ in 0 ..< 3 {
		sys_platformer(w)
	}

	pos, _ := logic.get_component(&w.position, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, pos.x == start_x + config.slide.distance, "slide distance pos=%v", pos^)
	testing.expectf(t, !platformer.slide_active, "slide should finish only after covering its distance")
}

@(test)
test_platformer_slide_momentum_decays_to_zero_over_configured_frames :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(68)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.speed = 12 * UNIT
	config.slide.distance = config.slide.speed
	config.slide.decay_frames = 3
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	sys_platformer(w)
	logic.add_component(&w.input, player, Input{})
	expected_velocities := [3]i32{8 * UNIT, 4 * UNIT, 0}
	for expected_velocity in expected_velocities {
		sys_platformer(w)
		vel, _ := test_platformer_velocity(w, player)
		testing.expectf(t, vel.x == expected_velocity, "decay velocity=%d, expected=%d", vel.x, expected_velocity)
	}
}

@(test)
test_platformer_slide_momentum_decays_to_run_speed_when_forward_is_held :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(69)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.speed = 12 * UNIT
	config.slide.distance = config.slide.speed
	config.slide.decay_frames = 3
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	sys_platformer(w)
	expected_velocities := [3]i32{10 * UNIT, 8 * UNIT, config.max_run}
	for expected_velocity in expected_velocities {
		sys_platformer(w)
		vel, _ := test_platformer_velocity(w, player)
		testing.expectf(t, vel.x == expected_velocity, "forward decay velocity=%d, expected=%d", vel.x, expected_velocity)
	}
}

@(test)
test_platformer_slide_momentum_decays_toward_opposite_run_speed :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(70)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.speed = 12 * UNIT
	config.slide.distance = config.slide.speed
	config.slide.decay_frames = 3
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	sys_platformer(w)
	logic.add_component(&w.input, player, Input{.West})
	expected_velocities := [3]i32{6 * UNIT, 0, -config.max_run}
	for expected_velocity in expected_velocities {
		sys_platformer(w)
		vel, _ := test_platformer_velocity(w, player)
		testing.expectf(t, vel.x == expected_velocity, "opposite decay velocity=%d, expected=%d", vel.x, expected_velocity)
	}
}

@(test)
test_platformer_slide_shrinks_collider_without_moving_feet :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(61)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	start := Position{64 * UNIT, i32(-test_capsule_bottom(&collider))}
	start_bottom := start.y + collider.y - collider.height / 2 - collider.radius
	logic.add_component(&w.position, player, start)
	logic.add_component(&w.input, player, Input{.Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{on_ground = true, facing = 1})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	updated_collider, has_collider := logic.get_component(&w.collider, player)
	testing.expect(t, has_pos && has_collider)
	bottom := pos.y + updated_collider.y - updated_collider.height / 2 - updated_collider.radius
	testing.expectf(
		t,
		updated_collider.height == PLATFORMER_DEFAULT_CONFIG.slide.collider_height,
		"slide collider=%v",
		updated_collider^,
	)
	testing.expectf(t, bottom == start_bottom, "slide moved feet from %d to %d", start_bottom, bottom)
}

@(test)
test_platformer_slide_restores_collider_and_starts_cooldown_when_finished :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(62)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.distance = config.slide.speed
	config.slide.cooldown_frames = 3
	start := Position{64 * UNIT, i32(-test_capsule_bottom(&collider))}
	start_bottom := start.y + collider.y - collider.height / 2 - collider.radius
	logic.add_component(&w.position, player, start)
	logic.add_component(&w.input, player, Input{.Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	sys_platformer(w)

	pos, _ := logic.get_component(&w.position, player)
	updated_collider, _ := logic.get_component(&w.collider, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	bottom := pos.y + updated_collider.y - updated_collider.height / 2 - updated_collider.radius
	testing.expectf(t, !platformer.slide_active, "one-frame slide should finish")
	testing.expectf(t, updated_collider.height == collider.height, "standing collider=%v", updated_collider^)
	testing.expectf(t, bottom == start_bottom, "restoring collider moved feet from %d to %d", start_bottom, bottom)
	testing.expectf(t, platformer.slide_cooldown == 3, "slide cooldown=%d", platformer.slide_cooldown)
}

@(test)
test_platformer_slide_stays_low_when_ceiling_blocks_standing_collider :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(
		shape.Segment{0, 0, 256 * UNIT, 0},
		shape.Segment{256 * UNIT, 20 * UNIT, 0, 20 * UNIT},
	)
	defer platformer_test_world_destroy(w)

	player := logic.Entity(63)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.distance = config.slide.speed
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	sys_platformer(w)

	updated_collider, _ := logic.get_component(&w.collider, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, platformer.slide_active, "low posture should remain active under ceiling")
	testing.expectf(
		t,
		platformer.slide_distance_remaining == 0,
		"slide motion should still finish, distance remaining=%d",
		platformer.slide_distance_remaining,
	)
	testing.expectf(
		t,
		updated_collider.height == config.slide.collider_height,
		"blocked standing collider=%v",
		updated_collider^,
	)
}

@(test)
test_platformer_finished_slide_keeps_moving_until_it_can_stand :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(
		shape.Segment{0, 0, 256 * UNIT, 0},
		shape.Segment{80 * UNIT, 20 * UNIT, 0, 20 * UNIT},
	)
	defer platformer_test_world_destroy(w)

	player := logic.Entity(66)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.distance = config.slide.speed
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	for _ in 0 ..< 5 {
		sys_platformer(w)
	}

	pos, _ := logic.get_component(&w.position, player)
	updated_collider, _ := logic.get_component(&w.collider, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, pos.x > 86 * UNIT, "blocked slide should carry actor out, pos=%v", pos^)
	testing.expectf(t, !platformer.slide_active, "actor should stand after clearing ceiling")
	testing.expectf(t, updated_collider.height == collider.height, "cleared slide collider=%v", updated_collider^)
}

@(test)
test_platformer_slide_cooldown_blocks_immediate_second_slide :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(7)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.slide.distance = config.slide.speed * 2
	config.slide.cooldown_frames = 3
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, on_ground = true, facing = 1})

	sys_platformer(w)
	logic.add_component(&w.input, player, Input{})
	sys_platformer(w)
	logic.add_component(&w.input, player, Input{.Action2})
	sys_platformer(w)

	platformer, _ := logic.get_component(&w.platformer, player)
	updated_collider, _ := logic.get_component(&w.collider, player)
	testing.expectf(t, !platformer.slide_active, "cooldown should block second slide")
	testing.expectf(t, updated_collider.height == collider.height, "blocked slide collider=%v", updated_collider^)

	logic.add_component(&w.input, player, Input{})
	sys_platformer(w)
	logic.add_component(&w.input, player, Input{.Action2})
	sys_platformer(w)
	updated_collider, _ = logic.get_component(&w.collider, player)
	testing.expectf(t, updated_collider.height == config.slide.collider_height, "slide should restart after cooldown")
}

@(test)
test_platformer_default_config_disables_air_dash :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)

	player := logic.Entity(64)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{facing = 1})

	sys_platformer(w)

	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, !platformer.slide_active, "airborne actor cannot slide")
	testing.expectf(t, platformer.dash_frames == 0, "default config must not air dash")
}

@(test)
test_platformer_rejects_slide_and_dash_enabled_together :: proc(t: ^testing.T) {
	config := PLATFORMER_DEFAULT_CONFIG
	config.dash.enabled = true
	platformer := Platformer {
		config = config,
	}

	testing.expect_assert_message(t, "dash and slide cannot be enabled at the same time")
	_ = platformer_config(&platformer)
}

@(test)
test_platformer_air_dash_resets_on_ground :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(8)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, air_jumps = 1, dash_air_used = 1, on_ground = true},
	)

	sys_platformer(w)

	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_platformer)
	testing.expectf(
		t,
		platformer.dash_air_used == 0,
		"air dashes should reset on ground, used=%d",
		platformer.dash_air_used,
	)
}

@(test)
test_platformer_consumes_external_velocity_with_collision :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{80 * UNIT, 0, 80 * UNIT, 128 * UNIT})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(9)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
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
	testing.expectf(
		t,
		platformer.velocity.x == 0,
		"platformer velocity should be collision-resolved, vel=%v",
		platformer.velocity,
	)
	testing.expectf(t, external^ == {}, "external velocity should be consumed, external=%v", external^)
}

@(test)
test_platformer_swims_in_all_input_directions_without_gravity :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.water", kind = .Water, bounds = {0, 0, 128 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(60)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 64 * UNIT})
	logic.add_component(&w.input, player, Input{.West, .North})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{3 * UNIT, -4 * UNIT}, facing = 1})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, platformer.in_water, "player should be swimming")
	diagonal_speed := PLATFORMER_DEFAULT_CONFIG.water.swim_speed * 707 / 1000
	testing.expectf(t, vel.x == -diagonal_speed, "swim x velocity=%v", vel^)
	testing.expectf(t, vel.y == diagonal_speed, "swim y velocity=%v", vel^)
	testing.expectf(t, pos.x < 64 * UNIT && pos.y > 64 * UNIT, "player should swim north-west, pos=%v", pos^)
}

@(test)
test_platformer_does_not_stand_on_top_of_water :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.water", kind = .Water, bounds = {0, 0, 128 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(62)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	start := Position{64 * UNIT, 140 * UNIT}
	logic.add_component(&w.position, player, start)
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -UNIT}, facing = 1})

	sys_platformer(w)

	pos, _ := logic.get_component(&w.position, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, !platformer.in_water, "capsule bottom touching water must not count as submerged")
	testing.expectf(t, pos.y < start.y, "player touching water from above should keep falling, pos=%v", pos^)

	sys_platformer(w)
	pos, _ = logic.get_component(&w.position, player)
	platformer, _ = logic.get_component(&w.platformer, player)
	capsule_top := pos.y + collider.y + collider.height / 2 + collider.radius
	testing.expectf(t, platformer.in_water, "player should swim after entering the water")
	testing.expectf(t, capsule_top == 128 * UNIT, "entered swimmer top=%d water top=%d", capsule_top, 128 * UNIT)
}

@(test)
test_platformer_swim_stops_with_capsule_top_at_water_surface :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	water_top := 128 * UNIT
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.water", kind = .Water, bounds = {0, 0, 128 * UNIT, i32(water_top)}},
	)

	player := logic.Entity(63)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	logic.add_component(&w.position, player, Position{64 * UNIT, 115 * UNIT})
	logic.add_component(&w.input, player, Input{.North})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{facing = 1})

	sys_platformer(w)

	pos, _ := logic.get_component(&w.position, player)
	vel, _ := test_platformer_velocity(w, player)
	capsule_top := pos.y + collider.y + collider.height / 2 + collider.radius
	testing.expectf(t, capsule_top == water_top, "swimmer top=%d water top=%d", capsule_top, water_top)
	testing.expectf(t, vel.y == 0, "water surface should stop upward swim velocity, vel=%v", vel^)
}

@(test)
test_platformer_jump_out_of_water_uses_configured_speed :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	water_top := 128 * UNIT
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.water", kind = .Water, bounds = {0, 0, 128 * UNIT, i32(water_top)}},
	)

	player := logic.Entity(64)
	collider := shape.Capsule{radius = 6 * UNIT, height = 12 * UNIT}
	config := PLATFORMER_DEFAULT_CONFIG
	config.water.jump_speed = 10 * UNIT
	start := Position{64 * UNIT, 116 * UNIT}
	logic.add_component(&w.position, player, start)
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{config = config, in_water = true, facing = 1})

	sys_platformer(w)

	pos, _ := logic.get_component(&w.position, player)
	vel, _ := test_platformer_velocity(w, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, platformer.swim_jumping, "surface jump should enter swim jump state")
	testing.expectf(t, !platformer.in_water, "surface jump should leave swimming state")
	testing.expectf(t, vel.y == config.water.jump_speed, "swim jump velocity=%v", vel^)
	testing.expectf(t, pos.y == start.y + config.water.jump_speed, "swim jump position=%v", pos^)

	first_jump_y := pos.y
	sys_platformer(w)
	pos, _ = logic.get_component(&w.position, player)
	vel, _ = test_platformer_velocity(w, player)
	platformer, _ = logic.get_component(&w.platformer, player)
	testing.expectf(t, platformer.swim_jumping, "swim jump should not be recaptured while leaving water")
	testing.expectf(t, !platformer.in_water, "swim jump should remain outside swimming movement")
	testing.expectf(t, pos.y > first_jump_y, "swim jump should continue rising, pos=%v", pos^)
	testing.expectf(t, vel.y < config.water.jump_speed && vel.y > 0, "gravity should affect swim jump after launch, vel=%v", vel^)
}

@(test)
test_platformer_water_disables_jump_and_gravity_while_idle :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.water", kind = .Water, bounds = {0, 0, 128 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(61)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	start := Position{64 * UNIT, 64 * UNIT}
	logic.add_component(&w.position, player, start)
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -4 * UNIT}, facing = 1})

	sys_platformer(w)

	pos, _ := logic.get_component(&w.position, player)
	vel, _ := test_platformer_velocity(w, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	testing.expectf(t, platformer.in_water, "player should be swimming")
	testing.expectf(t, vel^ == {}, "idle water should cancel jump and gravity, vel=%v", vel^)
	testing.expectf(t, pos^ == start, "idle swimmer should remain still, pos=%v", pos^)
}

@(test)
test_platformer_grabs_ladder_with_up_and_climbs :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(30)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 32 * UNIT})
	logic.add_component(&w.input, player, Input{.North})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{0, -4 * UNIT}, facing = 1})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, platformer.on_ladder, "player should grab ladder")
	testing.expectf(t, vel.y == PLATFORMER_DEFAULT_CONFIG.ladder.climb_speed, "ladder climb vel=%v", vel^)
	testing.expectf(t, pos.y > 32 * UNIT, "player should climb up, pos=%v", pos^)
}

@(test)
test_platformer_ladder_disables_horizontal_input_and_centers :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {64 * UNIT, 0, 80 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(31)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{65 * UNIT, 32 * UNIT})
	logic.add_component(&w.input, player, Input{.North, .East})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{facing = 1})

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	testing.expect(t, has_vel)
	testing.expectf(
		t,
		vel.x == PLATFORMER_DEFAULT_CONFIG.ladder.center_speed,
		"ladder should center instead of using horizontal input, vel=%v",
		vel^,
	)
}

@(test)
test_platformer_ladder_jump_detaches_and_jumps :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(32)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 32 * UNIT})
	logic.add_component(&w.input, player, Input{.Action1})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ladder = true, ladder_zone = 0, facing = 1},
	)

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, !platformer.on_ladder, "jump should detach from ladder")
	testing.expectf(t, vel.y > 0, "jump should launch upward, vel=%v", vel^)
}

@(test)
test_platformer_ladder_down_climbs_down :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(33)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 32 * UNIT})
	logic.add_component(&w.input, player, Input{.South})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ladder = true, ladder_zone = 0, facing = 1},
	)

	sys_platformer(w)

	vel, has_vel := test_platformer_velocity(w, player)
	pos, has_pos := logic.get_component(&w.position, player)
	testing.expect(t, has_vel)
	testing.expect(t, has_pos)
	testing.expectf(t, vel.y == -PLATFORMER_DEFAULT_CONFIG.ladder.climb_speed, "ladder climb down vel=%v", vel^)
	testing.expectf(t, pos.y < 32 * UNIT, "player should climb down, pos=%v", pos^)
}

@(test)
test_platformer_ladder_bottom_releases_on_floor :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 128 * UNIT}},
	)

	player := logic.Entity(34)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 13 * UNIT})
	logic.add_component(&w.input, player, Input{.South})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ladder = true, ladder_zone = 0, facing = 1},
	)

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, !platformer.on_ladder, "bottom floor should release ladder")
	testing.expectf(t, platformer.on_ground, "bottom floor should become ground")
	testing.expectf(t, vel.y == 0, "bottom floor should stop vertical velocity, vel=%v", vel^)
	testing.expectf(t, pos.y == 12 * UNIT, "player bottom should rest on floor, pos=%v", pos^)
}

@(test)
test_platformer_ladder_top_becomes_platform :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 64 * UNIT}},
	)

	player := logic.Entity(34)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 75 * UNIT})
	logic.add_component(&w.input, player, Input{.North})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, on_ladder = true, ladder_zone = 0, facing = 1},
	)

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, !platformer.on_ladder, "top climb should leave ladder")
	testing.expectf(t, platformer.on_ground, "ladder top should become platform")
	testing.expectf(t, vel.y == 0, "top platform should stop vertical velocity, vel=%v", vel^)
	testing.expectf(t, pos.y == 76 * UNIT, "player bottom should rest on ladder top, pos=%v", pos^)
}

@(test)
test_platformer_ladder_top_holds_player_without_input :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 64 * UNIT}},
	)

	player := logic.Entity(35)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 76 * UNIT})
	logic.add_component(&w.input, player, Input{})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, facing = 1})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, platformer.on_ground, "player should keep standing on ladder top")
	testing.expectf(t, !platformer.on_ladder, "standing on top should not auto-enter ladder")
	testing.expectf(t, vel.y == 0, "standing on top should not fall, vel=%v", vel^)
	testing.expectf(t, pos.y == 76 * UNIT, "standing top position should be stable, pos=%v", pos^)
}

@(test)
test_platformer_ladder_top_down_enters_ladder :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments()
	defer platformer_test_world_destroy(w)
	platformer_test_add_zone(
		w,
		Platformer_Zone{id = "test.ladder", kind = .Ladder, bounds = {60 * UNIT, 0, 68 * UNIT, 64 * UNIT}},
	)

	player := logic.Entity(36)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	logic.add_component(&w.position, player, Position{64 * UNIT, 76 * UNIT})
	logic.add_component(&w.input, player, Input{.South})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(&w.platformer, player, Platformer{velocity = Velocity{}, on_ground = true, facing = 1})

	sys_platformer(w)

	pos, has_pos := logic.get_component(&w.position, player)
	vel, has_vel := test_platformer_velocity(w, player)
	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_pos)
	testing.expect(t, has_vel)
	testing.expect(t, has_platformer)
	testing.expectf(t, platformer.on_ladder, "pressing down on ladder top should enter ladder")
	testing.expectf(t, !platformer.on_ground, "climbing down should leave platform ground")
	testing.expectf(t, vel.y == -PLATFORMER_DEFAULT_CONFIG.ladder.climb_speed, "down should climb down, vel=%v", vel^)
	testing.expectf(t, pos.y < 76 * UNIT, "player should move down onto ladder, pos=%v", pos^)
}

@(test)
test_animation_play_once_finishes_a_looping_definition_after_one_cycle :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defer logic.destroy_storage(&w.sprite)
	defs := [1]AnimDef{{frame_start = 0, frame_count = 1, repeat = 0}}
	frames := [1]AnimFrame{{duration = 10}}
	w.animation_atlas = {defs = defs[:], frames = frames[:]}
	entity := logic.Entity(44)
	anim := animation_create(&defs[0])
	animation_play_once(&anim, &defs[0])
	logic.add_component(&w.animation, entity, anim)
	logic.add_component(&w.sprite, entity, Sprite{})

	sys_animation(w, 0.011)

	updated, _ := logic.get_component(&w.animation, entity)
	testing.expectf(t, animation_is_finished(updated), "one-shot animation should finish after one cycle")
	testing.expectf(t, updated.repeat_index == 1, "one-shot repeats=%d", updated.repeat_index)
}

@(test)
test_platformer_anim_plays_slide_start_once_then_slide_loop :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [8]AnimDef{}
	player := logic.Entity(41)
	logic.add_component(&w.platformer, player, Platformer{on_ground = true, facing = 1})
	logic.add_component(&w.animation, player, animation_create(&defs[0]))
	logic.add_component(
		&w.platformer_anim,
		player,
		platformer_anim_create_char(&defs[0], &defs[1], &defs[2], &defs[3], &defs[4], &defs[5], &defs[6], &defs[7]),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	testing.expectf(t, ctrl.current == .Idle && anim.def == &defs[0], "initial animation=%v", ctrl.current)

	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.slide_active = true
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide_Start && anim.def == &defs[2], "slide start=%v", ctrl.current)
	testing.expectf(t, anim.playing, "slide start should be playing")

	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide_Start, "playing slide start was interrupted by %v", ctrl.current)

	anim.playing = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide && anim.def == &defs[3], "slide loop=%v", ctrl.current)
	testing.expectf(t, anim.playing, "slide loop should be playing")
}

@(test)
test_platformer_anim_finishes_slide_start_before_early_slide_exit :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [8]AnimDef{}
	player := logic.Entity(43)
	logic.add_component(&w.platformer, player, Platformer{slide_active = true, on_ground = true, facing = 1})
	logic.add_component(&w.animation, player, animation_create(&defs[0]))
	logic.add_component(
		&w.platformer_anim,
		player,
		platformer_anim_create_char(&defs[0], &defs[1], &defs[2], &defs[3], &defs[4], &defs[5], &defs[6], &defs[7]),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.slide_active = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide_Start, "slide start should finish before exit")

	anim.playing = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide_Exit && anim.def == &defs[4], "early slide end should go directly to exit")
}

@(test)
test_platformer_anim_plays_slide_exit_once_then_latest_locomotion_loop :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [8]AnimDef{}
	player := logic.Entity(42)
	logic.add_component(&w.platformer, player, Platformer{slide_active = true, on_ground = true, facing = 1})
	logic.add_component(&w.animation, player, animation_create(&defs[0]))
	logic.add_component(
		&w.platformer_anim,
		player,
		platformer_anim_create_char(&defs[0], &defs[1], &defs[2], &defs[3], &defs[4], &defs[5], &defs[6], &defs[7]),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	anim.playing = false
	sys_platformer_anim(w)

	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.slide_active = false
	platformer.velocity.x = UNIT
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide_Exit && anim.def == &defs[4], "slide exit=%v", ctrl.current)

	platformer.velocity.x = 0
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Slide_Exit, "playing slide exit was interrupted by %v", ctrl.current)

	platformer.velocity.x = UNIT
	anim.playing = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Run && anim.def == &defs[1], "post-slide locomotion=%v", ctrl.current)
}

@(test)
test_platformer_anim_plays_jump_start_once_then_jump_loop :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [8]AnimDef{}
	player := logic.Entity(45)
	logic.add_component(&w.platformer, player, Platformer{on_ground = true, facing = 1})
	logic.add_component(&w.animation, player, animation_create(&defs[0]))
	logic.add_component(
		&w.platformer_anim,
		player,
		platformer_anim_create_char(
			&defs[0],
			&defs[1],
			&defs[2],
			&defs[3],
			&defs[4],
			&defs[5],
			&defs[6],
			&defs[7],
		),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.on_ground = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump_Start && anim.def == &defs[5], "jump start=%v", ctrl.current)

	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump_Start, "playing jump start was interrupted by %v", ctrl.current)

	anim.playing = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump && anim.def == &defs[6], "jump loop=%v", ctrl.current)
}

@(test)
test_platformer_anim_finishes_jump_start_before_early_landing :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [8]AnimDef{}
	player := logic.Entity(47)
	logic.add_component(&w.platformer, player, Platformer{on_ground = false, facing = 1})
	logic.add_component(&w.animation, player, animation_create(&defs[0]))
	logic.add_component(
		&w.platformer_anim,
		player,
		platformer_anim_create_char(
			&defs[0],
			&defs[1],
			&defs[2],
			&defs[3],
			&defs[4],
			&defs[5],
			&defs[6],
			&defs[7],
		),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.on_ground = true
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump_Start, "jump start should finish before landing")

	anim.playing = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump_Land && anim.def == &defs[7], "early landing should go directly to land")
}

@(test)
test_platformer_anim_plays_jump_land_once_then_latest_locomotion_loop :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [8]AnimDef{}
	player := logic.Entity(46)
	logic.add_component(&w.platformer, player, Platformer{on_ground = false, facing = 1})
	logic.add_component(&w.animation, player, animation_create(&defs[0]))
	logic.add_component(
		&w.platformer_anim,
		player,
		platformer_anim_create_char(
			&defs[0],
			&defs[1],
			&defs[2],
			&defs[3],
			&defs[4],
			&defs[5],
			&defs[6],
			&defs[7],
		),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	anim.playing = false
	sys_platformer_anim(w)

	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.on_ground = true
	platformer.velocity.x = UNIT
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump_Land && anim.def == &defs[7], "jump land=%v", ctrl.current)

	platformer.velocity.x = 0
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Jump_Land, "playing jump land was interrupted by %v", ctrl.current)

	platformer.velocity.x = UNIT
	anim.playing = false
	sys_platformer_anim(w)
	testing.expectf(t, ctrl.current == .Run && anim.def == &defs[1], "post-jump locomotion=%v", ctrl.current)
}

@(test)
test_entity_pool_reuses_deleted_entity_id :: proc(t: ^testing.T) {
	w := new(World)
	defer entity_pool_test_destroy(w)
	start := w.next_entity_id

	first := create_entity(w)
	second := create_entity(w)

	testing.expectf(t, first == start, "first entity id = %v", first)
	testing.expectf(t, second == start + 1, "second entity id = %v", second)

	entity_delete(w, first)
	reused := create_entity(w)
	next := create_entity(w)

	testing.expectf(t, reused == first, "deleted entity id was not reused: got %v want %v", reused, first)
	testing.expectf(t, next == start + 2, "next fresh entity id = %v", next)
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
platformer_anim_test_world_destroy :: proc(w: ^World) {
	logic.destroy_storage(&w.platformer)
	logic.destroy_storage(&w.animation)
	logic.destroy_storage(&w.platformer_anim)
	free(w)
}

@(private = "file")
entity_pool_test_destroy :: proc(w: ^World) {
	delete(w.free_entity_ids)
	delete(w.free_entity_ids_lookup)
	free(w)
}

@(private = "file")
platformer_test_world_with_segments :: proc(segments: ..shape.Segment) -> ^World {
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
platformer_test_add_zone :: proc(w: ^World, zone: Platformer_Zone) {
	assert(len(w.platformer_zones) == 0)
	w.platformer_zones = make([]Platformer_Zone, 1)
	w.platformer_zones[0] = zone
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
	delete(w.platformer_zones)
	free(w)
}

@(private = "file")
test_capsule_bottom :: proc(capsule: ^shape.Capsule) -> i32 {
	return capsule.y - capsule.height / 2 - capsule.radius
}

@(private = "file")
test_capsule_has_ground_support :: proc(
	segments: []shape.Segment,
	pos: ^Position,
	collider: ^shape.Capsule,
	tolerance: i32,
) -> bool {
	bottom := pos.y + test_capsule_bottom(collider)
	offsets := [3]i32{0, collider.radius, -collider.radius}
	for offset in offsets {
		ground_y, ok := test_ground_y_at_x(segments, pos.x + collider.x + offset)
		if ok && abs(ground_y - bottom) <= tolerance {
			return true
		}
	}
	return false
}

@(private = "file")
test_ground_y_at_x :: proc(segments: []shape.Segment, x: i32) -> (i32, bool) {
	best_y := i32(0)
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
test_segment_y_at_x :: proc(segment: ^shape.Segment, x: i32) -> (i32, bool) {
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
