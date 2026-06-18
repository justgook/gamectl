package world

import "ui"

sys_ui :: proc(w: ^World) {
	the_nine := ui.move(nine(w.uv[418], 100, 100), 20, ui.wave(10, 30, 120, w.frame_count))
	a1 := ui.group([]ui.Node(UI_Item){ui.move(sprite(w.uv[418]), 20, 40), sprite(w.uv[1]), the_nine})

	w.nine_patch.count = 0
	ui.flatten(a1, w, render_shapes)


}

@(private = "file")
render_shapes :: proc(shape: ui.Shape, item: UI_Item, w: ^World) {
	switch value in item {
	case UI_Sprite:
	case UI_Nine:
		w.nine_patch.components = Nine_Patch {
			bounds = {shape.x, shape.y, shape.x + value.w * shape.sx, shape.y + value.h * shape.sy},
			slices = {6, 7, 11, 10},
			size   = {16, 16},
			uv     = value.uv,
		}

		w.nine_patch.count += 1
	case UI_Text:
	}

}
@(private = "file")
UI_Item :: union {
	UI_Sprite,
	UI_Nine,
	UI_Text,
}

@(private = "file")
UI_Sprite :: struct {
	uv: UV,
}

@(private = "file")
UI_Nine :: struct {
	uv:   UV,
	w, h: f32,
}

@(private = "file")
UI_Text :: struct {
	uv: UV,
}


@(private = "file")
sprite :: proc(uv: UV) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Sprite{uv = uv}))
}
@(private = "file")
nine :: proc(uv: UV, w, h: f32) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Nine{uv = uv, w = w, h = h}))
}
