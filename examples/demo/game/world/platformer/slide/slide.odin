package slide

Config :: struct {
	enabled:         bool,
	distance:        i32,
	speed:           i32,
	decay_frames:    int,
	cooldown_frames: int,
	collider_height: i32,
}

Can_Start :: proc(cfg: Config, on_ground: bool, cooldown: int) -> bool {
	return cfg.enabled && on_ground && cooldown == 0
}
