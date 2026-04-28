package world

import "../host"
import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"
import "grid"
import "logic"

// GAME_RESOLUTION :: [2]int{320, 180}
GAME_RESOLUTION :: [2]c.int{640, 360}
GAME_RESOLUTION_WIDTH :: 640
GAME_RESOLUTION_HEIGHT :: 360
OFFSCREEN_SAMPLE_COUNT :: 1


World :: struct {
	next_entity_id:      logic.Entity,
	sim_frame_length:    f64,
	accumulator:         f64,
	atlas:               sg.Image,
	lut:                 sg.Image,
	grid:                grid.Grid,
	cam:                 Camera,
	player1:             ^Input,
	sprite_pipe:         ^Sprite_Pipe,
	tilemap_pipe:        ^Tilemap_Pipe,
	nine_patch_pipe:     ^Nine_Patch_Pipe,
	uv:                  []UV,
	position:            logic.Component_Storage(Position),
	velocity:            logic.Component_Storage(Velocity),
	sprite:              logic.Component_Storage_Fixed(Sprite, SPRITE_RENDER_MAX),
	tilemap:             logic.Component_Storage_Fixed(Tilemap, MAX_TILEMAPS),
	nine_patch:          logic.Component_Storage_Fixed(Nine_Patch, NINE_PATCH_RENDER_MAX),
	brain:               logic.Component_Storage(Brain),
	input:               logic.Component_Storage(Input),
	timer:               logic.Component_Storage(Timer),
	// animations
	animation_atlas:     Animation_Atlas,
	animation:           logic.Component_Storage(Animation),
	// NEW rendering
	offscreen_pass:      sg.Pass,
	display_pass_action: sg.Pass_Action,
	display_pipe:        ^Display_Pipe,
}

frame :: proc(w: ^World, dt: f64) {
	w.accumulator += dt
	for (w.accumulator >= w.sim_frame_length) {
		w.accumulator -= w.sim_frame_length
		sys_brain(w)
		sys_move(w)
		sys_velocity(w)
	}

	sys_camera(w, dt)
	sys_animation(w, dt)


	// RENDER START HERE
	virtual_half_w: f32 = GAME_RESOLUTION_WIDTH * 0.5
	virtual_half_h: f32 = GAME_RESOLUTION_HEIGHT * 0.5
	virtual_screen_ortho :=
		linalg.matrix_ortho3d_f32(-virtual_half_w, virtual_half_w, -virtual_half_h, virtual_half_h, -1, 1) *
		linalg.matrix4_translate_f32({-virtual_half_w, -virtual_half_h, 0})
	sg.begin_pass(w.offscreen_pass)
	sys_tilemap(w, &w.cam.ortho)
	sys_sprite(w, &w.cam.ortho)
	sys_nine_patch(w, &virtual_screen_ortho)
	sg.end_pass()

	// RENDER THE CANVAS ON SCREEN
	sg.begin_pass({action = w.display_pass_action, swapchain = host.swapchain()})
	sys_display(w)
	// sys_nine_patch(w, &screen_ortho)
	sg.end_pass()

	sg.commit()
}


init :: proc(w: ^World, wh: [2]f32) {
	// TODO: move outside to display init
	w.cam.viewport = [2]f32{GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT}
	color_img := sg.make_image(
	{
		usage = {color_attachment = true},
		width = GAME_RESOLUTION[0],
		height = GAME_RESOLUTION[1],
		// pixel_format = .RGBA8,
		sample_count = OFFSCREEN_SAMPLE_COUNT,
	},
	)
	depth_img := sg.make_image(
		{
			usage = {depth_stencil_attachment = true},
			width = GAME_RESOLUTION[0],
			height = GAME_RESOLUTION[1],
			sample_count = 1,
			pixel_format = .DEPTH_STENCIL,
		},
	)
	w.offscreen_pass = {
		action = {colors = {0 = {load_action = .CLEAR, clear_value = {0.25, 0.25, 0.25, 1.0}}}},
		attachments = {
			colors = {0 = sg.make_view({color_attachment = {image = color_img}})},
			depth_stencil = sg.make_view({depth_stencil_attachment = {image = depth_img}}),
		},
	}
	w.display_pass_action = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.08, 0.09, 0.12, 1.0}}},
		depth = {load_action = .CLEAR, clear_value = 1.0},
	}

	w.display_pipe = display_init(color_img)


	w.next_entity_id = 100
	w.sim_frame_length = 1.0 / 60.0
	w.cam = camera_init(wh, wh / 2, 1.0)
	w.sprite_pipe = sprites_init(w.atlas)
	w.tilemap_pipe = tilemap_init(w.atlas, w.lut)
	w.nine_patch_pipe = nine_patch_init(w.atlas)
	// THE FIRST MOCK DATA

	player := create_entity(w)
	logic.add_component(&w.brain, player, Brain{})
	logic.add_component(&w.input, player, Input{})
	w.player1, _ = logic.get_component(&w.input, player)
	logic.add_component(&w.velocity, player, Velocity{})
	// logic.add_component(&w.position, player, Position{150 * UNIT, 128 * UNIT})
	logic.add_component(&w.position, player, Position{})
	logic.add_component(&w.sprite, player, Sprite{pos = {00, 00}, opacity = 1, uv = w.uv[968], size = {128, 128}})

	ui := create_entity(w)
	logic.add_component(
		&w.nine_patch,
		ui,
		Nine_Patch{bounds = {20, 20, 420, 120}, slices = {6, 7, 11, 10}, size = {16, 16}, uv = w.uv[418]},
	)

	// logic.add_component(&w.position, background, Position{0 * UNIT, 0 * UNIT})
	// // logic.add_component(
	// // 	&w.sprite,
	// // 	background,
	// // 	Sprite{opacity = 1, uv = {0, 0, 1, 1}, size = {256, 256}},
	// // )
	// logic.add_component(
	// 	&w.tilemap,
	// 	background,
	// 	Tilemap{tile_size = {16, 16}, tileset_uv = {0, 0, 1, 1}, lut_uv = {0, 0, 1, 1}},
	// )
	//
	host.info("world", "init", w.tilemap.components[0])
}

create_entity :: proc(w: ^World) -> logic.Entity {
	id := w.next_entity_id
	w.next_entity_id += 1

	return id
}

entity_delete :: proc(w: ^World, entity_id: logic.Entity) {
	logic.delete_component(&w.position, entity_id)
	logic.delete_component(&w.velocity, entity_id)
	logic.delete_component(&w.sprite, entity_id)
	logic.delete_component(&w.tilemap, entity_id)
	logic.delete_component(&w.nine_patch, entity_id)
	logic.delete_component(&w.brain, entity_id)
	logic.delete_component(&w.input, entity_id)
	logic.delete_component(&w.timer, entity_id)
}

cleanup :: proc(w: ^World) {
	// sg.destroy_image(w.offscreen_image)
	// w.offscreen_image = {}
	display_cleanup(w.display_pipe)

	delete(w.uv)
	logic.destroy_storage(&w.position)
	logic.destroy_storage(&w.velocity)
	sprites_cleanup(w.sprite_pipe)
	logic.destroy_storage(&w.sprite)
	tilemap_cleanup(w.tilemap_pipe)
	logic.destroy_storage(&w.tilemap)
	nine_patch_cleanup(w.nine_patch_pipe)
	logic.destroy_storage(&w.nine_patch)
	logic.destroy_storage(&w.brain)
	logic.destroy_storage(&w.input)
	logic.destroy_storage(&w.timer)
}
