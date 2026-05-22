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
	ground_stick:        int,
	wall_stick:          int,
	enable_slopes:       bool,
	max_slope_rise:     int,
	max_slope_run:      int,
	slope_snap_up:      int,
	slope_snap_down:    int,
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
	ground_stick       = 2 * UNIT,
	wall_stick         = 2 * UNIT,
	enable_slopes      = true,
	max_slope_rise    = 1,
	max_slope_run     = 1,
	slope_snap_up      = 4 * UNIT,
	slope_snap_down    = 4 * UNIT,
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

		platformer_refresh_ground(&w.grid, pos, vel, collider, platformer)
		platformer_apply_input(input, vel, platformer)
		platformer_apply_jump(input, vel, platformer)
		platformer_apply_gravity(vel, platformer)
		platformer_move_and_collide(&w.grid, pos, vel, collider, platformer)
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
	if vel.y > 0 {
		return
	}

	cfg := platformer_config(p)
	snap_up := cfg.ground_stick
	snap_down := cfg.ground_stick
	if cfg.enable_slopes {
		slope_support_snap := slope_support_snap(collider, cfg)
		snap_up = max(snap_up, cfg.slope_snap_up + slope_support_snap)
		snap_down = max(snap_down, cfg.slope_snap_down + slope_support_snap)
	}

	offsets := [3]int{0, collider.radius, -collider.radius}
	for offset in offsets {
		delta, normal, ok := find_walkable_ground_delta(
			g,
			pos,
			collider,
			cfg,
			int(pos.x) + collider.x + offset,
			snap_up,
			snap_down,
		)
		if ok {
			pos.y += i32(delta)
			vel.y = 0
			p.on_ground = true
			p.ground_normal = normal
			return
		}
	}

	if p.on_ground {
		p.on_ground = false
		p.ground_normal = {}
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

	// host.info("platform", "jump", jump_down, "on_ground", p.on_ground)

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
	if cfg.enable_slopes && p.on_ground && vel.x != 0 {
		slope_followed = follow_ground_slope(g, &old_pos, pos, vel, collider, p, cfg)
	}
	move_y_and_collide(g, pos, vel, collider, p, cfg)

	if p.on_ground && vel.y <= 0 && !slope_followed {
		stick_to_ground(g, pos, collider, p, cfg)
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
		if is_walkable_ground_segment(wall, cfg) {
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
			if !is_walkable_ground_segment(floor, cfg) {
				continue
			}
			normal = segment_up_normal(floor)
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
follow_ground_slope :: proc(
	g: ^grid.Grid,
	old_pos: ^Position,
	pos: ^Position,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	cfg: Platformer_Config,
) -> bool {
	step_snap := slope_step_snap(vel, cfg) + slope_support_snap(collider, cfg)
	offsets := [3]int{}
	if vel.x > 0 {
		offsets = {collider.radius, 0, -collider.radius}
	} else {
		offsets = {-collider.radius, 0, collider.radius}
	}

	for offset in offsets {
		old_x := int(old_pos.x) + collider.x + offset
		new_x := int(pos.x) + collider.x + offset

		segment, old_ground_y, ok := find_walkable_ground_at_x(
			g,
			old_pos,
			collider,
			cfg,
			old_x,
			step_snap,
			step_snap,
		)
		if !ok || abs(segment.w - segment.y) == 0 {
			continue
		}

		new_ground_y, contact_ok := segment_y_at_x(segment, new_x)
		if !contact_ok {
			continue
		}

		delta := new_ground_y - old_ground_y
		if delta > step_snap || delta < -step_snap {
			continue
		}

		pos.y = old_pos.y + i32(delta)
		vel.y = 0
		p.on_ground = true
		p.ground_normal = segment_up_normal(segment)
		return true
	}

	for offset in offsets {
		delta, normal, ok := find_walkable_ground_delta(
			g,
			pos,
			collider,
			cfg,
			int(pos.x) + collider.x + offset,
			step_snap,
			step_snap,
		)
		if ok {
			pos.y += i32(delta)
			vel.y = 0
			p.on_ground = true
			p.ground_normal = normal
			return true
		}
	}

	return false
}

@(private = "file")
stick_to_ground :: proc(g: ^grid.Grid, pos: ^Position, collider: ^shape.Capsule, p: ^Platformer, cfg: Platformer_Config) {
	snap_up := cfg.ground_stick
	snap_down := cfg.ground_stick
	offsets := [3]int{0, collider.radius, -collider.radius}
	if cfg.enable_slopes {
		slope_support_snap := slope_support_snap(collider, cfg)
		snap_up = max(snap_up, cfg.slope_snap_up + slope_support_snap)
		snap_down = max(snap_down, cfg.slope_snap_down + slope_support_snap)
	}

	for offset in offsets {
		delta, normal, ok := find_walkable_ground_delta(
			g,
			pos,
			collider,
			cfg,
			int(pos.x) + collider.x + offset,
			snap_up,
			snap_down,
		)
		if ok {
			pos.y += i32(delta)
			p.on_ground = true
			p.ground_normal = normal
			return
		}
	}

	p.on_ground = false
	p.ground_normal = {}
}

@(private = "file")
slope_support_snap :: proc(collider: ^shape.Capsule, cfg: Platformer_Config) -> int {
	assert(cfg.max_slope_run > 0)
	return collider.radius * cfg.max_slope_rise / cfg.max_slope_run + UNIT
}

@(private = "file")
slope_step_snap :: proc(vel: ^Velocity, cfg: Platformer_Config) -> int {
	assert(cfg.max_slope_run > 0)
	velocity_snap := int(abs(vel.x)) * cfg.max_slope_rise / cfg.max_slope_run + UNIT
	return max(max(cfg.slope_snap_up, cfg.slope_snap_down), velocity_snap)
}

@(private = "file")
find_walkable_ground_at_x :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	collider: ^shape.Capsule,
	cfg: Platformer_Config,
	support_x: int,
	snap_up: int,
	snap_down: int,
) -> (segment: ^[4]int, contact_y: int, ok: bool) {
	bounds := capsule_local_aabb(collider)
	bottom := int(pos.y) + bounds.y
	probe := [4]int {
		int(pos.x) + bounds.x,
		bottom - snap_down,
		int(pos.x) + bounds.z,
		bottom + snap_up,
	}
	found := grid.query_aabb(g, &probe)
	defer delete(found)

	best_delta := snap_up + snap_down + 1
	best_segment: ^[4]int = nil
	best_contact_y := 0
	for floor in found {
		if !is_walkable_ground_segment(floor, cfg) {
			continue
		}

		candidate_y, contact_ok := segment_y_at_x(floor, support_x)
		if !contact_ok {
			continue
		}

		candidate_delta := candidate_y - bottom
		if candidate_delta > snap_up || candidate_delta < -snap_down {
			continue
		}
		if abs(candidate_delta) < abs(best_delta) {
			best_delta = candidate_delta
			best_segment = floor
			best_contact_y = candidate_y
		}
	}

	if best_segment != nil {
		return best_segment, best_contact_y, true
	}
	return nil, 0, false
}

@(private = "file")
find_walkable_ground_delta :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	collider: ^shape.Capsule,
	cfg: Platformer_Config,
	support_x: int,
	snap_up: int,
	snap_down: int,
) -> (delta: int, normal: [2]int, ok: bool) {
	bounds := capsule_local_aabb(collider)
	bottom := int(pos.y) + bounds.y
	probe := [4]int {
		int(pos.x) + bounds.x,
		bottom - snap_down,
		int(pos.x) + bounds.z,
		bottom + snap_up,
	}
	found := grid.query_aabb(g, &probe)
	defer delete(found)

	best_delta := snap_up + snap_down + 1
	best_normal := [2]int{}
	for floor in found {
		if !is_walkable_ground_segment(floor, cfg) {
			continue
		}

		contact_y, contact_ok := segment_y_at_x(floor, support_x)
		if !contact_ok {
			continue
		}

		candidate_delta := contact_y - bottom
		if candidate_delta > snap_up || candidate_delta < -snap_down {
			continue
		}
		if abs(candidate_delta) < abs(best_delta) {
			best_delta = candidate_delta
			best_normal = segment_up_normal(floor)
		}
	}

	if best_delta <= snap_up + snap_down {
		return best_delta, best_normal, true
	}
	return 0, {}, false
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
is_walkable_ground_segment :: proc(segment: ^[4]int, cfg: Platformer_Config) -> bool {
	dx := abs(segment.z - segment.x)
	dy := abs(segment.w - segment.y)
	if dx == 0 {
		return false
	}
	if dy == 0 {
		return true
	}
	if !cfg.enable_slopes {
		return false
	}
	return dy * cfg.max_slope_run <= dx * cfg.max_slope_rise
}

@(private = "file")
segment_up_normal :: proc(segment: ^[4]int) -> [2]int {
	normal := segment_left_normal(segment)
	if normal.y < 0 {
		normal.x = -normal.x
		normal.y = -normal.y
	}
	return normal
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
