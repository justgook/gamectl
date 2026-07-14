package world

import "../director"
import "core:fmt"
import "logic"
import "ui"

ui_fonts_storage := [6]Text_Font{}
ui_nines_storage := [12]Nine_Patch{}

sys_ui :: proc(w: ^World) {
	player_hp := director_player_hp(w)
	player_money := director_player_money(w)

	statusbar := sprite({0.5, 1 - 48.0 / 512.0, 1.0 - 7 * 16.0 / 512.0, 1})
	statusbar = ui.move(statusbar, 8 + 4.5 * 16, GAME_RESOLUTION_HEIGHT - 24 - 8)
	hud_text := ui.move(
		text3(fmt.tprintf("HP %d   MONEY %d", player_hp, player_money)),
		16,
		GAME_RESOLUTION_HEIGHT - 28,
	)

	c: f32 = 16.0 / 512
	hp2 := sprite({27 * c, 1 - 4 * c, 1 - 2 * c, 1 - 3 * c})

	pp := logic.get_component(&w.position, w.player1_id)
	p := world_to_screen(&w.cam, to_pixelf(pp^))
	hp2 = ui.move(hp2, p.x, p.y + 20)


	w.nine_patch.count = 0
	w.text_glyph.count = 0
	w.ui_sprite.count = 0

	if w.input_mode == .Dialog {
		dialog_panel := group(
			{
				nine(8, GAME_RESOLUTION_WIDTH - 24, GAME_RESOLUTION_HEIGHT / 3 - 12),
				ui.move(nine(8, 80, 76), 12, 12),
				ui.move(text3("?"), 48, 46),
				ui.move(text3("FIXER"), 108, 78),
				ui.move(text3(dialog_text(w.active_dialog_text_id)), 108, 56),
				ui.move(nine(8, 112, 26), 108, 10),
				ui.move(text3("1  JOB"), 116, 18),
				ui.move(nine(8, 112, 26), 226, 10),
				ui.move(text3("2  PAY"), 234, 18),
				ui.move(nine(8, 112, 26), 344, 10),
				ui.move(text3("3  REFUSE"), 352, 18),
				ui.move(nine(8, 112, 26), 462, 10),
				ui.move(text3("4  LEAVE"), 470, 18),
			},
		)
		dialog_panel = ui.move(dialog_panel, 12, 6)
		ui.flatten(group({statusbar, hud_text, hp2, dialog_panel}), w, render_shapes)
	} else {
		ui.flatten(group({statusbar, hud_text, hp2}), w, render_shapes)
	}
}

@(private = "file")
@(require_results)
dialog_text :: proc(text_id: i32) -> string {
	switch text_id {
	case 1:
		return "Wake up, merc. Night City has another job for you."
	case:
		assert(false, "unknown mock dialog text id")
	}
	return ""
}

@(private = "file")
@(require_results)
director_player_hp :: proc(w: ^World) -> i32 {
	return director.entity_stat(&w.director, director.Entity_Id(0), director.Word_Id(0))
}

@(private = "file")
@(require_results)
director_player_money :: proc(w: ^World) -> i32 {
	return director.entity_stat(&w.director, director.Entity_Id(0), director.Word_Id(1))
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
		item := ui_nines_storage[value.id]
		w.nine_patch.components[w.nine_patch.count] = Nine_Patch {
			bounds = {shape.x, shape.y, shape.x + value.w * shape.sx, shape.y + value.h * shape.sy},
			slices = item.slices,
			size   = item.size,
			uv     = item.uv,
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
	id:   int,
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
nine :: proc(id: int, w, h: f32) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Nine{id = id, w = w, h = h}))
}

@(private = "file")
text_glyph :: proc(uv: UV) -> ui.Leaf(UI_Item) {
	return ui.leaf(UI_Item(UI_Text{uv = uv}))
}

@(private = "file")
text :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(ui_fonts_storage[0], value)
}

@(private = "file")
text1 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(ui_fonts_storage[1], value)
}

@(private = "file")
text2 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(ui_fonts_storage[2], value)
}

@(private = "file")
text3 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(ui_fonts_storage[3], value)
}

@(private = "file")
text4 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(ui_fonts_storage[4], value)
}

@(private = "file")
text5 :: proc(value: string) -> ui.Group(UI_Item) {
	return text_font(ui_fonts_storage[5], value)
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
			assert(u32(ch) < font.columns * font.rows)
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
	columns:    u32,
	rows:       u32,
}

@(private = "file")
text_font_glyph_uv :: proc(font: Text_Font, char_code: u8) -> UV {
	glyph_u := f32(char_code % u8(font.columns))
	glyph_v := f32(font.rows - 1 - u32(char_code / u8(font.columns)))
	cell_w := (font.uv.z - font.uv.x) / f32(font.columns)
	cell_h := (font.uv.w - font.uv.y) / f32(font.rows)
	u0 := font.uv.x + glyph_u * cell_w
	v0 := font.uv.y + glyph_v * cell_h
	return {u0, v0, u0 + cell_w, v0 + cell_h}
}
