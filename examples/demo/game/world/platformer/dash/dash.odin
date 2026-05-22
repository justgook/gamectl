package dash

Mode_Config :: struct {
	enabled: bool,
	speed:   i32,
	frames:  int,
	count:   int, // 0 = infinite
}

Config :: struct {
	enabled:             bool,
	ground:              Mode_Config,
	air:                 Mode_Config,
	cooldown_frames:     int,
	delay_frames:        int,
	reset_air_on_ground: bool,
}

Can_Start :: proc(cfg: Config, mode: Mode_Config, used, cooldown, delay: int) -> bool {
	if !cfg.enabled || !mode.enabled {
		return false
	}
	if cooldown > 0 || delay > 0 {
		return false
	}
	return mode.count == 0 || used < mode.count
}

Uses_Depleted :: proc(mode: Mode_Config, used: int) -> bool {
	return mode.count > 0 && used >= mode.count
}

Velocity_For_Direction :: proc(dir: [2]i32, speed: i32) -> [2]i32 {
	if dir.x != 0 && dir.y != 0 {
		diagonal_speed := speed * 707 / 1000
		return {dir.x * diagonal_speed, dir.y * diagonal_speed}
	}
	return {dir.x * speed, dir.y * speed}
}
