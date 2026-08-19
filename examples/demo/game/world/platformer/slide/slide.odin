package slide

Config :: struct {
	enabled:         bool,
	speed:           i32,
	frames:          int,
	cooldown_frames: int,
	collider_height: i32,
}

Can_Start :: proc(cfg: Config, on_ground: bool, cooldown: int) -> bool {
	return cfg.enabled && on_ground && cooldown == 0
}
