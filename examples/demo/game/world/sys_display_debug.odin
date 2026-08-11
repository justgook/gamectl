package world

import sg "../sokol/gfx"
import "core:math/linalg"

Debug_Canvas_Slot :: enum {
	Light,
	Color,
	Normal,
	Final,
}

DISPLAY_DEBUG_CANVAS_COUNT :: 4

Display_Debug_Pipe :: struct {
	pip:     sg.Pipeline,
	bind:    [DISPLAY_DEBUG_CANVAS_COUNT]sg.Bindings,
	params:  [DISPLAY_DEBUG_CANVAS_COUNT]Display_Vs_Params,
	active:  [DISPLAY_DEBUG_CANVAS_COUNT]bool,
	sampler: sg.Sampler,
}

sys_display_debug :: proc(w: ^World) {
	pipe := w.display_debug_pipe
	for slot in 0 ..< DISPLAY_DEBUG_CANVAS_COUNT {
		if !pipe.active[slot] {
			continue
		}
		sg.apply_pipeline(pipe.pip)
		sg.apply_bindings(pipe.bind[slot])
		sg.apply_uniforms(UB_display_vs_params, {ptr = &pipe.params[slot], size = size_of(Display_Vs_Params)})
		sg.draw(0, 6, 1)
	}
}

display_debug_resize :: proc(pipe: ^Display_Debug_Pipe, width, height: f32) {
	half_w := width * 0.5
	half_h := height * 0.5
	ortho :=
		linalg.matrix_ortho3d_f32(-half_w, half_w, -half_h, half_h, -1, 1) *
		linalg.matrix4_translate_f32({-half_w, -half_h, 0})

	canvas_w: f32 = GAME_RESOLUTION_WIDTH
	canvas_h: f32 = GAME_RESOLUTION_HEIGHT
	grid_origin := [2]f32{(width - canvas_w * 2) * 0.5, (height - canvas_h * 2) * 0.5}

	for slot in 0 ..< DISPLAY_DEBUG_CANVAS_COUNT {
		column := f32(slot % 2)
		row_from_top := f32(slot / 2)
		pipe.params[slot] = {
			ortho   = ortho,
			pos_px  = {grid_origin.x + (column + 0.5) * canvas_w, grid_origin.y + (1.5 - row_from_top) * canvas_h},
			size_px = {canvas_w, canvas_h},
		}
	}
}

display_debug_cleanup :: proc(pipe: ^Display_Debug_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.sampler)
	sg.destroy_buffer(pipe.bind[0].vertex_buffers[0])
	sg.destroy_buffer(pipe.bind[0].index_buffer)
	free(pipe)
}

display_debug_init :: proc(light_texture, color_texture, final_texture: sg.View) -> ^Display_Debug_Pipe {
	pipe := new(Display_Debug_Pipe)
	pipe.sampler = sg.make_sampler({})

	vertices := sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &DISPLAY_DEBUG_BASE_VERTICES, size = size_of(DISPLAY_DEBUG_BASE_VERTICES)},
		},
	)
	indices := sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &DISPLAY_DEBUG_BASE_INDICES, size = size_of(DISPLAY_DEBUG_BASE_INDICES)},
		},
	)

	for slot in 0 ..< DISPLAY_DEBUG_CANVAS_COUNT {
		pipe.bind[slot].vertex_buffers[0] = vertices
		pipe.bind[slot].index_buffer = indices
		pipe.bind[slot].samplers[SMP_display_smp] = pipe.sampler
	}

	light_slot := int(Debug_Canvas_Slot.Light)
	color_slot := int(Debug_Canvas_Slot.Color)
	final_slot := int(Debug_Canvas_Slot.Final)
	pipe.bind[light_slot].views[VIEW_display_tex0] = light_texture
	pipe.bind[color_slot].views[VIEW_display_tex0] = color_texture
	pipe.bind[final_slot].views[VIEW_display_tex0] = final_texture
	pipe.active[light_slot] = true
	pipe.active[color_slot] = true
	pipe.active[final_slot] = true

	pipe.pip = sg.make_pipeline(
		{
			shader = sg.make_shader(display_shader_desc(sg.query_backend())),
			index_type = .UINT16,
			cull_mode = .NONE,
			layout = {attrs = {ATTR_display_display_pos = {format = .FLOAT2, buffer_index = 0}}},
		},
	)

	return pipe
}

@(private = "file")
DISPLAY_DEBUG_BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
DISPLAY_DEBUG_BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}
