package world

import "ui"

sys_ui :: proc(w: ^World) {
	the_nine := nine(w.uv[418], 100, 100)
	the_nine = ui.move(the_nine, 20, 20)
	a1 := ui.group(
		[]ui.Node(UI_Item){UI_Item(ui.move(sprite(w.uv[418]), 20, 40)), UI_Item(sprite(w.uv[1])), UI_Item(the_nine)},
	)

	w.nine_patch.count = 0
	ui.flatten(a1, w, render_shapes)


}

@(private = "file")
render_shapes :: proc(item: UI_Item, w: ^World) {
	switch value in item {
	case UI_Sprite:
	case UI_Nine:
		w.nine_patch.components = Nine_Patch {
			bounds = {value.x, value.y, value.x + value.w * value.sx, value.y + value.h * value.sy},
			slices = {6, 7, 11, 10},
			size   = {16, 16},
			uv     = value.uv,
		}

		w.nine_patch.count += 1
	case UI_Text:
	}

}

@(private = "file")
UI_Sprite :: struct {
	using _: ui.Shape,
	uv:      UV,
}

UI_Nine :: struct {
	using _: ui.Shape,
	uv:      UV,
	w, h:    f32,
}

UI_Text :: struct {
	using _: ui.Shape,
	uv:      UV,
}

UI_Item :: union {
	UI_Sprite,
	UI_Nine,
	UI_Text,
}

@(private = "file")
sprite :: proc(uv: UV) -> UI_Sprite {
	return UI_Sprite{sx = 1, sy = 1, o = 1, uv = uv}
}
@(private = "file")
nine :: proc(uv: UV, w, h: f32) -> UI_Nine {
	return UI_Nine{sx = 1, sy = 1, o = 1, uv = uv, w = w, h = h}
}
