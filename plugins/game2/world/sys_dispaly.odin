package world

import sg "../sokol/gfx"
import "core:math"
import "core:math/linalg"

Display_Pipe :: struct {
	pip:    sg.Pipeline,
	bind:   sg.Bindings,
	params: Display_Vs_Params,
}

sys_display :: proc(w: ^World) {
	vs_params := w.display_pipe.params
	pipe := w.display_pipe

	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_display_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, 1)
}

display_resize :: proc(params: ^Display_Vs_Params, w, h: f32) {
	half_w: f32 = w * 0.5
	half_h: f32 = h * 0.5
	screen_ortho :=
		linalg.matrix_ortho3d_f32(-half_w, half_w, -half_h, half_h, -1, 1) *
		linalg.matrix4_translate_f32({-half_w, -half_h, 0})
	params.ortho = screen_ortho
	params.pos_px = {math.floor(w * 0.5), math.floor(h * 0.5)}
	params.size_px =
		[2]f32{GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT} *
		max(1, math.floor(min(w / GAME_RESOLUTION_WIDTH, h / GAME_RESOLUTION_HEIGHT)))
}

@(private = "file")
BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}


display_cleanup :: proc(pipe: ^Display_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_display_smp])
	sg.destroy_view(pipe.bind.views[VIEW_display_tex0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}

display_init :: proc(tex0: sg.Image) -> ^Display_Pipe {
	pipe := new(Display_Pipe)
	pipe.bind.samplers[SMP_display_smp] = sg.make_sampler({})
	pipe.bind.views[VIEW_display_tex0] = sg.make_view({texture = {image = tex0}})

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &BASE_VERTICES, size = size_of(BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{usage = {index_buffer = true, immutable = true}, data = {ptr = &BASE_INDICES, size = size_of(BASE_INDICES)}},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(display_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .NONE,
		layout = {attrs = {ATTR_display_display_pos = {format = .FLOAT2, buffer_index = 0}}},
	}
	pipeline_desc.colors[0].blend = {
		enabled          = true,
		src_factor_rgb   = .SRC_ALPHA,
		dst_factor_rgb   = .ONE_MINUS_SRC_ALPHA,
		op_rgb           = .ADD,
		src_factor_alpha = .ONE,
		dst_factor_alpha = .ONE_MINUS_SRC_ALPHA,
		op_alpha         = .ADD,
	}

	pipe.pip = sg.make_pipeline(pipeline_desc)

	return pipe
}
