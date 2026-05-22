package air_jump

Config :: struct {
	enabled:      bool,
	max_jumps:    int,
	jump_y_speed: i32,
}

Can_Jump :: proc(cfg: Config, jumps_used: int) -> bool {
	if !cfg.enabled {
		return false
	}
	return cfg.max_jumps == 0 || jumps_used < cfg.max_jumps
}
