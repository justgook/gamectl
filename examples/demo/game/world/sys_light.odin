package world

import sg "../sokol/gfx"
// import "core:c"
import "core:math/linalg"
import "logic"

sys_light :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	view: logic.View2(Position, Light) = logic.view(&w.position, &w.light)
	for id, pos, s in logic.each(&view) {
		s.pos = to_pixelf(pos^)
	}

	light_draw(w.light_pipe, w.light.count, &w.light.components, ortho)
}


@(private = "file")
light_draw :: proc(pipe: ^Light_Pipe, count: int, lights: ^[LIGHT_RENDER_MAX]Light, ortho: ^linalg.Matrix4f32) {
	if count < 1 {
		return
	}

	// vs_params := Light_Vs_Params {
	// 	ortho = ortho^,
	// 	// atlas_size = pipe.atlas_size,
	// }
	//
	// // update instance data
	// sg.update_buffer(pipe.bind.vertex_buffers[1], {ptr = lights, size = c.size_t(count * size_of(Light))})
	//
	// sg.apply_pipeline(pipe.pip)
	// sg.apply_bindings(pipe.bind)
	// sg.apply_uniforms(UB_light_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	// sg.draw(0, 6, count)
}


LIGHT_RENDER_MAX :: 256

@(private = "file")
BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

Light :: struct {
	pos:       [2]f32,
	z:         f32,
	opacity:   f32,
	flip:      u8,
	uv:        [4]f32,
	color_add: [4]f32, // RGB + intensity for blink/flash effects
	offset:    [2]i32, // TODO implement in shader
}

Light_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
	// atlas_size: [2]f32,
}

light_cleanup :: proc(pipe: ^Light_Pipe) {
	// sg.destroy_pipeline(pipe.pip)
	// sg.destroy_sampler(pipe.bind.samplers[SMP_light_default_sampler])
	// sg.destroy_view(pipe.bind.views[VIEW_light_tex0])
	// sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	// sg.destroy_buffer(pipe.bind.vertex_buffers[1])
	// sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}

light_init :: proc(tex0: sg.Image) -> ^Light_Pipe {
	pipe := new(Light_Pipe)
	tex0_desc := sg.query_image_desc(tex0)
	// pipe.atlas_size = {f32(tex0_desc.width), f32(tex0_desc.height)}
	// pipe.bind.samplers[SMP_light_default_sampler] = sg.make_sampler({})
	// pipe.bind.views[VIEW_light_tex0] = sg.make_view({texture = {image = tex0}})
	//
	// pipe.bind.vertex_buffers[0] = sg.make_buffer(
	// 	{
	// 		usage = sg.Buffer_Usage{vertex_buffer = true, immutable = true},
	// 		data = {ptr = &BASE_VERTICES, size = size_of(BASE_VERTICES)},
	// 	},
	// )
	//
	// pipe.bind.index_buffer = sg.make_buffer(
	// 	{
	// 		usage = sg.Buffer_Usage{index_buffer = true, immutable = true},
	// 		data = {ptr = &BASE_INDICES, size = size_of(BASE_INDICES)},
	// 	},
	// )
	//
	// pipe.bind.vertex_buffers[1] = sg.make_buffer(
	// 	{
	// 		usage = sg.Buffer_Usage{vertex_buffer = true, stream_update = true},
	// 		size = LIGHT_RENDER_MAX * size_of(light),
	// 	},
	// )
	//
	// pipeline_desc: sg.Pipeline_Desc = {
	// 	shader = sg.make_shader(light_shader_desc(sg.query_backend())),
	// 	cull_mode = .BACK,
	// 	depth = {compare = .LESS_EQUAL, write_enabled = true},
	// 	index_type = .UINT16,
	// 	layout = {
	// 		buffers = {1 = {step_func = .PER_INSTANCE}},
	// 		attrs = {
	// 			ATTR_light_light_pos = {format = .FLOAT2, buffer_index = 0},
	// 			ATTR_light_light_inst_pos = {format = .FLOAT2, buffer_index = 1},
	// 			ATTR_light_light_inst_z = {format = .FLOAT, buffer_index = 1},
	// 			ATTR_light_light_inst_opacity = {format = .FLOAT, buffer_index = 1},
	// 			ATTR_light_light_inst_flip_flags = {format = .UBYTE4, buffer_index = 1},
	// 			ATTR_light_light_inst_uv = {format = .FLOAT4, buffer_index = 1},
	// 			ATTR_light_light_inst_color_add = {format = .FLOAT4, buffer_index = 1},
	// 			ATTR_light_light_inst_offset = {format = .INT2, buffer_index = 1},
	// 		},
	// 	},
	// }

	// blend_state: sg.Blend_State = {
	// 	enabled          = true,
	// 	src_factor_rgb   = .SRC_ALPHA,
	// 	dst_factor_rgb   = .ONE_MINUS_SRC_ALPHA,
	// 	op_rgb           = .ADD,
	// 	src_factor_alpha = .ONE,
	// 	dst_factor_alpha = .ONE_MINUS_SRC_ALPHA,
	// 	op_alpha         = .ADD,
	// }
	//
	// pipeline_desc.colors[0] = {
	// 	blend = blend_state,
	// }

	// pipe.pip = sg.make_pipeline(pipeline_desc)

	return pipe
}
