package world

import "grid"
import "logic"
import air_jump "platformer/air_jump"
import dash "platformer/dash"
import slope "platformer/slope"
import wall "platformer/wall"
import "shape"

Dash_Direction_Proc :: proc(input: ^Input, p: ^Platformer) -> [2]i32

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
	wall_stick:         int,
	slope:              slope.Config,
	wall:               wall.Config,
	air_jump:           air_jump.Config,
	dash:               dash.Config,
	dash_direction:     Dash_Direction_Proc,
}

PLATFORMER_DEFAULT_CONFIG :: Platformer_Config {
	accel_ground = 16,
	accel_air = 8,
	max_run = 3 * UNIT,
	friction_ground = 24,
	gravity = -24,
	max_fall = -8 * UNIT,
	jump_speed = 6 * UNIT,
	jump_hold_force = 12,
	jump_hold_frames = 8,
	coyote_frames = 6,
	jump_buffer_frames = 6,
	wall_stick = 2 * UNIT,
	slope = {
		enabled = true,
		max_rise = 1,
		max_run = 1,
		snap_up = 4 * UNIT,
		snap_down = 4 * UNIT,
		ground_stick = 2 * UNIT,
	},
	wall = {
		enabled = true,
		slide_enabled = true,
		slide_accel = 8,
		max_slide_speed = 2 * UNIT,
		jump_enabled = true,
		max_jumps = 1,
		jump_x_speed = 3 * UNIT,
		jump_y_speed = 5 * UNIT,
	},
	air_jump = {enabled = true, max_jumps = 99, jump_y_speed = 5 * UNIT},
	dash = {
		enabled = true,
		ground = {enabled = true, speed = 5 * UNIT, frames = 8, count = 1},
		air = {enabled = true, speed = 5 * UNIT, frames = 8, count = 1},
		cooldown_frames = 20,
		delay_frames = 4,
		reset_air_on_ground = true,
	},
	dash_direction = default_dash_direction,
}

Platformer :: struct {
	config:           Platformer_Config,
	on_ground:        bool,
	on_wall:          bool,
	hit_ceiling:      bool,
	ground_normal:    [2]int,
	wall_normal:      [2]int,
	coyote_timer:     int,
	jump_buffer:      int,
	jump_frames:      int,
	jump_held:        bool,
	wall_jumps:       int,
	air_jumps:        int,
	dash_frames:      int,
	dash_delay:       int,
	dash_cooldown:    int,
	dash_ground_used: int,
	dash_air_used:    int,
	dash_dir:         [2]i32,
	dash_held:        bool,
	dash_air:         bool,
	facing:           i32,
}

sys_platformer :: proc(w: ^World) {
	view := logic.view(&w.position, &w.velocity, &w.input, &w.platformer)
	for entity, pos, vel, input, platformer in logic.each(&view) {
		collider, has_collider := logic.get_component(&w.collider, entity)
		assert(has_collider)

		platformer_refresh_ground(&w.grid, pos, vel, collider, platformer)
		platformer_update_dash_reset_and_timers(platformer)
		if platformer.dash_frames > 0 {
			platformer_apply_jump(input, vel, platformer)
			if platformer.dash_frames > 0 {
				platformer_apply_dash_velocity(vel, platformer)
				platformer_move_and_collide(&w.grid, pos, vel, collider, platformer)
				platformer_finish_dash_frame(vel, platformer)
				platformer.dash_held = .Action2 in input
				continue
			}
		}

		platformer_apply_input(input, vel, platformer)
		platformer_apply_jump(input, vel, platformer)
		if platformer_try_start_dash(input, vel, platformer) {
			platformer_move_and_collide(&w.grid, pos, vel, collider, platformer)
			platformer_finish_dash_frame(vel, platformer)
			platformer.dash_held = .Action2 in input
			continue
		}
		platformer_apply_gravity(vel, platformer)
		platformer_apply_wall_slide(vel, platformer)
		platformer_move_and_collide(&w.grid, pos, vel, collider, platformer)
		platformer.dash_held = .Action2 in input
	}
}

@(private = "file")
platformer_refresh_ground :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
) {
	cfg := platformer_config(p)
	result := slope.Refresh_Ground(g, pos, vel, collider, cfg.slope)
	if result.ok {
		apply_ground_result(pos, vel, p, result)
		return
	}

	if vel.y <= 0 && p.on_ground {
		p.on_ground = false
		p.ground_normal = {}
	}
}

@(private = "file")
platformer_update_dash_reset_and_timers :: proc(p: ^Platformer) {
	cfg := platformer_config(p)
	if p.dash_delay > 0 {
		p.dash_delay -= 1
	}
	if p.dash_cooldown > 0 {
		p.dash_cooldown -= 1
		if p.dash_cooldown == 0 {
			p.dash_ground_used = 0
			if !cfg.dash.reset_air_on_ground {
				p.dash_air_used = 0
			}
		}
	}
	if p.on_ground {
		p.dash_ground_used = 0
		if cfg.dash.reset_air_on_ground {
			p.dash_air_used = 0
		}
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

	jump_pressed := jump_down && !p.jump_held
	if jump_pressed {
		p.jump_buffer = cfg.jump_buffer_frames
	} else if p.jump_buffer > 0 {
		p.jump_buffer -= 1
	}

	if p.on_ground {
		p.coyote_timer = cfg.coyote_frames
		p.wall_jumps = 0
		p.air_jumps = 0
	} else if p.coyote_timer > 0 {
		p.coyote_timer -= 1
	}

	if p.jump_buffer > 0 && p.coyote_timer > 0 {
		vel.y = cfg.jump_speed
		p.dash_frames = 0
		p.on_ground = false
		p.coyote_timer = 0
		p.jump_buffer = 0
		p.jump_frames = cfg.jump_hold_frames
	} else if p.jump_buffer > 0 && !p.on_ground && p.on_wall && wall.Can_Jump(cfg.wall, p.wall_jumps) {
		jump_x := wall.Jump_Direction_X(p.wall_normal, p.facing)
		vel.x = jump_x * cfg.wall.jump_x_speed
		vel.y = cfg.wall.jump_y_speed
		p.dash_frames = 0
		p.facing = jump_x
		p.on_wall = false
		p.wall_normal = {}
		p.jump_buffer = 0
		p.jump_frames = cfg.jump_hold_frames
		p.wall_jumps += 1
	} else if p.jump_buffer > 0 &&
	   !p.on_ground &&
	   !p.on_wall &&
	   p.coyote_timer == 0 &&
	   air_jump.Can_Jump(cfg.air_jump, p.air_jumps) {
		vel.y = cfg.air_jump.jump_y_speed
		p.dash_frames = 0
		p.jump_buffer = 0
		p.jump_frames = cfg.jump_hold_frames
		p.air_jumps += 1
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
platformer_try_start_dash :: proc(input: ^Input, vel: ^Velocity, p: ^Platformer) -> bool {
	cfg := platformer_config(p)
	dash_pressed := .Action2 in input && !p.dash_held
	if !dash_pressed {
		return false
	}

	mode := cfg.dash.ground if p.on_ground else cfg.dash.air
	used := p.dash_ground_used if p.on_ground else p.dash_air_used
	if !dash.Can_Start(cfg.dash, mode, used, p.dash_cooldown, p.dash_delay) {
		return false
	}

	dir := cfg.dash_direction(input, p)
	if dir.x == 0 && dir.y == 0 {
		return false
	}

	p.dash_dir = dir
	p.dash_frames = mode.frames
	p.dash_delay = cfg.dash.delay_frames
	p.dash_air = !p.on_ground
	p.on_wall = false
	p.wall_normal = {}
	if p.on_ground {
		p.dash_ground_used += 1
		if dash.Uses_Depleted(mode, p.dash_ground_used) && cfg.dash.cooldown_frames > 0 {
			p.dash_cooldown = cfg.dash.cooldown_frames
		}
	} else {
		p.dash_air_used += 1
		if dash.Uses_Depleted(mode, p.dash_air_used) && !cfg.dash.reset_air_on_ground && cfg.dash.cooldown_frames > 0 {
			p.dash_cooldown = cfg.dash.cooldown_frames
		}
	}

	platformer_apply_dash_velocity(vel, p)
	return true
}

@(private = "file")
platformer_apply_dash_velocity :: proc(vel: ^Velocity, p: ^Platformer) {
	cfg := platformer_config(p)
	mode := cfg.dash.air if p.dash_air else cfg.dash.ground
	dash_vel := dash.Velocity_For_Direction(p.dash_dir, mode.speed)
	vel.x = dash_vel.x
	vel.y = dash_vel.y
}

@(private = "file")
platformer_finish_dash_frame :: proc(vel: ^Velocity, p: ^Platformer) {
	if p.dash_frames > 0 {
		p.dash_frames -= 1
	}
	if p.dash_frames == 0 && p.on_ground {
		cfg := platformer_config(p)
		vel.x = clamp(vel.x, -cfg.max_run, cfg.max_run)
	}
}

@(private = "file")
default_dash_direction :: proc(input: ^Input, p: ^Platformer) -> [2]i32 {
	dir := [2]i32{}
	if .East in input {
		dir.x += 1
	}
	if .West in input {
		dir.x -= 1
	}
	if .North in input {
		dir.y += 1
	}
	if .South in input {
		dir.y -= 1
	}
	if dir.x == 0 && dir.y == 0 {
		dir.x = p.facing
		if dir.x == 0 {
			dir.x = 1
		}
	}
	return dir
}

@(private = "file")
platformer_apply_wall_slide :: proc(vel: ^Velocity, p: ^Platformer) {
	cfg := platformer_config(p)
	if !p.on_ground && p.on_wall && vel.y < 0 {
		wall.Apply_Slide(vel, cfg.wall)
	}
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
	cfg := platformer_config(p)
	p.hit_ceiling = false

	if vel.y > 0 {
		p.on_ground = false
		p.ground_normal = {}
	}
	if vel.x != 0 {
		p.on_wall = false
		p.wall_normal = {}
	}

	old_pos := pos^
	move_x_and_collide(g, pos, vel, collider, p)

	slope_followed := false
	if cfg.slope.enabled && p.on_ground && vel.x != 0 {
		result := slope.Follow_Ground(g, &old_pos, pos, vel, collider, cfg.slope)
		if result.ok {
			apply_ground_result(pos, vel, p, result)
			slope_followed = true
		}
	}

	move_y_and_collide(g, pos, vel, collider, p, cfg)

	if p.on_ground && vel.y <= 0 && !slope_followed {
		result := slope.Stick_To_Ground(g, pos, collider, cfg.slope)
		if result.ok {
			apply_ground_result(pos, vel, p, result)
		} else {
			p.on_ground = false
			p.ground_normal = {}
		}
	}
	if p.on_wall && vel.x == 0 {
		stick_to_wall(g, pos, collider, p, cfg.wall_stick)
	}
}

@(private = "file")
move_x_and_collide :: proc(g: ^grid.Grid, pos: ^Position, vel: ^Velocity, collider: ^shape.Capsule, p: ^Platformer) {
	if vel.x == 0 {
		return
	}

	cfg := platformer_config(p)
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
		if slope.Is_Walkable_Ground_Segment(wall, cfg.slope) {
			continue
		}
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
move_y_and_collide :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	cfg: Platformer_Config,
) {
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
		if vel.y < 0 {
			if !slope.Is_Walkable_Ground_Segment(floor, cfg.slope) {
				continue
			}
			normal = slope.Segment_Up_Normal(floor)
		} else {
			if normal.y >= 0 || abs(normal.y) < abs(normal.x) {
				continue
			}
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
stick_to_wall :: proc(g: ^grid.Grid, pos: ^Position, collider: ^shape.Capsule, p: ^Platformer, stick: int) {
	bounds := capsule_local_aabb(collider)
	center_y := int(pos.y) + collider.y
	probe := [4]int {
		int(pos.x) + bounds.x - stick,
		int(pos.y) + bounds.y,
		int(pos.x) + bounds.z + stick,
		int(pos.y) + bounds.w,
	}
	found := grid.query_aabb(g, &probe)
	defer delete(found)

	best_delta := stick + 1
	best_normal := [2]int{}
	for wall in found {
		normal := segment_left_normal(wall)
		if abs(normal.x) < abs(normal.y) {
			continue
		}

		contact_x, ok := segment_x_at_y(wall, center_y)
		if !ok {
			continue
		}

		touch_x := int(pos.x) + bounds.z if normal.x < 0 else int(pos.x) + bounds.x
		delta := contact_x - touch_x
		if abs(delta) <= stick && abs(delta) < abs(best_delta) {
			best_delta = delta
			best_normal = normal
		}
	}

	if best_delta <= stick {
		p.on_wall = true
		p.wall_normal = best_normal
	} else {
		p.on_wall = false
		p.wall_normal = {}
	}
}

@(private = "file")
apply_ground_result :: proc(pos: ^Position, vel: ^Velocity, p: ^Platformer, result: slope.Ground_Result) {
	pos.y += i32(result.delta_y)
	vel.y = 0
	p.on_ground = true
	p.ground_normal = result.normal
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
