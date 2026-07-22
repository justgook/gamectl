package wall

Config :: struct {
	enabled:         bool,
	slide_enabled:   bool,
	slide_accel:     i32,
	max_slide_speed: i32,
	jump_enabled:    bool,
	max_jumps:       int,
	jump_x_speed:    i32,
	jump_y_speed:    i32,
}

Can_Jump :: proc(cfg: Config, jumps_used: int) -> bool {
	if !cfg.enabled || !cfg.jump_enabled {
		return false
	}
	return cfg.max_jumps == 0 || jumps_used < cfg.max_jumps
}

Apply_Slide :: proc(vel: ^[2]i32, cfg: Config) {
	if !cfg.enabled || !cfg.slide_enabled {
		return
	}

	down_speed := max(-vel.y, i32(0))
	down_speed = clamp(down_speed + cfg.slide_accel, i32(0), cfg.max_slide_speed)
	vel.y = -down_speed
}

Jump_Direction_X :: proc(wall_normal: [2]i32, facing: i32) -> i32 {
	if wall_normal.x > 0 {
		return 1
	}
	if wall_normal.x < 0 {
		return -1
	}
	return -facing
}
