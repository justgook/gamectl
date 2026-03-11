package world

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

Input :: bit_set[InputSet;u8]

sys_brain :: proc(w: ^World) {
	view := logic.view(&w.brain, &w.position, &w.input)
	for entity, brain, pos, input in logic.each(&view) {
		if brain^ == 0 {
			sys_keyboard(w, entity)

			continue
		}

		inputX := 0
		if .East in input {
			inputX = 1
		}
		if .West in input {
			inputX = -1
		}
		test := [4]int{}
		test.xy = pos^
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
}

@(private = "file")
sys_keyboard :: proc(w: ^World, id: int) {
	// fmt.aprint("THE USER INPUT")
	// if comp, ok := logic.get_component(&w.jump, id); ok {
	// 	comp.input = key_down(.SPACE)
	// }
	//
	// if char_input, ok := logic.get_component(&w.input, id); ok {
	// 	char_input.x = 0
	// 	char_input.x += i8(key_down(.RIGHT))
	// 	char_input.x -= i8(key_down(.LEFT))
	// }
	//
	// // Trigger/weapon input (X key to shoot)
	// if trigger, ok := logic.get_component(&w.trigger, id); ok {
	// 	trigger_set_active(trigger, key_down(.X))
	// }
}
