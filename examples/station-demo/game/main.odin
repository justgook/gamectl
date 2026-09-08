package main

import "core:c"
import content "content"
import host "host"
import sg "sokol/gfx"
import station "station"

MAX_VERTICES :: 256

Vertex :: struct {
	position: [2]f32,
	color:    [4]f32,
}

App_State :: struct {
	game:    station.State,
	content: content.Decoded,
	vertices: [dynamic]Vertex,
	pipeline: sg.Pipeline,
	bindings: sg.Bindings,
	pass:     sg.Pass_Action,
}

app: App_State

app_init :: proc() {
	host.setup_graphics()
	bytes, asset_ok := host.asset_read_all("station.rspk")
	assert(asset_ok, "required station.rspk could not be read")
	decoded, decode_ok := content.read(bytes)
	assert(decode_ok, "station.rspk violates game/CONTRACT.md")
	app.content = decoded
	app.game = station.init(app.content.data, app.content.bindings)
	app.vertices = make([dynamic]Vertex, 0, MAX_VERTICES)
	app.bindings.vertex_buffers[0] = sg.make_buffer({
		usage = {vertex_buffer = true, dynamic_update = true},
		size = MAX_VERTICES * size_of(Vertex),
	})
	shader := sg.make_shader(room_shader_desc(sg.query_backend()))
	app.pipeline = sg.make_pipeline({
		shader = shader,
		primitive_type = .TRIANGLES,
		cull_mode = .NONE,
		depth = {compare = .ALWAYS, write_enabled = false},
		layout = {attrs = {
			ATTR_room_position = {format = .FLOAT2, buffer_index = 0},
			ATTR_room_color0 = {format = .FLOAT4, buffer_index = 0},
		}},
	})
	app.pass = {
		colors = {0 = {load_action = .CLEAR, clear_value = {0.025, 0.035, 0.055, 1}}},
		depth = {load_action = .CLEAR, clear_value = 1},
	}
}

app_frame :: proc() {
	station.step(&app.game, host.frame_duration())
	build_room()
	sg.begin_pass({action = app.pass, swapchain = host.swapchain()})
	if len(app.vertices) > 0 {
		sg.update_buffer(app.bindings.vertex_buffers[0], {
			ptr = raw_data(app.vertices[:]),
			size = c.size_t(len(app.vertices) * size_of(Vertex)),
		})
		sg.apply_pipeline(app.pipeline)
		sg.apply_bindings(app.bindings)
		sg.draw(0, i32(len(app.vertices)), 1)
	}
	sg.end_pass()
	sg.commit()
}

app_event :: proc(event: host.Event) {
	switch event.kind {
	case .Action_Down: station.set_action(&app.game, event.action_code, true)
	case .Action_Up: station.set_action(&app.game, event.action_code, false)
	case .Resized, .Mouse_Move, .Mouse_Down, .Mouse_Up, .None:
	}
}

app_cleanup :: proc() {
	station.destroy(&app.game)
	content.destroy(&app.content)
	delete(app.vertices)
	host.shutdown_graphics()
	app = {}
}

@(export)
status_bits :: proc "c" () -> u32 {
	context = host.default_context()
	bits: u32
	if station.has_power(&app.game) {bits |= 1 << 0}
	if station.has_key(&app.game) {bits |= 1 << 1}
	if !station.is_locked(&app.game) {bits |= 1 << 2}
	if app.game.completed {bits |= 1 << 3}
	bits |= u32(app.game.message) << 8
	return bits
}

build_room :: proc() {
	clear(&app.vertices)
	// Floor and inset panels.
	add_rect(-0.9, -0.72, 0.9, 0.72, {0.075, 0.095, 0.13, 1})
	add_rect(-0.72, -0.52, 0.62, -0.48, {0.10, 0.14, 0.18, 1})
	add_rect(-0.72, 0.48, 0.62, 0.52, {0.10, 0.14, 0.18, 1})
	// Room walls, with a doorway gap in the east wall.
	wall := [4]f32{0.22, 0.28, 0.34, 1}
	add_rect(-0.94, -0.76, 0.94, -0.68, wall)
	add_rect(-0.94, 0.68, 0.94, 0.76, wall)
	add_rect(-0.94, -0.76, -0.86, 0.76, wall)
	add_rect(0.86, -0.76, 0.94, -0.16, wall)
	add_rect(0.86, 0.16, 0.94, 0.76, wall)
	// Exit threshold and Director-projected door.
	add_rect(0.84, -0.16, 1.04, 0.16, {0.08, 0.28, 0.27, 1})
	if station.is_locked(&app.game) {
		add_rect(0.82, -0.17, 0.9, 0.17, {0.88, 0.24, 0.22, 1})
	}
	power_color := [4]f32{0.70, 0.34, 0.12, 1}
	if station.has_power(&app.game) {power_color = {0.20, 0.90, 0.48, 1}}
	add_rect(-0.54, -0.40, -0.42, -0.28, power_color)
	if !station.has_key(&app.game) {
		add_rect(0.24, 0.33, 0.34, 0.39, {0.96, 0.78, 0.20, 1})
		add_rect(0.31, 0.29, 0.34, 0.38, {0.96, 0.78, 0.20, 1})
	}
	p := app.game.player
	add_rect(p.x - 0.035, p.y - 0.045, p.x + 0.035, p.y + 0.045, {0.35, 0.76, 1.0, 1})
}

add_rect :: proc(x0, y0, x1, y1: f32, color: [4]f32) {
	assert(len(app.vertices) + 6 <= MAX_VERTICES)
	append(&app.vertices,
		Vertex{{x0, y0}, color}, Vertex{{x1, y0}, color}, Vertex{{x1, y1}, color},
		Vertex{{x0, y0}, color}, Vertex{{x1, y1}, color}, Vertex{{x0, y1}, color},
	)
}
