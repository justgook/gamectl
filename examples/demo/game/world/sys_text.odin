package world

import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"

TEXT_GLYPH_RENDER_MAX :: 4096

Text_Glyph :: struct {
	pos:   [2]f32,
	uv:    [4]f32,
	color: [4]f32,
}

Text_Pipe :: struct {
	pip:        sg.Pipeline,
	bind:       sg.Bindings,
	atlas_size: [2]f32,
}

@(private = "file")
TEXT_VERTICES := [?][2]f32{{0, 0}, {0, 1}, {1, 0}, {1, 1}}

@(private = "file")
TEXT_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

sys_text :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	if w.text_glyph.count < 1 {
		return
	}

	pipe := w.text_pipe
	vs_params := Text_Vs_Params {
		ortho      = ortho^,
		atlas_size = pipe.atlas_size,
	}

	sg.update_buffer(
		pipe.bind.vertex_buffers[1],
		{ptr = raw_data(w.text_glyph.components[:]), size = c.size_t(w.text_glyph.count * size_of(Text_Glyph))},
	)

	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_text_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, len(TEXT_INDICES), w.text_glyph.count)
}

text_init :: proc(tex0: sg.Image) -> ^Text_Pipe {
	pipe := new(Text_Pipe)
	tex0_desc := sg.query_image_desc(tex0)
	pipe.atlas_size = {f32(tex0_desc.width), f32(tex0_desc.height)}
	pipe.bind.samplers[SMP_text_smp] = sg.make_sampler({})
	pipe.bind.views[VIEW_text_tex0] = sg.make_view({texture = {image = tex0}})

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data  = {ptr = &TEXT_VERTICES, size = size_of(TEXT_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{usage = {index_buffer = true, immutable = true}, data = {ptr = &TEXT_INDICES, size = size_of(TEXT_INDICES)}},
	)
	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{usage = {vertex_buffer = true, stream_update = true}, size = TEXT_GLYPH_RENDER_MAX * size_of(Text_Glyph)},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(text_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .NONE,
		depth = {compare = .LESS_EQUAL, write_enabled = true},
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_text_text_position   = {format = .FLOAT2, buffer_index = 0},
				ATTR_text_text_inst_pos   = {format = .FLOAT2, buffer_index = 1},
				ATTR_text_text_inst_uv    = {format = .FLOAT4, buffer_index = 1},
				ATTR_text_text_inst_color = {format = .FLOAT4, buffer_index = 1},
			},
		},
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

text_cleanup :: proc(pipe: ^Text_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_text_smp])
	sg.destroy_view(pipe.bind.views[VIEW_text_tex0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[1])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}
