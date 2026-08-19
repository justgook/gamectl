package world

import "logic"

TARGET_DISTANCE :: 64 * UNIT
TARGET_DIAGONAL_OFFSET :: 45 * UNIT

Target :: struct {
	x, y:      i32,
	direction: [2]i32,
}

target_component :: proc(pos: Position, facing: i32) -> Target {
	assert(facing == -1 || facing == 1)
	return Target{x = pos.x + facing * TARGET_DISTANCE, y = pos.y, direction = {facing, 0}}
}

sys_target :: proc(w: ^World) {
	view := logic.view(&w.input, &w.position, &w.target)
	for _, input, pos, target in logic.each(&view) {
		direction := target_input_direction(input)
		if direction.x != 0 || direction.y != 0 {
			target.direction = direction
		}

		offset := target.direction * TARGET_DISTANCE
		if target.direction.x != 0 && target.direction.y != 0 {
			offset = target.direction * TARGET_DIAGONAL_OFFSET
		}
		target.x = pos.x + offset.x
		target.y = pos.y + offset.y
	}
}

@(private = "file")
target_input_direction :: proc(input: ^Input) -> [2]i32 {
	direction: [2]i32
	if .TargetEast in input {
		direction.x += 1
	}
	if .TargetWest in input {
		direction.x -= 1
	}
	if .TargetNorth in input {
		direction.y += 1
	}
	if .TargetSouth in input {
		direction.y -= 1
	}
	return direction
}
