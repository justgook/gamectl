package world

import "grid"
import "logic"
import air_jump "platformer/air_jump"
import dash "platformer/dash"
import ladder "platformer/ladder"
import slope "platformer/slope"
import wall "platformer/wall"
import water "platformer/water"
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
	ladder:             ladder.Config,
	water:              water.Config,
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
	ladder = {enabled = true, climb_speed = 2 * UNIT, center_speed = 3 * UNIT},
	water = {enabled = true, swim_speed = 2 * UNIT, jump_speed = 8 * UNIT},
	air_jump = {enabled = true, max_jumps = 999, jump_y_speed = 5 * UNIT},
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
	velocity:         Velocity,
	on_ground:        bool,
	on_wall:          bool,
	on_ladder:        bool,
	in_water:         bool,
	swim_jumping:     bool,
	hit_ceiling:      bool,
	ground_normal:    [2]int,
	wall_normal:      [2]int,
	ground_segment:   ^[4]int,
	wall_segment:     ^[4]int,
	ladder_zone:      int,
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

Platformer_Zone_Kind :: enum {
	Ladder,
	Water,
}

Platformer_Zone :: struct {
	id:     string,
	kind:   Platformer_Zone_Kind,
	bounds: shape.Aabb,
}

sys_platformer :: proc(w: ^World) {
	view := logic.view(&w.position, &w.input, &w.platformer)
	for entity, pos, input, platformer in logic.each(&view) {
		collider, has_collider := logic.get_component(&w.collider, entity)
		assert(has_collider)

		vel := &platformer.velocity
		platformer_consume_external_velocity(&w.velocity, entity, vel)

		if platformer.swim_jumping {
			platformer_apply_swim_jump(&w.grid, pos, input, vel, collider, platformer)
			continue
		}

		water_zone, in_water := platformer_find_water_zone(w, pos, collider, platformer)
		if in_water {
			platformer_apply_swim(&w.grid, pos, input, vel, collider, platformer, &w.platformer_zones[water_zone])
			continue
		}
		platformer.in_water = false

		platformer_refresh_ground(&w.grid, pos, vel, collider, platformer)
		platformer_update_dash_reset_and_timers(platformer)

		ladder_zone, touching_ladder := platformer_find_ladder_zone(w, pos, collider, platformer)
		if platformer_handle_ladder(w, pos, input, vel, collider, platformer, ladder_zone, touching_ladder) {
			platformer.dash_held = .Action2 in input
			continue
		}
		if touching_ladder {
			platformer_apply_ladder_top_support(pos, vel, collider, platformer, &w.platformer_zones[ladder_zone])
		}

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
		if touching_ladder {
			platformer_apply_ladder_top_support(pos, vel, collider, platformer, &w.platformer_zones[ladder_zone])
		}
		platformer.dash_held = .Action2 in input
	}
}

@(private = "file")
platformer_consume_external_velocity :: proc(
	storage: ^logic.Component_Storage(Velocity),
	entity: logic.Entity,
	vel: ^Velocity,
) {
	external, has_external := logic.get_component(storage, entity)
	if !has_external {
		return
	}

	vel.x += external.x
	vel.y += external.y
	external^ = {}
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
		p.ground_segment = nil
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
platformer_find_water_zone :: proc(
	w: ^World,
	pos: ^Position,
	collider: ^shape.Capsule,
	p: ^Platformer,
) -> (int, bool) {
	cfg := platformer_config(p)
	if !cfg.water.enabled {
		return -1, false
	}

	player_bounds := platformer_world_aabb(pos, collider)
	for zone, index in w.platformer_zones {
		if zone.kind == .Water && aabb_overlaps_strict(player_bounds, zone.bounds) {
			return index, true
		}
	}
	return -1, false
}

@(private = "file")
platformer_apply_swim :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	input: ^Input,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	zone: ^Platformer_Zone,
) {
	assert(zone.kind == .Water)
	cfg := platformer_config(p)
	bounds := platformer_world_aabb(pos, collider)
	if bounds.w > zone.bounds.w {
		pos.y -= bounds.w - zone.bounds.w
		bounds = platformer_world_aabb(pos, collider)
	}
	jump_down := .Action1 in input
	jump_pressed := jump_down && !p.jump_held
	move := [2]i32{}
	if .East in input {move.x += 1}
	if .West in input {move.x -= 1}
	if .North in input {move.y += 1}
	if .South in input {move.y -= 1}

	swim_velocity := water.Velocity_For_Direction(move, cfg.water.swim_speed)
	vel.x = swim_velocity.x
	vel.y = swim_velocity.y
	if move.x != 0 {
		p.facing = move.x
	}

	p.in_water = true
	p.swim_jumping = false
	p.on_ground = false
	p.on_wall = false
	p.hit_ceiling = false
	p.ground_normal = {}
	p.wall_normal = {}
	p.ground_segment = nil
	p.wall_segment = nil
	p.on_ladder = false
	p.ladder_zone = -1
	p.coyote_timer = 0
	p.jump_buffer = 0
	p.jump_frames = 0
	p.jump_held = jump_down
	p.dash_frames = 0
	p.dash_delay = 0
	p.dash_held = .Action2 in input

	if jump_pressed && bounds.w == zone.bounds.w {
		p.in_water = false
		p.swim_jumping = true
		vel.y = cfg.water.jump_speed
		p.jump_held = true
		platformer_move_and_collide(g, pos, vel, collider, p)
		return
	}

	platformer_move_and_collide(g, pos, vel, collider, p)
	if move.y > 0 {
		bounds = platformer_world_aabb(pos, collider)
		if bounds.w > zone.bounds.w {
			pos.y -= bounds.w - zone.bounds.w
			vel.y = 0
		}
	}
}

@(private = "file")
platformer_apply_swim_jump :: proc(
	g: ^grid.Grid,
	pos: ^Position,
	input: ^Input,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
) {
	p.in_water = false
	p.on_ground = false
	p.on_wall = false
	p.ground_normal = {}
	p.wall_normal = {}
	p.ground_segment = nil
	p.wall_segment = nil

	platformer_apply_input(input, vel, p)
	platformer_apply_gravity(vel, p)
	platformer_move_and_collide(g, pos, vel, collider, p)
	if vel.y <= 0 {
		p.swim_jumping = false
	}
	p.jump_held = .Action1 in input
	p.dash_held = .Action2 in input
}

@(private = "file")
platformer_find_ladder_zone :: proc(
	w: ^World,
	pos: ^Position,
	collider: ^shape.Capsule,
	p: ^Platformer,
) -> (
	int,
	bool,
) {
	cfg := platformer_config(p)
	if !cfg.ladder.enabled {
		return -1, false
	}

	player_bounds := platformer_world_aabb(pos, collider)
	if p.on_ladder {
		assert(p.ladder_zone >= 0 && p.ladder_zone < len(w.platformer_zones))
		zone := &w.platformer_zones[p.ladder_zone]
		assert(zone.kind == .Ladder)
		if aabb_overlaps(player_bounds, zone.bounds) {
			return p.ladder_zone, true
		}
	}

	for zone, index in w.platformer_zones {
		if zone.kind != .Ladder {
			continue
		}

		if aabb_overlaps(player_bounds, zone.bounds) {
			return index, true
		}
	}

	return -1, false
}

@(private = "file")
platformer_handle_ladder :: proc(
	w: ^World,
	pos: ^Position,
	input: ^Input,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	zone_index: int,
	touching_ladder: bool,
) -> bool {
	cfg := platformer_config(p)
	jump_down := .Action1 in input
	jump_pressed := jump_down && !p.jump_held

	if p.on_ladder {
		if !touching_ladder {
			platformer_leave_ladder(p)
			return false
		}
		if jump_pressed {
			platformer_leave_ladder(p)
			platformer_apply_ladder_jump(vel, p)
			p.jump_held = true
			return false
		}

		platformer_apply_ladder(w, pos, input, vel, collider, p, &w.platformer_zones[zone_index], cfg.ladder)
		p.jump_held = jump_down
		return true
	}

	if touching_ladder &&
	   .South in input &&
	   platformer_is_on_ladder_top(pos, collider, &w.platformer_zones[zone_index]) {
		platformer_enter_ladder(p, zone_index)
		platformer_apply_ladder(w, pos, input, vel, collider, p, &w.platformer_zones[zone_index], cfg.ladder)
		p.jump_held = jump_down
		return true
	}

	if touching_ladder && .North in input {
		platformer_enter_ladder(p, zone_index)
		platformer_apply_ladder(w, pos, input, vel, collider, p, &w.platformer_zones[zone_index], cfg.ladder)
		p.jump_held = jump_down
		return true
	}

	return false
}

@(private = "file")
platformer_enter_ladder :: proc(p: ^Platformer, zone_index: int) {
	p.on_ladder = true
	p.ladder_zone = zone_index
	p.on_ground = false
	p.on_wall = false
	p.ground_normal = {}
	p.wall_normal = {}
	p.ground_segment = nil
	p.wall_segment = nil
	p.dash_frames = 0
	p.dash_delay = 0
	p.jump_buffer = 0
	p.coyote_timer = 0
}

@(private = "file")
platformer_leave_ladder :: proc(p: ^Platformer) {
	p.on_ladder = false
	p.ladder_zone = -1
}

@(private = "file")
platformer_apply_ladder_jump :: proc(vel: ^Velocity, p: ^Platformer) {
	cfg := platformer_config(p)
	vel.y = cfg.jump_speed
	p.jump_buffer = 0
	p.jump_frames = cfg.jump_hold_frames
	p.on_ground = false
	p.coyote_timer = 0
}

@(private = "file")
platformer_apply_ladder :: proc(
	w: ^World,
	pos: ^Position,
	input: ^Input,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	zone: ^Platformer_Zone,
	cfg: ladder.Config,
) {
	assert(zone.kind == .Ladder)
	start_bounds := platformer_world_aabb(pos, collider)
	start_bottom := int(start_bounds.y)
	center_x := int((zone.bounds.x + zone.bounds.z) / 2)
	target_pos_x := center_x - collider.x
	delta_x := target_pos_x - int(pos.x)
	vel.x = i32(clamp(delta_x, -int(cfg.center_speed), int(cfg.center_speed)))

	move_y := i32(0)
	if .North in input {
		move_y += 1
	}
	if .South in input {
		move_y -= 1
	}
	vel.y = move_y * cfg.climb_speed

	p.on_ground = false
	p.on_wall = false
	p.ground_normal = {}
	p.wall_normal = {}
	p.ground_segment = nil
	p.wall_segment = nil

	platformer_move_and_collide(&w.grid, pos, vel, collider, p)
	if move_y > 0 {
		platformer_finish_ladder_top_climb(pos, vel, collider, p, zone, start_bottom)
	} else if move_y < 0 && p.on_ground {
		platformer_leave_ladder(p)
	}
}

@(private = "file")
platformer_is_on_ladder_top :: proc(pos: ^Position, collider: ^shape.Capsule, zone: ^Platformer_Zone) -> bool {
	assert(zone.kind == .Ladder)
	bounds := platformer_world_aabb(pos, collider)
	return bounds.y == zone.bounds.w && bounds.z >= zone.bounds.x && bounds.x <= zone.bounds.z
}

@(private = "file")
platformer_apply_ladder_top_support :: proc(
	pos: ^Position,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	zone: ^Platformer_Zone,
) {
	if !platformer_is_on_ladder_top(pos, collider, zone) {
		return
	}
	vel.y = 0
	p.on_ground = true
	p.on_wall = false
	p.ground_normal = {0, 1}
	p.wall_normal = {}
	p.ground_segment = nil
	p.wall_segment = nil
}

@(private = "file")
platformer_finish_ladder_top_climb :: proc(
	pos: ^Position,
	vel: ^Velocity,
	collider: ^shape.Capsule,
	p: ^Platformer,
	zone: ^Platformer_Zone,
	start_bottom: int,
) {
	assert(zone.kind == .Ladder)
	bounds := platformer_world_aabb(pos, collider)
	if start_bottom > int(zone.bounds.w) || bounds.y < zone.bounds.w {
		return
	}
	local_bounds := capsule_local_aabb(collider)
	pos.y = zone.bounds.w - i32(local_bounds.y)
	vel.y = 0
	platformer_leave_ladder(p)
	p.on_ground = true
	p.on_wall = false
	p.ground_normal = {0, 1}
	p.wall_normal = {}
	p.ground_segment = nil
	p.wall_segment = nil
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
		p.ground_segment = nil
	}
	if vel.x != 0 {
		p.on_wall = false
		p.wall_normal = {}
		p.wall_segment = nil
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
			p.ground_segment = nil
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

		wall_min_y := int(pos.y) + bounds.y
		wall_max_y := int(pos.y) + bounds.w
		if p.on_ground {
			wall_min_y += collider.radius
			wall_max_y -= collider.radius
		}
		contact_x, ok := segment_x_at_aabb_y(wall, wall_min_y, wall_max_y, int(pos.y) + collider.y)
		if !ok {
			continue
		}

		candidate := contact_x - bounds.z if vel.x > 0 else contact_x - bounds.x
		if vel.x > 0 {
			if start_x + bounds.z <= contact_x && end_x + bounds.z >= contact_x {
				best_x = min(best_x, candidate)
				p.on_wall = true
				p.wall_normal = normal
				p.wall_segment = wall
			}
		} else {
			if start_x + bounds.x >= contact_x && end_x + bounds.x <= contact_x {
				best_x = max(best_x, candidate)
				p.on_wall = true
				p.wall_normal = normal
				p.wall_segment = wall
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

		contact_y, ok := segment_y_at_support_x(floor, int(pos.x) + collider.x)
		if !ok && vel.y > 0 {
			contact_y, ok = segment_y_at_aabb_x(
				floor,
				int(pos.x) + bounds.x,
				int(pos.x) + bounds.z,
				int(pos.x) + collider.x,
			)
		}
		if !ok {
			continue
		}

		candidate := contact_y - bounds.y if vel.y < 0 else contact_y - bounds.w
		if vel.y < 0 {
			if start_y + bounds.y >= contact_y && end_y + bounds.y <= contact_y {
				best_y = max(best_y, candidate)
				p.on_ground = true
				p.ground_normal = normal
				p.ground_segment = floor
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
	best_segment: ^[4]int = nil
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
			best_segment = wall
		}
	}

	if best_delta <= stick {
		p.on_wall = true
		p.wall_normal = best_normal
		p.wall_segment = best_segment
	} else {
		p.on_wall = false
		p.wall_normal = {}
		p.wall_segment = nil
	}
}

@(private = "file")
apply_ground_result :: proc(pos: ^Position, vel: ^Velocity, p: ^Platformer, result: slope.Ground_Result) {
	pos.y += i32(result.delta_y)
	vel.y = 0
	p.on_ground = true
	p.ground_normal = result.normal
	p.ground_segment = result.segment
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
platformer_world_aabb :: proc(pos: ^Position, collider: ^shape.Capsule) -> shape.Aabb {
	bounds := capsule_local_aabb(collider)
	return {
		i32(int(pos.x) + bounds.x),
		i32(int(pos.y) + bounds.y),
		i32(int(pos.x) + bounds.z),
		i32(int(pos.y) + bounds.w),
	}
}

@(private = "file")
aabb_overlaps :: proc(a, b: shape.Aabb) -> bool {
	return a.x <= b.z && a.z >= b.x && a.y <= b.w && a.w >= b.y
}

@(private = "file")
aabb_overlaps_strict :: proc(a, b: shape.Aabb) -> bool {
	return a.x < b.z && a.z > b.x && a.y < b.w && a.w > b.y
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
segment_y_at_support_x :: proc(segment: ^[4]int, x: int) -> (int, bool) {
	min_x := min(segment.x, segment.z)
	max_x := max(segment.x, segment.z)
	if x <= min_x || x >= max_x {
		return 0, false
	}
	return segment_y_at_x(segment, x)
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
segment_y_at_aabb_x :: proc(segment: ^[4]int, min_x, max_x, preferred_x: int) -> (int, bool) {
	contact_y, ok := segment_y_at_x(segment, preferred_x)
	if ok {
		return contact_y, true
	}

	segment_min_x := min(segment.x, segment.z)
	segment_max_x := max(segment.x, segment.z)
	if max_x < segment_min_x || min_x > segment_max_x {
		return 0, false
	}
	if segment.y == segment.w {
		return segment.y, true
	}

	clamped_x := clamp(preferred_x, segment_min_x, segment_max_x)
	return segment_y_at_x(segment, clamped_x)
}

@(private = "file")
segment_x_at_aabb_y :: proc(segment: ^[4]int, min_y, max_y, preferred_y: int) -> (int, bool) {
	contact_x, ok := segment_x_at_y(segment, preferred_y)
	if ok {
		return contact_x, true
	}

	segment_min_y := min(segment.y, segment.w)
	segment_max_y := max(segment.y, segment.w)
	if max_y < segment_min_y || min_y > segment_max_y {
		return 0, false
	}
	if segment.x == segment.z {
		return segment.x, true
	}

	clamped_y := clamp(preferred_y, segment_min_y, segment_max_y)
	return segment_x_at_y(segment, clamped_y)
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
