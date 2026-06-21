package world

import "../host"
import "logic"
import "ui"

sys_ui :: proc(w: ^World) {
	panel := group(
		{
			nine(w.uv[418], 240, 52),
			ui.move(text("\x04 use WASD to move "), 8, 38),
			ui.move(text1("\x1C J - jump"), 8, 28),
			ui.move(text2("\x93 K - dash"), 8, 18),
			ui.move(text5("\xCA L - fire"), 8, 8),
		},
	)

	panel = ui.move(panel, 20, ui.wave(10, 30, 120, w.frame_count))
	statusbar := sprite({0.5, 1 - 48.0 / 512.0, 1.0 - 7 * 16.0 / 512.0, 1})
	statusbar = ui.move(statusbar, 8 + 4.5 * 16, GAME_RESOLUTION_HEIGHT - 24 - 8)

	c: f32 = 16.0 / 512
	hp2 := sprite({27 * c, 1 - 4 * c, 1 - 2 * c, 1 - 3 * c})

	pp := logic.get_component(&w.position, w.player1_id)
	p := world_to_screen(&w.cam, to_pixelf(pp^))
	hp2 = ui.move(hp2, p.x, p.y + 20)


	w.nine_patch.count = 0
	w.text_glyph.count = 0
	w.ui_sprite.count = 0

	ui.flatten(group({panel, statusbar, hp2}), w, render_shapes)
}


@(private = "file")
render_shapes :: proc(shape: ui.Shape, item: UI_Item, w: ^World) {
	switch value in item {
	case UI_Sprite:
		w.ui_sprite.components[w.ui_sprite.count] = Sprite {
			pos     = {shape.x, shape.y},
			opacity = 1,
			uv      = value.uv,
		}

		w.ui_sprite.count += 1
	case UI_Nine:
		w.nine_patch.components[w.nine_patch.count] = Nine_Patch {
			bounds = {shape.x, shape.y, shape.x + value.w * shape.sx, shape.y + value.h * shape.sy},
			slices = {6, 7, 11, 10},
			size   = {16, 16},
			uv     = value.uv,
		}

		w.nine_patch.count += 1
	case UI_Text:
		assert(w.text_glyph.count < TEXT_GLYPH_RENDER_MAX)
		w.text_glyph.components[w.text_glyph.count] = Text_Glyph {
			pos   = {shape.x, shape.y},
			uv    = value.uv,
			color = {1, 1, 1, 1},
		}
		w.text_glyph.count += 1
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

group :: proc(items: []ui.Node(UI_Item)) -> ui.Group(UI_Item) {
	return ui.group(items)
}
@(private = "file")
sprite :: proc(uv: UV) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Sprite{uv = uv}))
}
@(private = "file")
nine :: proc(uv: UV, w, h: f32) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Nine{uv = uv, w = w, h = h}))
}

@(private = "file")
text_glyph :: proc(uv: UV) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Text{uv = uv}))
}

@(private = "file")
text :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(TEXT_DEBUG_FONT_0, value)
}

@(private = "file")
text1 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(TEXT_DEBUG_FONT_1, value)
}

@(private = "file")
text2 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(TEXT_DEBUG_FONT_2, value)
}

@(private = "file")
text3 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(TEXT_DEBUG_FONT_3, value)
}

@(private = "file")
text4 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(TEXT_DEBUG_FONT_4, value)
}

@(private = "file")
text5 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(TEXT_DEBUG_FONT_5, value)
}

@(private = "file")
text_font :: proc(font: Text_Font, value: string) -> ui.Group(UI_Item) {
	children := make([]ui.Node(UI_Item), len(value), context.temp_allocator)
	cursor_x: f32 = 0
	cursor_y: f32 = 0
	count := 0

	for index := 0; index < len(value); index += 1 {
		ch := value[index]
		switch ch {
		case '\r':
			cursor_x = 0
		case '\n':
			cursor_x = 0
			cursor_y += font.glyph_size.y
		case '\t':
			cursor_x += font.glyph_size.x * 4
		case:
			assert(int(ch) < font.columns * font.rows)
			children[count] = ui.move(text_glyph(text_font_glyph_uv(font, ch)), cursor_x, cursor_y)
			count += 1
			cursor_x += font.glyph_size.x
		}
	}

	return ui.group(children[:count])
}

Text_Font :: struct {
	uv:         UV,
	glyph_size: [2]f32,
	columns:    int,
	rows:       int,
}

TEXT_DEBUG_GLYPH_SIZE :: [2]f32{8, 8}
TEXT_DEBUG_FONT_COLUMNS :: 16
TEXT_DEBUG_FONT_ROWS :: 16
TEXT_DEBUG_FONT_0 :: Text_Font {
	uv         = {0.5, 0.5, 0.75, 0.75},
	glyph_size = TEXT_DEBUG_GLYPH_SIZE,
	columns    = TEXT_DEBUG_FONT_COLUMNS,
	rows       = TEXT_DEBUG_FONT_ROWS,
}
TEXT_DEBUG_FONT_1 :: Text_Font {
	uv         = {0.75, 0.5, 1.0, 0.75},
	glyph_size = TEXT_DEBUG_GLYPH_SIZE,
	columns    = TEXT_DEBUG_FONT_COLUMNS,
	rows       = TEXT_DEBUG_FONT_ROWS,
}
TEXT_DEBUG_FONT_2 :: Text_Font {
	uv         = {0.5, 0.25, 0.75, 0.5},
	glyph_size = TEXT_DEBUG_GLYPH_SIZE,
	columns    = TEXT_DEBUG_FONT_COLUMNS,
	rows       = TEXT_DEBUG_FONT_ROWS,
}
TEXT_DEBUG_FONT_3 :: Text_Font {
	uv         = {0.75, 0.25, 1.0, 0.5},
	glyph_size = TEXT_DEBUG_GLYPH_SIZE,
	columns    = TEXT_DEBUG_FONT_COLUMNS,
	rows       = TEXT_DEBUG_FONT_ROWS,
}
TEXT_DEBUG_FONT_4 :: Text_Font {
	uv         = {0.5, 0.0, 0.75, 0.25},
	glyph_size = TEXT_DEBUG_GLYPH_SIZE,
	columns    = TEXT_DEBUG_FONT_COLUMNS,
	rows       = TEXT_DEBUG_FONT_ROWS,
}
TEXT_DEBUG_FONT_5 :: Text_Font {
	uv         = {0.75, 0.0, 1.0, 0.25},
	glyph_size = TEXT_DEBUG_GLYPH_SIZE,
	columns    = TEXT_DEBUG_FONT_COLUMNS,
	rows       = TEXT_DEBUG_FONT_ROWS,
}

@(private = "file")
text_font_glyph_uv :: proc(font: Text_Font, char_code: u8) -> UV {
	glyph_u := f32(char_code % u8(font.columns))
	glyph_v := f32(font.rows - 1 - int(char_code / u8(font.columns)))
	cell_w := (font.uv.z - font.uv.x) / f32(font.columns)
	cell_h := (font.uv.w - font.uv.y) / f32(font.rows)
	u0 := font.uv.x + glyph_u * cell_w
	v0 := font.uv.y + glyph_v * cell_h
	return {u0, v0, u0 + cell_w, v0 + cell_h}
}
