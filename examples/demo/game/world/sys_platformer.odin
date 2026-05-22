package world

import "grid"
import "logic"
import "shape"

Platformer_Config :: struct {
	accel_ground:       i32,
	accel_air:          i32,
	max_run:            i32,
	friction_ground:    i32,
	gravity:            i32,
	max_fall:           i32,
	jump_speed:         i32,
	jump_hold_force:    i32,
	jump_hold_frames:   int,
	coyote_frames:      int,
	jump_buffer_frames: int,
}

PLATFORMER_DEFAULT_CONFIG :: Platformer_Config {
	accel_ground       = 16,
	accel_air          = 8,
	max_run            = 3 * UNIT,
	friction_ground    = 24,
	gravity            = -24,
	max_fall           = -8 * UNIT,
	jump_speed         = 6 * UNIT,
	jump_hold_force    = 12,
	jump_hold_frames   = 8,
	coyote_frames      = 6,
	jump_buffer_frames = 6,
}

Platformer :: struct {
	config:        Platformer_Config,
	on_ground:     bool,
	on_wall:       bool,
	hit_ceiling:   bool,
	ground_normal: [2]int,
	wall_normal:   [2]int,
	coyote_timer:  int,
	jump_buffer:   int,
	jump_frames:   int,
	jump_held:     bool,
	facing:        i32,
}

sys_platformer :: proc(w: ^World) {
	view := logic.view(&w.position, &w.velocity, &w.input, &w.platformer)
	for entity, pos, vel, input, platformer in logic.each(&view) {
		collider, has_collider := logic.get_component(&w.collider, entity)
		assert(has_collider)

		platformer_apply_input(input, vel, platformer)
		platformer_apply_jump(input, vel, platformer)
		platformer_apply_gravity(vel, platformer)
		platformer_move_and_collide(&w.grid, pos, vel, collider, platformer)
	}
}

@(private = "file")
platformer_apply_input :: proc(input: ^Input, vel: ^Velocity, p: ^Platformer) {
	cfg := platformer_config(p)
	move_x := i32(0)
	if .East in input {
		move_x += 1
	}
	if .West in input {
		move_x -= 1
	}

	if move_x != 0 {
		p.facing = move_x
		accel := cfg.accel_ground if p.on_ground else cfg.accel_air
		vel.x = clamp(vel.x + move_x * accel, -cfg.max_run, cfg.max_run)
	} else if p.on_ground {
		vel.x = approach_i32(vel.x, 0, cfg.friction_ground)
	}
}

@(private = "file")
platformer_apply_jump :: proc(input: ^Input, vel: ^Velocity, p: ^Platformer) {
	cfg := platformer_config(p)
	jump_down := .Action1 in input

	if jump_down {
		p.jump_buffer = cfg.jump_buffer_frames
	} else if p.jump_buffer > 0 {
		p.jump_buffer -= 1
	}

	if p.on_ground {
		p.coyote_timer = cfg.coyote_frames
	} else if p.coyote_timer > 0 {
		p.coyote_timer -= 1
	}

	if p.jump_buffer > 0 && p.coyote_timer > 0 {
		vel.y = cfg.jump_speed
		p.on_ground = false
		p.coyote_timer = 0
		p.jump_buffer = 0
		p.jump_frames = cfg.jump_hold_frames
	}

	if jump_down && p.jump_frames > 0 && vel.y > 0 {
		vel.y += cfg.jump_hold_force
		p.jump_frames -= 1
	} else if !jump_down {
		p.jump_frames = 0
	}

	p.jump_held = jump_down
}

@(private = "file")
platformer_apply_gravity :: proc(vel: ^Velocity, p: ^Platformer) {
	cfg := platformer_config(p)
	if !p.on_ground {
		vel.y = max(vel.y + cfg.gravity, cfg.max_fall)
	}
}

@(private = "file")
platformer_move_and_collide :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
) {
	p.on_ground = false
	p.on_wall = false
	p.hit_ceiling = false
	p.ground_normal = {}
	p.wall_normal = {}

	move_x_and_collide(g, pos, vel, collider, p)
	move_y_and_collide(g, pos, vel, collider, p)
}

@(private = "file")
move_x_and_collide :: proc(g: ^grid.Grid, pos: ^Position, vel: ^Velocity, collider: ^shape.Capsule, p: ^Platformer) {
	if vel.x == 0 {
		return
	}

	bounds := capsule_local_aabb(collider)
	start_x := int(pos.x)
	end_x := int(pos.x + vel.x)
	query := [4]int {
		min(start_x, end_x) + bounds.x,
		int(pos.y) + bounds.y,
		max(start_x, end_x) + bounds.z,
		int(pos.y) + bounds.w,
	}
	found := grid.query_aabb(g, &query)
	defer delete(found)

	best_x := end_x
	for wall in found {
		normal := segment_left_normal(wall)
		if vel.x > 0 && normal.x >= 0 {
			continue
		}
		if vel.x < 0 && normal.x <= 0 {
			continue
		}
		if abs(normal.x) < abs(normal.y) {
			continue
		}

		contact_x, ok := segment_x_at_y(wall, int(pos.y) + collider.y)
		if !ok {
			continue
		}

		candidate := contact_x - bounds.z if vel.x > 0 else contact_x - bounds.x
		if vel.x > 0 {
			if start_x + bounds.z <= contact_x && end_x + bounds.z >= contact_x {
				best_x = min(best_x, candidate)
				p.on_wall = true
				p.wall_normal = normal
			}
		} else {
			if start_x + bounds.x >= contact_x && end_x + bounds.x <= contact_x {
				best_x = max(best_x, candidate)
				p.on_wall = true
				p.wall_normal = normal
			}
		}
	}

	pos.x = i32(best_x)
	if best_x != end_x {
		vel.x = 0
	}
}

@(private = "file")
move_y_and_collide :: proc(g: ^grid.Grid, pos: ^Position, vel: ^Velocity, collider: ^shape.Capsule, p: ^Platformer) {
	if vel.y == 0 {
		return
	}

	bounds := capsule_local_aabb(collider)
	start_y := int(pos.y)
	end_y := int(pos.y + vel.y)
	query := [4]int {
		int(pos.x) + bounds.x,
		min(start_y, end_y) + bounds.y,
		int(pos.x) + bounds.z,
		max(start_y, end_y) + bounds.w,
	}
	found := grid.query_aabb(g, &query)
	defer delete(found)

	best_y := end_y
	for floor in found {
		normal := segment_left_normal(floor)
		if vel.y < 0 && normal.y <= 0 {
			continue
		}
		if vel.y > 0 && normal.y >= 0 {
			continue
		}
		if abs(normal.y) < abs(normal.x) {
			continue
		}

		contact_y, ok := segment_y_at_x(floor, int(pos.x) + collider.x)
		if !ok {
			continue
		}

		candidate := contact_y - bounds.y if vel.y < 0 else contact_y - bounds.w
		if vel.y < 0 {
			if start_y + bounds.y >= contact_y && end_y + bounds.y <= contact_y {
				best_y = max(best_y, candidate)
				p.on_ground = true
				p.ground_normal = normal
			}
		} else {
			if start_y + bounds.w <= contact_y && end_y + bounds.w >= contact_y {
				best_y = min(best_y, candidate)
				p.hit_ceiling = true
			}
		}
	}

	pos.y = i32(best_y)
	if best_y != end_y {
		vel.y = 0
	}
}

@(private = "file")
platformer_config :: proc(p: ^Platformer) -> Platformer_Config {
	if p.config.max_run == 0 {
		return PLATFORMER_DEFAULT_CONFIG
	}
	return p.config
}

@(private = "file")
capsule_local_aabb :: proc(capsule: ^shape.Capsule) -> [4]int {
	half_height := capsule.height / 2
	return {
		capsule.x - capsule.radius,
		capsule.y - half_height - capsule.radius,
		capsule.x + capsule.radius,
		capsule.y + half_height + capsule.radius,
	}
}

@(private = "file")
segment_left_normal :: proc(segment: ^[4]int) -> [2]int {
	dx := segment.z - segment.x
	dy := segment.w - segment.y
	return {-dy, dx}
}

@(private = "file")
segment_y_at_x :: proc(segment: ^[4]int, x: int) -> (int, bool) {
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

@(private = "file")
segment_x_at_y :: proc(segment: ^[4]int, y: int) -> (int, bool) {
	min_y := min(segment.y, segment.w)
	max_y := max(segment.y, segment.w)
	if y < min_y || y > max_y {
		return 0, false
	}
	if segment.y == segment.w {
		return 0, false
	}
	return segment.x + (y - segment.y) * (segment.z - segment.x) / (segment.w - segment.y), true
}

@(private = "file")
approach_i32 :: proc(value, target, step: i32) -> i32 {
	if value < target {
		return min(value + step, target)
	}
	if value > target {
		return max(value - step, target)
	}
	return target
}
