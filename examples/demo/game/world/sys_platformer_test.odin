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
test_platformer_ground_dash_uses_action2_and_direction :: proc(t: ^testing.T) {
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
	testing.expectf(t, vel.x == PLATFORMER_DEFAULT_CONFIG.dash.ground.speed, "dash vel=%v", vel^)
	testing.expectf(t, vel.y == 0, "dash vel=%v", vel^)
	testing.expectf(
		t,
		platformer.dash_frames == PLATFORMER_DEFAULT_CONFIG.dash.ground.frames - 1,
		"dash frames=%d",
		platformer.dash_frames,
	)
}

@(test)
test_platformer_dash_delay_blocks_immediate_second_dash :: proc(t: ^testing.T) {
	w := platformer_test_world_with_segments(shape.Segment{0, 0, 256 * UNIT, 0})
	defer platformer_test_world_destroy(w)

	player := logic.Entity(7)
	collider := shape.Capsule {
		radius = 6 * UNIT,
		height = 12 * UNIT,
	}
	config := PLATFORMER_DEFAULT_CONFIG
	config.dash.ground.frames = 1
	config.dash.ground.count = 0
	config.dash.delay_frames = 4
	logic.add_component(&w.position, player, Position{64 * UNIT, i32(-test_capsule_bottom(&collider))})
	logic.add_component(&w.input, player, Input{.East, .Action2})
	logic.add_component(&w.collider, player, collider)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{velocity = Velocity{}, config = config, on_ground = true, facing = 1},
	)

	sys_platformer(w)
	logic.add_component(&w.input, player, Input{})
	sys_platformer(w)
	logic.add_component(&w.input, player, Input{.East, .Action2})
	sys_platformer(w)

	platformer, has_platformer := logic.get_component(&w.platformer, player)
	testing.expect(t, has_platformer)
	testing.expectf(
		t,
		platformer.dash_frames == 0,
		"dash delay should block second dash, frames=%d",
		platformer.dash_frames,
	)
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
test_platformer_anim_selects_swim_and_swim_idle_in_water :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [?]AnimDef{{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}}
	player := logic.Entity(41)
	logic.add_component(&w.platformer, player, Platformer{in_water = true, velocity = Velocity{UNIT, -UNIT}, facing = -1})
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
			&defs[8],
			&defs[9],
			&defs[10],
			&defs[11],
			&defs[12],
			&defs[13],
		),
	)

	sys_platformer_anim(w)
	anim, _ := logic.get_component(&w.animation, player)
	ctrl, _ := logic.get_component(&w.platformer_anim, player)
	testing.expectf(t, ctrl.current == .Swim_Vertical, "vertical input should win over horizontal input")
	testing.expectf(t, anim.def == &defs[11], "expected vertical swim def")
	testing.expectf(t, ctrl.sprite_flip == 6, "downward swim should rotate 90 degrees clockwise")
	testing.expectf(t, ctrl.apply_facing, "vertical swim should preserve horizontal facing")
	testing.expectf(t, ctrl.facing == -1, "vertical swim facing=%d", ctrl.facing)

	platformer, _ := logic.get_component(&w.platformer, player)
	platformer.velocity = {UNIT, UNIT}
	sys_platformer_anim(w)
	ctrl, _ = logic.get_component(&w.platformer_anim, player)
	testing.expectf(t, ctrl.current == .Swim_Vertical, "upward diagonal should use vertical swim")
	testing.expectf(t, ctrl.sprite_flip == 0, "upward swim should use default orientation")

	platformer.velocity = {UNIT, 0}
	sys_platformer_anim(w)
	ctrl, _ = logic.get_component(&w.platformer_anim, player)
	testing.expectf(t, ctrl.current == .Swim, "horizontal swimmer should use swim animation")

	platformer.velocity = {}
	sys_platformer_anim(w)
	ctrl, _ = logic.get_component(&w.platformer_anim, player)
	testing.expectf(t, ctrl.current == .Swim_Idle, "idle swimmer should use swim idle animation")

	platformer.in_water = false
	platformer.swim_jumping = true
	sys_platformer_anim(w)
	anim, _ = logic.get_component(&w.animation, player)
	ctrl, _ = logic.get_component(&w.platformer_anim, player)
	testing.expectf(t, ctrl.current == .Swim_Jump, "water exit should use swim jump animation")
	testing.expectf(t, anim.def == &defs[13], "expected swim jump def")
}

@(test)
test_platformer_anim_selects_climb_on_ladder :: proc(t: ^testing.T) {
	w := new(World)
	defer platformer_anim_test_world_destroy(w)
	defs := [?]AnimDef{{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}}
	player := logic.Entity(40)
	logic.add_component(
		&w.platformer,
		player,
		Platformer{on_ladder = true, velocity = Velocity{0, PLATFORMER_DEFAULT_CONFIG.ladder.climb_speed}},
	)
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
			&defs[8],
			&defs[9],
			&defs[10],
			&defs[11],
			&defs[12],
			&defs[13],
		),
	)

	sys_platformer_anim(w)

	anim, has_anim := logic.get_component(&w.animation, player)
	ctrl, has_ctrl := logic.get_component(&w.platformer_anim, player)
	testing.expect(t, has_anim)
	testing.expect(t, has_ctrl)
	testing.expectf(t, ctrl.current == .Climb, "expected climb animation, got %v", ctrl.current)
	testing.expectf(t, anim.def == &defs[9], "expected climb def")
	testing.expectf(t, anim.speed > 0, "climb animation should advance while moving, speed=%f", anim.speed)
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
