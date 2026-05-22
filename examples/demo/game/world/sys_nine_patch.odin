package world

import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"

NINE_PATCH_RENDER_MAX :: 1024

Nine_Patch :: struct {
	bounds: [4]f32, // x,y = min position, z,w = max position in screen pixels
	slices: [4]f32, // left, top, right, bottom slice positions in source pixels
	size:   [2]f32, // source sprite size in pixels
	uv:     [4]f32,
}

Nine_Patch_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
}

Nine_Patch_Vertex :: struct {
	position: [2]f32,
}

@(private = "file")
NINE_PATCH_VERTICES := [?]Nine_Patch_Vertex {
	{{0, 3}},
	{{1, 3}},
	{{2, 3}},
	{{3, 3}},
	{{0, 2}},
	{{1, 2}},
	{{2, 2}},
	{{3, 2}},
	{{0, 1}},
	{{1, 1}},
	{{2, 1}},
	{{3, 1}},
	{{0, 0}},
	{{1, 0}},
	{{2, 0}},
	{{3, 0}},
}

@(private = "file")
NINE_PATCH_INDICES := [?]u16 {
	0,
	1,
	5,
	1,
	2,
	6,
	2,
	3,
	7,
	0,
	5,
	4,
	1,
	6,
	5,
	2,
	7,
	6,
	4,
	5,
	9,
	5,
	6,
	10,
	6,
	7,
	11,
	4,
	9,
	8,
	5,
	10,
	9,
	6,
	11,
	10,
	8,
	9,
	13,
	9,
	10,
	14,
	10,
	11,
	15,
	8,
	13,
	12,
	9,
	14,
	13,
	10,
	15,
	14,
}

sys_nine_patch :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	if w.nine_patch.count < 1 {
		return
	}

	pipe := w.nine_patch_pipe
	vs_params := Nine_Patch_Vs_Params {
		ortho = ortho^,
	}

	sg.update_buffer(
		pipe.bind.vertex_buffers[1],
		{ptr = raw_data(w.nine_patch.components[:]), size = c.size_t(w.nine_patch.count * size_of(Nine_Patch))},
	)

	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_nine_patch_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, len(NINE_PATCH_INDICES), w.nine_patch.count)
}

nine_patch_init :: proc(tex0: sg.Image) -> ^Nine_Patch_Pipe {
	pipe := new(Nine_Patch_Pipe)

	pipe.bind.samplers[SMP_nine_patch_smp] = sg.make_sampler({})
	pipe.bind.views[VIEW_nine_patch_tex0] = sg.make_view({texture = {image = tex0}})

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &NINE_PATCH_VERTICES, size = size_of(NINE_PATCH_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &NINE_PATCH_INDICES, size = size_of(NINE_PATCH_INDICES)},
		},
	)
	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{usage = {vertex_buffer = true, stream_update = true}, size = NINE_PATCH_RENDER_MAX * size_of(Nine_Patch)},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(nine_patch_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .BACK,
		depth = {compare = .LESS_EQUAL, write_enabled = true},
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_nine_patch_nine_patch_position = {format = .FLOAT2, buffer_index = 0},
				ATTR_nine_patch_nine_patch_inst_bounds = {format = .FLOAT4, buffer_index = 1},
				ATTR_nine_patch_nine_patch_inst_slices = {format = .FLOAT4, buffer_index = 1},
				ATTR_nine_patch_nine_patch_inst_size = {format = .FLOAT2, buffer_index = 1},
				ATTR_nine_patch_nine_patch_inst_uv = {format = .FLOAT4, buffer_index = 1},
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

nine_patch_cleanup :: proc(pipe: ^Nine_Patch_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_nine_patch_smp])
	sg.destroy_view(pipe.bind.views[VIEW_nine_patch_tex0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[1])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}
