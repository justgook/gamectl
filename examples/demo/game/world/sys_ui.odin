package world

import "ui"

@(private = "file")
UI_Sprite :: struct {
	using _: ui.Shape,
	uv:      UV,
}
@(private = "file")
sprite :: proc(uv: UV) -> ui.Shape {
	// return UI_Sprite{sx = 1, sy = 1, o = 1, uv = uv}
	return ui.Shape{sx = 1, sy = 1, o = 1}
}

@(private = "file")
count_shape :: proc(_: ui.Shape, count: ^int) {
	count^ += 1
}

sys_ui :: proc(w: ^World) {
	_ = w
	a1 := ui.group({ui.move(sprite(w.uv[418]), 20, 40), sprite(w.uv[1])})
	count := 0
	ui.flatten(a1, &count, count_shape)
}
