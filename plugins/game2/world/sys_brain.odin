package world

import "../host"
import "grid"
import "logic"
import "shape"

Brain :: i8
InputSet :: enum {
	North,
	East,
	South,
	West,
	Action1,
	Action2,
}

InputSet_Vectors :: [InputSet][2]int {
	.North   = {0, -1},
	.East    = {+1, 0},
	.South   = {0, +1},
	.West    = {-1, 0},
	.Action1 = {0, 0},
	.Action2 = {0, 0},
}

Input :: bit_set[InputSet;u8]

sys_brain :: proc(w: ^World) {
	view := logic.view(&w.brain, &w.position, &w.input)
	for _, brain, pos, input in logic.each(&view) {
		if brain^ == 0 {
			w.player1 = input

			continue
		}

		switch brain^ {
		case 1:
			brain1(w, input, pos)
		case:
			host.error("sys_brain", "unknown brain")
		}

	}
}

@(private = "file")
brain1 :: proc(w: ^World, input: ^Input, pos: ^Position) {
	inputX := 0
	if .East in input {
		inputX = 1
	}
	if .West in input {
		inputX = -1
	}
	test := [4]int{}
	test.xy = {int(pos^.x), int(pos^.y)}

	test.z = test.x + inputX * 10 * UNIT
	test.w = test.y
	found := grid.query_segment(&w.grid, &test)
	defer delete(found)

	for wall in found {
		shape.segment_segment_test(wall, &test) or_continue
		if .East in input {
			input^ -= {.East}
			input^ += {.West}
		} else {
			input^ -= {.East}
			input^ += {.West}
		}

		break
	}
}
