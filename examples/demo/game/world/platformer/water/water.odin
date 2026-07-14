package water

Config :: struct {
	enabled:    bool,
	swim_speed: i32,
}

Velocity_For_Direction :: proc(direction: [2]i32, speed: i32) -> [2]i32 {
	if direction.x != 0 && direction.y != 0 {
		diagonal_speed := speed * 707 / 1000
		return {direction.x * diagonal_speed, direction.y * diagonal_speed}
	}
	return {direction.x * speed, direction.y * speed}
}
